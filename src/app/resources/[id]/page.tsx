'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getYouTubeEmbedUrl, extractYouTubeId, isYouTubeUrl, isGenericYouTubeName, deduplicateAttributions } from '@/lib/youtube';
import { getDefaultCategories } from '@/lib/suggestions';
import Modal from '@/components/Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Rating from '@/components/Rating';
import CommentSection from '@/components/CommentSection';
import ThumbnailPicker from '@/components/ThumbnailPicker';
import { Icons } from '@/components/ui/Icons';

export default function ResourceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAdmin, activeRole } = useAuth();
    const queryClient = useQueryClient();
    const [deleting, setDeleting] = useState(false);
    const [copyStatus, setCopyStatus] = useState('Copy Link');
    const [shareOpen, setShareOpen] = useState(false);
    const shareRef = useRef<HTMLDivElement>(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [initialNoteContent, setInitialNoteContent] = useState('');
    const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [noteMessage, setNoteMessage] = useState({ type: '', text: '' });
    const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // In-place Notes Editing State
    const [isEditingPublicNotes, setIsEditingPublicNotes] = useState(false);
    const [tempPublicNotes, setTempPublicNotes] = useState('');
    const [isEditingAdminNotes, setIsEditingAdminNotes] = useState(false);
    const [tempAdminNotes, setTempAdminNotes] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const [isEditingPrompts, setIsEditingPrompts] = useState(false);
    const [tempPrompts, setTempPrompts] = useState('');
    const [isEditingRank, setIsEditingRank] = useState(false);
    const [tempRank, setTempRank] = useState<string>('');

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText: string;
        isDanger?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    // Link Extraction State
    const [isLinkSelectionOpen, setIsLinkSelectionOpen] = useState(false);
    const [extractedLinks, setExtractedLinks] = useState<{ url: string; title: string }[]>([]);
    const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
    const [isExtracting, setIsExtracting] = useState(false);

    // Generic URL Extraction State
    const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
    const [extractUrl, setExtractUrl] = useState('');

    const resourceId = params.id as string;

    // Fetch Resource
    const { data: resource, isLoading: resourceLoading } = useQuery({
        queryKey: ['resource', resourceId],
        queryFn: async () => {
            const response = await fetch(`/api/resources/${resourceId}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            const data = result.data;
            return {
                ...data,
                createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
            } as Resource;
        }
    });

    // Check if saved
    const { data: isSaved = false } = useQuery({
        queryKey: ['resource-saved-status', resourceId, user?.uid],
        queryFn: async () => {
            if (!user) return false;
            const response = await fetch(`/api/user-resources?uid=${user.uid}`);
            const result = await response.json();
            if (!result.success) return false;
            return result.data.savedResources?.includes(resourceId) || false;
        },
        enabled: !!user,
    });

    // Fetch User Note
    const { data: noteData } = useQuery({
        queryKey: ['user-note', resourceId, user?.uid],
        queryFn: async () => {
            if (!user) return null;
            const response = await fetch(`/api/user-notes/${resourceId}?uid=${user.uid}`);
            const result = await response.json();
            if (result.success && result.data.content) {
                return result.data.content;
            }
            return null;
        },
        enabled: !!user,
    });

    useEffect(() => {
        if (noteData) {
            setNoteContent(noteData);
            setInitialNoteContent(noteData);
        }
    }, [noteData]);

    const loading = resourceLoading;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
                setShareOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSave = async () => {
        if (!user) return router.push('/auth/login');
        try {
            const response = await fetch('/api/user-resources', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    resourceId,
                    action: isSaved ? 'unsave' : 'save'
                }),
            });

            const result = await response.json();
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['resource-saved-status', resourceId, user.uid] });
                queryClient.invalidateQueries({ queryKey: ['user-resources', user.uid] });
            }
        } catch (error) {
            console.error('Error updating saved status:', error);
        }
    };

    const handleDelete = async () => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Resource',
            message: 'Are you sure you want to delete this resource? This action cannot be undone.',
            confirmText: 'Delete',
            isDanger: true,
            onConfirm: async () => {
                setDeleting(true);
                try {
                    const token = await user?.getIdToken();
                    const response = await fetch(`/api/resources/${resourceId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    const result = await response.json();
                    if (result.success) {
                        sessionStorage.setItem('deletedResourceId', resourceId);
                        router.back();
                    } else {
                        throw new Error(result.error || 'Failed to delete resource');
                    }
                } catch (error: any) {
                    console.error('Error deleting resource:', error);
                    alert(error.message || 'Error deleting resource');
                    setDeleting(false);
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleCopyLink = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopyStatus('Copied! ✅');
            setTimeout(() => {
                setCopyStatus('Copy Link');
                setShareOpen(false);
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            setCopyStatus('Error ❌');
        });
    };

    const handleShareTwitter = () => {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(`Check out this resource: ${resource?.title}`);
        window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
        setShareOpen(false);
    };

    const handleShareLinkedIn = () => {
        const url = encodeURIComponent(window.location.href);
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
        setShareOpen(false);
    };

    const [isTagInputOpen, setIsTagInputOpen] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [isCategoryInputOpen, setIsCategoryInputOpen] = useState(false);
    const allCategories = getDefaultCategories();

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!isAdmin && resource?.addedBy !== user?.uid) return;
        if (!resource) return;

        setConfirmModal({
            isOpen: true,
            title: 'Remove Tag',
            message: `Are you sure you want to remove the tag "#${tagToRemove}"?`,
            confirmText: 'Remove',
            isDanger: true,
            onConfirm: async () => {
                const updatedTags = resource.tags?.filter(t => t !== tagToRemove) || [];
                try {
                    const token = await user?.getIdToken();
                    const response = await fetch(`/api/resources/${resourceId}`, {
                        method: 'PATCH',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ tags: updatedTags }),
                    });
                    const result = await response.json();
                    if (result.success) {
                        queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                        router.refresh();
                    }
                } catch (error) {
                    console.error('Error removing tag:', error);
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleAddTag = async () => {
        if (!newTag.trim() || !resource) return;
        if (!isAdmin && resource?.addedBy !== user?.uid) return;

        const currentTags = resource.tags || [];
        if (currentTags.includes(newTag.trim())) {
            setIsTagInputOpen(false);
            setNewTag('');
            return;
        }

        const updatedTags = [...currentTags, newTag.trim()];
        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tags: updatedTags }),
            });
            const result = await response.json();
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                router.refresh();
                setIsTagInputOpen(false);
                setNewTag('');
            }
        } catch (error) {
            console.error('Error adding tag:', error);
        }
    };

    const handleRemoveCategory = async (catToRemove: string) => {
        if (!isAdmin && resource?.addedBy !== user?.uid) return;
        if (!resource) return;

        setConfirmModal({
            isOpen: true,
            title: 'Remove Category',
            message: `Are you sure you want to remove the category "${catToRemove}"?`,
            confirmText: 'Remove',
            isDanger: true,
            onConfirm: async () => {
                const updatedCats = resource.categories?.filter(c => c !== catToRemove) || [];
                try {
                    const token = await user?.getIdToken();
                    const response = await fetch(`/api/resources/${resourceId}`, {
                        method: 'PATCH',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ categories: updatedCats }),
                    });
                    const result = await response.json();
                    if (result.success) {
                        queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                        router.refresh();
                    }
                } catch (error) {
                    console.error('Error removing category:', error);
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleAddCategory = async (cat: string) => {
        if (!cat || !resource) return;
        if (!isAdmin && resource?.addedBy !== user?.uid) return;

        const currentCats = resource.categories || [];
        if (currentCats.includes(cat)) {
            setIsCategoryInputOpen(false);
            return;
        }

        const updatedCats = [...currentCats, cat];
        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ categories: updatedCats }),
            });
            const result = await response.json();
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                router.refresh();
                setIsCategoryInputOpen(false);
            }
        } catch (error) {
            console.error('Error adding category:', error);
        }
    };

    const PRICING_OPTIONS = ['free', 'paid', 'freemium'];
    const PLATFORM_OPTIONS = ['gemini', 'nanobanana', 'chatgpt', 'claude', 'midjourney', 'general', 'other'];
    const TYPE_OPTIONS = ['video', 'article', 'tool', 'course', 'book', 'tutorial', 'other'];
    const MEDIA_OPTIONS = ['youtube', 'webpage', 'pdf', 'image', 'audio', 'other'];

    const handleUpdateField = async (field: string, value: any) => {
        if (!isAdmin && resource?.addedBy !== user?.uid) return;

        // Optimistic update
        const previousResource = queryClient.getQueryData(['resource', resourceId]);
        queryClient.setQueryData(['resource', resourceId], (old: any) => ({
            ...old,
            [field]: value
        }));

        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ [field]: value }),
            });
            const result = await response.json();
            if (!result.success) {
                // Revert on failure
                queryClient.setQueryData(['resource', resourceId], previousResource);
                console.error(`Error updating ${field}:`, result.error);
            } else {
                // Ensure data stays fresh on success
                queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                queryClient.invalidateQueries({ queryKey: ['resources'] });
                router.refresh();
            }
        } catch (error) {
            // Revert on error
            queryClient.setQueryData(['resource', resourceId], previousResource);
            console.error(`Error updating ${field}:`, error);
        }
    };

    const handleShareEmail = () => {
        const subject = encodeURIComponent(`Resource: ${resource?.title}`);
        const body = encodeURIComponent(`Check out this resource on PromptResources: ${window.location.href}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        setShareOpen(false);
    };

    const handleSaveNote = async () => {
        if (!user || !resource) return;
        setIsSavingNote(true);
        setNoteMessage({ type: '', text: '' });
        try {
            const response = await fetch(`/api/user-notes/${resourceId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, content: noteContent }),
            });
            const result = await response.json();
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['user-note', resourceId, user.uid] });
                setNoteMessage({ type: 'success', text: 'Note saved successfully!' });
                setTimeout(() => setIsNoteModalOpen(false), 1500);
            } else {
                setNoteMessage({ type: 'error', text: result.error || 'Failed to save note.' });
            }
        } catch (error) {
            console.error('Error saving note:', error);
            setNoteMessage({ type: 'error', text: 'An unexpected error occurred.' });
        } finally {
            setIsSavingNote(false);
        }
    };

    const insertMarkdown = (prefix: string, suffix: string = '') => {
        if (!noteTextareaRef.current) return;
        const textarea = noteTextareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
        setNoteContent(newText);

        // Focus back and set cursor pos
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    const extractYouTubeLinks = async () => {
        // Find YouTube link in content or resource URL
        let videoId = resource?.youtubeVideoId;

        if (!videoId && resource?.url) {
            videoId = extractYouTubeId(resource.url) || undefined;
        }

        // Also check note content for youtube links if not found in resource
        if (!videoId) {
            const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
            const match = noteContent.match(ytRegex);
            if (match) {
                videoId = match[1];
            }
        }

        if (!videoId) {
            alert('No YouTube video found in this resource or note.');
            return;
        }

        setIsExtracting(true);
        try {
            const response = await fetch(`/api/youtube/extract?videoId=${videoId}`);
            const result = await response.json();

            if (result.success && result.data.links.length > 0) {
                setExtractedLinks(result.data.links);
                setSelectedLinks(new Set(result.data.links.map((l: any) => l.url))); // Select all by default
                setIsLinkSelectionOpen(true);
            } else {
                alert('No links found in the video description.');
            }
        } catch (error) {
            console.error('Error extracting links:', error);
            alert('Failed to extract links. Please try again.');
        } finally {
            setIsExtracting(false);
        }
    };

    const extractLinksFromUrl = async () => {
        if (!extractUrl.trim()) {
            alert('Please enter a URL.');
            return;
        }

        // Validate URL
        try {
            new URL(extractUrl);
        } catch {
            alert('Please enter a valid URL (starting with http:// or https://).');
            return;
        }

        setIsExtracting(true);
        setIsUrlInputOpen(false);
        try {
            const response = await fetch(`/api/links/extract?url=${encodeURIComponent(extractUrl)}`);
            const result = await response.json();

            if (result.success && result.data.links.length > 0) {
                setExtractedLinks(result.data.links);
                setSelectedLinks(new Set(result.data.links.map((l: any) => l.url)));
                setIsLinkSelectionOpen(true);
            } else {
                alert(result.error || 'No links found on that page.');
            }
        } catch (error) {
            console.error('Error extracting links:', error);
            alert('Failed to extract links. Please try again.');
        } finally {
            setIsExtracting(false);
            setExtractUrl('');
        }
    };

    const toggleLinkSelection = (link: string) => {
        const newSelected = new Set(selectedLinks);
        if (newSelected.has(link)) {
            newSelected.delete(link);
        } else {
            newSelected.add(link);
        }
        setSelectedLinks(newSelected);
    };

    const insertSelectedLinks = () => {
        if (selectedLinks.size === 0) return;

        const linksText = extractedLinks
            .filter(link => selectedLinks.has(link.url))
            .map(link => `- [${link.title || 'Link'}](${link.url})`)
            .join('\n');

        insertMarkdown('\n' + linksText + '\n');
        setIsLinkSelectionOpen(false);
        setExtractedLinks([]);
    };

    if (loading) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                    <div className="loading-text">Loading resource...</div>
                </div>
            </div>
        );
    }

    if (!resource) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="main-content">
                    <div className="container">
                        <div className="empty-state">
                            <div className="empty-state-icon">🔍</div>
                            <div className="empty-state-title">Resource not found</div>
                            <Link href="/resources" className="btn btn-primary">
                                ← Back to Resources
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const r = resource as Resource;
    const ytId = r.youtubeVideoId || (r.mediaFormat === 'youtube' ? extractYouTubeId(r.url) : null);

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] text-white">
            <Navbar />
            
            {/* ── CINEMATIC HERO COVER ── */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer (Blurred Telemetry) */}
                <div className="absolute inset-0 z-0">
                    {r.thumbnailUrl || r.youtubeVideoId ? (
                        <div className="relative w-full h-full">
                            <img 
                                src={r.thumbnailUrl || `https://img.youtube.com/vi/${r.youtubeVideoId}/maxresdefault.jpg`} 
                                alt="" 
                                className="w-full h-full object-cover scale-110 blur-3xl opacity-20" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/40 via-[#0a0a0f]/80 to-[#0a0a0f]" />
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-[#0a0a0f] to-[#0a0a0f]" />
                    )}
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    {/* Header Pathing */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <div className="flex items-center gap-4">
                            <Link href="/resources" className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all group">
                                <Icons.arrowLeft size={20} className="text-white/40 group-hover:text-indigo-400 group-hover:-translate-x-1 transition-all" />
                            </Link>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Assets
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                    <span className="text-indigo-400/60 uppercase">Resource Detail</span>
                                    <span className="opacity-20">/</span>
                                    <span className="truncate max-w-[200px]">{r.title}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleSave}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                                    isSaved 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {isSaved ? '★ Saved to Library' : '☆ Save Asset'}
                            </button>
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <button onClick={() => setShareOpen(!shareOpen)} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all">
                                <Icons.share size={18} />
                                {shareOpen && (
                                    <div className="absolute top-full right-0 mt-4 z-50 share-menu animate-in fade-in slide-in-from-top-2">
                                        <button className="share-menu-item" onClick={handleCopyLink}>
                                            {copyStatus === 'Copy Link' ? '🔗 ' + copyStatus : '✅ ' + copyStatus}
                                        </button>
                                        <button className="share-menu-item" onClick={handleShareTwitter}>🐦 X / Twitter</button>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Identity Glass Card */}
                    <div className="glass-card p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row gap-10">
                            {/* Visual Representative */}
                            <div className="w-full md:w-[480px] aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black/40 shadow-inner group/media relative">
                                {ytId ? (
                                    <iframe
                                        src={getYouTubeEmbedUrl(ytId)}
                                        title={r.title}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : r.thumbnailUrl ? (
                                    <img src={r.thumbnailUrl} alt={r.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-white/10">
                                        <Icons.database size={64} strokeWidth={1} />
                                        <span className="text-[10px] font-black uppercase tracking-widest mt-4">Static Documentation</span>
                                    </div>
                                )}
                                {(isAdmin || (user && r.addedBy === user.uid)) && (
                                    <button 
                                        onClick={() => setIsPickerOpen(true)}
                                        className="absolute bottom-4 right-4 p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-white/40 hover:text-white opacity-0 group-hover/media:opacity-100 transition-all"
                                    >
                                        <Icons.edit size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Textual Identity */}
                            <div className="flex-1 flex flex-col py-2">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest`}>
                                        {r.type}
                                    </span>
                                    {r.isFavorite && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                            <Icons.sparkles size={10} /> Featured
                                        </div>
                                    )}
                                </div>

                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4 leading-none">
                                    {r.title}
                                </h1>

                                <div className="flex flex-wrap items-center gap-6 mb-8 text-white/40">
                                    <div className="flex items-center gap-3">
                                        <Rating value={r.averageRating || 0} count={r.reviewCount || 0} />
                                    </div>
                                    <div className="h-4 w-px bg-white/10" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🌐</span>
                                        <span className="text-xs font-black uppercase tracking-widest">{r.platform}</span>
                                    </div>
                                    <div className="h-4 w-px bg-white/10" />
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                                            r.pricing === 'free' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 
                                            r.pricing === 'paid' ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' : 
                                            'border-indigo-500/20 text-indigo-400 bg-indigo-500/5'
                                        }`}>
                                            {r.pricing}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-auto flex gap-4">
                                    <a 
                                        href={r.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 md:flex-none px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20"
                                    >
                                        Execute Command <Icons.external size={18} />
                                    </a>
                                    
                                    {(isAdmin || (user && r.addedBy === user.uid)) && (
                                        <Link href={`/resources/${r.id}/edit`} className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 hover:text-white">
                                            <Icons.edit size={20} />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="main-content -mt-28 overflow-visible">
                <main className="container mx-auto px-4 pt-0 pb-20 relative z-30">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Main Stream */}
                        <div className="lg:col-span-2 space-y-10">
                                <div className="bg-[#12121e]/90 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group mb-8">
                                    <div className="absolute top-0 right-0 p-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700"></div>
                                {isEditingTitle ? (
                                    <div className="animate-in fade-in zoom-in duration-200" style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            value={tempTitle}
                                            onChange={(e) => setTempTitle(e.target.value)}
                                            autoFocus
                                            style={{ fontSize: '2rem', fontWeight: 800, padding: 'var(--space-4)', background: 'var(--bg-input)' }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateField('title', tempTitle);
                                                    setIsEditingTitle(false);
                                                } else if (e.key === 'Escape') {
                                                    setIsEditingTitle(false);
                                                }
                                            }}
                                        />
                                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                                            <button 
                                                className="btn btn-primary btn-sm"
                                                onClick={async () => {
                                                    await handleUpdateField('title', tempTitle);
                                                    setIsEditingTitle(false);
                                                }}
                                            >
                                                Save Title
                                            </button>
                                            <button 
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setIsEditingTitle(false)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent flex items-center gap-4 mb-4">
                                        {(r.isFavorite || isAdmin || (user && r.addedBy === user.uid)) && (
                                            <span 
                                                title={r.isFavorite ? "Featured Resource (Click to unfeature)" : "Feature this resource"}
                                                onClick={(e) => {
                                                    if (isAdmin || (user && r.addedBy === user.uid)) {
                                                        e.stopPropagation();
                                                        handleUpdateField('isFavorite', !r.isFavorite);
                                                    }
                                                }}
                                                style={{ 
                                                    cursor: (isAdmin || (user && r.addedBy === user.uid)) ? 'pointer' : 'default',
                                                    opacity: r.isFavorite ? 1 : 0.3,
                                                    filter: r.isFavorite ? 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.5))' : 'grayscale(100%)',
                                                    transition: 'all 0.2s ease',
                                                }}
                                                className="hover:scale-110"
                                            >
                                                ⭐
                                            </span>
                                        )}
                                        <span
                                            style={{ cursor: (isAdmin || (user && r.addedBy === user.uid)) ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
                                            onClick={() => {
                                                if (isAdmin || (user && r.addedBy === user.uid)) {
                                                    setIsEditingTitle(true);
                                                    setTempTitle(r.title);
                                                }
                                            }}
                                        >
                                            {r.title}
                                            {(isAdmin || (user && r.addedBy === user.uid)) && (
                                                <span style={{ fontSize: '14px', marginLeft: 'var(--space-2)' }}>✏️</span>
                                            )}
                                        </span>
                                        {isEditingRank ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: 'var(--space-2)' }}>
                                                <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Quick Select Priority</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                                    {[1, 5, 10, 25, 50, 100].map(val => (
                                                        <button 
                                                            key={val}
                                                            className={`btn btn-sm ${parseInt(tempRank) === val ? 'btn-primary' : 'btn-secondary'}`}
                                                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 'bold' }}
                                                            onClick={() => setTempRank(val.toString())}
                                                        >
                                                            Top {val}
                                                        </button>
                                                    ))}
                                                </div>
                                                
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                    <button 
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                                                        onClick={() => setTempRank(Math.max(1, (parseInt(tempRank) || 2) - 1).toString())}
                                                    >
                                                        -
                                                    </button>
                                                    <input 
                                                        type="number" 
                                                        className="form-input" 
                                                        style={{ width: '80px', height: '36px', padding: '0', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }} 
                                                        value={tempRank} 
                                                        onChange={(e) => setTempRank(e.target.value)} 
                                                        placeholder="Rank"
                                                        autoFocus
                                                    />
                                                    <button 
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                                                        onClick={() => setTempRank(((parseInt(tempRank) || 0) + 1).toString())}
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border)' }}>
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={async () => {
                                                            const numRank = parseInt(tempRank);
                                                            await handleUpdateField('rank', isNaN(numRank) ? null : numRank);
                                                            setIsEditingRank(false);
                                                        }}
                                                    >
                                                        Save Rank
                                                    </button>
                                                    <button 
                                                        className="btn btn-secondary btn-sm" 
                                                        onClick={() => setIsEditingRank(false)}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ marginLeft: 'auto' }}
                                                        onClick={() => setTempRank('')}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <span 
                                                className="detail-rank" 
                                                style={{ cursor: (isAdmin || (user && r.addedBy === user.uid)) ? 'pointer' : 'default', padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)' }}
                                                onClick={() => {
                                                    if (isAdmin || (user && r.addedBy === user.uid)) {
                                                        setIsEditingRank(true);
                                                        setTempRank(r.rank ? r.rank.toString() : '');
                                                    }
                                                }}
                                                title={(isAdmin || (user && r.addedBy === user.uid)) ? "Click to set priority rank" : ""}
                                            >
                                                {(isAdmin || (user && r.addedBy === user.uid)) && !r.rank ? 'Set Ranking' : `Rank #${r.rank}`}
                                            </span>
                                        )}
                                    </h1>
                                )}
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                    <Rating value={r.averageRating || 0} count={r.reviewCount || 0} />
                                </div>

                                <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-white/10">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setIsNoteModalOpen(true)}
                                        id="open-notes"
                                    >
                                        {noteContent ? '📝 Edit Note' : '➕ Add Note'}
                                    </button>

                                    {(isAdmin || (user && r.addedBy === user.uid)) && (
                                        <>
                                            <Link href={`/resources/${r.id}/edit`} className="btn btn-secondary" id="edit-resource-top">
                                                ✏️ Edit
                                            </Link>
                                            <button
                                                className="btn btn-danger"
                                                onClick={handleDelete}
                                                disabled={deleting}
                                                id="delete-resource-top"
                                                title="Delete Resource"
                                                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                                            >
                                                {deleting ? '...' : '🗑 Delete'}
                                            </button>
                                        </>
                                    )}

                                    <div style={{ position: 'relative' }} ref={shareRef}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setShareOpen(!shareOpen)}
                                            id="share-resource"
                                        >
                                            📤 Share
                                        </button>

                                        {shareOpen && (
                                            <div className="share-menu">
                                                <button className="share-menu-item" onClick={handleCopyLink}>
                                                    {copyStatus === 'Copy Link' ? '🔗 ' + copyStatus : '✅ ' + copyStatus}
                                                </button>
                                                <button className="share-menu-item" onClick={handleShareTwitter}>
                                                    🐦 Share on X
                                                </button>
                                                <button className="share-menu-item" onClick={handleShareLinkedIn}>
                                                    💼 Share on LinkedIn
                                                </button>
                                                <button className="share-menu-item" onClick={handleShareEmail}>
                                                    ✉️ Share via Email
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                             <div className="bg-[#12121e]/50 border border-white/5 rounded-3xl p-6 md:p-8 mb-8 hover:bg-[#12121e]/70 transition-colors">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">📄</div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/50">Technical Description</h3>
                                </div>
                                <div className="text-white/70 leading-loose text-sm">
                                    {r.description}
                                </div>
                            </div>

                            {/* Recommended Nanobanana Prompt (Editable in-place) */}
                            {(r.prompts && r.prompts.length > 0 || isAdmin || (user && r.addedBy === user.uid)) && (
                                <div className="detail-section animate-fade-in group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 className="detail-section-title">🚀 Recommended Nanobanana Prompt</h3>
                                        {(isAdmin || (user && r.addedBy === user.uid)) && !isEditingPrompts && (
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button 
                                                    className="btn btn-secondary btn-sm transition-opacity"
                                                    onClick={() => {
                                                        setIsEditingPrompts(true);
                                                        setTempPrompts(r.prompts?.join('\n') || '');
                                                    }}
                                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                                >
                                                    ✏️ Edit Prompt
                                                </button>
                                                {r.prompts && r.prompts.length > 0 && (
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(r.prompts?.join('\n') || '');
                                                            alert('Prompt copied!');
                                                        }}
                                                        style={{ padding: '2px 8px', fontSize: '10px' }}
                                                    >
                                                        📋 Copy
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="glass-card" style={{ padding: 'var(--space-5)', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--accent-primary)', boxShadow: 'var(--shadow-glow-sm)' }}>
                                        {isEditingPrompts ? (
                                            <div className="animate-in fade-in zoom-in duration-200">
                                                <textarea
                                                    className="form-textarea"
                                                    value={tempPrompts}
                                                    onChange={(e) => setTempPrompts(e.target.value)}
                                                    placeholder="Paste scenario prompts here (one per line)..."
                                                    rows={6}
                                                    autoFocus
                                                    style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', lineHeight: '1.6' }}
                                                />
                                                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                                    <button 
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setIsEditingPrompts(false)}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={async () => {
                                                            const promptsArray = tempPrompts.split('\n').map(p => p.trim()).filter(Boolean);
                                                            await handleUpdateField('prompts', promptsArray);
                                                            setIsEditingPrompts(false);
                                                        }}
                                                    >
                                                        Save Prompt
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 'var(--text-sm)', lineHeight: '1.6', color: 'var(--accent-300)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                                                {r.prompts && r.prompts.length > 0 ? (
                                                    r.prompts.join('\n')
                                                ) : (isAdmin || (user && r.addedBy === user.uid)) ? (
                                                    <em style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => {
                                                        setIsEditingPrompts(true);
                                                        setTempPrompts('');
                                                    }}>Add scenario prompts for this r...</em>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {r.pricingDetails && (
                                <div className="detail-section">
                                    <h3 className="detail-section-title">Licensing & Cost</h3>
                                    <div className="glass-card" style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', borderStyle: 'dashed' }}>
                                        {r.pricingDetails}
                                    </div>
                                </div>
                            )}

                            {/* Public Notes (Editable in-place) */}
                            <div className="detail-section animate-fade-in group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 className="detail-section-title">📖 Important Notes & Instructions</h3>
                                    {(isAdmin || (user && r.addedBy === user.uid)) && !isEditingPublicNotes && (
                                        <button 
                                            className="btn btn-secondary btn-sm transition-opacity"
                                            onClick={() => {
                                                setIsEditingPublicNotes(true);
                                                setTempPublicNotes(r.notes || '');
                                            }}
                                            style={{ padding: '2px 8px', fontSize: '10px' }}
                                        >
                                            ✏️ Edit
                                        </button>
                                    )}
                                </div>
                                <div className="glass-card" style={{ padding: 'var(--space-5)', background: 'var(--bg-secondary)', borderLeft: '3px solid var(--primary-light)' }}>
                                    {isEditingPublicNotes ? (
                                        <div className="animate-in fade-in zoom-in duration-200">
                                            <textarea
                                                className="form-textarea"
                                                value={tempPublicNotes}
                                                onChange={(e) => setTempPublicNotes(e.target.value)}
                                                placeholder="Publicly visible notes..."
                                                rows={4}
                                                autoFocus
                                                style={{ fontSize: 'var(--text-sm)' }}
                                            />
                                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                                <button 
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setIsEditingPublicNotes(false)}
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    className="btn btn-primary btn-sm"
                                                    onClick={async () => {
                                                        await handleUpdateField('notes', tempPublicNotes);
                                                        setIsEditingPublicNotes(false);
                                                    }}
                                                >
                                                    Save Changes
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 'var(--text-sm)', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                            {r.notes ? (
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }} />
                                                    }}
                                                >
                                                    {r.notes}
                                                </ReactMarkdown>
                                            ) : (isAdmin || (user && r.addedBy === user.uid)) ? (
                                                <em style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => {
                                                    setIsEditingPublicNotes(true);
                                                    setTempPublicNotes('');
                                                }}>Add public notes or instructions...</em>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Internal Admin Notes (Editable in-place) */}
                            {(isAdmin || (user && r.addedBy === user.uid)) && (
                                <div className="detail-section animate-fade-in group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 className="detail-section-title">🔒 Internal Curator Notes</h3>
                                        {!isEditingAdminNotes && (
                                            <button 
                                                className="btn btn-secondary btn-sm transition-opacity"
                                                onClick={() => {
                                                    setIsEditingAdminNotes(true);
                                                    setTempAdminNotes(r.adminNotes || '');
                                                }}
                                                style={{ padding: '2px 8px', fontSize: '10px' }}
                                            >
                                                ✏️ Edit
                                            </button>
                                        )}
                                    </div>
                                    <div className="glass-card" style={{ padding: 'var(--space-5)', background: 'rgba(249, 115, 22, 0.05)', border: '1px dashed var(--accent-orange)' }}>
                                        {isEditingAdminNotes ? (
                                            <div className="animate-in fade-in zoom-in duration-200">
                                                <textarea
                                                    className="form-textarea"
                                                    value={tempAdminNotes}
                                                    onChange={(e) => setTempAdminNotes(e.target.value)}
                                                    placeholder="Internal curator notes..."
                                                    rows={3}
                                                    autoFocus
                                                    style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
                                                />
                                                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                                    <button 
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setIsEditingAdminNotes(false)}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={async () => {
                                                            await handleUpdateField('adminNotes', tempAdminNotes);
                                                            setIsEditingAdminNotes(false);
                                                        }}
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 'var(--text-xs)', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                                                {r.adminNotes ? (
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-orange)', textDecoration: 'underline' }} />
                                                        }}
                                                    >
                                                        {r.adminNotes}
                                                    </ReactMarkdown>
                                                ) : (
                                                    <em style={{ cursor: 'pointer' }} onClick={() => {
                                                        setIsEditingAdminNotes(true);
                                                        setTempAdminNotes('');
                                                    }}>Add internal notes...</em>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {noteContent && (
                                <div className="detail-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                        <h3 className="detail-section-title" style={{ margin: 0 }}>My Private Notes</h3>
                                        <button 
                                            className="btn btn-secondary btn-sm" 
                                            onClick={() => setIsNoteModalOpen(true)}
                                            style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)' }}
                                        >
                                            ✏️ Edit
                                        </button>
                                    </div>
                                    <div className="glass-card" style={{ padding: 'var(--space-6)', borderLeft: '4px solid var(--accent-primary)', background: 'var(--bg-secondary)' }}>
                                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }} />
                                                }}
                                            >
                                                {noteContent}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Community Section */}
                            <CommentSection resourceId={resourceId} />
                        </div>

                        {/* Sidebar */}
                        <aside className="space-y-10">
                            {/* Access Control */}
                            <div className="glass-card p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <Icons.external size={16} />
                                    </div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Access Protocol</h3>
                                </div>
                                
                                <a 
                                    href={r.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group/link mb-4"
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="min-w-0">
                                            <div className="text-white font-bold truncate">{new URL(r.url).hostname}</div>
                                            <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Direct Interface</div>
                                        </div>
                                        <Icons.external size={16} className="text-white/20 group-hover/link:text-indigo-400 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-all" />
                                    </div>
                                </a>

                                <button
                                    onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(r.url); alert('URL Copied!'); }}
                                    className="w-full py-3 bg-black/20 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
                                >
                                    📋 Copy Interface URL
                                </button>
                            </div>

                            {/* Classification */}
                            <div className="glass-card p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <Icons.rows size={16} />
                                    </div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Classification</h3>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex flex-wrap gap-2">
                                        {(isAdmin || (user && r.addedBy === user.uid)) ? (
                                            <>
                                                <select 
                                                    className={`px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-[10px] font-bold text-indigo-400/80 outline-none cursor-pointer hover:bg-indigo-500/10 transition-all appearance-none`}
                                                    value={r.pricing} 
                                                    onChange={(e) => handleUpdateField('pricing', e.target.value)}
                                                >
                                                    {['free', 'paid', 'freemium', 'enterprise'].map(opt => <option key={opt} value={opt} className="bg-[#0a0a0f]">{opt.toUpperCase()}</option>)}
                                                </select>
                                                <select 
                                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/60 outline-none cursor-pointer hover:bg-white/10 transition-all appearance-none"
                                                    value={r.platform} 
                                                    onChange={(e) => handleUpdateField('platform', e.target.value)}
                                                >
                                                    {['web', 'ios', 'android', 'macos', 'windows', 'multi'].map(opt => <option key={opt} value={opt} className="bg-[#0a0a0f]">{opt.toUpperCase()}</option>)}
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-[10px] font-bold text-indigo-400/80 uppercase`}>{r.pricing}</span>
                                                <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/60 uppercase">{r.platform}</span>
                                            </>
                                        )}
                                    </div>

                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-3">Topic Categories</div>
                                        <div className="flex flex-wrap gap-2">
                                            {r.categories?.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => {(isAdmin || (user && r.addedBy === user.uid)) ? handleRemoveCategory(cat) : null}}
                                                    className={`px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-[10px] font-bold text-indigo-400/80 transition-all ${ (isAdmin || (user && r.addedBy === user.uid)) ? 'hover:border-red-500/40 hover:text-red-400' : ''}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                            {(isAdmin || (user && r.addedBy === user.uid)) && (
                                               <button onClick={() => setIsCategoryInputOpen(true)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/40 hover:text-white">+</button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-3">Community Tags</div>
                                        <div className="flex flex-wrap gap-2">
                                            {r.tags?.map(tag => (
                                                <button 
                                                    key={tag} 
                                                    onClick={() => {(isAdmin || (user && r.addedBy === user.uid)) ? handleRemoveTag(tag) : null}}
                                                    className={`text-[10px] font-bold text-white/30 italic hover:text-indigo-400 transition-colors`}
                                                >
                                                    #{tag}
                                                </button>
                                            ))}
                                            {(isAdmin || (user && r.addedBy === user.uid)) && (
                                                <button onClick={() => setIsTagInputOpen(true)} className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-all">+</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Management Protocol (Curator Only) */}
                            {(isAdmin || (user && r.addedBy === user.uid)) && (
                                <div className="glass-card p-8 border-indigo-500/20 bg-indigo-500/5">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <Icons.settings size={16} />
                                        </div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Curation Workbench</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <Link href={`/resources/${r.id}/edit`} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group/edit">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover/edit:text-white">Hard Refactor</span>
                                            <Icons.edit size={14} className="text-white/20 group-hover/edit:text-indigo-400" />
                                        </Link>
                                        <button 
                                            onClick={handleDelete}
                                            disabled={deleting}
                                            className="w-full flex items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-2xl hover:bg-red-500/10 transition-all group/del"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-red-400/60 group-hover/del:text-red-400">{deleting ? 'Terminating...' : 'Decommission Asset'}</span>
                                            <Icons.delete size={14} className="text-red-400/20 group-hover/del:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Attribution Stats */}
                            <div className="glass-card p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <Icons.user size={16} />
                                    </div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Intelligence Origin</h3>
                                </div>
                                <div className="space-y-3">
                                    {deduplicateAttributions(r.attributions || []).map((attr, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-black text-xs">
                                                    {attr.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-white truncate">{attr.name}</div>
                                                    <div className="text-[8px] font-black uppercase text-white/20">{attr.role || 'Contributor'}</div>
                                                </div>
                                            </div>
                                            {attr.userId && (
                                                <Link href={`/creators/${attr.userId}`} className="p-2 text-white/20 hover:text-indigo-400 transition-all">
                                                    <Icons.arrowRight size={14} />
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>
                </main>
            </div>
            {/* Note Editor Modal */}
            <Modal
                isOpen={isNoteModalOpen}
                onClose={() => {
                    if (noteContent !== initialNoteContent) {
                        setIsUnsavedChangesModalOpen(true);
                    } else {
                        setIsNoteModalOpen(false);
                        setNoteMessage({ type: '', text: '' });
                    }
                }}
                title={`Notes for ${r.title}`}
                maxWidth="800px"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: noteMessage.type === 'success' ? 'var(--success-500)' : 'var(--danger-500)' }}>
                            {noteMessage.text}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button className="btn btn-secondary" onClick={() => setIsNoteModalOpen(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveNote}
                                disabled={isSavingNote}
                            >
                                {isSavingNote ? 'Saving...' : '💾 Save Note'}
                            </button>
                        </div>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="markdown-toolbar" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('**', '**')} title="Bold">B</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('*', '*')} title="Italic">I</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('### ')} title="Heading">H</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('[', '](url)')} title="Link">🔗</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('![alt text](', ')')} title="Image">🖼️</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('- ')} title="Bullet List">•</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('```\n', '\n```')} title="Code Block">{'<>'}</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('[PDF](', ')')} title="PDF Link">📄</button>
                            <button
                                className="toolbar-btn"
                                onClick={extractYouTubeLinks}
                                title="Extract Links from YouTube Description"
                                disabled={isExtracting}
                            >
                                {isExtracting ? '⏳' : '📺'}
                            </button>
                            <button
                                className="toolbar-btn"
                                onClick={() => setIsUrlInputOpen(true)}
                                title="Extract Links from any URL"
                                disabled={isExtracting}
                            >
                                {isExtracting ? '⏳' : '🌐'}
                            </button>
                        </div>
                        <button
                            className="btn btn-secondary"
                            style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                            onClick={() => setIsPreviewMode(!isPreviewMode)}
                        >
                            {isPreviewMode ? '✏️ Edit' : '👁️ Preview'}
                        </button>
                    </div>

                    {!isPreviewMode ? (
                        <textarea
                            ref={noteTextareaRef}
                            className="form-input"
                            style={{
                                width: '100%',
                                minHeight: '300px',
                                fontFamily: 'var(--font-mono)',
                                lineHeight: '1.6',
                                background: 'var(--bg-input)',
                                resize: 'vertical'
                            }}
                            placeholder="Write your private notes here using Markdown..."
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                        />
                    ) : (
                        <div
                            className="glass-card prose"
                            style={{
                                minHeight: '300px',
                                padding: 'var(--space-4)',
                                overflowY: 'auto',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)'
                            }}
                        >
                            {noteContent ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }} />
                                    }}
                                >
                                    {noteContent}
                                </ReactMarkdown>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No content to preview.</div>
                            )}
                        </div>
                    )}

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        Support for images, PDFs, and links via standard Markdown logic.
                    </div>
                </div>
            </Modal>

            {/* Link Selection Modal */}
            <Modal
                isOpen={isLinkSelectionOpen}
                onClose={() => setIsLinkSelectionOpen(false)}
                title="Select Links to Insert"
                maxWidth="600px"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}>
                        <button className="btn btn-secondary" onClick={() => setIsLinkSelectionOpen(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={insertSelectedLinks}>
                            Insert {selectedLinks.size} Links
                        </button>
                    </div>
                }
            >
                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-2)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 'bold' }}>
                            <input
                                type="checkbox"
                                checked={selectedLinks.size === extractedLinks.length}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSelectedLinks(new Set(extractedLinks.map(l => l.url)));
                                    } else {
                                        setSelectedLinks(new Set());
                                    }
                                }}
                            />
                            Select All
                        </label>
                    </div>
                    {extractedLinks.map((link, index) => (
                        <div key={index} className="card" style={{ padding: 'var(--space-2)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                            <input
                                type="checkbox"
                                checked={selectedLinks.has(link.url)}
                                onChange={() => toggleLinkSelection(link.url)}
                                style={{ marginTop: '5px' }}
                            />
                            <div style={{ wordBreak: 'break-all', fontSize: 'var(--text-sm)' }}>
                                <div style={{ fontWeight: 'bold' }}>{link.title}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{link.url}</div>
                            </div>
                        </div>
                    ))}
                    {extractedLinks.length === 0 && (
                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No links found to extract.
                        </div>
                    )}
                </div>
            </Modal>
            {/* Unsaved Changes Modal */}

            {/* URL Input Modal */}
            <Modal
                isOpen={isUrlInputOpen}
                onClose={() => { setIsUrlInputOpen(false); setExtractUrl(''); }}
                title="Extract Links from URL"
                maxWidth="500px"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}>
                        <button className="btn btn-secondary" onClick={() => { setIsUrlInputOpen(false); setExtractUrl(''); }}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={extractLinksFromUrl}
                            disabled={!extractUrl.trim()}
                        >
                            🔍 Extract Links
                        </button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                        Enter a URL to extract all links from that page. You can then select which links to insert into your note.
                    </p>
                    <input
                        type="url"
                        className="form-input"
                        placeholder="https://example.com/page-with-links"
                        value={extractUrl}
                        onChange={(e) => setExtractUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && extractUrl.trim()) {
                                extractLinksFromUrl();
                            }
                        }}
                        autoFocus
                        style={{ width: '100%' }}
                    />
                </div>
            </Modal>


            <Modal
                isOpen={isUnsavedChangesModalOpen}
                onClose={() => setIsUnsavedChangesModalOpen(false)}
                title="Unsaved Changes"
                maxWidth="400px"
                className="modal-danger"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsUnsavedChangesModalOpen(false)}
                        >
                            Keep Editing
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={() => {
                                setIsUnsavedChangesModalOpen(false);
                                setIsNoteModalOpen(false);
                                setNoteContent(initialNoteContent);
                                setNoteMessage({ type: '', text: '' });
                            }}
                        >
                            Discard Changes
                        </button>
                    </div>
                }
            >
                <div style={{ padding: 'var(--space-2)' }}>
                    <p>You have unsaved changes in your note. Are you sure you want to discard them?</p>
                </div>
            </Modal>

            {/* Confirmation Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirmModal}
                title={confirmModal.title}
                className={confirmModal.isDanger ? 'modal-danger' : ''}
                footer={
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', width: '100%' }}>
                        <button className="btn btn-secondary" onClick={closeConfirmModal}>Cancel</button>
                        <button 
                            className={`btn ${confirmModal.isDanger ? 'btn-danger' : 'btn-primary'}`} 
                            onClick={confirmModal.onConfirm}
                        >
                            {confirmModal.confirmText}
                        </button>
                    </div>
                }
            >
                <p style={{ color: 'var(--text-secondary)' }}>{confirmModal.message}</p>
            </Modal>

            <ThumbnailPicker 
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={(url) => handleUpdateField('thumbnailUrl', url)}
            />

            <Footer />
        </div>
    );
}
