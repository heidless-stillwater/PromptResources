'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { Attribution, Platform, ResourcePricing, ResourceType, MediaFormat, ResourceStatus, Resource, UserProfile } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { suggestCategories, suggestAttributions, getDefaultCategories, suggestDescription, suggestTags } from '@/lib/suggestions';
import { extractYouTubeId, isYouTubeUrl, fetchYouTubeMetadata, isGenericYouTubeName, deduplicateAttributions } from '@/lib/youtube';
import Link from 'next/link';
import ThumbnailPicker from '@/components/ThumbnailPicker';
import Modal from '@/components/Modal';
import { Icons } from '@/components/ui/Icons';
import { Category, ApiResponse } from '@/lib/types';
import Footer from '@/components/Footer';
import ConfirmationModal from '@/components/ConfirmationModal';

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
    const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
    const [rank, setRank] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [originalResource, setOriginalResource] = useState<Resource | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    const allCategories = getDefaultCategories();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isEnriching, setIsEnriching] = useState(false);
    
    // AI Overload Retry Logic
    const [isOverloadModalOpen, setIsOverloadModalOpen] = useState(false);
    const [retryCountdown, setRetryCountdown] = useState(10);
    const [isWaitingToRetry, setIsWaitingToRetry] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [knownCreators, setKnownCreators] = useState<Array<{ name: string; url: string }>>([]);
    const [lastEnrichField, setLastEnrichField] = useState<'description' | 'tags' | undefined>(undefined);

    const [dbCategories, setDbCategories] = useState<Category[]>([]);
    const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
    const [newCatLoading, setNewCatLoading] = useState(false);
    const [newCatData, setNewCatData] = useState({ name: '', icon: '📂', description: '' });

    const [notificationModal, setNotificationModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'error',
    });

    useEffect(() => {
        const fetchCats = async () => {
            try {
                const res = await fetch('/api/categories');
                const data = await res.json() as ApiResponse<Category[]>;
                if (data.success && data.data) {
                    setDbCategories(data.data);
                }
            } catch (e) {
                console.error('Failed to fetch categories');
            }
        };
        fetchCats();
    }, []);

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setNewCatLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newCatData)
            });
            const data = await res.json();
            if (data.success) {
                const newCatRecord = { ...newCatData, id: data.id, slug: newCatData.name.toLowerCase().replace(/\s+/g, '-') } as any;
                setDbCategories(prev => [...prev, newCatRecord]);
                addCategory(newCatRecord.name);
                setIsNewCatModalOpen(false);
                setNewCatData({ name: '', icon: '📂', description: '' });
            } else {
                setNotificationModal({
                    isOpen: true,
                    title: 'Creation Failed',
                    message: data.error || 'The system was unable to create this topic. Please check your permissions and try again.',
                    type: 'error'
                });
            }
        } catch (e) {
            setNotificationModal({
                isOpen: true,
                title: 'Network Error',
                message: 'A communication error occurred with the curation registry. Please verify your connection.',
                type: 'error'
            });
        } finally {
            setNewCatLoading(false);
        }
    };

    const handleAIEnrich = async (field?: 'description' | 'tags') => {
        if (!url || !user) return;
        
        setLastEnrichField(field);
        setIsEnriching(true);
        setError('');
        
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/ai/enrich', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    url,
                    title: title || undefined,
                    description: description || undefined
                })
            });
            
            const result = await res.json();
            if (result.success) {
                const data = result.data;
                setIsOverloadModalOpen(false); // Close modal if it was open from a previous retry
                
                if (field === 'description') {
                    if (data.description) setDescription(data.description);
                } else if (field === 'tags') {
                    if (data.tags) setTags(data.tags.join(', '));
                } else {
                    // Full enrichment
                    if (data.title && !title) setTitle(data.title);
                    if (data.description) setDescription(data.description);
                    if (data.tags) setTags(data.tags.join(', '));
                    if (data.categories && data.categories.length > 0) {
                        setSelectedCategories(Array.from(new Set([...selectedCategories, ...data.categories])));
                    }
                    if (data.attributions && data.attributions.length > 0) {
                        // Merge or replace attributions
                        setAttributions(prev => {
                            const filtered = prev.filter(a => a.name && a.url);
                            return [...filtered, ...data.attributions];
                        });
                    }
                }
            } else {
                // Check if it's a 503 / overload error
                if (result.error?.includes('503') || result.error?.includes('overloaded') || result.error?.includes('high demand')) {
                    setIsOverloadModalOpen(true);
                    setRetryCountdown(10);
                } else {
                    setError(result.error || 'AI Enrichment failed');
                }
            }
        } catch (err: any) {
            console.error('Enrichment error:', err);
            // Also check catch block error message
            if (err.message?.includes('503') || err.message?.includes('overloaded') || err.message?.includes('high demand')) {
                setIsOverloadModalOpen(true);
                setRetryCountdown(10);
            } else {
                setError('Failed to connect to AI enrichment service.');
            }
        } finally {
            setIsEnriching(false);
        }
    };

    const startRetryCountdown = () => {
        setIsWaitingToRetry(true);
        setRetryCountdown(10);
        
        const timer = setInterval(() => {
            setRetryCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsWaitingToRetry(false);
                    handleAIEnrich(lastEnrichField);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

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
                    setIsFavorite(res.isFavorite === undefined ? null : res.isFavorite);
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

    // Fetch Known Creators for autocomplete (Global + Personal History)
    useEffect(() => {
        if (!user) return;
        const fetchCreators = async () => {
            try {
                const mergedMap = new Map<string, any>();

                // 1. Fetch Global Public Registry
                try {
                    const usersSnap = await getDocs(
                        query(collection(db, 'users'), where('isPublicProfile', '==', true))
                    );
                    usersSnap.docs.forEach(d => {
                        const data = d.data();
                        if (data.displayName) {
                            mergedMap.set(data.displayName.toLowerCase(), { 
                                name: data.displayName, 
                                url: `/creators/${data.slug || d.id}` 
                            });
                        }
                    });
                } catch (e) { console.error('Global creators fetch failed:', e); }

                // 2. Fetch User's Personal History
                try {
                    const personalSnap = await getDocs(
                        query(collection(db, 'resources'), where('addedBy', '==', user.uid), limit(50))
                    );
                    const personalAttributions = personalSnap.docs.flatMap(d => d.data().attributions || []) as Attribution[];
                    personalAttributions.forEach(a => {
                        if (a.name && !mergedMap.has(a.name.toLowerCase())) {
                            mergedMap.set(a.name.toLowerCase(), { name: a.name, url: a.url });
                        }
                    });
                } catch (e) {
                    console.warn('Personal history fetch failed (likely missing index):', e);
                }

                const finalSuggestions = Array.from(mergedMap.values()).sort((a,b) => a.name.localeCompare(b.name));
                setKnownCreators(finalSuggestions);
            } catch (err) {
                console.error('Error in fetchCreators sequence:', err);
            }
        };
        fetchCreators();
    }, [user]);

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
        
        // Auto-detect link if selecting from list
        if (field === 'name') {
            const match = knownCreators.find(c => c.name.toLowerCase() === value.toLowerCase());
            if (match) {
                updated[idx].url = match.url;
            }
        }
        
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

    // Change detection logic
    useEffect(() => {
        if (!originalResource) return;

        const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean).sort().join(',');
        const originalTags = (originalResource.tags || []).sort().join(',');
        
        const currentCats = [...selectedCategories].sort().join(',');
        const originalCats = (originalResource.categories || []).sort().join(',');

        const currentPrompts = prompts.split('\n').map(p => p.trim()).filter(Boolean).sort().join('\n');
        const originalPrompts = (originalResource.prompts || []).sort().join('\n');

        const isChanged = 
            title.trim() !== (originalResource.title || '') ||
            description.trim() !== (originalResource.description || '') ||
            url.trim() !== (originalResource.url || '') ||
            type !== (originalResource.type || 'article') ||
            mediaFormat !== (originalResource.mediaFormat || 'webpage') ||
            platform !== (originalResource.platform || 'nanobanana') ||
            pricing !== (originalResource.pricing || 'free') ||
            (pricingDetails || '') !== (originalResource.pricingDetails || '') ||
            currentTags !== originalTags ||
            currentCats !== originalCats ||
            thumbnailUrl !== (originalResource.thumbnailUrl || '') ||
            status !== (originalResource.status || 'suggested') ||
            isFavorite !== (originalResource.isFavorite === undefined ? null : originalResource.isFavorite) ||
            (rank === '' ? null : Number(rank)) !== (originalResource.rank === undefined ? null : originalResource.rank) ||
            currentPrompts !== originalPrompts ||
            notes.trim() !== (originalResource.notes || '') ||
            adminNotes.trim() !== (originalResource.adminNotes || '');

        setHasChanges(isChanged);
    }, [title, description, url, type, mediaFormat, platform, pricing, pricingDetails, tags, selectedCategories, thumbnailUrl, status, isFavorite, rank, prompts, notes, adminNotes, originalResource]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (selectedCategories.length === 0) {
            setError('Please select at least one category.');
            return;
        }

        const validAttributions = attributions.filter((c) => (c.name || '').trim() && (c.url || '').trim());

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
        <div className="page-wrapper dashboard-theme">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '900px' }}>
                    {/* ── CINEMATIC HEADER ── */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Revision Hub
                                </div>
                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white leading-none">
                                    Edit <span className="text-indigo-400">Resource</span>
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <Link 
                                    href="/admin" 
                                    className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                                >
                                    <Icons.settings size={14} /> Admin Hub
                                </Link>
                            )}
                            <Link 
                                href="/resources" 
                                className="px-5 py-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20 transition-all flex items-center gap-2"
                            >
                                <Icons.database size={14} /> Global Resources
                            </Link>
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
                                <h3 className="admin-section-title">📝 Basic Information</h3>
                                <button
                                    type="button"
                                    className={`btn btn-primary btn-sm btn-glow ${isEnriching ? 'loading' : ''}`}
                                    onClick={() => handleAIEnrich()}
                                    id="ai-quick-autofill"
                                    disabled={!url || isEnriching}
                                >
                                    {isEnriching ? <span className="spinner-inline mr-2" /> : '✨'} Magic AI Autofill
                                </button>
                            </div>

                            <div className="admin-form-grid">
                                <div className="form-group col-span-2">
                                    <label className="form-label">URL *</label>
                                    <input
                                        type="url"
                                        className="form-input"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://..."
                                        required
                                    />
                                    {url && isYouTubeUrl(url) && (
                                        <div className="form-helper" style={{ color: 'var(--success-400)' }}>
                                            ✓ YouTube video detected
                                        </div>
                                    )}
                                </div>

                                {isAdmin && (
                                    <div className="col-span-2 space-y-8 my-6 pb-6 border-b border-white/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="form-group">
                                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Icons.trophy size={14} className="text-amber-400" /> Rank & Discovery Weight
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {[null, 1, 2, 3, 5, 10].map((r) => (
                                                        <button
                                                            key={r === null ? 'none' : r}
                                                            type="button"
                                                            onClick={() => setRank(r === null ? '' : r)}
                                                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                                                                (r === null && rank === '') || (typeof r === 'number' && rank === r)
                                                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                                                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'
                                                            }`}
                                                        >
                                                            {r === null ? 'None' : r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Icons.star size={14} className="text-amber-400" /> Featured Elevation
                                                </label>
                                                <div className="flex gap-2">
                                                    {[
                                                        { label: 'Standard', value: null },
                                                        { label: 'Featured', value: true },
                                                        { label: 'Not Set', value: false }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.label}
                                                            type="button"
                                                            onClick={() => setIsFavorite(opt.value)}
                                                            className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                                isFavorite === opt.value
                                                                    ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20'
                                                                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">🖼️ Thumbnail Image URL</label>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={thumbnailUrl}
                                                    onChange={(e) => setThumbnailUrl(e.target.value)}
                                                    placeholder="Enter image URL..."
                                                    style={{ flex: 1 }}
                                                />
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setIsPickerOpen(true)}
                                                    style={{ whiteSpace: 'nowrap' }}
                                                >
                                                    Browse scenarios
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
                                            <ThumbnailPicker 
                                                isOpen={isPickerOpen} 
                                                onClose={() => setIsPickerOpen(false)}
                                                onSelect={(url) => setThumbnailUrl(url)}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="form-group col-span-2">
                                    <label className="form-label">Title *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group col-span-2">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                                        <label className="form-label">Description *</label>
                                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleAIEnrich('description')}>✨ AI Suggest</button>
                                    </div>
                                    <textarea
                                        className="form-textarea"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        required
                                    />
                                </div>

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
                                    <label className="form-label">Format</label>
                                    <select className="form-select" value={mediaFormat} onChange={(e) => setMediaFormat(e.target.value as MediaFormat)}>
                                        <option value="youtube">YouTube</option>
                                        <option value="webpage">Webpage</option>
                                        <option value="pdf">PDF</option>
                                        <option value="image">Image</option>
                                        <option value="audio">Audio</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Platform</label>
                                    <select className="form-select" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                                        <option value="gemini">Gemini</option>
                                        <option value="chatgpt">ChatGPT</option>
                                        <option value="claude">Claude</option>
                                        <option value="nanobanana">NanoBanana</option>
                                        <option value="midjourney">Midjourney</option>
                                        <option value="general">General</option>
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

                                {pricing !== 'free' && (
                                    <div className="form-group col-span-2">
                                        <label className="form-label">Pricing Details</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={pricingDetails}
                                            onChange={(e) => setPricingDetails(e.target.value)}
                                            placeholder="e.g. $29/month"
                                        />
                                    </div>
                                )}

                                <div className="form-group col-span-2">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                                        <label className="form-label">Tags (comma separated)</label>
                                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleAIEnrich('tags')}>✨ AI Suggest</button>
                                    </div>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        placeholder="prompt, tutorial, gemini..."
                                    />
                                </div>

                                <div className="form-group col-span-2">
                                    <label className="form-label">Prompts (one per line)</label>
                                    <textarea
                                        className="form-textarea"
                                        value={prompts}
                                        onChange={(e) => setPrompts(e.target.value)}
                                        rows={4}
                                        placeholder="Paste specific prompts here..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="admin-section">
                            <div className="admin-section-header">
                                <h3 className="admin-section-title">📖 Public Notes</h3>
                            </div>
                            <div className="form-group">
                                <textarea
                                    className="form-textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Special instructions or context for users..."
                                    rows={3}
                                />
                                <p className="form-helper">Visible to all visitors on the resource detail page.</p>
                            </div>
                        </div>

                        <div className="admin-section">
                            <div className="admin-section-header">
                                <h3 className="admin-section-title">🏷️ Topics & Taxonomy</h3>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setIsNewCatModalOpen(true)}
                                    >
                                        <Icons.plus size={14} className="mr-1" /> New Topic
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-6">
                                {selectedCategories.map((cat) => (
                                    <span 
                                        key={cat} 
                                        className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-indigo-500/20 transition-all"
                                        onClick={() => removeCategory(cat)}
                                    >
                                        {cat} <Icons.close size={12} />
                                    </span>
                                ))}
                                {selectedCategories.length === 0 && (
                                    <span className="text-white/20 text-xs italic">No topics assigned.</span>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/30">Available in Registry</div>
                                <div className="flex flex-wrap gap-2">
                                    {dbCategories.filter(c => !selectedCategories.includes(c.name)).map((cat) => (
                                        <button 
                                            key={cat.id} 
                                            type="button" 
                                            className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/60 rounded-xl text-xs font-medium hover:bg-white/10 hover:border-white/20 transition-all"
                                            onClick={() => addCategory(cat.name)}
                                        >
                                            {cat.icon || '📂'} {cat.name}
                                        </button>
                                    ))}
                                    
                                    {/* Legacy/Fallback categories */}
                                    {allCategories.filter(name => !selectedCategories.includes(name) && !dbCategories.some(db => db.name === name)).map((cat) => (
                                        <button 
                                            key={cat} 
                                            type="button" 
                                            className="px-3 py-1.5 bg-white/[0.02] border border-white/5 text-white/30 rounded-xl text-xs font-medium hover:bg-white/5 hover:border-white/10 transition-all opacity-60"
                                            onClick={() => addCategory(cat)}
                                        >
                                            + {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="admin-section">
                            <div className="admin-section-header">
                                <h3 className="admin-section-title">👤 Attributions</h3>
                                <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleAIEnrich()}>✨ AI Suggest</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {attributions.map((attr, idx) => (
                                    <div key={idx} className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'end' }}>
                                        <div className="form-group">
                                            <label className="form-label">Name</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={attr.name}
                                                list="creators-shared-list-edit"
                                                onChange={(e) => updateAttribution(idx, 'name', e.target.value)}
                                                placeholder="Creator Name"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Link</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={attr.url}
                                                onChange={(e) => updateAttribution(idx, 'url', e.target.value)}
                                                placeholder="Profile or External URL"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => removeAttribution(idx)}
                                            disabled={attributions.length <= 1}
                                            style={{ marginBottom: 'var(--space-2)' }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={addAttribution}>
                                + Add Another
                            </button>
                            <datalist id="creators-shared-list-edit">
                                {knownCreators.map((c) => (
                                    <option key={c.name} value={c.name} />
                                ))}
                            </datalist>
                        </div>

                        {isAdmin && (
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <h3 className="admin-section-title">🔒 Administrative Notes</h3>
                                </div>
                                <div className="admin-form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Resource Status</label>
                                        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as ResourceStatus)}>
                                            <option value="suggested">Suggested</option>
                                            <option value="reviewing">Reviewing</option>
                                            <option value="published">Published</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </div>
                                    <div className="form-group col-span-2">
                                        <label className="form-label">Internal Curator Notes</label>
                                        <textarea
                                            className="form-textarea"
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            placeholder="Internal admin notes..."
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Original actions now handled by sticky bar, but keeping legacy for mobile/noscript fallback if needed */}
                        <div className={`admin-form-actions transition-opacity duration-300 ${hasChanges ? 'opacity-20' : 'opacity-100'}`}>
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary btn-lg btn-glow" disabled={saving}>
                                {saving ? (
                                    <>
                                        <div className="spinner-inline" />
                                        Saving...
                                    </>
                                ) : (
                                    '✅ Update Resource'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Premium Sticky Curation Toolbar */}
            <div className={`fixed bottom-0 left-0 right-0 z-[100] transition-all duration-500 transform ${hasChanges ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                <div className="max-w-[1000px] mx-auto px-6 pb-8">
                    <div className="bg-[#12121a]/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4 pl-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                                <Icons.sparkles size={18} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm tracking-tight">Unsaved Changes</h4>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Administrative Context Active</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pr-2">
                            <button 
                                type="button" 
                                className="px-6 py-3 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
                                onClick={() => router.back()}
                            >
                                Discard
                            </button>
                            <button 
                                type="button" 
                                className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={(e) => handleSubmit(e as any)}
                                disabled={saving}
                            >
                                {saving ? (
                                    <div className="spinner-inline w-3 h-3 border-2" />
                                ) : (
                                    <span>Update Resource</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isOverloadModalOpen}
                onClose={() => setIsOverloadModalOpen(false)}
                title="AI Engine Overloaded"
                className="modal-premium"
            >
                <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⚡</div>
                    <p>The Gemini AI engine is currently overloaded. Please wait 10 seconds.</p>
                    {isWaitingToRetry && <h3>{retryCountdown}</h3>}
                    <button className="btn btn-primary" onClick={startRetryCountdown} disabled={isWaitingToRetry}>
                        Retry Now
                    </button>
                </div>
            </Modal>

            {/* Create Category Modal */}
            <Modal
                isOpen={isNewCatModalOpen}
                onClose={() => setIsNewCatModalOpen(false)}
                title="Create New Topic"
            >
                <form onSubmit={handleCreateCategory} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-white/40 uppercase tracking-widest">Topic Name</label>
                            <input 
                                type="text"
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                value={newCatData.name}
                                onChange={(e) => setNewCatData({ ...newCatData, name: e.target.value })}
                                placeholder="e.g. Structural Logic"
                                required
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-black text-white/40 uppercase tracking-widest">Symbol / Emoji</label>
                            <div 
                                className="flex flex-wrap gap-2 mb-2 p-3 bg-black/20 rounded-xl border border-white/5"
                                style={{ maxHeight: '160px', overflowY: 'auto' }}
                            >
                                {['📂', '🤖', '🧠', '🔮', '⚡', '🏗️', '📐', '🧩', '🔗', '📝', '🖼️', '🎬', '🎵', '🎨', '🎯', '✅', '📘', '📋', '🔄', '💎', '🚀', '💻', '🌐', '📱', '📖', '📚', '✍️', '🔬', '🧪', '🔭', '🧮', '📊', '📈', '📉', '🎮', '🎲', '🏆', '🛠️', '⚒️', '⚙️', '💡', '🔦', '🌍', '🪐', '☀️', '⭐', '🔥', '✨', '🌟', '💫', '💥', '💢', '💦', '💨', '💤', '🕳️', '💬', '🗨️', '🗯️', '💭', '👁️', '👂', '👃', '👄', '👅', '👆', '👇', '👈', '👉', '👊', '👋', '👌', '👍', '👎', '👏', '👐', '👑', '👒', '🎓', '🎩', '🎒', '👝', '👛', '👜', '💼', '👓', '🕶️', '💍', '🌂'].map(sym => (
                                    <button
                                        key={sym}
                                        type="button"
                                        onClick={() => setNewCatData({ ...newCatData, icon: sym })}
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${newCatData.icon === sym ? 'bg-indigo-500/20 border-indigo-500 text-white scale-110' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}
                                    >
                                        {sym}
                                    </button>
                                ))}
                            </div>
                            <input 
                                type="text"
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                value={newCatData.icon}
                                onChange={(e) => setNewCatData({ ...newCatData, icon: e.target.value })}
                                placeholder="📂"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 uppercase tracking-widest">Description</label>
                        <textarea 
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 h-24"
                            value={newCatData.description}
                            onChange={(e) => setNewCatData({ ...newCatData, description: e.target.value })}
                            placeholder="Optional topic description..."
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                        <button 
                            type="button"
                            onClick={() => setIsNewCatModalOpen(false)}
                            className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={newCatLoading}
                            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {newCatLoading ? 'Creating...' : 'Create & Select'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Action Notification Modal */}
            <ConfirmationModal
                isOpen={notificationModal.isOpen}
                onClose={() => setNotificationModal(prev => ({ ...prev, isOpen: false }))}
                title={notificationModal.title}
                message={notificationModal.message}
                confirmText="Understood"
                onConfirm={() => setNotificationModal(prev => ({ ...prev, isOpen: false }))}
                isDanger={notificationModal.type === 'error'}
            />

            <Footer />
        </div>
    );
}
