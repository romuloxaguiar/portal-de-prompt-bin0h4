import {
    IMetric,
    IAggregatedMetrics,
    IDateRange,
    MetricType
} from '../../interfaces/analytics.interface';

/**
 * Enum defining all possible analytics action types in the Redux store.
 * Supports comprehensive analytics operations including real-time aggregation.
 */
export enum AnalyticsActionTypes {
    FETCH_METRICS_REQUEST = '@analytics/FETCH_METRICS_REQUEST',
    FETCH_METRICS_SUCCESS = '@analytics/FETCH_METRICS_SUCCESS',
    FETCH_METRICS_FAILURE = '@analytics/FETCH_METRICS_FAILURE',
    UPDATE_DATE_RANGE = '@analytics/UPDATE_DATE_RANGE',
    AGGREGATE_METRICS = '@analytics/AGGREGATE_METRICS'
}

/**
 * Interface for the metrics fetch request action.
 * Includes timezone-aware date range for accurate data retrieval.
 */
export interface FetchMetricsRequestAction {
    type: AnalyticsActionTypes.FETCH_METRICS_REQUEST;
    payload: IDateRange;
}

/**
 * Interface for the successful metrics fetch action.
 * Contains the retrieved metrics data with comprehensive metadata.
 */
export interface FetchMetricsSuccessAction {
    type: AnalyticsActionTypes.FETCH_METRICS_SUCCESS;
    payload: IMetric[];
}

/**
 * Interface for the failed metrics fetch action.
 * Includes detailed error information for proper error handling.
 */
export interface FetchMetricsFailureAction {
    type: AnalyticsActionTypes.FETCH_METRICS_FAILURE;
    payload: string;
}

/**
 * Interface for the date range update action.
 * Supports timezone-aware date range modifications.
 */
export interface UpdateDateRangeAction {
    type: AnalyticsActionTypes.UPDATE_DATE_RANGE;
    payload: IDateRange;
}

/**
 * Interface for the metrics aggregation action.
 * Enables real-time aggregation of metrics with comprehensive calculations.
 */
export interface AggregateMetricsAction {
    type: AnalyticsActionTypes.AGGREGATE_METRICS;
    payload: IAggregatedMetrics;
}

/**
 * Union type of all possible analytics actions.
 * Provides type safety for analytics-related Redux operations.
 */
export type AnalyticsAction =
    | FetchMetricsRequestAction
    | FetchMetricsSuccessAction
    | FetchMetricsFailureAction
    | UpdateDateRangeAction
    | AggregateMetricsAction;

/**
 * Interface defining the structure of the analytics state in Redux store.
 * Supports comprehensive analytics tracking with real-time aggregation capabilities.
 */
export interface AnalyticsState {
    /** Array of individual metrics with detailed metadata */
    metrics: IMetric[];
    
    /** Aggregated metrics data including ROI calculations and trends */
    aggregatedMetrics: IAggregatedMetrics;
    
    /** Current timezone-aware date range for analytics */
    dateRange: IDateRange;
    
    /** Loading state indicator for async operations */
    loading: boolean;
    
    /** Error state for failed operations */
    error: string | null;
}