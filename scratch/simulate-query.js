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
    const userId = 'stub_digital-assets';
    const displayName = 'Digital Assets';
    
    const searchNames = new Set();
    searchNames.add(displayName.trim());
    searchNames.add(displayName.trim().replace(/i$/, ''));
    searchNames.add(displayName.trim() + 'i');
    
    console.log(`Searching for: ${Array.from(searchNames)}`);

    const [uidSnap, nameSnap, extraSnap] = await Promise.all([
        db.collection('resources').where('attributedUserIds', 'array-contains', userId).get(),
        db.collection('resources').where('attributionNames', 'array-contains-any', Array.from(searchNames)).get(),
        db.collection('resources').where('attributionNames', 'array-contains', userId.replace(/^stub_/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).get()
    ]);

    const allIds = new Set();
    uidSnap.docs.forEach(d => allIds.add(d.id));
    nameSnap.docs.forEach(d => allIds.add(d.id));
    extraSnap.docs.forEach(d => allIds.add(d.id));

    console.log(`\nUID Snap: ${uidSnap.size}`);
    console.log(`Name Snap: ${nameSnap.size}`);
    console.log(`Extra Snap: ${extraSnap.size}`);
    console.log(`Total Unique: ${allIds.size}`);

    const results = [];
    for (const id of allIds) {
        const doc = await db.collection('resources').doc(id).get();
        const data = doc.data();
        results.push({ id, title: data.title, names: data.attributionNames, uids: data.attributedUserIds });
    }

    console.log('\n--- Results ---');
    results.forEach(r => console.log(`[${r.id}] ${r.title}\n    Names: ${JSON.stringify(r.names)}\n    UIDs: ${JSON.stringify(r.uids)}`));
}

debug().catch(console.error);
