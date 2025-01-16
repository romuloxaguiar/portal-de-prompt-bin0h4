/**
 * Analytics Data Processing Utility
 * Provides enterprise-grade utilities for processing analytics data including aggregation,
 * transformation, and statistical analysis with enhanced security and performance optimization
 * @version 1.0.0
 */

import { Logger } from '../../../common/utils/logger.util';
import { MetricModel, METRIC_TYPES, IMetric } from '../models/metric.model';
import { ReportModel, ReportType } from '../models/report.model';
import dayjs from 'dayjs'; // v1.11.9
import lodash from 'lodash'; // v4.17.21

const logger = new Logger('DataProcessingUtil');

/**
 * Interface for metric aggregation options
 */
interface AggregateOptions {
  timeWindow?: string;
  metrics?: METRIC_TYPES[];
  groupBy?: string[];
  includeRawData?: boolean;
}

/**
 * Interface for time series processing options
 */
interface TimeSeriesOptions {
  interval: string;
  aggregationType: 'sum' | 'avg' | 'min' | 'max';
  smoothing?: boolean;
  fillGaps?: boolean;
}

/**
 * Interface for ROI calculation configuration
 */
interface ROIConfig {
  costMetrics: string[];
  benefitMetrics: string[];
  timeframe: string;
  currency?: string;
}

/**
 * Interface for aggregated metrics result
 */
interface AggregatedMetrics {
  summary: {
    total: number;
    timeframe: {
      start: Date;
      end: Date;
    };
  };
  metrics: {
    [key: string]: {
      mean: number;
      median: number;
      stdDev: number;
      min: number;
      max: number;
      count: number;
    };
  };
  trends: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
  };
}

/**
 * Calculates aggregate statistics for a set of metrics with enhanced security and performance
 */
export async function calculateMetricAggregates(
  metrics: IMetric[],
  options: AggregateOptions
): Promise<AggregatedMetrics> {
  try {
    logger.debug('Starting metric aggregation', { metricCount: metrics.length });

    // Apply data masking for sensitive metrics
    const sanitizedMetrics = metrics.map(metric => ({
      ...metric,
      metadata: lodash.omit(metric.metadata, ['userEmail', 'ipAddress'])
    }));

    // Group metrics by type
    const groupedMetrics = lodash.groupBy(sanitizedMetrics, 'metricType');
    const results: AggregatedMetrics = {
      summary: {
        total: metrics.length,
        timeframe: {
          start: lodash.minBy(metrics, 'timestamp')?.timestamp || new Date(),
          end: lodash.maxBy(metrics, 'timestamp')?.timestamp || new Date()
        }
      },
      metrics: {},
      trends: {
        direction: 'stable',
        changePercent: 0
      }
    };

    // Calculate statistics for each metric type
    for (const [metricType, typeMetrics] of Object.entries(groupedMetrics)) {
      const values = typeMetrics.map(m => m.value);
      const sortedValues = [...values].sort((a, b) => a - b);

      results.metrics[metricType] = {
        mean: lodash.mean(values) || 0,
        median: calculateMedian(sortedValues),
        stdDev: calculateStandardDeviation(values),
        min: lodash.min(values) || 0,
        max: lodash.max(values) || 0,
        count: values.length
      };
    }

    // Calculate overall trend
    results.trends = calculateTrend(metrics);

    logger.debug('Completed metric aggregation', { resultSize: Object.keys(results.metrics).length });
    return results;
  } catch (error) {
    logger.error('Error in metric aggregation', { error });
    throw error;
  }
}

/**
 * Processes time series metrics data for visualization with enhanced performance
 */
export async function processTimeSeriesData(
  metrics: IMetric[],
  options: TimeSeriesOptions
): Promise<any> {
  try {
    logger.debug('Processing time series data', { options });

    const timeGroups = new Map<string, IMetric[]>();
    const interval = dayjs.duration(options.interval);

    // Group metrics by time interval
    metrics.forEach(metric => {
      const timeKey = dayjs(metric.timestamp)
        .startOf(options.interval as any)
        .format('YYYY-MM-DD HH:mm:ss');
      
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)?.push(metric);
    });

    // Apply aggregation for each time group
    const timeSeriesData = Array.from(timeGroups.entries()).map(([timeKey, groupMetrics]) => {
      const values = groupMetrics.map(m => m.value);
      let aggregatedValue: number;

      switch (options.aggregationType) {
        case 'sum':
          aggregatedValue = lodash.sum(values);
          break;
        case 'min':
          aggregatedValue = lodash.min(values) || 0;
          break;
        case 'max':
          aggregatedValue = lodash.max(values) || 0;
          break;
        case 'avg':
        default:
          aggregatedValue = lodash.mean(values) || 0;
      }

      return {
        timestamp: timeKey,
        value: aggregatedValue,
        count: values.length
      };
    });

    // Apply optional smoothing
    if (options.smoothing) {
      return applyMovingAverage(timeSeriesData, 3);
    }

    return timeSeriesData;
  } catch (error) {
    logger.error('Error processing time series data', { error });
    throw error;
  }
}

/**
 * Calculates ROI and business impact metrics with enhanced security
 */
