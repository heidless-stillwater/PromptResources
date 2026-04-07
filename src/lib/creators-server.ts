import { adminDb } from '@/lib/firebase-admin';
import { UserProfile, Resource, Attribution } from '@/lib/types';
import { PaginatedResponse } from '@/lib/types';

export interface PaginationOptions {
    limit?: number;
    lastVisible?: any;
    page?: number;
    pageSize?: number;
}

export interface CreatorStats {
    totalResources: number;
    categories: string[];
    platforms: string[];
    averageRating: number;
}

/**
 * Fetch a user profile by slug
 */
export async function getUserBySlug(slug: string): Promise<UserProfile | null> {
    const snapshot = await adminDb.collection('users')
        .where('slug', '==', slug)
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();
    return {
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    } as UserProfile;
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

/**
 * Aggregate stats for a creator
 */
export async function getCreatorStats(userId: string): Promise<CreatorStats> {
    const resources = await adminDb.collection('resources')
        .where('status', '==', 'published')
        .where('attributedUserIds', 'array-contains', userId)
        .get();
        
    const categories = new Set<string>();
    const platforms = new Set<string>();
    let totalScore = 0;
    
    resources.docs.forEach(doc => {
        const data = doc.data();
        if (data.categories) data.categories.forEach((c: string) => categories.add(c));
        if (data.platform) platforms.add(data.platform);
        if (data.averageRating) totalScore += data.averageRating;
    });
    
    return {
        totalResources: resources.docs.length,
        categories: Array.from(categories),
        platforms: Array.from(platforms),
        averageRating: resources.docs.length > 0 ? (totalScore / resources.docs.length) : 0
    };
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
