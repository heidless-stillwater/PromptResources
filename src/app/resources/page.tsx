import React, { Suspense } from 'react';
import ResourcesClient from '@/components/ResourcesClient';
import { getResourcesAction, getAllCategories } from '@/lib/resources-server';

export const revalidate = 60; // 1-minute revalidation window

interface ResourcesPageProps {
    searchParams: {
        platform?: string;
        pricing?: string;
        type?: string;
        category?: string;
        search?: string;
        isFavorite?: string;
        sortBy?: string;
        sortOrder?: string;
        page?: string;
    };
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
    const platform = searchParams.platform || null;
    const pricing = searchParams.pricing || null;
    const type = searchParams.type || null;
    const category = searchParams.category || null;
    const search = searchParams.search || null;
    const isFavorite = searchParams.isFavorite === 'true';
    const sortBy = searchParams.sortBy || 'updatedAt';
    const sortOrder = (searchParams.sortOrder as 'asc' | 'desc') || 'desc';
    const page = parseInt(searchParams.page || '1');

    const [{ resources, total, hasMore }, categories] = await Promise.all([
        getResourcesAction({
            platform,
            pricing,
            type,
            category,
            search,
            isFavorite,
            sortBy,
            sortOrder,
            page,
            pageSize: 24, // Consistent page size
            userIsAdmin: false,
        }),
        getAllCategories(),
    ]);

    return (
        <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
            <ResourcesClient 
                initialResources={resources} 
                initialCategories={categories} 
                totalResources={total}
                hasMoreInitial={hasMore}
            />
        </Suspense>
    );
}
