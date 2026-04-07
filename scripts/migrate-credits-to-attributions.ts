import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

async function migrate() {
    console.log('Starting migration: credits -> attributions');
    
    const resourcesRef = db.collection('resources');
    const snapshot = await resourcesRef.get();
    
    let updatedCount = 0;
    
    const batchSize = 100;
    let batch = db.batch();
    let currentBatchSize = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        
        if (data.credits && !data.attributions) {
            console.log(`Migrating resource ${doc.id}`);
            
            // Write attributions array
            batch.update(doc.ref, {
                attributions: data.credits,
                credits: FieldValue.delete()
            });
            
            currentBatchSize++;
            updatedCount++;
            
            if (currentBatchSize >= batchSize) {
                await batch.commit();
                batch = db.batch();
                currentBatchSize = 0;
                console.log(`Committed batch of 100...`);
            }
        }
    }
    
    if (currentBatchSize > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${currentBatchSize}...`);
    }
    
    console.log(`Migration complete. Updated ${updatedCount} resources.`);
}

migrate().catch(console.error);
