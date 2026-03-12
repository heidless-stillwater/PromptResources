// API: GET /api/member/[uid] - Get member data
// PLACEHOLDER: Uses API_SECRET_KEY for auth. Replace with proper auth in production.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: { uid: string } }
) {
    try {
        // Placeholder API key authentication
        const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('apiKey');
        const expectedKey = process.env.API_SECRET_KEY || 'pr_placeholder_api_key_change_me';

        if (apiKey !== expectedKey) {
            return NextResponse.json(
                { success: false, error: 'Invalid or missing API key. Use x-api-key header or apiKey query parameter.' },
                { status: 401 }
            );
        }

        const uid = params.uid;

        // Fetch user profile
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json(
                { success: false, error: 'Member not found' },
                { status: 404 }
            );
        }

        const userData = userDoc.data();

        // Fetch user resource data (saved, notes, progress)
        const userResDoc = await adminDb.collection('userResources').doc(uid).get();
        const userResData = userResDoc.exists ? userResDoc.data() : { savedResources: [], notes: {}, progress: {} };

        // Fetch full saved resource details
        let savedResourceDetails: any[] = [];
        const savedIds = userResData?.savedResources || [];
        if (savedIds.length > 0) {
            for (const id of savedIds) {
                try {
                    const rDoc = await adminDb.collection('resources').doc(id).get();
                    if (rDoc.exists) {
                        const data = rDoc.data();
                        savedResourceDetails.push({
                            id: rDoc.id,
                            ...data,
                            createdAt: data?.createdAt?.toDate()?.toISOString() || null,
                            updatedAt: data?.updatedAt?.toDate()?.toISOString() || null,
                        });
                    }
                } catch (err) {
                    console.error(`Error fetching resource ${id}:`, err);
                    // Continue to next resource instead of failing the whole request
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                profile: {
                    uid: userDoc.id,
                    email: userData?.email,
                    displayName: userData?.displayName,
                    role: userData?.role,
                    subscriptionType: userData?.subscriptionType,
                    createdAt: userData?.createdAt?.toDate()?.toISOString() || null,
                },
                savedResources: savedResourceDetails,
                notes: userResData?.notes || {},
                progress: userResData?.progress || {},
                stats: {
                    totalSaved: userResData?.savedResources?.length || 0,
                    totalCompleted: Object.values(userResData?.progress || {}).filter((s) => s === 'completed').length,
                    totalInProgress: Object.values(userResData?.progress || {}).filter((s) => s === 'in-progress').length,
                },
            },
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
