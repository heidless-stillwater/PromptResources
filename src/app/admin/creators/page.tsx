'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db, toolDb } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/utils';
import { Icons } from '@/components/ui/Icons';

export default function CreatorsAdminPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initialising Command</div>
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
            const usersSnap = await getDocs(collection(toolDb, 'users'));
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
            await updateDoc(doc(toolDb, 'users', uid), { isFeatured: !current });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] })
    });

    const toggleVerifiedMutation = useMutation({
        mutationFn: async ({ uid, current }: { uid: string, current: boolean }) => {
            await updateDoc(doc(toolDb, 'users', uid), { isVerified: !current });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] })
    });

    const createStubMutation = useMutation({
        mutationFn: async (stubData: { name: string, slug: string, type: string, bio: string }) => {
            const id = 'stub_' + nanoid();
            await setDoc(doc(toolDb, 'users', id), {
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
            const docRef = doc(toolDb, 'users', profileData.uid);
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
            <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Authorizing Access</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] text-white selection:bg-indigo-500/30">
            <Navbar />

            {/* Cinematic Hero */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-[#0a0a0f] to-[#0a0a0f]" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] -mr-48 -mt-48" />
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    {/* Header Pathing */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                                <Icons.user size={20} className="text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Creators
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                    <span className="text-white uppercase">Contributor Registry</span>
                                    <span className="opacity-20">/</span>
                                    <span className="text-indigo-400/60 font-black">Creator Management</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-3">
                            <button 
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                    isCreatingStub ? 'bg-rose-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                }`}
                                onClick={() => setIsCreatingStub(!isCreatingStub)}
                            >
                                {isCreatingStub ? <Icons.close size={16} /> : <Icons.plus size={16} />}
                                {isCreatingStub ? 'Terminate Action' : 'Deploy Identity Stub'}
                            </button>
                        </div>
                    </div>

                    {/* Identity Glass Card (Section Overview) */}
                    <div className="glass-card p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-8">
                                <div className="flex-1">
                                    <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none flex items-center gap-4">
                                        <Icons.users size={48} className="text-indigo-400" />
                                        <span>Creator <span className="text-indigo-400">Admin</span></span>
                                    </h1>
                                    <p className="text-white/40 max-w-2xl text-lg font-medium leading-relaxed">
                                        Registry and contributor statistics curation bench. Synchronize global data weights across the discovery cloud.
                                    </p>
                                </div>

                                <div className="flex flex-col items-end gap-4 min-w-[280px]">
                                    <button 
                                        className={`w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden active:scale-95 ${
                                            isSyncingAll ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-600 border border-indigo-500 text-white shadow-xl shadow-indigo-600/20'
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
                                                <><Icons.refresh size={16} className="animate-spin" /> Syncing ({syncProgress.current}/{syncProgress.total})</>
                                            ) : (
                                                <><Icons.refresh size={16} /> Sync Global Stats</>
                                            )}
                                        </span>
                                    </button>
                                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Final Synchronisation: Just Now</div>
                                </div>
                            </div>

                            {/* Integrated Stats Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Registry', value: creators.length, icon: <Icons.users size={14} /> },
                                    { label: 'Verified Entities', value: creators.filter(c => c.isVerified).length, icon: <Icons.check size={14} />, color: 'text-emerald-400' },
                                    { label: 'External Stubs', value: creators.filter(c => c.isStub).length, icon: <Icons.external size={14} />, color: 'text-indigo-400' },
                                    { label: 'Featured Pioneer', value: creators.filter(c => c.isFeatured).length, icon: <Icons.sparkles size={14} />, color: 'text-amber-400' }
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 p-5 rounded-2xl group hover:border-white/20 transition-all cursor-default overflow-hidden">
                                        <div className="flex items-center gap-2 text-white/20 group-hover:text-white/40 mb-3 transition-colors relative z-10">
                                            {stat.icon}
                                            <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                                        </div>
                                        <div className={`text-3xl font-black relative z-10 ${stat.color || 'text-white'}`}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 -mt-20 pb-20 relative z-30">
                {/* ── FAST PROGRESS ── */}
                {isSyncingAll && (
                    <div className="glass-card p-6 mb-8 animate-in slide-in-from-top-4 duration-500 border-indigo-500/20 bg-indigo-500/[0.02]">
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

                {/* ── FILTERING HUB ── */}
                <div className="flex flex-wrap items-center gap-3 p-4 bg-white/5 backdrop-blur-3xl border border-white/5 rounded-[2rem] mb-10">
                    <div className="relative flex-1 min-w-[280px]">
                        <Icons.search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                        <input 
                            type="text" 
                            placeholder="Search identities by name or signature slug..." 
                            className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs font-medium outline-none focus:border-indigo-500/30"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <select className="bg-black/40 border border-white/5 rounded-2xl p-3 text-[10px] font-black uppercase tracking-widest outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="all">All Profiles</option>
                        <option value="individual">Individual</option>
                        <option value="channel">Channel</option>
                        <option value="organization">Organization</option>
                    </select>

                    <select className="bg-black/40 border border-white/5 rounded-2xl p-3 text-[10px] font-black uppercase tracking-widest outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                        <option value="all">Any Identity</option>
                        <option value="stub">External Stubs</option>
                        <option value="native">Public Profiles</option>
                    </select>

                    <select className="bg-black/40 border border-white/5 rounded-2xl p-3 text-[10px] font-black uppercase tracking-widest outline-none" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                        <option value="total">Sort: Impact</option>
                        <option value="authored">Sort: Authored</option>
                        <option value="name">Sort: Alpha</option>
                        <option value="newest">Sort: Recency</option>
                    </select>
                </div>

                {/* ── STUB CREATION ── */}
                {isCreatingStub && (
                    <div className="glass-card p-10 mb-10 border-indigo-500/30 animate-in slide-in-from-top-4 duration-300 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48" />
                         
                        <div className="flex items-center gap-4 mb-10 relative z-10">
                            <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                <Icons.plus size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-widest">Deploy Identity Stub</h3>
                                <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Establishing discovery records for external cloud contributors.</p>
                            </div>
                        </div>

                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                createStubMutation.mutate(newStub);
                            }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10"
                        >
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-widest pl-2">Display Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all" 
                                    value={newStub.name} 
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setNewStub(s => ({...s, name, slug: slugify(name)}));
                                    }} 
                                    required 
                                    placeholder="e.g. Kevin Stratvert"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-widest pl-2">Unique Slug</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all" 
                                    value={newStub.slug} 
                                    onChange={(e) => setNewStub(s => ({...s, slug: e.target.value}))} 
                                    placeholder="e.g. kevin-stratvert"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-widest pl-2">Category Class</label>
                                <select 
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all cursor-pointer uppercase tracking-widest text-[10px] font-black" 
                                    value={newStub.type}
                                    onChange={(e) => setNewStub(s => ({...s, type: e.target.value}))} 
                                >
                                    <option value="individual">Individual</option>
                                    <option value="channel">Channel</option>
                                    <option value="organization">Organization</option>
                                </select>
                            </div>
                            <div className="md:col-span-3 space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-widest pl-2">Identity Narrative (Bio)</label>
                                <textarea 
                                    rows={3}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all min-h-[100px] leading-relaxed"
                                    value={newStub.bio}
                                    onChange={(e) => setNewStub(s => ({...s, bio: e.target.value}))}
                                    placeholder="Synthesize the mission and expertise for this identity record..."
                                />
                            </div>
                            <div className="md:col-span-3 flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsCreatingStub(false)} className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all border border-white/10">Abort</button>
                                <button type="submit" className="px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30">Commit Identity</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ── REGISTRY TABLE ── */}
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5">
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Contributor Identity</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Class Hub</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Impact Matrix</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Hall of Fame</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Trust Check</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Control Hub</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredCreators.map((c) => (
                                    <tr key={c.uid} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                {c.photoURL ? (
                                                     <img src={c.photoURL} alt={c.displayName} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/10 group-hover:ring-indigo-500/30 transition-all" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-xs font-black border border-white/10">
                                                        {(c.displayName?.[0] || 'C').toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-black text-white group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                                                        {c.displayName}
                                                        {syncedUids.has(c.uid) && (
                                                            <Icons.check className="text-emerald-400 animate-pulse" size={14} strokeWidth={4} />
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-black text-white/10 uppercase tracking-widest mt-0.5">
                                                        /{c.slug || c.uid.slice(0,8)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 w-fit">
                                                    {c.profileType || 'individual'}
                                                </span>
                                                {c.isStub && <span className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest">Cloud Signal</span>}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-xl font-black leading-none">{c.resourceCount || 0}</div>
                                                <div className="flex gap-3 text-[9px] font-black text-white/20 uppercase tracking-widest">
                                                    <span className="flex items-center gap-1"><Icons.wand size={8} className="text-indigo-400" /> {c.authoredCount || 0}</span>
                                                    <span className="flex items-center gap-1"><Icons.grid size={8} className="text-emerald-400" /> {c.curatedCount || 0}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <button 
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 ${
                                                    c.isFeatured 
                                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                                                        : 'bg-white/5 border-white/10 text-white/20 hover:text-white/40 group-hover:border-white/20'
                                                }`}
                                                onClick={() => toggleFeaturedMutation.mutate({ uid: c.uid, current: !!c.isFeatured })}
                                            >
                                                {c.isFeatured ? <Icons.sparkles size={12} /> : <Icons.plus size={12} />}
                                                {c.isFeatured ? 'Featured' : 'Elevate'}
                                            </button>
                                        </td>
                                        <td className="p-6">
                                            <button 
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 ${
                                                    c.isVerified 
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                                                        : 'bg-white/5 border-white/10 text-white/20 hover:text-white/40 group-hover:border-white/20'
                                                }`}
                                                onClick={() => toggleVerifiedMutation.mutate({ uid: c.uid, current: !!c.isVerified })}
                                            >
                                                {c.isVerified ? <Icons.check size={12} strokeWidth={4} /> : <Icons.shield size={12} />}
                                                {c.isVerified ? 'Verified' : 'Verify'}
                                            </button>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/20 hover:text-white transition-all flex items-center gap-2 group/btn active:scale-95"
                                                    onClick={() => setEditingCreator(c)}
                                                >
                                                    <Icons.settings size={16} className="group-hover/btn:rotate-45 transition-transform" />
                                                </button>
                                                <button 
                                                    className={`p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center gap-2 group/btn active:scale-95 ${
                                                        syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid ? 'text-indigo-400' : 'text-white/20 hover:text-white'
                                                    }`}
                                                    disabled={syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid}
                                                    onClick={() => syncCreatorMutation.mutate(c.uid)}
                                                >
                                                    {syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid ? (
                                                        <Icons.spinner className="animate-spin" size={16} />
                                                    ) : (
                                                        <Icons.refresh size={16} />
                                                    )}
                                                </button>
                                                <Link href={`/creators/${c.slug || c.uid}`} target="_blank" className="p-3 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-xl text-white/20 hover:text-indigo-400 transition-all active:scale-95">
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
                    <div className="py-40 text-center glass-card border-dashed">
                        <Icons.users size={48} className="mx-auto mb-6 text-white/10" />
                        <p className="font-black text-[10px] uppercase tracking-[0.4em] text-white/20">No identities discovered in registry cloud</p>
                    </div>
                )}
            </main>
            <Footer />

            {/* Bulk Sync Modal */}
            {showSyncConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-[#0a0a0f] border border-white/10 rounded-[2.5rem] p-12 max-w-lg w-full text-center shadow-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
                        <div className="w-24 h-24 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-10 border border-indigo-500/20 animate-pulse">
                            <Icons.refresh size={48} />
                        </div>
                        <h2 className="text-3xl font-black mb-4 tracking-tight uppercase tracking-widest">Sync Global Registry?</h2>
                        <p className="text-white/30 mb-12 leading-relaxed font-bold text-sm uppercase tracking-widest">
                            Initialising full background reconciliation for <span className="text-white">{creators.length} identities</span>. 
                            Aggregated impact matrix will be recalculated across the cloud.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30" onClick={handleSyncAll}>Engage Protocol</button>
                            <button className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all border border-white/10" onClick={() => setShowSyncConfirm(false)}>Abort Process</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Profile Logic remain same but wrapped in cinematic style if needed */}
            {/* Keeping the detailed Edit Profile Modal from before but ensuring it uses the cinematic theme */}
            {editingCreator && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300 p-4">
                    <div className="bg-[#0a0a0f] border border-white/10 rounded-[3rem] w-full max-w-3xl overflow-hidden shadow-edge relative animate-in zoom-in-95 duration-300">
                        <div className="p-12 md:p-16">
                            <div className="flex justify-between items-start mb-16">
                                <div>
                                    <div className="flex items-center gap-2 mb-3 text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px]">
                                        <Icons.settings size={16} /> Registry Authority
                                    </div>
                                    <h2 className="text-5xl font-black tracking-tighter uppercase">Curate <span className="text-white/40">Identity</span></h2>
                                    <p className="text-white/20 text-[10px] font-black uppercase tracking-widest mt-2 leading-none">Refining Metadata presence for {editingCreator.displayName}</p>
                                </div>
                                <button className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10 active:scale-95" onClick={() => setEditingCreator(null)}>
                                    <Icons.close size={24} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em] pl-2">Display Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-sm font-black focus:border-indigo-500 outline-none transition-all"
                                        value={editingCreator?.displayName || ''} 
                                        onChange={(e) => editingCreator && setEditingCreator({...editingCreator, displayName: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em] pl-2">Canonical Slug</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-sm font-black focus:border-indigo-500 outline-none transition-all"
                                        value={editingCreator?.slug || ''} 
                                        onChange={(e) => editingCreator && setEditingCreator({...editingCreator, slug: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em] pl-2">Narrative Biography</label>
                                    <textarea 
                                        rows={4}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-sm font-bold focus:border-indigo-500 outline-none transition-all min-h-[120px] leading-relaxed"
                                        value={editingCreator?.bio || ''}
                                        onChange={(e) => editingCreator && setEditingCreator({...editingCreator, bio: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 border-t border-white/5 pt-12">
                                <button className="flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all border border-white/10" onClick={() => setEditingCreator(null)}>Abort</button>
                                <button 
                                    className="flex-[2] py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 disabled:opacity-50"
                                    onClick={() => editingCreator && updateProfileMutation.mutate(editingCreator)}
                                    disabled={updateProfileMutation.isPending}
                                >
                                    {updateProfileMutation.isPending ? <Icons.spinner className="animate-spin" /> : <><Icons.check size={18} strokeWidth={4} /> Publish Changes</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

