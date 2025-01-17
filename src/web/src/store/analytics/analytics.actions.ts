import { Dispatch } from 'redux';
import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { debounce, memoize } from 'lodash';

import {
  AnalyticsActionTypes,
  AnalyticsAction,
  FetchMetricsRequestAction,
  FetchMetricsSuccessAction,
  FetchMetricsFailureAction,
  UpdateDateRangeAction,
  AggregateMetricsAction,
  BatchMetricsUpdateAction,
  ClearMetricsCacheAction,
  SetMetricsFilterAction,
  ExportMetricsReportAction
} from './analytics.types';

import {
  IMetric,
  IDateRange,
  IMetricFilter,
  IExportConfig
} from '../../interfaces/analytics.interface';

import { analyticsService } from '../../services/analytics.service';
import { storage, StorageKeys } from '../../utils/storage.util';
import { createError, handleError } from '../../utils/error.util';
import { ErrorCode } from '../../constants/error.constant';

// Cache configuration
const METRICS_CACHE_TTL = 300000; // 5 minutes
const BATCH_DELAY = 2000; // 2 seconds

/**
 * Action creator for initiating metrics fetch request
 */
export const fetchMetricsRequest = (dateRange: IDateRange): FetchMetricsRequestAction => ({
  type: AnalyticsActionTypes.FETCH_METRICS_REQUEST,
  payload: dateRange
});

/**
 * Action creator for successful metrics fetch
 */
export const fetchMetricsSuccess = (metrics: IMetric[]): FetchMetricsSuccessAction => ({
  type: AnalyticsActionTypes.FETCH_METRICS_SUCCESS,
  payload: metrics
});

/**
 * Action creator for failed metrics fetch
 */
export const fetchMetricsFailure = (error: Error): FetchMetricsFailureAction => ({
  type: AnalyticsActionTypes.FETCH_METRICS_FAILURE,
  payload: error.message
});

/**
 * Action creator for updating date range
 */
export const updateDateRange = (dateRange: IDateRange): UpdateDateRangeAction => ({
  type: AnalyticsActionTypes.UPDATE_DATE_RANGE,
  payload: dateRange
});

/**
 * Action creator for aggregating metrics
 */
export const aggregateMetrics = (metrics: IMetric[]): AggregateMetricsAction => ({
  type: AnalyticsActionTypes.AGGREGATE_METRICS,
  payload: {
    totalUsage: metrics.length,
    averageSuccessRate: calculateAverageSuccessRate(metrics),
    averageResponseTime: calculateAverageResponseTime(metrics),
    timeRange: getTimeRangeFromMetrics(metrics)
  }
});

/**
 * Enhanced thunk action creator for fetching metrics with caching and error handling
 */
export const fetchMetrics = (
  dateRange: IDateRange,
  filter?: IMetricFilter
): ThunkAction<Promise<void>, any, null, AnalyticsAction> => {
  return async (dispatch: ThunkDispatch<any, null, AnalyticsAction>) => {
    try {
      // Check cache first
      const cachedMetrics = await getCachedMetrics(dateRange);
      if (cachedMetrics) {
        dispatch(fetchMetricsSuccess(cachedMetrics));
        return;
      }

      dispatch(fetchMetricsRequest(dateRange));

      const response = await analyticsService.getMetrics({ dateRange, ...filter });
      const metrics = response.data;

      // Cache the results
      await cacheMetrics(dateRange, metrics);

      dispatch(fetchMetricsSuccess(metrics));
      dispatch(aggregateMetrics(metrics));
    } catch (error) {
      const appError = handleError(error);
      dispatch(fetchMetricsFailure(appError));
    }
  };
};

/**
 * Debounced action creator for batch metrics updates
 */
export const batchMetricsUpdate = debounce(
  (metrics: IMetric[]): BatchMetricsUpdateAction => ({
    type: AnalyticsActionTypes.BATCH_METRICS_UPDATE,
    payload: metrics
  }),
  BATCH_DELAY,
  { maxWait: 5000 }
);

/**
 * Action creator for exporting metrics report
 */
export const exportMetricsReport = (
  config: IExportConfig
): ThunkAction<Promise<void>, any, null, AnalyticsAction> => {
  return async (dispatch: ThunkDispatch<any, null, AnalyticsAction>) => {
    try {
      dispatch({ type: AnalyticsActionTypes.EXPORT_METRICS_REQUEST });
      
      const response = await analyticsService.exportMetrics(config);
      
      dispatch({
        type: AnalyticsActionTypes.EXPORT_METRICS_SUCCESS,
        payload: response.data
      });
    } catch (error) {
      const appError = handleError(error);
      dispatch({
        type: AnalyticsActionTypes.EXPORT_METRICS_FAILURE,
        payload: appError.message
      });
    }
  };
};

// Helper functions

/**
 * Memoized function to get cached metrics
 */
const getCachedMetrics = memoize(
  async (dateRange: IDateRange): Promise<IMetric[] | null> => {
    try {
      const cacheKey = `metrics_${dateRange.startDate}_${dateRange.endDate}`;
      return await storage.getItem<IMetric[]>(cacheKey);
    } catch {
      return null;
    }
  },
  (dateRange: IDateRange) => `${dateRange.startDate}_${dateRange.endDate}`
);

/**
 * Caches metrics with TTL
 */
const cacheMetrics = async (dateRange: IDateRange, metrics: IMetric[]): Promise<void> => {
  try {
    const cacheKey = `metrics_${dateRange.startDate}_${dateRange.endDate}`;
    await storage.setItem(cacheKey, metrics, {
      ttl: METRICS_CACHE_TTL,
      compress: true
    });
  } catch (error) {
    console.warn('Failed to cache metrics:', error);
  }
};

/**
 * Calculates average success rate from metrics
 */
const calculateAverageSuccessRate = (metrics: IMetric[]): number => {
  if (!metrics.length) return 0;
  const successMetrics = metrics.filter(m => m.type === 'success_rate');
  return successMetrics.reduce((acc, m) => acc + m.value, 0) / successMetrics.length;
};

/**
 * Calculates average response time from metrics
 */
const calculateAverageResponseTime = (metrics: IMetric[]): number => {
  if (!metrics.length) return 0;
  const responseMetrics = metrics.filter(m => m.type === 'response_time');
  return responseMetrics.reduce((acc, m) => acc + m.value, 0) / responseMetrics.length;
};

/**
 * Extracts time range from metrics array
 */
const getTimeRangeFromMetrics = (metrics: IMetric[]): IDateRange => {
  if (!metrics.length) {
    return {
      startDate: new Date(),
      endDate: new Date(),
      timezone: 'UTC'
    };
  }

  const timestamps = metrics.map(m => new Date(m.timestamp).getTime());
  return {
    startDate: new Date(Math.min(...timestamps)),
    endDate: new Date(Math.max(...timestamps)),
    timezone: 'UTC'
  };
};