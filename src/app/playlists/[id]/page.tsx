'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Icons } from '@/components/ui/Icons';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Rating from '@/components/Rating';
import CreatorChip from '@/components/CreatorChip';
import ResourceCard from '@/components/ResourceCard';
import { Resource } from '@/lib/types';

// Dnd Kit Imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Individual Sortable List Item Component
interface SortablePlaylistItemProps {
    res: Resource;
    idx: number;
    total: number;
    canManage: boolean;
    isCustomOrder: boolean;
    onPromote: () => void;
    onDemote: () => void;
    onMoveToTop: () => void;
    onMoveToBottom: () => void;
    onDelete: () => void;
    isCurrentCover: boolean;
    onSetAsCover: () => void;
    playlistId: string;
}

function SortablePlaylistItem({
    res,
    idx,
    total,
    canManage,
    isCustomOrder,
    onPromote,
    onDemote,
    onMoveToTop,
    onMoveToBottom,
    onDelete,
    isCurrentCover,
    onSetAsCover,
    playlistId
}: SortablePlaylistItemProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(`${window.location.origin}/resources/${res.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const router = useRouter();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: res.id, disabled: !canManage || !isCustomOrder });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    const handleItemClick = (e: React.MouseEvent) => {
        // Prevent click navigation if clicking buttons, drag handle, or other interactive controls
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[data-drag-handle]')) {
            return;
        }
        router.push(`/resources/${res.id}?playlistId=${playlistId}`);
    };

    return (
        <div 
            ref={setNodeRef}
            style={style}
            onClick={handleItemClick}
            className={`group relative cursor-pointer block transition-all ${
                isDragging 
                    ? 'border-primary/50 bg-[var(--bg-card)] shadow-2xl scale-[1.01] rounded-3xl' 
                    : ''
            }`}
        >
            <div 
                className="glass-card hover:border-primary/30 transition-all duration-300 flex flex-col sm:flex-row items-center gap-6 rounded-3xl bg-[var(--bg-card)] relative"
                style={{ paddingTop: '5px', paddingBottom: '5px', paddingLeft: '16px', paddingRight: '16px' }}
            >
                
                {/* Drag handle & Sequence Number */}
                <div className="flex items-center gap-2 shrink-0">
                    {canManage && isCustomOrder && (
                        <div 
                            {...attributes} 
                            {...listeners} 
                            data-drag-handle
                            className="cursor-grab p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            title="Drag to reorder"
                        >
                            <Icons.menu size={14} />
                        </div>
                    )}
                    <div className="w-8 flex items-center justify-center font-black font-outfit text-xl text-[var(--text-muted)] opacity-60 group-hover:text-primary transition-colors shrink-0">
                        #{idx + 1}
                    </div>
                </div>

                {/* Thumbnail */}
                <div className="w-full sm:w-40 aspect-video relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]/30 shrink-0">
                    {res.thumbnailUrl || res.youtubeVideoId ? (
                        <img 
                            src={res.thumbnailUrl || `https://img.youtube.com/vi/${res.youtubeVideoId}/hqdefault.jpg`}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl opacity-20 text-[var(--text-muted)]">
                            📄
                        </div>
                    )}
                </div>

                {/* Metadata details */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate group-hover:text-primary transition-colors mb-1 text-[var(--text-primary)]">
                        {res.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed mb-4">
                        {res.description}
                    </p>
                    
                    {/* Attributes belt */}
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            {res.platform}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            {res.pricing}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            {res.type}
                        </span>
                    </div>
                </div>

                {/* Action buttons (arrows, cover, delete) or Play Icon overlay */}
                <div className="flex items-center gap-2 shrink-0">
                    {canManage ? (
                        <div className="flex items-center gap-1.5">
                            {isCustomOrder && (
                                <>
                                    <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveToTop();
                                        }}
                                        className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:hover:bg-[var(--bg-secondary)]/30 disabled:cursor-not-allowed transition-all"
                                        title="Move to Top"
                                    >
                                        <Icons.chevronsUp size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPromote();
                                        }}
                                        className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:hover:bg-[var(--bg-secondary)]/30 disabled:cursor-not-allowed transition-all"
                                        title="Promote (Move Up)"
                                    >
                                        <Icons.arrowUp size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={idx === total - 1}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDemote();
                                        }}
                                        className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:hover:bg-[var(--bg-secondary)]/30 disabled:cursor-not-allowed transition-all"
                                        title="Demote (Move Down)"
                                    >
                                        <Icons.arrowDown size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={idx === total - 1}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveToBottom();
                                        }}
                                        className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:hover:bg-[var(--bg-secondary)]/30 disabled:cursor-not-allowed transition-all"
                                        title="Move to Bottom"
                                    >
                                        <Icons.chevronsDown size={12} />
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                                title={copied ? "Copied!" : "Copy Resource URL"}
                            >
                                {copied ? <Icons.check size={12} className="text-emerald-500" /> : <Icons.copy size={12} />}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSetAsCover();
                                }}
                                className={`p-2 rounded-xl border transition-all ${
                                    isCurrentCover 
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' 
                                        : 'border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                                title={isCurrentCover ? 'Active Playlist Cover' : 'Set as Playlist Cover'}
                            >
                                <Icons.image size={12} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="p-2 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/20 text-rose-500 transition-all ml-1.5"
                                title="Remove from Playlist"
                            >
                                <Icons.delete size={12} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                                title={copied ? "Copied!" : "Copy Resource URL"}
                            >
                                {copied ? <Icons.check size={12} className="text-emerald-500" /> : <Icons.copy size={12} />}
                            </button>
                            <div className="p-3 bg-primary text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 hidden sm:block shadow-lg shadow-primary/25">
                                <Icons.play size={14} fill="currentColor" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function PlaylistDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAdmin, loading: authLoading } = useAuth();
    const { isDarkMode } = useTheme();
    const [playlist, setPlaylist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    
    const [viewMode, setViewMode] = useState<'list' | 'grid-2' | 'grid-3' | 'grid-4' | 'grid-5'>('list');
    const [resourcesState, setResourcesState] = useState<Resource[]>([]);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sortBy, setSortBy] = useState<'custom' | 'updated' | 'created'>('custom');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Persist sorting preferences
    useEffect(() => {
        const savedSortBy = localStorage.getItem('playlist_sort_by');
        if (savedSortBy && ['custom', 'updated', 'created'].includes(savedSortBy)) {
            setSortBy(savedSortBy as any);
            if (savedSortBy === 'custom') {
                setViewMode('list');
            }
        }
        const savedSortOrder = localStorage.getItem('playlist_sort_order');
        if (savedSortOrder && ['asc', 'desc'].includes(savedSortOrder)) {
            setSortOrder(savedSortOrder as any);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('playlist_sort_by', sortBy);
    }, [sortBy]);

    useEffect(() => {
        localStorage.setItem('playlist_sort_order', sortOrder);
    }, [sortOrder]);

    const getSortedResources = () => {
        if (sortBy === 'custom') {
            return resourcesState;
        }
        const parseDate = (val: any) => {
            if (!val) return 0;
            if (typeof val.toDate === 'function') return val.toDate().getTime();
            if (val instanceof Date) return val.getTime();
            return new Date(val).getTime();
        };
        return [...resourcesState].sort((a, b) => {
            const field = sortBy === 'updated' ? 'updatedAt' : 'createdAt';
            const timeA = parseDate((a as any)[field]);
            const timeB = parseDate((b as any)[field]);
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });
    };
    
    // Deletion targets states
    const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);
    const [isDeletePlaylistOpen, setIsDeletePlaylistOpen] = useState(false);

    // Metadata Editing modal state
    const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState<'published' | 'private'>('private');
    const [editThumbnailSource, setEditThumbnailSource] = useState<'derived' | 'custom' | 'resource'>('derived');
    const [editThumbnailUrl, setEditThumbnailUrl] = useState('');
    const [editThumbnailResourceId, setEditThumbnailResourceId] = useState('');
    const [editRanking, setEditRanking] = useState<number>(3);
    const [isSavingMeta, setIsSavingMeta] = useState(false);

    // Tags states
    const [allTags, setAllTags] = useState<any[]>([]);
    const [newTag, setNewTag] = useState('');
    const [isTagInputOpen, setIsTagInputOpen] = useState(false);
    const [editTags, setEditTags] = useState('');
    const tagInputRef = React.useRef<HTMLDivElement>(null);

    const playlistId = params.id as string;

    useEffect(() => {
        if (playlistId && !authLoading) {
            fetchPlaylist();
        }
    }, [playlistId, authLoading, user]);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const res = await fetch('/api/tags', { cache: 'no-store' });
                const result = await res.json();
                if (result.success) {
                    setAllTags(result.data || []);
                }
            } catch (e) {
                console.error('[PlaylistDetailPage] Error fetching tags:', e);
            }
        };
        fetchTags();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
                setIsTagInputOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTags = allTags
        ? allTags
              .map((t: any) => t.name)
              .filter((tagName: string) => {
                  const isNotCurrent = !(playlist?.tags || []).includes(tagName);
                  const matchesSearch = tagName.toLowerCase().includes(newTag.toLowerCase());
                  return isNotCurrent && matchesSearch;
              })
        : [];

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!playlist || !user) return;
        try {
            const updatedTags = (playlist.tags || []).filter((t: string) => t !== tagToRemove);
            
            // Optimistic update
            setPlaylist({
                ...playlist,
                tags: updatedTags
            });

            const token = await user.getIdToken();
            await fetch(`/api/playlists/${playlistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tags: updatedTags }),
            });
            fetchPlaylist();
        } catch (e) {
            console.error('[PlaylistDetailPage] Error removing tag:', e);
        }
    };

    const handleAddTag = async (tagToAdd?: string) => {
        if (!playlist || !user) return;
        const tagValue = (tagToAdd || newTag).trim().toLowerCase();
        if (!tagValue) return;

        const currentTags = playlist.tags || [];
        if (currentTags.includes(tagValue)) {
            setNewTag('');
            setIsTagInputOpen(false);
            return;
        }

        const updatedTags = [...currentTags, tagValue];
        
        // Optimistic update
        setPlaylist({
            ...playlist,
            tags: updatedTags
        });

        try {
            const token = await user.getIdToken();
            await fetch(`/api/playlists/${playlistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tags: updatedTags }),
            });
            setNewTag('');
            setIsTagInputOpen(false);
            fetchPlaylist();
        } catch (e) {
            console.error('[PlaylistDetailPage] Error adding tag:', e);
        }
    };

    useEffect(() => {
        if (user) {
            fetchSavedIds();
        } else {
            setSavedIds(new Set());
        }
    }, [user]);

    const fetchPlaylist = async () => {
        try {
            setLoading(true);
            const token = user ? await user.getIdToken() : '';
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const res = await fetch(`/api/playlists/${playlistId}`, { headers, cache: 'no-store' });
            const result = await res.json();
            if (result.success) {
                setPlaylist(result.data);
                setResourcesState(result.data.resources || []);
            } else {
                setPlaylist(null);
                setResourcesState([]);
            }
        } catch (e) {
            console.error('[PlaylistDetailPage] Error fetching playlist details:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSavedIds = async () => {
        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/user-resources?uid=${user?.uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success && result.data?.savedResources) {
                setSavedIds(new Set(result.data.savedResources));
            }
        } catch (e) {
            console.error('[PlaylistDetailPage] Error fetching saved resource IDs:', e);
        }
    };

    const openEditMeta = () => {
        if (!playlist) return;
        setEditTitle(playlist.title || '');
        setEditDescription(playlist.description || '');
        setEditStatus(playlist.status || 'private');
        setEditThumbnailSource(playlist.thumbnailSource || 'derived');
        setEditThumbnailUrl(playlist.thumbnailUrl || '');
        setEditThumbnailResourceId(playlist.thumbnailResourceId || '');
        setEditRanking(playlist.ranking !== undefined ? playlist.ranking : 3);
        setEditTags((playlist.tags || []).join(', '));
        setIsEditMetaOpen(true);
    };

    const handleSaveMeta = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTitle.trim() || !user) return;

        try {
            setIsSavingMeta(true);
            const token = await user.getIdToken();
            const tagList = editTags
                .split(',')
                .map(t => t.trim().toLowerCase())
                .filter(Boolean);
            const res = await fetch(`/api/playlists/${playlistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: editTitle.trim(),
                    description: editDescription.trim(),
                    status: editStatus,
                    thumbnailSource: editThumbnailSource,
                    thumbnailUrl: editThumbnailSource === 'custom' ? editThumbnailUrl.trim() : null,
                    thumbnailResourceId: editThumbnailSource === 'resource' ? editThumbnailResourceId : null,
                    ranking: editRanking,
                    tags: tagList
                })
            });
            const result = await res.json();
            if (result.success) {
                setIsEditMetaOpen(false);
                fetchPlaylist();
                window.dispatchEvent(new Event('playlists-updated'));
            } else {
                alert('Failed to update settings: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[PlaylistDetailPage] Error updating metadata:', err);
            alert('Error updating settings');
        } finally {
            setIsSavingMeta(false);
        }
    };

    const handleToggleSave = async (e: React.MouseEvent, resourceId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { router.push('/auth/login'); return; }
        const isCurrentlySaved = savedIds.has(resourceId);
        const action = isCurrentlySaved ? 'unsave' : 'save';
        
        // Optimistic update
        const nextSaved = new Set(savedIds);
        if (isCurrentlySaved) nextSaved.delete(resourceId);
        else nextSaved.add(resourceId);
        setSavedIds(nextSaved);

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/user-resources', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ uid: user.uid, resourceId, action }),
            });
            const result = await res.json();
            if (!result.success) {
                fetchSavedIds();
            } else {
                window.dispatchEvent(new Event('playlists-updated'));
            }
        } catch (error) {
            console.error('[PlaylistDetailPage] Error toggling save:', error);
            fetchSavedIds();
        }
    };

    const updateResourceOrder = async (newResources: Resource[]) => {
        setResourcesState(newResources);
        try {
            setIsSavingOrder(true);
            const token = user ? await user.getIdToken() : '';
            const res = await fetch(`/api/playlists/${playlistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    resourceIds: newResources.map(r => r.id)
                })
            });
            const result = await res.json();
            if (!result.success) {
                console.error('[PlaylistDetailPage] Failed to update playlist order:', result.error);
                fetchPlaylist();
            } else {
                window.dispatchEvent(new Event('playlists-updated'));
            }
        } catch (e) {
            console.error('[PlaylistDetailPage] Error updating playlist order:', e);
            fetchPlaylist();
        } finally {
            setIsSavingOrder(false);
        }
    };

    const handleSetAsCover = async (res: Resource) => {
        if (!playlist || !user) return;
        
        // Optimistic update
        const updatedPlaylist = {
            ...playlist,
            thumbnailSource: 'resource',
            thumbnailResourceId: res.id,
            thumbnailUrl: res.thumbnailUrl || `https://img.youtube.com/vi/${res.youtubeVideoId}/hqdefault.jpg`
        };
        setPlaylist(updatedPlaylist);

        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/playlists/${playlistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    thumbnailSource: 'resource',
                    thumbnailResourceId: res.id
                })
            });
            const result = await response.json();
            if (result.success) {
                fetchPlaylist();
                window.dispatchEvent(new Event('playlists-updated'));
            } else {
                console.error('[PlaylistDetailPage] Failed to set cover:', result.error);
                fetchPlaylist();
            }
        } catch (e) {
            console.error('[PlaylistDetailPage] Error setting cover:', e);
            fetchPlaylist();
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        const targetId = deleteTarget.id;
        
        // Optimistic update
        const updated = resourcesState.filter(r => r.id !== targetId);
        setResourcesState(updated);
        setDeleteTarget(null);

        try {
            const token = user ? await user.getIdToken() : '';
            const res = await fetch(`/api/playlists/${playlistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    resourceIds: updated.map(r => r.id)
                })
            });
            const result = await res.json();
            if (!result.success) {
                console.error('[PlaylistDetailPage] Failed to remove resource:', result.error);
                fetchPlaylist();
            } else {
                window.dispatchEvent(new Event('playlists-updated'));
            }
        } catch (e) {
            console.error('[PlaylistDetailPage] Error removing resource:', e);
            fetchPlaylist();
        }
    };

    // Sensors config for Dnd Kit
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            const oldIndex = resourcesState.findIndex(r => r.id === active.id);
            const newIndex = resourcesState.findIndex(r => r.id === over.id);
            const next = arrayMove(resourcesState, oldIndex, newIndex);
            updateResourceOrder(next);
        }
    };

    const handlePromote = (index: number) => {
        if (index === 0) return;
        const next = [...resourcesState];
        const temp = next[index];
        next[index] = next[index - 1];
        next[index - 1] = temp;
        updateResourceOrder(next);
    };

    const handleDemote = (index: number) => {
        if (index === resourcesState.length - 1) return;
        const next = [...resourcesState];
        const temp = next[index];
        next[index] = next[index + 1];
        next[index + 1] = temp;
        updateResourceOrder(next);
    };

    const handleMoveToTop = (index: number) => {
        if (index === 0) return;
        const next = [...resourcesState];
        const item = next.splice(index, 1)[0];
        next.unshift(item);
        updateResourceOrder(next);
    };

    const handleMoveToBottom = (index: number) => {
        if (index === resourcesState.length - 1) return;
        const next = [...resourcesState];
        const item = next.splice(index, 1)[0];
        next.push(item);
        updateResourceOrder(next);
    };

    const handleDelete = async () => {
        try {
            setDeleting(true);
            const token = await user?.getIdToken();
            const res = await fetch(`/api/playlists/${playlistId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await res.json();
            if (result.success) {
                router.push('/playlists');
            }
        } catch (e) {
            console.error('[PlaylistDetailPage] Error deleting playlist:', e);
        } finally {
            setDeleting(false);
            setIsDeletePlaylistOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="page-wrapper dashboard-theme min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between">
                <Navbar />
                <div className="py-48 flex-grow flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Syncing Playlist...</span>
                </div>
                <Footer />
            </div>
        );
    }

    if (!playlist) {
        return (
            <div className="page-wrapper dashboard-theme min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between">
                <Navbar />
                <div className="py-48 flex-grow flex flex-col items-center justify-center gap-6">
                    <div className="text-5xl">🔍</div>
                    <h2 className="text-2xl font-black font-outfit uppercase tracking-tighter">Playlist not discovered</h2>
                    <p className="text-[var(--text-muted)] max-w-sm text-center font-semibold text-sm">
                        This playlist might have been deleted, or it is set to private.
                    </p>
                    <Link href="/playlists" className="px-8 py-3.5 bg-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                        ← Return to Playlists
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    const canManage = user && (playlist.addedBy === user.uid || isAdmin);

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-primary/30 font-inter">
            <Navbar />

            <div className="main-content pt-28 pb-20">
                <main className="container mx-auto px-4">
                    {/* Split Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                        
                        {/* LEFT COLUMN: Sticky Info Card */}
                        <div className={`lg:sticky lg:top-28 space-y-4 transition-all duration-300 ${isSidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-4'}`}>
                            {/* Playlist Hub Link */}
                            <Link 
                                href="/playlists" 
                                className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ${isSidebarCollapsed ? 'w-full justify-center pl-0' : 'pl-2'}`}
                                title="Playlists Hub"
                            >
                                <Icons.arrowLeft size={12} />
                                {!isSidebarCollapsed && <span>Playlists Hub</span>}
                            </Link>

                            <div className={`relative rounded-[2rem] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl transition-all duration-300 ${isSidebarCollapsed ? 'p-3' : 'p-8'}`}>
                                {/* Desktop Collapsible Toggle tab */}
                                <button
                                    type="button"
                                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                    className="hidden lg:flex absolute top-12 -right-4 w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-lg items-center justify-center cursor-pointer hover:bg-[var(--bg-secondary)] z-30 transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    title={isSidebarCollapsed ? "Expand Details" : "Collapse Details"}
                                >
                                    {isSidebarCollapsed ? <Icons.chevronRight size={14} /> : <Icons.chevronLeft size={14} />}
                                </button>

                                {isSidebarCollapsed ? (
                                    /* Collapsed Mini Sidebar View */
                                    <div className="flex flex-col items-center gap-5 py-4 animate-in fade-in duration-300">
                                        {/* Mini Cover Thumbnail */}
                                        <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]/30 shadow-md shrink-0">
                                            {playlist.thumbnailUrl ? (
                                                <img 
                                                    src={playlist.thumbnailUrl} 
                                                    alt={playlist.title} 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center opacity-20 text-[var(--text-muted)]">
                                                    <Icons.list size={16} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Mini Ranking */}
                                        <div className="text-[9px] font-black text-amber-400 flex items-center gap-0.5 animate-in fade-in duration-300" title={`Ranking: ${playlist.ranking || 3}`}>
                                            ⭐️{playlist.ranking || 3}
                                        </div>

                                        {/* Separator */}
                                        <div className="w-6 h-px bg-[var(--border)]" />

                                        {/* Action Icon Buttons */}
                                        <div className="flex flex-col gap-3 w-full items-center">
                                            {/* Play All */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (resourcesState.length > 0) {
                                                        router.push(`/resources/${resourcesState[0].id}?playlistId=${playlistId}`);
                                                    }
                                                }}
                                                disabled={resourcesState.length === 0}
                                                className="w-9 h-9 rounded-xl bg-primary disabled:bg-white/10 text-white disabled:text-white/25 flex items-center justify-center hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-all shadow-md shadow-primary/10"
                                                title="Play All Curated Sequence"
                                            >
                                                <Icons.play size={14} fill="currentColor" />
                                            </button>

                                            {/* Edit */}
                                            {canManage && (
                                                <button
                                                    type="button"
                                                    onClick={openEditMeta}
                                                    className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/60 text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all font-black text-xs"
                                                    title="Edit Playlist Settings"
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Full Expanded Sidebar View */
                                    <div className="animate-in fade-in duration-300">

                                        {/* Cover Stack */}
                                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]/30 mb-6 shadow-2xl">
                                            {playlist.thumbnailUrl ? (
                                                <img 
                                                    src={playlist.thumbnailUrl} 
                                                    alt={playlist.title} 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center opacity-20 text-[var(--text-muted)]">
                                                    <Icons.list size={48} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Details */}
                                        <h1 className="text-3xl font-black font-outfit tracking-tighter text-[var(--text-primary)] mb-3 leading-tight">
                                            {playlist.title}
                                        </h1>
                                        
                                        <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-4 pb-4 border-b border-[var(--border)]">
                                            <span>{playlist.status}</span>
                                            <span>•</span>
                                            <span>{resourcesState.length} Assets</span>
                                            <span>•</span>
                                            <span className="text-amber-400 flex items-center gap-0.5">⭐️ {playlist.ranking || 3}</span>
                                        </div>

                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium mb-8 whitespace-pre-wrap">
                                            {playlist.description || 'No description provided.'}
                                        </p>

                                        {/* Tag Section */}
                                        <div className="mb-6 pt-4 border-t border-[var(--border)]">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Intelligence Tags</h4>
                                            <div ref={tagInputRef} className="flex flex-wrap gap-2 items-center relative z-50">
                                                {playlist.tags?.map((tag: string) => {
                                                    const canEdit = isAdmin || (user && playlist.addedBy === user.uid);
                                                    return (
                                                        <span 
                                                            key={tag} 
                                                            className={`group/tag inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-secondary)]/60 border border-[var(--border)] rounded-lg text-[10px] font-bold text-[var(--text-muted)] italic transition-all hover:text-primary hover:border-primary/20 ${canEdit ? 'cursor-pointer' : ''}`}
                                                            onClick={() => {
                                                                if (canEdit) {
                                                                    handleRemoveTag(tag);
                                                                }
                                                            }}
                                                            title={canEdit ? `Click to remove tag #${tag}` : undefined}
                                                        >
                                                            #{tag}
                                                            {canEdit && (
                                                                <span className="opacity-0 group-hover/tag:opacity-100 text-rose-500 font-bold hover:scale-125 transition-all ml-1 text-xs leading-none">
                                                                    &times;
                                                                </span>
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                                {isTagInputOpen ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                className="px-2.5 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[10px] text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-primary/50 w-28"
                                                                placeholder="new tag..."
                                                                value={newTag}
                                                                onChange={(e) => setNewTag(e.target.value)}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleAddTag();
                                                                    } else if (e.key === 'Escape') {
                                                                        setIsTagInputOpen(false);
                                                                        setNewTag('');
                                                                    }
                                                                }}
                                                            />
                                                            {/* Suggestions Dropdown */}
                                                            {filteredTags.length > 0 && (
                                                                <div className="absolute top-full left-0 mt-1 w-48 max-h-[200px] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-2xl backdrop-blur-xl z-50 py-1 scrollbar-thin scrollbar-thumb-white/10">
                                                                    {filteredTags.map((tagName: string) => (
                                                                        <button
                                                                            key={tagName}
                                                                            onClick={() => handleAddTag(tagName)}
                                                                            className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-primary/20 transition-all font-medium flex items-center justify-between"
                                                                        >
                                                                            <span>#{tagName}</span>
                                                                            <span className="text-[8px] text-[var(--text-muted)]/50 font-mono">
                                                                                {allTags.find((t: any) => t.name === tagName)?.count || 0}
                                                                            </span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddTag()}
                                                            className="px-2 py-1 bg-primary text-white rounded text-[10px] font-black uppercase tracking-widest transition-all"
                                                        >
                                                            Add
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setIsTagInputOpen(false);
                                                                setNewTag('');
                                                            }}
                                                            className="px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded text-[10px] font-black uppercase tracking-widest transition-all"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    (isAdmin || (user && playlist.addedBy === user.uid)) && (
                                                        <button 
                                                            onClick={() => setIsTagInputOpen(true)} 
                                                            className="w-6 h-6 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)]/50 hover:text-primary hover:bg-primary/10 border border-[var(--border)] hover:border-primary/20 transition-all font-bold text-sm"
                                                            title="Add Tag"
                                                        >
                                                            +
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* Creator attribution */}
                                        <div className="mb-8 p-4 bg-[var(--bg-secondary)]/20 rounded-2xl border border-[var(--border)] flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center font-black text-xs overflow-hidden shrink-0">
                                                {playlist.creator?.photoURL ? (
                                                    <img src={playlist.creator.photoURL} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    playlist.creator?.displayName?.charAt(0) || '👤'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold truncate text-[var(--text-primary)]">{playlist.creator?.displayName || 'Unknown'}</div>
                                                <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-wider">Playlist Curator</div>
                                            </div>
                                        </div>

                                        {/* Primary Play Button */}
                                        <button
                                            onClick={() => {
                                                if (resourcesState.length > 0) {
                                                    router.push(`/resources/${resourcesState[0].id}?playlistId=${playlistId}`);
                                                }
                                            }}
                                            disabled={resourcesState.length === 0}
                                            className="w-full py-4 bg-primary disabled:bg-white/10 text-white disabled:text-white/25 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20"
                                        >
                                            <Icons.play size={16} fill="currentColor" /> Play All
                                        </button>

                                        {/* Owner Administration */}
                                        {canManage && (
                                            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[var(--border)]">
                                                <button
                                                    onClick={openEditMeta}
                                                    className="py-3.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80 border border-[var(--border)] rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-all"
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    onClick={() => setIsDeletePlaylistOpen(true)}
                                                    disabled={deleting}
                                                    className="py-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 transition-all"
                                                >
                                                    {deleting ? 'Deleting...' : '🗑️ Delete'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Resources Sequence */}
                        <div className={`space-y-6 transition-all duration-300 ${isSidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-8'}`}>
                            
                            {/* View Selector & Title */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-black font-outfit uppercase tracking-wider text-[var(--text-muted)] pl-2">
                                        Curated Playlist Sequence
                                    </h2>
                                    {isSavingOrder && (
                                        <div className="flex items-center gap-1.5 text-primary">
                                            <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                            <span className="text-[9px] font-black uppercase tracking-wider animate-pulse">Syncing Order...</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                                    <div className="flex bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-2xl p-1 shrink-0">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as any)}
                                            className="bg-transparent text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none px-3 py-1.5 rounded-xl cursor-pointer"
                                            title="Sort Sequence"
                                        >
                                            <option value="updated" className="bg-[var(--bg-primary)]">Date Updated</option>
                                            <option value="created" className="bg-[var(--bg-primary)]">Date Added</option>
                                            <option value="custom" className="bg-[var(--bg-primary)]">Custom Order</option>
                                        </select>
                                    </div>

                                    {sortBy !== 'custom' && (
                                        <button
                                            type="button"
                                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                            className="w-9 h-9 bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-2xl text-[10px] font-black text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center shrink-0"
                                            title={sortOrder === 'desc' ? "Sort: Descending (Newest First)" : "Sort: Ascending (Oldest First)"}
                                        >
                                            {sortOrder === 'desc' ? <Icons.arrowDown size={12} /> : <Icons.arrowUp size={12} />}
                                        </button>
                                    )}
                                
                                    <div className="flex bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-2xl p-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                                            viewMode === 'list' 
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title="List View"
                                    >
                                        <Icons.list size={12} />
                                        <span className="sr-only">List</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid-2')}
                                        className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                                            viewMode === 'grid-2' 
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title="2 Columns Grid"
                                    >
                                        <div className="relative flex items-center justify-center">
                                            <Icons.grid size={12} />
                                            <span className={`absolute -bottom-1 -right-1 text-[7px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center border ${
                                                viewMode === 'grid-2' 
                                                    ? 'bg-[var(--bg-primary)] text-primary border-primary/20' 
                                                    : 'bg-primary text-white border-transparent'
                                            }`}>
                                                2
                                            </span>
                                        </div>
                                        <span className="sr-only">2 Cols</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid-3')}
                                        className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                                            viewMode === 'grid-3' 
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title="3 Columns Grid"
                                    >
                                        <div className="relative flex items-center justify-center">
                                            <Icons.grid size={12} />
                                            <span className={`absolute -bottom-1 -right-1 text-[7px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center border ${
                                                viewMode === 'grid-3' 
                                                    ? 'bg-[var(--bg-primary)] text-primary border-primary/20' 
                                                    : 'bg-primary text-white border-transparent'
                                            }`}>
                                                3
                                            </span>
                                        </div>
                                        <span className="sr-only">3 Cols</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid-4')}
                                        className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                                            viewMode === 'grid-4' 
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title="4 Columns Grid"
                                    >
                                        <div className="relative flex items-center justify-center">
                                            <Icons.grid size={12} />
                                            <span className={`absolute -bottom-1 -right-1 text-[7px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center border ${
                                                viewMode === 'grid-4' 
                                                    ? 'bg-[var(--bg-primary)] text-primary border-primary/20' 
                                                    : 'bg-primary text-white border-transparent'
                                            }`}>
                                                4
                                            </span>
                                        </div>
                                        <span className="sr-only">4 Cols</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid-5')}
                                        className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                                                            viewMode === 'grid-5' 
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title="5 Columns Grid"
                                    >
                                        <div className="relative flex items-center justify-center">
                                            <Icons.grid size={12} />
                                            <span className={`absolute -bottom-1 -right-1 text-[7px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center border ${
                                                viewMode === 'grid-5' 
                                                    ? 'bg-[var(--bg-primary)] text-primary border-primary/20' 
                                                    : 'bg-primary text-white border-transparent'
                                            }`}>
                                                5
                                            </span>
                                        </div>
                                        <span className="sr-only">5 Cols</span>
                                    </button>
                                </div>
                            </div>
                            </div>

                            {resourcesState.length === 0 ? (
                                <div className="py-20 text-center border-2 border-dashed border-[var(--border)] rounded-[2rem] bg-[var(--bg-secondary)]/10">
                                    <Icons.list size={36} className="mx-auto mb-3 opacity-20 text-[var(--text-muted)]" />
                                    <h4 className="text-sm font-bold text-[var(--text-secondary)] mb-1">Playlist is currently empty</h4>
                                    <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-6">
                                        Go back to the Resources catalog and use the "Add to Playlist" button to include prompt resources.
                                    </p>
                                    <Link href="/resources" className="px-6 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-secondary)]/80 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                        Browse Resources
                                    </Link>
                                </div>
                            ) : (
                                <div>
                                    {viewMode === 'list' ? (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <SortableContext
                                                items={getSortedResources().map(r => r.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-4">
                                                    {getSortedResources().map((res: Resource, idx: number) => (
                                                        <SortablePlaylistItem
                                                            key={res.id}
                                                            res={res}
                                                            idx={idx}
                                                            total={resourcesState.length}
                                                            canManage={!!canManage}
                                                            isCustomOrder={sortBy === 'custom'}
                                                            onPromote={() => handlePromote(idx)}
                                                            onDemote={() => handleDemote(idx)}
                                                            onMoveToTop={() => handleMoveToTop(idx)}
                                                            onMoveToBottom={() => handleMoveToBottom(idx)}
                                                            onDelete={() => setDeleteTarget(res)}
                                                            isCurrentCover={
                                                                playlist.thumbnailSource === 'resource' &&
                                                                playlist.thumbnailResourceId === res.id
                                                            }
                                                            onSetAsCover={() => handleSetAsCover(res)}
                                                            playlistId={playlistId}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    ) : (
                                        <div className={`grid gap-6 ${
                                            viewMode === 'grid-2' ? 'grid-cols-1 sm:grid-cols-2' :
                                            viewMode === 'grid-3' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' :
                                            viewMode === 'grid-4' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' :
                                            'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                                        }`}>
                                            {getSortedResources().map((res: Resource) => (
                                                <ResourceCard
                                                    key={res.id}
                                                    resource={res}
                                                    savedIds={savedIds}
                                                    onToggleSave={handleToggleSave}
                                                    viewMode={
                                                        viewMode === 'grid-2' || viewMode === 'grid-3' ? 'grid' :
                                                        viewMode === 'grid-4' ? 'small' : 'minimal'
                                                    }
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </main>
            </div>

            {/* Confirmation Modal for Resource Removal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl relative flex flex-col text-[var(--text-primary)]">
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-500">Remove from Playlist</span>
                            <button onClick={() => setDeleteTarget(null)} className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                                <Icons.close size={18} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold">
                                Are you sure you want to remove <span className="text-[var(--text-primary)] font-bold">"{deleteTarget.title}"</span> from this playlist?
                            </p>

                            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-3 border border-[var(--border)] rounded-xl text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal for Playlist Deletion */}
            {isDeletePlaylistOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl relative flex flex-col text-[var(--text-primary)]">
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-500">Delete Playlist</span>
                            <button onClick={() => setIsDeletePlaylistOpen(false)} className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                                <Icons.close size={18} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {resourcesState.length > 0 && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-400">
                                    <Icons.alert size={16} className="shrink-0 mt-0.5" />
                                    <div className="text-[11px] font-semibold leading-normal">
                                        <div className="font-bold uppercase tracking-wider mb-0.5">Warning: Playlist is not empty</div>
                                        This playlist contains {resourcesState.length} curated {resourcesState.length === 1 ? 'asset' : 'assets'}. Deleting it will permanently remove this sequence.
                                    </div>
                                </div>
                            )}
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold">
                                Are you sure you want to delete the playlist <span className="text-[var(--text-primary)] font-bold">"{playlist.title}"</span>? This action is permanent and cannot be undone.
                            </p>

                            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
                                <button
                                    type="button"
                                    onClick={() => setIsDeletePlaylistOpen(false)}
                                    className="flex-1 py-3 border border-[var(--border)] rounded-xl text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
                                    disabled={deleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Playlist Settings Modal */}
            {isEditMetaOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl relative flex flex-col max-h-[90vh] text-[var(--text-primary)]">
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-6 shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Edit Playlist Settings</span>
                            <button onClick={() => setIsEditMetaOpen(false)} className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                                <Icons.close size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMeta} className="space-y-6 overflow-y-auto pr-1 flex-1 pb-4">
                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Playlist Name</label>
                                <input 
                                    type="text"
                                    required
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Description</label>
                                <textarea 
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-24 p-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all resize-none focus:bg-[var(--bg-secondary)]"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Tags (Comma-separated)</label>
                                <input 
                                    type="text"
                                    value={editTags}
                                    onChange={(e) => setEditTags(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                    placeholder="e.g. nextjs, tutorial, tips"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Visibility Status</label>
                                <div className="flex bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-0.5 w-max">
                                    <button
                                        type="button"
                                        onClick={() => setEditStatus('private')}
                                        className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${
                                            editStatus === 'private' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        Private
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditStatus('published')}
                                        className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${
                                            editStatus === 'published' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        Public
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Playlist Ranking</label>
                                <select 
                                    value={editRanking}
                                    onChange={(e) => setEditRanking(parseInt(e.target.value))}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                >
                                    <option value="1" className="bg-[var(--bg-card)] text-[var(--text-primary)]">⭐️ 1 Star</option>
                                    <option value="2" className="bg-[var(--bg-card)] text-[var(--text-primary)]">⭐️⭐️ 2 Stars</option>
                                    <option value="3" className="bg-[var(--bg-card)] text-[var(--text-primary)]">⭐️⭐️⭐️ 3 Stars (Default)</option>
                                    <option value="4" className="bg-[var(--bg-card)] text-[var(--text-primary)]">⭐️⭐️⭐️⭐️ 4 Stars</option>
                                    <option value="5" className="bg-[var(--bg-card)] text-[var(--text-primary)]">⭐️⭐️⭐️⭐️⭐️ 5 Stars</option>
                                </select>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Cover Thumbnail Source</label>
                                <select 
                                    value={editThumbnailSource}
                                    onChange={(e) => setEditThumbnailSource(e.target.value as any)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                >
                                    <option value="derived" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Derived (First item in sequence)</option>
                                    <option value="custom" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Custom Image URL</option>
                                    <option value="resource" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Selected Resource Thumbnail</option>
                                </select>

                                {/* Conditional custom URL */}
                                {editThumbnailSource === 'custom' && (
                                    <div className="space-y-2 pt-2">
                                        <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Thumbnail Image URL</label>
                                        <input 
                                            type="url"
                                            required
                                            placeholder="https://example.com/cover.jpg"
                                            value={editThumbnailUrl}
                                            onChange={(e) => setEditThumbnailUrl(e.target.value)}
                                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                        />
                                    </div>
                                )}

                                {/* Conditional specific resource */}
                                {editThumbnailSource === 'resource' && (
                                    <div className="space-y-2 pt-2">
                                        <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Select Source Resource</label>
                                        <select 
                                            value={editThumbnailResourceId}
                                            onChange={(e) => setEditThumbnailResourceId(e.target.value)}
                                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                        >
                                            <option value="" className="bg-[var(--bg-card)] text-[var(--text-primary)]">-- Choose resource --</option>
                                            {resourcesState.map((res: Resource) => (
                                                <option key={res.id} value={res.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">{res.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-[var(--border)] flex gap-4 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsEditMetaOpen(false)}
                                    className="flex-1 py-4 border border-[var(--border)] rounded-2xl text-[10px] font-black uppercase text-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/30 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingMeta}
                                    className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSavingMeta ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
