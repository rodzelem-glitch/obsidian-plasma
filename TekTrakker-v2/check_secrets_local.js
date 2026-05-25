import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: "tektrakker.firebaseapp.com",
  projectId: "tektrakker",
  storageBucket: "tektrakker.firebasestorage.app",
  messagingSenderId: "655867451194",
  appId: "1:655867451194:web:3369dc72e1f1c1c849a203",
  measurementId: "G-0Z6FHX8PGZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const orgsRef = collection(db, "organizations");
  const snap = await getDocs(orgsRef);
  console.log("Total organizations found:", snap.size);
  
  for (const orgDoc of snap.docs) {
    const orgData = orgDoc.data();
    console.log(`\n--- Organization: ${orgData.name} (ID: ${orgDoc.id}) ---`);
    console.log("Settings:", orgData.settings || "None");
    
    // Check secrets config
    const secretsRef = doc(db, "organizations", orgDoc.id, "secrets", "config");
    try {
      const secretsDoc = await getDoc(secretsRef);
      if (secretsDoc.exists()) {
        const secretsData = secretsDoc.data();
        console.log("RingCentral Secrets Configuration:");
        console.log("  ringCentralClientId:", secretsData.ringCentralClientId);
        console.log("  ringCentralEnvironment:", secretsData.ringCentralEnvironment);
        console.log("  ringCentralJwtToken (masked):", secretsData.ringCentralJwtToken ? secretsData.ringCentralJwtToken.substring(0, 15) + "..." : "None");
        console.log("  rcBackendClientId:", secretsData.rcBackendClientId);
      } else {
        console.log("  No secrets/config document exists for this organization.");
      }
    } catch (e) {
      console.error(`  Error reading secrets for ${orgDoc.id}:`, e.message);
    }
  }
  process.exit(0);
}

run().catch(e => {
  console.error("Error running script:", e);
  process.exit(1);
});
