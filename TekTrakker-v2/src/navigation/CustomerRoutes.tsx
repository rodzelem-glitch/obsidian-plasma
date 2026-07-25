
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { User } from 'types';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import CustomerLayout from '../components/layout/CustomerLayout';
import CustomerDashboard from '../pages/customer/CustomerDashboard';
import OrganizationTerms from '../pages/customer/OrganizationTerms';

const CustomerRoutes: React.FC<{ user: User, handleLogout: () => void }> = ({ user, handleLogout }) => (
  <ProtectedRoute isAllowed={user?.role === 'customer'}>
    <CustomerLayout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="" element={<CustomerDashboard />} />
        <Route path="terms" element={<OrganizationTerms />} />
      </Routes>
    </CustomerLayout>
  </ProtectedRoute>
);

export default CustomerRoutes;
