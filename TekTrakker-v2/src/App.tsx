
import React, { useEffect, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { User } from './types';
import { auth } from './lib/firebase';
import PWAInstallPrompt from './components/ui/PWAInstallPrompt';
import { Capacitor } from '@capacitor/core';
import DemoBanner from './components/DemoBanner';

// Lazy Loaded Routing Components for Bundle Splitting
const MasterAdminRoutes = lazy(() => import('./navigation/MasterAdminRoutes'));
const SalesRoutes = lazy(() => import('./navigation/SalesRoutes'));
const AdminRoutes = lazy(() => import('./navigation/AdminRoutes'));
const CustomerRoutes = lazy(() => import('./navigation/CustomerRoutes'));
const EmployeeRoutes = lazy(() => import('./navigation/EmployeeRoutes'));
const PublicRoutes = lazy(() => import('./navigation/PublicRoutes'));
import SaaSMarketing from './pages/landing/SaaSMarketing';
import LocationTracker from './components/common/LocationTracker';

const FieldProposal = lazy(() => import('./pages/FieldProposal'));
const PublicProposal = lazy(() => import('./pages/PublicProposal'));

// Lazy Load Payment and Marketplace
const CustomerPayment = lazy(() => import('./pages/CustomerPayment'));
const MarketplaceDirectory = lazy(() => import('./pages/marketplace/ProviderDirectory'));
const ProviderProfile = lazy(() => import('./pages/marketplace/ProviderProfile'));

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
    if (isMasterAdmin) return '/master/dashboard';
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
      if (isNative) {
        import('./lib/pushNotifications').then(module => {
          module.initializePushNotifications(user.id);
        });
      }
    }
  }, [user, isNative]);

  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  const handleLogout = () => {
    auth.signOut();
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  if (loading) {
    const currentHash = window.location.hash.split('?')[0].replace('#', '') || '/';
    const publicPaths = ['/', '/pro', '/pro/apex', '/compliance-view', '/privacy', '/terms', '/eula'];
    // Allow public marketing pages to instantly render the First Contentful Paint without waiting for Firebase Auth handshakes!
    if (!publicPaths.includes(currentHash)) {
      return <LoadingSpinner />;
    }
  }

  return (
    <>
      <PWAInstallPrompt />
      <DemoBanner />
      <BackgroundDelayer>
        <LocationTracker />
      </BackgroundDelayer>
      
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to={getRedirectPath(user, isMasterAdmin)} replace /> : (isNative ? <Navigate to="/login" replace /> : <SaaSMarketing />)} />

          {/* Marketplace routes - available to all users */}
          <Route path="/marketplace" element={<MarketplaceDirectory />} />
          <Route path="/marketplace/:orgId" element={<ProviderProfile />} />

          {/* Public Document Viewing (Available to guests and authenticated users) */}
          <Route path="/invoice/:jobId" element={
              <Suspense fallback={<LoadingSpinner />}>
                  <CustomerPayment />
              </Suspense>
          } />
          <Route path="/proposal-view/:proposalId" element={<PublicProposal />} />

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
    </>
  );
};

export default App;
