'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { UserProfile, Resource } from '@/lib/types';

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
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const defaultTab = (searchParams.get('tab') as any) || 'overview';
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'resources' | 'suggestions' | 'categories'>(defaultTab);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && (!user || !isAdmin)) {
            router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    useEffect(() => {
        async function fetchAdminData() {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const usersData = usersSnap.docs.map((d) => ({
                    ...d.data(),
                    uid: d.id,
                    createdAt: d.data().createdAt?.toDate() || new Date(),
                    updatedAt: d.data().updatedAt?.toDate() || new Date(),
                })) as UserProfile[];
                setUsers(usersData);

                const resSnap = await getDocs(collection(db, 'resources'));
                const resData = resSnap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate() || new Date(),
                    updatedAt: d.data().updatedAt?.toDate() || new Date(),
                })) as Resource[];
                setResources(resData);
            } catch (error) {
                console.error('Error fetching admin data:', error);
            } finally {
                setLoading(false);
            }
        }
        if (user && isAdmin) fetchAdminData();
    }, [user, isAdmin]);

    const handleDeleteResource = async (id: string) => {
        if (!confirm('Delete this resource?')) return;
        try {
            await deleteDoc(doc(db, 'resources', id));
            setResources(resources.filter((r) => r.id !== id));
        } catch (error) {
            console.error('Error deleting resource:', error);
        }
    };

    const handleApproveResource = async (id: string) => {
        try {
            await updateDoc(doc(db, 'resources', id), { status: 'published', updatedAt: new Date() });
            setResources(resources.map((r) => r.id === id ? { ...r, status: 'published' } : r));
        } catch (error) {
            console.error('Error approving resource:', error);
        }
    };

    const handleRoleChange = async (uid: string, newRole: string) => {
        try {
            await updateDoc(doc(db, 'users', uid), { role: newRole });
            setUsers(users.map((u) => u.uid === uid ? { ...u, role: newRole as UserProfile['role'] } : u));
        } catch (error) {
            console.error('Error updating role:', error);
        }
    };

    const handleSubChange = async (uid: string, newSub: string) => {
        try {
            await updateDoc(doc(db, 'users', uid), { subscriptionType: newSub });
            setUsers(users.map((u) => u.uid === uid ? { ...u, subscriptionType: newSub as UserProfile['subscriptionType'] } : u));
        } catch (error) {
            console.error('Error updating subscription:', error);
        }
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'users', 'resources', 'suggestions', 'categories'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    if (authLoading || !isAdmin) {
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

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <h1 style={{ marginBottom: 'var(--space-6)' }}>⚙️ Admin Panel</h1>

                    {/* Tabs */}
                    <div className="tabs">
                        {(['overview', 'users', 'resources', 'suggestions', 'categories'] as const).map((tab) => (
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
                                {tab === 'suggestions' && '💡 '}
                                {tab === 'categories' && '🏷️ '}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'suggestions' && reviewCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-5px',
                                        right: '-5px',
                                        background: 'var(--danger-500)',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '18px',
                                        height: '18px',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                    }}>
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
                                    <div className="stat-label">Total Resources</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{freeCount}</div>
                                    <div className="stat-label">Free Resources</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{paidCount}</div>
                                    <div className="stat-label">Paid Resources</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                                <div className="glass-card">
                                    <h3 style={{ marginBottom: 'var(--space-4)' }}>Recent Users</h3>
                                    {users.slice(0, 5).map((u) => (
                                        <div key={u.uid} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-3)',
                                            padding: 'var(--space-2) 0',
                                            borderBottom: '1px solid var(--border-subtle)',
                                        }}>
                                            <div className="avatar">
                                                {(u.displayName?.[0] || u.email?.[0] || 'U').toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{u.displayName}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{u.email}</div>
                                            </div>
                                            <span className="badge badge-primary">{u.role}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="glass-card">
                                    <h3 style={{ marginBottom: 'var(--space-4)' }}>Quick Actions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        <Link href="/resources/new" className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>
                                            ➕ Add Resource
                                        </Link>
                                        <Link href="/admin" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}
                                            onClick={() => setActiveTab('users')}>
                                            👥 Manage Users
                                        </Link>
                                        <Link href="/admin" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}
                                            onClick={() => setActiveTab('resources')}>
                                            📚 Manage Resources
                                        </Link>
                                        <Link href="/admin/audit/youtube" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                                            📺 YouTube Audit Tool
                                        </Link>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{ justifyContent: 'flex-start', width: '100%', textAlign: 'left' }}
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
