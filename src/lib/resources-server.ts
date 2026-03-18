import { adminDb } from '@/lib/firebase-admin';
import { Resource } from '@/lib/types';
import { Filter } from 'firebase-admin/firestore';

export interface GetResourcesOptions {
    platform?: string | null;
    pricing?: string | null;
    type?: string | null;
    category?: string | null;
    search?: string | null;
    addedBy?: string | null;
    isFavorite?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    userUid?: string | null;
    userIsAdmin?: boolean;
}

export async function getResourcesAction(options: GetResourcesOptions) {
    const {
        platform,
        pricing,
        type,
        category,
        search,
        addedBy,
        isFavorite,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        page = 1,
        pageSize = 20,
        userUid,
        userIsAdmin = false,
    } = options;

    try {
        let query: any = adminDb.collection('resources');

        // Access Control Filtering
        if (!userIsAdmin) {
            if (userUid) {
                // Show published resources OR resources added by the current user
                query = query.where(
                    Filter.or(
                        Filter.where('status', '==', 'published'),
                        Filter.where('addedBy', '==', userUid)
                    )
                );
            } else {
                query = query.where('status', '==', 'published');
            }
        }

        // Apply specified filters
        if (platform) query = query.where('platform', '==', platform);
        if (pricing) query = query.where('pricing', '==', pricing);
        if (type) query = query.where('type', '==', type);
        if (category) query = query.where('categories', 'array-contains', category);
        if (addedBy) query = query.where('addedBy', '==', addedBy);
        if (isFavorite) query = query.where('isFavorite', '==', true);

        // Sorting (Note: Firestore requires composite indexes for complex where + orderBy)
        query = query.orderBy(sortBy, sortOrder);

        let finalResources: Resource[] = [];
        let total = 0;

        if (search) {
            // Search still requires in-memory filtering for now due to lack of partial match in Firestore
            // We fetch a larger subset to allow for filtering
            const MAX_DOCS_TO_SCAN = 1000;
            const snapshot = await query.limit(MAX_DOCS_TO_SCAN).get();
            
            let allDocs = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate()?.toISOString() || null,
                updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || null,
            }));

            const term = search.toLowerCase();
            const filtered = allDocs.filter((r: any) =>
                r.title?.toLowerCase().includes(term) ||
                r.description?.toLowerCase().includes(term) ||
                (r.prompts && r.prompts.some((p: string) => p.toLowerCase().includes(term)))
            );

            total = filtered.length;
            const start = (page - 1) * pageSize;
            finalResources = filtered.slice(start, start + pageSize);
        } else {
            // No search term: We can use Firestore for pagination
            const countSnapshot = await query.count().get();
            total = countSnapshot.data().count;

            const snapshot = await query
                .offset((page - 1) * pageSize)
                .limit(pageSize)
                .get();

            finalResources = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate()?.toISOString() || null,
                updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || null,
            }));
        }

        // Fetch creator profiles for the current page
        const userIds = Array.from(new Set(finalResources.map((r: any) => r.addedBy).filter(Boolean)));
        const creatorProfiles: Record<string, any> = {};

        if (userIds.length > 0) {
            // Using Promise.all to fetch missing user profiles in parallel
            await Promise.all(userIds.map(async (uid: any) => {
                const userDoc = await adminDb.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    creatorProfiles[uid] = {
                        displayName: userData?.displayName || 'Unknown User',
                        photoURL: userData?.photoURL || null
                    };
                }
            }));
        }

        const resourcesWithCreators = finalResources.map((r: any) => ({
            ...r,
            creator: r.addedBy ? creatorProfiles[r.addedBy] : { displayName: 'Community' }
        }));

        return {
            resources: resourcesWithCreators as Resource[],
            total,
            hasMore: ((page - 1) * pageSize) + finalResources.length < total,
        };
    } catch (error) {
        console.error('Error in getResourcesAction:', error);
        throw error;
    }
}

export async function getResourceById(id: string) {
    try {
        const docRef = await adminDb.collection('resources').doc(id).get();
        if (!docRef.exists) return null;

        const data = docRef.data() as any;
        const resource = {
            id: docRef.id,
            ...data,
            createdAt: data.createdAt?.toDate()?.toISOString() || null,
            updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
        } as Resource;

        // Fetch creator
        if (resource.addedBy) {
            const userDoc = await adminDb.collection('users').doc(resource.addedBy).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                resource.creator = {
                    displayName: userData?.displayName || 'Unknown User',
                    photoURL: userData?.photoURL || null
                };
            } else {
                resource.creator = { displayName: 'Community' };
            }
        } else {
            resource.creator = { displayName: 'Community' };
        }

        return resource;
    } catch (error) {
        console.error('Error fetching resource by ID:', error);
        return null;
    }
}

export async function getAllCategories() {
    try {
        // Try to fetch from the categories collection first
        const categoriesSnap = await adminDb.collection('categories').get();
        if (!categoriesSnap.empty) {
            return categoriesSnap.docs
                .map(doc => doc.data().name || doc.id)
                .sort() as string[];
        }

        // Fallback: extract distinct categories from recent resources (efficient limit)
        const resourcesSnap = await adminDb.collection('resources').limit(200).get();
        const cats = new Set<string>();
        resourcesSnap.docs.forEach((doc) => {
            const data = doc.data();
            data.categories?.forEach((c: string) => cats.add(c));
        });
        return Array.from(cats).sort();
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}
