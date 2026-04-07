const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}

const db = getFirestore();

async function checkRob() {
    console.log('🔍 Checking user Rob...');
    const usersSnap = await db.collection('users').get();
    const robDocs = usersSnap.docs.filter(d => d.data().displayName === 'Rob');
    if (robDocs.length === 0) {
        console.log('❌ No user named Rob found.');
        return;
    }
    const rob = robDocs[0];
    console.log('✅ Found Rob:', rob.id, JSON.stringify(rob.data(), null, 2));
    
    console.log('🔍 Checking resources for Rob...');
    const resSnap = await db.collection('resources').where('attributedUserIds', 'array-contains', rob.id).get();
    console.log('📊 Resources linked to Rob directly:', resSnap.size);
    
    const allRes = await db.collection('resources').get();
    let robNamedCount = 0;
    allRes.docs.forEach(d => {
        const attr = d.data().attributions || [];
        if (attr.some((a) => a.name === 'Rob')) {
            robNamedCount++;
            console.log(' - Found Rob in resource:', d.id, JSON.stringify(d.data().attributions, null, 2));
        }
    });
    console.log('📊 Resources with attribution name Rob:', robNamedCount);
}

checkRob().then(() => process.exit(0));
