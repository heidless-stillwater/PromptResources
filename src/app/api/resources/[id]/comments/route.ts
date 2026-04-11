import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth-server';
import { FieldValue } from 'firebase-admin/firestore';
import { Comment } from '@/lib/types';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const resourceId = params.id;
        if (!resourceId) {
            return NextResponse.json({ success: false, error: 'Resource ID is required' }, { status: 400 });
        }

        const resourceRef = adminDb.collection('resources').doc(resourceId);
        const resourceSnap = await resourceRef.get();
        
        if (!resourceSnap.exists) {
             return NextResponse.json({ success: true, data: [], message: 'Resource not found, returning empty comments' });
        }

        const querySnapshot = await resourceRef.collection('comments').get();
        
        const comments = querySnapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
            };
        }) as Comment[];

        // Sort in memory for now
        comments.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
        });

        return NextResponse.json({ success: true, data: comments });
    } catch (error: any) {
        console.error('Error fetching comments:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const resourceId = params.id;
        const body = await request.json();
        const { userId, userName, userPhoto, content, rating } = body;

        // Security check: Ensure the body's userId matches the authenticated token
        if (userId !== decodedToken.uid) {
            return NextResponse.json({ success: false, error: 'User ID mismatch' }, { status: 403 });
        }

        if (!userId || !content) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const resourceRef = adminDb.collection('resources').doc(resourceId);
        const commentsRef = resourceRef.collection('comments');

        // Use a transaction for atomic rating updates
        const result = await adminDb.runTransaction(async (transaction) => {
            const resourceDoc = await transaction.get(resourceRef);
            if (!resourceDoc.exists) {
                throw new Error('Resource not found');
            }

            const resourceData = resourceDoc.data() || {};
            const currentCount = resourceData.reviewCount || 0;
            const currentAvg = resourceData.averageRating || 0;

            let newAvg = currentAvg;
            let newCount = currentCount;

            if (rating) {
                newCount = currentCount + 1;
                newAvg = ((currentAvg * currentCount) + rating) / newCount;
            }

            const newComment = {
                resourceId,
                userId,
                userName,
                userPhoto,
                content,
                rating: rating || null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            const docRef = commentsRef.doc();
            transaction.set(docRef, newComment);
            
            transaction.update(resourceRef, {
                averageRating: newAvg,
                reviewCount: newCount,
                updatedAt: FieldValue.serverTimestamp()
            });

            return { id: docRef.id, ...newComment };
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Error adding comment/review:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to add comment' }, { status: 500 });
    }
}
