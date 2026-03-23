
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Landing Pages
import SplitHome from '../pages/landing/SplitHome';
import SaaSMarketing from '../pages/landing/SaaSMarketing';
import OrganizationPublicSite from '../pages/landing/OrganizationPublicSite';
import ComplianceReport from '../pages/landing/ComplianceReport';
import PrivacyPolicy from '../pages/landing/PrivacyPolicy';
import TermsOfService from '../pages/landing/TermsOfService';
import EULA from '../pages/landing/EULA';

// Page Components
import LoginPage from '../pages/Login';
import PublicProposal from '../pages/PublicProposal';
import PublicBookingPage from '../pages/PublicBookingPage';
import PublicCareerPage from '../pages/PublicCareerPage';

// Lazy Load Payment Page
const CustomerPayment = lazy(() => import('../pages/CustomerPayment'));
const ApexDemo = lazy(() => import('../pages/Pro/ApexDemo'));

const PublicRoutes: React.FC<{ user: any, getRedirectPath: () => string }> = ({ user, getRedirectPath }) => (
  <Routes>
    <Route path="/" element={user ? <Navigate to={getRedirectPath()} replace /> : <SplitHome />} />
    <Route path="/pro" element={<SaaSMarketing />} />
    <Route path="/pro/apex" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Demo...</div>}>
            <ApexDemo />
        </Suspense>
    } />
    <Route path="/site/:orgId" element={<OrganizationPublicSite />} />
    <Route path="/book" element={<PublicBookingPage />} />
    <Route path="/careers/:orgId" element={<PublicCareerPage />} />
    
    <Route path="/compliance-view" element={<ComplianceReport />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/eula" element={<EULA />} />
    
    <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getRedirectPath()} replace />} />
  </Routes>
);

export default PublicRoutes;
