// API: GET /api/resources - List resources with optional filtering
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { getResourcesAction } from '@/lib/resources-server';
import { revalidatePath } from 'next/cache';
import { extractYouTubeId } from '@/lib/youtube';
import { resolveAttributions, syncCreatorStats } from '@/lib/creators-server';
import { generateSearchKeywords } from '@/lib/utils';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get('platform');
        const pricing = searchParams.get('pricing');
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const search = searchParams.get('search');
        const addedBy = searchParams.get('addedBy');
        const isFavorite = searchParams.get('isFavorite') === 'true';
        const sortBy = searchParams.get('sortBy') || 'updatedAt';
        const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

        const decodedToken = await getAuthUser(request);
        const userUid = decodedToken?.uid;
        const userIsAdmin = userUid ? await isAdmin(userUid) : false;

        const { resources, total, hasMore } = await getResourcesAction({
            platform,
            pricing,
            type,
            category,
            search,
            addedBy,
            isFavorite,
            sortBy,
            sortOrder,
            page,
            pageSize,
            userUid,
            userIsAdmin,
        });

        return NextResponse.json({
            success: true,
            data: resources,
            total,
            page,
            pageSize,
            hasMore,
            sortBy,
            sortOrder,
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const isAdminUser = await isAdmin(decodedToken.uid);
        const body = await request.json();

        // Basic validation
        if (!body.title || !body.url) {
            return NextResponse.json(
                { success: false, error: 'Title and URL are required' },
                { status: 400 }
            );
        }

        let finalAttributions = body.attributions || [];
        let attributedUserIds: string[] = [];

        if (finalAttributions.length > 0) {
            const resolved = await resolveAttributions(finalAttributions);
            finalAttributions = resolved.resolvedAttributions;
            attributedUserIds = resolved.attributedUserIds;
        }

        const now = new Date();
        const docData = {
            ...body,
            attributions: finalAttributions,
            attributedUserIds,
            addedBy: decodedToken.uid,
            youtubeVideoId: body.url ? extractYouTubeId(body.url) : null,
            thumbnailUrl: body.thumbnailUrl || null,
            searchKeywords: generateSearchKeywords(body.title, body.categories),
            createdAt: now,
            updatedAt: now,
            status: isAdminUser ? (body.status || 'published') : (['draft', 'suggested'].includes(body.status) ? body.status : 'suggested'),
            isFavorite: isAdminUser ? (body.isFavorite ?? null) : false,
            rank: isAdminUser ? (body.rank || null) : null,
            notes: body.notes?.trim() || null,
            adminNotes: body.adminNotes?.trim() || null,
        };

        const docRef = await adminDb.collection('resources').add(docData);
        
        // Revalidate listing pages to show new prompt immediately
        revalidatePath('/resources', 'page');
        revalidatePath('/', 'page');
        revalidatePath('/resources');
        revalidatePath('/');
        
        // Sync stats for attributed creators in the background (fire and forget)
        if (attributedUserIds.length > 0) {
            Promise.all(attributedUserIds.map(uid => syncCreatorStats(uid)))
                .catch(e => console.error('Error syncing creator stats after POST:', e));
        }

        return NextResponse.json({
            success: true,
            id: docRef.id,
            data: {
                ...docData,
                id: docRef.id,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            }
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
