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
import { getYouTubeEmbedUrl, extractYouTubeId, isYouTubeUrl, isGenericYouTubeName, deduplicateCredits } from '@/lib/youtube';
import { getDefaultCategories } from '@/lib/suggestions';
import Modal from '@/components/Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Rating from '@/components/Rating';
import CommentSection from '@/components/CommentSection';

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
        if (!confirm('Are you sure you want to delete this resource?')) return;
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
                router.push('/resources');
            } else {
                throw new Error(result.error || 'Failed to delete resource');
            }
        } catch (error: any) {
            console.error('Error deleting resource:', error);
            alert(error.message || 'Error deleting resource');
            setDeleting(false);
        }
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
                setIsCategoryInputOpen(false);
            }
        } catch (error) {
            console.error('Error adding category:', error);
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
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => router.push('/resources')}
                        >
                            ← Back
                        </button>
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
                                        <div className="video-actions-overlay">
                                            <a 
                                                href={resource.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-sm"
                                                style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)' }}
                                            >
                                                📺 Watch on YouTube
                                            </a>
                                        </div>
                                    </div>
                                ) : resource.thumbnailUrl && (
                                    <div className="detail-media-container">
                                        <img 
                                            src={resource.thumbnailUrl} 
                                            alt={resource.title}
                                            className="detail-media"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="detail-title-section">
                                <h1 className="detail-title">
                                    {resource.isFavorite && <span title="Featured Resource">⭐ </span>}
                                    {resource.title}
                                    {resource.rank && (
                                        <span className="detail-rank">
                                            Rank #{resource.rank}
                                        </span>
                                    )}
                                </h1>
                                
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
                                        <Link href={`/resources/${resource.id}/edit`} className="btn btn-secondary" id="edit-resource-top">
                                            ✏️ Edit
                                        </Link>
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

                            {resource.pricingDetails && (
                                <div className="detail-section">
                                    <h3 className="detail-section-title">Licensing & Cost</h3>
                                    <div className="glass-card" style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', borderStyle: 'dashed' }}>
                                        {resource.pricingDetails}
                                    </div>
                                </div>
                            )}

                            {/* Community Section */}
                            <CommentSection resourceId={resourceId} />

                            {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                <div style={{
                                    borderTop: '1px solid var(--border-subtle)',
                                    paddingTop: 'var(--space-8)',
                                    marginTop: 'var(--space-12)',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                }}>
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        id="delete-resource"
                                    >
                                        {deleting ? 'Deleting...' : '🗑 Delete Resource'}
                                    </button>
                                </div>
                            )}
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
                            </div>

                            <div className="sidebar-section">
                                <h3 className="detail-section-title">Classification</h3>
                                <div className="detail-meta-pills" style={{ marginTop: 0 }}>
                                    <span className={`badge badge-${resource.pricing}`}>{resource.pricing}</span>
                                    <span className="badge badge-accent">{resource.platform}</span>
                                    <span className="badge badge-primary">{resource.type}</span>
                                    <span className="badge badge-secondary">{resource.mediaFormat}</span>
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

                            {resource.credits && resource.credits.length > 0 && (
                                <div className="sidebar-section">
                                    <h3 className="detail-section-title">Attribution</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {deduplicateCredits(resource.credits || []).map((c) => {
                                            const isGeneric = isGenericYouTubeName(c.name) && resource.url && isYouTubeUrl(resource.url);
                                            const name = isGeneric ? 'YouTube' : c.name;
                                            return { ...c, name };
                                        }).map((credit, idx) => (
                                            <a
                                                key={idx}
                                                href={credit.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="credit-card"
                                                style={{ padding: 'var(--space-3)', fontSize: 'var(--text-xs)' }}
                                            >
                                                <div className="credit-avatar" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>👤</div>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        {credit.name}
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
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

            <Footer />
        </div >
    );
}
