import React from 'react';
import HomeClient from '@/components/HomeClient';
import { adminDb } from '@/lib/firebase-admin';
import { Resource, UserProfile } from '@/lib/types';
import { getAllCreators } from '@/lib/creators-server';
import { sanitize } from '@/lib/utils';

// Revalidate every hour
export const revalidate = 60;

export default async function HomePage() {
    let recentResources: Resource[] = [];
    let featuredCreators: UserProfile[] = [];
    let stats = { resources: 0, categories: 0, platforms: 6 };

    try {
        // Fetch recent resources
        const resourceSnap = await adminDb
            .collection('resources')
            .orderBy('createdAt', 'desc')
            .limit(6)
            .get();

        recentResources = resourceSnap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                status: 'published', // Default for legacy data
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
            };
        }) as Resource[];

        // Fetch featured creators
        featuredCreators = await getAllCreators({ featured: true, limit: 3 });

        // Fetch counts for stats
        const allResourcesSnap = await adminDb.collection('resources').count().get();
        const catSnap = await adminDb.collection('categories').get();
        
        stats = {
            resources: allResourcesSnap.data().count,
            categories: catSnap.size || 15,
            platforms: 6,
        };
    } catch (error) {
        console.error('Error fetching data on server:', error);
    }

    return <HomeClient recentResources={sanitize(recentResources)} featuredCreators={sanitize(featuredCreators)} />;
}
