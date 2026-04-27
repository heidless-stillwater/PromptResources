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

const db = getFirestore(app, 'prompttool-db-0');

async function checkVisibility() {
    console.log('--- Checking Creator Visibility in toolDbAdmin ---');
    const snapshot = await db.collection('users').limit(300).get();
    
    let visibleCount = 0;
    snapshot.docs.forEach(doc => {
        const profile = doc.data();
        const isVisible = 
            profile.isPublicProfile === true || 
            profile.isStub === true || 
            (profile.authoredCount || 0) > 0 || 
            (profile.resourceCount || 0) > 0;
            
        if (isVisible) {
            visibleCount++;
            if (profile.displayName === 'Digital Assets') {
                console.log('FOUND "Digital Assets":', {
                    uid: doc.id,
                    isVisible,
                    authoredCount: profile.authoredCount,
                    photoURL: !!profile.photoURL
                });
            }
        }
    });
    
    console.log(`Total Visible Creators: ${visibleCount} / ${snapshot.size}`);
}

checkVisibility().catch(console.error);
