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
    console.log('--- Final Counting ---');
    const snap = await db.collection('resources').get();
    
    let daCount = 0;
    let robCount = 0;
    let bothCount = 0;

    snap.docs.forEach(doc => {
        const uids = doc.data().attributedUserIds || [];
        const hasDA = uids.includes('stub_digital-assets');
        const hasRob = uids.includes('nNdenyyfKaN9yNB9Ly3vhhaHLXx1');
        
        if (hasDA) daCount++;
        if (hasRob) robCount++;
        if (hasDA && hasRob) bothCount++;
    });

    console.log(`Digital Assets (stub_digital-assets): ${daCount}`);
    console.log(`Rob (heidless): ${robCount}`);
    console.log(`Both: ${bothCount}`);
}

debug().catch(console.error);
