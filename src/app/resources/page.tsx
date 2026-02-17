'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { Resource, Platform, ResourcePricing, ResourceType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getYouTubeThumbnail, extractYouTubeId } from '@/lib/youtube';

function ResourcesContent() {
    const { isAdmin } = useAuth();
    const searchParams = useSearchParams();
    const [resources, setResources] = useState<Resource[]>([]);
    const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [platformFilter, setPlatformFilter] = useState<string>(searchParams.get('platform') || '');
    const [pricingFilter, setPricingFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [allCategories, setAllCategories] = useState<string[]>([]);
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
    }, [sortBy, sortOrder]);

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

        setFilteredResources(filtered);
    }, [resources, search, platformFilter, pricingFilter, typeFilter, categoryFilter]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const platforms: Platform[] = ['gemini', 'nanobanana', 'chatgpt', 'claude', 'midjourney', 'general', 'other'];
    const pricings: ResourcePricing[] = ['free', 'paid', 'freemium'];
    const types: ResourceType[] = ['video', 'article', 'tool', 'course', 'book', 'tutorial', 'other'];

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
                        {isAdmin && (
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
                            {isAdmin && (
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
                                                <span className={`badge badge-${resource.pricing}`}>
                                                    {resource.pricing}
                                                </span>
                                            </div>
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
                                                {resource.credits?.map((c) => c.name).join(', ') || 'Community'}
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
