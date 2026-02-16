// API: GET /api/resources/[id] - Get a single resource by ID
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const docRef = adminDb.collection('resources').doc(params.id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json(
                { success: false, error: 'Resource not found' },
                { status: 404 }
            );
        }

        const data = docSnap.data();
        const resource = {
            id: docSnap.id,
            ...data,
            createdAt: data?.createdAt?.toDate()?.toISOString() || null,
            updatedAt: data?.updatedAt?.toDate()?.toISOString() || null,
        };

        return NextResponse.json({
            success: true,
            data: resource,
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
