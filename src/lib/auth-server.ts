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
    const { toolDbAdmin, adminDb } = await import('./firebase-admin');
    
    // 1. Try Master Registry (PromptTool)
    const masterDoc = await toolDbAdmin.collection('users').doc(uid).get();
    if (masterDoc.exists && (masterDoc.data()?.role === 'admin' || masterDoc.data()?.role === 'su')) {
        return true;
    }

    // 2. Fallback to Local Registry (PromptResources)
    const localDoc = await adminDb.collection('users').doc(uid).get();
    if (localDoc.exists && (localDoc.data()?.role === 'admin' || localDoc.data()?.role === 'su')) {
        return true;
    }

    return false;
}
