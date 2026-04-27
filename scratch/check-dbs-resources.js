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

async function check() {
    const dbs = ['promptresources-db-0', '(default)'];
    for (const dbName of dbs) {
        console.log(`\n--- Checking DB: ${dbName} ---`);
        const db = getFirestore(app, dbName === '(default)' ? undefined : dbName);
        
        const daResources = await db.collection('resources')
            .where('attributedUserIds', 'array-contains', 'stub_digital-assets')
            .get();
        console.log(`Found ${daResources.size} resources for Digital Assets.`);
        
        const daByName = await db.collection('resources')
            .where('attributionNames', 'array-contains', 'Digital Assets')
            .get();
        console.log(`Found ${daByName.size} resources for "Digital Assets" name.`);

        const robResources = await db.collection('resources')
            .where('attributedUserIds', 'array-contains', 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1')
            .get();
        console.log(`Found ${robResources.size} resources for Rob.`);
    }
}

check().catch(console.error);
