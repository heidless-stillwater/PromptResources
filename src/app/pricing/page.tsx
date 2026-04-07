import React from 'react';
import PricingClient from '@/components/PricingClient';

export default function PricingPage() {
    // This is the Price ID you provided: price_1TJbyl8bQ1wpTXPRKqQXYFac
    const STRIPE_PRICE_ID = 'price_1TJbyl8bQ1wpTXPRKqQXYFac';

    return <PricingClient priceId={STRIPE_PRICE_ID} />;
}
