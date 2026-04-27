'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
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
import { extractYouTubeId } from '@/lib/youtube';

export default function AdminPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper dashboard-theme min-h-screen flex items-center justify-center">
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
    const { user, isAdmin, canSwitchRoles, activeRole, loading: authLoading } = useAuth();
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
    
    // Reconciliation State
    const [legacyStats, setLegacyStats] = useState<{ default: number; active: number; node: string } | null>(null);
    const [isCheckingLegacy, setIsCheckingLegacy] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);
    
    // Total Tracking
    const [totalResourceCount, setTotalResourceCount] = useState(0);

    // Resources Tab Enhanced State
    const [resourcesSearch, setResourcesSearch] = useState('');
    const [resourcesSortBy, setResourcesSortBy] = useState<string>('updatedAt');
    const [resourcesSortOrder, setResourcesSortOrder] = useState<'asc' | 'desc'>('desc');
    const [resourcesFilterStatus, setResourcesFilterStatus] = useState<string>('all');
    const [resourcesFilterPlatform, setResourcesFilterPlatform] = useState<string>('all');
    const [resourcesGroupBy, setResourcesGroupBy] = useState<'none' | 'creator' | 'platform' | 'status'>('none');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});



    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    useEffect(() => {
        if (!authLoading && (!user || !isAdmin)) {
            router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    // Fetch users
    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: async () => {
            const idToken = await user?.getIdToken();
            const res = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const data = await res.json();
            console.log('[AdminHub] Users API Response:', data);
            if (!data.success) {
                console.error('[AdminHub] Users API Error:', data.error, data.stack);
                return [];
            }
            return data.users as UserProfile[];
        },
        enabled: !!user && (isAdmin || canSwitchRoles),
    });

    // Fetch resources
    const { data: resources = [], isLoading: resourcesLoading } = useQuery({
        queryKey: ['admin', 'resources'],
        queryFn: async () => {
            try {
                const idToken = await user?.getIdToken();
                const response = await fetch('/api/resources?pageSize=1000&status=published,draft,pending,suggested,flagged,hidden,tainted', {
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });
                const result = await response.json();
                if (result.success) {
                    setTotalResourceCount(result.total || 0);
                    return result.data as Resource[];
                } else {
                    console.error('[AdminHub] API Error:', result.error);
                    return [];
                }
            } catch (err) {
                console.error('[AdminHub] Fetch Crash:', err);
                return [];
            }
        },
        enabled: !!user && (isAdmin || canSwitchRoles),
    });

    const processedResources = useMemo(() => {
        // 1. Filter
        let filtered = (resources as Resource[]).filter(r => {
            const matchesSearch = r.title.toLowerCase().includes(resourcesSearch.toLowerCase()) || 
                                (r.creator?.displayName || '').toLowerCase().includes(resourcesSearch.toLowerCase());
            const matchesPlatform = resourcesFilterPlatform === 'all' || r.platform === resourcesFilterPlatform;
            const matchesStatus = resourcesFilterStatus === 'all' || r.status === resourcesFilterStatus;
            const isMainView = r.status !== 'pending' && r.status !== 'suggested' && r.status !== 'tainted';
            return matchesSearch && matchesPlatform && matchesStatus && isMainView;
        });

        // 2. Sort
        filtered.sort((a, b) => {
            let valA: any = a[resourcesSortBy as keyof Resource] || '';
            let valB: any = b[resourcesSortBy as keyof Resource] || '';
            if (resourcesSortBy === 'creator') {
                valA = a.creator?.displayName || '';
                valB = b.creator?.displayName || '';
            }
            if (valA < valB) return resourcesSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return resourcesSortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        // 3. Group
        const groups: Record<string, { label: string, items: Resource[] }> = {};
        if (resourcesGroupBy !== 'none') {
            filtered.forEach(r => {
                let key = 'other';
                let label = 'Other';
                if (resourcesGroupBy === 'creator') {
                    key = r.addedBy || 'community';
                    label = r.creator?.displayName || 'Community';
                } else if (resourcesGroupBy === 'platform') {
                    key = r.platform || 'general';
                    label = r.platform || 'General';
                } else if (resourcesGroupBy === 'status') {
                    key = r.status || 'draft';
                    label = r.status || 'Draft';
                }
                if (!groups[key]) groups[key] = { label, items: [] };
                groups[key].items.push(r);
            });
        }

        return { filtered, groups };
    }, [resources, resourcesSearch, resourcesFilterPlatform, resourcesFilterStatus, resourcesSortBy, resourcesSortOrder, resourcesGroupBy]);

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
            const idToken = await user?.getIdToken();
            const res = await fetch('/api/admin/creators', {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const data = await res.json();
            if (!data.success) {
                console.error('[AdminHub] Creators API Error:', data.error);
                return [];
            }
            return data.creators as UserProfile[];
        },
        enabled: !!user && (isAdmin || canSwitchRoles),
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

    const checkLegacyData = async () => {
        setIsCheckingLegacy(true);
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/admin/reconcile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setLegacyStats(data.counts);
            }
        } catch (err) {
            console.error('Check failed:', err);
        } finally {
            setIsCheckingLegacy(false);
        }
    };

    const runReconciliation = async () => {
        if (!confirm(`Move ${legacyStats?.default} resources to ${legacyStats?.node}?`)) return;
        setIsReconciling(true);
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/admin/reconcile', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setLegacyStats(null);
                queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });
            }
        } catch (err) {
            console.error('Reconciliation failed:', err);
        } finally {
            setIsReconciling(false);
        }
    };

    if (authLoading || usersLoading || resourcesLoading || creatorsLoading || !isAdmin) {
        return (
            <div className="page-wrapper dashboard-theme min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Authorizing Access</div>
                </div>
            </div>
        );
    }

    const handleTabChange = (tab: typeof activeTab) => {
        setActiveTab(tab);
        router.push(`/admin?tab=${tab}`, { scroll: false });
    };

    const freeCount = resources.filter((r) => r.pricing === 'free').length;
    const paidCount = resources.filter((r) => r.pricing === 'paid').length;
    const reviewCount = resources.filter((r) => r.status === 'pending' || r.status === 'suggested').length;
    const taintedCount = resources.filter((r) => r.status === 'tainted').length;
    const creatorsCount = users.filter((u) => u.isPublicProfile || u.isStub).length;

    return (
        <div className="page-wrapper dashboard-theme min-h-screen selection:bg-primary/30">
            <Navbar />

            {/* Cinematic Hero */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-48 -mt-48" />
                </div>

                <div className="container relative z-10 flex flex-col gap-4 pt-8 pb-0">
                    {/* Header Pathing */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-6">
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
                    <div className="glass-card p-5 shadow-2xl relative overflow-hidden group mb-10">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10">
                            <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                                Registry Authority / Control Hub
                                <span className="w-1 h-1 rounded-full bg-indigo-500/50" />
                                <span className="text-indigo-400/60 flex items-center gap-1">
                                    <Icons.database size={10} />
                                    {process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || 'promptresources-db-0'}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white mb-3 leading-none flex items-center gap-4">
                                <Icons.settings size={48} className="text-indigo-400" />
                                <span>Control <span className="text-indigo-400">Hub</span></span>
                            </h1>

                            <p className="text-white/40 max-w-2xl text-lg font-medium leading-relaxed mb-4">
                                Orchestrate the architectural integrity of the PromptMaster ecosystem. Manage users, resources, and taxonomies through the high-density administrative workbench.
                            </p>

                            {/* Integrated Stats HUD */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                                {[
                                    { label: 'Total Users', value: users.length, icon: <Icons.users size={14} /> },
                                    { label: 'Resource Assets', value: totalResourceCount || resources.length, icon: <Icons.database size={14} /> },
                                    { label: 'Pending Review', value: reviewCount, icon: <Icons.sparkles size={14} />, color: 'text-indigo-400' },
                                    { label: 'Tainted Assets', value: taintedCount, icon: <Icons.report size={14} />, color: 'text-rose-400' },
                                    { label: 'Active Creators', value: creatorsCount, icon: <Icons.user size={14} /> },
                                    { label: 'Free Assets', value: freeCount, icon: <Icons.zap size={14} /> }
                                ].map((stat, i) => (
                                    <div key={i} className="glass-card p-5 group hover:border-white/20 transition-all cursor-default relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-indigo-500/10 transition-all" />
                                        <div className="flex items-center gap-1 text-white/20 group-hover:text-white/40 mb-1 transition-colors relative z-10">
                                            {stat.icon}
                                            <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                                        </div>
                                        <div className={`text-2xl font-black relative z-10 ${stat.color || 'text-white'}`}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Reconciliation Warning Card */}
                            {activeTab === 'overview' && (
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="glass-card p-3 px-6 border-indigo-500/30 bg-indigo-500/5 flex flex-col justify-between group">
                                        <div>
                                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                                <Icons.shield size={14} /> Sovereign Data Check
                                            </h3>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed mb-3">
                                                Detect and reconcile resources stored in legacy or secondary database instances.
                                            </p>
                                        </div>
                                        <button 
                                            onClick={checkLegacyData}
                                            disabled={isCheckingLegacy}
                                            className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isCheckingLegacy ? <Icons.spinner className="animate-spin" size={12} /> : <Icons.search size={12} />}
                                            {isCheckingLegacy ? 'Scanning...' : 'Check Legacy Registry'}
                                        </button>
                                    </div>

                                    {legacyStats && legacyStats.default > 0 && (
                                        <div className="glass-card p-3 px-6 border-rose-500/30 bg-rose-500/5 flex flex-col justify-between animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                                    <Icons.alert size={14} /> Mismatch Detected
                                                </h3>
                                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed mb-3">
                                                    Found <span className="text-white">{legacyStats.default}</span> resources in <span className="text-rose-400">(default)</span>. 
                                                    Your active node <span className="text-indigo-400">{legacyStats.node}</span> expects all data.
                                                </p>
                                            </div>
                                            <button 
                                                onClick={runReconciliation}
                                                disabled={isReconciling}
                                                className="w-full py-3 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-rose-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
                                            >
                                                {isReconciling ? <Icons.spinner className="animate-spin" size={12} /> : <Icons.zap size={12} />}
                                                {isReconciling ? 'Reconciling...' : `Move to ${legacyStats.node}`}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 pt-0 pb-10 relative z-30 mt-10">
                {/* Navigation Hub */}
                <div className="flex flex-wrap items-center gap-2 p-2 bg-white/5 backdrop-blur-3xl border border-white/5 rounded-[2rem] w-fit mb-5">
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
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="glass-card p-4">
                                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
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

                            <div className="space-y-4">
                                <div className="glass-card p-4 bg-indigo-600/[0.03] border-indigo-500/20">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/30 mb-3 flex items-center gap-2">
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
                                            { label: 'Sources Registry', icon: <Icons.user size={16} />, tab: 'creators' },
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
                        <div className="glass-card overflow-hidden mt-3">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/5">
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Registry Authority</th>
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Credentials</th>
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">System Role</th>
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Tier</th>
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Established</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {users.map((u) => (
                                            <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-3 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black border border-white/10">
                                                            {(u.displayName?.[0] || 'U').toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-bold group-hover:text-indigo-400 transition-colors">{u.displayName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 px-6 text-xs text-white/40 font-mono tracking-tight">{u.email}</td>
                                                <td className="p-3 px-6">
                                                    <CustomSelect 
                                                        value={u.role}
                                                        onChange={(val) => handleRoleChange(u.uid, val)}
                                                        options={[
                                                            { value: 'member', label: 'Member' },
                                                            { value: 'admin', label: 'Admin' },
                                                            { value: 'su', label: 'SU' }
                                                        ]}
                                                        className="min-w-[120px]"
                                                    />
                                                </td>
                                                <td className="p-3 px-6">
                                                    <div className="flex flex-col gap-1.5">
                                                        {u.subscription?.status === 'active' ? (
                                                            <div className="flex items-center gap-2 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                                                    {u.subscription.bundleId || 'PRO Suite'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <CustomSelect 
                                                                value={u.subscriptionType}
                                                                onChange={(val) => handleSubChange(u.uid, val)}
                                                                options={[
                                                                    { value: 'free', label: 'Free' },
                                                                    { value: 'standard', label: 'Standard' },
                                                                    { value: 'pro', label: 'Pro' }
                                                                ]}
                                                                className="min-w-[120px]"
                                                            />
                                                        )}
                                                        {u.subscription?.status && u.subscription.status !== 'active' && (
                                                            <span className="text-[8px] font-bold uppercase tracking-wider text-red-400/60 ml-1">
                                                                Status: {u.subscription.status.replace('_', ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/20">
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
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><Icons.database size={20} /></div>
                                    <h3 className="text-xl font-black tracking-widest uppercase">Global Asset Registry</h3>
                                </div>
                                <Link href="/resources/new" className="px-6 py-2.5 bg-indigo-600 border border-indigo-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2">
                                    <Icons.plus size={14} /> New Resource
                                </Link>
                            </div>

                            {/* Resource Controls */}
                            <div className="flex flex-wrap items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-3xl mt-3">
                                <div className="relative flex-1 min-w-[250px]">
                                    <Icons.search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl h-9 pl-12 pr-4 text-xs font-medium outline-none focus:border-indigo-500/30 text-white"
                                        placeholder="Search title or creator..."
                                        value={resourcesSearch}
                                        onChange={(e) => setResourcesSearch(e.target.value)}
                                    />
                                </div>
                                <CustomSelect 
                                    value={resourcesFilterPlatform}
                                    onChange={setResourcesFilterPlatform}
                                    options={[
                                        { value: 'all', label: 'Platform: All' },
                                        { value: 'gemini', label: 'Gemini' },
                                        { value: 'chatgpt', label: 'ChatGPT' },
                                        { value: 'claude', label: 'Claude' },
                                        { value: 'midjourney', label: 'Midjourney' }
                                    ]}
                                    className="min-w-[150px]"
                                />
                                <CustomSelect 
                                    value={resourcesFilterStatus}
                                    onChange={setResourcesFilterStatus}
                                    options={[
                                        { value: 'all', label: 'Status: All' },
                                        { value: 'published', label: 'Published' },
                                        { value: 'draft', label: 'Draft' },
                                        { value: 'hidden', label: 'Hidden' }
                                    ]}
                                    className="min-w-[150px]"
                                />
                                <CustomSelect 
                                    value={resourcesGroupBy}
                                    onChange={(val) => {
                                        setResourcesGroupBy(val as any);
                                        setExpandedGroups({});
                                    }}
                                    options={[
                                        { value: 'none', label: 'Group: None' },
                                        { value: 'creator', label: 'Group: Creator' },
                                        { value: 'platform', label: 'Group: Platform' },
                                        { value: 'status', label: 'Group: Status' }
                                    ]}
                                    className="min-w-[150px]"
                                />
                                <button 
                                    className={`h-9 px-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                        resourcesGroupBy !== 'none' 
                                            ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' 
                                            : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-indigo-500/30'
                                    }`}
                                    onClick={() => {
                                        // If not grouped, auto-group by creator first to make the button "active"
                                        if (resourcesGroupBy === 'none') {
                                            setResourcesGroupBy('creator');
                                            // Delay expansion slightly to allow groups to be calculated
                                            setTimeout(() => {
                                                const groupKeys = Object.keys(processedResources.groups);
                                                const allExpanded: Record<string, boolean> = {};
                                                groupKeys.forEach(k => allExpanded[k] = true);
                                                setExpandedGroups(allExpanded);
                                            }, 10);
                                            return;
                                        }

                                        const groupKeys = Object.keys(processedResources.groups);
                                        const isSomeExpanded = Object.keys(expandedGroups).length > 0;
                                        
                                        if (isSomeExpanded) {
                                            setExpandedGroups({});
                                        } else {
                                            const allExpanded: Record<string, boolean> = {};
                                            groupKeys.forEach(k => allExpanded[k] = true);
                                            setExpandedGroups(allExpanded);
                                        }
                                    }}
                                >
                                    <Icons.list size={14} />
                                    Expand | Collapse
                                </button>
                            </div>

                            <div className="glass-card overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/5">
                                            {[
                                                { key: 'thumbnail', label: 'Preview' },
                                                { key: 'title', label: 'Discovery Title' },
                                                { key: 'creator', label: 'Creator Authority' },
                                                { key: 'platform', label: 'Platform Hub' },
                                                { key: 'status', label: 'Visibility' },
                                                { key: 'type', label: 'Taxonomy' },
                                                { key: 'updatedAt', label: 'Last Signal' }
                                            ].map((col) => (
                                                <th 
                                                    key={col.key}
                                                    className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30 cursor-pointer hover:text-white transition-colors"
                                                    onClick={() => {
                                                        if (resourcesSortBy === col.key) {
                                                            setResourcesSortOrder(resourcesSortOrder === 'asc' ? 'desc' : 'asc');
                                                        } else {
                                                            setResourcesSortBy(col.key);
                                                            setResourcesSortOrder('asc');
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {col.label}
                                                        {resourcesSortBy === col.key && (
                                                            <Icons.chevronDown size={12} className={`transition-transform ${resourcesSortOrder === 'desc' ? '' : 'rotate-180'}`} />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Action Hub</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(() => {
                                            const { filtered, groups } = processedResources;

                                            // 3. Group
                                            if (resourcesGroupBy !== 'none') {
                                                return Object.entries(groups).map(([key, group]) => {
                                                    const isExpanded = !!expandedGroups[key];
                                                    return (
                                                        <React.Fragment key={key}>
                                                            <tr 
                                                                className="bg-white/5 border-y border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                                                onClick={() => toggleGroup(key)}
                                                            >
                                                                <td colSpan={7} className="p-2 px-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <Icons.chevronRight size={14} className={`text-indigo-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">{resourcesGroupBy}:</span>
                                                                            <span className="text-xs font-black uppercase tracking-widest text-white/80">{group.label}</span>
                                                                            <span className="ml-2 px-2 py-0.5 bg-white/10 rounded text-[9px] font-black text-white/40">{group.items.length} Assets</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && group.items.map(r => (
                                                                <ResourceRow key={r.id} r={r} onDelete={handleDeleteResource} />
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                });
                                            }

                                            return filtered.map((r) => (
                                                <ResourceRow key={r.id} r={r} onDelete={handleDeleteResource} />
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Creators View */}
                    {activeTab === 'creators' && (
                        <div className="space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-6">
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

                            <div className="flex flex-wrap items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-3xl mt-3">
                                <div className="relative flex-1 min-w-[300px]">
                                    <Icons.search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl h-9 pl-12 pr-4 text-xs font-medium outline-none focus:border-indigo-500/30 text-white"
                                        placeholder="Search registry by name or signature slug..."
                                        value={creatorsSearch}
                                        onChange={(e) => setCreatorsSearch(e.target.value)}
                                    />
                                </div>
                                <CustomSelect 
                                    value={creatorFilterType}
                                    onChange={setCreatorFilterType}
                                    options={[
                                        { value: 'all', label: 'Diversity: All' },
                                        { value: 'individual', label: 'Identity: Individual' },
                                        { value: 'channel', label: 'Identity: Channel' }
                                    ]}
                                    className="min-w-[150px]"
                                />
                                <CustomSelect 
                                    value={creatorSortBy}
                                    onChange={(val) => setCreatorSortBy(val as any)}
                                    options={[
                                        { value: 'total', label: 'Weight: Volume' },
                                        { value: 'name', label: 'Alpha: Name' }
                                    ]}
                                    className="min-w-[150px]"
                                />
                            </div>

                            {isCreatingStub && (
                                <div className="glass-card p-3 px-6 border-indigo-500/50 animate-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 mb-6">
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
                                            <CustomSelect 
                                                value={newStub.type}
                                                onChange={(val) => setNewStub(s => ({...s, type: val}))}
                                                options={[
                                                    { value: 'individual', label: 'Individual' },
                                                    { value: 'channel', label: 'Channel' },
                                                    { value: 'organization', label: 'Organization' }
                                                ]}
                                                className="w-full"
                                            />
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
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Source Identity</th>
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Profile Meta</th>
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-center">Density</th>
                                            <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Action Hub</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {creators
                                            .filter(c => c.displayName.toLowerCase().includes(creatorsSearch.toLowerCase()))
                                            .sort((a, b) => (b.resourceCount || 0) - (a.resourceCount || 0))
                                            .map((c) => (
                                            <tr key={c.uid} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="p-3 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/20 border border-indigo-500/20 flex items-center justify-center">
                                                            {c.photoURL ? (
                                                                <img src={c.photoURL} alt={c.displayName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-black text-primary">
                                                                    {c.displayName?.[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold">{c.displayName}</span>
                                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">{c.slug}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 px-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-white/40">{c.profileType || 'individual'}</span>
                                                        {c.isStub && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">External Stub</span>}
                                                    </div>
                                                </td>
                                                <td className="p-3 px-6 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="text-lg font-black">{c.resourceCount || 0}</span>
                                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Resources</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 px-6 text-right">
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
                        <div className="glass-card overflow-hidden mt-3">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5">
                                        <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Proposed Signal</th>
                                        <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Source Metadata</th>
                                        <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Curation Authority</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {resources.filter(r => r.status === 'pending' || r.status === 'suggested').map((r) => (
                                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-3 px-6">
                                                <div className="text-sm font-black mb-1">{r.title}</div>
                                                <div className="text-[10px] text-white/30 font-mono tracking-tighter truncate max-w-[400px]">{r.url}</div>
                                            </td>
                                            <td className="p-3 px-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{r.platform}</div>
                                                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{users.find(u => u.uid === r.addedBy)?.email || 'Anonymous'}</div>
                                                </div>
                                            </td>
                                            <td className="p-3 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all" onClick={() => handleApproveResource(r.id)}>Commit</button>
                                                    <button className="px-5 py-2 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all" onClick={() => handleDeleteResource(r.id)}>Discard</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {resources.filter(r => r.status === 'pending' || r.status === 'suggested').length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-10 text-center text-white/20 text-[10px] font-black uppercase tracking-widest">No pending proposals in registry</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Categories View */}
                    {activeTab === 'categories' && (
                        <div className="glass-card p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black mb-4 tracking-tighter uppercase tracking-widest text-white/80">Registry Taxonomy</h3>
                                <p className="text-white/40 max-w-2xl text-lg font-medium leading-relaxed mb-5">
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
                        <div className="glass-card overflow-hidden mt-3">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5">
                                        <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Suppressed Resource</th>
                                        <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Safety Concern</th>
                                        <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30">Contributor</th>
                                        <th className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Remediation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {resources.filter(r => r.status === 'tainted').map((r) => (
                                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="p-3 px-6">
                                                <div className="text-sm font-black mb-1 group-hover:text-rose-400 transition-colors">{r.title}</div>
                                                <div className="text-[10px] text-white/30 font-mono tracking-tighter truncate max-w-[400px]">{r.url}</div>
                                            </td>
                                            <td className="p-3 px-6">
                                                <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest rounded">
                                                    {r.reportType || 'General Safety'}
                                                </span>
                                            </td>
                                            <td className="p-3 px-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[10px] font-bold text-white/60">
                                                        {users.find(u => u.uid === r.addedBy)?.displayName || 'Unknown Creator'}
                                                    </div>
                                                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                                                        Strikes: {users.find(u => u.uid === r.addedBy)?.strikes || 0}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 px-6 text-right">
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

function ResourceRow({ r, onDelete }: { r: Resource, onDelete: (id: string) => void }) {
    const ytId = r.url ? extractYouTubeId(r.url) : null;
    const thumbUrl = r.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

    return (
        <tr className="hover:bg-white/[0.02] transition-colors group">
            <td className="p-3 px-6">
                <div className="w-12 h-8 rounded bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                    {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <Icons.image size={12} className="text-white/10" />
                    )}
                </div>
            </td>
            <td className="p-3 px-6">
                <Link href={`/resources/${r.id}`} className="text-sm font-bold hover:text-indigo-400 transition-colors block mb-1">{r.title}</Link>
                <div className="text-[10px] text-white/20 font-mono truncate max-w-[200px]">{r.url}</div>
            </td>
            <td className="p-3 px-6">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-[8px] font-black border border-white/10">
                        {(r.creator?.displayName?.[0] || 'C').toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-white/60">{r.creator?.displayName || 'Unknown'}</span>
                </div>
            </td>
            <td className="p-3 px-6">
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black uppercase tracking-widest text-white/40">{r.platform}</span>
            </td>
            <td className="p-3 px-6">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${r.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
                    {r.status}
                </span>
            </td>
            <td className="p-3 px-6">
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{r.type}</span>
            </td>
            <td className="p-3 px-6 text-[10px] font-black uppercase tracking-widest text-white/20">
                {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : 'N/A'}
            </td>
            <td className="p-3 px-6 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/resources/${r.id}/edit`} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
                        <Icons.edit size={14} />
                    </Link>
                    <button
                        onClick={() => onDelete(r.id)}
                        className="p-2 bg-white/5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all"
                    >
                        <Icons.trash size={14} />
                    </button>
                </div>
            </td>
        </tr>
    );
}


function CustomSelect({ value, onChange, options, placeholder, className = "" }: { 
    value: string, 
    onChange: (val: string) => void, 
    options: { value: string, label: string }[],
    placeholder?: string,
    className?: string
}) {
    return (
        <div className={`relative flex items-center group ${className}`}>
            <select 
                value={value} 
                onChange={e => onChange(e.target.value)} 
                className="h-9 bg-black/40 border border-white/5 rounded-xl px-4 pr-10 text-[10px] font-black font-outfit uppercase text-white/40 outline-none hover:bg-white/5 hover:border-indigo-500/30 transition-all cursor-pointer appearance-none tracking-widest w-full"
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#0f172a] text-white">{opt.label}</option>
                ))}
            </select>
            <Icons.chevronDown size={12} className="absolute right-4 text-white/10 pointer-events-none group-hover:text-indigo-400 transition-colors" />
        </div>
    );
}
