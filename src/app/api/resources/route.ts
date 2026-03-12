// API: GET /api/resources - List resources with optional filtering
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser, isAdmin } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get('platform');
        const pricing = searchParams.get('pricing');
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const search = searchParams.get('search');
        const addedBy = searchParams.get('addedBy');
        const isFavorite = searchParams.get('isFavorite') === 'true';
        const sortBy = searchParams.get('sortBy') || 'updatedAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

        const decodedToken = await getAuthUser(request);
        const userUid = decodedToken?.uid;
        const userIsAdmin = userUid ? await isAdmin(userUid) : false;

        let querySnapshot = await adminDb.collection('resources').get();
        let resources = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()?.toISOString() || null,
            updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || null,
        })) as any[];

        // Access Control Filtering
        if (!userIsAdmin) {
            resources = resources.filter((r: any) => {
                // Public resources are those with status 'published'
                const isPublished = r.status === 'published';
                // Own resources are those where addedBy matches userUid
                const isOwn = userUid && r.addedBy === userUid;
                
                return isPublished || isOwn;
            });
        }

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
        
        if (addedBy) {
            resources = resources.filter((r: any) => r.addedBy === addedBy);
        }

        if (isFavorite) {
            resources = resources.filter((r: any) => r.isFavorite === true);
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

            // Special handling for rank - push nulls to the end regardless of order
            if (sortBy === 'rank') {
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
            }

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

        // Fetch creator profiles for the paginated resources
        const userIds = Array.from(new Set(paginatedResources.map((r: any) => r.addedBy).filter(Boolean)));
        const creatorProfiles: Record<string, any> = {};

        if (userIds.length > 0) {
            // Firestore 'in' query has a limit of 30, but pageSize is max 100.
            // For simplicity in this app, we'll fetch them in chunks if needed or just fetch individual docs since it's admin SDK.
            // Let's use individual fetches for reliability or a chunked approach.
            for (const uid of userIds as string[]) {
                const userDoc = await adminDb.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    creatorProfiles[uid] = {
                        displayName: userData?.displayName || 'Unknown User',
                        photoURL: userData?.photoURL || null
                    };
                }
            }
        }

        const resourcesWithCreators = paginatedResources.map((r: any) => ({
            ...r,
            creator: r.addedBy ? creatorProfiles[r.addedBy] : { displayName: 'Community' }
        }));

        return NextResponse.json({
            success: true,
            data: resourcesWithCreators,
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



export async function POST(request: NextRequest) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const isAdminUser = await isAdmin(decodedToken.uid);
        const body = await request.json();

        // Basic validation
        if (!body.title || !body.url) {
            return NextResponse.json(
                { success: false, error: 'Title and URL are required' },
                { status: 400 }
            );
        }

        const now = new Date();
        const docData = {
            ...body,
            addedBy: decodedToken.uid,
            createdAt: now,
            updatedAt: now,
            status: isAdminUser ? (body.status || 'published') : (['draft', 'suggested'].includes(body.status) ? body.status : 'suggested'),
            // Non-admins cannot set rank or favorite status
            isFavorite: isAdminUser ? (body.isFavorite || false) : false,
            rank: isAdminUser ? (body.rank || null) : null,
        };

        const docRef = await adminDb.collection('resources').add(docData);

        return NextResponse.json({
            success: true,
            id: docRef.id,
            data: {
                ...docData,
                id: docRef.id,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            }
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
