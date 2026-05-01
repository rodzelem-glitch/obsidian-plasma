
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/functions';
import 'firebase/compat/storage';
import 'firebase/compat/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// Activate Physical IndexDB Persistence for Offline Technicians
db.enablePersistence().catch((err: any) => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistence failed: Multiple identical tabs open.');
    } else if (err.code === 'unimplemented') {
        console.warn('Persistence failed: Browser does not support IndexDB.');
    } else {
        console.warn('Firestore Persistence Error:', err);
    }
});

const auth = firebase.auth();
const functions = firebase.functions();
const storage = firebase.storage();
const app = firebase.app();

let messaging: firebase.messaging.Messaging | null = null;
try {
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn('Firebase Messaging not supported:', e);
}

export { db, auth, functions, storage, app, messaging, firebase };
