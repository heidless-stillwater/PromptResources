import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAllCreators } from '@/lib/creators-server';
import { isAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(idToken);
        
        if (!await isAdmin(decoded.uid)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        // Use the high-fidelity server-side logic that includes stubs and resource-scanned creators
        const creators = await getAllCreators({ limit: 1000 });
        
        return NextResponse.json({ success: true, creators });
    } catch (e: any) {
        console.error('[API] /admin/creators Error:', e.message);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
