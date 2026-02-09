/**
 * Type definitions for AgentGuard lib modules
 */

// Subscription status types
export type SubscriptionStatus = 
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

// Pricing tier types
export interface PricingTier {
  id: string;
  name: string;
  stripePriceId?: string;
  price: number;
  interval: string;
  features: {
    maxScansPerMonth: number;
    maxTeamMembers: number;
    advancedRules: boolean;
    customRules: boolean;
    reports: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    sso: boolean;
    onPremise: boolean;
  };
}

// Subscription data type
export interface Subscription {
  id: string;
  userId: string;
  tier: string;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

// User data type
export interface User {
  id: string;
  email: string;
  name?: string;
  stripeCustomerId?: string;
  subscriptionId?: string | null;
  tier?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Database query types
export interface SubscriptionQuery {
  userId?: string;
  status?: string;
  tier?: string;
  stripeSubscriptionId?: string;
}

// Database class interface
export interface Database {
  // Subscriptions
  getSubscriptions(query?: SubscriptionQuery): Subscription[];
  getSubscriptionById(id: string): Subscription | undefined;
  getSubscriptionByUserId(userId: string): Subscription | undefined;
  createSubscription(subscription: Subscription): Subscription;
  updateSubscription(id: string, updates: Partial<Subscription>): Subscription | null;
  deleteSubscription(id: string): boolean;

  // Users
  getUserById(id: string): User | undefined;
  getUserByEmail(email: string): User | undefined;
  createUser(user: User): User;
  updateUser(id: string, updates: Partial<User>): User | null;
}

// Pricing tiers constant
export declare const PRICING_TIERS: Record<string, PricingTier>;

// Subscription status enum
export declare const SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus>;

// Schema classes
export declare class SubscriptionSchema {
  static create(userId: string, tier?: string, stripeData?: any): Subscription;
  static calculatePeriodEnd(): string;
  static validate(data: any): { valid: boolean; errors: string[] };
}

// Database factory function
export declare function getDatabase(): Database;
