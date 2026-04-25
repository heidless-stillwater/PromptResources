import { adminDb, toolDbAdmin } from '@/lib/firebase-admin';
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
    status?: string | null;
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

import { cookies } from 'next/headers';
import { getProtectionConfig } from './config-helper';

export async function getResourcesAction(options: GetResourcesOptions) {
    const {
        platform,
        pricing,
        type,
        category,
        search,
        addedBy,
        status,
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
        // ────────────────────────────────────────────────────
        // SOVEREIGN GATE: Online Safety Act Enforcement
        // ────────────────────────────────────────────────────
        const protection = await getProtectionConfig();
        const cookieStore = await cookies();
        const isVerified = cookieStore.get('stillwater_av_verified')?.value === 'true';

        // Apply gate if: AV is enabled AND (Strictness is Maximum OR User is NOT Admin)
        // CRITICAL: Admins ALWAYS bypass the gate for metadata/counts to ensure Control Hub visibility
        const gateActive = protection.avEnabled && !isVerified && !userIsAdmin && (protection.avStrictness === 'maximum' || !userIsAdmin);
        
        // Even if gated, we can still provide metadata like total counts
        if (gateActive && !addedBy) {
            console.log('[SovereignGate] Gating resource list: Age Verification Required.');
            const countSnap = await adminDb.collection('resources').where('status', '==', 'published').count().get();
            return {
                resources: [],
                total: countSnap.data().count,
                hasMore: false,
                complianceGated: true 
            };
        }

        let query: any = adminDb.collection('resources');

        // ────────────────────────────────────────────────────
        // SOVEREIGN GATE: Content Visibility & Moderation
        // ────────────────────────────────────────────────────
        // ────────────────────────────────────────────────────
        // SOVEREIGN GATE: Content Visibility & Moderation
        // ────────────────────────────────────────────────────
        if (status) {
            const statusList = status.split(',').filter(Boolean);
            if (statusList.length === 1) {
                query = query.where('status', '==', statusList[0]);
            } else if (statusList.length > 1) {
                query = query.where('status', 'in', statusList);
            }
        } else if (!userIsAdmin) {
            // Strictly exclude hidden content from public view if no specific status requested
            query = query.where('status', 'not-in', ['hidden', 'draft', 'pending']);
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
        let countSnapshot = await query.count().get();
        total = countSnapshot.data().count;

        // CRITICAL FALLBACK: If total is 0 and we are an admin querying the 'db-0' instance,
        // try a one-time check of the '(default)' database to see if data exists there instead.
        if (total === 0 && userIsAdmin && !search && !addedBy) {
            try {
                const { getDb } = await import('./firebase-admin');
                const defaultDb = getDb('(default)');
                if (defaultDb) {
                    let fallbackQuery: any = defaultDb.collection('resources');
                    if (status) {
                         const statusList = status.split(',').filter(Boolean);
                         if (statusList.length === 1) fallbackQuery = fallbackQuery.where('status', '==', statusList[0]);
                         else if (statusList.length > 1) fallbackQuery = fallbackQuery.where('status', 'in', statusList);
                    } else if (!userIsAdmin) {
                         // For non-admins, only fallback to published content
                         fallbackQuery = fallbackQuery.where('status', '==', 'published');
                    }
                    
                    const fallbackCount = await fallbackQuery.count().get();
                    if (fallbackCount.data().count > 0) {
                        console.log(`[SovereignResolver] Data found in (default) database (${fallbackCount.data().count} items). Redirecting query...`);
                        query = fallbackQuery;
                        total = fallbackCount.data().count;
                    }
                }
            } catch (e) {
                console.error('[SovereignResolver] Fallback check failed:', e);
            }
        }

        const snapshot = await query
            .offset((page - 1) * pageSize)
            .limit(pageSize)
            .get();

        finalResources = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            status: 'published', // Default for legacy data
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
                const userDoc = await toolDbAdmin.collection('users').doc(uid).get();
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
        const protection = await getProtectionConfig();
        const cookieStore = await cookies();
        const isVerified = cookieStore.get('stillwater_av_verified')?.value === 'true';

        // Apply gate if: AV is enabled AND (Strictness is Maximum OR User is NOT Admin)
        // Note: For getResourceById, we don't have userIsAdmin readily available from options, 
        // so we check the protection status.
        if (protection.avEnabled && !isVerified && protection.avStrictness === 'maximum') {
            console.log(`[SovereignGate] Blocked access to resource ${id}: Age Verification Required (Maximum Strictness).`);
            return null;
        }

        const docRef = await adminDb.collection('resources').doc(id).get();
        if (!docRef.exists) return null;

        const data = docRef.data() as any;
        
        // Gating Check: If resource is hidden/draft/pending, only admins can view it
        // Note: For now, we allow admins to see it. If you want to strictly hide it even from admins in this view, 
        // you can change the condition.
        if (data.status === 'hidden' || data.status === 'draft' || data.status === 'pending') {
            // We return null to simulate 'not found' for public users
            // You might want to pass a 'userIsAdmin' flag here in the future
            return null;
        }
        const resource = {
            id: docRef.id,
            status: 'published', // Default for legacy data
            ...data,
            createdAt: data.createdAt?.toDate()?.toISOString() || null,
            updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
        } as Resource;

        // Fetch creator
        if (resource.addedBy) {
            const userDoc = await toolDbAdmin.collection('users').doc(resource.addedBy).get();
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
