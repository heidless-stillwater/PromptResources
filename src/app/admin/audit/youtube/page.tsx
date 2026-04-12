'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Resource } from '@/lib/types';
import { isYouTubeUrl, fetchYouTubeMetadata, isGenericYouTubeName } from '@/lib/youtube';
import { Icons } from '@/components/ui/Icons';

interface AuditItem {
    resource: Resource;
    currentName: string;
    suggestedName?: string;
    status: 'pending' | 'checking' | 'ready' | 'fixing' | 'fixed' | 'error' | 'skipped';
    error?: string;
}

export default function YouTubeAuditPage() {
    return (
        <Suspense fallback={
            <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initialising Command</div>
                </div>
            </div>
        }>
            <YouTubeAuditContent />
        </Suspense>
    );
}

function YouTubeAuditContent() {
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
            <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initialising Audit Engine</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] text-white selection:bg-indigo-500/30">
            <Navbar />

            {/* Cinematic Hero */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-900/10 via-[#0a0a0f] to-[#0a0a0f]" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] -mr-48 -mt-48" />
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div className="flex flex-col">
                            <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                Registry Intelligence / Audit / Youtube
                            </div>
                            <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white leading-none">
                                Youtube <span className="text-rose-500 font-black">Audit</span>
                            </h1>
                            <p className="text-white/40 font-medium max-w-xl mt-4 leading-relaxed">
                                System-wide reconciliation of generic video attributions. Identifying missing creator identities across the discovery cloud.
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-3">
                            <Link href="/admin" className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 transition-all active:scale-95 flex items-center gap-2">
                                <Icons.arrowLeft size={14} /> Authority Hub
                            </Link>
                            <button
                                className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 transition-all active:scale-95 flex items-center gap-2"
                                onClick={runAudit}
                                disabled={isAuditing || auditItems.every(i => i.status !== 'pending')}
                            >
                                <Icons.search size={14} /> Scan Channels
                            </button>
                            <button
                                className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all active:scale-95 flex items-center gap-2"
                                onClick={fixAll}
                                disabled={isAuditing || !auditItems.some(i => i.status === 'ready')}
                            >
                                <Icons.zap size={14} /> Reconclie All
                            </button>
                        </div>
                    </div>

                    {/* Integrated Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { label: 'Video Resources', value: stats.youtube, icon: <Icons.video size={14} /> },
                            { label: 'Identified Signals', value: auditItems.filter(i => i.status === 'ready' || i.status === 'pending').length, icon: <Icons.activity size={14} />, color: 'text-rose-400' },
                            { label: 'System Fixed', value: stats.fixed, icon: <Icons.check size={14} />, color: 'text-emerald-400' }
                        ].map((stat, i) => (
                            <div key={i} className="glass-card p-5 group hover:border-white/20 transition-all cursor-default relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-rose-500/10 transition-all" />
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

            <main className="container mx-auto px-4 -mt-20 pb-20 relative z-30">
                <div className="glass-card overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5">
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Target Resource</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Generic Metadata</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Found Identity</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30">Engine Status</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Operational Tool</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {auditItems.map((item, idx) => (
                                    <tr key={item.resource.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="text-sm font-black mb-1 group-hover:text-rose-400 transition-colors">{item.resource.title}</div>
                                            <div className="text-[9px] font-black text-white/10 uppercase tracking-widest truncate max-w-[400px]">
                                                {item.resource.url}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isGenericYouTubeName(item.currentName) ? 'bg-rose-500/10 text-rose-400' : 'bg-white/10 text-white/40'}`}>
                                                {item.currentName}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <div className="text-xs font-black text-rose-400 uppercase tracking-widest">
                                                {item.suggestedName || (item.status === 'checking' ? '...' : '-')}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                {item.status === 'pending' && <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Queue</span>}
                                                {item.status === 'checking' && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">Checking</span>}
                                                {item.status === 'ready' && <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">Ready</span>}
                                                {item.status === 'fixing' && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">Fixing</span>}
                                                {item.status === 'fixed' && <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Reconciled</span>}
                                                {item.status === 'error' && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest" title={item.error}>Signal Error</span>}
                                                {item.status === 'skipped' && <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">Inactive</span>}
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            {item.status === 'ready' && (
                                                <button 
                                                    className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95" 
                                                    onClick={() => fixItem(idx)}
                                                >
                                                    Fix Signal
                                                </button>
                                            )}
                                            {item.status === 'error' && (
                                                <button 
                                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95" 
                                                    onClick={() => {
                                                        const items = [...auditItems];
                                                        items[idx].status = 'pending';
                                                        setAuditItems(items);
                                                    }}
                                                >
                                                    Retry
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {auditItems.length === 0 && !loading && (
                    <div className="py-40 text-center glass-card border-dashed">
                        <Icons.video size={48} className="mx-auto mb-6 text-white/10" />
                        <p className="font-black text-[10px] uppercase tracking-[0.4em] text-white/20">No video signals found in registry</p>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
