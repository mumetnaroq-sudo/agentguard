# AgentGuard Billing Integration - Setup Guide

## Overview

This document outlines the Stripe billing integration for AgentGuard's paid subscription tiers.

## Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 10 scans/mo, basic rules |
| **Pro** | $29/mo | 100 scans/mo, dashboard, advanced rules, reports, API access |
| **Team** | $99/mo | 500 scans/mo, 10 team members, priority support |
| **Enterprise** | $299/mo | Unlimited scans, unlimited team, custom rules, SSO, on-premise |

## Environment Variables

Create a `.env` file or configure these in Vercel:

```bash
# Stripe Keys (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (create these in Stripe Dashboard)
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# App URL
APP_URL=https://agentguard.vercel.app
```

## Stripe Setup

### 1. Create Stripe Account
- Sign up at [stripe.com](https://stripe.com)
- Get your API keys from the Dashboard

### 2. Create Products and Prices

In the Stripe Dashboard, create three products:

1. **AgentGuard Pro**
   - Recurring, Monthly
   - Price: $29.00
   - Copy the Price ID to `STRIPE_PRICE_PRO`

2. **AgentGuard Team**
   - Recurring, Monthly
   - Price: $99.00
   - Copy the Price ID to `STRIPE_PRICE_TEAM`

3. **AgentGuard Enterprise**
   - Recurring, Monthly
   - Price: $299.00
   - Copy the Price ID to `STRIPE_PRICE_ENTERPRISE`

### 3. Configure Webhook

In Stripe Dashboard → Developers → Webhooks:

1. Add endpoint: `https://agentguard.vercel.app/api/webhooks/stripe`
2. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Configure Customer Portal

In Stripe Dashboard → Settings → Customer Portal:

- Enable: "Allow customers to update payment methods"
- Enable: "Allow customers to update subscriptions"
- Enable: "Allow customers to cancel subscriptions"

## API Endpoints

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscriptions/pricing` | Get all pricing tiers |
| GET | `/api/subscriptions` | Get current user's subscription |
| POST | `/api/subscriptions/checkout` | Create Stripe checkout session |
| POST | `/api/subscriptions/cancel` | Cancel subscription |
| POST | `/api/subscriptions/reactivate` | Reactivate subscription |
| POST | `/api/subscriptions/change-tier` | Change subscription tier |
| POST | `/api/subscriptions/portal` | Create customer portal session |
| GET | `/api/subscriptions/usage` | Get usage statistics |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

## Feature Gating

Use the `FeatureGate` middleware to control access to features:

```javascript
const { FeatureGate, FEATURES } = require('./middleware/feature-gate');
const gate = new FeatureGate();

// Check if user has feature
if (gate.hasFeature(userId, FEATURES.ADVANCED_RULES)) {
  // Allow advanced rules
}

// Express middleware
app.use('/api/advanced-rules', gate.middleware(FEATURES.ADVANCED_RULES));

// Check quotas
const result = await gate.trackAndCheck(userId, 'scan');
if (!result.allowed) {
  return res.status(429).json({ error: 'Quota exceeded' });
}
```

## Database Schema

The integration uses a JSON file-based database (MVP). For production, migrate to PostgreSQL or MongoDB.

### Collections

- **subscriptions** - User subscriptions
- **users** - User accounts with Stripe customer IDs
- **teams** - Team/organization data
- **usage** - Monthly usage tracking

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Set Environment Variables

```bash
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add STRIPE_PRICE_PRO
vercel env add STRIPE_PRICE_TEAM
vercel env add STRIPE_PRICE_ENTERPRISE
```

## Testing

### Local Testing

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login and forward webhooks:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. Use test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Requires 3D Secure: `4000 0025 0000 3155`

### Test Checkout Flow

1. Go to `/billing`
2. Select a plan
3. Complete checkout with test card
4. Verify subscription is active
5. Check usage limits are applied

## Security Considerations

1. **Webhook Verification** - Always verify Stripe signatures
2. **User Authentication** - Replace `x-user-id` header with proper JWT/session auth
3. **Database** - Migrate to proper database for production
4. **HTTPS** - Always use HTTPS in production
5. **Secrets** - Never commit secrets to git

## Migration to Production Database

To upgrade from JSON files to PostgreSQL:

1. Install PostgreSQL client:
   ```bash
   npm install pg
   ```

2. Create database schema (see `lib/schema.js` for structure)

3. Replace `lib/db.js` with PostgreSQL implementation

4. Update environment variables with database connection string

## Support

For issues or questions:
- Stripe Docs: https://stripe.com/docs
- GitHub Issues: https://github.com/mumetnaroq/agentguard/issues