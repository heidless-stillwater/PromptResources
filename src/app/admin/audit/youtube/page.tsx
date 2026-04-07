'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Resource, Attribution } from '@/lib/types';
import { isYouTubeUrl, fetchYouTubeMetadata, isGenericYouTubeName } from '@/lib/youtube';

interface AuditItem {
    resource: Resource;
    currentName: string;
    suggestedName?: string;
    status: 'pending' | 'checking' | 'ready' | 'fixing' | 'fixed' | 'error' | 'skipped';
    error?: string;
}

export default function YouTubeAuditPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuditing, setIsAuditing] = useState(false);
    const [stats, setStats] = useState({ total: 0, youtube: 0, needsFix: 0, fixed: 0 });

    useEffect(() => {
        if (!authLoading && (!user || !isAdmin)) {
            router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    useEffect(() => {
        async function fetchResources() {
            try {
                const response = await fetch('/api/resources?pageSize=1000');
                const result = await response.json();

                if (result.success) {
                    const allResources = result.data as Resource[];
                    const ytResources = allResources.filter(r => isYouTubeUrl(r.url));

                    const items: AuditItem[] = ytResources.map(r => {
                        const ytAttribution = r.attributions?.find(c => isGenericYouTubeName(c.name));

                        return {
                            resource: r,
                            currentName: ytAttribution?.name || 'Unknown',
                            status: ytAttribution ? 'pending' : 'skipped'
                        };
                    });

                    setAuditItems(items);
                    setStats({
                        total: allResources.length,
                        youtube: ytResources.length,
                        needsFix: items.filter(i => i.status === 'pending').length,
                        fixed: 0
                    });
                }
            } catch (error) {
                console.error('Error fetching resources:', error);
            } finally {
                setLoading(false);
            }
        }
        if (user && isAdmin) fetchResources();
    }, [user, isAdmin]);

    const runAudit = async () => {
        setIsAuditing(true);
        const newItems = [...auditItems];

        for (let i = 0; i < newItems.length; i++) {
            if (newItems[i].status !== 'pending') continue;

            newItems[i].status = 'checking';
            setAuditItems([...newItems]);

            try {
                const metadata = await fetchYouTubeMetadata(newItems[i].resource.url);
                if (metadata && metadata.author_name) {
                    newItems[i].suggestedName = metadata.author_name;
                    newItems[i].status = 'ready';
                } else {
                    newItems[i].status = 'error';
                    newItems[i].error = 'Could not fetch metadata';
                }
            } catch (err) {
                newItems[i].status = 'error';
                newItems[i].error = 'Fetch failed';
            }
            setAuditItems([...newItems]);
        }
        setIsAuditing(false);
    };

    const fixItem = async (index: number) => {
        const item = auditItems[index];
        if (!item.suggestedName) return;

        const updatedItems = [...auditItems];
        updatedItems[index].status = 'fixing';
        setAuditItems(updatedItems);

        try {
            const updatedAttributions = item.resource.attributions.map(c => {
                if (isGenericYouTubeName(c.name)) {
                    return { ...c, name: item.suggestedName! };
                }
                return c;
            });

            const response = await fetch(`/api/resources/${item.resource.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attributions: updatedAttributions })
            });

            const result = await response.json();
            if (result.success) {
                updatedItems[index].status = 'fixed';
                setStats(prev => ({ ...prev, fixed: prev.fixed + 1 }));
            } else {
                updatedItems[index].status = 'error';
                updatedItems[index].error = result.error || 'Update failed';
            }
        } catch (err) {
            updatedItems[index].status = 'error';
            updatedItems[index].error = 'Network error';
        }
        setAuditItems([...updatedItems]);
    };

    const fixAll = async () => {
        const readyIndices = auditItems
            .map((item, idx) => item.status === 'ready' ? idx : -1)
            .filter(idx => idx !== -1);

        for (const idx of readyIndices) {
            await fixItem(idx);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page"><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <Link href="/admin" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-2)' }}>
                                ← Back to Admin
                            </Link>
                            <h1>📺 YouTube Resource Audit</h1>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={runAudit}
                                disabled={isAuditing || auditItems.every(i => i.status !== 'pending')}
                            >
                                🔍 Scan Channels
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={fixAll}
                                disabled={isAuditing || !auditItems.some(i => i.status === 'ready')}
                            >
                                ✨ Fix All Ready
                            </button>
                        </div>
                    </div>

                    <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{stats.youtube}</div>
                            <div className="stat-label">YouTube Resources</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{auditItems.filter(i => i.status === 'ready' || i.status === 'pending').length}</div>
                            <div className="stat-label">Potential Fixes</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-value">{stats.fixed}</div>
                            <div className="stat-label">Fixed Today</div>
                        </div>
                    </div>

                    <div className="glass-card">
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Resource</th>
                                        <th>Current Attribution</th>
                                        <th>Suggested Channel</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditItems.map((item, idx) => (
                                        <tr key={item.resource.id}>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.resource.title}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.resource.url}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${isGenericYouTubeName(item.currentName) ? 'badge-accent' : ''}`}>
                                                    {item.currentName}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--success-400)', fontWeight: 600 }}>
                                                {item.suggestedName || '-'}
                                            </td>
                                            <td>
                                                {item.status === 'pending' && <span className="badge">Pending Scan</span>}
                                                {item.status === 'checking' && <span className="badge">Checking...</span>}
                                                {item.status === 'ready' && <span className="badge badge-success">Ready to Fix</span>}
                                                {item.status === 'fixing' && <span className="badge">Fixing...</span>}
                                                {item.status === 'fixed' && <span className="badge badge-primary">✅ Fixed</span>}
                                                {item.status === 'error' && <span className="badge badge-danger" title={item.error}>⚠️ Error</span>}
                                                {item.status === 'skipped' && <span className="badge">Skipped</span>}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {item.status === 'ready' && (
                                                    <button className="btn btn-primary btn-sm" onClick={() => fixItem(idx)}>
                                                        Apply Fix
                                                    </button>
                                                )}
                                                {item.status === 'error' && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => {
                                                        const items = [...auditItems];
                                                        items[idx].status = 'pending';
                                                        setAuditItems(items);
                                                    }}>
                                                        Retry
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {auditItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-muted)' }}>
                                                No YouTube resources found to audit.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
