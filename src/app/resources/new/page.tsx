'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Modal from '@/components/Modal';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Attribution, Platform, ResourcePricing, ResourceType, MediaFormat, ResourceStatus } from '@/lib/types';
import { suggestCategories, suggestAttributions, getDefaultCategories, suggestDescription, suggestTags } from '@/lib/suggestions';
import { extractYouTubeId, isYouTubeUrl, fetchYouTubeMetadata, isGenericYouTubeName, deduplicateAttributions } from '@/lib/youtube';
import ThumbnailPicker from '@/components/ThumbnailPicker';

export default function NewResourcePage() {
    const { user, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [type, setType] = useState<ResourceType>('article');
    const [mediaFormat, setMediaFormat] = useState<MediaFormat>('webpage');
    const [platform, setPlatform] = useState<Platform>('nanobanana');
    const [pricing, setPricing] = useState<ResourcePricing>('free');
    const [pricingDetails, setPricingDetails] = useState('');
    const [tags, setTags] = useState('');
    const [prompts, setPrompts] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
    const [attributions, setAttributions] = useState<Attribution[]>([{ name: '', url: '' }]);
    const [status, setStatus] = useState<ResourceStatus>(isAdmin ? 'published' : 'suggested');
    const [suggestedAttributions, setSuggestedAttributions] = useState<Attribution[]>([]);
    const [ytMetadata, setYtMetadata] = useState<any>(null);
    const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
    const [rank, setRank] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [error, setError] = useState('');
    const [dupWarning, setDupWarning] = useState<{ matches: Array<{ id: string; title: string; url: string; matchType: 'title' | 'url' }> } | null>(null);
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [liveCheck, setLiveCheck] = useState<{ titleMatch: boolean; urlMatch: boolean }>({ titleMatch: false, urlMatch: false });

    const allCategories = getDefaultCategories();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const syncYouTubeData = async (targetUrl: string) => {
        if (!targetUrl || !isYouTubeUrl(targetUrl)) return;
        
        setIsSyncing(true);
        setSyncError(null);
        
        try {
            const data = await fetchYouTubeMetadata(targetUrl);
            if (data && data.author_name) {
                const channelName = data.author_name;
                
                // Set suggested values
                setAttributions(prev => {
                    // If attributions list contains generic placeholder or is empty, update/add
                    if (prev.length === 0 || (prev.length === 1 && !prev[0].name && !prev[0].url)) {
                        return [{ name: channelName, url: data.author_url || targetUrl }];
                    }
                    
                    const hasGeneric = prev.some(c => isGenericYouTubeName(c.name));
                    if (hasGeneric) {
                        return prev.map(c => isGenericYouTubeName(c.name) ? { ...c, name: channelName, url: data.author_url || targetUrl } : c);
                    }
                    
                    // If channel name is not already in attributions, add it
                    if (!prev.some(c => c.name === channelName)) {
                        return [...prev, { name: channelName, url: data.author_url || targetUrl }];
                    }
                    
                    return prev;
                });
                
                if (!title && data.title) setTitle(data.title);
                if (data.thumbnail_url) setThumbnailUrl(data.thumbnail_url);
                
                // Also trigger logic-based suggestions
                const currentTitle = title || data.title || '';
                if (currentTitle) {
                    const cats = suggestCategories(currentTitle, description, targetUrl, { tags, type, mediaFormat, platform, pricing });
                    if (selectedCategories.length === 0) {
                        setSelectedCategories(cats);
                    }
                    
                    const suggestedTags = suggestTags(currentTitle, description, targetUrl);
                    if (!tags && suggestedTags.length > 0) {
                        setTags(suggestedTags.join(', '));
                    }
                    
                    if (!description) {
                        const desc = suggestDescription(currentTitle);
                        if (desc) setDescription(desc);
                    }
                }
                
                setYtMetadata(data); // This will update Suggested Pills via useEffect
            } else {
                setSyncError("Could not fetch metadata. Make sure it's a public YouTube URL.");
            }
        } catch (err) {
            setSyncError("YouTube sync failed. Please try again.");
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-detect YouTube and suggest categories/attributions
    useEffect(() => {
        if (url && isYouTubeUrl(url)) {
            setMediaFormat('youtube');
            setType('video');
            
            // Only auto-sync if url looks like a video ID
            if (url.includes('watch?v=') || url.includes('youtu.be/')) {
                syncYouTubeData(url);
            }
        } else if (url && (url.endsWith('.pdf') || url.includes('/pdf/'))) {
            setMediaFormat('pdf');
            setType('article'); // Assuming PDF is usually an article/document
        } else {
            setYtMetadata(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    useEffect(() => {
        if (title || url) {
            const cats = suggestCategories(title, description, url, { tags, type, mediaFormat, platform, pricing });
            setSuggestedCategories(cats);
            const creds = suggestAttributions(url, title, { authorName: ytMetadata?.author_name, authorUrl: ytMetadata?.author_url });
            setSuggestedAttributions(creds);
        }
    }, [title, description, url, ytMetadata, tags, type, mediaFormat, platform, pricing]);

    // Live duplicate check — debounced 700ms after user stops typing
    useEffect(() => {
        const trimmedTitle = title.trim();
        const trimmedUrl = url.trim();
        if (!trimmedTitle && !trimmedUrl) {
            setLiveCheck({ titleMatch: false, urlMatch: false });
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams();
                if (trimmedTitle) params.set('title', trimmedTitle);
                if (trimmedUrl) params.set('url', trimmedUrl);
                const token = user ? await user.getIdToken() : '';
                const res = await fetch(`/api/resources/check-duplicate?${params.toString()}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                });
                const data = await res.json();
                setLiveCheck({ titleMatch: data.titleMatch, urlMatch: data.urlMatch });
            } catch {
                // silent fail — check happens on submit too
            }
        }, 700);
        return () => clearTimeout(timer);
    }, [title, url, user]);

    // Fetch Hub Library Default Image on Load
    useEffect(() => {
        const fetchDefaultHubImage = async () => {
            try {
                const q = query(
                    collection(db, 'thumbnailAssets'), 
                    where('isDefault', '==', true),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const defaultAsset = snapshot.docs[0].data();
                    if (!thumbnailUrl) { // Only set if user hasn't already picked one/youtube sync haven't run
                        setThumbnailUrl(defaultAsset.url);
                    }
                }
            } catch (error) {
                console.error('Error fetching default hub image:', error);
            }
        };
        fetchDefaultHubImage();
    }, []);

    const addCategory = (cat: string) => {
        if (!selectedCategories.includes(cat)) {
            setSelectedCategories([...selectedCategories, cat]);
        }
    };

    const removeCategory = (cat: string) => {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    };

    const addAttribution = () => {
        setAttributions([...attributions, { name: '', url: '' }]);
    };

    const removeAttribution = (idx: number) => {
        setAttributions(attributions.filter((_, i) => i !== idx));
    };

    const updateAttribution = (idx: number, field: keyof Attribution, value: string) => {
        const updated = [...attributions];
        updated[idx] = { ...updated[idx], [field]: value };
        setAttributions(updated);
    };

    const toggleSelfAttribution = () => {
        if (!user) return;
        const selfIdx = attributions.findIndex(a => a.userId === user.uid);
        if (selfIdx >= 0) {
            removeAttribution(selfIdx);
        } else {
            setAttributions([...attributions, { name: user.displayName || 'Me', userId: user.uid, url: '', role: 'author' }]);
        }
    };

    const applySuggestedAttribution = (attribution: Attribution) => {
        const empty = attributions.findIndex((c) => !c.name && !c.url);
        if (empty >= 0) {
            const updated = [...attributions];
            updated[empty] = attribution;
            setAttributions(updated);
        } else {
            setAttributions([...attributions, attribution]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (selectedCategories.length === 0) {
            setError('Please select at least one category.');
            return;
        }

        // Pre-flight duplicate check via server-side API (scoped to this user's resources)
        try {
            const params = new URLSearchParams();
            if (title.trim()) params.set('title', title.trim());
            if (url.trim()) params.set('url', url.trim());
            const token = user ? await user.getIdToken() : '';
            const res = await fetch(`/api/resources/check-duplicate?${params.toString()}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            const data = await res.json();

            if (data.titleMatch || data.urlMatch) {
                setDupWarning({ matches: data.matches });
                setPendingSubmit(true);
                return;
            }
        } catch (err) {
            console.error('Duplicate check failed:', err);
        }

        await doSubmit();
    };

    const doSubmit = async (overwriteId?: string) => {

        const validAttributions = attributions.filter((c) => c.name.trim() && c.url.trim());

        setLoading(true);
        try {
            const youtubeVideoId = extractYouTubeId(url);
            const token = user ? await user.getIdToken() : '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const endpoint = overwriteId ? `/api/resources/${overwriteId}` : '/api/resources';
            const method = overwriteId ? 'PATCH' : 'POST';

            const response = await fetch(endpoint, {
                method,
                headers,
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    url: url.trim(),
                    type,
                    mediaFormat,
                    platform,
                    pricing,
                    pricingDetails: pricingDetails.trim(),
                    categories: selectedCategories,
                    attributions: validAttributions,
                    youtubeVideoId: youtubeVideoId || null,
                    thumbnailUrl: thumbnailUrl.trim() || null,
                    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                    addedBy: user?.uid,
                    status: isAdmin ? status : 'suggested',
                    isFavorite: isFavorite === null ? null : isFavorite,
                    rank: rank === '' ? null : Number(rank),
                    prompts: prompts.split('\n').map(p => p.trim()).filter(Boolean),
                    notes: notes.trim() || null,
                    adminNotes: adminNotes.trim() || null,
                }),
            });

            const result = await response.json();

            if (result.success) {
                router.refresh();
                if (isAdmin) {
                    router.push(`/resources/${overwriteId || result.id || ''}`);
                } else {
                    router.push('/resources?suggested=true');
                }
            } else {
                setError(result.error || 'Failed to submit resource.');
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            setError(error.message || 'Failed to add resource.');
        } finally {
            setLoading(false);
            setPendingSubmit(false);
            setDupWarning(null);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login?redirect=/resources/new');
        }
    }, [user, authLoading, router]);

    if (authLoading) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="main-content">
                    <div className="loading-page">
                        <div className="spinner" />
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect via useEffect
    }

    return (
        <div className="page-wrapper dashboard-theme">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '900px' }}>
                    {/* Breadcrumb */}
                    <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        <Link href="/resources" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                            ← Resources
                        </Link>
                        <span>/</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {isAdmin ? 'Add New Resource' : 'Suggest a Resource'}
                        </span>
                    </div>

                    <div className="admin-header" style={{ marginBottom: 'var(--space-8)' }}>
                        <div className="admin-title-group">
                            <h1 className="admin-title">
                                {isAdmin ? '➕ Add New Resource' : '💡 Suggest a Resource'}
                            </h1>
                            <p className="admin-subtitle">
                                {isAdmin 
                                    ? 'Fill in the details below to add a new resource to the collection.' 
                                    : 'Share a valuable tool, article, or video with the community.'
                                }
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <Link href="/resources" className="btn btn-secondary btn-sm" id="back-to-resources">
                                ← Resources
                            </Link>
                            {isAdmin && (
                                <Link href="/admin" className="btn btn-secondary btn-sm" id="back-to-admin">
                                    Admin
                                </Link>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        {error && (
                            <div style={{
                                padding: 'var(--space-3) var(--space-4)',
                                background: 'rgba(244, 63, 94, 0.1)',
                                border: '1px solid rgba(244, 63, 94, 0.3)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--danger-400)',
                                fontSize: 'var(--text-sm)',
                                marginBottom: 'var(--space-5)',
                            }}>
                                {error}
                            </div>
                        )}

                        <div className="admin-section">
                            <div className="admin-section-header">
                                <h3 className="admin-section-title">
                                    📝 Basic Information
                                </h3>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm btn-glow"
                                    onClick={() => {
                                        const cats = suggestCategories(title, description, url, { tags, type, mediaFormat, platform, pricing });
                                        setSelectedCategories(Array.from(new Set([...selectedCategories, ...cats])));
                                        const creds = suggestAttributions(url, title, { authorName: ytMetadata?.author_name, authorUrl: ytMetadata?.author_url });
                                        if (creds.length > 0) setAttributions(creds);
                                        if (!description) {
                                            const desc = suggestDescription(title);
                                            setDescription(desc);
                                        }
                                        const suggestedTags = suggestTags(title, description, url);
                                        if (suggestedTags.length > 0) {
                                            const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean);
                                            const newTags = Array.from(new Set([...currentTags, ...suggestedTags]));
                                            setTags(newTags.join(', '));
                                        }
                                    }}
                                    id="ai-quick-autofill"
                                    title="Autofill Description, Tags, Categories and Attributions using AI"
                                >
                                    ✨ Magic AI Autofill
                                </button>
                            </div>

                            <div className="admin-form-grid">
                            <div className="form-group col-span-2">
                                <label className="form-label" htmlFor="url">URL *</label>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <input
                                        id="url"
                                        type="url"
                                        className="form-input"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://..."
                                        style={{ flex: 1 }}
                                        required
                                    />
                                    {isYouTubeUrl(url) && (
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => syncYouTubeData(url)}
                                            disabled={isSyncing}
                                            style={{ whiteSpace: 'nowrap' }}
                                        >
                                            {isSyncing ? <div className="spinner-inline" /> : 'Sync Channel'}
                                        </button>
                                    )}
                                </div>
                                {syncError && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger-400)', marginTop: 'var(--space-1)' }}>{syncError}</div>}
                                {liveCheck.urlMatch && (
                                    <div style={{
                                        marginTop: 'var(--space-2)',
                                        padding: 'var(--space-2) var(--space-3)',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--danger-400)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-2)'
                                    }}>
                                        ⚠️ A resource with this URL already exists in the database.
                                    </div>
                                )}
                                <p className="form-helper">The link to the resource (website, video, document, etc.)</p>
                            </div>

                            {isAdmin && (
                                <>
                                    <div className="form-group col-span-2">
                                        <label className="form-label" htmlFor="thumbnailUrl">🖼️ Thumbnail Image URL</label>
                                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                                            <input
                                                id="thumbnailUrl"
                                                type="text"
                                                className="form-input"
                                                value={thumbnailUrl}
                                                onChange={(e) => setThumbnailUrl(e.target.value)}
                                                placeholder="Enter image URL or pick from Nanobanana scenarios..."
                                                style={{ flex: 1 }}
                                            />
                                            {isAdmin && (
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setIsPickerOpen(true)}
                                                    style={{ whiteSpace: 'nowrap', padding: 'var(--space-2) var(--space-4)', fontSize: '12px' }}
                                                >
                                                    📂 Browse scenarios
                                                </button>
                                            )}
                                        </div>
                                        
                                        {thumbnailUrl && (
                                            <div style={{ marginTop: 'var(--space-3)', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '140px', width: '250px', position: 'relative', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                                <img src={thumbnailUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <button 
                                                    type="button" 
                                                    className="btn btn-danger btn-sm" 
                                                    onClick={() => setThumbnailUrl('')}
                                                    style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 10px', fontSize: '11px', boxShadow: 'var(--shadow-lg)' }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                        <p className="form-helper" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            💡 Standard size: 1280x720 (16:9). YouTube URLs will automatically fetch thumbnails.
                                        </p>
                                    </div>
                                    
                                    <ThumbnailPicker 
                                        isOpen={isPickerOpen} 
                                        onClose={() => setIsPickerOpen(false)}
                                        onSelect={(url) => setThumbnailUrl(url)}
                                    />
                                </>
                            )}

                                <div className="form-group col-span-2">
                                    <label className="form-label" htmlFor="title">Title *</label>
                                    <input
                                        id="title"
                                        type="text"
                                        className="form-input"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Ultimate Guide to Gemini Prompt Engineering"
                                        required
                                        style={liveCheck.titleMatch ? { borderColor: 'var(--danger)' } : {}}
                                    />
                                    {liveCheck.titleMatch && (
                                        <div style={{
                                            marginTop: 'var(--space-2)',
                                            padding: 'var(--space-2) var(--space-3)',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--danger-400)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-2)'
                                        }}>
                                            ⚠️ A resource with this title already exists in the database.
                                        </div>
                                    )}
                                </div>

                                   <div className="form-group col-span-2">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                        <label className="form-label" style={{ marginBottom: 0 }}>👥 Creators & Attributions</label>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button
                                                type="button"
                                                className={`btn btn-sm ${attributions.some(a => a.userId === user.uid) ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={toggleSelfAttribution}
                                            >
                                                {attributions.some(a => a.userId === user.uid) ? '✅ I am the Author' : '👤 Add Me as Author'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={addAttribution}
                                            >
                                                ➕ Add Another
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                        {attributions.map((attr, idx) => (
                                            <div key={idx} className="glass-card" style={{ padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr auto', gap: 'var(--space-3)', alignItems: 'end' }}>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Name</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={attr.name}
                                                            onChange={(e) => updateAttribution(idx, 'name', e.target.value)}
                                                            placeholder="Creator name"
                                                            disabled={attr.userId === user.uid}
                                                        />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>URL</label>
                                                        <input
                                                            type="url"
                                                            className="form-input"
                                                            value={attr.url}
                                                            onChange={(e) => updateAttribution(idx, 'url', e.target.value)}
                                                            placeholder="Profile/Video Link"
                                                        />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Role</label>
                                                        <select
                                                            className="form-select"
                                                            value={attr.role || 'author'}
                                                            onChange={(e) => updateAttribution(idx, 'role', e.target.value)}
                                                        >
                                                            <option value="author">Author/Creator</option>
                                                            <option value="curator">Curator/Collector</option>
                                                            <option value="presenter">Presenter</option>
                                                            <option value="contributor">Contributor</option>
                                                        </select>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => removeAttribution(idx)}
                                                        style={{ color: 'var(--danger-400)', padding: 'var(--space-2)' }}
                                                        title="Remove attribution"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {suggestedAttributions.length > 0 && suggestedAttributions.some(s => !attributions.some(a => a.name === s.name)) && (
                                        <div style={{ marginTop: 'var(--space-3)' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>🤖 Suggested from URL:</div>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                {suggestedAttributions
                                                    .filter(s => !attributions.some(a => a.name === s.name))
                                                    .map((s, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            className="chip chip-accent clickable"
                                                            onClick={() => applySuggestedAttribution(s)}
                                                            style={{ fontSize: '11px' }}
                                                        >
                                                            + {s.name}
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group col-span-2">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <label className="form-label" htmlFor="description" style={{ marginBottom: 0 }}>Description *</label>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => {
                                                const desc = suggestDescription(title);
                                                if (desc) setDescription(desc);
                                            }}
                                            id="ai-suggest-description"
                                            disabled={!title}
                                        >
                                            ✨ AI Suggest
                                        </button>
                                    </div>
                                    <textarea
                                        id="description"
                                        className="form-textarea"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe what this resource covers..."
                                        required
                                        rows={4}
                                    />
                                </div>


                                <div className="form-group">
                                    <label className="form-label" htmlFor="type">Resource Type *</label>
                                    <select id="type" className="form-select" value={type} onChange={(e) => setType(e.target.value as ResourceType)}>
                                        <option value="video">Video</option>
                                        <option value="article">Article</option>
                                        <option value="tool">Tool</option>
                                        <option value="course">Course</option>
                                        <option value="book">Book</option>
                                        <option value="tutorial">Tutorial</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="mediaFormat">Media Format *</label>
                                    <select id="mediaFormat" className="form-select" value={mediaFormat} onChange={(e) => setMediaFormat(e.target.value as MediaFormat)}>
                                        <option value="youtube">YouTube</option>
                                        <option value="webpage">Webpage</option>
                                        <option value="pdf">PDF</option>
                                        <option value="image">Image</option>
                                        <option value="audio">Audio</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="platform">Platform *</label>
                                    <select id="platform" className="form-select" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                                        <option value="gemini">Gemini</option>
                                        <option value="nanobanana">NanoBanana</option>
                                        <option value="chatgpt">ChatGPT</option>
                                        <option value="claude">Claude</option>
                                        <option value="midjourney">Midjourney</option>
                                        <option value="general">General</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="pricing">Pricing *</label>
                                    <select id="pricing" className="form-select" value={pricing} onChange={(e) => setPricing(e.target.value as ResourcePricing)}>
                                        <option value="free">Free</option>
                                        <option value="paid">Paid</option>
                                        <option value="freemium">Freemium</option>
                                    </select>
                                </div>

                                {pricing !== 'free' && (
                                    <div className="form-group col-span-2">
                                        <label className="form-label" htmlFor="pricingDetails">Pricing Details</label>
                                        <input
                                            id="pricingDetails"
                                            type="text"
                                            className="form-input"
                                            value={pricingDetails}
                                            onChange={(e) => setPricingDetails(e.target.value)}
                                            placeholder="e.g. $29/month, $99 one-time"
                                        />
                                    </div>
                                )}

                                <div className="form-group col-span-2">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <label className="form-label" htmlFor="tags" style={{ marginBottom: 0 }}>Tags (comma separated)</label>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => {
                                                const suggestedTags = suggestTags(title, description, url);
                                                const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean);
                                                const newTags = Array.from(new Set([...currentTags, ...suggestedTags]));
                                                setTags(newTags.join(', '));
                                            }}
                                            id="ai-suggest-tags"
                                            disabled={!title}
                                        >
                                            ✨ AI Suggest
                                        </button>
                                    </div>
                                    <input
                                        id="tags"
                                        type="text"
                                        className="form-input"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        placeholder="prompt, AI, tutorial, beginner"
                                    />
                                </div>

                                <div className="form-group col-span-2">
                                    <label className="form-label" htmlFor="notes">📖 Public Notes & Instructions</label>
                                    <textarea
                                        id="notes"
                                        className="form-textarea"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Publicly visible notes, special instructions, or context for users..."
                                        rows={3}
                                    />
                                    <p className="form-helper" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Visible to all visitors on the resource detail page</p>
                                </div>

                                <div className="form-group col-span-2">
                                    <label className="form-label" htmlFor="prompts">Prompts (One per line)</label>
                                    <textarea
                                        id="prompts"
                                        className="form-textarea"
                                        value={prompts}
                                        onChange={(e) => setPrompts(e.target.value)}
                                        placeholder="Paste prompts here, one per line..."
                                        rows={5}
                                    />
                                    <p className="form-helper">Add specific prompts that this resource provides or teaches.</p>
                                </div>

                                {isAdmin && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Rank (Priority)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={rank}
                                                onChange={(e) => setRank(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 1 (Top priority)"
                                            />
                                        </div>
                                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 'var(--space-2)' }}>
                                            <div style={{ width: '100%' }}>
                                                <label className="form-label" style={{ fontWeight: 600 }}>⭐ Featured Status</label>
                                                <select 
                                                    className="form-select" 
                                                    value={isFavorite === null ? '' : isFavorite.toString()}
                                                    onChange={(e) => setIsFavorite(e.target.value === '' ? null : e.target.value === 'true')}
                                                >
                                                    <option value="">Not Set (Default)</option>
                                                    <option value="true">Featured</option>
                                                    <option value="false">Not Featured</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="admin-section">
                            <div className="admin-section-header">
                                <h3 className="admin-section-title">🏷️ Categories <span style={{ color: 'var(--danger-400)', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-2)', fontWeight: 400 }}>* (Pick at least one)</span></h3>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        const cats = suggestCategories(title, description, url, { tags, type, mediaFormat, platform, pricing });
                                        setSelectedCategories(Array.from(new Set([...selectedCategories, ...cats])));
                                    }}
                                    id="ai-suggest-categories"
                                >
                                    ✨ AI Suggest
                                </button>
                            </div>

                            <div className="admin-categories-selection">
                                {/* Selected */}
                                <div className="selected-categories-list">
                                    <div className="selection-label">Selected:</div>
                                    <div className="chips-container">
                                        {selectedCategories.map((cat) => (
                                            <span
                                                key={cat}
                                                className="chip chip-primary clickable"
                                                onClick={() => removeCategory(cat)}
                                            >
                                                {cat} <span className="chip-close">✕</span>
                                            </span>
                                        ))}
                                        {selectedCategories.length === 0 && (
                                            <span className="selection-placeholder">No categories selected - please pick at least one.</span>
                                        )}
                                    </div>
                                </div>

                                <div className="admin-divider" />

                                {/* AI Suggestions */}
                                {suggestedCategories.length > 0 && suggestedCategories.some(c => !selectedCategories.includes(c)) && (
                                    <div className="suggested-categories">
                                        <div className="selection-label ai-label">🤖 AI Suggested:</div>
                                        <div className="chips-container">
                                            {suggestedCategories
                                                .filter((c) => !selectedCategories.includes(c))
                                                .map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        className="chip chip-accent clickable"
                                                        onClick={() => addCategory(cat)}
                                                    >
                                                        + {cat}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* All Categories */}
                                <div className="all-categories">
                                    <div className="selection-label">Available:</div>
                                    <div className="chips-container">
                                        {allCategories
                                            .filter((c) => !selectedCategories.includes(c))
                                            .map((cat) => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    className="chip clickable"
                                                    style={{ background: 'rgba(255,255,255,0.05)' }}
                                                    onClick={() => addCategory(cat)}
                                                >
                                                    + {cat}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Attributions */}
                        <div className="admin-section">
                            <div className="admin-section-header">
                                <h3 className="admin-section-title">👤 Attributions & Attribution</h3>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        const creds = suggestAttributions(url, title, { authorName: ytMetadata?.author_name });
                                        if (creds.length > 0) setAttributions(creds);
                                    }}
                                    id="ai-suggest-attributions"
                                >
                                    ✨ AI Suggest Attributions
                                </button>
                            </div>

                            <div className="admin-attributions-section">
                                {/* AI Suggested Attributions */}
                                {suggestedAttributions.length > 0 && (
                                    <div className="suggested-attributions-pill-group">
                                        <div className="selection-label ai-label">🤖 AI Suggested:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                            {suggestedAttributions.map((attribution, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="btn btn-xs btn-secondary"
                                                    style={{ borderRadius: '20px' }}
                                                    onClick={() => applySuggestedAttribution(attribution)}
                                                >
                                                    + {attribution.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="attributions-list">
                                    {attributions.map((attribution, idx) => (
                                        <div key={idx} className="attribution-row">
                                            <div className="form-group">
                                                <label className="form-label">Name</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={attribution.name}
                                                    onChange={(e) => updateAttribution(idx, 'name', e.target.value)}
                                                    placeholder="Creator/Provider name"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">URL</label>
                                                <input
                                                    type="url"
                                                    className="form-input"
                                                    value={attribution.url}
                                                    onChange={(e) => updateAttribution(idx, 'url', e.target.value)}
                                                    placeholder="https://..."
                                                />
                                            </div>
                                            <div className="attribution-actions">
                                                {attributions.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn-icon btn-danger"
                                                        onClick={() => removeAttribution(idx)}
                                                        title="Remove Attribution"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button type="button" className="btn btn-secondary btn-sm" onClick={addAttribution} style={{ marginTop: 'var(--space-2)' }}>
                                    + Add Another Attribution
                                </button>
                            </div>
                        </div>

                        <div className="form-group col-span-2">
                            <label className="form-label" htmlFor="adminNotes">🔒 Internal Curator Notes (Administrative)</label>
                            <textarea
                                id="adminNotes"
                                className="form-textarea"
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Internal context, metadata, or follow-up notes about this resource..."
                                rows={3}
                            />
                            <p className="form-helper" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Private notes for administrators only (internal use only)</p>
                        </div>

                        {/* Submit */}
                        <div className="admin-form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg btn-glow"
                                disabled={loading}
                                id="submit-resource"
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner-inline" />
                                        {isAdmin ? 'Adding...' : 'Submitting...'}
                                    </>
                                ) : (
                                    isAdmin ? '✅ Add Resource' : '🚀 Submit for Review'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Duplicate Warning Modal */}
            {dupWarning && (
                <Modal
                    isOpen={true}
                    onClose={() => { setDupWarning(null); setPendingSubmit(false); }}
                    title="⚠️ Potential Duplicate Detected"
                    className="modal-danger"
                    footer={
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <button
                                className="btn btn-secondary"
                                style={{ width: '100%' }}
                                onClick={() => { setDupWarning(null); setPendingSubmit(false); }}
                            >
                                ← Cancel &amp; Edit
                            </button>
                            <button
                                onClick={() => { setDupWarning(null); doSubmit(); }}
                                disabled={loading}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    fontSize: 'var(--text-xs)',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    padding: 0,
                                }}
                            >
                                {loading ? 'Saving...' : 'Save as new anyway (I know it\'s a duplicate)'}
                            </button>
                        </div>
                    }
                >
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                        We found existing resources that match your submission. You can overwrite an existing listing with your new data, or save this as a completely new entry.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {dupWarning.matches?.map((match) => (
                            <div key={match.id} className="glass-card" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${match.matchType === 'title' ? 'var(--warning)' : 'var(--danger)'}` }}>
                                <div style={{ overflow: 'hidden', flex: 1, paddingRight: 'var(--space-3)' }}>
                                    <h4 style={{ fontSize: '13px', margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {match.matchType === 'title' ? '🏷️' : '🔗'} {match.title}
                                    </h4>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {match.url}
                                    </p>
                                </div>
                                <button 
                                    className="btn btn-sm btn-primary" 
                                    style={{ whiteSpace: 'nowrap', padding: 'var(--space-2) var(--space-3)', fontSize: '11px' }}
                                    onClick={() => { setDupWarning(null); doSubmit(match.id); }}
                                    disabled={loading}
                                >
                                    Overwrite
                                </button>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}
