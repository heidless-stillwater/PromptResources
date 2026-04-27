'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { UserProfile } from '@/lib/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Icons } from '@/components/ui/Icons';

interface Props {
    featured: UserProfile[];
    creators: UserProfile[];
}

const profileTypeIcon = (type?: string, size = 14) => {
    switch (type) {
        case 'individual': return <Icons.user size={size} />;
        case 'channel': return <Icons.video size={size} />;
        case 'organization': return <Icons.users size={size} />;
        default: return <Icons.user size={size} />;
    }
};

export default function CreatorsDirectoryClient({ featured, creators }: Props) {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'individual' | 'channel' | 'organization'>('all');
    const [sortBy, setSortBy] = useState<'authored' | 'curated' | 'total' | 'newest' | 'name'>('authored');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'wide' | 'list' | 'table' | 'small'>('grid');

    // Preference Persistence
    useEffect(() => {
        const savedMode = localStorage.getItem('creators_view_mode');
        if (savedMode && ['grid', 'wide', 'list', 'table', 'small'].includes(savedMode)) {
            setViewMode(savedMode as any);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('creators_view_mode', viewMode);
    }, [viewMode]);

    const sortedCreators = useMemo(() => {
        const sorted = [...creators].sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'authored') comparison = (b.authoredCount || 0) - (a.authoredCount || 0);
            else if (sortBy === 'curated') comparison = (b.curatedCount || 0) - (a.curatedCount || 0);
            else if (sortBy === 'total') comparison = (b.resourceCount || 0) - (a.resourceCount || 0);
            else if (sortBy === 'name') comparison = a.displayName.localeCompare(b.displayName);
            else if (sortBy === 'newest') {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val?.toDate === 'function') return val.toDate().getTime();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime() || 0;
                };
                comparison = getTime(b.createdAt) - getTime(a.createdAt);
            }
            return sortOrder === 'desc' ? comparison : -comparison;
        });
        return sorted;
    }, [creators, sortBy, sortOrder]);

    const filtered = useMemo(() => {
        return sortedCreators.filter(c => {
            const matchesSearch =
                !search ||
                c.displayName.toLowerCase().includes(search.toLowerCase()) ||
                c.bio?.toLowerCase().includes(search.toLowerCase()) ||
                c.slug?.toLowerCase().includes(search.toLowerCase()) ||
                c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
            const matchesType = filterType === 'all' || c.profileType === filterType;
            const matchesVerified = !showVerifiedOnly || c.isVerified;
            return matchesSearch && matchesType && matchesVerified;
        });
    }, [sortedCreators, search, filterType, showVerifiedOnly]);

    const hasFilters = !!(search || filterType !== 'all' || showVerifiedOnly);

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filtered, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `creators_registry_export_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleShare = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        alert('Registry link with active filters copied to clipboard!');
    };

    return (
        <div className="page-wrapper dashboard-theme min-h-screen">
            <Navbar />
            <div className="main-content">
                <div className="container">

                    {/* Cinematic Hero - Styled after Control Hub */}
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
                                        <Icons.users size={20} className="text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                            Ecosystem Registry / Authority
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                            <span className="text-white uppercase tracking-widest">Sources</span>
                                            <span className="opacity-20">/</span>
                                            <span className="text-primary/60 font-black tracking-widest uppercase">Pioneer Directory</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 p-3 px-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
                                    <div className="flex flex-col items-end">
                                        <div className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Public Registry</div>
                                        <div className="text-xs font-bold text-primary tracking-widest">PROMPT-CLOUD</div>
                                    </div>
                                    <div className="h-8 w-px bg-white/10" />
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">Global Sync</span>
                                    </div>
                                </div>
                            </div>

                            {/* Main Identity Glass Card */}
                            <div className="glass-card p-8 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-primary/10 transition-all duration-1000" />
                                
                                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                                    <div>
                                        <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                            Directory Index / Sources Hub
                                            <span className="w-1 h-1 rounded-full bg-primary/50" />
                                            <span className="text-primary/60 flex items-center gap-1">
                                                <Icons.database size={10} />
                                                prompttool-db-0
                                            </span>
                                        </div>
                                        <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-4 leading-none flex items-center gap-4 font-outfit">
                                            <span>Sources <span className="text-primary">Registry</span></span>
                                        </h1>
                                        <p className="text-white/40 max-w-xl text-lg font-medium leading-relaxed italic">
                                            Discover the pioneers, builders, and educators shaping the future of the AI learning landscape. Explore profiles, browse collections, and find your next favourite creator.
                                        </p>
                                    </div>

                                    {/* HUD - Embedded in Hero */}
                                    <div className="grid grid-cols-2 gap-3 h-full">
                                        {[
                                            { label: 'Sources', value: creators.length, icon: <Icons.users size={16} />, tooltip: 'Total number of verified and community creators registered in the Stillwater ecosystem.' },
                                            { label: 'Verified', value: creators.filter(c => c.isVerified).length, icon: <Icons.check size={16} />, tooltip: 'Creators who have passed identity and quality verification standards.' },
                                            { label: 'Impact', value: creators.reduce((acc, c) => acc + (c.resourceCount || 0), 0), icon: <Icons.zap size={16} />, tooltip: 'Cumulative number of architectural assets contributed by the community to the registry.' },
                                            { label: 'Ranked', value: creators.filter(c => c.rank).length, icon: <Icons.trophy size={16} />, tooltip: 'Creators recognized for exceptional contribution quality and system performance.' }
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

                    {/* Control Belt - Sync'd with Platform Archetype */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-background-secondary/30 backdrop-blur-xl border border-white/5 rounded-[2rem] mb-6" id="registry-controls">
                        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[300px]">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md">
                                <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="Search pioneers by name or expertise..."
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all font-medium"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    id="creators-search"
                                />
                            </div>
                            
                            <div className="h-8 w-px bg-white/5 hidden md:block"></div>

                            {/* View Mode Switcher */}
                            <div className="flex p-1 bg-black/40 rounded-xl">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                    title="Grid View"
                                >
                                    <Icons.grid size={18} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('wide')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'wide' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                    title="Wide View (2 per row)"
                                >
                                    <Icons.stack size={18} />
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
                                    <Icons.text size={18} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('table')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                    title="Table View"
                                >
                                    <Icons.rows size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Type filters */}
                            <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                                {(['all', 'individual', 'channel', 'organization'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                            filterType === type ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
                                        }`}
                                    >
                                        {type === 'all' ? 'All' : type}
                                    </button>
                                ))}
                            </div>

                            <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl hidden sm:block">
                                <span className="text-xs font-black text-primary uppercase tracking-widest">{filtered.length} Discovered</span>
                            </div>

                            {hasFilters && (
                                <button
                                    onClick={() => { setSearch(''); setFilterType('all'); setShowVerifiedOnly(false); }}
                                    className="p-2 text-rose-400/60 hover:text-rose-400 transition-all"
                                    title="Reset Filters"
                                >
                                    <Icons.refresh size={18} />
                                </button>
                            )}

                            <div className="h-8 w-px bg-white/5 hidden lg:block"></div>

                            {/* Sort Dropdown */}
                            <div className="relative group/sort hidden lg:block">
                                <select 
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="h-11 bg-background border border-white/5 rounded-xl px-4 pr-10 text-[10px] font-black uppercase text-white/70 outline-none hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer min-w-[160px] appearance-none tracking-widest font-outfit"
                                >
                                    <option value="authored" className="bg-[#1e293b] text-white">Sort: Authored Assets</option>
                                    <option value="curated" className="bg-[#1e293b] text-white">Sort: Curated Index</option>
                                    <option value="total" className="bg-[#1e293b] text-white">Sort: Registry Impact</option>
                                    <option value="newest" className="bg-[#1e293b] text-white">Sort: Discovery Date</option>
                                    <option value="name" className="bg-[#1e293b] text-white">Sort: Identity (A-Z)</option>
                                </select>
                                <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none group-hover/sort:text-primary transition-colors" />
                            </div>

                            {/* Verified Toggle */}
                            <button 
                                onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
                                className={`h-11 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                                    showVerifiedOnly 
                                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                    : 'bg-black/40 border-white/5 text-white/20 hover:text-white/40'
                                }`}
                            >
                                <Icons.check size={12} strokeWidth={4} />
                                Verified Only
                            </button>

                            <div className="h-8 w-px bg-white/5"></div>

                            <button onClick={handleShare} className="p-2 text-white/20 hover:text-primary transition-all">
                                <Icons.share size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ── RESULTS ── */}
                    {filtered.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-24 text-center">
                            <Icons.users size={64} className="mx-auto mb-6 text-white/5" />
                            <h3 className="text-xl font-bold text-white/60 mb-2">No Sources Discovered</h3>
                            <p className="text-white/30 font-medium">Try broadening your search or adjusting the classification filters.</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {/* Featured (only show in Grid view as a special section) */}
                            {featured.length > 0 && !search && filterType === 'all' && viewMode === 'grid' && (
                                <section>
                                    <div className="flex items-center gap-4 mb-8">
                                        <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">Featured Sources</h2>
                                        <div className="flex-1 h-px bg-gradient-to-r from-primary/25 to-transparent" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {featured.map(c => <CreatorCard key={c.uid} creator={c} featured viewMode="grid" />)}
                                    </div>
                                </section>
                            )}

                            <section>
                                <div className="flex items-center justify-between mb-8 px-2">
                                    <p className="text-[11px] text-white/20 font-black uppercase tracking-[0.4em]">
                                        Registry Records ({filtered.length})
                                    </p>
                                    <div className="h-px flex-1 mx-6 bg-white/5" />
                                </div>

                                {viewMode === 'table' ? (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b border-white/5">
                                                    <th className="px-8 py-5">Identity</th>
                                                    <th className="px-8 py-5">Expertise</th>
                                                    <th className="px-8 py-5 text-center">Authorship</th>
                                                    <th className="px-8 py-5 text-center">Curation</th>
                                                    <th className="px-8 py-5 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filtered.map(c => (
                                                    <tr key={c.uid} className="hover:bg-white/[0.03] transition-colors group">
                                                        <td className="px-8 py-4">
                                                            <Link href={`/creators/${c.slug || c.uid}`} className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/20 flex-shrink-0">
                                                                    {c.photoURL ? (
                                                                        <img src={c.photoURL} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center font-black text-primary text-xs uppercase">
                                                                            {c.displayName[0]}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-bold text-white flex items-center gap-2 group-hover:text-primary transition-colors">
                                                                        {c.displayName}
                                                                        {c.isVerified && <Icons.check size={12} className="text-emerald-500" strokeWidth={4} />}
                                                                    </div>
                                                                    <div className="text-[10px] text-white/20 font-medium uppercase tracking-tighter">
                                                                        {c.slug || 'active-member'}
                                                                    </div>
                                                                </div>
                                                            </Link>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <div className="flex gap-2">
                                                                {c.tags?.slice(0, 2).map(t => (
                                                                    <span key={t} className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded font-bold uppercase tracking-wider italic">#{t}</span>
                                                                )) || <span className="text-[10px] text-white/10 uppercase italic">Generalist Builder</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4 text-center">
                                                            <span className="text-sm font-black text-white">{c.authoredCount || 0}</span>
                                                        </td>
                                                        <td className="px-8 py-4 text-center">
                                                            <span className="text-sm font-black text-white/60">{c.curatedCount || 0}</span>
                                                        </td>
                                                        <td className="px-8 py-4 text-right">
                                                            <Link href={`/creators/${c.slug || c.uid}`} className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-primary hover:text-primary/80 transition-colors bg-primary/10 px-4 py-2 rounded-lg">
                                                                Profile <Icons.chevronRight size={12} />
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className={`grid gap-6 ${
                                        viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 
                                        viewMode === 'wide' ? 'grid-cols-1 md:grid-cols-2' :
                                        viewMode === 'small' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' :
                                        'grid-cols-1'
                                    }`}>
                                        {filtered.map(c => <CreatorCard key={c.uid} creator={c} viewMode={viewMode} />)}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

function CreatorCard({ creator, featured = false, viewMode = 'grid' }: { creator: UserProfile; featured?: boolean, viewMode?: 'grid' | 'wide' | 'list' | 'table' | 'small' }) {
    const initials = creator.displayName
        .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    if (viewMode === 'small') {
        return (
            <Link
                href={`/creators/${creator.slug || creator.uid}`}
                className="group flex flex-col p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/30 hover:bg-white/[0.05] transition-all h-full relative"
            >
                 {/* Quick Actions (Hover Only) */}
                <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigator.clipboard.writeText(`${window.location.origin}/creators/${creator.slug || creator.uid}`);
                            alert(`Link copied!`);
                        }}
                        className="p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-primary transition-all"
                    >
                        <Icons.share size={10} />
                    </button>
                </div>

                <div className="flex items-start gap-3 mb-3">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                        {creator.photoURL ? (
                            <img src={creator.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xs font-black text-primary">
                                {initials}
                            </div>
                        )}
                        {creator.isVerified && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-background">
                                <Icons.check size={8} strokeWidth={4} />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">{creator.displayName}</h3>
                        <div className="text-[9px] text-white/20 font-black uppercase tracking-tighter truncate">/{creator.slug || 'user'}</div>
                    </div>
                </div>

                <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <Icons.wand size={10} className="text-primary/50" />
                        <span className="text-[10px] font-black text-white/60">{creator.authoredCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Icons.grid size={10} className="text-emerald-400/50" />
                        <span className="text-[10px] font-black text-white/60">{creator.curatedCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary/40">
                         {profileTypeIcon(creator.profileType, 10)}
                    </div>
                </div>
            </Link>
        )
    }

    if (viewMode === 'list') {
        return (
            <Link
                href={`/creators/${creator.slug || creator.uid}`}
                className={`flex items-center gap-6 p-5 rounded-2xl border transition-all duration-300 group ${
                    featured
                        ? 'bg-primary/5 border-primary/30 hover:border-primary/50'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                }`}
                style={{ textDecoration: 'none' }}
            >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    {creator.photoURL ? (
                        <img
                            src={creator.photoURL}
                            alt={creator.displayName}
                            className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/5 shadow-2xl"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-black text-white ring-2 ring-white/5 shadow-2xl">
                            {initials}
                        </div>
                    )}
                    {creator.isVerified && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                            <Icons.check size={12} strokeWidth={4} />
                        </div>
                    )}
                </div>

                {/* Identity & Bio */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-xl font-extrabold text-white group-hover:text-primary transition-colors tracking-tight">{creator.displayName}</h3>
                        <span className="text-primary/40">{profileTypeIcon(creator.profileType, 16)}</span>
                        {creator.isStub && (
                            <span className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-black bg-white/5 px-2 py-0.5 rounded-md">Registry</span>
                        )}
                        {featured && (
                            <span className="text-[8px] uppercase tracking-[0.2em] text-amber-400 font-black bg-amber-400/10 px-2 py-0.5 rounded-md">Featured Pioneer</span>
                        )}
                    </div>
                    {creator.bio ? (
                        <p className="text-sm text-white/40 leading-relaxed line-clamp-1 max-w-2xl font-medium">{creator.bio}</p>
                    ) : (
                        <p className="text-xs text-white/10 italic font-medium">Contributor has not yet published a biography to the registry cloud.</p>
                    )}
                    {creator.tags && creator.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-3">
                            {creator.tags.slice(0, 5).map(t => (
                                <span key={t} className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-white/30 font-bold uppercase tracking-wider">
                                    #{t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Impact Stats */}
                <div className="flex items-center gap-4 pr-6 shrink-0">
                    <div className="flex gap-2 mr-4">
                         <button 
                            onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const url = `${window.location.origin}/creators/${creator.slug || creator.uid}`;
                                if (navigator.share) {
                                    try {
                                        await navigator.share({
                                            title: `${creator.displayName} | Creator Profile`,
                                            text: `Discover ${creator.displayName} on PromptResources.`,
                                            url: url,
                                        });
                                    } catch (err) { /* silent cancel */ }
                                } else {
                                    navigator.clipboard.writeText(url);
                                    alert(`Link copied!`);
                                }
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-primary/30 hover:border-primary/30 transition-all opacity-0 group-hover:opacity-100"
                            title="Share Profile"
                        >
                            <Icons.share size={14} />
                        </button>
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigator.clipboard.writeText(`${window.location.origin}/creators/${creator.slug || creator.uid}`);
                                alert(`Link copied!`);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-primary/30 hover:border-primary/30 transition-all opacity-0 group-hover:opacity-100"
                            title="Copy Link"
                        >
                            <Icons.copy size={13} />
                        </button>
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(creator, null, 2));
                                const downloadAnchorNode = document.createElement('a');
                                downloadAnchorNode.setAttribute("href", dataStr);
                                downloadAnchorNode.setAttribute("download", `creator_${creator.slug || creator.uid}.json`);
                                document.body.appendChild(downloadAnchorNode);
                                downloadAnchorNode.click();
                                downloadAnchorNode.remove();
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-emerald-600/30 hover:border-emerald-500/30 transition-all opacity-0 group-hover:opacity-100"
                            title="Quick Export"
                        >
                            <Icons.download size={14} />
                        </button>
                    </div>

                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-black text-white tracking-tighter">{creator.authoredCount || 0}</span>
                        <span className="text-[8px] uppercase tracking-widest text-white/20 font-black mt-1">Authored</span>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-black text-white/60 tracking-tighter">{creator.curatedCount || 0}</span>
                        <span className="text-[8px] uppercase tracking-widest text-white/20 font-black mt-1">Curated</span>
                    </div>
                </div>

                <div className="text-white/10 group-hover:text-primary group-hover:translate-x-1.5 transition-all">
                    <Icons.chevronRight size={24} />
                </div>
            </Link>
        )
    }

    // Default Grid Mode
    // Premium Grid Mode
    return (
        <div
            className={`group glass-card relative overflow-hidden transition-all duration-300 flex flex-col hover:border-primary/30 shadow-2xl ${
                featured ? 'bg-primary/5 ring-1 ring-primary/20' : ''
            }`}
        >
            {/* Quick Utility Overlay */}
            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/creators/${creator.slug || creator.uid}`); alert('Link copied!'); }}
                    className="p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-primary transition-all"
                >
                    <Icons.copy size={12} />
                </button>
            </div>

            <Link href={`/creators/${creator.slug || creator.uid}`} className="p-6 flex flex-col h-full">
                <div className="flex items-start gap-4 mb-6">
                    <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-[1.25rem] p-[2px] bg-gradient-to-br from-white/20 to-transparent shadow-2xl">
                            <div className="w-full h-full rounded-[1.15rem] overflow-hidden bg-background">
                                {creator.photoURL ? (
                                    <img src={creator.photoURL} alt={creator.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-white text-xl">
                                        {initials}
                                    </div>
                                )}
                            </div>
                        </div>
                        {creator.isVerified && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-lg flex items-center justify-center border-2 border-background-secondary">
                                <Icons.check size={10} strokeWidth={4} />
                            </div>
                        )}
                    </div>
                    
                    <div className="min-w-0 flex-1 pt-1">
                        <h3 className="text-lg font-bold text-white group-hover:text-primary transition-all truncate leading-tight">
                            {creator.displayName}
                        </h3>
                        <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">
                            {creator.profileType || 'Contributor'}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-white/40 font-medium leading-relaxed line-clamp-2 mb-6">
                    {creator.bio || "Awaiting profile telemetry from the registry cloud..."}
                </p>

                <div className="mt-auto pt-6 border-t border-white/5 grid grid-cols-2 gap-3">
                    <div className="bg-black/20 rounded-xl p-3 flex flex-col items-center">
                        <span className="text-xl font-black text-white tracking-tighter">{creator.authoredCount || 0}</span>
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">Authored</span>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3 flex flex-col items-center">
                        <span className="text-xl font-black text-white/60 tracking-tighter">{creator.curatedCount || 0}</span>
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">Curated</span>
                    </div>
                </div>

                {creator.tags && creator.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {creator.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] text-primary/60 font-bold italic">#{tag}</span>
                        ))}
                    </div>
                )}
            </Link>
        </div>
    );
}
