'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getYouTubeEmbedUrl, extractYouTubeId, isYouTubeUrl, isGenericYouTubeName, deduplicateAttributions } from '@/lib/youtube';
import Modal from '@/components/Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CreatorChip from '@/components/CreatorChip';
import { Icons } from '@/components/ui/Icons';

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

    const handleUpdateRank = async (newRank: number | null) => {
        if (!isAdmin || !resource) return;
        
        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    rank: newRank
                }),
            });

            const result = await response.json();
            if (result.success) {
                setResource(prev => ({ ...prev, rank: newRank }));
            }
        } catch (error) {
            console.error('Error updating rank:', error);
        }
    };

    const handleUpdateFeatured = async (featured: boolean | null) => {
        if (!isAdmin || !resource) return;
        
        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    isFavorite: featured
                }),
            });

            const result = await response.json();
            if (result.success) {
                setResource(prev => ({ ...prev, isFavorite: featured }));
            }
        } catch (error) {
            console.error('Error updating featured status:', error);
        }
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
            const response = await fetch(`/api/youtube/extract?videoId=${videoId}&uid=${user?.uid || ''}`);
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
            const response = await fetch(`/api/links/extract?url=${encodeURIComponent(extractUrl)}&uid=${user?.uid || ''}`);
            const result = await response.json();
            if (result.success && result.data.links.length > 0) {
                setExtractedLinks(result.data.links);
                setSelectedLinks(new Set(result.data.links.map((l: any) => l.url)));
                setIsLinkSelectionOpen(true);
            } else {
                alert(result.error || 'No links found on that page.');
            }
        } catch (error: any) {
            console.error('Error extracting links:', error);
            if (error.status === 403 || error.code === 'LIMIT_REACHED') {
                alert('Daily Magic AI limit reached. Upgrade to Pro for unlimited usage.');
                router.push('/pricing');
            } else {
                alert('Failed to extract links. Please try again.');
            }
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
        <div className="page-wrapper dashboard-theme">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    {/* Breadcrumb Navigation - Styled for Premium Hub */}
                    <div className="flex items-center gap-2 mb-12 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                        <Link href="/resources" className="hover:text-indigo-400 transition-colors">Resources Library</Link>
                        <span className="opacity-20">/</span>
                        <span className="text-indigo-400/50">{resource.title}</span>
                    </div>

                    {/* Premium Header - Synchronized with 'Topic Registry' Style */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-16">
                        <div className="hero-section text-left flex-1">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="p-5 bg-indigo-500/10 rounded-[2rem] border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.1)] relative group">
                                    <div className="absolute inset-0 bg-indigo-400/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    {resource.type === 'video' ? <Icons.play className="w-12 h-12 text-indigo-400 relative z-10" /> :
                                     resource.type === 'tool' ? <Icons.settings className="w-12 h-12 text-indigo-400 relative z-10" /> :
                                     <Icons.fileText className="w-12 h-12 text-indigo-400 relative z-10" />}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-3 ml-1">
                                        <Icons.trophy size={12} className="text-amber-400 animate-pulse" />
                                        <span>Curated Architectural Asset</span>
                                    </div>
                                    <h1 className="text-5xl md:text-8xl font-black tracking-[-0.05em] bg-gradient-to-br from-white via-white/90 to-white/30 bg-clip-text text-transparent leading-[0.85] py-2">
                                        {resource.title}
                                    </h1>
                                </div>
                            </div>
                            <div className="relative pl-8">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500/50 to-transparent rounded-full" />
                                <p className="text-white/40 text-xl md:text-2xl font-medium max-w-4xl leading-relaxed italic">
                                    {resource.description}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-6">
                                    {resource.categories?.map((cat) => (
                                        <Link 
                                            key={cat} 
                                            href={`/resources?category=${encodeURIComponent(cat)}`}
                                            className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all"
                                        >
                                            {cat}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions Unit */}
                        <div className="flex flex-wrap items-center gap-4 shrink-0">
                            <a 
                                href={resource.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-12 py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:scale-[1.03] active:scale-95 group"
                            >
                                Launch Asset 
                                <Icons.external size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </a>
                            
                            <button 
                                onClick={handleToggleSave}
                                className={`p-6 rounded-[2rem] border transition-all ${
                                    isSaved ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                                }`}
                                title={isSaved ? 'Remove from collection' : 'Save to collection'}
                            >
                                <Icons.star size={24} fill={isSaved ? "currentColor" : "none"} />
                            </button>
                        </div>
                    </div>

                    <div className="glass-card animate-slide-up" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                            {/* Premium Scrollable Emoji Gallery */}
                            <div className="flex overflow-x-auto gap-4 p-6 bg-white/[0.02] border-b border-white/5 mx-[-2rem] mt-[-2rem] mb-8 custom-scrollbar scroll-smooth">
                                {/* Platform Tile */}
                                <div className="flex-none min-w-[140px] glass-card p-5 transition-all hover:scale-105 border-indigo-500/20 bg-indigo-500/5 group">
                                    <div className="text-4xl mb-4 group-hover:animate-bounce-short">
                                        {resource.platform === 'gemini' ? '♊' :
                                         resource.platform === 'nanobanana' ? '🍌' :
                                         resource.platform === 'chatgpt' ? '🤖' :
                                         resource.platform === 'claude' ? '🎨' :
                                         resource.platform === 'midjourney' ? '🌌' : '🌐'}
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Platform</div>
                                    <div className="text-sm font-black text-white truncate">{resource.platform}</div>
                                </div>

                                {/* Pricing Tile */}
                                <div className={`flex-none min-w-[140px] glass-card p-5 transition-all hover:scale-105 group ${
                                    resource.pricing === 'free' ? 'border-emerald-500/20 bg-emerald-500/5' :
                                    resource.pricing === 'freemium' ? 'border-amber-500/20 bg-amber-500/5' :
                                    'border-blue-500/20 bg-blue-500/5'
                                }`}>
                                    <div className="text-4xl mb-4 group-hover:animate-bounce-short">
                                        {resource.pricing === 'free' ? '🆓' :
                                         resource.pricing === 'freemium' ? '🔓' : '💰'}
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Pricing</div>
                                    <div className="text-sm font-black text-white truncate uppercase">{resource.pricing}</div>
                                </div>

                                {/* Format Tile */}
                                <div className="flex-none min-w-[140px] glass-card p-5 transition-all hover:scale-105 border-purple-500/20 bg-purple-500/5 group">
                                    <div className="text-4xl mb-4 group-hover:animate-bounce-short">
                                        {resource.type === 'video' ? '📺' :
                                         resource.type === 'article' ? '📄' :
                                         resource.type === 'tool' ? '🔧' :
                                         resource.type === 'course' ? '🎓' :
                                         resource.type === 'book' ? '📚' : '📖'}
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Format</div>
                                    <div className="text-sm font-black text-white truncate uppercase">{resource.type}</div>
                                </div>

                                {/* Tags as individual tiles */}
                                {resource.tags && resource.tags.map((tag, idx) => (
                                    <div key={tag} className="flex-none min-w-[120px] glass-card p-5 transition-all hover:scale-105 border-white/5 bg-white/[0.02] group">
                                        <div className="text-2xl mb-4 opacity-30 font-black italic">#{idx+1}</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Tag</div>
                                        <div className="text-sm font-black text-indigo-400 truncate">#{tag}</div>
                                    </div>
                                ))}

                                <div className="flex-none w-8"></div>
                            </div>

                            {/* Admin Management Panel */}
                            {isAdmin && (
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 mb-8">
                                    <div className="flex flex-wrap items-center justify-between gap-6">
                                        <div className="flex flex-col gap-3">
                                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                                <Icons.trophy size={10} className="text-amber-400" /> Discovery Weight (Rank)
                                            </label>
                                            <div className="flex gap-2">
                                                {[null, 1, 2, 3, 5, 10].map((r) => (
                                                    <button
                                                        key={r === null ? 'none' : r}
                                                        type="button"
                                                        onClick={() => handleUpdateRank(r)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                            (r === null && resource.rank === null) || (typeof r === 'number' && resource.rank === r)
                                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/20'
                                                        }`}
                                                    >
                                                        {r === null ? 'None' : r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                                <Icons.star size={10} className="text-amber-400" /> Featured Elevation
                                            </label>
                                            <div className="flex gap-2">
                                                {[
                                                    { label: 'Standard', value: null },
                                                    { label: 'Featured', value: true },
                                                    { label: 'Baseline', value: false }
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.label}
                                                        type="button"
                                                        onClick={() => handleUpdateFeatured(opt.value)}
                                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                            resource.isFavorite === opt.value
                                                                ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20'
                                                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/20'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                <div className="lg:col-span-2 flex flex-col gap-12">
                                    {/* Video Section */}
                                    {ytId && (
                                        <div className="w-full">
                                            <div className="youtube-embed aspect-video rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-black/40">
                                                <iframe
                                                    src={getYouTubeEmbedUrl(ytId)}
                                                    title={resource.title}
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    className="w-full h-full border-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Description */}
                                    <div className="prose-xl text-white/70 leading-relaxed whitespace-pre-wrap">
                                        {resource.description}
                                    </div>

                                    {/* Featured Prompts */}
                                    {resource.prompts && resource.prompts.length > 0 && (
                                        <div>
                                            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest flex items-center gap-4">
                                                <span className="w-8 h-px bg-indigo-500/50" />
                                                Featured Prompts
                                                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs opacity-50 font-black">{resource.prompts.length}</span>
                                            </h3>
                                            <div className="flex flex-col gap-4">
                                                {resource.prompts.map((prompt, idx) => (
                                                    <div key={idx} className="glass-card p-8 group relative overflow-hidden active:scale-[0.99] transition-all">
                                                        <div className="text-white/80 text-lg leading-relaxed whitespace-pre-wrap mb-6">
                                                            {prompt}
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={() => handleCopyPrompt(prompt, idx)}
                                                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                                    copiedPromptIdx === idx ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                                                                }`}
                                                            >
                                                                {copiedPromptIdx === idx ? 'Copied to Clipboard' : '📋 Extract Prompt'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-10">
                                    {/* Authors & Creators */}
                                    {resource.attributions && resource.attributions.length > 0 && (
                                        <div className="glass-card p-6 border-white/5">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-6 flex items-center gap-3">
                                                <Icons.users size={12} />
                                                System Architects
                                            </h3>
                                            <div className="flex flex-col gap-3">
                                                {deduplicateAttributions(resource.attributions || []).map((c, idx) => {
                                                    const isGeneric = isGenericYouTubeName(c.name) && resource.url && isYouTubeUrl(resource.url);
                                                    const name = isGeneric ? 'YouTube' : c.name;
                                                    const attribution = { ...c, name };
                                                    return (
                                                        <CreatorChip key={idx} attribution={attribution} size="lg" />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Private Notes */}
                                    {user && (
                                        <div className="glass-card p-6 border-indigo-500/10 bg-indigo-500/[0.02]">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-3">
                                                    <Icons.fileText size={12} />
                                                    Private Notes
                                                </h3>
                                                <button 
                                                    onClick={() => setIsNoteModalOpen(true)}
                                                    className="p-2 text-white/20 hover:text-indigo-400 transition-colors"
                                                >
                                                    <Icons.edit size={16} />
                                                </button>
                                            </div>
                                            {noteContent ? (
                                                <div className="text-sm text-white/60 leading-relaxed max-h-[300px] overflow-hidden relative">
                                                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none" />
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {noteContent}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="py-4 text-center">
                                                    <p className="text-xs text-white/20 font-bold mb-4 uppercase tracking-widest">No active notes</p>
                                                    <button onClick={() => setIsNoteModalOpen(true)} className="px-4 py-2 border border-white/5 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all">Add Notes</button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Admin Controls Area */}
                                    {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                        <div className="flex flex-col gap-3 mt-4">
                                            <Link href={`/resources/${resource.id}/edit`} className="w-full py-4 glass-card text-center text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-all">✏️ Refine Architecture</Link>
                                            <button onClick={handleDelete} disabled={deleting} className="w-full py-4 glass-card border-rose-500/20 text-rose-500/40 text-center text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 transition-all">
                                                {deleting ? 'Decommissioning...' : '🗑 Discard Asset'}
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                title={`Analysis: ${resource.title}`}
                maxWidth="800px"
                footer={
                    <div className="flex justify-between w-full items-center">
                        <div className={`text-[10px] font-black uppercase tracking-widest ${noteMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{noteMessage.text}</div>
                        <div className="flex gap-3">
                            <button className="px-5 py-2 rounded-xl bg-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest" onClick={() => setIsNoteModalOpen(false)}>Discard</button>
                            <button className="px-7 py-2 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20" onClick={handleSaveNote} disabled={isSavingNote}>{isSavingNote ? 'Syncing...' : '💾 Sync Note'}</button>
                        </div>
                    </div>
                }
            >
                <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center p-2 bg-black/40 border border-white/5 rounded-2xl">
                        <div className="flex gap-1">
                            <button className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all font-black" onClick={() => insertMarkdown('**', '**')}>B</button>
                            <button className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all italic" onClick={() => insertMarkdown('*', '*')}>I</button>
                            <button className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all" onClick={() => insertMarkdown('### ')}>H</button>
                            <button className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all" onClick={() => insertMarkdown('[', '](url)')}>🔗</button>
                            <button className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all" onClick={() => insertMarkdown('```\n', '\n```')}>{'<>'}</button>
                            <div className="w-px h-6 bg-white/5 mx-1" />
                            <button className="w-10 h-10 flex items-center justify-center text-indigo-400/60 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all" onClick={extractYouTubeLinks} disabled={isExtracting} title="Extract from YouTube">{isExtracting ? '⏳' : '📺'}</button>
                            <button className="w-10 h-10 flex items-center justify-center text-indigo-400/60 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all" onClick={() => setIsUrlInputOpen(true)} disabled={isExtracting} title="Extract from URL">{isExtracting ? '⏳' : '🌐'}</button>
                        </div>
                        <button className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all" onClick={() => setIsPreviewMode(!isPreviewMode)}>{isPreviewMode ? '✏️ Architect' : '👁️ Preview'}</button>
                    </div>

                    {!isPreviewMode ? (
                        <textarea ref={noteTextareaRef} className="w-full min-h-[400px] bg-black/40 border-white/5 rounded-2xl p-6 text-white text-sm outline-none focus:border-indigo-500/50 transition-all font-mono leading-relaxed" placeholder="Document your architectural findings..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
                    ) : (
                        <div className="w-full min-h-[400px] bg-black/40 border-white/5 rounded-2xl p-6 overflow-y-auto prose prose-invert max-w-none">
                            {noteContent ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {noteContent}
                                </ReactMarkdown>
                            ) : (
                                <div className="text-white/20 italic font-bold">Concept stage - No data recorded.</div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Sub-Modals for Link Extraction */}
            <Modal isOpen={isLinkSelectionOpen} onClose={() => setIsLinkSelectionOpen(false)} title="Registry Extraction" maxWidth="600px" footer={<div className="flex justify-end gap-3 w-full"><button className="px-6 py-2 bg-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest rounded-xl" onClick={() => setIsLinkSelectionOpen(false)}>Discard</button><button className="px-8 py-2 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg" onClick={insertSelectedLinks}>Import {selectedLinks.size} Assets</button></div>}>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl mb-2">
                        <input type="checkbox" checked={selectedLinks.size === extractedLinks.length} onChange={(e) => setSelectedLinks(e.target.checked ? new Set(extractedLinks.map(l => l.url)) : new Set())} className="w-4 h-4 rounded border-white/10 bg-black/40 text-indigo-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-white/40">Select All Assets</span>
                    </div>
                    {extractedLinks.map((link, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 hover:bg-white/[0.02] rounded-2xl transition-colors border border-transparent hover:border-white/5">
                            <input type="checkbox" checked={selectedLinks.has(link.url)} onChange={() => toggleLinkSelection(link.url)} className="w-4 h-4 rounded border-white/10 bg-black/40 text-indigo-500 mt-1" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white truncate mb-1">{link.title}</div>
                                <div className="text-[10px] font-medium text-white/30 truncate uppercase tracking-tight">{link.url}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            <Modal isOpen={isUrlInputOpen} onClose={() => { setIsUrlInputOpen(false); setExtractUrl(''); }} title="Remote Extraction" maxWidth="500px" footer={<div className="flex justify-end gap-3 w-full"><button className="px-6 py-2 bg-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest rounded-xl" onClick={() => { setIsUrlInputOpen(false); setExtractUrl(''); }}>Cancel</button><button className="px-8 py-2 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg" onClick={extractLinksFromUrl} disabled={!extractUrl.trim()}>Start Scan</button></div>}>
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-white/40 leading-relaxed">Specify a remote registry URL to perform a Magic AI scan for architectural assets.</p>
                    <input type="url" className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500/50 transition-all font-medium" placeholder="https://registry.example.com" value={extractUrl} onChange={(e) => setExtractUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && extractUrl.trim() && extractLinksFromUrl()} autoFocus />
                </div>
            </Modal>

            <Modal isOpen={isUnsavedChangesModalOpen} onClose={() => setIsUnsavedChangesModalOpen(false)} title="Conflict Warning" maxWidth="400px" footer={<div className="flex justify-end gap-3 w-full"><button className="px-6 py-2 bg-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest rounded-xl" onClick={() => setIsUnsavedChangesModalOpen(false)}>Continue Architecting</button><button className="px-8 py-2 bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-rose-600/20" onClick={() => { setIsUnsavedChangesModalOpen(false); setIsNoteModalOpen(false); setNoteContent(initialNoteContent); }}>Discard Work</button></div>}>
                <div className="p-2">
                    <p className="text-sm text-white/60 leading-relaxed">You have unsynchronized architectural notes. Discarding will permanently remove these records from the session.</p>
                </div>
            </Modal>

            <Footer />
        </div>
    );
}
