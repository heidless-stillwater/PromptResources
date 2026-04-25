'use client';

import React, { useState, useMemo } from 'react';
import { Icons } from '@/components/ui/Icons';

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
    }, [platformFilter, typeFilter, categoryFilter, priorityRank, selectedCreators, registryActive, shells]);

    const filteredCreators = useMemo(() => {
        return creators
            .filter(c => (c.displayName || '').toLowerCase().includes(creatorSearch.toLowerCase()))
            .sort((a, b) => {
                if (creatorSortBy === 'resources') return (b.resourceCount || 0) - (a.resourceCount || 0);
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [creators, creatorSearch, creatorSortBy]);

    const toggleCreator = (uid: string) => {
        const current = selectedCreators || [];
        if (current.includes(uid)) setSelectedCreators(current.filter(id => id !== uid));
        else setSelectedCreators([...current, uid]);
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
        setRegistryActive(true);
        setSelectedCreators(shell.filters.selectedCreators);
    };

    const deleteShell = (name: string) => {
        const updated = shells.filter(s => s.name !== name);
        setShells(updated);
        localStorage.setItem('context-shells-v2', JSON.stringify(updated));
    };

    const selectStyle = "h-11 bg-black/40 border border-white/5 rounded-xl px-3 text-[10px] font-black font-outfit uppercase text-white/40 outline-none hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer min-w-[120px] appearance-none text-center tracking-widest";

    return (
        <div id="filter-console" className="flex flex-col gap-px bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden transition-all duration-500 shadow-2xl font-inter">
            
            {/* STICKY CONTROL BELT */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-black/40 backdrop-blur-3xl">
                
                {/* 1. Attribute Selectors */}
                <div className="flex items-center gap-2">
                    <button
                        className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all ${featuredOnly ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/5 border-white/5 text-white/20 hover:text-white'}`}
                        onClick={() => setFeaturedOnly(!featuredOnly)}
                        title="Featured Only"
                    >
                        <Icons.star size={18} fill={featuredOnly ? "currentColor" : "none"} />
                    </button>

                    <div className="relative flex items-center group">
                        <select 
                            value={priorityRank} 
                            onChange={e => setPriorityRank(e.target.value)} 
                            className={selectStyle}
                        >
                            <option value="">Ranking</option>
                            <option value="any">Ranked Only</option>
                            {[1,3,5,10,25].map(r => <option key={r} value={r.toString()}>Top {r}</option>)}
                        </select>
                        <Icons.chevronDown size={12} className="absolute right-3 text-white/10 pointer-events-none group-hover:text-primary transition-colors" />
                    </div>

                    <div className="relative flex items-center group">
                        <select 
                            value={categoryFilter} 
                            onChange={e => setCategoryFilter(e.target.value)} 
                            className={selectStyle}
                        >
                            <option value="">Domains</option>
                            {initialCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <Icons.chevronDown size={12} className="absolute right-3 text-white/10 pointer-events-none group-hover:text-primary transition-colors" />
                    </div>

                    <div className="relative flex items-center group">
                        <select 
                            value={typeFilter} 
                            onChange={e => setTypeFilter(e.target.value)} 
                            className={selectStyle}
                        >
                            <option value="">Asset Type</option>
                            {types.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <Icons.chevronDown size={12} className="absolute right-3 text-white/10 pointer-events-none group-hover:text-primary transition-colors" />
                    </div>
                </div>

                <div className="h-6 w-px bg-white/5 hidden md:block" />

                {/* 2. Workspace Status Indicator */}
                <div className="flex-1 flex items-center gap-4 min-w-[200px]">
                    <button 
                        onClick={() => setRegistryActive(!registryActive)}
                        className={`group relative flex items-center justify-center transition-all ${registryActive ? 'scale-110' : 'opacity-20 hover:opacity-100 grayscale hover:grayscale-0'}`}
                    >
                        <div className={`w-3.5 h-3.5 rounded-full transition-all duration-700 ${activeShell ? 'bg-primary shadow-[0_0_15px_#14b8a6]' : (selectedCreators?.length || 0) > 0 ? 'bg-primary/40' : 'bg-white/10'}`} />
                        {!registryActive && <Icons.close size={8} className="absolute text-white font-black" />}
                    </button>
                    <div className="flex flex-col min-w-0">
                        <span 
                            onClick={() => setRegistryActive(!registryActive)}
                            className={`text-[10px] font-black font-outfit uppercase tracking-[0.25em] truncate cursor-pointer transition-colors ${!registryActive ? 'text-white/10' : activeShell ? 'text-primary' : 'text-white/40'}`}
                        >
                            {!registryActive ? 'Registry Bypassed' : activeShell ? activeShell.name : (selectedCreators?.length || 0) > 0 ? 'Workspace Active' : 'Sovereign Console'}
                        </span>
                        <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar transition-all ${!registryActive ? 'opacity-0 h-0' : 'opacity-100 h-4 mt-1'}`}>
                            {selectedCreators?.length === 0 ? (
                                <span className="text-[8px] font-bold text-white/5 uppercase italic">Zero Pioneers Captivated</span>
                            ) : (
                                selectedCreators.map(uid => {
                                    const c = creators.find(cr => cr.uid === uid);
                                    if (!c) return null;
                                    return (
                                        <span key={uid} onClick={() => toggleCreator(uid)} className="text-[8px] font-black text-white/20 hover:text-rose-500 cursor-pointer whitespace-nowrap bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5 transition-all uppercase tracking-tighter">
                                            {c.displayName}
                                        </span>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Global Actions */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsSaving(!isSaving)}
                        className={`h-11 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${isSaving ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95'}`}
                    >
                        {isSaving ? 'Cancel' : 'Pin Context'}
                    </button>
                    <button onClick={() => setShowDiscovery(!showDiscovery)} className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all ${showDiscovery ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-white/5 border-white/5 text-white/10 hover:text-white hover:bg-white/10'}`}>
                        <Icons.search size={16} />
                    </button>
                </div>
            </div>

            {/* SAVE INTERFACE */}
            {isSaving && (
                <div className="px-6 py-4 bg-primary/5 border-t border-primary/10 flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                    <input 
                        autoFocus
                        value={tempName}
                        onChange={e => setTempName(e.target.value)}
                        placeholder="Context shell identifier..."
                        className="flex-1 bg-transparent border-b border-primary/20 outline-none text-[11px] text-white py-1 placeholder:text-white/5 font-black uppercase tracking-widest"
                        onKeyDown={e => e.key === 'Enter' && saveCurrentShell()}
                    />
                    <button onClick={saveCurrentShell} className="text-[10px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest">Commit Shell</button>
                </div>
            )}

            {/* DISCOVERY & LIBRARY CONSOLE */}
            {showDiscovery && (
                <div className="border-t border-white/5 flex flex-col md:flex-row animate-in slide-in-from-top-4 duration-500 max-h-[500px]">
                    {/* Shell Archive */}
                    <div className="w-full md:w-72 border-r border-white/5 bg-black/20 flex flex-col">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-black font-outfit uppercase tracking-[0.3em] text-white/20">Shell Archive</span>
                            <span className="text-[9px] font-black text-primary/40 bg-primary/5 px-2 py-0.5 rounded-full">{shells.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {shells.length === 0 ? (
                                <div className="text-center py-20 text-[10px] font-black text-white/5 uppercase tracking-widest italic">Zero Records</div>
                            ) : shells.map(s => (
                                <div key={s.name} className={`p-4 rounded-2xl border group transition-all cursor-pointer ${activeShell?.name === s.name ? 'bg-primary/10 border-primary/30 shadow-inner' : 'bg-white/5 border-transparent hover:border-white/10'}`} onClick={() => loadShell(s)}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${activeShell?.name === s.name ? 'text-primary' : 'text-white/40'}`}>{s.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); deleteShell(s.name); }} className="text-rose-500/0 group-hover:text-rose-500/40 hover:text-rose-500 transition-all">
                                            <Icons.close size={10} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {s.filters.priorityRank && <span className="text-[8px] font-black text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded uppercase border border-primary/10">Rank {s.filters.priorityRank}</span>}
                                        {s.filters.selectedCreators.length > 0 && <span className="text-[8px] font-black text-white/20 bg-white/5 px-1.5 py-0.5 rounded uppercase border border-white/5">{s.filters.selectedCreators.length} Pioneers</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scouting Engine */}
                    <div className="flex-1 flex flex-col bg-black/10">
                        <div className="p-6 border-b border-white/5 flex items-center gap-4">
                            <div className="relative flex-1">
                                <input placeholder="Scout the registry..." value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl h-11 pl-11 text-xs text-white outline-none focus:border-primary/30 transition-all font-medium" />
                                <Icons.search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" />
                            </div>
                            <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5">
                                <button onClick={() => setCreatorSortBy('resources')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${creatorSortBy === 'resources' ? 'bg-primary text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}>Impact</button>
                                <button onClick={() => setCreatorSortBy('updated')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${creatorSortBy === 'updated' ? 'bg-primary text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}>Activity</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 lg:grid-cols-3 gap-3 custom-scrollbar">
                            {filteredCreators.map(c => {
                                const active = (selectedCreators || []).includes(c.uid);
                                return (
                                    <button key={c.uid} onClick={() => toggleCreator(c.uid)} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${active ? 'bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(20,184,166,0.1)]' : 'bg-white/[0.02] border-transparent hover:border-white/5 hover:bg-white/[0.04]'}`}>
                                        <div className="w-8 h-8 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 border border-white/5">
                                            {c.photoURL ? <img src={c.photoURL} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-white/10">{c.displayName?.charAt(0)}</div>}
                                        </div>
                                        <div className="flex flex-col items-start min-w-0">
                                            <span className={`text-[10px] font-black truncate uppercase tracking-tighter ${active ? 'text-primary' : 'text-white/40'}`}>{c.displayName}</span>
                                            <span className="text-[8px] font-bold text-white/10 uppercase">{c.resourceCount || 0} Assets</span>
                                        </div>
                                        {active && <Icons.check size={12} className="ml-auto text-primary animate-in zoom-in" />}
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
