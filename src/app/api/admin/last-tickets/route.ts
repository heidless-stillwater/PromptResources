export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { accreditationDb } from '@/lib/firebase-admin';
import { sanitize } from '@/lib/utils';

export async function GET() {
    try {
        const snap = await accreditationDb.collection('tickets')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
            
        const tickets = snap.docs.map((doc: any) => sanitize({
            id: doc.id,
            ...doc.data()
        }));
        
        return NextResponse.json({ success: true, tickets });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
