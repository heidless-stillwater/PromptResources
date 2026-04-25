const admin = require('firebase-admin');
const path = require('path');

// Initialize with the service account from PromptResources
const serviceAccount = require('/home/heidless/projects/PromptResources/service-account.json');

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function injectAmberDrifts() {
    const policies = [
        {
            name: 'Online Safety Act 2023',
            slug: 'osa-drift',
            status: 'amber',
            targetApps: ['promptresources'],
            driftMessage: 'OSA Compliance Drift: Automated reporting telemetry is intermittent.',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            name: 'GDPR Data Sovereignty',
            slug: 'gdpr-drift',
            status: 'amber',
            targetApps: ['all'],
            driftMessage: 'GDPR Advisory: Cross-border data residency verification required.',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
    ];

    console.log('Injecting Amber Drifts...');
    for (const policy of policies) {
        await db.collection('policies').doc(policy.slug).set(policy);
        console.log(`- Injected: ${policy.name}`);
    }
    console.log('Injection Complete.');
}

injectAmberDrifts().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
