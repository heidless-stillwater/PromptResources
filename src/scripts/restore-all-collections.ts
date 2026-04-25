import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase Admin Configuration (heidless-apps-0)
// Using hardcoded credentials derived from .env.local for robustness in script execution
const serviceAccount = {
  projectId: 'heidless-apps-0',
  clientEmail: 'firebase-adminsdk-fbsvc@heidless-apps-0.iam.gserviceaccount.com',
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') || "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCxfE7ZUt48Uod7\nk3TPW5LzBs7gNpNWuI10M10mZKrWOSXruVNzHuSTqhlAkh30Sc+w//+25oLPwH55\nUzDSJF6R0/Tb4CrHgq2Dn3wcWJa3gCWB+v2sZCli93Pc0nWTy1BMss2xwYandssR\nYi9g4ifLWR9ndMQnfWzhQiMACiXF7i8Mj/81x8tDcvlkrWe+FeE9Ej0RSA0YJLZQ\ntpbBNBlgJPynqtHsPSPmebTDKvA6jTLPj5+A8y2kTb2YqULAAJ8I8esSlDu9rRJW\noFp0A2pYuYsm27fu4+mZh1Qy9sbRFu9UzcS3zqTIkbxwsaW6r5lcV/tz6shVXqPy\nbaP299GLAgMBAAECggEACzupXTgmnZ3Bj7uCQe9zSlNXe47+CJfknVf04M2v7Eqw\npjh+r24N8cnrEDr55LCukZlvjJq5PmnZ91bMY7hujdSNjkROoNLvUBcjdUMmwtVm\n9PuMMOwj8cIPQLNx7UPfFgOeYM41S1sJjipEgmFokFut0PqYbEFpceD23cqb9RNm\nI+rLBAwWqPdLfS2l3sJt1A1j/5YXgzs+2ur/+pHIaDYDKTyNe+go9Jkdxy7AFl0a\nFmLHX0svHqVxDhYcZWLnWYMEmPdf6BCPUgFCW4n+OclRvEwuLBymif9FSHSjGosC\nHFQ7H5GKVAxW1mnluoLl6D5kvAvhlNoZITNYsf7AzQKBgQDrmHZVqugV/mbkVNuI\n3e7V0asHZbTMSCIgaZ/Ok1pd15Q47dj27i2MH+Ir7vtYXIMyVCfIH4UZ0mOIFEyP\nT4jbKDJeVpmTwHYgRMehFBKBdKsGnzTUlR27yefotyBftTeMnJfRuuBi1F2w9iQv\nEfo3JocxY/oiBQ/19hI543BMJQKBgQDA23Po6sn7Aj/eBTn/cCUdmNCXdyEL4PzJ\n9nyNeER3d9WWz1iyoXaZnIQHVZP2ZKgzboukmhrn+qfpE4zXwtgaq5iGvP0p5qiO\nhfdF8R+inekK6m2S1z/b3rboPrW1aKonYGT4wCM/7qtK/hTwKzH36T6zrBo65eSL\nciOQq7Nf7wKBgQDWEdGsY7/AhEm/vS9BfM8QcBQkg5C1cfG4W+E+Vfvtev4OgGf9\nb0vpn+rlmp+9mUoIyBjhqWpKnTWdJzytl0o2QJ8Lw0qGy4FKLtTpkxCBmp3wRWc+\npkO/J2XWudbrwAC6fmsgwdozUt3S9sTIFGC0DgkXos1cbhcjmbTT7spSFQKBgQCj\nD+otIXet1/UQT/L922BGahLUPlGerZiPWu1s4Cdjq9rYLHCeeI7CyueHHACC8BCX\ni/xeLD5brj+SfokzVPdLdZL9OYYEi5YxC2xLothQspt8M0J6Sa0gxmp4a61PuTNF\nH+e/uxUS1UXXnoUtnBgfuQLe/8Ed04strFAN3l9H2QKBgHnIwcboOjjNbTaOI2/W\n/yjX6Pa5X8PIJfq21btCY82Wu6YYvdV/aBqSJRX3zf8Ta4LmilkiMZ5Gcd2isRVC\nnp6iclQsTrJM8BS5lXecFJuXYwqTvjBOJd9GYLrORj1b1Uq7rU2Gnk7heGHkEWLD\ndFGJmI2SfnzDh5j8RfeaWPU6\n-----END PRIVATE KEY-----\n"
};

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app, 'promptresources-db-0');

const BACKUP_PATH = path.join(__dirname, '../../BACKUPS/rob-backup-resources-2026-02-16T13-12-39-169Z.json');

async function restore() {
  console.log('--- Sovereign Data Restoration Initialised ---');
  
  if (!fs.existsSync(BACKUP_PATH)) {
    console.error(`Error: Backup file not found at ${BACKUP_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(BACKUP_PATH, 'utf8');
  const data = JSON.parse(rawData);

  const collections = [
    { key: 'resources', dbName: 'resources' },
    { key: 'resourceTags', dbName: 'resourceTags' },
    { key: 'resourceCategories', dbName: 'resourceCategories' },
    { key: 'resourceRelatedLinks', dbName: 'resourceRelatedLinks' }
  ];

  for (const col of collections) {
    const items = data[col.key] || [];
    console.log(`\nRestoring collection [${col.dbName}] (${items.length} items)...`);
    
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = db.batch();
      const chunk = items.slice(i, i + batchSize);
      
      chunk.forEach((item: any) => {
        const { id, ...docData } = item;
        const finalData = { ...docData };
        
        // Convert ISO strings back to Firestore Timestamps
        if (finalData.createdAt) finalData.createdAt = Timestamp.fromDate(new Date(finalData.createdAt));
        if (finalData.updatedAt) finalData.updatedAt = Timestamp.fromDate(new Date(finalData.updatedAt));
        
        const docRef = db.collection(col.dbName).doc(id);
        batch.set(docRef, finalData);
      });
      
      await batch.commit();
      console.log(`  Added batch ${Math.floor(i / batchSize) + 1} (${chunk.length} docs)`);
    }
  }

  console.log('\n--- Restoration SUCCESS ---');
  console.log('System Status: ALL_RESOURCES_RECOVERY_COMPLETE');
  process.exit(0);
}

restore().catch(err => {
  console.error('\n--- Restoration FAILED ---');
  console.error(err);
  process.exit(1);
});
