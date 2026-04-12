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
    initialCategories: { id: string; name: string; slug: string }[];
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
    const [priorityRank, setPriorityRank] = useState(searchParams.get('priorityRank') || '');
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'updatedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'desc');
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
    const [pageSize, setPageSize] = useState(parseInt(searchParams.get('pageSize') || '24'));
    const [selectedCreators, setSelectedCreators] = useState<string[]>(
        searchParams.get('creators') ? searchParams.get('creators')!.split(',').filter(Boolean) : []
    );
    const [registryActive, setRegistryActive] = useState(searchParams.get('registryActive') !== 'false');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'small'>('grid');

    // Unified filter sync to URL — now a stable function called by interactions
    // This prevents circular dependency loops with searchParams
    const syncFilters = useCallback((newFilters: any) => {
        const params = new URLSearchParams(searchParams.toString());
        
        // Map UI state keys to URL param keys
        if (newFilters.search !== undefined) {
            if (newFilters.search) params.set('search', newFilters.search);
            else params.delete('search');
        }
        if (newFilters.platformFilter !== undefined) {
            if (newFilters.platformFilter) params.set('platform', newFilters.platformFilter);
            else params.delete('platform');
        }
        if (newFilters.pricingFilter !== undefined) {
            if (newFilters.pricingFilter) params.set('pricing', newFilters.pricingFilter);
            else params.delete('pricing');
        }
        if (newFilters.typeFilter !== undefined) {
            if (newFilters.typeFilter) params.set('type', newFilters.typeFilter);
            else params.delete('type');
        }
        if (newFilters.categoryFilter !== undefined) {
            if (newFilters.categoryFilter) params.set('category', newFilters.categoryFilter);
            else params.delete('category');
        }
        if (newFilters.featuredOnly !== undefined) {
            if (newFilters.featuredOnly) params.set('isFavorite', 'true');
            else params.delete('isFavorite');
        }
        if (newFilters.priorityRank !== undefined) {
            if (newFilters.priorityRank) params.set('priorityRank', newFilters.priorityRank);
            else params.delete('priorityRank');
        }
        if (newFilters.sortBy !== undefined) {
            if (newFilters.sortBy) params.set('sortBy', newFilters.sortBy);
            else params.delete('sortBy');
        }
        if (newFilters.sortOrder !== undefined) {
            if (newFilters.sortOrder) params.set('sortOrder', newFilters.sortOrder);
            else params.delete('sortOrder');
        }
        if (newFilters.selectedCreators !== undefined) {
            if (newFilters.selectedCreators.length > 0) params.set('creators', newFilters.selectedCreators.join(','));
            else params.delete('creators');
        }
        if (newFilters.registryActive !== undefined) {
            if (newFilters.registryActive === false) params.set('registryActive', 'false');
            else params.delete('registryActive');
        }

        // Filter changes ALWAYS reset to page 1
        params.delete('page');

        setLoading(true);
        router.push(`/resources?${params.toString()}`);
    }, [router, searchParams]);

    // Sync state from server props when they change (initial load or navigation).
    // Derive currentPage and pageSize directly from the URL — the single source of truth.
    useEffect(() => {
        setResources(initialResources);
        setCurrentPage(parseInt(searchParams.get('page') || '1'));
        setPageSize(parseInt(searchParams.get('pageSize') || '96'));
        
        // Sync local filter states with URL
        setSearch(searchParams.get('search') || '');
        setPlatformFilter(searchParams.get('platform') || '');
        setPricingFilter(searchParams.get('pricing') || '');
        setTypeFilter(searchParams.get('type') || '');
        setCategoryFilter(searchParams.get('category') || '');
        setFeaturedOnly(searchParams.get('isFavorite') === 'true');
        setPriorityRank(searchParams.get('priorityRank') || '');
        setSortBy(searchParams.get('sortBy') || 'updatedAt');
        setSortOrder((searchParams.get('sortOrder') as any) || 'desc');
        setSelectedCreators(searchParams.get('creators') ? searchParams.get('creators')!.split(',').filter(Boolean) : []);
        setRegistryActive(searchParams.get('registryActive') !== 'false');
        
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

    // Fetch creators registry for the Context Console
    const { data: creators = [], isLoading: loadingCreators } = useQuery({
        queryKey: ['creators-registry'],
        queryFn: async () => {
            const response = await fetch('/api/resources/creators');
            const result = await response.json();
            return result.data || [];
        }
    });

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const params = new URLSearchParams(searchParams.toString());
            if (search) params.set('search', search); else params.delete('search');
            router.push(`/resources?${params.toString()}`);
        } else if (e.key === 'Escape') {
            setSearch('');
            const params = new URLSearchParams(searchParams.toString());
            params.delete('search');
            router.push(`/resources?${params.toString()}`);
        }
    };

    const hasActiveFilters = !!(search || platformFilter || pricingFilter || typeFilter || categoryFilter || featuredOnly || priorityRank);

    const clearAllFilters = () => {
        setSearch('');
        setPlatformFilter('');
        setPricingFilter('');
        setTypeFilter('');
        setCategoryFilter('');
        setFeaturedOnly(false);
        setPriorityRank('');
        setSelectedCreators([]);
        router.push('/resources');
    };

    const handlePageChange = (newPage: number, newPageSize?: number) => {
        // Direct URL push is the ONLY mechanism for page navigation.
        // This prevents the syncFilters effect from ever overwriting page state.
        const params = new URLSearchParams(searchParams.toString());
        if (newPageSize) {
            params.set('pageSize', newPageSize.toString());
            // Changing density resets to page 1
            params.delete('page');
        } else {
            if (newPage <= 1) {
                params.delete('page');
            } else {
                params.set('page', newPage.toString());
            }
        }
        setLoading(true);
        router.push(`/resources?${params.toString()}`);
    };



    // Background fetch to ensure latest data (especially after redirects from creation)
    const backgroundFetch = useCallback(async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            // Background fetch uses the same params as the URL
            const params = new URLSearchParams(searchParams.toString());

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
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] text-white selection:bg-indigo-500/30">
            <Navbar />

            {/* ── CINEMATIC HERO COVER ── */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer (Blurred Telemetry) */}
                <div className="absolute inset-0 z-0">
                    <div className="w-full h-full bg-[#0a0a0f]">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-50" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pb-32" />
                    </div>
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    {/* Header Pathing */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                                <Icons.database size={20} className="text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Discovery
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                    <span className="text-white uppercase">Master Library</span>
                                    <span className="opacity-20">/</span>
                                    <span className="text-indigo-400/60 font-black">All Resources</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <button 
                                    className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all flex items-center gap-2"
                                    onClick={() => setDedupOpen(true)}
                                >
                                    <Icons.search size={14} /> Duplicate Audit
                                </button>
                            )}
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <Link href="/resources/new" className="px-6 py-2.5 bg-indigo-600 border border-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95">
                                <Icons.plus size={14} /> Add Resource
                            </Link>
                        </div>
                    </div>

                    {/* Identity Glass Card (Section Overview) */}
                    <div className="glass-card p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10">
                            {searchParams.get('suggested') === 'true' && (
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest mb-8">
                                    <Icons.sparkles size={12} /> Sync Success: Contribution Pending Review
                                </div>
                            )}

                            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6 leading-none flex items-center gap-4">
                                <Icons.database size={48} className="text-indigo-400" />
                                <span>Master <span className="text-indigo-400">Library</span></span>
                            </h1>

                            <p className="text-white/40 max-w-2xl text-lg font-medium leading-relaxed mb-6">
                                Explore <span className="text-indigo-400 font-bold">{totalResources}</span> curated architectural prompts and structural assets within the master registry. Refine your workspace using the unified workbench controls.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 -mt-20 mb-12 relative z-30">

                    {/* Integrated Control Belt (Search + Filters + View Modes) */}
                    <div className="sticky top-[72px] z-[40] -mx-4 px-4 pt-4 pb-[5px] bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] mb-[5px]">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-4 w-full justify-between p-2 bg-white/[0.02] border border-white/5 rounded-3xl mb-1">
                                <div className="relative flex-1 min-w-[300px] group">
                                    <Icons.search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${search ? 'text-indigo-400' : 'text-white/20'}`} />
                                    <input
                                        type="text"
                                        placeholder="Search architecture or structural URL..."
                                        className="w-full h-11 pl-12 pr-12 bg-black/40 border border-white/5 rounded-2xl text-white text-sm outline-none focus:border-indigo-500/50 transition-all font-medium tracking-tight"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={handleSearchKeyDown}
                                        id="resource-search"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearch('');
                                                const params = new URLSearchParams(searchParams.toString());
                                                params.delete('search');
                                                router.push(`/resources?${params.toString()}`);
                                            }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80 transition-colors p-1"
                                        >
                                            <Icons.close size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={clearAllFilters}
                                            className="h-10 px-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-black uppercase tracking-widest text-rose-400 transition-all flex items-center gap-2"
                                        >
                                            <Icons.close size={12} /> <span className="font-black uppercase tracking-widest">Clear Filters</span>
                                        </button>
                                    )}
                                    {user && (
                                        <Link 
                                            href="/resources/new" 
                                            className="h-10 px-6 bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                                        >
                                            <Icons.plus size={14} /> Add Resource
                                        </Link>
                                    )}
                                    
                                    <div className="h-6 w-px bg-white/5"></div>

                                    {/* View Mode Switcher */}
                                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                        <button 
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                            title="Gallery View"
                                        >
                                            <Icons.grid size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setViewMode('small')}
                                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'small' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                            title="Compact Grid"
                                        >
                                            <Icons.feed size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                            title="Detailed List View"
                                        >
                                            <Icons.list size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Filters Bar */}
                            <FilterBar
                                platformFilter={platformFilter}
                                setPlatformFilter={(val: string) => syncFilters({ platformFilter: val })}
                                pricingFilter={pricingFilter}
                                setPricingFilter={(val: string) => syncFilters({ pricingFilter: val })}
                                typeFilter={typeFilter}
                                setTypeFilter={(val: string) => syncFilters({ typeFilter: val })}
                                categoryFilter={categoryFilter}
                                setCategoryFilter={(val: string) => syncFilters({ categoryFilter: val })}
                                featuredOnly={featuredOnly}
                                setFeaturedOnly={(val: boolean) => syncFilters({ featuredOnly: val })}
                                priorityRank={priorityRank}
                                setPriorityRank={(val: string) => syncFilters({ priorityRank: val })}
                                sortBy={sortBy}
                                setSortBy={(val: string) => syncFilters({ sortBy: val })}
                                sortOrder={sortOrder}
                                setSortOrder={(val: 'asc' | 'desc') => syncFilters({ sortOrder: val })}
                                initialCategories={initialCategories}
                                selectedCreators={selectedCreators}
                                setSelectedCreators={(val: string[]) => syncFilters({ selectedCreators: val })}
                                registryActive={registryActive}
                                setRegistryActive={(val: boolean) => syncFilters({ registryActive: val })}
                                creators={creators}
                                loadingCreators={loadingCreators}
                            />
                        </div>
                    </div>

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
                            <div className="flex gap-4">
                                <Button 
                                    variant="secondary" 
                                    className="font-bold border-white/5"
                                    onClick={() => {
                                        setSearch('');
                                        setPlatformFilter('');
                                        setPricingFilter('');
                                        setTypeFilter('');
                                        setCategoryFilter('');
                                        setFeaturedOnly(false);
                                        setPriorityRank('');
                                    }}
                                >
                                    Clear All Filters
                                </Button>
                                {user && (
                                    <Link href="/resources/new" className="btn btn-primary font-bold">
                                        ➕ Suggest a Resource
                                    </Link>
                                )}
                            </div>
                        </Card>
                    ) : (
                        <div className={`
                            ${viewMode === 'grid' ? 'resource-grid' : 
                              viewMode === 'small' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4' :
                              'flex flex-col gap-6'}
                        `}>
                            {resources.map((resource) => (
                                <ResourceCard
                                    key={resource.id}
                                    resource={resource}
                                    savedIds={savedIds}
                                    onToggleSave={handleToggleSave}
                                    onDelete={handleDeleteResource}
                                    onToggleFavorite={handleToggleFavorite}
                                    viewMode={viewMode}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalResources > 0 && !loading && (
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            flexWrap: 'wrap',
                            gap: 'var(--space-6)', 
                            marginTop: 'var(--space-12)',
                            marginBottom: 'var(--space-8)'
                        }}>
                            {/* Current Index Indicator */}
                            <div className="flex items-center text-xs font-black text-white/30 uppercase tracking-widest bg-white/5 border border-white/5 px-4 py-2 rounded-xl">
                                Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalResources)} of {totalResources}
                            </div>

                            {/* Grid Density Controller */}
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Show</span>
                                <select 
                                    className="form-select text-sm py-1 pl-2 pr-8 h-8 rounded-lg outline-none bg-transparent border-none text-white font-bold"
                                    value={pageSize}
                                    onChange={(e) => handlePageChange(1, Number(e.target.value))}
                                >
                                    <option value={24} className="bg-[#12121a]">24</option>
                                    <option value={48} className="bg-[#12121a]">48</option>
                                    <option value={96} className="bg-[#12121a]">96</option>
                                </select>
                            </div>

                            <div className="hidden sm:block h-6 w-px bg-white/10"></div>
                                  {/* Navigation Controller */}
                            <div className="flex items-center gap-2">
                                <button 
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    title="Previous Page"
                                >
                                    ◀
                                </button>
                                
                                <div className="flex items-center gap-1.5 px-1">
                                    {(() => {
                                        const totalPages = Math.ceil(totalResources / pageSize);
                                        const pages = [];
                                        const range = 2; // Number of pages to show around current
                                        
                                        for (let i = 1; i <= totalPages; i++) {
                                            if (
                                                i === 1 || 
                                                i === totalPages || 
                                                (i >= currentPage - range && i <= currentPage + range)
                                            ) {
                                                pages.push(
                                                    <button
                                                        key={i}
                                                        onClick={() => handlePageChange(i)}
                                                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-black transition-all ${
                                                            currentPage === i 
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500' 
                                                            : 'bg-white/5 border border-white/5 text-white/40 hover:text-white hover:border-white/20'
                                                        }`}
                                                    >
                                                        {i}
                                                    </button>
                                                );
                                            } else if (
                                                (i === currentPage - range - 1 && i > 1) ||
                                                (i === currentPage + range + 1 && i < totalPages)
                                            ) {
                                                pages.push(
                                                    <span key={`sep-${i}`} className="w-6 text-center text-white/20 font-bold">...</span>
                                                );
                                            }
                                        }
                                        return pages;
                                    })()}
                                </div>

                                <button 
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= Math.ceil(totalResources / pageSize)}
                                    title="Next Page"
                                >
                                    ▶
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                <Footer />

                {/* Dedup Modal */}
                <DedupModal isOpen={dedupOpen} onClose={() => setDedupOpen(false)} />

                {/* Mobile FAB */}
                {user && (
                    <Link 
                        href="/resources/new" 
                        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-2xl z-40 border border-white/20"
                        id="mobile-add-fab"
                    >
                        <span className="text-2xl text-white">➕</span>
                    </Link>
                )}

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
