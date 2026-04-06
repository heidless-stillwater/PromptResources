'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { ThumbnailAsset } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AssetManagerPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    
    const [assets, setAssets] = useState<ThumbnailAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    // Upload form state
    const [newTitle, setNewTitle] = useState('');
    const [newTags, setNewTags] = useState('');
    const [newCategory, setNewCategory] = useState('');
    
    // AI Generation Assistant state
    const [isGeneratingInspiration, setIsGeneratingInspiration] = useState(false);
    const [scenarioDesc, setScenarioDesc] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isArchitectOpen, setIsArchitectOpen] = useState(false);
    const [quality, setQuality] = useState('draft');
    
    // In-Hub Generator Modal state
    const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
    const [isGeneratingInStudio, setIsGeneratingInStudio] = useState(false);
    const [studioResult, setStudioResult] = useState<any>(null);
    const [studioProgress, setStudioProgress] = useState<string>('');

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/resources');
            return;
        }
        if (isAdmin) {
            fetchAssets();
        }
    }, [isAdmin, authLoading]);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'thumbnailAssets'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate(),
                updatedAt: doc.data().updatedAt?.toDate()
            })) as ThumbnailAsset[];
            setAssets(data);
        } catch (error) {
            console.error('Error fetching assets:', error);
            setMessage({ type: 'error', text: 'Failed to load asset library.' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Please upload an image file.' });
            return;
        }

        try {
            setUploading(true);
            setMessage({ type: '', text: '' });

            // 1. Upload to Storage
            const storagePath = `thumbnail-assets/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 2. Create Firestore Record
            const assetData = {
                url: downloadURL,
                storagePath, // Store path for deletion cleanup
                title: newTitle || file.name,
                tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                category: newCategory || 'nanobanana',
                createdAt: new Date(),
                updatedAt: new Date(),
                addedBy: user.uid
            };

            await addDoc(collection(db, 'thumbnailAssets'), assetData);
            
            setMessage({ type: 'success', text: 'Asset uploaded and registered!' });
            setNewTitle('');
            setNewTags('');
            fetchAssets();
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleGeneratePrompt = async () => {
        if (!scenarioDesc || !user) return;
        
        try {
            setIsGeneratingInspiration(true);
            setMessage({ type: '', text: '' });
            setIsArchitectOpen(true);
            
            const idToken = await user.getIdToken();
            
            const response = await fetch('/api/assets/generate-prompt', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ description: scenarioDesc })
            });
            
            const result = await response.json();
            if (result.success) {
                setGeneratedPrompt(result.prompt);
            } else {
                throw new Error(result.error || 'Failed to architect scenario.');
            }
        } catch (error: any) {
            console.error('Generation helper error:', error);
            setMessage({ type: 'error', text: 'AI Architect is currently unavailable. Please ensure your Gemini API key is configured.' });
        } finally {
            setIsGeneratingInspiration(false);
        }
    };

    const useArchitectedScenario = () => {
        setNewTitle(scenarioDesc.length > 30 ? scenarioDesc.slice(0, 30) + '...' : scenarioDesc);
        setNewTags(`nanobanana, scenario, ${scenarioDesc.toLowerCase().split(' ').slice(0, 2).join('-')}`);
        setMessage({ type: 'success', text: 'Scenario metadata populated below! Now generate the image and upload it.' });
    };

    const handleStudioGenerate = async () => {
        if (!generatedPrompt || !user) return;
        
        try {
            setIsGeneratingInStudio(true);
            setIsStudioModalOpen(true);
            setStudioResult(null);
            setStudioProgress('Initializing Nanobanana bridge...');
            
            const idToken = await user.getIdToken();
            
            // Note: Crossing ports to Port 3001 (PromptTool API)
            const response = await fetch('http://localhost:3001/api/generate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ 
                    prompt: generatedPrompt,
                    uid: user.uid,
                    quality: quality === 'draft' ? 'standard' : quality, // Map draft to standard for API if needed
                    aspectRatio: '16:9',
                    promptType: 'freeform',
                    count: 1,
                    modality: 'image'
                })
            });

            if (!response.ok) throw new Error('Could not connect to Studio API. Ensure port 3001 is running.');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) return;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'progress') setStudioProgress(data.message);
                                if (data.type === 'image_ready') {
                                    setStudioResult(data.image);
                                    setStudioProgress('Image generated! Auto-registering...');
                                    
                                    // AUTOMATIC REGISTRATION
                                    const assetData = {
                                        url: data.image.imageUrl,
                                        storagePath: '', // Hosted in PromptTool storage
                                        title: newTitle || scenarioDesc || 'Studio Creation',
                                        tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                                        category: 'nanobanana',
                                        createdAt: new Date(),
                                        updatedAt: new Date(),
                                        addedBy: user.uid,
                                        isStudioAsset: true
                                    };

                                    const docRef = await addDoc(collection(db, 'thumbnailAssets'), assetData);
                                    
                                    // OPTIMISTIC UPDATE: Add to local state immediately
                                    const newAsset = { ...assetData, id: docRef.id } as ThumbnailAsset;
                                    setAssets(prev => [newAsset, ...prev]);
                                    
                                    setStudioProgress('Success! Asset registered to library.');
                                }
                            if (data.type === 'error') throw new Error(data.error);
                        } catch (e) { console.error('SSE bit parse error', e); }
                    }
                }
            }
        } catch (error: any) {
            console.error('Studio bridge error:', error);
            setStudioProgress(`Error: ${error.message}`);
        } finally {
            setIsGeneratingInStudio(false);
        }
    };

    const registerStudioAsset = async () => {
        if (!studioResult || !user) return;
        
        try {
            setUploading(true);
            const assetData = {
                url: studioResult.imageUrl,
                storagePath: '', // Hosted in PromptTool storage
                title: newTitle || scenarioDesc || 'Studio Creation',
                tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                category: 'nanobanana',
                createdAt: new Date(),
                updatedAt: new Date(),
                addedBy: user.uid,
                isStudioAsset: true
            };

            await addDoc(collection(db, 'thumbnailAssets'), assetData);
            setMessage({ type: 'success', text: 'Creation successfully registered to Hub library!' });
            setIsStudioModalOpen(false);
            fetchAssets();
        } catch (error) {
            console.error('Registration error:', error);
            setMessage({ type: 'error', text: 'Failed to register Studio asset.' });
        } finally {
            setUploading(false);
        }
    };

    const handleSetDefault = async (asset: ThumbnailAsset) => {
        try {
            setLoading(true);
            const oldDefault = assets.find(a => a.isDefault);
            if (oldDefault) {
                await updateDoc(doc(db, 'thumbnailAssets', oldDefault.id), { isDefault: false });
            }
            await updateDoc(doc(db, 'thumbnailAssets', asset.id), { isDefault: true });
            setAssets(prev => prev.map(a => ({
                ...a,
                isDefault: a.id === asset.id
            })));
            setMessage({ type: 'success', text: `"${asset.title}" is now the HUB DEFAULT template.` });
        } catch (error) {
            console.error('Error setting default:', error);
            setMessage({ type: 'error', text: 'Failed to set default asset.' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (asset: any) => {
        if (!confirm('Are you sure? This will delete the image from storage and the registry.')) return;

        try {
            setLoading(true);
            if (asset.storagePath) {
                const storageRef = ref(storage, asset.storagePath);
                await deleteObject(storageRef).catch(err => console.warn('Storage delete fail:', err));
            }

            await deleteDoc(doc(db, 'thumbnailAssets', asset.id));
            setAssets(prev => prev.filter(a => a.id !== asset.id));
            setMessage({ type: 'success', text: 'Asset permanently removed.' });
        } catch (error) {
            console.error('Delete error:', error);
            setMessage({ type: 'error', text: 'Failed to delete asset.' });
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || !isAdmin) {
        return <div className="page-wrapper"><Navbar /><div className="loading-page"><div className="spinner" /></div></div>;
    }

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-8)' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                                <h1 style={{ margin: 0 }}>🎨 Thumbnail Asset Hub</h1>
                                <Link href="/admin" className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    ⚙️ Admin Panel
                                </Link>
                            </div>
                            <p style={{ color: 'var(--text-muted)' }}>Manage scenario-specific images generated with Nanobanana</p>
                        </div>
                        <div className="glass-card" style={{ padding: 'var(--space-4)', maxWidth: '400px' }}>
                            <h4 style={{ marginBottom: 'var(--space-3)', fontSize: '14px' }}>⬆️ Register New Nanobanana Asset</h4>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Title (e.g. Gemini Tutorial Dark)" 
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    style={{ fontSize: '12px', padding: '6px 10px' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Tags (comma separated: tool, gemini, blue)" 
                                    value={newTags}
                                    onChange={e => setNewTags(e.target.value)}
                                    style={{ fontSize: '12px', padding: '6px 10px' }}
                                />
                            </div>
                            <input 
                                type="file" 
                                id="asset-upload" 
                                hidden 
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                            <label htmlFor="asset-upload" className={`btn btn-primary btn-block ${uploading ? 'disabled' : ''}`}>
                                {uploading ? 'Processing...' : '📁 Upload & Tag Asset'}
                            </label>
                        </div>
                    </div>

                    {/* ✨ AI Scenario Architect Section */}
                    <div className="glass-card" style={{ 
                        marginBottom: 'var(--space-8)', 
                        padding: 'var(--space-6)', 
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
                        border: '1px solid rgba(168, 85, 247, 0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                            <div>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
                                    ✨ AI Scenario Architect
                                </h3>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                    Describe your resource scenario and we'll engineer the perfect Nanobanana prompt for it.
                                </p>
                            </div>
                            <button 
                                className="btn btn-ghost btn-sm"
                                onClick={() => setIsArchitectOpen(!isArchitectOpen)}
                            >
                                {isArchitectOpen ? 'Collapse' : 'Open Architect'}
                            </button>
                        </div>

                        {isArchitectOpen && (
                            <div className="animate-fade-in">
                                <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ flex: 1 }}>
                                        <label className="form-label">Scenario Description</label>
                                        <textarea
                                            className="form-input"
                                            rows={2}
                                            placeholder="e.g. A futuristic workspace showing a Gemini AI assistant drafting code with a clean blue aesthetic..."
                                            value={scenarioDesc}
                                            onChange={(e) => setScenarioDesc(e.target.value)}
                                            style={{ resize: 'none', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div style={{ alignSelf: 'flex-end', paddingBottom: '4px' }}>
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={handleGeneratePrompt}
                                            disabled={isGeneratingInspiration || !scenarioDesc}
                                            style={{ padding: 'var(--space-3) var(--space-6)' }}
                                        >
                                            {isGeneratingInspiration ? <div className="spinner-inline" /> : '🚀 Architect Scenario'}
                                        </button>
                                    </div>
                                </div>

                                {generatedPrompt && (
                                    <div className="glass-card animate-fade-in" style={{ padding: 'var(--space-4)', background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(168, 85, 247, 0.4)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-300)', textTransform: 'uppercase' }}>Recommended Nanobanana Prompt</span>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button 
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedPrompt);
                                                        setMessage({ type: 'success', text: 'Prompt copied! Use it in Nanobanana Studio.' });
                                                    }}
                                                >
                                                    Copy
                                                </button>
                                                <button 
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={useArchitectedScenario}
                                                    style={{ border: '1px solid rgba(168, 85, 247, 0.3)' }}
                                                >
                                                    ✅ Populate Metadata
                                                </button>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                                            "{generatedPrompt}"
                                        </p>
                                        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 'var(--space-2)', 
                                                background: 'var(--bg-input)', 
                                                padding: '6px 14px', 
                                                borderRadius: 'var(--radius-sm)', 
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fidelity</span>
                                                <select 
                                                    value={quality} 
                                                    onChange={(e) => setQuality(e.target.value)}
                                                    style={{ 
                                                        background: 'transparent', 
                                                        color: 'var(--text-primary)', 
                                                        border: 'none', 
                                                        fontSize: '12px', 
                                                        fontWeight: 600, 
                                                        outline: 'none', 
                                                        cursor: 'pointer',
                                                        appearance: 'none',
                                                        paddingRight: '4px'
                                                    }}
                                                >
                                                    <option value="draft" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Draft (Fast)</option>
                                                    <option value="standard" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Standard HD</option>
                                                    <option value="high" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>High Def (2K)</option>
                                                    <option value="ultra" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Ultra 4K</option>
                                                </select>
                                            </div>
                                                <button 
                                                    onClick={handleStudioGenerate}
                                                    className="btn btn-primary btn-sm"
                                                    style={{ background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)', border: 'none' }}
                                                >
                                                    ⚡ Generate in Hub
                                                </button>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                                💡 Use the generated prompt on port 3001, then upload your masterpiece below.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {message.text && (
                        <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-6)' }}>
                            {message.text}
                        </div>
                    )}

                    {loading && assets.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
                            <div className="spinner" />
                        </div>
                    ) : (
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                            gap: 'var(--space-6)' 
                        }}>
                            {assets.map((asset: any) => (
                                <div key={asset.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div style={{ position: 'relative', height: '160px', width: '100%' }}>
                                        <Image 
                                            src={asset.url} 
                                            alt={asset.title} 
                                            fill 
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            style={{ objectFit: 'cover' }}
                                        />
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: '8px', 
                                            right: '8px',
                                            display: 'flex',
                                            gap: '4px',
                                            zIndex: 10
                                        }}>
                                            <button 
                                                className="btn btn-danger btn-sm" 
                                                onClick={() => handleDelete(asset)}
                                                style={{ padding: '4px 8px', fontSize: '10px' }}
                                            >
                                                🗑️ Delete
                                            </button>
                                            {!asset.isDefault && (
                                                <button 
                                                    className="btn btn-secondary btn-sm" 
                                                    onClick={() => handleSetDefault(asset)}
                                                    style={{ padding: '4px 8px', fontSize: '10px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                                                >
                                                    ⭐ Set Default
                                                </button>
                                            )}
                                        </div>
                                        {asset.isDefault && (
                                            <div style={{ 
                                                position: 'absolute', 
                                                bottom: '8px', 
                                                left: '8px',
                                                background: 'var(--success)',
                                                color: 'white',
                                                padding: '2px 8px',
                                                borderRadius: '100px',
                                                fontSize: '9px',
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                                                zIndex: 10
                                            }}>
                                                Primary Default
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: 'var(--space-4)' }}>
                                        <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>{asset.title}</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {asset.tags?.map((tag: string) => (
                                                <span key={tag} className="badge badge-secondary" style={{ fontSize: '10px' }}>
                                                    {tag}
                                                </span>
                                            ))}
                                            {(!asset.tags || asset.tags.length === 0) && (
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>No tags</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && assets.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🖼️</div>
                            <h3>Library is Empty</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>Upload your Nanobanana scenario images to start building your curation toolkit.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 🎨 Nanobanana Studio Modal (Port 3001 Bridge) */}
            {isStudioModalOpen && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 
                }}>
                    <div className="glass-card animate-scale-in" style={{ 
                        width: '90%', maxWidth: '600px', padding: 'var(--space-8)', 
                        border: '1px solid var(--accent-primary)', boxShadow: 'var(--shadow-glow)' 
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
                            <h2 style={{ margin: 0, fontSize: '20px' }}>🎨 Nanobanana Hub Generator</h2>
                            <button className="btn btn-ghost" onClick={() => setIsStudioModalOpen(false)}>✕</button>
                        </div>

                        <div style={{ 
                            height: '300px', width: '100%', background: 'rgba(0,0,0,0.4)', 
                            borderRadius: 'var(--radius-md)', border: '1px dashed rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                            position: 'relative', marginBottom: 'var(--space-6)'
                        }}>
                            {isGeneratingInStudio ? (
                                <div style={{ textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                                    <p style={{ fontSize: '13px', color: 'var(--accent-300)', fontWeight: 600 }}>{studioProgress}</p>
                                </div>
                            ) : studioResult ? (
                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <Image 
                                        src={studioResult.imageUrl} 
                                        alt="Result" 
                                        fill 
                                        priority
                                        sizes="(max-width: 768px) 90vw, 600px"
                                        style={{ objectFit: 'contain' }}
                                    />
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>{studioProgress || 'Waiting for generation...'}</p>
                            )}
                        </div>

                        {studioResult && (
                            <div className="animate-fade-in" style={{ textAlign: 'center', marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <p style={{ fontSize: '14px', color: 'var(--success)', fontWeight: 700, margin: 0 }}>
                                    ✨ Successfully registered to Hub Library
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ flex: 1, height: '48px', background: studioResult ? 'var(--bg-input)' : undefined }}
                                onClick={() => setIsStudioModalOpen(false)}
                            >
                                {studioResult ? 'Close Generator' : 'Cancel'}
                            </button>
                            <button 
                                className="btn btn-ghost" 
                                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                                onClick={handleStudioGenerate}
                                disabled={isGeneratingInStudio}
                            >
                                {studioResult ? '🔄 Regenerate' : '🚀 Start Generation'}
                            </button>
                        </div>
                        
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'var(--space-6)', textAlign: 'center' }}>
                            💡 This generation is powered by the Nanobanana API on port 3001.
                        </p>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
