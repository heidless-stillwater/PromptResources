
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'heidless-apps-0'
    });
}

const auth = admin.auth();

async function recreateUser() {
    const email = 'test15@test.com';
    try {
        const user = await auth.getUserByEmail(email);
        console.log(`Deleting existing user: ${user.uid}`);
        await auth.deleteUser(user.uid);
    } catch (error) {
        // ignore if not found
    }

    console.log('Creating fresh user test15@test.com...');
    await auth.createUser({
        email,
        password: 'password123',
        displayName: 'Test User 15'
    });
    console.log('Created!');
}

recreateUser();
