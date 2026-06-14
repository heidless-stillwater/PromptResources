import { adminDb } from '../src/lib/firebase-admin';

async function checkResources() {
    const snap = await adminDb.collection('resources').limit(5).get();
    snap.docs.forEach(doc => {
        console.log(`Resource: ${doc.data().title}, AddedBy: ${doc.data().addedBy}`);
    });
}

checkResources();
