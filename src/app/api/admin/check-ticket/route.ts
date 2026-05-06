import { NextResponse } from 'next/server';
import { accreditationDb } from '@/lib/firebase-admin';
import { sanitize } from '@/lib/utils';

export async function GET() {
    const tid = 'UlbqtosG29ZpknpBtpMD';
    try {
        const doc = await accreditationDb.collection('tickets').doc(tid).get();
        if (doc.exists) {
            return NextResponse.json({ success: true, data: sanitize(doc.data()) });
        }
        return NextResponse.json({ success: false, message: 'Ticket not found' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
