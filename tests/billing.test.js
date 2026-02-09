/**
 * AgentGuard Billing Tests
 * Tests for subscription management and Stripe integration
 */

const { SubscriptionSchema, TeamSchema, UsageSchema, PRICING_TIERS, SUBSCRIPTION_STATUS } = require('../lib/schema');
const { Database } = require('../lib/db');
const { FeatureGate, FEATURES } = require('../middleware/feature-gate');
const path = require('path');
const fs = require('fs');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '.test-data');

describe('AgentGuard Billing', () => {
  let db;
  let gate;

  beforeEach(() => {
    // Clean up test data
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { recursive: true });
    }
    
    // Set test database path BEFORE any database initialization
    process.env.DB_PATH = TEST_DB_PATH;
    
    // Reset the singleton to ensure clean state
    const dbModule = require('../lib/db');
    dbModule.getDatabase = () => {
      if (!dbModule.dbInstance) {
        dbModule.dbInstance = new Database();
      }
      return dbModule.dbInstance;
    };
    
    db = new Database();
    gate = new FeatureGate();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { recursive: true });
    }
  });

  describe('Schema', () => {
    test('SubscriptionSchema.create creates valid subscription', () => {
      const sub = SubscriptionSchema.create('user_123', 'PRO');
      
      expect(sub.userId).toBe('user_123');
      expect(sub.tier).toBe('PRO');
      expect(sub.status).toBe(SUBSCRIPTION_STATUS.INCOMPLETE);
      expect(sub.id).toMatch(/^sub_/);
      expect(sub.createdAt).toBeDefined();
    });

    test('SubscriptionSchema.create for FREE tier sets ACTIVE status', () => {
      const sub = SubscriptionSchema.create('user_123', 'FREE');
      expect(sub.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    });

    test('TeamSchema.create creates valid team', () => {
      const team = TeamSchema.create('user_123', 'My Team');
      
      expect(team.name).toBe('My Team');
      expect(team.ownerId).toBe('user_123');
      expect(team.members).toHaveLength(1);
      expect(team.members[0].role).toBe('owner');
    });

    test('UsageSchema.create creates valid usage record', () => {
      const usage = UsageSchema.create('user_123', 'team_456');
      
      expect(usage.userId).toBe('user_123');
      expect(usage.teamId).toBe('team_456');
      expect(usage.scansCount).toBe(0);
      expect(usage.month).toMatch(/^\d{4}-\d{2}$/);
    });

    test('PRICING_TIERS has all required tiers', () => {
      expect(PRICING_TIERS.FREE).toBeDefined();
      expect(PRICING_TIERS.PRO).toBeDefined();
      expect(PRICING_TIERS.TEAM).toBeDefined();
      expect(PRICING_TIERS.ENTERPRISE).toBeDefined();
    });

    test('PRO tier has correct pricing', () => {
      expect(PRICING_TIERS.PRO.price).toBe(29);
      expect(PRICING_TIERS.PRO.features.maxScansPerMonth).toBe(100);
      expect(PRICING_TIERS.PRO.features.advancedRules).toBe(true);
    });
  });

  describe('Database', () => {
    test('creates subscription', () => {
      const sub = SubscriptionSchema.create('user_123', 'PRO');
      const created = db.createSubscription(sub);
      
      expect(created.id).toBe(sub.id);
      
      const found = db.getSubscriptionById(sub.id);
      expect(found).toEqual(sub);
    });

    test('gets subscription by user ID', () => {
      const sub = SubscriptionSchema.create('user_123', 'PRO');
      const created = db.createSubscription(sub);
      
      const found = db.getSubscriptionByUserId('user_123');
      expect(found).toBeDefined();
      expect(found.userId).toBe('user_123');
      expect(found.tier).toBe('PRO');
    });

    test('updates subscription', () => {
      const sub = SubscriptionSchema.create('user_123', 'PRO');
      db.createSubscription(sub);
      
      const updated = db.updateSubscription(sub.id, { status: 'active' });
      expect(updated.status).toBe('active');
      expect(updated.updatedAt).toBeDefined();
    });

    test('tracks usage', () => {
      const usage = db.getOrCreateMonthlyUsage('user_123');
      expect(usage.scansCount).toBe(0);
      
      db.incrementUsage('user_123', 'scansCount', 5);
      
      const updated = db.getOrCreateMonthlyUsage('user_123');
      expect(updated.scansCount).toBe(5);
    });
  });

  describe('Feature Gate', () => {
    test('returns FREE tier for user without subscription', () => {
      const tier = gate.getUserTier('nonexistent_user');
      expect(tier).toBe('FREE');
    });

    test('checks feature availability', () => {
      // Create PRO subscription
      const sub = SubscriptionSchema.create('user_pro', 'PRO');
      db.createSubscription(sub);
      
      expect(gate.hasFeature('user_pro', 'advancedRules')).toBe(true);
      expect(gate.hasFeature('user_pro', 'customRules')).toBe(false);
    });

    test('checks scan limits', () => {
      // Create PRO subscription (100 scans)
      const sub = SubscriptionSchema.create('user_pro', 'PRO');
      db.createSubscription(sub);
      
      // No scans yet - should allow
      expect(gate.canPerform('user_pro', 'maxScansPerMonth', 0)).toBe(true);
      expect(gate.canPerform('user_pro', 'maxScansPerMonth', 99)).toBe(true);
      
      // At limit - should not allow
      expect(gate.canPerform('user_pro', 'maxScansPerMonth', 100)).toBe(false);
    });

    test('unlimited scans for ENTERPRISE', () => {
      const sub = SubscriptionSchema.create('user_ent', 'ENTERPRISE');
      db.createSubscription(sub);
      
      expect(gate.canPerform('user_ent', 'maxScansPerMonth', 999999)).toBe(true);
    });

    test('trackAndCheck allows within quota', async () => {
      const sub = SubscriptionSchema.create('user_pro', 'PRO');
      sub.status = 'active'; // Set to active
      db.createSubscription(sub);
      
      const result = await gate.trackAndCheck('user_pro', 'scan');
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
    });

    test('trackAndCheck denies when quota exceeded', async () => {
      const sub = SubscriptionSchema.create('user_pro', 'PRO');
      db.createSubscription(sub);
      
      // Use up all scans
      const usage = db.getOrCreateMonthlyUsage('user_pro');
      usage.scansCount = 100;
      db.write('usage', [usage]);
      
      const result = await gate.trackAndCheck('user_pro', 'scan');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Tier Features', () => {
    test('FREE tier has correct features', () => {
      const features = PRICING_TIERS.FREE.features;
      expect(features.maxScansPerMonth).toBe(10);
      expect(features.advancedRules).toBe(false);
      expect(features.reports).toBe(false);
    });

    test('TEAM tier has correct features', () => {
      const features = PRICING_TIERS.TEAM.features;
      expect(features.maxScansPerMonth).toBe(500);
      expect(features.maxTeamMembers).toBe(10);
      expect(features.prioritySupport).toBe(true);
    });

    test('ENTERPRISE tier has unlimited features', () => {
      const features = PRICING_TIERS.ENTERPRISE.features;
      expect(features.maxScansPerMonth).toBe(-1);
      expect(features.maxTeamMembers).toBe(-1);
      expect(features.customRules).toBe(true);
      expect(features.sso).toBe(true);
    });
  });
});