import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    try {
        const categoriesSnap = await adminDb.collection('categories').get();
        const categories = categoriesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

        return NextResponse.json({ success: true, data: categories });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken || !(await isAdmin(decodedToken.uid))) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        if (!body.name) {
            return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
        }

        const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
        const newCategory = {
            name: body.name,
            slug,
            description: body.description || '',
            icon: body.icon || '📂',
            updatedAt: new Date()
        };

        const docRef = await adminDb.collection('categories').add(newCategory);
        return NextResponse.json({ success: true, id: docRef.id });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
