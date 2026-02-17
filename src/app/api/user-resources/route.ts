import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// GET /api/user-resources?uid=...
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uid = searchParams.get('uid');

        if (!uid) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        const userResRef = adminDb.collection('userResources').doc(uid);
        const userResSnap = await userResRef.get();

        if (!userResSnap.exists) {
            return NextResponse.json({
                success: true,
                data: {
                    savedResources: [],
                    notes: {},
                    progress: {}
                }
            });
        }

        return NextResponse.json({
            success: true,
            data: userResSnap.data()
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/user-resources
// Body: { uid, resourceId, action: 'save' | 'unsave' | 'progress', status?: string }
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { uid, resourceId, action, status } = body;

        if (!uid || !resourceId || !action) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const userResRef = adminDb.collection('userResources').doc(uid);
        const userResSnap = await userResRef.get();

        let data: any = userResSnap.exists ? userResSnap.data() : {
            savedResources: [],
            notes: {},
            progress: {}
        };

        if (action === 'save') {
            if (!data.savedResources.includes(resourceId)) {
                data.savedResources.push(resourceId);
            }
        } else if (action === 'unsave') {
            data.savedResources = data.savedResources.filter((id: string) => id !== resourceId);
        } else if (action === 'progress' && status) {
            data.progress = data.progress || {};
            data.progress[resourceId] = status;
        }

        await userResRef.set(data, { merge: true });

        return NextResponse.json({
            success: true,
            data: data
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
