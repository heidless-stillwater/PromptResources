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

const dbs = ['promptresources-db-0', 'prompttool-db-0', '(default)'];
const avatar = 'https://yt3.googleusercontent.com/ytc/AIdro_n9HLvJrVfO7jK9ul3qw5uqyh0OArOAkYVJApmHf8RkhA=s900-c-k-c0x00ffffff-no-rj';

async function repair() {
    console.log('--- Repairing Digital Assets Avatar & Stats ---');
    for (const dbName of dbs) {
        const db = getFirestore(app, dbName === '(default)' ? undefined : dbName);
        const users = await db.collection('users').where('displayName', '==', 'Digital Assets').get();
        
        for (const doc of users.docs) {
            await doc.ref.update({
                photoURL: avatar,
                authoredCount: 7,
                resourceCount: 7,
                updatedAt: new Date()
            });
            console.log(`Repaired ${doc.id} in ${dbName}`);
        }
    }
}

repair().catch(console.error);
