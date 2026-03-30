
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from 'types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import BillingGate from '../components/BillingGate';
import AdminLayout from '../components/layout/AdminLayout';

// Admin Components
import AdminDashboard from '../pages/admin/AdminDashboard';
import { ActiveTechsView, ActiveJobsView, PartOrdersView, UnpaidInvoicesView } from '../pages/admin/DashboardDetails';
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
import SalesPipeline from '../pages/admin/SalesPipeline';
import ReviewHub from '../pages/admin/ReviewHub';
import GovBidHelper from '../pages/admin/GovBidHelper';
import ProjectManagement from '../pages/admin/ProjectManagement';
import Messages from '../pages/Messages';
import FieldProposal from '../pages/FieldProposal';
import KioskMode from '../pages/admin/KioskMode';

const AdminRoutes: React.FC<{ user: User, handleLogout: () => void, isDemoMode: boolean }> = ({ user, handleLogout, isDemoMode }) => (
  <ProtectedRoute isAllowed={!!user && (user.role === 'master_admin' || user.role === 'admin' || user.role === 'both' || user.role === 'supervisor' || isDemoMode)}>
    <BillingGate>
      <AdminLayout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="dashboard/active-techs" element={<ActiveTechsView />} />
          <Route path="dashboard/active-jobs" element={<ActiveJobsView />} />
          <Route path="dashboard/orders" element={<PartOrdersView />} />
          <Route path="dashboard/unpaid-invoices" element={<UnpaidInvoicesView />} />
          <Route path="analytics" element={<AnalyticsMaster />} />
          <Route path="marketing" element={<MarketingROI />} />
          <Route path="campaigns" element={<MarketingCampaigns />} />
          <Route path="social" element={<SocialMediaHub />} />
          <Route path="sales" element={<SalesPipeline />} />
          <Route path="operations" element={<OperationsView />} />
          <Route path="customers" element={<CustomerCenterView />} />
          <Route path="workforce" element={<WorkforceView />} />
          <Route path="records" element={<RecordsView />} />
          <Route path="financials" element={<Financials />} />
          <Route path="compliance" element={<ComplianceDashboard />} />
          <Route path="estimator" element={<EstimatorSettings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="hiring" element={<ApplicantTracking />} />
          <Route path="reviews" element={<ReviewHub />} />
          <Route path="messages" element={<Messages />} />
          <Route path="contracts" element={<GovBidHelper />} />
          <Route path="projects" element={<ProjectManagement />} />
          <Route path="proposal" element={<FieldProposal />} />
          <Route path="kiosk" element={<KioskMode />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </AdminLayout>
    </BillingGate>
  </ProtectedRoute>
);

export default AdminRoutes;
