/**
 * Reports Controller
 * Handles HTTP requests for analytics report generation, retrieval, and management
 * with enhanced support for pagination, filtering, and scheduled reports.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // v4.18.2
import { ReportsService } from '../services/reports.service';
import { AuthenticatedRequest } from '../../../common/interfaces/request.interface';
import { ApiResponse, ApiPaginatedResponse } from '../../../common/types/api-response.type';
import { Logger } from '../../../common/utils/logger.util';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { HttpStatus } from '../../../common/constants/http-status.constant';

/**
 * Controller class for handling analytics report HTTP requests
 */
export class ReportsController {
  private readonly logger: Logger;

  constructor(private readonly reportsService: ReportsService) {
    this.logger = new Logger('ReportsController');
  }

  /**
   * Generates a new analytics report with enhanced validation and error handling
   */
  async generateReport(
    req: Request<AuthenticatedRequest>,
    res: Response
  ): Promise<void> {
    this.logger.debug('Generate report request received', {
      userId: req.body.userId,
      workspaceId: req.body.workspaceId
    });

    try {
      const { userId, workspaceId } = req.body;
      const reportConfig = {
        title: req.body.title,
        description: req.body.description,
        reportType: req.body.reportType,
        dateRange: {
          start: new Date(req.body.dateRange.start),
          end: new Date(req.body.dateRange.end)
        },
        metrics: req.body.metrics,
        visualization: req.body.visualization,
        exportFormat: req.body.exportFormat
      };

      const result = await this.reportsService.generateReport(
        reportConfig,
        workspaceId,
        userId
      );

      const response: ApiResponse<any> = {
        status: HttpStatus.ACCEPTED,
        success: result.success,
        timestamp: new Date(),
        ...(result.success
          ? { data: result.data }
          : { error: result.error })
      };

      res.status(response.status).json(response);
    } catch (error) {
      this.logger.error('Error generating report', { error });
      
      const response: ApiResponse<any> = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to generate report',
          status: HttpStatus.INTERNAL_SERVER_ERROR
        }
      };

      res.status(response.status).json(response);
    }
  }

  /**
   * Retrieves paginated and filtered reports for a workspace
   */
  async getWorkspaceReports(
    req: Request<AuthenticatedRequest>,
    res: Response
  ): Promise<void> {
    this.logger.debug('Get workspace reports request received', {
      workspaceId: req.body.workspaceId
    });

    try {
      const { workspaceId } = req.body;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const filter = {
        reportType: req.query.reportType as string,
        dateRange: req.query.dateRange ? {
          start: new Date(req.query.dateRange.toString().split(',')[0]),
          end: new Date(req.query.dateRange.toString().split(',')[1])
        } : undefined,
        isArchived: req.query.isArchived === 'true'
      };

      const result = await this.reportsService.getWorkspaceReports(
        workspaceId,
        filter,
        { page, limit }
      );

      const response: ApiPaginatedResponse<any> = {
        status: HttpStatus.OK,
        success: result.success,
        timestamp: new Date(),
        ...(result.success
          ? {
              data: result.data.reports,
              pagination: result.data.pagination
            }
          : { error: result.error })
      };

      res.status(response.status).json(response);
    } catch (error) {
      this.logger.error('Error retrieving workspace reports', { error });
      
      const response: ApiResponse<any> = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve workspace reports',
          status: HttpStatus.INTERNAL_SERVER_ERROR
        }
      };

      res.status(response.status).json(response);
    }
  }

  /**
   * Archives a specific report with metadata tracking
   */
  async archiveReport(
    req: Request<AuthenticatedRequest>,
    res: Response
  ): Promise<void> {
    this.logger.debug('Archive report request received', {
      reportId: req.params.reportId
    });

    try {
      const { reportId } = req.params;
      const { reason } = req.body;

      await this.reportsService.archiveReport(reportId, reason);

      const response: ApiResponse<any> = {
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: {
          message: 'Report archived successfully',
          reportId
        }
      };

      res.status(response.status).json(response);
    } catch (error) {
      this.logger.error('Error archiving report', { error });
      
      const response: ApiResponse<any> = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to archive report',
          status: HttpStatus.INTERNAL_SERVER_ERROR
        }
      };

      res.status(response.status).json(response);
    }
  }

  /**
   * Schedules a recurring report generation with validation
   */
  async scheduleReport(
    req: Request<AuthenticatedRequest>,
    res: Response
  ): Promise<void> {
    this.logger.debug('Schedule report request received', {
      userId: req.body.userId,
      workspaceId: req.body.workspaceId
    });

    try {
      const { userId, workspaceId } = req.body;
      const scheduleConfig = {
        reportConfig: {
          title: req.body.title,
          description: req.body.description,
          reportType: req.body.reportType,
          metrics: req.body.metrics,
          visualization: req.body.visualization,
          exportFormat: req.body.exportFormat
        },
        schedule: {
          frequency: req.body.frequency,
          startDate: new Date(req.body.startDate),
          endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
          timezone: req.body.timezone
        }
      };

      const result = await this.reportsService.scheduleReport(
        scheduleConfig,
        workspaceId,
        userId
      );

      const response: ApiResponse<any> = {
        status: HttpStatus.CREATED,
        success: result.success,
        timestamp: new Date(),
        ...(result.success
          ? { data: result.data }
          : { error: result.error })
      };

      res.status(response.status).json(response);
    } catch (error) {
      this.logger.error('Error scheduling report', { error });
      
      const response: ApiResponse<any> = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        timestamp: new Date(),
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to schedule report',
          status: HttpStatus.INTERNAL_SERVER_ERROR
        }
      };

      res.status(response.status).json(response);
    }
  }
}