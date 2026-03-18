'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getYouTubeEmbedUrl, extractYouTubeId, isYouTubeUrl, isGenericYouTubeName, deduplicateCredits } from '@/lib/youtube';
import Modal from '@/components/Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface ResourceDetailClientProps {
    initialResource: Resource;
}

export default function ResourceDetailClient({ initialResource }: ResourceDetailClientProps) {
    const router = useRouter();
    const { user, isAdmin } = useAuth();
    const [resource, setResource] = useState<Resource>(initialResource);
    const [isSaved, setIsSaved] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [copyStatus, setCopyStatus] = useState('Copy Link');
    const [shareOpen, setShareOpen] = useState(false);
    const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);
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

    const resourceId = resource.id;

    useEffect(() => {
        async function fetchUserSpecificData() {
            if (!user) return;
            
            try {
                // Check if saved
                const userResResponse = await fetch(`/api/user-resources?uid=${user.uid}`);
                const userResResult = await userResResponse.json();
                if (userResResult.success) {
                    setIsSaved(userResResult.data.savedResources?.includes(resourceId) || false);
                }

                // Fetch note
                const noteResponse = await fetch(`/api/user-notes/${resourceId}?uid=${user.uid}`);
                const noteResult = await noteResponse.json();
                if (noteResult.success && noteResult.data.content) {
                    setNoteContent(noteResult.data.content);
                    setInitialNoteContent(noteResult.data.content);
                }
            } catch (error) {
                console.error('Error fetching user specific data:', error);
            }
        }
        fetchUserSpecificData();
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

    const handleToggleSave = async () => {
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

    const handleCopyPrompt = (text: string, idx: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPromptIdx(idx);
            setTimeout(() => {
                setCopiedPromptIdx(null);
            }, 2000);
        }).catch(err => {
            console.error('Could not copy prompt: ', err);
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

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    const extractYouTubeLinks = async () => {
        let videoId = resource?.youtubeVideoId;
        if (!videoId && resource?.url) {
            videoId = extractYouTubeId(resource.url) || undefined;
        }
        if (!videoId) {
            const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
            const match = noteContent.match(ytRegex);
            if (match) videoId = match[1];
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
                setSelectedLinks(new Set(result.data.links.map((l: any) => l.url)));
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
        if (!extractUrl.trim()) { alert('Please enter a URL.'); return; }
        try { new URL(extractUrl); } catch { alert('Please enter a valid URL.'); return; }

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
        if (newSelected.has(link)) newSelected.delete(link);
        else newSelected.add(link);
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

    const ytId = resource.youtubeVideoId || (resource.mediaFormat === 'youtube' ? extractYouTubeId(resource.url) : null);

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '900px' }}>
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
                        <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                            {/* Header Section: Thumbnail + Title/Actions */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '140px 1fr',
                                gap: 'var(--space-8)',
                                alignItems: 'start',
                                marginBottom: 'var(--space-8)'
                            }}>
                                {/* Thumbnail */}
                                <div style={{
                                    width: '140px',
                                    height: '140px',
                                    borderRadius: 'var(--radius-lg)',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    flexShrink: 0,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: 'var(--shadow-md)',
                                }}>
                                    {resource.thumbnailUrl ? (
                                        <Image
                                            src={resource.thumbnailUrl}
                                            alt={resource.title}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                            unoptimized
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '3rem',
                                            background: 'var(--primary-dark)',
                                        }}>
                                            {resource.type === 'video' ? '📺' : '📄'}
                                        </div>
                                    )}
                                </div>

                                {/* Title and Info Card */}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--space-2)'
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                                {resource.categories?.map((cat) => (
                                                    <Link key={cat} href={`/resources?category=${encodeURIComponent(cat)}`} className="badge badge-primary">{cat}</Link>
                                                ))}
                                                <span className="badge badge-accent">{resource.platform}</span>
                                                <span className={`badge badge-${resource.pricing}`}>{resource.pricing}</span>
                                                <span className="badge badge-secondary">{resource.type}</span>
                                            </div>
                                            <h1 style={{
                                                fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                                                fontWeight: 800,
                                                lineHeight: 1.1,
                                                marginBottom: 'var(--space-2)',
                                                background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                            }}>
                                                {resource.title}
                                            </h1>
                                            <div style={{
                                                display: 'flex',
                                                gap: 'var(--space-4)',
                                                color: 'var(--text-muted)',
                                                fontSize: 'var(--text-sm)'
                                            }}>
                                                <span>Added {new Date(resource.createdAt).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span>Updated {new Date(resource.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        {/* Action Buttons: Save, Note, Share, Edit, Open */}
                                        <div style={{ 
                                            display: 'flex', 
                                            flexWrap: 'wrap', 
                                            gap: 'var(--space-3)', 
                                            marginTop: 'var(--space-4)',
                                            alignItems: 'center' 
                                        }}>
                                            <button
                                                className={`save-button ${isSaved ? 'active' : ''}`}
                                                style={{ 
                                                    position: 'static', 
                                                    width: '42px', 
                                                    height: '42px', 
                                                    borderRadius: 'var(--radius-md)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.4rem'
                                                }}
                                                onClick={handleToggleSave}
                                                title={isSaved ? 'Remove from saved' : 'Save resource'}
                                            >
                                                {isSaved ? '★' : '☆'}
                                            </button>

                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => setIsNoteModalOpen(true)}
                                                id="open-notes"
                                                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                                            >
                                                {noteContent ? '📝 Edit Note' : '➕ Add Note'}
                                            </button>

                                            {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                                <Link 
                                                    href={`/resources/${resource.id}/edit`} 
                                                    className="btn btn-secondary" 
                                                    id="edit-resource-top"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                                                >
                                                    ✏️ Edit
                                                </Link>
                                            )}

                                            <div style={{ position: 'relative' }} ref={shareRef}>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => setShareOpen(!shareOpen)}
                                                    id="share-resource"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                                                >
                                                    ↗️ Share
                                                </button>
                                                
                                                {shareOpen && (
                                                    <div className="glass-card" style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        marginTop: 'var(--space-2)',
                                                        width: '240px',
                                                        padding: 'var(--space-2)',
                                                        zIndex: 100,
                                                        boxShadow: 'var(--shadow-xl)',
                                                        background: 'var(--bg-elevated)',
                                                        border: '1px solid var(--border-subtle)',
                                                        animation: 'fadeIn 0.2s ease-out'
                                                    }}>
                                                        <button
                                                            className="user-menu-item"
                                                            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent' }}
                                                            onClick={(e) => handleCopyLink(e)}
                                                        >
                                                            {copyStatus === 'Copy Link' ? '🔗 ' + copyStatus : copyStatus}
                                                        </button>
                                                        <button
                                                            className="user-menu-item"
                                                            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent' }}
                                                            onClick={handleShareTwitter}
                                                        >
                                                            𝕏 Share on X
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

                                            <a
                                                href={resource.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-primary"
                                                id="open-resource"
                                                style={{ 
                                                    marginLeft: 'auto',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-2)',
                                                    padding: 'var(--space-2) var(--space-6)',
                                                    fontWeight: 600,
                                                    fontSize: 'var(--text-lg)'
                                                }}
                                            >
                                                🌐 Open Resource
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                                {/* Video Section (If it's a YouTube video) */}
                                {ytId && (
                                    <div style={{ width: '100%' }}>
                                        <div className="youtube-embed" style={{ 
                                            borderRadius: 'var(--radius-lg)', 
                                            overflow: 'hidden',
                                            boxShadow: 'var(--shadow-lg)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            aspectRatio: '16/9'
                                        }}>
                                            <iframe
                                                src={getYouTubeEmbedUrl(ytId)}
                                                title={resource.title}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                style={{ border: 'none', width: '100%', height: '100%' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Description</h3>
                                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{resource.description}</p>
                                </div>

                                {resource.prompts && resource.prompts.length > 0 && (
                                    <div>
                                        <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <span>💬 Featured Prompts</span>
                                            <span className="badge badge-secondary" style={{ fontSize: 'var(--text-xs)' }}>{resource.prompts.length}</span>
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                            {resource.prompts.map((prompt, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="card" 
                                                    style={{ 
                                                        padding: 'var(--space-4)', 
                                                        background: 'var(--bg-subtle)', 
                                                        border: '1px solid var(--border-subtle)',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 'var(--space-3)' }}>
                                                        {prompt}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => handleCopyPrompt(prompt, idx)}
                                                            className={`btn btn-sm ${copiedPromptIdx === idx ? 'btn-secondary' : 'btn-outline'}`}
                                                            style={{ fontSize: 'var(--text-xs)', height: '28px', padding: '0 var(--space-3)' }}
                                                        >
                                                            {copiedPromptIdx === idx ? 'Copied! ✅' : '📋 Copy Prompt'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {resource.credits && resource.credits.length > 0 && (
                                    <div>
                                        <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Credits & Attribution</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {deduplicateCredits(resource.credits || []).map((c) => {
                                                const isGeneric = isGenericYouTubeName(c.name) && resource.url && isYouTubeUrl(resource.url);
                                                const name = isGeneric ? 'YouTube' : c.name;
                                                return { ...c, name };
                                            }).map((credit, idx) => (
                                                <a key={idx} href={credit.url} target="_blank" rel="noopener noreferrer" className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', textDecoration: 'none' }}>
                                                    <span style={{ fontSize: '1.2rem' }}>👤</span>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{credit.name}</div>
                                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{credit.url}</div>
                                                    </div>
                                                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>↗</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {resource.pricingDetails && (
                                    <div>
                                        <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Pricing Details</h3>
                                        <p style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{resource.pricingDetails}</p>
                                    </div>
                                )}

                                {user && (
                                    <div id="resource-notes-section">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                            <h3 style={{ fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0 }}>Resource Notes</h3>
                                            <button 
                                                className="btn btn-secondary btn-sm" 
                                                onClick={() => setIsNoteModalOpen(true)}
                                            >
                                                {noteContent ? '📝 Edit Note' : '➕ Add Note'}
                                            </button>
                                        </div>
                                        <div className="card" style={{ padding: 'var(--space-6)', minHeight: '100px', background: 'var(--bg-elevated)', position: 'relative' }}>
                                            {noteContent ? (
                                                <div className="prose">
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]} 
                                                        components={{ 
                                                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }} /> 
                                                        }}
                                                    >
                                                        {noteContent}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4) 0' }}>
                                                    <div style={{ fontSize: '2rem' }}>📒</div>
                                                    <p>You haven&apos;t added any notes to this resource yet.</p>
                                                    <div style={{ marginTop: 'var(--space-2)' }}>
                                                        <button 
                                                            className="btn btn-primary btn-sm" 
                                                            onClick={() => setIsNoteModalOpen(true)}
                                                            style={{ margin: '0 auto' }}
                                                        >
                                                            Add your first note
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)' }}>
                                        <Link href={`/resources/${resource.id}/edit`} className="btn btn-secondary" id="edit-resource">✏️ Edit</Link>
                                        <button className="btn btn-danger" onClick={handleDelete} disabled={deleting} id="delete-resource">
                                            {deleting ? 'Deleting...' : '🗑 Delete'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isNoteModalOpen}
                onClose={() => {
                    if (noteContent !== initialNoteContent) setIsUnsavedChangesModalOpen(true);
                    else { setIsNoteModalOpen(false); setNoteMessage({ type: '', text: '' }); }
                }}
                title={`Notes for ${resource.title}`}
                maxWidth="800px"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: noteMessage.type === 'success' ? 'var(--success-500)' : 'var(--danger-500)' }}>{noteMessage.text}</div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button className="btn btn-secondary" onClick={() => setIsNoteModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveNote} disabled={isSavingNote}>{isSavingNote ? 'Saving...' : '💾 Save Note'}</button>
                        </div>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="markdown-toolbar">
                            <button className="toolbar-btn" onClick={() => insertMarkdown('**', '**')}>B</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('*', '*')}>I</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('### ')}>H</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('[', '](url)')}>🔗</button>
                            <button className="toolbar-btn" onClick={() => insertMarkdown('```\n', '\n```')}>{'<>'}</button>
                            <button className="toolbar-btn" onClick={extractYouTubeLinks} disabled={isExtracting}>{isExtracting ? '⏳' : '📺'}</button>
                            <button className="toolbar-btn" onClick={() => setIsUrlInputOpen(true)} disabled={isExtracting}>{isExtracting ? '⏳' : '🌐'}</button>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsPreviewMode(!isPreviewMode)}>{isPreviewMode ? '✏️ Edit' : '👁️ Preview'}</button>
                    </div>

                    {!isPreviewMode ? (
                        <textarea ref={noteTextareaRef} className="form-input" style={{ width: '100%', minHeight: '300px', fontFamily: 'var(--font-mono)', lineHeight: '1.6', background: 'var(--bg-input)', resize: 'vertical' }} placeholder="Write your private notes here..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
                    ) : (
                        <div className="glass-card prose" style={{ minHeight: '300px', padding: 'var(--space-4)', overflowY: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            {noteContent ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }} /> }}>
                                    {noteContent}
                                </ReactMarkdown>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No content to preview.</div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={isLinkSelectionOpen} onClose={() => setIsLinkSelectionOpen(false)} title="Select Links" maxWidth="600px" footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}><button className="btn btn-secondary" onClick={() => setIsLinkSelectionOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={insertSelectedLinks}>Insert {selectedLinks.size} Links</button></div>}>
                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-2)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 'bold' }}>
                            <input type="checkbox" checked={selectedLinks.size === extractedLinks.length} onChange={(e) => setSelectedLinks(e.target.checked ? new Set(extractedLinks.map(l => l.url)) : new Set())} /> Select All
                        </label>
                    </div>
                    {extractedLinks.map((link, idx) => (
                        <div key={idx} className="card" style={{ padding: 'var(--space-2)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                            <input type="checkbox" checked={selectedLinks.has(link.url)} onChange={() => toggleLinkSelection(link.url)} />
                            <div style={{ wordBreak: 'break-all', fontSize: 'var(--text-sm)' }}>
                                <div style={{ fontWeight: 'bold' }}>{link.title}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{link.url}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            <Modal isOpen={isUrlInputOpen} onClose={() => { setIsUrlInputOpen(false); setExtractUrl(''); }} title="Extract Links from URL" maxWidth="500px" footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}><button className="btn btn-secondary" onClick={() => { setIsUrlInputOpen(false); setExtractUrl(''); }}>Cancel</button><button className="btn btn-primary" onClick={extractLinksFromUrl} disabled={!extractUrl.trim()}>🔍 Extract Links</button></div>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Enter a URL to extract all links.</p>
                    <input type="url" className="form-input" placeholder="https://example.com" value={extractUrl} onChange={(e) => setExtractUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && extractUrl.trim() && extractLinksFromUrl()} autoFocus style={{ width: '100%' }} />
                </div>
            </Modal>

            <Modal isOpen={isUnsavedChangesModalOpen} onClose={() => setIsUnsavedChangesModalOpen(false)} title="Unsaved Changes" maxWidth="400px" footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}><button className="btn btn-secondary" onClick={() => setIsUnsavedChangesModalOpen(false)}>Keep Editing</button><button className="btn btn-danger" onClick={() => { setIsUnsavedChangesModalOpen(false); setIsNoteModalOpen(false); setNoteContent(initialNoteContent); }}>Discard Changes</button></div>}>
                <div style={{ padding: 'var(--space-2)' }}><p>Discard unsaved changes?</p></div>
            </Modal>

            <Footer />
            </div>
    );
}
