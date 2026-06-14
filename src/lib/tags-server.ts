import { adminDb } from '@/lib/firebase-admin';

/**
 * Synchronizes tag usage counts in the master 'resourceTags' collection.
 * Called when a resource is created, updated, or deleted.
 */
export async function syncResourceTags(addedTags: string[], removedTags: string[], userId: string) {
    // Process added tags
    for (const tagName of addedTags) {
        const cleanName = tagName.trim();
        if (!cleanName) continue;
        
        const querySnap = await adminDb.collection('resourceTags')
            .where('name', '==', cleanName)
            .limit(1)
            .get();
            
        if (!querySnap.empty) {
            const docRef = querySnap.docs[0].ref;
            const currentData = querySnap.docs[0].data();
            await docRef.update({
                count: (currentData.count || 0) + 1,
                updatedAt: new Date()
            });
        } else {
            const docRef = adminDb.collection('resourceTags').doc();
            await docRef.set({
                name: cleanName,
                count: 1,
                userId: userId,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
    }
    
    // Process removed tags
    for (const tagName of removedTags) {
        const cleanName = tagName.trim();
        if (!cleanName) continue;
        
        const querySnap = await adminDb.collection('resourceTags')
            .where('name', '==', cleanName)
            .limit(1)
            .get();
            
        if (!querySnap.empty) {
            const docRef = querySnap.docs[0].ref;
            const currentData = querySnap.docs[0].data();
            const currentCount = currentData.count || 0;
            await docRef.update({
                count: Math.max(0, currentCount - 1),
                updatedAt: new Date()
            });
        }
    }
}
