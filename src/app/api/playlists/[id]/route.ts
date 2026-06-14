export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { getPlaylistById, updatePlaylistAction, deletePlaylistAction } from '@/lib/playlists-server';

interface RouteContext {
    params: {
        id: string;
    };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const decodedToken = await getAuthUser(request);
        const userUid = decodedToken?.uid || null;
        const userIsAdmin = userUid ? await isAdmin(userUid) : false;

        const playlist = await getPlaylistById(params.id, userUid, userIsAdmin);

        if (!playlist) {
            return NextResponse.json({ success: false, error: 'Playlist not found or private' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: playlist
        });
    } catch (e: any) {
        console.error('[API Playlists ID] GET Error:', e);
        return NextResponse.json(
            { success: false, error: e.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const userIsAdmin = await isAdmin(decodedToken.uid);

        const updatedPlaylist = await updatePlaylistAction(
            params.id,
            body,
            decodedToken.uid,
            userIsAdmin
        );

        return NextResponse.json({
            success: true,
            data: updatedPlaylist
        });
    } catch (e: any) {
        console.error('[API Playlists ID] PATCH Error:', e);
        return NextResponse.json(
            { success: false, error: e.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userIsAdmin = await isAdmin(decodedToken.uid);
        await deletePlaylistAction(params.id, decodedToken.uid, userIsAdmin);

        return NextResponse.json({
            success: true,
            message: 'Playlist deleted successfully'
        });
    } catch (e: any) {
        console.error('[API Playlists ID] DELETE Error:', e);
        return NextResponse.json(
            { success: false, error: e.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
