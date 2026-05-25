const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tektrakker'
});

const db = admin.firestore();

async function run() {
  const targetSubId = "sub-1772596124157";
  const docRef = db.collection('subcontractors').doc(targetSubId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    const data = docSnap.data();
    console.log("Found ghost subcontractor to delete:");
    console.log(`- ID: ${targetSubId}`);
    console.log(`- Email: ${data.email}`);
    console.log(`- Name: ${data.firstName} ${data.lastName}`);
    
    await docRef.delete();
    console.log("\n--> Ghost subcontractor deleted successfully from Firestore!");
  } else {
    console.log(`Subcontractor document with ID ${targetSubId} not found. (It may have already been deleted.)`);
  }
  process.exit(0);
}

run().catch(e => {
  console.error("Error deleting ghost subcontractor:", e);
  process.exit(1);
});
