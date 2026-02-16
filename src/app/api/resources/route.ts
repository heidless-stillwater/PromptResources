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
        const sortBy = searchParams.get('sortBy') || 'updatedAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

        let querySnapshot = await adminDb.collection('resources').get();
        let resources = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()?.toISOString() || null,
            updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || null,
        }));

        // Filtering
        if (platform) {
            resources = resources.filter((r: any) => r.platform === platform);
        }

        if (pricing) {
            resources = resources.filter((r: any) => r.pricing === pricing);
        }

        if (type) {
            resources = resources.filter((r: any) => r.type === type);
        }

        if (category) {
            resources = resources.filter((r: any) => r.categories?.includes(category));
        }

        if (search) {
            const term = search.toLowerCase();
            resources = resources.filter((r: any) =>
                r.title?.toLowerCase().includes(term) ||
                r.description?.toLowerCase().includes(term)
            );
        }

        // Sorting
        resources.sort((a: any, b: any) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            // Handle title case-insensitivity
            if (sortBy === 'title') {
                valA = valA?.toLowerCase() || '';
                valB = valB?.toLowerCase() || '';
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

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
            sortBy,
            sortOrder,
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
