
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from 'types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import BillingGate from '../components/BillingGate';
import AdminLayout from '../components/layout/AdminLayout';
import { hasPermission } from 'lib/utils';

// Admin Components
import AdminDashboard from '../pages/admin/AdminDashboard';
import KortPlayground from '../pages/admin/KortPlayground';
import { ActiveTechsView, ActiveJobsView, PartOrdersView, UnpaidInvoicesView, UpcomingMaintenanceView, ActiveWarrantiesView, AlertsCenterView } from '../pages/admin/DashboardDetails';
import OperationsView from '../pages/admin/OperationsView';
import CustomerCenterView from '../pages/admin/CustomerCenterView';
import WorkforceView from '../pages/admin/WorkforceView';
import RecordsView from '../pages/admin/RecordsView';
import Financials from '../pages/admin/Financials';
import EstimatorSettings from '../pages/admin/EstimatorSettings';
import ComplianceDashboard from '../pages/admin/ComplianceDashboard';
import Settings from '../pages/admin/Settings';
import ApplicantTracking from '../pages/admin/ApplicantTracking';
import AnalyticsMaster from '../pages/admin/AnalyticsMaster';
import MarketingROI from '../pages/admin/MarketingROI';
import MarketingCampaigns from '../pages/admin/MarketingCampaigns';
import SocialMediaHub from '../pages/admin/SocialMediaHub';
import SalesAndMarketingHub from '../pages/admin/SalesAndMarketingHub';
import SalesPipeline from '../pages/admin/SalesPipeline';
import ReviewHub from '../pages/admin/ReviewHub';
import BlogManager from '../pages/admin/BlogManager';
import BidOptimizationTool from '../pages/admin/BidOptimizationTool';
import IntegrationsMarketplace from '../pages/admin/IntegrationsMarketplace';
import ContractingHub from '../pages/admin/ContractingHub';
import ProjectManagement from '../pages/admin/ProjectManagement';
import ProjectProposalsPage from '../pages/admin/proposals/ProjectProposalsPage';
import Messages from '../pages/Messages';
import FieldProposal from '../pages/FieldProposal';
import KioskMode from '../pages/admin/KioskMode';
import DatabaseMigration from '../pages/admin/DatabaseMigration';
import TrainingHub from '../pages/TrainingHub';
import VirtualWorkerUpgrade from '../pages/admin/VirtualWorkerUpgrade';
import VirtualWorkerReports from '../pages/admin/VirtualWorkerReports';
import HROperationsDashboard from '../pages/admin/HROperationsDashboard';
import WarrantyClaimsDashboard from '../pages/admin/WarrantyClaimsDashboard';
import Whiteboard from '../pages/admin/Whiteboard';
import CompanyCalendar from '../pages/admin/CompanyCalendar';

const PermissionProtectedRoute: React.FC<{ user: User, permission: string, children: React.ReactElement }> = ({ user, permission, children }) => {
  if (hasPermission(user, permission)) {
    return children;
  }
  return <Navigate to="/admin/dashboard" replace />;
};

