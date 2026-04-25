const admin = require('firebase-admin');
const path = require('path');

// Initialize with the first service account found
const serviceAccount = require('/home/heidless/projects/PromptResources/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://promptresources-db-0.firebaseio.com"
    });
}

const db = admin.firestore();

async function checkFlagged() {
    console.log('Checking for flagged resources...');
    const snapshot = await db.collection('resources').where('status', '==', 'flagged').get();
    
    if (snapshot.empty) {
        console.log('No flagged resources found.');
        
        // Let's find one to flag for testing
        const first = await db.collection('resources').limit(1).get();
        if (!first.empty) {
            const id = first.docs[0].id;
            console.log(`Flagging resource ${id} for testing...`);
            await db.collection('resources').doc(id).update({ 
                status: 'flagged',
                reportType: 'misinformation'
            });
            console.log('Done.');
        }
    } else {
        console.log(`Found ${snapshot.size} flagged resources:`);
        snapshot.docs.forEach(doc => {
            console.log(`- ${doc.id}: ${doc.data().title} (Status: ${doc.data().status}, ReportType: ${doc.data().reportType})`);
        });
    }
}

checkFlagged().catch(console.error);