export async function calculateROIMetrics(
  metrics: IMetric[],
  config: ROIConfig
): Promise<any> {
  try {
    logger.debug('Calculating ROI metrics', { config });

    const costMetrics = metrics.filter(m => 
      config.costMetrics.includes(m.metricType));
    const benefitMetrics = metrics.filter(m => 
      config.benefitMetrics.includes(m.metricType));

    const totalCost = lodash.sumBy(costMetrics, 'value');
    const totalBenefit = lodash.sumBy(benefitMetrics, 'value');

    const roi = ((totalBenefit - totalCost) / totalCost) * 100;
    const paybackPeriod = totalCost / (totalBenefit / metrics.length);

    return {
      roi: Number(roi.toFixed(2)),
      paybackPeriod: Number(paybackPeriod.toFixed(2)),
      metrics: {
        totalCost,
        totalBenefit,
        netBenefit: totalBenefit - totalCost
      },
      currency: config.currency || 'USD',
      timeframe: config.timeframe,
      confidence: calculateConfidenceScore(metrics)
    };
  } catch (error) {
    logger.error('Error calculating ROI metrics', { error });
    throw error;
  }
}

/**
 * Generates a comprehensive performance report with enhanced validation
 */
export async function generatePerformanceReport(
  workspaceId: string,
  dateRange: { start: Date; end: Date }
): Promise<any> {
  try {
    logger.debug('Generating performance report', { workspaceId, dateRange });

    const metrics = await MetricModel.findByDateRange(dateRange, { workspaceId });
    
    const report = {
      overview: await calculateMetricAggregates(metrics, {
        timeWindow: '1d',
        metrics: [METRIC_TYPES.USAGE, METRIC_TYPES.SUCCESS_RATE]
      }),
      timeSeries: await processTimeSeriesData(metrics, {
        interval: '1h',
        aggregationType: 'avg',
        smoothing: true
      }),
      roi: await calculateROIMetrics(metrics, {
        costMetrics: [METRIC_TYPES.COST_SAVINGS],
        benefitMetrics: [METRIC_TYPES.ROI],
        timeframe: '30d'
      }),
      recommendations: generateRecommendations(metrics)
    };

    return report;
  } catch (error) {
    logger.error('Error generating performance report', { error });
    throw error;
  }
}

/**
 * Helper function to calculate median with numerical stability
 */
function calculateMedian(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

/**
 * Helper function to calculate standard deviation with enhanced precision
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = lodash.mean(values) || 0;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return Math.sqrt(lodash.mean(squareDiffs) || 0);
}

/**
 * Helper function to calculate trend direction and magnitude
 */
function calculateTrend(metrics: IMetric[]): { direction: 'up' | 'down' | 'stable'; changePercent: number } {
  if (metrics.length < 2) {
    return { direction: 'stable', changePercent: 0 };
  }

  const sortedMetrics = lodash.sortBy(metrics, 'timestamp');
  const firstValue = sortedMetrics[0].value;
  const lastValue = sortedMetrics[sortedMetrics.length - 1].value;
  const changePercent = ((lastValue - firstValue) / firstValue) * 100;

  return {
    direction: changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'stable',
    changePercent: Number(changePercent.toFixed(2))
  };
}

/**
 * Helper function to apply moving average smoothing
 */
function applyMovingAverage(data: any[], windowSize: number): any[] {
  return data.map((item, index) => {
    const window = data.slice(
      Math.max(0, index - windowSize + 1),
      index + 1
    );
    return {
      ...item,
      value: lodash.mean(window.map(w => w.value)) || 0
    };
  });
}

/**
 * Helper function to calculate confidence score for metrics
 */
function calculateConfidenceScore(metrics: IMetric[]): number {
  const sampleSize = metrics.length;
  const variability = calculateStandardDeviation(metrics.map(m => m.value));
  const timeSpan = dayjs(lodash.maxBy(metrics, 'timestamp')?.timestamp)
    .diff(dayjs(lodash.minBy(metrics, 'timestamp')?.timestamp), 'day');

  // Calculate confidence score based on sample size, variability, and time span
  const score = Math.min(
    100,
    (Math.log10(sampleSize) * 20) +
    (Math.max(0, 100 - variability)) * 0.4 +
    (Math.min(timeSpan, 30) / 30) * 40
  );

  return Number(score.toFixed(2));
}

/**
 * Helper function to generate recommendations based on metrics
 */
function generateRecommendations(metrics: IMetric[]): string[] {
  const recommendations: string[] = [];
  const successRate = lodash.meanBy(
    metrics.filter(m => m.metricType === METRIC_TYPES.SUCCESS_RATE),
    'value'
  ) || 0;

  const responseTime = lodash.meanBy(
    metrics.filter(m => m.metricType === METRIC_TYPES.RESPONSE_TIME),
    'value'
  ) || 0;

  if (successRate < 90) {
    recommendations.push('Consider reviewing and optimizing prompt templates to improve success rate');
  }

  if (responseTime > 2000) {
    recommendations.push('Response times are above target. Consider implementing caching or optimization strategies');
  }

  return recommendations;
}