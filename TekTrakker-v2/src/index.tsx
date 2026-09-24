(window as any).appLoaded = true;
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { FranchiseProvider } from './context/FranchiseContext';
import { LanguageProvider } from './context/LanguageContext';
import { TelephonyProvider } from './context/TelephonyContext';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import './styles/index.css';
// Register Capacitor PWA Elements safely
try {
    const definePromise = defineCustomElements(window);
    if (definePromise && definePromise.catch) {
        definePromise.catch(console.error);
    }
} catch (e) {
    console.error("Failed to load PWA elements", e);
}

// UNCONDITIONALLY PURGE ALL SERVICE WORKERS TO PREVENT BACKGROUND INTERRUPTIONS & SPONTANEOUS RELOADS
// The app relies on standard immutable HTTP caching for lightning-fast loads without hijacking active sessions.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister().catch(() => {});
        }
    }).catch(() => {});
}

// --- MOBILE HEIGHT FIX ---
const updateVH = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
};
window.addEventListener('resize', updateVH);
updateVH();

import { isChunkErrorMessage } from './lib/lazyWithRetry';

// --- DYNAMIC CHUNK AUTO-RECOVERY ---
// Detect chunk loading / dynamic import errors caused by new deployments & stale browser sessions
const handleChunkError = (err?: any) => {
    console.warn('[Auto-Recovery] Dynamic chunk mismatch detected. Recovering latest build...', err);
    const storageKey = 'chunk_reload_timestamp';
    const lastReload = sessionStorage.getItem(storageKey);
    const now = Date.now();

    // Prevent infinite reload loop if the network is genuinely down (10s cooldown)
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(storageKey, now.toString());
        const url = new URL(window.location.href);
        url.searchParams.set('v', now.toString());
        window.location.replace(url.toString());
    }
};

// Intercept Vite preload errors and auto-recover to the latest deployed version
window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    handleChunkError(event);
});

// Intercept global script/unhandled rejection errors for stale dynamic imports
window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (isChunkErrorMessage(msg)) {
        event.preventDefault();
        handleChunkError(event.reason);
    }
});

window.addEventListener('error', (event) => {
    const msg = event.message || event.error?.message || '';
    if (isChunkErrorMessage(msg)) {
        handleChunkError(event.error);
    }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// --- EMAIL LINK SAFELINKS HASH STRIPPING FIX ---
// Many enterprise email scanners (Office 365, Barracuda, etc) mangle HashRouter anchors by stripping the `#` 
// and converting them to hard paths. Because this is Firebase Hosting SPA, a hard path like /register 
// hits index.html successfully, but HashRouter won't see it correctly since `window.location.hash` is empty!
const isNativePlatform = typeof window !== 'undefined' && !!((window as any).Capacitor?.isNativePlatform?.());
if (!isNativePlatform && window.location.pathname && window.location.pathname.length > 1 && window.location.pathname !== '/index.html') {
    // We arrived via a hijacked hard link (e.g. /register?view=...)
    // Instantly rewrite the URL to restore the hash fragment and reload so React Router picks it up!
    const recoveredPath = window.location.pathname;
    const recoveredSearch = window.location.search || '';
    window.location.replace('/#' + recoveredPath + recoveredSearch);
}

class GlobalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Global React Crash:", error, errorInfo);
    (window as any).appHasErrors = true;

    if (error?.message && isChunkErrorMessage(error.message)) {
      handleChunkError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkErrorMessage(this.state.error?.message);

      if (isChunk) {
        return (
          <div className="p-5 bg-slate-900 text-white h-screen w-screen overflow-auto flex flex-col items-center justify-center text-center">
            <div className="max-w-md w-full bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500 mx-auto" />
              <h1 className="text-xl font-black text-white">Updating Application...</h1>
              <p className="text-sm text-slate-300">A new build was deployed. Loading the latest version of TekTrakker...</p>
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('v', Date.now().toString());
                  window.location.replace(url.toString());
                }}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                Click here if not redirected automatically
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="p-5 bg-slate-900 text-white h-screen w-screen overflow-auto flex flex-col items-center justify-center text-center">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-4">
            <h1 className="text-xl font-black text-rose-400">Application Notice</h1>
            <p className="text-sm text-slate-300">An unexpected view error occurred. You can safely refresh the view to continue.</p>
            <button
              onClick={() => {
                try {
                  sessionStorage.clear();
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name));
                    });
                  }
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                      for (const reg of regs) reg.unregister().catch(() => {});
                    });
                  }
                } catch (e) {}
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now().toString());
                window.location.replace(url.toString());
              }}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md"
            >
              Refresh View
            </button>
            {this.state.error?.message && (
              <pre className="whitespace-pre-wrap break-words text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-lg text-left max-h-32 overflow-y-auto">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children; 
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <FranchiseProvider>
        <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AppProvider>
            <LanguageProvider>
              <ConfirmProvider>
                <TelephonyProvider>
                  <App />
                </TelephonyProvider>
              </ConfirmProvider>
            </LanguageProvider>
          </AppProvider>
        </HashRouter>
      </FranchiseProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
