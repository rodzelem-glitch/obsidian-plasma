
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/functions';
import 'firebase/compat/storage';
import 'firebase/compat/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tektrakker.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tektrakker",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tektrakker.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "655867451194",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:655867451194:web:3369dc72e1f1c1c849a203",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-0Z6FHX8PGZ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// IMPORTANT: Force long polling specifically on Mobile (Capacitor) to prevent socket freezing/listener delays.
// On desktop web, we want standard highly-optimized WebSocket connection logic.
const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

if (isNative) {
    db.settings({
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: false
    });
} else {
    // Standard desktop execution (No forced polling required)
}

// Activate Physical IndexDB Persistence for Offline Technicians
(async () => {
    try {
        const currentProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
        const cachedProjectId = localStorage.getItem('__tektrakker_fb_project');
        
        if (cachedProjectId && cachedProjectId !== currentProjectId) {
            console.warn("Firebase Project Environment shifted! Clearing local indexedDB cache to prevent socket corruption.");
            try { await db.clearPersistence(); } catch (e) { console.warn("Could not wipe persistence:", e); }
        }
        localStorage.setItem('__tektrakker_fb_project', currentProjectId || '');
        
        await db.enablePersistence();
    } catch (err: any) {
        if (err.code === 'failed-precondition') {
            console.warn('Persistence failed: Multiple identical tabs open.');
        } else if (err.code === 'unimplemented') {
            console.warn('Persistence failed: Browser does not support IndexDB.');
        } else {
            console.warn('Firestore Persistence Error:', err);
        }
    }
})();

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
