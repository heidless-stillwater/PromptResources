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

async function deepSearch() {
    console.log('--- DEEP SEARCH FOR ROB ---');
    const resSnap = await db.collection('resources').get();
    let count = 0;
    resSnap.docs.forEach(d => {
        const data = d.data();
        const str = JSON.stringify(data).toLowerCase();
        if (str.includes('rob')) {
            count++;
            console.log(`\n[${count}] Resource: ${d.id} | Title: ${data.title}`);
            console.log(`  Attributions: ${JSON.stringify(data.attributions)}`);
            console.log(`  Attributed IDs: ${JSON.stringify(data.attributedUserIds)}`);
            console.log(`  Added By: ${data.addedBy}`);
        }
    });

    console.log('\n--- SEEKING USER CLUES ---');
    const usersSnap = await db.collection('users').get();
    usersSnap.docs.forEach(u => {
        const data = u.data();
        if (JSON.stringify(data).toLowerCase().includes('rob')) {
            console.log(`Found user: ${u.id} | Name: ${data.displayName} | Slug: ${data.slug}`);
        }
    });
}

deepSearch().then(() => process.exit(0));
