// API: GET /api/resources - List resources with optional filtering
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { getResourcesAction } from '@/lib/resources-server';

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

        const now = new Date();
        const docData = {
            ...body,
            addedBy: decodedToken.uid,
            thumbnailUrl: body.thumbnailUrl || null,
            createdAt: now,
            updatedAt: now,
            status: isAdminUser ? (body.status || 'published') : (['draft', 'suggested'].includes(body.status) ? body.status : 'suggested'),
            isFavorite: isAdminUser ? (body.isFavorite || false) : false,
            rank: isAdminUser ? (body.rank || null) : null,
        };

        const docRef = await adminDb.collection('resources').add(docData);

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
