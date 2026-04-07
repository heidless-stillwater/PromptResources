const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function backfillCreatorStats() {
    console.log('Recalculating all creator stats...');
    const creators = await db.collection('users').get();
    
    for (const doc of creators.docs) {
        const creatorId = doc.id;
        const resQuery = await db.collection('resources')
            .where('attributedUserIds', 'array-contains', creatorId)
            .get();
            
        let authored = 0;
        let curated = 0;
        
        resQuery.docs.forEach(rDoc => {
            const data = rDoc.data();
            const attr = (data.attributions || []).find(a => a.userId === creatorId);
            if (attr) {
                if (['author', 'creator', 'source'].includes(attr.role)) authored++;
                else curated++;
            }
        });
        
        await db.collection('users').doc(creatorId).update({
            resourceCount: resQuery.docs.length,
            authoredCount: authored,
            curatedCount: curated,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Updated ${doc.data().displayName}: Authored=${authored}, Curated=${curated}`);
    }
    process.exit(0);
}

backfillCreatorStats();
