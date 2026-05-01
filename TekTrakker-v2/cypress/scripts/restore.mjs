import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: "tektrakker.firebaseapp.com",
  projectId: "tektrakker",
  storageBucket: "tektrakker.firebasestorage.app",
  messagingSenderId: "655867451194",
  appId: "1:655867451194:web:3369dc72e1f1c1c849a203"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
      console.log('Authenticating...');
      await signInWithEmailAndPassword(auth, 'cypress-admin@tektrakker.com', 'password123');
      console.log('Restoring master_admin_org...');
      await updateDoc(doc(db, "organizations", "master_admin_org"), {
          subscriptionStatus: "active"
      });
      console.log('Success.');
  } catch (e) {
      console.error(e);
      process.exit(1);
  }
  process.exit(0);
}

run();
