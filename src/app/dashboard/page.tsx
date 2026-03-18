'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Resource, UserResourceData } from '@/lib/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function DashboardPage() {
    const { user, profile, loading: authLoading, activeRole } = useAuth();
    const router = useRouter();
    const [savedExpanded, setSavedExpanded] = useState(false);
    const [contributionsExpanded, setContributionsExpanded] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    // Fetch user progress and saved IDs
    const { data: userResData, isLoading: userResLoading } = useQuery({
        queryKey: ['user-resources', user?.uid],
        queryFn: async () => {
            const res = await fetch(`/api/user-resources?uid=${user?.uid}`);
            const result = await res.json();
            return result.success ? (result.data as UserResourceData) : null;
        },
        enabled: !!user,
    });

    const savedIds = userResData?.savedResources || [];

    // Fetch details for first 4 saved resources
    const { data: savedResources = [], isLoading: savedResLoading } = useQuery({
        queryKey: ['saved-resources-details', savedIds.slice(0, 4)],
        queryFn: async () => {
            const fetched: Resource[] = [];
            for (const id of [...savedIds].reverse().slice(0, 4)) {
                try {
                    const res = await fetch(`/api/resources/${id}`);
                    const result = await res.json();
                    if (result.success) fetched.push(result.data);
                } catch (err) {
                    console.error(`Error fetching resource ${id}:`, err);
                }
            }
            return fetched;
        },
        enabled: savedIds.length > 0,
    });

    // Fetch total resources count
    const { data: totalResources = 0 } = useQuery({
        queryKey: ['total-resources-count'],
        queryFn: async () => {
            const res = await fetch('/api/resources?pageSize=1');
            const result = await res.json();
            return result.success ? result.total : 0;
        },
        enabled: !!user,
    });

    // Fetch user contributions
    const { data: myAddedResources = [], isLoading: contributionsLoading } = useQuery({
        queryKey: ['my-contributions', user?.uid],
        queryFn: async () => {
            const res = await fetch(`/api/resources?addedBy=${user?.uid}`);
            const result = await res.json();
            return result.success ? (result.data as Resource[]) : [];
        },
        enabled: !!user,
    });

    const loading = userResLoading || savedResLoading || contributionsLoading;

    const queryClient = useQueryClient();

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
                // Invalidate relevant queries to refetch data
                queryClient.invalidateQueries({ queryKey: ['user-resources', user.uid] });
                queryClient.invalidateQueries({ queryKey: ['saved-resources-details'] });
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
                                        <Image
                                            src={profile.photoURL}
                                            alt={profile.displayName || ''}
                                            fill
                                            sizes="64px"
                                            style={{ objectFit: 'cover', borderRadius: '50%' }}
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
                            {activeRole === 'admin' && (
                                <Link href="/admin" className="btn btn-ghost" style={{ marginRight: 'var(--space-2)' }}>
                                    ⚙️ Admin Panel
                                </Link>
                            )}
                            <span className={`badge badge-${profile?.subscriptionType === 'pro' ? 'accent' : profile?.subscriptionType === 'standard' ? 'primary' : 'success'}`}>
                                {profile?.subscriptionType?.toUpperCase() || 'FREE'} Plan
                            </span>
                            <span className="badge badge-primary">
                                {activeRole?.toUpperCase() || 'MEMBER'}
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
                            <div className="stat-value">{myAddedResources.length}</div>
                            <div className="stat-label">Contributions</div>
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

                        <Link href="/resources/new" className="glass-card" style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            padding: 'var(--space-5)',
                            border: '1px solid var(--primary-500)',
                            background: 'rgba(99, 102, 241, 0.05)',
                        }}>
                            <div style={{ fontSize: '2rem' }}>➕</div>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--primary-400)' }}>Add New Resource</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Contribute to the community</div>
                            </div>
                        </Link>
                    </div>

                    <div style={{ 
                        marginBottom: 'var(--space-4)', // Reduced from space-8 to group header and content better
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div 
                            onClick={() => setSavedExpanded(!savedExpanded)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                cursor: 'pointer',
                                userSelect: 'none',
                                gap: 'var(--space-2)'
                            }}
                        >
                            <span style={{ 
                                transform: savedExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform var(--transition-fast)',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)'
                            }}>▶</span>
                            <h2 style={{ marginBottom: 0 }}>⭐ Saved Resources</h2>
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                {savedResources.length}
                            </span>
                        </div>
                        {savedResources.length > 0 && (
                            <Link href="/dashboard/saved" className="btn btn-ghost btn-sm">
                                View All →
                            </Link>
                        )}
                    </div>

                        {savedExpanded && (
                            loading ? (
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', animation: 'slideDown var(--transition-base)' }}>
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
                            )
                        )}
                    
                    {/* My Contributions */}
                    <div style={{ 
                        marginBottom: 'var(--space-4)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 'var(--space-8)' // Keep space-8 as margin top for consistency
                    }}>
                        <div 
                            onClick={() => setContributionsExpanded(!contributionsExpanded)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                cursor: 'pointer',
                                userSelect: 'none',
                                gap: 'var(--space-2)'
                            }}
                        >
                            <span style={{ 
                                transform: contributionsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform var(--transition-fast)',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)'
                            }}>▶</span>
                            <h2 style={{ marginBottom: 0 }}>📝 My Contributions</h2>
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                {myAddedResources.length}
                            </span>
                        </div>
                        <Link href="/resources/new" className="btn btn-primary btn-sm">
                            + Suggest New
                        </Link>
                    </div>

                        {contributionsExpanded && (
                            loading ? (
                                <div className="loading-page" style={{ minHeight: '200px' }}>
                                    <div className="spinner" />
                                </div>
                            ) : myAddedResources.length === 0 ? (
                                <div className="glass-card" style={{
                                    textAlign: 'center',
                                    padding: 'var(--space-10)',
                                }}>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                                        You haven&apos;t suggested any resources yet. Contribute to the community!
                                    </p>
                                    <Link href="/resources/new" className="btn btn-ghost">
                                        Suggest a Resource
                                    </Link>
                                </div>
                            ) : (
                                <div className="custom-scrollbar" style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: 'var(--space-3)',
                                    maxHeight: '420px',
                                    overflowY: 'auto',
                                    paddingRight: 'var(--space-2)',
                                    animation: 'slideDown var(--transition-base)'
                                }}>
                                    {myAddedResources.map((resource) => (
                                        <div
                                            key={resource.id}
                                            className="card"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-4)',
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
                                                    gap: 'var(--space-3)',
                                                    marginTop: 'var(--space-1)',
                                                    alignItems: 'center'
                                                }}>
                                                    <span className={`badge badge-${resource.status === 'published' ? 'success' : resource.status === 'suggested' ? 'warning' : 'secondary'}`} style={{ fontSize: '0.6rem' }}>
                                                        {resource.status?.toUpperCase() || 'PENDING'}
                                                    </span>
                                                    <span>{resource.platform}</span>
                                                    <span>{new Date(resource.updatedAt || resource.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <Link href={`/resources/${resource.id}`} className="btn btn-ghost btn-sm">
                                                    View
                                                </Link>
                                                <Link href={`/resources/${resource.id}/edit`} className="btn btn-secondary btn-sm">
                                                    Edit
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    
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
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{profile?.role?.toUpperCase() || 'MEMBER'}</div>
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
