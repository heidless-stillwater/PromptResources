import { adminDb } from '@/lib/firebase-admin';
import { UserProfile, Resource, Attribution } from '@/lib/types';
import { PaginatedResponse } from '@/lib/types';
import { slugify } from '@/lib/utils';

export interface PaginationOptions {
    limit?: number;
    lastVisible?: any;
    page?: number;
    pageSize?: number;
}

export interface CreatorStats {
    totalResources: number;
    authoredCount: number;
    curatedCount: number;
    categories: string[];
    platforms: string[];
    averageRating: number;
}

/**
 * Fetch a user profile by slug or UID
 */
export async function getUserBySlug(slug: string): Promise<UserProfile | null> {
    // 1. Try slug lookup first (preferred for SEO)
    const snapshot = await adminDb.collection('users')
        .where('slug', '==', slug)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return {
            ...data,
            uid: snapshot.docs[0].id,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as UserProfile;
    }

    // 2. Try ID lookup as fallback (essential for stubs/new users)
    try {
        const docSnap = await adminDb.collection('users').doc(slug).get();
        if (docSnap.exists) {
            const data = docSnap.data()!;
            return {
                ...data,
                uid: docSnap.id,
                createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
            } as UserProfile;
        }
    } catch (e) {
        // Not a valid ID or fetch failed
    }

    return null;
}

/**
 * Get resources attributed to, or curated by, a specific user/creator
 */
export async function getCreatorResources(userId: string, options: PaginationOptions = {}): Promise<PaginatedResponse<Resource>> {
    const pageSize = options.pageSize || 50; 
    const page = options.page || 1;
    
    // We want resources where addedBy == userId OR attributedUserIds contains userId
    // Since firestore doesn't do cross-field OR queries easily, we query both and merge.
    // In a prod app we might use a dedicated index, but here we'll rely on the server side merge.
    
    // Ideally, for pagination, an array-contains on a unified 'involvedUserIds' would be cleaner.
    // For now, we'll try to query `attributedUserIds` as the primary.
    
    const snapshot = await adminDb.collection('resources')
        .where('status', '==', 'published')
        .where('attributedUserIds', 'array-contains', userId)
        .orderBy('createdAt', 'desc')
        .limit(pageSize + 1)
        .get();

    const resources = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as Resource;
    });

    const hasMore = resources.length > pageSize;
    if (hasMore) resources.pop();

    return {
        success: true,
        data: resources,
        total: resources.length, 
        page,
        pageSize,
        hasMore
    };
}

/**
 * Fetch public creators directory
 */
export async function getAllCreators(options?: { featured?: boolean; limit?: number; type?: string }): Promise<UserProfile[]> {
    let query: FirebaseFirestore.Query = adminDb.collection('users');

    // Only public or stub profiles
    // We cannot do an OR natively easily across true/false on different fields,
    // so we assume we only want `isStub == true` OR `isPublicProfile == true`
    query = query.where('isPublicProfile', '==', true); 

    if (options?.featured) {
        query = query.where('isFeatured', '==', true);
    }
    
    if (options?.type) {
        query = query.where('profileType', '==', options.type);
    }

    // Remove orderBy to avoid composite index requirement during dev
    // query = query.orderBy('resourceCount', 'desc');

    if (options?.limit) {
        query = query.limit(options.limit);
    } else {
        query = query.limit(50);
    }

    const snapshot = await query.get();
    
    // Sort in-memory instead of DB to unblock UI while indexes build
    const creators = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            uid: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as UserProfile;
    });

    return creators.sort((a, b) => (b.resourceCount || 0) - (a.resourceCount || 0));
}

