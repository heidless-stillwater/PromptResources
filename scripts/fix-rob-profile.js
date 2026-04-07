const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}

const db = getFirestore();

async function fixRob() {
    const robUid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';
    console.log('--- AUTO-ATTRIBUTING ROB ---');
    const resSnap = await db.collection('resources').where('addedBy', '==', robUid).get();
    let updated = 0;
    
    const batch = db.batch();
    
    for (const d of resSnap.docs) {
        const data = d.data();
        let ids = data.attributedUserIds || [];
        if (!ids.includes(robUid)) {
            ids.push(robUid);
            batch.update(d.ref, { attributedUserIds: ids });
            updated++;
        }
    }
    
    if (updated > 0) {
        await batch.commit();
    }
    
    console.log('Total resources updated for Rob:', updated);
}

fixRob().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
