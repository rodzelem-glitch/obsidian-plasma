
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute: React.FC<{ isAllowed: boolean; redirectPath?: string; children: React.ReactNode; }> = ({ isAllowed, redirectPath = '/login', children }) => {
  if (!isAllowed) return <Navigate to={redirectPath} replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
