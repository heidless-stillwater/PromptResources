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
import NextImage from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CreatorChip from '@/components/CreatorChip';
import { Icons } from '@/components/ui/Icons';
import Rating from '@/components/Rating';

interface ResourceDetailClientProps {
    initialResource: Resource;
}

export default function ResourceDetailClient({ initialResource }: ResourceDetailClientProps) {
    const router = useRouter();
    const { user, isAdmin } = useAuth();
    const [resource, setResource] = useState<Resource>(initialResource);
    const [isSaved, setIsSaved] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);
    
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
            } catch (error) { console.error('Error fetching user specific data:', error); }
        }
        fetchUserSpecificData();
    }, [resourceId, user]);

    const handleToggleSave = async () => {
        if (!user) return router.push('/auth/login');
        try {
            const response = await fetch('/api/user-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, resourceId, action: isSaved ? 'unsave' : 'save' }),
            });
            const result = await response.json();
            if (result.success) setIsSaved(!isSaved);
        } catch (error) { console.error('Error updating saved status:', error); }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this resource?')) return;
        setDeleting(true);
        try {
            const token = await user?.getIdToken();
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) router.push('/resources');
        } catch (error) { console.error('Error deleting resource:', error); setDeleting(false); }
    };

    const handleCopyPrompt = (text: string, idx: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPromptIdx(idx);
            setTimeout(() => setCopiedPromptIdx(null), 2000);
        });
    };

    const handleUpdateRank = async (newRank: number | null) => {
        if (!isAdmin) return;
        try {
            const token = await user?.getIdToken();
            await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ rank: newRank }),
            });
            setResource(prev => ({ ...prev, rank: newRank }));
        } catch (error) { console.error('Error updating rank:', error); }
    };

    const handleUpdateFeatured = async (featured: boolean | null) => {
        if (!isAdmin) return;
        try {
            const token = await user?.getIdToken();
            await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ isFavorite: featured }),
            });
            setResource(prev => ({ ...prev, isFavorite: featured }));
        } catch (error) { console.error('Error updating featured status:', error); }
    };

    const handleSaveNote = async () => {
        if (!user) return;
        setIsSavingNote(true);
        try {
            await fetch(`/api/user-notes/${resourceId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, content: noteContent }),
            });
            setInitialNoteContent(noteContent);
            setNoteMessage({ type: 'success', text: 'Note synchronized!' });
            setTimeout(() => setIsNoteModalOpen(false), 1500);
        } catch (error) { setNoteMessage({ type: 'error', text: 'Sync failed.' }); }
        finally { setIsSavingNote(false); }
    };

    const insertMarkdown = (prefix: string, suffix: string = '') => {
        if (!noteTextareaRef.current) return;
        const textarea = noteTextareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const newText = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
        setNoteContent(newText);
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, end + prefix.length); }, 0);
    };

    const extractYouTubeLinks = async () => {
        let videoId = resource?.youtubeVideoId;
        if (!videoId && resource?.url) videoId = extractYouTubeId(resource.url) || undefined;
        if (!videoId) { alert('No YouTube source found.'); return; }
        setIsExtracting(true);
        try {
            const response = await fetch(`/api/youtube/extract?videoId=${videoId}&uid=${user?.uid || ''}`);
            const result = await response.json();
            if (result.success && result.data.links.length > 0) {
                setExtractedLinks(result.data.links);
                setSelectedLinks(new Set(result.data.links.map((l: any) => l.url)));
                setIsLinkSelectionOpen(true);
            } else alert('No description links found.');
        } catch (error) { console.error('Extraction error:', error); }
        finally { setIsExtracting(false); }
    };

    const ytId = resource.youtubeVideoId || (resource.mediaFormat === 'youtube' ? extractYouTubeId(resource.url) : null);

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#020617] text-white selection:bg-primary/30 font-inter">
            <Navbar />

            <div className="main-content">
                {/* ── PREMIUM CINEMATIC HERO SECTION ── */}
                <div className="relative w-full overflow-hidden border-b border-white/5 bg-[#020617]">
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent opacity-60" />
                        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[180px] opacity-40 animate-pulse" />
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '60px 60px' }} />
                    </div>

                    <div className="container relative z-10 pt-24 pb-32">
                        <div className="flex flex-col gap-10">
                            {/* Header Pathing (Breadcrumbs) */}
                            <div className="flex items-center gap-4 animate-fade-in-up">
                                <Link href="/resources" className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-primary/20 hover:border-primary/30 transition-all group">
                                    <Icons.arrowLeft size={18} className="text-white/40 group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
                                </Link>
                                <div className="flex flex-col">
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                        Registry Intelligence / Assets
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                        <span className="text-primary/60 uppercase">Resource Detail</span>
                                        <span className="opacity-20">/</span>
                                        <span className="truncate max-w-[200px]">{resource.title}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Title Group */}
                            <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
                                <div className="max-w-4xl space-y-6">
                                    <div className="space-y-4">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-primary animate-fade-in-up-delay-1">
                                            <Icons.database size={12} /> Master Asset Registry
                                        </div>
                                        <h1 className="text-4xl md:text-6xl font-black font-outfit tracking-tighter text-white leading-none animate-fade-in-up-delay-2">
                                            {resource.title}
                                        </h1>
                                    </div>
                                    <p className="text-white/50 max-w-2xl text-base md:text-lg font-medium leading-relaxed animate-fade-in-up-delay-3">
                                        {resource.description}
                                    </p>
                                </div>

                                {/* Primary Actions */}
                                <div className="flex flex-wrap lg:flex-col items-center gap-5 animate-fade-in-up-delay-4 shrink-0">
                                    <a 
                                        href={resource.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="px-10 py-5 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-3 group"
                                    >
                                        Launch Interface 
                                        <Icons.external size={16} strokeWidth={3} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </a>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={handleToggleSave}
                                            className={`w-14 h-14 flex items-center justify-center rounded-2xl border transition-all ${
                                                isSaved ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-white/20 hover:text-white hover:bg-white/10'
                                            }`}
                                            title="Save to Library"
                                        >
                                            <Icons.star size={24} fill={isSaved ? "currentColor" : "none"} />
                                        </button>
                                        {(isAdmin || (user && resource.addedBy === user.uid)) && (
                                            <Link 
                                                href={`/resources/${resource.id}/edit`}
                                                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/20 hover:text-white hover:bg-white/10 transition-all"
                                                title="Edit Asset"
                                            >
                                                <Icons.edit size={24} />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <main className="container relative z-20 -mt-28 pb-32">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* Left Column: Core Intelligence */}
                        <div className="lg:col-span-8 flex flex-col gap-10">
                            {/* Primary Media Unit */}
                            <div className="glass-card bg-[#0a0a0f]/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-4 shadow-2xl overflow-hidden">
                                {ytId ? (
                                    <div className="aspect-video rounded-2xl overflow-hidden border border-white/5 bg-black/40 relative group">
                                        <iframe
                                            src={getYouTubeEmbedUrl(ytId)}
                                            title={resource.title}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="w-full h-full border-none"
                                        />
                                    </div>
                                ) : resource.thumbnailUrl ? (
                                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/5">
                                        <NextImage 
                                            src={resource.thumbnailUrl} 
                                            alt={resource.title} 
                                            fill 
                                            className="object-cover"
                                            priority
                                        />
                                    </div>
                                ) : (
                                    <div className="aspect-video rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center">
                                        <Icons.database size={60} className="text-white/5" />
                                    </div>
                                )}

                                {/* Quick Stats Belt */}
                                <div className="flex flex-wrap items-center gap-12 p-10">
                                    <div className="flex flex-col gap-3">
                                        <span className="text-[10px] uppercase font-black tracking-[0.25em] text-white/30">Platform Domain</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{resource.platform === 'gemini' ? '♊' : resource.platform === 'chatgpt' ? '🤖' : '🌐'}</span>
                                            <span className="text-4xl font-black font-outfit text-white uppercase tracking-tighter">{resource.platform}</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-16 bg-white/5 hidden md:block" />
                                    <div className="flex flex-col gap-3">
                                        <span className="text-[10px] uppercase font-black tracking-[0.25em] text-white/30">Access Protocol</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{resource.pricing === 'free' ? '🆓' : '💰'}</span>
                                            <span className="text-4xl font-black font-outfit text-white uppercase tracking-tighter">{resource.pricing}</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-16 bg-white/5 hidden md:block" />
                                    <div className="flex flex-col gap-3">
                                        <span className="text-[10px] uppercase font-black tracking-[0.25em] text-white/30">Asset Architecture</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{resource.type === 'video' ? '📺' : '📄'}</span>
                                            <span className="text-4xl font-black font-outfit text-white uppercase tracking-tighter">{resource.type}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Description & Structured Intelligence */}
                            <div className="glass-card bg-[#0a0a0f]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-xl">
                                <h2 className="text-3xl font-black font-outfit text-white tracking-tighter mb-8 flex items-center gap-4">
                                    Architectural Overview
                                </h2>
                                <div className="prose prose-invert prose-lg max-w-none text-white/50 leading-relaxed font-medium">
                                    {resource.description}
                                </div>
                            </div>

                            {/* Prompts Gallery */}
                            {resource.prompts && resource.prompts.length > 0 && (
                                <div className="flex flex-col gap-8">
                                    <h2 className="text-3xl font-black font-outfit text-white tracking-tighter mb-2">Fragment Extraction</h2>
                                    <div className="flex flex-col gap-6">
                                        {resource.prompts.map((prompt, idx) => (
                                            <div key={idx} className="glass-card group bg-white/[0.02] border border-white/10 rounded-2xl p-8 hover:border-primary/30 transition-all relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="text-white/60 text-base leading-relaxed mb-8 whitespace-pre-wrap font-medium">
                                                    {prompt}
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => handleCopyPrompt(prompt, idx)}
                                                        className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                            copiedPromptIdx === idx ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border-white/5 text-white/30 hover:text-white hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {copiedPromptIdx === idx ? 'Copied to Clipboard' : '📋 Extract Fragment'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Governance & Identity */}
                        <div className="lg:col-span-4 flex flex-col gap-10">
                            {/* Pioneer Identity Card */}
                            <div className="glass-card bg-[#0a0a0f]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-xl">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 mb-8 flex items-center gap-3">
                                    <Icons.users size={14} className="text-primary/60" />
                                    Pioneer Attribution
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {deduplicateAttributions(resource.attributions || []).map((c, idx) => {
                                        const isGeneric = isGenericYouTubeName(c.name) && resource.url && isYouTubeUrl(resource.url);
                                        const name = isGeneric ? 'YouTube' : c.name;
                                        return <CreatorChip key={idx} attribution={{ ...c, name }} size="md" showExternalIcon />;
                                    })}
                                </div>
                            </div>

                            {/* Private Intelligence (Notes) */}
                            {user && (
                                <div className="glass-card bg-primary/[0.02] backdrop-blur-2xl border border-primary/10 rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-12 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all pointer-events-none" />
                                    <div className="flex justify-between items-center mb-8 relative z-10">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary flex items-center gap-3">
                                            <Icons.text size={14} />
                                            Private Intelligence
                                        </h3>
                                        <button 
                                            onClick={() => setIsNoteModalOpen(true)}
                                            className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
                                            title="Open Console"
                                        >
                                            <Icons.edit size={16} />
                                        </button>
                                    </div>

                                    <div className="relative z-10">
                                        {noteContent ? (
                                            <div className="prose prose-invert prose-sm line-clamp-6 text-white/50 font-medium">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="py-12 text-center border-2 border-dashed border-primary/10 rounded-2xl bg-black/20">
                                                <Icons.edit size={24} className="mx-auto mb-3 text-primary/20" />
                                                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Initialize Fragment Notes</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Discovery Administration (Admin only) */}
                            {isAdmin && (
                                <div className="glass-card bg-amber-500/[0.02] backdrop-blur-2xl border border-amber-500/10 rounded-[2.5rem] p-10 shadow-xl">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500/60 mb-8 flex items-center gap-3">
                                        <Icons.trophy size={14} />
                                        Discovery Administration
                                    </h3>
                                    
                                    <div className="space-y-8">
                                        <div className="flex flex-col gap-4">
                                            <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Sovereign Sentinel</label>
                                            <button 
                                                onClick={() => handleUpdateFeatured(!resource.isFavorite)}
                                                className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                    resource.isFavorite ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 border-white/10 text-white/30 hover:text-white'
                                                }`}
                                            >
                                                {resource.isFavorite ? 'Featured Status Active' : 'Elevate to Featured'}
                                            </button>
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Discovery Weight</label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {[1, 2, 3, 4, 5].map((num) => (
                                                    <button
                                                        key={num}
                                                        onClick={() => handleUpdateRank(resource.rank === num ? null : num)}
                                                        className={`h-10 rounded-lg flex items-center justify-center text-xs font-black transition-all border ${
                                                            resource.rank === num ? 'bg-primary border-primary text-white shadow-md' : 'bg-white/5 border-white/10 text-white/20 hover:text-white'
                                                        }`}
                                                    >
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {(ytId || resource.url) && (
                                            <div className="flex flex-col gap-4">
                                                <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Content Discovery</label>
                                                <button 
                                                    onClick={extractYouTubeLinks}
                                                    disabled={isExtracting}
                                                    className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-primary/20 hover:border-primary/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                                >
                                                    {isExtracting ? <Icons.spinner className="animate-spin" size={14} /> : <Icons.search size={14} />}
                                                    Extract Source Links
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            <Footer />

            {/* Note Console Modal */}
            <Modal isOpen={isNoteModalOpen} onClose={() => {
                if (noteContent !== initialNoteContent) setIsUnsavedChangesModalOpen(true);
                else setIsNoteModalOpen(false);
            }} title="Intelligence Console">
                <div className="flex flex-col gap-6 p-2 min-h-[500px]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex gap-2">
                            <button onClick={() => setIsPreviewMode(false)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isPreviewMode ? 'bg-primary text-white' : 'text-white/30 hover:text-white/60'}`}>Markdown</button>
                            <button onClick={() => setIsPreviewMode(true)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isPreviewMode ? 'bg-primary text-white' : 'text-white/30 hover:text-white/60'}`}>Intelligence Preview</button>
                        </div>
                        {!isPreviewMode && (
                            <div className="flex gap-2">
                                <button onClick={() => insertMarkdown('**', '**')} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/60" title="Bold"><Icons.star size={14} /></button>
                                <button onClick={() => insertMarkdown('- ')} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/60" title="Bullet List"><Icons.list size={14} /></button>
                                <button onClick={() => insertMarkdown('[', '](url)')} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/60" title="Link"><Icons.external size={14} /></button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col relative">
                        {isPreviewMode ? (
                            <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-8 overflow-y-auto prose prose-invert prose-lg max-w-none shadow-inner">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent || '*No intelligence captured yet.*'}</ReactMarkdown>
                            </div>
                        ) : (
                            <textarea
                                ref={noteTextareaRef}
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder="Capture fragment intelligence, architectural patterns, or implementation notes..."
                                className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-8 text-white/80 font-medium leading-relaxed outline-none focus:border-primary/30 transition-all resize-none shadow-inner custom-scrollbar"
                            />
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${noteContent === initialNoteContent ? 'bg-white/10' : 'bg-primary animate-pulse'}`} />
                            <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">
                                {noteContent === initialNoteContent ? 'Console Synchronized' : 'Draft Persistence Active'}
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            {noteMessage.text && (
                                <span className={`text-[10px] font-black uppercase tracking-widest ${noteMessage.type === 'success' ? 'text-primary' : 'text-rose-500'}`}>
                                    {noteMessage.text}
                                </span>
                            )}
                            <button
                                onClick={handleSaveNote}
                                disabled={isSavingNote || noteContent === initialNoteContent}
                                className="px-10 py-4 bg-primary disabled:bg-white/10 text-white disabled:text-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 active:scale-95"
                            >
                                {isSavingNote ? 'Synchronizing...' : 'Sync Intelligence'}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
