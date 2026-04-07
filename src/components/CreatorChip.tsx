'use client';

import React from 'react';
import Link from 'next/link';
import { Attribution } from '@/lib/types';

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
        ? `/creators/${attribution.userId}`   // will be redirected to slug via profile lookup
        : attribution.url;

    const roleLabel = attribution.role
        ? attribution.role.charAt(0).toUpperCase() + attribution.role.slice(1)
        : null;

    const chipClass = `creator-chip creator-chip--${size}${isInternal ? ' creator-chip--internal' : ''}`;

    const inner = (
        <>
            <span className="creator-chip-avatar">👤</span>
            <span className="creator-chip-name">{attribution.name}</span>
            {roleLabel && <span className="creator-chip-role">{roleLabel}</span>}
            {!isInternal && showExternalIcon && attribution.url && (
                <span className="creator-chip-ext">↗</span>
            )}
            {isInternal && <span className="creator-chip-ext">→</span>}
        </>
    );

    if (!href) {
        return <span className={chipClass}>{inner}</span>;
    }

    if (isInternal) {
        return (
            <Link href={href} className={chipClass}>
                {inner}
            </Link>
        );
    }

    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={chipClass}>
            {inner}
        </a>
    );
}
