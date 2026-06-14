export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    try {
        const auth = getAdminAuth();
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth?.verifyIdToken(token);
        if (!decodedToken || !await isAdmin(decodedToken.uid)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const defaultDb = getDb('(default)');
        const db0 = getDb(process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0');

        if (!defaultDb || !db0) {
            return NextResponse.json({ success: false, error: 'Databases not available' }, { status: 500 });
        }

        const defaultSnap = await defaultDb.collection('resources').count().get();
        const db0Snap = await db0.collection('resources').count().get();

        return NextResponse.json({
            success: true,
            counts: {
                default: defaultSnap.data().count,
                active: db0Snap.data().count,
                node: process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0'
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = getAdminAuth();
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth?.verifyIdToken(token);
        if (!decodedToken || !await isAdmin(decodedToken.uid)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const defaultDb = getDb('(default)');
        const db0 = getDb(process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0');

        if (!defaultDb || !db0) {
            return NextResponse.json({ success: false, error: 'Databases not available' }, { status: 500 });
        }

        // Fetch all from default
        const snapshot = await defaultDb.collection('resources').get();
        const resources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (resources.length === 0) {
            return NextResponse.json({ success: true, message: 'No legacy resources found' });
        }

        // Batch write to db-0
        const batch = db0.batch();
        resources.forEach(res => {
            const { id, ...data } = res;
            const ref = db0.collection('resources').doc(id);
            batch.set(ref, data);
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: `Successfully reconciled ${resources.length} resources to ${process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0'}`
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
