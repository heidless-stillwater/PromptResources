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
import Modal from '@/components/Modal';
import DedupModal from '@/components/DedupModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { SkeletonGrid } from '@/components/ui/Skeleton';

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
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    
    const [resources, setResources] = useState<Resource[]>(initialResources);
    const [loading, setLoading] = useState(false);
    const [dedupOpen, setDedupOpen] = useState(false);

    // Auth guard and private scoping
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
        }
    }, [user, authLoading, router]);
    
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        isDanger?: boolean;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        onConfirm: () => {},
    });

    const [isDeleting, setIsDeleting] = useState(false);
    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
    
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
        // Only use initialResources if we're an admin, otherwise we want to rely on the background fetch which scopes to user
        if (isAdmin) {
            setResources(initialResources);
        } else {
            setResources([]);
        }
        setCurrentPage(parseInt(searchParams.get('page') || '1'));
        setLoading(false);

        // Handle post-deletion focus restoration from detail page
        const deletedId = sessionStorage.getItem('deletedResourceId');
        if (deletedId) {
            sessionStorage.removeItem('deletedResourceId');
            const index = initialResources.findIndex(r => r.id === deletedId);
            if (index !== -1) {
                const previousItem = initialResources[index - 1] || initialResources[index + 1];
                setResources(prev => prev.filter(r => r.id !== deletedId));
                router.refresh();
                if (previousItem) {
                    setTimeout(() => {
                        const el = document.getElementById(`resource-card-${previousItem.id}`);
                        if (el) {
                            el.focus();
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 300);
                }
            }
        }
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

    // Background fetch to ensure latest data (especially after redirects from creation)
    const backgroundFetch = useCallback(async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const params = new URLSearchParams(searchParams.toString());
            
            // Scope to current user unless they are admin managing everything
            if (!isAdmin) {
                params.set('addedBy', user.uid);
            }

            const response = await fetch(`/api/resources?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setResources(result.data);
            }
        } catch (error) {
            console.error('Error background fetching resources:', error);
        }
    }, [user, searchParams, isAdmin]);

    // Perform refetch on mount to apply user scoping
    useEffect(() => {
        if (user) {
            backgroundFetch();
        }
    }, [user, searchParams, backgroundFetch]);

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

    const handleToggleFavorite = async (e: React.MouseEvent, resourceId: string, currentStatus: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        // Optimistic update
        setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isFavorite: !currentStatus } : r));

        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isFavorite: !currentStatus }),
            });
            const result = await response.json();
            if (!result.success) {
                // Revert
                setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isFavorite: currentStatus } : r));
                console.error('Error toggling favorite:', result.error);
            }
        } catch (error) {
            // Revert
            setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isFavorite: currentStatus } : r));
            console.error('Error toggling favorite:', error);
        }
    };

    const handleDeleteResource = async (e: React.MouseEvent, resourceId: string) => {
        e.preventDefault();
        e.stopPropagation();

        setConfirmModal({
            isOpen: true,
            title: 'Delete Resource',
            message: 'Are you sure you want to delete this resource? This action cannot be undone.',
            confirmText: 'Delete',
            isDanger: true,
            onConfirm: async () => {
                try {
                    const token = await user?.getIdToken();
                    const res = await fetch(`/api/resources/${resourceId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (res.ok) {
                        const index = resources.findIndex(r => r.id === resourceId);
                        const previousItem = resources[index - 1] || resources[index + 1];
                        
                        setResources(prev => prev.filter(r => r.id !== resourceId));
                        router.refresh();
                        
                        if (previousItem) {
                            setTimeout(() => {
                                const el = document.getElementById(`resource-card-${previousItem.id}`);
                                if (el) {
                                    el.focus();
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            }, 100);
                        }
                    } else {
                        const data = await res.json();
                        alert(`Failed to delete resource: ${data.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Error deleting resource:', error);
                    alert('An error occurred while deleting.');
                } finally {
                    closeConfirmModal();
                }
            }
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
                            {isAdmin && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setDedupOpen(true)} id="dedup-btn">
                                    🔍 Dedup
                                </button>
                            )}
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
                        <div style={{ paddingTop: '1rem' }}>
                            <SkeletonGrid count={8} columns={4} aspectRatio="16/9" />
                        </div>
                    ) : resources.length === 0 ? (
                        <Card variant="glass" className="flex flex-col items-center justify-center py-20 text-center bg-background-secondary/20 border-dashed border-2">
                            <div className="w-20 h-20 rounded-full bg-background-secondary flex items-center justify-center mb-6">
                                <Icons.search className="w-10 h-10 text-foreground-muted opacity-20" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">No resources found</h3>
                            <p className="text-foreground-muted mb-8 max-w-xs mx-auto">
                                Try adjusting your filters or search terms to discover new architectural templates.
                            </p>
                            <Button 
                                variant="secondary" 
                                className="font-bold"
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
                            </Button>
                        </Card>
                    ) : (
                        <div className="resource-grid">
                            {resources.map((resource) => (
                                <ResourceCard
                                    key={resource.id}
                                    resource={resource}
                                    savedIds={savedIds}
                                    onToggleSave={handleToggleSave}
                                    onDelete={handleDeleteResource}
                                    onToggleFavorite={handleToggleFavorite}
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

            {/* Dedup Modal */}
            <DedupModal isOpen={dedupOpen} onClose={() => setDedupOpen(false)} />

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDanger={confirmModal.isDanger}
            />
        </div>
    );
}
