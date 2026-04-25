import { NextRequest, NextResponse } from 'next/server';
import { AuditService } from '@/lib/services/audit-service';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const { action, targetType, targetId, policySlug, message, details, status } = await req.json();

        await AuditService.log({
            actor: decodedToken.email as string,
            action: action || 'GENERIC_EVENT',
            targetType: targetType || 'system',
            targetId: targetId || 'global',
            policySlug,
            status: status || 'success',
            message: message || 'Event logged via API',
            details
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[AuditAPI] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
