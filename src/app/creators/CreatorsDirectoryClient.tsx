'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { UserProfile } from '@/lib/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface Props {
    featured: UserProfile[];
    creators: UserProfile[];
}

const profileTypeBadge = (type?: string) => {
    const map: Record<string, string> = {
        individual: '👤',
        channel: '📺',
        organization: '🏢',
    };
    return map[type || 'individual'] || '👤';
};

export default function CreatorsDirectoryClient({ featured, creators }: Props) {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'individual' | 'channel' | 'organization'>('all');
    const [sortBy, setSortBy] = useState<'authored' | 'curated' | 'total' | 'newest'>('authored');

    const sortedCreators = useMemo(() => {
        return [...creators].sort((a, b) => {
            if (sortBy === 'authored') return (b.authoredCount || 0) - (a.authoredCount || 0);
            if (sortBy === 'curated') return (b.curatedCount || 0) - (a.curatedCount || 0);
            if (sortBy === 'total') return (b.resourceCount || 0) - (a.resourceCount || 0);
            if (sortBy === 'newest') {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val?.toDate === 'function') return val.toDate().getTime();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime() || 0;
                };
                return getTime(b.createdAt) - getTime(a.createdAt);
            }
            return 0;
        });
    }, [creators, sortBy]);

    const filtered = useMemo(() => {
        return sortedCreators.filter(c => {
            const matchesSearch =
                !search ||
                c.displayName.toLowerCase().includes(search.toLowerCase()) ||
                c.bio?.toLowerCase().includes(search.toLowerCase()) ||
                c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
            const matchesType = filterType === 'all' || c.profileType === filterType;
            return matchesSearch && matchesType;
        });
    }, [sortedCreators, search, filterType]);

    return (
        <div className="page-wrapper dashboard-theme">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <div className="creators-dir-root">
                        {/* ── PAGE HEADER ── */}
                        <div className="creators-dir-header">
                            <div className="creators-dir-header-inner">
                                <h1 className="creators-dir-title">
                                    <span className="creators-dir-title-icon">🌟</span>
                                    Community Registry
                                </h1>
                                <p className="creators-dir-subtitle">
                                    Discover the creators, builders, and curators shaping the future of AI learning.
                                </p>
                            </div>
                        </div>

                        {/* ── FEATURED STRIP ── */}
                        {featured.length > 0 && (
                            <section className="creators-featured-section">
                                <h2 className="creators-section-label">Featured Members</h2>
                                <div className="creators-featured-strip">
                                    {featured.map(c => <CreatorCard key={c.uid} creator={c} featured />)}
                                </div>
                            </section>
                        )}

                        {/* ── FILTERS & SORTing ── */}
                        <div className="creators-filters-row">
                            <div className="creators-filters">
                                <div className="creators-search-wrap">
                                    <span className="creators-search-icon">🔍</span>
                                    <input
                                        type="text"
                                        className="creators-search-input"
                                        placeholder="Search by name or bio…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="creators-filter-chips">
                                    {(['all', 'individual', 'channel', 'organization'] as const).map(type => (
                                        <button
                                            key={type}
                                            className={`creators-filter-chip${filterType === type ? ' active' : ''}`}
                                            onClick={() => setFilterType(type)}
                                        >
                                            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="creators-sort-wrap">
                                <span className="creators-sort-label">Sort by:</span>
                                <select 
                                    className="creators-sort-select"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                >
                                    <option value="authored">Most Authored ✍️</option>
                                    <option value="curated">Top Curators 📂</option>
                                    <option value="total">Total Impact 📈</option>
                                    <option value="newest">Newest Members ✨</option>
                                </select>
                            </div>
                        </div>

                        {/* ── RESULTS ── */}
                        {filtered.length === 0 ? (
                            <div className="creators-empty">
                                <span>😔</span>
                                <p>No community members match your criteria.</p>
                            </div>
                        ) : (
                            <>
                                <div className="creators-result-meta">
                                    {filtered.length} {filtered.length === 1 ? 'member' : 'members'} found
                                </div>
                                <div className="creators-grid">
                                    {filtered.map(c => <CreatorCard key={c.uid} creator={c} />)}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

function CreatorCard({ creator, featured = false }: { creator: UserProfile; featured?: boolean }) {
    const initials = creator.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <Link href={`/creators/${creator.slug || creator.uid}`} className={`creator-card${featured ? ' featured' : ''}`}>
            <div className="creator-card-avatar-wrap">
                {creator.photoURL ? (
                    <img src={creator.photoURL} alt={creator.displayName} className="creator-card-avatar" />
                ) : (
                    <div className="creator-card-avatar-fallback">{initials}</div>
                )}
                {creator.isVerified && <span className="creator-card-verified">✓</span>}
            </div>
            <div className="creator-card-body">
                <div className="creator-card-name-row">
                    <span className="creator-card-type-icon">{profileTypeBadge(creator.profileType)}</span>
                    <span className="creator-card-name">{creator.displayName}</span>
                </div>
                {creator.bio && (
                    <p className="creator-card-bio">{creator.bio}</p>
                )}
                <div className="creator-card-footer">
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <span className="creator-card-stat" title="Resources created by this user">
                            ✍️ {creator.authoredCount ?? 0} <span style={{ opacity: 0.7, fontSize: '9px' }}>Authored</span>
                        </span>
                        <span className="creator-card-stat" title="Resources curated by this user">
                            📂 {creator.curatedCount ?? 0} <span style={{ opacity: 0.7, fontSize: '9px' }}>Curated</span>
                        </span>
                    </div>
                    {creator.tags && creator.tags.length > 0 && (
                        <span className="creator-card-tags">
                            {creator.tags.slice(0, 2).map(t => (
                                <span key={t} className="creator-card-tag">#{t}</span>
                            ))}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
