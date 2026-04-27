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
    console.log('--- Deep Check: Digital Assets in promptresources-db-0 ---');
    const doc = await db.collection('users').doc('stub_digital-assets').get();
    if (doc.exists) {
        console.log('Document stub_digital-assets found:');
        console.log(JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('Document stub_digital-assets NOT found.');
    }
    
    const byName = await db.collection('users').where('displayName', '==', 'Digital Assets').get();
    console.log(`Found ${byName.size} docs by name.`);
    byName.docs.forEach(d => console.log(`  - ID: ${d.id}, Data: ${JSON.stringify(d.data(), null, 2)}`));
}

check().catch(console.error);
