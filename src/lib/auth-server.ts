import { adminAuth } from './firebase-admin';
import { NextRequest } from 'next/server';

export async function getAuthUser(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}

export async function isAdmin(uid: string) {
    const { toolDbAdmin: db } = await import('./firebase-admin');
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return false;
    const userData = userDoc.data();
    return userData?.role === 'admin' || userData?.role === 'su';
}
