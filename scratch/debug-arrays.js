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
    console.log('--- Deep Resource Analysis ---');
    
    // 1. Check all resources for "Digital Assets" in attributionNames
    const byName = await db.collection('resources')
        .where('attributionNames', 'array-contains', 'Digital Assets')
        .get();
    console.log(`Found ${byName.size} resources with "Digital Assets" in attributionNames array.`);
    byName.docs.forEach(d => console.log(`  - ${d.id}: ${d.data().title}`));

    // 2. Check for "rob" in attributionNames
    const byRob = await db.collection('resources')
        .where('attributionNames', 'array-contains', 'rob')
        .get();
    console.log(`\nFound ${byRob.size} resources with "rob" in attributionNames array.`);

    // 3. Check for UID heidless/rob
    const robUid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';
    const byRobUid = await db.collection('resources')
        .where('attributedUserIds', 'array-contains', robUid)
        .get();
    console.log(`\nFound ${byRobUid.size} resources with Rob UID in attributedUserIds array.`);

    // 4. Check for Digital Assets UID
    const daUid = 'stub_digital-assets';
    const byDaUid = await db.collection('resources')
        .where('attributedUserIds', 'array-contains', daUid)
        .get();
    console.log(`\nFound ${byDaUid.size} resources with Digital Assets UID in attributedUserIds array.`);

    // 5. SAMPLE ONE RESOURCE TO SEE ALL ARRAYS
    if (byRobUid.size > 0) {
        console.log('\n--- Sample Rob Resource ---');
        console.log(JSON.stringify(byRobUid.docs[0].data(), null, 2));
    }
}

debug().catch(console.error);
