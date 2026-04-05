import React from 'react';
import HomeClient from '@/components/HomeClient';
import { adminDb } from '@/lib/firebase-admin';
import { Resource } from '@/lib/types';

// Revalidate every hour
export const revalidate = 60;

export default async function HomePage() {
    let recentResources: Resource[] = [];
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
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
            };
        }) as Resource[];

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

    return <HomeClient recentResources={recentResources as any} />;
}
