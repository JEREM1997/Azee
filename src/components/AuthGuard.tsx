import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const AuthGuard: React.FC = () => {
  const { user, loading, isAdmin, isProduction } = useAuth();
  const location = useLocation();
  const fallbackRoute = isAdmin ? '/dashboard' : isProduction ? '/plans' : '/orders';

  if (loading) {
    return <LoadingSpinner fullScreen message="Checking authentication..." />;
  }

  if (!user) {
    // Redirect to login page but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based route protection
  const adminOnlyRoutes = ['/dashboard', '/production', '/admin', '/users', '/users/create', '/stats', '/audit'];
  const productionRoutes = ['/plans'];

  const isAdminRoute = adminOnlyRoutes.some(route => location.pathname.startsWith(route));
  const isProductionRoute = productionRoutes.some(route => location.pathname.startsWith(route));

  if (isAdminRoute && !isAdmin) {
   return <Navigate to={fallbackRoute} replace />; 
  }

  if (isProductionRoute && !isProduction && !isAdmin) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return <Outlet />;
};

export default AuthGuard;
