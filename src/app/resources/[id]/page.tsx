'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import { FlagModal } from '@/components/FlagModal';
import { useToast } from '@/components/Toast';
import CreatorChip from '@/components/CreatorChip';
import ConfirmationModal from '@/components/ConfirmationModal';
import { triggerTicketFixAction } from './actions';

export default function ResourceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const ticketId = searchParams.get('ticketId');
    const returnUrl = searchParams.get('returnUrl');
    const { user, isAdmin, activeRole } = useAuth();
    const { addToast } = useToast();
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
    const [fixModalOpen, setFixModalOpen] = useState(false);
    const [activeFixPending, setActiveFixPending] = useState(false);

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

    const FIX_SUMMARIES: Record<string, string> = {
      'encryption_enforcement_fix': 'Enforce AES-256-GCM encryption across all satellite shards.',
      'encryption-enforcement': 'Enforce AES-256-GCM encryption across all satellite shards.',
      'av_gateway_fix': 'Deploy a technical age-verification gateway on Port 3002.',
      'fix-av-gateway': 'Deploy a technical age-verification gateway on Port 3002.',
      'moderation_baseline_fix': 'Synchronize global content moderation and safety baselines.',
      'fix-content-moderation': 'Synchronize global content moderation and safety baselines.',
      'fix-data-audit': 'Restore administrative telemetry and clinical audit trails.',
      'reinstate_content': 'Restore flagged resource to public view and remove user strikes.',
      'archive_content': 'Move tainted resource to secure administrative archive.',
      'fix-encryption': 'Harden database encryption settings.',
    };

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

    // Compliance / Reporting State
    const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);

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

    const effectiveTicketId = resource?.activeTicketId || ticketId;

    // Fetch Active Ticket Data
    const { data: ticketData } = useQuery({
        queryKey: ['ticket', effectiveTicketId],
        queryFn: async () => {
            if (!effectiveTicketId) return null;
            const response = await fetch(`/api/moderation/tickets/${effectiveTicketId}`);
            const result = await response.json();
            return result.success ? result.data : null;
        },
        enabled: !!effectiveTicketId
    });

    const hasActiveFix = !!ticketData?.remediation?.fixId;
    const fixId = ticketData?.remediation?.fixId;
    const predictiveAction = fixId ? (FIX_SUMMARIES[fixId] || 'Generic System Alignment') : 'Generic System Alignment';

    // Check if saved
    const { data: isSaved = false } = useQuery({
        queryKey: ['resource-saved-status', resourceId, user?.uid],
        queryFn: async () => {
            if (!user) return false;
            const response = await fetch(`/api/user-resources?uid=${user.uid}`);
            const result = await response.json();
            if (!result.success) return false;
            return result.data.some((r: any) => r.id === resourceId);
        },
        enabled: !!user,
    });

    // Toggle save
    const toggleSave = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/user-resources', {
                method: isSaved ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resourceId })
            });
            const result = await response.json();
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['resource-saved-status', resourceId, user.uid] });
                addToast(isSaved ? 'Removed from library' : 'Saved to library', 'success');
            }
        } catch (error) {
            console.error('Save error:', error);
        }
    };

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

    const [resolving, setResolving] = useState<string | null>(null);

    const handleResolution = async (action: 'reinstate' | 'archive' | 'dismiss') => {
        if (!effectiveTicketId) return;
        setResolving(action);
        try {
            const token = await user?.getIdToken();
            const response = await fetch('/api/moderation/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    resourceId,
                    ticketId: effectiveTicketId,
                    action
                })
            });

            const result = await response.json();
            if (result.success) {
                addToast(
                    action === 'reinstate' 
                        ? 'Resource reinstated and strike removed.' 
                        : 'Resource archived as tainted.', 
                    'success'
                );
                
                // Redirect back to Accreditation if returnUrl provided
                if (returnUrl) {
                    window.location.href = returnUrl;
                } else {
                    queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                }
            } else {
                throw new Error(result.error || 'Resolution failed');
            }
        } catch (error: any) {
            console.error('Resolution Error:', error);
            addToast(error.message, 'error');
        } finally {
            setResolving(null);
        }
    };

    // Dedicated dismiss for general feedback — never redirects, stays on page.
    const [dismissingFeedback, setDismissingFeedback] = useState(false);
    const handleDismissFeedback = async () => {
        if (!effectiveTicketId || dismissingFeedback) return;
        setDismissingFeedback(true);
        try {
            const token = await user?.getIdToken();
            const response = await fetch('/api/moderation/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    resourceId,
                    ticketId: effectiveTicketId,
                    action: 'dismiss'
                })
            });
            const result = await response.json();
            if (result.success) {
                addToast('Feedback dismissed.', 'success');
                queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                queryClient.invalidateQueries({ queryKey: ['ticket', effectiveTicketId] });
            } else {
                addToast(result.error || 'Could not dismiss feedback.', 'error');
            }
        } catch (error: any) {
            addToast('Unexpected error dismissing feedback.', 'error');
        } finally {
            setDismissingFeedback(false);
        }
    };

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
        <div className="page-wrapper dashboard-theme min-h-screen selection:bg-primary/30 font-inter text-white">
            <Navbar />
                {/* ── PREMIUM CINEMATIC COVER ── */}
            <div className="relative w-full overflow-hidden flex flex-col border-b border-white/5">
                {/* Background Layer (Stillwater Brand Glow) */}
                <div className="absolute inset-0 z-0">
                    <div className="w-full h-full">
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-background to-background opacity-60" />
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px] -mr-48 -mt-48" />
                        {r.thumbnailUrl && (
                            <div className="absolute inset-0 opacity-10">
                                <img src={r.thumbnailUrl} alt="" className="w-full h-full object-cover blur-3xl scale-110" />
                                <div className="absolute inset-0 bg-black/60" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="container relative z-10 pt-12 pb-24">
                    {/* Pathing breadcrumbs */}
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-8">
                        <Link href="/" className="hover:text-teal-400 transition-colors">Sources Registry</Link>
                        <Icons.chevronRight size={10} className="text-white/10" />
                        <Link href="/resources" className="hover:text-teal-400 transition-colors">Resources</Link>
                        <Icons.chevronRight size={10} className="text-white/10" />
                        <span className="text-teal-400">Identity Active</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="px-3 py-1 bg-teal-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-teal-500/20">
                            <Icons.database size={12} /> {r.type}
                        </span>
                        <div className="h-4 w-px bg-white/10" />
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-md ${
                            r.pricing === 'free' ? 'text-emerald-400 bg-emerald-500/5' : 
                            r.pricing === 'paid' ? 'text-amber-500 bg-amber-500/5' : 
                            'text-teal-400 bg-teal-500/5'
                        }`}>
                            {r.pricing}
                        </span>
                        {r.isFavorite && (
                            <>
                                <div className="h-4 w-px bg-white/10" />
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    <Icons.sparkles size={12} /> Featured
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="main-content -mt-12 overflow-visible">
                <main className="container mx-auto px-4 pt-0 pb-20 relative z-30">
                    
                    {/* ── GENERAL FEEDBACK PANEL ── */}
                    {r.activeTicketId && r.reportType === 'other' && r.status !== 'flagged' && (
                        <div className="mb-10 p-8 border border-indigo-500/30 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 animate-in fade-in slide-in-from-top-4 duration-700 backdrop-blur-xl bg-indigo-500/10">
                            <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-inner bg-indigo-500/20 text-indigo-400">
                                <Icons.check size={40} />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 text-indigo-400">
                                    Feedback Registered
                                </h3>
                                <p className="text-sm font-medium leading-relaxed max-w-4xl text-indigo-300/70">
                                    Thank you — your feedback has been successfully logged and is available for review by our team. No action is required from you.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 shrink-0">
                                <Link
                                    href={`http://localhost:3003/tickets/${r.activeTicketId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center shadow-lg bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/20"
                                >
                                    View Feedback Ticket
                                </Link>
                                {isAdmin && (
                                    <button
                                        onClick={handleDismissFeedback}
                                        className="px-8 py-3 bg-white/10 border border-white/20 text-white/60 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all text-center"
                                        disabled={dismissingFeedback}
                                    >
                                        {dismissingFeedback ? 'Dismissing...' : 'Dismiss'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── CRITICAL SAFETY ALERT (all non-feedback safety reports) ── */}
                    {(r.activeTicketId || r.status === 'flagged' || r.status === 'hidden') && r.reportType && r.reportType !== 'other' && (
                        <div className={`mb-10 border rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700 ${
                            ticketData?.status === 'resolved'
                                ? 'bg-teal-500/10 border-teal-500/30'
                                : 'bg-rose-950/60 border-rose-500/50 shadow-2xl shadow-rose-500/20'
                        }`}>
                            {/* Priority bar */}
                            {ticketData?.status !== 'resolved' && (
                                <div className="flex items-center gap-3 px-8 py-2.5 bg-rose-500/20 border-b border-rose-500/30">
                                    <span className="inline-block w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-rose-300">
                                        Critical Priority — Safety Incident Active
                                    </span>
                                </div>
                            )}

                            <div className="p-8 flex flex-col md:flex-row items-start md:items-center gap-8">
                                {/* Icon */}
                                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-inner ${
                                    ticketData?.status === 'resolved'
                                        ? 'bg-teal-500/20 text-teal-400'
                                        : 'bg-rose-500/20 text-rose-400'
                                }`}>
                                    {ticketData?.status === 'resolved'
                                        ? <Icons.check size={40} />
                                        : <Icons.report size={40} className="animate-pulse" />}
                                </div>

                                {/* Text */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className={`text-2xl font-black uppercase tracking-tighter ${
                                            ticketData?.status === 'resolved' ? 'text-teal-400' : 'text-rose-300'
                                        }`}>
                                            {ticketData?.status === 'resolved'
                                                ? '✅ Safety Incident Resolved'
                                                : '🚨 Safety Alert'}
                                        </h3>
                                        {ticketData?.status !== 'resolved' && (
                                            <span className="px-3 py-1 bg-rose-500/30 border border-rose-500/40 rounded-lg text-[9px] font-black uppercase tracking-widest text-rose-300">
                                                {r.reportType === 'illegal' ? 'Illegal Content'
                                                    : r.reportType === 'harmful_children' ? 'Minor Protection'
                                                    : r.reportType === 'harassment' ? 'Harassment'
                                                    : r.reportType === 'hate_speech' ? 'Hate Speech'
                                                    : r.reportType === 'misinformation' ? 'Misinformation'
                                                    : r.reportType === 'spam' ? 'Spam / Abuse'
                                                    : 'Safety Concern'}
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm font-medium leading-relaxed max-w-3xl ${
                                        ticketData?.status === 'resolved' ? 'text-teal-300/70' : 'text-rose-200/70'
                                    }`}>
                                        {ticketData?.status === 'resolved'
                                            ? 'This safety report has been reviewed and resolved. The asset has been cleared and is fully verified within Stillwater safety protocols.'
                                            : `A critical safety concern has been reported for this resource. It has been ${
                                                r.status === 'hidden' ? 'immediately removed from public view' : 'restricted pending investigation'
                                              } and escalated for emergency review. No further action is required from you.`}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-3 shrink-0">
                                    {(r.activeTicketId || effectiveTicketId) && (
                                        <Link
                                            href={`http://localhost:3003/tickets/${r.activeTicketId || effectiveTicketId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center shadow-lg ${
                                                ticketData?.status === 'resolved'
                                                    ? 'bg-teal-500 text-white hover:bg-teal-600 shadow-teal-500/20'
                                                    : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/30'
                                            }`}
                                        >
                                            {ticketData?.status === 'resolved' ? 'View Final Report' : 'View Incident Ticket'}
                                        </Link>
                                    )}
                                    {isAdmin && ticketData?.status === 'resolved' && (
                                        <button
                                            onClick={() => handleResolution('dismiss')}
                                            className="px-8 py-3 bg-white/10 border border-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all text-center"
                                            disabled={!!resolving}
                                        >
                                            {resolving === 'dismiss' ? 'Dismissing...' : 'Dismiss Resolution'}
                                        </button>
                                    )}
                                    {isAdmin && ticketData?.status !== 'resolved' && (
                                        <>
                                            <button
                                                className="px-8 py-3 bg-teal-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                                                onClick={() => handleResolution('reinstate')}
                                                disabled={!!resolving}
                                            >
                                                {resolving === 'reinstate' ? 'Reinstating...' : '✅ Reinstate Asset'}
                                            </button>
                                            {hasActiveFix && (
                                                <button
                                                    onClick={() => setFixModalOpen(true)}
                                                    className="px-8 py-3 bg-white/10 border border-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all text-center"
                                                    disabled={activeFixPending}
                                                >
                                                    {activeFixPending ? 'Initiating...' : '🚀 Initiate Active Fix'}
                                                </button>
                                            )}
                                            <button
                                                className="px-8 py-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                                                onClick={() => handleResolution('archive')}
                                                disabled={!!resolving}
                                            >
                                                {resolving === 'archive' ? 'Archiving...' : '⚠️ Archive Tainted Asset'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {/* ── COLUMN 1: IDENTITY & CORE ── */}
                        <div className="lg:col-span-2 space-y-10">
                            <div className="space-y-6">
                                {isEditingTitle ? (
                                    <div className="animate-in fade-in zoom-in duration-200">
                                        <input 
                                            type="text" 
                                            className="form-input text-4xl font-black bg-white/5 border-white/10 p-4 rounded-2xl w-full mb-4" 
                                            value={tempTitle}
                                            onChange={(e) => setTempTitle(e.target.value)}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateField('title', tempTitle);
                                                    setIsEditingTitle(false);
                                                } else if (e.key === 'Escape') {
                                                    setIsEditingTitle(false);
                                                }
                                            }}
                                        />
                                        <div className="flex gap-3">
                                            <button className="btn btn-primary btn-sm" onClick={() => { handleUpdateField('title', tempTitle); setIsEditingTitle(false); }}>Save</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingTitle(false)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <h1 
                                            className="text-4xl md:text-6xl font-black tracking-tighter text-white font-outfit leading-none flex flex-wrap items-center gap-4 text-left group cursor-pointer"
                                            onClick={() => { if (isAdmin || (user && r.addedBy === user.uid)) { setIsEditingTitle(true); setTempTitle(r.title); } }}
                                        >
                                            {r.isFavorite && <span className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">⭐</span>}
                                            {r.title}
                                            {(isAdmin || (user && r.addedBy === user.uid)) && <Icons.edit size={20} className="text-white/10 group-hover:text-teal-400 transition-colors" />}
                                        </h1>
                                        
                                        <div className="flex items-center gap-6">
                                            {isEditingRank ? (
                                                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-3">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Priority Ranking</span>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="number" 
                                                            className="form-input w-24 text-center font-bold" 
                                                            value={tempRank} 
                                                            onChange={(e) => setTempRank(e.target.value)}
                                                        />
                                                        <button className="btn btn-primary btn-sm" onClick={() => { handleUpdateField('rank', parseInt(tempRank)); setIsEditingRank(false); }}>Set</button>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingRank(false)}>X</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div 
                                                    className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-teal-400 cursor-pointer hover:bg-white/10 transition-colors"
                                                    onClick={() => { if (isAdmin || (user && r.addedBy === user.uid)) { setIsEditingRank(true); setTempRank(r.rank?.toString() || ''); } }}
                                                >
                                                    Asset Priority #{r.rank || 'None'}
                                                </div>
                                            )}
                                            <div className="h-4 w-px bg-white/10" />
                                            <div className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                                Added by <span className="text-white/60">{r.creator?.displayName || 'Community'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Large Thumbnail Content */}
                            <div className="relative group rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl">
                                {r.thumbnailUrl ? (
                                    <div className="aspect-video relative">
                                        <img src={r.thumbnailUrl} alt={r.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    </div>
                                ) : (
                                    <div className="aspect-video flex items-center justify-center bg-teal-500/5">
                                        <Icons.database size={64} className="text-teal-500/10" />
                                    </div>
                                )}
                            </div>

                            {/* Description Block */}
                            <div className="glass-card p-10 border-teal-500/10">
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-6 flex items-center gap-3">
                                    <Icons.info size={14} className="text-teal-500" /> Architectural Intelligence
                                </h3>
                                <div className="text-lg text-slate-300 leading-relaxed font-medium whitespace-pre-wrap text-left">
                                    {r.description || 'No metadata description provided for this architectural asset.'}
                                </div>
                            </div>

                            {/* Nanobanana Prompts */}
                            {(r.prompts && r.prompts.length > 0 || isAdmin || (user && r.addedBy === user.uid)) && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
                                            <Icons.sparkles size={14} className="text-teal-500" /> Recommended Nanobanana Prompts
                                        </h3>
                                        {(isAdmin || (user && r.addedBy === user.uid)) && !isEditingPrompts && (
                                            <button className="btn-ghost text-[10px] font-black uppercase tracking-widest text-teal-400" onClick={() => { setIsEditingPrompts(true); setTempPrompts(r.prompts?.join('\n') || ''); }}>Edit Prompts</button>
                                        )}
                                    </div>
                                    
                                    <div className="glass-card p-8 bg-black/40 border-teal-500/20 relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-teal-500/40" />
                                        {isEditingPrompts ? (
                                            <div className="space-y-4">
                                                <textarea className="form-textarea font-mono text-sm leading-loose bg-black/60 p-6 border-white/5 rounded-2xl w-full" rows={6} value={tempPrompts} onChange={(e) => setTempPrompts(e.target.value)} />
                                                <div className="flex gap-3 justify-end">
                                                    <button className="btn btn-primary" onClick={async () => { const promptsArray = tempPrompts.split('\n').map(p => p.trim()).filter(Boolean); await handleUpdateField('prompts', promptsArray); setIsEditingPrompts(false); }}>Save Prompts</button>
                                                    <button className="btn btn-secondary" onClick={() => setIsEditingPrompts(false)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm font-mono text-teal-400/80 leading-loose whitespace-pre-wrap text-left">
                                                {r.prompts && r.prompts.length > 0 ? r.prompts.join('\n') : 'No prompts defined for this asset.'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Public Notes */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
                                        <Icons.edit size={14} className="text-teal-500" /> Implementation Notes
                                    </h3>
                                    {(isAdmin || (user && r.addedBy === user.uid)) && !isEditingPublicNotes && (
                                        <button className="btn-ghost text-[10px] font-black uppercase tracking-widest text-teal-400" onClick={() => { setIsNoteModalOpen(true); }}>Edit Notes</button>
                                    )}
                                </div>
                                <div className="glass-card p-10 bg-white/5 border-white/10">
                                    <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap text-left">
                                        {r.notes ? (
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }} />
                                                }}
                                            >
                                                {r.notes}
                                            </ReactMarkdown>
                                        ) : 'No implementation notes provided.'}
                                    </div>
                                </div>
                            </div>

                            {/* Internal Curator Notes */}
                            {(isAdmin || (user && r.addedBy === user.uid)) && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-rose-400/60 flex items-center gap-3">
                                            <Icons.shield size={14} className="text-rose-500" /> Internal Curator Intelligence
                                        </h3>
                                        {!isEditingAdminNotes && (
                                            <button className="btn-ghost text-[10px] font-black uppercase tracking-widest text-rose-500" onClick={() => { setIsEditingAdminNotes(true); setTempAdminNotes(r.adminNotes || ''); }}>Edit Curator Data</button>
                                        )}
                                    </div>
                                    <div className="glass-card p-10 bg-rose-500/5 border-rose-500/20">
                                        {isEditingAdminNotes ? (
                                            <div className="space-y-4">
                                                <textarea className="form-textarea text-xs leading-relaxed bg-black/40 p-6 border-white/5 rounded-2xl w-full" rows={4} value={tempAdminNotes} onChange={(e) => setTempAdminNotes(e.target.value)} />
                                                <div className="flex gap-3 justify-end">
                                                    <button className="btn btn-primary" onClick={async () => { await handleUpdateField('adminNotes', tempAdminNotes); setIsEditingAdminNotes(false); }}>Save</button>
                                                    <button className="btn btn-secondary" onClick={() => setIsEditingAdminNotes(false)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-rose-300/60 leading-relaxed italic whitespace-pre-wrap text-left">
                                                {r.adminNotes || 'No internal curated intelligence recorded.'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Personal Insight Anchor */}
                            {noteContent && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-teal-400 flex items-center gap-3">
                                            <Icons.user size={14} className="text-teal-400" /> Your Sovereign Insights
                                        </h3>
                                        <button className="btn-ghost text-[10px] font-black uppercase tracking-widest text-teal-400" onClick={() => setIsNoteModalOpen(true)}>Refine Insight</button>
                                    </div>
                                    <div className="glass-card p-10 bg-teal-500/5 border-teal-500/20">
                                        <div className="text-sm text-slate-300 leading-relaxed font-medium text-left">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Community Engagement */}
                            <div className="pt-10 border-t border-white/5">
                                <CommentSection resourceId={resourceId} />
                            </div>
                        </div>

                        {/* ── COLUMN 2: ACTION & INTELLIGENCE HUB ── */}
                        <div className="lg:col-span-1 space-y-10">
                            {/* Primary Actions */}
                            <div className="space-y-4">
                                <a 
                                    href={r.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full py-5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-2xl shadow-teal-500/20 hover:scale-[1.02] active:scale-95"
                                >
                                    Open Resource <Icons.external size={18} strokeWidth={3} />
                                </a>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setIsFlagModalOpen(true)}
                                        className="py-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:bg-rose-500 hover:text-white hover:border-rose-400 transition-all flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest"
                                    >
                                        <Icons.report size={16} /> Report
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className={`py-4 border rounded-2xl transition-all flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest ${isSaved ? 'bg-teal-500/20 border-teal-500/40 text-teal-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}
                                    >
                                        {isSaved ? <Icons.check size={16} /> : <Icons.plus size={16} />} {isSaved ? 'Saved' : 'Save'}
                                    </button>
                                </div>
                                
                                <div className="flex gap-4">
                                    <button onClick={() => setShareOpen(!shareOpen)} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                                        <Icons.share size={16} /> Share
                                    </button>
                                    {(isAdmin || (user && r.addedBy === user.uid)) && (
                                        <button onClick={handleDelete} className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all">
                                            <Icons.trash size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Ratings & Metadata */}
                            <div className="glass-card p-8 space-y-8 border-white/5">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Community Evaluation</h4>
                                    <div className="flex items-center justify-between">
                                        <Rating value={r.averageRating || 0} count={r.reviewCount || 0} />
                                        <div className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Verified Metrics</div>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Architecture</span>
                                        <span className="text-xs font-bold text-white capitalize">{r.platform}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Pricing Model</span>
                                        <span className="text-xs font-bold text-teal-400 capitalize">{r.pricing}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Intelligence Type</span>
                                        <span className="text-xs font-bold text-white capitalize">{r.type}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Primary Categories</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {r.categories?.map(cat => (
                                            <span key={cat} className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] font-black text-white/60 uppercase tracking-tighter">
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Intelligence Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {r.tags?.map(tag => (
                                            <span key={tag} className="text-[10px] font-bold text-white/30 italic hover:text-teal-400 transition-colors">#{tag}</span>
                                        ))}
                                        {(isAdmin || (user && r.addedBy === user.uid)) && (
                                            <button onClick={() => setIsTagInputOpen(true)} className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-all">+</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Curation Workbench */}
                            {(isAdmin || (user && r.addedBy === user.uid)) && (
                                <div className="glass-card p-8 border-teal-500/20 bg-teal-500/5">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-500">
                                            <Icons.settings size={16} />
                                        </div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">Curation Workbench</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <Link href={`/resources/${r.id}/edit`} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group/edit">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover/edit:text-white">Hard Refactor</span>
                                            <Icons.edit size={14} className="text-white/20 group-hover/edit:text-teal-400" />
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Intelligence Origin */}
                            <div className="glass-card p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-500">
                                        <Icons.user size={16} />
                                    </div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Intelligence Origin</h3>
                                </div>
                                <div className="space-y-3">
                                    {deduplicateAttributions(r.attributions || []).map((attr, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl group/attr">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-teal-500/20 overflow-hidden">
                                                    {attr.photoURL ? (
                                                        <img src={attr.photoURL} alt={attr.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        attr.name.charAt(0)
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-white truncate">{attr.name}</div>
                                                    <div className="text-[8px] font-black uppercase text-white/20">{attr.role || 'Contributor'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
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
                onSelect={(url) => {
                    handleUpdateField('thumbnailUrl', url);
                    setIsPickerOpen(false);
                }}
                onClose={() => setIsPickerOpen(false)}
            />

            {isFlagModalOpen && (
                <FlagModal
                    resourceId={resourceId}
                    resourceTitle={r.title}
                    onClose={() => setIsFlagModalOpen(false)}
                    onSuccess={() => {
                        setIsFlagModalOpen(false);
                        // Force real-time refresh of resource status
                        queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                        addToast('Report submitted successfully. Regulatory review pending.', 'success');
                    }}
                />
            )}

            <ConfirmationModal
                isOpen={fixModalOpen}
                title="Initiate Sovereign Active Fix"
                message={`Are you sure you want to trigger the automated remediation protocol for this issue? This will perform the following predictive action: \n\n"${predictiveAction}"`}
                confirmText="Trigger Fix"
                onConfirm={async () => {
                    setFixModalOpen(false);
                    setActiveFixPending(true);
                    try {
                        const result = await triggerTicketFixAction(effectiveTicketId!);
                        if (result.success) {
                            addToast('Active Fix applied successfully. Systemic integrity restored.', 'success');
                            queryClient.invalidateQueries({ queryKey: ['resource', resourceId] });
                            queryClient.invalidateQueries({ queryKey: ['ticket', effectiveTicketId] });
                            router.refresh();
                        } else {
                            addToast(`Fix failed: ${result.message}`, 'error');
                        }
                    } catch (error) {
                        addToast('Critical error triggering fix protocol.', 'error');
                    } finally {
                        setActiveFixPending(false);
                    }
                }}
                onClose={() => setFixModalOpen(false)}
            />
            <Footer />
        </div>
    );
}
