import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";


try {
  const envContent = fs.readFileSync(".env", "utf-8");
  const extracted = {};
  envContent.split("\n").forEach(line => {
      const match = line.match(/^VITE_FIREBASE_([A-Z0-9_]+)="?(.*?)"?\r?$/);
      if (match) extracted[match[1]] = match[2].trim();
  });
  
  const FIREBASE_CONFIG = {
    apiKey: extracted.API_KEY,
    authDomain: extracted.AUTH_DOMAIN,
    projectId: extracted.PROJECT_ID,
    storageBucket: extracted.STORAGE_BUCKET,
    messagingSenderId: extracted.MESSAGING_SENDER_ID,
    appId: extracted.APP_ID,
  };

  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);

  async function check() {
    const orgsRef = collection(db, "organizations");
    const q = query(orgsRef);
    const snap = await getDocs(q);
    console.log("Total orgs:", snap.size);
    snap.forEach(doc => {
       const data = doc.data();
       if (data.name && data.name.toLowerCase().includes("tekair")) {
           console.log("FOUND TEKAIR:", data.name, "ID:", doc.id);
           console.log("logoUrl:", data.logoUrl);
           console.log("publicLogoUrl:", data.settings?.publicLogoUrl);
       }
    });
    process.exit(0);
  }

  check().catch(e => { console.log("Error", e); process.exit(1); });

} catch(e) {
  console.log("Error parsing env", e);
  process.exit(1);
}
