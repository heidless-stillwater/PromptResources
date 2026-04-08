const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Setup Admin SDK for all 3 DBs
const adminConfig = {
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
};

const app = admin.initializeApp(adminConfig, 'audit');
const dbDefault = getFirestore(app);
const dbTool = getFirestore(app, 'prompttool-db-0');
const dbMaster = getFirestore(app, 'promptmaster-spa-db-0');

async function audit() {
    const userEmail = 'heidlessemail18@gmail.com'; // Your email from logs
    console.log(`🔍 Starting Audit for: ${userEmail}`);

    const snapshots = await Promise.all([
        dbDefault.collection('users').where('email', '==', userEmail).get(),
        dbTool.collection('users').where('email', '==', userEmail).get(),
        dbMaster.collection('users').where('email', '==', userEmail).get()
    ]);

    const names = ['(DEFAULT / RESOURCES)', 'PROMPTTOOL-DB', 'PROMPTMASTER-DB'];
    
    snapshots.forEach((snap, i) => {
        console.log(`\n--- ${names[i]} ---`);
        if (snap.empty) {
            console.log('❌ No user document found in this database!');
        } else {
            snap.docs.forEach(doc => {
                const data = doc.data();
                console.log(`✅ User ID: ${doc.id}`);
                console.log(`🟢 Subscription Type: ${data.subscriptionType}`);
                console.log(`🟢 Subscription Object:`, JSON.stringify(data.subscription, null, 2));
                console.log(`🟢 Suite Metadata:`, JSON.stringify(data.subscriptionMetadata, null, 2));
            });
        }
    });

    process.exit(0);
}

audit();
