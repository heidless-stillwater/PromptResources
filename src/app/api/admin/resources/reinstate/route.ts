import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, toolDbAdmin } from '@/lib/firebase-admin';
import { StrikesService } from '@/lib/services/strikes-service';

/**
 * Admin Reinstate API
 * Allows administrators to reinstate tainted/flagged resources and optionally reset contributor strikes.
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        // Verify Admin status
        const userDoc = await toolDbAdmin.collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists || !userDoc.data()?.isAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { resourceId, resetStrike } = await req.json();

        if (!resourceId) {
            return NextResponse.json({ success: false, error: 'Missing resourceId' }, { status: 400 });
        }

        console.log(`[AdminAPI] Reinstating Resource ${resourceId}. Reset Strike: ${resetStrike}`);

        // 1. Update Resource
        await adminDb.collection('resources').doc(resourceId).update({
            status: 'published',
            reportType: null, // Clear any safety concern flag
            updatedAt: new Date()
        });

        // 2. Optional Strike Management
        if (resetStrike) {
            const resourceDoc = await adminDb.collection('resources').doc(resourceId).get();
            const authorId = resourceDoc.data()?.addedBy;
            if (authorId) {
                await StrikesService.removeStrike(authorId);
                console.log(`[AdminAPI] Strike removed for user ${authorId}`);
            }
        }

        return NextResponse.json({ success: true, message: 'Resource reinstated successfully.' });

    } catch (error: any) {
        console.error('[AdminAPI] Reinstate Failed:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
