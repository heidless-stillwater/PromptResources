'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Modal from '@/components/Modal';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Attribution, Platform, ResourcePricing, ResourceType, MediaFormat, ResourceStatus, UserProfile } from '@/lib/types';
import { suggestCategories, suggestAttributions, getDefaultCategories, suggestDescription, suggestTags } from '@/lib/suggestions';
import { extractYouTubeId, isYouTubeUrl, fetchYouTubeMetadata, isGenericYouTubeName, deduplicateAttributions } from '@/lib/youtube';
import ThumbnailPicker from '@/components/ThumbnailPicker';
import { Icons } from '@/components/ui/Icons';
import { Category, ApiResponse } from '@/lib/types';
import Footer from '@/components/Footer';
import ConfirmationModal from '@/components/ConfirmationModal';

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
    const [knownCreators, setKnownCreators] = useState<Array<{ name: string; url: string }>>([]);
    const [hasContent, setHasContent] = useState(false);

    const allCategories = getDefaultCategories();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isEnriching, setIsEnriching] = useState(false);
    
    // AI Overload Retry Logic
    const [isOverloadModalOpen, setIsOverloadModalOpen] = useState(false);
    const [retryCountdown, setRetryCountdown] = useState(10);
    const [isWaitingToRetry, setIsWaitingToRetry] = useState(false);
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
        setNewCatLoading(true);
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    // Content detection for sticky bar
    useEffect(() => {
        const hasAnyContent = !!(title.trim() || url.trim() || description.trim() || selectedCategories.length > 0);
        setHasContent(hasAnyContent);
    }, [title, url, description, selectedCategories]);

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

        const validAttributions = attributions.filter((c) => (c.name || '').trim() && (c.url || '').trim());

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
                    {/* Breadcrumb & Top Nav */}
                    <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            <Link href="/resources" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                                ← Resources
                            </Link>
                            <span>/</span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                                {isAdmin ? 'Add New Resource' : 'Suggest a Resource'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            {isAdmin && (
                                <Link href="/admin" className="btn btn-secondary btn-sm" id="back-to-admin">
                                    ⚙️ Admin
                                </Link>
                            )}
                            <Link href="/resources" className="btn btn-primary btn-sm" id="back-to-resources">
                                📚 Resources
                            </Link>
                        </div>
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
                                    className={`btn btn-primary btn-sm btn-glow ${isEnriching ? 'loading' : ''}`}
                                    onClick={() => handleAIEnrich()}
                                    id="ai-quick-autofill"
                                    disabled={!url || isEnriching}
                                    title="Autofill Description, Tags, Categories and Attributions using Gemini AI"
                                >
                                    {isEnriching ? <span className="spinner-inline mr-2" /> : '✨'} Magic AI Autofill
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
                                <div className="col-span-2 space-y-8 mb-6 pb-6 border-b border-white/5">
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
                                    </div>
                                    
                                    <ThumbnailPicker 
                                        isOpen={isPickerOpen} 
                                        onClose={() => setIsPickerOpen(false)}
                                        onSelect={(url) => setThumbnailUrl(url)}
                                    />
                                </div>
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

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {attributions.map((attr, idx) => (
                                            <div key={idx} style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: '1fr 1fr 1fr auto', 
                                                gap: 'var(--space-2)', 
                                                alignItems: 'center',
                                                padding: 'var(--space-2)',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={attr.name}
                                                        list="creators-shared-list"
                                                        onChange={(e) => updateAttribution(idx, 'name', e.target.value)}
                                                        placeholder="Creator Name"
                                                        disabled={attr.userId === user.uid}
                                                        style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)', width: '100%' }}
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={attr.url}
                                                    onChange={(e) => updateAttribution(idx, 'url', e.target.value)}
                                                    placeholder="Profile Link"
                                                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}
                                                />
                                                <select
                                                    className="form-select"
                                                    value={attr.role || 'author'}
                                                    onChange={(e) => updateAttribution(idx, 'role', e.target.value)}
                                                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}
                                                >
                                                    <option value="author">Author</option>
                                                    <option value="curator">Curator</option>
                                                    <option value="presenter">Presenter</option>
                                                    <option value="contributor">Contrib</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => removeAttribution(idx)}
                                                    style={{ color: 'var(--danger-400)', padding: 'var(--space-1)' }}
                                                >
                                                    ✕
                                                </button>
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
                                    <datalist id="creators-shared-list">
                                        {knownCreators.map((c) => (
                                            <option key={c.name} value={c.name} />
                                        ))}
                                    </datalist>
                                </div>

                                <div className="form-group col-span-2">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <label className="form-label" htmlFor="description" style={{ marginBottom: 0 }}>Description *</label>
                                        <button
                                            type="button"
                                            className={`btn btn-secondary btn-sm ${isEnriching ? 'opacity-50' : ''}`}
                                            onClick={() => handleAIEnrich('description')}
                                            id="ai-suggest-description"
                                            disabled={!url || isEnriching}
                                        >
                                            {isEnriching ? '...' : '✨ AI Suggest'}
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
                                            className={`btn btn-secondary btn-sm ${isEnriching ? 'opacity-50' : ''}`}
                                            onClick={() => handleAIEnrich('tags')}
                                            id="ai-suggest-tags"
                                            disabled={!url || isEnriching}
                                        >
                                            {isEnriching ? '...' : '✨ AI Suggest'}
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
                                    <div className="selection-label flex justify-between items-center w-full">
                                        <span>Available Topics:</span>
                                        {isAdmin && (
                                            <button 
                                                type="button" 
                                                onClick={() => setIsNewCatModalOpen(true)}
                                                className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                                            >
                                                <Icons.plus size={12} /> Create New
                                            </button>
                                        )}
                                    </div>
                                    <div className="chips-container">
                                        {dbCategories
                                            .filter((c) => !selectedCategories.includes(c.name))
                                            .map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    className="chip clickable"
                                                    style={{ background: 'rgba(255,255,255,0.05)' }}
                                                    onClick={() => addCategory(cat.name)}
                                                >
                                                    {cat.icon || '📂'} {cat.name}
                                                </button>
                                            ))}
                                        
                                        {/* Fallback to default categories if DB is empty or for extra coverage */}
                                        {allCategories
                                            .filter((name) => !selectedCategories.includes(name) && !dbCategories.some(db => db.name === name))
                                            .map((cat) => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    className="chip clickable opacity-60"
                                                    style={{ background: 'rgba(255,255,255,0.02)' }}
                                                    onClick={() => addCategory(cat)}
                                                >
                                                    + {cat}
                                                </button>
                                            ))}
                                    </div>
                                </div>
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

                        {/* Original actions handled by sticky bar */}
                        <div className={`admin-form-actions transition-opacity duration-300 ${hasContent ? 'opacity-20' : 'opacity-100'}`}>
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg btn-glow"
                                disabled={loading}
                                id="submit-resource-legacy"
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

            {/* Premium Sticky Curation Toolbar (Unified with Edit Flow) */}
            <div className={`fixed bottom-0 left-0 right-0 z-[100] transition-all duration-500 transform ${hasContent ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                <div className="max-w-[1000px] mx-auto px-6 pb-8">
                    <div className="bg-[#12121a]/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4 pl-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                                <Icons.plus size={18} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm tracking-tight">{isAdmin ? 'Add New Resource' : 'Suggest Resource'}</h4>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Entry Context Active</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pr-2">
                            <button 
                                type="button" 
                                className="px-6 py-3 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
                                onClick={() => router.back()}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={(e) => handleSubmit(e as any)}
                                disabled={loading}
                                id="submit-resource-sticky"
                            >
                                {loading ? (
                                    <div className="spinner-inline w-3 h-3 border-2" />
                                ) : (
                                    <span>{isAdmin ? '✅ Add Resource' : '🚀 Submit for Review'}</span>
                                )}
                            </button>
                        </div>
                    </div>
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
                                <div className="flex gap-2">
                                    <Link 
                                        href={`/resources/${match.id}`} 
                                        target="_blank"
                                        className="btn btn-sm btn-secondary flex items-center gap-1.5"
                                        style={{ whiteSpace: 'nowrap', padding: 'var(--space-2) var(--space-3)', fontSize: '11px' }}
                                    >
                                        🔍 View
                                    </Link>
                                    <button 
                                        className="btn btn-sm btn-primary" 
                                        style={{ whiteSpace: 'nowrap', padding: 'var(--space-2) var(--space-3)', fontSize: '11px' }}
                                        onClick={() => { setDupWarning(null); doSubmit(match.id); }}
                                        disabled={loading}
                                    >
                                        Overwrite
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

            {/* AI Overload Modal */}
            <Modal
                isOpen={isOverloadModalOpen}
                onClose={() => setIsOverloadModalOpen(false)}
                title="AI Engine Overloaded"
                className="modal-premium"
                footer={
                    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                        <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsOverloadModalOpen(false)}
                            disabled={isWaitingToRetry}
                        >
                            Cancel
                        </button>
                        <button 
                            className="btn btn-primary btn-sm btn-glow"
                            onClick={startRetryCountdown}
                            disabled={isWaitingToRetry}
                        >
                            {isWaitingToRetry ? `Retrying in ${retryCountdown}s...` : 'Retry after 10s Pause'}
                        </button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                    <div style={{ fontSize: '3rem' }}>⚡</div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        The Gemini AI engine is currently experiencing high demand and is temporarily overloaded.
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        This is usually a brief spike. We recommend waiting 10 seconds before attempting another generation.
                    </p>
                    {isWaitingToRetry && (
                        <div className="countdown-container" style={{ marginTop: 'var(--space-4)' }}>
                            <div className="spinner-inline" style={{ width: '24px', height: '24px', marginRight: 'var(--space-3)' }} />
                            <span style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--accent-primary)' }}>{retryCountdown}</span>
                        </div>
                    )}
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
                            <div className="flex flex-wrap gap-2 mb-2 p-3 bg-black/20 rounded-xl border border-white/5">
                                {['📂', '🤖', '🧠', '🔮', '⚡', '🏗️', '📐', '🧩', '🔗', '📝', '🖼️', '🎬', '🎵', '🎨', '🎯', '✅', '📘', '📋', '🔄', '💎'].map(sym => (
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
