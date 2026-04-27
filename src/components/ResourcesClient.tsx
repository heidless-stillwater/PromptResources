'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
    
    // Filters (managed in state for UI, syncs to URL)
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [platformFilter, setPlatformFilter] = useState(searchParams.get('platform') || '');
    const [pricingFilter, setPricingFilter] = useState(searchParams.get('pricing') || '');
    const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
    const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
    const [featuredOnly, setFeaturedOnly] = useState(searchParams.get('isFavorite') === 'true');
    const [priorityRank, setPriorityRank] = useState(searchParams.get('priorityRank') || '');
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'desc');
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
    const [pageSize, setPageSize] = useState(parseInt(searchParams.get('pageSize') || '24'));
    const [selectedCreators, setSelectedCreators] = useState<string[]>(
        searchParams.get('creators') ? searchParams.get('creators')!.split(',').filter(Boolean) : []
    );
    const [registryActive, setRegistryActive] = useState(searchParams.get('registryActive') !== 'false');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'small'>('grid');
    const [gridColumns, setGridColumns] = useState<number>(3);
    const [colsOpen, setColsOpen] = useState(false);
    const colsRef = useRef<HTMLDivElement>(null);

    // Unified filter sync to URL
    const syncFilters = useCallback((newFilters: any) => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (newFilters.search !== undefined) { if (newFilters.search) params.set('search', newFilters.search); else params.delete('search'); }
        if (newFilters.platformFilter !== undefined) { if (newFilters.platformFilter) params.set('platform', newFilters.platformFilter); else params.delete('platform'); }
        if (newFilters.pricingFilter !== undefined) { if (newFilters.pricingFilter) params.set('pricing', newFilters.pricingFilter); else params.delete('pricing'); }
        if (newFilters.typeFilter !== undefined) { if (newFilters.typeFilter) params.set('type', newFilters.typeFilter); else params.delete('type'); }
        if (newFilters.categoryFilter !== undefined) { if (newFilters.categoryFilter) params.set('category', newFilters.categoryFilter); else params.delete('category'); }
        if (newFilters.featuredOnly !== undefined) { if (newFilters.featuredOnly) params.set('isFavorite', 'true'); else params.delete('isFavorite'); }
        if (newFilters.priorityRank !== undefined) { if (newFilters.priorityRank) params.set('priorityRank', newFilters.priorityRank); else params.delete('priorityRank'); }
        if (newFilters.sortBy !== undefined) { if (newFilters.sortBy) params.set('sortBy', newFilters.sortBy); else params.delete('sortBy'); }
        if (newFilters.sortOrder !== undefined) { if (newFilters.sortOrder) params.set('sortOrder', newFilters.sortOrder); else params.delete('sortOrder'); }
        if (newFilters.selectedCreators !== undefined) { if (newFilters.selectedCreators.length > 0) params.set('creators', newFilters.selectedCreators.join(',')); else params.delete('creators'); }
        if (newFilters.registryActive !== undefined) { if (newFilters.registryActive === false) params.set('registryActive', 'false'); else params.delete('registryActive'); }

        params.delete('page');
        setLoading(true);
        router.push(`/resources?${params.toString()}`, { scroll: false });
    }, [router, searchParams]);

    // Handle clicks outside of collapsible column selector
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (colsRef.current && !colsRef.current.contains(event.target as Node)) {
                setColsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync state from server props when they change
    useEffect(() => {
        setResources(initialResources);
        setCurrentPage(parseInt(searchParams.get('page') || '1'));
        setPageSize(parseInt(searchParams.get('pageSize') || '24'));
        setSearch(searchParams.get('search') || '');
        setPlatformFilter(searchParams.get('platform') || '');
        setPricingFilter(searchParams.get('pricing') || '');
        setTypeFilter(searchParams.get('type') || '');
        setCategoryFilter(searchParams.get('category') || '');
        setFeaturedOnly(searchParams.get('isFavorite') === 'true');
        setPriorityRank(searchParams.get('priorityRank') || '');
        setSortBy(searchParams.get('sortBy') || 'createdAt');
        setSortOrder((searchParams.get('sortOrder') as any) || 'desc');
        setSelectedCreators(searchParams.get('creators') ? searchParams.get('creators')!.split(',').filter(Boolean) : []);
        setRegistryActive(searchParams.get('registryActive') !== 'false');
        setLoading(false);
    }, [initialResources, searchParams]);

    // Fetch saved resources
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

    // Fetch creators registry
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
            syncFilters({ search });
        } else if (e.key === 'Escape') {
            setSearch('');
            syncFilters({ search: '' });
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
        const params = new URLSearchParams(searchParams.toString());
        if (newPageSize) {
            params.set('pageSize', newPageSize.toString());
            params.delete('page');
        } else {
            if (newPage <= 1) params.delete('page');
            else params.set('page', newPage.toString());
        }
        setLoading(true);
        router.push(`/resources?${params.toString()}`);
    };

    const handleToggleSave = async (e: React.MouseEvent, resourceId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { router.push('/auth/login'); return; }
        const isCurrentlySaved = savedIds.has(resourceId);
        const action = isCurrentlySaved ? 'unsave' : 'save';
        try {
            await fetch('/api/user-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, resourceId, action }),
            });
            queryClient.invalidateQueries({ queryKey: ['savedResources', user?.uid] });
        } catch (error) {
            console.error('Error toggling save:', error);
        }
    };

    const handleToggleFavorite = async (e: React.MouseEvent, resourceId: string, currentStatus: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isFavorite: !currentStatus } : r));
        try {
            const token = await user?.getIdToken();
            await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ isFavorite: !currentStatus }),
            });
        } catch (error) {
            setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isFavorite: currentStatus } : r));
        }
    };

    const handleDeleteResource = async (e: React.MouseEvent, resourceId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            title: 'Delete Resource',
            message: 'Are you sure you want to delete this resource?',
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
                        setResources(prev => prev.filter(r => r.id !== resourceId));
                        router.refresh();
                    }
                } catch (error) {
                    console.error('Error deleting resource:', error);
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    return (
        <div className="page-wrapper dashboard-theme min-h-screen selection:bg-primary/30 font-inter">
            <Navbar />

            <div className="main-content">
                <div className="container mx-auto px-4 pt-12">
                    
                    {/* Cinematic Header Container */}
                    <div className="relative w-full overflow-hidden flex flex-col mb-10">
                        {/* Background Layer */}
                        <div className="absolute inset-0 z-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-48 -mt-48" />
                        </div>

                        <div className="relative z-10 flex flex-col gap-6 pt-8">
                        {/* Identity Pathing */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                                    <Icons.database size={20} className="text-primary" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                        Ecosystem Registry / Assets
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                        <span className="text-white uppercase tracking-widest">Resources</span>
                                        <span className="opacity-20">/</span>
                                        <span className="text-primary/60 font-black tracking-widest uppercase">Resources</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 p-3 px-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
                                <div className="flex flex-col items-end">
                                    <div className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Central Registry</div>
                                    <div className="text-xs font-bold text-primary tracking-widest">PROMPT-SYNC</div>
                                </div>
                                <div className="h-8 w-px bg-white/10" />
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">Asset Hub Active</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Identity Glass Card */}
                        <div className="glass-card p-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-primary/10 transition-all duration-1000" />
                            
                            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                                <div>
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                        Directory Index / Resources
                                        <span className="w-1 h-1 rounded-full bg-primary/50" />
                                        <span className="text-primary/60 flex items-center gap-1">
                                            <Icons.database size={10} />
                                            prompttool-db-1
                                        </span>
                                    </div>
                                    <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-4 leading-none flex items-center gap-4">
                                        <span>Resource <span className="text-primary">Registry</span></span>
                                    </h1>
                                    <p className="text-white/40 max-w-xl text-lg font-medium leading-relaxed italic">
                                        Explore <span className="text-primary font-black">{totalResources}</span> curated architectural templates and high-fidelity assets within the Stillwater sovereign knowledge graph.
                                    </p>
                                    <div className="flex items-center gap-4 mt-8">
                                        <Link 
                                            href="/resources/new" 
                                            className="px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.03] active:scale-95 group"
                                        >
                                            New Resource
                                            <Icons.plus size={14} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
                                        </Link>
                                        {isAdmin && (
                                            <button 
                                                onClick={() => setDedupOpen(true)}
                                                className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                                title="Audit Fragments"
                                            >
                                                <Icons.search size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* HUD - Embedded in Hero */}
                                <div className="grid grid-cols-2 gap-3 h-full">
                                    {[
                                        { label: 'Total Assets', value: totalResources, icon: <Icons.database size={16} />, tooltip: 'Complete index of architectural fragments, prompts, and workflows available.' },
                                        { label: 'Domains', value: initialCategories.length, icon: <Icons.grid size={16} />, tooltip: 'Number of distinct technological and creative specializations covered by the registry.' },
                                        { label: 'Sources', value: creators.length, icon: <Icons.users size={16} />, tooltip: 'Number of verified creators and organizations contributing to this asset index.' },
                                        { label: 'Verified Rank', value: resources.filter(r => r.rank).length, icon: <Icons.trophy size={16} />, tooltip: 'High-performance assets that have achieved priority ranking in technical benchmarks.' }
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center hover:bg-white/10 transition-all group/stat relative overflow-hidden" title={stat.tooltip}>
                                            <div className="absolute top-0 right-0 p-2 text-primary/10 group-hover/stat:text-primary/30 transition-colors">
                                                {stat.icon}
                                            </div>
                                            <div className="text-3xl font-black text-white group-hover/stat:scale-110 transition-transform duration-500 tracking-tighter">{stat.value}</div>
                                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mt-2 leading-none">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* ── CONTROL BELT (Aligned with Sources Page) ── */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-background-secondary/30 backdrop-blur-xl border border-white/5 rounded-[2rem] mb-6 shadow-2xl relative overflow-hidden" id="registry-controls">
                        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[300px] relative z-10">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md group">
                                <Icons.search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${search ? 'text-primary' : 'text-white/20'}`} />
                                <input
                                    type="text"
                                    placeholder="Search architectural fragments..."
                                    className="w-full h-11 pl-12 pr-10 bg-black/40 border border-white/5 rounded-2xl text-sm outline-none focus:border-primary/50 transition-all font-medium placeholder:text-white/30"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    id="resource-search"
                                />
                                {search && (
                                    <button onClick={() => { setSearch(''); syncFilters({ search: '' }); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80">
                                        <Icons.close size={14} />
                                    </button>
                                )}
                            </div>
                            
                            <div className="h-8 w-px bg-white/5 hidden md:block"></div>

                            {/* View Mode Switcher */}
                            <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
                                <button 
                                    onClick={() => setViewMode('grid')} 
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                    title="Grid View"
                                >
                                    <Icons.grid size={18} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('small')} 
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'small' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                    title="Compact View"
                                >
                                    <Icons.feed size={18} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('list')} 
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                    title="List View"
                                >
                                    <Icons.list size={18} />
                                </button>
                            </div>

                            {viewMode === 'grid' && (
                                <div className="relative" ref={colsRef}>
                                    <button onClick={() => setColsOpen(!colsOpen)} className={`h-11 px-4 rounded-xl transition-all flex items-center gap-2 bg-black/40 border border-white/5 ${colsOpen ? 'text-primary border-primary/30' : 'text-white/20 hover:text-white/60'}`}>
                                        <Icons.grid size={14} />
                                        <span className="text-[10px] font-black tracking-widest">{gridColumns} COL</span>
                                    </button>
                                    {colsOpen && (
                                        <div className="absolute left-0 top-full mt-4 w-56 bg-[#0f172a] border border-white/10 p-4 shadow-2xl rounded-3xl z-50 animate-fade-in-up backdrop-blur-3xl">
                                            <div className="grid grid-cols-2 gap-3">
                                                {[2, 3, 4, 5].map(cols => (
                                                    <button key={cols} onClick={() => { setGridColumns(cols); setColsOpen(false); }} className={`flex flex-col items-center gap-3 p-3 rounded-2xl transition-all border ${gridColumns === cols ? 'bg-primary/10 border-primary/30 text-primary' : 'text-white/20 hover:bg-white/5 border-transparent hover:border-white/10'}`}>
                                                        <div className={`grid gap-0.5 w-full aspect-video bg-black/40 p-1 rounded-md`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                                                            {[...Array(cols * 2)].map((_, i) => <div key={i} className={`h-full w-full rounded-[1px] ${gridColumns === cols ? 'bg-primary/40' : 'bg-white/10'}`} />)}
                                                        </div>
                                                        <span className="text-[10px] font-black">{cols} COL</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 relative z-10">
                            {/* Sort Dropdown */}
                            <div className="relative group/sort hidden lg:block">
                                <select 
                                    value={sortBy}
                                    onChange={(e) => syncFilters({ sortBy: e.target.value })}
                                    className="h-11 bg-[#0a0a0f] border border-white/5 rounded-xl px-4 pr-10 text-[10px] font-black uppercase text-white/70 outline-none hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer min-w-[180px] appearance-none tracking-widest"
                                >
                                    <option value="updatedAt" className="bg-[#1e293b] text-white">Sort: Last Synced</option>
                                    <option value="createdAt" className="bg-[#1e293b] text-white">Sort: Discovery Date</option>
                                    <option value="title" className="bg-[#1e293b] text-white">Sort: Identity (A-Z)</option>
                                    <option value="rank" className="bg-[#1e293b] text-white">Sort: Technical Rank</option>
                                    <option value="averageRating" className="bg-[#1e293b] text-white">Sort: System Rating</option>
                                </select>
                                <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none group-hover/sort:text-primary transition-colors" />
                            </div>

                            {/* Sort Order Toggle */}
                            <button 
                                onClick={() => syncFilters({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })}
                                className="h-11 w-11 flex items-center justify-center bg-black/40 border border-white/5 rounded-xl text-white/20 hover:text-primary hover:border-primary/30 transition-all shadow-xl group"
                                title={sortOrder === 'asc' ? 'Ascending Order' : 'Descending Order'}
                            >
                                {sortOrder === 'asc' ? <Icons.arrowUp size={16} /> : <Icons.arrowDown size={16} />}
                            </button>

                            <div className="h-8 w-px bg-white/5 hidden md:block"></div>

                            {hasActiveFilters && (
                                <button onClick={clearAllFilters} className="h-11 px-6 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400 transition-all flex items-center gap-2">
                                    <Icons.refresh size={12} /> Reset
                                </button>
                            )}
                            
                            <div className="px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl hidden lg:block">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{resources.length} Assets Found</span>
                            </div>
                        </div>

                        {/* Filter Console Integrated */}
                        <div className="w-full mt-2 relative z-10">
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

                    {/* ── RESULTS ── */}
                    {loading ? (
                        <div className="pt-4"><SkeletonGrid count={8} columns={4} aspectRatio="16/9" /></div>
                    ) : resources.length === 0 ? (
                        <Card variant="glass" className="flex flex-col items-center justify-center py-32 text-center border-dashed border-white/10 bg-white/[0.01]">
                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 relative">
                                <Icons.database size={48} className="text-white/10" />
                                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl" />
                            </div>
                            <h3 className="text-3xl font-black mb-4 tracking-tight">No assets discovered</h3>
                            <p className="text-white/30 mb-12 max-w-sm mx-auto font-medium leading-relaxed">
                                Our scanners couldn't find any architectural fragments matching your criteria. Try broadening your discovery parameters.
                            </p>
                            <Button variant="secondary" onClick={clearAllFilters} className="rounded-[2rem] font-black px-12 py-6 text-[10px] uppercase tracking-widest">Reset Discovery Console</Button>
                        </Card>
                    ) : (
                        <div className="space-y-12">
                            <div className="flex items-center gap-4 mb-8 px-2">
                                <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">Registry Records ({totalResources})</h2>
                                <div className="flex-1 h-px bg-gradient-to-r from-primary/25 to-transparent" />
                            </div>

                            <div className={`
                                ${viewMode === 'grid' ? 
                                    (gridColumns === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-10' :
                                     gridColumns === 3 ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10' :
                                     gridColumns === 4 ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10' :
                                     'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-10') : 
                                  viewMode === 'small' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6' :
                                  'flex flex-col gap-10'}
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
                        </div>
                    )}

                    {/* Pagination */}
                    {totalResources > pageSize && (
                        <div className="flex flex-col items-center gap-10 mt-32">
                            <div className="flex items-center gap-6">
                                <button 
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="w-16 h-16 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all shadow-xl"
                                >
                                    <Icons.chevronLeft size={28} />
                                </button>
                                <div className="px-10 py-5 bg-white/5 border border-white/10 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] text-white/40 shadow-xl">
                                    Segment {currentPage} <span className="mx-2 opacity-20">/</span> {Math.ceil(totalResources / pageSize)}
                                </div>
                                <button 
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= Math.ceil(totalResources / pageSize)}
                                    className="w-16 h-16 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all shadow-xl"
                                >
                                    <Icons.chevronRight size={28} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Footer />
            <DedupModal isOpen={dedupOpen} onClose={() => setDedupOpen(false)} />
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDanger={confirmModal.isDanger}
                onConfirm={confirmModal.onConfirm}
                onClose={closeConfirmModal}
            />
        </div>
    );
}
