/**
 * Analytics Metrics Service
 * Handles collection, aggregation, and analysis of platform usage, performance, and ROI metrics
 * with enhanced caching, validation, and error handling capabilities.
 * @version 1.0.0
 */

import dayjs from 'dayjs'; // v1.11.9
import retry from 'retry'; // v0.13.1
import { createClient, RedisClientType } from 'redis'; // v4.6.7
import { Logger } from '../../../common/utils/logger.util';
import { MetricModel, METRIC_TYPES, IMetric } from '../models/metric.model';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { HttpStatus } from '../../../common/constants/http-status.constant';

/**
 * Interface for metric data input
 */
interface MetricData {
  promptId: string;
  workspaceId: string;
  userId: string;
  metricType: METRIC_TYPES;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Interface for metric query options
 */
interface MetricOptions {
  groupBy?: string[];
  metricTypes?: METRIC_TYPES[];
  includeMetadata?: boolean;
}

/**
 * Interface for date range filtering
 */
interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Interface for service response
 */
interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    status: HttpStatus;
  };
}

/**
 * Service class for handling analytics metrics operations
 */
export class MetricsService {
  private readonly logger: Logger;
  private readonly metricModel: typeof MetricModel;
  private readonly redisClient: RedisClientType;
  private readonly retryAttempts: number = 3;
  private readonly cacheExpiration: number = 3600; // 1 hour

  constructor(
    logger: Logger,
    metricModel: typeof MetricModel,
    config: { redisUrl: string; retryAttempts?: number; cacheExpiration?: number }
  ) {
    this.logger = logger;
    this.metricModel = metricModel;
    this.retryAttempts = config.retryAttempts || this.retryAttempts;
    this.cacheExpiration = config.cacheExpiration || this.cacheExpiration;

    // Initialize Redis client
    this.redisClient = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

    this.initializeRedis();
  }

  /**
   * Initializes Redis connection with error handling
   */
  private async initializeRedis(): Promise<void> {
    try {
      await this.redisClient.connect();
      this.logger.info('Redis connection established');
    } catch (error) {
      this.logger.error('Redis connection failed', { error });
    }
  }

  /**
   * Records a new metric with validation and retry logic
   */
  async recordMetric(metricData: MetricData): Promise<ServiceResponse<IMetric>> {
    this.logger.debug('Recording metric', { metricData });

    try {
      // Validate metric data
      if (!this.validateMetricData(metricData)) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid metric data',
            status: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // Implement retry logic
      const operation = retry.operation({
        retries: this.retryAttempts,
        factor: 2,
        minTimeout: 1000,
      });

      return await new Promise((resolve, reject) => {
        operation.attempt(async () => {
          try {
            const metric = await this.metricModel.create(metricData);
            await this.invalidateCache(metricData.promptId);
            
            resolve({
              success: true,
              data: metric,
            });
          } catch (error) {
            if (operation.retry(error as Error)) {
              return;
            }
            reject(error);
          }
        });
      });
    } catch (error) {
      this.logger.error('Error recording metric', { error, metricData });
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to record metric',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Retrieves metrics for a specific prompt with caching
   */
  async getPromptMetrics(
    promptId: string,
    dateRange: DateRange,
    options: MetricOptions = {}
  ): Promise<ServiceResponse<IMetric[]>> {
    this.logger.debug('Getting prompt metrics', { promptId, dateRange, options });

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(promptId, dateRange, options);
      const cachedData = await this.redisClient.get(cacheKey);

      if (cachedData) {
        return {
          success: true,
          data: JSON.parse(cachedData),
        };
      }

      // Fetch from database
      const metrics = await this.metricModel.findByPromptId(promptId, dateRange);

      // Cache results
      await this.redisClient.setEx(
        cacheKey,
        this.cacheExpiration,
        JSON.stringify(metrics)
      );

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      this.logger.error('Error retrieving prompt metrics', { error, promptId });
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve metrics',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Retrieves workspace analytics with aggregation
   */
  async getWorkspaceAnalytics(
    workspaceId: string,
    dateRange: DateRange,
    options: MetricOptions = {}
  ): Promise<ServiceResponse<any>> {
    this.logger.debug('Getting workspace analytics', { workspaceId, dateRange, options });

    try {
      const aggregateOptions = {
        dateRange,
        groupBy: options.groupBy,
        metricTypes: options.metricTypes,
      };

      const analytics = await this.metricModel.aggregateByWorkspace(
        workspaceId,
        aggregateOptions
      );

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Error retrieving workspace analytics', { error, workspaceId });
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve workspace analytics',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Calculates ROI metrics based on usage and cost data
   */
  async calculateROI(
    workspaceId: string,
    dateRange: DateRange
  ): Promise<ServiceResponse<any>> {
    this.logger.debug('Calculating ROI metrics', { workspaceId, dateRange });

    try {
      const metrics = await this.metricModel.aggregateByWorkspace(workspaceId, {
        dateRange,
        metricTypes: [METRIC_TYPES.COST_SAVINGS, METRIC_TYPES.USAGE],
      });

      const roi = this.processROICalculation(metrics);

      return {
        success: true,
        data: roi,
      };
    } catch (error) {
      this.logger.error('Error calculating ROI', { error, workspaceId });
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to calculate ROI',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Validates metric data structure and values
   */
  private validateMetricData(data: MetricData): boolean {
    return !!(
      data.promptId &&
      data.workspaceId &&
      data.userId &&
      data.metricType &&
      typeof data.value === 'number' &&
      Object.values(METRIC_TYPES).includes(data.metricType)
    );
  }

  /**
   * Generates cache key for metrics data
   */
  private generateCacheKey(
    promptId: string,
    dateRange: DateRange,
    options: MetricOptions
  ): string {
    return `metrics:${promptId}:${dayjs(dateRange.start).unix()}:${dayjs(
      dateRange.end
    ).unix()}:${JSON.stringify(options)}`;
  }

  /**
   * Invalidates cache for a specific prompt
   */
  private async invalidateCache(promptId: string): Promise<void> {
    const pattern = `metrics:${promptId}:*`;
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      await this.redisClient.del(keys);
    }
  }

  /**
   * Processes ROI calculation from metrics data
   */
  private processROICalculation(metrics: any[]): any {
    const costSavings = metrics.find(
      (m) => m._id?.metricType === METRIC_TYPES.COST_SAVINGS
    )?.sum || 0;
    const usage = metrics.find(
      (m) => m._id?.metricType === METRIC_TYPES.USAGE
    )?.count || 0;

    return {
      totalSavings: costSavings,
      totalUsage: usage,
      averageSavingsPerUse: usage > 0 ? costSavings / usage : 0,
      timestamp: new Date(),
    };
  }
}