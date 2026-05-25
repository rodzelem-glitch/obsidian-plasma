import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tektrakker'
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function run() {
  const orgId = "org-1765817997819";
  
  console.log("=== CLEANSING GUSTO INTEGRATION FOR TEKAIR INC. ===");

  // 1. Cleanse Organization document
  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();
  if (orgSnap.exists) {
    console.log("Found TekAir Inc organization document. Deleting Gusto keys...");
    await orgRef.update({
      gustoAccessToken: FieldValue.delete(),
      gustoCompanyId: FieldValue.delete(),
      gustoCompanyUuid: FieldValue.delete(),
      gustoOnboardingUrl: FieldValue.delete(),
      gustoRefreshToken: FieldValue.delete()
    });
    console.log("Organization-level Gusto keys deleted successfully.");
  } else {
    console.log("TekAir Inc organization document not found!");
  }

  // 2. Cleanse Users documents
  const usersRef = db.collection('users');
  const usersSnap = await usersRef.where('organizationId', '==', orgId).get();
  console.log(`Found ${usersSnap.docs.length} users under TekAir Inc. Cleanse in progress...`);
  
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
      console.log(`- Staged User: ${data.firstName || ''} ${data.lastName || ''} (${data.email})`);
    }
  });

  if (usersUpdatedCount > 0) {
    await userBatch.commit();
    console.log(`Successfully updated ${usersUpdatedCount} users' Gusto fields.`);
  } else {
    console.log("No users with Gusto data found.");
  }

  // 3. Cleanse Subcontractors documents
  const subRef = db.collection('subcontractors');
  const subSnap = await subRef.where('organizationId', '==', orgId).get();
  console.log(`Found ${subSnap.docs.length} subcontractors under TekAir Inc. Cleanse in progress...`);
  
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
      console.log(`- Staged Subcontractor: ${data.firstName || ''} ${data.lastName || ''} (${data.email})`);
    }
  });

  if (subsUpdatedCount > 0) {
    await subBatch.commit();
    console.log(`Successfully updated ${subsUpdatedCount} subcontractors' Gusto fields.`);
  } else {
    console.log("No subcontractors with Gusto data found.");
  }

  console.log("\n=== CLEANSING COMPLETED SUCCESSFULLY! ===");
  process.exit(0);
}

run().catch(e => {
  console.error("Error running cleansing script:", e);
  process.exit(1);
});
