import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isYouTubeUrl, getYouTubeMetadataServer, isGenericYouTubeName, deduplicateCredits } from '@/lib/youtube';
import { Resource } from '@/lib/types';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const docRef = adminDb.collection('resources').doc(params.id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json(
                { success: false, error: 'Resource not found' },
                { status: 404 }
            );
        }

        const data = docSnap.data();
        let resource = {
            id: docSnap.id,
            ...data,
            createdAt: data?.createdAt?.toDate()?.toISOString() || null,
            updatedAt: data?.updatedAt?.toDate()?.toISOString() || null,
        } as Resource;

        // --- SELF-HEALING LOGIC ---
        // If it's a YouTube resource and has generic credits, auto-enrich and update in background
        const hasGenericYT = resource.url && isYouTubeUrl(resource.url) &&
            (resource.credits?.length === 0 || resource.credits?.some(c => isGenericYouTubeName(c.name)));

        if (hasGenericYT) {
            try {
                const metadata = await getYouTubeMetadataServer(resource.url!);
                if (metadata && metadata.author_name) {
                    const newCredits = deduplicateCredits(resource.credits?.length > 0
                        ? resource.credits.map(c => isGenericYouTubeName(c.name) ? { ...c, name: metadata.author_name, url: metadata.author_url || c.url } : c)
                        : [{ name: metadata.author_name, url: metadata.author_url || resource.url! }]);

                    // Update local copy immediately for faster UI response
                    resource.credits = newCredits;

                    // Update Firestore in background (fire and forget)
                    adminDb.collection('resources').doc(params.id).update({
                        credits: newCredits,
                        updatedAt: new Date()
                    }).catch(e => console.error('Background self-healing update failed:', e));
                }
            } catch (err) {
                console.error('Self-healing metadata enrichment failed:', err);
            }
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

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const docRef = adminDb.collection('resources').doc(params.id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json(
                { success: false, error: 'Resource not found' },
                { status: 404 }
            );
        }

        const now = new Date();
        const updateData = {
            ...body,
            updatedAt: now,
        };

        // Remove ID if present in body to avoid writing it as a field
        delete updateData.id;

        await docRef.update(updateData);

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
