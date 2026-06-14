'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Icons } from '@/components/ui/Icons';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useRouter } from 'next/navigation';
import { clearPlaylistsCache } from '@/lib/playlists-cache';

interface AddToPlaylistModalProps {
    resourceId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function AddToPlaylistModal({ resourceId, isOpen, onClose }: AddToPlaylistModalProps) {
    const { user } = useAuth();
    const { isDarkMode } = useTheme();
    const router = useRouter();
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState('');
    const [newStatus, setNewStatus] = useState<'published' | 'private'>('private');
    const [creating, setCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmedPlaylist, setConfirmedPlaylist] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            setShowConfirmation(false);
            setConfirmedPlaylist(null);
            if (user) {
                fetchUserPlaylists();
            }
        }
    }, [isOpen, user, resourceId]);

    const fetchUserPlaylists = async () => {
        try {
            setLoading(true);
            const token = await user?.getIdToken();
            const res = await fetch('/api/playlists?userOnly=true', {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-store'
            });
            const result = await res.json();
            if (result.success) {
                setPlaylists(result.data || []);
            }
        } catch (e) {
            console.error('[AddToPlaylistModal] Error fetching user playlists:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePlaylist = async (playlist: any, isChecked: boolean) => {
        try {
            let updatedResourceIds = [...(playlist.resourceIds || [])];
            if (isChecked) {
                if (!updatedResourceIds.includes(resourceId)) {
                    updatedResourceIds.push(resourceId);
                }
            } else {
                updatedResourceIds = updatedResourceIds.filter(id => id !== resourceId);
            }

            // Update locally for immediate feedback
            setPlaylists(prev => prev.map(p => p.id === playlist.id ? { ...p, resourceIds: updatedResourceIds } : p));

            const token = await user?.getIdToken();
            const res = await fetch(`/api/playlists/${playlist.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resourceIds: updatedResourceIds })
            });
            const result = await res.json();

            // Clear cache and notify resource cards
            clearPlaylistsCache();
            window.dispatchEvent(new Event('playlists-updated'));

            // Show confirmation overlay only when the resource is successfully added
            if (isChecked && result.success) {
                setConfirmedPlaylist(playlist);
                setShowConfirmation(true);
            }
        } catch (e) {
            console.error('[AddToPlaylistModal] Error toggling playlist:', e);
            // Revert on failure
            fetchUserPlaylists();
        }
    };

    const handleCreatePlaylist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        try {
            setCreating(true);
            const token = await user?.getIdToken();
            const res = await fetch('/api/playlists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    status: newStatus,
                    resourceIds: [resourceId]
                })
            });
            const result = await res.json();
            if (result.success) {
                setNewTitle('');
                setNewStatus('private');
                setShowCreateForm(false);
                
                // Clear cache and notify resource cards
                clearPlaylistsCache();
                window.dispatchEvent(new Event('playlists-updated'));

                // Show confirmation overlay for the newly created playlist
                setConfirmedPlaylist(result.data);
                setShowConfirmation(true);

                fetchUserPlaylists();
            }
        } catch (e) {
            console.error('[AddToPlaylistModal] Error creating playlist:', e);
        } finally {
            setCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-[2rem] border p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)]"
            >
                
                {/* Confirmation Overlay */}
                {showConfirmation && confirmedPlaylist && (
                    <div className="absolute inset-0 z-30 bg-[var(--bg-primary)]/95 backdrop-blur-md flex flex-col justify-center p-6 animate-in fade-in duration-200">
                        <div className="text-center space-y-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-500">
                                <Icons.check size={24} />
                            </div>
                            
                            <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Successfully Added</h4>
                                <p className="text-[10px] text-[var(--text-muted)] px-4 leading-relaxed">
                                    Resource has been assigned to playlist <span className="font-bold text-[var(--text-primary)]">"{confirmedPlaylist.title}"</span>.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 pt-4 px-2">
                                <button
                                    onClick={() => {
                                        router.push(`/resources/${resourceId}?playlistId=${confirmedPlaylist.id}`);
                                        onClose();
                                    }}
                                    className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Icons.play size={12} /> Open Resource
                                </button>
                                
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <button
                                        onClick={() => {
                                            setShowConfirmation(false);
                                            setConfirmedPlaylist(null);
                                        }}
                                        className="py-3 border border-[var(--border)] bg-[var(--bg-secondary)]/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/60 transition-all"
                                    >
                                        Continue
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="py-3 border border-emerald-500/20 bg-emerald-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/20 transition-all"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-4 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Save to Playlist</span>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        <Icons.close size={18} />
                    </button>
                </div>

                {/* Content — shows 4 rows then scrolls */}
                <div className="overflow-y-auto pr-1 space-y-4 py-2 custom-scrollbar" style={{ maxHeight: '272px' }}>
                    {loading ? (
                        <div className="py-12 flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Loading playlists...</span>
                        </div>
                    ) : playlists.length === 0 && !showCreateForm ? (
                        <div className="py-12 text-center">
                            <p className="text-xs font-semibold text-[var(--text-muted)] italic mb-4">No playlists discovered.</p>
                            <button 
                                onClick={() => setShowCreateForm(true)}
                                className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                            >
                                Create First Playlist
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {playlists.map((playlist) => {
                                const isChecked = (playlist.resourceIds || []).includes(resourceId);
                                return (
                                    <label 
                                        key={playlist.id} 
                                        className={`flex items-center gap-4 p-3 border rounded-2xl cursor-pointer transition-all hover:bg-[var(--bg-secondary)]/50 select-none ${
                                            isChecked ? 'border-primary/45 bg-primary/5' : 'border-[var(--border)] bg-[var(--bg-secondary)]/30'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => handleTogglePlaylist(playlist, e.target.checked)}
                                            className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-primary)] text-primary focus:ring-0 cursor-pointer accent-primary"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold truncate">{playlist.title}</div>
                                            <div className="text-[8px] font-black text-[var(--text-muted)] opacity-70 uppercase tracking-widest mt-1 flex items-center gap-2">
                                                <span>{playlist.status}</span>
                                                <span className="opacity-30">•</span>
                                                <span>{playlist.resourceIds?.length || 0} Assets</span>
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Create Playlist Form Inline */}
                <div className="shrink-0 pt-4 border-t border-[var(--border)] mt-4">
                    {showCreateForm ? (
                        <form onSubmit={handleCreatePlaylist} className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-2">
                                <label className="text-[8px] font-black uppercase tracking-widest pl-1 text-[var(--text-muted)]">Playlist Name</label>
                                <input 
                                    type="text"
                                    required
                                    placeholder="Enter title..."
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-10 px-4 text-xs font-semibold outline-none focus:border-primary/50 transition-all text-[var(--text-primary)]"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-0.5">
                                    <button 
                                        type="button" 
                                        onClick={() => setNewStatus('private')}
                                        className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${newStatus === 'private' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Private
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setNewStatus('published')}
                                        className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${newStatus === 'published' ? 'bg-primary text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Public
                                    </button>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCreateForm(false)}
                                        className="px-4 py-2 border border-[var(--border)] rounded-xl text-[9px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={creating}
                                        className="px-4 py-2 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {creating ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <button 
                            onClick={() => setShowCreateForm(true)}
                            className="w-full h-11 flex items-center justify-center gap-2 border border-dashed border-[var(--border)] hover:border-primary/30 rounded-2xl text-[9px] font-black uppercase tracking-widest text-primary transition-all"
                        >
                            <Icons.plus size={12} /> Create New Playlist
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
