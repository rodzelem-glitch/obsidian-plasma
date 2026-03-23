const admin = require('firebase-admin');

// Ensure you are authorized via ADC or a service account
admin.initializeApp({
  projectId: 'tektrakker'
});

const db = admin.firestore();

async function findSettings() {
  const collections = ['platformSettings', 'settings', 'config', 'admin', 'billing'];
  console.log('--- STARTING SEARCH ---');
  
  for (const coll of collections) {
    try {
      const snap = await db.collection(coll).get();
      if (snap.empty) {
        // console.log(\`Collection \${coll} is empty.\`);
      } else {
        snap.forEach(doc => {
          console.log(\`FOUND in \${coll} [\${doc.id}]:\`, JSON.stringify(doc.data(), null, 2));
        });
      }
    } catch (e) {
      console.log(\`Error reading \${coll}: \${e.message}\`);
    }
  }
  console.log('--- SEARCH COMPLETE ---');
}

findSettings();
