import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
        return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    try {
        const noteDoc = await adminDb.collection('userNotes').doc(`${uid}_${params.resourceId}`).get();

        if (!noteDoc.exists) {
            return NextResponse.json({ success: true, data: { content: '' } });
        }

        return NextResponse.json({ success: true, data: noteDoc.data() });
    } catch (error: any) {
        console.error('Error fetching user note:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    try {
        const body = await request.json();
        const { uid, content } = body;

        if (!uid) {
            return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        const noteRef = adminDb.collection('userNotes').doc(`${uid}_${params.resourceId}`);
        await noteRef.set({
            uid,
            resourceId: params.resourceId,
            content,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating user note:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
