import React from 'react';

/**
 * Checks whether an error message is caused by a missing chunk / stale dynamic import.
 * This happens when a new version of the app has been deployed and old hashed asset files
 * have been replaced on the hosting server.
 */
export const isChunkErrorMessage = (msg?: any): boolean => {
  const lower = String(msg?.message || msg || '').toLowerCase();
  return (
    lower.includes('loading chunk') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('error loading dynamically imported module') ||
    lower.includes('expected a javascript-or-wasm module script') ||
    lower.includes('failed to load module script') ||
    lower.includes('strict mime type checking') ||
    lower.includes('unsupported mime type') ||
    lower.includes("reading 'default'") ||
    lower.includes('reading "default"')
  );
};

/**
 * Wraps a dynamic import in an auto-retry promise.
 * If the module fails to load due to network hiccups, it retries up to `maxRetries` times.
 * If the failure is due to a stale chunk mismatch from a new deployment, it automatically
 * performs a seamless location replace with a cache-buster timestamp to self-heal without
 * crashing the user's active session or requiring manual refresh clicks.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  maxRetries = 2,
  intervalMs = 800
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const execute = (retriesLeft: number) => {
        factory()
          .then(resolve)
          .catch((error) => {
            const isChunkErr = isChunkErrorMessage(error);

            if (retriesLeft > 0) {
              console.warn(
                `[lazyWithRetry] Dynamic import failed (${retriesLeft} retries left). Retrying in ${intervalMs}ms...`,
                error
              );
              setTimeout(() => execute(retriesLeft - 1), intervalMs);
              return;
            }

            if (isChunkErr && typeof window !== 'undefined') {
              console.warn('[lazyWithRetry] Stale chunk mismatch detected. Auto-healing with latest build...', error);
              const storageKey = 'lazy_chunk_reload_ts';
              const lastReload = sessionStorage.getItem(storageKey);
              const now = Date.now();

              // Prevent infinite reload loops if server is genuinely unreachable (10s threshold)
              if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                sessionStorage.setItem(storageKey, now.toString());
                const url = new URL(window.location.href);
                url.searchParams.set('v', now.toString());
                window.location.replace(url.toString());
                return;
              }
            }

            reject(error);
          });
      };

      execute(maxRetries);
    })
  );
}

/**
 * Preload a lazy component in idle time so that switching to that view is instant
 * and doesn't depend on network fetching when the user clicks the link.
 */
export function preloadModule(factory: () => Promise<any>): void {
  if (typeof window === 'undefined') return;

  const run = () => {
    try {
      factory().catch((err) => {
        // Preload failures can be safely ignored; will retry on actual navigation
        console.debug('[preloadModule] Idle preload deferred:', err?.message || err);
      });
    } catch (e) {
      // Ignore
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 2000);
  }
}
