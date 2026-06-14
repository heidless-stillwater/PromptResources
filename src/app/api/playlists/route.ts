export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { getPlaylistsAction, createPlaylistAction } from '@/lib/playlists-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const addedBy = searchParams.get('addedBy');
        const status = searchParams.get('status') as 'published' | 'private' | null;
        const userOnly = searchParams.get('userOnly') === 'true';
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '24'), 100);
        const sortBy = searchParams.get('sortBy') as 'title' | 'createdAt' | 'updatedAt' | 'ranking' | null;
        const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;
        const ranking = searchParams.get('ranking') ? parseInt(searchParams.get('ranking')!) : null;

        const decodedToken = await getAuthUser(request);
        const userUid = decodedToken?.uid || null;

        const userIsAdmin = userUid ? await isAdmin(userUid) : false;

        const { playlists, total, hasMore } = await getPlaylistsAction({
            search,
            addedBy,
            status,
            userOnly,
            page,
            pageSize,
            userUid,
            userIsAdmin,
            sortBy,
            sortOrder,
            ranking
        });

        return NextResponse.json({
            success: true,
            data: playlists,
            total,
            page,
            pageSize,
            hasMore
        });
    } catch (e: any) {
        console.error('[API Playlists] GET Error:', e);
        return NextResponse.json(
            { success: false, error: e.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        if (!body.title) {
            return NextResponse.json({ success: false, error: 'Playlist title is required' }, { status: 400 });
        }

        const newPlaylist = await createPlaylistAction(body, decodedToken.uid);

        return NextResponse.json({
            success: true,
            data: newPlaylist
        });
    } catch (e: any) {
        console.error('[API Playlists] POST Error:', e);
        return NextResponse.json(
            { success: false, error: e.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
