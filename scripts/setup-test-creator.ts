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

async function run() {
  const users = await db.collection('users').limit(1).get();
  if (users.empty) {
    console.log('No users found in collection!');
    return;
  }
  const user = users.docs[0];
  console.log(`Updating user ${user.id} to be featured...`);
  await user.ref.update({
    isFeatured: true,
    isPublicProfile: true,
    slug: 'featured-test',
    resourceCount: 5,
    bio: 'Stillwater Studio test creator.',
    displayName: 'Featured Tester'
  });
  console.log('User updated successfully.');
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
