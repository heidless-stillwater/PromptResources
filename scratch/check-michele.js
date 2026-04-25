const { adminDb, toolDbAdmin } = require('./src/lib/firebase-admin');
const { slugify } = require('./src/lib/utils');

async function checkMichele() {
    console.log("Checking for Michele Tort...");
    
    // Check users
    const userSlug = await toolDbAdmin.collection('users').where('slug', '==', 'michele-tort').get();
    console.log(`Users with slug 'michele-tort': ${userSlug.size}`);
    userSlug.forEach(doc => console.log(`- ID: ${doc.id}, Data:`, doc.data()));

    const userName = await toolDbAdmin.collection('users').where('displayName', '==', 'Michele Tort').get();
    console.log(`Users with name 'Michele Tort': ${userName.size}`);
    userName.forEach(doc => console.log(`- ID: ${doc.id}, Data:`, doc.data()));

    // Check resources
    const resSnap = await adminDb.collection('resources').where('attributionNames', 'array-contains', 'Michele Tort').get();
    console.log(`Resources with 'Michele Tort': ${resSnap.size}`);
}

checkMichele().catch(console.error);
