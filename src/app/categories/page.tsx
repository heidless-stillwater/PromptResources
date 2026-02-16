'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Resource } from '@/lib/types';
import { getDefaultCategories } from '@/lib/suggestions';

interface CategoryInfo {
    name: string;
    count: number;
    platforms: string[];
    freeCount: number;
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchCategories() {
            try {
                const response = await fetch('/api/resources?pageSize=1000');
                const result = await response.json();
                
                if (result.success) {
                    const resources = result.data as Resource[];
                    const catMap = new Map<string, CategoryInfo>();

                    resources.forEach((r) => {
                        (r.categories || []).forEach((c) => {
                            // Normalize to Title Case
                            const cat = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
                            const existing = catMap.get(cat) || {
                                name: cat,
                                count: 0,
                                platforms: [],
                                freeCount: 0,
                            };
                            existing.count++;
                            if (r.platform && !existing.platforms.includes(r.platform)) {
                                existing.platforms.push(r.platform);
                            }
                            if (r.pricing === 'free') existing.freeCount++;
                            catMap.set(cat, existing);
                        });
                    });

                    // Add default categories without resources
                    const defaultCats = getDefaultCategories();
                    defaultCats.forEach((cat) => {
                        if (!catMap.has(cat)) {
                            catMap.set(cat, { name: cat, count: 0, platforms: [], freeCount: 0 });
                        }
                    });

                    setCategories(
                        Array.from(catMap.values()).sort((a, b) => b.count - a.count)
                    );
                } else {
                    console.error('API Error:', result.error);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchCategories();
    }, []);

    const iconMap: Record<string, string> = {
        'Prompt Engineering': '⚡',
        'Image Generation': '🖼️',
        'Text Generation': '📝',
        'Code Generation': '💻',
        'Video Generation': '🎬',
        'Audio Generation': '🎵',
        'Chatbot Development': '🤖',
        'API Integration': '🔌',
        'Best Practices': '✅',
        'Advanced Techniques': '🎯',
        'Beginner Guide': '📘',
        'Use Cases': '💡',
        'Comparison': '⚖️',
        'News & Updates': '📰',
        'Research': '🔬',
        'Tools & Plugins': '🔧',
        'Templates': '📋',
        'Workflow': '🔄',
        'Gemini': '🔮',
        'NanoBanana': '🍌',
        'ChatGPT': '🤖',
        'Claude': '🧠',
        'Midjourney': '🎨',
        'Archive': '📁',
        'Project': '🏗️',
        'Tutorial': '📖',
    };

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <div style={{ marginBottom: 'var(--space-8)' }}>
                        <h1 style={{ marginBottom: 'var(--space-2)' }}>🏷️ Categories</h1>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Browse resources by topic and interest area
                        </p>
                    </div>

                    {loading ? (
                        <div className="loading-page">
                            <div className="spinner" />
                            <div className="loading-text">Loading categories...</div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: 'var(--space-4)',
                        }}>
                            {categories.map((cat) => (
                                <Link
                                    key={cat.name}
                                    href={`/resources?category=${encodeURIComponent(cat.name)}`}
                                    className="glass-card"
                                    style={{
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 'var(--space-4)',
                                        padding: 'var(--space-5)',
                                        opacity: cat.count > 0 ? 1 : 0.5,
                                    }}
                                >
                                    <div style={{
                                        fontSize: '2rem',
                                        width: '48px',
                                        height: '48px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-lg)',
                                        flexShrink: 0,
                                    }}>
                                        {iconMap[cat.name] || '📂'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontWeight: 700,
                                            color: 'var(--text-primary)',
                                            marginBottom: 'var(--space-1)',
                                        }}>
                                            {cat.name}
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--text-muted)',
                                            marginBottom: 'var(--space-2)',
                                        }}>
                                            {cat.count} resource{cat.count !== 1 ? 's' : ''}
                                            {cat.freeCount > 0 && ` · ${cat.freeCount} free`}
                                        </div>
                                        {cat.platforms.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                                                {cat.platforms.slice(0, 3).map((p) => (
                                                    <span key={p} className="badge badge-accent" style={{ fontSize: '0.6rem' }}>
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)' }}>→</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}
