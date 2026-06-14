export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    try {
        const snapshot = await adminDb.collection('resources')
            .where('title', '==', 'The Easy Way to Pick UI Colors')
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ success: false, message: 'Resource not found.' });
        }

        const batch = adminDb.batch();
        const ids: string[] = [];

        snapshot.docs.forEach(doc => {
            ids.push(doc.id);
            batch.update(doc.ref, {
                activeTicketId: null,
                reportType: null,
                status: 'published'
            });
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: `Found and cleared ${ids.length} resources matching title.`,
            clearedIds: ids
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
