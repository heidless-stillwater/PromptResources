import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, accreditationDb, toolDbAdmin } from '@/lib/firebase-admin';
import { StrikesService } from '@/lib/services/strikes-service';

/**
 * Moderation Resolution API
 * Allows admins to Reinstate or Archive flagged content and resolve linked tickets.
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

        const { resourceId, ticketId, action } = await req.json();

        if (!resourceId || !ticketId || !action) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        console.log(`[ModerationAPI] Resolving Ticket ${ticketId} for Resource ${resourceId} with Action: ${action}`);

        if (action === 'reinstate') {
            // 1. Update Resource
            await adminDb.collection('resources').doc(resourceId).update({
                status: 'published',
                reportType: null,
                updatedAt: new Date()
            });

            // 2. Remove Strike
            const resourceDoc = await adminDb.collection('resources').doc(resourceId).get();
            const authorId = resourceDoc.data()?.addedBy;
            if (authorId) {
                await StrikesService.removeStrike(authorId);
            }

            // 3. Resolve Ticket in Accreditation
            await accreditationDb.collection('tickets').doc(ticketId).update({
                status: 'resolved',
                updatedAt: new Date(),
                'remediation.resolvedAt': new Date(),
                'remediation.resolvedBy': decodedToken.email,
                'remediation.notes': `Resource administratively reinstated. Contributor strike removed.`
            });

        } else if (action === 'archive') {
            // 1. Update Resource
            await adminDb.collection('resources').doc(resourceId).update({
                status: 'tainted',
                updatedAt: new Date()
            });

            // 2. Resolve Ticket in Accreditation
            await accreditationDb.collection('tickets').doc(ticketId).update({
                status: 'resolved',
                updatedAt: new Date(),
                'remediation.resolvedAt': new Date(),
                'remediation.resolvedBy': decodedToken.email,
                'remediation.notes': `Resource archived as "tainted". Strike remains active.`
            });
        } else {
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[ModerationAPI] Resolution Failed:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
