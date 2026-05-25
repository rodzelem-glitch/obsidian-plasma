(window as any).appLoaded = true;
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { FranchiseProvider } from './context/FranchiseContext';
import { LanguageProvider } from './context/LanguageContext';
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
        let updateSW: any;
        const triggerUpdate = (reload = true) => {
            if (typeof updateSW === 'function') {
                return updateSW(reload);
            } else {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (let r of registrations) {
                        if (r.waiting) {
                            r.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    }
                    if (reload) {
                        setTimeout(() => window.location.reload(), 500);
                    }
                });
            }
        };
        (window as any).updateServiceWorker = triggerUpdate;

        updateSW = registerSW({
            immediate: true,
            onNeedRefresh() {
                console.info('[VitePWA] New service worker available. Notifying user via toast.');
                setTimeout(() => { 
                    window.dispatchEvent(new CustomEvent('app-update-available', { 
                        detail: { updateSW: triggerUpdate } 
                    })); 
                }, 100);
            },
            onRegisteredSW(swUrl, r) {
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
            console.warn('Chunk load error detected. Force clearing service workers and reloading...');
            sessionStorage.setItem(storageKey, now.toString());
            
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (let registration of registrations) {
                        registration.unregister();
                    }
                    window.location.reload();
                }).catch(() => {
                    window.location.reload();
                });
            } else {
                window.location.reload();
            }
        } else {
            document.body.innerHTML = "<div style=\"background: radial-gradient(135deg, #0f172a 0%, #1e1b4b 100%); display: flex; align-items: center; justify-content: center; height: 100vh; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #f8fafc; text-align: center; padding: 20px; box-sizing: border-box; overflow: hidden; margin: 0;\">\n    <div style=\"background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 24px; padding: 40px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); box-sizing: border-box; transition: all 0.3s ease;\">\n        <div style=\"width: 64px; height: 64px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;\">\n            <svg style=\"width: 32px; height: 32px; color: #ef4444;\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"2\">\n                <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z\" />\n            </svg>\n        </div>\n        <h1 style=\"font-size: 24px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.025em; background: linear-gradient(to right, #f8fafc, #cbd5e1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;\">App Update Required</h1>\n        <p style=\"font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 32px;\">A critical update is available, but the browser cache prevents it from loading correctly. Press below to clear cache and reload.</p>\n        <button onclick=\"window.location.reload(true);\" style=\"background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; border: none; padding: 14px 28px; font-size: 14px; font-weight: 700; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4); transition: all 0.2s ease; width: 100%; display: inline-block; box-sizing: border-box;\">Force Reload & Update</button>\n    </div>\n</div>";
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
    (window as any).appHasErrors = true;
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
            <LanguageProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </LanguageProvider>
          </AppProvider>
        </HashRouter>
      </FranchiseProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
