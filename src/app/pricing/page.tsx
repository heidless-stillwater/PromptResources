import React, { Suspense } from 'react';
import PricingClient from '@/components/PricingClient';

export default function PricingPage() {
    // This is the Price ID you provided: price_1TJbyl8bQ1wpTXPRKqQXYFac
    const STRIPE_PRICE_ID = 'price_1TJbyl8bQ1wpTXPRKqQXYFac';

    return (
        <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
            <PricingClient priceId={STRIPE_PRICE_ID} />
        </Suspense>
    );
}
