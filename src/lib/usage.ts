import { adminDb } from './firebase-admin';

export interface UsageLimit {
    feature: string;
    limit: number;
    usageCount: number;
    isPro: boolean;
}

export async function checkFeatureUsage(uid: string, feature: string): Promise<{ allowed: boolean; usageCount: number; limit: number }> {
    // 1. Get user profile for subscription status
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const isPro = userData?.subscriptionType === 'pro' || userData?.subscription?.status === 'active';

    // 2. Pro users have unlimited access (in this prototype)
    if (isPro) {
        return { allowed: true, usageCount: 0, limit: -1 };
    }

    // 3. Get usage for today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usageRef = adminDb.collection('users').doc(uid).collection('usage').doc(`${feature}_${today}`);
    const usageSnap = await usageRef.get();

    const limit = 3; // Free limit
    const usageCount = usageSnap.exists ? usageSnap.data()?.count || 0 : 0;

    if (usageCount >= limit) {
        return { allowed: false, usageCount, limit };
    }

    return { allowed: true, usageCount, limit };
}

export async function incrementFeatureUsage(uid: string, feature: string) {
    const today = new Date().toISOString().split('T')[0];
    const usageRef = adminDb.collection('users').doc(uid).collection('usage').doc(`${feature}_${today}`);
    
    await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(usageRef);
        if (!doc.exists) {
            transaction.set(usageRef, { count: 1, lastUsed: new Date() });
        } else {
            transaction.update(usageRef, { count: doc.data()?.count + 1, lastUsed: new Date() });
        }
    });
}
