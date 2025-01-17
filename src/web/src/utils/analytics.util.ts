import { round } from 'lodash'; // ^4.17.21
import {
  IMetric,
  IAggregatedMetrics,
  MetricType
} from '../interfaces/analytics.interface';
import { formatDate, getDateRange } from './date.util';

// Cache implementation for metric calculations
const metricCache = new Map<string, { value: number; timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

// Statistical constants for calculations
const CONFIDENCE_LEVEL = 0.95;
const OUTLIER_THRESHOLD = 2.5;
const TREND_SIGNIFICANCE_THRESHOLD = 0.1;

/**
 * Calculates the average value for a specific metric type with outlier removal
 * and confidence interval calculation
 */
export const calculateAverageMetric = (
  metrics: IMetric[],
  metricType: MetricType,
  cacheOptions: { useCache: boolean; cacheKey?: string } = { useCache: true }
): { average: number; confidenceInterval: number } => {
  if (!metrics?.length) {
    return { average: 0, confidenceInterval: 0 };
  }

  const cacheKey = cacheOptions.cacheKey || `${metricType}-${metrics.length}`;
  
  if (cacheOptions.useCache) {
    const cached = metricCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { average: cached.value, confidenceInterval: 0 };
    }
  }

  // Filter metrics by type and remove outliers
  const filteredMetrics = metrics
    .filter(m => m.type === metricType)
    .map(m => m.value);

  if (!filteredMetrics.length) {
    return { average: 0, confidenceInterval: 0 };
  }

  // Calculate mean and standard deviation
  const mean = filteredMetrics.reduce((sum, val) => sum + val, 0) / filteredMetrics.length;
  const stdDev = Math.sqrt(
    filteredMetrics.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / filteredMetrics.length
  );

  // Remove outliers
  const validMetrics = filteredMetrics.filter(
    val => Math.abs(val - mean) <= OUTLIER_THRESHOLD * stdDev
  );

  // Calculate weighted average based on recency
  const weightedSum = validMetrics.reduce((sum, val, idx) => {
    const weight = (idx + 1) / validMetrics.length;
    return sum + val * weight;
  }, 0);

  const average = round(weightedSum / validMetrics.length, 2);
  const confidenceInterval = round(
    CONFIDENCE_LEVEL * stdDev / Math.sqrt(validMetrics.length),
    2
  );

  if (cacheOptions.useCache) {
    metricCache.set(cacheKey, { value: average, timestamp: Date.now() });
  }

  return { average, confidenceInterval };
};

/**
 * Formats metric values for display with appropriate units and localization
 */
export const formatMetricValue = (
  value: number,
  metricType: MetricType,
  options: { locale?: string; precision?: number } = {}
): string => {
  const { locale = 'en-US', precision = 2 } = options;

  switch (metricType) {
    case MetricType.SUCCESS_RATE:
      return `${round(value * 100, precision)}%`;
    case MetricType.RESPONSE_TIME:
      return `${round(value, precision)}ms`;
    case MetricType.USAGE:
      return new Intl.NumberFormat(locale).format(round(value, precision));
    default:
      return round(value, precision).toString();
  }
};

/**
 * Aggregates metrics with trend analysis and automated insights
 */
