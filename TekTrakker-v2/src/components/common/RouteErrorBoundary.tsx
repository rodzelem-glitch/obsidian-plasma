import React, { Component, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isChunkErrorMessage } from '../../lib/lazyWithRetry';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  resetOnLocationChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class InnerErrorBoundary extends Component<Props & { locationKey: string }, State> {
  constructor(props: Props & { locationKey: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RouteErrorBoundary] Caught route crash:', error, errorInfo);

    // If this is a chunk load error caused by a new build deployment, auto-recover seamlessly
    if (isChunkErrorMessage(error?.message)) {
      const storageKey = 'route_error_reload_ts';
      const last = sessionStorage.getItem(storageKey);
      const now = Date.now();

      if (!last || now - parseInt(last, 10) > 10000) {
        sessionStorage.setItem(storageKey, now.toString());
        const url = new URL(window.location.href);
        url.searchParams.set('v', now.toString());
        window.location.replace(url.toString());
      }
    }
  }

  componentDidUpdate(prevProps: Props & { locationKey: string }) {
    // Automatically clear error when the user switches to a different route/page
    if (this.state.hasError && prevProps.locationKey !== this.props.locationKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.replace(url.toString());
  };

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkErrorMessage(this.state.error?.message);

      return (
        <div className="w-full min-h-[380px] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800/40 shadow-sm">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {isChunk ? 'New Version Available' : (this.props.fallbackTitle || 'View Temporarily Unavailable')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {isChunk
                  ? 'A new system update was just deployed. Click below to load the latest version seamlessly.'
                  : 'An error occurred while loading this view. You can retry, or choose another section from the navigation menu.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleRetry}
                className="w-full sm:flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>

              <button
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Reload Page</span>
              </button>
            </div>

            {this.state.error?.message && !isChunk && (
              <details className="text-left pt-2">
                <summary className="text-[11px] font-semibold text-slate-400 hover:text-slate-300 cursor-pointer select-none">
                  Technical Details
                </summary>
                <pre className="mt-2 p-3 bg-slate-950/80 rounded-lg text-[10px] text-rose-300 font-mono overflow-x-auto max-h-28 whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const RouteErrorBoundary: React.FC<Props> = (props) => {
  const location = useLocation();
  const locationKey = `${location.pathname}${location.search}`;

  return <InnerErrorBoundary {...props} locationKey={locationKey} />;
};

export default RouteErrorBoundary;
