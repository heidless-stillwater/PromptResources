'use client';

import React, { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';

interface ContextShell {
    name: string;
    filters: {
        platform: string;
        type: string;
        category: string;
        featuredOnly: boolean;
        priorityRank: string;
        registryActive: boolean;
        selectedCreators: string[];
    };
    createdAt: number;
}

interface FilterBarProps {
    platformFilter: string;
    setPlatformFilter: (val: string) => void;
    pricingFilter: string;
    setPricingFilter: (val: string) => void;
    typeFilter: string;
    setTypeFilter: (val: string) => void;
    categoryFilter: string;
    setCategoryFilter: (val: string) => void;
    featuredOnly: boolean;
    setFeaturedOnly: (val: boolean) => void;
    priorityRank: string;
    setPriorityRank: (val: string) => void;
    sortBy: string;
    setSortBy: (val: string) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (val: 'asc' | 'desc') => void;
    selectedCreators: string[];
    setSelectedCreators: (val: string[]) => void;
    registryActive: boolean;
    setRegistryActive: (val: boolean) => void;
    creators: any[];
    loadingCreators: boolean;
    initialCategories: { id: string; name: string; slug?: string }[];
}

const FilterBar: React.FC<FilterBarProps> = ({
    platformFilter, setPlatformFilter,
    pricingFilter, setPricingFilter,
    typeFilter, setTypeFilter,
    categoryFilter, setCategoryFilter,
    featuredOnly, setFeaturedOnly,
    priorityRank, setPriorityRank,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    selectedCreators, setSelectedCreators,
    registryActive, setRegistryActive,
    creators, loadingCreators,
    initialCategories
}) => {
    const types = ['prompt', 'workflow', 'system', 'agent', 'template'];
    const platforms = ['youtube', 'twitter', 'website', 'course', 'community'];

    // Console Persistence & Discovery
    const [showDiscovery, setShowDiscovery] = useState(false);
    const [creatorSearch, setCreatorSearch] = useState('');
    const [creatorSortBy, setCreatorSortBy] = useState<'resources' | 'updated'>('resources');
    
    const [shells, setShells] = useState<ContextShell[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [tempName, setTempName] = useState('');

    React.useEffect(() => {
        const saved = localStorage.getItem('context-shells-v2');
        if (saved) setShells(JSON.parse(saved));
    }, []);

    const activeShell = useMemo(() => {
        return shells.find(s => {
            const match = s.filters.platform === platformFilter &&
                          s.filters.type === typeFilter &&
                          s.filters.category === categoryFilter &&
                          s.filters.priorityRank === priorityRank &&
                          s.filters.registryActive === registryActive &&
                          [...(s.filters.selectedCreators || [])].sort().join(',') === [...(selectedCreators || [])].sort().join(',');
            return match;
        });
    }, [platformFilter, typeFilter, categoryFilter, featuredOnly, priorityRank, selectedCreators, registryActive, shells]);

    const filteredCreators = useMemo(() => {
        return creators
            .filter(c => c.displayName.toLowerCase().includes(creatorSearch.toLowerCase()))
            .sort((a, b) => {
                if (creatorSortBy === 'resources') return (b.resourceCount || 0) - (a.resourceCount || 0);
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [creators, creatorSearch, creatorSortBy]);

    const toggleCreator = (uid: string) => {
        const current = selectedCreators || [];
        if (current.includes(uid)) {
            setSelectedCreators(current.filter(id => id !== uid));
        } else {
            setSelectedCreators([...current, uid]);
        }
    };

    const saveCurrentShell = () => {
        if (!tempName.trim()) return;
        const newShell: ContextShell = {
            name: tempName.trim(),
            filters: {
                platform: platformFilter,
                type: typeFilter,
                category: categoryFilter,
                featuredOnly,
                priorityRank,
                registryActive,
                selectedCreators: [...selectedCreators]
            },
            createdAt: Date.now()
        };
        const updated = [...shells.filter(s => s.name !== newShell.name), newShell];
        setShells(updated);
        localStorage.setItem('context-shells-v2', JSON.stringify(updated));
        setTempName('');
        setIsSaving(false);
    };

    const loadShell = (shell: ContextShell) => {
        setPlatformFilter(shell.filters.platform);
        setTypeFilter(shell.filters.type);
        setCategoryFilter(shell.filters.category);
        setFeaturedOnly(shell.filters.featuredOnly);
        setPriorityRank(shell.filters.priorityRank);
        setRegistryActive(shell.filters.registryActive ?? true);
        setSelectedCreators(shell.filters.selectedCreators);
    };

    const deleteShell = (name: string) => {
        const updated = shells.filter(s => s.name !== name);
        setShells(updated);
        localStorage.setItem('context-shells-v2', JSON.stringify(updated));
    };

    // Style helper for dark mode selects
    const selectStyle = "h-10 bg-[#0f0f1b] border border-white/10 rounded-xl px-2 text-[10px] font-black uppercase text-white/70 outline-none hover:bg-white/10 transition-all cursor-pointer min-w-[110px] appearance-none text-center shadow-inner hover:border-indigo-500/30";

    return (
        <div id="filter-console" className="flex flex-col gap-px bg-white/5 border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 shadow-2xl">
            
            {/* STICKY CONTROL BELT */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-[#0a0a0f]/90 backdrop-blur-3xl border-b border-white/5">
                
                {/* 1. Attributes Belt (Refactored: Rank instead of Platform) */}
                <div className="flex items-center gap-3">
                    <button
                        className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${featuredOnly ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/30 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}
                        onClick={() => setFeaturedOnly(!featuredOnly)}
                        title="Featured Only"
                    >
                        {featuredOnly ? '⭐' : '☆'}
                    </button>

                    {/* RANK SELECTOR (Replacing Platform) */}
                    <div className="relative group/sel">
                        <select 
                            value={priorityRank} 
                            onChange={e => setPriorityRank(e.target.value)} 
                            className={selectStyle}
                        >
                            <option value="" className="bg-[#0a0a0f] text-white">Full Registry</option>
                            <option value="any" className="bg-[#0a0a0f] text-white">Ranked Only</option>
                            {[1,2,3,4,5,10,25,50,100].map(r => (
                                <option key={r} value={r.toString()} className="bg-[#0a0a0f] text-white">Top {r}</option>
                            ))}
                        </select>
                        <Icons.ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover/sel:text-indigo-400 transition-colors" />
                    </div>

                    {/* CATEGORY SELECTOR */}
                    <div className="relative group/sel">
                        <select 
                            value={categoryFilter} 
                            onChange={e => setCategoryFilter(e.target.value)} 
                            className={selectStyle}
                        >
                            <option value="" className="bg-[#0a0a0f] text-white">All Categories</option>
                            {initialCategories.map(c => <option key={c.id} value={c.id} className="bg-[#0a0a0f] text-white">{c.name}</option>)}
                        </select>
                        <Icons.ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover/sel:text-indigo-400 transition-colors" />
                    </div>

                    {/* TYPE SELECTOR */}
                    <div className="relative group/sel">
                        <select 
                            value={typeFilter} 
                            onChange={e => setTypeFilter(e.target.value)} 
                            className={selectStyle}
                        >
                            <option value="" className="bg-[#0a0a0f] text-white">All Types</option>
                            {types.map(t => <option key={t} value={t} className="bg-[#0a0a0f] text-white">{t}</option>)}
                        </select>
                        <Icons.ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover/sel:text-indigo-400 transition-colors" />
                    </div>
                </div>

                <div className="h-6 w-px bg-white/10 hidden md:block" />

                {/* 2. THE WORKSPACE INDICATOR (Aura Indicator) */}
                <div className="flex-1 flex items-center gap-3 overflow-hidden">
                    <button 
                        onClick={() => setRegistryActive(!registryActive)}
                        className={`group relative flex items-center justify-center transition-all ${registryActive ? 'scale-110' : 'grayscale opacity-50 hover:grayscale-0 hover:opacity-100'}`}
                        title={registryActive ? "Deactivate Workspace" : "Activate Workspace"}
                    >
                        <div className={`w-3 h-3 rounded-full transition-all duration-500 ${activeShell ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' : (selectedCreators?.length || 0) > 0 ? 'bg-indigo-400 shadow-[0_0_12px_#818cf8]' : 'bg-white/10'}`} />
                        {!registryActive && <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold">✕</div>}
                    </button>
                    <div className="flex flex-col min-w-0">
                        <span 
                            onClick={() => setRegistryActive(!registryActive)}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] truncate cursor-pointer transition-colors ${!registryActive ? 'text-white/20' : activeShell ? 'text-emerald-400' : (selectedCreators?.length || 0) > 0 ? 'text-indigo-300' : 'text-white/20'}`}
                        >
                            {!registryActive ? 'Registry Bypassed' : activeShell ? activeShell.name : (selectedCreators?.length || 0) > 0 ? 'Workspace Draft' : 'Context Builder'}
                        </span>
                        <div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar transition-all ${!registryActive ? 'opacity-20 pointer-events-none blur-[1px]' : 'opacity-100'}`}>
                            {selectedCreators?.length === 0 ? (
                                <span className="text-[8px] font-bold text-white/5 uppercase italic">No curators captured</span>
                            ) : (
                                selectedCreators.map(uid => {
                                    const c = creators.find(cr => cr.uid === uid);
                                    if (!c) return null;
                                    return (
                                        <span key={uid} onClick={() => toggleCreator(uid)} className="text-[8px] font-bold text-white/40 hover:text-red-400 cursor-pointer whitespace-nowrap bg-white/5 px-2 py-0.5 rounded-full border border-white/5 transition-all">
                                            {c.displayName}
                                        </span>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. ACTIONS */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsSaving(!isSaving)}
                        className={`h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isSaving ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/30'}`}
                    >
                        {isSaving ? 'Cancel' : 'Pin Shell'}
                    </button>
                    <button onClick={() => setShowDiscovery(!showDiscovery)} className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${showDiscovery ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                        <Icons.Compass size={14} className={showDiscovery ? 'text-indigo-400' : 'text-white/20'} />
                    </button>
                </div>
            </div>

            {/* SAVE INTERFACE */}
            {isSaving && (
                <div className="px-4 py-3 bg-indigo-600/10 border-t border-indigo-500/20 flex items-center gap-3 animate-slideDown">
                    <input 
                        autoFocus
                        value={tempName}
                        onChange={e => setTempName(e.target.value)}
                        placeholder="Context shell name (e.g. YouTube Tools)..."
                        className="flex-1 bg-transparent border-b border-indigo-500/30 outline-none text-[11px] text-white py-1 placeholder:text-white/10"
                        onKeyDown={e => e.key === 'Enter' && saveCurrentShell()}
                    />
                    <button onClick={saveCurrentShell} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors">SYNC SHELL</button>
                </div>
            )}

            {/* DISCOVERY & LIBRARY CONSOLE */}
            {showDiscovery && (
                <div className="border-t border-white/10 flex flex-col md:flex-row animate-slideDown max-h-[450px]">
                    {/* Shell Archive */}
                    <div className="w-full md:w-64 border-r border-white/10 bg-[#0a0a0f]/50 flex flex-col">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Context Archive</span>
                            <span className="text-[8px] font-bold text-white/10">{shells.length} Shells</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {shells.length === 0 ? (
                                <div className="text-center py-10 text-[9px] font-bold text-white/5 italic">Archive Empty</div>
                            ) : shells.map(s => (
                                <div key={s.name} className={`p-3 rounded-xl border group/shell transition-all cursor-pointer ${activeShell?.name === s.name ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-transparent hover:border-white/10'}`} onClick={() => loadShell(s)}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[10px] font-black uppercase tracking-tight ${activeShell?.name === s.name ? 'text-emerald-400' : 'text-white/60'}`}>{s.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); deleteShell(s.name); }} className="text-red-500/0 group-hover/shell:text-red-500/40 hover:text-red-500 text-[10px]">✕</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {s.filters.priorityRank && <span className="text-[8px] text-emerald-400/40 bg-emerald-500/5 px-1 rounded uppercase">Rank {s.filters.priorityRank}</span>}
                                        {s.filters.selectedCreators.length > 0 && <span className="text-[8px] text-indigo-400/40 bg-indigo-500/5 px-1 rounded uppercase">{s.filters.selectedCreators.length} Curators</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scouting Engine */}
                    <div className="flex-1 flex flex-col bg-[#0a0a0f]/20">
                        <div className="p-4 border-b border-white/5 flex items-center gap-3">
                            <div className="relative flex-1">
                                <input placeholder="Scout registry..." value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl h-9 pl-9 text-xs text-white outline-none focus:border-indigo-500/30" />
                                <Icons.Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                            </div>
                            <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
                                <button onClick={() => setCreatorSortBy('resources')} className={`px-2 py-1 text-[8px] font-black uppercase rounded ${creatorSortBy === 'resources' ? 'bg-indigo-600 text-white shadow-md' : 'text-white/20'}`}>Impact</button>
                                <button onClick={() => setCreatorSortBy('updated')} className={`px-2 py-1 text-[8px] font-black uppercase rounded ${creatorSortBy === 'updated' ? 'bg-indigo-600 text-white shadow-md' : 'text-white/20'}`}>Activity</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 gap-2 custom-scrollbar">
                            {filteredCreators.map(c => {
                                const active = selectedCreators.includes(c.uid);
                                return (
                                    <button key={c.uid} onClick={() => toggleCreator(c.uid)} className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${active ? 'bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : 'bg-white/[0.02] border-transparent hover:border-white/10'}`}>
                                        <div className="w-6 h-6 rounded bg-white/5 overflow-hidden flex-shrink-0">
                                            {c.photoURL ? <img src={c.photoURL} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white/20">{c.displayName.charAt(0)}</div>}
                                        </div>
                                        <span className={`text-[10px] font-bold truncate ${active ? 'text-indigo-200' : 'text-white/60'}`}>{c.displayName}</span>
                                        {active && <span className="ml-auto text-indigo-400 text-[10px] animate-in zoom-in">✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterBar;
