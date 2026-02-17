'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function PricingPage() {
    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ textAlign: 'center', maxWidth: '800px' }}>
                    <div style={{ padding: 'var(--space-12) 0' }}>
                        <h1 style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>💎 Upgrade Your Plan</h1>
                        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>
                            Get exclusive access to premium AI prompt resources and advanced features.
                        </p>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: 'var(--space-6)',
                            marginBottom: 'var(--space-12)'
                        }}>
                            <div className="glass-card" style={{ padding: 'var(--space-8)', position: 'relative' }}>
                                <h3 style={{ marginBottom: 'var(--space-2)' }}>Free</h3>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 'var(--space-4)' }}>$0</div>
                                <ul style={{ textAlign: 'left', marginBottom: 'var(--space-8)', paddingLeft: 'var(--space-4)' }}>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Browse public resources</li>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Save up to 10 items</li>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Basic category search</li>
                                </ul>
                                <button className="btn btn-secondary w-full" disabled>Current Plan</button>
                            </div>

                            <div className="glass-card" style={{
                                padding: 'var(--space-8)',
                                border: '2px solid var(--primary-500)',
                                transform: 'scale(1.05)',
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-12px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'var(--primary-500)',
                                    color: 'white',
                                    padding: '2px 12px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700
                                }}>MOST POPULAR</div>
                                <h3 style={{ marginBottom: 'var(--space-2)' }}>Standard</h3>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 'var(--space-4)' }}>$9<small style={{ fontSize: '1rem' }}>/mo</small></div>
                                <ul style={{ textAlign: 'left', marginBottom: 'var(--space-8)', paddingLeft: 'var(--space-4)' }}>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Unlimited saved resources</li>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Advanced AI suggestions</li>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Ad-free experience</li>
                                </ul>
                                <button className="btn btn-primary w-full shadow-lg" onClick={() => alert('Checkout coming soon!')}>Get Started</button>
                            </div>

                            <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
                                <h3 style={{ marginBottom: 'var(--space-2)' }}>Pro</h3>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 'var(--space-4)' }}>$19<small style={{ fontSize: '1rem' }}>/mo</small></div>
                                <ul style={{ textAlign: 'left', marginBottom: 'var(--space-8)', paddingLeft: 'var(--space-4)' }}>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Everything in Standard</li>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Early access to new tools</li>
                                    <li style={{ marginBottom: 'var(--space-2)' }}>Priority support</li>
                                </ul>
                                <button className="btn btn-secondary w-full" onClick={() => alert('Checkout coming soon!')}>Go Pro</button>
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: 'var(--space-6)', display: 'inline-block' }}>
                            <p style={{ marginBottom: 0 }}>
                                💡 Need a custom plan for your team? <Link href="mailto:support@promptresources.com" style={{ color: 'var(--primary-400)' }}>Contact us</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
