import React, { Suspense } from 'react';
import PricingClient from '@/components/PricingClient';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PricingPage() {
    // This is the Price ID you provided: price_1TJbyl8bQ1wpTXPRKqQXYFac
    const STRIPE_PRICE_ID = 'price_1TJbyl8bQ1wpTXPRKqQXYFac';

    return (
        <main className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f]">
            <Navbar />
            <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
                <PricingClient priceId={STRIPE_PRICE_ID} />
            </Suspense>
            <Footer />
        </main>
    );
}
