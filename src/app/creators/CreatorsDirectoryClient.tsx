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
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table' | 'small'>('grid');

    // Preference Persistence
    useEffect(() => {
        const savedMode = localStorage.getItem('creators_view_mode');
        if (savedMode && ['grid', 'list', 'table', 'small'].includes(savedMode)) {
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

                    {/* ── PAGE HEADER ── */}
                    <div className="text-center py-16 mb-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600/15 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
                            <Icons.trophy size={12} /> Hall of Fame
                        </div>
                        <h1 className="text-6xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-none block">
                            Community Registry
                        </h1>
                        <p className="text-white/50 text-lg max-w-2xl mx-auto">
                            Discover the pioneers, builders, and educators shaping the future of the AI learning landscape.
                        </p>
                    </div>

                    {/* ── REGISTRY STATS ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'Total Pioneers', value: creators.length, icon: <Icons.users size={16} />, color: 'text-indigo-400' },
                            { label: 'Verified Leaders', value: creators.filter(c => c.isVerified).length, icon: <Icons.check size={16} />, color: 'text-emerald-400' },
                            { label: 'Global Impact', value: creators.reduce((acc, c) => acc + (c.resourceCount || 0), 0), icon: <Icons.sparkles size={16} />, color: 'text-amber-400' },
                            { label: 'Registry Rank', value: creators.filter(c => c.rank).length, icon: <Icons.trophy size={16} />, color: 'text-rose-400' }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4 hover:bg-white/[0.04] transition-colors group">
                                <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <div className="text-lg font-black text-white leading-none mb-1">{stat.value}</div>
                                    <div className="text-[9px] uppercase font-bold tracking-widest text-white/30">{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── FILTER BAR ── */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 flex flex-col gap-5 backdrop-blur-sm shadow-2xl">
                        {/* Search + type filters */}
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Search */}
                            <div className="relative flex-grow min-w-[260px]">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-lg pointer-events-none transition-colors ${search ? 'text-indigo-400' : 'text-white/30'}`}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search by name, expertise or platform…"
                                    className="w-full h-12 pl-12 pr-12 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    id="creators-search"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80 transition-colors"
                                        title="Clear search"
                                    >✕</button>
                                )}
                            </div>

                            {/* Type chips */}
                            <div className="flex gap-2 flex-wrap">
                                {(['all', 'individual', 'channel', 'organization'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`h-11 px-5 rounded-xl text-sm font-bold transition-all border ${filterType === type
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                            : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]'
                                        }`}
                                        id={`filter-type-${type}`}
                                    >
                                        {type === 'all' ? 'All Members' : type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort + verified toggle + clear */}
                        <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-6">
                                {/* Verified toggle */}
                                <label className="flex items-center gap-3 cursor-pointer select-none" htmlFor="toggle-verified">
                                    <div
                                        onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
                                        className={`w-10 h-[22px] rounded-full relative transition-colors ${showVerifiedOnly ? 'bg-emerald-500' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-all ${showVerifiedOnly ? 'left-[21px]' : 'left-[3px]'}`} />
                                    </div>
                                    <span className={`text-sm font-semibold transition-colors ${showVerifiedOnly ? 'text-emerald-400' : 'text-white/40'}`}>
                                        Verified Only
                                    </span>
                                </label>

                                <div className="w-px h-5 bg-white/10" />

                                {/* Sort */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Sort By:</span>
                                        <select
                                            className="bg-transparent text-indigo-400 font-bold text-sm outline-none cursor-pointer"
                                            value={sortBy}
                                            onChange={e => setSortBy(e.target.value as any)}
                                            id="creators-sort"
                                        >
                                            <option value="authored" className="bg-[#12121e]">Authorship</option>
                                            <option value="curated" className="bg-[#12121e]">Curation</option>
                                            <option value="total" className="bg-[#12121e]">Total Impact</option>
                                            <option value="name" className="bg-[#12121e]">Alphabetical</option>
                                            <option value="newest" className="bg-[#12121e]">Recency</option>
                                        </select>
                                    </div>

                                    <button 
                                        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
                                        title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                                    >
                                        {sortOrder === 'desc' ? <Icons.trendingDown size={14} /> : <Icons.trendingUp size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* View Toggles */}
                                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shadow-inner overflow-hidden">
                                    <button 
                                        onClick={() => setViewMode('grid')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}`}
                                        title="Gallery View"
                                    >
                                        <Icons.grid size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('small')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'small' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}`}
                                        title="Compact Grid"
                                    >
                                        <Icons.feed size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('list')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}`}
                                        title="List View"
                                    >
                                        <Icons.text size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('table')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}`}
                                        title="Table View"
                                    >
                                        <Icons.rows size={18} />
                                    </button>
                                </div>

                                {hasFilters && (
                                    <button
                                        onClick={() => { setSearch(''); setFilterType('all'); setShowVerifiedOnly(false); }}
                                        className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 h-8 rounded-lg transition-all"
                                        id="clear-creators-filters"
                                    >
                                        <Icons.refresh size={11} /> Clear
                                    </button>
                                )}

                                <div className="w-px h-6 bg-white/10 mx-1" />

                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleShare}
                                        className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all shadow-inner"
                                        title="Share Directory Link"
                                    >
                                        <Icons.share size={16} />
                                    </button>
                                    <button 
                                        onClick={handleExport}
                                        className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-emerald-600/20 hover:border-emerald-500/30 transition-all shadow-inner"
                                        title="Export Registry (JSON)"
                                    >
                                        <Icons.download size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── RESULTS ── */}
                    {filtered.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-24 text-center">
                            <Icons.users size={64} className="mx-auto mb-6 text-white/5" />
                            <h3 className="text-xl font-bold text-white/60 mb-2">No Pioneers Discovered</h3>
                            <p className="text-white/30 font-medium">Try broadening your search or adjusting the classification filters.</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {/* Featured (only show in Grid view as a special section) */}
                            {featured.length > 0 && !search && filterType === 'all' && viewMode === 'grid' && (
                                <section>
                                    <div className="flex items-center gap-4 mb-8">
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Featured Pioneers</h2>
                                        <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/25 to-transparent" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {featured.map(c => <CreatorCard key={c.uid} creator={c} featured viewMode="grid" />)}
                                    </div>
                                </section>
                            )}

                            <section>
                                <div className="flex items-center justify-between mb-8 px-2">
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">
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
                                                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-600/20 flex-shrink-0">
                                                                    {c.photoURL ? (
                                                                        <img src={c.photoURL} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center font-black text-indigo-400 text-xs uppercase">
                                                                            {c.displayName[0]}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-bold text-white flex items-center gap-2 group-hover:text-indigo-400 transition-colors">
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
                                                            <Link href={`/creators/${c.slug || c.uid}`} className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-400/10 px-4 py-2 rounded-lg">
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

function CreatorCard({ creator, featured = false, viewMode = 'grid' }: { creator: UserProfile; featured?: boolean, viewMode?: 'grid' | 'list' | 'table' | 'small' }) {
    const initials = creator.displayName
        .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    if (viewMode === 'small') {
        return (
            <Link
                href={`/creators/${creator.slug || creator.uid}`}
                className="group flex flex-col p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all h-full relative"
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
                        className="p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-indigo-600 transition-all"
                    >
                        <Icons.share size={10} />
                    </button>
                </div>

                <div className="flex items-start gap-3 mb-3">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                        {creator.photoURL ? (
                            <img src={creator.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-indigo-600/20 flex items-center justify-center text-xs font-black text-indigo-400">
                                {initials}
                            </div>
                        )}
                        {creator.isVerified && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#0f0f15]">
                                <Icons.check size={8} strokeWidth={4} />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{creator.displayName}</h3>
                        <div className="text-[9px] text-white/20 font-black uppercase tracking-tighter truncate">/{creator.slug || 'user'}</div>
                    </div>
                </div>

                <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <Icons.wand size={10} className="text-indigo-400/50" />
                        <span className="text-[10px] font-black text-white/60">{creator.authoredCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Icons.grid size={10} className="text-emerald-400/50" />
                        <span className="text-[10px] font-black text-white/60">{creator.curatedCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-indigo-400/40">
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
                        ? 'bg-indigo-600/[0.08] border-indigo-500/30 hover:border-indigo-400/50'
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
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-2xl font-black text-white ring-2 ring-white/5 shadow-2xl">
                            {initials}
                        </div>
                    )}
                    {creator.isVerified && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#0f0f15] shadow-lg">
                            <Icons.check size={12} strokeWidth={4} />
                        </div>
                    )}
                </div>

                {/* Identity & Bio */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-xl font-extrabold text-white group-hover:text-indigo-400 transition-colors tracking-tight">{creator.displayName}</h3>
                        <span className="text-indigo-400/40">{profileTypeIcon(creator.profileType, 16)}</span>
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
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-indigo-600/30 hover:border-indigo-500/30 transition-all opacity-0 group-hover:opacity-100"
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
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-indigo-600/30 hover:border-indigo-500/30 transition-all opacity-0 group-hover:opacity-100"
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

                <div className="text-white/10 group-hover:text-indigo-400 group-hover:translate-x-1.5 transition-all">
                    <Icons.chevronRight size={24} />
                </div>
            </Link>
        )
    }

    // Default Grid Mode
    return (
        <Link
            href={`/creators/${creator.slug || creator.uid}`}
            className={`block rounded-2xl border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl group overflow-hidden h-full relative ${
                featured
                    ? 'bg-indigo-600/[0.08] border-indigo-500/30 hover:border-indigo-400/50 hover:shadow-indigo-600/10'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
            }`}
            style={{ textDecoration: 'none' }}
        >
            {featured && (
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            )}

            {/* Quick Actions (Hover Only) */}
            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            } catch (err) { /* focus check */ }
                        } else {
                            navigator.clipboard.writeText(url);
                            alert(`Link copied!`);
                        }
                    }}
                    className="p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-indigo-600 transition-all shadow-xl"
                    title="Share Profile"
                >
                    <Icons.share size={12} />
                </button>
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigator.clipboard.writeText(`${window.location.origin}/creators/${creator.slug || creator.uid}`);
                        alert(`Link to ${creator.displayName} copied!`);
                    }}
                    className="p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-indigo-600 transition-all shadow-xl"
                    title="Copy Link"
                >
                    <Icons.copy size={12} />
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
                    className="p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-emerald-600 transition-all shadow-xl"
                    title="Quick Export"
                >
                    <Icons.download size={12} />
                </button>
            </div>

            <div className="p-7 flex flex-col gap-5 h-full relative z-10">
                <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                        {creator.photoURL ? (
                            <img
                                src={creator.photoURL}
                                alt={creator.displayName}
                                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/5"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-xl font-black text-white ring-2 ring-white/5">
                                {initials}
                            </div>
                        )}
                        {creator.isVerified && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#0f0f15]">
                                <Icons.check size={10} strokeWidth={4} />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-indigo-400/60">{profileTypeIcon(creator.profileType)}</span>
                            <h3 className="font-extrabold text-white group-hover:text-indigo-400 transition-all truncate tracking-tight">{creator.displayName}</h3>
                        </div>
                        {creator.isStub && (
                            <span className="text-[8px] uppercase tracking-[0.2em] text-white/20 font-black">Registry Contributor</span>
                        )}
                    </div>
                </div>

                {creator.bio ? (
                    <p className="text-sm text-white/40 leading-relaxed line-clamp-2 font-medium">{creator.bio}</p>
                ) : (
                    <div className="h-[2.8rem] flex items-center">
                         <span className="text-[10px] text-white/10 italic font-medium uppercase tracking-widest">Awaiting profile telemetry...</span>
                    </div>
                )}

                <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/20 rounded-xl px-2 py-2.5 flex flex-col items-center">
                            <span className="text-xl font-black text-white tracking-tighter">{creator.authoredCount || 0}</span>
                            <span className="text-[8px] uppercase tracking-widest text-white/20 font-black">Authored</span>
                        </div>
                        <div className="bg-black/20 rounded-xl px-2 py-2.5 flex flex-col items-center">
                            <span className="text-xl font-black text-white/60 tracking-tighter">{creator.curatedCount || 0}</span>
                            <span className="text-[8px] uppercase tracking-widest text-white/20 font-black">Curated</span>
                        </div>
                    </div>

                    {creator.tags && creator.tags.length > 0 ? (
                        <div className="flex gap-1.5 flex-wrap">
                            {creator.tags.slice(0, 3).map(t => (
                                <span key={t} className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-white/40 font-bold uppercase tracking-wider">
                                    #{t}
                                </span>
                            ))}
                        </div>
                    ) : (
                         <div className="h-5" />
                    )}
                </div>
            </div>
        </Link>
    );
}
