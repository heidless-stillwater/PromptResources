import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { nanoid } from 'nanoid';

// Script to automatically create stub profiles for unique string attributions 
// and link them back to the resources.

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = getFirestore();

function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function run() {
    console.log('🔄 Starting backfill of creator attributions...');

    // 1. Fetch all users for lookup
    const usersSnap = await db.collection('users').get();
    // Maps lowercase displayName to UID
    const userMap = new Map<string, string>();
    usersSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.displayName) {
            userMap.set(data.displayName.toLowerCase().trim(), doc.id);
        }
    });

    const resourcesSnap = await db.collection('resources').get();
    let updatedCount = 0;
    let stubCount = 0;

    for (const doc of resourcesSnap.docs) {
        const resource = doc.data();
        const attributions = resource.attributions || [];
        let modified = false;
        const attributedUserIds = new Set<string>(resource.attributedUserIds || []);

        for (let i = 0; i < attributions.length; i++) {
            const attr = attributions[i];
            
            // Skip empty or already linked
            if (!attr.name || attr.userId) {
                if (attr.userId) attributedUserIds.add(attr.userId);
                continue;
            }

            const nameKey = attr.name.toLowerCase().trim();

            if (userMap.has(nameKey)) {
                // Link to existing user/stub
                attr.userId = userMap.get(nameKey);
                attributedUserIds.add(attr.userId!);
                modified = true;
            } else {
                // It's a new unique creator name! Create a stub.
                const stubId = 'stub_' + nanoid(10);
                const stubSlug = generateSlug(attr.name);
                
                await db.collection('users').doc(stubId).set({
                    uid: stubId,
                    displayName: attr.name,
                    email: `stub_${stubId}@directory.local`,
                    role: 'member',
                    subscriptionType: 'free',
                    slug: stubSlug,
                    profileType: 'individual',
                    isStub: true,
                    isPublicProfile: true, // Show in directory
                    isFeatured: false,
                    isVerified: false,
                    resourceCount: 0,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                userMap.set(nameKey, stubId);
                stubCount++;

                attr.userId = stubId;
                attributedUserIds.add(stubId);
                modified = true;
            }
        }

        if (modified) {
            await doc.ref.update({
                attributions,
                attributedUserIds: Array.from(attributedUserIds),
                updatedAt: FieldValue.serverTimestamp()
            });
            updatedCount++;
        }
    }

    console.log(`✅ Backfill complete. Created ${stubCount} new stub profiles. Updated ${updatedCount} resources.`);
}

run().then(() => process.exit(0)).catch((e) => { 
    console.error(e); 
    process.exit(1); 
});
