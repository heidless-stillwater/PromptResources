import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

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
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title')?.trim() || '';
    const url = searchParams.get('url')?.trim() || '';

    try {
        const ytId = url ? extractYouTubeId(url) : null;
        const queries: Promise<any>[] = [];

        // 1. Title match
        if (title) {
            queries.push(adminDb.collection('resources').where('title', '==', title).limit(3).get());
        } else {
            queries.push(Promise.resolve(null));
        }

        // 2. Exact URL match
        if (url) {
            queries.push(adminDb.collection('resources').where('url', '==', url).limit(3).get());
        } else {
            queries.push(Promise.resolve(null));
        }

        // 3. YouTube specific matches (if applicable)
        if (ytId) {
            // First check the explicit field
            queries.push(adminDb.collection('resources').where('youtubeVideoId', '==', ytId).limit(3).get());
            
            // Then check common URL variations to catch older records missing the ID field
            const variants = [
                `https://www.youtube.com/watch?v=${ytId}`,
                `https://youtube.com/watch?v=${ytId}`,
                `https://youtu.be/${ytId}`,
                `https://www.youtube.com/embed/${ytId}`,
                `https://www.youtube.com/shorts/${ytId}`
            ];
            variants.forEach(v => {
                if (v !== url) { // Already checked exact match
                    queries.push(adminDb.collection('resources').where('url', '==', v).limit(2).get());
                }
            });
        }

        const results = await Promise.all(queries);
        
        const matches: Array<{ id: string; title: string; url: string; matchType: 'title' | 'url' }> = [];
        const seenDocIds = new Set<string>();

        // Process title results (index 0)
        if (results[0]) {
            results[0].docs.forEach((d: any) => {
                matches.push({ id: d.id, title: d.data().title, url: d.data().url, matchType: 'title' });
                seenDocIds.add(d.id);
            });
        }

        // Process all other results (URL and YT variations)
        for (let i = 1; i < results.length; i++) {
            if (results[i]) {
                results[i].docs.forEach((d: any) => {
                    if (!seenDocIds.has(d.id)) {
                        matches.push({ id: d.id, title: d.data().title, url: d.data().url, matchType: 'url' });
                        seenDocIds.add(d.id);
                    }
                });
            }
        }

        return NextResponse.json({
            titleMatch: matches.some(m => m.matchType === 'title'),
            urlMatch: matches.some(m => m.matchType === 'url'),
            matches,
        });
    } catch (error: any) {
        console.error('Duplicate check error:', error);
        return NextResponse.json({ titleMatch: false, urlMatch: false, matches: [] });
    }
}


