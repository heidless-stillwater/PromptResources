'use client';

import React from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import Rating from '@/components/Rating';

interface ResourceCardProps {
    resource: Resource;
    savedIds: Set<string>;
    onToggleSave: (e: React.MouseEvent, resourceId: string) => void;
    onDelete?: (e: React.MouseEvent, resourceId: string) => void;
    onToggleFavorite?: (e: React.MouseEvent, resourceId: string, currentStatus: boolean) => void;
}

export default function ResourceCard({ resource, savedIds, onToggleSave, onDelete, onToggleFavorite }: ResourceCardProps) {
    const { user, isAdmin } = useAuth();
    const isSaved = savedIds.has(resource.id);
    const canEdit = isAdmin || (user && resource.addedBy === user.uid);

    return (
        <Link
            id={`resource-card-${resource.id}`}
            href={`/resources/${resource.id}`}
            className="resource-card animate-fade-in"
            style={{ textDecoration: 'none', color: 'inherit' }}
        >
            <div className="resource-card-thumb">
                {resource.thumbnailUrl ? (
                    <div className="relative w-full h-full">
                        <NextImage
                            src={resource.thumbnailUrl}
                            alt={resource.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            style={{ objectFit: 'cover' }}
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
                            style={{ objectFit: 'cover' }}
                            priority={resource.isFavorite}
                        />
                    </div>
                ) : (
                    <div className="resource-card-placeholder">
                        {resource.type === 'article' ? '📄' :
                            resource.type === 'tool' ? '🔧' :
                                resource.type === 'course' ? '🎓' :
                                    resource.type === 'book' ? '📚' : '📖'}
                    </div>
                )}
                <div className="resource-card-pricing">
                    <span className={`badge badge-${resource.pricing}`}>
                        {resource.pricing}
                    </span>
                </div>

                <div style={{ position: 'absolute', bottom: 'var(--space-3)', right: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', zIndex: 2 }}>
                    {canEdit && onDelete && (
                        <button
                            className="save-button"
                            onClick={(e) => onDelete(e, resource.id)}
                            title="Delete resource"
                            style={{ position: 'static', background: 'rgba(239, 68, 68, 0.8)', borderColor: 'rgba(239, 68, 68, 0.4)', fontSize: '0.9rem' }}
                        >
                            🗑
                        </button>
                    )}
                    <button
                        className={`save-button ${isSaved ? 'active' : ''}`}
                        onClick={(e) => onToggleSave(e, resource.id)}
                        title={isSaved ? 'Remove from saved' : 'Save resource'}
                        id={`save-${resource.id}`}
                        style={{ position: 'static' }}
                    >
                        {isSaved ? '★' : '☆'}
                    </button>
                </div>
            </div>

            <div className="resource-card-body">
                <div className="resource-card-title">
                    {resource.title}
                    {(resource.isFavorite || canEdit) && (
                        <span 
                            className={`featured-star transition-all duration-200 ${canEdit ? 'hover:scale-110 cursor-pointer' : ''}`}
                            style={{ 
                                opacity: resource.isFavorite ? 1 : 0.3,
                                filter: resource.isFavorite ? 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.5))' : 'grayscale(100%)',
                            }}
                            title={resource.isFavorite ? "Featured Resource (Click to unfeature)" : "Feature this resource"}
                            onClick={(e) => {
                                if (canEdit && onToggleFavorite) {
                                    onToggleFavorite(e, resource.id, resource.isFavorite || false);
                                }
                            }}
                        >
                            ⭐
                        </span>
                    )}
                </div>
                <div style={{ marginBottom: 'var(--space-2)' }}>
                    <Rating value={resource.averageRating || 0} size="sm" showLabel={false} />
                </div>
                <div className="resource-card-desc">{resource.description}</div>
                
                {resource.tags && resource.tags.length > 0 && (
                    <div className="resource-card-tags">
                        {resource.tags.map((tag) => (
                            <span key={tag} className="resource-card-tag">#{tag}</span>
                        ))}
                    </div>
                )}

                <div className="resource-card-meta">
                    {resource.categories?.slice(0, 2).map((cat) => (
                        <span key={cat} className="badge badge-primary">{cat}</span>
                    ))}
                    <span className="badge badge-accent">{resource.platform}</span>
                </div>
            </div>

            <div className="resource-card-footer">
                <div className="resource-card-credits">
                    {resource.creator?.photoURL && (
                        <NextImage 
                            src={resource.creator.photoURL} 
                            alt={resource.creator.displayName} 
                            width={20} 
                            height={20} 
                            className="creator-avatar"
                        />
                    )}
                    <span>{resource.creator?.displayName || 'Community'}</span>
                </div>
                {resource.rank && (
                    <div className="resource-card-rank">
                        🏆 #{resource.rank}
                    </div>
                )}
            </div>
        </Link>
    );
}
