const { adminDb } = require('./src/lib/firebase-admin');

async function checkResource() {
  const rid = 'QJO23QgBc4OVSNqjD5Sp';
  try {
    const resDoc = await adminDb.collection('resources').doc(rid).get();
    if (resDoc.exists) {
      console.log('Resource Data:', JSON.stringify(resDoc.data(), null, 2));
    } else {
      console.log('Resource not found');
    }
  } catch (error) {
    console.error('Error checking resource:', error);
  }
}

checkResource();
