const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'tektrakker' });
const db = admin.firestore();

async function run() {
  console.log('--- DEEP SEARCH ---');
  const collections = ['platformSettings', 'settings', 'config', 'metadata', 'billing'];
  for (const coll of collections) {
    const snap = await db.collection(coll).get();
    snap.forEach(doc => {
      console.log(`PATH: ${coll}/${doc.id}`);
      console.log('DATA:', JSON.stringify(doc.data(), null, 2));
    });
  }
  
  // Also check if there's a document in 'organizations' named 'platform' or similar
  const platDoc = await db.collection('organizations').doc('platform').get();
  if (platDoc.exists) {
    console.log('PATH: organizations/platform');
    console.log('DATA:', JSON.stringify(platDoc.data(), null, 2));
  }
}
run();
