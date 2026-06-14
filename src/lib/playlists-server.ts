import { adminDb, toolDbAdmin } from '@/lib/firebase-admin';
import { Playlist, Resource } from '@/lib/types';
import { extractYouTubeId } from '@/lib/youtube';

export interface GetPlaylistsOptions {
    search?: string | null;
    addedBy?: string | null;
    status?: 'published' | 'private' | null;
    userOnly?: boolean;
    page?: number;
    pageSize?: number;
    userUid?: string | null;
    userIsAdmin?: boolean;
    sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'ranking' | null;
    sortOrder?: 'asc' | 'desc' | null;
    ranking?: number | null;
}

/**
 * Resolves the cover thumbnail url for a playlist based on its source settings.
 */
async function resolvePlaylistThumbnail(playlistData: any): Promise<string | null> {
    const { thumbnailSource, thumbnailResourceId, thumbnailUrl, resourceIds } = playlistData;

    if (thumbnailSource === 'custom') {
        return thumbnailUrl || null;
    }

    if (thumbnailSource === 'resource' && thumbnailResourceId) {
        try {
            const resSnap = await adminDb.collection('resources').doc(thumbnailResourceId).get();
            if (resSnap.exists) {
                const resData = resSnap.data();
                return resData?.thumbnailUrl || null;
            }
        } catch (e) {
            console.error('[PlaylistsServer] Error resolving resource thumbnail:', e);
        }
    }

    // Default 'derived': check first resource in list
    if (resourceIds && resourceIds.length > 0) {
        try {
            const firstId = resourceIds[0];
            const resSnap = await adminDb.collection('resources').doc(firstId).get();
            if (resSnap.exists) {
                const resData = resSnap.data();
                return resData?.thumbnailUrl || null;
            }
        } catch (e) {
            console.error('[PlaylistsServer] Error resolving derived first resource thumbnail:', e);
        }
    }

    return null;
}

