const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnvVar(name) {
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (!match) return null;
    let val = match[1].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
    }
    return val;
}

const projectId = getEnvVar('FIREBASE_ADMIN_PROJECT_ID');
const clientEmail = getEnvVar('FIREBASE_ADMIN_CLIENT_EMAIL');
let privateKey = getEnvVar('FIREBASE_ADMIN_PRIVATE_KEY');
if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');

const app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const sourceDb = getFirestore(app, 'prompttool-db-0');
const targetDb = getFirestore(app, 'promptresources-db-0');

async function syncUsers() {
    console.log('--- Syncing Users from prompttool-db-0 to promptresources-db-0 ---');
    const snapshot = await sourceDb.collection('users').get();
    console.log(`Found ${snapshot.size} users in source.`);

    let syncedCount = 0;
    const batch = targetDb.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Only sync visible/relevant users to save space
        const isVisible = 
            data.isPublicProfile === true || 
            data.isStub === true || 
            (data.authoredCount || 0) > 0 || 
            (data.resourceCount || 0) > 0;

        if (isVisible) {
            batch.set(targetDb.collection('users').doc(doc.id), data);
            syncedCount++;
            batchSize++;
            
            if (batchSize >= 400) {
                await batch.commit();
                batchSize = 0;
            }
        }
    }

    if (batchSize > 0) {
        await batch.commit();
    }

    console.log(`--- Sync Complete. Synced ${syncedCount} users to promptresources-db-0. ---`);
}

syncUsers().catch(console.error);
