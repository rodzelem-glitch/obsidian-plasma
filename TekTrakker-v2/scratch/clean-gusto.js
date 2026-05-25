const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Resolve service account from parent directory
const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("Service account key not found at:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tektrakker'
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function run() {
  const orgId = "org-1765817997819";
  
  console.log("====================================================");
  console.log("=== CLEANSING GUSTO INTEGRATION FOR TEKAIR INC. ===");
  console.log("====================================================");

  // 1. Cleanse Organization document
  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();
  if (orgSnap.exists) {
    const data = orgSnap.data();
    console.log("Found TekAir Inc organization document.");
    console.log("Gusto fields before cleanse:", Object.keys(data).filter(k => k.toLowerCase().includes('gusto')));
    
    await orgRef.update({
      gustoAccessToken: FieldValue.delete(),
      gustoCompanyId: FieldValue.delete(),
      gustoCompanyUuid: FieldValue.delete(),
      gustoOnboardingUrl: FieldValue.delete(),
      gustoRefreshToken: FieldValue.delete()
    });
    console.log("--> Organization-level Gusto keys deleted successfully.");
  } else {
    console.log("TekAir Inc organization document not found!");
  }

  // 2. Cleanse Users documents
  const usersRef = db.collection('users');
  const usersSnap = await usersRef.where('organizationId', '==', orgId).get();
  console.log(`\nFound ${usersSnap.docs.length} users under TekAir Inc.`);
  
  const userBatch = db.batch();
  let usersUpdatedCount = 0;
  
  usersSnap.docs.forEach(uDoc => {
    const data = uDoc.data();
    const hasGustoData = data.gustoEmployeeId || data.gustoOnboardingUrl || data.gustoOnboardingStatus;
    if (hasGustoData) {
      userBatch.update(uDoc.ref, {
        gustoEmployeeId: FieldValue.delete(),
        gustoOnboardingUrl: FieldValue.delete(),
        gustoOnboardingStatus: FieldValue.delete()
      });
      usersUpdatedCount++;
      console.log(`- Staging User: ${data.firstName || ''} ${data.lastName || ''} (${data.email})`);
    }
  });

  if (usersUpdatedCount > 0) {
    await userBatch.commit();
    console.log(`--> Successfully deleted Gusto fields for ${usersUpdatedCount} users.`);
  } else {
    console.log("No users with Gusto data found.");
  }

  // 3. Cleanse Subcontractors documents
  const subRef = db.collection('subcontractors');
  const subSnap = await subRef.where('organizationId', '==', orgId).get();
  console.log(`\nFound ${subSnap.docs.length} subcontractors under TekAir Inc.`);
  
  const subBatch = db.batch();
  let subsUpdatedCount = 0;
  
  subSnap.docs.forEach(sDoc => {
    const data = sDoc.data();
    const hasGustoData = data.gustoEmployeeId || data.gustoOnboardingUrl || data.gustoOnboardingStatus;
    if (hasGustoData) {
      subBatch.update(sDoc.ref, {
        gustoEmployeeId: FieldValue.delete(),
        gustoOnboardingUrl: FieldValue.delete(),
        gustoOnboardingStatus: FieldValue.delete()
      });
      subsUpdatedCount++;
      console.log(`- Staging Subcontractor: ${data.firstName || ''} ${data.lastName || ''} (${data.email})`);
    }
  });

  if (subsUpdatedCount > 0) {
    await subBatch.commit();
    console.log(`--> Successfully deleted Gusto fields for ${subsUpdatedCount} subcontractors.`);
  } else {
    console.log("No subcontractors with Gusto data found.");
  }

  console.log("\n====================================================");
  console.log("=== CLEANSING COMPLETED SUCCESSFULLY! ===");
  console.log("====================================================");
  process.exit(0);
}

run().catch(e => {
  console.error("Error running cleansing script:", e);
  process.exit(1);
});
