
import { initializeApp, getApps } from 'firebase/app';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: "tektrakker.firebaseapp.com",
  projectId: "tektrakker",
  storageBucket: "tektrakker.firebasestorage.app",
  messagingSenderId: "655867451194",
  appId: "1:655867451194:web:3369dc72e1f1c1c849a203",
  measurementId: "G-0Z6FHX8PGZ"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const functions = getFunctions(app);

export { app, functions };
