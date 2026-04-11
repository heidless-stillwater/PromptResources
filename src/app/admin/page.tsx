'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { UserProfile, Resource } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
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
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'resources' | 'creators' | 'suggestions' | 'categories'>(defaultTab);
    
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
            const usersSnap = await getDocs(collection(db, 'users'));
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
            await updateDoc(doc(db, 'users', uid), { role });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        }
    });

    const updateSubMutation = useMutation({
        mutationFn: async ({ uid, subscriptionType }: { uid: string, subscriptionType: string }) => {
            await updateDoc(doc(db, 'users', uid), { subscriptionType });
        },
        onSuccess: () => {
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

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'users', 'resources', 'suggestions', 'categories'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    // Fetch Creators
    const { data: creators = [], isLoading: creatorsLoading } = useQuery({
        queryKey: ['admin', 'creators'],
        queryFn: async () => {
            const usersSnap = await getDocs(collection(db, 'users'));
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
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
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
    const creatorsCount = users.filter((u) => u.isPublicProfile || u.isStub).length;

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
                        <h1>⚙️ Admin Panel</h1>
                        <div className="badge badge-secondary">Logged in as {activeRole?.toUpperCase()}</div>
                    </div>

                    {/* Tabs */}
                    <div className="tabs">
                        {(['overview', 'users', 'resources', 'creators', 'suggestions', 'categories'] as const).map((tab) => (
                            <button
                                key={tab}
                                className={`tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => handleTabChange(tab)}
                                id={`admin-tab-${tab}`}
                                style={{ position: 'relative' }}
                            >
                                {tab === 'overview' && '📊 '}
                                {tab === 'users' && '👥 '}
                                {tab === 'resources' && '📚 '}
                                {tab === 'creators' && '🎨 '}
                                {tab === 'suggestions' && '💡 '}
                                {tab === 'categories' && '🏷️ '}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'suggestions' && reviewCount > 0 && (
                                    <span className="tab-notification">
                                        {reviewCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Overview */}
                    {activeTab === 'overview' && (
                        <div className="animate-fade-in">
                            <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{users.length}</div>
                                    <div className="stat-label">Total Users</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{resources.length}</div>
                                    <div className="stat-label">Resources</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{creatorsCount}</div>
                                    <div className="stat-label">Creators</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{freeCount}</div>
                                    <div className="stat-label">Free Items</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{reviewCount}</div>
                                    <div className="stat-label">Pending Review</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-8)' }}>
                                <div className="glass-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                                        <h3 style={{ margin: 0 }}>Recent Users</h3>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('users')}>View All</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                        {users.slice(0, 5).map((u) => (
                                            <div key={u.uid} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-4)',
                                                paddingBottom: 'var(--space-4)',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            }}>
                                                <div className="avatar" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
                                                    {(u.displayName?.[0] || u.email?.[0] || 'U').toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{u.displayName}</div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{u.email}</div>
                                                </div>
                                                <span className={`badge ${u.role === 'su' ? 'badge-primary' : 'badge-secondary'}`}>{u.role}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="glass-card">
                                    <h3 style={{ marginBottom: 'var(--space-6)' }}>Quick Actions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        <Link href="/resources/new" className="btn btn-primary" style={{ width: '100%' }}>
                                            ➕ Add Resource
                                        </Link>
                                        <Link href="/resources/admin/assets" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                                            🖼️ Nanobanana Scenario Hub
                                        </Link>
                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: 'var(--space-1) 0' }} />
                                        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}
                                            onClick={() => setActiveTab('users')}>
                                            👥 Manage Users
                                        </button>
                                        <Link href="/admin/creators" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                                            🎨 Manage Creators
                                        </Link>
                                        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}
                                            onClick={() => setActiveTab('resources')}>
                                            📚 Manage Resources
                                        </button>
                                        <Link href="/admin/audit/youtube" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                                            📺 YouTube Audit Tool
                                        </Link>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{ width: '100%', justifyContent: 'flex-start' }}
                                            onClick={() => handleTabChange('suggestions')}>
                                            💡 Review Suggestions ({reviewCount})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Users Tab */}
                    {activeTab === 'users' && (
                        <div className="animate-fade-in">
                            <div className="table-wrapper">
                                <table className="table" id="users-table">
                                    <thead>
                                        <tr>
                                            <th>User</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Subscription</th>
                                            <th>Joined</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <tr key={u.uid}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 'var(--text-xs)' }}>
                                                            {(u.displayName?.[0] || 'U').toUpperCase()}
                                                        </div>
                                                        {u.displayName}
                                                    </div>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                                                <td>
                                                    <select
                                                        className="form-select"
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                                        style={{ minWidth: 100, padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)' }}
                                                    >
                                                        <option value="member">Member</option>
                                                        <option value="admin">Admin</option>
                                                        <option value="su">SU</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        className="form-select"
                                                        value={u.subscriptionType}
                                                        onChange={(e) => handleSubChange(u.uid, e.target.value)}
                                                        style={{ minWidth: 100, padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)' }}
                                                    >
                                                        <option value="free">Free</option>
                                                        <option value="standard">Standard</option>
                                                        <option value="pro">Pro</option>
                                                    </select>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td>
                                                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                                                        {u.uid.slice(0, 8)}...
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Suggestions Tab */}
                    {activeTab === 'suggestions' && (
                        <div className="animate-fade-in">
                            <div className="table-wrapper">
                                <table className="table" id="suggestions-table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Platform</th>
                                            <th>Type</th>
                                            <th>Pricing</th>
                                            <th>Submitted By</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resources.filter(r => r.status === 'pending' || r.status === 'suggested').length === 0 ? (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                                                    No suggestions needing review.
                                                </td>
                                            </tr>
                                        ) : resources.filter(r => r.status === 'pending' || r.status === 'suggested').map((r) => (
                                            <tr key={r.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {r.url}
                                                    </div>
                                                </td>
                                                <td><span className="badge badge-accent">{r.platform}</span></td>
                                                <td style={{ color: 'var(--text-muted)' }}>{r.type}</td>
                                                <td><span className={`badge badge-${r.pricing}`}>{r.pricing}</span></td>
                                                <td>
                                                    <div style={{ fontSize: 'var(--text-xs)' }}>
                                                        {users.find(u => u.uid === r.addedBy)?.email || r.addedBy || 'Anonymous'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${r.status === 'suggested' ? 'accent' : 'secondary'}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => handleApproveResource(r.id)}
                                                        >
                                                            ✅ Approve
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => handleDeleteResource(r.id)}
                                                            style={{ color: 'var(--danger-400)' }}
                                                        >
                                                            ❌ Reject
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

                    {/* Resources Tab */}
                    {activeTab === 'resources' && (
                        <div className="animate-fade-in">
                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                marginBottom: 'var(--space-4)',
                            }}>
                                <Link href="/resources/new" className="btn btn-primary">
                                    ➕ Add Resource
                                </Link>
                            </div>
                            <div className="table-wrapper">
                                <table className="table" id="resources-table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Platform</th>
                                            <th>Status</th>
                                            <th>Type</th>
                                            <th>Pricing</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resources.filter(r => r.status !== 'pending' && r.status !== 'suggested').map((r) => (
                                            <tr key={r.id}>
                                                <td>
                                                    <Link href={`/resources/${r.id}`} style={{
                                                        fontWeight: 600,
                                                        fontSize: 'var(--text-sm)',
                                                    }}>
                                                        {r.title}
                                                    </Link>
                                                </td>
                                                <td><span className="badge badge-accent">{r.platform}</span></td>
                                                <td>
                                                    <span className={`badge badge-${r.status === 'published' ? 'success' : 'secondary'}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>{r.type}</td>
                                                <td><span className={`badge badge-${r.pricing}`}>{r.pricing}</span></td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                        <Link href={`/resources/${r.id}/edit`} className="btn btn-ghost btn-sm">✏️</Link>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => handleDeleteResource(r.id)}
                                                            style={{ color: 'var(--danger-400)' }}
                                                        >
                                                            🗑
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

                    {/* Creators Tab */}
                    {activeTab === 'creators' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                    <h3 style={{ margin: 0 }}>🎨 Creator Registry Explorer</h3>
                                    <div className="badge badge-secondary">{creators.length} items</div>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => setIsCreatingStub(!isCreatingStub)}>
                                    {isCreatingStub ? 'Cancel' : '➕ Add External Stub'}
                                </button>
                            </div>

                            {/* Advanced Filter Bar */}
                            <div className="filter-bar" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                <div className="search-input-wrapper" style={{ flex: 2, minWidth: '250px' }}>
                                    <span className="search-icon">🔍</span>
                                    <input 
                                        type="text" 
                                        placeholder="Search creators by name or slug..." 
                                        value={creatorsSearch}
                                        onChange={(e) => setCreatorsSearch(e.target.value)}
                                    />
                                </div>
                                <select className="form-select" style={{ flex: 1, fontSize: '0.8rem' }} value={creatorFilterType} onChange={(e) => setCreatorFilterType(e.target.value)}>
                                    <option value="all">All Types</option>
                                    <option value="individual">Individual</option>
                                    <option value="channel">Channel</option>
                                    <option value="organization">Organization</option>
                                </select>
                                <select className="form-select" style={{ flex: 1, fontSize: '0.8rem' }} value={creatorFilterStatus} onChange={(e) => setCreatorFilterStatus(e.target.value as any)}>
                                    <option value="all">All Status</option>
                                    <option value="stub">Stubs Only</option>
                                    <option value="native">Native Only</option>
                                </select>
                                <select className="form-select" style={{ flex: 1, fontSize: '0.8rem' }} value={creatorSortBy} onChange={(e) => setCreatorSortBy(e.target.value as any)}>
                                    <option value="total">Resources (Dec)</option>
                                    <option value="authored">Authored (Dec)</option>
                                    <option value="name">Alphabetical</option>
                                    <option value="newest">Newest First</option>
                                </select>
                            </div>

                            {isCreatingStub && (
                                <div className="glass-card" style={{ marginBottom: 'var(--space-6)', border: '1px solid var(--accent-primary)', animation: 'slideDown 0.3s ease' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                                        <h4 style={{ margin: 0 }}>Register External Creator Stub</h4>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setIsCreatingStub(false)}>✕</button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="Display Name (e.g. Kevin Stratvert)" 
                                                value={newStub.name}
                                                onChange={(e) => {
                                                    const name = e.target.value;
                                                    setNewStub(s => ({...s, name, slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-')}));
                                                }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="Custom Slug" 
                                                value={newStub.slug}
                                                onChange={(e) => setNewStub(s => ({...s, slug: e.target.value}))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <select 
                                                className="form-select" 
                                                value={newStub.type}
                                                onChange={(e) => setNewStub(s => ({...s, type: e.target.value}))}
                                            >
                                                <option value="individual">Individual</option>
                                                <option value="channel">Channel</option>
                                                <option value="organization">Organization</option>
                                            </select>
                                        </div>
                                        <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setIsCreatingStub(false)}>Cancel</button>
                                            <button 
                                                className="btn btn-primary btn-sm"
                                                onClick={() => createStubMutation.mutate(newStub)}
                                                disabled={!newStub.name || createStubMutation.isPending}
                                            >
                                                {createStubMutation.isPending ? 'Saving...' : 'Confirm Registration'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="table-wrapper">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th onClick={() => setCreatorSortBy('name')} style={{ cursor: 'pointer' }}>
                                                Creator {creatorSortBy === 'name' ? '↓' : ''}
                                            </th>
                                            <th>Type</th>
                                            <th onClick={() => setCreatorSortBy('total')} style={{ cursor: 'pointer' }}>
                                                Total {creatorSortBy === 'total' ? '↓' : ''}
                                            </th>
                                            <th onClick={() => setCreatorSortBy('authored')} style={{ cursor: 'pointer' }}>
                                                Authored {creatorSortBy === 'authored' ? '↓' : ''}
                                            </th>
                                            <th>Curated</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creators
                                            .filter(c => {
                                                const matchesSearch = c.displayName.toLowerCase().includes(creatorsSearch.toLowerCase()) || 
                                                                     (c.slug && c.slug.toLowerCase().includes(creatorsSearch.toLowerCase()));
                                                const matchesType = creatorFilterType === 'all' || (c.profileType || 'individual') === creatorFilterType;
                                                const matchesStatus = creatorFilterStatus === 'all' || (creatorFilterStatus === 'stub' ? c.isStub : !c.isStub);
                                                return matchesSearch && matchesType && matchesStatus;
                                            })
                                            .sort((a, b) => {
                                                if (creatorSortBy === 'name') return a.displayName.localeCompare(b.displayName);
                                                if (creatorSortBy === 'authored') return (b.authoredCount || 0) - (a.authoredCount || 0);
                                                if (creatorSortBy === 'newest') return new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime();
                                                return (b.resourceCount || 0) - (a.resourceCount || 0);
                                            })
                                            .map((c) => (
                                            <tr key={c.uid}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className="avatar" style={{ width: 24, height: 24, fontSize: '10px' }}>
                                                            {(c.displayName?.[0] || 'C').toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.displayName}</div>
                                                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{c.slug}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span className="badge badge-secondary" style={{ fontSize: '9px', width: 'fit-content' }}>{c.profileType || 'individual'}</span>
                                                        {c.isStub && <span style={{ fontSize: '8px', color: 'var(--accent-primary)', fontWeight: 700 }}>EXTERNAL</span>}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{c.resourceCount || 0}</td>
                                                <td>✍️ {c.authoredCount || 0}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>📂 {c.curatedCount || 0}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button 
                                                            className="btn btn-ghost btn-sm" 
                                                            onClick={() => syncCreatorMutation.mutate(c.uid)}
                                                            disabled={syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid}
                                                            title="Re-calculate statistics"
                                                        >
                                                            {syncCreatorMutation.isPending && syncCreatorMutation.variables === c.uid ? (
                                                                <div className="spinner-inline" style={{ width: '12px', height: '12px' }} />
                                                            ) : '🔄'}
                                                        </button>
                                                        <Link href={`/creators/${c.slug || c.uid}`} target="_blank" className="btn btn-ghost btn-sm" title="View Public Profile">
                                                            🔗
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

                    {/* Categories Tab */}

                    {/* Categories Tab */}
                    {activeTab === 'categories' && (
                        <div className="animate-fade-in">
                            <div className="glass-card">
                                <h3 style={{ marginBottom: 'var(--space-4)' }}>Category Management</h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                                    Categories are auto-populated from resources. AI suggestions help maintain consistency.
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                    {Array.from(new Set(resources.flatMap((r) => r.categories || []))).sort().map((cat) => {
                                        const count = resources.filter((r) => r.categories?.includes(cat)).length;
                                        return (
                                            <div key={cat} className="badge badge-primary" style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                                {cat} <span style={{ opacity: 0.6 }}>({count})</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}
