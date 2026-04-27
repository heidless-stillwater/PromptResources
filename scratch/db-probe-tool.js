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

const db = getFirestore(app, 'prompttool-db-0'); // LOOKING IN TOOL DB

async function probe() {
    console.log('--- Probing Tool DB for Digital Assets ---');
    const userSnap = await db.collection('users').get();
    const digitalAssets = userSnap.docs.find(d => d.data().displayName === 'Digital Assets');
    
    if (!digitalAssets) {
        console.log('Creator "Digital Assets" not found in Tool DB. Available:');
        userSnap.docs.forEach(d => console.log(` - [${d.id}] ${d.data().displayName} (Slug: ${d.data().slug})`));
        return;
    }

    console.log('Found Digital Assets:', digitalAssets.data());
}

probe().catch(console.error);
