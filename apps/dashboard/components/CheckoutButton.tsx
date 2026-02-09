'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLANS, PlanType } from '@/lib/stripe';
import { cn } from '@/lib/utils';

interface CheckoutButtonProps {
  plan: PlanType;
  className?: string;
  children?: React.ReactNode;
  successUrl?: string;
  cancelUrl?: string;
}

export function CheckoutButton({
  plan,
  className,
  children,
  successUrl,
  cancelUrl,
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          successUrl,
          cancelUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const planInfo = PLANS[plan];

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium transition-colors',
          'bg-blue-600 text-white hover:bg-blue-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          className
        )}
      >
        {isLoading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children || `Subscribe to ${planInfo.name} - $${planInfo.price}/${planInfo.interval}`
        )}
      </button>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

// Pricing card component that includes the checkout button
interface PricingCardProps {
  plan: PlanType;
  highlighted?: boolean;
}

export function PricingCard({ plan, highlighted = false }: PricingCardProps) {
  const planInfo = PLANS[plan];

  return (
    <div
      className={cn(
        'rounded-2xl border p-8 shadow-sm',
        highlighted
          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500'
          : 'border-gray-200 bg-white'
      )}
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{planInfo.name}</h3>
        <p className="mt-2 text-sm text-gray-600">{planInfo.description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-gray-900">${planInfo.price}</span>
        <span className="text-gray-600">/{planInfo.interval}</span>
      </div>

      <ul className="mb-8 space-y-3">
        {planInfo.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-gray-600">{feature}</span>
          </li>
        ))}
      </ul>

      <CheckoutButton
        plan={plan}
        className={cn(
          'w-full',
          highlighted
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-900 hover:bg-gray-800'
        )}
      />
    </div>
  );
}
