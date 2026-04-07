'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UserProfile, Resource, CreatorSocial } from '@/lib/types';
import { CreatorStats } from '@/lib/creators-server';
import ResourceCard from '@/components/ResourceCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ThumbnailPicker from '@/components/ThumbnailPicker';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Icons } from '@/components/ui/Icons';

interface Props {
    creator: UserProfile;
    initialResources: Resource[];
    stats: CreatorStats;
}

const socialIcon = (platform: CreatorSocial['platform']) => {
    switch (platform) {
        case 'youtube': return <Icons.play size={14} />;
        case 'twitter': return <Icons.twitter size={14} />;
        case 'github': return <Icons.database size={14} />; // Or generic code icon
        case 'linkedin': return <Icons.user size={14} />;
        case 'website': return <Icons.globe size={14} />;
        default: return <Icons.external size={14} />;
    }
};

const profileTypeBadge = (type?: string) => {
    const map: Record<string, { label: string; color: string }> = {
        individual: { label: 'Creator', color: '#6C63FF' },
        channel: { label: 'Channel', color: '#FF4D6D' },
        organization: { label: 'Organization', color: '#0CB8B6' },
    };
    return map[type || 'individual'] || map.individual;
};

export default function CreatorProfileClient({ creator, initialResources, stats }: Props) {
    const [activeTab, setActiveTab] = useState<'authored' | 'curated'>('curated');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number | 'all'>(50);
    const [isEditingHeader, setIsEditingHeader] = useState(false);
    const [currentBanner, setCurrentBanner] = useState(creator.bannerUrl);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const badge = profileTypeBadge(creator.profileType);

    // Check if current user is the profile owner or an admin
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Simplified: check if UID matches or if user has admin role (optional)
                const isOwner = user.uid === creator.uid;
                setIsAuthorized(isOwner);
            } else {
                setIsAuthorized(false);
            }
        });
        return () => unsubscribe();
    }, [creator.uid]);

    const handleBannerSelect = async (url: string) => {
        try {
            setIsUpdating(true);
            const userRef = doc(db, 'users', creator.uid);
            await updateDoc(userRef, {
                bannerUrl: url,
                updatedAt: new Date()
            });
            setCurrentBanner(url);
            setIsEditingHeader(false);
        } catch (error) {
            console.error('Error updating banner:', error);
            alert('Failed to update banner image.');
        } finally {
            setIsUpdating(false);
        }
    };

    // Filter resources based on active tab
    const filteredResources = initialResources.filter(resource => {
        if (activeTab === 'authored') {
            return resource.attributions?.some(a => a.userId === creator.uid && a.role !== 'curator');
        } else {
            return resource.addedBy === creator.uid || resource.attributions?.some(a => a.userId === creator.uid && a.role === 'curator');
        }
    });

    // Pagination logic
    const totalItems = filteredResources.length;
    const isAll = pageSize === 'all';
    const effectivePageSize = isAll ? totalItems : pageSize;
    const totalPages = isAll ? 1 : Math.ceil(totalItems / effectivePageSize);
    
    // Ensure current page is valid after tab/pageSize change
    const safeCurrentPage = Math.min(currentPage, totalPages || 1);
    
    const paginatedResources = isAll 
        ? filteredResources 
        : filteredResources.slice((safeCurrentPage - 1) * effectivePageSize, safeCurrentPage * effectivePageSize);

    const initials = creator.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="page-wrapper dashboard-theme">
            <Navbar />
            
            <main className="main-content">
                <div className="container">
                    <div className="creator-profile-root">
                        
                        {/* ── CINEMATIC HERO SECTION ── */}
                        <section className="creator-hero-ultra animate-fade-in" style={{
                            padding: 'var(--space-12) 0',
                            marginBottom: 'var(--space-8)',
                            position: 'relative',
                            backgroundImage: currentBanner
                                ? `linear-gradient(to bottom, rgba(15, 12, 41, 0.7), rgba(15, 12, 41, 0.9)), url(${currentBanner})`
                                : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            borderRadius: 'var(--radius-2xl)',
                            overflow: 'hidden'
                        }}>
                            {/* Ambient Glow (Fallback if no banner) */}
                            {!currentBanner && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '100%',
                                    height: '100%',
                                    background: 'radial-gradient(circle at center, rgba(108, 99, 255, 0.1) 0%, rgba(15, 12, 41, 0.4) 70%)',
                                    pointerEvents: 'none',
                                    zIndex: 0
                                }} />
                            )}

                            {isAuthorized && (
                                <button 
                                    className="btn btn-xs btn-glass"
                                    style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}
                                    onClick={() => setIsEditingHeader(true)}
                                    disabled={isUpdating}
                                >
                                    <Icons.image size={12} style={{ marginRight: '6px' }} />
                                    {isUpdating ? 'Updating...' : 'Change Cover'}
                                </button>
                            )}

                            <div className="creator-hero-inner" style={{ position: 'relative', zIndex: 2 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-6)' }}>
                                    
                                    {/* Elevated Avatar */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ 
                                            width: '128px', 
                                            height: '128px', 
                                            borderRadius: '32px', 
                                            padding: '4px',
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)',
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                            transform: 'rotate(-2deg)'
                                        }}>
                                            {creator.photoURL ? (
                                                <img 
                                                    src={creator.photoURL} 
                                                    alt={creator.displayName} 
                                                    style={{ width: '100%', height: '100%', borderRadius: '28px', objectFit: 'cover' }} 
                                                />
                                            ) : (
                                                <div style={{ 
                                                    width: '100%', 
                                                    height: '100%', 
                                                    borderRadius: '28px', 
                                                    background: 'linear-gradient(135deg, #6C63FF 0%, #3F3D56 100%)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    fontSize: '2.5rem', 
                                                    fontWeight: 800, 
                                                    color: 'white'
                                                }}>
                                                    {initials}
                                                </div>
                                            )}
                                        </div>
                                        {creator.isVerified && (
                                            <div style={{ 
                                                position: 'absolute', 
                                                bottom: '-8px', 
                                                right: '-8px', 
                                                background: 'var(--success)', 
                                                color: 'white', 
                                                borderRadius: '50%', 
                                                width: '32px', 
                                                height: '32px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                border: '4px solid #0f0f15',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                                            }} title="Verified Creator">
                                                <Icons.check size={16} strokeWidth={4} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="creator-identity">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                            <h1 style={{ fontSize: '3.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.04em', color: 'var(--text-bright)' }}>
                                                {creator.displayName}
                                            </h1>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                padding: '4px 12px', 
                                                background: badge.color + '22', 
                                                color: badge.color, 
                                                borderRadius: '100px', 
                                                fontWeight: 800, 
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.1em',
                                                border: `1px solid ${badge.color}44`
                                            }}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        
                                        {creator.bio && (
                                            <div className="glass-card" style={{ 
                                                maxWidth: '650px', 
                                                margin: 'var(--space-4) auto', 
                                                padding: 'var(--space-4) var(--space-8)',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: 'var(--radius-xl)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                backdropFilter: 'blur(10px)'
                                            }}>
                                                <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>{creator.bio}</p>
                                            </div>
                                        )}

                                        {/* Social Connectivity Hub */}
                                        {creator.socials && creator.socials.length > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                                                {creator.socials.map((s, i) => (
                                                    <a
                                                        key={i}
                                                        href={s.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="creator-social-pill"
                                                        style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '8px',
                                                            background: 'rgba(255,255,255,0.05)',
                                                            padding: 'var(--space-2) var(--space-5)',
                                                            borderRadius: '100px',
                                                            color: 'var(--text-bright)',
                                                            fontSize: 'var(--text-sm)',
                                                            fontWeight: 600,
                                                            transition: 'all 0.2s ease',
                                                            border: '1px solid rgba(255,255,255,0.05)',
                                                            textDecoration: 'none'
                                                        }}
                                                    >
                                                        {socialIcon(s.platform)}
                                                        <span style={{ textTransform: 'capitalize' }}>{s.label || s.platform}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── IMPACT STATS STRIP ── */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                            gap: 'var(--space-4)',
                            marginBottom: 'var(--space-12)'
                        }}>
                            {[
                                { label: 'Authored Resources', value: stats.authoredCount, icon: <Icons.wand size={20} />, color: 'var(--accent-primary)' },
                                { label: 'Curated Assets', value: stats.curatedCount, icon: <Icons.grid size={20} />, color: '#00C896' },
                                { label: 'Categories Mastered', value: stats.categories.length, icon: <Icons.tag size={20} />, color: 'var(--accent-yellow)' },
                                { label: 'Avg Community Rating', value: stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—', icon: <Icons.sparkles size={20} />, color: '#FF4D6D' }
                            ].map((stat, i) => (
                                <div key={i} className="glass-card" style={{ 
                                    padding: 'var(--space-6)', 
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ color: stat.color }}>{stat.icon}</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-bright)', lineHeight: 1 }}>{stat.value}</div>
                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 700 }}>{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* ── RESOURCE EXPLORER ── */}
                        <section className="creator-resources-section">
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'flex-end', 
                                marginBottom: 'var(--space-8)',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                paddingBottom: 'var(--space-4)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-bright)' }}>Contributions</h2>
                                    <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                                        {['authored', 'curated'].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }}
                                                style={{ 
                                                    background: 'none',
                                                    border: 'none',
                                                    color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                    fontSize: '1rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    padding: 'var(--space-2) 0',
                                                    position: 'relative',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {tab === 'authored' ? 'Authored' : 'Curated'}
                                                {activeTab === tab && (
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        bottom: '-17px', 
                                                        left: 0, 
                                                        width: '100%', 
                                                        height: '3px', 
                                                        background: 'var(--accent-primary)',
                                                        borderRadius: '100px'
                                                    }} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>PAGE SIZE</span>
                                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                                        {[20, 50, 'all'].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => { setPageSize(size as any); setCurrentPage(1); }}
                                                style={{ 
                                                    background: pageSize === size ? 'rgba(255,255,255,0.1)' : 'none',
                                                    border: 'none',
                                                    color: pageSize === size ? 'var(--text-bright)' : 'var(--text-muted)',
                                                    padding: '4px 12px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {size === 'all' ? 'ALL' : size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {filteredResources.length === 0 ? (
                                <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}><Icons.grid size={48} opacity={0.2} /></div>
                                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>No resources found in this collection.</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                                        gap: 'var(--space-6)',
                                        marginBottom: 'var(--space-8)'
                                    }}>
                                        {paginatedResources.map(resource => (
                                            <ResourceCard key={resource.id} resource={resource} />
                                        ))}
                                    </div>

                                    {!isAll && totalPages > 1 && (
                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-12)' }}>
                                            <div className="pagination-nav-ultra" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <button 
                                                    className="nav-btn-circle" 
                                                    disabled={safeCurrentPage === 1}
                                                    onClick={() => {
                                                        setCurrentPage(prev => Math.max(1, prev - 1));
                                                        window.scrollTo({ top: 300, behavior: 'smooth' });
                                                    }}
                                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'none', color: 'white', cursor: 'pointer', opacity: safeCurrentPage === 1 ? 0.3 : 1 }}
                                                >
                                                    <Icons.chevronLeft size={20} />
                                                </button>
                                                
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                                    <button 
                                                        key={num}
                                                        onClick={() => {
                                                            setCurrentPage(num);
                                                            window.scrollTo({ top: 300, behavior: 'smooth' });
                                                        }}
                                                        style={{ 
                                                            width: '40px', 
                                                            height: '40px', 
                                                            borderRadius: '50%', 
                                                            border: 'none', 
                                                            background: safeCurrentPage === num ? 'var(--accent-primary)' : 'none', 
                                                            color: 'white', 
                                                            cursor: 'pointer',
                                                            fontWeight: 700,
                                                            fontSize: '13px'
                                                        }}
                                                    >
                                                        {num}
                                                    </button>
                                                ))}

                                                <button 
                                                    className="nav-btn-circle" 
                                                    disabled={safeCurrentPage === totalPages}
                                                    onClick={() => {
                                                        setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                                        window.scrollTo({ top: 300, behavior: 'smooth' });
                                                    }}
                                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'none', color: 'white', cursor: 'pointer', opacity: safeCurrentPage === totalPages ? 0.3 : 1 }}
                                                >
                                                    <Icons.chevronRight size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </main>

            <Footer />

            <ThumbnailPicker 
                isOpen={isEditingHeader}
                onClose={() => setIsEditingHeader(false)}
                onSelect={handleBannerSelect}
            />
        </div>
    );
}
