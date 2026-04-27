const { adminDb } = require('./src/lib/firebase-admin');
require('dotenv').config();

async function inspect() {
    try {
        const snap = await adminDb.collection('resources').limit(1).get();
        if (snap.empty) {
            console.log('No resources found');
            return;
        }
        snap.forEach(doc => {
            console.log('Document ID:', doc.id);
            console.log('Data:', JSON.stringify(doc.data(), null, 2));
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

inspect();
