/**
 * AgentGuard Billing - Feature Gating Middleware
 * Controls access to features based on subscription tier
 */

const { PRICING_TIERS } = require('../lib/schema');
const { getDatabase } = require('../lib/db');

class FeatureGate {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Get user's effective tier
   */
  getUserTier(userId) {
    const subscription = this.db.getSubscriptionByUserId(userId);
    return subscription?.tier || 'FREE';
  }

  /**
   * Get features available for a tier
   */
  getFeatures(tier) {
    return PRICING_TIERS[tier]?.features || PRICING_TIERS.FREE.features;
  }

  /**
   * Check if a feature is available for user
   */
  hasFeature(userId, feature) {
    const tier = this.getUserTier(userId);
    const features = this.getFeatures(tier);
    return features[feature] === true || features[feature] > 0 || features[feature] === -1;
  }

  /**
   * Check if user can perform action (with limit)
   */
  canPerform(userId, action, currentCount) {
    const tier = this.getUserTier(userId);
    const features = this.getFeatures(tier);
    const limit = features[action];

    if (limit === -1) return true; // Unlimited
    if (limit === undefined) return false; // Feature not available
    return currentCount < limit;
  }

  /**
   * Get remaining quota for an action
   */
  getRemainingQuota(userId, action, currentCount) {
    const tier = this.getUserTier(userId);
    const features = this.getFeatures(tier);
    const limit = features[action];

    if (limit === -1) return -1; // Unlimited
    if (limit === undefined || limit === false) return 0;
    return Math.max(0, limit - currentCount);
  }

  /**
   * Express middleware to check feature access
   */
  middleware(feature) {
    return (req, res, next) => {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!this.hasFeature(userId, feature)) {
        const tier = this.getUserTier(userId);
        return res.status(403).json({
          error: 'Feature not available on your plan',
          code: 'FEATURE_NOT_AVAILABLE',
          feature,
          currentTier: tier,
          upgradeUrl: '/billing/upgrade'
        });
      }

      next();
    };
  }

  /**
   * Express middleware to check action limits
   */
  limitMiddleware(action, getCurrentCount) {
    return async (req, res, next) => {
      const userId = req.user?.id || req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const currentCount = await getCurrentCount(userId);
      
      if (!this.canPerform(userId, action, currentCount)) {
        const tier = this.getUserTier(userId);
        const features = this.getFeatures(tier);
        const limit = features[action];

        return res.status(429).json({
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED',
          action,
          limit,
          current: currentCount,
          remaining: 0,
          upgradeUrl: '/billing/upgrade'
        });
      }

      // Add quota info to request
      req.quota = {
        action,
        limit: this.getFeatures(this.getUserTier(userId))[action],
        current: currentCount,
        remaining: this.getRemainingQuota(userId, action, currentCount)
      };

      next();
    };
  }

  /**
   * Track usage and check limits
   */
  async trackAndCheck(userId, action, increment = 1) {
    const usage = this.db.getOrCreateMonthlyUsage(userId);
    const metricMap = {
      'scan': 'scansCount',
      'apiCall': 'apiCalls',
      'report': 'reportsGenerated'
    };

    const metric = metricMap[action];
    if (!metric) return { allowed: true };

    const currentCount = usage[metric] || 0;
    
    if (!this.canPerform(userId, `max${action.charAt(0).toUpperCase() + action.slice(1)}sPerMonth`, currentCount)) {
      return {
        allowed: false,
        error: 'Quota exceeded',
        tier: this.getUserTier(userId),
        current: currentCount,
        limit: this.getFeatures(this.getUserTier(userId))[`max${action.charAt(0).toUpperCase() + action.slice(1)}sPerMonth`]
      };
    }

    // Increment usage
    this.db.incrementUsage(userId, metric, increment);

    return {
      allowed: true,
      current: currentCount + increment,
      remaining: this.getRemainingQuota(userId, `max${action.charAt(0).toUpperCase() + action.slice(1)}sPerMonth`, currentCount + increment)
    };
  }
}

// Feature definitions for reference
const FEATURES = {
  // Scanning
  SCAN: 'maxScansPerMonth',
  ADVANCED_RULES: 'advancedRules',
  CUSTOM_RULES: 'customRules',
  
  // Reporting
  REPORTS: 'reports',
  
  // API
  API_ACCESS: 'apiAccess',
  
  // Team
  TEAM_MEMBERS: 'maxTeamMembers',
  
  // Support
  PRIORITY_SUPPORT: 'prioritySupport',
  
  // Enterprise
  SSO: 'sso',
  ON_PREMISE: 'onPremise'
};

module.exports = { FeatureGate, FEATURES };