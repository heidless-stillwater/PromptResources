const dotenv = require('dotenv');
const path = require('path');
// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || 'stillwater-sovereign-02';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase configuration variables in .env.local');
  process.exit(1);
}

const formattedKey = privateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim();

const adminApp = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey: formattedKey }),
});

const auth = getAuth(adminApp);
const testEmail = 'playwright_test_curator@stillwater.test';

async function main() {
  try {
    const userRecord = await auth.getUserByEmail(testEmail);
    console.log(`User already exists: ${userRecord.uid}`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('User does not exist. Creating new test user...');
      const userRecord = await auth.createUser({
        email: testEmail,
        password: 'password123',
        displayName: 'Playwright Test Curator',
      });
      console.log(`Successfully created new user: ${userRecord.uid}`);
    } else {
      console.error('Error checking user:', error);
      process.exit(1);
    }
  }
  process.exit(0);
}

main();
