import { useState, useCallback, useEffect, useRef, useMemo } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { AnalyticsService } from '../services/analytics.service';
import {
  fetchMetrics,
  updateDateRange,
  retryFailedMetrics
} from '../store/analytics/analytics.actions';
import {
  selectMetrics,
  selectAggregatedMetrics,
  selectDateRange,
  selectIsLoading,
  selectError
} from '../store/analytics/analytics.selectors';
import {
  IMetric,
  IAggregatedMetrics,
  IDateRange,
  IAnalyticsEvent,
  MetricType
} from '../interfaces/analytics.interface';
import { AppError } from '../utils/error.util';

// Constants for analytics operations
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 2000;
const CACHE_DURATION = 300000; // 5 minutes
const RETRY_ATTEMPTS = 3;

/**
 * Custom hook providing comprehensive analytics functionality
 * @param initialDateRange - Initial date range for analytics
 * @param options - Configuration options for analytics behavior
 */
export const useAnalytics = (
  initialDateRange: IDateRange,
  options: {
    batchEvents?: boolean;
    cacheResults?: boolean;
    retryOnFailure?: boolean;
  } = {}
) => {
  // Redux hooks
  const dispatch = useDispatch();
  const metrics = useSelector(selectMetrics);
  const aggregatedMetrics = useSelector(selectAggregatedMetrics);
  const dateRange = useSelector(selectDateRange);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // Local state
  const [eventQueue, setEventQueue] = useState<IAnalyticsEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Refs for cleanup and batching
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Memoized analytics service instance
   */
  const analyticsService = useMemo(() => new AnalyticsService(), []);

  /**
   * Handles date range changes with optimized cache usage
   */
  const handleDateRangeChange = useCallback(async (newDateRange: IDateRange) => {
    try {
      dispatch(updateDateRange(newDateRange));
      await dispatch(fetchMetrics(newDateRange));
    } catch (error) {
      if (options.retryOnFailure && retryCount < RETRY_ATTEMPTS) {
        setRetryCount(prev => prev + 1);
        await dispatch(retryFailedMetrics());
      }
      throw new AppError('Failed to update date range', { error });
    }
  }, [dispatch, options.retryOnFailure, retryCount]);

  /**
   * Tracks analytics events with batching support
   */
  const trackAnalyticsEvent = useCallback(async (event: IAnalyticsEvent) => {
    if (options.batchEvents) {
      setEventQueue(prev => [...prev, event]);
    } else {
      try {
        await analyticsService.trackEvent(event);
      } catch (error) {
        console.error('Failed to track event:', error);
        if (options.retryOnFailure) {
          setEventQueue(prev => [...prev, event]);
        }
      }
    }
  }, [options.batchEvents, options.retryOnFailure, analyticsService]);

  /**
   * Tracks prompt-specific analytics with enhanced error handling
   */
  const trackPromptAnalytics = useCallback(async (
    promptId: string,
    usageData: {
      successRate: number;
      responseTime: number;
      tokenCount: number;
      cost: number;
    }
  ) => {
    try {
      await analyticsService.trackPromptUsage(promptId, {
        type: MetricType.USAGE,
        value: 1,
        metadata: {
          successRate: usageData.successRate,
          responseTime: usageData.responseTime,
          tokenCount: usageData.tokenCount,
          cost: usageData.cost
        }
      });
    } catch (error) {
      console.error('Failed to track prompt usage:', error);
      if (options.retryOnFailure) {
        setEventQueue(prev => [...prev, {
          type: 'prompt_usage',
          promptId,
          data: usageData
        }]);
      }
    }
  }, [options.retryOnFailure, analyticsService]);

  /**
   * Clears analytics cache
   */
  const clearAnalyticsCache = useCallback(async () => {
    try {
      await analyticsService.clearCache();
    } catch (error) {
      console.error('Failed to clear analytics cache:', error);
    }
  }, [analyticsService]);

  /**
   * Processes batched events queue
   */
  const processBatchQueue = useCallback(async () => {
    if (eventQueue.length === 0) return;

    setIsSyncing(true);
    try {
      const events = [...eventQueue];
      setEventQueue([]);

      await analyticsService.batchTrackEvents(events);
    } catch (error) {
      console.error('Failed to process event batch:', error);
      if (options.retryOnFailure) {
        setEventQueue(prev => [...prev, ...eventQueue]);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [eventQueue, options.retryOnFailure, analyticsService]);

  // Effect for initial data fetch
  useEffect(() => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchInitialData = async () => {
      try {
        await dispatch(fetchMetrics(initialDateRange));
      } catch (error) {
        console.error('Failed to fetch initial analytics data:', error);
      }
    };

    fetchInitialData();

    return () => {
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, [dispatch, initialDateRange]);

  // Effect for batch processing
  useEffect(() => {
    if (!options.batchEvents || eventQueue.length === 0) return;

    if (eventQueue.length >= BATCH_SIZE) {
      processBatchQueue();
    } else if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(() => {
        processBatchQueue();
        batchTimeoutRef.current = null;
      }, BATCH_INTERVAL);
    }

    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
    };
  }, [eventQueue, options.batchEvents, processBatchQueue]);

  return {
    // State
    metrics,
    aggregatedMetrics,
    dateRange,
    isLoading,
    error,
    isSyncing,

    // Actions
    handleDateRangeChange,
    trackAnalyticsEvent,
    trackPromptAnalytics,
    clearAnalyticsCache
  };
};

export default useAnalytics;