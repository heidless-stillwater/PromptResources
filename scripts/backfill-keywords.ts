/**
 * REPAIR SCRIPT: Backfill Search Keywords
 * 
 * Purpose: Iterates through all existing resources and generates 'searchKeywords'
 * to enable the new cost-optimized indexed search.
 * 
 * Run with: npx ts-node scripts/backfill-keywords.ts
 */

import { adminDb } from '../src/lib/firebase-admin';
import { generateSearchKeywords } from '../src/lib/utils';

async function backfillKeywords() {
    console.log('🚀 Starting keyword backfill...');
    
    const snapshot = await adminDb.collection('resources').get();
    console.log(`📝 Found ${snapshot.size} resources to process.`);
    
    let updatedCount = 0;
    const batch = adminDb.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip if already has keywords (unless we want to force refresh)
        if (data.searchKeywords && data.searchKeywords.length > 0) {
            continue;
        }

        const keywords = generateSearchKeywords(data.title || '', data.categories || []);
        
        batch.update(doc.ref, {
            searchKeywords: keywords,
            updatedAt: new Date()
        });

        updatedCount++;
        batchSize++;

        // Firestore batch limit is 500
        if (batchSize >= 400) {
            await batch.commit();
            console.log(`✅ Progress: ${updatedCount} resources updated...`);
            batchSize = 0;
        }
    }

    if (batchSize > 0) {
        await batch.commit();
    }

    console.log(`✨ FINISHED: Updated ${updatedCount} resources.`);
    process.exit(0);
}

backfillKeywords().catch(err => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
});
