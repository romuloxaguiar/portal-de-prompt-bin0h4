import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Skeleton,
  Alert,
  Tooltip
} from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro';
import { MetricsCard } from './MetricsCard';
import { AnalyticsChart } from './AnalyticsChart';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricType, IDateRange } from '../../interfaces/analytics.interface';

interface AnalyticsDashboardProps {
  workspaceId: string;
  initialDateRange?: IDateRange;
  onError?: (error: Error) => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  workspaceId,
  initialDateRange,
  onError
}) => {
  // Refs for resize handling and performance optimization
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Analytics hook for data management
  const {
    metrics,
    aggregatedMetrics,
    dateRange,
    handleDateRangeChange,
    isLoading,
    error,
    isSyncing
  } = useAnalytics(initialDateRange || {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Calculate trends for metrics cards
  const trends = useMemo(() => ({
    usage: calculateTrend(aggregatedMetrics.totalUsage, metrics),
    successRate: calculateTrend(aggregatedMetrics.averageSuccessRate, metrics),
    responseTime: calculateTrend(aggregatedMetrics.averageResponseTime, metrics),
    cost: calculateTrend(aggregatedMetrics.totalCost, metrics)
  }), [aggregatedMetrics, metrics]);

  // Handle date range changes
  const handleDateChange = useCallback((newDateRange: IDateRange) => {
    handleDateRangeChange({
      ...newDateRange,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }, [handleDateRangeChange]);

  // Export metrics data
  const handleExport = useCallback(async (format: 'CSV' | 'PDF') => {
    try {
      const data = await formatExportData(metrics, format);
      downloadExportFile(data, format, `analytics_export_${Date.now()}`);
    } catch (error) {
      console.error('Export failed:', error);
      if (onError) onError(error as Error);
    }
  }, [metrics, onError]);

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ mb: 2 }}
        action={
          <Tooltip title="Retry loading analytics">
            <button onClick={() => handleDateRangeChange(dateRange)}>
              Retry
            </button>
          </Tooltip>
        }
      >
        Failed to load analytics: {error.message}
      </Alert>
    );
  }

  return (
    <div ref={dashboardRef} role="region" aria-label="Analytics Dashboard">
      <Grid container spacing={3}>
        {/* Header with date range picker */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h1">
              Analytics Dashboard
              {isSyncing && (
                <Tooltip title="Syncing latest data...">
                  <span className="sync-indicator" aria-label="syncing">⟳</span>
                </Tooltip>
              )}
            </Typography>
            <DateRangePicker
              value={[dateRange.startDate, dateRange.endDate]}
              onChange={(newValue) => {
                if (newValue[0] && newValue[1]) {
                  handleDateChange({
                    startDate: newValue[0],
                    endDate: newValue[1],
                    timezone: dateRange.timezone
                  });
                }
              }}
              renderInput={(startProps, endProps) => (
                <>
                  <input {...startProps} />
                  <input {...endProps} />
                </>
              )}
            />
          </Paper>
        </Grid>

        {/* Metrics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="Total Usage"
            type={MetricType.USAGE}
            value={aggregatedMetrics.totalUsage}
            trend={trends.usage}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="Success Rate"
            type={MetricType.SUCCESS_RATE}
            value={aggregatedMetrics.averageSuccessRate}
            trend={trends.successRate}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="Avg Response Time"
            type={MetricType.RESPONSE_TIME}
            value={aggregatedMetrics.averageResponseTime}
            trend={trends.responseTime}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="Total Cost"
            type={MetricType.COST_PER_PROMPT}
            value={aggregatedMetrics.totalCost}
            trend={trends.cost}
          />
        </Grid>

        {/* Analytics Charts */}
        <Grid item xs={12} md={8}>
          <AnalyticsChart
            title="Usage Over Time"
            metricType={MetricType.USAGE}
            workspaceId={workspaceId}
            chartType="area"
            showControls={true}
            enableExport={true}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <AnalyticsChart
            title="Success Rate Trend"
            metricType={MetricType.SUCCESS_RATE}
            workspaceId={workspaceId}
            chartType="line"
            showControls={false}
          />
        </Grid>
        <Grid item xs={12}>
          <AnalyticsChart
            title="Response Time Distribution"
            metricType={MetricType.RESPONSE_TIME}
            workspaceId={workspaceId}
            chartType="bar"
            showControls={true}
            enableExport={true}
          />
        </Grid>
      </Grid>
    </div>
  );
};

// Helper function to calculate trends
const calculateTrend = (currentValue: number, metrics: any[]): number => {
  if (!metrics.length) return 0;
  const previousValue = metrics[metrics.length - 2]?.value || currentValue;
  return ((currentValue - previousValue) / previousValue) * 100;
};

// Helper function to format export data
const formatExportData = async (metrics: any[], format: string): Promise<Blob> => {
  // Implementation would go here
  return new Blob();
};

// Helper function to download export file
const downloadExportFile = (data: Blob, format: string, filename: string): void => {
  // Implementation would go here
};

export default AnalyticsDashboard;