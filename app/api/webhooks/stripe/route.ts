/**
 * AgentGuard API - Stripe Webhooks
 * Next.js App Router implementation with Prisma
 * Handles Stripe payment events
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Subscription status mapping from Stripe to our database
const statusMap: Record<string, string> = {
  active: 'active',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  past_due: 'past_due',
  paused: 'paused',
  trialing: 'trialing',
  unpaid: 'unpaid',
};

// Tier mapping from price IDs to tier names
const getTierFromPriceId = (priceId: string): string => {
  const priceTierMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_PRO || '']: 'pro',
    [process.env.STRIPE_PRICE_TEAM || '']: 'team',
    [process.env.STRIPE_PRICE_ENTERPRISE || '']: 'enterprise',
  };
  return priceTierMap[priceId] || 'free';
};

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
      { error: 'Invalid signature', message: err.message },
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
 * Creates or activates the subscription after successful checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log('Processing checkout completion:', session.id);

  const { userId, subscriptionId, tier } = session.metadata || {};

  if (!userId) {
    console.error('Missing userId in checkout session metadata:', session.id);
    throw new Error('Missing required metadata: userId');
  }

  const stripeSubscriptionId = session.subscription as string;
  if (!stripeSubscriptionId) {
    console.error('No subscription ID in checkout session:', session.id);
    throw new Error('No subscription ID in checkout session');
  }

  // Retrieve the subscription from Stripe to get full details
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price.id;
  const subscriptionTier = tier || getTierFromPriceId(priceId);

  // Check if subscription already exists
  let subscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: stripeSubscriptionId },
        { id: subscriptionId || 'never-match' },
      ],
    },
  });

  if (subscription) {
    // Update existing subscription
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: statusMap[stripeSubscription.status] || stripeSubscription.status,
        stripeSubscriptionId: stripeSubscriptionId,
        stripePriceId: priceId,
        stripeCustomerId: stripeSubscription.customer as string,
        tier: subscriptionTier,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });
    console.log('Subscription updated after checkout:', subscription.id);
  } else {
    // Create new subscription
    subscription = await prisma.subscription.create({
      data: {
        userId,
        stripeSubscriptionId: stripeSubscriptionId,
        stripePriceId: priceId,
        stripeCustomerId: stripeSubscription.customer as string,
        tier: subscriptionTier,
        status: statusMap[stripeSubscription.status] || stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });
    console.log('New subscription created after checkout:', subscription.id);
  }

  // Update user tier if necessary
  await prisma.user.update({
    where: { id: userId },
    data: { 
      // Note: Add tier field to User model if needed
      // For now, we just log this
    },
  });
}

/**
 * Handle customer.subscription.updated event
 * Updates local subscription status when Stripe subscription changes
 */
async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
  console.log('Processing subscription update:', stripeSubscription.id);

  // Find the subscription by Stripe subscription ID
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.log('Local subscription not found for Stripe subscription:', stripeSubscription.id);
    return;
  }

  const priceId = stripeSubscription.items.data[0]?.price.id;
  const newTier = priceId ? getTierFromPriceId(priceId) : subscription.tier;

  const updateData: any = {
    status: statusMap[stripeSubscription.status] || stripeSubscription.status,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
  };

  // Update tier if price changed
  if (priceId && priceId !== subscription.stripePriceId) {
    updateData.stripePriceId = priceId;
    updateData.tier = newTier;
  }

  // Set canceledAt if subscription is canceled
  if (stripeSubscription.canceled_at) {
    updateData.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: updateData,
  });

  console.log('Subscription updated:', subscription.id);
}

/**
 * Handle customer.subscription.deleted event
 * Marks subscription as canceled and downgrades user to free tier
 */
async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
  console.log('Processing subscription deletion:', stripeSubscription.id);

  // Find the subscription by Stripe subscription ID
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.log('Local subscription not found for Stripe subscription:', stripeSubscription.id);
    return;
  }

  // Update subscription as canceled
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'canceled',
      tier: 'free',
      canceledAt: new Date(),
      cancelAtPeriodEnd: false,
    },
  });

  // Create a new free subscription for the user if they don't have one
  const existingFreeSub = await prisma.subscription.findFirst({
    where: {
      userId: subscription.userId,
      tier: 'free',
      status: 'active',
    },
  });

  if (!existingFreeSub) {
    await prisma.subscription.create({
      data: {
        userId: subscription.userId,
        tier: 'free',
        status: 'active',
      },
    });
    console.log('Created free subscription for user after cancellation:', subscription.userId);
  }

  console.log('Subscription cancelled and user downgraded to free:', subscription.id);
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

  // Retrieve the subscription from Stripe to get latest period dates
  const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

  // Find the subscription by Stripe subscription ID
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.log('Local subscription not found for Stripe subscription:', stripeSubscription.id);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: statusMap[stripeSubscription.status] || stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    },
  });

  console.log('Invoice paid processed for subscription:', subscription.id);
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

  // Find the subscription by Stripe subscription ID
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });

  if (!subscription) {
    console.log('Local subscription not found for Stripe subscription:', invoice.subscription);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'past_due',
    },
  });

  console.log('Payment failure processed for subscription:', subscription.id);
}
