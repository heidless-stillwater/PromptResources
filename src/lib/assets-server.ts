import { adminDb } from '@/lib/firebase-admin';
import { ThumbnailAsset } from '@/lib/types';

export async function getThumbnailAssets(tags?: string[]) {
    try {
        let query: any = adminDb.collection('thumbnailAssets').orderBy('createdAt', 'desc');
        
        if (tags && tags.length > 0) {
            query = query.where('tags', 'array-contains-any', tags);
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc: any) => {
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
                ...data,
                createdAt: formatDate(data.createdAt),
                updatedAt: formatDate(data.updatedAt),
            };
        }) as ThumbnailAsset[];
    } catch (error) {
        console.error('Error fetching thumbnail assets:', error);
        return [];
    }
}

export async function createThumbnailAsset(data: Omit<ThumbnailAsset, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        const now = new Date();
        const docRef = await adminDb.collection('thumbnailAssets').add({
            ...data,
            createdAt: now,
            updatedAt: now,
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating thumbnail asset:', error);
        throw error;
    }
}

export async function deleteThumbnailAsset(id: string) {
    try {
        await adminDb.collection('thumbnailAssets').doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error deleting thumbnail asset:', error);
        throw error;
    }
}

export async function updateThumbnailAsset(id: string, data: Partial<ThumbnailAsset>) {
    try {
        const updateData = {
            ...data,
            updatedAt: new Date(),
        };
        delete (updateData as any).id;
        delete (updateData as any).createdAt;
        
        await adminDb.collection('thumbnailAssets').doc(id).update(updateData);
        return true;
    } catch (error) {
        console.error('Error updating thumbnail asset:', error);
        throw error;
    }
}
