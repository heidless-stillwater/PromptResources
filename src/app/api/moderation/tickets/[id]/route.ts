import { NextResponse } from 'next/server';
import { accreditationDb } from '@/lib/firebase-admin';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params;

    try {
        const ticketDoc = await accreditationDb.collection('tickets').doc(id).get();
        if (!ticketDoc.exists) {
            return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: { id: ticketDoc.id, ...ticketDoc.data() }
        });
    } catch (error: any) {
        console.error('[ModerationTicketAPI] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
