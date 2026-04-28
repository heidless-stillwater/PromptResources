const { accreditationDb } = require('./src/lib/firebase-admin');

async function checkTicket() {
  const tid = 'LcWLSwFVhr6hJRQvdThc';
  try {
    const doc = await accreditationDb.collection('tickets').doc(tid).get();
    if (doc.exists) {
      console.log('Ticket Data:', JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('Ticket not found');
    }
  } catch (error) {
    console.error('Error checking ticket:', error);
  }
}

checkTicket();
