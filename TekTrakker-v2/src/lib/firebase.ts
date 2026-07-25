
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

interface CapacitorWindow extends Window {
    Capacitor?: {
        isNativePlatform?: () => boolean;
    };
}

const isNative = !!(window as unknown as CapacitorWindow).Capacitor?.isNativePlatform?.();

// Force long polling globally to prevent connection freezing, proxy/VPN blocks, and QUIC protocol write errors (e.g., ERR_QUIC_PROTOCOL_ERROR).
db.settings({
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false
});

const auth = firebase.auth();
const functions = firebase.functions();
const storage = firebase.storage();
const app = firebase.app();

const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname === '[::1]';

const shouldConnectEmulator = isNative ? import.meta.env.DEV : isLocalhost;
const isEmulatorMode = import.meta.env.VITE_USE_EMULATOR === 'true' && shouldConnectEmulator;

if (isEmulatorMode) {
  console.log('Testing Mode: Connecting to Firebase Emulators');
  db.useEmulator('127.0.0.1', 8081);
  auth.useEmulator('http://127.0.0.1:9099');
  functions.useEmulator('127.0.0.1', 5001);
  storage.useEmulator('127.0.0.1', 9199);
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
        
        if (isNative) {
            await db.enablePersistence();
        } else {
            try {
                await db.enablePersistence({ synchronizeTabs: true });
            } catch (err: any) {
                if (err.code === 'failed-precondition') {
                    console.warn('Persistence failed: Multiple identical tabs open.');
                } else {
                    await db.enablePersistence();
                }
            }
        }
    } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === 'unimplemented') {
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
    import(/* @vite-ignore */ '@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', async ({ isActive }) => {
            if (isActive) {
                console.log("App foregrounded: reconnecting Firestore network to sync stale data.");
                try {
                    await db.enableNetwork();
                } catch (e) {
                    console.warn("Could not enable network:", e);
                }
            }
        });
    }).catch(err => console.warn("Failed to load @capacitor/app", err));
}

export { db, auth, functions, storage, app, messaging, firebase, isEmulatorMode };


