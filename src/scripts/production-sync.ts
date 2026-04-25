import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: 'heidless-apps-0',
  clientEmail: 'firebase-adminsdk-fbsvc@heidless-apps-0.iam.gserviceaccount.com',
  privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCxfE7ZUt48Uod7\nk3TPW5LzBs7gNpNWuI10M10mZKrWOSXruVNzHuSTqhlAkh30Sc+w//+25oLPwH55\nUzDSJF6R0/Tb4CrHgq2Dn3wcWJa3gCWB+v2sZCli93Pc0nWTy1BMss2xwYandssR\nYi9g4ifLWR9ndMQnfWzhQiMACiXF7i8Mj/81x8tDcvlkrWe+FeE9Ej0RSA0YJLZQ\ntpbBNBlgJPynqtHsPSPmebTDKvA6jTLPj5+A8y2kTb2YqULAAJ8I8esSlDu9rRJW\noFp0A2pYuYsm27fu4+mZh1Qy9sbRFu9UzcS3zqTIkbxwsaW6r5lcV/tz6shVXqPy\nbaP299GLAgMBAAECggEACzupXTgmnZ3Bj7uCQe9zSlNXe47+CJfknVf04M2v7Eqw\npjh+r24N8cnrEDr55LCukZlvjJq5PmnZ91bMY7hujdSNjkROoNLvUBcjdUMmwtVm\n9PuMMOwj8cIPQLNx7UPfFgOeYM41S1sJjipEgmFokFut0PqYbEFpceD23cqb9RNm\nI+rLBAwWqPdLfS2l3sJt1A1j/5YXgzs+2ur/+pHIaDYDKTyNe+go9Jkdxy7AFl0a\nFmLHX0svHqVxDhYcZWLnWYMEmPdf6BCPUgFCW4n+OclRvEwuLBymif9FSHSjGosC\nHFQ7H5GKVAxW1mnluoLl6D5kvAvhlNoZITNYsf7AzQKBgQDrmHZVqugV/mbkVNuI\n3e7V0asHZbTMSCIgaZ/Ok1pd15Q47dj27i2MH+Ir7vtYXIMyVCfIH4UZ0mOIFEyP\nT4jbKDJeVpmTwHYgRMehFBKBdKsGnzTUlR27yefotyBftTeMnJfRuuBi1F2w9iQv\nEfo3JocxY/oiBQ/19hI543BMJQKBgQDA23Po6sn7Aj/eBTn/cCUdmNCXdyEL4PzJ\n9nyNeER3d9WWz1iyoXaZnIQHVZP2ZKgzboukmhrn+qfpE4zXwtgaq5iGvP0p5qiO\nhfdF8R+inekK6m2S1z/b3rboPrW1aKonYGT4wCM/7qtK/hTwKzH36T6zrBo65eSL\nciOQq7Nf7wKBgQDWEdGsY7/AhEm/vS9BfM8QcBQkg5C1cfG4W+E+Vfvtev4OgGf9\nb0vpn+rlmp+9mUoIyBjhqWpKnTWdJzytl0o2QJ8Lw0qGy4FKLtTpkxCBmp3wRWc+\npkO/J2XWudbrwAC6fmsgwdozUt3S9sTIFGC0DgkXos1cbhcjmbTT7spSFQKBgQCj\nD+otIXet1/UQT/L922BGahLUPlGerZiPWu1s4Cdjq9rYLHCeeI7CyueHHACC8BCX\ni/xeLD5brj+SfokzVPdLdZL9OYYEi5YxC2xLothQspt8M0J6Sa0gxmp4a61PuTNF\nH+e/uxUS1UXXnoUtnBgfuQLe/8Ed04strFAN3l9H2QKBgHnIwcboOjjNbTaOI2/W\n/yjX6Pa5X8PIJfq21btCY82Wu6YYvdV/aBqSJRX3zf8Ta4LmilkiMZ5Gcd2isRVC\nnp6iclQsTrJM8BS5lXecFJuXYwqTvjBOJd9GYLrORj1b1Uq7rU2Gnk7heGHkEWLD\ndFGJmI2SfnzDh5j8RfeaWPU6\n-----END PRIVATE KEY-----\n"
};

if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
}

async function migrate() {
    const sourceDb = getFirestore(undefined, 'promptresources-db-0');
    const targetDb = getFirestore(undefined, 'promptresources-db-0');

    console.log('🚀 Starting Full Production Sync...');

    // 1. Wipe TARGET
    console.log('🧹 Wiping target collections in promptresources-db-0...');
    const targetResources = await targetDb.collection('resources').get();
    const batchWipe = targetDb.batch();
    targetResources.docs.forEach(doc => batchWipe.delete(doc.ref));
    await batchWipe.commit();
    console.log(`✅ Wiped ${targetResources.size} resources.`);

    const targetCats = await targetDb.collection('categories').get();
    const batchWipeCats = targetDb.batch();
    targetCats.docs.forEach(doc => batchWipeCats.delete(doc.ref));
    await batchWipeCats.commit();
    console.log(`✅ Wiped ${targetCats.size} categories.`);

    // 2. Migrate CATEGORIES
    console.log('📂 Migrating categories...');
    const sourceCats = await sourceDb.collection('categories').get();
    let catCount = 0;
    const catBatch = targetDb.batch();
    sourceCats.forEach(doc => {
        catBatch.set(targetDb.collection('categories').doc(doc.id), doc.data());
        catCount++;
    });
    await catBatch.commit();
    console.log(`✅ Migrated ${catCount} categories.`);

    // 3. Migrate RESOURCES
    console.log('🎥 Migrating 152 resources...');
    const sourceResources = await sourceDb.collection('resources').get();
    let resCount = 0;
    
    // Firestore batch limit is 500, so 152 is safe in one batch
    const resBatch = targetDb.batch();
    
    sourceResources.forEach(doc => {
        const data = doc.data();
        
        // Ensure status defaults to published if missing
        if (!data.status) data.status = 'published';
        
        resBatch.set(targetDb.collection('resources').doc(doc.id), data);
        resCount++;
    });

    await resBatch.commit();
    console.log(`✨ SUCCESS: Migrated ${resCount} resources and all associated metadata.`);
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ MIGRATION FAILED:', err);
    process.exit(1);
});