const AdminRoutes: React.FC<{ user: User, handleLogout: () => void, isDemoMode: boolean }> = ({ user, handleLogout, isDemoMode }) => {
  const isKortTester = user?.email === 'integrations@kortpayments.com' || (user?.role as string) === 'kort_tester';
  const isUnlocked = isKortTester && typeof window !== 'undefined' && localStorage.getItem('kort_tester_unlocked') === 'true';

  return (
    <ProtectedRoute isAllowed={!!user && (user.role === 'master_admin' || user.role === 'admin' || user.role === 'both' || user.role === 'supervisor' || user.role === 'platform_sales' || isKortTester || isDemoMode)}>
      <BillingGate>
        <AdminLayout user={user} onLogout={handleLogout}>
          {isKortTester && !isUnlocked ? (
            <Routes>
              <Route path="kort-playground" element={<KortPlayground />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/admin/kort-playground" replace />} />
            </Routes>
          ) : user?.role === 'platform_sales' ? (
            <Routes>
              <Route path="project-proposals" element={<ProjectProposalsPage />} />
              <Route path="*" element={<Navigate to="/sales/dashboard" replace />} />
            </Routes>
          ) : (
            <Routes>
              {isKortTester && <Route path="kort-playground" element={<KortPlayground />} />}
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="hr" element={<PermissionProtectedRoute user={user} permission="view_financials"><HROperationsDashboard /></PermissionProtectedRoute>} />
          <Route path="dashboard/active-techs" element={<ActiveTechsView />} />
          <Route path="dashboard/active-jobs" element={<ActiveJobsView />} />
          <Route path="dashboard/orders" element={<PartOrdersView />} />
          <Route path="dashboard/unpaid-invoices" element={<UnpaidInvoicesView />} />
          <Route path="dashboard/maintenance" element={<UpcomingMaintenanceView />} />
          <Route path="dashboard/active-warranties" element={<ActiveWarrantiesView />} />
          <Route path="dashboard/alerts" element={<AlertsCenterView />} />
          <Route path="analytics" element={<PermissionProtectedRoute user={user} permission="view_financials"><AnalyticsMaster /></PermissionProtectedRoute>} />
          <Route path="marketing" element={<PermissionProtectedRoute user={user} permission="manage_marketing"><MarketingROI /></PermissionProtectedRoute>} />
          <Route path="marketing-hub" element={<PermissionProtectedRoute user={user} permission="manage_marketing"><SalesAndMarketingHub /></PermissionProtectedRoute>} />
          <Route path="campaigns" element={<PermissionProtectedRoute user={user} permission="manage_marketing"><MarketingCampaigns /></PermissionProtectedRoute>} />
          {/* <Route path="social" element={<PermissionProtectedRoute user={user} permission="manage_marketing"><SocialMediaHub /></PermissionProtectedRoute>} /> */}
          <Route path="blog" element={<PermissionProtectedRoute user={user} permission="manage_marketing"><BlogManager /></PermissionProtectedRoute>} />
          <Route path="sales" element={<PermissionProtectedRoute user={user} permission="manage_marketing"><SalesPipeline /></PermissionProtectedRoute>} />
          <Route path="operations" element={<PermissionProtectedRoute user={user} permission="manage_dispatch"><OperationsView /></PermissionProtectedRoute>} />
          <Route path="customers" element={<PermissionProtectedRoute user={user} permission="view_customers"><CustomerCenterView /></PermissionProtectedRoute>} />
          <Route path="workforce" element={<WorkforceView />} />
          <Route path="records" element={<PermissionProtectedRoute user={user} permission="manage_inventory"><RecordsView /></PermissionProtectedRoute>} />
          <Route path="financials" element={<PermissionProtectedRoute user={user} permission="view_financials"><Financials /></PermissionProtectedRoute>} />
          <Route path="compliance" element={<PermissionProtectedRoute user={user} permission="view_refrigerant"><ComplianceDashboard /></PermissionProtectedRoute>} />
          <Route path="estimator" element={<EstimatorSettings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="integrations-marketplace" element={<IntegrationsMarketplace />} />
          <Route path="hiring" element={<ApplicantTracking />} />
          <Route path="reviews" element={<PermissionProtectedRoute user={user} permission="manage_marketing"><ReviewHub /></PermissionProtectedRoute>} />
          <Route path="messages" element={<Messages />} />
          <Route path="contracts" element={<PermissionProtectedRoute user={user} permission="view_financials"><BidOptimizationTool /></PermissionProtectedRoute>} />
          <Route path="contracting" element={<PermissionProtectedRoute user={user} permission="view_customers"><ContractingHub /></PermissionProtectedRoute>} />

          <Route path="projects" element={<PermissionProtectedRoute user={user} permission="manage_dispatch"><ProjectManagement /></PermissionProtectedRoute>} />
          <Route path="project-proposals" element={<PermissionProtectedRoute user={user} permission="view_financials"><ProjectProposalsPage /></PermissionProtectedRoute>} />
          <Route path="calendar" element={<PermissionProtectedRoute user={user} permission="manage_dispatch"><CompanyCalendar /></PermissionProtectedRoute>} />
          <Route path="proposal" element={<FieldProposal />} />
          <Route path="kiosk" element={<KioskMode />} />
          <Route path="training" element={<TrainingHub user={user} />} />
          <Route path="migrate" element={<DatabaseMigration />} />
          <Route path="ai-worker-upgrade" element={<VirtualWorkerUpgrade />} />
          <Route path="ai-reports" element={<VirtualWorkerReports />} />
          <Route path="whiteboard" element={<Whiteboard />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
          )}
        </AdminLayout>
      </BillingGate>
    </ProtectedRoute>
  );
};

export default AdminRoutes;


