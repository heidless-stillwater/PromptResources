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

const db = getFirestore(app, 'promptresources-db-0');

async function cleanup() {
    console.log('--- Cleaning up Stale Profiles in promptresources-db-0 ---');
    const snapshot = await db.collection('users').get();
    
    let deletedCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.isStub && doc.id.startsWith('stub_') && !doc.id.startsWith('stub_digital-assets')) {
             // If the ID is a legacy stub ID (random) but we have a better one...
             // For safety, only delete if the ID is NOT the slug-based ID
             const expectedId = `stub_${data.slug}`;
             if (data.slug && doc.id !== expectedId) {
                 console.log(`Deleting stale stub: ${doc.id} (Name: ${data.displayName}, Better ID: ${expectedId})`);
                 batch.delete(doc.ref);
                 deletedCount++;
             }
        }
    }
    
    // Special case for Digital Assets stale profile if it exists under old ID
    const staleDA = snapshot.docs.find(d => d.data().displayName === 'Digital Assets' && d.id !== 'stub_digital-assets');
    if (staleDA) {
        console.log(`Deleting stale Digital Assets profile: ${staleDA.id}`);
        batch.delete(staleDA.ref);
        deletedCount++;
    }

    if (deletedCount > 0) {
        await batch.commit();
    }
    
    console.log(`--- Cleanup Complete. Deleted ${deletedCount} stale profiles. ---`);
}

cleanup().catch(console.error);
