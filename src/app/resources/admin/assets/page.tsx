'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { ThumbnailAsset } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/ui/Icons';

export default function AssetManagerPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper dashboard-theme min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initialising Asset Hub</div>
                </div>
            </div>
        }>
            <AssetManagerContent />
        </Suspense>
    );
}

function AssetManagerContent() {
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
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorDetails, setErrorDetails] = useState({ title: '', message: '' });

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/resources');
            return;
        }
        if (isAdmin) {
            fetchAssets();
        }
    }, [isAdmin, authLoading, router]);

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

            const storagePath = `thumbnail-assets/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const assetData = {
                url: downloadURL,
                storagePath,
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
            setErrorDetails({
                title: 'AI Architect Unavailable',
                message: 'The AI Architect is currently experiencing high demand or is temporarily offline.'
            });
            setShowErrorModal(true);
        } finally {
            setIsGeneratingInspiration(false);
        }
    };

    const useArchitectedScenario = () => {
        setNewTitle(scenarioDesc.length > 30 ? scenarioDesc.slice(0, 30) + '...' : scenarioDesc);
        setNewTags(`nanobanana, scenario, ${scenarioDesc.toLowerCase().split(' ').slice(0, 2).join('-')}`);
        setMessage({ type: 'success', text: 'Scenario metadata populated below!' });
    };

    const handleStudioGenerate = async () => {
        if (!generatedPrompt || !user) return;
        
        try {
            setIsGeneratingInStudio(true);
            setIsStudioModalOpen(true);
            setStudioResult(null);
            setStudioProgress('Initializing Nanobanana bridge...');
            
            const idToken = await user.getIdToken();
            
            const response = await fetch('http://localhost:3001/api/generate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ 
                    prompt: generatedPrompt,
                    uid: user.uid,
                    quality: quality === 'draft' ? 'standard' : quality,
                    aspectRatio: '16:9',
                    promptType: 'freeform',
                    count: 1,
                    modality: 'image'
                })
            });

            if (!response.ok) throw new Error('Could not connect to Studio API.');

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
                                
                                const assetData = {
                                    url: data.image.imageUrl,
                                    storagePath: '',
                                    title: newTitle || scenarioDesc || 'Studio Creation',
                                    tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                                    category: 'nanobanana',
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                    addedBy: user.uid,
                                    isStudioAsset: true
                                };

                                const docRef = await addDoc(collection(db, 'thumbnailAssets'), assetData);
                                
                                const newAsset: ThumbnailAsset = { 
                                    ...assetData, 
                                    id: docRef.id,
                                    createdAt: assetData.createdAt,
                                    updatedAt: assetData.updatedAt
                                };
                                
                                setAssets(prev => [newAsset, ...prev]);
                                setStudioProgress('Success! Asset registered to library.');
                                setTimeout(() => fetchAssets(), 1000);
                            }
                            if (data.type === 'error') throw new Error(data.error);
                        } catch (e) { }
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
        } catch (error) {
            console.error('Error setting default:', error);
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
        } catch (error) {
            console.error('Delete error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="page-wrapper dashboard-theme min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Authorizing Access</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-background text-white selection:bg-primary/30">
            <Navbar />

            {/* Cinematic Hero */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-48 -mt-48" />
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex flex-col">
                            <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                Registry Intelligence / Systems / Assets
                            </div>
                            <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white leading-none">
                                Asset <span className="text-primary font-black">Library</span>
                            </h1>
                            <p className="text-white/40 font-medium max-w-xl mt-4 leading-relaxed">
                                Manage scenario-specific images generated with Nanobanana. Orchestrate visual representations across the discovery cloud.
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-3">
                            <Link href="/admin" className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 transition-all active:scale-95 flex items-center gap-2">
                                <Icons.settings size={14} /> Authority Hub
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 -mt-20 pb-20 relative z-30">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Control Bench */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* AI Scenario Architect */}
                        <div className="glass-card p-8 border-primary/20 relative overflow-hidden group bg-background-secondary/30">
                             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-all duration-1000" />
                             
                            <div className="flex items-center gap-4 mb-8 relative z-10">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary border border-primary/20">
                                    <Icons.zap size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-black uppercase tracking-widest text-white/80">Scenario Architect</h3>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">AI-Powered Asset Engineering</p>
                                </div>
                            </div>

                            <div className="space-y-6 relative z-10">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest pl-2">Scenario Objective</label>
                                    <textarea 
                                        className="w-full bg-background/40 border border-white/10 rounded-2xl px-6 py-5 text-sm font-medium focus:border-primary outline-none transition-all min-h-[100px] leading-relaxed"
                                        placeholder="Describe the visual objective (e.g. A futuristic workspace showing a Gemini AI assistant drafting code with a clean blue aesthetic...)"
                                        value={scenarioDesc}
                                        onChange={(e) => setScenarioDesc(e.target.value)}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                     <button 
                                        className="px-10 py-4 bg-primary hover:bg-primary/80 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                        onClick={handleGeneratePrompt}
                                        disabled={isGeneratingInspiration || !scenarioDesc}
                                    >
                                        {isGeneratingInspiration ? <Icons.spinner size={16} className="animate-spin" /> : <Icons.zap size={16} />}
                                        Architect Scenario
                                    </button>

                                    {generatedPrompt && (
                                        <button 
                                            className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2"
                                            onClick={handleStudioGenerate}
                                            disabled={isGeneratingInStudio}
                                        >
                                            {isGeneratingInStudio ? <Icons.spinner size={16} className="animate-spin" /> : <Icons.plus size={16} />}
                                            Generate in Hub
                                        </button>
                                    )}
                                </div>

                                {generatedPrompt && (
                                    <div className="p-6 bg-primary/10 border border-primary/20 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Recommended Nanobanana Prompt</span>
                                            <button 
                                                className="text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedPrompt);
                                                    setMessage({ type: 'success', text: 'Prompt copied!' });
                                                }}
                                            >
                                                Copy Identity
                                            </button>
                                        </div>
                                        <p className="text-xs font-medium text-white/70 italic leading-relaxed">"{generatedPrompt}"</p>
                                        <div className="flex justify-end mt-6">
                                            <button className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-2" onClick={useArchitectedScenario}>
                                                <Icons.check size={10} strokeWidth={4} /> Populate Metadata
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assets Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {assets.map((asset) => (
                                <div key={asset.id} className="glass-card overflow-hidden group/card hover:border-primary/30 transition-all bg-background-secondary/30">
                                    <div className="relative aspect-video overflow-hidden">
                                        <img 
                                            src={asset.url} 
                                            alt={asset.title} 
                                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                        
                                        <div className="absolute top-4 left-4 z-10 flex gap-2">
                                            {asset.isDefault ? (
                                                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-lg backdrop-blur-md">
                                                    Hub Default
                                                </span>
                                            ) : (
                                                <button 
                                                    onClick={() => handleSetDefault(asset)}
                                                    className="px-3 py-1 bg-black/40 hover:bg-primary/40 border border-white/10 text-white/40 hover:text-white text-[8px] font-black uppercase tracking-widest rounded-lg backdrop-blur-md opacity-0 group-hover/card:opacity-100 transition-all"
                                                >
                                                    Set Default
                                                </button>
                                            )}
                                        </div>

                                        <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover/card:opacity-100 transition-all">
                                            <button 
                                                onClick={() => handleDelete(asset)}
                                                className="p-2 bg-rose-500/20 hover:bg-rose-500 border border-rose-500/30 text-rose-400 hover:text-white rounded-lg backdrop-blur-md transition-all"
                                            >
                                                <Icons.trash size={12} />
                                            </button>
                                        </div>

                                        <div className="absolute bottom-4 left-4 right-4 z-10">
                                            <div className="flex flex-col">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{asset.category}</div>
                                                <h4 className="text-sm font-black text-white group-hover/card:text-primary transition-colors">{asset.title}</h4>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 flex flex-wrap gap-2">
                                        {asset.tags?.map((tag) => (
                                            <span key={tag} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black uppercase tracking-widest text-white/30 group-hover/card:text-white/60 transition-colors">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar Bench */}
                    <div className="space-y-8">
                        {/* Registrar Form */}
                        <div className="glass-card p-8 bg-primary/[0.03] border-primary/20">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/30 mb-8 flex items-center gap-2">
                                <Icons.plus size={14} className="text-primary" /> Registrar
                            </h3>
                            
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-widest pl-2">Asset Title</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-background/40 border border-white/5 rounded-2xl px-5 py-4 text-xs font-bold focus:border-primary outline-none transition-all placeholder:text-white/10"
                                        placeholder="e.g. Gemini Tutorial Dark"
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-widest pl-2">Tags (Signals)</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-background/40 border border-white/5 rounded-2xl px-5 py-4 text-xs font-bold focus:border-primary outline-none transition-all placeholder:text-white/10"
                                        placeholder="tool, gemini, blue, workspace"
                                        value={newTags}
                                        onChange={e => setNewTags(e.target.value)}
                                    />
                                </div>
                                
                                <input type="file" id="asset-upload" hidden onChange={handleFileUpload} disabled={uploading} />
                                <label htmlFor="asset-upload" className={`w-full py-4 bg-primary hover:bg-primary/80 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/20 cursor-pointer flex items-center justify-center gap-3 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {uploading ? <Icons.spinner size={16} className="animate-spin" /> : <Icons.upload size={16} />}
                                    Commence Registration
                                </label>
                            </div>
                        </div>

                        {/* Info Hub */}
                        <div className="glass-card p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Icons.info size={14} className="text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Hub Protocols</span>
                            </div>
                            <p className="text-xs font-medium text-white/40 leading-relaxed">
                                Assets registered here are used as visual proxies for non-video resources. The <span className="text-primary">Scenario Architect</span> ensures thematic consistency across the registry.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />

            {/* In-Hub Studio Modal */}
            {isStudioModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
                    <div className="bg-background-secondary border border-white/20 rounded-[3rem] p-12 max-w-2xl w-full text-center shadow-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
                        
                        <div className="flex justify-between items-start mb-10">
                            <div className="text-left">
                                <h2 className="text-3xl font-black uppercase tracking-widest">Studio <span className="text-primary">Bridge</span></h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mt-1">Nanobanana Execution Protocol</p>
                            </div>
                            <button className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all" onClick={() => setIsStudioModalOpen(false)}>
                                <Icons.close size={20} />
                            </button>
                        </div>

                        <div className="bg-black/40 border border-white/5 rounded-3xl aspect-video relative overflow-hidden mb-10 flex items-center justify-center">
                            {isGeneratingInStudio ? (
                                <div className="flex flex-col items-center gap-6">
                                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">{studioProgress}</div>
                                </div>
                            ) : studioResult ? (
                                <img src={studioResult.imageUrl} alt="Result" className="w-full h-full object-cover animate-in zoom-in-95 duration-500" />
                            ) : (
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/10">Establishing Bridge Connection...</div>
                            )}
                        </div>

                        {studioResult && (
                            <div className="mb-10 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-2">
                                    <Icons.check size={14} strokeWidth={4} /> Asset Successfully Registered to Registry
                                </span>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button 
                                className="flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                                onClick={() => setIsStudioModalOpen(false)}
                            >
                                Terminate
                            </button>
                            <button 
                                className="flex-[2] py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary/80 transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2"
                                onClick={handleStudioGenerate}
                                disabled={isGeneratingInStudio}
                            >
                                {isGeneratingInStudio ? <Icons.spinner className="animate-spin" /> : <><Icons.zap size={16} /> Force Regeneration</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
