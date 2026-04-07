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
                        <button className="btn btn-primary" onClick={() => setIsCreatingStub(!isCreatingStub)}>
                            {isCreatingStub ? 'Cancel' : '➕ Add External Stub'}
                        </button>
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
                                        onChange={(e) => setNewStub(s => ({...s, name: e.target.value}))} 
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
                                {creators.map((c) => (
                                    <tr key={c.uid}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <div className="avatar" style={{ width: 32, height: 32, fontSize: 'var(--text-xs)' }}>
                                                    {(c.displayName?.[0] || 'C').toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{c.displayName}</div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        Slug: {c.slug || c.uid.slice(0,8)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span className={`badge badge-secondary`} style={{ width: 'fit-content' }}>
                                                    {c.profileType || 'individual'}
                                                </span>
                                                {c.isStub && <span className="badge badge-accent" style={{ width: 'fit-content', fontSize: '0.65rem' }}>External Stub</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="stat-value" style={{ fontSize: '1.2rem', margin: 0 }}>
                                                {c.resourceCount || 0}
                                            </div>
                                        </td>
                                        <td>
                                            <button 
                                                className={`btn btn-sm ${c.isFeatured ? 'btn-primary' : 'btn-ghost'}`}
                                                onClick={() => toggleFeaturedMutation.mutate({ uid: c.uid, current: !!c.isFeatured })}
                                            >
                                                {c.isFeatured ? '⭐ Yes' : '☆ No'}
                                            </button>
                                        </td>
                                        <td>
                                            <button 
                                                className={`btn btn-sm ${c.isVerified ? 'btn-primary' : 'btn-ghost'}`}
                                                onClick={() => toggleVerifiedMutation.mutate({ uid: c.uid, current: !!c.isVerified })}
                                            >
                                                {c.isVerified ? '☑️ Yes' : '☐ No'}
                                            </button>
                                        </td>
                                        <td>
                                            <Link href={`/creators/${c.slug || c.uid}`} target="_blank" className="btn btn-ghost btn-sm">
                                                ↗ View
                                            </Link>
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
        </div>
    );
}
