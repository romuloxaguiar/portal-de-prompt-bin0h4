/**
 * Defines the types of metrics that can be tracked in the system.
 * Supports comprehensive analytics tracking across usage, performance, and business metrics.
 */
export enum MetricType {
    USAGE = 'usage',
    SUCCESS_RATE = 'success_rate',
    RESPONSE_TIME = 'response_time',
    ERROR_RATE = 'error_rate',
    USER_SATISFACTION = 'user_satisfaction',
    PROMPT_ITERATIONS = 'prompt_iterations',
    TOKEN_USAGE = 'token_usage',
    COST_PER_PROMPT = 'cost_per_prompt',
    TEAM_COLLABORATION = 'team_collaboration'
}

/**
 * Interface representing a single analytics metric with comprehensive metadata support.
 * Captures detailed information about each metric for advanced analytics capabilities.
 */
export interface IMetric {
    /** Unique identifier for the metric */
    id: string;
    
    /** Associated prompt identifier */
    promptId: string;
    
    /** Workspace context for the metric */
    workspaceId: string;
    
    /** User who generated the metric */
    userId: string;
    
    /** Type of metric being tracked */
    type: MetricType;
    
    /** Numerical value of the metric */
    value: number;
    
    /** Timestamp when the metric was recorded */
    timestamp: Date;
    
    /** Additional contextual data for the metric */
    metadata: Record<string, any>;
    
    /** Categorization tags for the metric */
    tags: string[];
    
    /** Source system or component that generated the metric */
    source: string;
    
    /** Version information for tracking metric evolution */
    version: string;
}

/**
 * Interface for specifying date ranges with timezone support.
 * Used for time-based analytics queries and reporting.
 */
export interface IDateRange {
    /** Start date for the range */
    startDate: Date;
    
    /** End date for the range */
    endDate: Date;
    
    /** Timezone for date calculations */
    timezone: string;
}

/**
 * Interface for aggregated metrics data.
 * Provides comprehensive analytics overview including ROI calculations and trends.
 */
export interface IAggregatedMetrics {
    /** Total usage count for the period */
    totalUsage: number;
    
    /** Average success rate as percentage */
    averageSuccessRate: number;
    
    /** Average response time in milliseconds */
    averageResponseTime: number;
    
    /** Error rate as percentage */
    errorRate: number;
    
    /** User satisfaction score (0-100) */
    userSatisfactionScore: number;
    
    /** Time range for the aggregated data */
    timeRange: IDateRange;
    
    /** Total tokens consumed */
    totalTokensUsed: number;
    
    /** Total cost in currency units */
    totalCost: number;
    
    /** Average iterations per prompt */
    averageIterationsPerPrompt: number;
    
    /** Team collaboration score (0-100) */
    teamCollaborationScore: number;
    
    /** Time-series data for trend analysis */
    trendData: Record<string, number[]>;
}

/**
 * Interface for metric filtering criteria.
 * Enables advanced filtering and querying of metrics data.
 */
export interface IMetricFilter {
    /** Filter by workspace */
    workspaceId?: string;
    
    /** Filter by prompt */
    promptId?: string;
    
    /** Filter by user */
    userId?: string;
    
    /** Filter by metric type */
    type?: MetricType;
    
    /** Filter by date range */
    dateRange?: IDateRange;
    
    /** Filter by tags */
    tags?: string[];
    
    /** Filter by source */
    source?: string;
    
    /** Filter by version */
    version?: string;
    
    /** Filter by value range */
    valueRange?: {
        min?: number;
        max?: number;
    };
}