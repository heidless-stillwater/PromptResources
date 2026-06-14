import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isYouTubeUrl, getYouTubeMetadataServer, isGenericYouTubeName, deduplicateAttributions, extractYouTubeId } from '@/lib/youtube';
import { resolveAttributions, syncCreatorStats } from '@/lib/creators-server';
import { Resource } from '@/lib/types';
import { generateSearchKeywords } from '@/lib/utils';
import { getResourceById } from '@/lib/resources-server';
import { syncResourceTags } from '@/lib/tags-server';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // 1. Try to get enriched resource from server helper
        let resource = await getResourceById(params.id);

        // 2. Fallback to raw fetch for non-published resources (if requester has access)
        if (!resource) {
            const docRef = adminDb.collection('resources').doc(params.id);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                return NextResponse.json(
                    { success: false, error: 'Resource not found' },
                    { status: 404 }
                );
            }

            const data = docSnap.data();
            const formatDate = (val: any) => {
                if (!val) return null;
                if (typeof val.toDate === 'function') return val.toDate().toISOString();
                if (val instanceof Date) return val.toISOString();
                if (typeof val === 'string') return val;
                return null;
            };

            resource = {
                id: docSnap.id,
                ...data,
                createdAt: formatDate(data?.createdAt),
                updatedAt: formatDate(data?.updatedAt),
            } as Resource;
        }

        // 3. Final safety check
        if (!resource) {
            return NextResponse.json(
                { success: false, error: 'Resource not found' },
                { status: 404 }
            );
        }

        // --- SELF-HEALING LOGIC ---
        // If it's a YouTube resource and has generic attributions, auto-enrich and update in background
        const hasGenericYT = resource.url && isYouTubeUrl(resource.url) &&
            (resource.attributions?.length === 0 || resource.attributions?.some(c => isGenericYouTubeName(c.name)));

        if (hasGenericYT) {
            try {
                const metadata = await getYouTubeMetadataServer(resource.url!);
                if (metadata && metadata.author_name) {
                    const newAttributions = deduplicateAttributions(resource.attributions?.length > 0
                        ? resource.attributions.map(c => isGenericYouTubeName(c.name) ? { ...c, name: metadata.author_name, url: metadata.author_url || c.url } : c)
                        : [{ name: metadata.author_name, url: metadata.author_url || resource.url! }]);

                    // Update local copy immediately for faster UI response
                    resource.attributions = newAttributions;

                    // Update Firestore in background (fire and forget)
                    const updatePayload: any = {
                        attributions: newAttributions,
                        attributionNames: newAttributions.map(a => a.name).filter(Boolean),
                        updatedAt: new Date()
                    };

                    // SELF-HEALING: If thumbnail is missing or is not the standard YT one, update it
                    const expectedYTThumbnail = `https://img.youtube.com/vi/${extractYouTubeId(resource.url!) || ''}/hqdefault.jpg`;
                    if (!resource.thumbnailUrl || (resource.thumbnailUrl !== expectedYTThumbnail && resource.thumbnailUrl.includes('img.youtube.com'))) {
                        updatePayload.thumbnailUrl = expectedYTThumbnail;
                        resource.thumbnailUrl = expectedYTThumbnail; // Update local copy
                    }

                    adminDb.collection('resources').doc(params.id).update(updatePayload)
                        .catch(e => console.error('Background self-healing update failed:', e));
                }
            } catch (err) {
                console.error('Self-healing metadata enrichment failed:', err);
            }
        }
        // --- SELF-HEALING ATTRIBUTIONS ---
        // If resource has attributions but they haven't been resolved to User IDs, do it now in background
        const needsAttributionResolution = resource.attributions?.length > 0 && (!resource.attributedUserIds || resource.attributedUserIds.length === 0);
        
        if (needsAttributionResolution) {
            resolveAttributions(resource.attributions, resource.url || undefined).then(async (resolved) => {
                if (resolved.attributedUserIds?.length > 0) {
                    await adminDb.collection('resources').doc(params.id).update({
                        attributions: resolved.resolvedAttributions,
                        attributedUserIds: resolved.attributedUserIds,
                        updatedAt: new Date()
                    });
                    console.log(`Background attribution resolution success for resource ${params.id}`);
                    
                    // Sync stats for discovered creators
                    Promise.all(resolved.attributedUserIds.map(uid => syncCreatorStats(uid)))
                        .catch(e => console.error('Error syncing stats during healing:', e));
                }
            }).catch(e => console.error('Background attribution resolution failed:', e));
        }
        // -------------------------

        return NextResponse.json({
            success: true,
            data: resource,
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

import { getAuthUser, isAdmin } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const docRef = adminDb.collection('resources').doc(params.id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json(
                { success: false, error: 'Resource not found' },
                { status: 404 }
            );
        }

        const resourceData = docSnap.data();
        const adminStatus = await isAdmin(decodedToken.uid);
        const isOwner = resourceData?.addedBy === decodedToken.uid;

        if (!adminStatus && !isOwner) {
            return NextResponse.json(
                { success: false, error: 'Forbidden: You do not have permission to edit this resource' },
                { status: 403 }
            );
        }

        const body = await request.json();
        
        let finalAttributions = body.attributions;
        let attributedUserIds = undefined;

        if (finalAttributions && Array.isArray(finalAttributions)) {
            const resolved = await resolveAttributions(finalAttributions, body.url || resourceData?.url);
            finalAttributions = resolved.resolvedAttributions;
            attributedUserIds = resolved.attributedUserIds;
        }

        const now = new Date();
        const updateData: any = {
            ...body,
            updatedAt: now,
        };

        if (finalAttributions) {
            updateData.attributions = finalAttributions;
            updateData.attributionNames = finalAttributions.map((a: any) => a.name).filter(Boolean);
        }
        if (attributedUserIds !== undefined) {
            updateData.attributedUserIds = attributedUserIds;
        }

        if (body.url !== undefined) {
            const ytId = body.url ? extractYouTubeId(body.url) : null;
            updateData.youtubeVideoId = ytId;
            // If URL changed and no new thumbnail provided, auto-derive it
            if (ytId && !body.thumbnailUrl) {
                updateData.thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
            }
        }

        // Regenerate search keywords if title or categories change
        if (body.title !== undefined || body.categories !== undefined) {
            const updatedTitle = body.title !== undefined ? body.title : resourceData?.title;
            const updatedCategories = body.categories !== undefined ? body.categories : resourceData?.categories;
            updateData.searchKeywords = generateSearchKeywords(updatedTitle, updatedCategories);
        }

        // Remove sensitive fields if present in body to avoid writing them as fields
        delete updateData.id;
        delete updateData.addedBy;
        delete updateData.createdAt;

        await docRef.update(updateData);

        // Sync tag usage counts in master list
        if (body.tags && Array.isArray(body.tags)) {
            const previousTags: string[] = resourceData?.tags || [];
            const currentTags: string[] = body.tags;
            const addedTags = currentTags.filter(t => !previousTags.includes(t));
            const removedTags = previousTags.filter(t => !currentTags.includes(t));
            if (addedTags.length > 0 || removedTags.length > 0) {
                syncResourceTags(addedTags, removedTags, decodedToken.uid)
                    .catch(e => console.error('Error syncing tags after PATCH:', e));
            }
        }

        // Revalidate the paths immediately
        revalidatePath('/resources', 'page');
        revalidatePath(`/resources/${params.id}`, 'page');
        revalidatePath('/', 'page');
        revalidatePath('/resources');
        revalidatePath(`/resources/${params.id}`);
        revalidatePath('/'); // Homepage might show this resource too
        
        // Sync stats for affected creators
        const affectedUids = new Set<string>();
        if (resourceData?.attributedUserIds) {
            resourceData.attributedUserIds.forEach((uid: string) => affectedUids.add(uid));
        }
        if (attributedUserIds) {
            attributedUserIds.forEach((uid: string) => affectedUids.add(uid));
        }
        
        if (affectedUids.size > 0) {
            Promise.all(Array.from(affectedUids).map(uid => syncCreatorStats(uid)))
                .catch(e => console.error('Error syncing creator stats after PATCH:', e));
        }

        return NextResponse.json({
            success: true,
            data: {
                ...docSnap.data(),
                ...updateData,
                id: params.id,
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await getAuthUser(request);
        if (!decodedToken) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const docRef = adminDb.collection('resources').doc(params.id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json(
                { success: false, error: 'Resource not found' },
                { status: 404 }
            );
        }

        const resourceData = docSnap.data();
        const adminStatus = await isAdmin(decodedToken.uid);
        const isOwner = resourceData?.addedBy === decodedToken.uid;

        if (!adminStatus && !isOwner) {
            return NextResponse.json(
                { success: false, error: 'Forbidden: You do not have permission to delete this resource' },
                { status: 403 }
            );
        }

        const tags = resourceData?.tags || [];
        await docRef.delete();

        // Decrement tag counts in the master list
        if (tags.length > 0) {
            await syncResourceTags([], tags, decodedToken.uid);
        }

        // Revalidate listing page
        revalidatePath('/resources');
        revalidatePath('/');

        // Sync stats for previously attributed creators
        if (resourceData?.attributedUserIds && Array.isArray(resourceData.attributedUserIds)) {
            Promise.all(resourceData.attributedUserIds.map((uid: string) => syncCreatorStats(uid)))
                .catch(e => console.error('Error syncing creator stats after DELETE:', e));
        }

        return NextResponse.json({
            success: true,
            message: 'Resource deleted successfully'
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
