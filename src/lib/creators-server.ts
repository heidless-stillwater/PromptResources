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
    // Phase 4 "All-In" Sweep: We fetch a broad pool and filter in-memory to bypass potential flag discrepancies.
    const snapshot = await adminDb.collection('users')
        .limit(options?.limit || 300)
        .get();

    const creators: UserProfile[] = [];

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const profile = {
            ...data,
            uid: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as UserProfile;

        // Visibility Safeguard: Include if they are public, a stub, or have ANY community impact
        const isVisible = 
            profile.isPublicProfile === true || 
            profile.isStub === true || 
            (profile.authoredCount || 0) > 0 || 
            (profile.resourceCount || 0) > 0;

        if (!isVisible) return;

        // Apply secondary filters
        if (options?.featured && !profile.isFeatured) return;
        if (options?.type && profile.profileType !== options.type) return;

        creators.push(profile);
    });

    // Impact Fallback: If registry is empty/sparse, sweep resources for unique attribution names
    if (creators.length < 5) {
        const resourcesSnap = await adminDb.collection('resources')
            .where('status', '==', 'published')
            .limit(500)
            .get();
        
        const extraCreators = new Map<string, UserProfile>();
        resourcesSnap.docs.forEach(doc => {
            const data = doc.data();
            const names = data.attributionNames || [];
            names.forEach((name: string) => {
                if (!creators.find(c => c.displayName === name) && !extraCreators.has(name)) {
                    extraCreators.set(name, {
                        uid: `temp_${name}`,
                        displayName: name,
                        slug: slugify(name),
                        resourceCount: 1,
                        authoredCount: 1,
                        isPublicProfile: true,
                        createdAt: data.createdAt?.toDate?.() || new Date(),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(),
                    } as UserProfile);
                } else if (extraCreators.has(name)) {
                    const existing = extraCreators.get(name)!;
                    existing.resourceCount = (existing.resourceCount || 0) + 1;
                    existing.authoredCount = (existing.authoredCount || 0) + 1;
                    // Keep most recent update
                    const resUpdate = data.updatedAt?.toDate?.() || new Date();
                    if (resUpdate > existing.updatedAt) existing.updatedAt = resUpdate;
                }
            });
        });
        creators.push(...Array.from(extraCreators.values()));
    }

    // Sort by impact (Authored > Total > Name)
    return creators.sort((a, b) => {
        const aVal = (a.authoredCount || 0) * 10 + (a.resourceCount || 0);
        const bVal = (b.authoredCount || 0) * 10 + (b.resourceCount || 0);
        return bVal - aVal;
    });
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
        const updates: any = {
            resourceCount: stats.totalResources,
            authoredCount: stats.authoredCount,
            curatedCount: stats.curatedCount,
            categories: stats.categories,
            platforms: stats.platforms,
            updatedAt: new Date()
        };

        // If they have authored resources, ensure they are visible in the registry
        if (stats.authoredCount > 0) {
            updates.isPublicProfile = true;
        }

        await adminDb.collection('users').doc(userId).update(updates);
        console.log(`Synced stats for creator ${userId}: Authored: ${stats.authoredCount}, Curated: ${stats.curatedCount}`);
    } catch (e) {
        console.error(`Failed to sync stats for creator ${userId}:`, e);
    }
}
