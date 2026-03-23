
import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { auth } from './lib/firebase';
import PWAInstallPrompt from './components/ui/PWAInstallPrompt';
import { Capacitor } from '@capacitor/core';
import DemoBanner from './components/DemoBanner';

// Routing Components
import PublicRoutes from './navigation/PublicRoutes';
import MasterAdminRoutes from './navigation/MasterAdminRoutes';
import SalesRoutes from './navigation/SalesRoutes';
import AdminRoutes from './navigation/AdminRoutes';
import CustomerRoutes from './navigation/CustomerRoutes';
import EmployeeRoutes from './navigation/EmployeeRoutes';
import SplitHome from './pages/landing/SplitHome';
import LocationTracker from './components/common/LocationTracker';

import FieldProposal from './pages/FieldProposal';
import PublicProposal from './pages/PublicProposal';

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

const App: React.FC = () => {
  const { state, dispatch, getRedirectPath } = useAppContext();
  const { currentUser: user, isMasterAdmin, loading, isDemoMode } = state;
  const navigate = useNavigate();

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (user?.id && isNative) {
      import('./lib/pushNotifications').then(module => {
        module.initializePushNotifications(user.id);
      });
    }
  }, [user?.id, isNative]);

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
    return <LoadingSpinner />;
  }

  return (
    <>
      <PWAInstallPrompt />
      <DemoBanner />
      <LocationTracker />
      
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to={getRedirectPath(user, isMasterAdmin)} replace /> : (isNative ? <Navigate to="/login" replace /> : <SplitHome />)} />

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
              
              {/* Shared Route: Proposal Editor (Accessible by Admins and Techs) */}
              <Route path="/proposal" element={<FieldProposal />} />
              
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
