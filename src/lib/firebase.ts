// Firebase Client SDK Configuration
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (prevent re-initialization in hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (typeof window !== 'undefined') {
    if (!(window as any).__EMULATORS_CONNECTED__) {
        if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST) {
            connectAuthEmulator(auth, `http://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST}`);
        }
        if (process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST) {
            const [host, port] = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST.split(':');
            connectFirestoreEmulator(db, host, parseInt(port));
        }
        (window as any).__EMULATORS_CONNECTED__ = true;
    }
}

export default app;
