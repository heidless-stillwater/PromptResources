import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { sanitize } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// GET: Fetch all master tags
export async function GET(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const tagsSnap = await adminDb.collection('resourceTags').get();
        const tags = tagsSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            count: doc.data().count || 0,
        }));

        // Sort by count descending, then by name alphabetically
        tags.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        return NextResponse.json({
            success: true,
            data: sanitize(tags)
        });
    } catch (error: any) {
        console.error('Error fetching tags:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: Add a new master tag (Admin only)
export async function POST(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const isUserAdmin = await isAdmin(decodedToken.uid);
        if (!isUserAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const cleanName = body.name?.trim();
        if (!cleanName) {
            return NextResponse.json({ success: false, error: 'Tag name is required' }, { status: 400 });
        }

        // Check if exists
        const querySnap = await adminDb.collection('resourceTags')
            .where('name', '==', cleanName)
            .limit(1)
            .get();

        if (!querySnap.empty) {
            return NextResponse.json({ success: false, error: 'Tag already exists' }, { status: 400 });
        }

        const docRef = adminDb.collection('resourceTags').doc();
        const docData = {
            name: cleanName,
            count: 0,
            userId: decodedToken.uid,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await docRef.set(docData);

        return NextResponse.json({
            success: true,
            data: {
                id: docRef.id,
                ...docData
            }
        });
    } catch (error: any) {
        console.error('Error creating tag:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PATCH: Rename an existing master tag (Admin only)
export async function PATCH(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const isUserAdmin = await isAdmin(decodedToken.uid);
        if (!isUserAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name } = body;
        const cleanName = name?.trim();
        
        if (!id || !cleanName) {
            return NextResponse.json({ success: false, error: 'ID and new name are required' }, { status: 400 });
        }

        const docRef = adminDb.collection('resourceTags').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
        }

        const oldName = docSnap.data()?.name;

        // Check if name is already taken by another document
        const duplicateSnap = await adminDb.collection('resourceTags')
            .where('name', '==', cleanName)
            .limit(1)
            .get();

        if (!duplicateSnap.empty && duplicateSnap.docs[0].id !== id) {
            return NextResponse.json({ success: false, error: 'Another tag with this name already exists' }, { status: 400 });
        }

        // 1. Update master tag document
        await docRef.update({
            name: cleanName,
            updatedAt: new Date()
        });

        // 2. Background sync: rename this tag in all resources that use it
        if (oldName && oldName !== cleanName) {
            const resourcesSnap = await adminDb.collection('resources')
                .where('tags', 'array-contains', oldName)
                .get();

            if (!resourcesSnap.empty) {
                const batch = adminDb.batch();
                resourcesSnap.docs.forEach(doc => {
                    const currentTags: string[] = doc.data().tags || [];
                    const updatedTags = currentTags.map(t => t === oldName ? cleanName : t);
                    batch.update(doc.ref, { 
                        tags: updatedTags,
                        updatedAt: new Date()
                    });
                });
                await batch.commit();
            }
        }

        return NextResponse.json({
            success: true,
            data: { id, name: cleanName }
        });
    } catch (error: any) {
        console.error('Error updating tag:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE: Delete a tag from the master list (Admin only)
export async function DELETE(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const isUserAdmin = await isAdmin(decodedToken.uid);
        if (!isUserAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Tag ID is required' }, { status: 400 });
        }

        const docRef = adminDb.collection('resourceTags').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
        }

        const tagName = docSnap.data()?.name;

        // 1. Delete master tag document
        await docRef.delete();

        // 2. Background sync: remove this tag from all resources
        if (tagName) {
            const resourcesSnap = await adminDb.collection('resources')
                .where('tags', 'array-contains', tagName)
                .get();

            if (!resourcesSnap.empty) {
                const batch = adminDb.batch();
                resourcesSnap.docs.forEach(doc => {
                    const currentTags: string[] = doc.data().tags || [];
                    const updatedTags = currentTags.filter(t => t !== tagName);
                    batch.update(doc.ref, { 
                        tags: updatedTags,
                        updatedAt: new Date()
                    });
                });
                await batch.commit();
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Tag deleted globally'
        });
    } catch (error: any) {
        console.error('Error deleting tag:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
