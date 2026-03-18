'use client';

import React from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Resource } from '@/lib/types';
import { isYouTubeUrl, isGenericYouTubeName, deduplicateCredits } from '@/lib/youtube';

interface HomeClientProps {
    recentResources: Resource[];
    stats: {
        resources: number;
        categories: number;
        platforms: number;
    };
}

export default function HomeClient({ recentResources, stats }: HomeClientProps) {
    const { user } = useAuth();

    return (
        <div className="page-wrapper">
            <Navbar />

            {/* Hero Section */}
            <section className="hero" id="hero-section">
                <div className="container" style={{ position: 'relative', zIndex: 1 }}>
                    <h1 className="hero-title animate-slide-up">
                        Master AI Prompts.<br />
                        Unlock Possibilities.
                    </h1>
                    <p className="hero-desc animate-fade-in">
                        Your curated hub for AI prompt education and reference. Discover resources for
                        Gemini, NanoBanana, ChatGPT, Claude, Midjourney, and more — from beginner guides
                        to advanced techniques.
                    </p>
                    <div className="hero-actions animate-fade-in">
                        <Link href="/resources" className="btn btn-primary btn-lg" id="hero-browse">
                            🔍 Browse Resources
                        </Link>
                        {!user && (
                            <Link href="/auth/register" className="btn btn-secondary btn-lg" id="hero-signup">
                                ✨ Get Started Free
                            </Link>
                        )}
                    </div>
                </div>

                {/* Decorative orbs */}
                <div style={{
                    position: 'absolute',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
                    top: '-100px',
                    right: '-100px',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)',
                    bottom: '-80px',
                    left: '-60px',
                    pointerEvents: 'none',
                }} />
            </section>

            {/* Stats Section */}
            <section style={{ padding: 'var(--space-16) 0' }}>
                <div className="container">
                    <div className="stats-grid">
                        <div className="glass-card stat-card">
                            <div className="stat-value">{stats.resources || '∞'}</div>
                            <div className="stat-label">Curated Resources</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{stats.categories || '15+'}</div>
                            <div className="stat-label">Categories</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{stats.platforms}+</div>
                            <div className="stat-label">AI Platforms</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">∞</div>
                            <div className="stat-label">Prompt Ideas</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Platform Highlights */}
            <section style={{ padding: 'var(--space-16) 0', background: 'var(--bg-secondary)' }}>
                <div className="container">
                    <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                        Platforms We Cover
                    </h2>
                    <p style={{
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--space-12)',
                        maxWidth: '600px',
                        margin: '0 auto var(--space-12)',
                    }}>
                        Starting with Gemini and NanoBanana, expanding to cover all major AI platforms
                    </p>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 'var(--space-4)',
                    }}>
                        {[
                            { name: 'Gemini', icon: '🔮', desc: 'Google AI', featured: true },
                            { name: 'NanoBanana', icon: '🍌', desc: 'Prompt Generation', featured: true },
                            { name: 'ChatGPT', icon: '🤖', desc: 'OpenAI', featured: false },
                            { name: 'Claude', icon: '🧠', desc: 'Anthropic', featured: false },
                            { name: 'Midjourney', icon: '🎨', desc: 'Image AI', featured: false },
                            { name: 'More...', icon: '🚀', desc: 'Coming Soon', featured: false },
                        ].map((platform) => (
                            <div
                                key={platform.name}
                                className="glass-card"
                                style={{
                                    textAlign: 'center',
                                    padding: 'var(--space-6)',
                                    borderColor: platform.featured ? 'var(--primary-500)' : undefined,
                                    boxShadow: platform.featured ? 'var(--shadow-glow)' : undefined,
                                }}
                            >
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>
                                    {platform.icon}
                                </div>
                                <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                                    {platform.name}
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                    {platform.desc}
                                </div>
                                {platform.featured && (
                                    <span className="badge badge-primary" style={{ marginTop: 'var(--space-2)' }}>
                                        Featured
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Recent Resources */}
            {recentResources.length > 0 && (
                <section style={{ padding: 'var(--space-16) 0' }}>
                    <div className="container">
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-8)',
                        }}>
                            <h2>Latest Resources</h2>
                            <Link href="/resources" className="btn btn-secondary">
                                View All →
                            </Link>
                        </div>

                        <div className="resource-grid">
                            {recentResources.map((resource) => (
                                <Link
                                    href={`/resources/${resource.id}`}
                                    key={resource.id}
                                    className="resource-card"
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div className="resource-card-thumb">
                                        {resource.thumbnailUrl ? (
                                            <div className="relative w-full h-full">
                                                <NextImage
                                                    src={resource.thumbnailUrl}
                                                    alt={resource.title}
                                                    fill
                                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="resource-card-placeholder">
                                                {resource.mediaFormat === 'youtube' ? '▶️' :
                                                    resource.type === 'article' ? '📄' :
                                                        resource.type === 'tool' ? '🔧' :
                                                            resource.type === 'course' ? '🎓' : '📚'}
                                            </div>
                                        )}
                                        <div className="resource-card-pricing">
                                            <span className={`badge badge-${resource.pricing}`}>
                                                {resource.pricing}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="resource-card-body">
                                        <div className="resource-card-title">
                                            {resource.title}
                                            {resource.isFavorite && (
                                                <span className="featured-star" title="Featured Resource">⭐</span>
                                            )}
                                        </div>
                                        <div className="resource-card-desc">{resource.description}</div>
                                        <div className="resource-card-meta">
                                            {resource.categories?.slice(0, 2).map((cat) => (
                                                <span key={cat} className="badge badge-primary">{cat}</span>
                                            ))}
                                            <span className="badge badge-accent">{resource.platform}</span>
                                        </div>
                                    </div>
                                    <div className="resource-card-footer">
                                        <div className="resource-card-credits">
                                            {(() => {
                                                const uniqueCredits = deduplicateCredits(resource.credits || []);
                                                const firstCredit = uniqueCredits?.[0];
                                                if (firstCredit && isGenericYouTubeName(firstCredit.name) && resource.url && isYouTubeUrl(resource.url)) {
                                                    return 'YouTube';
                                                }
                                                return firstCredit?.name || 'Community';
                                            })()}
                                        </div>
                                        <span style={{
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--text-muted)',
                                        }}>
                                            {resource.type}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Pricing Section */}
            <section style={{ padding: 'var(--space-16) 0', background: 'var(--bg-secondary)' }} id="pricing-section">
                <div className="container">
                    <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                        Simple, Transparent Pricing
                    </h2>
                    <p style={{
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--space-12)',
                        maxWidth: '500px',
                        margin: '0 auto var(--space-12)',
                    }}>
                        Start free and upgrade as you grow. All plans include access to curated resources.
                    </p>

                    <div className="pricing-grid">
                        <div className="glass-card pricing-card">
                            <div className="pricing-tier">Free</div>
                            <div className="pricing-price">$0<span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>/mo</span></div>
                            <ul className="pricing-features">
                                <li className="pricing-feature">Browse all free resources</li>
                                <li className="pricing-feature">Save up to 25 resources</li>
                                <li className="pricing-feature">Basic search & filtering</li>
                                <li className="pricing-feature">Community access</li>
                            </ul>
                            <Link href="/auth/register" className="btn btn-secondary btn-lg" style={{ width: '100%' }}>
                                Get Started
                            </Link>
                        </div>

                        <div className="glass-card pricing-card featured">
                            <div className="pricing-tier">Standard</div>
                            <div className="pricing-price">$9<span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>/mo</span></div>
                            <ul className="pricing-features">
                                <li className="pricing-feature">All free features</li>
                                <li className="pricing-feature">Unlimited saved resources</li>
                                <li className="pricing-feature">Premium resource access</li>
                                <li className="pricing-feature">AI-powered suggestions</li>
                                <li className="pricing-feature">Progress tracking</li>
                                <li className="pricing-feature">API access (100 calls/day)</li>
                            </ul>
                            <Link href="/auth/register" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                                Start Free Trial
                            </Link>
                        </div>

                        <div className="glass-card pricing-card">
                            <div className="pricing-tier">Pro</div>
                            <div className="pricing-price">$29<span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>/mo</span></div>
                            <ul className="pricing-features">
                                <li className="pricing-feature">All standard features</li>
                                <li className="pricing-feature">Unlimited storage</li>
                                <li className="pricing-feature">Priority support</li>
                                <li className="pricing-feature">Custom collections</li>
                                <li className="pricing-feature">API access (unlimited)</li>
                                <li className="pricing-feature">Early access to new features</li>
                            </ul>
                            <Link href="/auth/register" className="btn btn-secondary btn-lg" style={{ width: '100%' }}>
                                Go Pro
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: 'var(--space-20) 0', textAlign: 'center' }}>
                <div className="container">
                    <h2 style={{ marginBottom: 'var(--space-4)' }}>
                        Ready to Master AI Prompts?
                    </h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--space-8)',
                        maxWidth: '500px',
                        margin: '0 auto var(--space-8)',
                    }}>
                        Join our growing community and get access to the best AI prompt resources, curated by experts.
                    </p>
                    <Link href={user ? '/resources' : '/auth/register'} className="btn btn-primary btn-lg">
                        {user ? 'Browse Resources →' : '🚀 Start Your Journey'}
                    </Link>
                </div>
            </section>

            <Footer />
        </div>
    );
}
