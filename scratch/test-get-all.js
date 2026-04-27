const { getAllCreators } = require('../src/lib/creators-server');

async function test() {
    console.log('--- Testing getAllCreators ---');
    const creators = await getAllCreators({ limit: 48 });
    console.log(`Returned ${creators.length} creators`);
    
    const digitalAssets = creators.find(c => c.displayName === 'Digital Assets');
    if (digitalAssets) {
        console.log('Digital Assets found in result:');
        console.log(`  UID: ${digitalAssets.uid}`);
        console.log(`  AuthoredCount: ${digitalAssets.authoredCount}`);
        console.log(`  PhotoURL: ${!!digitalAssets.photoURL}`);
    } else {
        console.log('Digital Assets NOT found in result.');
    }
}

test().catch(console.error);
