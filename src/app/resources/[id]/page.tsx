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

    const ytId = resource.youtubeVideoId || (resource.mediaFormat === 'youtube' ? extractYouTubeId(resource.url) : null);

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container detail-container">
                    {/* Breadcrumb & Global Actions */}
                    <div className="detail-header-nav">
                        <div className="detail-breadcrumb">
                            <Link href="/resources">Resources</Link>
                            <span>/</span>
                            <span>{resource.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            {user && (
                                <Link href="/resources/new" className="btn btn-secondary btn-sm">
                                    ➕ Add Resource
                                </Link>
                            )}
                            <Link href="/resources" className="btn btn-primary btn-sm">
                                📚 Resources
                            </Link>
                        </div>
                    </div>

                    <div className="detail-layout animate-slide-up">
                        <div className="detail-main-column">
                            {/* Media Section */}
                            <div className="detail-media-container" style={{ display: 'block', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                                {ytId ? (
                                    <div className="video-theater-mode animate-in fade-in zoom-in duration-500">
                                        <div className="youtube-embed shadow-2xl">
                                            <iframe
                                                src={getYouTubeEmbedUrl(ytId)}
                                                title={resource.title}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                        <div className="video-actions-overlay" style={{ gap: 'var(--space-2)' }}>
                                            <a 
                                                href={resource.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-sm"
                                                style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)' }}
                                            >
                                                📺 Watch on YouTube
                                            </a>
                                            {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                                <button 
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setIsPickerOpen(true)}
                                                    style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
                                                >
                                                    🖼️ Swap Thumbnail
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="detail-media-container" style={{ position: 'relative' }}>
                                        {resource.thumbnailUrl ? (
                                            <img 
                                                src={resource.thumbnailUrl} 
                                                alt={resource.title}
                                                className="detail-media"
                                            />
                                        ) : (
                                            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                                                <p style={{ color: 'var(--text-muted)' }}>No hero image set</p>
                                            </div>
                                        )}
                                        {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                            <div style={{ position: 'absolute', bottom: '12px', right: '12px' }}>
                                                <button 
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setIsPickerOpen(true)}
                                                    style={{ fontSize: '10px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                >
                                                    🖼️ Update Hero Image
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="detail-title-section group">
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
                                    <h1 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                        {(resource.isFavorite || isAdmin || (user && resource.addedBy === user.uid)) && (
                                            <span 
                                                title={resource.isFavorite ? "Featured Resource (Click to unfeature)" : "Feature this resource"}
                                                onClick={(e) => {
                                                    if (isAdmin || (user && resource.addedBy === user.uid)) {
                                                        e.stopPropagation();
                                                        handleUpdateField('isFavorite', !resource.isFavorite);
                                                    }
                                                }}
                                                style={{ 
                                                    cursor: (isAdmin || (user && resource.addedBy === user.uid)) ? 'pointer' : 'default',
                                                    opacity: resource.isFavorite ? 1 : 0.3,
                                                    filter: resource.isFavorite ? 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.5))' : 'grayscale(100%)',
                                                    transition: 'all 0.2s ease',
                                                }}
                                                className="hover:scale-110"
                                            >
                                                ⭐
                                            </span>
                                        )}
                                        <span
                                            style={{ cursor: (isAdmin || (user && resource.addedBy === user.uid)) ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
                                            onClick={() => {
                                                if (isAdmin || (user && resource.addedBy === user.uid)) {
                                                    setIsEditingTitle(true);
                                                    setTempTitle(resource.title);
                                                }
                                            }}
                                        >
                                            {resource.title}
                                            {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                                <span style={{ fontSize: '14px', marginLeft: 'var(--space-2)' }}>✏️</span>
                                            )}
                                        </span>
                                        {isEditingRank ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <input 
                                                    type="number" 
                                                    className="form-input" 
                                                    style={{ width: '80px', padding: 'var(--space-1) var(--space-2)' }} 
                                                    value={tempRank} 
                                                    onChange={(e) => setTempRank(e.target.value)} 
                                                    placeholder="Priority..."
                                                    autoFocus
                                                />
                                                <button 
                                                    className="btn btn-primary btn-sm"
                                                    onClick={async () => {
                                                        const numRank = parseInt(tempRank);
                                                        await handleUpdateField('rank', isNaN(numRank) ? null : numRank);
                                                        setIsEditingRank(false);
                                                    }}
                                                >
                                                    Save
                                                </button>
                                                <button 
                                                    className="btn btn-secondary btn-sm" 
                                                    onClick={() => setIsEditingRank(false)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <span 
                                                className="detail-rank" 
                                                style={{ cursor: (isAdmin || (user && resource.addedBy === user.uid)) ? 'pointer' : 'default', padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)' }}
                                                onClick={() => {
                                                    if (isAdmin || (user && resource.addedBy === user.uid)) {
                                                        setIsEditingRank(true);
                                                        setTempRank(resource.rank ? resource.rank.toString() : '');
                                                    }
                                                }}
                                                title={(isAdmin || (user && resource.addedBy === user.uid)) ? "Click to set priority rank" : ""}
                                            >
                                                {(isAdmin || (user && resource.addedBy === user.uid)) && !resource.rank ? 'Set Priority' : `Rank #${resource.rank}`}
                                            </span>
                                        )}
                                    </h1>
                                )}
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                    <Rating value={resource.averageRating || 0} count={resource.reviewCount || 0} />
                                </div>

                                <div className="detail-actions">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setIsNoteModalOpen(true)}
                                        id="open-notes"
                                    >
                                        {noteContent ? '📝 Edit Note' : '➕ Add Note'}
                                    </button>

                                    {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                        <>
                                            <Link href={`/resources/${resource.id}/edit`} className="btn btn-secondary" id="edit-resource-top">
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

                             <div className="detail-section">
                                <h3 className="detail-section-title">Technical Description</h3>
                                <div className="detail-description">
                                    {resource.description}
                                </div>
                            </div>

                            {/* Recommended Nanobanana Prompt (Editable in-place) */}
                            {(resource.prompts && resource.prompts.length > 0 || isAdmin || (user && resource.addedBy === user.uid)) && (
                                <div className="detail-section animate-fade-in group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 className="detail-section-title">🚀 Recommended Nanobanana Prompt</h3>
                                        {(isAdmin || (user && resource.addedBy === user.uid)) && !isEditingPrompts && (
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button 
                                                    className="btn btn-secondary btn-sm transition-opacity"
                                                    onClick={() => {
                                                        setIsEditingPrompts(true);
                                                        setTempPrompts(resource.prompts?.join('\n') || '');
                                                    }}
                                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                                >
                                                    ✏️ Edit Prompt
                                                </button>
                                                {resource.prompts && resource.prompts.length > 0 && (
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(resource.prompts?.join('\n') || '');
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
                                                {resource.prompts && resource.prompts.length > 0 ? (
                                                    resource.prompts.join('\n')
                                                ) : (isAdmin || (user && resource.addedBy === user.uid)) ? (
                                                    <em style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => {
                                                        setIsEditingPrompts(true);
                                                        setTempPrompts('');
                                                    }}>Add scenario prompts for this resource...</em>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {resource.pricingDetails && (
                                <div className="detail-section">
                                    <h3 className="detail-section-title">Licensing & Cost</h3>
                                    <div className="glass-card" style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', borderStyle: 'dashed' }}>
                                        {resource.pricingDetails}
                                    </div>
                                </div>
                            )}

                            {/* Public Notes (Editable in-place) */}
                            <div className="detail-section animate-fade-in group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 className="detail-section-title">📖 Important Notes & Instructions</h3>
                                    {(isAdmin || (user && resource.addedBy === user.uid)) && !isEditingPublicNotes && (
                                        <button 
                                            className="btn btn-secondary btn-sm transition-opacity"
                                            onClick={() => {
                                                setIsEditingPublicNotes(true);
                                                setTempPublicNotes(resource.notes || '');
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
                                            {resource.notes ? (
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }} />
                                                    }}
                                                >
                                                    {resource.notes}
                                                </ReactMarkdown>
                                            ) : (isAdmin || (user && resource.addedBy === user.uid)) ? (
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
                            {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                <div className="detail-section animate-fade-in group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 className="detail-section-title">🔒 Internal Curator Notes</h3>
                                        {!isEditingAdminNotes && (
                                            <button 
                                                className="btn btn-secondary btn-sm transition-opacity"
                                                onClick={() => {
                                                    setIsEditingAdminNotes(true);
                                                    setTempAdminNotes(resource.adminNotes || '');
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
                                                {resource.adminNotes ? (
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-orange)', textDecoration: 'underline' }} />
                                                        }}
                                                    >
                                                        {resource.adminNotes}
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

                        <aside className="detail-sidebar">
                            <div className="sidebar-section">
                                <h3 className="detail-section-title">Access</h3>
                                <a 
                                    href={resource.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="resource-link-card"
                                    style={{ marginTop: 0 }}
                                >
                                    <div className="resource-link-info">
                                        <div className="resource-link-icon">
                                            {resource.mediaFormat === 'youtube' ? '📺' : 
                                             resource.mediaFormat === 'pdf' ? '📄' : '🌐'}
                                        </div>
                                        <div className="resource-link-text">
                                            <span className="resource-link-label">Direct Entry</span>
                                            <span className="resource-link-url">{new URL(resource.url).hostname}</span>
                                        </div>
                                    </div>
                                    <span style={{ color: 'var(--accent-primary)' }}>↗</span>
                                </a>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ width: '100%', marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigator.clipboard.writeText(resource.url);
                                        const btn = e.currentTarget;
                                        const original = btn.textContent;
                                        btn.textContent = '✅ Copied!';
                                        setTimeout(() => { btn.textContent = original; }, 2000);
                                    }}
                                    title="Copy resource URL to clipboard"
                                >
                                    📋 Copy Link
                                </button>
                            </div>

                            <div className="sidebar-section">
                                <h3 className="detail-section-title">Classification</h3>
                                <div className="detail-meta-pills" style={{ marginTop: 0 }}>
                                    {(isAdmin || (user && resource.addedBy === user.uid)) ? (
                                        <>
                                            <select 
                                                className={`badge badge-${resource.pricing}`} 
                                                value={resource.pricing} 
                                                onChange={(e) => handleUpdateField('pricing', e.target.value)}
                                                style={{ appearance: 'none', cursor: 'pointer', paddingRight: '0.8rem', outline: 'none' }}
                                                title="Update Pricing"
                                            >
                                                {PRICING_OPTIONS.map(opt => <option key={opt} value={opt} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{opt}</option>)}
                                            </select>
                                            <select 
                                                className="badge badge-accent" 
                                                value={resource.platform} 
                                                onChange={(e) => handleUpdateField('platform', e.target.value)}
                                                style={{ appearance: 'none', cursor: 'pointer', paddingRight: '0.8rem', outline: 'none' }}
                                                title="Update Platform"
                                            >
                                                {PLATFORM_OPTIONS.map(opt => <option key={opt} value={opt} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{opt}</option>)}
                                            </select>
                                            <select 
                                                className="badge badge-primary" 
                                                value={resource.type} 
                                                onChange={(e) => handleUpdateField('type', e.target.value)}
                                                style={{ appearance: 'none', cursor: 'pointer', paddingRight: '0.8rem', outline: 'none' }}
                                                title="Update Type"
                                            >
                                                {TYPE_OPTIONS.map(opt => <option key={opt} value={opt} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{opt}</option>)}
                                            </select>
                                            <select 
                                                className="badge badge-secondary" 
                                                value={resource.mediaFormat} 
                                                onChange={(e) => handleUpdateField('mediaFormat', e.target.value)}
                                                style={{ appearance: 'none', cursor: 'pointer', paddingRight: '0.8rem', outline: 'none' }}
                                                title="Update Media Format"
                                            >
                                                {MEDIA_OPTIONS.map(opt => <option key={opt} value={opt} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{opt}</option>)}
                                            </select>
                                        </>
                                    ) : (
                                        <>
                                            <span className={`badge badge-${resource.pricing}`}>{resource.pricing}</span>
                                            <span className="badge badge-accent">{resource.platform}</span>
                                            <span className="badge badge-primary">{resource.type}</span>
                                            <span className="badge badge-secondary">{resource.mediaFormat}</span>
                                        </>
                                    )}
                                </div>
                                
                                <div style={{ marginTop: 'var(--space-6)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>Categories</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {resource.categories?.map((cat) => (
                                            <button
                                                key={cat}
                                                className="category-badge-editable"
                                                onClick={() => handleRemoveCategory(cat)}
                                                title="Click to remove category"
                                                disabled={!isAdmin && resource.addedBy !== user?.uid}
                                            >
                                                {cat}
                                            </button>
                                        ))}

                                        {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                {isCategoryInputOpen ? (
                                                    <select
                                                        autoFocus
                                                        className="category-select-inline"
                                                        onChange={(e) => handleAddCategory(e.target.value)}
                                                        onBlur={() => setIsCategoryInputOpen(false)}
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>Add Category...</option>
                                                        {allCategories
                                                            .filter(c => !resource.categories?.includes(c))
                                                            .map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))
                                                        }
                                                    </select>
                                                ) : (
                                                    <button 
                                                        className="tag-add-btn" 
                                                        onClick={() => setIsCategoryInputOpen(true)}
                                                        title="Add Category"
                                                    >
                                                        +
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {resource.attributions && resource.attributions.length > 0 && (
                                <div className="sidebar-section">
                                    <h3 className="detail-section-title">Attribution</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {deduplicateAttributions(resource.attributions || []).map((c) => {
                                            const isGeneric = isGenericYouTubeName(c.name) && resource.url && isYouTubeUrl(resource.url);
                                            const name = isGeneric ? 'YouTube' : c.name;
                                            return { ...c, name };
                                        }).map((attribution, idx) => {
                                            const internalLink = attribution.userId ? `/creators/${attribution.userId}` : null;
                                            
                                            return (
                                                <div 
                                                    key={idx}
                                                    className="attribution-card group/attr"
                                                    style={{ padding: 'var(--space-3)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexGrow: 1, minWidth: 0 }}>
                                                        <div className="attribution-avatar" style={{ width: '32px', height: '32px', fontSize: '1rem', flexShrink: 0 }}>👤</div>
                                                        <div style={{ minWidth: 0 }}>
                                                            {internalLink ? (
                                                                <Link 
                                                                    href={internalLink}
                                                                    className="font-bold text-white hover:text-indigo-400 transition-colors truncate block"
                                                                    title={`View ${attribution.name}'s profile`}
                                                                >
                                                                    {attribution.name}
                                                                </Link>
                                                            ) : (
                                                                <div className="font-bold text-white/90 truncate">{attribution.name}</div>
                                                            )}
                                                            <div className="text-[10px] text-white/40 uppercase tracking-wider">
                                                                {attribution.role || 'Contributor'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        {attribution.url && (
                                                            <a 
                                                                href={attribution.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all"
                                                                title="External Source"
                                                            >
                                                                <Icons.external size={14} />
                                                            </a>
                                                        )}
                                                        {internalLink && (
                                                            <Link 
                                                                href={internalLink}
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all opacity-0 group-hover/attr:opacity-100"
                                                                title="View Registry Profile"
                                                            >
                                                                <Icons.user size={14} />
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="sidebar-section">
                                <h3 className="detail-section-title">Tags</h3>
                                <div className="inline-tag-editor">
                                    {resource.tags?.map((tag) => (
                                        <button 
                                            key={tag} 
                                            className="tag-badge-editable"
                                            onClick={() => handleRemoveTag(tag)}
                                            title="Click to remove tag"
                                            disabled={!isAdmin && resource.addedBy !== user?.uid}
                                        >
                                            #{tag}
                                        </button>
                                    ))}
                                    
                                    {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                        <>
                                            {isTagInputOpen ? (
                                                <input
                                                    autoFocus
                                                    className="tag-input-inline"
                                                    value={newTag}
                                                    onChange={(e) => setNewTag(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleAddTag();
                                                        if (e.key === 'Escape') setIsTagInputOpen(false);
                                                    }}
                                                    onBlur={() => {
                                                        if (!newTag.trim()) setIsTagInputOpen(false);
                                                    }}
                                                    placeholder="Add tag..."
                                                />
                                            ) : (
                                                <button 
                                                    className="tag-add-btn" 
                                                    onClick={() => setIsTagInputOpen(true)}
                                                    title="Add new tag"
                                                >
                                                    +
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
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
                title={`Notes for ${resource.title}`}
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
        </div >
    );
}
