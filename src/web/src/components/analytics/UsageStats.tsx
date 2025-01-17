import React, { useMemo, useCallback, useEffect } from 'react';
import { format } from 'date-fns'; // ^2.30.0
import { useAnalytics } from '../../hooks/useAnalytics';
import Card from '../common/Card';
import ErrorBoundary from '../common/ErrorBoundary';
import { IMetric, MetricType } from '../../interfaces/analytics.interface';
import { theme } from '../../styles/theme.styles';

interface UsageStatsProps {
  workspaceId?: string;
  promptId?: string;
  className?: string;
  dateRange?: { start: Date; end: Date };
  refreshInterval?: number;
}

const UsageStats: React.FC<UsageStatsProps> = ({
  workspaceId,
  promptId,
  className,
  dateRange,
  refreshInterval = 30000 // Default 30s refresh
}) => {
  // Analytics hook with error handling
  const { metrics, aggregatedMetrics, isLoading, error } = useAnalytics({
    dateRange: dateRange ? {
      startDate: dateRange.start,
      endDate: dateRange.end,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    } : undefined,
    batchEvents: true,
    cacheResults: true,
    retryOnFailure: true
  });

  // Format metric values based on type
  const formatMetricValue = useCallback((value: number, type: MetricType, locale: string = 'en-US'): string => {
    switch (type) {
      case MetricType.SUCCESS_RATE:
      case MetricType.ERROR_RATE:
        return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
      case MetricType.RESPONSE_TIME:
        return `${value.toFixed(0)}ms`;
      case MetricType.COST_PER_PROMPT:
        return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
      case MetricType.TOKEN_USAGE:
        return new Intl.NumberFormat(locale, { notation: 'compact' }).format(value);
      default:
        return new Intl.NumberFormat(locale).format(value);
    }
  }, []);

  // Calculate trends for metrics
  const calculateTrends = useMemo(() => {
    if (!metrics.length) return {};

    const trends: Record<string, { direction: 'up' | 'down' | 'stable', percentage: number }> = {};
    const metricTypes = Object.values(MetricType);

    metricTypes.forEach(type => {
      const typeMetrics = metrics.filter(m => m.type === type);
      if (typeMetrics.length < 2) return;

      const sorted = [...typeMetrics].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const current = sorted[0].value;
      const previous = sorted[1].value;
      const change = ((current - previous) / previous) * 100;

      trends[type] = {
        direction: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
        percentage: Math.abs(change)
      };
    });

    return trends;
  }, [metrics]);

  // Auto-refresh metrics
  useEffect(() => {
    if (!refreshInterval) return;

    const intervalId = setInterval(() => {
      // Analytics hook will handle the refresh
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Loading state
  if (isLoading) {
    return (
      <div className={className} aria-busy="true" role="status">
        <Card elevation={1} className="usage-stats-loading">
          <div className="loading-skeleton" />
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card elevation={1} className={`usage-stats-error ${className}`} role="alert">
        <h3>Unable to load analytics</h3>
        <p>{error.message}</p>
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <div 
        className={`usage-stats-grid ${className}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: theme.spacing(2),
          width: '100%'
        }}
      >
        {/* Total Usage Card */}
        <Card 
          elevation={1}
          className="metric-card"
          aria-label="Total Usage Statistics"
        >
          <h3>Total Usage</h3>
          <div className="metric-value">
            {formatMetricValue(aggregatedMetrics.totalUsage, MetricType.USAGE)}
          </div>
          {calculateTrends()[MetricType.USAGE] && (
            <div className="trend-indicator" aria-label={`Trend: ${calculateTrends()[MetricType.USAGE]?.direction}`}>
              {calculateTrends()[MetricType.USAGE]?.percentage.toFixed(1)}% {calculateTrends()[MetricType.USAGE]?.direction}
            </div>
          )}
        </Card>

        {/* Success Rate Card */}
        <Card 
          elevation={1}
          className="metric-card"
          aria-label="Success Rate Statistics"
        >
          <h3>Success Rate</h3>
          <div className="metric-value">
            {formatMetricValue(aggregatedMetrics.averageSuccessRate, MetricType.SUCCESS_RATE)}
          </div>
          {calculateTrends()[MetricType.SUCCESS_RATE] && (
            <div className="trend-indicator" aria-label={`Trend: ${calculateTrends()[MetricType.SUCCESS_RATE]?.direction}`}>
              {calculateTrends()[MetricType.SUCCESS_RATE]?.percentage.toFixed(1)}% {calculateTrends()[MetricType.SUCCESS_RATE]?.direction}
            </div>
          )}
        </Card>

        {/* Response Time Card */}
        <Card 
          elevation={1}
          className="metric-card"
          aria-label="Response Time Statistics"
        >
          <h3>Avg Response Time</h3>
          <div className="metric-value">
            {formatMetricValue(aggregatedMetrics.averageResponseTime, MetricType.RESPONSE_TIME)}
          </div>
          {calculateTrends()[MetricType.RESPONSE_TIME] && (
            <div className="trend-indicator" aria-label={`Trend: ${calculateTrends()[MetricType.RESPONSE_TIME]?.direction}`}>
              {calculateTrends()[MetricType.RESPONSE_TIME]?.percentage.toFixed(1)}% {calculateTrends()[MetricType.RESPONSE_TIME]?.direction}
            </div>
          )}
        </Card>

        {/* Cost Analysis Card */}
        <Card 
          elevation={1}
          className="metric-card"
          aria-label="Cost Analysis Statistics"
        >
          <h3>Total Cost</h3>
          <div className="metric-value">
            {formatMetricValue(aggregatedMetrics.totalCost, MetricType.COST_PER_PROMPT)}
          </div>
          {calculateTrends()[MetricType.COST_PER_PROMPT] && (
            <div className="trend-indicator" aria-label={`Trend: ${calculateTrends()[MetricType.COST_PER_PROMPT]?.direction}`}>
              {calculateTrends()[MetricType.COST_PER_PROMPT]?.percentage.toFixed(1)}% {calculateTrends()[MetricType.COST_PER_PROMPT]?.direction}
            </div>
          )}
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(UsageStats);