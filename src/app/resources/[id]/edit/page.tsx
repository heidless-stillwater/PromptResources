'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { Attribution, Platform, ResourcePricing, ResourceType, MediaFormat, ResourceStatus, Resource } from '@/lib/types';
import { suggestCategories, suggestAttributions, getDefaultCategories, suggestDescription, suggestTags } from '@/lib/suggestions';
import { extractYouTubeId, isYouTubeUrl, fetchYouTubeMetadata, isGenericYouTubeName, deduplicateAttributions } from '@/lib/youtube';
import Link from 'next/link';
import ThumbnailPicker from '@/components/ThumbnailPicker';

export default function EditResourcePage() {
    const { user, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();
    const { id } = useParams();

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
    const [status, setStatus] = useState<ResourceStatus>('suggested');
    const [suggestedAttributions, setSuggestedAttributions] = useState<Attribution[]>([]);
    const [ytMetadata, setYtMetadata] = useState<any>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [rank, setRank] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [originalResource, setOriginalResource] = useState<Resource | null>(null);

    const allCategories = getDefaultCategories();
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // Fetch existing resource
    useEffect(() => {
        if (!id || !user) return;

        const fetchResource = async () => {
            try {
                const response = await fetch(`/api/resources/${id}`);
                const result = await response.json();

                if (result.success) {
                    const res = result.data;
                    
                    // Security check: Only owner or admin can edit
                    if (!isAdmin && res.addedBy !== user.uid) {
                        router.push('/dashboard');
                        return;
                    }

                    setOriginalResource(res);
                    setTitle(res.title || '');
                    setDescription(res.description || '');
                    setUrl(res.url || '');
                    setType(res.type || 'article');
                    setMediaFormat(res.mediaFormat || 'webpage');
                    setPlatform(res.platform || 'nanobanana');
                    setPricing(res.pricing || 'free');
                    setPricingDetails(res.pricingDetails || '');
                    setTags(res.tags?.join(', ') || '');
                    setSelectedCategories(res.categories || []);
                    setAttributions(res.attributions && res.attributions.length > 0 ? res.attributions : [{ name: '', url: '' }]);
                    setThumbnailUrl(res.thumbnailUrl || '');
                    setStatus(res.status || 'suggested');
                    setIsFavorite(res.isFavorite || false);
                    setRank(res.rank === null ? '' : res.rank);
                    setPrompts(res.prompts?.join('\n') || '');
                    setNotes(res.notes || '');
                    setAdminNotes(res.adminNotes || '');
                } else {
                    setError('Resource not found.');
                }
            } catch (err) {
                setError('Failed to load resource data.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchResource();
    }, [id, user, isAdmin, router]);

    // Auto-detect YouTube and suggest categories/attributions (only if URL changes)
    useEffect(() => {
        if (url && isYouTubeUrl(url) && url !== originalResource?.url) {
            setMediaFormat('youtube');
            setType('video');

            // Fetch channel name via oEmbed
            const fetchYouTubeData = async () => {
                const data = await fetchYouTubeMetadata(url);
                if (data && data.author_name) {
                    const channelName = data.author_name;
                    setYtMetadata(data);

                    setSuggestedAttributions(prev => {
                        const newCreds = isYouTubeUrl(url) ?
                            prev.map(c => c.name === 'Youtube' ? { ...c, name: channelName, url: data.author_url || url } : c) :
                            [...prev];

                        if (!newCreds.some(c => c.name === channelName)) {
                            newCreds.push({ name: channelName, url: data.author_url || url });
                        }
                        return deduplicateAttributions(newCreds);
                    });

                    // Autofill Title
                    setTitle(prev => {
                        if (!prev && data.title) return data.title;
                        return prev;
                    });

                    // Autofill description
                    setDescription(prev => {
                        if (!prev && data.title) {
                            return suggestDescription(data.title);
                        }
                        return prev;
                    });

                    // Autofill Categories
                    setSelectedCategories(prev => {
                        if (prev.length === 0 && data.title) {
                             const cats = suggestCategories(data.title, suggestDescription(data.title), url, { tags, type, mediaFormat, platform, pricing });
                             return Array.from(new Set([...prev, ...cats]));
                        }
                        return prev;
                    });

                    // Autofill Tags
                    setTags(prev => {
                        if (!prev && data.title) {
                            const suggestedTags = suggestTags(data.title, suggestDescription(data.title), url);
                            if (suggestedTags.length > 0) {
                                return suggestedTags.join(', ');
                            }
                        }
                        return prev;
                    });

                    // Only autofill attributions if they are empty or just have placeholders
                    setAttributions(prev => {
                        if (prev.length === 0 || (prev.length === 1 && !prev[0].name && !prev[0].url)) {
                            return [{ name: channelName, url: data.author_url || url }];
                        }
                        return prev.map(c => isGenericYouTubeName(c.name) ? { ...c, name: channelName, url: data.author_url || url } : c);
                    });

                    // Autofill Thumbnail
                    if (data.thumbnail_url && !thumbnailUrl) {
                        setThumbnailUrl(data.thumbnail_url);
                    }
                }
            };
            fetchYouTubeData();
        } else {
            setYtMetadata(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, originalResource?.url]);

    useEffect(() => {
        if (title || url) {
            const cats = suggestCategories(title, description, url, { tags, type, mediaFormat, platform, pricing });
            setSuggestedCategories(cats);
            const creds = suggestAttributions(url, title, { authorName: ytMetadata?.author_name, authorUrl: ytMetadata?.author_url });
            setSuggestedAttributions(creds);
        }
    }, [title, description, url, ytMetadata, tags, type, mediaFormat, platform, pricing]);

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

        const validAttributions = attributions.filter((c) => c.name.trim() && c.url.trim());

        setSaving(true);
        try {
            const youtubeVideoId = extractYouTubeId(url);
            const token = user ? await user.getIdToken() : '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/resources/${id}`, {
                method: 'PATCH',
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
                    status: isAdmin ? status : originalResource?.status || 'suggested',
                    isFavorite,
                    rank: rank === '' ? null : Number(rank),
                    prompts: prompts.split('\n').map(p => p.trim()).filter(Boolean),
                    notes: notes.trim() || null,
                    adminNotes: adminNotes.trim() || null,
                }),
            });

            const result = await response.json();

            if (result.success) {
                router.refresh();
                router.push(`/resources/${id}`);
            } else {
                setError(result.error || 'Failed to update resource.');
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            setError(error.message || 'Failed to update resource.');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/auth/login?redirect=/resources/${id}/edit`);
        }
    }, [user, authLoading, router, id]);

    if (authLoading || loading) {
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
        return null;
    }

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <button 
                            type="button" 
                            className="btn btn-ghost btn-sm"
                            onClick={() => router.back()}
                        >
                            ← Back
                        </button>
                        <h1 style={{ marginBottom: 0 }}>
                            ✏️ Edit Resource
                        </h1>
                    </div>

                    <form onSubmit={handleSubmit}>
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

                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 0 }}>
                                    📝 Basic Information
                                </h3>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        const cats = suggestCategories(title, description, url, { tags, type, mediaFormat, platform, pricing });
                                        setSelectedCategories(Array.from(new Set([...selectedCategories, ...cats])));
                                        const creds = suggestAttributions(url, title, { authorName: ytMetadata?.author_name, authorUrl: ytMetadata?.author_url });
                                        if (creds.length > 0) setAttributions(creds);
                                        if (!description) {
                                            const desc = suggestDescription(title);
                                            if (desc) setDescription(desc);
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

                            <div className="form-group">
                                <label className="form-label" htmlFor="url">URL *</label>
                                <input
                                    id="url"
                                    type="url"
                                    className="form-input"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://..."
                                    required
                                />
                                {url && isYouTubeUrl(url) && (
                                    <div className="form-helper" style={{ color: 'var(--success-400)' }}>
                                        ✓ YouTube video detected - will auto-embed
                                    </div>
                                )}
                            </div>

                             {isAdmin && (
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
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setIsPickerOpen(true)}
                                            style={{ whiteSpace: 'nowrap', padding: 'var(--space-2) var(--space-4)', fontSize: '12px' }}
                                        >
                                            📂 Browse scenarios
                                        </button>
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
                                    <ThumbnailPicker 
                                        isOpen={isPickerOpen} 
                                        onClose={() => setIsPickerOpen(false)}
                                        onSelect={(url) => setThumbnailUrl(url)}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label" htmlFor="title">Title *</label>
                                <input
                                    id="title"
                                    type="text"
                                    className="form-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Ultimate Guide to Gemini Prompt Engineering"
                                    required
                                />
                            </div>

                            <div className="form-group">
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
                                />
                            </div>


                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                            </div>

                            {pricing !== 'free' && (
                                <div className="form-group">
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

                            <div className="form-group">
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="status">Status</label>
                                        <select id="status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value as ResourceStatus)}>
                                            <option value="suggested">Suggested</option>
                                            <option value="reviewing">Reviewing</option>
                                            <option value="published">Published</option>
                                            <option value="archived">Archived</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </div>
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
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={isFavorite}
                                                onChange={(e) => setIsFavorite(e.target.checked)}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            ⭐ Favorite / Featured
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Categories */}
                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 0 }}>🏷️ Categories <span style={{ color: 'var(--danger-400)', fontSize: 'var(--text-sm)' }}>* (min 1)</span></h3>
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

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                                {selectedCategories.map((cat) => (
                                    <span
                                        key={cat}
                                        className="badge badge-primary"
                                        style={{ cursor: 'pointer', padding: 'var(--space-2) var(--space-3)' }}
                                        onClick={() => removeCategory(cat)}
                                    >
                                        {cat} ✕
                                    </span>
                                ))}
                            </div>

                            {/* AI Suggestions */}
                            {suggestedCategories.length > 0 && suggestedCategories.some(c => !selectedCategories.includes(c)) && (
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--accent-400)',
                                        fontWeight: 600,
                                        marginBottom: 'var(--space-2)',
                                        textTransform: 'uppercase',
                                    }}>
                                        🤖 AI Suggested
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {suggestedCategories
                                            .filter((c) => !selectedCategories.includes(c))
                                            .map((cat) => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    className="badge badge-accent"
                                                    style={{
                                                        cursor: 'pointer',
                                                        padding: 'var(--space-2) var(--space-3)',
                                                        background: 'rgba(249, 115, 22, 0.1)',
                                                    }}
                                                    onClick={() => addCategory(cat)}
                                                >
                                                    + {cat}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div style={{
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--text-muted)',
                                    fontWeight: 600,
                                    marginBottom: 'var(--space-2)',
                                    textTransform: 'uppercase',
                                }}>
                                    All Categories
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                    {allCategories
                                        .filter((c) => !selectedCategories.includes(c))
                                        .map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                className="badge badge-primary"
                                                style={{
                                                    cursor: 'pointer',
                                                    padding: 'var(--space-1) var(--space-3)',
                                                    opacity: 0.6,
                                                }}
                                                onClick={() => addCategory(cat)}
                                            >
                                                + {cat}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        </div>

                        {/* Attributions */}
                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 0 }}>👤 Attributions & Attribution</h3>
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

                            {/* AI Suggested Attributions */}
                            {suggestedAttributions.length > 0 && suggestedAttributions.some(sc => !attributions.some(c => c.name === sc.name)) && (
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--accent-400)',
                                        fontWeight: 600,
                                        marginBottom: 'var(--space-2)',
                                        textTransform: 'uppercase',
                                    }}>
                                        🤖 AI Suggested Attributions
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {suggestedAttributions
                                            .filter(sc => !attributions.some(c => c.name === sc.name))
                                            .map((attribution, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => applySuggestedAttribution(attribution)}
                                                >
                                                    + {attribution.name}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {attributions.map((attribution, idx) => (
                                <div key={idx} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr auto',
                                    gap: 'var(--space-3)',
                                    marginBottom: 'var(--space-3)',
                                    alignItems: 'end',
                                }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Provider Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={attribution.name}
                                            onChange={(e) => updateAttribution(idx, 'name', e.target.value)}
                                            placeholder="Creator/Provider name"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Provider URL</label>
                                        <input
                                            type="url"
                                            className="form-input"
                                            value={attribution.url}
                                            onChange={(e) => updateAttribution(idx, 'url', e.target.value)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                    {attributions.length > 1 && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => removeAttribution(idx)}
                                            style={{ color: 'var(--danger-400)' }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button type="button" className="btn btn-ghost btn-sm" onClick={addAttribution}>
                                + Add Another Attribution
                            </button>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>📖 Public Notes & Instructions</h3>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <textarea
                                    id="notes"
                                    className="form-textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Publicly visible notes, special instructions, or context for users..."
                                    rows={3}
                                />
                                <p className="form-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Visible to all visitors on the resource detail page</p>
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>🔒 Internal Curator Notes (Administrative)</h3>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <textarea
                                    id="adminNotes"
                                    className="form-textarea"
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Internal context, metadata, or follow-up notes about this resource..."
                                    rows={3}
                                />
                                <p className="form-helper" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Private notes for administrators only (internal use only)</p>
                            </div>
                        </div>

                        {/* Submit */}
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                disabled={saving}
                                id="submit-update"
                            >
                                {saving ? 'Saving...' : '✅ Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
