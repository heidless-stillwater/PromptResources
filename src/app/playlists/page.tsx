'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Icons } from '@/components/ui/Icons';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

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
    rectSortingStrategy,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Sortable Playlist Card ───────────────────────────────────────────────────

interface SortablePlaylistCardProps {
    playlist: any;
    viewMode: 'list' | 'grid-2' | 'grid-3' | 'grid-4' | 'grid-5';
    isSelecting: boolean;
    isSelected: boolean;
    canReorder: boolean;
    onToggleSelect: (id: string) => void;
}

function SortablePlaylistCard({
    playlist,
    viewMode,
    isSelecting,
    isSelected,
    canReorder,
    onToggleSelect,
}: SortablePlaylistCardProps) {
    const router = useRouter();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: playlist.id, disabled: !canReorder });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.75 : 1,
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (isSelecting) {
            e.preventDefault();
            onToggleSelect(playlist.id);
            return;
        }
        router.push(`/playlists/${playlist.id}`);
    };

    const thumbnailEl = playlist.thumbnailUrl ? (
        <img
            src={playlist.thumbnailUrl}
            alt={playlist.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
    ) : (
        <div className="w-full h-full flex items-center justify-center opacity-30 text-[var(--text-muted)]">
            <Icons.list size={32} />
        </div>
    );

    const statusBadge = (
        <span className={`px-2.5 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-wider ${
            playlist.status === 'published'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
        }`}>
            {playlist.status}
        </span>
    );

    // ── List View ──────────────────────────────────────────────────────────────
    if (viewMode === 'list') {
        return (
            <div
                ref={setNodeRef}
                style={style}
                onClick={handleCardClick}
                className={`group relative cursor-pointer flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 bg-[var(--bg-card)] ${
                    isSelected
                        ? 'border-primary/60 bg-primary/5 shadow-lg shadow-primary/10'
                        : 'border-[var(--border)] hover:border-primary/30'
                } ${isDragging ? 'shadow-2xl scale-[1.01]' : ''}`}
            >
                {/* Drag Handle */}
                {canReorder && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                        title="Drag to reorder"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Icons.menu size={14} />
                    </div>
                )}

                {/* Checkbox */}
                {isSelecting && (
                    <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'bg-primary border-primary' : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                        }`}
                        onClick={(e) => { e.stopPropagation(); onToggleSelect(playlist.id); }}
                    >
                        {isSelected && <Icons.check size={11} className="text-white" />}
                    </div>
                )}

                {/* Thumbnail */}
                <div className="w-20 aspect-video rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]/40 shrink-0">
                    {thumbnailEl}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black font-outfit tracking-tight text-[var(--text-primary)] group-hover:text-primary transition-colors truncate mb-0.5">
                        {playlist.title}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 leading-relaxed font-medium mb-2">
                        {playlist.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                        {statusBadge}
                        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            📚 {playlist.resourceIds?.length || 0} Assets
                        </span>
                        <div className="w-px h-3 bg-[var(--border)]" />
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-0.5" title={`Ranking: ${playlist.ranking || 3}`}>
                            ⭐️ {playlist.ranking || 3}
                        </span>
                        {playlist.tags && playlist.tags.length > 0 && (
                            <>
                                <div className="w-px h-3 bg-[var(--border)]" />
                                <div className="flex gap-1.5 flex-wrap">
                                    {playlist.tags.slice(0, 2).map((tag: string) => (
                                        <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-primary/40 italic">#{tag}</span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Creator & Arrow */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-teal-500 text-white flex items-center justify-center font-black text-[9px] overflow-hidden">
                            {playlist.creator?.photoURL ? (
                                <img src={playlist.creator.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                                playlist.creator?.displayName?.charAt(0) || '👤'
                            )}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] hidden sm:block">
                            {playlist.creator?.displayName || 'Unknown'}
                        </span>
                    </div>
                    <div className="text-[var(--text-muted)] group-hover:text-primary transition-all group-hover:translate-x-1">
                        <Icons.chevronRight size={14} />
                    </div>
                </div>
            </div>
        );
    }

    // ── Grid View ──────────────────────────────────────────────────────────────
    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={handleCardClick}
            className={`group relative cursor-pointer block ${isDragging ? 'scale-[1.02]' : ''}`}
        >
            {/* Stacked Paper Border Effect */}
            <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-3xl bg-[var(--bg-secondary)]/40 border border-[var(--border)] -z-10 transition-transform duration-300 group-hover:translate-x-2.5 group-hover:translate-y-2.5" />
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-[var(--bg-secondary)]/20 border border-[var(--border)] -z-20 transition-transform duration-300 group-hover:translate-x-4.5 group-hover:translate-y-4.5" />

            {/* Selection Overlay */}
            {isSelecting && (
                <div
                    className={`absolute inset-0 z-10 rounded-3xl border-2 transition-all ${
                        isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent hover:border-primary/40'
                    }`}
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(playlist.id); }}
                >
                    <div
                        className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-primary border-primary' : 'border-white/60 bg-black/30 backdrop-blur-sm'
                        }`}
                    >
                        {isSelected && <Icons.check size={11} className="text-white" />}
                    </div>
                </div>
            )}

            {/* Main Card */}
            <div className={`glass-card !p-0 overflow-hidden relative border transition-all duration-300 rounded-3xl h-full flex flex-col bg-[var(--bg-card)] ${
                isSelected ? 'border-primary/60' : 'border-[var(--border)] group-hover:border-primary/40'
            }`}>
                {/* Cover */}
                <div className="aspect-video relative overflow-hidden bg-[var(--bg-secondary)]/40 border-b border-[var(--border)]">
                    {thumbnailEl}

                    {/* Drag Handle (top-right, shown in canReorder mode) */}
                    {canReorder && (
                        <div
                            {...attributes}
                            {...listeners}
                            className="absolute top-2 right-2 z-20 cursor-grab p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/60 transition-all"
                            title="Drag to reorder"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Icons.menu size={12} />
                        </div>
                    )}

                    {/* Quantity Badge */}
                    <div className="absolute bottom-3 right-3 bg-[var(--bg-primary)]/85 backdrop-blur-md border border-[var(--border)] rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                        📚 {playlist.resourceIds?.length || 0} Assets
                    </div>
                    {/* Ranking Badge */}
                    <div className="absolute bottom-3 left-3 bg-[var(--bg-primary)]/85 backdrop-blur-md border border-[var(--border)] rounded-xl px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-0.5" title={`Ranking: ${playlist.ranking || 3}`}>
                        ⭐️ {playlist.ranking || 3}
                    </div>
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex gap-2">
                        {statusBadge}
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-black font-outfit tracking-tight text-[var(--text-primary)] group-hover:text-primary transition-colors line-clamp-1 mb-2">
                        {playlist.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed mb-6 font-medium">
                        {playlist.description || 'No description provided.'}
                    </p>

                    {/* Tag Belt */}
                    {playlist.tags && playlist.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4 mt-auto">
                            {playlist.tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-primary/40 italic">#{tag}</span>
                            ))}
                        </div>
                    )}

                    {/* Creator Info */}
                    <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-teal-500 text-white flex items-center justify-center font-black text-[9px] overflow-hidden">
                                {playlist.creator?.photoURL ? (
                                    <img src={playlist.creator.photoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    playlist.creator?.displayName?.charAt(0) || '👤'
                                )}
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                {playlist.creator?.displayName || 'Unknown'}
                            </span>
                        </div>
                        <div className="text-[var(--text-muted)] group-hover:text-primary transition-all group-hover:translate-x-1">
                            <Icons.chevronRight size={16} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'grid-2' | 'grid-3' | 'grid-4' | 'grid-5';

export default function PlaylistsPage() {
    const { user, isAdmin } = useAuth();
    const { isDarkMode } = useTheme();
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [playlistsState, setPlaylistsState] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterOwn, setFilterOwn] = useState(false);

    const [viewMode, setViewMode] = useState<ViewMode>('grid-4');

    // Multi-select
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Bulk delete
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isConfirmBulkDeleteOpen, setIsConfirmBulkDeleteOpen] = useState(false);

    // Create Playlist Form Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createTitle, setCreateTitle] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [createTags, setCreateTags] = useState('');
    const [createStatus, setCreateStatus] = useState<'published' | 'private'>('private');
    const [submitting, setSubmitting] = useState(false);

    const [sortBy, setSortBy] = useState<'title' | 'createdAt' | 'updatedAt' | 'ranking'>('ranking');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [rankingFilter, setRankingFilter] = useState<string>('');

    const canReorder = !!user && filterOwn && sortBy === 'updatedAt' && sortOrder === 'desc';

    // ── DnD Sensors ────────────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // ── Data Fetching ──────────────────────────────────────────────────────────
    useEffect(() => {
        fetchPlaylists();
    }, [search, filterOwn, user, sortBy, sortOrder, rankingFilter]);

    // Apply saved localStorage order whenever playlists or filterOwn changes
    useEffect(() => {
        if (!filterOwn || !user || sortBy !== 'updatedAt' || sortOrder !== 'desc') {
            setPlaylistsState(playlists);
            return;
        }
        try {
            const key = `pr_playlist_order_${user.uid}`;
            const raw = localStorage.getItem(key);
            if (raw) {
                const orderedIds: string[] = JSON.parse(raw);
                const ordered = [
                    ...orderedIds.map((id) => playlists.find((p) => p.id === id)).filter(Boolean),
                    ...playlists.filter((p) => !orderedIds.includes(p.id)),
                ];
                setPlaylistsState(ordered as any[]);
            } else {
                setPlaylistsState(playlists);
            }
        } catch {
            setPlaylistsState(playlists);
        }
    }, [playlists, filterOwn, user, sortBy, sortOrder]);

    const fetchPlaylists = async () => {
        try {
            setLoading(true);
            const token = user ? await user.getIdToken() : '';
            let url = `/api/playlists?search=${encodeURIComponent(search)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
            if (rankingFilter) url += `&ranking=${rankingFilter}`;
            if (filterOwn && user) url += `&userOnly=true`;
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(url, { headers, cache: 'no-store' });
            const result = await res.json();
            if (result.success) setPlaylists(result.data || []);
        } catch (e) {
            console.error('[PlaylistsPage] Error fetching playlists:', e);
        } finally {
            setLoading(false);
        }
    };

    // ── Drag & Drop ────────────────────────────────────────────────────────────
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            const oldIndex = playlistsState.findIndex((p) => p.id === active.id);
            const newIndex = playlistsState.findIndex((p) => p.id === over.id);
            const next = arrayMove(playlistsState, oldIndex, newIndex);
            setPlaylistsState(next);
            if (user) {
                const key = `pr_playlist_order_${user.uid}`;
                localStorage.setItem(key, JSON.stringify(next.map((p) => p.id)));
            }
        }
    };

    // ── Selection ──────────────────────────────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const exitSelectMode = () => {
        setIsSelecting(false);
        setSelectedIds(new Set());
    };

    // ── Bulk Delete ────────────────────────────────────────────────────────────
    const handleBulkDelete = async () => {
        if (!user || selectedIds.size === 0) return;
        try {
            setIsBulkDeleting(true);
            const token = await user.getIdToken();
            await Promise.all(
                Array.from(selectedIds).map((id) =>
                    fetch(`/api/playlists/${id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    })
                )
            );
            // Remove from local order in localStorage
            if (user) {
                const key = `pr_playlist_order_${user.uid}`;
                const raw = localStorage.getItem(key);
                if (raw) {
                    const ids: string[] = JSON.parse(raw).filter((id: string) => !selectedIds.has(id));
                    localStorage.setItem(key, JSON.stringify(ids));
                }
            }
            exitSelectMode();
            fetchPlaylists();
            window.dispatchEvent(new Event('playlists-updated'));
        } catch (e) {
            console.error('[PlaylistsPage] Error bulk deleting playlists:', e);
        } finally {
            setIsBulkDeleting(false);
            setIsConfirmBulkDeleteOpen(false);
        }
    };

    // ── Create Playlist ────────────────────────────────────────────────────────
    const handleCreatePlaylist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createTitle.trim() || !user) return;
        try {
            setSubmitting(true);
            const token = await user.getIdToken();
            const tagList = createTags
                .split(',')
                .map(t => t.trim().toLowerCase())
                .filter(Boolean);
            const res = await fetch('/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title: createTitle.trim(), description: createDesc.trim(), status: createStatus, tags: tagList, resourceIds: [] }),
            });
            const result = await res.json();
            if (result.success) {
                setCreateTitle('');
                setCreateDesc('');
                setCreateTags('');
                setCreateStatus('private');
                setIsCreateOpen(false);
                fetchPlaylists();
            }
        } catch (e) {
            console.error('[PlaylistsPage] Error creating playlist:', e);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Derived ────────────────────────────────────────────────────────────────
    const gridClass: Record<ViewMode, string> = {
        list: 'flex flex-col gap-4',
        'grid-2': 'grid grid-cols-1 md:grid-cols-2 gap-8',
        'grid-3': 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8',
        'grid-4': 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6',
        'grid-5': 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5',
    };

    const viewButtons: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
        { 
            mode: 'list', 
            label: 'List View',
            icon: <Icons.list size={12} /> 
        },
        { 
            mode: 'grid-2', 
            label: '2 Columns',
            icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="18" rx="1" />
                    <rect x="14" y="3" width="7" height="18" rx="1" />
                </svg>
            )
        },
        { 
            mode: 'grid-3', 
            label: '3 Columns',
            icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="5" height="18" rx="1" />
                    <rect x="9" y="3" width="6" height="18" rx="1" />
                    <rect x="17" y="3" width="5" height="18" rx="1" />
                </svg>
            )
        },
        { 
            mode: 'grid-4', 
            label: '4 Columns',
            icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
            )
        },
        { 
            mode: 'grid-5', 
            label: '5 Columns',
            icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="5" height="7" rx="1" />
                    <rect x="9" y="3" width="6" height="7" rx="1" />
                    <rect x="17" y="3" width="5" height="7" rx="1" />
                    <rect x="2" y="14" width="5" height="7" rx="1" />
                    <rect x="9" y="14" width="6" height="7" rx="1" />
                    <rect x="17" y="14" width="5" height="7" rx="1" />
                </svg>
            )
        },
    ];

    // ── JSX ────────────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-primary/30 font-inter">
            <Navbar />

            <div className="main-content pt-24 pb-32">
                <main className="container mx-auto px-4">

                    {/* Header Banner */}
                    <div className="relative rounded-[2.5rem] overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]/30 p-10 md:p-16 mb-12 shadow-2xl">
                        <div className="absolute inset-0 z-0">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-60" />
                            <div className="absolute top-[-50%] right-[-20%] w-[60%] h-[100%] bg-primary/10 rounded-full blur-[150px] opacity-40" />
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="space-y-4 max-w-2xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-primary">
                                    <Icons.list size={12} /> Playlists Hub
                                </div>
                                <h1 className="text-4xl md:text-6xl font-black font-outfit tracking-tighter text-[var(--text-primary)] leading-none">
                                    Resource Playlists
                                </h1>
                                <p className="text-[var(--text-secondary)] text-base md:text-lg font-medium leading-relaxed">
                                    Explore curated learning pathways and sequence collections of engineering prompts and architectural assets.
                                </p>
                            </div>

                            {user && (
                                <button
                                    onClick={() => setIsCreateOpen(true)}
                                    className="px-8 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 shrink-0 self-start md:self-auto"
                                >
                                    ➕ Create Playlist
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter Belt */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">

                        {/* Left: Search + Icon Controls */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative w-full sm:w-72">
                                <input
                                    type="text"
                                    placeholder="Search playlists..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl h-11 pl-11 pr-4 text-xs font-semibold outline-none focus:border-primary/50 transition-all text-[var(--text-primary)]"
                                />
                                <Icons.search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-60" />
                            </div>

                            {/* Ranking Filter — icon-only with native select overlay */}
                            <div
                                className={`relative w-11 h-11 flex items-center justify-center rounded-2xl border transition-all cursor-pointer ${
                                    rankingFilter
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                        : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-400/30'
                                }`}
                                title={rankingFilter ? `Ranking: ${rankingFilter} ⭐` : 'Filter by Ranking'}
                            >
                                <span className="text-base pointer-events-none select-none">⭐</span>
                                <select
                                    value={rankingFilter}
                                    onChange={(e) => setRankingFilter(e.target.value)}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                >
                                    <option value="">All Rankings</option>
                                    <option value="5">5 Stars</option>
                                    <option value="4">4 Stars</option>
                                    <option value="3">3 Stars</option>
                                    <option value="2">2 Stars</option>
                                    <option value="1">1 Star</option>
                                </select>
                            </div>

                            {/* My/Public Tabs — icon only */}
                            {user && (
                                <div className="flex bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-1 shrink-0">
                                    <button
                                        onClick={() => { setFilterOwn(false); exitSelectMode(); }}
                                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                                            !filterOwn ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title="Public Playlists"
                                    >
                                        <Icons.globe size={14} />
                                    </button>
                                    <button
                                        onClick={() => setFilterOwn(true)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                                            filterOwn ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title="My Playlists"
                                    >
                                        <Icons.user size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right: Sort + Select + View Selector */}
                        <div className="flex items-center gap-3 shrink-0">
                            {/* Sort — icon-only with native select overlay */}
                            <div
                                className="relative w-11 h-11 flex items-center justify-center rounded-2xl border bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-primary/30 transition-all cursor-pointer"
                                title={`Sort: ${sortBy} ${sortOrder === 'desc' ? '↓' : '↑'}`}
                            >
                                <Icons.sort size={15} />
                                <select
                                    value={`${sortBy}_${sortOrder}`}
                                    onChange={(e) => {
                                        const [newSortBy, newSortOrder] = e.target.value.split('_') as [any, any];
                                        setSortBy(newSortBy);
                                        setSortOrder(newSortOrder);
                                    }}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                >
                                    <option value="ranking_desc">⭐️ Highest Ranking</option>
                                    <option value="ranking_asc">⭐️ Lowest Ranking</option>
                                    <option value="updatedAt_desc">📅 Recently Updated</option>
                                    <option value="updatedAt_asc">📅 Oldest Updated</option>
                                    <option value="createdAt_desc">✨ Recently Created</option>
                                    <option value="createdAt_asc">✨ Oldest Created</option>
                                    <option value="title_asc">🔤 Title (A-Z)</option>
                                    <option value="title_desc">🔤 Title (Z-A)</option>
                                </select>
                            </div>

                            {/* Select Mode Toggle */}
                            {user && playlistsState.length > 0 && (
                                <button
                                    onClick={() => isSelecting ? exitSelectMode() : setIsSelecting(true)}
                                    className={`w-11 h-11 flex items-center justify-center rounded-2xl border transition-all ${
                                        isSelecting
                                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                                             : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-primary/30'
                                    }`}
                                    title={isSelecting ? `Cancel Selection (${selectedIds.size})` : 'Select Mode'}
                                >
                                    {isSelecting ? <Icons.close size={14} /> : <Icons.check size={14} />}
                                </button>
                            )}

                            {/* Select All Toggle (Icon-only) */}
                            {user && playlistsState.length > 0 && isSelecting && (
                                <button
                                    onClick={() => {
                                        const allSelected = selectedIds.size === playlistsState.length;
                                        if (allSelected) {
                                            setSelectedIds(new Set());
                                        } else {
                                            setSelectedIds(new Set(playlistsState.map((p) => p.id)));
                                        }
                                    }}
                                    className="w-11 h-11 flex items-center justify-center rounded-2xl border bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-primary/30 transition-all"
                                    title={selectedIds.size === playlistsState.length ? 'Deselect All' : 'Select All'}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M7 12l5 5L22 7" />
                                        <path d="M2 12l5 5L12 10" />
                                    </svg>
                                </button>
                            )}

                            {/* View Mode Selector */}
                            <div className="flex bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-2xl p-1 items-center">
                                {viewButtons.map(({ mode, icon, label }) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setViewMode(mode)}
                                        className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center ${
                                            viewMode === mode
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title={mode === 'list' ? 'List View' : `${label}`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>


                    {/* DnD hint for My Playlists */}
                    {canReorder && playlistsState.length > 1 && (
                        <div className="mb-5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
                            <Icons.menu size={10} />
                            Drag cards to reorder — saved automatically
                        </div>
                    )}

                    {/* Catalog */}
                    {loading ? (
                        <div className="py-24 flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Syncing Catalog...</span>
                        </div>
                    ) : playlistsState.length === 0 ? (
                        <div className="py-24 text-center glass-card border-[var(--border)] bg-[var(--bg-secondary)]/10">
                            <div className="text-4xl mb-4">📂</div>
                            <h3 className="text-lg font-bold mb-2">No playlists discovered</h3>
                            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-6">
                                Try adjusting your search keywords or create a new playlist of resources.
                            </p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={playlistsState.map((p) => p.id)}
                                strategy={viewMode === 'list' ? verticalListSortingStrategy : rectSortingStrategy}
                            >
                                <div className={gridClass[viewMode]}>
                                    {playlistsState.map((playlist) => (
                                        <SortablePlaylistCard
                                            key={playlist.id}
                                            playlist={playlist}
                                            viewMode={viewMode}
                                            isSelecting={isSelecting}
                                            isSelected={selectedIds.has(playlist.id)}
                                            canReorder={canReorder}
                                            onToggleSelect={toggleSelect}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </main>
            </div>

            <Footer />

            {/* ── Floating Selection Action Bar ─────────────────────────────────── */}
            {isSelecting && selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
                    <div className="flex items-center gap-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl px-4 py-2.5 shadow-2xl shadow-black/30 backdrop-blur-md">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] px-1">
                            {selectedIds.size} selected
                        </span>
                        <div className="w-px h-4 bg-[var(--border)]" />
                        {/* Select All */}
                        <button
                            onClick={() => setSelectedIds(new Set(playlistsState.map((p) => p.id)))}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-primary hover:bg-primary/10 transition-all"
                            title="Select All"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 12l5 5L22 7" />
                                <path d="M2 12l5 5L12 10" />
                            </svg>
                        </button>
                        {/* Delete */}
                        <button
                            onClick={() => setIsConfirmBulkDeleteOpen(true)}
                            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                            title={`Delete ${selectedIds.size} selected`}
                        >
                            <Icons.trash size={14} />
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center leading-none">
                                {selectedIds.size}
                            </span>
                        </button>
                        <div className="w-px h-4 bg-[var(--border)]" />
                        {/* Close */}
                        <button
                            onClick={exitSelectMode}
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                            title="Exit selection"
                        >
                            <Icons.close size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Bulk Delete Confirmation Modal ────────────────────────────────── */}
            {isConfirmBulkDeleteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl text-[var(--text-primary)]">
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-500">Delete Playlists</span>
                            <button onClick={() => setIsConfirmBulkDeleteOpen(false)} className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                                <Icons.close size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold mb-6">
                            Are you sure you want to permanently delete <span className="text-[var(--text-primary)] font-bold">{selectedIds.size} playlist{selectedIds.size > 1 ? 's' : ''}</span>? This action cannot be undone.
                        </p>

                        {playlistsState.filter((p) => selectedIds.has(p.id)).some((p) => p.resourceIds?.length > 0) && (
                            <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-400">
                                <Icons.alert size={16} className="shrink-0 mt-0.5" />
                                <div className="text-[11px] font-semibold leading-normal">
                                    <div className="font-bold uppercase tracking-wider mb-0.5">Warning: Non-empty playlists selected</div>
                                    Some of the selected playlists contain curated assets. Deleting them will permanently remove their sequences.
                                </div>
                            </div>
                        )}

                        <div className="mb-6 max-h-40 overflow-y-auto border border-[var(--border)] rounded-2xl p-4 bg-[var(--bg-secondary)]/30 space-y-2">
                            {playlistsState.filter((p) => selectedIds.has(p.id)).map((p) => (
                                <div key={p.id} className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center justify-between gap-2">
                                    <Link 
                                        href={`/playlists/${p.id}`}
                                        target="_blank"
                                        className="flex items-center gap-2 truncate hover:text-primary transition-colors"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                        <span className="truncate">{p.title}</span>
                                        <Icons.external size={10} className="opacity-50 shrink-0" />
                                    </Link>
                                    {p.resourceIds?.length > 0 && (
                                        <span className="text-[9px] font-black uppercase text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 shrink-0">
                                            {p.resourceIds.length} assets
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
                            <button
                                type="button"
                                onClick={() => setIsConfirmBulkDeleteOpen(false)}
                                disabled={isBulkDeleting}
                                className="flex-1 py-3 border border-[var(--border)] rounded-xl text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting}
                                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create Playlist Modal ─────────────────────────────────────────── */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh] text-[var(--text-primary)]">
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">New Playlist</span>
                            <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                                <Icons.close size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePlaylist} className="space-y-6 overflow-y-auto pr-1">
                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Playlist Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Next.js Masterclass"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-12 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Description</label>
                                <textarea
                                    placeholder="Enter a brief summary..."
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-24 p-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Tags (Comma-separated)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. tutorial, intermediate, nextjs"
                                    value={createTags}
                                    onChange={(e) => setCreateTags(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-12 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Visibility</label>
                                    <div className="flex bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-0.5">
                                        <button type="button" onClick={() => setCreateStatus('private')}
                                            className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${createStatus === 'private' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                        >Private</button>
                                        <button type="button" onClick={() => setCreateStatus('published')}
                                            className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${createStatus === 'published' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                        >Public</button>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-6">
                                    <button type="button" onClick={() => setIsCreateOpen(false)}
                                        className="px-6 py-3 border border-[var(--border)] rounded-xl text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
                                    >Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                    >{submitting ? 'Creating...' : 'Create'}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
