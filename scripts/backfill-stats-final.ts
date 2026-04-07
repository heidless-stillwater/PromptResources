import { adminDb } from '../src/lib/firebase-admin';
import * as admin from 'firebase-admin';

async function backfillCreatorStats() {
    try {
        console.log('🚀 Recalculating all creator stats...');
        const creators = await adminDb.collection('users').get();
        console.log(`Found ${creators.size} creators to process.`);
        
        for (const doc of creators.docs) {
            const creatorId = doc.id;
            const displayName = doc.data().displayName || 'Unknown';
            
            // Get all published resources where this user is attributed
            const resQuery = await adminDb.collection('resources')
                .where('status', '==', 'published')
                .where('attributedUserIds', 'array-contains', creatorId)
                .get();
                
            let authored = 0;
            let curated = 0;
            
            resQuery.docs.forEach(rDoc => {
                const data = rDoc.data();
                const attributions = data.attributions || [];
                const myAttr = attributions.find((a: any) => a.userId === creatorId);
                
                if (myAttr) {
                    // Roles that count as 'Authored'
                    const authoredRoles = ['author', 'creator', 'source', 'presenter'];
                    if (authoredRoles.includes(myAttr.role)) {
                        authored++;
                    } else {
                        curated++;
                    }
                }
            });
            
            await adminDb.collection('users').doc(creatorId).update({
                resourceCount: resQuery.docs.length,
                authoredCount: authored,
                curatedCount: curated,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`✅ Updated ${displayName}: Total=${resQuery.docs.length}, Authored=${authored}, Curated=${curated}`);
        }
        
        console.log('✨ All stats updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during backfill:', error);
        process.exit(1);
    }
}

backfillCreatorStats();
