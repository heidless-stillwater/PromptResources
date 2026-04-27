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

async function probe() {
    console.log('--- Probing Digital Assets Resources ---');
    
    // Find resources where attribution name is "Digital Assets"
    const resourcesSnap = await db.collection('resources')
        .where('attributionNames', 'array-contains', 'Digital Assets')
        .get();
    
    console.log('Resources found for "Digital Assets":', resourcesSnap.size);
    resourcesSnap.docs.forEach(doc => {
        const d = doc.data();
        console.log(` - [${doc.id}] ${d.title}`);
        console.log(`   attributedUserIds: ${JSON.stringify(d.attributedUserIds)}`);
        console.log(`   attributions: ${JSON.stringify(d.attributions)}`);
    });
}

probe().catch(console.error);
