import { NextRequest, NextResponse } from 'next/server';
import { ModerationService } from '@/lib/services/moderation-service';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const { resourceId, reason, details, userName } = await req.json();

        if (!resourceId || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await ModerationService.flagResource({
            resourceId,
            userId: decodedToken.uid,
            userName: userName || (decodedToken.name as string),
            userEmail: decodedToken.email as string,
            userRole: (decodedToken.role as string) || 'member',
            reason,
            details
        });

        if (result.success) {
            return NextResponse.json({ success: true, flagId: result.flagId });
        } else {
            return NextResponse.json({ success: false, error: 'Failed to submit flag' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[FlagAPI] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
