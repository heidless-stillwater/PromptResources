const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Manually initialize if needed, but usually we can just use the config
const projectId = process.env.FIREBASE_PROJECT_ID || 'promptresources-666'; // Fallback
const databaseId = process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: projectId
    });
}

const db = admin.firestore();
// Access the specific database if not default
const adminDb = (databaseId === '(default)') ? db : admin.firestore(admin.app(), databaseId);

async function debugSajid() {
    console.log('--- DEBUG SAJID (JS) ---');
    console.log('Project ID:', projectId);
    console.log('Database ID:', databaseId);

    // 1. Find user profile for "sajid"
    const slug = 'sajid';
    
    console.log(`Searching for user with slug: ${slug}`);
    const userSnap = await adminDb.collection('users')
        .where('slug', '==', slug)
        .get();
        
    if (userSnap.empty) {
        console.log('No user found with slug "sajid"');
    } else {
        userSnap.forEach(doc => {
            console.log(`Found user by slug: ${doc.id}`, JSON.stringify(doc.data(), null, 2));
        });
    }
    
    // 2. Find resources with "sajid" in attributions
    console.log('\nSearching for resources with "sajid" in attributions...');
    
    // broad search for anything containing "sajid" in attributions array
    const allRes = await adminDb.collection('resources').limit(1000).get();
    let foundCount = 0;
    
    for (const doc of allRes.docs) {
        const data = doc.data();
        const attributions = data.attributions || [];
        const hasSajid = attributions.some(a => a.name && a.name.toLowerCase().includes('sajid'));
        
        if (hasSajid) {
            console.log(`Found resource: ${doc.id} - ${data.title}`);
            console.log('Attributions:', JSON.stringify(attributions, null, 2));
            console.log('AttributedUserIds:', JSON.stringify(data.attributedUserIds, null, 2));
            foundCount++;
            
            // Fix it!
            const newAttributedUserIds = data.attributedUserIds || [];
            let changed = false;
            
            for (const attr of attributions) {
                if (attr.name && attr.name.toLowerCase().includes('sajid')) {
                    if (!attr.userId || attr.userId === '') {
                        attr.userId = 'stub_sajid';
                        changed = true;
                    }
                    if (!newAttributedUserIds.includes(attr.userId)) {
                        newAttributedUserIds.push(attr.userId);
                        changed = true;
                    }
                }
            }
            
            if (changed) {
                console.log('Updating resource with fixed attributions...');
                await adminDb.collection('resources').doc(doc.id).update({
                    attributions: attributions,
                    attributedUserIds: newAttributedUserIds,
                    updatedAt: new Date()
                });
                console.log('Update complete.');
            }
        }
    }
    console.log(`Done. Found and processed ${foundCount} resources.`);
}

debugSajid().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
