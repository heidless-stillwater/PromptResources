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

async function debug() {
    console.log('--- Debugging Resource Attributions for "Digital Assets" ---');
    
    // 1. Find the Digital Assets UID
    const daDocs = await db.collection('users').where('displayName', '==', 'Digital Assets').get();
    console.log(`Found ${daDocs.size} users with name "Digital Assets"`);
    daDocs.forEach(d => console.log(`  - UID: ${d.id}, Data: ${JSON.stringify(d.data(), null, 2)}`));

    const daUids = daDocs.docs.map(d => d.id);

    // 2. Check resources attributed to these UIDs
    for (const uid of daUids) {
        const resources = await db.collection('resources').where('creatorId', '==', uid).get();
        console.log(`\nUID ${uid} has ${resources.size} resources:`);
        resources.docs.slice(0, 5).forEach(r => {
            const data = r.data();
            console.log(`  - Resource: ${r.id}, Title: ${data.title}, Attribution: ${data.attributionName}`);
        });
    }

    // 3. Check for Rob
    const robDocs = await db.collection('users').where('displayName', '==', 'rob').get();
    console.log(`\nFound ${robDocs.size} users with name "rob"`);
    robDocs.forEach(d => console.log(`  - UID: ${d.id}, Authored: ${d.data().authoredCount}`));

    // 4. Check resources with attributionName "Digital Assets"
    const byName = await db.collection('resources').where('attributionName', '==', 'Digital Assets').get();
    console.log(`\nFound ${byName.size} resources with attributionName "Digital Assets"`);
}

debug().catch(console.error);
