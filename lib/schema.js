/**
 * AgentGuard Billing - Database Schema
 * Subscription management data models
 */

// Pricing tiers configuration
const PRICING_TIERS = {
  FREE: {
    id: 'free',
    name: 'Open Source',
    price: 0,
    interval: 'month',
    features: {
      maxScansPerMonth: 10,
      maxTeamMembers: 1,
      advancedRules: false,
      customRules: false,
      reports: false,
      apiAccess: false,
      prioritySupport: false,
      sso: false,
      onPremise: false
    }
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
    price: 29,
    interval: 'month',
    features: {
      maxScansPerMonth: 100,
      maxTeamMembers: 1,
      advancedRules: true,
      customRules: false,
      reports: true,
      apiAccess: true,
      prioritySupport: false,
      sso: false,
      onPremise: false
    }
  },
  TEAM: {
    id: 'team',
    name: 'Team',
    stripePriceId: process.env.STRIPE_PRICE_TEAM || 'price_team_monthly',
    price: 99,
    interval: 'month',
    features: {
      maxScansPerMonth: 500,
      maxTeamMembers: 10,
      advancedRules: true,
      customRules: false,
      reports: true,
      apiAccess: true,
      prioritySupport: true,
      sso: false,
      onPremise: false
    }
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_monthly',
    price: 299,
    interval: 'month',
    features: {
      maxScansPerMonth: -1, // Unlimited
      maxTeamMembers: -1, // Unlimited
      advancedRules: true,
      customRules: true,
      reports: true,
      apiAccess: true,
      prioritySupport: true,
      sso: true,
      onPremise: true
    }
  }
};

// Subscription status enum
const SUBSCRIPTION_STATUS = {
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  UNPAID: 'unpaid',
  PAUSED: 'paused'
};

// User subscription schema
class SubscriptionSchema {
  constructor() {
    this.required = [
      'id',
      'userId',
      'tier',
      'status',
      'createdAt',
      'updatedAt'
    ];
  }

  // Create a new subscription record
  static create(userId, tier = 'FREE', stripeData = null) {
    const now = new Date().toISOString();
    return {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      tier,
      status: tier === 'FREE' ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.INCOMPLETE,
      stripeCustomerId: stripeData?.customerId || null,
      stripeSubscriptionId: stripeData?.subscriptionId || null,
      stripePriceId: PRICING_TIERS[tier]?.stripePriceId || null,
      currentPeriodStart: now,
      currentPeriodEnd: tier === 'FREE' ? null : this.calculatePeriodEnd(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
      metadata: {}
    };
  }

  // Calculate period end (30 days from now)
  static calculatePeriodEnd() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString();
  }

  // Validate subscription data
  static validate(data) {
    const errors = [];
    
    if (!data.userId) errors.push('userId is required');
    if (!data.tier) errors.push('tier is required');
    if (!PRICING_TIERS[data.tier]) errors.push(`Invalid tier: ${data.tier}`);
    if (!data.status) errors.push('status is required');
    if (!Object.values(SUBSCRIPTION_STATUS).includes(data.status)) {
      errors.push(`Invalid status: ${data.status}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Team/Organization schema (for Team and Enterprise tiers)
class TeamSchema {
  static create(ownerId, name) {
    const now = new Date().toISOString();
    return {
      id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      ownerId,
      members: [{
        userId: ownerId,
        role: 'owner',
        joinedAt: now
      }],
      subscriptionId: null,
      createdAt: now,
      updatedAt: now
    };
  }
}

// Usage tracking schema
class UsageSchema {
  static create(userId, teamId = null) {
    const now = new Date().toISOString();
    return {
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      teamId,
      month: new Date().toISOString().slice(0, 7), // YYYY-MM
      scansCount: 0,
      apiCalls: 0,
      reportsGenerated: 0,
      createdAt: now,
      updatedAt: now
    };
  }
}

module.exports = {
  PRICING_TIERS,
  SUBSCRIPTION_STATUS,
  SubscriptionSchema,
  TeamSchema,
  UsageSchema
};