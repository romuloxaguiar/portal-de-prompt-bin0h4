import React, { useEffect, useMemo, useCallback } from 'react';
import { Container, Typography, CircularProgress, Alert } from '@mui/material';
import { AppLayout } from '../components/layout/AppLayout';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useAnalytics } from '../hooks/useAnalytics';
import { IDateRange } from '../interfaces/analytics.interface';

/**
 * Analytics page component that serves as the main analytics dashboard view.
 * Implements comprehensive metrics visualization with real-time updates and filtering.
 */
const Analytics: React.FC = () => {
  // Initialize analytics hook with caching and real-time updates
  const {
    metrics,
    aggregatedMetrics,
    dateRange,
    handleDateRangeChange,
    isLoading,
    error,
    isSyncing,
    clearAnalyticsCache
  } = useAnalytics({
    batchEvents: true,
    cacheResults: true,
    retryOnFailure: true
  });

  // Initialize default date range
  const initialDateRange: IDateRange = useMemo(() => ({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }), []);

  // Handle date range changes with analytics refresh
  const handleDateChange = useCallback((newDateRange: IDateRange) => {
    handleDateRangeChange(newDateRange);
  }, [handleDateRangeChange]);

  // Clear cache and refresh data on mount
  useEffect(() => {
    const initializeAnalytics = async () => {
      await clearAnalyticsCache();
      handleDateRangeChange(initialDateRange);
    };

    initializeAnalytics();
  }, [clearAnalyticsCache, handleDateRangeChange, initialDateRange]);

  // Error boundary fallback UI
  const errorFallback = useMemo(() => (
    <Container>
      <Alert 
        severity="error"
        sx={{ mt: 3 }}
        action={
          <button onClick={() => handleDateRangeChange(dateRange)}>
            Retry
          </button>
        }
      >
        Failed to load analytics dashboard. Please try again.
      </Alert>
    </Container>
  ), [dateRange, handleDateRangeChange]);

  return (
    <ErrorBoundary fallback={errorFallback}>
      <AppLayout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom
            sx={{ mb: 4 }}
          >
            Analytics Dashboard
          </Typography>

          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ mb: 4 }}
          >
            Monitor prompt performance, usage patterns, and team collaboration metrics
          </Typography>

          {isLoading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '400px' 
            }}>
              <CircularProgress 
                size={40}
                aria-label="Loading analytics data"
              />
            </div>
          ) : error ? (
            <Alert 
              severity="error"
              sx={{ mb: 3 }}
              action={
                <button onClick={() => handleDateRangeChange(dateRange)}>
                  Retry
                </button>
              }
            >
              {error}
            </Alert>
          ) : (
            <AnalyticsDashboard
              workspaceId="global"
              initialDateRange={initialDateRange}
              onDateRangeChange={handleDateChange}
              metrics={metrics}
              aggregatedMetrics={aggregatedMetrics}
              isSyncing={isSyncing}
            />
          )}
        </Container>
      </AppLayout>
    </ErrorBoundary>
  );
};

export default Analytics;