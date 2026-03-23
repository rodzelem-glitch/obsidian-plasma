import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import './styles/index.css';

// Register Capacitor PWA Elements
defineCustomElements(window);

// --- MOBILE HEIGHT FIX ---
const updateVH = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
};
window.addEventListener('resize', updateVH);
updateVH();

// --- VERSION UPDATE HANDLER ---
window.addEventListener('error', (event) => {
  const msg = event.message?.toLowerCase() || '';
  const isChunkError = 
    msg.includes('loading chunk') || 
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module');

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
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AppProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AppProvider>
    </HashRouter>
  </React.StrictMode>
);