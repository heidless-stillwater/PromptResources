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
    const decodedToken = await getAuthUser(request);
    if (!decodedToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(decodedToken.uid);

    try {
        // Scope the query:
        // - Regular users: only their own resources (addedBy == uid)
        // - Admins: all resources, but we bucket per-user before deduping
        //   so cross-user matches are NEVER flagged as duplicates.
        let query: FirebaseFirestore.Query = adminDb.collection('resources');
        if (!userIsAdmin) {
            query = query.where('addedBy', '==', decodedToken.uid);
        }

        const snapshot = await query.get();

        const resourcesByUser: Record<string, any[]> = {};
        const backfillPromises: Promise<any>[] = [];

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            const owner = data.addedBy || '__unknown__';

            const extractedId = data.url ? extractYouTubeId(data.url) : null;
            const existingId = data.youtubeVideoId;

            const res = {
                id,
                title: data.title || '',
                url: data.url || '',
                youtubeVideoId: extractedId || existingId || null,
                addedBy: owner,
            };

            if (!resourcesByUser[owner]) resourcesByUser[owner] = [];
            resourcesByUser[owner].push(res);

            // Backfill YouTube ID if inconsistent
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

        const duplicates: any[] = [];

        // Scan for duplicates within each user's own bucket only
        for (const userResources of Object.values(resourcesByUser)) {
            const urlGroups: Record<string, typeof userResources> = {};
            const titleGroups: Record<string, typeof userResources> = {};
            const ytGroups: Record<string, typeof userResources> = {};

            userResources.forEach(res => {
                if (res.url) {
                    const key = res.url.trim().toLowerCase();
                    if (!urlGroups[key]) urlGroups[key] = [];
                    urlGroups[key].push(res);
                }
                if (res.title) {
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

            // 1. YouTube clusters (strongest signal)
            Object.entries(ytGroups).forEach(([key, items]) => {
                if (items.length > 1) duplicates.push({ type: 'youtube', key, items });
            });

            // 2. URL clusters (skip if already covered by YT)
            Object.entries(urlGroups).forEach(([key, items]) => {
                if (items.length > 1) {
                    const coveredByYt = duplicates.some(d =>
                        d.type === 'youtube' &&
                        items.every((i: any) => d.items.find((u: any) => u.id === i.id))
                    );
                    if (!coveredByYt) duplicates.push({ type: 'url', key, items });
                }
            });

            // 3. Title clusters (skip if already covered)
            Object.entries(titleGroups).forEach(([key, items]) => {
                if (items.length > 1) {
                    const covered = duplicates.some(d =>
                        d.items.length >= items.length &&
                        items.every((i: any) => d.items.find((u: any) => u.id === i.id))
                    );
                    if (!covered) duplicates.push({ type: 'title', key, items });
                }
            });
        }

        console.log(`[Dedup] Found ${duplicates.length} duplicate clusters (per-user scoped).`);
        return NextResponse.json({ duplicates });
    } catch (error: any) {
        console.error('Scan duplicates error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
