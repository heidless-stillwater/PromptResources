import { NextRequest, NextResponse } from 'next/server';
import { accreditationDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        // Only allow admin to simulate drifts (or the specific test user)
        if (decodedToken.email !== 'heidlessemail18@gmail.com') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const policies = [
            {
                name: 'Online Safety Act 2023',
                slug: 'osa-drift',
                status: 'amber',
                targetApps: ['promptresources'],
                driftMessage: 'OSA Compliance Drift: Automated reporting telemetry is intermittent.',
                updatedAt: FieldValue.serverTimestamp()
            },
            {
                name: 'GDPR Data Sovereignty',
                slug: 'gdpr-drift',
                status: 'amber',
                targetApps: ['all'],
                driftMessage: 'GDPR Advisory: Cross-border data residency verification required.',
                updatedAt: FieldValue.serverTimestamp()
            }
        ];

        for (const policy of policies) {
            await accreditationDb.collection('policies').doc(policy.slug).set(policy);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[TestDriftAPI] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(token);

        // Clear the test policies
        const osaRef = accreditationDb.collection('policies').doc('osa-drift');
        const gdprRef = accreditationDb.collection('policies').doc('gdpr-drift');
        
        await osaRef.delete();
        await gdprRef.delete();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
