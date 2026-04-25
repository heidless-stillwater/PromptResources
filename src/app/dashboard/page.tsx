'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Resource, UserResourceData } from '@/lib/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icons } from '@/components/ui/Icons';
import ManageSubscriptionButton from '@/components/ManageSubscriptionButton';
import { ComplianceCenter } from '@/components/ComplianceCenter';

import { Suspense } from 'react';

function DashboardContent() {
    const { user, profile, loading: authLoading, activeRole } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isSubscribedSuccess = searchParams.get('subscribed') === 'true';
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
            const token = await user?.getIdToken();
            const res = await fetch(`/api/user-resources?uid=${user?.uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
            const token = await user?.getIdToken();
            const fetched: Resource[] = [];
            for (const id of [...savedIds].reverse().slice(0, 4)) {
                try {
                    const res = await fetch(`/api/resources/${id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
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
            const token = await user?.getIdToken();
            const res = await fetch('/api/resources?pageSize=1', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            return result.success ? result.total : 0;
        },
        enabled: !!user,
    });

    // Fetch global pending reviews for admins
    const { data: globalPendingCount = 0 } = useQuery({
        queryKey: ['global-pending-count'],
        queryFn: async () => {
            const token = await user?.getIdToken();
            const res = await fetch('/api/resources?status=suggested,pending&pageSize=1', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            return result.success ? result.total : 0;
        },
        enabled: !!user && activeRole === 'admin',
    });

    // Fetch user contributions
    const { data: myAddedResources = [], isLoading: contributionsLoading } = useQuery({
        queryKey: ['my-contributions', user?.uid],
        queryFn: async () => {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/resources?addedBy=${user?.uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
            const token = await user.getIdToken();
            const response = await fetch('/api/user-resources', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
        <div className="page-wrapper dashboard-theme">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    {/* Success Banner */}
                    {isSubscribedSuccess && (
                        <div className="glass-card" style={{ 
                            marginBottom: 'var(--space-6)', 
                            background: 'rgba(16,185,129,0.1)', 
                            border: '1px solid rgba(16,185,129,0.3)',
                            padding: 'var(--space-4) var(--space-6)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            animation: 'fade-in 0.5s ease-out'
                        }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                <Icons.check size={24} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Welcome to the Master Suite! 🚀</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Your subscription is now active. Explore all products below.</div>
                            </div>
                            <button 
                                onClick={() => {
                                    const params = new URLSearchParams(window.location.search);
                                    params.delete('subscribed');
                                    router.replace(`/dashboard?${params.toString()}`);
                                }}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <Icons.close size={20} />
                            </button>
                        </div>
                    )}

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
                                    ⚙️ Control Hub
                                </Link>
                            )}
                            <span className={`badge badge-${(profile?.subscription?.status === 'active' || profile?.subscriptionType === 'pro') ? 'accent' : profile?.subscriptionType === 'standard' ? 'primary' : 'success'}`}>
                                {profile?.subscription?.status === 'active' 
                                    ? (profile.subscription.bundleId?.toUpperCase() || 'MASTER SUITE') 
                                    : (profile?.subscriptionType === 'pro' ? 'PRO' : profile?.subscriptionType?.toUpperCase() || 'FREE')} Plan
                            </span>
                            <span className="badge badge-primary">
                                {activeRole?.toUpperCase() || 'MEMBER'}
                            </span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
                        {activeRole === 'admin' ? (
                            <>
                                <div className="glass-card stat-card highlight-border">
                                    <div className="stat-value">{totalResources}</div>
                                    <div className="stat-label">Total Resources</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{globalPendingCount}</div>
                                    <div className="stat-label">Pending Reviews</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{userResData?.savedResources?.length || 0}</div>
                                    <div className="stat-label">My Collections</div>
                                </div>
                                <div className="glass-card stat-card">
                                    <div className="stat-value">{completedCount}</div>
                                    <div className="stat-label">My Progress</div>
                                </div>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
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

                        <Link href="/resources/new" className="highlight-card" style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            padding: 'var(--space-5)',
                        }}>
                            <div className="pulse-target" style={{ fontSize: '2rem' }}>➕</div>
                            <div>
                                <div style={{ fontWeight: 800, color: 'white' }}>Add New Resource</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255, 255, 255, 0.8)' }}>Contribute to the community</div>
                            </div>
                        </Link>
                    </div>

                    {/* Sovereign Compliance Registry */}
                    <div style={{ marginBottom: 'var(--space-8)' }}>
                        <ComplianceCenter />
                    </div>

                    {/* Subscription Suite Card */}
                    {(profile?.subscription?.status === 'active' || profile?.subscriptionType === 'pro') ? (
                        <div className="glass-card" style={{ marginBottom: 'var(--space-8)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%)', border: '1px solid rgba(99,102,241,0.3)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', zIndex: 0, filter: 'blur(30px)' }}></div>
                            
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary-400)', marginBottom: 'var(--space-1)' }}>
                                            Premium Platform Access
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                                            {profile.subscription?.bundleId || (profile.subscriptionType === 'pro' ? 'Pro Architect' : 'Master Suite')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                        <span className="badge badge-accent" style={{ fontSize: '10px', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>✅ SUBSCRIPTION ACTIVE</span>
                                        <ManageSubscriptionButton 
                                            label="Manage Billing →" 
                                            style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }} 
                                        />
                                    </div>
                                </div>
 
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                                    {[
                                        { suite: 'resources', label: 'Stillwater Resources', description: 'Elite library of prompt engineering & AI blueprints.', emoji: '📚', href: '/resources' },
                                        { suite: 'studio', label: 'Stillwater Studio', description: 'Multi-modal content generation engine.', emoji: '🎨', href: 'http://localhost:3001/generate' },
                                        { suite: 'prompttool', label: 'PromptTool', description: 'Advanced prompt refining & testing environment.', emoji: '✨', href: 'http://localhost:3001/generate' },
                                        { suite: 'registry', label: 'Stillwater Registry', description: 'Private organizational blueprint management.', emoji: '📋', href: 'http://localhost:5173' },
                                    ].map(({ suite, label, description, emoji, href }) => {
                                        const isCurrentApp = suite === 'resources';
                                        
                                        const activeSuites = profile.subscription?.activeSuites || [];
                                        const hasAccess = 
                                            activeSuites.includes(suite) || 
                                            profile.subscriptionType === 'pro' ||
                                            (suite === 'resources' && (activeSuites.includes('promptresources') || profile.subscription?.status === 'active')) ||
                                            (suite === 'prompttool' && activeSuites.includes('studio')) ||
                                            (suite === 'studio' && activeSuites.includes('prompttool'));
                                        
                                        return (
                                            <a
                                                key={suite}
                                                href={hasAccess ? href : '/pricing'}
                                                target={href.startsWith('http') ? '_blank' : undefined}
                                                rel="noreferrer"
                                                className={`suite-tile ${hasAccess ? 'active' : 'locked'} ${isCurrentApp ? 'current' : ''}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-4)',
                                                    padding: 'var(--space-4)',
                                                    borderRadius: 'var(--radius-lg)',
                                                    background: isCurrentApp ? 'rgba(99,102,241,0.08)' : hasAccess ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.2)',
                                                    border: `1px solid ${isCurrentApp ? 'var(--primary-500)' : hasAccess ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                                    textDecoration: 'none',
                                                    color: 'inherit',
                                                    transition: 'all 0.2s ease',
                                                    position: 'relative',
                                                    boxShadow: isCurrentApp ? '0 0 20px rgba(99,102,241,0.15)' : 'none'
                                                }}
                                            >
                                                <div style={{ 
                                                    width: '48px', 
                                                    height: '48px', 
                                                    borderRadius: '12px', 
                                                    background: isCurrentApp ? 'var(--primary-500)' : hasAccess ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.5rem',
                                                    border: `1px solid ${hasAccess || isCurrentApp ? 'rgba(99,102,241,0.2)' : 'transparent'}`,
                                                    color: isCurrentApp ? 'white' : 'inherit'
                                                }}>
                                                    {emoji}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: isCurrentApp || hasAccess ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</div>
                                                        {isCurrentApp && (
                                                            <span style={{ fontSize: '8px', fontWeight: 900, background: 'var(--primary-500)', color: 'white', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current App</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{description}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: isCurrentApp || hasAccess ? 'var(--success-400)' : 'var(--text-muted)' }}>
                                                        {isCurrentApp ? '✓ Active & Current' : hasAccess ? '✓ Unlocked' : '🔒 Upgrade to Unlock'}
                                                    </div>
                                                </div>
                                                {hasAccess && (
                                                    <div style={{ color: 'var(--primary-400)', opacity: 0.5 }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                                                    </div>
                                                )}
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card" style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>💎 Free Plan</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Upgrade to unlock Studio, PromptTool &amp; the full Registry.</div>
                            </div>
                            <Link href="/pricing" className="btn btn-primary btn-sm">Upgrade →</Link>
                        </div>
                    )}

                    {/* Saved Resources */}
                    <div style={{ 
                        marginBottom: 'var(--space-4)',
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
                        <div className="expandable-section animate-slide-down">
                            {loading ? (
                                <div className="loading-page" style={{ minHeight: '200px' }}>
                                    <div className="spinner" />
                                </div>
                            ) : savedResources.length === 0 ? (
                                <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>📭</div>
                                    <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>No saved resources yet</div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>Browse resources and save your favorites for quick access</p>
                                    <Link href="/resources" className="btn btn-primary">Browse Resources</Link>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {savedResources.map((resource) => (
                                        <Link href={`/resources/${resource.id}`} key={resource.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', textDecoration: 'none', color: 'inherit' }}>
                                            <div style={{ fontSize: '1.5rem' }}>{resource.mediaFormat === 'youtube' ? '▶️' : resource.type === 'article' ? '📄' : resource.type === 'tool' ? '🔧' : '📚'}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{resource.title}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                                                    <span className={`badge badge-${resource.pricing}`} style={{ fontSize: '0.65rem' }}>{resource.pricing}</span>
                                                    <span>{resource.platform}</span>
                                                </div>
                                            </div>
                                            <button className="btn btn-ghost btn-sm" onClick={(e) => handleUnsave(e, resource.id)} style={{ color: 'var(--text-muted)' }} title="Remove from saved">✕</button>
                                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>→</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* My Contributions */}
                    <div style={{ 
                        marginBottom: 'var(--space-4)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 'var(--space-8)'
                    }}>
                        <div 
                            onClick={() => setContributionsExpanded(!contributionsExpanded)}
                            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', gap: 'var(--space-2)' }}
                        >
                            <span style={{ 
                                transform: contributionsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform var(--transition-fast)',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)'
                            }}>▶</span>
                            <h2 style={{ marginBottom: 0 }}>📝 My Contributions</h2>
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{myAddedResources.length}</span>
                        </div>
                        <Link href="/resources/new" className="btn btn-primary btn-sm">+ Suggest New</Link>
                    </div>

                    {contributionsExpanded && (
                        <div className="expandable-section animate-slide-down">
                            {loading ? (
                                <div className="loading-page" style={{ minHeight: '200px' }}>
                                    <div className="spinner" />
                                </div>
                            ) : myAddedResources.length === 0 ? (
                                <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>You haven&apos;t suggested any resources yet. Contribute to the community!</p>
                                    <Link href="/resources/new" className="btn btn-ghost">Suggest a Resource</Link>
                                </div>
                            ) : (
                                <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: '420px', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
                                    {myAddedResources.map((resource) => (
                                        <div key={resource.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                            <div style={{ fontSize: '1.5rem' }}>{resource.mediaFormat === 'youtube' ? '▶️' : resource.type === 'article' ? '📄' : resource.type === 'tool' ? '🔧' : '📚'}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{resource.title}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-1)', alignItems: 'center' }}>
                                                    <span className={`badge badge-${resource.status === 'published' ? 'success' : resource.status === 'suggested' ? 'warning' : 'secondary'}`} style={{ fontSize: '0.6rem' }}>{resource.status?.toUpperCase() || 'PENDING'}</span>
                                                    <span>{resource.platform}</span>
                                                    <span>{new Date(resource.updatedAt || resource.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <Link href={`/resources/${resource.id}`} className="btn btn-ghost btn-sm">View</Link>
                                                <Link href={`/resources/${resource.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Account Info */}
                    <div className="glass-card" style={{ marginTop: 'var(--space-8)' }}>
                        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>👤 Account Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
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
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                    <div className="loading-text">Initializing Secure Session...</div>
                </div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
