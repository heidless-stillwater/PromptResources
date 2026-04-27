
import { adminDb, toolDbAdmin } from './src/lib/firebase-admin';

async function checkDave() {
    console.log('Checking Dave Jeltema in adminDb (PromptResources)...');
    const adminSnap = await adminDb.collection('users').where('displayName', '==', 'Dave Jeltema').get();
    if (adminSnap.empty) {
        console.log('Not found in adminDb');
    } else {
        adminSnap.docs.forEach(doc => {
            console.log(`ID: ${doc.id}`);
            console.log(`Data:`, doc.data());
        });
    }

    console.log('\nChecking Dave Jeltema in toolDbAdmin (Master)...');
    const toolSnap = await toolDbAdmin.collection('users').where('displayName', '==', 'Dave Jeltema').get();
    if (toolSnap.empty) {
        console.log('Not found in toolDbAdmin');
    } else {
        toolSnap.docs.forEach(doc => {
            console.log(`ID: ${doc.id}`);
            console.log(`Data:`, doc.data());
        });
    }
}

checkDave().catch(console.error);
