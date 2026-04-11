import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken || !(await isAdmin(decodedToken.uid))) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const updateData: any = {};
        if (body.name) updateData.name = body.name;
        if (body.slug) updateData.slug = body.slug;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.icon) updateData.icon = body.icon;
        updateData.updatedAt = new Date();

        await adminDb.collection('categories').doc(params.id).update(updateData);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken || !(await isAdmin(decodedToken.uid))) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await adminDb.collection('categories').doc(params.id).delete();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
