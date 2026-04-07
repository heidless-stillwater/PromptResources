const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if (val.startsWith('\"') && val.endsWith('\"')) val = val.slice(1, -1);
        if (val.startsWith(\"'\") && val.endsWith(\"'\")) val = val.slice(1, -1);
        env[key] = val;
    }
});

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\\\n/g, '\\n').replace(/\\n/g, '\n'),
    }),
});

const db = admin.firestore();

async function backfillCreatorStats() {
    console.log('🚀 Recalculating Stats...');
    const creators = await db.collection('users').get();
    
    for (const doc of creators.docs) {
        const creatorId = doc.id;
        const resQuery = await db.collection('resources')
            .where('status', '==', 'published')
            .where('attributedUserIds', 'array-contains', creatorId)
            .get();
            
        let authored = 0;
        let curated = 0;
        
        resQuery.docs.forEach(rDoc => {
            const data = rDoc.data();
            const attributions = data.attributions || [];
            const myAttr = attributions.find(a => a.userId === creatorId);
            
            if (myAttr) {
                const authoredRoles = ['author', 'creator', 'source', 'presenter'];
                if (authoredRoles.includes(myAttr.role)) authored++;
                else curated++;
            }
        });
        
        await db.collection('users').doc(creatorId).update({
            resourceCount: resQuery.docs.length,
            authoredCount: authored,
            curatedCount: curated,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ ${doc.data().displayName}: Authored=${authored}, Curated=${curated}, Total=${resQuery.docs.length}`);
    }
    process.exit(0);
}

backfillCreatorStats();
