
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { User } from '../types';

// Landing Pages (legal + org sites only - marketing pages live in TekTrakker-Website)
const OrganizationPublicSite = lazy(() => import('../pages/landing/OrganizationPublicSite'));
const ComplianceReport = lazy(() => import('../pages/landing/ComplianceReport'));
const PrivacyPolicy = lazy(() => import('../pages/landing/PrivacyPolicy'));
const TermsOfService = lazy(() => import('../pages/landing/TermsOfService'));
const EULA = lazy(() => import('../pages/landing/EULA'));
const FAQ = lazy(() => import('../pages/landing/FAQ'));
const ReviewsWidget = lazy(() => import('../pages/landing/ReviewsWidget'));
const PropertyOwnerMarketing = lazy(() => import('../pages/landing/PropertyOwnerMarketing'));
const VirtualWorkerMarketing = lazy(() => import('../pages/landing/VirtualWorkerMarketing'));
const VirtualWorkerCommands = lazy(() => import('../pages/landing/VirtualWorkerCommands'));
const FranchiseOpportunities = lazy(() => import('../pages/landing/FranchiseOpportunities'));
// Page Components
const LoginPage = lazy(() => import('../pages/Login'));
const PublicBookingPage = lazy(() => import('../pages/PublicBookingPage'));
const PublicCareerPage = lazy(() => import('../pages/PublicCareerPage'));
const PublicUploadPortal = lazy(() => import('../pages/PublicUploadPortal'));
const PublicTechFormFill = lazy(() => import('../pages/PublicTechFormFill'));
const PublicAwardVerification = lazy(() => import('../pages/public/PublicAwardVerification'));
const PublicAwardWidget = lazy(() => import('../pages/public/PublicAwardWidget'));
const PublicMultiAwardWidget = lazy(() => import('../pages/public/PublicMultiAwardWidget'));

// Lazy Load Payment Page & Public Documents
const ApexDemo = lazy(() => import('../pages/Pro/ApexDemo'));
const SaaSCheckoutFunnel = lazy(() => import('../pages/landing/SaaSCheckoutFunnel'));
const OAuthCallback = lazy(() => import('../pages/OAuthCallback'));
const CustomerPayment = lazy(() => import('../pages/CustomerPayment'));
const PublicProjectProposal = lazy(() => import('../pages/PublicProjectProposal'));
const PublicEquipmentReport = lazy(() => import('../pages/PublicEquipmentReport'));
const PublicServiceReport = lazy(() => import('../pages/PublicServiceReport'));
const Unsubscribe = lazy(() => import('../pages/Unsubscribe'));

const PublicRoutes: React.FC<{ user: User | null, getRedirectPath: () => string }> = ({ user, getRedirectPath }) => (
  <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/offer" element={<SaaSCheckoutFunnel />} />
    <Route path="/pro/apex" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Demo...</div>}>
            <ApexDemo />
        </Suspense>
    } />
    
    {/* Public Document Routes */}
    <Route path="/invoice/:jobId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Invoice...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/invoice/:id" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Invoice...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/pay/:paymentRequestId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Payment...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/pay/:jobId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Payment...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/pay/:id" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Payment...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/deposit/:paymentRequestId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Deposit...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/deposit/:jobId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Deposit...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/deposit/:id" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Deposit...</div>}>
            <CustomerPayment />
        </Suspense>
    } />
    <Route path="/proposal-view/:proposalId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Proposal...</div>}>
            <PublicProjectProposal />
        </Suspense>
    } />
    <Route path="/project-proposal-view/:proposalId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Proposal...</div>}>
            <PublicProjectProposal />
        </Suspense>
    } />
    <Route path="/proposal/:proposalId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Proposal...</div>}>
            <PublicProjectProposal />
        </Suspense>
    } />
    <Route path="/public-proposal/:proposalId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Proposal...</div>}>
            <PublicProjectProposal />
        </Suspense>
    } />
    <Route path="/service-report" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Service Report...</div>}>
            <PublicServiceReport />
        </Suspense>
    } />
    <Route path="/service-report/:jobId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Service Report...</div>}>
            <PublicServiceReport />
        </Suspense>
    } />
    <Route path="/service-report/:id" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Service Report...</div>}>
            <PublicServiceReport />
        </Suspense>
    } />
    <Route path="/report" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Service Report...</div>}>
            <PublicServiceReport />
        </Suspense>
    } />
    <Route path="/report/service/:jobId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Service Report...</div>}>
            <PublicServiceReport />
        </Suspense>
    } />
    <Route path="/report/:jobId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Service Report...</div>}>
            <PublicServiceReport />
        </Suspense>
    } />
    <Route path="/report/equipment/:customerId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Equipment Report...</div>}>
            <PublicEquipmentReport />
        </Suspense>
    } />
    <Route path="/asset/:customerId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Equipment...</div>}>
            <PublicEquipmentReport />
        </Suspense>
    } />
    <Route path="/equipment/:customerId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading Equipment...</div>}>
            <PublicEquipmentReport />
        </Suspense>
    } />
    <Route path="/unsubscribe" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading...</div>}>
            <Unsubscribe />
        </Suspense>
    } />
    <Route path="/site/:orgId" element={<OrganizationPublicSite />} />
    <Route path="/p/:slug" element={<OrganizationPublicSite />} />
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
    <Route path="/book" element={<PublicBookingPage />} />
    <Route path="/careers/:orgId" element={<PublicCareerPage />} />
    <Route path="/public-upload/:token" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-900 text-white">Connecting Secure Portal...</div>}>
            <PublicUploadPortal />
        </Suspense>
    } />
    <Route path="/public-upload/job/:token" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-900 text-white">Connecting Job Upload Portal...</div>}>
            <PublicUploadPortal />
        </Suspense>
    } />
    <Route path="/tech-form/:jobId" element={
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading Field Technician Form...</div>}>
            <PublicTechFormFill />
        </Suspense>
    } />
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
    <Route path="/homeowners" element={<PropertyOwnerMarketing />} />
    <Route path="/ai-worker" element={<VirtualWorkerMarketing />} />
    <Route path="/ai-commands" element={<VirtualWorkerCommands />} />
    <Route path="/franchise" element={<FranchiseOpportunities />} />
    
    <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={`${getRedirectPath()}${window.location.search}`} replace />} />
    <Route path="/register" element={!user ? <LoginPage /> : <Navigate to={`${getRedirectPath()}${window.location.search}`} replace />} />
    <Route path="*" element={<Navigate to={`/login${window.location.search}`} replace />} />
  </Routes>
);

export default PublicRoutes;
