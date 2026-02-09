import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS, PlanType } from '@/lib/stripe';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    // Get the current user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { plan, successUrl, cancelUrl } = body;

    // Validate plan type
    if (!plan || !['PRO', 'TEAM'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be PRO or TEAM' },
        { status: 400 }
      );
    }

    // Get the price ID for the selected plan
    const priceId = PRICE_IDS[plan as PlanType];

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${request.headers.get('origin')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.headers.get('origin')}/checkout/cancel`,
      metadata: {
        userId,
        plan,
      },
      // Enable customer portal for managing subscriptions
      billing_address_collection: 'required',
      // Create or use existing customer
      client_reference_id: userId,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    );
  }
}
