import React, { Suspense } from 'react';
import ResourcesClient from '@/components/ResourcesClient';
import { getResourcesAction, getAllCategories } from '@/lib/resources-server';
import { sanitize } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ResourcesPageProps {
    searchParams: {
        platform?: string;
        pricing?: string;
        type?: string;
        category?: string;
        search?: string;
        isFavorite?: string;
        priorityRank?: string;
        sortBy?: string;
        sortOrder?: string;
        page?: string;
        pageSize?: string;
        creators?: string;
        registryActive?: string;
    };
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
    const platform = searchParams.platform || null;
    const pricing = searchParams.pricing || null;
    const type = searchParams.type || null;
    const category = searchParams.category || null;
    const search = searchParams.search || null;
    const isFavorite = searchParams.isFavorite === 'true';
    const priorityRank = searchParams.priorityRank || '';
    const sortBy = searchParams.sortBy || 'updatedAt';
    const sortOrder = (searchParams.sortOrder as 'asc' | 'desc') || 'desc';
    const page = parseInt(searchParams.page || '1');
    const pageSize = Math.min(parseInt(searchParams.pageSize || '96'), 96);
    const registryActive = searchParams.registryActive !== 'false';
    const creators = (registryActive && searchParams.creators) ? searchParams.creators.split(',').filter(Boolean) : null;

    const [{ resources, total, hasMore }, categories] = await Promise.all([
        getResourcesAction({
            platform,
            pricing,
            type,
            category,
            search,
            isFavorite,
            priorityRank,
            sortBy,
            sortOrder,
            page,
            creators,
            pageSize,
            userIsAdmin: false,
        }),
        getAllCategories(),
    ]);

    return (
        <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
            <ResourcesClient 
                initialResources={sanitize(resources)} 
                initialCategories={sanitize(categories)} 
                totalResources={total}
                hasMoreInitial={hasMore}
            />
        </Suspense>
    );
}