// Simple in-memory cache for creator stats to reduce Firestore reads
const statsCache = new Map<string, { stats: CreatorStats; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Aggregate stats for a creator
 */
export async function getCreatorStats(userId: string): Promise<CreatorStats> {
    // Check Cache first
    const cached = statsCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.stats;
    }

    // 1. Resources authored by them (attributedUserIds contains userId)
    const authoredSnapshot = await adminDb.collection('resources')
        .where('status', '==', 'published')
        .where('attributedUserIds', 'array-contains', userId)
        .get();

    // 2. Resources curated by them (addedBy == userId)
    const curatedSnapshot = await adminDb.collection('resources')
        .where('status', '==', 'published')
        .where('addedBy', '==', userId)
        .get();
        
    const categories = new Set<string>();
    const platforms = new Set<string>();
    let totalScore = 0;
    let reviewsCount = 0;
    
    // Merge both for unique resource list for platform/category stats
    const allDocIds = new Set<string>();
    const allDocs: FirebaseFirestore.DocumentData[] = [];
    
    [...authoredSnapshot.docs, ...curatedSnapshot.docs].forEach(doc => {
        if (!allDocIds.has(doc.id)) {
            allDocIds.add(doc.id);
            const data = doc.data();
            allDocs.push(data);
            if (data.categories) data.categories.forEach((c: string) => categories.add(c));
            if (data.platform) platforms.add(data.platform);
            if (data.averageRating) {
                totalScore += data.averageRating;
                reviewsCount++;
            }
        }
    });
    
    const stats = {
        totalResources: allDocIds.size,
        authoredCount: authoredSnapshot.docs.length,
        curatedCount: curatedSnapshot.docs.length,
        categories: Array.from(categories),
        platforms: Array.from(platforms),
        averageRating: reviewsCount > 0 ? (totalScore / reviewsCount) : 0
    };

    // Update Cache
    statsCache.set(userId, { stats, timestamp: Date.now() });
    
    return stats;
}

/**
 * Auto-detect and resolve attribution names to actual User IDs in the system.
 */
export async function resolveAttributions(attributions: Attribution[]): Promise<{ resolvedAttributions: Attribution[], attributedUserIds: string[] }> {
    if (!attributions || !Array.isArray(attributions) || attributions.length === 0) {
        return { resolvedAttributions: [], attributedUserIds: [] };
    }

    const resolved = [...attributions];
    const userIds = new Set<string>();

    for (let i = 0; i < resolved.length; i++) {
        const attr = resolved[i];
        if (attr.userId) {
            userIds.add(attr.userId);
            continue;
        }

        if (!attr.name) continue;

        try {
            // Check if there is an existing public profile or stub with this exact name
            const snapshot = await adminDb.collection('users')
                .where('displayName', '==', attr.name)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const userData = doc.data();
                if (userData.isPublicProfile || userData.isStub) {
                    attr.userId = doc.id;
                    userIds.add(doc.id);
                }
            } else {
                // CREATE STUB: If no profile exists, create a stub profile.
                // This fulfills Phase 4 requirement: 'Auto-creation from attributions'.
                const stubId = `stub_${slugify(attr.name)}_${Math.random().toString(36).substring(2, 7)}`;
                const slug = slugify(attr.name);
                
                const newStub: Partial<UserProfile> = {
                    uid: stubId,
                    displayName: attr.name,
                    slug: slug,
                    isStub: true,
                    isPublicProfile: true, // Make stubs visible in directory by default
                    profileType: 'individual',
                    resourceCount: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                await adminDb.collection('users').doc(stubId).set(newStub);
                attr.userId = stubId;
                userIds.add(stubId);
                console.log(`Created new creator stub for: ${attr.name} (${stubId})`);
            }
        } catch (e) {
            console.error('Error resolving attribution:', attr.name, e);
        }
    }

    return {
        resolvedAttributions: resolved,
        attributedUserIds: Array.from(userIds)
    };
}

/**
 * Synchronize aggregate statistics for a creator profile.
 */
export async function syncCreatorStats(userId: string): Promise<void> {
    try {
        const stats = await getCreatorStats(userId);
        await adminDb.collection('users').doc(userId).update({
            resourceCount: stats.totalResources,
            authoredCount: stats.authoredCount,
            curatedCount: stats.curatedCount,
            categories: stats.categories,
            platforms: stats.platforms,
            updatedAt: new Date()
        });
        console.log(`Synced stats for creator ${userId}: Authored: ${stats.authoredCount}, Curated: ${stats.curatedCount}`);
    } catch (e) {
        console.error(`Failed to sync stats for creator ${userId}:`, e);
    }
}
