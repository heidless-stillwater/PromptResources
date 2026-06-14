'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/Icons';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Resource, Playlist } from '@/lib/types';

interface PlaylistQueueSidebarProps {
    playlistId: string;
    currentResourceId: string;
}

export default function PlaylistQueueSidebar({ playlistId, currentResourceId }: PlaylistQueueSidebarProps) {
    const router = useRouter();
    const { isDarkMode } = useTheme();
    const [playlist, setPlaylist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (playlistId) {
            fetchPlaylist();
        }
    }, [playlistId]);

    const fetchPlaylist = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/playlists/${playlistId}`, { cache: 'no-store' });
            const result = await res.json();
            if (result.success) {
                setPlaylist(result.data);
            }
        } catch (e) {
            console.error('[PlaylistQueueSidebar] Error fetching playlist:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-80 shrink-0 border rounded-[2rem] p-6 flex flex-col items-center justify-center min-h-[400px] bg-[var(--bg-secondary)]/30 border-[var(--border)] text-[var(--text-primary)]">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Loading Playlist...</span>
            </div>
        );
    }

    if (!playlist) return null;

    const resources = playlist.resources || [];
    const currentIndex = resources.findIndex((r: Resource) => r.id === currentResourceId);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < resources.length - 1;

    const prevId = hasPrev ? resources[currentIndex - 1].id : null;
    const nextId = hasNext ? resources[currentIndex + 1].id : null;

    const navigateToResource = (id: string | null) => {
        if (id) {
            router.push(`/resources/${id}?playlistId=${playlistId}`);
        }
    };

    if (isCollapsed) {
        return (
            <button 
                onClick={() => setIsCollapsed(false)}
                className="fixed right-6 bottom-6 z-40 px-5 py-3.5 bg-primary text-white rounded-full shadow-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
            >
                <Icons.list size={14} /> Show Playlist Queue ({currentIndex + 1}/{resources.length})
            </button>
        );
    }

    return (
        <div className="w-full lg:w-80 shrink-0 border rounded-[2rem] overflow-hidden flex flex-col max-h-[80vh] shadow-2xl bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)]">
            {/* Header */}
            <div className="p-5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-secondary)]/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.25em] truncate flex-1">
                        Playing Playlist
                    </span>
                    <button 
                        onClick={() => setIsCollapsed(true)} 
                        className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                        title="Minimize Queue"
                    >
                        <Icons.chevronRight size={16} />
                    </button>
                </div>
                <h4 className="text-sm font-bold truncate mb-1">{playlist.title}</h4>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest mt-3 pt-3 border-t border-[var(--border)]">
                    <span>Item {currentIndex !== -1 ? currentIndex + 1 : 0} of {resources.length}</span>
                    <div className="flex gap-1.5">
                        <button
                            disabled={!hasPrev}
                            onClick={() => navigateToResource(prevId)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] disabled:opacity-20 transition-all text-[var(--text-primary)]"
                            title="Previous Item"
                        >
                            <Icons.chevronLeft size={12} />
                        </button>
                        <button
                            disabled={!hasNext}
                            onClick={() => navigateToResource(nextId)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] disabled:opacity-20 transition-all text-[var(--text-primary)]"
                            title="Next Item"
                        >
                            <Icons.chevronRight size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Queue */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar max-h-[60vh]">
                {resources.map((res: Resource, idx: number) => {
                    const isActive = res.id === currentResourceId;
                    return (
                        <div
                            key={res.id}
                            onClick={() => navigateToResource(res.id)}
                            className={`flex gap-3 p-2.5 rounded-2xl cursor-pointer border transition-all hover:bg-[var(--bg-secondary)]/50 ${
                                isActive 
                                    ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/5' 
                                    : 'border-transparent bg-transparent'
                            }`}
                        >
                            {/* Number label */}
                            <div className={`w-6 flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isActive ? 'text-primary' : 'opacity-20'
                            }`}>
                                {idx + 1}
                            </div>
                            
                            {/* Thumbnail or Icon */}
                            <div className="w-16 aspect-video relative rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]/30 shrink-0">
                                {res.thumbnailUrl || res.youtubeVideoId ? (
                                    <img 
                                        src={res.thumbnailUrl || `https://img.youtube.com/vi/${res.youtubeVideoId}/hqdefault.jpg`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs opacity-20">
                                        📄
                                    </div>
                                )}
                            </div>

                            {/* Resource Details */}
                            <div className="flex-1 min-w-0">
                                <h5 className={`text-[11px] font-bold truncate ${
                                    isActive ? 'text-primary' : ''
                                }`}>
                                    {res.title}
                                </h5>
                                <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest mt-1">
                                    <span>{res.platform}</span>
                                    <span>•</span>
                                    <span>{res.pricing}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
