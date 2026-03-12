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
import Modal from '@/components/Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ResourceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAdmin, activeRole } = useAuth();
    const [resource, setResource] = useState<Resource | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
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

    // Link Extraction State
    const [isLinkSelectionOpen, setIsLinkSelectionOpen] = useState(false);
    const [extractedLinks, setExtractedLinks] = useState<{ url: string; title: string }[]>([]);
    const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
    const [isExtracting, setIsExtracting] = useState(false);

    // Generic URL Extraction State
    const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
    const [extractUrl, setExtractUrl] = useState('');

    const resourceId = params.id as string;

    useEffect(() => {
        async function fetchResource() {
            try {
                const response = await fetch(`/api/resources/${resourceId}`);
                const result = await response.json();

                if (result.success) {
                    const data = result.data;
                    setResource({
                        ...data,
                        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
                    } as Resource);
                } else {
                    console.error('API Error:', result.error);
                }

                // Check if saved via API
                if (user) {
                    const userResResponse = await fetch(`/api/user-resources?uid=${user.uid}`);
                    const userResResult = await userResResponse.json();
                    if (userResResult.success) {
                        setIsSaved(userResResult.data.savedResources?.includes(resourceId) || false);
                    }
                }
            } catch (error) {
                console.error('Error fetching resource:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchResource();

        async function fetchNote() {
            if (!user) return;
            try {
                const response = await fetch(`/api/user-notes/${resourceId}?uid=${user.uid}`);
                const result = await response.json();
                if (result.success && result.data.content) {
                    setNoteContent(result.data.content);
                    setInitialNoteContent(result.data.content);
                }
            } catch (error) {
                console.error('Error fetching note:', error);
            }
        }
        fetchNote();
    }, [resourceId, user]);

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
                setIsSaved(!isSaved);
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
                setInitialNoteContent(noteContent);
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
                <div className="container" style={{ maxWidth: '900px' }}>
                    {/* Breadcrumb */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-muted)',
                        }}>
                            <Link href="/resources" style={{ color: 'var(--text-muted)' }}>Resources</Link>
                            <span>→</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{resource.title}</span>
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => router.push('/resources')}
                            style={{ padding: 'var(--space-1) var(--space-4)' }}
                        >
                            ← Back
                        </button>
                    </div>

                    <div className="glass-card animate-slide-up" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Video / Media */}
                        {ytId && (
                            <div className="youtube-embed">
                                <iframe
                                    src={getYouTubeEmbedUrl(ytId)}
                                    title={resource.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        )}

                        <div style={{ padding: 'var(--space-8)' }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 'var(--space-4)',
                                marginBottom: 'var(--space-6)',
                            }}>
                                <div style={{ flex: 1 }}>
                                    <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        {resource.isFavorite && <span title="Featured Resource">⭐</span>}
                                        {resource.title}
                                        {resource.rank && (
                                            <span style={{
                                                fontSize: 'var(--text-xs)',
                                                background: 'var(--bg-card)',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-full)',
                                                border: '1px solid var(--border-subtle)',
                                                verticalAlign: 'middle',
                                                marginLeft: 'var(--space-2)'
                                            }}>
                                                Rank #{resource.rank}
                                            </span>
                                        )}
                                    </h1>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        <span className={`badge badge-${resource.pricing}`}>{resource.pricing}</span>
                                        <span className="badge badge-accent">{resource.platform}</span>
                                        <span className="badge badge-primary">{resource.type}</span>
                                        <span className="badge badge-warning">{resource.mediaFormat}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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
                                                <div
                                                    className="glass-card"
                                                    style={{
                                                        position: 'absolute',
                                                        top: 'calc(100% + 10px)',
                                                        right: 0,
                                                        width: '200px',
                                                        zIndex: 100,
                                                        padding: 'var(--space-2)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 'var(--space-1)',
                                                        boxShadow: 'var(--shadow-lg)',
                                                        border: '1px solid var(--border-subtle)',
                                                    }}
                                                >
                                                    <button
                                                        className="user-menu-item"
                                                        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent' }}
                                                        onClick={handleCopyLink}
                                                    >
                                                        {copyStatus === 'Copy Link' ? '🔗 ' + copyStatus : copyStatus}
                                                    </button>
                                                    <button
                                                        className="user-menu-item"
                                                        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent' }}
                                                        onClick={handleShareTwitter}
                                                    >
                                                        🐦 Share on X / Twitter
                                                    </button>
                                                    <button
                                                        className="user-menu-item"
                                                        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent' }}
                                                        onClick={handleShareLinkedIn}
                                                    >
                                                        💼 Share on LinkedIn
                                                    </button>
                                                    <button
                                                        className="user-menu-item"
                                                        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent' }}
                                                        onClick={handleShareEmail}
                                                    >
                                                        ✉️ Share via Email
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary"
                                        id="open-resource"
                                    >
                                        🌐 Open Resource
                                    </a>
                                </div>
                            </div>


                            {/* Description */}
                            <div style={{ marginBottom: 'var(--space-8)' }}>
                                <h3 style={{
                                    fontSize: 'var(--text-base)',
                                    color: 'var(--text-secondary)',
                                    marginBottom: 'var(--space-3)',
                                }}>
                                    Description
                                </h3>
                                <p style={{
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.8,
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {resource.description}
                                </p>
                            </div>

                            {/* Categories */}
                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <h3 style={{
                                    fontSize: 'var(--text-base)',
                                    color: 'var(--text-secondary)',
                                    marginBottom: 'var(--space-3)',
                                }}>
                                    Categories
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                    {resource.categories?.map((cat) => (
                                        <Link
                                            key={cat}
                                            href={`/resources?category=${encodeURIComponent(cat)}`}
                                            className="badge badge-primary"
                                            style={{ textDecoration: 'none', cursor: 'pointer' }}
                                        >
                                            {cat}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Credits */}
                            {resource.credits && resource.credits.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--text-base)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: 'var(--space-3)',
                                    }}>
                                        Credits & Attribution
                                    </h3>
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
                                                className="card"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-3)',
                                                    padding: 'var(--space-3) var(--space-4)',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>👤</span>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                                        {credit.name}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        {credit.url}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    marginLeft: 'auto',
                                                    color: 'var(--text-muted)',
                                                    fontSize: 'var(--text-sm)',
                                                }}>
                                                    ↗
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tags */}
                            {resource.tags && resource.tags.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--text-base)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: 'var(--space-3)',
                                    }}>
                                        Tags
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {resource.tags.map((tag) => (
                                            <span key={tag} className="badge badge-primary"
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pricing Details */}
                            {resource.pricingDetails && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--text-base)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: 'var(--space-3)',
                                    }}>
                                        Pricing Details
                                    </h3>
                                    <p style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                                        {resource.pricingDetails}
                                    </p>
                                </div>
                            )}

                            {/* Owner/Admin Actions */}
                            {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                <div style={{
                                    borderTop: '1px solid var(--border-subtle)',
                                    paddingTop: 'var(--space-6)',
                                    display: 'flex',
                                    gap: 'var(--space-3)',
                                }}>
                                    <Link href={`/resources/${resource.id}/edit`} className="btn btn-secondary" id="edit-resource">
                                        ✏️ Edit
                                    </Link>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => router.push('/resources')}
                                        id="cancel-admin-view"
                                    >
                                        ✕ Cancel
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        id="delete-resource"
                                    >
                                        {deleting ? 'Deleting...' : '🗑 Delete'}
                                    </button>
                                </div>
                            )}
                        </div>
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
            <Footer />
        </div >
    );
}
