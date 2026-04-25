'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import Rating from '@/components/Rating';
import CreatorChip from '@/components/CreatorChip';
import { Icons } from '@/components/ui/Icons';

interface ResourceCardProps {
    resource: Resource;
    savedIds?: Set<string>;
    onToggleSave?: (e: React.MouseEvent, resourceId: string) => void;
    onDelete?: (e: React.MouseEvent, resourceId: string) => void;
    onToggleFavorite?: (e: React.MouseEvent, resourceId: string, currentStatus: boolean) => void;
    viewMode?: 'grid' | 'list' | 'small';
}

export default function ResourceCard({ resource, savedIds = new Set(), onToggleSave, onDelete, onToggleFavorite, viewMode = 'grid' }: ResourceCardProps) {
    const { user, isAdmin } = useAuth();
    const isSaved = savedIds.has(resource.id);
    const canEdit = isAdmin || (user && resource.addedBy === user.uid);

    const router = useRouter();

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
                className="group glass-card bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-primary/30 transition-all flex flex-col h-full cursor-pointer shadow-md font-inter"
                onClick={handleCardClick}
            >
                <div className="relative aspect-video overflow-hidden shrink-0 m-2 rounded-xl">
                    {resource.thumbnailUrl || resource.youtubeVideoId ? (
                        <NextImage
                            src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/mqdefault.jpg`}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-2xl opacity-20">
                            {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                        </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1 z-10">
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-black/60 text-white/80 border border-white/5 backdrop-blur-sm flex items-center gap-1`}>
                            <span>{pricingIcons[resource.pricing] || '💰'}</span>
                            {resource.pricing}
                        </span>
                        {resource.status === 'flagged' && (
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-rose-500 text-white border border-white/20 backdrop-blur-sm flex items-center gap-1 animate-pulse-rose whitespace-nowrap z-30 shadow-lg">
                                <Icons.report size={8} /> {resource.reportType ? reportLabels[resource.reportType] : 'Safety'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="px-4 pb-4 flex flex-col flex-grow">
                    <h3 className="text-xs font-black font-outfit tracking-tighter text-white group-hover:text-primary transition-colors line-clamp-1 mb-3">
                        {resource.title}
                    </h3>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                            <Icons.grid size={10} className="text-primary/50" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 truncate">{resource.platform}</span>
                        </div>
                        <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'list') {
        return (
            <div
                id={`resource-card-${resource.id}`}
                className="flex flex-col md:flex-row gap-6 p-5 rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl hover:border-primary/30 transition-all duration-500 group cursor-pointer shadow-2xl relative overflow-hidden font-inter"
                onClick={handleCardClick}
            >
                {/* Featured Glow */}
                {resource.isFavorite && (
                    <div className="absolute top-0 right-0 p-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                )}

                {/* Thumbnail Side */}
                <div className="relative w-full md:w-72 aspect-video md:aspect-auto rounded-2xl overflow-hidden flex-shrink-0 border border-white/5">
                    {resource.thumbnailUrl || resource.youtubeVideoId ? (
                        <NextImage
                            src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/mqdefault.jpg`}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02] text-4xl">
                            {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                        </div>
                    )}
                    <div className="absolute top-3 left-3 z-[10] flex flex-col gap-2">
                        <span className={`px-3 py-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/90 flex items-center gap-2`}>
                            <span>{pricingIcons[resource.pricing] || '💰'}</span>
                            {resource.pricing}
                        </span>
                        {resource.status === 'flagged' && (
                            <span className="bg-rose-500 text-white border border-white/20 rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse-rose whitespace-nowrap z-30 shadow-lg">
                                <Icons.report size={10} /> Security Review Active
                            </span>
                        )}
                    </div>
                </div>

                {/* Content Side */}
                <div className="flex flex-col flex-grow min-w-0 pt-2">
                    <div className="flex justify-between items-start gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-2xl font-black font-outfit tracking-tighter leading-tight text-white group-hover:text-primary transition-all mb-2">
                                <Link href={`/resources/${resource.id}`} onClick={(e) => e.stopPropagation()}>
                                    {resource.title}
                                </Link>
                            </h3>
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4">
                                <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                                <span className="flex items-center gap-1.5">
                                    <span className="text-white/10">{platformIcons[resource.platform] || '🌐'}</span>
                                    {resource.platform}
                                </span>
                                {resource.rank && <span className="text-amber-500">🏆 #{resource.rank} Rank</span>}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Utility Toolbar */}
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/resources/${resource.id}`); alert('Link copied!'); }}
                                    className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/20 hover:text-white hover:bg-primary/30 transition-all"
                                    title="Copy Registry Path"
                                >
                                    <Icons.copy size={14} />
                                </button>
                                {canEdit && (
                                    <Link 
                                        href={`/resources/${resource.id}/edit`} 
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/20 hover:text-white hover:bg-primary transition-all"
                                        title="Modify Asset"
                                    >
                                        <Icons.edit size={14} />
                                    </Link>
                                )}
                            </div>
                            <button
                                className={`p-3 rounded-xl border transition-all active:scale-95 ${isSaved ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-white/5 border-white/10 text-white/20 hover:text-white'}`}
                                onClick={(e) => onToggleSave?.(e, resource.id)}
                                title={isSaved ? 'Remove from Vault' : 'Secure to Vault'}
                            >
                                {isSaved ? '★' : '☆'}
                            </button>
                        </div>
                    </div>

                    <p className="text-sm font-medium text-white/40 line-clamp-2 leading-relaxed mb-6 max-w-3xl">{resource.description}</p>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-6 pt-5 border-t border-white/5">
                        <div className="flex gap-2">
                            {resource.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-primary/40 italic">#{tag}</span>
                            ))}
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
            className={`group glass-card relative overflow-hidden transition-all duration-500 flex flex-col h-full hover:border-primary/40 shadow-2xl rounded-3xl bg-white/[0.03] font-inter ${
                resource.isFavorite ? 'bg-primary/[0.04] ring-1 ring-primary/20' : ''
            }`}
            onClick={handleCardClick}
            style={{ cursor: 'pointer' }}
        >
            {/* Quick Utility Overlay */}
            <div className="absolute top-5 right-5 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <button 
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/resources/${resource.id}`); alert('Registry link copied!'); }}
                    className="p-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white/40 hover:text-white hover:bg-primary transition-all"
                >
                    <Icons.copy size={12} />
                </button>
                <button
                    className={`p-2.5 rounded-2xl border transition-all active:scale-95 backdrop-blur-xl ${isSaved ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-black/60 border-white/10 text-white/40 hover:text-white hover:bg-primary'}`}
                    onClick={(e) => onToggleSave?.(e, resource.id)}
                    title={isSaved ? 'Remove from vault' : 'Secure in vault'}
                >
                    {isSaved ? '★' : '☆'}
                </button>
            </div>

            {/* Thumbnail Header */}
            <div className="relative aspect-video m-4 rounded-[1.5rem] overflow-hidden border border-white/5 shadow-2xl">
                {resource.thumbnailUrl || resource.youtubeVideoId ? (
                    <NextImage
                        src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/mqdefault.jpg`}
                        alt={resource.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        priority={!!resource.isFavorite}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent text-5xl">
                         {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                    </div>
                )}
                
                {/* Branding Overlays */}
                <div className="absolute top-3 left-3 z-[10] flex flex-col gap-2">
                    <span className={`px-3 py-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/90 flex items-center gap-2`}>
                        <span>{pricingIcons[resource.pricing] || '💰'}</span>
                        {resource.pricing}
                    </span>
                    {resource.status === 'flagged' && (
                        <span className="px-3 py-1 bg-rose-500 border border-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-white flex items-center gap-2 animate-pulse shadow-xl">
                            <Icons.report size={12} /> Security Review
                        </span>
                    )}
                </div>
            </div>

            <div className="px-7 pb-7 pt-2 flex flex-col flex-grow">
                <div className="flex justify-between items-start gap-4 mb-4">
                    <h3 className="text-xl font-black font-outfit tracking-tighter leading-tight text-white group-hover:text-primary transition-all line-clamp-2">
                        {resource.title}
                    </h3>
                    {resource.isFavorite && (
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/5">
                            <Icons.sparkles size={14} />
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6">
                    <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                    <span className="flex items-center gap-1.5">
                        <span className="text-white/10">{platformIcons[resource.platform] || '🌐'}</span>
                        {resource.platform}
                    </span>
                </div>

                <p className="text-sm font-medium text-white/40 line-clamp-2 leading-relaxed mb-6">
                    {resource.description}
                </p>
                
                {/* Tag Belt */}
                {resource.tags && resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-8">
                        {resource.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-primary/40 italic">#{tag}</span>
                        ))}
                    </div>
                )}

                {/* Footer Sync */}
                <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
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
                                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/20 hover:text-white hover:bg-primary hover:border-primary transition-all flex items-center justify-center"
                            >
                                <Icons.edit size={14} />
                            </Link>
                        )}
                        <div className="text-white/10 group-hover:text-primary group-hover:translate-x-1.5 transition-all">
                            <Icons.chevronRight size={24} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
