'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { useAuth } from '@/contexts/AuthContext'; 
import Image from 'next/image';

import { UserProfile } from '@/lib/types';

interface Resource {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  type?: string;
  status?: string;
  mediaFormat?: string;
  createdAt?: any;
}

export default function HomeClient({ recentResources = [], featuredCreators = [], topics = [] }: { recentResources?: Resource[], featuredCreators?: UserProfile[], topics?: string[] }) {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // High quality dummy data based on user input (YouTube, inline resources, guides, business info)
    const dummyResources = [
        { id: 1, type: 'youtube tutorial', title: 'High-Retention YouTube Documentaries', description: 'Step-by-step masterclass on automating 8K sleep documentaries with next-gen multimodal pipelines.', status: 'published' },
        { id: 2, type: 'inline resource', title: 'Workflow Architecture Templates', description: 'Downloadable architectural diagrams for setting up asynchronous, multi-agent media engines.', status: 'published' },
        { id: 3, type: 'guide', title: 'The Complete Guide to NextJS Serverless', description: 'Exclusive technical blueprint for scaling Firebase authentication alongside NextJS App Router.', status: 'published' },
        { id: 4, type: 'business info', title: 'Founder Data: Monetizing Auto-Media', description: 'Verified business intelligence covering audience retention, AdSense optimizations, and channel growth.', status: 'published' }
    ];

    return (
        <main className="min-h-screen bg-[#0a0a0f] text-foreground selection:bg-primary/30">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-stillwater-teal flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                            <Icons.sparkles className="text-white w-6 h-6" />
                        </div>
                        <span className="text-xl font-black uppercase tracking-tighter">Stillwater <span className="text-primary">Studio</span></span>
                    </div>
                    <Button
                        onClick={signInWithGoogle}
                        variant="ghost"
                        className="text-xs font-black uppercase tracking-widest hover:bg-white/5"
                    >
                        Sign In
                    </Button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-12 px-6 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/assets/landing/hero-anatomy.png"
                        alt="Network Visualization"
                        fill
                        sizes="100vw"
                        className="object-cover opacity-20 mix-blend-luminosity scale-105"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
                </div>

                <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-stillwater-teal animate-pulse-rose" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70">Library Management Protocol</span>
                        </div>

                        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85]">
                            Build Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-stillwater-teal to-accent">Resource</span> <br />
                            Empire
                        </h1>

                        <p className="text-lg md:text-xl text-foreground-muted max-w-xl font-medium">
                            Don&apos;t just organize—distribute. Build and curate your own technical libraries, share exclusive masterclasses with the network, and discover expert-curated collections from industry veterans.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                            <Button
                                onClick={signInWithGoogle}
                                size="lg"
                                className="h-16 px-12 group relative overflow-hidden bg-primary hover:bg-primary-hover rounded-2xl shadow-2xl shadow-primary/20"
                            >
                                <span className="relative z-10 flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                                    Get Started
                                    <Icons.arrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Button>
                            <p className="text-[10px] uppercase font-black tracking-widest opacity-40">Personal Hubs • Global Sharing</p>
                        </div>
                    </div>

                    {/* Anatomy Card */}
                    <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
                        <Card variant="glass" className="p-8 rounded-[3rem] border-white/5 bg-white/[0.02] backdrop-blur-2xl shadow-2xl backdrop-glow">
                            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-8 border border-white/10 shadow-lg">
                                <Image 
                                    src="/assets/landing/hero-anatomy.png" 
                                    alt="Library Visual" 
                                    fill 
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    className="object-cover" 
                                />
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Community Shared Collection</span>
                                    <div className="flex gap-1" aria-hidden="true">
                                        {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-[#0a0a0f]/80 border border-white/5 font-mono text-xs leading-relaxed group hover:border-primary/50 transition-colors">
                                        <p className="text-white/40 mb-1 font-bold uppercase tracking-tighter text-[9px]">The Automation Architect's Vault</p>
                                        <span className="text-primary-hover">Curator:</span> @SystemFounder, <span className="text-stillwater-teal">Focus:</span> Video Presentation, <span className="text-accent">Scale:</span> 12 Active Libraries Built...
                                    </div>
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-all">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Open Full Library</p>
                                            <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-tighter">140 Curated Resources • 2.4k Subscribers</p>
                                        </div>
                                        <Icons.arrowRight className="text-primary w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            {/* The Collective Showcase */}
            <section className="py-32 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto space-y-16">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                        <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Network Discovery</span>
                            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Curated <br />Libraries</h2>
                        </div>
                        <p className="text-foreground-muted font-medium max-w-sm">Browse elite resources hand-picked by the community. Clone public libraries into your personal vault.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(recentResources && recentResources.length > 0 ? recentResources : dummyResources).map((resource: any, i: number) => (
                            <Link 
                                key={resource?.id || i} 
                                href={`/resources/${resource.id}`}
                                className="aspect-[3/4] rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden relative group cursor-pointer hover:bg-white/[0.05] transition-colors flex flex-col justify-end"
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                                    {resource?.status === 'flagged' && (
                                        <div className="px-3 py-1 bg-rose-500/80 border border-rose-500/20 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2 animate-pulse-rose shadow-lg shadow-rose-500/20">
                                            <Icons.report size={10} /> Safety Concerns
                                        </div>
                                    )}
                                </div>
                                <div className="relative z-10 space-y-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 p-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px]">✨</div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-primary shadow-sm">{resource?.type || 'Blueprint'}</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white line-clamp-2 leading-tight drop-shadow-md">{resource?.title || `Resource ${i + 1}`}</h3>
                                    <p className="text-[10px] font-medium text-white/70 line-clamp-2 drop-shadow-sm">{resource?.description || 'No description provided.'}</p>
                                    <div className="flex gap-2 pt-2">
                                        {resource?.type?.includes('video') || resource?.type?.includes('youtube') || resource?.mediaFormat === 'youtube' ? (
                                            <div className="px-2 py-1 rounded-md bg-white/10 text-[8px] font-black uppercase hover:bg-white/20 transition-colors backdrop-blur-md">Watch Now</div>
                                        ) : resource?.type?.includes('business') ? (
                                            <div className="px-2 py-1 rounded-md bg-white/10 text-[8px] font-black uppercase hover:bg-white/20 transition-colors backdrop-blur-md">View Data</div>
                                        ) : (
                                            <div className="px-2 py-1 rounded-md bg-white/10 text-[8px] font-black uppercase hover:bg-white/20 transition-colors backdrop-blur-md">Read Article</div>
                                        )}
                                        <div className="px-2 py-1 rounded-md bg-white/5 text-[8px] font-black uppercase text-white/50 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-md">Save</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Featured Creators Row */}
                    {featuredCreators.length > 0 && (
                        <div className="space-y-8 pt-16">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold uppercase tracking-widest flex items-center gap-3">
                                    <span className="w-8 h-px bg-primary/30" />
                                    Our Top Creators
                                </h3>
                                <Link href="/creators" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                                    View Directory →
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                {featuredCreators.map((creator) => (
                                    <Link 
                                        key={creator.uid} 
                                        href={`/creators/${creator.slug || creator.uid}`}
                                        className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] hover:border-primary/30 transition-all group flex items-center gap-4"
                                    >
                                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden grayscale group-hover:grayscale-0 transition-all">
                                            {creator.photoURL ? (
                                                <Image 
                                                    src={creator.photoURL} 
                                                    alt={creator.displayName} 
                                                    fill 
                                                    sizes="64px"
                                                    className="object-cover" 
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-xl font-black">
                                                    {creator.displayName[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-tight group-hover:text-primary transition-colors">{creator.displayName}</p>
                                            <p className="text-[10px] text-foreground-muted uppercase font-bold tracking-tighter">{creator.resourceCount || 0} RESOURCES</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Collective Incentives */}
            <section className="py-32 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Unleash Your <span className="text-primary">Ecosystem</span></h2>
                        <p className="text-foreground-muted font-bold uppercase tracking-widest text-xs">Transform isolated knowledge into a dynamic, sharing-first platform</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card variant="glass" className="p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01] transition-all hover:bg-white/[0.03]">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mb-6">🏗️</div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2">Build Your Library</h3>
                            <p className="text-[10px] text-foreground-muted font-medium mb-4">Curate and organize your own localized hub of videos, architectural guides, and technical insights in one centralized vault.</p>
                            <div className="h-1 w-8 bg-primary rounded-full" />
                        </Card>

                        <Card variant="glass" className="p-8 rounded-[2.5rem] border-primary/20 bg-primary/5 transition-all hover:scale-105 active:scale-95 cursor-pointer">
                            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl mb-6">🤝</div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2 text-primary">Share with the Network</h3>
                            <p className="text-[10px] text-foreground/70 font-medium mb-4">Publish your architectural flows. Build an audience and rank globally by giving engineers access to your private resource collections.</p>
                            <div className="h-1 w-8 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]" />
                        </Card>

                        <Card variant="glass" className="p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01] transition-all hover:bg-white/[0.03]">
                            <div className="w-12 h-12 rounded-2xl bg-founder-gold/10 flex items-center justify-center text-2xl mb-6">💎</div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2">Curated Master-Tiers</h3>
                            <p className="text-[10px] text-foreground-muted font-medium mb-4">Instantly unlock master-tier, expert-curated libraries containing verified data, AdSense optimizations, and highly optimized templates.</p>
                            <div className="h-1 w-8 bg-founder-gold rounded-full" />
                        </Card>
                    </div>

                    <div className="mt-16 text-center">
                        <Button
                            onClick={signInWithGoogle}
                            size="lg"
                            className="h-16 px-16 bg-white text-black hover:bg-white/90 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-white/10"
                        >
                            Get Started Now
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-24 px-6 border-t border-white/5 bg-background">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="space-y-4 text-center md:text-left">
                        <div className="flex items-center gap-2 justify-center md:justify-start">
                            <Icons.sparkles className="text-primary w-5 h-5" />
                            <span className="font-black uppercase tracking-tighter">Stillwater Studio</span>
                        </div>
                        <p className="text-xs text-foreground-muted font-medium max-w-xs">
                            Curate, discover, and distribute premium technical resources on the premier knowledge-sharing network.
                        </p>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-foreground-muted opacity-40">
                        © 2026 Stillwater Studio
                    </div>
                </div>
            </footer>

            <style jsx>{`
                .backdrop-glow {
                    position: relative;
                }
                .backdrop-glow::after {
                    content: '';
                    position: absolute;
                    inset: -20px;
                    background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
                    opacity: 0.1;
                    z-index: -1;
                    filter: blur(40px);
                }
            `}</style>
        </main>
    );
}
