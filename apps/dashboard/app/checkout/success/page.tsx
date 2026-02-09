import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { stripe } from '@/lib/stripe';

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

async function SuccessContent({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    redirect('/');
  }

  try {
    // Retrieve the checkout session to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return (
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg
              className="h-8 w-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-gray-900">
            Payment Pending
          </h1>
          <p className="mb-8 text-gray-600">
            Your payment is being processed. We&apos;ll update your account once it&apos;s complete.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>
        </div>
      );
    }

    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
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
        </div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          Welcome to AgentGuard {session.metadata?.plan || 'Pro'}!
        </h1>
        <p className="mb-8 text-gray-600">
          Your subscription has been activated successfully. You now have access to all {session.metadata?.plan || 'Pro'} features.
        </p>
        
        <div className="mb-8 rounded-lg bg-gray-50 p-6 text-left">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">What&apos;s next?</h2>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                1
              </span>
              <span>Complete your security profile setup</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                2
              </span>
              <span>Run your first comprehensive scan</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                3
              </span>
              <span>Invite team members (Team plan only)</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Read Documentation
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          A confirmation email has been sent to{' '}
          <span className="font-medium text-gray-900">
            {session.customer_details?.email || 'your email'}
          </span>
        </p>
      </div>
    );
  } catch (error) {
    console.error('Error retrieving session:', error);
    
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          Something went wrong
        </h1>
        <p className="mb-8 text-gray-600">
          We couldn&apos;t verify your payment status. Please contact support if you believe this is an error.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }
}

// Loading fallback
function SuccessLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <p className="mt-4 text-gray-600">Verifying your subscription...</p>
    </div>
  );
}

export default function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<SuccessLoading />}>
          <SuccessContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
