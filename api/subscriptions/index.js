/**
 * AgentGuard API - Subscription Routes
 * Handles subscription management and checkout
 */

const { StripeService } = require('../lib/stripe');
const { PRICING_TIERS, SubscriptionSchema } = require('../lib/schema');
const { getDatabase } = require('../lib/db');

const stripeService = new StripeService();
const db = getDatabase();

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // GET /api/subscriptions/pricing - Get pricing tiers
    if (path === '/api/subscriptions/pricing' && req.method === 'GET') {
      return getPricing(req, res);
    }

    // GET /api/subscriptions - Get user's subscription
    if (path === '/api/subscriptions' && req.method === 'GET') {
      return getSubscription(req, res);
    }

    // POST /api/subscriptions/checkout - Create checkout session
    if (path === '/api/subscriptions/checkout' && req.method === 'POST') {
      return createCheckout(req, res);
    }

    // POST /api/subscriptions/cancel - Cancel subscription
    if (path === '/api/subscriptions/cancel' && req.method === 'POST') {
      return cancelSubscription(req, res);
    }

    // POST /api/subscriptions/reactivate - Reactivate subscription
    if (path === '/api/subscriptions/reactivate' && req.method === 'POST') {
      return reactivateSubscription(req, res);
    }

    // POST /api/subscriptions/change-tier - Change subscription tier
    if (path === '/api/subscriptions/change-tier' && req.method === 'POST') {
      return changeTier(req, res);
    }

    // POST /api/subscriptions/portal - Create customer portal session
    if (path === '/api/subscriptions/portal' && req.method === 'POST') {
      return createPortalSession(req, res);
    }

    // GET /api/subscriptions/usage - Get usage stats
    if (path === '/api/subscriptions/usage' && req.method === 'GET') {
      return getUsage(req, res);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Get pricing tiers
async function getPricing(req, res) {
  const tiers = Object.values(PRICING_TIERS).map(tier => ({
    id: tier.id,
    name: tier.name,
    price: tier.price,
    interval: tier.interval,
    features: tier.features
  }));

  return res.status(200).json({ tiers });
}

// Get user's subscription
async function getSubscription(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let subscription = db.getSubscriptionByUserId(userId);
  
  // Create free subscription if none exists
  if (!subscription) {
    subscription = SubscriptionSchema.create(userId, 'FREE');
    db.createSubscription(subscription);
  }

  const tier = PRICING_TIERS[subscription.tier];

  return res.status(200).json({
    subscription: {
      ...subscription,
      tierDetails: {
        name: tier.name,
        price: tier.price,
        features: tier.features
      }
    }
  });
}

// Create checkout session
async function createCheckout(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const body = await parseBody(req);
  const { tier, successUrl, cancelUrl } = body;

  if (!tier || !successUrl || !cancelUrl) {
    return res.status(400).json({
      error: 'Missing required fields: tier, successUrl, cancelUrl'
    });
  }

  if (!PRICING_TIERS[tier] || tier === 'FREE') {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  try {
    const session = await stripeService.createCheckoutSession(
      userId,
      tier,
      successUrl,
      cancelUrl
    );

    return res.status(200).json({
      sessionId: session.sessionId,
      url: session.url
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
}

// Cancel subscription
async function cancelSubscription(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const subscription = db.getSubscriptionByUserId(userId);
  if (!subscription || subscription.tier === 'FREE') {
    return res.status(400).json({ error: 'No active paid subscription' });
  }

  if (!subscription.stripeSubscriptionId) {
    return res.status(400).json({ error: 'No Stripe subscription found' });
  }

  const body = await parseBody(req);
  const { immediately = false } = body;

  try {
    await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    return res.status(200).json({
      message: immediately
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at the end of the billing period',
      cancelAtPeriodEnd: !immediately
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to cancel subscription',
      message: error.message
    });
  }
}

// Reactivate subscription
async function reactivateSubscription(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const subscription = db.getSubscriptionByUserId(userId);
  if (!subscription || !subscription.stripeSubscriptionId) {
    return res.status(400).json({ error: 'No active subscription found' });
  }

  try {
    await stripeService.reactivateSubscription(subscription.stripeSubscriptionId);

    return res.status(200).json({
      message: 'Subscription reactivated successfully'
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to reactivate subscription',
      message: error.message
    });
  }
}

// Change subscription tier
async function changeTier(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const body = await parseBody(req);
  const { tier: newTier } = body;

  if (!newTier || !PRICING_TIERS[newTier] || newTier === 'FREE') {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const subscription = db.getSubscriptionByUserId(userId);
  if (!subscription || !subscription.stripeSubscriptionId) {
    return res.status(400).json({
      error: 'No active paid subscription',
      message: 'Subscribe to a paid plan first'
    });
  }

  try {
    await stripeService.changeTier(subscription.stripeSubscriptionId, newTier);

    return res.status(200).json({
      message: 'Subscription tier changed successfully',
      newTier
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to change tier',
      message: error.message
    });
  }
}

// Create customer portal session
async function createPortalSession(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const subscription = db.getSubscriptionByUserId(userId);
  if (!subscription?.stripeCustomerId) {
    return res.status(400).json({ error: 'No billing account found' });
  }

  const body = await parseBody(req);
  const { returnUrl } = body;

  try {
    const session = await stripeService.createPortalSession(
      subscription.stripeCustomerId,
      returnUrl || `${process.env.APP_URL}/billing`
    );

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to create portal session',
      message: error.message
    });
  }
}

// Get usage stats
async function getUsage(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const month = new Date().toISOString().slice(0, 7);
  const usage = db.getOrCreateMonthlyUsage(userId);
  const subscription = db.getSubscriptionByUserId(userId) || { tier: 'FREE' };
  const tier = PRICING_TIERS[subscription.tier];

  return res.status(200).json({
    month,
    usage: {
      scans: {
        used: usage.scansCount,
        limit: tier.features.maxScansPerMonth,
        remaining: tier.features.maxScansPerMonth === -1
          ? -1
          : Math.max(0, tier.features.maxScansPerMonth - usage.scansCount)
      },
      apiCalls: {
        used: usage.apiCalls,
        limit: tier.features.apiAccess ? 'unlimited' : 0,
        remaining: tier.features.apiAccess ? -1 : 0
      },
      reports: {
        used: usage.reportsGenerated,
        limit: tier.features.reports ? 'unlimited' : 0,
        remaining: tier.features.reports ? -1 : 0
      }
    }
  });
}

// Helper functions
function getUserId(req) {
  // In production, this should validate JWT or session
  return req.headers['x-user-id'] || req.user?.id;
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}