/**
 * Analytics Metrics Controller
 * Handles HTTP requests for analytics metrics operations with enhanced validation,
 * caching, and comprehensive error handling capabilities.
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // v4.18.2
import dayjs from 'dayjs'; // v1.11.9
import { MetricsService } from '../services/metrics.service';
import { ApiResponse } from '../../../common/types/api-response.type';
import { Logger } from '../../../common/utils/logger.util';
import { HttpStatus } from '../../../common/constants/http-status.constant';
import { ErrorCode } from '../../../common/constants/error-codes.constant';

/**
 * Controller class for handling analytics metrics HTTP requests
 */
export class MetricsController {
  private readonly logger: Logger;
  private readonly metricsService: MetricsService;

  /**
   * Initializes the metrics controller with required dependencies
   */
  constructor(metricsService: MetricsService) {
    this.metricsService = metricsService;
    this.logger = new Logger('MetricsController');
  }

  /**
   * Records a new metric with enhanced validation and correlation tracking
   * 
   * @param req Express request object containing metric data
   * @param res Express response object
   */
  async recordMetric(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string;
    this.logger.debug('Recording metric', { correlationId, body: req.body });

    try {
      const metricData = {
        promptId: req.body.promptId,
        workspaceId: req.body.workspaceId,
        userId: req.body.userId,
        metricType: req.body.metricType,
        value: req.body.value,
        metadata: req.body.metadata
      };

      const result = await this.metricsService.recordMetric(metricData);

      if (!result.success) {
        res.status(result.error!.status).json({
          status: result.error!.status,
          success: false,
          timestamp: new Date(),
          error: result.error
        });
        return;
      }

      res.status(HttpStatus.CREATED).json({
        status: HttpStatus.CREATED,
        success: true,
        timestamp: new Date(),
        data: result.data
      });
    } catch (error) {
      this.logger.error('Error recording metric', { error, correlationId });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to record metric',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date()
        }
      });
    }
  }

  /**
   * Retrieves metrics for a specific prompt with caching and aggregation
   * 
   * @param req Express request object containing prompt ID and query parameters
   * @param res Express response object
   */
  async getPromptMetrics(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string;
    const promptId = req.params.promptId;
    
    this.logger.debug('Getting prompt metrics', { correlationId, promptId });

    try {
      const dateRange = {
        start: dayjs(req.query.startDate as string).toDate(),
        end: dayjs(req.query.endDate as string).toDate()
      };

      const result = await this.metricsService.getPromptMetrics(promptId, dateRange);

      if (!result.success) {
        res.status(result.error!.status).json({
          status: result.error!.status,
          success: false,
          timestamp: new Date(),
          error: result.error
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: result.data
      });
    } catch (error) {
      this.logger.error('Error retrieving prompt metrics', { error, correlationId });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve prompt metrics',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date()
        }
      });
    }
  }

  /**
   * Retrieves aggregated analytics for a workspace with flexible querying
   * 
   * @param req Express request object containing workspace ID and query parameters
   * @param res Express response object
   */
  async getWorkspaceAnalytics(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string;
    const workspaceId = req.params.workspaceId;
    
    this.logger.debug('Getting workspace analytics', { correlationId, workspaceId });

    try {
      const dateRange = {
        start: dayjs(req.query.startDate as string).toDate(),
        end: dayjs(req.query.endDate as string).toDate()
      };

      const options = {
        groupBy: req.query.groupBy ? (req.query.groupBy as string).split(',') : undefined,
        metricTypes: req.query.metricTypes ? (req.query.metricTypes as string).split(',') : undefined
      };

      const result = await this.metricsService.getWorkspaceAnalytics(
        workspaceId,
        dateRange,
        options
      );

      if (!result.success) {
        res.status(result.error!.status).json({
          status: result.error!.status,
          success: false,
          timestamp: new Date(),
          error: result.error
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: result.data
      });
    } catch (error) {
      this.logger.error('Error retrieving workspace analytics', { error, correlationId });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve workspace analytics',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date()
        }
      });
    }
  }

  /**
   * Retrieves ROI metrics with business impact analysis
   * 
   * @param req Express request object containing workspace ID and date range
   * @param res Express response object
   */
  async getROIMetrics(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string;
    const workspaceId = req.params.workspaceId;
    
    this.logger.debug('Getting ROI metrics', { correlationId, workspaceId });

    try {
      const dateRange = {
        start: dayjs(req.query.startDate as string).toDate(),
        end: dayjs(req.query.endDate as string).toDate()
      };

      const result = await this.metricsService.calculateROI(workspaceId, dateRange);

      if (!result.success) {
        res.status(result.error!.status).json({
          status: result.error!.status,
          success: false,
          timestamp: new Date(),
          error: result.error
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: result.data
      });
    } catch (error) {
      this.logger.error('Error calculating ROI metrics', { error, correlationId });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to calculate ROI metrics',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date()
        }
      });
    }
  }
}