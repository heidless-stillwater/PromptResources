'use client';

import React from 'react';
import Link from 'next/link';
import { Attribution } from '@/lib/types';
import { Icons } from '@/components/ui/Icons';

interface CreatorChipProps {
    attribution: Attribution;
    /** Size variant */
    size?: 'sm' | 'md';
    /** If true, render as external link when no userId slug available */
    showExternalIcon?: boolean;
}

/**
 * A small, reusable creator attribution chip.
 * - If attribution.userId/slug is set → links to /creators/{slug}
 * - Otherwise → links to attribution.url (external)
 * - Falls back gracefully to plain text if no url
 */
export default function CreatorChip({ attribution, size = 'md', showExternalIcon = true }: CreatorChipProps) {
    const isInternal = !!attribution.userId;
    const href = isInternal
        ? `/creators/${attribution.userId}` // will be redirected to slug via profile lookup
        : attribution.url;

    const roleLabel = attribution.role
        ? attribution.role.charAt(0).toUpperCase() + attribution.role.slice(1)
        : null;

    const baseClass = `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 group`;
    const themeClass = isInternal
        ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 hover:border-indigo-400/40'
        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white';
    
    const sizeClass = size === 'sm' ? 'px-2 py-1 text-[10px]' : '';

    const inner = (
        <>
            <div className={`flex items-center justify-center ${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} rounded-full bg-black/20 text-indigo-400 group-hover:scale-110 transition-transform`}>
                <Icons.user size={size === 'sm' ? 10 : 12} />
            </div>
            <span className="truncate max-w-[120px]">{attribution.name}</span>
            {roleLabel && (
                <span className="opacity-40 font-medium px-1.5 border-l border-white/10 ml-0.5">
                    {roleLabel}
                </span>
            )}
            {href && (
                <span className={`transition-transform group-hover:translate-x-0.5 ${isInternal ? 'text-indigo-500/50' : 'text-white/20'}`}>
                    {isInternal ? <Icons.chevronRight size={10} /> : <Icons.external size={10} />}
                </span>
            )}
        </>
    );

    if (!href) {
        return <span className={`${baseClass} ${themeClass} ${sizeClass}`}>{inner}</span>;
    }

    if (isInternal) {
        return (
            <Link href={href} className={`${baseClass} ${themeClass} ${sizeClass}`}>
                {inner}
            </Link>
        );
    }

    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={`${baseClass} ${themeClass} ${sizeClass}`}>
            {inner}
        </a>
    );
}
