import React, { useMemo, useCallback, useRef, useEffect, memo } from 'react';
import {
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'; // ^2.7.0
import { useResizeObserver } from '@react-hook/resize-observer'; // ^1.2.0
import { throttle } from 'lodash'; // ^4.17.21

import { useAnalytics } from '../../hooks/useAnalytics';
import { IMetric, MetricType } from '../../interfaces/analytics.interface';
import { ChartContainer } from '../../styles/analytics.styles';

// Chart colors for different metric types
const CHART_COLORS = {
  [MetricType.USAGE]: '#4CAF50',
  [MetricType.SUCCESS_RATE]: '#2196F3',
  [MetricType.RESPONSE_TIME]: '#FFC107',
  [MetricType.ERROR_RATE]: '#F44336',
  [MetricType.USER_SATISFACTION]: '#9C27B0',
  [MetricType.PROMPT_ITERATIONS]: '#FF9800',
  [MetricType.TOKEN_USAGE]: '#00BCD4',
  [MetricType.COST_PER_PROMPT]: '#795548',
  [MetricType.TEAM_COLLABORATION]: '#3F51B5'
};

// Constants for performance optimization
const THROTTLE_DELAY = 100;
const MIN_DATA_POINTS = 10;
const MAX_DATA_POINTS = 1000;
const ANIMATION_DURATION = 300;

interface PerformanceGraphProps {
  metricTypes: MetricType[];
  height?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  tooltipFormatter?: (value: number, type: MetricType) => string;
}

interface FormattedMetricData {
  timestamp: string;
  [key: string]: number | string;
}

/**
 * Performance graph component for visualizing analytics metrics
 * Supports multiple metric types, real-time updates, and responsive design
 */
const PerformanceGraph = memo(({
  metricTypes,
  height = '400px',
  showLegend = true,
  showGrid = true,
  animate = true,
  tooltipFormatter
}: PerformanceGraphProps) => {
  // Hooks
  const containerRef = useRef<HTMLDivElement>(null);
  const { metrics, dateRange, isLoading } = useAnalytics();
  const size = useResizeObserver(containerRef);

  // Format metrics data for chart visualization
  const chartData = useMemo(() => {
    if (!metrics.length) return [];

    // Group metrics by timestamp
    const groupedMetrics = metrics.reduce<Record<string, FormattedMetricData>>((acc, metric) => {
      const timestamp = new Date(metric.timestamp).toISOString();
      if (!acc[timestamp]) {
        acc[timestamp] = { timestamp };
      }
      acc[timestamp][metric.type] = metric.value;
      return acc;
    }, {});

    // Convert to array and sort by timestamp
    let formattedData = Object.values(groupedMetrics)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Optimize data points for performance
    if (formattedData.length > MAX_DATA_POINTS) {
      const interval = Math.ceil(formattedData.length / MAX_DATA_POINTS);
      formattedData = formattedData.filter((_, index) => index % interval === 0);
    }

    return formattedData;
  }, [metrics]);

  // Format tooltip values with metric-specific formatting
  const formatTooltipValue = useCallback((value: number, type: MetricType): string => {
    if (tooltipFormatter) {
      return tooltipFormatter(value, type);
    }

    switch (type) {
      case MetricType.SUCCESS_RATE:
      case MetricType.ERROR_RATE:
        return `${(value * 100).toFixed(1)}%`;
      case MetricType.RESPONSE_TIME:
        return `${value.toFixed(0)}ms`;
      case MetricType.COST_PER_PROMPT:
        return `$${value.toFixed(3)}`;
      case MetricType.TOKEN_USAGE:
        return value.toLocaleString();
      default:
        return value.toFixed(2);
    }
  }, [tooltipFormatter]);

  // Handle window resize with throttling
  useEffect(() => {
    const handleResize = throttle(() => {
      if (containerRef.current) {
        containerRef.current.style.height = height;
      }
    }, THROTTLE_DELAY);

    handleResize();
    return () => handleResize.cancel();
  }, [height]);

  if (isLoading) {
    return (
      <ChartContainer ref={containerRef}>
        <div className="loading">Loading metrics data...</div>
      </ChartContainer>
    );
  }

  if (!chartData.length) {
    return (
      <ChartContainer ref={containerRef}>
        <div className="no-data">No metrics data available</div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer ref={containerRef}>
      <ResponsiveContainer width="100%" height={height}>
        <Line
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(0,0,0,0.1)"
            />
          )}
          
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
            minTickGap={30}
          />

          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(value) => value.toLocaleString()}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />

          <Tooltip
            formatter={(value: number, name: string) => [
              formatTooltipValue(value as number, name as MetricType),
              name
            ]}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />

          {showLegend && (
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => value.replace(/_/g, ' ')}
            />
          )}

          {metricTypes.map((metricType) => (
            <Line
              key={metricType}
              type="monotone"
              dataKey={metricType}
              name={metricType.replace(/_/g, ' ')}
              stroke={CHART_COLORS[metricType]}
              strokeWidth={2}
              dot={false}
              yAxisId={metricType.includes('RATE') ? 'right' : 'left'}
              animationDuration={animate ? ANIMATION_DURATION : 0}
              activeDot={{ r: 6 }}
            />
          ))}
        </Line>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

PerformanceGraph.displayName = 'PerformanceGraph';

export default PerformanceGraph;