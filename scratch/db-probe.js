const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Minimal config for probing
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !privateKey || !clientEmail) {
    console.log('Missing env vars for probe');
    process.exit(1);
}

const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
});

async function probe() {
    const dbs = ['(default)', 'promptresources-db-0', 'prompttool-db-0'];
    
    for (const dbName of dbs) {
        try {
            console.log(`\n--- Probing DB: ${dbName} ---`);
            const db = getFirestore(app, dbName === '(default)' ? undefined : dbName);
            
            // Check resources
            const resSnap = await db.collection('resources').limit(1).get();
            console.log(`Resources collection exists: ${!resSnap.empty}`);
            if (!resSnap.empty) {
                const countSnap = await db.collection('resources').count().get();
                console.log(`Total Resources: ${countSnap.data().count}`);
            }

            // Check users
            const userSnap = await db.collection('users').limit(1).get();
            console.log(`Users collection exists: ${!userSnap.empty}`);
        } catch (err) {
            console.log(`Error probing ${dbName}: ${err.message}`);
        }
    }
}

probe().then(() => process.exit(0));
