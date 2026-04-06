import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import * as assetsServer from '@/lib/assets-server';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        
        const admin = await isAdmin(decodedToken.uid);
        if (!admin) return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });

        await assetsServer.deleteThumbnailAsset(params.id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        
        const admin = await isAdmin(decodedToken.uid);
        if (!admin) return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });

        const body = await request.json();
        await assetsServer.updateThumbnailAsset(params.id, body);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
