import Stripe from 'stripe';

// Initialize Stripe with the secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Price IDs for AgentGuard plans
// Replace these with your actual Stripe Price IDs
export const PRICE_IDS = {
  // Pro plan - $29/month
  PRO: process.env.STRIPE_PRICE_PRO || 'price_pro_placeholder',
  // Team plan - $99/month
  TEAM: process.env.STRIPE_PRICE_TEAM || 'price_team_placeholder',
} as const;

// Plan metadata for display
export const PLANS = {
  PRO: {
    id: PRICE_IDS.PRO,
    name: 'Pro',
    description: 'Advanced security scanning for professional developers',
    price: 29,
    interval: 'month',
    features: [
      'Unlimited scans',
      'Advanced vulnerability detection',
      'Priority support',
      'CI/CD integration',
      'Custom rules',
    ],
  },
  TEAM: {
    id: PRICE_IDS.TEAM,
    name: 'Team',
    description: 'Team collaboration and enterprise features',
    price: 99,
    interval: 'month',
    features: [
      'Everything in Pro',
      'Team management',
      'Organization-wide policies',
      'SSO integration',
      'Dedicated support',
      'Custom integrations',
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;
