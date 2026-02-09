import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-600"
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
          Checkout Cancelled
        </h1>
        
        <p className="mb-8 text-gray-600">
          Your payment was cancelled and you haven&apos;t been charged. 
          If you have any questions or need help, feel free to reach out to our support team.
        </p>

        <div className="mb-8 rounded-lg bg-blue-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-blue-900">
            Not ready to subscribe?
          </h2>
          <p className="text-blue-700">
            You can still use AgentGuard&apos;s free tier with basic security scans. 
            Upgrade anytime when you&apos;re ready for advanced features.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            View Pricing
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Need help?{' '}
          <Link href="/support" className="font-medium text-blue-600 hover:text-blue-500">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
