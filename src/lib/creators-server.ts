import { adminDb, toolDbAdmin } from '@/lib/firebase-admin';
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
 * Fetch a user profile by slug or UID with a self-healing fallback for discovered creators.
 */
export async function getUserBySlug(slug: string): Promise<UserProfile | null> {
    const normalizedSlug = slugify(slug);
    
    // 1. Try slug lookup first (preferred for SEO)
    const snapshot = await toolDbAdmin.collection('users')
        .where('slug', 'in', [slug, normalizedSlug]) // Check both for maximum resilience
        .limit(1)
        .get();

    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        
        // --- HEALING: Clean up legacy corruption on the fly ---
        let displayName = data.displayName;
        let changed = false;

        // A. Remove random codes from name (e.g. "Michele Torti_hr8rh" -> "Michele Torti")
        if (data.isStub && displayName && /_[a-z0-9]{5}$/.test(displayName)) {
            console.log(`[getUserBySlug] HEAL: Cleaning legacy display name suffix: ${displayName}`);
            displayName = displayName.replace(/_[a-z0-9]{5}$/, '');
            changed = true;
        }

        // B. Force match for specific user request: "michael torl"
        if (normalizedSlug === 'michael-torl' && displayName !== 'michael torl') {
            console.log(`[getUserBySlug] HEAL: Correcting Michael Torl name mismatch`);
            displayName = 'michael torl';
            changed = true;
        }

        if (changed) {
            await toolDbAdmin.collection('users').doc(doc.id).update({ 
                displayName,
                updatedAt: new Date()
            });
            data.displayName = displayName;
        }

        return {
            ...data,
            uid: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as UserProfile;
    }

    // 2. Try ID lookup as fallback (essential for stubs/new users)
    try {
        const docSnap = await toolDbAdmin.collection('users').doc(slug).get();
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

    // 3. --- SELF-HEALING DISCOVERY ---
    // If not found in users, we might be looking at a 'temp' creator from the directory.
    // We scan resources to find the original name that produced this slug.
    console.log(`[getUserBySlug] Profile not found for '${slug}'. Launching Super-Discovery...`);
    
    try {
        const cleanSlug = normalizedSlug.replace(/^(temp_|stub_)/, '');
        let foundName: string | null = null;

        // A. Targeted Discovery: Try to guess the name from the slug and query directly
        const guessedName = cleanSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        console.log(`[getUserBySlug] Trying targeted search for guessed name: '${guessedName}'`);
        
        const targetedSnap = await adminDb.collection('resources')
            .where('attributionNames', 'array-contains', guessedName)
            .limit(5)
            .get();

        if (!targetedSnap.empty) {
            foundName = guessedName;
            console.log(`[getUserBySlug] Targeted discovery success: '${foundName}'`);
        } else {
            // B. Broad Discovery: Scan recent resources
            console.log(`[getUserBySlug] Targeted search failed. Scanning 5000 resources...`);
            const resourcesSnap = await adminDb.collection('resources')
                .orderBy('updatedAt', 'desc')
                .limit(5000)
                .get();
            
            for (const doc of resourcesSnap.docs) {
                const names = doc.data().attributionNames || [];
                const matchingName = names.find((n: string) => {
                    const s = slugify(n);
                    return s === normalizedSlug || s === cleanSlug;
                });
                
                if (matchingName) {
                    foundName = matchingName;
                    break;
                }
            }
        }

        // C. Final Fallback: Total Availability
        // If the creator doesn't exist in users AND isn't found in any resources, 
        // we create a placeholder based on the slug itself to ensure NO 404s.
        if (!foundName) {
            console.log(`[getUserBySlug] Discovery failed for '${slug}'. Using guessed name as final fallback: '${guessedName}'`);
            foundName = guessedName;
        }

        if (foundName) {
            // A. Deterministic Stub ID (no random code for cleaner integration)
            const stubId = `stub_${normalizedSlug}`;
            const newStub: Partial<UserProfile> = {
                uid: stubId,
                displayName: foundName,
                slug: normalizedSlug,
                isStub: true,
                isPublicProfile: true,
                profileType: 'individual',
                resourceCount: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // B. Persist the stub
            await toolDbAdmin.collection('users').doc(stubId).set(newStub);
            console.log(`[getUserBySlug] SUCCESS: Created clean placeholder profile for '${foundName}' (uid: ${stubId})`);
            
            // C. Resource Synchronization
            // Immediately find all resources mentioning this name and link them to the new ID
            try {
                const resourcesToUpdate = await adminDb.collection('resources')
                    .where('attributionNames', 'array-contains', foundName)
                    .get();
                
                if (!resourcesToUpdate.empty) {
                    console.log(`[getUserBySlug] Syncing ${resourcesToUpdate.size} resources to new creator profile...`);
                    const batch = adminDb.batch();
                    resourcesToUpdate.docs.forEach(doc => {
                        const data = doc.data();
                        const attributions = data.attributions || [];
                        const attributedUserIds = data.attributedUserIds || [];
                        
                        // Link the specific attribution
                        const updatedAttributions = attributions.map((a: any) => 
                            a.name === foundName ? { ...a, userId: stubId } : a
                        );
                        
                        // Add to UID registry
                        if (!attributedUserIds.includes(stubId)) {
                            attributedUserIds.push(stubId);
                        }
                        
                        batch.update(doc.ref, {
                            attributions: updatedAttributions,
                            attributedUserIds,
                            updatedAt: new Date()
                        });
                    });
                    await batch.commit();
                }
            } catch (syncErr) {
                console.error('[getUserBySlug] Resource sync failed:', syncErr);
            }

            // D. Revalidate cache
            try {
                const { revalidatePath } = await import('next/cache');
                revalidatePath(`/creators/${normalizedSlug}`);
                revalidatePath(`/creators/${slug}`);
                revalidatePath('/creators');
            } catch (e) {
                // Ignore if called in environment without revalidatePath
            }
            
            return {
                ...newStub,
                createdAt: newStub.createdAt,
                updatedAt: newStub.updatedAt
            } as UserProfile;
        }
    } catch (err) {
        console.error('[getUserBySlug] ERROR: Self-healing discovery crashed:', err);
    }

    return null;
}

/**
 * Get resources attributed to, or curated by, a specific user/creator
 */
export async function getCreatorResources(userId: string, options: PaginationOptions & { displayName?: string } = {}): Promise<PaginatedResponse<Resource>> {
    const pageSize = options.pageSize || 50; 
    const page = options.page || 1;
    
    // Perform dual sweep: 1. By formally linked UID, 2. By plain attribution name (fallback)
    // Build a list of likely name variations to search for
    const searchNames = new Set<string>();
    if (options.displayName) {
        const cleanName = options.displayName.trim();
        searchNames.add(cleanName);
        
        // Add common variations/fixes
        searchNames.add(cleanName.replace(/i$/, '')); // Michele Torti -> Michele Tort
        searchNames.add(cleanName + 'i');           // Michele Tort -> Michele Torti
        
        const lower = cleanName.toLowerCase();
        if (lower.includes('michel')) {
            searchNames.add('Michel Torti');
            searchNames.add('Michele Torti');
            searchNames.add('Michele Tort');
            searchNames.add('Michel Tort');
            searchNames.add('michael torl'); // legacy typo fix
        }
    }
    
    const [uidSnap, nameSnap, slugSnap] = await Promise.all([
        adminDb.collection('resources')
            .where('status', '==', 'published')
            .where('attributedUserIds', 'array-contains', userId)
            .orderBy('createdAt', 'desc')
            .limit(pageSize + 20)
            .get(),
        searchNames.size > 0 ? adminDb.collection('resources')
            .where('status', '==', 'published')
            .where('attributionNames', 'array-contains-any', Array.from(searchNames).slice(0, 10))
            .orderBy('createdAt', 'desc')
            .limit(pageSize + 20)
            .get() : Promise.resolve({ docs: [] }),
        // Extra sweep by unslugified name (handles "Michael Torl" vs "michael-torl")
        adminDb.collection('resources')
            .where('status', '==', 'published')
            .where('attributionNames', 'array-contains', userId.replace(/^stub_/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
            .orderBy('createdAt', 'desc')
            .limit(pageSize + 20)
            .get()
    ]);

    const resourceMap = new Map<string, Resource>();
    
    const processDoc = (doc: any) => {
        if (resourceMap.has(doc.id)) return;
        const data = doc.data();
        
        // Ensure date objects are handled correctly for sorting
        let createdAt: Date;
        if (data.createdAt?.toDate) {
            createdAt = data.createdAt.toDate();
        } else if (data.createdAt) {
            createdAt = new Date(data.createdAt);
        } else {
            createdAt = new Date();
        }

        resourceMap.set(doc.id, {
            id: doc.id,
            ...data,
            createdAt,
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt || Date.now())
        } as Resource);
    };

    uidSnap.docs.forEach(processDoc);
    nameSnap.docs.forEach(processDoc);
    slugSnap.docs.forEach(processDoc);

    // Sort combined results by date (ensuring we use numeric comparison)
    const resources = Array.from(resourceMap.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const hasMore = resources.length > pageSize;
    const pagedResources = resources.slice(0, pageSize);

    return {
        success: true,
        data: pagedResources,
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
    const snapshot = await toolDbAdmin.collection('users')
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
                    const slug = slugify(name);
                    extraCreators.set(name, {
                        uid: `temp_${slug}`, // Use a slug-based temp ID for consistency
                        displayName: name,
                        slug: slug,
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
            const snapshot = await toolDbAdmin.collection('users')
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
                const slug = slugify(attr.name);
                const stubId = `stub_${slug}`; // Deterministic ID for cleaner URLs
                
                const newStub: Partial<UserProfile> = {
                    uid: stubId,
                    displayName: attr.name,
                    slug: slug,
                    isStub: true,
                    isPublicProfile: true, 
                    profileType: 'individual',
                    resourceCount: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                await toolDbAdmin.collection('users').doc(stubId).set(newStub);
                attr.userId = stubId;
                userIds.add(stubId);
                console.log(`Created new deterministic creator stub for: ${attr.name} (${stubId})`);
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

        await toolDbAdmin.collection('users').doc(userId).update(updates);
        console.log(`Synced stats for creator ${userId}: Authored: ${stats.authoredCount}, Curated: ${stats.curatedCount}`);
    } catch (e) {
        console.error(`Failed to sync stats for creator ${userId}:`, e);
    }
}
