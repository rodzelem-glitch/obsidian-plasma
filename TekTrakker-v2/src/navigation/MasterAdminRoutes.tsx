
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from '../types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import MasterLayout from '../components/layout/MasterLayout';
import { useAppContext } from '../context/AppContext';

// Master Admin Components
import MasterDashboard from '../pages/master/MasterDashboard';
import MasterInbox from '../pages/master/MasterInbox';
import MasterOrganizations from '../pages/master/MasterOrganizations';
import FranchiseManager from '../pages/master/FranchiseManager';
import GlobalMembers from '../pages/master/GlobalMembers';
import GlobalUsers from '../pages/master/GlobalUsers';
import GlobalCustomers from '../pages/master/GlobalCustomers';
import MasterBilling from '../pages/master/MasterBilling';
import FranchiseBilling from '../pages/master/FranchiseBilling';
import MasterSalesTeam from '../pages/master/MasterSalesTeam';
import ComplianceRegistry from '../pages/master/ComplianceRegistry';
import MasterAnalyticsHub from '../pages/master/MasterAnalyticsHub';
import PlatformAnalytics from '../pages/master/PlatformAnalytics'; 
import TelephonyAnalytics from '../pages/master/TelephonyAnalytics';
import PlatformCampaignStudio from '../pages/master/PlatformCampaignStudio';
import MasterIntegrationRequests from '../pages/master/MasterIntegrationRequests';
import Messages from '../pages/Messages';
import AiUsageMaster from '../pages/admin/AiUsageMaster';
import StorageUsageMaster from '../pages/admin/StorageUsageMaster';
import VirtualWorkerReports from '../pages/admin/VirtualWorkerReports';

import Financials from '../pages/admin/Financials';
import MobileDevConsole from '../pages/master/MobileDevConsole';
import MasterAwardIssuer from '../pages/master/MasterAwardIssuer';

const MasterAdminRoutes: React.FC<{ user: User, handleLogout: () => void }> = ({ user, handleLogout }) => {
  const { state } = useAppContext();
  const isAllowed = state.isMasterAdmin || user.role === 'franchise_admin';
  const isPlatformOwner = state.isMasterAdmin;

  return (
    <ProtectedRoute isAllowed={isAllowed}>
      <MasterLayout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="dashboard" element={<MasterDashboard />} />
          <Route path="awards" element={<MasterAwardIssuer />} />
          <Route path="organizations" element={<MasterOrganizations />} />
          <Route path="members" element={<GlobalMembers />} />
          <Route path="users" element={<GlobalUsers />} />
          <Route path="customers" element={<GlobalCustomers />} />
          <Route path="compliance" element={<ComplianceRegistry />} />
          <Route path="messages" element={<Messages />} />
          <Route path="communications" element={<Messages />} />
          <Route path="phone" element={<Navigate to="/master/communications?tab=phone" replace />} />
          <Route path="sales-team" element={<MasterSalesTeam />} />
          <Route path="franchises" element={<FranchiseManager />} />
          <Route path="analytics" element={<MasterAnalyticsHub />} />
          <Route path="ai-usage" element={<Navigate to="/master/analytics?tab=ai-usage" replace />} />
          <Route path="storage-usage" element={<Navigate to="/master/analytics?tab=storage" replace />} />
          <Route path="telephony" element={<Navigate to="/master/analytics?tab=telephony" replace />} />
          <Route path="ai-reports" element={<Navigate to="/master/analytics?tab=ai-reports" replace />} />
          <Route path="campaigns" element={<PlatformCampaignStudio />} />
          <Route path="integration-requests" element={<MasterIntegrationRequests />} />
          <Route path="drip-campaigns" element={<PlatformCampaignStudio />} />
          
          {/* Franchise Admin Only Routes */}
          {!isPlatformOwner && isAllowed && (
              <Route path="franchise-billing" element={<FranchiseBilling />} />
          )}

          {/* Platform Owner Only Routes */}
          {isPlatformOwner && (
            <>
              <Route path="billing" element={<MasterBilling />} />
              <Route path="inbox" element={<MasterInbox />} />
              <Route path="financials" element={<Financials />} />
              <Route path="developer-console" element={<MobileDevConsole />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/master/dashboard" replace />} />
        </Routes>
      </MasterLayout>
    </ProtectedRoute>
  );
}

export default MasterAdminRoutes;

