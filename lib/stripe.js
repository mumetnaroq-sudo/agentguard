/**
 * AgentGuard Billing - Stripe Integration
 * Handles Stripe checkout, subscriptions, and billing
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PRICING_TIERS, SubscriptionSchema, SUBSCRIPTION_STATUS } = require('./schema');
const { getDatabase } = require('./db');

class StripeService {
  constructor() {
    this.db = getDatabase();
    this.stripe = stripe;
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(userId, email, name) {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        userId
      }
    });

    // Update user with Stripe customer ID
    this.db.updateUser(userId, {
      stripeCustomerId: customer.id
    });

    return customer;
  }

  /**
   * Get or create Stripe customer for user
   */
  async getOrCreateCustomer(userId, email, name) {
    const user = this.db.getUserById(userId);
    
    if (user?.stripeCustomerId) {
      try {
        return await this.stripe.customers.retrieve(user.stripeCustomerId);
      } catch (err) {
        // Customer not found, create new
      }
    }

    return this.createCustomer(userId, email, name);
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(userId, tierId, successUrl, cancelUrl) {
    const tier = PRICING_TIERS[tierId];
    if (!tier || tier.price === 0) {
      throw new Error(`Invalid tier or free tier: ${tierId}`);
    }

    const user = this.db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const customer = await this.getOrCreateCustomer(userId, user.email, user.name);

    // Create pending subscription record
    const subscription = SubscriptionSchema.create(userId, tierId, {
      customerId: customer.id
    });
    this.db.createSubscription(subscription);

    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: tier.stripePriceId,
        quantity: 1
      }],
      mode: 'subscription',
      subscription_data: {
        metadata: {
          userId,
          subscriptionId: subscription.id,
          tier: tierId
        }
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        subscriptionId: subscription.id,
        tier: tierId
      }
    });

    return {
      sessionId: session.id,
      url: session.url,
      subscriptionId: subscription.id
    };
  }

  /**
   * Create a customer portal session
   */
  async createPortalSession(customerId, returnUrl) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    return {
      url: session.url
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(stripeSubscriptionId, cancelImmediately = false) {
    if (cancelImmediately) {
      const subscription = await this.stripe.subscriptions.cancel(stripeSubscriptionId);
      return subscription;
    } else {
      // Cancel at period end
      const subscription = await this.stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true
      });
      
      // Update local subscription record
      const localSub = this.db.getSubscriptions({ stripeSubscriptionId })[0];
      if (localSub) {
        this.db.updateSubscription(localSub.id, {
          cancelAtPeriodEnd: true
        });
      }
      
      return subscription;
    }
  }

  /**
   * Reactivate a subscription that was set to cancel
   */
  async reactivateSubscription(stripeSubscriptionId) {
    const subscription = await this.stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update local subscription record
    const localSub = this.db.getSubscriptions({ stripeSubscriptionId })[0];
    if (localSub) {
      this.db.updateSubscription(localSub.id, {
        cancelAtPeriodEnd: false
      });
    }

    return subscription;
  }

  /**
   * Change subscription tier
   */
  async changeTier(stripeSubscriptionId, newTierId) {
    const tier = PRICING_TIERS[newTierId];
    if (!tier || tier.price === 0) {
      throw new Error('Cannot change to free tier via this method');
    }

    const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    
    const updatedSubscription = await this.stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: tier.stripePriceId
      }],
      metadata: {
        ...subscription.metadata,
        tier: newTierId
      }
    });

    // Update local subscription
    const localSub = this.db.getSubscriptions({ stripeSubscriptionId })[0];
    if (localSub) {
      this.db.updateSubscription(localSub.id, {
        tier: newTierId,
        stripePriceId: tier.stripePriceId
      });
    }

    return updatedSubscription;
  }

  /**
   * Get subscription details from Stripe
   */
  async getSubscription(stripeSubscriptionId) {
    return this.stripe.subscriptions.retrieve(stripeSubscriptionId);
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(payload, signature, secret) {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Handle checkout.session.completed webhook
   */
  async handleCheckoutCompleted(session) {
    const { userId, subscriptionId, tier } = session.metadata;
    const stripeSubscriptionId = session.subscription;

    // Update subscription record
    const subscription = this.db.updateSubscription(subscriptionId, {
      status: SUBSCRIPTION_STATUS.ACTIVE,
      stripeSubscriptionId,
      stripePriceId: session.line_items?.data[0]?.price?.id || PRICING_TIERS[tier].stripePriceId,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Update user with subscription info
    this.db.updateUser(userId, {
      subscriptionId,
      tier
    });

    return subscription;
  }

  /**
   * Handle invoice.paid webhook
   */
  async handleInvoicePaid(invoice) {
    const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
    const localSub = this.db.getSubscriptions({ stripeSubscriptionId: subscription.id })[0];
    
    if (localSub) {
      this.db.updateSubscription(localSub.id, {
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
      });
    }

    return localSub;
  }

  /**
   * Handle invoice.payment_failed webhook
   */
  async handleInvoicePaymentFailed(invoice) {
    const localSub = this.db.getSubscriptions({ stripeSubscriptionId: invoice.subscription })[0];
    
    if (localSub) {
      this.db.updateSubscription(localSub.id, {
        status: SUBSCRIPTION_STATUS.PAST_DUE
      });
    }

    return localSub;
  }

  /**
   * Handle customer.subscription.updated webhook
   */
  async handleSubscriptionUpdated(subscription) {
    const localSub = this.db.getSubscriptions({ stripeSubscriptionId: subscription.id })[0];
    
    if (localSub) {
      const statusMap = {
        'active': SUBSCRIPTION_STATUS.ACTIVE,
        'canceled': SUBSCRIPTION_STATUS.CANCELED,
        'incomplete': SUBSCRIPTION_STATUS.INCOMPLETE,
        'incomplete_expired': SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
        'past_due': SUBSCRIPTION_STATUS.PAST_DUE,
        'paused': SUBSCRIPTION_STATUS.PAUSED,
        'trialing': SUBSCRIPTION_STATUS.TRIALING,
        'unpaid': SUBSCRIPTION_STATUS.UNPAID
      };

      this.db.updateSubscription(localSub.id, {
        status: statusMap[subscription.status] || subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
      });
    }

    return localSub;
  }

  /**
   * Handle customer.subscription.deleted webhook
   */
  async handleSubscriptionDeleted(subscription) {
    const localSub = this.db.getSubscriptions({ stripeSubscriptionId: subscription.id })[0];
    
    if (localSub) {
      this.db.updateSubscription(localSub.id, {
        status: SUBSCRIPTION_STATUS.CANCELED,
        tier: 'FREE',
        canceledAt: new Date().toISOString()
      });

      // Downgrade user to free tier
      this.db.updateUser(localSub.userId, {
        tier: 'FREE',
        subscriptionId: null
      });
    }

    return localSub;
  }
}

module.exports = { StripeService };