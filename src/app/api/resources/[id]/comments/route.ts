import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { Comment, Review } from '@/lib/types';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const resourceId = params.id;
        if (!resourceId) {
            return NextResponse.json({ success: false, error: 'Resource ID is required' }, { status: 400 });
        }

        // Check if resource exists before fetching comments to avoid 500s on parent misses
        const resourceRef = doc(db, 'resources', resourceId);
        const resourceSnap = await getDoc(resourceRef);
        
        if (!resourceSnap.exists()) {
             return NextResponse.json({ success: true, data: [], message: 'Resource not found, returning empty comments' });
        }

        const commentsRef = collection(db, 'resources', resourceId, 'comments');
        const querySnapshot = await getDocs(query(commentsRef));
        
        const comments = querySnapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
            };
        }) as Comment[];

        // Sort in memory for now
        comments.sort((a: any, b: any) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
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
        const resourceId = params.id;
        const body = await request.json();
        const { userId, userName, userPhoto, content, rating } = body;

        if (!userId || !content) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const commentsRef = collection(db, 'resources', resourceId, 'comments');
        const resourceRef = doc(db, 'resources', resourceId);

        // Use a transaction to update rating and add comment atomically
        const result = await runTransaction(db, async (transaction) => {
            const resourceDoc = await transaction.get(resourceRef);
            if (!resourceDoc.exists()) {
                throw new Error('Resource not found');
            }

            const resourceData = resourceDoc.data();
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
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const docRef = await addDoc(commentsRef, newComment);
            
            transaction.update(resourceRef, {
                averageRating: newAvg,
                reviewCount: newCount,
                updatedAt: serverTimestamp()
            });

            return { id: docRef.id, ...newComment };
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Error adding comment/review:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to add comment' }, { status: 500 });
    }
}
