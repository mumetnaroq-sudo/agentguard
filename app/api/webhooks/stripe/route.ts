/**
 * AgentGuard API - Stripe Webhooks
 * Next.js App Router implementation
 * Handles Stripe payment events
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
// Import from CommonJS modules
import dbModule from '../../../../lib/db.js';
import schemaModule from '../../../../lib/schema.js';

const { getDatabase } = dbModule;
const { SUBSCRIPTION_STATUS, PRICING_TIERS } = schemaModule;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST handler for Stripe webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify webhook secret is configured
  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Get the Stripe signature header
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    console.error('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  // Get raw body for signature verification
  const body = await request.text();

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log(`Webhook received: ${event.type}`);

  try {
    // Handle specific event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 * Activates the subscription after successful checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log('Processing checkout completion:', session.id);

  const db = getDatabase();
  const { userId, subscriptionId, tier } = session.metadata || {};

  if (!userId || !subscriptionId || !tier) {
    console.error('Missing metadata in checkout session:', session.id);
    throw new Error('Missing required metadata');
  }

  const stripeSubscriptionId = session.subscription as string;
  if (!stripeSubscriptionId) {
    console.error('No subscription ID in checkout session:', session.id);
    throw new Error('No subscription ID');
  }

  // Update subscription record
  const subscription = db.updateSubscription(subscriptionId, {
    status: SUBSCRIPTION_STATUS.ACTIVE,
    stripeSubscriptionId,
    stripePriceId: PRICING_TIERS[tier as keyof typeof PRICING_TIERS]?.stripePriceId || null,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (!subscription) {
    console.error('Subscription not found:', subscriptionId);
    throw new Error('Subscription not found');
  }

  // Update user with subscription info
  db.updateUser(userId, {
    subscriptionId,
    tier,
  });

  console.log('Subscription activated:', subscription.id);
}

/**
 * Handle customer.subscription.updated event
 * Updates local subscription status when Stripe subscription changes
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  console.log('Processing subscription update:', subscription.id);

  const db = getDatabase();
  const localSubs = db.getSubscriptions({ stripeSubscriptionId: subscription.id });
  const localSub = localSubs[0];

  if (!localSub) {
    console.log('Local subscription not found for Stripe subscription:', subscription.id);
    return;
  }

  // Map Stripe status to local status
  const statusMap: Record<string, string> = {
    active: SUBSCRIPTION_STATUS.ACTIVE,
    canceled: SUBSCRIPTION_STATUS.CANCELED,
    incomplete: SUBSCRIPTION_STATUS.INCOMPLETE,
    incomplete_expired: SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
    past_due: SUBSCRIPTION_STATUS.PAST_DUE,
    paused: SUBSCRIPTION_STATUS.PAUSED,
    trialing: SUBSCRIPTION_STATUS.TRIALING,
    unpaid: SUBSCRIPTION_STATUS.UNPAID,
  };

  const updates: any = {
    status: statusMap[subscription.status] || subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  };

  if (subscription.canceled_at) {
    updates.canceledAt = new Date(subscription.canceled_at * 1000).toISOString();
  }

  // Handle tier change if items changed
  if (subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    const tier = Object.entries(PRICING_TIERS).find(
      ([, tier]) => tier.stripePriceId === priceId
    );
    if (tier) {
      updates.tier = tier[0];
      updates.stripePriceId = priceId;
    }
  }

  db.updateSubscription(localSub.id, updates);
  console.log('Subscription updated:', localSub.id);
}

/**
 * Handle customer.subscription.deleted event
 * Marks subscription as canceled and downgrades user to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  console.log('Processing subscription deletion:', subscription.id);

  const db = getDatabase();
  const localSubs = db.getSubscriptions({ stripeSubscriptionId: subscription.id });
  const localSub = localSubs[0];

  if (!localSub) {
    console.log('Local subscription not found for Stripe subscription:', subscription.id);
    return;
  }

  // Update subscription as canceled
  db.updateSubscription(localSub.id, {
    status: SUBSCRIPTION_STATUS.CANCELED,
    tier: 'FREE',
    canceledAt: new Date().toISOString(),
  });

  // Downgrade user to free tier
  db.updateUser(localSub.userId, {
    tier: 'FREE',
    subscriptionId: null,
  });

  console.log('Subscription cancelled and user downgraded:', localSub.id);
}

/**
 * Handle invoice.paid event
 * Updates subscription period dates after successful payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  console.log('Processing invoice payment:', invoice.id);

  if (!invoice.subscription) {
    console.log('No subscription associated with invoice:', invoice.id);
    return;
  }

  const db = getDatabase();
  const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const localSubs = db.getSubscriptions({ stripeSubscriptionId: stripeSubscription.id });
  const localSub = localSubs[0];

  if (!localSub) {
    console.log('Local subscription not found for Stripe subscription:', stripeSubscription.id);
    return;
  }

  db.updateSubscription(localSub.id, {
    status: SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
  });

  console.log('Invoice paid processed for subscription:', localSub.id);
}

/**
 * Handle invoice.payment_failed event
 * Marks subscription as past_due
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log('Processing payment failure:', invoice.id);

  if (!invoice.subscription) {
    console.log('No subscription associated with invoice:', invoice.id);
    return;
  }

  const db = getDatabase();
  const localSubs = db.getSubscriptions({ stripeSubscriptionId: invoice.subscription as string });
  const localSub = localSubs[0];

  if (!localSub) {
    console.log('Local subscription not found for Stripe subscription:', invoice.subscription);
    return;
  }

  db.updateSubscription(localSub.id, {
    status: SUBSCRIPTION_STATUS.PAST_DUE,
  });

  console.log('Payment failure processed for subscription:', localSub.id);
}
