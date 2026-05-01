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
  const users = [
    'rodzelem@gmail.com', 'HJzF14p8QnfaTsnJ8ZulGvJAR5D3', 
    'nWYBg3LkmkkQEW7kjstB', 'platform' // Check various probable IDs
  ];
  
  for (let id of users) {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) {
          console.log(`FOUND ${id}: role=${snap.data().role}, orgId=${snap.data().organizationId}`);
      }
  }
  process.exit(0);
}
run();
