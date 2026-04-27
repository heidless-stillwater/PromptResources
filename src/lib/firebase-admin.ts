import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * SOVEREIGN ADMIN INITIALIZATION (Universal Pattern)
 * Stable singleton pattern for Next.js 14/15 / Cloud Run.
 * Includes Zero-Config fallback for GCP environments.
 */

let adminApp: App | null = null;

function getAdminApp(): App | null {
  if (typeof window !== 'undefined') return null;
  if (adminApp) return adminApp;

  try {
    console.log(`[FirebaseAdmin] HANDSHAKE_START: [DEFAULT]`, { 
        hasEmulatorHost: !!process.env.FIRESTORE_EMULATOR_HOST,
        emulatorHost: process.env.FIRESTORE_EMULATOR_HOST 
    });
    const apps = getApps();
    const existing = apps.find(a => a.name === '[DEFAULT]');
    if (existing) {
        adminApp = existing;
        return adminApp;
    }

    // Support both suite-specific and global environment variants
    const projectId = process.env.SERVICE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.SERVICE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.SERVICE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (projectId && privateKey && clientEmail) {
        console.log(`[FirebaseAdmin] PREPARING_CERT: ${projectId}`);
        const formattedKey = privateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim();
        const credential = cert({ projectId, clientEmail, privateKey: formattedKey });
        
        console.log(`[FirebaseAdmin] INITIALIZING_APP: [DEFAULT] (Manual Cert)`);
        adminApp = initializeApp({ credential });
    } else {
        console.log(`[FirebaseAdmin] INITIALIZING_APP: [DEFAULT] (Zero-Config/GCP Default)`);
        // On Cloud Run/GCP, initializeApp() without args uses the built-in Service Account
        adminApp = initializeApp();
    }

    return adminApp;
  } catch (error: any) {
    console.error(`[FirebaseAdmin] HANDSHAKE_CRASH: ${error.message} - ${error.stack}`);
    return null;
  }
}

// Service Getters
export const getAdminAuth = (): Auth | null => {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
};

export const getDb = (name: string): Firestore | null => {
  const app = getAdminApp();
  if (!app) return null;
  
  try {
    const db = (name === '(default)' || !name) ? getFirestore(app) : getFirestore(app, name);
    try { db.settings({ ignoreUndefinedProperties: true }); } catch (e) {}
    return db;
  } catch (err) {
    console.error(`[FirebaseAdmin] Firestore error (${name}): ${err}`);
    return null;
  }
};

/**
 * LAZY PROXIES
 * Prevents initialization at build time and provides safe fallbacks.
 */
const createLazyDb = (name: string) => {
    return new Proxy({} as Firestore, {
        get(_, prop) {
            const db = getDb(name);
            if (!db) {
                return (...args: any[]) => ({
                    collection: () => createLazyDb(name),
                    doc: () => createLazyDb(name),
                    get: () => Promise.resolve({ exists: false, docs: [], data: () => ({}) }),
                    where: () => createLazyDb(name),
                    orderBy: () => createLazyDb(name),
                    limit: () => createLazyDb(name),
                });
            }
            const value = (db as any)[prop];
            return typeof value === 'function' ? value.bind(db) : value;
        }
    });
};

// Database Exports
const DEFAULT_RESOURCES_DB = process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0';
export const adminDb = createLazyDb(DEFAULT_RESOURCES_DB);
export const toolDbAdmin = createLazyDb('prompttool-db-0');
export const masterDbAdmin = createLazyDb('promptmaster-spa-db-0');
export const accreditationDb = createLazyDb('promptaccreditation-db-0');

// Auth Proxy
export const adminAuth = new Proxy({} as Auth, {
    get(_, prop) {
        const auth = getAdminAuth();
        if (!auth) {
            return () => Promise.resolve({ uid: 'anonymous' });
        }
        const value = (auth as any)[prop];
        return typeof value === 'function' ? value.bind(auth) : value;
    }
});

export default adminApp;


