
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Set emulator host before initializing
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'heidless-apps-0'
    });
}

const auth = admin.auth();

async function resetUser() {
    const email = 'test15@test.com';
    try {
        const user = await auth.getUserByEmail(email);
        console.log(`User found, resetting password: ${user.uid}`);
        await auth.updateUser(user.uid, {
            password: 'password123'
        });
        console.log('Password reset to password123');
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log('User not found, creating...');
            await auth.createUser({
                email,
                password: 'password123',
                displayName: 'Test User 15'
            });
            console.log('User created with password123');
        } else {
            console.error('Error:', error);
        }
    }
}

resetUser();
