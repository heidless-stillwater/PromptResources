import { adminDb } from './firebase-admin';
import { decrypt } from './crypto';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const secretCache: Record<string, { value: string; expires: number }> = {};

/**
 * Retrieves a secret from the global configuration store in Firestore.
 * Falls back to local process.env if not found or if there's an error.
 * Implements a 5-minute in-memory cache.
 */
export async function getSecret(key: string): Promise<string | undefined> {
  const now = Date.now();

  // 1. Check Cache
  if (secretCache[key] && secretCache[key].expires > now) {
    return secretCache[key].value;
  }

  try {
    // 2. Fetch from Firestore
    // Using heidless-apps-0 project (default)
    const doc = await adminDb.collection('system_config').doc('global_secrets').get();
    
    if (doc.exists) {
      const data = doc.data();
      const encryptedValue = data?.[key];

      if (encryptedValue) {
        // 3. Decrypt
        const decrypted = decrypt(encryptedValue);
        
        // 4. Update Cache
        secretCache[key] = {
          value: decrypted,
          expires: now + CACHE_TTL
        };

        return decrypted;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch secret [${key}] from DB, falling back to ENV:`, error);
  }

  // 5. Fallback to process.env
  return process.env[key];
}
