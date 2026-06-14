'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import Rating from '@/components/Rating';
import CreatorChip from '@/components/CreatorChip';
import { Icons } from '@/components/ui/Icons';
import { useTheme } from '@/components/providers/ThemeProvider';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';
import Modal from '@/components/Modal';
import { getSharedPlaylists, clearPlaylistsCache } from '@/lib/playlists-cache';

interface ResourceCardProps {
    resource: Resource;
    savedIds?: Set<string>;
    onToggleSave?: (e: React.MouseEvent, resourceId: string) => void;
    onDelete?: (e: React.MouseEvent, resourceId: string) => void;
    onToggleFavorite?: (e: React.MouseEvent, resourceId: string, currentStatus: boolean) => void;
    viewMode?: 'grid' | 'list' | 'small' | 'minimal';
}

export default function ResourceCard({ resource, savedIds = new Set(), onToggleSave, onDelete, onToggleFavorite, viewMode = 'grid' }: ResourceCardProps) {
    const { user, isAdmin } = useAuth();
    const { isDarkMode } = useTheme();
    const isSaved = savedIds.has(resource.id);
    const canEdit = isAdmin || (user && resource.addedBy === user.uid);

    const router = useRouter();
    const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
    const [itemPlaylists, setItemPlaylists] = useState<any[]>([]);
    const [isExplorerOpen, setIsExplorerOpen] = useState(false);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

    useEffect(() => {
        if (isCopyModalOpen) {
            const timer = setTimeout(() => {
                setIsCopyModalOpen(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isCopyModalOpen]);

    useEffect(() => {
        const handleUpdate = () => {
            if (user) {
                getSharedPlaylists(async () => await user.getIdToken())
                    .then(list => {
                        const matched = list.filter(p => (p.resourceIds || []).includes(resource.id));
                        setItemPlaylists(matched);
                    });
            } else {
                setItemPlaylists([]);
            }
        };

        window.addEventListener('playlists-updated', handleUpdate);
        handleUpdate();

        return () => {
            window.removeEventListener('playlists-updated', handleUpdate);
        };
    }, [user, resource.id]);

    const handleCardClick = (e: React.MouseEvent) => {
        // Only navigate if we didn't click an interactive element
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('.featured-star')) {
            return;
        }
        router.push(`/resources/${resource.id}`);
    };

    const typeIcons: Record<string, string> = {
        article: '📄',
        tool: '🔧',
        course: '🎓',
        book: '📚',
        video: '📺',
        newsletter: '📧',
        tutorial: '💡',
        other: '📖'
    };

    const reportLabels: Record<string, string> = {
        illegal: 'Safety Concern',
        harmful_children: 'Protecting Minors',
        harassment: 'Community Respect',
        hate_speech: 'Inclusivity Check',
        misinformation: 'Quality Verification',
        spam: 'Platform Integrity',
        other: 'General Feedback'
    };

    const platformIcons: Record<string, string> = {
        gemini: '♊',
        nanobanana: '🍌',
        chatgpt: '🤖',
        claude: '🎨',
        midjourney: '🌌',
        general: '🌐',
        other: '🏷️'
    };

    const pricingIcons: Record<string, string> = {
        free: '🆓',
        paid: '💰',
        freemium: '🔓'
    };

    if (viewMode === 'small') {
        return (
            <div
                id={`resource-card-${resource.id}`}
                className={`group glass-card !p-0 border rounded-2xl overflow-hidden hover:border-primary/30 transition-all flex flex-col h-full cursor-pointer shadow-lg font-inter ${
                    isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.02] border-slate-200/80 shadow-slate-100/5'
                }`}
                onClick={handleCardClick}
            >
                <div className="relative aspect-video overflow-hidden shrink-0 m-1 rounded-xl">
                    {resource.thumbnailUrl || resource.youtubeVideoId ? (
                        <NextImage
                            src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/hqdefault.jpg`}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center text-2xl ${isDarkMode ? 'bg-white/5 opacity-20' : 'bg-black/5 opacity-30'}`}>
                            {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                        </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1 z-10">
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border backdrop-blur-sm flex items-center gap-1 bg-black/60 text-white/80 border-white/5`}>
                            <span>{pricingIcons[resource.pricing] || '💰'}</span>
                            {resource.pricing}
                        </span>
                    </div>
                </div>
                <div className="px-2 pb-2 flex flex-col flex-grow">
                    <h3 className={`text-[11px] font-bold font-outfit tracking-tight group-hover:text-primary transition-colors line-clamp-2 mb-3 leading-tight min-h-[2.2em] ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                        {resource.title}
                    </h3>
                    <div className={`mt-auto flex items-center justify-between gap-2 pt-3 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-1.5">
                            <Icons.grid size={10} className="text-primary/50" />
                            <span className={`text-[9px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>{resource.platform}</span>
                        </div>
                        <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                    </div>
                </div>
            </div>
        );
    }
    
    if (viewMode === 'minimal') {
        return (
            <div
                id={`resource-card-${resource.id}`}
                className={`group glass-card !p-0 border rounded-lg overflow-hidden hover:border-primary/30 transition-all flex flex-col h-full cursor-pointer shadow-md font-inter border-t-2 border-t-transparent hover:border-t-primary ${
                    isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.02] border-slate-200/80 shadow-slate-100/5'
                }`}
                onClick={handleCardClick}
            >
                <div className="relative aspect-video overflow-hidden shrink-0">
                    {resource.thumbnailUrl || resource.youtubeVideoId ? (
                        <NextImage
                            src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/hqdefault.jpg`}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center text-lg ${isDarkMode ? 'bg-white/5 opacity-20' : 'bg-black/5 opacity-30'}`}>
                            {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                        </div>
                    )}
                    <div className="absolute top-1 left-1 flex gap-0.5 z-10">
                         <span className="text-[6px] font-black uppercase px-1 py-0.5 rounded bg-black/60 text-white/80 border border-white/5 backdrop-blur-sm flex items-center gap-0.5">
                            {pricingIcons[resource.pricing] || '💰'}
                        </span>
                    </div>
                </div>
                <div className="p-0.5 px-1 pb-1.5 flex flex-col flex-grow">
                    <h3 className={`text-[9px] font-bold font-outfit tracking-tight group-hover:text-primary transition-colors line-clamp-2 mb-1.5 leading-tight min-h-[2.2em] ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                        {resource.title}
                    </h3>
                    <div className={`mt-auto flex items-center justify-between gap-1 pt-1 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-1 min-w-0">
                            <span className={`text-[7px] font-black uppercase tracking-tighter truncate ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`}>{resource.platform}</span>
                        </div>
                        <Rating value={resource.averageRating || 0} size="xs" showLabel={false} />
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'list') {
        return (
            <div
                id={`resource-card-${resource.id}`}
                className={`flex flex-col md:flex-row gap-6 p-5 rounded-[2rem] border backdrop-blur-xl hover:border-primary/30 transition-all duration-500 group cursor-pointer shadow-2xl relative overflow-hidden font-inter ${
                    isDarkMode ? 'border-white/10 bg-white/[0.03] shadow-black/20' : 'border-slate-200/80 bg-white/70 shadow-slate-100/5'
                }`}
                onClick={handleCardClick}
            >
                {/* Featured Glow */}
                {resource.isFavorite && (
                    <div className="absolute top-0 right-0 p-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                )}

                {/* Thumbnail Side */}
                <div className={`relative w-full md:w-72 aspect-video md:aspect-auto rounded-2xl overflow-hidden flex-shrink-0 border ${isDarkMode ? 'border-white/5' : 'border-slate-200/50'}`}>
                    {resource.thumbnailUrl || resource.youtubeVideoId ? (
                        <NextImage
                            src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/hqdefault.jpg`}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br ${isDarkMode ? 'from-white/5 to-white/[0.02]' : 'from-black/5 to-black/[0.02]'}`}>
                            {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                        </div>
                    )}
                    <div className="absolute top-3 left-3 z-[10] flex flex-col gap-2">
                        <span className="px-3 py-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/90 flex items-center gap-2">
                            <span>{pricingIcons[resource.pricing] || '💰'}</span>
                            {resource.pricing}
                        </span>
                    </div>
                </div>

                {/* Content Side */}
                <div className="flex flex-col flex-grow min-w-0 pt-2">
                    <div className="flex justify-between items-start gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                            <h3 className={`text-xl font-bold font-outfit tracking-tighter leading-tight group-hover:text-primary transition-all mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                <Link href={`/resources/${resource.id}`} onClick={(e) => e.stopPropagation()}>
                                    {resource.title}
                                </Link>
                            </h3>
                            <div className={`flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                                <span className="flex items-center gap-1.5">
                                    <span className={isDarkMode ? 'text-white/10' : 'text-slate-350'}>{platformIcons[resource.platform] || '🌐'}</span>
                                    {resource.platform}
                                </span>
                                {resource.rank && <span className="text-amber-500">🏆 #{resource.rank} Rank</span>}
                                {resource.createdAt && (
                                    <span 
                                        className={`flex items-center gap-1.5 ml-auto italic font-medium ${isDarkMode ? 'text-white/10' : 'text-slate-300'}`}
                                        suppressHydrationWarning
                                    >
                                        <Icons.calendar size={10} />
                                        {new Date(resource.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Utility Toolbar */}
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/resources/${resource.id}`); setIsCopyModalOpen(true); }}
                                    className={`p-2.5 border rounded-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white/20 hover:text-white hover:bg-primary/30' : 'bg-black/5 border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}
                                    title="Copy Registry Path"
                                >
                                    <Icons.copy size={14} />
                                </button>
                                {user && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setIsPlaylistOpen(true); }}
                                        className={`p-2.5 border rounded-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white/20 hover:text-white hover:bg-primary/30' : 'bg-black/5 border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}
                                        title="Add to Playlist"
                                    >
                                        <Icons.list size={14} />
                                    </button>
                                )}
                                {canEdit && (
                                    <Link 
                                        href={`/resources/${resource.id}/edit`} 
                                        onClick={(e) => e.stopPropagation()}
                                        className={`p-2.5 border rounded-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white/20 hover:text-white hover:bg-primary' : 'bg-black/5 border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}
                                        title="Modify Asset"
                                    >
                                        <Icons.edit size={14} />
                                    </Link>
                                )}
                            </div>
                            <button
                                className={`p-3 rounded-xl border transition-all active:scale-95 ${
                                    isSaved 
                                        ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' 
                                        : isDarkMode 
                                            ? 'bg-white/5 border-white/10 text-white/20 hover:text-white' 
                                            : 'bg-black/5 border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                                onClick={(e) => onToggleSave?.(e, resource.id)}
                                title={isSaved ? 'Remove from Vault' : 'Secure to Vault'}
                            >
                                {isSaved ? '★' : '☆'}
                            </button>
                        </div>
                    </div>

                    <p className={`text-sm font-medium line-clamp-2 leading-relaxed mb-6 max-w-3xl ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>{resource.description}</p>

                    <div className={`mt-auto flex flex-wrap items-center justify-between gap-6 pt-5 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                {resource.tags?.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-primary/40 italic">#{tag}</span>
                                ))}
                            </div>
                            {/* Playlist Assignment Explorer Trigger */}
                            {user && (
                                <div className="relative w-48 mt-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={() => setIsExplorerOpen(true)}
                                        className={`w-full text-[9px] font-bold uppercase tracking-widest h-8 px-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                                            itemPlaylists.length > 0
                                                ? 'bg-primary/5 border-primary/20 text-primary hover:border-primary/45'
                                                : 'bg-[var(--bg-secondary)]/30 border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]/80'
                                        }`}
                                    >
                                        <span>
                                            {itemPlaylists.length === 0 
                                                ? 'In 0 Playlists' 
                                                : `In ${itemPlaylists.length} Playlist${itemPlaylists.length > 1 ? 's' : ''}`
                                            }
                                        </span>
                                        <Icons.chevronRight size={12} className="opacity-60" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            {(() => {
                                const primaryAttr = resource.attributions?.find(a => !!a.userId) || resource.attributions?.[0];
                                return primaryAttr ? <CreatorChip attribution={primaryAttr} size="sm" showExternalIcon={false} /> : null;
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default Grid Mode (Synchronized with CreatorCard Premium Grid)
    return (
        <div
            id={`resource-card-${resource.id}`}
            className={`group glass-card !p-0 relative overflow-hidden transition-all duration-500 flex flex-col h-full hover:border-primary/40 shadow-2xl rounded-3xl font-inter ${
                resource.isFavorite ? (isDarkMode ? 'bg-primary/[0.04] ring-1 ring-primary/20' : 'bg-primary/[0.02] ring-1 ring-primary/10') : ''
            } ${isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200/80 shadow-slate-100/5'}`}
            onClick={handleCardClick}
            style={{ cursor: 'pointer' }}
        >
            {/* Quick Utility Overlay */}
            <div className="absolute top-5 right-5 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <button 
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/resources/${resource.id}`); setIsCopyModalOpen(true); }}
                    className="p-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white/40 hover:text-white hover:bg-primary transition-all"
                    title="Copy Registry Path"
                >
                    <Icons.copy size={12} />
                </button>
                {user && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsPlaylistOpen(true); }}
                        className="p-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white/40 hover:text-white hover:bg-primary transition-all"
                        title="Add to Playlist"
                    >
                        <Icons.list size={12} />
                    </button>
                )}
                <button
                    className={`p-2.5 rounded-2xl border transition-all active:scale-95 backdrop-blur-xl ${isSaved ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-black/60 border-white/10 text-white/40 hover:text-white hover:bg-primary'}`}
                    onClick={(e) => onToggleSave?.(e, resource.id)}
                    title={isSaved ? 'Remove from vault' : 'Secure in vault'}
                >
                    {isSaved ? '★' : '☆'}
                </button>
            </div>

            {/* Thumbnail Header */}
            <div className={`relative aspect-video m-2 rounded-[1.5rem] overflow-hidden shrink-0 border shadow-2xl ${isDarkMode ? 'border-white/5' : 'border-slate-200/55'}`}>
                {resource.thumbnailUrl || resource.youtubeVideoId ? (
                    <NextImage
                        src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/hqdefault.jpg`}
                        alt={resource.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        priority={!!resource.isFavorite}
                    />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br ${isDarkMode ? 'from-white/5 to-transparent' : 'from-black/5 to-transparent'}`}>
                         {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                    </div>
                )}
                
                {/* Branding Overlays */}
                <div className="absolute top-3 left-3 z-[10] flex flex-col gap-2">
                    <span className="px-3 py-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/90 flex items-center gap-2">
                        <span>{pricingIcons[resource.pricing] || '💰'}</span>
                        {resource.pricing}
                    </span>
                </div>
            </div>

            <div className="px-3 pb-3 pt-1 flex flex-col flex-grow">
                <div className="flex justify-between items-start gap-4 mb-4">
                    <h3 className={`text-xl font-black font-outfit tracking-tighter leading-tight group-hover:text-primary transition-all line-clamp-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {resource.title}
                    </h3>
                    {resource.isFavorite && (
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/5">
                            <Icons.sparkles size={14} />
                        </div>
                    )}
                </div>
                
                <div className={`flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                    <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                    <span className="flex items-center gap-1.5">
                        <span className={isDarkMode ? 'text-white/10' : 'text-slate-350'}>{platformIcons[resource.platform] || '🌐'}</span>
                        {resource.platform}
                    </span>
                </div>

                <p className={`text-sm font-medium line-clamp-2 leading-relaxed mb-6 ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
                    {resource.description}
                </p>
                
                {/* Tag Belt */}
                {resource.tags && resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                        {resource.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-primary/40 italic">#{tag}</span>
                        ))}
                    </div>
                )}

                {/* Playlist Assignment Explorer Trigger */}
                {user && (
                    <div className="relative mb-8 w-full" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setIsExplorerOpen(true)}
                            className={`w-full text-[10px] font-bold uppercase tracking-widest h-9 px-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                                itemPlaylists.length > 0
                                    ? 'bg-primary/5 border-primary/20 text-primary hover:border-primary/45'
                                    : 'bg-[var(--bg-secondary)]/30 border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]/80'
                            }`}
                        >
                            <span>
                                {itemPlaylists.length === 0 
                                    ? 'In 0 Playlists' 
                                    : `In ${itemPlaylists.length} Playlist${itemPlaylists.length > 1 ? 's' : ''}`
                                }
                            </span>
                            <Icons.chevronRight size={12} className="opacity-60" />
                        </button>
                    </div>
                )}

                {/* Footer Sync */}
                <div className={`mt-auto pt-6 border-t flex items-center justify-between ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                        {(() => {
                            const primaryAttr = resource.attributions?.find(a => !!a.userId) || resource.attributions?.[0];
                            return primaryAttr ? <CreatorChip attribution={primaryAttr} size="sm" showExternalIcon={false} /> : null;
                        })()}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {canEdit && (
                            <Link 
                                href={`/resources/${resource.id}/edit`} 
                                onClick={(e) => e.stopPropagation()}
                                className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center ${isDarkMode ? 'bg-white/5 border-white/10 text-white/20 hover:text-white hover:bg-primary hover:border-primary' : 'bg-black/5 border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}
                                title="Modify Asset"
                            >
                                <Icons.edit size={14} />
                            </Link>
                        )}
                        <div className={`transition-all group-hover:text-primary group-hover:translate-x-1.5 ${isDarkMode ? 'text-white/10' : 'text-slate-300'}`}>
                            <Icons.chevronRight size={24} />
                        </div>
                    </div>
                </div>
            </div>
            <AddToPlaylistModal 
                resourceId={resource.id} 
                isOpen={isPlaylistOpen} 
                onClose={() => setIsPlaylistOpen(false)} 
            />

            {isExplorerOpen && (
                <div 
                    onClick={(e) => { e.stopPropagation(); setIsExplorerOpen(false); }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-[var(--text-primary)]"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-[2rem] border p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh] bg-[var(--bg-primary)] border-[var(--border)] animate-in zoom-in-95 duration-200"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-4 shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Playlist Explorer</span>
                            <button 
                                type="button"
                                onClick={() => setIsExplorerOpen(false)} 
                                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <Icons.close size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto pr-1 space-y-4 py-2 custom-scrollbar max-h-[300px]">
                            {itemPlaylists.length === 0 ? (
                                <div className="py-8 text-center space-y-4">
                                    <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)]/50 flex items-center justify-center mx-auto text-[var(--text-muted)]">
                                        <Icons.list size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold">No Playlists Discovered</h4>
                                        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed px-4">
                                            This asset is not curated in any collections yet.
                                        </p>
                                    </div>
                                    {user && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsExplorerOpen(false);
                                                setIsPlaylistOpen(true);
                                            }}
                                            className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                                        >
                                            Add to Playlist
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[10px] text-[var(--text-muted)] mb-2 px-1">
                                        This asset is included in the following playlists:
                                    </p>
                                    {itemPlaylists.map((playlist) => (
                                        <button
                                            key={playlist.id}
                                            type="button"
                                            onClick={() => {
                                                setIsExplorerOpen(false);
                                                router.push(`/playlists/${playlist.id}`);
                                            }}
                                            className="flex items-center gap-4 p-3 border border-[var(--border)] bg-[var(--bg-secondary)]/30 rounded-2xl cursor-pointer transition-all hover:bg-[var(--bg-secondary)]/60 text-left select-none w-full"
                                        >
                                            {playlist.thumbnailUrl ? (
                                                <img
                                                    src={playlist.thumbnailUrl}
                                                    alt={playlist.title}
                                                    className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)]/50 flex items-center justify-center text-[var(--text-muted)] flex-shrink-0">
                                                    <Icons.list size={20} />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold truncate text-[var(--text-primary)]">{playlist.title}</div>
                                                <div className="text-[8px] font-black text-[var(--text-muted)] opacity-70 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded border text-[6px] font-black uppercase tracking-wider ${
                                                        playlist.status === 'published'
                                                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                                            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                                                    }`}>
                                                        {playlist.status}
                                                    </span>
                                                    <span className="opacity-30">•</span>
                                                    <span>{playlist.resourceIds?.length || 0} Assets</span>
                                                </div>
                                            </div>
                                            <Icons.chevronRight size={14} className="text-[var(--text-muted)] shrink-0 opacity-60" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {isCopyModalOpen && (
                <Modal
                    isOpen={isCopyModalOpen}
                    onClose={() => setIsCopyModalOpen(false)}
                    title="Copy Success"
                    maxWidth="400px"
                >
                    <div className="flex flex-col items-center justify-center text-center p-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
                            <Icons.check size={24} />
                        </div>
                        <h3 className="text-base font-bold text-white mb-2">Registry Path Copied!</h3>
                        <p className="text-xs text-white/50 leading-relaxed mb-6">
                            The direct link to this resource has been securely copied to your clipboard.
                        </p>
                        <button
                            onClick={() => setIsCopyModalOpen(false)}
                            className="w-full py-3 bg-primary hover:bg-primary/80 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Understood
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
