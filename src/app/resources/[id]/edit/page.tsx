'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Credit, Platform, ResourcePricing, ResourceType, MediaFormat, Resource } from '@/lib/types';
import { suggestCategories, suggestCredits, getDefaultCategories } from '@/lib/suggestions';
import { isYouTubeUrl, extractYouTubeId } from '@/lib/youtube';

export default function EditResourcePage() {
    const params = useParams();
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const resourceId = params.id as string;

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
    const [credits, setCredits] = useState<Credit[]>([{ name: '', url: '' }]);
    const [status, setStatus] = useState<'published' | 'draft'>('published');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const allCategories = getDefaultCategories();

    useEffect(() => {
        async function fetchResource() {
            try {
                const response = await fetch(`/api/resources/${resourceId}`);
                const result = await response.json();
                
                if (result.success) {
                    const data = result.data as Resource;
                    setTitle(data.title || '');
                    setDescription(data.description || '');
                    setUrl(data.url || '');
                    setType(data.type || 'article');
                    setMediaFormat(data.mediaFormat || 'webpage');
                    setPlatform(data.platform || 'general');
                    setPricing(data.pricing || 'free');
                    setPricingDetails(data.pricingDetails || '');
                    setTags(data.tags?.join(', ') || '');
                    setSelectedCategories(data.categories || []);
                    setCredits(data.credits?.length > 0 ? data.credits : [{ name: '', url: '' }]);
                    setStatus(data.status || 'published');
                } else {
                    console.error('API Error:', result.error);
                }
            } catch (err) {
                console.error('Error fetching resource:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchResource();
    }, [resourceId]);

    const addCategory = (cat: string) => {
        if (!selectedCategories.includes(cat)) {
            setSelectedCategories([...selectedCategories, cat]);
        }
    };

    const removeCategory = (cat: string) => {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    };

    const addCredit = () => setCredits([...credits, { name: '', url: '' }]);
    const removeCredit = (idx: number) => setCredits(credits.filter((_, i) => i !== idx));
    const updateCredit = (idx: number, field: keyof Credit, value: string) => {
        const updated = [...credits];
        updated[idx] = { ...updated[idx], [field]: value };
        setCredits(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (selectedCategories.length === 0) {
            setError('Please select at least one category.');
            return;
        }

        const validCredits = credits.filter((c) => c.name.trim() && c.url.trim());
        setSaving(true);

        try {
            const youtubeVideoId = extractYouTubeId(url);
            await updateDoc(doc(db, 'resources', resourceId), {
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
                status,
                updatedAt: serverTimestamp(),
            });
            router.push(`/resources/${resourceId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to update resource.');
        } finally {
            setSaving(false);
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
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page"><div className="spinner" /></div>
            </div>
        );
    }

    const suggestedCats = suggestCategories(title, description, url).filter((c) => !selectedCategories.includes(c));

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 style={{ marginBottom: 'var(--space-6)' }}>✏️ Edit Resource</h1>

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
                            <h3 style={{
                                fontSize: 'var(--text-lg)',
                                marginBottom: 'var(--space-5)',
                                paddingBottom: 'var(--space-3)',
                                borderBottom: '1px solid var(--border-subtle)',
                            }}>
                                📝 Basic Information
                            </h3>

                            <div className="form-group">
                                <label className="form-label">Title *</label>
                                <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description *</label>
                                <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">URL *</label>
                                <input type="url" className="form-input" value={url} onChange={(e) => setUrl(e.target.value)} required />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-select" value={type} onChange={(e) => setType(e.target.value as ResourceType)}>
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
                                    <label className="form-label">Media Format</label>
                                    <select className="form-select" value={mediaFormat} onChange={(e) => setMediaFormat(e.target.value as MediaFormat)}>
                                        <option value="youtube">YouTube</option>
                                        <option value="webpage">Webpage</option>
                                        <option value="pdf">PDF</option>
                                        <option value="image">Image</option>
                                        <option value="audio">Audio</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Platform</label>
                                    <select className="form-select" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
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
                                    <label className="form-label">Pricing</label>
                                    <select className="form-select" value={pricing} onChange={(e) => setPricing(e.target.value as ResourcePricing)}>
                                        <option value="free">Free</option>
                                        <option value="paid">Paid</option>
                                        <option value="freemium">Freemium</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}>
                                        <option value="published">Published</option>
                                        <option value="draft">Draft</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tags (comma separated)</label>
                                <input type="text" className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} />
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>🏷️ Categories</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                                {selectedCategories.map((cat) => (
                                    <span key={cat} className="badge badge-primary" style={{ cursor: 'pointer', padding: 'var(--space-2) var(--space-3)' }} onClick={() => removeCategory(cat)}>
                                        {cat} ✕
                                    </span>
                                ))}
                            </div>
                            {suggestedCats.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-400)', fontWeight: 600 }}>🤖 Suggested: </span>
                                    {suggestedCats.map((cat) => (
                                        <button key={cat} type="button" className="badge badge-accent" style={{ cursor: 'pointer', marginRight: 'var(--space-1)' }} onClick={() => addCategory(cat)}>
                                            + {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                                {allCategories.filter((c) => !selectedCategories.includes(c)).map((cat) => (
                                    <button key={cat} type="button" className="badge badge-primary" style={{ cursor: 'pointer', opacity: 0.5, fontSize: '0.65rem' }} onClick={() => addCategory(cat)}>
                                        + {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Credits */}
                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>👤 Credits</h3>
                            {credits.map((credit, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                    <input type="text" className="form-input" value={credit.name} onChange={(e) => updateCredit(idx, 'name', e.target.value)} placeholder="Name" />
                                    <input type="url" className="form-input" value={credit.url} onChange={(e) => updateCredit(idx, 'url', e.target.value)} placeholder="URL" />
                                    {credits.length > 1 && (
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeCredit(idx)} style={{ color: 'var(--danger-400)' }}>✕</button>
                                    )}
                                </div>
                            ))}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={addCredit}>+ Add Credit</button>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
                            <button type="submit" className="btn btn-primary btn-lg" disabled={saving} id="save-resource">
                                {saving ? 'Saving...' : '✅ Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
