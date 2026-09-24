import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from 'types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import BillingGate from '../components/BillingGate';
import AdminLayout from '../components/layout/AdminLayout';
import { hasPermission } from 'lib/utils';
import { lazyWithRetry, preloadModule } from '../lib/lazyWithRetry';

// Lazy-loaded Admin Components with auto-retry and cache-busting self-healing
const AdminDashboard = lazyWithRetry(() => import('../pages/admin/AdminDashboard'));
const KortPlayground = lazyWithRetry(() => import('../pages/admin/KortPlayground'));
const OperationsView = lazyWithRetry(() => import('../pages/admin/OperationsView'));
const CustomerCenterView = lazyWithRetry(() => import('../pages/admin/CustomerCenterView'));
const WorkforceView = lazyWithRetry(() => import('../pages/admin/WorkforceView'));
const RecordsView = lazyWithRetry(() => import('../pages/admin/RecordsView'));
const Financials = lazyWithRetry(() => import('../pages/admin/Financials'));
const EstimatorSettings = lazyWithRetry(() => import('../pages/admin/EstimatorSettings'));
const ComplianceDashboard = lazyWithRetry(() => import('../pages/admin/ComplianceDashboard'));
const Settings = lazyWithRetry(() => import('../pages/admin/Settings'));
const ApplicantTracking = lazyWithRetry(() => import('../pages/admin/ApplicantTracking'));
const AnalyticsMaster = lazyWithRetry(() => import('../pages/admin/AnalyticsMaster'));
const MarketingROI = lazyWithRetry(() => import('../pages/admin/MarketingROI'));
const MarketingCampaigns = lazyWithRetry(() => import('../pages/admin/MarketingCampaigns'));
const SalesAndMarketingHub = lazyWithRetry(() => import('../pages/admin/SalesAndMarketingHub'));
const SalesPipeline = lazyWithRetry(() => import('../pages/admin/SalesPipeline'));
const ReviewHub = lazyWithRetry(() => import('../pages/admin/ReviewHub'));
const BlogManager = lazyWithRetry(() => import('../pages/admin/BlogManager'));
const BidOptimizationTool = lazyWithRetry(() => import('../pages/admin/BidOptimizationTool'));
const IntegrationsMarketplace = lazyWithRetry(() => import('../pages/admin/IntegrationsMarketplace'));
const ContractingHub = lazyWithRetry(() => import('../pages/admin/ContractingHub'));
const ProjectManagement = lazyWithRetry(() => import('../pages/admin/ProjectManagement'));
const ProjectProposalsPage = lazyWithRetry(() => import('../pages/admin/proposals/ProjectProposalsPage'));
const Messages = lazyWithRetry(() => import('../pages/Messages'));
const FieldProposal = lazyWithRetry(() => import('../pages/FieldProposal'));
const KioskMode = lazyWithRetry(() => import('../pages/admin/KioskMode'));
const DatabaseMigration = lazyWithRetry(() => import('../pages/admin/DatabaseMigration'));
const TrainingHub = lazyWithRetry(() => import('../pages/TrainingHub'));
const VirtualWorkerUpgrade = lazyWithRetry(() => import('../pages/admin/VirtualWorkerUpgrade'));
const VirtualWorkerReports = lazyWithRetry(() => import('../pages/admin/VirtualWorkerReports'));
const HROperationsDashboard = lazyWithRetry(() => import('../pages/admin/HROperationsDashboard'));
const Whiteboard = lazyWithRetry(() => import('../pages/admin/Whiteboard'));
const CompanyCalendar = lazyWithRetry(() => import('../pages/admin/CompanyCalendar'));
const AwardProgramHub = lazyWithRetry(() => import('../pages/admin/AwardProgramHub'));
const OrganizationDrive = lazyWithRetry(() => import('../pages/admin/OrganizationDrive'));

// Lazy Dashboard details
const ActiveTechsView = lazyWithRetry(() => import('../pages/admin/DashboardDetails').then(m => ({ default: m.ActiveTechsView })));
const ActiveJobsView = lazyWithRetry(() => import('../pages/admin/DashboardDetails').then(m => ({ default: m.ActiveJobsView })));
const PartOrdersView = lazyWithRetry(() => import('../pages/admin/DashboardDetails').then(m => ({ default: m.PartOrdersView })));
const UnpaidInvoicesView = lazyWithRetry(() => import('../pages/admin/DashboardDetails').then(m => ({ default: m.UnpaidInvoicesView })));
const UpcomingMaintenanceView = lazyWithRetry(() => import('../pages/admin/DashboardDetails').then(m => ({ default: m.UpcomingMaintenanceView })));
const ActiveWarrantiesView = lazyWithRetry(() => import('../pages/admin/DashboardDetails').then(m => ({ default: m.ActiveWarrantiesView })));
const AlertsCenterView = lazyWithRetry(() => import('../pages/admin/DashboardDetails').then(m => ({ default: m.AlertsCenterView })));

const AdminRouteFallback: React.FC = () => (
  <div className="flex items-center justify-center p-12 min-h-[300px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400"></div>
  </div>
);

const PermissionProtectedRoute: React.FC<{ user: User, permission: string, children: React.ReactElement }> = ({ user, permission, children }) => {
  if (hasPermission(user, permission)) {
    return children;
  }
  return <Navigate to="/admin/dashboard" replace />;
};

const AdminRoutes: React.FC<{ user: User, handleLogout: () => void, isDemoMode: boolean }> = ({ user, handleLogout, isDemoMode }) => {
  const isKortTester = user?.email === 'integrations@kortpayments.com' || (user?.role as string) === 'kort_tester';
  const isUnlocked = isKortTester && typeof window !== 'undefined' && localStorage.getItem('kort_tester_unlocked') === 'true';

  // Warm up and preload primary admin views during browser idle time
  // This makes switching between tabs instant (0ms) and prevents chunk mismatches after deploys
  React.useEffect(() => {
    preloadModule(() => import('../pages/admin/WorkforceView'));
    preloadModule(() => import('../pages/admin/CustomerCenterView'));
    preloadModule(() => import('../pages/admin/Financials'));
    preloadModule(() => import('../pages/admin/OperationsView'));
    preloadModule(() => import('../pages/admin/Settings'));
  }, []);

  return (
    <ProtectedRoute isAllowed={!!user && (user.role === 'master_admin' || user.role === 'admin' || user.role === 'both' || user.role === 'supervisor' || user.role === 'platform_sales' || isKortTester || isDemoMode)}>
      <BillingGate>
        <AdminLayout user={user} onLogout={handleLogout}>
          <Suspense fallback={<AdminRouteFallback />}>
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
                <Route path="awards" element={<AwardProgramHub />} />
                <Route path="messages" element={<Messages />} />
                <Route path="communications" element={<Messages />} />
                <Route path="phone" element={<Navigate to="/admin/communications?tab=phone" replace />} />
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
                <Route path="drive" element={<OrganizationDrive />} />
                <Route path="organization-drive" element={<Navigate to="/admin/drive" replace />} />
                <Route path="history" element={<Navigate to="/admin/records?tab=history" replace />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            )}
          </Suspense>
        </AdminLayout>
      </BillingGate>
    </ProtectedRoute>
  );
};

export default AdminRoutes;


