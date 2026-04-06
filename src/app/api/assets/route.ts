import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import * as assetsServer from '@/lib/assets-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tags = searchParams.get('tags')?.split(',').filter(Boolean);
        
        const assets = await assetsServer.getThumbnailAssets(tags);
        return NextResponse.json({ success: true, data: assets });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        
        const admin = await isAdmin(decodedToken.uid);
        if (!admin) return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });

        const body = await request.json();
        const assetId = await assetsServer.createThumbnailAsset({
            ...body,
            addedBy: decodedToken.uid
        });

        return NextResponse.json({ success: true, id: assetId });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
