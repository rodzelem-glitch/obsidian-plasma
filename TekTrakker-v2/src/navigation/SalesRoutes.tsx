
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from '../types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import SalesLayout from '../components/layout/SalesLayout';

// Sales Rep Components
import SalesOverview from '../pages/sales/SalesOverview';
import SalesLeads from '../pages/sales/SalesLeads';
import SalesPipelineBoard from '../pages/sales/SalesPipeline';
import SalesCommissions from '../pages/sales/SalesCommissions';
import SalesResources from '../pages/sales/SalesResources';
import SalesTools from '../pages/sales/SalesTools';
import SalesExpenses from '../pages/sales/SalesExpenses';
import CampaignManager from '../pages/sales/CampaignManager';
import Messages from '../pages/Messages';
import MailingListManager from '../pages/master/components/MailingListManager';

const SalesRoutes: React.FC<{ user: User, handleLogout: () => void }> = ({ user, handleLogout }) => (
  <ProtectedRoute isAllowed={user?.role === 'platform_sales' || user?.role === 'master_admin'}>
    <SalesLayout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="dashboard" element={<SalesOverview />} />
        <Route path="leads" element={<SalesLeads />} />
        <Route path="pipeline" element={<SalesPipelineBoard />} />
        <Route path="campaigns" element={<CampaignManager />} />
        <Route path="commissions" element={<SalesCommissions />} />
        <Route path="resources" element={<SalesResources />} />
        <Route path="tools" element={<SalesTools />} />
        <Route path="expenses" element={<SalesExpenses />} />
        <Route path="messages" element={<Messages />} />
        <Route path="mailing-lists" element={<MailingListManager />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </SalesLayout>
  </ProtectedRoute>
);

export default SalesRoutes;
