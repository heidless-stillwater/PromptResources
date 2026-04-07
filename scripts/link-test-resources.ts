import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
const TEST_USER_ID = '6W6SvLUqb4asm2UmsVRZ6CakgVh2';

async function run() {
  const resources = await db.collection('resources').limit(3).get();
  if (resources.empty) {
    console.log('No resources found to link!');
    return;
  }
  
  for (const doc of resources.docs) {
    console.log(`Linking resource ${doc.id} to featured user...`);
    await doc.ref.update({
      attributedUserIds: [TEST_USER_ID],
      status: 'published'
    });
  }
  
  // Also update stats for creator sync check
  await db.collection('users').doc(TEST_USER_ID).update({
    resourceCount: 3
  });
  
  console.log('Linked 3 resources successfully.');
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
