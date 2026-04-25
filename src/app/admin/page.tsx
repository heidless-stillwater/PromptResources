'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db, toolDb } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { UserProfile, Resource } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icons } from '@/components/ui/Icons';

export default function AdminPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initialising Command</div>
                </div>
            </div>
        }>
            <AdminContent />
        </Suspense>
    );
}

function AdminContent() {
    const { user, isAdmin, activeRole, loading: authLoading } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const defaultTab = (searchParams.get('tab') as any) || 'overview';
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'resources' | 'creators' | 'suggestions' | 'categories' | 'tainted'>(defaultTab);
    
    // Creator Explorer State
    const [isCreatingStub, setIsCreatingStub] = useState(false);
    const [newStub, setNewStub] = useState({ name: '', slug: '', type: 'individual', bio: '' });
    const [creatorsSearch, setCreatorsSearch] = useState('');
    const [creatorSortBy, setCreatorSortBy] = useState<'name' | 'authored' | 'total' | 'newest'>('total');
    const [creatorFilterType, setCreatorFilterType] = useState<string>('all');
    const [creatorFilterStatus, setCreatorFilterStatus] = useState<'all' | 'stub' | 'native'>('all');

    useEffect(() => {
        if (!authLoading && (!user || !isAdmin)) {
            router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    // Fetch users
    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: async () => {
            const usersSnap = await getDocs(collection(toolDb, 'users'));
            return usersSnap.docs.map((d) => ({
                ...d.data(),
                uid: d.id,
                createdAt: d.data().createdAt?.toDate() || new Date(),
                updatedAt: d.data().updatedAt?.toDate() || new Date(),
            })) as UserProfile[];
        },
        enabled: !!user && isAdmin,
    });

    // Fetch resources
    const { data: resources = [], isLoading: resourcesLoading } = useQuery({
        queryKey: ['admin', 'resources'],
        queryFn: async () => {
            const resSnap = await getDocs(collection(db, 'resources'));
            return resSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate() || new Date(),
                updatedAt: d.data().updatedAt?.toDate() || new Date(),
            })) as Resource[];
        },
        enabled: !!user && isAdmin,
    });

    // Mutations
    const deleteResourceMutation = useMutation({
        mutationFn: async (id: string) => {
            await deleteDoc(doc(db, 'resources', id));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });
        }
    });

    const approveResourceMutation = useMutation({
        mutationFn: async (id: string) => {
            await updateDoc(doc(db, 'resources', id), { status: 'published', updatedAt: new Date() });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });
        }
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ uid, role }: { uid: string, role: string }) => {
            await updateDoc(doc(toolDb, 'users', uid), { role });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        }
    });

    const updateSubMutation = useMutation({
        mutationFn: async ({ uid, subscriptionType }: { uid: string, subscriptionType: string }) => {
            await updateDoc(doc(toolDb, 'users', uid), { subscriptionType });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        }
    });

    const reinstateResourceMutation = useMutation({
        mutationFn: async ({ resourceId, resetStrike }: { resourceId: string, resetStrike: boolean }) => {
            const token = await user?.getIdToken();
            const res = await fetch('/api/admin/resources/reinstate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resourceId, resetStrike })
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        }
    });

    const handleDeleteResource = async (id: string) => {
        if (!confirm('Delete this resource?')) return;
        deleteResourceMutation.mutate(id);
    };

    const handleApproveResource = async (id: string) => {
        approveResourceMutation.mutate(id);
    };

    const handleRoleChange = async (uid: string, newRole: string) => {
        updateRoleMutation.mutate({ uid, role: newRole });
    };

    const handleSubChange = async (uid: string, newSub: string) => {
        updateSubMutation.mutate({ uid, subscriptionType: newSub });
    };

    const handleReinstate = async (resourceId: string, title: string) => {
        const resetStrike = confirm(`Reinstate "${title}"?\n\nClick OK to ALSO reset the contributor's safety strike.\nClick Cancel to reinstate WITHOUT resetting the strike.`);
        
        // This is a bit tricky since confirm only returns true/false.
        // Let's use a more explicit confirm for the strike.
        
        const proceed = confirm(`Are you sure you want to reinstate "${title}"?`);
        if (!proceed) return;

        const shouldResetStrike = confirm(`Reset the contributor strike for this resource?`);
        
        reinstateResourceMutation.mutate({ resourceId, resetStrike: shouldResetStrike });
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'users', 'resources', 'creators', 'suggestions', 'categories', 'tainted'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    // Fetch Creators
    const { data: creators = [], isLoading: creatorsLoading } = useQuery({
        queryKey: ['admin', 'creators'],
        queryFn: async () => {
            const usersSnap = await getDocs(collection(toolDb, 'users'));
            const list = usersSnap.docs.map((d) => ({
                ...d.data(),
                uid: d.id,
            })) as UserProfile[];
            return list.filter(u => u.isPublicProfile || u.isStub);
        },
        enabled: !!user && isAdmin,
    });

    const createStubMutation = useMutation({
        mutationFn: async (stubData: { name: string, slug: string, type: string, bio: string }) => {
            const { nanoid } = await import('nanoid');
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
                resourceCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] });
            setIsCreatingStub(false);
            setNewStub({ name: '', slug: '', type: 'individual', bio: '' });
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
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'creators'] })
    });

    if (authLoading || usersLoading || resourcesLoading || creatorsLoading || !isAdmin) {
        return (
            <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Authorizing Access</div>
                </div>
            </div>
        );
    }

    const handleTabChange = (tab: typeof activeTab) => {
        setActiveTab(tab);
        router.push(`/admin?tab=${tab}`);
    };

    const freeCount = resources.filter((r) => r.pricing === 'free').length;
    const paidCount = resources.filter((r) => r.pricing === 'paid').length;
    const reviewCount = resources.filter((r) => r.status === 'pending' || r.status === 'suggested').length;
    const taintedCount = resources.filter((r) => r.status === 'tainted').length;
    const creatorsCount = users.filter((u) => u.isPublicProfile || u.isStub).length;

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
                                <Icons.settings size={20} className="text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Systems
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                    <span className="text-white uppercase">Authority Hub</span>
                                    <span className="opacity-20">/</span>
                                    <span className="text-indigo-400/60 font-black">Control Center</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
                            <div className="flex flex-col items-end">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Active Authority</div>
                                <div className="text-xs font-bold text-indigo-400">{activeRole?.toUpperCase()}</div>
                            </div>
                            <div className="h-8 w-px bg-white/10" />
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Sync Operational</span>
                            </div>
                        </div>
                    </div>

                    {/* Identity Glass Card (Section Overview) */}
                    <div className="glass-card p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10">
                            <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none flex items-center gap-4">
                                <Icons.settings size={48} className="text-indigo-400" />
                                <span>Control <span className="text-indigo-400">Hub</span></span>
                            </h1>

                            <p className="text-white/40 max-w-2xl text-lg font-medium leading-relaxed mb-8">
                                Orchestrate the architectural integrity of the PromptMaster ecosystem. Manage users, resources, and taxonomies through the high-density administrative workbench.
                            </p>

                            {/* Integrated Stats HUD */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                {[
                                    { label: 'Total Users', value: users.length, icon: <Icons.users size={14} /> },
                                    { label: 'Resource Assets', value: resources.length, icon: <Icons.database size={14} /> },
                                    { label: 'Pending Review', value: reviewCount, icon: <Icons.sparkles size={14} />, color: 'text-indigo-400' },
                                    { label: 'Tainted Assets', value: taintedCount, icon: <Icons.report size={14} />, color: 'text-rose-400' },
                                    { label: 'Active Creators', value: creatorsCount, icon: <Icons.user size={14} /> },
                                    { label: 'Free Assets', value: freeCount, icon: <Icons.zap size={14} /> }
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 p-5 rounded-2xl group hover:border-white/20 transition-all cursor-default relative overflow-hidden">
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
                {/* Navigation Hub */}
                <div className="flex flex-wrap items-center gap-2 p-2 bg-white/5 backdrop-blur-3xl border border-white/5 rounded-[2rem] w-fit mb-10">
                    {(['overview', 'users', 'resources', 'creators', 'suggestions', 'categories', 'tainted'] as const).map((tab) => (
                        <button
                            key={tab}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 group ${
                                activeTab === tab 
                                    ? 'bg-indigo-600 border border-indigo-400 text-white shadow-xl shadow-indigo-600/20' 
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                            }`}
                            onClick={() => handleTabChange(tab)}
                        >
                            {tab}
                            {tab === 'suggestions' && reviewCount > 0 && (
                                <span className="bg-rose-500 text-white text-[8px] min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-1">
                                    {reviewCount}
                                </span>
                            )}
                            {tab === 'tainted' && taintedCount > 0 && (
                                <span className="bg-rose-500 text-white text-[8px] min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-1">
                                    {taintedCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Dashboard Views */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <div className="glass-card p-8">
                                    <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                                                <Icons.users size={20} />
                                            </div>
                                            <h3 className="text-xl font-black tracking-widest uppercase text-white/80">Authority Feed</h3>
                                        </div>
                                        <button className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300" onClick={() => setActiveTab('users')}>
                                            Full Directory →
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {users.slice(0, 5).map((u) => (
                                            <div key={u.uid} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 text-xs font-black">
                                                    {(u.displayName?.[0] || u.email?.[0] || 'U').toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold truncate">{u.displayName}</div>
                                                    <div className="text-[10px] text-white/30 truncate uppercase tracking-widest">{u.email}</div>
                                                </div>
                                                <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                                    u.role === 'su' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-white/40 border border-white/10'
                                                }`}>
                                                    {u.role}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="glass-card p-8 bg-indigo-600/[0.03] border-indigo-500/20">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/30 mb-6 flex items-center gap-2">
                                        <Icons.zap size={14} className="text-indigo-400" /> Command Center
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        <Link href="/resources/new" className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center gap-4 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]">
                                            <div className="p-2 bg-white/20 rounded-xl"><Icons.plus size={18} /></div>
                                            <span className="text-xs font-black uppercase tracking-widest">Register New Asset</span>
                                        </Link>
                                        <Link href="/resources/admin/assets" className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center gap-4 transition-all border border-white/5">
                                            <div className="p-2 bg-white/10 rounded-xl"><Icons.image size={18} /></div>
                                            <span className="text-xs font-black uppercase tracking-widest">Asset Scenario Hub</span>
                                        </Link>
                                        <div className="h-px bg-white/5 my-2" />
                                        {[
                                            { label: 'Directory Management', icon: <Icons.users size={16} />, tab: 'users' },
                                            { label: 'Creator Registry', icon: <Icons.user size={16} />, tab: 'creators' },
                                            { label: 'YouTube Audit Bot', icon: <Icons.video size={16} />, href: '/admin/audit/youtube' }
                                        ].map((act, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => act.tab ? setActiveTab(act.tab as any) : act.href && router.push(act.href)}
                                                className="p-4 bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl flex items-center gap-4 transition-all border border-white/5 text-white/60 hover:text-white"
                                            >
                                                <div className="text-white/20">{act.icon}</div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">{act.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Users View */}
                    {activeTab === 'users' && (
                        <div className="glass-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/5">
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Registry Authority</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Credentials</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">System Role</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Tier</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Established</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {users.map((u) => (
                                            <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black border border-white/10">
                                                            {(u.displayName?.[0] || 'U').toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-bold group-hover:text-indigo-400 transition-colors">{u.displayName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-xs text-white/40 font-mono tracking-tight">{u.email}</td>
                                                <td className="p-6">
                                                    <select
                                                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500/50"
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                                    >
                                                        <option value="member">Member</option>
                                                        <option value="admin">Admin</option>
                                                        <option value="su">SU</option>
                                                    </select>
                                                </td>
                                                <td className="p-6">
                                                    <select
                                                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500/50"
                                                        value={u.subscriptionType}
                                                        onChange={(e) => handleSubChange(u.uid, e.target.value)}
                                                    >
                                                        <option value="free">Free</option>
                                                        <option value="standard">Standard</option>
                                                        <option value="pro">Pro</option>
                                                    </select>
                                                </td>
                                                <td className="p-6 text-[10px] font-black uppercase tracking-widest text-white/20">
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Resources View */}
                    {activeTab === 'resources' && (
                        <div className="space-y-6">
                            <div className="flex justify-end">
                                <Link href="/resources/new" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2">
                                    <Icons.plus size={14} /> New Resource
                                </Link>
                            </div>
                            <div className="glass-card overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/5">
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Discovery Title</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Platform Hub</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Visibility</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Taxonomy</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Action Hub</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {resources.filter(r => r.status !== 'pending' && r.status !== 'suggested' && r.status !== 'tainted').map((r) => (
                                            <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="p-6">
                                                    <Link href={`/resources/${r.id}`} className="text-sm font-bold hover:text-indigo-400 transition-colors">{r.title}</Link>
                                                </td>
                                                <td className="p-6">
                                                    <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black uppercase tracking-widest">{r.platform}</span>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${r.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-xs text-white/40 uppercase tracking-widest">{r.type}</td>
                                                <td className="p-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={`/resources/${r.id}/edit`} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"><Icons.edit size={14} /></Link>
                                                        <button
                                                            onClick={() => handleDeleteResource(r.id)}
                                                            className="p-2 bg-white/5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all"
                                                        >
                                                            <Icons.trash size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Creators View */}
                    {activeTab === 'creators' && (
                        <div className="space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><Icons.user size={20} /></div>
                                    <h3 className="text-xl font-black tracking-widest uppercase">Creator Explorer</h3>
                                </div>
                                <button 
                                    className="px-6 py-2.5 bg-indigo-600 border border-indigo-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                                    onClick={() => setIsCreatingStub(!isCreatingStub)}
                                >
                                    {isCreatingStub ? 'Cancel Action' : '➕ Register External Stub'}
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-3xl">
                                <div className="relative flex-1 min-w-[300px]">
                                    <Icons.search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs font-medium outline-none focus:border-indigo-500/30"
                                        placeholder="Search registry by name or signature slug..."
                                        value={creatorsSearch}
                                        onChange={(e) => setCreatorsSearch(e.target.value)}
                                    />
                                </div>
                                <select className="bg-black/40 border border-white/5 rounded-2xl p-3 text-[10px] font-black uppercase tracking-widest outline-none" value={creatorFilterType} onChange={(e) => setCreatorFilterType(e.target.value)}>
                                    <option value="all">Diversity: All</option>
                                    <option value="individual">Identity: Individual</option>
                                    <option value="channel">Identity: Channel</option>
                                </select>
                                <select className="bg-black/40 border border-white/5 rounded-2xl p-3 text-[10px] font-black uppercase tracking-widest outline-none" value={creatorSortBy} onChange={(e) => setCreatorSortBy(e.target.value as any)}>
                                    <option value="total">Weight: Volume</option>
                                    <option value="name">Alpha: Name</option>
                                </select>
                            </div>

                            {isCreatingStub && (
                                <div className="glass-card p-6 border-indigo-500/50 animate-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Display Name</label>
                                            <input 
                                                type="text" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                                                value={newStub.name}
                                                onChange={(e) => {
                                                    const name = e.target.value;
                                                    setNewStub(s => ({...s, name, slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-')}));
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Canonical Slug</label>
                                            <input 
                                                type="text" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                                                value={newStub.slug}
                                                onChange={(e) => setNewStub(s => ({...s, slug: e.target.value}))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Identity Type</label>
                                            <select className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 uppercase tracking-widest font-black" 
                                                value={newStub.type} onChange={(e) => setNewStub(s => ({...s, type: e.target.value}))}>
                                                <option value="individual">Individual</option>
                                                <option value="channel">Channel</option>
                                                <option value="organization">Organization</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <button className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={() => setIsCreatingStub(false)}>Terminate</button>
                                        <button className="px-6 py-2.5 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={() => createStubMutation.mutate(newStub)}>Commit Registration</button>
                                    </div>
                                </div>
                            )}

                            <div className="glass-card overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/5">
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Contributor Identity</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Profile Meta</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-center">Density</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Action Hub</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {creators
                                            .filter(c => c.displayName.toLowerCase().includes(creatorsSearch.toLowerCase()))
                                            .sort((a, b) => (b.resourceCount || 0) - (a.resourceCount || 0))
                                            .map((c) => (
                                            <tr key={c.uid} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-black">{c.displayName?.[0]?.toUpperCase()}</div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold">{c.displayName}</span>
                                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">{c.slug}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-white/40">{c.profileType || 'individual'}</span>
                                                        {c.isStub && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">External Stub</span>}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="text-lg font-black">{c.resourceCount || 0}</span>
                                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Resources</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all" 
                                                            onClick={() => syncCreatorMutation.mutate(c.uid)}
                                                        ><Icons.refresh size={14} /></button>
                                                        <Link href={`/creators/${c.slug || c.uid}`} target="_blank" className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                                                            <Icons.external size={14} />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Suggestions View */}
                    {activeTab === 'suggestions' && (
                        <div className="glass-card overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5">
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Proposed Signal</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Source Metadata</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Curation Authority</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {resources.filter(r => r.status === 'pending' || r.status === 'suggested').map((r) => (
                                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-6">
                                                <div className="text-sm font-black mb-1">{r.title}</div>
                                                <div className="text-[10px] text-white/30 font-mono tracking-tighter truncate max-w-[400px]">{r.url}</div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{r.platform}</div>
                                                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{users.find(u => u.uid === r.addedBy)?.email || 'Anonymous'}</div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all" onClick={() => handleApproveResource(r.id)}>Commit</button>
                                                    <button className="px-5 py-2 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all" onClick={() => handleDeleteResource(r.id)}>Discard</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {resources.filter(r => r.status === 'pending' || r.status === 'suggested').length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-20 text-center text-white/20 text-[10px] font-black uppercase tracking-widest">No pending proposals in registry</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Categories View */}
                    {activeTab === 'categories' && (
                        <div className="glass-card p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black mb-4 tracking-tighter uppercase tracking-widest text-white/80">Registry Taxonomy</h3>
                                <p className="text-white/40 max-w-2xl text-lg font-medium leading-relaxed mb-10">
                                    Managing structural discovery weights across the global asset hub. AI-suggested topics and manual curator tags are unified here.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    {Array.from(new Set(resources.flatMap((r) => r.categories || []))).sort().map((cat) => (
                                        <div key={cat} className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-500/50 transition-all cursor-default">
                                            {cat} <span className="text-white/20 ml-2">{resources.filter(r => r.categories?.includes(cat)).length}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tainted View */}
                    {activeTab === 'tainted' && (
                        <div className="glass-card overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5">
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Suppressed Resource</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Safety Concern</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Contributor</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Remediation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {resources.filter(r => r.status === 'tainted').map((r) => (
                                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="p-6">
                                                <div className="text-sm font-black mb-1 group-hover:text-rose-400 transition-colors">{r.title}</div>
                                                <div className="text-[10px] text-white/30 font-mono tracking-tighter truncate max-w-[400px]">{r.url}</div>
                                            </td>
                                            <td className="p-6">
                                                <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest rounded">
                                                    {r.reportType || 'General Safety'}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[10px] font-bold text-white/60">
                                                        {users.find(u => u.uid === r.addedBy)?.displayName || 'Unknown Creator'}
                                                    </div>
                                                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                                                        Strikes: {users.find(u => u.uid === r.addedBy)?.strikes || 0}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-indigo-600/10"
                                                        onClick={() => handleReinstate(r.id, r.title)}
                                                    >
                                                        Reinstate
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteResource(r.id)}
                                                        className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all"
                                                        title="Permanent Delete"
                                                    >
                                                        <Icons.trash size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {resources.filter(r => r.status === 'tainted').length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-20 text-center text-white/20 text-[10px] font-black uppercase tracking-widest">No tainted assets found in registry</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}

