
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Landing Pages
// Deprecated: const SplitHome = lazy(() => import('../pages/landing/SplitHome'));
const SaaSMarketing = lazy(() => import('../pages/landing/SaaSMarketing'));
const PropertyOwnerMarketing = lazy(() => import('../pages/landing/PropertyOwnerMarketing'));
const OrganizationPublicSite = lazy(() => import('../pages/landing/OrganizationPublicSite'));
const ComplianceReport = lazy(() => import('../pages/landing/ComplianceReport'));
const PrivacyPolicy = lazy(() => import('../pages/landing/PrivacyPolicy'));
const TermsOfService = lazy(() => import('../pages/landing/TermsOfService'));
const EULA = lazy(() => import('../pages/landing/EULA'));
const FAQ = lazy(() => import('../pages/landing/FAQ'));
const VirtualWorkerMarketing = lazy(() => import('../pages/landing/VirtualWorkerMarketing'));
const VirtualWorkerCommands = lazy(() => import('../pages/landing/VirtualWorkerCommands'));
const ReviewsWidget = lazy(() => import('../pages/landing/ReviewsWidget'));

// Page Components
const LoginPage = lazy(() => import('../pages/Login'));
const PublicProposal = lazy(() => import('../pages/PublicProposal'));
const PublicBookingPage = lazy(() => import('../pages/PublicBookingPage'));
const PublicCareerPage = lazy(() => import('../pages/PublicCareerPage'));

// Lazy Load Payment Page
const CustomerPayment = lazy(() => import('../pages/CustomerPayment'));
const ApexDemo = lazy(() => import('../pages/Pro/ApexDemo'));
const SaaSCheckoutFunnel = lazy(() => import('../pages/landing/SaaSCheckoutFunnel'));
const OAuthCallback = lazy(() => import('../pages/OAuthCallback'));

const PublicRoutes: React.FC<{ user: any, getRedirectPath: () => string }> = ({ user, getRedirectPath }) => (
  <Routes>
    <Route path="/offer" element={<SaaSCheckoutFunnel />} />
    <Route path="/" element={user ? <Navigate to={getRedirectPath()} replace /> : <Navigate to="/login" replace />} />
    <Route path="/homeowners" element={<PropertyOwnerMarketing />} />
    <Route path="/ai-worker" element={<VirtualWorkerMarketing />} />
    <Route path="/ai-worker-commands" element={<VirtualWorkerCommands />} />
    <Route path="/pro/apex" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Demo...</div>}>
            <ApexDemo />
        </Suspense>
    } />
    <Route path="/site/:orgId" element={<OrganizationPublicSite />} />
    <Route path="/widgets/reviews/:orgId" element={<ReviewsWidget />} />
    <Route path="/book" element={<PublicBookingPage />} />
    <Route path="/careers/:orgId" element={<PublicCareerPage />} />
    <Route path="/auth/callback" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Processing Authentication...</div>}>
            <OAuthCallback />
        </Suspense>
    } />
    
    <Route path="/compliance-view" element={<ComplianceReport />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/eula" element={<EULA />} />
    <Route path="/faq" element={<FAQ />} />
    
    <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={`${getRedirectPath()}${window.location.search}`} replace />} />
    <Route path="/register" element={!user ? <LoginPage /> : <Navigate to={`${getRedirectPath()}${window.location.search}`} replace />} />
    <Route path="*" element={<Navigate to={`/login${window.location.search}`} replace />} />
  </Routes>
);

export default PublicRoutes;
