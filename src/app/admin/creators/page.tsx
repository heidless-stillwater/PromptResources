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
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
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
    const [newStub, setNewStub] = useState({ name: '', slug: '', type: 'individual' });
    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'none' }>({ message: '', type: 'none' });
    const [sortBy, setSortBy] = useState<'name' | 'authored' | 'total' | 'newest'>('total');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'stub' | 'native'>('all');

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
            
            // Filter to only public profiles and stubs
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
        mutationFn: async (stubData: { name: string, slug: string, type: string }) => {
            const id = 'stub_' + nanoid();
            await setDoc(doc(db, 'users', id), {
                uid: id,
                displayName: stubData.name,
                email: 'fake@directory.stub',
                role: 'member',
                subscriptionType: 'free',
                slug: stubData.slug || id,
                profileType: stubData.type,
                isStub: true,
                isPublicProfile: true, // Need to be public to show in directory
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
            setNewStub({ name: '', slug: '', type: 'individual' });
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
            setSyncStatus({ message: `Successfully synced statistics for ${userId}`, type: 'success' });
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
            return (b.resourceCount || 0) - (a.resourceCount || 0); // default 'total'
        });

    const handleSyncAll = async () => {
        if (!confirm(`Sync stats for all ${creators.length} creators? This might take a moment.`)) return;
        setIsSyncingAll(true);
        try {
            for (const c of creators) {
                await syncCreatorMutation.mutateAsync(c.uid);
            }
            setSyncStatus({ message: `Successfully updated all ${creators.length} creators!`, type: 'success' });
        } catch (e) {
            setSyncStatus({ message: 'Sync process was interrupted or failed for one or more creators.', type: 'error' });
        } finally {
            setIsSyncingAll(false);
        }
    };

    if (authLoading || isLoading || !isAdmin) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 'var(--space-6) 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <Link href="/admin" className="btn btn-ghost" style={{ padding: '0 var(--space-2)' }}>← Back to Admin</Link>
                            <h1 style={{ margin: 0 }}>🎨 Creator Management</h1>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={handleSyncAll} 
                                disabled={isSyncingAll || creators.length === 0}
                            >
                                {isSyncingAll ? '⏳ Syncing...' : '🔄 Sync All Stats'}
                            </button>
                            <button className="btn btn-primary" onClick={() => setIsCreatingStub(!isCreatingStub)}>
                                {isCreatingStub ? 'Cancel' : '➕ Add External Stub'}
                            </button>
                        </div>
                    </div>

                    {/* Summary Widgets */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-6)', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <div className="glass-card stat-card" style={{ padding: 'var(--space-4)' }}>
                            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{creators.length}</div>
                            <div className="stat-label">Total Creators</div>
                        </div>
                        <div className="glass-card stat-card" style={{ padding: 'var(--space-4)' }}>
                            <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--accent-primary)' }}>
                                {creators.filter(c => c.isStub).length}
                            </div>
                            <div className="stat-label">External Stubs</div>
                        </div>
                        <div className="glass-card stat-card" style={{ padding: 'var(--space-4)' }}>
                            <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>
                                {creators.filter(c => c.isVerified).length}
                            </div>
                            <div className="stat-label">Verified</div>
                        </div>
                        <div className="glass-card stat-card" style={{ padding: 'var(--space-4)' }}>
                            <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>
                                {creators.filter(c => c.isFeatured).length}
                            </div>
                            <div className="stat-label">Featured</div>
                        </div>
                    </div>

                    <div className="filter-bar" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                        <div className="search-input-wrapper" style={{ flex: 2, minWidth: '300px' }}>
                            <span className="search-icon">🔍</span>
                            <input 
                                type="text" 
                                placeholder="Search by name, slug or platform..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        
                        <select className="form-select" style={{ flex: 1, minWidth: '140px' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="all">All Types</option>
                            <option value="individual">Individual</option>
                            <option value="channel">Channel</option>
                            <option value="organization">Organization</option>
                        </select>

                        <select className="form-select" style={{ flex: 1, minWidth: '140px' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                            <option value="all">All Status</option>
                            <option value="stub">Stubs Only</option>
                            <option value="native">Native Users</option>
                        </select>

                        <select className="form-select" style={{ flex: 1, minWidth: '140px' }} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                            <option value="total">Sort by Resources</option>
                            <option value="authored">Sort by Authored</option>
                            <option value="name">Sort by Name</option>
                            <option value="newest">Sort by Newest</option>
                        </select>
                    </div>

                    {isCreatingStub && (
                        <div className="glass-card animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
                            <h3>Create External Creator Stub</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)', fontSize: '0.9rem' }}>
                                A stub account allows external YouTubers or writers to appear in the directory. If they sign up later, this profile can be linked.
                            </p>
                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    createStubMutation.mutate(newStub);
                                }}
                                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-4)', alignItems: 'end' }}
                            >
                                <div className="form-group">
                                    <label>Display Name</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={newStub.name} 
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setNewStub(s => ({...s, name, slug: slugify(name)}));
                                        }} 
                                        required 
                                        placeholder="e.g. Kevin Stratvert"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Custom Slug (Optional)</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={newStub.slug} 
                                        onChange={(e) => setNewStub(s => ({...s, slug: e.target.value}))} 
                                        placeholder="e.g. kevin-stratvert"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Type</label>
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
                                <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
                                    Save Stub
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="table-wrapper animate-fade-in">
                        <table className="table" id="creators-table">
                            <thead>
                                <tr>
                                    <th>Creator</th>
                                    <th>Type / Profile</th>
                                    <th>Resources</th>
                                    <th>Featured</th>
                                    <th>Verified</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCreators.map((c) => (
                                    <tr key={c.uid}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                {c.photoURL ? (
                                                     <img src={c.photoURL} alt={c.displayName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 'var(--text-xs)' }}>
                                                        {(c.displayName?.[0] || 'C').toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {c.displayName}
                                                        {c.isVerified && <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>☑️</span>}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        slug: {c.slug || c.uid.slice(0,8)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span className={`badge badge-secondary`} style={{ width: 'fit-content', fontSize: '10px' }}>
                                                    {c.profileType || 'individual'}
                                                </span>
                                                {c.isStub && <span className="badge badge-accent" style={{ width: 'fit-content', fontSize: '9px', padding: '0 4px', background: 'rgba(99,102,241,0.05)' }}>External Stub</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                    {c.resourceCount || 0}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                                                    <span>✍️ {c.authoredCount || 0}</span>
                                                    <span>📂 {c.curatedCount || 0}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <button 
                                                className={`btn btn-sm ${c.isFeatured ? 'btn-primary' : 'btn-ghost'}`}
                                                style={{ padding: '2px 8px', fontSize: '10px' }}
                                                onClick={() => toggleFeaturedMutation.mutate({ uid: c.uid, current: !!c.isFeatured })}
                                            >
                                                {c.isFeatured ? '⭐ Featured' : '☆ Feature'}
                                            </button>
                                        </td>
                                        <td>
                                            <button 
                                                className={`btn btn-sm ${c.isVerified ? 'btn-primary' : 'btn-ghost'}`}
                                                style={{ padding: '2px 8px', fontSize: '10px' }}
                                                onClick={() => toggleVerifiedMutation.mutate({ uid: c.uid, current: !!c.isVerified })}
                                            >
                                                {c.isVerified ? '✅ Verified' : '☐ Verify'}
                                            </button>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button 
                                                    className="btn btn-ghost btn-sm" 
                                                    title="Sync Stats"
                                                    disabled={syncCreatorMutation.isPending}
                                                    onClick={() => syncCreatorMutation.mutate(c.uid)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <Icons.refresh size={16} className={syncCreatorMutation.isPending ? 'animate-spin' : ''} />
                                                    <span style={{ fontSize: '10px' }}>Sync</span>
                                                </button>
                                                <Link href={`/creators/${c.slug || c.uid}`} target="_blank" className="btn btn-ghost btn-sm">
                                                    <Icons.external size={14} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {creators.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                            No public creators or stubs found.
                        </div>
                    )}
                </div>
            </div>
            <Footer />

            {/* Sync Feedback Modal */}
            {syncStatus.type !== 'none' && (
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 1000 }}>
                    <div className="glass-card modal-content" style={{ maxWidth: '450px', width: '90%', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>
                            {syncStatus.type === 'success' ? '✅' : '❌'}
                        </div>
                        <h3 style={{ marginBottom: 'var(--space-2)' }}>
                            {syncStatus.type === 'success' ? 'Sync Complete' : 'Sync Error'}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
                            {syncStatus.message}
                        </p>
                        <button 
                            className={`btn ${syncStatus.type === 'success' ? 'btn-primary' : 'btn-secondary'} w-full`}
                            onClick={() => setSyncStatus({ message: '', type: 'none' })}
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
