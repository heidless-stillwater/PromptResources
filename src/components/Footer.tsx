'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: 'var(--space-8) 0',
            marginTop: 'auto',
        }}>
            <div className="container">
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-8)',
                    marginBottom: 'var(--space-8)',
                }}>
                    <div>
                        <div style={{
                            fontSize: 'var(--text-lg)',
                            fontWeight: 800,
                            background: 'var(--gradient-primary)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            marginBottom: 'var(--space-3)',
                        }}>
                            PromptResources
                        </div>
                        <p style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-muted)',
                            lineHeight: 1.7,
                        }}>
                            Your curated hub for AI prompt education, resources, and mastery. Covering Gemini, NanoBanana, ChatGPT, Claude, and more.
                        </p>
                    </div>

                    <div>
                        <h4 style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--space-4)',
                        }}>
                            Explore
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <Link href="/resources" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>All Resources</Link>
                            <Link href="/categories" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Categories</Link>
                            <Link href="/resources?platform=gemini" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Gemini Prompts</Link>
                            <Link href="/resources?platform=nanobanana" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>NanoBanana Prompts</Link>
                        </div>
                    </div>

                    <div>
                        <h4 style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--space-4)',
                        }}>
                            Account
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <Link href="/auth/login" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Sign In</Link>
                            <Link href="/auth/register" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Get Started</Link>
                            <Link href="/pricing" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Pricing</Link>
                        </div>
                    </div>

                    <div>
                        <h4 style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--space-4)',
                        }}>
                            Developers
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <Link href="/api-docs" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>API Documentation</Link>
                        </div>
                    </div>
                </div>

                <div style={{
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: 'var(--space-6)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 'var(--space-4)',
                }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        © {new Date().getFullYear()} PromptResources. All rights reserved.
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        Powered by Firebase • Built with Next.js
                    </p>
                </div>
            </div>
        </footer>
    );
}
