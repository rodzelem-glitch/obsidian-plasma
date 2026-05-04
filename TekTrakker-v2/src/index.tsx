import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { FranchiseProvider } from './context/FranchiseContext';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Capacitor PWA Elements safely
try {
    const definePromise = defineCustomElements(window);
    if (definePromise && definePromise.catch) {
        definePromise.catch(console.error);
    }
} catch (e) {
    console.error("Failed to load PWA elements", e);
}

// FORCIBLY PURGE PWA SERVICE WORKERS DURING LOCAL DEV OR ON CAPACITOR NATIVE
// Prevents local caching loops where the browser ignores npm run dev updates, and prevents WKWebView issues.
if ('serviceWorker' in navigator) {
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.isNativePlatform();
    
    if (import.meta.env.DEV || isNative) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
                console.warn('[VitePWA] Forcefully unregistered service-worker for dev/native platform.');
            }
        });
    } else {
        // Register it manually for production web users
        const updateSW = registerSW({
            immediate: true,
            onNeedRefresh() {
                // Automatically activate the new service worker and reload the page
                // This ensures the user NEVER gets stuck on an old cached version
                updateSW(true);
            },
            onRegisteredSW(swUrl, r) {
                // Periodically check for updates (every hour)
                if (r) {
                    setInterval(() => {
                        r.update();
                    }, 60 * 60 * 1000);
                }
            }
        });
    }
}

// --- MOBILE HEIGHT FIX ---
const updateVH = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
};
window.addEventListener('resize', updateVH);
updateVH();

// --- VERSION UPDATE HANDLER ---
const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
    let msg = '';
    if (event instanceof ErrorEvent) {
        msg = event.message?.toLowerCase() || '';
    } else if (event instanceof PromiseRejectionEvent) {
        msg = event.reason?.message?.toLowerCase() || event.reason?.toString()?.toLowerCase() || '';
    }

    const isChunkError = 
        msg.includes('loading chunk') || 
        msg.includes('importing a module script failed') ||
        msg.includes('dynamically imported module') ||
        msg.includes('expected a javascript-or-wasm module script');

    if (isChunkError) {
        const storageKey = 'version_reload_timestamp';
        const lastReload = sessionStorage.getItem(storageKey);
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload) > 10000) {
            console.warn('Chunk load error detected. Reloading for new version...');
            sessionStorage.setItem(storageKey, now.toString());
            window.location.reload();
        }
    }
};

window.addEventListener('error', handleChunkError);
window.addEventListener('unhandledrejection', handleChunkError);

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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-5 bg-white text-gray-800 h-screen w-screen overflow-auto flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-2.5 text-red-600">Something went wrong.</h1>
          <p className="text-base mb-5 text-gray-700">Please close the app and try again.</p>
          <pre className="whitespace-pre-wrap break-words text-xs text-black bg-slate-100 p-4 rounded max-w-[80%]">
             {this.state.error?.name}: {this.state.error?.message}
          </pre>
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
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </AppProvider>
        </HashRouter>
      </FranchiseProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
