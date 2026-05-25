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
  const orgId = "org-1765817997819";
  
  console.log("=== VERIFYING GUSTO CLEANSE STATUS ===");

  // 1. Verify Organization document
  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();
  if (orgSnap.exists) {
    const data = orgSnap.data();
    const gustoKeys = Object.keys(data).filter(k => k.toLowerCase().includes('gusto'));
    console.log("Organization Gusto Fields left:", gustoKeys);
  }

  // 2. Verify Users documents
  const usersRef = db.collection('users');
  const usersSnap = await usersRef.where('organizationId', '==', orgId).get();
  let usersWithGusto = 0;
  usersSnap.docs.forEach(uDoc => {
    const data = uDoc.data();
    const gustoKeys = Object.keys(data).filter(k => k.toLowerCase().includes('gusto'));
    if (gustoKeys.length > 0) {
      console.log(`User ${uDoc.id} (${data.email}) still has keys:`, gustoKeys);
      usersWithGusto++;
    }
  });
  console.log("Total users with Gusto data left:", usersWithGusto);

  // 3. Verify Subcontractors documents
  const subRef = db.collection('subcontractors');
  const subSnap = await subRef.where('organizationId', '==', orgId).get();
  let subsWithGusto = 0;
  subSnap.docs.forEach(sDoc => {
    const data = sDoc.data();
    const gustoKeys = Object.keys(data).filter(k => k.toLowerCase().includes('gusto'));
    if (gustoKeys.length > 0) {
      console.log(`Subcontractor ${sDoc.id} (${data.email}) still has keys:`, gustoKeys);
      subsWithGusto++;
    }
  });
  console.log("Total subcontractors with Gusto data left:", subsWithGusto);

  console.log("=== VERIFICATION COMPLETED ===");
  process.exit(0);
}

run();
