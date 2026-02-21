'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Credit, Platform, ResourcePricing, ResourceType, MediaFormat } from '@/lib/types';
import { suggestCategories, suggestCredits, getDefaultCategories, suggestDescription, suggestTags } from '@/lib/suggestions';
import { extractYouTubeId, isYouTubeUrl, fetchYouTubeMetadata } from '@/lib/youtube';

export default function NewResourcePage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [type, setType] = useState<ResourceType>('article');
    const [mediaFormat, setMediaFormat] = useState<MediaFormat>('webpage');
    const [platform, setPlatform] = useState<Platform>('general');
    const [pricing, setPricing] = useState<ResourcePricing>('free');
    const [pricingDetails, setPricingDetails] = useState('');
    const [tags, setTags] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
    const [credits, setCredits] = useState<Credit[]>([{ name: '', url: '' }]);
    const [suggestedCredits, setSuggestedCredits] = useState<Credit[]>([]);
    const [ytMetadata, setYtMetadata] = useState<any>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [rank, setRank] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const allCategories = getDefaultCategories();

    // Auto-detect YouTube and suggest categories/credits
    useEffect(() => {
        if (url && isYouTubeUrl(url)) {
            setMediaFormat('youtube');
            setType('video');

            // Fetch channel name via oEmbed
            const fetchYouTubeData = async () => {
                const data = await fetchYouTubeMetadata(url);
                if (data && data.author_name) {
                    const channelName = data.author_name;
                    setYtMetadata(data);

                    setSuggestedCredits(prev => {
                        const newCreds = [...prev];
                        const ytIdx = newCreds.findIndex(c => c.name === 'Youtube');
                        if (ytIdx >= 0) {
                            newCreds[ytIdx] = { ...newCreds[ytIdx], name: channelName };
                        } else if (!newCreds.some(c => c.name === channelName)) {
                            newCreds.push({ name: channelName, url: url });
                        }
                        return newCreds;
                    });

                    setCredits(prev => {
                        if (prev.length === 1 && (!prev[0].name || prev[0].name === 'Youtube')) {
                            return [{ name: channelName, url: url }];
                        }
                        return prev.map(c =>
                            (c.name === 'Youtube') ? { ...c, name: channelName } : c
                        );
                    });
                }
            };
            fetchYouTubeData();
        } else {
            setYtMetadata(null);
        }
    }, [url]);

    useEffect(() => {
        if (title || url) {
            const cats = suggestCategories(title, description, url);
            setSuggestedCategories(cats);
            const creds = suggestCredits(url, title, { authorName: ytMetadata?.author_name });
            setSuggestedCredits(creds);
        }
    }, [title, description, url, ytMetadata]);

    const addCategory = (cat: string) => {
        if (!selectedCategories.includes(cat)) {
            setSelectedCategories([...selectedCategories, cat]);
        }
    };

    const removeCategory = (cat: string) => {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    };

    const addCredit = () => {
        setCredits([...credits, { name: '', url: '' }]);
    };

    const removeCredit = (idx: number) => {
        setCredits(credits.filter((_, i) => i !== idx));
    };

    const updateCredit = (idx: number, field: keyof Credit, value: string) => {
        const updated = [...credits];
        updated[idx] = { ...updated[idx], [field]: value };
        setCredits(updated);
    };

    const applySuggestedCredit = (credit: Credit) => {
        const empty = credits.findIndex((c) => !c.name && !c.url);
        if (empty >= 0) {
            const updated = [...credits];
            updated[empty] = credit;
            setCredits(updated);
        } else {
            setCredits([...credits, credit]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (selectedCategories.length === 0) {
            setError('Please select at least one category.');
            return;
        }

        const validCredits = credits.filter((c) => c.name.trim() && c.url.trim());

        setLoading(true);
        try {
            const youtubeVideoId = extractYouTubeId(url);

            const response = await fetch('/api/resources', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
                    credits: validCredits,
                    youtubeVideoId: youtubeVideoId || null,
                    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                    addedBy: user?.uid || 'unknown',
                    status: 'published',
                    isFavorite,
                    rank: rank === '' ? null : Number(rank),
                }),
            });

            const result = await response.json();

            if (result.success) {
                router.push('/resources');
            } else {
                setError(result.error || 'Failed to add resource.');
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            setError(error.message || 'Failed to add resource.');
        } finally {
            setLoading(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="main-content">
                    <div className="container">
                        <div className="empty-state">
                            <div className="empty-state-icon">🔒</div>
                            <div className="empty-state-title">Access Denied</div>
                            <div className="empty-state-desc">Only admins can add resources.</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 style={{ marginBottom: 'var(--space-6)' }}>➕ Add New Resource</h1>

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
                                        const cats = suggestCategories(title, description, url);
                                        setSelectedCategories(Array.from(new Set([...selectedCategories, ...cats])));
                                        const creds = suggestCredits(url, title, { authorName: ytMetadata?.author_name });
                                        if (creds.length > 0) setCredits(creds);
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
                                    title="Autofill Description, Tags, Categories and Credits using AI"
                                >
                                    ✨ Magic AI Autofill
                                </button>
                            </div>

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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
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
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Rank (Priority)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={rank}
                                        onChange={(e) => setRank(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="e.g. 1 (Top priority)"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 0 }}>🏷️ Categories <span style={{ color: 'var(--danger-400)', fontSize: 'var(--text-sm)' }}>* (min 1)</span></h3>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        const cats = suggestCategories(title, description, url);
                                        setSelectedCategories(Array.from(new Set([...selectedCategories, ...cats])));
                                    }}
                                    id="ai-suggest-categories"
                                >
                                    ✨ AI Suggest
                                </button>
                            </div>

                            {/* Selected */}
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
                                {selectedCategories.length === 0 && (
                                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                        No categories selected
                                    </span>
                                )}
                            </div>

                            {/* AI Suggestions */}
                            {suggestedCategories.length > 0 && (
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

                            {/* All Categories */}
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

                        {/* Credits */}
                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 0 }}>👤 Credits & Attribution</h3>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        const creds = suggestCredits(url, title, { authorName: ytMetadata?.author_name });
                                        if (creds.length > 0) setCredits(creds);
                                    }}
                                    id="ai-suggest-credits"
                                >
                                    ✨ AI Suggest Credits
                                </button>
                            </div>

                            {/* AI Suggested Credits */}
                            {suggestedCredits.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--accent-400)',
                                        fontWeight: 600,
                                        marginBottom: 'var(--space-2)',
                                        textTransform: 'uppercase',
                                    }}>
                                        🤖 AI Suggested Credits
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {suggestedCredits.map((credit, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => applySuggestedCredit(credit)}
                                            >
                                                + {credit.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {credits.map((credit, idx) => (
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
                                            value={credit.name}
                                            onChange={(e) => updateCredit(idx, 'name', e.target.value)}
                                            placeholder="Creator/Provider name"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Provider URL</label>
                                        <input
                                            type="url"
                                            className="form-input"
                                            value={credit.url}
                                            onChange={(e) => updateCredit(idx, 'url', e.target.value)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                    {credits.length > 1 && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => removeCredit(idx)}
                                            style={{ color: 'var(--danger-400)' }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button type="button" className="btn btn-ghost btn-sm" onClick={addCredit}>
                                + Add Another Credit
                            </button>
                        </div>

                        {/* Submit */}
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                disabled={loading}
                                id="submit-resource"
                            >
                                {loading ? 'Adding Resource...' : '✅ Add Resource'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
