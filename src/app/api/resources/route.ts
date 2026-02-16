// API: GET /api/resources - List resources with optional filtering
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get('platform');
        const pricing = searchParams.get('pricing');
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

        let query: FirebaseFirestore.Query = adminDb.collection('resources')
            .orderBy('createdAt', 'desc');

        if (platform) {
            query = query.where('platform', '==', platform);
        }

        if (pricing) {
            query = query.where('pricing', '==', pricing);
        }

        if (type) {
            query = query.where('type', '==', type);
        }

        const snapshot = await query.get();
        let resources = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()?.toISOString() || null,
            updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || null,
        }));

        // Client-side filtering for category (Firestore doesn't support array-contains with other where clauses easily)
        if (category) {
            resources = resources.filter((r: any) => r.categories?.includes(category));
        }

        // Search filter
        if (search) {
            const term = search.toLowerCase();
            resources = resources.filter((r: any) =>
                r.title?.toLowerCase().includes(term) ||
                r.description?.toLowerCase().includes(term)
            );
        }

        const total = resources.length;
        const start = (page - 1) * pageSize;
        const paginatedResources = resources.slice(start, start + pageSize);

        return NextResponse.json({
            success: true,
            data: paginatedResources,
            total,
            page,
            pageSize,
            hasMore: start + pageSize < total,
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
