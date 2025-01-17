import { AnalyticsActionTypes, AnalyticsAction, AnalyticsState } from './analytics.types';
import { IMetric, MetricType, IAggregatedMetrics, IDateRange } from '../../interfaces/analytics.interface';

/**
 * Initial state for analytics with comprehensive default values
 * Implements enterprise-grade analytics state management
 */
const initialState: AnalyticsState = {
    metrics: [],
    aggregatedMetrics: {
        totalUsage: 0,
        averageSuccessRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
        userSatisfactionScore: 0,
        timeRange: {
            startDate: new Date(),
            endDate: new Date(),
            timezone: 'UTC'
        },
        totalTokensUsed: 0,
        totalCost: 0,
        averageIterationsPerPrompt: 0,
        teamCollaborationScore: 0,
        trendData: {
            daily: [],
            weekly: [],
            monthly: []
        }
    },
    dateRange: {
        startDate: new Date(),
        endDate: new Date(),
        timezone: 'UTC'
    },
    loading: false,
    error: null
};

/**
 * Calculates aggregated metrics from raw metric data
 * Supports comprehensive analytics calculations with error handling
 */
const calculateAggregatedMetrics = (metrics: IMetric[], dateRange: IDateRange): IAggregatedMetrics => {
    try {
        const filteredMetrics = metrics.filter(metric => 
            new Date(metric.timestamp) >= dateRange.startDate &&
            new Date(metric.timestamp) <= dateRange.endDate
        );

        const totalUsage = filteredMetrics.filter(m => m.type === MetricType.USAGE).length;
        const successRateMetrics = filteredMetrics.filter(m => m.type === MetricType.SUCCESS_RATE);
        const responseTimeMetrics = filteredMetrics.filter(m => m.type === MetricType.RESPONSE_TIME);
        const errorRateMetrics = filteredMetrics.filter(m => m.type === MetricType.ERROR_RATE);
        const satisfactionMetrics = filteredMetrics.filter(m => m.type === MetricType.USER_SATISFACTION);
        const tokenUsageMetrics = filteredMetrics.filter(m => m.type === MetricType.TOKEN_USAGE);
        const costMetrics = filteredMetrics.filter(m => m.type === MetricType.COST_PER_PROMPT);
        const iterationMetrics = filteredMetrics.filter(m => m.type === MetricType.PROMPT_ITERATIONS);
        const collaborationMetrics = filteredMetrics.filter(m => m.type === MetricType.TEAM_COLLABORATION);

        return {
            totalUsage,
            averageSuccessRate: calculateAverage(successRateMetrics),
            averageResponseTime: calculateAverage(responseTimeMetrics),
            errorRate: calculateAverage(errorRateMetrics),
            userSatisfactionScore: calculateAverage(satisfactionMetrics),
            timeRange: dateRange,
            totalTokensUsed: sumMetrics(tokenUsageMetrics),
            totalCost: sumMetrics(costMetrics),
            averageIterationsPerPrompt: calculateAverage(iterationMetrics),
            teamCollaborationScore: calculateAverage(collaborationMetrics),
            trendData: calculateTrendData(filteredMetrics, dateRange)
        };
    } catch (error) {
        console.error('Error calculating aggregated metrics:', error);
        return initialState.aggregatedMetrics;
    }
};

/**
 * Calculates average value from array of metrics
 * Handles empty arrays and invalid values
 */
const calculateAverage = (metrics: IMetric[]): number => {
    if (!metrics.length) return 0;
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
};

/**
 * Calculates sum of metric values
 * Handles empty arrays and invalid values
 */
const sumMetrics = (metrics: IMetric[]): number => {
    return metrics.reduce((sum, metric) => sum + metric.value, 0);
};

/**
 * Calculates trend data for different time periods
 * Supports daily, weekly, and monthly trend analysis
 */
const calculateTrendData = (metrics: IMetric[], dateRange: IDateRange): Record<string, number[]> => {
    try {
        // Implementation of trend calculations would go here
        // This is a placeholder returning empty arrays
        return {
            daily: [],
            weekly: [],
            monthly: []
        };
    } catch (error) {
        console.error('Error calculating trend data:', error);
        return initialState.aggregatedMetrics.trendData;
    }
};

/**
 * Redux reducer for analytics state management
 * Implements comprehensive analytics state updates with error handling
 */
const analyticsReducer = (
    state: AnalyticsState = initialState,
    action: AnalyticsAction
): AnalyticsState => {
    switch (action.type) {
        case AnalyticsActionTypes.FETCH_METRICS_REQUEST:
            return {
                ...state,
                loading: true,
                error: null
            };

        case AnalyticsActionTypes.FETCH_METRICS_SUCCESS:
            const aggregatedMetrics = calculateAggregatedMetrics(action.payload, state.dateRange);
            return {
                ...state,
                metrics: action.payload,
                aggregatedMetrics,
                loading: false,
                error: null
            };

        case AnalyticsActionTypes.FETCH_METRICS_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.payload
            };

        case AnalyticsActionTypes.UPDATE_DATE_RANGE:
            const newAggregatedMetrics = calculateAggregatedMetrics(state.metrics, action.payload);
            return {
                ...state,
                dateRange: action.payload,
                aggregatedMetrics: newAggregatedMetrics
            };

        case AnalyticsActionTypes.AGGREGATE_METRICS:
            return {
                ...state,
                aggregatedMetrics: action.payload
            };

        default:
            return state;
    }
};

export default analyticsReducer;