import { adminDb } from '@/lib/firebase-admin';
import { Resource } from '@/lib/types';
import { Filter } from 'firebase-admin/firestore';
import { extractYouTubeId } from '@/lib/youtube';

export interface GetResourcesOptions {
    platform?: string | null;
    pricing?: string | null;
    type?: string | null;
    category?: string | null;
    search?: string | null;
    addedBy?: string | null;
    isFavorite?: boolean;
    priorityRank?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    userUid?: string | null;
    userIsAdmin?: boolean;
    creators?: string[] | null;
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
        priorityRank = '',
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        page = 1,
        pageSize = 96,
        userUid,
        userIsAdmin = false,
        creators = null,
    } = options;

    try {
        let query: any = adminDb.collection('resources');

        // Access Control Filtering
        // Legacy Support: We allow all resources for now because many older items 
        // lack a "status" field. Firestore equality filters on "status" would 
        // hide these resources entirely.
        if (!userIsAdmin) {
            // For now, we are not strictly filtering by status until a migration is complete.
            // If you want to hide a resource globally, use a rank of -1 or delete it.
        }

        // Apply specified filters
        if (platform) query = query.where('platform', '==', platform);
        if (pricing) query = query.where('pricing', '==', pricing);
        if (type) query = query.where('type', '==', type);
        if (category) query = query.where('categories', 'array-contains', category);
        if (addedBy) query = query.where('addedBy', '==', addedBy);
        if (isFavorite) query = query.where('isFavorite', '==', true);
        if (creators && creators.length > 0) {
            // Use attributedUserIds (UIDs) instead of names for robust filtering
            // Firestore array-contains-any limit is 10
            query = query.where('attributedUserIds', 'array-contains-any', creators.slice(0, 10));
        }
        // Priority rank filtering: 'any' = rank > 0, specific number = exact match
        if (priorityRank === 'any') {
            query = query.where('rank', '>', 0);
        } else if (priorityRank && !isNaN(Number(priorityRank))) {
            // "Top X" logic: rank must be between 1 and X
            query = query.where('rank', '>', 0).where('rank', '<=', Number(priorityRank));
        }

        // Support 'rank' sort: Firestore requires the field to exist on the doc.
        // If sorting by rank, we automatically ensure we only query docs with a rank if not already filtered.
        const effectiveSortBy = sortBy;
        let rankRequirementApplied = !!priorityRank;

        if (effectiveSortBy === 'rank' && !rankRequirementApplied) {
            query = query.where('rank', '>', 0);
            rankRequirementApplied = true;
        }

        if (priorityRank === 'any' || (effectiveSortBy === 'rank' && !priorityRank)) {
            // Firestore: inequality filter on rank requires orderBy(rank) first
            query = query.orderBy('rank', sortOrder);
            if (effectiveSortBy !== 'rank') {
                query = query.orderBy(effectiveSortBy, sortOrder);
            }
        } else {
            query = query.orderBy(effectiveSortBy, sortOrder);
        }

        let finalResources: Resource[] = [];
        let total = 0;

        if (search) {
            const isUrl = /^https?:\/\//i.test(search);
            const ytId = extractYouTubeId(search);

            if (ytId) {
                // If it's a YouTube link or ID, search by the extracted ID
                query = query.where('youtubeVideoId', '==', ytId);
            } else if (isUrl) {
                // If it's a direct URL, search for exact match
                query = query.where('url', '==', search);
            } else {
                // Standard keyword search
                const searchTokens = search.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(t => t.length >= 2)
                    .slice(0, 10); // Firestore limit

                if (searchTokens.length > 0) {
                    query = query.where('searchKeywords', 'array-contains-any', searchTokens);
                }
            }
        }

        // No search term or tokens: We can use Firestore for pagination
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
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.name || doc.id,
                        slug: data.slug || doc.id.toLowerCase().replace(/\s+/g, '-'),
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        // Fallback: extract distinct categories from recent resources
        const resourcesSnap = await adminDb.collection('resources').limit(200).get();
        const catsMap = new Map<string, { id: string; name: string; slug: string }>();
        resourcesSnap.docs.forEach((doc) => {
            const data = doc.data();
            data.categories?.forEach((c: string) => {
                if (!catsMap.has(c)) {
                    catsMap.set(c, {
                        id: c,
                        name: c,
                        slug: c.toLowerCase().replace(/\s+/g, '-'),
                    });
                }
            });
        });
        return Array.from(catsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}
