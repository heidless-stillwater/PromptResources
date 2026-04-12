'use client';

import React, { useState, useEffect } from 'react';
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
import { Icons } from '@/components/ui/Icons';

interface Props {
    creator: UserProfile;
    initialResources: Resource[];
    stats: CreatorStats;
}

const socialIcon = (platform: CreatorSocial['platform']) => {
    switch (platform) {
        case 'youtube': return <Icons.play size={14} />;
        case 'twitter': return <Icons.twitter size={14} />;
        case 'github': return <Icons.database size={14} />;
        case 'linkedin': return <Icons.user size={14} />;
        case 'website': return <Icons.globe size={14} />;
        default: return <Icons.external size={14} />;
    }
};

const profileTypeBadge = (type?: string) => {
    const map: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
        individual: { label: 'Creator', bgColor: 'bg-indigo-500/10', textColor: 'text-indigo-400', borderColor: 'border-indigo-500/20' },
        channel: { label: 'Channel', bgColor: 'bg-rose-500/10', textColor: 'text-rose-400', borderColor: 'border-rose-500/20' },
        organization: { label: 'Organization', bgColor: 'bg-teal-500/10', textColor: 'text-teal-400', borderColor: 'border-teal-500/20' },
    };
    return map[type || 'individual'] || map.individual;
};

