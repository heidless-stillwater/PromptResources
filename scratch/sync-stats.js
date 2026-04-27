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

const resDb = getFirestore(app, 'promptresources-db-0');
const toolDb = getFirestore(app, 'prompttool-db-0');

async function syncDigitalAssets() {
    const userId = 'stub_digital-assets';
    console.log(`--- Syncing stats for ${userId} ---`);
    
    // 1. Authored
    const authoredSnap = await resDb.collection('resources')
        .where('status', '==', 'published')
        .where('attributedUserIds', 'array-contains', userId)
        .get();
    
    // 2. Curated
    const curatedSnap = await resDb.collection('resources')
        .where('status', '==', 'published')
        .where('addedBy', '==', userId)
        .get();
        
    const categories = new Set();
    const platforms = new Set();
    
    authoredSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.categories) d.categories.forEach(c => categories.add(c));
        if (d.platform) platforms.add(d.platform);
    });
    
    const updates = {
        resourceCount: authoredSnap.size + curatedSnap.size,
        authoredCount: authoredSnap.size,
        curatedCount: curatedSnap.size,
        categories: Array.from(categories),
        platforms: Array.from(platforms),
        updatedAt: new Date(),
        isPublicProfile: true
    };
    
    console.log('Update Payload:', updates);
    await toolDb.collection('users').doc(userId).update(updates);
    console.log('Sync Complete.');
}

syncDigitalAssets().catch(console.error);
