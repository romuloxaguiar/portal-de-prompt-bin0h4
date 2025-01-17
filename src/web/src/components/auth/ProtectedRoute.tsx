import React from 'react'; // v18.0.0
import { Navigate, useLocation } from 'react-router-dom'; // v6.0.0
import Loading from '../common/Loading';
import { useAuth } from '../../hooks/useAuth';

/**
 * Props interface for the ProtectedRoute component with enhanced security options
 */
interface ProtectedRouteProps {
  /** Child components to render when authenticated and authorized */
  children: React.ReactNode;
  /** Path to redirect to when unauthenticated */
  redirectPath?: string;
  /** Optional role requirement for accessing the route */
  requiredRole?: string;
  /** Custom message to display during authentication check */
  loadingMessage?: string;
}

/**
 * Higher-order component that protects routes by enforcing authentication
 * and optional role-based authorization
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = React.memo(({
  children,
  redirectPath = '/login',
  requiredRole,
  loadingMessage = 'Verifying authentication...'
}) => {
  const { isAuthenticated, loading, hasRequiredRole } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <Loading 
        overlay={true}
        size="large"
        color="primary"
        ariaLabel={loadingMessage}
      />
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Preserve the attempted URL for post-login redirect
    return (
      <Navigate 
        to={redirectPath} 
        replace={true}
        state={{ from: location, reason: 'authentication_required' }}
      />
    );
  }

  // Check role-based access if required
  if (requiredRole && !hasRequiredRole(requiredRole)) {
    return (
      <Navigate 
        to="/unauthorized" 
        replace={true}
        state={{ 
          from: location,
          reason: 'insufficient_permissions',
          requiredRole 
        }}
      />
    );
  }

  // Render protected content if all checks pass
  return <>{children}</>;
});

// Set display name for debugging
ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute;