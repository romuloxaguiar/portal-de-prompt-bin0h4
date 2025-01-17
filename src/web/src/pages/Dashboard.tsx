import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Grid, Paper, Typography, Box, Skeleton, Alert, Tooltip } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal components
import AppLayout from '../components/layout/AppLayout';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import WorkspaceList from '../components/workspace/WorkspaceList';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

// Types and interfaces
import { Workspace } from '../interfaces/workspace.interface';
import { IDateRange } from '../interfaces/analytics.interface';

/**
 * Main dashboard component providing overview of the Prompts Portal platform
 * Implements real-time updates, analytics, and workspace management
 */
const Dashboard: React.FC = () => {
  // State management
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [dateRange, setDateRange] = useState<IDateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [error, setError] = useState<Error | null>(null);

  // Hooks
  const { user } = useAuth();
  const { connect, subscribe, connectionHealth } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}/dashboard`,
    {
      autoConnect: true,
      enablePresence: true,
      heartbeatInterval: 30000
    }
  );

  // Initialize WebSocket connection
  useEffect(() => {
    if (user) {
      connect().catch(error => {
        console.error('WebSocket connection failed:', error);
        setError(error);
      });
    }
  }, [user, connect]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (selectedWorkspace) {
      subscribe('workspace_update', (update: any) => {
        if (update.workspaceId === selectedWorkspace.id) {
          setSelectedWorkspace(prev => ({ ...prev!, ...update }));
        }
      });
    }
  }, [selectedWorkspace, subscribe]);

  // Handle workspace selection
  const handleWorkspaceSelect = useCallback((workspace: Workspace) => {
    setSelectedWorkspace(workspace);
  }, []);

  // Handle error display and recovery
  const handleError = useCallback((error: Error) => {
    console.error('Dashboard error:', error);
    setError(error);
  }, []);

  // Memoized date range for analytics
  const analyticsDateRange = useMemo(() => ({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    timezone: dateRange.timezone
  }), [dateRange]);

  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error" sx={{ m: 2 }}>
          Something went wrong. Please refresh the page or contact support.
        </Alert>
      }
      onError={handleError}
    >
      <AppLayout>
        <Box sx={{ p: 3 }}>
          {/* Dashboard Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Dashboard
              {connectionHealth.isHealthy && (
                <Tooltip title="Real-time updates active">
                  <Box component="span" sx={{ ml: 1, color: 'success.main' }}>
                    ●
                  </Box>
                </Tooltip>
              )}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Welcome back, {user?.firstName}! Here's an overview of your prompts and analytics.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* Analytics Section */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
                  <AnalyticsDashboard
                    workspaceId={selectedWorkspace?.id || user?.workspaceId}
                    initialDateRange={analyticsDateRange}
                    onError={handleError}
                  />
                </Suspense>
              </Paper>
            </Grid>

            {/* Workspaces Section */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Your Workspaces
                </Typography>
                <Suspense fallback={<Skeleton variant="rectangular" height={200} />}>
                  <WorkspaceList
                    teamId={user?.workspaceId}
                    onWorkspaceSelect={handleWorkspaceSelect}
                    viewMode="grid"
                    sortBy="lastActivity"
                  />
                </Suspense>
              </Paper>
            </Grid>
          </Grid>

          {/* Error Display */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mt: 2 }}
              onClose={() => setError(null)}
            >
              {error.message}
            </Alert>
          )}
        </Box>
      </AppLayout>
    </ErrorBoundary>
  );
};

export default Dashboard;