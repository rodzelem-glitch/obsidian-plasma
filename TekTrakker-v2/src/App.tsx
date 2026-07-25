import { cleanUndefinedFields } from './lib/utils';

import React, { useEffect, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { User } from './types';
import { auth } from './lib/firebase';
import { Capacitor } from '@capacitor/core';
import DemoBanner from './components/DemoBanner';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Lazy Loaded Routing Components for Bundle Splitting
const MasterAdminRoutes = lazy(() => import('./navigation/MasterAdminRoutes'));
const SalesRoutes = lazy(() => import('./navigation/SalesRoutes'));
const AdminRoutes = lazy(() => import('./navigation/AdminRoutes'));
const CustomerRoutes = lazy(() => import('./navigation/CustomerRoutes'));
const EmployeeRoutes = lazy(() => import('./navigation/EmployeeRoutes'));
const PublicRoutes = lazy(() => import('./navigation/PublicRoutes'));

import LocationTracker from './components/common/LocationTracker';
import ScrollToTop from './components/common/ScrollToTop';
import { CallListener } from './components/common/CallListener';
import WorkOrderAssociationsModal from './components/modals/WorkOrderAssociationsModal';
import SubcontractorAgreementsGate from './components/auth/SubcontractorAgreementsGate';


const PublicProposal = lazy(() => import('./pages/PublicProposal'));
import PublicProjectProposal from './pages/PublicProjectProposal';
const PublicEquipmentReport = lazy(() => import('./pages/PublicEquipmentReport'));
const ComplianceReport = lazy(() => import('./pages/landing/ComplianceReport'));
const PrivacyPolicy = lazy(() => import('./pages/landing/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/landing/TermsOfService'));
const EULA = lazy(() => import('./pages/landing/EULA'));


// Lazy Load Payment and Marketplace
const CustomerPayment = lazy(() => import('./pages/CustomerPayment'));
const MarketplaceDirectory = lazy(() => import('./pages/marketplace/ProviderDirectory'));
const ProviderProfile = lazy(() => import('./pages/marketplace/ProviderProfile'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));

// Public widgets - serve app data, not marketing
const ReviewsWidget = lazy(() => import('./pages/landing/ReviewsWidget'));
const SubcontractorOnboardingWidget = lazy(() => import('./pages/landing/SubcontractorOnboardingWidget'));

// A simple loading spinner component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Utility to delay background chunk execution until after LCP paint
const BackgroundDelayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shouldRender, setShouldRender] = React.useState(false);
  React.useEffect(() => {
      const t = setTimeout(() => setShouldRender(true), 3500);
      return () => clearTimeout(t);
  }, []);
  return shouldRender ? <>{children}</> : null;
};

