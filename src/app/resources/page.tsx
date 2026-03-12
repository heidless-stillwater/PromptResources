'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { Resource, Platform, ResourcePricing, ResourceType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getYouTubeThumbnail, extractYouTubeId, isYouTubeUrl, isGenericYouTubeName, deduplicateCredits } from '@/lib/youtube';

function ResourcesContent() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [resources, setResources] = useState<Resource[]>([]);
    const [savedResourceIds, setSavedResourceIds] = useState<Set<string>>(new Set());
    const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [platformFilter, setPlatformFilter] = useState<string>(searchParams.get('platform') || '');
    const [pricingFilter, setPricingFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [allCategories, setAllCategories] = useState<string[]>([]);
    const [featuredOnly, setFeaturedOnly] = useState(false);
    const [sortBy, setSortBy] = useState<string>('updatedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        async function fetchResources() {
            setLoading(true);
            try {
                const response = await fetch(`/api/resources?pageSize=100&sortBy=${sortBy}&sortOrder=${sortOrder}`);
                const result = await response.json();

                if (result.success) {
                    const data: Resource[] = result.data.map((r: any) => ({
                        ...r,
                        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                        updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
                    }));
                    setResources(data);

                    // Extract unique categories
                    const cats = new Set<string>();
                    data.forEach((r) => r.categories?.forEach((c) => cats.add(c)));
                    setAllCategories(Array.from(cats).sort());
                } else {
                    console.error('API Error:', result.error);
                }
            } catch (error) {
                console.error('Error fetching resources:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchResources();

        async function fetchSavedResources() {
            if (!user) return;
            try {
                const response = await fetch(`/api/user-resources?uid=${user.uid}`);
                const result = await response.json();
                if (result.success) {
                    setSavedResourceIds(new Set(result.data.savedResources || []));
                }
            } catch (error) {
                console.error('Error fetching saved resources:', error);
            }
        }
        fetchSavedResources();
    }, [sortBy, sortOrder, user]);

    const applyFilters = useCallback(() => {
        let filtered = [...resources];

        if (search) {
            const term = search.toLowerCase();
            filtered = filtered.filter((r) =>
                r.title.toLowerCase().includes(term) ||
                r.description?.toLowerCase().includes(term) ||
                r.tags?.some((t) => t.toLowerCase().includes(term))
            );
        }

        if (platformFilter) {
            filtered = filtered.filter((r) => r.platform === platformFilter);
        }

        if (pricingFilter) {
            filtered = filtered.filter((r) => r.pricing === pricingFilter);
        }

        if (typeFilter) {
            filtered = filtered.filter((r) => r.type === typeFilter);
        }

        if (categoryFilter) {
            filtered = filtered.filter((r) => r.categories?.includes(categoryFilter));
        }

        if (featuredOnly) {
            filtered = filtered.filter((r) => r.isFavorite);
        }

        setFilteredResources(filtered);
    }, [resources, search, platformFilter, pricingFilter, typeFilter, categoryFilter, featuredOnly]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const platforms: Platform[] = ['gemini', 'nanobanana', 'chatgpt', 'claude', 'midjourney', 'general', 'other'];
    const pricings: ResourcePricing[] = ['free', 'paid', 'freemium'];
    const types: ResourceType[] = ['video', 'article', 'tool', 'course', 'book', 'tutorial', 'other'];

    const handleToggleSave = async (e: React.MouseEvent, resourceId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) {
            router.push('/auth/login');
            return;
        }

        const isCurrentlySaved = savedResourceIds.has(resourceId);

        // Optimistic update
        const newSavedIds = new Set(savedResourceIds);
        if (isCurrentlySaved) {
            newSavedIds.delete(resourceId);
        } else {
            newSavedIds.add(resourceId);
        }
        setSavedResourceIds(newSavedIds);

        try {
            const response = await fetch('/api/user-resources', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    resourceId,
                    action: isCurrentlySaved ? 'unsave' : 'save'
                }),
            });

            const result = await response.json();
            if (!result.success) {
                // Rollback if failed
                setSavedResourceIds(savedResourceIds);
                console.error('Failed to update saved status:', result.error);
            }
        } catch (error) {
            // Rollback if failed
            setSavedResourceIds(savedResourceIds);
            console.error('Error updating saved status:', error);
        }
    };

    return (
        <div className="page-wrapper">
            <Navbar />

            <div className="main-content">
                <div className="container">
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)',
                    }}>
                        <div>
                            <h1 style={{ marginBottom: 'var(--space-2)' }}>📚 Resources</h1>
                            <p style={{ color: 'var(--text-muted)' }}>
                                {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} found
                            </p>
                        </div>
                        {user && (
                            <Link href="/resources/new" className="btn btn-primary" id="add-resource-btn">
                                ➕ Add Resource
                            </Link>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="filter-bar" id="resource-filters">
                        <div className="search-input-wrapper">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search resources..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                id="resource-search"
                            />
                        </div>

                        <select
                            className="form-select"
                            value={platformFilter}
                            onChange={(e) => setPlatformFilter(e.target.value)}
                            id="filter-platform"
                        >
                            <option value="">All Platforms</option>
                            {platforms.map((p) => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={pricingFilter}
                            onChange={(e) => setPricingFilter(e.target.value)}
                            id="filter-pricing"
                        >
                            <option value="">All Pricing</option>
                            {pricings.map((p) => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            id="filter-type"
                        >
                            <option value="">All Types</option>
                            {types.map((t) => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            id="filter-category"
                        >
                            <option value="">All Categories</option>
                            {allCategories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <button
                            className={`btn ${featuredOnly ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFeaturedOnly(!featuredOnly)}
                            id="filter-featured"
                            style={{ gap: 'var(--space-2)' }}
                        >
                            {featuredOnly ? '⭐ Featured' : '☆ All'}
                        </button>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                            <select
                                className="form-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                id="sort-by"
                                style={{ minWidth: '140px' }}
                            >
                                <option value="createdAt">Date Created</option>
                                <option value="updatedAt">Date Updated</option>
                                <option value="title">Title</option>
                                <option value="rank">Rank / Priority</option>
                            </select>

                            <button
                                className="btn btn-secondary"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                id="toggle-sort-order"
                                title={sortOrder === 'asc' ? 'Sorted Ascending' : 'Sorted Descending'}
                                style={{ padding: '0 var(--space-3)', fontSize: '1.2rem' }}
                            >
                                {sortOrder === 'asc' ? '🔼' : '🔽'}
                            </button>
                        </div>
                    </div>

                    {/* Resource Grid */}
                    {loading ? (
                        <div className="loading-page">
                            <div className="spinner" />
                            <div className="loading-text">Loading resources...</div>
                        </div>
                    ) : filteredResources.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <div className="empty-state-title">No resources found</div>
                            <div className="empty-state-desc">
                                {search || platformFilter || pricingFilter || typeFilter || categoryFilter
                                    ? 'Try adjusting your filters'
                                    : 'No resources have been added yet'}
                            </div>
                            {user && (
                                <Link href="/resources/new" className="btn btn-primary">
                                    ➕ Add First Resource
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="resource-grid">
                            {filteredResources.map((resource) => {
                                const ytId = resource.youtubeVideoId || (resource.mediaFormat === 'youtube' ? extractYouTubeId(resource.url) : null);

                                return (
                                    <Link
                                        href={`/resources/${resource.id}`}
                                        key={resource.id}
                                        className="resource-card"
                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                        id={`resource-${resource.id}`}
                                    >
                                        <div className="resource-card-thumb">
                                            {ytId ? (
                                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                    <Image
                                                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                                        alt={resource.title}
                                                        fill
                                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                </div>
                                            ) : (
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '2.5rem',
                                                    background: 'var(--gradient-glass)',
                                                }}>
                                                    {resource.type === 'video' ? '▶️' :
                                                        resource.type === 'article' ? '📄' :
                                                            resource.type === 'tool' ? '🔧' :
                                                                resource.type === 'course' ? '🎓' :
                                                                    resource.type === 'book' ? '📖' :
                                                                        resource.type === 'tutorial' ? '📝' : '📚'}
                                                </div>
                                            )}
                                            <div className="resource-card-pricing">
                                                {resource.isFavorite && (
                                                    <span className="badge badge-warning" style={{ marginRight: 'var(--space-1)', fontSize: '1rem' }} title="Featured Resource">
                                                        ⭐
                                                    </span>
                                                )}
                                                <span className={`badge badge-${resource.pricing}`}>
                                                    {resource.pricing}
                                                </span>
                                            </div>
                                            <button
                                                className={`btn ${savedResourceIds.has(resource.id) ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={(e) => handleToggleSave(e, resource.id)}
                                                style={{
                                                    position: 'absolute',
                                                    top: 'var(--space-3)',
                                                    left: 'var(--space-3)',
                                                    padding: 'var(--space-1) var(--space-2)',
                                                    fontSize: '1.1rem',
                                                    zIndex: 10,
                                                    borderRadius: 'var(--radius-full)',
                                                    width: '32px',
                                                    height: '32px',
                                                    background: savedResourceIds.has(resource.id) ? 'var(--gradient-primary)' : 'rgba(0,0,0,0.4)',
                                                    border: 'none',
                                                }}
                                                title={savedResourceIds.has(resource.id) ? "Unsave resource" : "Save for later"}
                                            >
                                                {savedResourceIds.has(resource.id) ? '⭐' : '☆'}
                                            </button>
                                            {resource.rank && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 'var(--space-2)',
                                                    left: 'var(--space-2)',
                                                    background: 'rgba(0,0,0,0.6)',
                                                    color: 'white',
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: 'var(--text-xs)',
                                                    fontWeight: 'bold',
                                                    zIndex: 1,
                                                }}>
                                                    #{resource.rank}
                                                </div>
                                            )}
                                        </div>

                                        <div className="resource-card-body">
                                            <div className="resource-card-title">{resource.title}</div>
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
                                                {deduplicateCredits(resource.credits || []).map((c) => {
                                                    if (isGenericYouTubeName(c.name) && resource.url && isYouTubeUrl(resource.url)) {
                                                        return { ...c, name: 'YouTube' };
                                                    }
                                                    return c;
                                                }).map(c => c.name).join(', ') || 'Community'}
                                            </div>
                                            <span style={{
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--text-muted)',
                                            }}>
                                                {resource.type}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
}

export default function ResourcesPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                </div>
            </div>
        }>
            <ResourcesContent />
        </Suspense>
    );
}
