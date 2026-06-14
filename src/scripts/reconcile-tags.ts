import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environmental variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const databaseId = process.env.FIREBASE_DATABASE_ID || 'promptresources-db-0';

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Error: Missing Firebase Admin environment variables in .env.local');
  process.exit(1);
}

const formattedKey = privateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim();

if (getApps().length === 0) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey: formattedKey })
  });
}

const db = getFirestore(getApps()[0], databaseId);

async function reconcileTags() {
  console.log('🚀 Starting Intelligence Tags Reconciliation Script...');
  console.log(`📡 Targeting Database ID: ${databaseId}`);

  // 1. Fetch all existing master tags
  console.log('📥 Fetching existing master tags...');
  const tagsSnap = await db.collection('resourceTags').get();
  const masterTagsMap = new Map<string, { id: string; name: string; count: number }>();
  
  tagsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      masterTagsMap.set(data.name.trim(), {
        id: doc.id,
        name: data.name.trim(),
        count: data.count || 0
      });
    }
  });
  console.log(`✅ Loaded ${masterTagsMap.size} master tags.`);

  // 2. Fetch all resources and count tags
  console.log('📥 Fetching all resources...');
  const resourcesSnap = await db.collection('resources').get();
  const resourceCount = resourcesSnap.size;
  console.log(`✅ Loaded ${resourceCount} resources. Counting tag frequencies...`);

  const tagCounts = new Map<string, number>();
  resourcesSnap.forEach(doc => {
    const data = doc.data();
    const tags: string[] = data.tags || [];
    tags.forEach(tag => {
      const cleanTag = tag.trim();
      if (cleanTag) {
        tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
      }
    });
  });

  console.log(`📊 Found ${tagCounts.size} unique tags inside resources:`);
  tagCounts.forEach((count, name) => {
    console.log(`   - #${name}: ${count} usages`);
  });

  // 3. Reconcile tags list and prepare batch updates
  const createdTags: string[] = [];
  const updatedTags: { name: string; oldVal: number; newVal: number }[] = [];
  
  let batch = db.batch();
  let operationCount = 0;
  const commitBatchIfNeeded = async () => {
    if (operationCount >= 400) { // Keep safe margin under 500 limit
      console.log(`   ⏳ Committing batch of ${operationCount} operations...`);
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  };

  for (const [tagName, actualCount] of Array.from(tagCounts.entries())) {
    const existing = masterTagsMap.get(tagName);

    if (!existing) {
      // Missing tag! Create in resourceTags
      const docRef = db.collection('resourceTags').doc();
      batch.set(docRef, {
        name: tagName,
        count: actualCount,
        userId: 'system-reconciliation',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      createdTags.push(tagName);
      operationCount++;
      await commitBatchIfNeeded();
    } else if (existing.count !== actualCount) {
      // Mismatched count! Update count
      const docRef = db.collection('resourceTags').doc(existing.id);
      batch.update(docRef, {
        count: actualCount,
        updatedAt: Timestamp.now()
      });
      updatedTags.push({ name: tagName, oldVal: existing.count, newVal: actualCount });
      operationCount++;
      await commitBatchIfNeeded();
    }
  }

  // Final commit if any remaining operations
  if (operationCount > 0) {
    console.log(`   ⏳ Committing final batch of ${operationCount} operations...`);
    await batch.commit();
  }

  console.log('\n✨ Reconciliation Summary:');
  console.log(`🆕 Created ${createdTags.length} missing tags:`, createdTags);
  console.log(`🔄 Corrected count for ${updatedTags.length} tags:`);
  updatedTags.forEach(t => {
    console.log(`   - #${t.name}: count corrected from ${t.oldVal} to ${t.newVal}`);
  });
  console.log('\n✅ Tags reconciliation complete!');
  process.exit(0);
}

reconcileTags().catch(error => {
  console.error('❌ Error executing reconciliation:', error);
  process.exit(1);
});
