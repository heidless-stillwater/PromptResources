import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { FieldPath } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        const decodedToken = await getAuthUser(request);
        const userUid = decodedToken?.uid;
        const userIsAdmin = userUid ? await isAdmin(userUid) : false;

        const resources: any[] = [];
        
        // Firestore 'in' queries are limited to 30 items
        const chunkSize = 30;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const snapshot = await adminDb.collection('resources')
                .where(FieldPath.documentId(), 'in', chunk)
                .get();
                
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Access Control: Must be published OR be the owner OR be an admin
                if (userIsAdmin || data.status === 'published' || (userUid && data.addedBy === userUid)) {
                    resources.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate()?.toISOString() || null,
                        updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
                    });
                }
            });
        }

        return NextResponse.json({ success: true, data: resources });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
