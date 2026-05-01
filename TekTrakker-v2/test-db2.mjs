import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: "tektrakker.firebaseapp.com",
  projectId: "tektrakker",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Connecting to:", firebaseConfig.projectId);
  const snap = await getDocs(collection(db, 'organizations'));
  console.log('Total Organizations:', snap.docs.length);
  snap.docs.forEach(d => console.log(d.id, '->', d.data().name, d.data().createdAt?.seconds || d.data().createdAt));
  process.exit(0);
}
run();
