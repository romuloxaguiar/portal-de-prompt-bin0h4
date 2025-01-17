/**
 * Redux selectors for analytics state management with memoization and type safety
 * Implements performance-optimized access to metrics and aggregated statistics
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.0
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../root.reducer';
import { IMetric, IAggregatedMetrics, IDateRange } from '../../interfaces/analytics.interface';

/**
 * Base selector to access the analytics slice of the Redux store
 * Provides type-safe access to analytics state
 */
export const selectAnalyticsState = (state: RootState) => state.analytics;

/**
 * Memoized selector for retrieving all metrics data
 * Optimizes performance by preventing unnecessary recomputations
 */
export const selectMetrics = createSelector(
    [selectAnalyticsState],
    (analyticsState): IMetric[] => analyticsState.metrics || []
);

/**
 * Memoized selector for accessing aggregated metrics
 * Provides computed analytics with caching for performance
 */
export const selectAggregatedMetrics = createSelector(
    [selectAnalyticsState],
    (analyticsState): IAggregatedMetrics => analyticsState.aggregatedMetrics || {
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
    }
);

/**
 * Memoized selector for retrieving current date range filter
 * Ensures consistent timezone handling and date validation
 */
export const selectDateRange = createSelector(
    [selectAnalyticsState],
    (analyticsState): IDateRange => analyticsState.dateRange || {
        startDate: new Date(),
        endDate: new Date(),
        timezone: 'UTC'
    }
);

/**
 * Memoized selector for loading state
 * Tracks async operations status
 */
export const selectIsLoading = createSelector(
    [selectAnalyticsState],
    (analyticsState): boolean => analyticsState.loading
);

/**
 * Memoized selector for error state
 * Provides type-safe access to error information
 */
export const selectError = createSelector(
    [selectAnalyticsState],
    (analyticsState): string | null => analyticsState.error
);

/**
 * Memoized selector for total usage metrics
 * Computes total prompt usage across the system
 */
export const selectTotalUsage = createSelector(
    [selectAggregatedMetrics],
    (metrics): number => metrics.totalUsage
);

/**
 * Memoized selector for success rate metrics
 * Provides performance success indicators
 */
export const selectSuccessRate = createSelector(
    [selectAggregatedMetrics],
    (metrics): number => metrics.averageSuccessRate
);

/**
 * Memoized selector for cost metrics
 * Calculates total cost of prompt usage
 */
export const selectTotalCost = createSelector(
    [selectAggregatedMetrics],
    (metrics): number => metrics.totalCost
);

/**
 * Memoized selector for team collaboration metrics
 * Measures team engagement and collaboration effectiveness
 */
export const selectTeamCollaborationScore = createSelector(
    [selectAggregatedMetrics],
    (metrics): number => metrics.teamCollaborationScore
);

/**
 * Memoized selector for trend data
 * Provides time-series analytics for visualization
 */
export const selectTrendData = createSelector(
    [selectAggregatedMetrics],
    (metrics): Record<string, number[]> => metrics.trendData
);

/**
 * Memoized selector for token usage metrics
 * Tracks AI model token consumption
 */
export const selectTokenUsage = createSelector(
    [selectAggregatedMetrics],
    (metrics): number => metrics.totalTokensUsed
);

/**
 * Memoized selector for response time metrics
 * Monitors system performance and latency
 */
export const selectAverageResponseTime = createSelector(
    [selectAggregatedMetrics],
    (metrics): number => metrics.averageResponseTime
);