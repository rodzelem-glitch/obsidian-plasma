
import React, { useEffect, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { User } from './types';
import { auth } from './lib/firebase';
import PWAInstallPrompt from './components/ui/PWAInstallPrompt';
import { Capacitor } from '@capacitor/core';
import DemoBanner from './components/DemoBanner';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Lazy Loaded Routing Components for Bundle Splitting
const MasterAdminRoutes = lazy(() => import('./navigation/MasterAdminRoutes'));
const SalesRoutes = lazy(() => import('./navigation/SalesRoutes'));
const AdminRoutes = lazy(() => import('./navigation/AdminRoutes'));
const CustomerRoutes = lazy(() => import('./navigation/CustomerRoutes'));
const EmployeeRoutes = lazy(() => import('./navigation/EmployeeRoutes'));
const PublicRoutes = lazy(() => import('./navigation/PublicRoutes'));
import SaaSMarketing from './pages/landing/SaaSMarketing';
import LocationTracker from './components/common/LocationTracker';
import ScrollToTop from './components/common/ScrollToTop';

const FieldProposal = lazy(() => import('./pages/FieldProposal'));
const PublicProposal = lazy(() => import('./pages/PublicProposal'));
const PublicEquipmentReport = lazy(() => import('./pages/PublicEquipmentReport'));
const FranchiseOpportunities = lazy(() => import('./pages/landing/FranchiseOpportunities'));
const FranchiseAgreementDoc = lazy(() => import('./pages/landing/FranchiseAgreementDoc'));
const ComplianceReport = lazy(() => import('./pages/landing/ComplianceReport'));
const PrivacyPolicy = lazy(() => import('./pages/landing/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/landing/TermsOfService'));
const EULA = lazy(() => import('./pages/landing/EULA'));
import { LiveSupportFloatingButton } from './components/common/LiveSupportComponent';

// Lazy Load Payment and Marketplace
const CustomerPayment = lazy(() => import('./pages/CustomerPayment'));
const MarketplaceDirectory = lazy(() => import('./pages/marketplace/ProviderDirectory'));
const ProviderProfile = lazy(() => import('./pages/marketplace/ProviderProfile'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));

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
  const { state, dispatch } = useAppContext();
  const { currentUser: user, isMasterAdmin, loading, isDemoMode } = state;
  const navigate = useNavigate();

  const isNative = Capacitor.isNativePlatform();

  const getRedirectPath = useCallback((user: User | null, isMasterAdmin: boolean): string => {
    if (!user) return '/login';
    if (isMasterAdmin || user.role === 'franchise_admin') return '/master/dashboard';
    if (user.role === 'platform_sales') return '/sales/dashboard';
    if (user.role === 'admin' || user.role === 'both' || user.role === 'supervisor') return '/admin/dashboard';
    if (user.role === 'customer') {
        if (!user.organizationId || user.organizationId === 'unaffiliated') {
            return '/marketplace';
        }
        return '/portal';
    }
    if (user.role === 'employee') return '/briefing';
    
    // If unaffiliated or role unknown, send to marketplace for searching/connection
    const path = (!user.organizationId || user.organizationId === 'unaffiliated' || !user.role) ? '/marketplace' : '/login';
    console.log(`[Navigation] User: ${user.email}, Role: ${user.role}, Org: ${user.organizationId} -> Path: ${path}`);
    return path;
  }, []); // Dependencies for useCallback should be empty if it only uses its arguments, or include external state if needed.

  useEffect(() => {
    if (user?.id) {
      console.log(`[App] Current User: ${user.email}, Role: ${user.role}, Org: ${user.organizationId}`);
      import('./lib/pushNotificationService').then(module => {
        module.setupFCMToken(user.id);
      });
      // TEMPORARY: Reset master platform logo & color locally based on user request
      if (isMasterAdmin && user.organizationId) {
          import('./lib/firebase').then(({ db }) => {
              db.collection('organizations').doc(user.organizationId).update({
                  logoUrl: null,
                  primaryColor: null
              }).catch(() => {});
          }).catch(() => {});
      }
    }
  }, [user, isMasterAdmin]);

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
      document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)');
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
      console.log('[Attribution] GCLID captured:', gclid);
      localStorage.setItem('tt_gclid', gclid);
      localStorage.setItem('tt_gclid_captured_at', Date.now().toString());
    }
  }, []);

  const handleLogout = () => {
    auth.signOut();
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  if (loading) {
    const currentHash = window.location.hash.split('?')[0].replace('#', '') || '/';
    const publicPaths = ['/', '/offer', '/pro', '/pro/apex', '/compliance-view', '/privacy', '/terms', '/eula', '/franchise', '/franchise-agreement'];
    // Allow public marketing pages to instantly render the First Contentful Paint without waiting for Firebase Auth handshakes!
    if (!publicPaths.includes(currentHash)) {
      return <LoadingSpinner />;
    }
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
      <PWAInstallPrompt />
      <DemoBanner />
      <BackgroundDelayer>
        <LocationTracker />
      </BackgroundDelayer>
      
      <div className="safe-area-wrapper min-h-screen w-full flex flex-col">
        <ScrollToTop />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={user ? <Navigate to={getRedirectPath(user, isMasterAdmin)} replace /> : (isNative ? <Navigate to="/login" replace /> : <SaaSMarketing />)} />

            {/* Marketplace routes - available to all users */}
            <Route path="/marketplace" element={<MarketplaceDirectory />} />
            <Route path="/marketplace/:orgId" element={<ProviderProfile />} />
            <Route path="/franchise" element={<FranchiseOpportunities />} />
            <Route path="/franchise-agreement" element={<FranchiseAgreementDoc />} />

            {/* Public Document Viewing (Available to guests and authenticated users) */}
            <Route path="/invoice/:jobId" element={
                <Suspense fallback={<LoadingSpinner />}>
                    <CustomerPayment />
                </Suspense>
            } />
            <Route path="/proposal-view/:proposalId" element={<PublicProposal />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/report/equipment/:customerId" element={<PublicEquipmentReport />} />

            {/* Standalone Legal & Verification Documents */}
            <Route path="/compliance-view" element={<ComplianceReport />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/eula" element={<EULA />} />

            {user ? (
              <>
                {/* Logged In User Routes */}
                <Route path="/master/*" element={<MasterAdminRoutes user={user} handleLogout={handleLogout} />} />
                <Route path="/sales/*" element={<SalesRoutes user={user} handleLogout={handleLogout} />} />
                <Route path="/admin/*" element={<AdminRoutes user={user} handleLogout={handleLogout} isDemoMode={isDemoMode} />} />
                <Route path="/portal/*" element={<CustomerRoutes user={user} handleLogout={handleLogout} />} />
                <Route path="/briefing/*" element={<EmployeeRoutes user={user} handleLogout={handleLogout} isDemoMode={isDemoMode} getRedirectPath={() => getRedirectPath(user, isMasterAdmin)} />} />
                
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
