import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * SOVEREIGN ADMIN INITIALIZATION (Anti-Deadlock Edition)
 * Ensures that even if the network or credentials hang, the server process does not.
 */

let adminApp: App | null = null;
const dbCache: Record<string, Firestore> = {};

function initAdmin(): App | null {
  if (typeof window !== 'undefined') return null;
  if (adminApp) return adminApp;
  
  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || 'stillwater-sovereign-01';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  try {
    if (projectId && clientEmail && privateKey) {
      console.log('[FirebaseAdmin] Handshake: Initializing with Explicit Service Account');
      const formattedKey = privateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim();
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: formattedKey }),
      });
    } else {
      console.log('[FirebaseAdmin] Handshake: Initializing with Zero-Config (ADC)');
      adminApp = initializeApp();
    }
    return adminApp;
  } catch (error: any) {
    console.error('[FirebaseAdmin] Handshake_CRASH:', error.message);
    const retryApps = getApps();
    if (retryApps.length > 0) return retryApps[0];
    return null;
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[Sovereign] Database timeout after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/**
 * RECURSIVE STABILITY PROXY
 */
function createRecursiveProxy(target: any): any {
  return new Proxy(target, {
    get(t, prop: string) {
      const value = Reflect.get(t, prop);
      if (typeof value === 'function') {
        // These methods are final execution points that return Promises
        if (['get', 'set', 'update', 'add', 'delete'].includes(prop)) {
          return (...args: any[]) => withTimeout(value.apply(t, args));
        }
        // Other methods (collection, where, count, etc.) return chainable objects
        return (...args: any[]) => {
          const result = value.apply(t, args);
          return (result && typeof result === 'object') ? createRecursiveProxy(result) : result;
        };
      }
      return value;
    }
  });
}


/**
 * COMPATIBILITY GETTERS
 */
export function getAdminAuth(): Auth | null {
  const app = initAdmin();
  return app ? getAuth(app) : null;
}

export function getDb(name?: string): Firestore | null {
  const app = initAdmin();
  if (!app) return null;
  const targetDb = name || process.env.FIREBASE_DATABASE_ID || '(default)';
  if (dbCache[targetDb]) return dbCache[targetDb];
  try {
    const db = (targetDb === '(default)') ? getFirestore(app) : getFirestore(app, targetDb);
    try { (db as any).settings({ ignoreUndefinedProperties: true }); } catch (e) {}
    dbCache[targetDb] = db;
    return db;
  } catch (err: any) {
    console.error(`[FirebaseAdmin] getDb_FAULT (${targetDb}):`, err.message);
    return null;
  }
}

const createLazyDb = (name: string) => {
    return new Proxy({} as Firestore, {
        get(_, prop: string) {
            // WE MUST NOT CALL getDb(name) SYNCHRONOUSLY if we are worried about hangs.
            // Instead, we return a function that calls it if the prop is a method.
            const db = getDb(name);
            if (!db) {
                if (['collection', 'doc', 'where', 'limit', 'orderBy', 'count'].includes(prop)) return () => createLazyDb(name);
                if (prop === 'get') return () => Promise.resolve({ exists: false, docs: [], data: () => ({}) });
                return undefined;
            }
            return createRecursiveProxy(db)[prop];
        }
    });
};

// GLOBAL EXPORTS (Port 3002 Compatibility)
export const adminDb = createLazyDb(process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0');
export const toolDbAdmin = createLazyDb('prompttool-db-0');
export const masterDbAdmin = createLazyDb('promptmaster-spa-db-0');
export const accreditationDb = createLazyDb('promptaccreditation-db-0');
export const globalDb = adminDb;

export const adminAuth = new Proxy({} as Auth, {
    get(_, prop: string) {
        const auth = getAdminAuth();
        if (!auth) throw new Error('Auth unavailable');
        const value = Reflect.get(auth, prop);
        return typeof value === 'function' ? value.bind(auth) : value;
    }
});
