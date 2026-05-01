
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from '../types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import MasterLayout from '../components/layout/MasterLayout';
import { useAppContext } from '../context/AppContext';

// Master Admin Components
import MasterDashboard from '../pages/master/MasterDashboard';
import MasterOrganizations from '../pages/master/MasterOrganizations';
import FranchiseManager from '../pages/master/FranchiseManager';
import GlobalMembers from '../pages/master/GlobalMembers';
import GlobalUsers from '../pages/master/GlobalUsers';
import GlobalCustomers from '../pages/master/GlobalCustomers';
import MasterBilling from '../pages/master/MasterBilling';
import FranchiseBilling from '../pages/master/FranchiseBilling';
import MasterSalesTeam from '../pages/master/MasterSalesTeam';
import ComplianceRegistry from '../pages/master/ComplianceRegistry';
import PlatformAnalytics from '../pages/master/PlatformAnalytics'; 
import PlatformCampaignStudio from '../pages/master/PlatformCampaignStudio';
import MasterIntegrationRequests from '../pages/master/MasterIntegrationRequests';
import Messages from '../pages/Messages';
import AiUsageMaster from '../pages/admin/AiUsageMaster';
import StorageUsageMaster from '../pages/admin/StorageUsageMaster';
import VirtualWorkerReports from '../pages/admin/VirtualWorkerReports';

const MasterAdminRoutes: React.FC<{ user: User, handleLogout: () => void }> = ({ user, handleLogout }) => {
  const { state } = useAppContext();
  const isAllowed = state.isMasterAdmin || user.role === 'franchise_admin';
  const isPlatformOwner = state.isMasterAdmin;

  return (
    <ProtectedRoute isAllowed={isAllowed}>
      <MasterLayout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="dashboard" element={<MasterDashboard />} />
          <Route path="organizations" element={<MasterOrganizations />} />
          <Route path="members" element={<GlobalMembers />} />
          <Route path="users" element={<GlobalUsers />} />
          <Route path="customers" element={<GlobalCustomers />} />
          <Route path="compliance" element={<ComplianceRegistry />} />
          <Route path="messages" element={<Messages />} />
          <Route path="sales-team" element={<MasterSalesTeam />} />
          <Route path="franchises" element={<FranchiseManager />} />
          <Route path="ai-usage" element={<AiUsageMaster />} />
          <Route path="storage-usage" element={<StorageUsageMaster />} />
          <Route path="campaigns" element={<PlatformCampaignStudio />} />
          <Route path="ai-reports" element={<VirtualWorkerReports />} />
          <Route path="integration-requests" element={<MasterIntegrationRequests />} />
          
          {/* Franchise Admin Only Routes */}
          {!isPlatformOwner && isAllowed && (
              <Route path="franchise-billing" element={<FranchiseBilling />} />
          )}

          {/* Platform Owner Only Routes */}
          {isPlatformOwner && (
            <>
              <Route path="billing" element={<MasterBilling />} />
              <Route path="analytics" element={<PlatformAnalytics />} /> 
            </>
          )}

          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </MasterLayout>
    </ProtectedRoute>
  );
}

export default MasterAdminRoutes;
