
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from '../types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import MasterLayout from '../components/layout/MasterLayout';
import { useAppContext } from '../context/AppContext';

// Master Admin Components
import MasterDashboard from '../pages/master/MasterDashboard';
import MasterOrganizations from '../pages/master/MasterOrganizations';
import GlobalMembers from '../pages/master/GlobalMembers';
import GlobalUsers from '../pages/master/GlobalUsers';
import GlobalCustomers from '../pages/master/GlobalCustomers';
import MasterBilling from '../pages/master/MasterBilling';
import MasterSalesTeam from '../pages/master/MasterSalesTeam';
import ComplianceRegistry from '../pages/master/ComplianceRegistry';
import PlatformAnalytics from '../pages/master/PlatformAnalytics'; 
import Messages from '../pages/Messages';
import AiUsageMaster from '../pages/admin/AiUsageMaster';
import StorageUsageMaster from '../pages/admin/StorageUsageMaster';

const MasterAdminRoutes: React.FC<{ user: User, handleLogout: () => void }> = ({ user, handleLogout }) => {
  const { state } = useAppContext();
  return (
    <ProtectedRoute isAllowed={state.isMasterAdmin}>
      <MasterLayout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="dashboard" element={<MasterDashboard />} />
          <Route path="organizations" element={<MasterOrganizations />} />
          <Route path="members" element={<GlobalMembers />} />
          <Route path="users" element={<GlobalUsers />} />
          <Route path="customers" element={<GlobalCustomers />} />
          <Route path="billing" element={<MasterBilling />} />
          <Route path="sales-team" element={<MasterSalesTeam />} />
          <Route path="compliance" element={<ComplianceRegistry />} />
          <Route path="analytics" element={<PlatformAnalytics />} /> 
          <Route path="ai-usage" element={<AiUsageMaster />} />
          <Route path="storage-usage" element={<StorageUsageMaster />} />
          <Route path="messages" element={<Messages />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </MasterLayout>
    </ProtectedRoute>
  );
}

export default MasterAdminRoutes;
