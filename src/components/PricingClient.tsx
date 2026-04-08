'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const PLAN_FEATURES = [
    { name: 'Stillwater Resources', description: 'Full access to the global elite library.', suite: 'resources' },
    { name: 'Stillwater Studio', description: 'Unlimited generation with next-gen multimodal pipelines.', suite: 'studio' },
    { name: 'Stillwater Registry', description: 'Advanced blueprint management & private registries.', suite: 'registry' },
    { name: 'Priority Support', description: 'Direct access to our architecture team.', suite: 'support' },
];

export default function PricingClient({ priceId }: { priceId: string }) {
    const { user, signInWithGoogle } = useAuth();
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Explicitly persist the return path so it's never lost during re-renders or hydration
    const [persistedReturnUrl, setPersistedReturnUrl] = useState<string | null>(null);

    useEffect(() => {
        // Run once on mount to lock in the return target
        const urlParams = new URLSearchParams(window.location.search);
        const r = urlParams.get('returnUrl') || searchParams.get('returnUrl');
        if (r) {
            console.log('🔗 Return path locked:', r);
            setPersistedReturnUrl(r);
        }
    }, [searchParams]);

    const isMasterRedirect = persistedReturnUrl?.includes('5173') || persistedReturnUrl?.includes('promptmaster');
    const isToolRedirect = persistedReturnUrl?.includes('3001') || persistedReturnUrl?.includes('prompttool');

    const handleSubscribe = async () => {
        if (!user) {
            signInWithGoogle();
            return;
        }

        setLoading(true);
        try {
            const token = await user.getIdToken();
            // Use the persisted return URL if available, otherwise fallback to local dashboard
            const baseUrl = persistedReturnUrl || (window.location.origin + '/dashboard');
            const successUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}subscribed=true`;

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    priceId: priceId,
                    successUrl,
                    cancelUrl: `${window.location.origin}/pricing`,
                }),
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to create checkout session');
            }
        } catch (err) {
            console.error('Subscription error:', err);
            alert('Failed to initiate checkout. Please check the console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-foreground pt-32 pb-20 px-6">
            <div className="max-w-5xl mx-auto space-y-16">
                {/* Dynamic Return Breadcrumb */}
                {persistedReturnUrl && (
                    <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
                        <Link 
                            href={persistedReturnUrl}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                        >
                            <Icons.arrowLeft size={12} className="text-primary group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted group-hover:text-white">
                                Return to {isMasterRedirect ? 'Stillwater Registry' : isToolRedirect ? 'Stillwater Studio' : 'Previous Location'}
                            </span>
                        </Link>
                    </div>
                )}

                <div className="text-center space-y-4">
                    <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter">
                        The Master <span className="text-primary">Suite</span>
                    </h1>
                    <p className="text-lg text-foreground-muted font-medium max-w-2xl mx-auto">
                        One subscription. Three powerful applications. Unlock the full Stillwater ecosystem and build your resource empire.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 max-w-2xl mx-auto">
                    <Card variant="glass" className="p-12 rounded-[3.5rem] border-primary/30 bg-primary/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8">
                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
                                <Icons.sparkles className="w-8 h-8" />
                            </div>
                        </div>

                        <div className="space-y-8 relative z-10">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4 block">The Founding Architect Bundle</span>
                                <h2 className="text-4xl font-black uppercase tracking-tight">Full Access Suite</h2>
                            </div>

                            <div className="space-y-4">
                                {PLAN_FEATURES.map((feature, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 group-hover:border-primary/20 transition-all">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] mt-1">✓</div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-tight">{feature.name}</p>
                                            <p className="text-[10px] text-foreground-muted font-medium">{feature.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-8">
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-widest text-foreground-muted">All-In Subscription</p>
                                    <p className="text-4xl font-black tracking-tighter text-white font-mono">£50.00 <span className="text-sm font-medium text-foreground-muted">/ month</span></p>
                                </div>
                                <Button
                                    disabled={loading}
                                    onClick={handleSubscribe}
                                    size="lg"
                                    className="h-16 px-12 bg-white text-black hover:bg-primary hover:text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/5"
                                >
                                    {loading ? <Icons.spinner className="w-5 h-5 animate-spin" /> : 'Get Started Now'}
                                </Button>
                            </div>
                        </div>
                    </Card>

                {persistedReturnUrl && (
                    <div style={{ marginTop: 'var(--space-4)', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <Icons.check size={10} style={{ display: 'inline', marginRight: '4px', color: 'var(--success-500)' }} />
                        Return path active: <span style={{ color: 'var(--primary-400)' }}>{isMasterRedirect ? 'PromptMaster' : isToolRedirect ? 'PromptTool' : 'External App'}</span>
                    </div>
                )}
                </div>

                <p className="text-center text-[10px] uppercase font-black tracking-widest text-foreground-muted opacity-40">
                    Secure Stripe Checkout • Cancel Anytime • Instant Suite Activation
                </p>
            </div>
        </div>
    );
}
