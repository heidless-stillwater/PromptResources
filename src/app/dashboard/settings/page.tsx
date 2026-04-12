'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ManageSubscriptionButton from '@/components/ManageSubscriptionButton';
import { Icons } from '@/components/ui/Icons';

export default function SettingsPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const [displayName, setDisplayName] = useState(profile?.displayName || '');
    const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
    
    // Creator Profile fields
    const [isPublicProfile, setIsPublicProfile] = useState(profile?.isPublicProfile || false);
    const [profileType, setProfileType] = useState(profile?.profileType || 'individual');
    const [slug, setSlug] = useState(profile?.slug || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [bannerUrl, setBannerUrl] = useState(profile?.bannerUrl || '');
    
    const [message, setMessage] = useState({ type: '', text: '' });
    const [imgError, setImgError] = useState(false);

    // Update state when profile loads
    React.useEffect(() => {
        if (profile) {
            setDisplayName(profile.displayName || '');
            setPhotoURL(profile.photoURL || '');
            setIsPublicProfile(profile.isPublicProfile || false);
            setProfileType(profile.profileType || 'individual');
            setSlug(profile.slug || '');
            setBio(profile.bio || '');
            setBannerUrl(profile.bannerUrl || '');
            setImgError(false);
        }
    }, [profile]);

    const updateProfileMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!user) throw new Error('Not authenticated');
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                ...data,
                updatedAt: new Date(),
            });
        },
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
        },
        onError: (error) => {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        }
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!user) throw new Error('Not authenticated');
            const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        },
        onSuccess: (downloadURL) => {
            setPhotoURL(downloadURL);
            setImgError(false);
            setMessage({ type: 'success', text: 'Image uploaded! Remember to save changes.' });
        },
        onError: (error) => {
            console.error('Error uploading file:', error);
            setMessage({ type: 'error', text: 'Failed to upload image.' });
        }
    });

    if (authLoading || !user) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        
        let finalSlug = slug.trim();
        if (isPublicProfile && !finalSlug) {
            finalSlug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            setSlug(finalSlug);
        }
        
        updateProfileMutation.mutate({ 
            displayName, 
            photoURL,
            isPublicProfile,
            profileType: profileType as any,
            slug: finalSlug,
            bio,
            bannerUrl
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Please upload an image file.' });
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            setMessage({ type: 'error', text: 'Image size should be less than 2MB.' });
            return;
        }

        setMessage({ type: '', text: '' });
        uploadMutation.mutate(file);
    };

    const saving = updateProfileMutation.isPending;
    const uploading = uploadMutation.isPending;

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] text-white selection:bg-indigo-500/30">
            <Navbar />
            
            {/* ── CINEMATIC HERO COVER ── */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer (Blurred Telemetry) */}
                <div className="absolute inset-0 z-0">
                    {bannerUrl ? (
                        <div className="relative w-full h-full">
                            <img src={bannerUrl} alt="" className="w-full h-full object-cover opacity-30 scale-110 blur-3xl" />
                            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/0 via-[#0a0a0f]/60 to-[#0a0a0f]" />
                            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
                        </div>
                    ) : (
                        <div className="w-full h-full bg-[#0a0a0f]">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-50" />
                        </div>
                    )}
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    {/* Header Pathing */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                                <Icons.settings size={20} className="text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Workspace
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                    <span className="text-white uppercase">Account Configuration</span>
                                    <span className="opacity-20">/</span>
                                    <span className="text-indigo-400/60 font-black">User Preferences</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {saving && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Syncing Registry...</span>
                                </div>
                            )}
                            <button 
                                onClick={handleUpdateProfile}
                                className="px-8 py-3 bg-indigo-600 border border-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                <Icons.copy size={14} className="inline mr-2" /> Save Global Changes
                            </button>
                        </div>
                    </div>

                    {/* Identity Glass Card (Profile Overview) */}
                    <div className="glass-card p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row gap-10">
                            {/* Visual Identity (Avatar Management) */}
                            <div className="relative flex-shrink-0">
                                <div className="w-32 h-32 md:w-48 md:h-48 rounded-[2.5rem] p-[2px] bg-gradient-to-br from-white/40 via-white/5 to-transparent backdrop-blur-3xl shadow-2xl overflow-hidden hover:scale-105 transition-transform duration-500 cursor-pointer"
                                     onClick={() => document.getElementById('avatar-upload')?.click()}>
                                    <div className="w-full h-full rounded-[2.4rem] overflow-hidden bg-[#0a0a0f] relative group/avatar">
                                        {photoURL && !imgError ? (
                                            <img src={photoURL} alt={displayName} className="w-full h-full object-cover transition-opacity duration-300 group-hover/avatar:opacity-40" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-5xl font-black text-white group-hover/avatar:opacity-40 transition-opacity">
                                                {(displayName?.[0] || 'U').toUpperCase()}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                                            <Icons.image size={32} className="text-white" />
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                    id="avatar-upload"
                                />
                                {uploading && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[2.5rem] flex items-center justify-center z-20">
                                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* Essential Config */}
                            <div className="flex-1 flex flex-col py-2">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                        {profileType.toUpperCase()} IDENTITY
                                    </span>
                                    <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em]">{user.email}</span>
                                </div>

                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6 leading-none">
                                    Engine <span className="text-indigo-400">Settings</span>
                                </h1>

                                <p className="text-white/40 max-w-xl text-lg font-medium leading-relaxed mb-10">
                                    Personalize your presence within the Registry Intelligence ecosystem. Manage your public identity, attribution preferences, and service entitlements.
                                </p>

                                <div className="mt-auto flex flex-wrap gap-4">
                                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
                                        <div className={`p-2 rounded-lg ${isPublicProfile ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/20'}`}>
                                            <Icons.users size={18} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase text-white tracking-widest">Public Visibility</span>
                                            <label className="relative inline-flex items-center cursor-pointer mt-1">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={isPublicProfile} 
                                                    onChange={(e) => setIsPublicProfile(e.target.checked)}
                                                />
                                                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 -mt-28 pb-12 relative z-30">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: IDENTITY & CONFIG */}
                    <div className="lg:col-span-2 space-y-8">
                        {message.text && (
                            <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-top-4 duration-500 ${
                                message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${message.type === 'success' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                        {message.type === 'success' ? <Icons.check size={20} /> : <Icons.close size={20} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{message.type.toUpperCase()} NOTIFICATION</span>
                                        <span className="font-bold">{message.text}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-[#12121e]/90 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                            
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                                    <Icons.user size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tighter">Public Persona</h2>
                                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Profile Metadata & URL Configuration</p>
                                </div>
                            </div>

                            <form onSubmit={handleUpdateProfile} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex justify-between">
                                            Display Identity <span>Max 40 chars</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:text-white/10"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="Your Display Name"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                            Classification Type
                                        </label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold"
                                            value={profileType}
                                            onChange={(e) => setProfileType(e.target.value as any)}
                                        >
                                            <option value="individual">Individual Pioneer</option>
                                            <option value="channel">Content Channel</option>
                                            <option value="organization">Educational Organization</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex justify-between">
                                        Intelligence Domain URL <span>Registry Unique Slug</span>
                                    </label>
                                    <div className="flex">
                                        <div className="bg-white/5 border border-white/10 border-r-0 rounded-l-2xl px-6 flex items-center text-white/20 text-xs font-bold tracking-tight">
                                            registry.intelligence/creators/
                                        </div>
                                        <input
                                            type="text"
                                            className="flex-1 bg-black/40 border border-white/10 rounded-r-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:text-white/10"
                                            value={slug}
                                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            placeholder="e.g. neuro-architect"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                        Experience Bio
                                    </label>
                                    <textarea
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:text-white/10 min-h-[140px]"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Briefly describe your focus and contributions to the registry..."
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                        Banner Visual URL
                                    </label>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:text-white/10"
                                            value={bannerUrl}
                                            onChange={(e) => setBannerUrl(e.target.value)}
                                            placeholder="https://example.com/cinematic-banner.jpg"
                                        />
                                        <div className="w-16 h-16 rounded-2xl border border-white/10 bg-black/60 overflow-hidden shrink-0">
                                            {bannerUrl && <img src={bannerUrl} className="w-full h-full object-cover" alt="" />}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex justify-end">
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={saving}
                                        className="px-10 py-4 bg-indigo-600 border border-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                                Persisting Identity...
                                            </div>
                                        ) : 'Update Public Registry Records'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: SUBSCRIPTION & SYSTEM */}
                    <div className="space-y-8">
                        <div className="bg-[#12121e]/90 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                                    <Icons.sparkles size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tighter">Entitlements</h2>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Registry Subscription Status</p>
                                </div>
                            </div>

                            {profile?.subscription?.status === 'active' ? (
                                <div className="space-y-6">
                                    <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{profile.subscription.bundleId}</span>
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-white">ACTIVE</span>
                                        </div>
                                        <div className="text-lg font-bold text-white mb-4 italic">Intelligence Master Suite</div>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.subscription.activeSuites.map((suite) => (
                                                <span key={suite} className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-wider text-white/60">
                                                    {suite} access
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <ManageSubscriptionButton 
                                        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all"
                                        label="Configure Plan & Billing"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-6 text-center">
                                    <div className="p-8 bg-black/40 border border-dashed border-white/10 rounded-2xl">
                                        <Icons.shield size={32} className="mx-auto mb-4 text-white/10" />
                                        <div className="text-sm font-bold text-white/40 mb-2 uppercase tracking-wide">Standard Pioneer</div>
                                        <p className="text-xs text-white/20 font-medium leading-relaxed mb-6">Upgrade to unlock the full Stillwater Intelligence ecosystem — Studio, Registry & more.</p>
                                        <a href="/pricing" className="inline-block px-10 py-3 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
                                            View Upgrade Paths
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-rose-500/5 border border-rose-500/10 rounded-3xl p-8 backdrop-blur-xl">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                                    <Icons.shield size={20} />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Security Hub</h3>
                            </div>
                            <p className="text-xs text-white/30 font-medium leading-relaxed mb-6">
                                Advanced security features including Multi-Factor Authentication and Federated Identity settings are currently being deployed.
                            </p>
                            <div className="text-[10px] font-black uppercase text-indigo-400/60 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full animate-pulse" />
                                Coming in v2.4.0
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
