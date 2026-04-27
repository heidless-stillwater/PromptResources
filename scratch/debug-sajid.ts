import { adminDb } from '../src/lib/firebase-admin';
import { slugify } from '../src/lib/utils';
import { resolveAttributions, syncCreatorStats } from '../src/lib/creators-server';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function debugSajid() {
    console.log('--- DEBUG SAJID ---');
    
    // 1. Find user profile for "sajid"
    const slug = 'sajid';
    const normalizedSlug = slugify(slug);
    
    console.log(`Searching for user with slug: ${normalizedSlug}`);
    const userSnap = await adminDb.collection('users')
        .where('slug', '==', normalizedSlug)
        .get();
        
    if (userSnap.empty) {
        console.log('No user found with slug "sajid"');
        
        // Try searching by display name
        const nameSnap = await adminDb.collection('users')
            .where('displayName', '>=', 'Sajid')
            .where('displayName', '<=', 'Sajid\uf8ff')
            .get();
            
        if (nameSnap.empty) {
            console.log('No user found with name starting with "Sajid"');
        } else {
            nameSnap.forEach(doc => {
                console.log(`Found user by name: ${doc.id}`, JSON.stringify(doc.data(), null, 2));
            });
        }
    } else {
        userSnap.forEach(doc => {
            console.log(`Found user by slug: ${doc.id}`, JSON.stringify(doc.data(), null, 2));
        });
    }
    
    // 2. Find resources with "sajid" in attributions
    console.log('\nSearching for resources with "sajid" in attributions...');
    
    // We search attributionNames first
    const resSnap = await adminDb.collection('resources')
        .where('attributionNames', 'array-contains', 'Sajid')
        .get();
        
    const resSnapLower = await adminDb.collection('resources')
        .where('attributionNames', 'array-contains', 'sajid')
        .get();
        
    const allDocs = [...resSnap.docs, ...resSnapLower.docs];
    
    if (allDocs.length === 0) {
        console.log('No resources found with "Sajid" or "sajid" in attributionNames');
        
        // Broad search
        console.log('Doing broad search in all resources...');
        const allRes = await adminDb.collection('resources').limit(1000).get();
        let foundCount = 0;
        allRes.forEach(doc => {
            const data = doc.data();
            const attributions = data.attributions || [];
            const hasSajid = attributions.some((a: any) => a.name.toLowerCase().includes('sajid'));
            if (hasSajid) {
                console.log(`Found resource by broad search: ${doc.id} - ${data.title}`);
                console.log('Attributions:', JSON.stringify(attributions, null, 2));
                console.log('AttributedUserIds:', JSON.stringify(data.attributedUserIds, null, 2));
                foundCount++;
                
                // Attempt to fix it!
                resolveAndFix(doc.id, data);
            }
        });
        console.log(`Broad search found ${foundCount} resources.`);
    } else {
        console.log(`Found ${allDocs.length} resources via indexed search.`);
        allDocs.forEach(doc => {
            const data = doc.data();
            console.log(`Resource: ${doc.id} - ${data.title}`);
            console.log('Attributions:', JSON.stringify(data.attributions, null, 2));
            console.log('AttributedUserIds:', JSON.stringify(data.attributedUserIds, null, 2));
            
            // Attempt to fix it!
            resolveAndFix(doc.id, data);
        });
    }
}

async function resolveAndFix(id: string, data: any) {
    console.log(`Attempting to resolve attributions for resource ${id}...`);
    try {
        const resolved = await resolveAttributions(data.attributions, data.url);
        console.log('Resolved Attributions:', JSON.stringify(resolved.resolvedAttributions, null, 2));
        console.log('Resolved User IDs:', JSON.stringify(resolved.attributedUserIds, null, 2));
        
        await adminDb.collection('resources').doc(id).update({
            attributions: resolved.resolvedAttributions,
            attributedUserIds: resolved.attributedUserIds,
            updatedAt: new Date()
        });
        
        console.log('Resource updated successfully.');
        
        // Sync stats
        if (resolved.attributedUserIds) {
            for (const uid of resolved.attributedUserIds) {
                await syncCreatorStats(uid);
                console.log(`Synced stats for user ${uid}`);
            }
        }
    } catch (err) {
        console.error(`Failed to fix resource ${id}:`, err);
    }
}

debugSajid().then(() => console.log('Done.')).catch(console.error);
