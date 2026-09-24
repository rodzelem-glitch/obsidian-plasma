import { cleanUndefinedFields } from './lib/utils';

import React, { useEffect, Suspense, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { User } from './types';
import { auth } from './lib/firebase';
import { Capacitor } from '@capacitor/core';
import DemoBanner from './components/DemoBanner';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { lazyWithRetry } from './lib/lazyWithRetry';

// Lazy Loaded Routing Components with auto-retry and cache-busting self-healing
const MasterAdminRoutes = lazyWithRetry(() => import('./navigation/MasterAdminRoutes'));
const SalesRoutes = lazyWithRetry(() => import('./navigation/SalesRoutes'));
const AdminRoutes = lazyWithRetry(() => import('./navigation/AdminRoutes'));
const CustomerRoutes = lazyWithRetry(() => import('./navigation/CustomerRoutes'));
const EmployeeRoutes = lazyWithRetry(() => import('./navigation/EmployeeRoutes'));
const PublicRoutes = lazyWithRetry(() => import('./navigation/PublicRoutes'));

import LocationTracker from './components/common/LocationTracker';
import ScrollToTop from './components/common/ScrollToTop';
import { CallListener } from './components/common/CallListener';
import { ActiveCallBar } from './components/common/ActiveCallBar';
import WorkOrderAssociationsModal from './components/modals/WorkOrderAssociationsModal';
import SubcontractorAgreementsGate from './components/auth/SubcontractorAgreementsGate';
import { resolveUserRedirectPath, setActiveView, type ActiveViewMode } from './lib/viewState';


const PublicProposal = lazyWithRetry(() => import('./pages/PublicProposal'));
const PublicProjectProposal = lazyWithRetry(() => import('./pages/PublicProjectProposal'));
const PublicEquipmentReport = lazyWithRetry(() => import('./pages/PublicEquipmentReport'));
const PublicServiceReport = lazyWithRetry(() => import('./pages/PublicServiceReport'));
const PublicTechFormFill = lazyWithRetry(() => import('./pages/PublicTechFormFill'));
const ComplianceReport = lazyWithRetry(() => import('./pages/landing/ComplianceReport'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/landing/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('./pages/landing/TermsOfService'));
const EULA = lazyWithRetry(() => import('./pages/landing/EULA'));


// Lazy Load Payment and Marketplace
const CustomerPayment = lazyWithRetry(() => import('./pages/CustomerPayment'));
const MarketplaceDirectory = lazyWithRetry(() => import('./pages/marketplace/ProviderDirectory'));
const ProviderProfile = lazyWithRetry(() => import('./pages/marketplace/ProviderProfile'));
const Unsubscribe = lazyWithRetry(() => import('./pages/Unsubscribe'));

// Public widgets - serve app data, not marketing
const ReviewsWidget = lazyWithRetry(() => import('./pages/landing/ReviewsWidget'));
const SubcontractorOnboardingWidget = lazyWithRetry(() => import('./pages/landing/SubcontractorOnboardingWidget'));
const PublicAwardWidget = lazyWithRetry(() => import('./pages/public/PublicAwardWidget'));
const PublicMultiAwardWidget = lazyWithRetry(() => import('./pages/public/PublicMultiAwardWidget'));
const PublicAwardVerification = lazyWithRetry(() => import('./pages/public/PublicAwardVerification'));

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
    return resolveUserRedirectPath(user, isMasterAdmin);
  }, []);

  const userId = user?.id;

  // Automatically track and synchronize the user's active view mode across navigations
  const lastActiveViewRef = useRef<ActiveViewMode | null>(null);

  useEffect(() => {
    if (!userId || isDemoMode) return;
    const path = location.pathname;
    let targetView: ActiveViewMode | null = null;
    if (path.startsWith('/briefing')) {
      targetView = 'tech';
    } else if (path.startsWith('/admin')) {
      // Do not overwrite Master Admin's default view to 'admin' when inspecting tenant admin routes
      if (!isMasterAdmin && user?.role !== 'master_admin') {
        targetView = 'admin';
      }
    } else if (path.startsWith('/master')) {
      targetView = 'master';
    } else if (path.startsWith('/sales')) {
      targetView = 'sales';
    } else if (path.startsWith('/portal')) {
      targetView = 'customer';
    }

    if (targetView && targetView !== lastActiveViewRef.current) {
      lastActiveViewRef.current = targetView;
      setActiveView(targetView, userId);
    }
  }, [location.pathname, userId, isDemoMode, isMasterAdmin, user?.role]);

  useEffect(() => {
    if (userId && !isDemoMode) {
      import('./lib/pushNotificationService').then(module => {
        module.setupFCMToken(userId);
      });
    }
  }, [userId, isDemoMode]);

  useEffect(() => {
    const applyTheme = async () => {
      if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
        if (Capacitor.isNativePlatform()) {
          try {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            await StatusBar.show().catch(() => {});
            await StatusBar.setStyle({ style: Style.Dark });
            if (Capacitor.getPlatform() === 'android') {
                await StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
                const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
                await NavigationBar.setNavigationBarColor({ color: '#0f172a', darkButtons: false }).catch(() => {});
            }
          } catch (e) { console.error(e); }
        }
      } else {
        document.documentElement.classList.remove('dark');
        if (Capacitor.isNativePlatform()) {
          try {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            await StatusBar.show().catch(() => {});
            await StatusBar.setStyle({ style: Style.Light });
            if (Capacitor.getPlatform() === 'android') {
                await StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {});
                const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
                await NavigationBar.setNavigationBarColor({ color: '#f8fafc', darkButtons: true }).catch(() => {});
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
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        StatusBar.show().catch(console.error);
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
    const publicPrefixes = [
      '/', '/offer', '/pro', '/compliance-view', '/privacy', '/terms', '/eula', 
      '/franchise', '/franchise-agreement', '/ai-worker', '/ai-worker-commands', '/homeowners', '/faq',
      '/invoice', '/pay', '/deposit', '/proposal-view', '/project-proposal-view', '/proposal', 
      '/public-proposal', '/service-report', '/report', '/tech-form', '/public-upload', '/widgets', 
      '/site', '/p', '/awards', '/careers', '/book', '/asset', '/equipment', '/register', '/login', '/unsubscribe'
    ];
    const isPublicRoute = publicPrefixes.some(p => currentHash === p || currentHash.startsWith(p + '/'));
    // Allow public marketing & document viewing pages to instantly render the First Contentful Paint without waiting for Firebase Auth handshakes!
    // However, if we are initializing a demo session, we must block the UI and show the loading spinner to prevent 
    // the unauthenticated route from triggering a Navigate to /login before the demo context is built.
    if (!isPublicRoute || demoRole) {
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
        style={{ zIndex: 999999 }}
      />
      <DemoBanner />
      <LocationTracker />
      <ActiveCallBar />
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
            <Route path="/invoice/:id" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/pay/:paymentRequestId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/pay/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/pay/:id" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/deposit/:paymentRequestId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/deposit/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/deposit/:id" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/proposal-view/:proposalId" element={<PublicProjectProposal />} />
            <Route path="/project-proposal-view/:proposalId" element={<PublicProjectProposal />} />
            <Route path="/proposal/:proposalId" element={<PublicProjectProposal />} />
            <Route path="/public-proposal/:proposalId" element={<PublicProjectProposal />} />
            <Route path="/proposal" element={user ? <Navigate to={(user.role === 'employee' || user.role === 'Technician' || user.role === 'Subcontractor') ? '/briefing/proposal' : '/admin/proposal'} replace /> : <Navigate to="/login" replace />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/service-report" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <PublicServiceReport />
                </Suspense>
            } />
            <Route path="/service-report/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <PublicServiceReport />
                </Suspense>
            } />
            <Route path="/service-report/:id" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <PublicServiceReport />
                </Suspense>
            } />
            <Route path="/report/service/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <PublicServiceReport />
                </Suspense>
            } />
            <Route path="/report" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <PublicServiceReport />
                </Suspense>
            } />
            <Route path="/report/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <PublicServiceReport />
                </Suspense>
            } />
            <Route path="/report/equipment/:customerId" element={<PublicEquipmentReport />} />
            <Route path="/asset/:customerId" element={<PublicEquipmentReport />} />
            <Route path="/equipment/:customerId" element={<PublicEquipmentReport />} />
            <Route path="/tech-form/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <PublicTechFormFill />
                </Suspense>
            } />

            {/* Standalone Legal & Verification Documents */}
            <Route path="/compliance-view" element={<ComplianceReport />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/eula" element={<EULA />} />

            {/* Public widgets */}
            <Route path="/widgets/reviews/:orgId" element={<ReviewsWidget />} />
            <Route path="/widgets/award/:awardId" element={
                <Suspense fallback={<div className="bg-transparent flex items-center justify-center p-4">Loading Badge...</div>}>
                    <PublicAwardWidget />
                </Suspense>
            } />
            <Route path="/widgets/awards/:orgId" element={
                <Suspense fallback={<div className="bg-transparent flex items-center justify-center p-4">Loading Awards Showcase...</div>}>
                    <PublicMultiAwardWidget />
                </Suspense>
            } />
            <Route path="/awards/verify" element={
                <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950 text-white">Verifying Award...</div>}>
                    <PublicAwardVerification />
                </Suspense>
            } />
            <Route path="/awards/verify/:awardId" element={
                <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950 text-white">Verifying Award...</div>}>
                    <PublicAwardVerification />
                </Suspense>
            } />
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
