import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        if (!webhookSecret || !signature) {
            throw new Error('Missing stripe signature or webhook secret');
        }
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }

    console.log(`🔔 Received Stripe event: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.client_reference_id;
                const customerEmail = session.customer_details?.email;

                if (!userId) {
                    console.error('❌ Missing client_reference_id in checkout session');
                    break;
                }

                // 1. Fetch the line items to see what was purchased
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
                const activeSuites = new Set<string>();
                let bundleId = 'unknown';

                // 2. Extract suite access from Product Metadata
                for (const item of lineItems.data) {
                    const product = await stripe.products.retrieve(item.price?.product as string);
                    bundleId = product.name;
                    
                    const access = product.metadata.suite_access; // e.g. "resources,studio"
                    if (access) {
                        access.split(',').map(s => s.trim()).forEach(s => activeSuites.add(s));
                    }
                }

                // 3. Update Firestore
                await adminDb.collection('users').doc(userId).update({
                    subscription: {
                        bundleId,
                        activeSuites: Array.from(activeSuites),
                        status: 'active',
                        expiresAt: null, // Subscriptions stay active until canceled
                    },
                    updatedAt: new Date()
                });

                console.log(`✅ User ${userId} (${customerEmail}) granted access to: ${Array.from(activeSuites).join(', ')}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                // This would require mapping Stripe Customer ID back to Firebase UI
                // For now, we'll rely on checkout.session.completed for simplicity in prototype
                break;
            }

            default:
                console.log(`⏩ Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (err: any) {
        console.error(`❌ Webhook handler failed: ${err.message}`);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}

// Next.js config for raw body (necessary for Stripe)
export const config = {
    api: {
        bodyParser: false,
    },
};
