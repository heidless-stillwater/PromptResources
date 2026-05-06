import { NextResponse } from 'next/server';
import { adminAuth, toolDbAdmin } from '@/lib/firebase-admin';
import { sanitize } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(idToken);
        
        // Check role in Firestore since customClaims might not be populated in the local emulator
        const userDoc = await toolDbAdmin.collection('users').doc(decoded.uid).get();
        const userData = userDoc.data() || {};
        const isAdmin = 
            decoded.role === 'admin' || 
            decoded.role === 'su' ||
            userData.role === 'admin' || 
            userData.role === 'su' || 
            decoded.email === process.env.ADMIN_EMAIL;

        if (!isAdmin) {
            console.error('[API] /admin/users Forbidden: User is not admin', decoded.email);
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }


        // Fetch auth users
        const listUsersResult = await adminAuth.listUsers(1000);
        
        // Fetch firestore users from both potential authorities to augment data
        const dbUsersSnap = await toolDbAdmin.collection('users').get();
        const defaultDbSnap = await (await import('@/lib/firebase-admin')).getDb('(default)')?.collection('users').get();
        
        const dbUsersMap = new Map();
        // 1. Load from Tool DB (Primary for suite)
        dbUsersSnap.docs.forEach((d: any) => dbUsersMap.set(d.id, d.data()));
        // 2. Overlay from Default DB (Legacy/Global fallback)
        defaultDbSnap?.docs.forEach((d: any) => {
            const existing = dbUsersMap.get(d.id) || {};
            dbUsersMap.set(d.id, { ...existing, ...d.data() });
        });

        const users = listUsersResult.users.map(u => {
            const dbUser = dbUsersMap.get(u.uid) || {};
            return {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName || dbUser.displayName || 'Anonymous',
                role: u.customClaims?.role || dbUser.role || 'member',
                subscriptionType: u.customClaims?.tier || dbUser.subscriptionType || 'free',
                createdAt: u.metadata.creationTime,
                lastSignInTime: u.metadata.lastSignInTime,
                isPublicProfile: dbUser.isPublicProfile || false,
                isStub: dbUser.isStub || false,
                subscription: dbUser.subscription
            };
        });
        console.log(`[API] /admin/users returning ${users.length} users`);
        return NextResponse.json({ success: true, users: sanitize(users) });
    } catch (e: any) {
        console.error('[API] /admin/users Error:', e.message, e.stack);
        return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 });
    }
}
