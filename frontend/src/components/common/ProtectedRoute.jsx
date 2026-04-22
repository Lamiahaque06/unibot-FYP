import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../../contexts/authStore';

/**
 * Protected Route Component
 * Restricts access to authenticated users with specific roles
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {Array<string>} props.allowedRoles - Allowed user roles
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
