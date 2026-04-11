'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/utils';
import { Icons } from '@/components/ui/Icons';

export default function CreatorsAdminPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0f0f15]">
                <Navbar />
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <Icons.spinner className="animate-spin text-indigo-500" size={40} />
                </div>
            </div>
        }>
            <CreatorsAdminContent />
        </Suspense>
    );
}

function CreatorsAdminContent() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [isCreatingStub, setIsCreatingStub] = useState(false);
    const [editingCreator, setEditingCreator] = useState<UserProfile | null>(null);
    const [newStub, setNewStub] = useState({ name: '', slug: '', type: 'individual', bio: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const [syncedUids, setSyncedUids] = useState<Set<string>>(new Set());
    const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'none' }>({ message: '', type: 'none' });
    const [sortBy, setSortBy] = useState<'name' | 'authored' | 'total' | 'newest'>('total');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'stub' | 'native'>('all');
    const [showSyncConfirm, setShowSyncConfirm] = useState(false);

    useEffect(() => {
        if (!authLoading && (!user || !isAdmin)) {
            router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    // Fetch creators
    const { data: creators = [], isLoading } = useQuery({
        queryKey: ['admin', 'creators'],
        queryFn: async () => {
            const usersSnap = await getDocs(collection(db, 'users'));
            const list = usersSnap.docs.map((d) => ({
                ...d.data(),
                uid: d.id,
            })) as UserProfile[];
            
            return list.filter(u => u.isPublicProfile || u.isStub).sort((a, b) => (b.resourceCount || 0) - (a.resourceCount || 0));
        },
        enabled: !!user && isAdmin,
    });

    const toggleFeaturedMutation = useMutation({
        mutationFn: async ({ uid, current }: { uid: string, current: boolean }) => {
            await updateDoc(doc(db, 'users', uid), { isFeatured: !current });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] })
    });

    const toggleVerifiedMutation = useMutation({
        mutationFn: async ({ uid, current }: { uid: string, current: boolean }) => {
            await updateDoc(doc(db, 'users', uid), { isVerified: !current });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] })
    });

    const createStubMutation = useMutation({
        mutationFn: async (stubData: { name: string, slug: string, type: string, bio: string }) => {
            const id = 'stub_' + nanoid();
            await setDoc(doc(db, 'users', id), {
                uid: id,
                displayName: stubData.name,
                email: 'fake@directory.stub',
                role: 'member',
                subscriptionType: 'free',
                slug: stubData.slug || id,
                profileType: stubData.type,
                bio: stubData.bio,
                isStub: true,
                isPublicProfile: true,
                isFeatured: false,
                isVerified: false,
                resourceCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] });
            setIsCreatingStub(false);
            setNewStub({ name: '', slug: '', type: 'individual', bio: '' });
        }
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (profileData: Partial<UserProfile>) => {
            if (!profileData.uid) return;
            const docRef = doc(db, 'users', profileData.uid);
            await updateDoc(docRef, {
                ...profileData,
                updatedAt: serverTimestamp()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] });
            setEditingCreator(null);
            setSyncStatus({ message: 'Profile updated successfully!', type: 'success' });
        }
    });

    const syncCreatorMutation = useMutation({
        mutationFn: async (userId: string) => {
            const idToken = await user?.getIdToken();
            const res = await fetch('/api/admin/creators/sync', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to sync');
            }
            return res.json();
        },
        onSuccess: (_, userId) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] });
            setSyncedUids(prev => new Set(prev).add(userId));
            setTimeout(() => {
                setSyncedUids(prev => {
                    const next = new Set(prev);
                    next.delete(userId);
                    return next;
                });
            }, 5000);
        },
        onError: (error: any) => {
            setSyncStatus({ message: `Sync failed: ${error.message}`, type: 'error' });
        }
    });

    const filteredCreators = creators
        .filter(c => {
            const matchesSearch = c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 (c.slug && c.slug.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesType = filterType === 'all' || (c.profileType || 'individual') === filterType;
            const matchesStatus = filterStatus === 'all' || (filterStatus === 'stub' ? c.isStub : !c.isStub);
            return matchesSearch && matchesType && matchesStatus;
        })
        .sort((a, b) => {
            if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
            if (sortBy === 'authored') return (b.authoredCount || 0) - (a.authoredCount || 0);
            if (sortBy === 'newest') {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val?.toDate === 'function') return val.toDate().getTime();
                    return new Date(val).getTime();
                };
                return getTime(b.createdAt) - getTime(a.createdAt);
            }
            return (b.resourceCount || 0) - (a.resourceCount || 0);
        });

    const handleSyncAll = async () => {
        setShowSyncConfirm(false);
        setIsSyncingAll(true);
        setSyncProgress({ current: 0, total: creators.length });
        try {
            for (let i = 0; i < creators.length; i++) {
                const c = creators[i];
                setSyncProgress(prev => ({ ...prev, current: i + 1 }));
                await syncCreatorMutation.mutateAsync(c.uid);
            }
            setSyncStatus({ message: `Successfully updated all ${creators.length} creators!`, type: 'success' });
        } catch (e) {
            setSyncStatus({ message: 'Sync process was interrupted or failed for one or more creators.', type: 'error' });
        } finally {
            setIsSyncingAll(false);
            setSyncProgress({ current: 0, total: 0 });
        }
    };

    if (authLoading || isLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-[#0f0f15]">
                <Navbar />
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <Icons.spinner className="animate-spin text-indigo-500" size={40} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f15] text-white">
            <Navbar />
            <main className="container mx-auto px-4 py-12">
                {/* ── HEADER ── */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold uppercase tracking-widest text-[10px]">
                            <Icons.settings size={12} /> Registry Control Center
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Creator Management</h1>
                        <p className="text-white/40 font-medium mt-1">Registry and contributor statistics curation bench</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all relative overflow-hidden group ${
                                isSyncingAll ? 'bg-indigo-600/20 text-indigo-400' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                            }`}
                            onClick={() => !isSyncingAll && setShowSyncConfirm(true)} 
                            disabled={isSyncingAll || creators.length === 0}
                        >
                            {isSyncingAll && (
                                <div 
                                    className="absolute inset-y-0 left-0 bg-indigo-600/20 transition-all duration-300" 
                                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }} 
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                                {isSyncingAll ? (
                                    <>⏳ Syncing ({syncProgress.current}/{syncProgress.total})</>
                                ) : (
                                    <><Icons.refresh size={16} /> Sync All Stats</>
                                )}
                            </span>
                        </button>
                        <button 
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                isCreatingStub ? 'bg-rose-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                            }`}
                            onClick={() => setIsCreatingStub(!isCreatingStub)}
                        >
                            {isCreatingStub ? <Icons.close size={16} /> : <Icons.plus size={16} />}
                            {isCreatingStub ? 'Cancel' : 'Add External Stub'}
                        </button>
                    </div>
                </div>

                {/* ── FAST PROGRESS ── */}
                {isSyncingAll && (
                    <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-6 mb-8 animate-fade-in shadow-xl backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Syncing Metadata Engine</span>
                            <span className="text-lg font-black">{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500" 
                                style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }} 
                            />
                        </div>
                    </div>
                )}

                {/* ── STATS OVERVIEW ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Registry', value: creators.length, color: 'text-white' },
                        { label: 'External Stubs', value: creators.filter(c => c.isStub).length, color: 'text-indigo-400' },
                        { label: 'Verified Partners', value: creators.filter(c => c.isVerified).length, color: 'text-emerald-400' },
                        { label: 'Featured Pioneer', value: creators.filter(c => c.isFeatured).length, color: 'text-amber-400' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 p-6 rounded-2xl">
                            <div className={`text-2xl font-black mb-1 ${stat.color}`}>{stat.value}</div>
                            <div className="text-[10px] uppercase font-bold tracking-widest text-white/20">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── FILTERING ── */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-8 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[280px]">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Find by name, slug or platform..." 
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:border-indigo-500/50 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white/70 outline-none focus:border-indigo-500/50 cursor-pointer" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="all" className="bg-[#1a1a24]">All Profile Types</option>
                        <option value="individual" className="bg-[#1a1a24]">Individual</option>
                        <option value="channel" className="bg-[#1a1a24]">Channel</option>
                        <option value="organization" className="bg-[#1a1a24]">Organization</option>
                    </select>

                    <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white/70 outline-none focus:border-indigo-500/50 cursor-pointer" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                        <option value="all" className="bg-[#1a1a24]">Any Identity Source</option>
                        <option value="stub" className="bg-[#1a1a24]">External Stubs</option>
                        <option value="native" className="bg-[#1a1a24]">Public Profiles</option>
                    </select>

                    <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white/70 outline-none focus:border-indigo-500/50 cursor-pointer" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                        <option value="total" className="bg-[#1a1a24]">Impact (Resources)</option>
                        <option value="authored" className="bg-[#1a1a24]">Authorship Count</option>
                        <option value="name" className="bg-[#1a1a24]">Alphabetical Order</option>
                        <option value="newest" className="bg-[#1a1a24]">Recently Onboarded</option>
                    </select>
                </div>

                {/* ── STUB CREATION ── */}
                {isCreatingStub && (
                    <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-8 mb-8 animate-fade-in shadow-xl shadow-indigo-600/5">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                                <Icons.plus size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Deploy Identity Stub</h3>
                                <p className="text-indigo-400/60 text-sm">Create a discovered creator profile for the community registry.</p>
                            </div>
                        </div>
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                createStubMutation.mutate(newStub);
                            }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-1">Legal / Display Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-white/20" 
                                    value={newStub.name} 
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setNewStub(s => ({...s, name, slug: slugify(name)}));
                                    }} 
                                    required 
                                    placeholder="e.g. Kevin Stratvert"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-1">Unique Profile Slug</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-white/20" 
                                    value={newStub.slug} 
                                    onChange={(e) => setNewStub(s => ({...s, slug: e.target.value}))} 
                                    placeholder="e.g. kevin-stratvert"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-1">Profile Category</label>
                                <select 
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all cursor-pointer" 
                                    value={newStub.type}
                                    onChange={(e) => setNewStub(s => ({...s, type: e.target.value}))} 
                                >
                                    <option value="individual" className="bg-[#1a1a24]">Individual</option>
                                    <option value="channel" className="bg-[#1a1a24]">Channel</option>
                                    <option value="organization" className="bg-[#1a1a24]">Organization</option>
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-3">
                                <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-1">Professional Bio</label>
                                <textarea 
                                    rows={2}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-white/20"
                                    value={newStub.bio}
                                    onChange={(e) => setNewStub(s => ({...s, bio: e.target.value}))}
                                    placeholder="Draft a concise summary of the creator's mission and expertise..."
                                />
                            </div>
                            <div className="md:col-span-3 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsCreatingStub(false)} className="px-6 py-2.5 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-all text-sm">Dismiss</button>
                                <button type="submit" className="px-8 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 transition-all text-sm shadow-lg shadow-indigo-600/20">Create Identity</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ── TABLE ── */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/30">
                                    <th className="px-6 py-4">Registry Identity</th>
                                    <th className="px-6 py-4">Source / Class</th>
                                    <th className="px-6 py-4">Impact Stats</th>
                                    <th className="px-6 py-4">Hall of Fame</th>
                                    <th className="px-6 py-4">Verification</th>
                                    <th className="px-6 py-4 text-right">Admin Tools</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredCreators.map((c) => (
                                    <tr key={c.uid} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                {c.photoURL ? (
                                                     <img src={c.photoURL} alt={c.displayName} className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-xs font-black">
                                                        {(c.displayName?.[0] || 'C').toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                                                        {c.displayName}
                                                        {syncedUids.has(c.uid) && (
                                                            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded animate-pulse">UP TO DATE</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-medium text-white/30 uppercase tracking-tighter">
                                                        /{c.slug || c.uid.slice(0,8)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-black uppercase text-white/50 w-fit">
                                                    {c.profileType || 'individual'}
                                                </span>
                                                {c.isStub && <span className="text-[8px] font-black text-indigo-400/60 uppercase">Cloud Contributor</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-lg font-black leading-none">{c.resourceCount || 0}</div>
                                                <div className="flex gap-3 text-[9px] font-black text-white/30">
                                                    <span className="flex items-center gap-1"><Icons.wand size={8} className="text-indigo-400" /> {c.authoredCount || 0}</span>
                                                    <span className="flex items-center gap-1"><Icons.grid size={8} className="text-emerald-400" /> {c.curatedCount || 0}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <button 
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${
                                                    c.isFeatured 
                                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                                                        : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10 hover:text-white/60'
                                                }`}
                                                onClick={() => toggleFeaturedMutation.mutate({ uid: c.uid, current: !!c.isFeatured })}
                                            >
                                                {c.isFeatured ? <Icons.sparkles size={12} /> : <Icons.plus size={12} />}
                                                {c.isFeatured ? 'Featured Pioneer' : 'Elevate Card'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            <button 
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${
                                                    c.isVerified 
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                                                        : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10 hover:text-white/60'
                                                }`}
                                                onClick={() => toggleVerifiedMutation.mutate({ uid: c.uid, current: !!c.isVerified })}
                                            >
                                                {c.isVerified ? <Icons.check size={12} strokeWidth={4} /> : <Icons.close size={12} />}
                                                {c.isVerified ? 'Verified Active' : 'Issue Trust Check'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all flex items-center gap-2 group/btn"
                                                    onClick={() => setEditingCreator(c)}
                                                >
                                                    <Icons.settings size={16} className="group-hover/btn:rotate-45 transition-transform" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:block">Curation</span>
                                                </button>
                                                <button 
                                                    className={`p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center gap-2 group/btn ${
                                                        syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid ? 'text-indigo-400' : 'text-white/40 hover:text-white'
                                                    }`}
                                                    disabled={syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid}
                                                    onClick={() => syncCreatorMutation.mutate(c.uid)}
                                                >
                                                    {syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid ? (
                                                        <Icons.spinner className="animate-spin" size={16} />
                                                    ) : (
                                                        <Icons.refresh size={16} />
                                                    )}
                                                    <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:block">Sync</span>
                                                </button>
                                                <Link href={`/creators/${c.slug || c.uid}`} target="_blank" className="p-2.5 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-xl text-white/40 hover:text-indigo-400 transition-all">
                                                    <Icons.external size={16} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {creators.length === 0 && (
                    <div className="py-20 text-center opacity-40">
                        <Icons.users size={48} className="mx-auto mb-4" />
                        <p className="font-bold text-lg">No identities discovered in the registry cloud.</p>
                    </div>
                )}
            </main>
            <Footer />

            {/* Bulk Sync Modal */}
            {showSyncConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#1a1a24] border border-white/10 rounded-[2.5rem] p-10 max-w-lg w-full text-center shadow-3xl">
                        <div className="w-20 h-20 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                            <Icons.refresh size={40} />
                        </div>
                        <h2 className="text-3xl font-black mb-4 tracking-tight">Sync Global Curation?</h2>
                        <p className="text-white/40 mb-10 leading-relaxed font-semibold">
                            Triggering a full background reconciliation for <span className="text-white">{creators.length} identities</span>. 
                            Aggregated metrics will be refreshed across the platform.
                        </p>
                        <div className="flex gap-4">
                            <button className="flex-1 px-8 py-4 rounded-2xl font-black text-sm bg-white/5 hover:bg-white/10 transition-all border border-white/10" onClick={() => setShowSyncConfirm(false)}>Abort Process</button>
                            <button className="flex-1 px-8 py-4 rounded-2xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30" onClick={handleSyncAll}>Initial Sync Engaged</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Modal */}
            {syncStatus.type !== 'none' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#1a1a24] border border-white/10 rounded-[2.5rem] p-10 max-w-lg w-full text-center shadow-3xl">
                        <div className={`text-6xl mb-6 ${syncStatus.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {syncStatus.type === 'success' ? <Icons.check className="mx-auto" size={80} /> : <Icons.close className="mx-auto" size={80} />}
                        </div>
                        <h3 className="text-3xl font-black mb-4 tracking-tight">
                            {syncStatus.type === 'success' ? 'Propagation Success' : 'Engine Interrupted'}
                        </h3>
                        <p className="text-white/40 mb-10 leading-relaxed font-semibold">
                            {syncStatus.message}
                        </p>
                        <button 
                            className="w-full px-8 py-4 rounded-2xl font-black text-sm bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                            onClick={() => setSyncStatus({ message: '', type: 'none' })}
                        >
                            Acknowledge Replay
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {editingCreator && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fade-in p-4 overflow-y-auto">
                    <div className="bg-[#12121a] border border-white/10 rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-edge relative my-auto">
                        <div className="p-8 md:p-12">
                            <div className="flex justify-between items-start mb-12">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-black uppercase tracking-widest text-[10px]">
                                        <Icons.settings size={14} /> Profile Authority
                                    </div>
                                    <h2 className="text-4xl font-extrabold tracking-tight">Curate Identity</h2>
                                    <p className="text-white/30 text-sm font-medium mt-1">Refining meta presence for {editingCreator.displayName}</p>
                                </div>
                                <button className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10" onClick={() => setEditingCreator(null)}>
                                    <Icons.close size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] pl-1">Registry Display Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all placeholder:text-white/20"
                                        value={editingCreator?.displayName || ''} 
                                        onChange={(e) => editingCreator && setEditingCreator({...editingCreator, displayName: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] pl-1">Unique Resource Slug</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all placeholder:text-white/20"
                                        value={editingCreator?.slug || ''} 
                                        onChange={(e) => editingCreator && setEditingCreator({...editingCreator, slug: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] pl-1">Contribution Biography</label>
                                    <textarea 
                                        rows={4}
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all placeholder:text-white/20 min-h-[140px] leading-relaxed"
                                        value={editingCreator?.bio || ''}
                                        onChange={(e) => editingCreator && setEditingCreator({...editingCreator, bio: e.target.value})}
                                        placeholder="Craft a professional narrative for this creator..."
                                    />
                                </div>
                            </div>

                            <div className="mb-12">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] mb-6">
                                    <Icons.globe size={14} /> Social Connectivity Graph
                                </h4>
                                
                                <div className="space-y-4 bg-black/20 rounded-[2rem] p-6 border border-white/5">
                                    {['youtube', 'twitter', 'website'].map(platform => (
                                        <div key={platform} className="flex items-center gap-5 group/row">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                                                platform === 'youtube' ? 'bg-rose-600/10 text-rose-500' : platform === 'twitter' ? 'bg-indigo-400/10 text-indigo-400' : 'bg-white/5 text-white/30'
                                            }`}>
                                                {platform === 'youtube' ? <Icons.play size={24} /> : platform === 'twitter' ? <Icons.twitter size={24} /> : <Icons.globe size={24} />}
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder={platform === 'youtube' ? 'Channel Endpoint / ID' : platform === 'twitter' ? '@Identity' : 'https://verified.domain'} 
                                                className="flex-1 bg-transparent border-b border-white/5 py-3 text-sm font-bold focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/10 group-hover/row:border-white/10"
                                                value={editingCreator?.socials?.find(s => s.platform === platform)?.url || ''}
                                                onChange={(e) => {
                                                    if (!editingCreator) return;
                                                    const val = e.target.value;
                                                    const current = [...(editingCreator.socials || [])];
                                                    const idx = current.findIndex(s => s.platform === platform);
                                                    if (idx >= 0) current[idx].url = val;
                                                    else current.push({ platform: platform as any, url: val });
                                                    setEditingCreator({...editingCreator, socials: current});
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 border-t border-white/5 pt-10">
                                <button className="flex-1 py-4 rounded-2xl font-black text-sm bg-white/5 hover:bg-white/10 transition-all border border-white/10" onClick={() => setEditingCreator(null)}>Abort Edits</button>
                                <button 
                                    className="flex-[2] py-4 rounded-2xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 disabled:opacity-50"
                                    onClick={() => editingCreator && updateProfileMutation.mutate(editingCreator)}
                                    disabled={updateProfileMutation.isPending}
                                >
                                    {updateProfileMutation.isPending ? <Icons.spinner className="animate-spin" /> : <><Icons.check size={18} strokeWidth={4} /> Publish Registry Updates</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
