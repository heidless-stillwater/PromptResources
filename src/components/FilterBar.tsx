'use client';

import React from 'react';
import { Platform, ResourcePricing, ResourceType } from '@/lib/types';

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
    sortBy: string;
    setSortBy: (val: string) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (val: 'asc' | 'desc') => void;
    onApply: () => void;
    initialCategories: string[];
}

export default function FilterBar({
    platformFilter, setPlatformFilter,
    pricingFilter, setPricingFilter,
    typeFilter, setTypeFilter,
    categoryFilter, setCategoryFilter,
    featuredOnly, setFeaturedOnly,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    onApply,
    initialCategories
}: FilterBarProps) {
    const platforms: Platform[] = ['gemini', 'nanobanana', 'chatgpt', 'claude', 'midjourney', 'general', 'other'];
    const pricings: ResourcePricing[] = ['free', 'paid', 'freemium'];
    const types: ResourceType[] = ['video', 'article', 'tool', 'course', 'book', 'tutorial', 'other'];

    const handleChange = (setter: (val: any) => void, val: any) => {
        setter(val);
        setTimeout(onApply, 0);
    };

    return (
        <div className="flex flex-wrap gap-4 items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-sm" id="resource-filters">
            <div className="flex flex-wrap gap-3 flex-1">
                <select
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-all cursor-pointer"
                    value={platformFilter}
                    onChange={(e) => handleChange(setPlatformFilter, e.target.value)}
                    id="filter-platform"
                    title="Filter by Platform"
                >
                    <option value="" className="bg-[#1c1c21]">🌐 Platform</option>
                    {platforms.map((p) => (
                        <option key={p} value={p} className="bg-[#1c1c21]">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                </select>

                <select
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-all cursor-pointer"
                    value={pricingFilter}
                    onChange={(e) => handleChange(setPricingFilter, e.target.value)}
                    id="filter-pricing"
                    title="Filter by Pricing"
                >
                    <option value="" className="bg-[#1c1c21]">💰 Pricing</option>
                    {pricings.map((p) => (
                        <option key={p} value={p} className="bg-[#1c1c21]">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                </select>

                <select
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-all cursor-pointer"
                    value={typeFilter}
                    onChange={(e) => handleChange(setTypeFilter, e.target.value)}
                    id="filter-type"
                    title="Filter by Type"
                >
                    <option value="" className="bg-[#1c1c21]">🧩 Type</option>
                    {types.map((t) => (
                        <option key={t} value={t} className="bg-[#1c1c21]">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                </select>

                <select
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-all cursor-pointer"
                    value={categoryFilter}
                    onChange={(e) => handleChange(setCategoryFilter, e.target.value)}
                    id="filter-category"
                    title="Filter by Category"
                >
                    <option value="" className="bg-[#1c1c21]">📁 Category</option>
                    {initialCategories.map((c) => (
                        <option key={c} value={c} className="bg-[#1c1c21]">{c}</option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-3">
                <button
                    className={`p-2.5 rounded-xl border transition-all ${featuredOnly ? 'bg-primary border-primary shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'}`}
                    onClick={() => handleChange(setFeaturedOnly, !featuredOnly)}
                    id="filter-featured"
                    title="Show Featured Only"
                >
                    {featuredOnly ? '⭐' : '☆'}
                </button>

                <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
                    <select
                        className="bg-transparent text-xs font-bold uppercase tracking-widest text-white outline-none px-2 py-1 cursor-pointer"
                        value={sortBy}
                        onChange={(e) => handleChange(setSortBy, e.target.value)}
                        id="sort-by"
                        title="Sort Resources"
                    >
                        <option value="createdAt" className="bg-[#1c1c21]">Created</option>
                        <option value="updatedAt" className="bg-[#1c1c21]">Updated</option>
                        <option value="title" className="bg-[#1c1c21]">Title</option>
                        <option value="rank" className="bg-[#1c1c21]">Rank</option>
                    </select>

                    <button
                        className="p-1 px-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                        onClick={() => handleChange(setSortOrder, sortOrder === 'asc' ? 'desc' : 'asc')}
                        id="toggle-sort-order"
                        title={sortOrder === 'asc' ? 'Sorted Ascending' : 'Sorted Descending'}
                    >
                        {sortOrder === 'asc' ? '🔼' : '🔽'}
                    </button>
                </div>
            </div>
        </div>
    );
}
