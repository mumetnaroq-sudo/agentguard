/**
 * AgentGuard API - Stripe Webhooks
 * Handles Stripe payment events
 */

const { StripeService } = require('../lib/stripe');
const { getDatabase } = require('../lib/db');

const stripeService = new StripeService();
const db = getDatabase();

module.exports = async (req, res) => {
  // Disable CORS for webhooks (Stripe requires this)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    const body = await getRawBody(req);
    event = stripeService.constructWebhookEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log(`Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'invoice.created':
        // Log but don't need to handle
        console.log('Invoice created:', event.data.object.id);
        break;

      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object.id);
        break;

      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// Handle checkout.session.completed
async function handleCheckoutCompleted(session) {
  console.log('Processing checkout completion:', session.id);
  
  try {
    const subscription = await stripeService.handleCheckoutCompleted(session);
    console.log('Subscription activated:', subscription?.id);
  } catch (error) {
    console.error('Error handling checkout completion:', error);
    throw error;
  }
}

// Handle invoice.paid
async function handleInvoicePaid(invoice) {
  console.log('Processing invoice payment:', invoice.id);
  
  try {
    const subscription = await stripeService.handleInvoicePaid(invoice);
    console.log('Invoice paid for subscription:', subscription?.id);
  } catch (error) {
    console.error('Error handling invoice payment:', error);
    throw error;
  }
}

// Handle invoice.payment_failed
async function handleInvoicePaymentFailed(invoice) {
  console.log('Processing payment failure:', invoice.id);
  
  try {
    const subscription = await stripeService.handleInvoicePaymentFailed(invoice);
    
    if (subscription) {
      // Notify user about payment failure
      console.log('Payment failed for subscription:', subscription.id);
      
      // TODO: Send email notification
      // await sendPaymentFailedEmail(subscription.userId, invoice);
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
    throw error;
  }
}

// Handle customer.subscription.updated
async function handleSubscriptionUpdated(subscription) {
  console.log('Processing subscription update:', subscription.id);
  
  try {
    const localSub = await stripeService.handleSubscriptionUpdated(subscription);
    console.log('Subscription updated:', localSub?.id);
  } catch (error) {
    console.error('Error handling subscription update:', error);
    throw error;
  }
}

// Handle customer.subscription.deleted
async function handleSubscriptionDeleted(subscription) {
  console.log('Processing subscription deletion:', subscription.id);
  
  try {
    const localSub = await stripeService.handleSubscriptionDeleted(subscription);
    console.log('Subscription cancelled:', localSub?.id);
    
    // TODO: Send cancellation email
    // await sendCancellationEmail(localSub.userId);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
    throw error;
  }
}

// Handle customer.subscription.created
async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created in Stripe:', subscription.id);
  // Usually handled by checkout.session.completed, but log for tracking
}

// Helper to get raw body for webhook verification
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}