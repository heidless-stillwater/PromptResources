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
                className="group bg-[#12121a]/60 border border-white/10 rounded-xl overflow-hidden hover:border-indigo-500/30 transition-all flex flex-col h-full cursor-pointer shadow-md"
                onClick={handleCardClick}
            >
                <div className="relative aspect-video overflow-hidden shrink-0">
                    {resource.thumbnailUrl || resource.youtubeVideoId ? (
                        <NextImage
                            src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/mqdefault.jpg`}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-2xl opacity-20">
                            {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                        </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1">
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded bg-black/60 text-white/80 border border-white/5 backdrop-blur-sm flex items-center gap-1`}>
                            <span>{pricingIcons[resource.pricing] || '💰'}</span>
                            {resource.pricing}
                        </span>
                    </div>
                </div>
                <div className="p-3 flex flex-col flex-grow">
                    <h3 className="text-sm font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors line-clamp-1 mb-2">
                        {resource.title}
                    </h3>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/20 truncate flex items-center gap-1">
                        <span>{platformIcons[resource.platform] || '🌐'}</span>
                        {resource.platform}
                    </span>
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
                className="flex flex-col sm:flex-row gap-6 p-4 rounded-2xl border border-white/10 bg-[#12121a]/60 backdrop-blur-md hover:border-indigo-500/30 transition-all duration-300 group cursor-pointer"
                onClick={handleCardClick}
            >
                {/* Thumbnail Side */}
                <div className="relative w-full sm:w-60 h-40 sm:h-auto aspect-video sm:aspect-auto rounded-xl overflow-hidden flex-shrink-0">
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
                    <div className="absolute top-2 left-2 z-[5]">
                        <span className={`badge badge-${resource.pricing} text-[8px] px-2 py-0.5`}>
                            {resource.pricing}
                        </span>
                    </div>
                </div>

                {/* Content Side */}
                <div className="resource-card-content flex flex-col flex-grow p-5 pt-4">
                <div className="flex justify-between items-start gap-3 mb-2">
                    <h3 className="resource-card-title text-base font-black tracking-tight leading-snug text-white/90 group-hover:text-indigo-400 transition-colors">
                        <Link href={`/resources/${resource.id}`} onClick={(e) => e.stopPropagation()}>
                            {resource.title}
                        </Link>
                    </h3>
    <div className="flex items-center gap-2 shrink-0">
                            {/* Resource Utilities */}
                            <div className="flex gap-1.5 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const url = `${window.location.origin}/resources/${resource.id}`;
                                        if (navigator.share) {
                                            try {
                                                await navigator.share({
                                                    title: resource.title,
                                                    text: resource.description,
                                                    url: url,
                                                });
                                            } catch (err) { /* focus */ }
                                        } else {
                                            navigator.clipboard.writeText(url);
                                            alert('Link copied!');
                                        }
                                    }}
                                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/30 hover:text-white hover:bg-indigo-600/30 transition-all"
                                    title="Share Resource"
                                >
                                    <Icons.share size={14} />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(`${window.location.origin}/resources/${resource.id}`);
                                        alert('Resource link copied!');
                                    }}
                                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/30 hover:text-white hover:bg-indigo-600/30 transition-all"
                                    title="Copy Link"
                                >
                                    <Icons.copy size={14} />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resource, null, 2));
                                        const downloadAnchorNode = document.createElement('a');
                                        downloadAnchorNode.setAttribute("href", dataStr);
                                        downloadAnchorNode.setAttribute("download", `resource_${resource.id}.json`);
                                        document.body.appendChild(downloadAnchorNode);
                                        downloadAnchorNode.click();
                                        downloadAnchorNode.remove();
                                    }}
                                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/30 hover:text-white hover:bg-emerald-600/30 transition-all"
                                    title="Export Data"
                                >
                                    <Icons.download size={14} />
                                </button>
                            </div>

                            {resource.isFavorite && (
                                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-1.5 rounded-lg" title="Featured Resource">
                                    <Icons.sparkles size={14} />
                                </span>
                            )}
                            {canEdit && (
                                <button
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-500/30 bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white hover:bg-indigo-500 transition-all active:scale-95 group/edit"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        router.push(`/resources/${resource.id}/edit`);
                                    }}
                                    title="Edit Resource"
                                >
                                    <span className="text-[12px]">✏️</span>
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Edit Details</span>
                                </button>
                            )}
                            <button
                                className={`p-2 rounded-xl border transition-all active:scale-95 ${isSaved ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                                onClick={(e) => onToggleSave?.(e, resource.id)}
                                title={isSaved ? 'Remove from saved' : 'Save resource'}
                            >
                                {isSaved ? '★' : '☆'}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                        <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                        <span className="text-[10px] uppercase font-black tracking-widest text-white/20 flex items-center gap-1.5">
                            <span className="text-sm">{platformIcons[resource.platform] || '🌐'}</span>
                            {resource.platform}
                        </span>
                        <span className="text-[10px] uppercase font-black tracking-widest text-white/20 flex items-center gap-1.5">
                            <span className="text-sm">{pricingIcons[resource.pricing] || '💰'}</span>
                            {resource.pricing}
                        </span>
                        {resource.rank && <span className="text-[10px] font-black text-amber-500">🏆 #{resource.rank}</span>}
                    </div>

                    <p className="text-sm font-medium text-white/40 line-clamp-2 leading-relaxed mb-4 max-w-3xl">{resource.description}</p>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
                        <div className="flex gap-2">
                            {resource.categories?.slice(0, 3).map(cat => (
                                <span key={cat} className="badge badge-primary text-[9px] lowercase opacity-60">/{cat}</span>
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

    // Default Grid Mode
    return (
        <div
            id={`resource-card-${resource.id}`}
            className="resource-card group hover-glow bg-[#12121a]/60 backdrop-blur-md flex flex-col h-full shadow-2xl"
            onClick={handleCardClick}
            style={{ cursor: 'pointer' }}
        >
            <Link href={`/resources/${resource.id}`} className="resource-card-thumb relative block overflow-hidden shrink-0" onClick={(e) => e.stopPropagation()}>
                {resource.thumbnailUrl ? (
                    <div className="relative w-full h-full">
                        <NextImage
                            src={resource.thumbnailUrl}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            priority={!!resource.isFavorite}
                        />
                    </div>
                ) : resource.youtubeVideoId ? (
                    <div className="relative w-full h-full">
                        <NextImage
                            src={`https://img.youtube.com/vi/${resource.youtubeVideoId}/mqdefault.jpg`}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            priority={!!resource.isFavorite}
                        />
                    </div>
                ) : (
                    <div className="resource-card-placeholder flex items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02]">
                        <span className="text-4xl text-white/20 group-hover:scale-110 transition-transform duration-500">
                             {typeIcons[resource.type as keyof typeof typeIcons] || typeIcons.other}
                        </span>
                    </div>
                )}
                
                <div className="absolute top-3 left-3 z-[5] flex flex-col gap-2">
                    <span className={`badge badge-${resource.pricing} text-[9px] flex items-center gap-1.5`}>
                        <span>{pricingIcons[resource.pricing] || '💰'}</span>
                        {resource.pricing}
                    </span>
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white/80 flex items-center gap-1.5">
                        <span>{platformIcons[resource.platform] || '🌐'}</span>
                        {resource.platform}
                    </span>
                </div>

                <div className="absolute bottom-3 right-3 flex gap-2 z-[5] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {canEdit && (
                        <button
                            className="p-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-500/30 backdrop-blur-md transition-all active:scale-95"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/resources/${resource.id}/edit`);
                            }}
                            title="Edit Resource"
                        >
                            <span className="text-[14px]">✏️</span>
                        </button>
                    )}
                    {canEdit && onDelete && (
                        <button
                            className="p-2 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white border border-rose-500/20 backdrop-blur-md transition-all active:scale-95"
                            onClick={(e) => onDelete(e, resource.id)}
                            title="Delete resource"
                        >
                            <Icons.close size={14} />
                        </button>
                    )}
                    <button
                        className={`p-2 px-3 rounded-xl border transition-all active:scale-95 backdrop-blur-md ${isSaved ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-black/60 border-white/10 text-white/70 hover:text-white'}`}
                        onClick={(e) => onToggleSave?.(e, resource.id)}
                        title={isSaved ? 'Remove from saved' : 'Save resource'}
                        id={`save-${resource.id}`}
                    >
                        {isSaved ? '★' : '☆'}
                    </button>
                </div>
            </Link>

            <div className="resource-card-body p-5 space-y-3 flex-grow border-x border-white/5">
                <div className="resource-card-title flex justify-between items-start gap-2">
                    <Link href={`/resources/${resource.id}`} className="text-base font-bold leading-tight hover:text-indigo-400 transition-colors line-clamp-2" onClick={(e) => e.stopPropagation()}>
                        {resource.title}
                    </Link>
                    {(resource.isFavorite || canEdit) && (
                        <div 
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all shrink-0 ${resource.isFavorite ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'} ${canEdit ? 'cursor-pointer' : ''}`}
                            onClick={(e) => {
                                if (canEdit && onToggleFavorite) {
                                    onToggleFavorite(e, resource.id, resource.isFavorite || false);
                                }
                            }}
                        >
                            <Icons.sparkles size={10} />
                            {resource.isFavorite && <span className="premium-label text-[8px] font-black uppercase">Featured</span>}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center">
                    <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                </div>

                <p className="resource-card-description text-sm font-medium text-white/40 line-clamp-2 leading-relaxed mb-4 flex-grow">
                    {resource.description}
                </p>
                
                {resource.tags && resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 font-bold italic">
                        {resource.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[9px] text-indigo-400/60">#{tag}</span>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                    {resource.categories?.slice(0, 2).map((cat) => (
                        <span key={cat} className="badge badge-primary scale-90">{cat}</span>
                    ))}
                </div>
            </div>

            <div className="mt-auto border border-white/5 bg-black/20 p-4 rounded-b-2xl space-y-3">
                <div className="flex items-center">
                    {(() => {
                        const primaryAttr = resource.attributions?.find(a => !!a.userId) || resource.attributions?.[0];
                        return primaryAttr ? <CreatorChip attribution={primaryAttr} size="sm" showExternalIcon={false} /> : null;
                    })()}
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/20">
                    <div className="flex items-center gap-2">
                        <span className="text-white/20">Curated by</span>
                        {resource.creator?.photoURL && (
                            <NextImage 
                                src={resource.creator.photoURL} 
                                alt={resource.creator.displayName} 
                                width={14} 
                                height={14} 
                                className="rounded-full ring-1 ring-white/10"
                            />
                        )}
                        <span className="text-white/40">{resource.creator?.displayName || 'Community'}</span>
                    </div>
                    {resource.rank && (
                        <div className="flex items-center gap-1.5 text-amber-500">
                            🏆 #{resource.rank}
                        </div>
                    )}
                    {isAdmin && (
                        <button
                            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/10"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/resources/${resource.id}/edit`);
                            }}
                        >
                            ✏️ Edit
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
