import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: "tektrakker.firebaseapp.com",
  projectId: "tektrakker",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const docRef = doc(db, 'organizations', 'nWYBg3LkmkkQEW7kjstB');
  const snap = await getDoc(docRef);
  console.log(JSON.stringify(snap.data(), null, 2));
  process.exit(0);
}
run();
