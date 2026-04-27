const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnvVar(name) {
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (!match) return null;
    let val = match[1].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
    }
    return val;
}

const projectId = getEnvVar('FIREBASE_ADMIN_PROJECT_ID');
const clientEmail = getEnvVar('FIREBASE_ADMIN_CLIENT_EMAIL');
let privateKey = getEnvVar('FIREBASE_ADMIN_PRIVATE_KEY');
if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');

const app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = getFirestore(app, 'promptresources-db-0');

// Helper to slugify names (matches utils.ts)
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function migrateStubs() {
    console.log('--- Starting Registry Identity Healing ---');
    
    const resourcesSnap = await db.collection('resources').get();
    console.log(`Scanning ${resourcesSnap.size} resources...`);

    let updatedCount = 0;
    const batch = db.batch();
    let batchSize = 0;

    for (const doc of resourcesSnap.docs) {
        const data = doc.data();
        const attributions = data.attributions || [];
        const attributedUserIds = data.attributedUserIds || [];
        
        let needsUpdate = false;
        const newAttributions = [];
        const newUserIds = new Set(attributedUserIds);

        for (const attr of attributions) {
            if (attr.userId && attr.userId.startsWith('stub_')) {
                const expectedStubId = `stub_${slugify(attr.name)}`;
                if (attr.userId !== expectedStubId) {
                    console.log(`[Heal] [${doc.id}] Correcting stub for "${attr.name}": ${attr.userId} -> ${expectedStubId}`);
                    
                    // Update the specific attribution
                    newAttributions.push({ ...attr, userId: expectedStubId });
                    
                    // Update the registry set
                    newUserIds.delete(attr.userId);
                    newUserIds.add(expectedStubId);
                    
                    needsUpdate = true;
                } else {
                    newAttributions.push(attr);
                }
            } else {
                newAttributions.push(attr);
            }
        }

        if (needsUpdate) {
            batch.update(doc.ref, {
                attributions: newAttributions,
                attributedUserIds: Array.from(newUserIds),
                updatedAt: new Date()
            });
            updatedCount++;
            batchSize++;
            
            if (batchSize >= 400) {
                await batch.commit();
                batchSize = 0;
                console.log('Batch committed...');
            }
        }
    }

    if (batchSize > 0) {
        await batch.commit();
    }

    console.log(`--- Healing Complete. Updated ${updatedCount} resources. ---`);
}

migrateStubs().catch(console.error);
