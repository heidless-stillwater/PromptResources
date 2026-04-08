'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import Rating from '@/components/Rating';
import CreatorChip from '@/components/CreatorChip';

interface ResourceCardProps {
    resource: Resource;
    savedIds?: Set<string>;
    onToggleSave?: (e: React.MouseEvent, resourceId: string) => void;
    onDelete?: (e: React.MouseEvent, resourceId: string) => void;
    onToggleFavorite?: (e: React.MouseEvent, resourceId: string, currentStatus: boolean) => void;
}

export default function ResourceCard({ resource, savedIds = new Set(), onToggleSave, onDelete, onToggleFavorite }: ResourceCardProps) {
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

    return (
        <div
            id={`resource-card-${resource.id}`}
            className="resource-card group hover-glow bg-[#12121a]/60 backdrop-blur-md"
            onClick={handleCardClick}
            style={{ cursor: 'pointer' }}
        >
            <Link href={`/resources/${resource.id}`} className="resource-card-thumb relative block overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {resource.thumbnailUrl ? (
                    <div className="relative w-full h-full">
                        <NextImage
                            src={resource.thumbnailUrl}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            priority={resource.isFavorite}
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
                            priority={resource.isFavorite}
                        />
                    </div>
                ) : (
                    <div className="resource-card-placeholder flex items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02]">
                        <span className="text-4xl">
                            {resource.type === 'article' ? '📄' :
                                resource.type === 'tool' ? '🔧' :
                                    resource.type === 'course' ? '🎓' :
                                        resource.type === 'book' ? '📚' : '📖'}
                        </span>
                    </div>
                )}
                
                <div className="absolute top-3 left-3 z-[5]">
                    <span className={`badge badge-${resource.pricing}`}>
                        {resource.pricing}
                    </span>
                </div>

                <div className="absolute bottom-3 right-3 flex gap-2 z-[5] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {canEdit && onDelete && (
                        <button
                            className="p-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white border border-red-500/20 backdrop-blur-md transition-all active:scale-95"
                            onClick={(e) => onDelete(e, resource.id)}
                            title="Delete resource"
                        >
                            🗑
                        </button>
                    )}
                    <button
                        className={`p-2 px-3 rounded-xl border transition-all active:scale-95 backdrop-blur-md ${isSaved ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-black/60 border-white/10 text-white/70 hover:text-white'}`}
                        onClick={(e) => onToggleSave?.(e, resource.id)}
                        title={isSaved ? 'Remove from saved' : 'Save resource'}
                        id={`save-${resource.id}`}
                    >
                        {isSaved ? '★' : '☆'}
                    </button>
                </div>
            </Link>

            <div className="resource-card-body p-5 space-y-3">
                <div className="resource-card-title flex justify-between items-start gap-2">
                    <Link href={`/resources/${resource.id}`} className="text-lg font-bold leading-tight hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                        {resource.title}
                    </Link>
                    {(resource.isFavorite || canEdit) && (
                        <div 
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all ${resource.isFavorite ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'} ${canEdit ? 'cursor-pointer' : ''}`}
                            onClick={(e) => {
                                if (canEdit && onToggleFavorite) {
                                    onToggleFavorite(e, resource.id, resource.isFavorite || false);
                                }
                            }}
                        >
                            <span className="text-xs">⭐</span>
                            {resource.isFavorite && <span className="premium-label text-[8px]">Featured</span>}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center">
                    <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                </div>

                <div className="resource-card-desc text-sm text-foreground-muted line-clamp-3 leading-relaxed">{resource.description}</div>
                
                {resource.tags && resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {resource.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] font-bold text-primary/70">#{tag}</span>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {resource.categories?.slice(0, 2).map((cat) => (
                        <span key={cat} className="badge badge-primary">{cat}</span>
                    ))}
                    <span className="badge badge-accent bg-transparent border-accent/30 text-accent">{resource.platform}</span>
                </div>
            </div>

            <div className="mt-auto border-t border-white/5 bg-black/20 p-4 space-y-3">
                <div className="flex items-center">
                    {(() => {
                        const primaryAttr = resource.attributions?.find(a => !!a.userId) || resource.attributions?.[0];
                        return primaryAttr ? <CreatorChip attribution={primaryAttr} size="sm" showExternalIcon={false} /> : null;
                    })()}
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/30">
                    <div className="flex items-center gap-2">
                        <span>Added by</span>
                        {resource.creator?.photoURL && (
                            <NextImage 
                                src={resource.creator.photoURL} 
                                alt={resource.creator.displayName} 
                                width={14} 
                                height={14} 
                                className="rounded-full ring-1 ring-white/10"
                            />
                        )}
                        <span className="text-white/60">{resource.creator?.displayName || 'Community'}</span>
                    </div>
                    {resource.rank && (
                        <div className="flex items-center gap-1.5 text-yellow-500">
                            🏆 #{resource.rank}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