export const aggregateMetrics = (
  metrics: IMetric[],
  timeRange: { startDate: Date; endDate: Date }
): IAggregatedMetrics => {
  const { startDate, endDate } = timeRange;
  const filteredMetrics = metrics.filter(
    m => new Date(m.timestamp) >= startDate && new Date(m.timestamp) <= endDate
  );

  const usage = calculateAverageMetric(filteredMetrics, MetricType.USAGE);
  const successRate = calculateSuccessRate(filteredMetrics);
  const responseTime = calculateAverageMetric(filteredMetrics, MetricType.RESPONSE_TIME);

  const trends = calculateTrends(filteredMetrics, timeRange);

  return {
    totalUsage: round(usage.average, 0),
    averageSuccessRate: round(successRate.average * 100, 2),
    averageResponseTime: round(responseTime.average, 2),
    errorRate: round((1 - successRate.average) * 100, 2),
    userSatisfactionScore: calculateUserSatisfactionScore(filteredMetrics),
    timeRange: {
      startDate,
      endDate,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    totalTokensUsed: calculateTotalTokens(filteredMetrics),
    totalCost: calculateTotalCost(filteredMetrics),
    averageIterationsPerPrompt: calculateAverageIterations(filteredMetrics),
    teamCollaborationScore: calculateCollaborationScore(filteredMetrics),
    trendData: trends
  };
};

/**
 * Calculates success rate with confidence intervals
 */
export const calculateSuccessRate = (
  metrics: IMetric[]
): { average: number; confidenceInterval: number } => {
  const successMetrics = metrics.filter(m => m.type === MetricType.SUCCESS_RATE);
  
  if (!successMetrics.length) {
    return { average: 0, confidenceInterval: 0 };
  }

  // Weight recent metrics more heavily
  const weightedSum = successMetrics.reduce((sum, metric, idx) => {
    const weight = (idx + 1) / successMetrics.length;
    return sum + (metric.value * weight);
  }, 0);

  const average = weightedSum / successMetrics.length;
  const variance = successMetrics.reduce(
    (sum, metric) => sum + Math.pow(metric.value - average, 2),
    0
  ) / successMetrics.length;

  return {
    average: round(average, 4),
    confidenceInterval: round(
      CONFIDENCE_LEVEL * Math.sqrt(variance / successMetrics.length),
      4
    )
  };
};

/**
 * Validates and sanitizes metric data inputs
 */
export const validateMetricData = (
  metrics: IMetric[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!Array.isArray(metrics)) {
    errors.push('Metrics must be an array');
    return { valid: false, errors };
  }

  metrics.forEach((metric, index) => {
    if (!metric.id) errors.push(`Metric at index ${index} missing id`);
    if (!metric.type) errors.push(`Metric at index ${index} missing type`);
    if (typeof metric.value !== 'number') {
      errors.push(`Metric at index ${index} has invalid value`);
    }
    if (!(metric.timestamp instanceof Date) && !Date.parse(metric.timestamp.toString())) {
      errors.push(`Metric at index ${index} has invalid timestamp`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Calculates metric trends and patterns over time
 */
export const calculateTrends = (
  metrics: IMetric[],
  timeRange: { startDate: Date; endDate: Date }
): Record<string, number[]> => {
  const trends: Record<string, number[]> = {};
  const { startDate, endDate } = timeRange;

  // Group metrics by day
  const dailyMetrics = metrics.reduce((acc, metric) => {
    const date = formatDate(metric.timestamp, 'YYYY-MM-DD');
    if (!acc[date]) acc[date] = [];
    acc[date].push(metric);
    return acc;
  }, {} as Record<string, IMetric[]>);

  // Calculate daily averages for each metric type
  Object.values(MetricType).forEach(type => {
    trends[type] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = formatDate(currentDate, 'YYYY-MM-DD');
      const dayMetrics = dailyMetrics[dateKey] || [];
      const average = calculateAverageMetric(dayMetrics, type as MetricType).average;
      trends[type].push(average);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  return trends;
};

/**
 * Generates automated insights from metrics data
 */
export const generateMetricInsights = (
  metrics: IMetric[]
): { insights: string[]; confidence: number }[] => {
  const insights: { insights: string[]; confidence: number }[] = [];
  
  // Analyze success rate trends
  const successTrend = calculateTrends(
    metrics.filter(m => m.type === MetricType.SUCCESS_RATE),
    { startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date() }
  );

  // Detect significant changes
  const significantChanges = Object.entries(successTrend).filter(([_, values]) => {
    const change = (values[values.length - 1] - values[0]) / values[0];
    return Math.abs(change) >= TREND_SIGNIFICANCE_THRESHOLD;
  });

  significantChanges.forEach(([metric, values]) => {
    const change = (values[values.length - 1] - values[0]) / values[0];
    insights.push({
      insights: [
        `${metric} has ${change > 0 ? 'increased' : 'decreased'} by ${round(Math.abs(change) * 100, 1)}% over the last 30 days`
      ],
      confidence: calculateConfidenceScore(values)
    });
  });

  return insights;
};

// Helper functions
const calculateUserSatisfactionScore = (metrics: IMetric[]): number => {
  const satisfactionMetrics = metrics.filter(m => m.type === MetricType.USER_SATISFACTION);
  return satisfactionMetrics.length
    ? round(calculateAverageMetric(satisfactionMetrics, MetricType.USER_SATISFACTION).average, 2)
    : 0;
};

const calculateTotalTokens = (metrics: IMetric[]): number => {
  return metrics
    .filter(m => m.type === MetricType.TOKEN_USAGE)
    .reduce((sum, m) => sum + m.value, 0);
};

const calculateTotalCost = (metrics: IMetric[]): number => {
  return round(
    metrics
      .filter(m => m.type === MetricType.COST_PER_PROMPT)
      .reduce((sum, m) => sum + m.value, 0),
    2
  );
};

const calculateAverageIterations = (metrics: IMetric[]): number => {
  const iterationMetrics = metrics.filter(m => m.type === MetricType.PROMPT_ITERATIONS);
  return iterationMetrics.length
    ? round(calculateAverageMetric(iterationMetrics, MetricType.PROMPT_ITERATIONS).average, 1)
    : 0;
};

const calculateCollaborationScore = (metrics: IMetric[]): number => {
  const collaborationMetrics = metrics.filter(m => m.type === MetricType.TEAM_COLLABORATION);
  return collaborationMetrics.length
    ? round(calculateAverageMetric(collaborationMetrics, MetricType.TEAM_COLLABORATION).average, 2)
    : 0;
};

const calculateConfidenceScore = (values: number[]): number => {
  const variance = values.reduce((sum, val) => sum + Math.pow(val - values[0], 2), 0) / values.length;
  return round(1 - Math.min(variance, 1), 2);
};