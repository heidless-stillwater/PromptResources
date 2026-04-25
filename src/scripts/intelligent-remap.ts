import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase Admin Configuration (heidless-apps-0)
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

async function wipeCollection(name: string) {
  const snap = await db.collection(name).get();
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Wiped collection: ${name} (${snap.size} docs)`);
}

async function runRemap() {
  console.log('--- Sovereign Intelligent Re-Mapping Initialised ---');

  if (!fs.existsSync(BACKUP_PATH)) {
    console.error(`Error: Backup file not found at ${BACKUP_PATH}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

  // Wipe before restoration
  await wipeCollection('resources');
  await wipeCollection('resourceTags');
  await wipeCollection('resourceCategories');
  await wipeCollection('resourceRelatedLinks');

  // 1. Remap Resources
  console.log('\nRemapping Resources...');
  const resBatch = db.batch();
  data.resources.forEach((oldRes: any) => {
    const newRes: any = {
      id: oldRes.id,
      title: oldRes.name,
      description: oldRes.description || '',
      url: oldRes.resourcelink,
      addedBy: oldRes.userId,
      createdAt: Timestamp.fromDate(new Date(oldRes.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(oldRes.updatedAt)),
      notes: oldRes.resourceNotes || '',
      status: 'published',
      pricing: 'free',
      platform: 'general',
      mediaFormat: oldRes.resourcelink.includes('youtube.com') || oldRes.resourcelink.includes('youtu.be') ? 'youtube' : 'webpage',
      type: (oldRes.resourcecCategories || 'Tutorial').toLowerCase(),
      categories: [oldRes.resourcecCategories || 'Tutorial'],
      tags: oldRes.resourceTags ? oldRes.resourceTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      prompts: oldRes.prompts || [],
      attributions: []
    };
    
    // Safety check for YouTube ID
    if (newRes.mediaFormat === 'youtube') {
      const match = oldRes.resourcelink.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
      if (match) newRes.youtubeVideoId = match[1];
    }

    resBatch.set(db.collection('resources').doc(newRes.id), newRes);
  });
  await resBatch.commit();
  console.log(`Restored ${data.resources.length} resources with correct schema mapping.`);

  // 2. Remap Categories
  console.log('\nRemapping Categories...');
  const catBatch = db.batch();
  data.resourceCategories.forEach((cat: any) => {
    catBatch.set(db.collection('resourceCategories').doc(cat.id), {
      ...cat,
      createdAt: Timestamp.fromDate(new Date(cat.createdAt))
    });
  });
  await catBatch.commit();

  // 3. Remap Tags
  console.log('\nRemapping Tags...');
  const tagBatch = db.batch();
  data.resourceTags.forEach((tag: any) => {
    tagBatch.set(db.collection('resourceTags').doc(tag.id), {
      ...tag,
      createdAt: Timestamp.fromDate(new Date(tag.createdAt))
    });
  });
  await tagBatch.commit();

  // 4. Remap Related Links
  console.log('\nRemapping Related Links...');
  const linkBatch = db.batch();
  data.resourceRelatedLinks.forEach((link: any) => {
    const newLink = {
      ...link,
      createdAt: Timestamp.fromDate(new Date(link.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(link.updatedAt))
    };
    linkBatch.set(db.collection('resourceRelatedLinks').doc(link.id), newLink);
  });
  await linkBatch.commit();

  console.log('\n--- INTELLIGENT REMAP SUCCESS ---');
  process.exit(0);
}

runRemap().catch(err => {
  console.error('\n--- REMAP FAILED ---');
  console.error(err);
  process.exit(1);
});
