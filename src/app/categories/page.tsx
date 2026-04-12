'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Modal from '@/components/Modal';
import { Icons } from '@/components/ui/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { Category, ApiResponse } from '@/lib/types';

export default function CategoriesPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // CRUD States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({ name: '', slug: '', description: '', icon: '📂' });
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch both categories and resources to get counts
            const [catRes, resRes] = await Promise.all([
                fetch('/api/categories'),
                fetch('/api/resources?pageSize=2000') // Get all for counts
            ]);

            const catsData = await catRes.json() as ApiResponse<Category[]>;
            const resourcesData = await resRes.json();

            if (catsData.success && resourcesData.success) {
                const resources = resourcesData.data;
                const dbCats = catsData.data || [];
                
                // Calculate counts from resources
                const countsMap = new Map<string, { total: number; free: number }>();
                resources.forEach((r: any) => {
                    (r.categories || []).forEach((c: string) => {
                        const normalized = c.trim();
                        const current = countsMap.get(normalized) || { total: 0, free: 0 };
                        current.total++;
                        if (r.pricing === 'free') current.free++;
                        countsMap.set(normalized, current);
                    });
                });

                // Merge counts into categories
                const enrichedCats = dbCats.map(cat => ({
                    ...cat,
                    count: countsMap.get(cat.name)?.total || 0,
                    freeCount: countsMap.get(cat.name)?.free || 0
                }));

                setCategories(enrichedCats.sort((a, b) => (b.count || 0) - (a.count || 0)));
            }
        } catch (err) {
            console.error('Failed to fetch:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredCategories = useMemo(() => {
        return categories.filter(c => 
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.description?.toLowerCase().includes(search.toLowerCase())
        );
    }, [categories, search]);

    const handleSelectAll = () => {
        if (selectedIds.size === filteredCategories.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCategories.map(c => c.id)));
        }
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setIsAddModalOpen(false);
                setFormData({ name: '', slug: '', description: '', icon: '📂' });
                fetchData();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to create category');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCategory) return;
        setActionLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/categories/${currentCategory.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setIsEditModalOpen(false);
                setCurrentCategory(null);
                fetchData();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to update category');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This will not delete the resources assigned to it.`)) return;
        try {
            const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                fetchData();
            }
        } catch (err) {
            alert('Delete failed');
        }
    };

    const openEdit = (cat: Category) => {
        setCurrentCategory(cat);
        setFormData({
            name: cat.name,
            slug: cat.slug || '',
            description: cat.description || '',
            icon: cat.icon || '📂'
        });
        setIsEditModalOpen(true);
    };

    const iconMap: Record<string, string> = {
        'Prompt Engineering': '⚡',
        'Image Generation': '🖼️',
        'Text Generation': '📝',
        'Code Generation': '💻',
        'Video Generation': '🎬',
        'Audio Generation': '🎵',
        'Chatbot Development': '🤖',
        'API Integration': '🔌',
        'Best Practices': '✅',
        'Advanced Techniques': '🎯',
        'Beginner Guide': '📘',
        'Use Cases': '💡',
        'Comparison': '⚖️',
        'News & Updates': '📰',
        'Research': '🔬',
        'Tools & Plugins': '🔧',
        'Templates': '📋',
        'Workflow': '🔄',
        'Gemini': '🔮',
        'NanoBanana': '🍌',
        'ChatGPT': '🤖',
        'Claude': '🧠',
        'Midjourney': '🎨',
        'Archive': '📁',
        'Project': '🏗️',
        'Tutorial': '📖',
    };

    return (
        <div className="page-wrapper dashboard-theme min-h-screen bg-[#0a0a0f] text-white selection:bg-indigo-500/30">
            <Navbar />

            {/* ── CINEMATIC HERO COVER ── */}
            <div className="relative w-full h-auto overflow-hidden flex flex-col">
                {/* Background Layer (Blurred Telemetry) */}
                <div className="absolute inset-0 z-0">
                    <div className="w-full h-full bg-[#0a0a0f]">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-50" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pb-32" />
                    </div>
                </div>

                <div className="container relative z-10 flex flex-col gap-8 pt-8 pb-32">
                    {/* Header Pathing */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                                <Icons.folder size={20} className="text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">
                                    Registry Intelligence / Taxonomy
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                    <span className="text-white uppercase">Topic Registry</span>
                                    <span className="opacity-20">/</span>
                                    <span className="text-indigo-400/60 font-black">Category Management</span>
                                </div>
                            </div>
                        </div>
                        
                        {isAdmin && (
                            <div className="flex items-center gap-3">
                                {selectedIds.size > 0 && (
                                    <button 
                                        onClick={() => alert('Bulk actions coming soon')}
                                        className="px-6 py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center gap-2"
                                    >
                                        <Icons.trash size={14} /> Delete {selectedIds.size} Assets
                                    </button>
                                )}
                                <button 
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="px-8 py-2.5 bg-indigo-600 border border-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
                                >
                                    <Icons.plus size={14} /> New Registry Entry
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Identity Glass Card (Section Overview) */}
                    <div className="glass-card p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-500/10 transition-all duration-1000" />
                        
                        <div className="relative z-10">
                            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6 leading-none flex items-center gap-4">
                                <Icons.folder className="text-indigo-400" size={48} />
                                <span>Topic <span className="text-indigo-400">Registry</span></span>
                            </h1>

                            <p className="text-white/40 max-w-2xl text-lg font-medium leading-relaxed mb-6">
                                Curate and organize the architectural taxonomy of the PromptMaster ecosystem. Manage granular categories, discovery weights, and structural metadata.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 -mt-20 pb-12 relative z-30">

                    {/* Control Belt */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-background-secondary/30 backdrop-blur-xl border border-white/5 rounded-[2rem] mb-10">
                        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                            <div className="relative flex-1 max-w-md">
                                <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="Search categories..."
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            
                            <div className="h-8 w-px bg-white/5"></div>

                            {/* View Mode Switcher */}
                            <div className="flex p-1 bg-black/40 rounded-xl">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                >
                                    <Icons.layoutGrid size={18} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                                >
                                    <Icons.list size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{filteredCategories.length} Topics</span>
                            </div>
                            {selectedIds.size > 0 && (
                                <button 
                                    onClick={handleSelectAll}
                                    className="text-xs font-bold text-white/40 hover:text-white underline underline-offset-4"
                                >
                                    {selectedIds.size === filteredCategories.length ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 opacity-20">
                            <div className="spinner mb-4" />
                            <div className="text-xs font-black uppercase tracking-[0.3em]">Initializing Registry</div>
                        </div>
                    ) : (
                        <div className={viewMode === 'grid' 
                            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            : "flex flex-col gap-3"
                        }>
                            {filteredCategories.map((cat) => (
                                <div 
                                    key={cat.id} 
                                    className={`
                                        group relative overflow-hidden transition-all duration-300
                                        ${viewMode === 'grid' 
                                            ? 'glass-card p-6 min-h-[180px] flex flex-col hover:border-indigo-500/30' 
                                            : 'flex items-center gap-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] hover:border-white/10'}
                                        ${selectedIds.has(cat.id) ? 'ring-2 ring-indigo-500 border-indigo-500/50 bg-indigo-500/5' : ''}
                                    `}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                                        handleToggleSelect(cat.id);
                                    }}
                                >
                                    {/* Selection Overlay for Grid */}
                                    {selectedIds.has(cat.id) && viewMode === 'grid' && (
                                        <div className="absolute top-4 right-4 z-10">
                                            <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                                                <Icons.check size={14} className="text-white" />
                                            </div>
                                        </div>
                                    )}

                                    <div className={viewMode === 'grid' ? "flex items-start gap-4 mb-4" : "flex items-center gap-4 flex-1"}>
                                        <div className={`
                                            flex items-center justify-center rounded-2xl flex-shrink-0
                                            ${viewMode === 'grid' ? 'w-14 h-14 text-2xl bg-white/5 border border-white/10' : 'w-10 h-10 text-xl'}
                                        `}>
                                            {cat.icon || iconMap[cat.name] || '📂'}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="text-lg font-bold text-white tracking-tight truncate">
                                                    {cat.name}
                                                </h3>
                                                {cat.freeCount ? cat.freeCount > 0 && (
                                                    <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full uppercase tracking-tighter">
                                                        Freemium Friendly
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="text-sm text-foreground-muted line-clamp-1 font-medium italic opacity-60">
                                                {cat.description || `Explore ${cat.count} curated resources.`}
                                            </p>
                                        </div>
                                    </div>

                                    {viewMode === 'list' && (
                                        <div className="flex items-center gap-8 mr-4">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-white">{cat.count}</span>
                                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Resources</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className={viewMode === 'grid' ? "mt-auto pt-6 flex justify-between items-center" : "flex items-center gap-2"}>
                                        <Link 
                                            href={`/resources?category=${encodeURIComponent(cat.name)}`}
                                            className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-500/20 transition-all flex items-center gap-2"
                                        >
                                            Explore <Icons.arrowRight size={14} />
                                        </Link>

                                        {isAdmin && (
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => openEdit(cat)}
                                                    className="p-2 text-white/20 hover:text-white/60 transition-all"
                                                    title="Edit Category"
                                                >
                                                    <Icons.edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(cat.id, cat.name)}
                                                    className="p-2 text-white/20 hover:text-rose-400/60 transition-all"
                                                    title="Delete Category"
                                                >
                                                    <Icons.trash size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Stats overlay for grid */}
                                    {viewMode === 'grid' && (
                                        <div className="absolute top-6 right-6 flex flex-col items-end opacity-20 group-hover:opacity-40 transition-opacity">
                                            <span className="text-3xl font-black text-white">{cat.count}</span>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Assets</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </main>

            {/* Modals */}
            <Modal
                isOpen={isAddModalOpen || isEditModalOpen}
                onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                title={isAddModalOpen ? 'Create New Topic' : 'Edit Topic'}
            >
                <form onSubmit={isAddModalOpen ? handleAdd : handleEdit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl font-bold">
                            {error}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-white/40 uppercase tracking-widest">Display name</label>
                            <input 
                                type="text"
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Code Generation"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-white/40 uppercase tracking-widest">Symbol / Icon</label>
                            <input 
                                type="text"
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                value={formData.icon}
                                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                placeholder="Emoji or Lucide name"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 uppercase tracking-widest">Description</label>
                        <textarea 
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 h-24"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe what kind of resources belong here..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                        <button 
                            type="button"
                            onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                            className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={actionLoading}
                            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {actionLoading ? 'Saving...' : 'Save Category'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Footer />
        </div>
    );
}
