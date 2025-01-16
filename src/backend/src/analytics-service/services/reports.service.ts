/**
 * Reports Service
 * Handles generation, management, and retrieval of analytics reports including usage summaries,
 * performance metrics, ROI analysis, and team analytics reports with enhanced error handling,
 * scheduling capabilities, and performance optimizations.
 * @version 1.0.0
 */

import dayjs from 'dayjs'; // v1.11.9
import { ReportModel } from '../models/report.model';
import { MetricsService } from './metrics.service';
import { ServiceResponse } from '../../../common/types/service-response.type';
import { Logger } from '../../../common/utils/logger.util';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { HttpStatus } from '../../../common/constants/http-status.constant';
import { createClient, RedisClientType } from 'redis'; // v4.6.7
import { Queue, QueueScheduler, Worker } from 'bullmq'; // v4.12.0

/**
 * Interface for report generation configuration
 */
interface ReportConfig {
  title: string;
  description: string;
  reportType: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: string[];
  visualization?: {
    type: string;
    options: Record<string, any>;
  };
  exportFormat?: 'PDF' | 'CSV' | 'JSON';
}

/**
 * Interface for report filter options
 */
interface ReportFilter {
  reportType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  isArchived?: boolean;
}

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Reports service class for managing analytics reports
 */
export class ReportsService {
  private readonly logger: Logger;
  private readonly reportModel: typeof ReportModel;
  private readonly metricsService: MetricsService;
  private readonly reportCache: RedisClientType;
  private readonly reportQueue: Queue;
  private readonly cacheExpiration: number = 3600; // 1 hour

  constructor(config: {
    redisUrl: string;
    queueConfig: {
      connection: { host: string; port: number };
    };
  }) {
    this.logger = new Logger('ReportsService');
    this.reportModel = ReportModel;
    this.metricsService = new MetricsService(
      this.logger,
      ReportModel,
      { redisUrl: config.redisUrl }
    );

    // Initialize Redis cache
    this.reportCache = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

    // Initialize report generation queue
    this.reportQueue = new Queue('report-generation', {
      connection: config.queueConfig.connection,
    });

    this.initialize();
  }

  /**
   * Initializes service dependencies and workers
   */
  private async initialize(): Promise<void> {
    try {
      await this.reportCache.connect();
      
      // Initialize queue scheduler
      const scheduler = new QueueScheduler('report-generation', {
        connection: this.reportQueue.opts.connection,
      });

      // Initialize report generation worker
      const worker = new Worker(
        'report-generation',
        async (job) => {
          return this.processReportGeneration(job.data);
        },
        {
          connection: this.reportQueue.opts.connection,
        }
      );

      worker.on('completed', (job) => {
        this.logger.debug('Report generation completed', { jobId: job.id });
      });

      worker.on('failed', (job, error) => {
        this.logger.error('Report generation failed', { jobId: job?.id, error });
      });

      this.logger.info('Reports service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize reports service', { error });
      throw error;
    }
  }

  /**
   * Generates a new analytics report with enhanced error handling and retry mechanism
   */
  async generateReport(
    config: ReportConfig,
    workspaceId: string,
    userId: string
  ): Promise<ServiceResponse<any>> {
    this.logger.debug('Generating report', { config, workspaceId });

    try {
      // Validate report configuration
      if (!this.validateReportConfig(config)) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid report configuration',
            status: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // Queue report generation
      const job = await this.reportQueue.add(
        'generate',
        {
          config,
          workspaceId,
          userId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }
      );

      return {
        success: true,
        data: {
          jobId: job.id,
          status: 'queued',
          estimatedCompletion: dayjs().add(5, 'minute').toDate(),
        },
      };
    } catch (error) {
      this.logger.error('Error queueing report generation', { error });
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to generate report',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Retrieves reports for a workspace with advanced filtering and pagination
   */
  async getWorkspaceReports(
    workspaceId: string,
    filter: ReportFilter = {},
    pagination: PaginationOptions
  ): Promise<ServiceResponse<any>> {
    this.logger.debug('Getting workspace reports', { workspaceId, filter, pagination });

    try {
      const cacheKey = this.generateCacheKey(workspaceId, filter, pagination);
      const cachedData = await this.reportCache.get(cacheKey);

      if (cachedData) {
        return {
          success: true,
          data: JSON.parse(cachedData),
        };
      }

      const reports = await this.reportModel.findByWorkspace(workspaceId, {
        ...filter,
        page: pagination.page,
        limit: pagination.limit,
      });

      const response = {
        reports,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: await this.getReportCount(workspaceId, filter),
        },
      };

      await this.reportCache.setEx(
        cacheKey,
        this.cacheExpiration,
        JSON.stringify(response)
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Error retrieving workspace reports', { error });
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve reports',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Processes report generation with metrics aggregation and analysis
   */
  private async processReportGeneration(data: {
    config: ReportConfig;
    workspaceId: string;
    userId: string;
  }): Promise<any> {
    const { config, workspaceId, userId } = data;

    // Get metrics data
    const metricsResponse = await this.metricsService.getWorkspaceAnalytics(
      workspaceId,
      config.dateRange,
      { metricTypes: config.metrics as any[] }
    );

    if (!metricsResponse.success) {
      throw new Error('Failed to retrieve metrics data');
    }

    // Calculate ROI if needed
    let roiData;
    if (config.metrics.includes('ROI')) {
      const roiResponse = await this.metricsService.calculateROI(
        workspaceId,
        config.dateRange
      );
      if (roiResponse.success) {
        roiData = roiResponse.data;
      }
    }

    // Generate report
    return await this.reportModel.generateReport(
      {
        dateRange: config.dateRange,
        metrics: config.metrics,
        filters: {
          reportType: config.reportType,
        },
      },
      workspaceId,
      userId
    );
  }

  /**
   * Validates report configuration
   */
  private validateReportConfig(config: ReportConfig): boolean {
    return !!(
      config.title &&
      config.description &&
      config.reportType &&
      config.dateRange?.start &&
      config.dateRange?.end &&
      Array.isArray(config.metrics) &&
      config.metrics.length > 0
    );
  }

  /**
   * Generates cache key for reports data
   */
  private generateCacheKey(
    workspaceId: string,
    filter: ReportFilter,
    pagination: PaginationOptions
  ): string {
    return `reports:${workspaceId}:${JSON.stringify(filter)}:${pagination.page}:${
      pagination.limit
    }`;
  }

  /**
   * Gets total report count for pagination
   */
  private async getReportCount(
    workspaceId: string,
    filter: ReportFilter
  ): Promise<number> {
    const query: any = { workspaceId };

    if (filter.reportType) {
      query.reportType = filter.reportType;
    }

    if (filter.dateRange) {
      query.generatedAt = {
        $gte: filter.dateRange.start,
        $lte: filter.dateRange.end,
      };
    }

    if (typeof filter.isArchived === 'boolean') {
      query.isArchived = filter.isArchived;
    }

    return await this.reportModel.countDocuments(query);
  }
}