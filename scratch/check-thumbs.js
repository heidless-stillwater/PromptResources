const { adminDb } = require('./src/lib/firebase-admin');

async function checkResources() {
    const snap = await adminDb.collection('resources').limit(10).get();
    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`Resource: ${doc.id}`);
        console.log(`  Title: ${data.title}`);
        console.log(`  URL: ${data.url}`);
        console.log(`  ThumbnailUrl: "${data.thumbnailUrl}"`);
        console.log(`  youtubeVideoId: ${data.youtubeVideoId}`);
        console.log('---');
    });
}

checkResources();
