const { toolDbAdmin } = require('./src/lib/firebase-admin');

async function checkUser() {
  const uid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';
  try {
    const userDoc = await toolDbAdmin.collection('users').doc(uid).get();
    if (userDoc.exists) {
      console.log('User Role:', userDoc.data().role);
      console.log('User Email:', userDoc.data().email);
    } else {
      console.log('User not found in toolDbAdmin');
    }
  } catch (error) {
    console.error('Error checking user:', error);
  }
}

checkUser();
