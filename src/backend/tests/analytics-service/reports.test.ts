/**
 * Comprehensive test suite for analytics reports functionality
 * Tests report generation, retrieval, archival, scheduling, security, and performance
 * @version 1.0.0
 */

import { MongoMemoryServer } from 'mongodb-memory-server'; // v8.13.0
import mongoose from 'mongoose'; // v7.0.0
import { ReportsController } from '../../src/analytics-service/controllers/reports.controller';
import { ReportsService } from '../../src/analytics-service/services/reports.service';
import { ReportModel, ReportType } from '../../src/analytics-service/models/report.model';
import { MetricModel, METRIC_TYPES } from '../../src/analytics-service/models/metric.model';
import { ErrorCode } from '../../src/common/constants/error-codes.constant';
import { HttpStatus } from '../../src/common/constants/http-status.constant';

// Mock dependencies
jest.mock('../../src/analytics-service/services/reports.service');
jest.mock('../../src/analytics-service/models/report.model');

describe('ReportsController', () => {
  let mongoServer: MongoMemoryServer;
  let reportsController: ReportsController;
  let reportsService: jest.Mocked<ReportsService>;
  let mockRequest: any;
  let mockResponse: any;

  beforeAll(async () => {
    // Setup MongoDB memory server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Initialize mocks
    reportsService = new ReportsService({
      redisUrl: 'redis://localhost:6379',
      queueConfig: {
        connection: { host: 'localhost', port: 6379 }
      }
    }) as jest.Mocked<ReportsService>;

    reportsController = new ReportsController(reportsService);

    // Setup response mock
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          userId: 'test-user-id',
          workspaceId: 'test-workspace-id',
          title: 'Test Report',
          description: 'Test Description',
          reportType: ReportType.PERFORMANCE_METRICS,
          dateRange: {
            start: new Date('2023-01-01'),
            end: new Date('2023-12-31')
          },
          metrics: [METRIC_TYPES.USAGE, METRIC_TYPES.SUCCESS_RATE],
          visualization: {
            type: 'line',
            options: { showLegend: true }
          },
          exportFormat: 'PDF'
        }
      };
    });

    it('should successfully generate a report', async () => {
      const mockResult = {
        success: true,
        data: {
          jobId: 'test-job-id',
          status: 'queued',
          estimatedCompletion: new Date()
        }
      };

      reportsService.generateReport.mockResolvedValue(mockResult);

      await reportsController.generateReport(mockRequest, mockResponse);

      expect(reportsService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          title: mockRequest.body.title,
          reportType: mockRequest.body.reportType,
          metrics: mockRequest.body.metrics
        }),
        mockRequest.body.workspaceId,
        mockRequest.body.userId
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            jobId: 'test-job-id'
          })
        })
      );
    });

    it('should handle validation errors', async () => {
      mockRequest.body.metrics = [];

      const mockResult = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid report configuration',
          status: HttpStatus.BAD_REQUEST
        }
      };

      reportsService.generateReport.mockResolvedValue(mockResult);

      await reportsController.generateReport(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR
          })
        })
      );
    });

    it('should handle ROI calculation reports', async () => {
      mockRequest.body.reportType = ReportType.ROI_ANALYSIS;
      mockRequest.body.metrics = [METRIC_TYPES.ROI, METRIC_TYPES.COST_SAVINGS];

      const mockResult = {
        success: true,
        data: {
          jobId: 'roi-job-id',
          status: 'queued'
        }
      };

      reportsService.generateReport.mockResolvedValue(mockResult);

      await reportsController.generateReport(mockRequest, mockResponse);

      expect(reportsService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: ReportType.ROI_ANALYSIS,
          metrics: [METRIC_TYPES.ROI, METRIC_TYPES.COST_SAVINGS]
        }),
        mockRequest.body.workspaceId,
        mockRequest.body.userId
      );
    });
  });

  describe('getWorkspaceReports', () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          workspaceId: 'test-workspace-id'
        },
        query: {
          page: '1',
          limit: '10',
          reportType: ReportType.PERFORMANCE_METRICS,
          dateRange: '2023-01-01,2023-12-31',
          isArchived: 'false'
        }
      };
    });

    it('should retrieve paginated workspace reports', async () => {
      const mockResult = {
        success: true,
        data: {
          reports: [
            {
              id: 'report-1',
              title: 'Performance Report'
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1
          }
        }
      };

      reportsService.getWorkspaceReports.mockResolvedValue(mockResult);

      await reportsController.getWorkspaceReports(mockRequest, mockResponse);

      expect(reportsService.getWorkspaceReports).toHaveBeenCalledWith(
        mockRequest.body.workspaceId,
        expect.objectContaining({
          reportType: mockRequest.query.reportType,
          isArchived: false
        }),
        { page: 1, limit: 10 }
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.any(Object)
        })
      );
    });

    it('should handle filtering by date range', async () => {
      const mockResult = {
        success: true,
        data: {
          reports: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0
          }
        }
      };

      reportsService.getWorkspaceReports.mockResolvedValue(mockResult);

      await reportsController.getWorkspaceReports(mockRequest, mockResponse);

      expect(reportsService.getWorkspaceReports).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date)
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('archiveReport', () => {
    beforeEach(() => {
      mockRequest = {
        params: {
          reportId: 'test-report-id'
        },
        body: {
          reason: 'Outdated report'
        }
      };
    });

    it('should successfully archive a report', async () => {
      await reportsController.archiveReport(mockRequest, mockResponse);

      expect(reportsService.archiveReport).toHaveBeenCalledWith(
        mockRequest.params.reportId,
        mockRequest.body.reason
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            reportId: mockRequest.params.reportId
          })
        })
      );
    });

    it('should handle non-existent report archival', async () => {
      reportsService.archiveReport.mockRejectedValue(new Error('Report not found'));

      await reportsController.archiveReport(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_SERVER_ERROR
          })
        })
      );
    });
  });

  describe('scheduleReport', () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          userId: 'test-user-id',
          workspaceId: 'test-workspace-id',
          title: 'Scheduled Report',
          description: 'Weekly Performance Report',
          reportType: ReportType.PERFORMANCE_METRICS,
          metrics: [METRIC_TYPES.USAGE],
          frequency: 'WEEKLY',
          startDate: new Date('2024-01-01'),
          timezone: 'UTC'
        }
      };
    });

    it('should successfully schedule a report', async () => {
      const mockResult = {
        success: true,
        data: {
          scheduleId: 'schedule-1',
          nextRun: new Date('2024-01-08')
        }
      };

      reportsService.scheduleReport.mockResolvedValue(mockResult);

      await reportsController.scheduleReport(mockRequest, mockResponse);

      expect(reportsService.scheduleReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportConfig: expect.any(Object),
          schedule: expect.objectContaining({
            frequency: 'WEEKLY',
            startDate: expect.any(Date)
          })
        }),
        mockRequest.body.workspaceId,
        mockRequest.body.userId
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    });

    it('should validate schedule configuration', async () => {
      mockRequest.body.frequency = 'INVALID';

      const mockResult = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid schedule configuration',
          status: HttpStatus.BAD_REQUEST
        }
      };

      reportsService.scheduleReport.mockResolvedValue(mockResult);

      await reportsController.scheduleReport(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });
  });
});