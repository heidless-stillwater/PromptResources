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

async function checkDbs() {
    const dbs = ['promptresources-db-0', 'prompttool-db-0', '(default)'];
    
    for (const dbName of dbs) {
        const db = getFirestore(app, dbName === '(default)' ? undefined : dbName);
        const snap = await db.collection('users').get();
        console.log(`DB: ${dbName} -> ${snap.size} users`);
        const digitalAssets = snap.docs.find(d => d.data().displayName === 'Digital Assets');
        if (digitalAssets) {
            console.log(`  - Found "Digital Assets" in ${dbName}`);
            console.log(`    Data: ${JSON.stringify(digitalAssets.data(), null, 2)}`);
        }
    }
}

checkDbs().catch(console.error);
