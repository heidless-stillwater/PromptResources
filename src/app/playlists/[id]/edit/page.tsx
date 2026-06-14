'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Icons } from '@/components/ui/Icons';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
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

// Individual Sortable Item Component
interface SortableResourceItemProps {
    resource: Resource;
    index: number;
    total: number;
    onMoveToTop: () => void;
    onMoveToBottom: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
}

function SortableResourceItem({
    resource,
    index,
    total,
    onMoveToTop,
    onMoveToBottom,
    onMoveUp,
    onMoveDown,
    onRemove
}: SortableResourceItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: resource.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-2xl transition-all ${
                isDragging 
                    ? 'border-primary/50 bg-[var(--bg-card)] shadow-2xl scale-[1.01]' 
                    : 'border-[var(--border)] bg-[var(--bg-secondary)]/20 hover:bg-[var(--bg-secondary)]/45 hover:border-[var(--border)]/80'
            }`}
        >
            {/* Drag Handle & Ordering */}
            <div className="flex items-center gap-3 shrink-0">
                <div {...attributes} {...listeners} className="cursor-grab p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    <Icons.menu size={16} />
                </div>
                <div className="w-6 text-[10px] font-black text-[var(--text-muted)] opacity-60 text-center">
                    #{index + 1}
                </div>
            </div>

            {/* Thumbnail */}
            <div className="w-20 aspect-video relative rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]/30 shrink-0">
                {resource.thumbnailUrl || resource.youtubeVideoId ? (
                    <img 
                        src={resource.thumbnailUrl || `https://img.youtube.com/vi/${resource.youtubeVideoId}/hqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs opacity-20 text-[var(--text-primary)]">
                        📄
                    </div>
                )}
            </div>

            {/* Resource details */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
                <h4 className="text-xs font-bold truncate text-[var(--text-primary)]">{resource.title}</h4>
                <p className="text-[9px] text-[var(--text-muted)] truncate mt-0.5">{resource.description}</p>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[8px] font-black uppercase text-[var(--text-muted)]/50 tracking-widest mt-1">
                    <span>{resource.platform}</span>
                    <span>•</span>
                    <span>{resource.pricing}</span>
                </div>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    disabled={index === 0}
                    onClick={onMoveToTop}
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-10"
                    title="Move to Top"
                >
                    <Icons.arrowUp size={11} />
                </button>
                <button
                    type="button"
                    disabled={index === 0}
                    onClick={onMoveUp}
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-10"
                    title="Move Up"
                >
                    <Icons.chevronUp size={11} />
                </button>
                <button
                    type="button"
                    disabled={index === total - 1}
                    onClick={onMoveDown}
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-10"
                    title="Move Down"
                >
                    <Icons.chevronDown size={11} />
                </button>
                <button
                    type="button"
                    disabled={index === total - 1}
                    onClick={onMoveToBottom}
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-10"
                    title="Move to Bottom"
                >
                    <Icons.arrowDown size={11} />
                </button>
                <button
                    type="button"
                    onClick={onRemove}
                    className="p-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/25 text-rose-500 transition-all ml-2"
                    title="Remove from Playlist"
                >
                    <Icons.delete size={11} />
                </button>
            </div>
        </div>
    );
}

