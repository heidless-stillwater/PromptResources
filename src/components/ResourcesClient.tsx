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
import { useTheme } from '@/components/providers/ThemeProvider';

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
    const { user, profile, isAdmin, isSu, loading: authLoading } = useAuth();
    const { isDarkMode } = useTheme();
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
    const [excludeUid, setExcludeUid] = useState<string | null>(searchParams.get('excludeUid') || null);
    const [viewMode, setViewMode] = useState<'grid-2' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6' | 'list'>('grid-3');
    
    // Preference Persistence
    useEffect(() => {
        const savedMode = localStorage.getItem('resources_view_mode');
        if (savedMode && ['grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6', 'list'].includes(savedMode)) {
            setViewMode(savedMode as any);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('resources_view_mode', viewMode);
    }, [viewMode]);

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
        if (newFilters.excludeUid !== undefined) { if (newFilters.excludeUid) params.set('excludeUid', newFilters.excludeUid); else params.delete('excludeUid'); }

        params.delete('page');
        setLoading(true);
        router.push(`/resources?${params.toString()}`, { scroll: false });
    }, [router, searchParams]);

    // Force refresh resources list from server on mount to clear Next.js Router Cache
    useEffect(() => {
        router.refresh();
    }, [router]);

    // Sync filters from URL
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
        setExcludeUid(searchParams.get('excludeUid') || null);
        setLoading(false);
    }, [initialResources, searchParams]);

    // Fetch saved resources
    const { data: savedIds = new Set<string>() } = useQuery({
        queryKey: ['savedResources', user?.uid],
        queryFn: async () => {
            if (!user) return new Set<string>();
            const token = await user.getIdToken();
            const response = await fetch(`/api/user-resources?uid=${user.uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
                                <div className={`p-3 border rounded-2xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                                    <Icons.database size={20} className="text-primary" />
                                </div>
                                <div className="flex flex-col">
                                    <div className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`}>
                                        Curated Resources & Tools
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold">
                                        <span className={`uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Resources</span>
                                        <span className="opacity-20">/</span>
                                        <span className="text-primary/60 font-black tracking-widest uppercase">Discover</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className={`flex-1 md:flex-initial flex items-center gap-4 p-3 px-4 border rounded-2xl backdrop-blur-xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                                    <div className="flex flex-col items-end">
                                        <div className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`}>Shared Hub</div>
                                        <div className="text-xs font-bold text-primary tracking-widest">PREMIUM HUB</div>
                                    </div>
                                    <div className={`h-8 w-px ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`} />
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className={`text-[10px] font-black uppercase tracking-widest italic ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>Hub Active</span>
                                    </div>
                                </div>
                                <Link 
                                    href="/resources/new"
                                    className={`p-3 border rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-md ${
                                        isDarkMode 
                                            ? 'bg-primary/20 border-primary/30 text-primary hover:bg-primary/30 hover:border-primary/50' 
                                            : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 hover:border-primary/40'
                                    }`}
                                    style={{ height: '58px', width: '58px' }}
                                    title="Add New Resource"
                                >
                                    <Icons.plus size={20} strokeWidth={3} />
                                </Link>
                            </div>
                        </div>

                        {/* Main Identity Glass Card */}
                        <div className="glass-card p-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-primary/10 transition-all duration-1000" />
                            
                            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                                <div>
                                    <div className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`}>
                                        Resource Library
                                        <span className="w-1 h-1 rounded-full bg-primary/50" />
                                        <span className="text-primary/60 flex items-center gap-1">
                                            <Icons.database size={10} />
                                            Verified Database
                                        </span>
                                    </div>
                                    <h1 className={`text-5xl md:text-8xl font-black tracking-tighter mb-4 leading-none flex items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                        <span>Resource <span className="text-primary">Library</span></span>
                                        <Link 
                                            href="/resources/new" 
                                            className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary flex items-center justify-center transition-all hover:scale-105 shrink-0"
                                            title="Add New Resource"
                                        >
                                            <Icons.plus size={20} strokeWidth={3} />
                                        </Link>
                                    </h1>
                                    <p className={`max-w-xl text-lg font-medium leading-relaxed italic ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
                                        Discover high-performance resource templates, assets, and design libraries hand-crafted for modern creators.
                                    </p>
                                    <div className="flex items-center gap-4 mt-8">
                                        <Link 
                                            href="/resources/new" 
                                            className="px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.03] active:scale-95 group"
                                        >
                                            Suggest New Resource
                                            <Icons.plus size={14} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
                                        </Link>
                                        {isAdmin && (
                                            <button 
                                                onClick={() => setDedupOpen(true)}
                                                className={`p-4 rounded-2xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white' : 'bg-black/5 border-black/10 text-slate-500 hover:bg-black/10 hover:text-slate-800'}`}
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
                                        { label: 'Specialties', value: initialCategories.length, icon: <Icons.grid size={16} />, tooltip: 'Number of distinct technological and creative specializations covered by the registry.' },
                                        { label: 'Contributors', value: creators.length, icon: <Icons.users size={16} />, tooltip: 'Number of verified creators and organizations contributing to this asset index.' },
                                        { label: 'Asset Priority', value: resources.filter(r => r.rank).length, icon: <Icons.trophy size={16} />, tooltip: 'High-performance assets that have achieved priority ranking in technical benchmarks.' }
                                    ].map((stat, i) => (
                                        <div key={i} className={`border rounded-2xl p-5 flex flex-col items-center justify-center transition-all group/stat relative overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-black/[0.02] border-black/5 hover:bg-black/5'}`} title={stat.tooltip}>
                                            <div className="absolute top-0 right-0 p-2 text-primary/10 group-hover/stat:text-primary/30 transition-colors">
                                                {stat.icon}
                                            </div>
                                            <div className={`text-3xl font-black group-hover/stat:scale-110 transition-transform duration-500 tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stat.value}</div>
                                            <div className={`text-[9px] font-black uppercase tracking-[0.3em] mt-2 leading-none ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`}>{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* ── REGISTRY TABS (Admin & SU Only) ── */}
                    {(isAdmin || isSu || profile?.role === 'admin' || profile?.role === 'su') && (
                        <div className={`flex gap-1 p-1.5 border rounded-[1.5rem] mb-6 self-start backdrop-blur-xl animate-in slide-in-from-left-4 duration-700 ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white/60 border-slate-200'}`}>
                            <button 
                                onClick={() => syncFilters({ excludeUid: '' })}
                                className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!excludeUid ? 'bg-primary text-white shadow-xl shadow-primary/20' : isDarkMode ? 'text-white/40 hover:text-white/60' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Shared Hub {!excludeUid && `(${totalResources})`}
                            </button>
                            <button 
                                onClick={() => syncFilters({ excludeUid: user?.uid })}
                                className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${excludeUid ? 'bg-primary text-white shadow-xl shadow-primary/20' : isDarkMode ? 'text-white/40 hover:text-white/60' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Custom Workspace {excludeUid && `(${totalResources})`}
                            </button>
                        </div>
                    )}

                    {/* ── CONTROL BELT ── */}
                    <div className={`flex flex-wrap items-center justify-between gap-4 p-4 border rounded-[2rem] mb-6 shadow-2xl relative overflow-hidden ${isDarkMode ? 'bg-background-secondary/30 border-white/5' : 'bg-white/80 border-slate-200/60'}`} id="registry-controls">
                        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[300px] relative z-10">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md group">
                                <Icons.search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${search ? 'text-primary' : isDarkMode ? 'text-white/20' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    placeholder="Search resources..."
                                    className={`w-full h-11 pl-12 pr-10 border rounded-2xl text-sm outline-none focus:border-primary/50 transition-all font-medium ${isDarkMode ? 'bg-black/40 border-white/5 text-white placeholder:text-white/30' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    id="resource-search"
                                />
                                {search && (
                                    <button onClick={() => { setSearch(''); syncFilters({ search: '' }); }} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30 hover:text-white/80' : 'text-slate-400 hover:text-slate-800'}`}>
                                        <Icons.close size={14} />
                                    </button>
                                )}
                            </div>
                            
                            <div className={`h-8 w-px hidden md:block ${isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`}></div>

                            {/* Density Selector Architecture */}
                            <div className={`flex p-1 rounded-xl border ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                {(['grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6'] as any[]).map(m => (
                                    <button 
                                        key={m}
                                        onClick={() => setViewMode(m)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === m ? (isDarkMode ? 'bg-white/10 text-white shadow-inner' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50') : (isDarkMode ? 'text-white/20 hover:text-white' : 'text-slate-400 hover:text-slate-700')}`}
                                    >
                                        {m.split('-')[1]}C
                                    </button>
                                ))}
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? (isDarkMode ? 'bg-white/10 text-white shadow-inner' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50') : (isDarkMode ? 'text-white/20 hover:text-white' : 'text-slate-400 hover:text-slate-700')}`}
                                    title="List View"
                                >
                                    <Icons.list className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 relative z-10">
                            {/* Sort Dropdown */}
                            <div className="relative group/sort hidden lg:block">
                                <select 
                                    value={sortBy}
                                    onChange={(e) => syncFilters({ sortBy: e.target.value })}
                                    className={`h-11 border rounded-xl px-4 pr-10 text-[10px] font-black uppercase outline-none transition-all cursor-pointer min-w-[180px] appearance-none tracking-widest ${isDarkMode ? 'bg-[#0a0a0f] border-white/5 text-white/70 hover:bg-white/5 hover:border-primary/30' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-primary/30'}`}
                                >
                                    <option value="updatedAt" className={isDarkMode ? 'bg-[#1e293b] text-white' : 'bg-white text-slate-800'}>Recently Updated</option>
                                    <option value="createdAt" className={isDarkMode ? 'bg-[#1e293b] text-white' : 'bg-white text-slate-800'}>Created Date</option>
                                    <option value="title" className={isDarkMode ? 'bg-[#1e293b] text-white' : 'bg-white text-slate-800'}>Alphabetical (A-Z)</option>
                                    <option value="rank" className={isDarkMode ? 'bg-[#1e293b] text-white' : 'bg-white text-slate-800'}>Asset Priority</option>
                                    <option value="averageRating" className={isDarkMode ? 'bg-[#1e293b] text-white' : 'bg-white text-slate-800'}>User Rating</option>
                                </select>
                                <Icons.chevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none group-hover/sort:text-primary transition-colors ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`} />
                            </div>

                            {/* Sort Order Toggle */}
                            <button 
                                onClick={() => syncFilters({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })}
                                className={`h-11 w-11 flex items-center justify-center border rounded-xl transition-all shadow-xl group ${isDarkMode ? 'bg-black/40 border-white/5 text-white/20 hover:text-primary hover:border-primary/30' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30'}`}
                                title={sortOrder === 'asc' ? 'Ascending Order' : 'Descending Order'}
                            >
                                {sortOrder === 'asc' ? <Icons.arrowUp size={16} /> : <Icons.arrowDown size={16} />}
                            </button>

                            <div className={`h-8 w-px hidden md:block ${isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`}></div>

                            {hasActiveFilters && (
                                <button onClick={clearAllFilters} className="h-11 px-6 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400 transition-all flex items-center gap-2">
                                    <Icons.refresh size={12} /> Reset
                                </button>
                            )}
                            
                            <div className={`px-4 py-2.5 border rounded-xl hidden lg:block ${isDarkMode ? 'bg-primary/10 border-primary/20' : 'bg-primary/5 border-primary/10'}`}>
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
                        <Card variant="glass" className={`flex flex-col items-center justify-center py-32 text-center border-dashed bg-white/[0.01] ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 relative ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                                <Icons.database size={48} className={isDarkMode ? 'text-white/10' : 'text-slate-350'} />
                                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl" />
                            </div>
                            <h3 className="text-3xl font-black mb-4 tracking-tight">No assets discovered</h3>
                            <p className={`mb-12 max-w-sm mx-auto font-medium leading-relaxed ${isDarkMode ? 'text-white/30' : 'text-slate-500'}`}>
                                Our scanners couldn&apos;t find any architectural fragments matching your criteria. Try broadening your discovery parameters.
                            </p>
                            <Button variant="secondary" onClick={clearAllFilters} className="rounded-[2rem] font-black px-12 py-6 text-[10px] uppercase tracking-widest">Reset All Filters</Button>
                        </Card>
                    ) : (
                        <div className="space-y-12">
                            <div className="flex items-center gap-4 mb-8 px-2">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">All Resources ({totalResources})</h2>
                                    <Link 
                                        href="/resources/new" 
                                        className="text-primary hover:text-primary/80 transition-colors p-1"
                                        title="Add New Resource"
                                    >
                                        <Icons.plus size={14} strokeWidth={3} />
                                    </Link>
                                </div>
                                <div className={`flex-1 h-px bg-gradient-to-r ${isDarkMode ? 'from-primary/25 to-transparent' : 'from-primary/15 to-transparent'}`} />
                            </div>

                            <div className={`
                                ${viewMode === 'grid-2' ? 'grid grid-cols-1 sm:grid-cols-2 gap-5' :
                                  viewMode === 'grid-3' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' :
                                  viewMode === 'grid-4' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2' :
                                  viewMode === 'grid-5' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2' :
                                  viewMode === 'grid-6' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2' :
                                  'flex flex-col gap-5'}
                            `}>
                                {resources.map((resource) => (
                                    <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        savedIds={savedIds}
                                        onToggleSave={handleToggleSave}
                                        onDelete={handleDeleteResource}
                                        onToggleFavorite={handleToggleFavorite}
                                        viewMode={viewMode === 'list' ? 'list' : (viewMode === 'grid-4') ? 'small' : (viewMode === 'grid-5' || viewMode === 'grid-6') ? 'minimal' : 'grid'}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalResources > pageSize && (() => {
                        const totalPages = Math.ceil(totalResources / pageSize);
                        const delta = 1;
                        const pages: (number | string)[] = [];
                        for (let i = 1; i <= totalPages; i++) {
                            if (
                                i === 1 ||
                                i === totalPages ||
                                (i >= currentPage - delta && i <= currentPage + delta)
                            ) {
                                pages.push(i);
                            } else if (pages[pages.length - 1] !== '...') {
                                pages.push('...');
                            }
                        }

                        return (
                            <div className="flex flex-col items-center gap-10 mt-32 select-none animate-in fade-in duration-500">
                                <div className="flex items-center gap-2">
                                    {/* Previous Button */}
                                    <button 
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-300 shadow-md ${
                                            isDarkMode 
                                                ? 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20' 
                                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                                        }`}
                                        title="Previous Page"
                                    >
                                        <Icons.chevronLeft size={18} />
                                    </button>

                                    {/* Page Numbers */}
                                    <div className="flex items-center gap-1.5">
                                        {pages.map((p, idx) => {
                                            if (p === '...') {
                                                return (
                                                    <span 
                                                        key={`ellipsis-${idx}`} 
                                                        className={`w-10 h-10 flex items-center justify-center text-xs font-bold ${
                                                            isDarkMode ? 'text-white/30' : 'text-slate-400'
                                                        }`}
                                                    >
                                                        •••
                                                    </span>
                                                );
                                            }

                                            const isCurrent = p === currentPage;
                                            return (
                                                <button
                                                    key={`page-${p}`}
                                                    onClick={() => handlePageChange(p as number)}
                                                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all duration-300 ${
                                                        isCurrent
                                                            ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                                                            : isDarkMode
                                                                ? 'bg-white/5 border border-white/5 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/10'
                                                                : 'bg-slate-50 border border-slate-200/60 text-slate-500 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Next Button */}
                                    <button 
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage >= totalPages}
                                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-300 shadow-md ${
                                            isDarkMode 
                                                ? 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20' 
                                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                                        }`}
                                        title="Next Page"
                                    >
                                        <Icons.chevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
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
