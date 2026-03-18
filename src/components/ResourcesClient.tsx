'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ResourceCard from '@/components/ResourceCard';
import FilterBar from '@/components/FilterBar';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ResourcesClientProps {
    initialResources: Resource[];
    initialCategories: string[];
    totalResources: number;
    hasMoreInitial: boolean;
}

export default function ResourcesClient({ 
    initialResources, 
    initialCategories,
    totalResources,
    hasMoreInitial 
}: ResourcesClientProps) {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    
    const [resources, setResources] = useState<Resource[]>(initialResources);
    const [loading, setLoading] = useState(false);
    
    // Filters (managed in state for UI, syncs to URL)
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [platformFilter, setPlatformFilter] = useState(searchParams.get('platform') || '');
    const [pricingFilter, setPricingFilter] = useState(searchParams.get('pricing') || '');
    const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
    const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
    const [featuredOnly, setFeaturedOnly] = useState(searchParams.get('isFavorite') === 'true');
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'updatedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'desc');
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== (searchParams.get('search') || '')) {
                applyFilters();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Sync state from server props when they change (initial load or navigation)
    useEffect(() => {
        setResources(initialResources);
        setCurrentPage(parseInt(searchParams.get('page') || '1'));
        setLoading(false);
    }, [initialResources, searchParams]);

    // Fetch saved resources for the current user
    const { data: savedIds = new Set<string>() } = useQuery({
        queryKey: ['savedResources', user?.uid],
        queryFn: async () => {
            if (!user) return new Set<string>();
            const response = await fetch(`/api/user-resources?uid=${user.uid}`);
            const result = await response.json();
            return new Set<string>(result.data?.savedResources || []);
        },
        enabled: !!user,
    });

    // Apply filters via URL navigation (Server-side filtering strategy)
    const applyFilters = useCallback(() => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (platformFilter) params.set('platform', platformFilter);
        if (pricingFilter) params.set('pricing', pricingFilter);
        if (typeFilter) params.set('type', typeFilter);
        if (categoryFilter) params.set('category', categoryFilter);
        if (featuredOnly) params.set('isFavorite', 'true');
        if (sortBy) params.set('sortBy', sortBy);
        if (sortOrder) params.set('sortOrder', sortOrder);
        
        // Reset to page 1 on filter change
        setCurrentPage(1);

        setLoading(true);
        router.push(`/resources?${params.toString()}`);
        setLoading(false);
    }, [router, search, platformFilter, pricingFilter, typeFilter, categoryFilter, featuredOnly, sortBy, sortOrder]);

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', newPage.toString());
        
        setLoading(true);
        router.push(`/resources?${params.toString()}`);
    };

    // Debt: In a real "snappy" UI, we'd debounce the search input
    // For now, let's trigger applyFilters on "Enter" or Blur for search, and on change for select
    
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    };

    const toggleSaveMutation = useMutation({
        mutationFn: async ({ resourceId, action }: { resourceId: string, action: 'save' | 'unsave' }) => {
            if (!user) throw new Error('Not authenticated');
            const response = await fetch('/api/user-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, resourceId, action }),
            });
            return response.json();
        },
        onMutate: async ({ resourceId, action }) => {
            await queryClient.cancelQueries({ queryKey: ['savedResources', user?.uid] });
            const previousSavedIds = queryClient.getQueryData<Set<string>>(['savedResources', user?.uid]);
            
            queryClient.setQueryData(['savedResources', user?.uid], (old: Set<string> | undefined) => {
                const next = new Set(old || []);
                if (action === 'save') next.add(resourceId);
                else next.delete(resourceId);
                return next;
            });

            return { previousSavedIds };
        },
        onError: (err, variables, context) => {
            if (context?.previousSavedIds) {
                queryClient.setQueryData(['savedResources', user?.uid], context.previousSavedIds);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['savedResources', user?.uid] });
        }
    });

    const handleToggleSave = (e: React.MouseEvent, resourceId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) {
            router.push('/auth/login');
            return;
        }

        const isCurrentlySaved = savedIds.has(resourceId);
        toggleSaveMutation.mutate({ 
            resourceId, 
            action: isCurrentlySaved ? 'unsave' : 'save' 
        });
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
                            {searchParams.get('suggested') === 'true' && (
                                <div className="badge badge-success" style={{ padding: 'var(--space-2) var(--space-4)', width: '100%', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', display: 'block', textAlign: 'center' }}>
                                    ✨ Your suggestion has been submitted for review! Thank you for contributing.
                                </div>
                            )}
                            <h1 style={{ marginBottom: 'var(--space-2)' }}>📚 Resources</h1>
                            <p style={{ color: 'var(--text-muted)' }}>
                                {totalResources} resource{totalResources !== 1 ? 's' : ''} found
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <div className="search-input-wrapper">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search resources..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    onBlur={applyFilters}
                                    id="resource-search"
                                />
                            </div>
                            {user && (
                                <Link href="/resources/new" className="btn btn-primary" id="add-resource-btn">
                                    ➕ Add Resource
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Filters */}
                    <FilterBar
                        platformFilter={platformFilter}
                        setPlatformFilter={setPlatformFilter}
                        pricingFilter={pricingFilter}
                        setPricingFilter={setPricingFilter}
                        typeFilter={typeFilter}
                        setTypeFilter={setTypeFilter}
                        categoryFilter={categoryFilter}
                        setCategoryFilter={setCategoryFilter}
                        featuredOnly={featuredOnly}
                        setFeaturedOnly={setFeaturedOnly}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        onApply={applyFilters}
                        initialCategories={initialCategories}
                    />

                    {/* Resource Grid */}
                    {loading ? (
                        <div className="loading-page">
                            <div className="spinner" />
                            <div className="loading-text">Loading resources...</div>
                        </div>
                    ) : resources.length === 0 ? (
                        <div style={{
                            padding: 'var(--space-12) var(--space-4)',
                            textAlign: 'center',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px dashed rgba(255, 255, 255, 0.1)',
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🔍</div>
                            <h3>No resources found</h3>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Try adjusting your filters or search terms.
                            </p>
                            <button
                                className="btn btn-secondary"
                                style={{ marginTop: 'var(--space-4)' }}
                                onClick={() => {
                                    setSearch('');
                                    setPlatformFilter('');
                                    setPricingFilter('');
                                    setTypeFilter('');
                                    setCategoryFilter('');
                                    setFeaturedOnly(false);
                                    applyFilters();
                                }}
                            >
                                Clear All Filters
                            </button>
                        </div>
                    ) : (
                        <div className="resource-grid">
                            {resources.map((resource) => (
                                <ResourceCard
                                    key={resource.id}
                                    resource={resource}
                                    savedIds={savedIds}
                                    onToggleSave={handleToggleSave}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalResources > 24 && !loading && (
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: 'var(--space-4)', 
                            marginTop: 'var(--space-12)',
                            marginBottom: 'var(--space-8)'
                        }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                ◀ Previous
                            </button>
                            
                            <div style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                                Page {currentPage} of {Math.ceil(totalResources / 24)}
                            </div>

                            <button 
                                className="btn btn-secondary" 
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={!hasMoreInitial}
                            >
                                Next ▶
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
}
