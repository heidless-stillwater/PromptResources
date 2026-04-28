const { adminDb } = require('./src/lib/firebase-admin');

async function clearStrayTickets() {
  try {
    const snapshot = await adminDb.collection('resources')
      .where('activeTicketId', '!=', null)
      .get();

    if (snapshot.empty) {
      console.log('No resources found with active tickets.');
      return;
    }

    console.log(`Found ${snapshot.size} resources with active tickets. Clearing...`);

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => {
      console.log(`- Clearing ticket ${doc.data().activeTicketId} from resource ${doc.id}`);
      batch.update(doc.ref, {
        activeTicketId: null,
        reportType: null,
        status: 'published' // Assuming we want to reinstate them if they were stuck
      });
    });

    await batch.commit();
    console.log('Successfully cleared all stray tickets.');
  } catch (error) {
    console.error('Error clearing stray tickets:', error);
  }
}

clearStrayTickets();
