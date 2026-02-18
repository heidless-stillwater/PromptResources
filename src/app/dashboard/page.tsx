'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Resource, UserResourceData } from '@/lib/types';

export default function DashboardPage() {
    const { user, profile, loading: authLoading, activeRole } = useAuth();
    const router = useRouter();
    const [savedResources, setSavedResources] = useState<Resource[]>([]);
    const [userResData, setUserResData] = useState<UserResourceData | null>(null);
    const [totalResources, setTotalResources] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        async function fetchDashboardData() {
            if (!user) return;
            try {
                // Fetch user resource data via API
                const userResResponse = await fetch(`/api/user-resources?uid=${user.uid}`);
                const userResResult = await userResResponse.json();

                let savedIds: string[] = [];
                if (userResResult.success) {
                    const data = userResResult.data as UserResourceData;
                    setUserResData(data);
                    savedIds = data.savedResources || [];
                }

                // Fetch saved resources details via API
                if (savedIds.length > 0) {
                    const resourcePromises = savedIds.slice(0, 10).map(async (id) => {
                        try {
                            const res = await fetch(`/api/resources/${id}`);
                            const result = await res.json();
                            return result.success ? result.data : null;
                        } catch (err) {
                            return null;
                        }
                    });
                    const resources = (await Promise.all(resourcePromises)).filter(Boolean) as Resource[];
                    setSavedResources(resources);
                }

                // Get total resources count via API
                const allResResponse = await fetch('/api/resources?pageSize=1');
                const allResResult = await allResResponse.json();
                if (allResResult.success) {
                    setTotalResources(allResResult.total);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchDashboardData();
    }, [user]);

    const handleUnsave = async (e: React.MouseEvent, resourceId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) return;

        try {
            const response = await fetch('/api/user-resources', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    resourceId,
                    action: 'unsave'
                }),
            });

            const result = await response.json();
            if (result.success) {
                // Remove from local state
                setSavedResources(savedResources.filter(r => r.id !== resourceId));
                if (userResData) {
                    setUserResData({
                        ...userResData,
                        savedResources: userResData.savedResources.filter(id => id !== resourceId)
                    });
                }
            }
        } catch (error) {
            console.error('Error unsaving resource:', error);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                    <div className="loading-text">Loading dashboard...</div>
                </div>
            </div>
        );
    }

    const completedCount = userResData
        ? Object.values(userResData.progress || {}).filter((s) => s === 'completed').length
        : 0;

    const inProgressCount = userResData
        ? Object.values(userResData.progress || {}).filter((s) => s === 'in-progress').length
        : 0;

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    {/* Welcome Header */}
                    <div style={{
                        marginBottom: 'var(--space-8)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                                {profile?.photoURL ? (
                                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                        <img
                                            src={profile.photoURL}
                                            alt={profile.displayName}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                        />
                                    </div>
                                ) : (
                                    (profile?.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
                                )}
                            </div>
                            <div>
                                <h1 style={{ marginBottom: 'var(--space-2)' }}>
                                    Welcome, {profile?.displayName || 'User'} 👋
                                </h1>
                                <p style={{ color: 'var(--text-muted)' }}>
                                    Here&apos;s your learning progress overview
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <span className={`badge badge-${profile?.subscriptionType === 'pro' ? 'accent' : profile?.subscriptionType === 'standard' ? 'primary' : 'success'}`}>
                                {profile?.subscriptionType?.toUpperCase() || 'FREE'} Plan
                            </span>
                            <span className="badge badge-primary">
                                {activeRole.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{userResData?.savedResources?.length || 0}</div>
                            <div className="stat-label">Saved Resources</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{completedCount}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{inProgressCount}</div>
                            <div className="stat-label">In Progress</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{totalResources}</div>
                            <div className="stat-label">Total Available</div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-8)',
                    }}>
                        <Link href="/resources" className="glass-card" style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            padding: 'var(--space-5)',
                        }}>
                            <div style={{ fontSize: '2rem' }}>📚</div>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Browse Resources</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Discover new AI prompt resources</div>
                            </div>
                        </Link>

                        <Link href="/categories" className="glass-card" style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            padding: 'var(--space-5)',
                        }}>
                            <div style={{ fontSize: '2rem' }}>🏷️</div>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Categories</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Browse by topic</div>
                            </div>
                        </Link>

                        <Link href="/pricing" className="glass-card" style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            padding: 'var(--space-5)',
                        }}>
                            <div style={{ fontSize: '2rem' }}>💎</div>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Upgrade Plan</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Get more features</div>
                            </div>
                        </Link>
                    </div>

                    {/* Saved Resources */}
                    <div style={{ marginBottom: 'var(--space-8)' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-5)',
                        }}>
                            <h2>⭐ Saved Resources</h2>
                            {savedResources.length > 0 && (
                                <Link href="/dashboard/saved" className="btn btn-ghost">
                                    View All →
                                </Link>
                            )}
                        </div>

                        {loading ? (
                            <div className="loading-page" style={{ minHeight: '200px' }}>
                                <div className="spinner" />
                            </div>
                        ) : savedResources.length === 0 ? (
                            <div className="glass-card" style={{
                                textAlign: 'center',
                                padding: 'var(--space-10)',
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>📭</div>
                                <div style={{
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600,
                                    marginBottom: 'var(--space-2)',
                                }}>
                                    No saved resources yet
                                </div>
                                <p style={{
                                    color: 'var(--text-muted)',
                                    fontSize: 'var(--text-sm)',
                                    marginBottom: 'var(--space-4)',
                                }}>
                                    Browse resources and save your favorites for quick access
                                </p>
                                <Link href="/resources" className="btn btn-primary">
                                    Browse Resources
                                </Link>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {savedResources.map((resource) => (
                                    <Link
                                        href={`/resources/${resource.id}`}
                                        key={resource.id}
                                        className="card"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-4)',
                                            textDecoration: 'none',
                                            color: 'inherit',
                                        }}
                                    >
                                        <div style={{ fontSize: '1.5rem' }}>
                                            {resource.mediaFormat === 'youtube' ? '▶️' :
                                                resource.type === 'article' ? '📄' :
                                                    resource.type === 'tool' ? '🔧' : '📚'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                                {resource.title}
                                            </div>
                                            <div style={{
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--text-muted)',
                                                display: 'flex',
                                                gap: 'var(--space-2)',
                                                marginTop: 'var(--space-1)',
                                            }}>
                                                <span className={`badge badge-${resource.pricing}`} style={{ fontSize: '0.65rem' }}>{resource.pricing}</span>
                                                <span>{resource.platform}</span>
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={(e) => handleUnsave(e, resource.id)}
                                            style={{ color: 'var(--text-muted)' }}
                                            title="Remove from saved"
                                        >
                                            ✕
                                        </button>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>→</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Account Info */}
                    <div className="glass-card">
                        <h3 style={{
                            fontSize: 'var(--text-lg)',
                            marginBottom: 'var(--space-5)',
                            paddingBottom: 'var(--space-3)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            👤 Account Details
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 'var(--space-4)',
                        }}>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Email</div>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{user.email}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Role</div>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{profile?.role?.toUpperCase()}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Subscription</div>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{profile?.subscriptionType?.toUpperCase() || 'FREE'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Member Since</div>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
