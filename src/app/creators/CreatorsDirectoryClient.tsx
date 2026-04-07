'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { UserProfile } from '@/lib/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Icons } from '@/components/ui/Icons';

interface Props {
    featured: UserProfile[];
    creators: UserProfile[];
}

const profileTypeIcon = (type?: string) => {
    switch (type) {
        case 'individual': return <Icons.user size={16} />;
        case 'channel': return <Icons.video size={16} />;
        case 'organization': return <Icons.users size={16} />;
        default: return <Icons.user size={16} />;
    }
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
                            <div className="creators-dir-header-inner" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
                                <div style={{ 
                                    display: 'inline-flex', 
                                    padding: 'var(--space-2) var(--space-4)', 
                                    background: 'rgba(108, 99, 255, 0.15)', 
                                    borderRadius: '100px', 
                                    color: 'var(--accent-primary)',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 700,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    marginBottom: 'var(--space-4)',
                                    border: '1px solid rgba(108, 99, 255, 0.2)'
                                }}>
                                    <Icons.trophy size={12} style={{ marginRight: '8px' }} /> Hall of Fame
                                </div>
                                <h1 className="creators-dir-title" style={{ fontSize: '3.5rem', marginBottom: 'var(--space-2)' }}>
                                    Community Registry
                                </h1>
                                <p className="creators-dir-subtitle" style={{ fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
                                    Discover the pioneers, builders, and educators shaping the future of the AI learning landscape.
                                </p>
                            </div>
                        </div>

                        {/* ── FILTERS & SORTING ── */}
                        <div className="creators-filters-row" style={{ 
                            background: 'rgba(255,255,255,0.03)', 
                            backdropFilter: 'blur(10px)',
                            padding: 'var(--space-6)',
                            borderRadius: 'var(--radius-xl)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            gap: 'var(--space-4)',
                            marginBottom: 'var(--space-12)'
                        }}>
                            <div className="creators-search-wrap" style={{ flex: 2, minWidth: '300px' }}>
                                <span className="creators-search-icon">🔍</span>
                                <input
                                    type="text"
                                    className="creators-search-input"
                                    placeholder="Search by name, expertise or platform…"
                                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            
                            <div className="creators-filter-chips" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                {(['all', 'individual', 'channel', 'organization'] as const).map(type => (
                                    <button
                                        key={type}
                                        className={`creators-filter-chip${filterType === type ? ' active' : ''}`}
                                        style={{ 
                                            background: filterType === type ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                            border: 'none',
                                            padding: 'var(--space-2) var(--space-4)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'white',
                                            fontSize: 'var(--text-sm)',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => setFilterType(type)}
                                    >
                                        {type === 'all' ? 'All Members' : type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>

                            <div className="creators-sort-wrap" style={{ marginLeft: 'auto' }}>
                                <select 
                                    className="creators-sort-select"
                                    style={{ 
                                        background: 'rgba(0,0,0,0.2)', 
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        color: 'white',
                                        padding: 'var(--space-2) var(--space-4)',
                                        borderRadius: 'var(--radius-md)'
                                    }}
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                >
                                    <option value="authored">Sort by Authored ✍️</option>
                                    <option value="curated">Sort by Curated 📂</option>
                                    <option value="total">Sort by Impact 📉</option>
                                    <option value="newest">Sort by Newest ✨</option>
                                </select>
                            </div>
                        </div>

                        {/* ── FEATURED SECTION ── */}
                        {featured.length > 0 && !search && filterType === 'all' && (
                            <section className="creators-featured-section" style={{ marginBottom: 'var(--space-12)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                                    <h2 className="creators-section-label" style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '0.1em', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                                        Featured Pioneers
                                    </h2>
                                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(108, 99, 255, 0.3) 0%, transparent 100%)' }}></div>
                                </div>
                                <div className="creators-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
                                    {featured.map(c => <CreatorCard key={c.uid} creator={c} featured />)}
                                </div>
                            </section>
                        )}

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
                                <div className="creators-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
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
        <Link href={`/creators/${creator.slug || creator.uid}`} className={`creator-card-ultra${featured ? ' featured' : ''}`} style={{ textDecoration: 'none' }}>
            <div className={`glass-card creator-card-inner animate-fade-in`} style={{ 
                height: '100%', 
                padding: 'var(--space-6)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--space-4)',
                background: featured ? 'rgba(108, 99, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: featured ? '1px solid rgba(108, 99, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Glow for Featured */}
                {featured && <div style={{ 
                    position: 'absolute', 
                    top: '-50px', 
                    right: '-50px', 
                    width: '150px', 
                    height: '150px', 
                    background: 'radial-gradient(circle, rgba(108, 99, 255, 0.1) 0%, transparent 70%)', 
                    zIndex: 0 
                }} />}

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
                    <div className="creator-card-avatar-wrap-ultra" style={{ position: 'relative' }}>
                        {creator.photoURL ? (
                            <img src={creator.photoURL} alt={creator.displayName} style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ 
                                width: '64px', 
                                height: '64px', 
                                borderRadius: '16px', 
                                background: 'linear-gradient(135deg, #6C63FF 0%, #3F3D56 100%)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '1.25rem', 
                                fontWeight: 800, 
                                color: 'white' 
                            }}>
                                {initials}
                            </div>
                        )}
                        {creator.isVerified && (
                            <div style={{ 
                                position: 'absolute', 
                                bottom: '-4px', 
                                right: '-4px', 
                                background: 'var(--success)', 
                                color: 'white', 
                                borderRadius: '50%', 
                                width: '20px', 
                                height: '20px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '10px',
                                border: '2px solid #0f0f15'
                            }}>
                                <Icons.check size={10} strokeWidth={4} />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                                {profileTypeIcon(creator.profileType)}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)' }}>{creator.displayName}</h3>
                        </div>
                        {creator.isStub && (
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>Registry Contributor</span>
                        )}
                    </div>
                </div>

                {creator.bio && (
                    <p style={{ 
                        margin: 0, 
                        fontSize: '0.9rem', 
                        lineHeight: '1.5', 
                        color: 'var(--text-muted)', 
                        display: '-webkit-box', 
                        WebkitLineClamp: 2, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden' 
                    }}>
                        {creator.bio}
                    </p>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <div style={{ 
                            flex: 1, 
                            background: 'rgba(0,0,0,0.2)', 
                            padding: 'var(--space-2) var(--space-3)', 
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-bright)' }}>{creator.authoredCount || 0}</span>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Authored</span>
                        </div>
                        <div style={{ 
                            flex: 1, 
                            background: 'rgba(0,0,0,0.2)', 
                            padding: 'var(--space-2) var(--space-3)', 
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-bright)' }}>{creator.curatedCount || 0}</span>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Curated</span>
                        </div>
                    </div>

                    {creator.tags && creator.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {creator.tags.slice(0, 3).map(t => (
                                <span key={t} style={{ 
                                    fontSize: '10px', 
                                    padding: '2px 8px', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '100px', 
                                    color: 'var(--text-muted)',
                                    fontWeight: 500
                                }}>
                                    #{t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
