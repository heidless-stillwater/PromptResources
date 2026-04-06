import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';

function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/, // Direct ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export async function GET(request: NextRequest) {
    // Only admins can scan the full collection
    const decodedToken = await getAuthUser(request);
    if (!decodedToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userIsAdmin = await isAdmin(decodedToken.uid);
    if (!userIsAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const snapshot = await adminDb.collection('resources').get();
        const allResources: any[] = [];
        const backfillPromises: Promise<any>[] = [];

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            // Always extract from URL to ensure clustering key is consistent
            const extractedId = data.url ? extractYouTubeId(data.url) : null;
            const existingId = data.youtubeVideoId;

            const res = {
                id,
                title: data.title || '',
                url: data.url || '',
                description: data.description || '',
                youtubeVideoId: extractedId || existingId || null,
            };

            allResources.push(res);

            // Backfill or update if DB field is missing or inconsistent with current URL
            if (extractedId && extractedId !== existingId) {
                backfillPromises.push(
                    adminDb.collection('resources').doc(id).update({
                        youtubeVideoId: extractedId,
                        updatedAt: new Date()
                    })
                );
            }
        });

        if (backfillPromises.length > 0) {
            console.log(`[Dedup] Auto-healing ${backfillPromises.length} YouTube ID fields...`);
            await Promise.all(backfillPromises);
        }

        const urlGroups: Record<string, typeof allResources> = {};
        const titleGroups: Record<string, typeof allResources> = {};
        const ytGroups: Record<string, typeof allResources> = {};

        allResources.forEach(res => {
            if (res.url) {
                const key = res.url.trim().toLowerCase();
                if (!urlGroups[key]) urlGroups[key] = [];
                urlGroups[key].push(res);
            }
            if (res.title) {
                // More aggressive title normalization for clustering
                const key = res.title.trim().toLowerCase().replace(/\s+/g, ' ');
                if (!titleGroups[key]) titleGroups[key] = [];
                titleGroups[key].push(res);
            }
            if (res.youtubeVideoId) {
                const key = res.youtubeVideoId;
                if (!ytGroups[key]) ytGroups[key] = [];
                ytGroups[key].push(res);
            }
        });

        const duplicates: any[] = [];

        // 1. YouTube Clusters (Strongest Match)
        Object.entries(ytGroups).forEach(([key, items]) => {
            if (items.length > 1) {
                duplicates.push({ type: 'youtube', key, items });
            }
        });

        // 2. URL Clusters (where not already covered by YT)
        Object.entries(urlGroups).forEach(([key, items]) => {
            if (items.length > 1) {
                const coveredByYt = duplicates.some(d => 
                    d.type === 'youtube' && 
                    items.every(i => d.items.find((u: any) => u.id === i.id))
                );
                if (!coveredByYt) {
                    duplicates.push({ type: 'url', key, items });
                }
            }
        });

        // 3. Title Clusters
        Object.entries(titleGroups).forEach(([key, items]) => {
            if (items.length > 1) {
                const covered = duplicates.some(d =>
                    d.items.length >= items.length &&
                    items.every(i => d.items.find((u: any) => u.id === i.id))
                );
                if (!covered) {
                    duplicates.push({ type: 'title', key, items });
                }
            }
        });

        console.log(`[Dedup] Scan complete. Found ${duplicates.length} duplicate clusters.`);
        return NextResponse.json({ duplicates });
    } catch (error: any) {
        console.error('Scan duplicates error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