const App: React.FC = () => {
  const { state, dispatch, startDemo } = useAppContext();
  const { currentUser: user, isMasterAdmin, loading, isDemoMode } = state;
  const navigate = useNavigate();
  const location = useLocation();

  // Parse demo mode immediately during render. If we wait for useEffect, the <Navigate> fallback 
  // for public routes may redirect to /login and destroy the hash query parameters first.
  const hash = window.location.hash || '';
  const hashQueryIndex = hash.indexOf('?');
  const hashSearch = hashQueryIndex >= 0 ? hash.substring(hashQueryIndex) : '';
  const urlParams = new URLSearchParams(hashSearch || window.location.search);
  const demoRole = urlParams.get('demo');

  useEffect(() => {
    if (demoRole === 'admin' || demoRole === 'employee' || demoRole === 'customer') {
      // Remove demo param from URL to prevent infinite loops on reload
      const cleanHash = hashQueryIndex >= 0 ? hash.substring(0, hashQueryIndex) : hash;
      window.history.replaceState({}, document.title, window.location.pathname + (cleanHash || '#/'));
      startDemo(demoRole as 'admin' | 'employee' | 'customer');
    }
  }, [demoRole, startDemo, hash, hashQueryIndex]);



  const getRedirectPath = useCallback((user: User | null, isMasterAdmin: boolean): string => {
    if (!user) return '/login';
    if ((user.role as string) === 'kort_tester') return '/admin/kort-playground';
    if (isMasterAdmin || user.role === 'franchise_admin') return '/master/dashboard';
    if (user.role === 'platform_sales') return '/sales/dashboard';
    if (user.role === 'admin' || user.role === 'both' || user.role === 'supervisor') return '/admin/dashboard';
    if (user.role === 'customer') {
        if (!user.organizationId || user.organizationId === 'unaffiliated') {
            return '/marketplace';
        }
        return '/portal';
    }
    if (user.role === 'employee' || user.role === 'Subcontractor' || user.role === 'Technician') {
        if (!user.organizationId || user.organizationId === 'unaffiliated') {
            return '/marketplace';
        }
        return '/briefing';
    }
    
    const path = (!user.organizationId || user.organizationId === 'unaffiliated' || !user.role) ? '/marketplace' : '/login';
    return path;
  }, []); // Dependencies for useCallback should be empty if it only uses its arguments, or include external state if needed.

  const userId = user?.id;
  useEffect(() => {
    if (userId && !isDemoMode) {
      import('./lib/pushNotificationService').then(module => {
        module.setupFCMToken(userId);
      });
      // TEMPORARY: Reset master platform logo & color locally based on user request
      if (isMasterAdmin && user?.organizationId) {
          import('./lib/firebase').then(({ db }) => {
              db.collection('organizations').doc(user.organizationId).update(cleanUndefinedFields({
                  logoUrl: null,
                  primaryColor: null
              })).catch(() => {});
          }).catch(() => {});
      }
    }
  }, [userId, isMasterAdmin, isDemoMode]);

  useEffect(() => {
    const applyTheme = async () => {
      if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
        if (Capacitor.isNativePlatform()) {
          try {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            await StatusBar.setStyle({ style: Style.Dark });
            if (Capacitor.getPlatform() === 'android') {
                const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
                await NavigationBar.setNavigationBarColor({ color: '#0f172a', darkButtons: false });
            }
          } catch (e) { console.error(e); }
        }
      } else {
        document.documentElement.classList.remove('dark');
        if (Capacitor.isNativePlatform()) {
          try {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            await StatusBar.setStyle({ style: Style.Light });
            if (Capacitor.getPlatform() === 'android') {
                const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
                await NavigationBar.setNavigationBarColor({ color: '#f8fafc', darkButtons: true });
            }
          } catch (e) { console.error(e); }
        }
      }
    };
    applyTheme();
  }, [state.theme, loading]);

  useEffect(() => {
    if (!loading && Capacitor.isNativePlatform()) {
      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide().catch(console.error);
      });
      // Hide native controls for immersive swipe-to-reveal mode
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        StatusBar.hide().catch(console.error);
      });
      import('@capgo/capacitor-navigation-bar').then(({ NavigationBar }) => {
        // Fallback for NavigationBar since it doesn't support hide()
        NavigationBar.setNavigationBarColor({ color: 'transparent', darkButtons: true }).catch(console.error);
      });
    }
  }, [loading]);

  // Physical Android Webview SafeArea Bypass Hook
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/status-bar').then(({ StatusBar }) => {
         StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      });

      // Using native CSS env variables for safe areas which is strictly preferred with Capacitor 8
      if (Capacitor.getPlatform() === 'android') {
          import('@capacitor/status-bar').then(({ StatusBar }) => {
              StatusBar.getInfo().then(info => {
                  // Always enforce a minimum padding of 32px on Android to clear physical notches 
                  // even if the OS reports the status bar as "hidden" or 0px height.
                  const height = (info && info.height && info.height > 20) ? info.height : 32;
                  document.documentElement.style.setProperty('--sat', `${height}px`);
              }).catch(() => document.documentElement.style.setProperty('--sat', '32px'));
          });
      } else {
          document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)');
      }
      document.documentElement.style.setProperty('--sab', 'env(safe-area-inset-bottom)');

      // Globally Initialize Social Login Native Bridge to prevent iOS "No provider initialized" Error
      import('@capgo/capacitor-social-login').then(({ SocialLogin }) => {
          SocialLogin.initialize({
              google: {
                  webClientId: '655867451194-lsfv2au0832sarq3uor8ch9tj9kmssai.apps.googleusercontent.com',
                  iOSClientId: '655867451194-gk7g5mg1rt145jgpov7utcv9jcqbmn1v.apps.googleusercontent.com'
              }
          }).catch(console.error);
      });

      // RevenueCat SDK Initialization (Cross-Platform)
      if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
          import('@revenuecat/purchases-capacitor').then(({ Purchases, LOG_LEVEL }) => {
              Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
              if (Capacitor.getPlatform() === 'ios') {
                  const iosKey = import.meta.env.VITE_REVENUECAT_IOS_KEY || "appl_XOiJFDxQXCmbEBPbeghEZiWcRbX";
                  if (iosKey) Purchases.configure({ apiKey: iosKey });
              } else if (Capacitor.getPlatform() === 'android') {
                  const androidKey = import.meta.env.VITE_REVENUECAT_ANDROID_KEY;
                  if (androidKey) {
                      Purchases.configure({ apiKey: androidKey });
                  } else {
                      console.warn('RevenueCat Android API Key is missing. In-app purchases will not work.');
                  }
              }
          }).catch(e => console.warn('RevenueCat failed to load:', e));
      }
    }
  }, []);

  useEffect(() => {
    // Capture Google Ads Click ID (GCLID) for attribution
    const urlParams = new URLSearchParams(window.location.search);
    const gclid = urlParams.get('gclid');
    
    if (gclid) {
      localStorage.setItem('tt_gclid', gclid);
      localStorage.setItem('tt_gclid_captured_at', Date.now().toString());
    }
  }, []);

  useEffect(() => {
    const handleAppUpdate = (event: any) => {
      const currentHash = window.location.hash.split('?')[0];
      const isPublicRoute = currentHash.startsWith('#/invoice/') || 
                            currentHash.startsWith('#/proposal-view/') || 
                            currentHash.startsWith('#/project-proposal-view/') || 
                            currentHash.startsWith('#/report/') ||
                            currentHash.startsWith('#/public-upload/') ||
                            currentHash.startsWith('#/unsubscribe') ||
                            currentHash === '#/unsubscribe' ||
                            currentHash === '' ||
                            currentHash === '#/' ||
                            currentHash === '#/homeowners' ||
                            currentHash === '#/ai-worker' ||
                            currentHash === '#/ai-worker-commands' ||
                            currentHash === '#/privacy' ||
                            currentHash === '#/terms' ||
                            currentHash === '#/eula' ||
                            currentHash === '#/faq' ||
                            currentHash === '#/franchise' ||
                            currentHash === '#/franchise-agreement';
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' || 
                          window.location.hostname.startsWith('192.168.') || 
                          window.location.hostname.startsWith('10.');
      
      if (!user || isPublicRoute || isLocalhost || sessionStorage.getItem('dismiss_app_update') === 'true') {
        console.info('[PWA] Suppressing update toast:', currentHash, { hasUser: !!user, isLocalhost });
        return;
      }
      const updateSW = event?.detail?.updateSW || (window as any).updateServiceWorker;
      toast(
        <div className="flex flex-col gap-3 p-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <div className="font-extrabold text-sm text-white tracking-wide">A new version of TekTrakker is available!</div>
          </div>
          <div className="text-[12px] text-slate-200 leading-relaxed font-medium">An update is required to keep all real-time field tracking and integrations synchronized.</div>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.dismiss('app-update-toast');
                if (typeof updateSW === 'function') {
                  try {
                    console.log('Invoking updateSW...');
                    updateSW(true);
                  } catch (err) {
                    console.error('Error invoking updateSW:', err);
                    window.location.reload();
                  }
                } else {
                  window.location.reload();
                }
              }}
              className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-95 cursor-pointer"
            >
              Update Now
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                sessionStorage.setItem('dismiss_app_update', 'true');
                toast.dismiss('app-update-toast');
              }}
              className="px-5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-600/50 active:scale-95 cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>,
        {
          position: 'bottom-center',
          autoClose: false,
          toastId: 'app-update-toast',
          closeButton: false,
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15)',
            color: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '420px',
          }
        }
      );
    };
    window.addEventListener('app-update-available', handleAppUpdate as any);
    return () => window.removeEventListener('app-update-available', handleAppUpdate as any);
  }, [user]);

  const handleLogout = () => {
    localStorage.setItem('just_logged_out', 'true');
    auth.signOut();
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  useEffect(() => {
    if (!loading && !demoRole) {
      (window as any).appLoaded = true;
    }
  }, [loading, demoRole]);

  console.log("[App-Debug] Render state - loading:", loading, "user:", user?.email, "demoRole:", demoRole, "hash:", window.location.hash);

  if (loading || demoRole) {
    const currentHash = window.location.hash.split('?')[0].replace('#', '') || '/';
    const publicPaths = ['/', '/offer', '/pro', '/pro/apex', '/compliance-view', '/privacy', '/terms', '/eula', '/franchise', '/franchise-agreement', '/ai-worker', '/ai-worker-commands', '/homeowners', '/faq'];
    // Allow public marketing pages to instantly render the First Contentful Paint without waiting for Firebase Auth handshakes!
    // However, if we are initializing a demo session, we must block the UI and show the loading spinner to prevent 
    // the unauthenticated route from triggering a Navigate to /login before the demo context is built.
    if (!publicPaths.includes(currentHash) || demoRole) {
      return <LoadingSpinner />;
    }
  }

  // Set loaded for public routes that bypass the spinner
  if (!loading && !demoRole) {
      (window as any).appLoaded = true;
  }

  const isEmployeeOnly = user && (user.role === 'employee' || user.role === 'Technician' || user.role === 'Subcontractor');
  if (isEmployeeOnly && location.pathname.startsWith('/admin/training')) {
    return <Navigate to={`/briefing/training${location.search}`} replace />;
  }


  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover
        theme={state.theme === 'dark' ? 'dark' : 'light'}
        toastClassName="!rounded-xl !shadow-lg !text-sm !font-medium"
        limit={3}
      />
      <DemoBanner />
      <LocationTracker />
      <BackgroundDelayer>
        <CallListener />
      </BackgroundDelayer>
      
      <div className="safe-area-wrapper min-h-screen w-full flex flex-col">
        <ScrollToTop />
        <WorkOrderAssociationsModal
          isOpen={!!state.viewingWorkOrderNumber}
          onClose={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: null, customerId: null } })}
          workOrderNumber={state.viewingWorkOrderNumber}
          customerId={state.viewingWorkOrderCustomerId}
        />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={user ? <Navigate to={getRedirectPath(user, isMasterAdmin)} replace /> : <Navigate to="/login" replace />} />

            {/* Marketplace routes - available to all users */}
            <Route path="/marketplace" element={<MarketplaceDirectory />} />
            <Route path="/marketplace/:orgId" element={<ProviderProfile />} />
            {/* Franchise pages live on tektrakker.com - redirect there */}
            <Route path="/franchise" element={<Navigate to="https://tektrakker.com/franchise" replace />} />

            {/* Public Document Viewing (Available to guests and authenticated users) */}
            <Route path="/invoice/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/proposal-view/:proposalId" element={<PublicProjectProposal />} />
            <Route path="/project-proposal-view/:proposalId" element={<PublicProjectProposal />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/report/equipment/:customerId" element={<PublicEquipmentReport />} />

            {/* Standalone Legal & Verification Documents */}
            <Route path="/compliance-view" element={<ComplianceReport />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/eula" element={<EULA />} />

            {/* Public widgets */}
            <Route path="/widgets/reviews/:orgId" element={<ReviewsWidget />} />
            <Route path="/widgets/subcontractor-setup/:orgId" element={<SubcontractorOnboardingWidget />} />
            <Route path="/widgets/subcontractor-onboarding/:orgId" element={<SubcontractorOnboardingWidget />} />

            {user ? (
              <>
                {/* Logged In User Routes */}
                <Route path="/master/*" element={<MasterAdminRoutes user={user} handleLogout={handleLogout} />} />
                <Route path="/sales/*" element={<SalesRoutes user={user} handleLogout={handleLogout} />} />
                <Route path="/admin/*" element={<AdminRoutes user={user} handleLogout={handleLogout} isDemoMode={isDemoMode} />} />
                <Route path="/portal/*" element={<CustomerRoutes user={user} handleLogout={handleLogout} />} />
                <Route path="/briefing/*" element={
                  <SubcontractorAgreementsGate user={user}>
                    <EmployeeRoutes user={user} handleLogout={handleLogout} isDemoMode={isDemoMode} getRedirectPath={() => getRedirectPath(user, isMasterAdmin)} />
                  </SubcontractorAgreementsGate>
                } />
                
                {/* Fallback for any other authenticated route - might redirect to a default page or show a 404 within the user's layout */}
                <Route path="*" element={<Navigate to={getRedirectPath(user, isMasterAdmin)} replace />} />
              </>
            ) : (
              /* Public Routes - Only accessible when not logged in */
              <Route path="/*" element={<PublicRoutes user={user} getRedirectPath={() => getRedirectPath(user, isMasterAdmin)} />} />
            )}
          </Routes>
        </Suspense>
      </div>
    </>
  );
};

export default App;