export default function CreatorProfileClient({ creator, initialResources, stats }: Props) {
    const authoredResources = initialResources.filter(r =>
        r.attributions?.some(a => a.userId === creator.uid && a.role !== 'curator')
    );
    const curatedResources = initialResources.filter(r =>
        r.addedBy === creator.uid || r.attributions?.some(a => a.userId === creator.uid && a.role === 'curator')
    );

    const defaultTab: 'authored' | 'curated' =
        curatedResources.length > 0 ? 'curated' :
        authoredResources.length > 0 ? 'authored' :
        'curated';

    const [activeTab, setActiveTab] = useState<'authored' | 'curated'>(defaultTab);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number | 'all'>(50);
    const [isEditingHeader, setIsEditingHeader] = useState(false);
    const [currentBanner, setCurrentBanner] = useState(creator.bannerUrl);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'small'>('grid');

    const badge = profileTypeBadge(creator.profileType);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
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

    const filteredResources = activeTab === 'authored' ? authoredResources : curatedResources;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert(`Direct link to ${creator.displayName}'s profile copied!`);
    };

    const handleSocialShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${creator.displayName} | Creator Profile`,
                    text: `Discover the AI resources and collections from ${creator.displayName} on PromptResources.`,
                    url: window.location.href,
                });
            } catch (err) {
                console.log('User cancelled share');
            }
        } else {
            handleCopyLink();
        }
    };

    const handleExport = () => {
        const exportData = {
            profile: creator,
            stats: stats,
            contributions: {
                authored: authoredResources,
                curated: curatedResources
            },
            exportedAt: new Date().toISOString()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `creator_profile_${creator.slug || creator.uid}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const totalItems = filteredResources.length;
    const isAll = pageSize === 'all';
    const effectivePageSize = isAll ? totalItems : pageSize;
    const totalPages = isAll ? 1 : Math.ceil(totalItems / effectivePageSize);
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
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] text-white">
            <Navbar />
            
            {/* ── CINEMATIC HERO COVER ── */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer (Blurred Telemetry) */}
                <div className="absolute inset-0 z-0">
                    {currentBanner ? (
                        <div className="relative w-full h-full">
                            <img 
                                src={currentBanner} 
                                alt="" 
                                className="w-full h-full object-cover scale-110 blur-3xl opacity-20" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/40 via-[#0a0a0f]/80 to-[#0a0a0f]" />
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-[#0a0a0f] to-[#0a0a0f]" />
                    )}
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    {/* Header Pathing */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <div className="flex items-center gap-4">
                            <Link href="/creators" className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all group">
                                <Icons.arrowLeft size={20} className="text-white/40 group-hover:text-indigo-400 group-hover:-translate-x-1 transition-all" />
                            </Link>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Creators
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                    <span className="text-indigo-400/60 uppercase">Identity Profile</span>
                                    <span className="opacity-20">/</span>
                                    <span className="truncate max-w-[200px]">{creator.displayName}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleSocialShare}
                                className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all flex items-center gap-2"
                            >
                                <Icons.share size={18} /> Share Profile
                            </button>
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <Link href="/creators" className="px-6 py-2.5 bg-indigo-600 border border-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20">
                                <Icons.users size={18} /> Community Registry
                            </Link>
                        </div>
                    </div>

                    {/* Identity Glass Card */}
                    <div className="glass-card p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row gap-10">
                            {/* Visual Identity (Avatar) */}
                            <div className="relative flex-shrink-0">
                                <div className="w-32 h-32 md:w-48 md:h-48 rounded-[2.5rem] p-[2px] bg-gradient-to-br from-white/40 via-white/5 to-transparent backdrop-blur-3xl shadow-2xl overflow-hidden hover:scale-105 transition-transform duration-500">
                                    <div className="w-full h-full rounded-[2.4rem] overflow-hidden bg-[#0a0a0f]">
                                        {creator.photoURL ? (
                                            <img src={creator.photoURL} alt={creator.displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-5xl font-black text-white">
                                                {initials}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {creator.isVerified && (
                                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center border-4 border-[#12121e] shadow-2xl" title="Verified Pioneer">
                                        <Icons.check size={22} strokeWidth={4} />
                                    </div>
                                )}
                                {isAuthorized && (
                                    <button 
                                        onClick={() => setIsEditingHeader(true)}
                                        className="absolute -top-2 -right-2 p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-white/40 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                                    >
                                        <Icons.image size={18} />
                                    </button>
                                )}
                            </div>

                            {/* Textual Identity */}
                            <div className="flex-1 flex flex-col py-2">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                        {badge.label}
                                    </span>
                                    <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em]">Pioneer ID: {creator.uid.slice(0, 8)}</span>
                                </div>

                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4 leading-none">
                                    {creator.displayName}
                                </h1>

                                {creator.bio && (
                                    <p className="text-white/50 max-w-2xl text-base font-medium leading-relaxed mb-4">
                                        {creator.bio}
                                    </p>
                                )}

                                <div className="mt-auto flex flex-wrap gap-4">
                                    {creator.socials?.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-3 text-xs font-bold text-white/60 hover:text-white"
                                        >
                                            <span className="text-indigo-400">{socialIcon(s.platform)}</span>
                                            <span className="capitalize tracking-tight">{s.label || s.platform}</span>
                                        </a>
                                    ))}
                                    
                                    {isAuthorized && (
                                        <Link href="/dashboard/settings" className="p-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all text-white/40 hover:text-indigo-400">
                                            <Icons.settings size={20} />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 -mt-28 pb-12 relative z-30">
                {/* ── IMPACT GRID ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Authored Resources', value: stats.authoredCount, icon: <Icons.wand size={20} />, color: 'from-indigo-500/10 to-indigo-500/5' },
                        { label: 'Curated Assets', value: stats.curatedCount, icon: <Icons.grid size={20} />, color: 'from-indigo-500/10 to-indigo-500/5' },
                        { label: 'Categories Mastered', value: stats.categories.length, icon: <Icons.tag size={20} />, color: 'from-indigo-500/10 to-indigo-500/5' },
                        { label: 'Community Rating', value: stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—', icon: <Icons.sparkles size={20} />, color: 'from-indigo-500/10 to-indigo-500/5' }
                    ].map((stat, i) => (
                        <div key={i} className={`relative bg-gradient-to-br ${stat.color} border border-white/10 p-8 rounded-[2rem] flex flex-col items-center gap-3 hover:bg-white/5 transition-all group overflow-hidden`}>
                            <div className="text-indigo-400 group-hover:scale-110 transition-transform duration-500 z-10 opacity-60">{stat.icon}</div>
                            <div className="text-5xl font-black text-white relative z-10 tracking-tight">{stat.value}</div>
                            <div className="text-[10px] uppercase font-black tracking-[0.25em] text-white/30 text-center z-10 leading-tight">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── RESOURCE EXPLORER ── */}
                <section className="mt-20">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12 border-b border-white/5 pb-8">
                        <div className="flex items-center gap-14">
                            <h2 className="text-3xl font-black text-white tracking-tighter">Contributions</h2>
                            <div className="flex gap-10">
                                {['authored', 'curated'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }}
                                        className={`relative py-3 text-sm font-black uppercase tracking-widest transition-all ${
                                            activeTab === tab ? 'text-indigo-400' : 'text-white/30 hover:text-white/70'
                                        }`}
                                    >
                                        {tab === 'authored' ? 'Authored' : 'Curated'}
                                        {activeTab === tab && (
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest leading-none">View Mode</span>
                                <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/5">
                                    <button 
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}`}
                                        title="Gallery View"
                                    >
                                        <Icons.grid size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('small')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'small' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}`}
                                        title="Compact View"
                                    >
                                        <Icons.feed size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}`}
                                        title="List View"
                                    >
                                        <Icons.text size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest leading-none">Density</span>
                                <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/5">
                                    {[20, 50, 'all'].map(size => (
                                        <button
                                            key={size}
                                            onClick={() => { setPageSize(size as any); setCurrentPage(1); }}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                                                pageSize === size ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
                                            }`}
                                        >
                                            {size === 'all' ? 'ALL' : size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {filteredResources.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-20 text-center">
                            <Icons.grid size={48} className="mx-auto text-white/10 mb-6" />
                            <p className="text-white/40 font-medium">No resources found in this collection.</p>
                        </div>
                    ) : (
                        <>
                            <div className={
                                viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12' : 
                                viewMode === 'small' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-12' :
                                'flex flex-col gap-6 mb-12'
                            }>
                                {paginatedResources.map(resource => (
                                    <ResourceCard key={resource.id} resource={resource} viewMode={viewMode} />
                                ))}
                            </div>

                            {!isAll && totalPages > 1 && (
                                <div className="flex justify-center mt-16 pb-12">
                                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 p-2 rounded-full backdrop-blur-md">
                                        <button 
                                            disabled={safeCurrentPage === 1}
                                            onClick={() => {
                                                setCurrentPage(prev => Math.max(1, prev - 1));
                                                window.scrollTo({ top: 400, behavior: 'smooth' });
                                            }}
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                        >
                                            <Icons.chevronLeft size={20} />
                                        </button>
                                        
                                        <div className="flex gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                                <button 
                                                    key={num}
                                                    onClick={() => {
                                                        setCurrentPage(num);
                                                        window.scrollTo({ top: 400, behavior: 'smooth' });
                                                    }}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                                        safeCurrentPage === num 
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                                            : 'text-white/40 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>

                                        <button 
                                            disabled={safeCurrentPage === totalPages}
                                            onClick={() => {
                                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                                window.scrollTo({ top: 400, behavior: 'smooth' });
                                            }}
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                        >
                                            <Icons.chevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>

            <Footer />

            <ThumbnailPicker 
                isOpen={isEditingHeader}
                onClose={() => setIsEditingHeader(false)}
                onSelect={handleBannerSelect}
            />
        </div>
    );
}
