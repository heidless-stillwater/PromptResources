
import { adminAuth } from '../src/lib/firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkUser() {
    const email = 'test15@test.com';
    try {
        const user = await adminAuth.getUserByEmail(email);
        console.log(`User found: ${user.uid}, email: ${user.email}`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.log(`User ${email} NOT found in emulator.`);
            console.log('Creating user...');
            try {
                const newUser = await adminAuth.createUser({
                    email,
                    password: 'password123',
                    displayName: 'Test User 15',
                });
                console.log(`Created user: ${newUser.uid}`);
            } catch (createError) {
                console.error('Failed to create user:', createError);
            }
        } else {
            console.error('Error checking user:', error);
        }
    }
}

checkUser();
