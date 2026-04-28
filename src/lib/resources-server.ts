import { adminDb, toolDbAdmin, accreditationDb } from '@/lib/firebase-admin';
import { Resource } from '@/lib/types';
import { Filter } from 'firebase-admin/firestore';
import { extractYouTubeId } from '@/lib/youtube';
import { cookies } from 'next/headers';
import { getProtectionConfig } from './config-helper';

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
        const gateActive = protection.avEnabled && !isVerified && !userIsAdmin && (protection.avStrictness === 'maximum' || !userIsAdmin);
        
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
        if (status) {
            const statusList = status.split(',').filter(Boolean);
            if (statusList.length === 1) {
                query = query.where('status', '==', statusList[0]);
            } else if (statusList.length > 1) {
                query = query.where('status', 'in', statusList);
            }
        } else if (!userIsAdmin) {
            // Strictly exclude hidden content from public view if no specific status requested.
            // NOTE: Firestore allows only one disjunction (in, not-in, array-contains-any) per query.
            // If search or creator filters are active (using array-contains-any), we must avoid 'not-in'.
            if (search || (creators && creators.length > 0)) {
                query = query.where('status', '==', 'published');
            } else {
                query = query.where('status', 'not-in', ['hidden', 'draft', 'pending']);
            }
        }

        // Apply specified filters
        if (platform) query = query.where('platform', '==', platform);
        if (pricing) query = query.where('pricing', '==', pricing);
        if (type) query = query.where('type', '==', type);
        if (category) query = query.where('categories', 'array-contains', category);
        if (addedBy) query = query.where('addedBy', '==', addedBy);
        if (isFavorite) query = query.where('isFavorite', '==', true);
        if (creators && creators.length > 0) {
            query = query.where('attributedUserIds', 'array-contains-any', creators.slice(0, 10));
        }
        if (priorityRank === 'any') {
            query = query.where('rank', '>', 0);
        } else if (priorityRank && !isNaN(Number(priorityRank))) {
            query = query.where('rank', '>', 0).where('rank', '<=', Number(priorityRank));
        }

        const effectiveSortBy = sortBy;
        let rankRequirementApplied = !!priorityRank;

        if (effectiveSortBy === 'rank' && !rankRequirementApplied) {
            query = query.where('rank', '>', 0);
            rankRequirementApplied = true;
        }

        if (priorityRank === 'any' || (effectiveSortBy === 'rank' && !priorityRank)) {
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
                query = query.where('youtubeVideoId', '==', ytId);
            } else if (isUrl) {
                query = query.where('url', '==', search);
            } else {
                const searchTokens = search.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(t => t.length >= 2)
                    .slice(0, 10);

                if (searchTokens.length > 0) {
                    query = query.where('searchKeywords', 'array-contains-any', searchTokens);
                }
            }
        }

        let countSnapshot = await query.count().get();
        total = countSnapshot.data().count;

        // HEALING: Fallback for 'averageRating' if no rated items exist
        // Firestore excludes documents missing the field used in orderBy.
        // If a user sorts by rating but no assets have been rated, we pivot back to discovery date.
        if (total === 0 && effectiveSortBy === 'averageRating') {
            console.log('[SovereignDiscovery] No rated items found. Falling back to chronological discovery.');
            // Re-clone query without the rating sort
            let fallbackQuery: any = adminDb.collection('resources');
            
            // Re-apply same filters
            if (status) {
                const statusList = status.split(',').filter(Boolean);
                if (statusList.length === 1) fallbackQuery = fallbackQuery.where('status', '==', statusList[0]);
                else if (statusList.length > 1) fallbackQuery = fallbackQuery.where('status', 'in', statusList);
            } else if (!userIsAdmin) {
                if (search || (creators && creators.length > 0)) fallbackQuery = fallbackQuery.where('status', '==', 'published');
                else fallbackQuery = fallbackQuery.where('status', 'not-in', ['hidden', 'draft', 'pending']);
            }
            if (platform) fallbackQuery = fallbackQuery.where('platform', '==', platform);
            if (pricing) fallbackQuery = fallbackQuery.where('pricing', '==', pricing);
            if (type) fallbackQuery = fallbackQuery.where('type', '==', type);
            if (category) fallbackQuery = fallbackQuery.where('categories', 'array-contains', category);
            if (addedBy) fallbackQuery = fallbackQuery.where('addedBy', '==', addedBy);
            if (isFavorite) fallbackQuery = fallbackQuery.where('isFavorite', '==', true);
            if (creators && creators.length > 0) fallbackQuery = fallbackQuery.where('attributedUserIds', 'array-contains-any', creators.slice(0, 10));
            if (priorityRank === 'any') fallbackQuery = fallbackQuery.where('rank', '>', 0);
            else if (priorityRank && !isNaN(Number(priorityRank))) fallbackQuery = fallbackQuery.where('rank', '>', 0).where('rank', '<=', Number(priorityRank));
            
            if (search) {
                const ytId = extractYouTubeId(search);
                if (ytId) fallbackQuery = fallbackQuery.where('youtubeVideoId', '==', ytId);
                else if (/^https?:\/\//i.test(search)) fallbackQuery = fallbackQuery.where('url', '==', search);
                else {
                    const searchTokens = search.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(t => t.length >= 2).slice(0, 10);
                    if (searchTokens.length > 0) fallbackQuery = fallbackQuery.where('searchKeywords', 'array-contains-any', searchTokens);
                }
            }

            fallbackQuery = fallbackQuery.orderBy('updatedAt', 'desc');
            query = fallbackQuery;
            
            const fallbackCount = await query.count().get();
            total = fallbackCount.data().count;
        }

        const snapshot = await query
            .offset((page - 1) * pageSize)
            .limit(pageSize)
            .get();

        finalResources = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            const formatDate = (val: any) => {
                if (!val) return null;
                if (typeof val.toDate === 'function') return val.toDate().toISOString();
                if (val instanceof Date) return val.toISOString();
                if (typeof val === 'string') return val;
                return null;
            };

            return {
                id: doc.id,
                status: 'published', // Default for legacy data
                ...data,
                createdAt: formatDate(data.createdAt),
                updatedAt: formatDate(data.updatedAt),
            };
        });

        // SELF-HEALING: Background Sync for YouTube Thumbnails
        finalResources.forEach((r: any) => {
            const ytId = r.url ? extractYouTubeId(r.url) : null;
            const expectedThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
            
            // Aggressive Healing: If it's YouTube and the thumbnail doesn't match our HQ standard, fix it.
            // This covers missing (null/empty), broken, or low-res thumbnails.
            if (ytId && expectedThumb && r.thumbnailUrl !== expectedThumb) {
                console.log(`[SelfHealing] Repairing thumbnail for ${r.id} (${r.title}) -> ${expectedThumb}`);
                
                // Heal locally for immediate UI update
                r.thumbnailUrl = expectedThumb;
                
                // Heal in Firestore (Background)
                adminDb.collection('resources').doc(r.id).update({
                    thumbnailUrl: expectedThumb,
                    updatedAt: new Date()
                }).catch(e => console.error(`[SelfHealing] Failed to sync thumbnail for ${r.id}:`, e));
            }
        });

        // Fetch creator profiles for the current page
        const userIds = Array.from(new Set(finalResources.map((r: any) => r.addedBy).filter(Boolean)));
        const creatorProfiles: Record<string, any> = {};

        if (userIds.length > 0) {
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

        // ── ENRICH WITH ACTIVE TICKETS ──
        const resourceIds = resourcesWithCreators.map(r => r.id);
        if (resourceIds.length > 0) {
            try {
                // Fetch all open tickets for these resources in chunks of 10 (Firestore limit)
                const ticketMap: Record<string, string> = {};
                const chunks = [];
                for (let i = 0; i < resourceIds.length; i += 10) {
                    chunks.push(resourceIds.slice(i, i + 10));
                }

                await Promise.all(chunks.map(async (chunk) => {
                    const ticketsSnap = await accreditationDb.collection('tickets')
                        .where('remediation.resourceId', 'in', chunk)
                        .where('status', 'in', ['open', 'in_progress'])
                        .get();
                    
                    ticketsSnap.docs.forEach(doc => {
                        const data = doc.data();
                        if (data.remediation?.resourceId) {
                            ticketMap[data.remediation.resourceId] = doc.id;
                        }
                    });
                }));

                resourcesWithCreators.forEach((r: any) => {
                    r.activeTicketId = ticketMap[r.id] || null;
                });
            } catch (ticketError) {
                console.error('[ResourcesServer] Failed to enrich with tickets:', ticketError);
            }
        }

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

        if (protection.avEnabled && !isVerified && protection.avStrictness === 'maximum') {
            console.log(`[SovereignGate] Blocked access to resource ${id}: Age Verification Required (Maximum Strictness).`);
            return null;
        }

        const docRef = await adminDb.collection('resources').doc(id).get();
        if (!docRef.exists) return null;

        const data = docRef.data() as any;
        
        if (data.status === 'hidden' || data.status === 'draft' || data.status === 'pending') {
            return null;
        }
        const resource = {
            id: docRef.id,
            status: 'published',
            ...data,
            createdAt: data.createdAt?.toDate()?.toISOString() || null,
            updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
        } as Resource;

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

        // --- ENRICH ATTRIBUTIONS ---
        if (resource.attributedUserIds && resource.attributedUserIds.length > 0) {
            const uids = resource.attributedUserIds.slice(0, 10);
            
            // 1. Try Suite-wide Registry first (toolDbAdmin)
            const suiteRefs = uids.map(uid => toolDbAdmin.collection('users').doc(uid));
            const suiteDocs = await toolDbAdmin.getAll(...suiteRefs);
            
            const profileMap: Record<string, any> = {};
            const missingUids: string[] = [];
            
            suiteDocs.forEach(doc => {
                const data = doc.data();
                if (doc.exists && data) {
                    profileMap[doc.id] = data;
                    // If global record exists but is missing an avatar, still try local fallback
                    if (!data.photoURL) {
                        missingUids.push(doc.id);
                    }
                } else {
                    missingUids.push(doc.id);
                }
            });

            // 2. Fallback to Local Creator Database (adminDb) for missing ones (or missing avatars)
            if (missingUids.length > 0) {
                const localRefs = missingUids.map(uid => adminDb.collection('users').doc(uid));
                const localDocs = await adminDb.getAll(...localRefs);
                localDocs.forEach(doc => {
                    const localData = doc.data();
                    if (doc.exists && localData) {
                        // Only overwrite or fill in if the local record has a photoURL
                        if (localData.photoURL || !profileMap[doc.id]) {
                            profileMap[doc.id] = { 
                                ...(profileMap[doc.id] || {}), 
                                ...localData 
                            };
                        }
                    }
                });
            }

            resource.attributions = resource.attributions.map(attr => {
                if (attr.userId && profileMap[attr.userId]) {
                    return {
                        ...attr,
                        photoURL: profileMap[attr.userId].photoURL,
                        name: profileMap[attr.userId].displayName || attr.name 
                    };
                }
                return attr;
            });
        }

        // --- ENRICH WITH ACTIVE TICKET ---
        try {
            const ticketsSnap = await accreditationDb.collection('tickets')
                .where('remediation.resourceId', '==', id)
                .where('status', 'in', ['open', 'in_progress'])
                .limit(1)
                .get();
            
            if (!ticketsSnap.empty) {
                resource.activeTicketId = ticketsSnap.docs[0].id;
            }
        } catch (ticketError) {
            console.error('[ResourcesServer] Failed to enrich detail with ticket:', ticketError);
        }

        return resource;
    } catch (error) {
        console.error('Error fetching resource by ID:', error);
        return null;
    }
}

export async function getAllCategories() {
    try {
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
