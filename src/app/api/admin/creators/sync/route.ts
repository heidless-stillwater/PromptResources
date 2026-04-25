import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { syncCreatorStats } from '@/lib/creators-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken || !(await isAdmin(decodedToken.uid))) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { userId } = await request.json();
        if (!userId) {
            return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
        }

        await syncCreatorStats(userId);

        return NextResponse.json({ success: true, message: `Stats synced for ${userId}` });
    } catch (error: any) {
        console.error('Creator Sync API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
