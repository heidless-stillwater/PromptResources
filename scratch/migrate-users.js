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

const toolDb = getFirestore(app, 'prompttool-db-0');

function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function migrateUserProfiles() {
    console.log('--- Migrating User Profiles to Deterministic IDs ---');
    
    const usersSnap = await toolDb.collection('users').get();
    console.log(`Scanning ${usersSnap.size} users...`);

    let migratedCount = 0;

    for (const doc of usersSnap.docs) {
        const data = doc.data();
        if (data.isStub && doc.id.startsWith('stub_')) {
            const expectedId = `stub_${slugify(data.displayName)}`;
            if (doc.id !== expectedId) {
                console.log(`[Migrate] ${data.displayName}: ${doc.id} -> ${expectedId}`);
                
                // 1. Create new doc
                await toolDb.collection('users').doc(expectedId).set({
                    ...data,
                    uid: expectedId,
                    updatedAt: new Date()
                });
                
                // 2. Delete old doc
                await toolDb.collection('users').doc(doc.id).delete();
                
                migratedCount++;
            }
        }
    }

    console.log(`--- Migration Complete. Migrated ${migratedCount} profiles. ---`);
}

migrateUserProfiles().catch(console.error);
