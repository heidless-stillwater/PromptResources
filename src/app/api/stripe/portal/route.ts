import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const stripe = await getStripe();
        const { uid, returnUrl } = await req.json();

        if (!uid) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 1. Fetch user from Firestore to get stripeCustomerId
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const customerId = userData?.stripeCustomerId;

        if (!customerId) {
            return NextResponse.json({ 
                error: 'No active subscription found. Please subscribe first.' 
            }, { status: 400 });
        }

        // 2. Create Stripe Customer Portal session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
        });

        return NextResponse.json({ url: portalSession.url });
    } catch (err: any) {
        console.error('❌ Stripe Portal Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
