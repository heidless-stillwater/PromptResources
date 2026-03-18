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
        <div className="filter-bar" id="resource-filters">
            <div className="filter-group">
                <select
                    className="form-select"
                    value={platformFilter}
                    onChange={(e) => handleChange(setPlatformFilter, e.target.value)}
                    id="filter-platform"
                    title="Filter by Platform"
                >
                    <option value="">🌐 Platform</option>
                    {platforms.map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                </select>

                <select
                    className="form-select"
                    value={pricingFilter}
                    onChange={(e) => handleChange(setPricingFilter, e.target.value)}
                    id="filter-pricing"
                    title="Filter by Pricing"
                >
                    <option value="">💰 Pricing</option>
                    {pricings.map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                </select>

                <select
                    className="form-select"
                    value={typeFilter}
                    onChange={(e) => handleChange(setTypeFilter, e.target.value)}
                    id="filter-type"
                    title="Filter by Type"
                >
                    <option value="">🧩 Type</option>
                    {types.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                </select>

                <select
                    className="form-select"
                    value={categoryFilter}
                    onChange={(e) => handleChange(setCategoryFilter, e.target.value)}
                    id="filter-category"
                    title="Filter by Category"
                >
                    <option value="">📁 Category</option>
                    {initialCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            <div className="filter-actions">
                <button
                    className={`btn ${featuredOnly ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleChange(setFeaturedOnly, !featuredOnly)}
                    id="filter-featured"
                    title="Show Featured Only"
                    style={{ gap: 'var(--space-2)' }}
                >
                    {featuredOnly ? '⭐' : '☆'}
                </button>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <select
                        className="form-select"
                        value={sortBy}
                        onChange={(e) => handleChange(setSortBy, e.target.value)}
                        id="sort-by"
                        title="Sort Resources"
                        style={{ minWidth: '100px' }}
                    >
                        <option value="createdAt">🔃 Created</option>
                        <option value="updatedAt">🔃 Updated</option>
                        <option value="title">🔃 Title</option>
                        <option value="rank">🔃 Rank</option>
                    </select>

                    <button
                        className="btn btn-secondary"
                        onClick={() => handleChange(setSortOrder, sortOrder === 'asc' ? 'desc' : 'asc')}
                        id="toggle-sort-order"
                        title={sortOrder === 'asc' ? 'Sorted Ascending' : 'Sorted Descending'}
                        style={{ padding: '0 var(--space-3)', fontSize: '1.2rem' }}
                    >
                        {sortOrder === 'asc' ? '🔼' : '🔽'}
                    </button>
                </div>
            </div>
        </div>
    );
}
