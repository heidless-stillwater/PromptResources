'use client';

import React from 'react';

// ============================================
// Base Skeleton Primitive
// ============================================

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse rounded-lg bg-white/5 ${className}`}
            style={style}
        />
    );
}

// ============================================
// Skeleton Card — for image grids / resource grids
// ============================================

export function SkeletonCard({ aspectRatio = '1/1' }: { aspectRatio?: string }) {
    return (
        <div className="rounded-xl overflow-hidden border border-white/5 bg-white/[0.02]">
            <Skeleton
                className="w-full"
                style={{ aspectRatio }}
            />
            <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full mt-4" />
                <Skeleton className="h-3 w-2/3" />
            </div>
        </div>
    );
}

// ============================================
// Skeleton Grid — for gallery / resource views
// ============================================

export function SkeletonGrid({
    count = 8,
    columns = 4,
    aspectRatio = '4/3', // default to standard resource aspect ratio
}: {
    count?: number;
    columns?: number;
    aspectRatio?: string;
}) {
    return (
        <div className="resource-grid">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} aspectRatio={aspectRatio} />
            ))}
        </div>
    );
}

// ============================================
// Skeleton Header — for page headers
// ============================================

export function SkeletonHeader() {
    return (
        <div className="space-y-3 mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
        </div>
    );
}

// ============================================
// Skeleton Feed — for community feed view
// ============================================

export function SkeletonFeedItem() {
    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
            <Skeleton className="w-full" style={{ aspectRatio: '16/10' }} />
            <div className="p-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-4 pt-2">
                    <Skeleton className="h-8 w-16 rounded-lg" />
                    <Skeleton className="h-8 w-16 rounded-lg" />
                    <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

export function SkeletonFeed({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonFeedItem key={i} />
            ))}
        </div>
    );
}

// ============================================
// Skeleton Stats — for dashboard stat cards
// ============================================

export function SkeletonStatCard() {
    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
        </div>
    );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonStatCard key={i} />
            ))}
        </div>
    );
}

// ============================================
// Skeleton Profile — for creator profile cards
// ============================================

export function SkeletonProfile() {
    return (
        <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-60" />
            </div>
        </div>
    );
}
