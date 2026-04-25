import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import * as assetsServer from '@/lib/assets-server';
import { ComplianceService } from '@/lib/services/compliance-service';

export async function GET(request: NextRequest) {
    try {
        // Active Compliance Gating
        const gate = await ComplianceService.verifySovereignGate();
        if (gate.gated) {
             return NextResponse.json({ 
                success: false, 
                error: gate.message,
                gated: true 
            }, { status: 403 });
        }

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
        // Active Compliance Gating
        const gate = await ComplianceService.verifySovereignGate();
        if (gate.gated) {
             return NextResponse.json({ 
                success: false, 
                error: gate.message,
                gated: true 
            }, { status: 403 });
        }

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
