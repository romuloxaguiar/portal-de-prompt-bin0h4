import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ROUTES } from './constants/routes.constant';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useCollaboration } from './hooks/useCollaboration';
import Loading from './components/common/Loading';

// Lazy-loaded page components
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const PromptLibrary = React.lazy(() => import('./pages/PromptLibrary'));
const PromptDetail = React.lazy(() => import('./pages/PromptDetail'));
const Settings = React.lazy(() => import('./pages/Settings'));
const TeamManagement = React.lazy(() => import('./pages/TeamManagement'));
const WorkspaceDetail = React.lazy(() => import('./pages/WorkspaceDetail'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

/**
 * Root application component implementing routing, authentication, and real-time features
 */
const App: React.FC = () => {
  const { theme, isHighContrast } = useTheme();
  const { isAuthenticated, validateSession } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize real-time collaboration
  const { connectionHealth } = useCollaboration('global', {
    autoConnect: true,
    enablePresence: true,
    heartbeatInterval: 30000
  });

  // Validate session on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await validateSession();
      } catch (error) {
        console.error('Session validation failed:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [validateSession]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Something went wrong</h2>
      <pre style={{ color: 'red' }}>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  if (!isInitialized) {
    return <Loading size="large" overlay ariaLabel="Initializing application..." />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AppLayout
            collaborationStatus={connectionHealth}
            highContrastMode={isHighContrast}
          >
            <Suspense fallback={<Loading overlay size="large" />}>
              <Routes>
                {/* Public routes */}
                <Route
                  path={ROUTES.LOGIN}
                  element={!isAuthenticated ? <Login /> : <Navigate to={ROUTES.DASHBOARD} replace />}
                />

                {/* Protected routes */}
                <Route
                  path={ROUTES.DASHBOARD}
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={ROUTES.ANALYTICS}
                  element={
                    <ProtectedRoute requiredRole="ADMIN">
                      <Analytics />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={ROUTES.PROMPT_LIBRARY}
                  element={
                    <ProtectedRoute>
                      <PromptLibrary />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={ROUTES.PROMPT_DETAIL}
                  element={
                    <ProtectedRoute>
                      <PromptDetail />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={ROUTES.SETTINGS}
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={ROUTES.TEAM_MANAGEMENT}
                  element={
                    <ProtectedRoute requiredRole="ADMIN">
                      <TeamManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={ROUTES.WORKSPACE_DETAIL}
                  element={
                    <ProtectedRoute>
                      <WorkspaceDetail />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all route */}
                <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
                <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
              </Routes>
            </Suspense>
          </AppLayout>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;