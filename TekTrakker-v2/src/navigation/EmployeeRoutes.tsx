import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from 'types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import EmployeeLayout from '../components/layout/EmployeeLayout';
import { useAppContext } from '../context/AppContext';

// Employee Components
import DailyBriefing from '../pages/DailyBriefing';
import JobScheduling from '../pages/JobScheduling';
import FieldProposal from '../pages/FieldProposal';
import Messages from '../pages/Messages';
import TimeAndMileage from '../pages/TimeAndMileage';
import PaymentsAndOrders from '../pages/PaymentsAndOrders';
import IndustryToolsHub from '../pages/tools/IndustryToolsHub';
import HRResources from '../pages/HRResources';

import BillingGate from '../components/BillingGate';

const EmployeeRoutes: React.FC<{ user: User, handleLogout: () => void, isDemoMode: boolean, getRedirectPath: () => string }> = ({ user, handleLogout, isDemoMode, getRedirectPath }) => {
  const { state } = useAppContext();

  return (
    <ProtectedRoute isAllowed={!!user && (user.role === 'employee' || user.role === 'both' || user.role === 'supervisor' || user.role === 'Technician' || user.role === 'Subcontractor' || user.role === 'admin' || user.role === 'master_admin')}>
        <BillingGate>
          <EmployeeLayout user={user} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<DailyBriefing />} />
                <Route path="/scheduling" element={<JobScheduling />} />
                <Route path="/proposal" element={<FieldProposal />} />
                <Route path="/payments" element={<PaymentsAndOrders />} />
                <Route path="/tools" element={<IndustryToolsHub />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/timelog" element={<TimeAndMileage />} />
                <Route path="/hr" element={<HRResources />} />
                <Route path="*" element={<Navigate to={getRedirectPath()} replace />} />
              </Routes>
          </EmployeeLayout>
        </BillingGate>
    </ProtectedRoute>
  );
}

export default EmployeeRoutes;
