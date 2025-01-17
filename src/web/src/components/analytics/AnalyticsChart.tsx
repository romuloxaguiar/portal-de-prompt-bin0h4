import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'; // ^2.7.0
import { useAnalytics } from '../../hooks/useAnalytics';
import {
  IMetric,
  MetricType,
  IAggregatedMetrics,
  ChartType,
  IDateRange
} from '../../interfaces/analytics.interface';

// Chart color constants
const CHART_COLORS = {
  USAGE: '#8884d8',
  SUCCESS_RATE: '#82ca9d',
  RESPONSE_TIME: '#ffc658',
  ERROR_RATE: '#ff7300',
  COMPLETION_RATE: '#8dd1e1',
  ROI: '#a4de6c'
};

// Chart configuration defaults
const CHART_DEFAULTS = {
  height: 400,
  margin: { top: 20, right: 30, left: 20, bottom: 30 },
  animationDuration: 300,
  tooltipDebounce: 100,
  exportFormats: ['PNG', 'SVG', 'CSV'],
  accessibilityLabels: {
    chartRole: 'img',
    chartLabel: 'Analytics visualization'
  }
};

interface AnalyticsChartProps {
  title: string;
  metricType: MetricType;
  workspaceId: string;
  chartType: ChartType;
  showControls?: boolean;
  enableExport?: boolean;
  refreshInterval?: number;
  timezone?: string;
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  title,
  metricType,
  workspaceId,
  chartType,
  showControls = true,
  enableExport = true,
  refreshInterval = 30000,
  timezone = 'UTC'
}) => {
  // Refs for resize handling and export
  const chartRef = useRef<HTMLDivElement>(null);
  const exportTimeoutRef = useRef<NodeJS.Timeout>();

  // Analytics hook for data fetching and state management
  const {
    metrics,
    aggregatedMetrics,
    dateRange,
    isLoading,
    error,
    handleDateRangeChange
  } = useAnalytics({
    batchEvents: true,
    cacheResults: true,
    retryOnFailure: true
  });

  // Format chart data with timezone support
  const formatChartData = useCallback((metrics: IMetric[], timezone: string) => {
    return metrics
      .filter(metric => metric.type === metricType)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(metric => ({
        timestamp: new Date(metric.timestamp).toLocaleString('en-US', { timeZone: timezone }),
        value: metric.value,
        metadata: metric.metadata
      }));
  }, [metricType]);

  // Memoized chart configuration
  const chartConfig = useMemo(() => {
    const config = {
      xAxisLabel: 'Time',
      yAxisLabel: metricType.replace(/_/g, ' ').toLowerCase(),
      color: CHART_COLORS[metricType] || CHART_COLORS.USAGE,
      tooltipFormatter: (value: number) => `${value.toFixed(2)}`,
      dataKey: 'value'
    };

    return config;
  }, [metricType]);

  // Memoized chart data
  const chartData = useMemo(() => {
    return formatChartData(metrics, timezone);
  }, [metrics, formatChartData, timezone]);

  // Handle chart export
  const handleExport = useCallback(async (format: string) => {
    if (!chartRef.current) return;

    try {
      if (format === 'CSV') {
        const csvContent = chartData
          .map(row => `${row.timestamp},${row.value}`)
          .join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}_${new Date().toISOString()}.csv`;
        link.click();
      } else {
        // SVG/PNG export implementation would go here
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [chartData, title]);

  // Render chart based on type
  const renderChart = useCallback(() => {
    const commonProps = {
      data: chartData,
      margin: CHART_DEFAULTS.margin,
      role: CHART_DEFAULTS.accessibilityLabels.chartRole,
      'aria-label': `${title} ${CHART_DEFAULTS.accessibilityLabels.chartLabel}`
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" label={{ value: chartConfig.xAxisLabel, position: 'bottom' }} />
            <YAxis label={{ value: chartConfig.yAxisLabel, angle: -90, position: 'left' }} />
            <Tooltip formatter={chartConfig.tooltipFormatter} />
            <Legend />
            <Line
              type="monotone"
              dataKey={chartConfig.dataKey}
              stroke={chartConfig.color}
              animationDuration={CHART_DEFAULTS.animationDuration}
              dot={false}
            />
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" label={{ value: chartConfig.xAxisLabel, position: 'bottom' }} />
            <YAxis label={{ value: chartConfig.yAxisLabel, angle: -90, position: 'left' }} />
            <Tooltip formatter={chartConfig.tooltipFormatter} />
            <Legend />
            <Bar
              dataKey={chartConfig.dataKey}
              fill={chartConfig.color}
              animationDuration={CHART_DEFAULTS.animationDuration}
            />
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" label={{ value: chartConfig.xAxisLabel, position: 'bottom' }} />
            <YAxis label={{ value: chartConfig.yAxisLabel, angle: -90, position: 'left' }} />
            <Tooltip formatter={chartConfig.tooltipFormatter} />
            <Legend />
            <Area
              type="monotone"
              dataKey={chartConfig.dataKey}
              stroke={chartConfig.color}
              fill={chartConfig.color}
              animationDuration={CHART_DEFAULTS.animationDuration}
            />
          </AreaChart>
        );

      default:
        return null;
    }
  }, [chartType, chartData, chartConfig, title]);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const intervalId = setInterval(() => {
      handleDateRangeChange(dateRange);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, handleDateRangeChange, dateRange]);

  if (error) {
    return (
      <div role="alert" className="analytics-chart-error">
        Error loading chart: {error.message}
      </div>
    );
  }

  return (
    <div className="analytics-chart" ref={chartRef}>
      <div className="analytics-chart-header">
        <h3>{title}</h3>
        {showControls && (
          <div className="analytics-chart-controls">
            {enableExport && (
              <div className="export-controls">
                {CHART_DEFAULTS.exportFormats.map(format => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    className="export-button"
                  >
                    Export {format}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="analytics-chart-container" style={{ height: CHART_DEFAULTS.height }}>
        {isLoading ? (
          <div className="analytics-chart-loading">Loading chart data...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default AnalyticsChart;