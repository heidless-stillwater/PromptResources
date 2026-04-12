import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAuthUser } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
    try {
        const stripe = await getStripe();
        const decodedToken = await getAuthUser(req);
        if (!decodedToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { priceId, successUrl, cancelUrl } = await req.json();

        if (!priceId) {
            return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
        }

        // Create Checkout Sessions from body params
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl || `${req.nextUrl.origin}/resources?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${req.nextUrl.origin}/pricing`,
            client_reference_id: decodedToken.uid,
            customer_email: decodedToken.email,
            metadata: {
              userId: decodedToken.uid
            }
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Checkout error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
