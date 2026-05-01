import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SaaSMarketing from './pages/landing/SaaSMarketing';

const PropertyOwnerMarketing = lazy(() => import('./pages/landing/PropertyOwnerMarketing'));
const VirtualWorkerMarketing = lazy(() => import('./pages/landing/VirtualWorkerMarketing'));
const VirtualWorkerCommands = lazy(() => import('./pages/landing/VirtualWorkerCommands'));
const PrivacyPolicy = lazy(() => import('./pages/landing/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/landing/TermsOfService'));
const EULA = lazy(() => import('./pages/landing/EULA'));
const FAQ = lazy(() => import('./pages/landing/FAQ'));
const FranchiseAgreementDoc = lazy(() => import('./pages/landing/FranchiseAgreementDoc'));
const FranchiseOpportunities = lazy(() => import('./pages/landing/FranchiseOpportunities'));

const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>
);

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<SaaSMarketing />} />
          <Route path="/homeowners" element={<PropertyOwnerMarketing />} />
          <Route path="/ai-worker" element={<VirtualWorkerMarketing />} />
          <Route path="/ai-worker-commands" element={<VirtualWorkerCommands />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/eula" element={<EULA />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/franchise" element={<FranchiseOpportunities />} />
          <Route path="/franchise-agreement" element={<FranchiseAgreementDoc />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </Suspense>
  );
}

export default App;
