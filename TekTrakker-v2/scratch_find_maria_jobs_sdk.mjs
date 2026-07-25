import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: "tektrakker.firebaseapp.com",
  projectId: "tektrakker",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8081);

async function main() {
    const jobIds = ['JOB-1784508990760', 'JOB-1784507647719'];
    
    console.log("=== JOBS ===");
    for (const jobId of jobIds) {
        const jobRef = doc(db, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);
        if (jobSnap.exists()) {
            console.log(`Job: ${jobId}`);
            console.log(JSON.stringify(jobSnap.data(), null, 2));
        } else {
            console.log(`Job: ${jobId} NOT FOUND`);
        }
    }

    console.log("\n=== AUDIT LOGS ===");
    const auditSnap = await getDocs(collection(db, 'auditLogs'));
    console.log(`Total audit logs: ${auditSnap.docs.length}`);
    auditSnap.docs.forEach(d => {
        const data = d.data();
        const dataStr = JSON.stringify(data);
        if (dataStr.includes('JOB-1784508990760') || dataStr.includes('JOB-1784507647719') || dataStr.includes('Maria Fuentes') || dataStr.includes('1402 Paso Hondo')) {
            console.log(`Audit Log ID: ${d.id}`);
            console.log(JSON.stringify(data, null, 2));
        }
    });
}

main().then(() => process.exit(0)).catch(console.error);
