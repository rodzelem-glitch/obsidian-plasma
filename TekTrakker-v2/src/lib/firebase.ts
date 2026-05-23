
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
interface CapacitorWindow extends Window {
    Capacitor?: {
        isNativePlatform?: () => boolean;
    };
}

const isNative = !!(window as unknown as CapacitorWindow).Capacitor?.isNativePlatform?.();

if (isNative) {
    db.settings({
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: false
    });
} else {
    // Standard desktop execution (No forced polling required)
}

const auth = firebase.auth();
const functions = firebase.functions();
const storage = firebase.storage();
const app = firebase.app();

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  console.log('Testing Mode: Connecting to Firebase Emulators');
  db.useEmulator('localhost', 8081);
  auth.useEmulator('http://localhost:9099');
  functions.useEmulator('localhost', 5001);
  storage.useEmulator('localhost', 9199);
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
        
        await db.enablePersistence({ synchronizeTabs: true });
    } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === 'failed-precondition') {
            console.warn('Persistence failed: Multiple identical tabs open.');
        } else if (error.code === 'unimplemented') {
            console.warn('Persistence failed: Browser does not support IndexDB.');
        } else {
            console.warn('Firestore Persistence Error:', err);
        }
    }
})();



let messaging: firebase.messaging.Messaging | null = null;
try {
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn('Firebase Messaging not supported:', e);
}

// Mobile Network Reconnection Fix
if (isNative) {
    import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', async ({ isActive }) => {
            if (isActive) {
                console.log("App foregrounded: reconnecting Firestore network to sync stale data.");
                try {
                    await db.enableNetwork();
                } catch (e) {
                    console.warn("Could not enable network:", e);
                }
            } else {
                console.log("App backgrounded: disabling Firestore network to preserve battery and prevent broken sockets.");
                try {
                    await db.disableNetwork();
                } catch (e) {
                    console.warn("Could not disable network:", e);
                }
            }
        });
    }).catch(err => console.warn("Failed to load @capacitor/app", err));
}

export { db, auth, functions, storage, app, messaging, firebase };

