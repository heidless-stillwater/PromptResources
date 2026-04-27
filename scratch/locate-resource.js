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
    const id = 'G0zC3FpS2vK0m0u1m2p3';
    for (const dbName of dbs) {
        const db = getFirestore(app, dbName === '(default)' ? undefined : dbName);
        const doc = await db.collection('resources').doc(id).get();
        if (doc.exists) {
            console.log(`Found in ${dbName}:`);
            console.log(JSON.stringify(doc.data(), null, 2));
        } else {
            console.log(`Not found in ${dbName}`);
        }
    }
}

check().catch(console.error);