export async function getPlaylistsAction(options: GetPlaylistsOptions) {
    const {
        search,
        addedBy,
        status,
        userOnly = false,
        page = 1,
        pageSize = 24,
        userUid = null,
        userIsAdmin = false,
        sortBy = 'ranking',
        sortOrder = 'desc',
        ranking = null
    } = options;
 
    try {
        let query: any = adminDb.collection('playlists');
 
        // Apply owner/public filters
        if (userOnly && userUid) {
            query = query.where('addedBy', '==', userUid);
        } else if (addedBy) {
            query = query.where('addedBy', '==', addedBy);
            // Public lists only unless requester is owner/admin
            if (addedBy !== userUid && !userIsAdmin) {
                query = query.where('status', '==', 'published');
            }
        } else if (status) {
            query = query.where('status', '==', status);
        } else if (!userIsAdmin) {
            // Public viewing only by default
            query = query.where('status', '==', 'published');
        }
 
        // Firestore query (index-free, sorting in-memory below)
        const snapshot = await query.get();
        let allPlaylists = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                ranking: data.ranking !== undefined ? data.ranking : 1
            };
        }) as Playlist[];
 
        // Filter by ranking in-memory if specified
        if (ranking !== null && ranking !== undefined) {
            allPlaylists = allPlaylists.filter(p => p.ranking === ranking);
        }
 
        const finalSortBy = sortBy || 'updatedAt';
        const finalSortOrder = sortOrder || 'desc';
 
        // In-memory dynamic sort
        allPlaylists.sort((a, b) => {
            if (finalSortBy === 'title') {
                const titleA = (a.title || '').toLowerCase();
                const titleB = (b.title || '').toLowerCase();
                if (titleA < titleB) return finalSortOrder === 'asc' ? -1 : 1;
                if (titleA > titleB) return finalSortOrder === 'asc' ? 1 : -1;
                return 0;
            } else if (finalSortBy === 'ranking') {
                const rankA = a.ranking !== undefined ? a.ranking : 1;
                const rankB = b.ranking !== undefined ? b.ranking : 1;
                return finalSortOrder === 'asc' ? rankA - rankB : rankB - rankA;
            } else {
                const parseDate = (val: any) => {
                    if (!val) return 0;
                    if (typeof val.toDate === 'function') return val.toDate().getTime();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime();
                };
                const timeA = parseDate((a as any)[finalSortBy]);
                const timeB = parseDate((b as any)[finalSortBy]);
                return finalSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
            }
        });
 
        // In-memory text search if requested
        if (search) {
            const term = search.toLowerCase();
            allPlaylists = allPlaylists.filter(p =>
                (p.title || '').toLowerCase().includes(term) ||
                (p.description || '').toLowerCase().includes(term) ||
                (p.tags || []).some(t => t.toLowerCase().includes(term))
            );
        }

        const total = allPlaylists.length;
        const startIndex = (page - 1) * pageSize;
        const pagePlaylists = allPlaylists.slice(startIndex, startIndex + pageSize);

        // Enrich with creators and thumbnails
        const creatorProfiles: Record<string, any> = {};
        const uids = Array.from(new Set(pagePlaylists.map(p => p.addedBy).filter(Boolean)));

        if (uids.length > 0) {
            await Promise.all(uids.map(async (uid) => {
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

        const enrichedPlaylists = await Promise.all(pagePlaylists.map(async (p) => {
            const cover = await resolvePlaylistThumbnail(p);
            return {
                ...p,
                thumbnailUrl: cover,
                creator: p.addedBy ? creatorProfiles[p.addedBy] : { displayName: 'Community' },
                createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : p.createdAt),
                updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : (p.updatedAt?.toDate ? p.updatedAt.toDate().toISOString() : p.updatedAt)
            };
        }));

        return {
            playlists: enrichedPlaylists as Playlist[],
            total,
            hasMore: startIndex + pagePlaylists.length < total
        };
    } catch (e) {
        console.error('[PlaylistsServer] Error fetching playlists:', e);
        throw e;
    }
}

export async function getPlaylistById(id: string, userUid?: string | null, userIsAdmin = false) {
    try {
        const docRef = await adminDb.collection('playlists').doc(id).get();
        if (!docRef.exists) return null;

        const data = docRef.data() as any;

        // Visibility gate
        if (data.status === 'private' && data.addedBy !== userUid && !userIsAdmin) {
            return null;
        }

        const cover = await resolvePlaylistThumbnail({ ...data, id });
        const creatorDoc = await toolDbAdmin.collection('users').doc(data.addedBy).get();
        const creator = creatorDoc.exists ? {
            displayName: creatorDoc.data()?.displayName || 'Unknown User',
            photoURL: creatorDoc.data()?.photoURL || null
        } : { displayName: 'Community' };

        // Fetch full resources in their exact order
        const resolvedResources: Resource[] = [];
        const resourceIds = data.resourceIds || [];

        if (resourceIds.length > 0) {
            // Query in chunks of 10 docs (Firestore limit for getAll)
            const chunks: string[][] = [];
            for (let i = 0; i < resourceIds.length; i += 10) {
                chunks.push(resourceIds.slice(i, i + 10));
            }

            const rawResourceMap: Record<string, Resource> = {};
            await Promise.all(chunks.map(async (chunk) => {
                const refs = chunk.map(rid => adminDb.collection('resources').doc(rid));
                const docs = await adminDb.getAll(...refs);
                docs.forEach(docSnap => {
                    if (docSnap.exists) {
                        const rData = docSnap.data() as any;
                        const formatDate = (val: any) => {
                            if (!val) return null;
                            if (typeof val.toDate === 'function') return val.toDate().toISOString();
                            if (val instanceof Date) return val.toISOString();
                            return val;
                        };
                        rawResourceMap[docSnap.id] = {
                            id: docSnap.id,
                            ...rData,
                            createdAt: formatDate(rData.createdAt),
                            updatedAt: formatDate(rData.updatedAt)
                        } as Resource;
                    }
                });
            }));

            // Keep the exact order of the playlist's resourceIds
            resourceIds.forEach((rid: string) => {
                if (rawResourceMap[rid]) {
                    resolvedResources.push(rawResourceMap[rid]);
                }
            });
        }

        return {
            id,
            ...data,
            ranking: data.ranking !== undefined ? data.ranking : 3,
            thumbnailUrl: cover,
            creator,
            resources: resolvedResources as Resource[],
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        };
    } catch (e) {
        console.error('[PlaylistsServer] Error fetching playlist details:', e);
        return null;
    }
}

export async function createPlaylistAction(playlist: Partial<Playlist>, userUid: string) {
    if (!playlist.title?.trim()) {
        throw new Error('Playlist title is required');
    }

    try {
        const now = new Date();
        const playlistData = {
            title: playlist.title.trim(),
            description: playlist.description?.trim() || '',
            thumbnailUrl: null,
            thumbnailSource: playlist.thumbnailSource || 'derived',
            thumbnailResourceId: playlist.thumbnailResourceId || null,
            resourceIds: playlist.resourceIds || [],
            addedBy: userUid,
            status: playlist.status || 'private',
            ranking: playlist.ranking !== undefined ? playlist.ranking : 3,
            tags: playlist.tags || [],
            createdAt: now,
            updatedAt: now
        };

        const docRef = await adminDb.collection('playlists').add(playlistData);
        return {
            id: docRef.id,
            ...playlistData,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        };
    } catch (e) {
        console.error('[PlaylistsServer] Error creating playlist:', e);
        throw e;
    }
}

export async function updatePlaylistAction(id: string, updates: Partial<Playlist>, userUid: string, userIsAdmin = false) {
    try {
        const docRef = adminDb.collection('playlists').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            throw new Error('Playlist not found');
        }

        const data = docSnap.data();
        if (data?.addedBy !== userUid && !userIsAdmin) {
            throw new Error('Unauthorized update access');
        }

        const now = new Date();
        const patch: Record<string, any> = {
            updatedAt: now
        };

        if (updates.title !== undefined) patch.title = updates.title.trim();
        if (updates.description !== undefined) patch.description = updates.description.trim();
        if (updates.status !== undefined) patch.status = updates.status;
        if (updates.resourceIds !== undefined) patch.resourceIds = updates.resourceIds;
        if (updates.thumbnailSource !== undefined) patch.thumbnailSource = updates.thumbnailSource;
        if (updates.thumbnailResourceId !== undefined) patch.thumbnailResourceId = updates.thumbnailResourceId;
        if (updates.thumbnailUrl !== undefined) patch.thumbnailUrl = updates.thumbnailUrl;
        if (updates.ranking !== undefined) patch.ranking = updates.ranking;
        if (updates.tags !== undefined) patch.tags = updates.tags;

        await docRef.update(patch);

        return {
            id,
            ...data,
            ...patch,
            updatedAt: now.toISOString()
        };
    } catch (e) {
        console.error('[PlaylistsServer] Error updating playlist:', e);
        throw e;
    }
}

export async function deletePlaylistAction(id: string, userUid: string, userIsAdmin = false) {
    try {
        const docRef = adminDb.collection('playlists').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            throw new Error('Playlist not found');
        }

        const data = docSnap.data();
        if (data?.addedBy !== userUid && !userIsAdmin) {
            throw new Error('Unauthorized delete access');
        }

        await docRef.delete();
        return { success: true };
    } catch (e) {
        console.error('[PlaylistsServer] Error deleting playlist:', e);
        throw e;
    }
}
