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

async function listAll() {
    console.log('--- USERS ---');
    const usersSnap = await db.collection('users').get();
    usersSnap.docs.forEach(d => {
        const data = d.data();
        console.log(`UID: ${d.id} | Name: ${data.displayName} | Slug: ${data.slug} | Public: ${data.isPublicProfile} | Stub: ${data.isStub}`);
    });

    console.log('\n--- ROB RESOURCES ---');
    const resSnap = await db.collection('resources').get();
    resSnap.docs.forEach(d => {
        const data = d.data();
        const attributions = data.attributions || [];
        if (attributions.some(a => a.name && a.name.toLowerCase().includes('rob'))) {
            console.log(`Resource ID: ${d.id} | Title: ${data.title} | AttributedIDs: ${JSON.stringify(data.attributedUserIds)} | Attributions: ${JSON.stringify(attributions)}`);
        }
    });
}

listAll().then(() => process.exit(0));