export default function PlaylistEditPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAdmin, loading: authLoading } = useAuth();
    const { isDarkMode } = useTheme();

    const playlistId = params.id as string;

    // Form states
    const [playlist, setPlaylist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'published' | 'private'>('private');
    const [thumbnailSource, setThumbnailSource] = useState<'derived' | 'custom' | 'resource'>('derived');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [thumbnailResourceId, setThumbnailResourceId] = useState('');
    const [tags, setTags] = useState('');
    
    // Sortable resources array state
    const [resources, setResources] = useState<Resource[]>([]);

    useEffect(() => {
        if (playlistId && !authLoading) {
            fetchPlaylist();
        }
    }, [playlistId, authLoading, user]);

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
                const p = result.data;
                // Owner / Admin authorization check
                if (user && p.addedBy !== user.uid && !isAdmin) {
                    alert('Unauthorized access');
                    router.push(`/playlists/${playlistId}`);
                    return;
                }
                setPlaylist(p);
                setTitle(p.title || '');
                setDescription(p.description || '');
                setStatus(p.status || 'private');
                setThumbnailSource(p.thumbnailSource || 'derived');
                setThumbnailUrl(p.thumbnailUrl || '');
                setThumbnailResourceId(p.thumbnailResourceId || '');
                setResources(p.resources || []);
                setTags((p.tags || []).join(', '));
            } else {
                setPlaylist(null);
            }
        } catch (e) {
            console.error('[PlaylistEditPage] Error fetching playlist:', e);
        } finally {
            setLoading(false);
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
            setResources((prev) => {
                const oldIndex = prev.findIndex(r => r.id === active.id);
                const newIndex = prev.findIndex(r => r.id === over.id);
                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    };

    // Button sorting actions
    const moveUp = (index: number) => {
        if (index === 0) return;
        setResources(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index - 1];
            next[index - 1] = temp;
            return next;
        });
    };

    const moveDown = (index: number) => {
        if (index === resources.length - 1) return;
        setResources(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index + 1];
            next[index + 1] = temp;
            return next;
        });
    };

    const moveToTop = (index: number) => {
        if (index === 0) return;
        setResources(prev => {
            const next = [...prev];
            const item = next.splice(index, 1)[0];
            next.unshift(item);
            return next;
        });
    };

    const moveToBottom = (index: number) => {
        if (index === resources.length - 1) return;
        setResources(prev => {
            const next = [...prev];
            const item = next.splice(index, 1)[0];
            next.push(item);
            return next;
        });
    };

    const removeResource = (index: number) => {
        setResources(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !user) return;

        try {
            setSaving(true);
            const token = await user.getIdToken();
            const res = await fetch(`/api/playlists/${playlistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    status,
                    thumbnailSource,
                    thumbnailUrl: thumbnailSource === 'custom' ? thumbnailUrl.trim() : null,
                    thumbnailResourceId: thumbnailSource === 'resource' ? thumbnailResourceId : null,
                    resourceIds: resources.map(r => r.id),
                    tags: tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
                })
            });
            const result = await res.json();
            if (result.success) {
                router.push(`/playlists/${playlistId}`);
                router.refresh();
            }
        } catch (e) {
            console.error('[PlaylistEditPage] Error updating playlist:', e);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="page-wrapper dashboard-theme min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between">
                <Navbar />
                <div className="py-48 flex-grow flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Syncing Workspace...</span>
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
                    <h2 className="text-2xl font-black font-outfit uppercase tracking-tighter">Workspace Error</h2>
                    <p className="text-[var(--text-muted)] max-w-sm text-center font-semibold text-sm">
                        This playlist could not be resolved or retrieved.
                    </p>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-primary/30 font-inter">
            <Navbar />

            <div className="main-content pt-28 pb-20">
                <main className="container mx-auto px-4">
                    {/* Header Banner */}
                    <div className="relative rounded-[2rem] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-10">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-4 transition-colors">
                            <Link href={`/playlists/${playlistId}`}>
                                ← Cancel to Playlist View
                            </Link>
                        </div>
                        <h1 className="text-2xl font-black font-outfit uppercase tracking-wider text-[var(--text-primary)]">
                            Playlist Reorder Studio
                        </h1>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-1">
                            Modify metadata configuration and reorder resource play sequences
                        </p>
                    </div>

                    <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        
                        {/* LEFT COLUMN: Metadata Config Form */}
                        <div className="lg:col-span-5 space-y-8">
                            <div className="glass-card p-8 space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary pb-4 border-b border-[var(--border)]">
                                    Playlist Configurations
                                </h3>

                                <div className="space-y-2">
                                    <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Playlist Name</label>
                                    <input 
                                        type="text"
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Description</label>
                                    <textarea 
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl h-24 p-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all resize-none focus:bg-[var(--bg-secondary)]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Tags (Comma-separated)</label>
                                    <input 
                                        type="text"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                        placeholder="e.g. nextjs, tutorial, tips"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Visibility Status</label>
                                    <div className="flex bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl p-0.5 w-max">
                                        <button
                                            type="button"
                                            onClick={() => setStatus('private')}
                                            className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${
                                                status === 'private' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                            }`}
                                        >
                                            Private
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStatus('published')}
                                            className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${
                                                status === 'published' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                            }`}
                                        >
                                            Public
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                                    <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Cover Thumbnail Source</label>
                                    <select 
                                        value={thumbnailSource}
                                        onChange={(e) => setThumbnailSource(e.target.value as any)}
                                        className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                    >
                                        <option value="derived" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Derived (First item in sequence)</option>
                                        <option value="custom" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Custom Image URL</option>
                                        <option value="resource" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Selected Resource Thumbnail</option>
                                    </select>

                                    {/* Conditional custom URL */}
                                    {thumbnailSource === 'custom' && (
                                        <div className="space-y-2 pt-2">
                                            <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Thumbnail Image URL</label>
                                            <input 
                                                type="url"
                                                required
                                                placeholder="https://example.com/cover.jpg"
                                                value={thumbnailUrl}
                                                onChange={(e) => setThumbnailUrl(e.target.value)}
                                                className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                            />
                                        </div>
                                    )}

                                    {/* Conditional specific resource */}
                                    {thumbnailSource === 'resource' && (
                                        <div className="space-y-2 pt-2">
                                            <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Select Source Resource</label>
                                            <select 
                                                value={thumbnailResourceId}
                                                onChange={(e) => setThumbnailResourceId(e.target.value)}
                                                className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl h-11 px-4 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-primary/50 transition-all focus:bg-[var(--bg-secondary)]"
                                            >
                                                <option value="" className="bg-[var(--bg-card)] text-[var(--text-primary)]">-- Choose resource --</option>
                                                {resources.map((res: Resource) => (
                                                    <option key={res.id} value={res.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">{res.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-[var(--border)] flex gap-4">
                                    <Link
                                        href={`/playlists/${playlistId}`}
                                        className="flex-1 py-4 border border-[var(--border)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/30 transition-all"
                                    >
                                        Cancel
                                    </Link>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Reorder Sandbox */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className="glass-card p-8">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-6 pb-4 border-b border-[var(--border)] flex items-center justify-between">
                                    <span>Sequence Sandbox</span>
                                    <span className="text-[9px] font-mono opacity-40">Drag handles or use buttons to sort</span>
                                </h3>

                                {resources.length === 0 ? (
                                    <div className="py-20 text-center border-2 border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)]/10">
                                        <div className="text-3xl mb-3 opacity-20">📭</div>
                                        <p className="text-xs text-[var(--text-muted)]">No resources assigned to this playlist yet.</p>
                                    </div>
                                ) : (
                                    <DndContext 
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext 
                                            items={resources.map(r => r.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-3">
                                                {resources.map((res, idx) => (
                                                    <SortableResourceItem 
                                                        key={res.id} 
                                                        resource={res} 
                                                        index={idx}
                                                        total={resources.length}
                                                        onMoveToTop={() => moveToTop(idx)}
                                                        onMoveToBottom={() => moveToBottom(idx)}
                                                        onMoveUp={() => moveUp(idx)}
                                                        onMoveDown={() => moveDown(idx)}
                                                        onRemove={() => removeResource(idx)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        </div>

                    </form>
                </main>
            </div>

            <Footer />
        </div>
    );
}
