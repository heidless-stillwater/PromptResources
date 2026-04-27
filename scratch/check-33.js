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

async function check() {
    console.log('--- Checking for any "Digital Assets" variants ---');
    const allUsers = await db.collection('users').get();
    allUsers.docs.forEach(doc => {
        const name = doc.data().displayName || '';
        if (name.toLowerCase().includes('digital') || name.toLowerCase().includes('asset')) {
            console.log(`Match: ID=${doc.id}, Name="${name}", Authored=${doc.data().authoredCount}`);
        }
        if (doc.data().authoredCount === 33) {
             console.log(`Found 33 Authored: ID=${doc.id}, Name="${name}"`);
        }
    });
}

check().catch(console.error);
