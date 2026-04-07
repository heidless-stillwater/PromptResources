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

interface Props {
    creator: UserProfile;
    initialResources: Resource[];
    stats: CreatorStats;
}

const socialIcon = (platform: CreatorSocial['platform']) => {
    const icons: Record<string, string> = {
        youtube: '▶',
        twitter: '𝕏',
        github: '⌥',
        linkedin: 'in',
        website: '🌐',
        other: '↗',
    };
    return icons[platform] || '↗';
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
            <div className="main-content">
                <div className="container">
                    <div className="creator-profile-root">
                        {/* ── HERO BANNER ── */}
                        <div
                            className="creator-hero"
                            style={{
                                backgroundImage: currentBanner
                                    ? `url(${currentBanner})`
                                    : 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
                            }}
                        >
                            <div className="creator-hero-overlay" />
                            
                            {isAuthorized && (
                                <button 
                                    className="btn btn-xs btn-glass creator-edit-header-btn"
                                    onClick={() => setIsEditingHeader(true)}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? '⌛ Updating...' : '🖼️ Edit Header'}
                                </button>
                            )}

                            <div className="creator-hero-content">

                                {/* Avatar */}
                                <div className="creator-avatar-wrap">
                                    {creator.photoURL ? (
                                        <img
                                            src={creator.photoURL}
                                            alt={creator.displayName}
                                            className="creator-avatar-img"
                                        />
                                    ) : (
                                        <div className="creator-avatar-fallback">{initials}</div>
                                    )}
                                    {creator.isVerified && (
                                        <span className="creator-verified-badge" title="Verified Creator">✓</span>
                                    )}
                                </div>

                                {/* Name + badges */}
                                <div className="creator-hero-meta">
                                    <div className="creator-hero-badges">
                                        <span
                                            className="creator-type-badge"
                                            style={{ background: badge.color + '26', color: badge.color, borderColor: badge.color + '60' }}
                                        >
                                            {badge.label}
                                        </span>
                                        {creator.isStub && (
                                            <span className="creator-stub-badge">External Creator</span>
                                        )}
                                        {creator.isFeatured && (
                                            <span className="creator-featured-badge">⭐ Featured</span>
                                        )}
                                    </div>
                                    <h1 className="creator-hero-name">{creator.displayName}</h1>
                                    {creator.bio && <p className="creator-hero-bio">{creator.bio}</p>}
                                </div>

                                {/* Social links */}
                                {creator.socials && creator.socials.length > 0 && (
                                    <div className="creator-socials">
                                        {creator.socials.map((s, i) => (
                                            <a
                                                key={i}
                                                href={s.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="creator-social-pill"
                                                title={s.label || s.platform}
                                            >
                                                <span className="creator-social-icon">{socialIcon(s.platform)}</span>
                                                <span className="creator-social-label">{s.label || s.platform}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── STATS ROW ── */}
                        <div className="creator-stats-row">
                            <div className="creator-stat-chip">
                                <span className="creator-stat-value">{stats.totalResources}</span>
                                <span className="creator-stat-label">Resources</span>
                            </div>
                            <div className="creator-stat-chip">
                                <span className="creator-stat-value">{stats.categories.length}</span>
                                <span className="creator-stat-label">Categories</span>
                            </div>
                            <div className="creator-stat-chip">
                                <span className="creator-stat-value">{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}</span>
                                <span className="creator-stat-label">Avg Rating</span>
                            </div>
                            <div className="creator-stat-chip">
                                <span className="creator-stat-value">{stats.platforms.length}</span>
                                <span className="creator-stat-label">Platforms</span>
                            </div>
                        </div>

                        {/* ── EXPERTISE TAGS ── */}
                        {creator.tags && creator.tags.length > 0 && (
                            <div className="creator-tags-section">
                                <h2 className="creator-section-title">Expertise</h2>
                                <div className="creator-tags-cloud">
                                    {creator.tags.map(tag => (
                                        <Link
                                            key={tag}
                                            href={`/resources?tag=${encodeURIComponent(tag)}`}
                                            className="creator-tag-pill"
                                        >
                                            #{tag}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── RESOURCES GRID ── */}
                        <div className="creator-resources-section">
                            <div className="creator-resources-header-toolbar">
                                <div className="creator-resources-header-main">
                                    <h2 className="creator-section-title">Resources</h2>
                                    <div className="creator-tabs-minimal">
                                        <button
                                            className={`creator-tab-min${activeTab === 'authored' ? ' active' : ''}`}
                                            onClick={() => { setActiveTab('authored'); setCurrentPage(1); }}
                                        >
                                            Authored ({initialResources.filter(r => r.attributions?.some(a => a.userId === creator.uid && a.role !== 'curator')).length})
                                        </button>
                                        <button
                                            className={`creator-tab-min${activeTab === 'curated' ? ' active' : ''}`}
                                            onClick={() => { setActiveTab('curated'); setCurrentPage(1); }}
                                        >
                                            Curated ({initialResources.filter(r => r.addedBy === creator.uid || r.attributions?.some(a => a.userId === creator.uid && a.role === 'curator')).length})
                                        </button>
                                    </div>
                                </div>

                                <div className="creator-pagination-controls">
                                    <div className="page-size-selector">
                                        <span className="selector-label">Show</span>
                                        {[20, 50, 100, 'all'].map(size => (
                                            <button
                                                key={size}
                                                className={`size-btn${pageSize === size ? ' active' : ''}`}
                                                onClick={() => { setPageSize(size as any); setCurrentPage(1); }}
                                            >
                                                {size === 'all' ? 'All' : size}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {!isAll && totalPages > 1 && (
                                        <div className="pagination-nav">
                                            <button 
                                                className="nav-btn" 
                                                disabled={safeCurrentPage === 1}
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            >
                                                Previous
                                            </button>
                                            <span className="page-info">
                                                Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
                                            </span>
                                            <button 
                                                className="nav-btn" 
                                                disabled={safeCurrentPage === totalPages}
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {filteredResources.length === 0 ? (
                                <div className="creator-empty-state">
                                    <span className="creator-empty-icon">📭</span>
                                    <p>No resources found in this category.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="creator-resources-grid">
                                        {paginatedResources.map(resource => (
                                            <ResourceCard key={resource.id} resource={resource} />
                                        ))}
                                    </div>

                                    {!isAll && totalPages > 1 && (
                                        <div className="creator-pagination-footer">
                                            <div className="creator-pagination-controls" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-8)' }}>
                                                <div className="page-size-selector">
                                                    <span className="selector-label">Show</span>
                                                    {[20, 50, 100, 'all'].map(size => (
                                                        <button
                                                            key={size}
                                                            className={`size-btn${pageSize === size ? ' active' : ''}`}
                                                            onClick={() => { 
                                                                setPageSize(size as any); 
                                                                setCurrentPage(1);
                                                                window.scrollTo({ top: document.querySelector('.creator-resources-section')?.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                                                            }}
                                                        >
                                                            {size === 'all' ? 'All' : size}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="pagination-nav">
                                                    <button 
                                                        className="nav-btn" 
                                                        disabled={safeCurrentPage === 1}
                                                        onClick={() => {
                                                            setCurrentPage(prev => Math.max(1, prev - 1));
                                                            window.scrollTo({ top: document.querySelector('.creator-resources-section')?.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                                                        }}
                                                    >
                                                        Previous
                                                    </button>
                                                    <div className="page-numbers">
                                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                                            <button 
                                                                key={num}
                                                                className={`page-num-btn${safeCurrentPage === num ? ' active' : ''}`}
                                                                onClick={() => {
                                                                    setCurrentPage(num);
                                                                    window.scrollTo({ top: document.querySelector('.creator-resources-section')?.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                                                                }}
                                                            >
                                                                {num}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button 
                                                        className="nav-btn" 
                                                        disabled={safeCurrentPage === totalPages}
                                                        onClick={() => {
                                                            setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                                            window.scrollTo({ top: document.querySelector('.creator-resources-section')?.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                                                        }}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />

            <ThumbnailPicker 
                isOpen={isEditingHeader}
                onClose={() => setIsEditingHeader(false)}
                onSelect={handleBannerSelect}
            />
        </div>
    );
}
