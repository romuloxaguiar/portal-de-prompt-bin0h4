import { jest } from '@jest/globals';
import dayjs from 'dayjs'; // v1.11.9
import mongoose from 'mongoose'; // v7.0.0
import { createClient } from 'redis'; // v4.6.7
import { MetricsService } from '../../src/analytics-service/services/metrics.service';
import { MetricModel, METRIC_TYPES } from '../../src/analytics-service/models/metric.model';
import { Logger } from '../../src/common/utils/logger.util';
import { ErrorCode } from '../../src/common/constants/error-codes.constant';
import { HttpStatus } from '../../src/common/constants/http-status.constant';

// Test constants
const TEST_WORKSPACE_ID = 'test-workspace-123';
const TEST_PROMPT_ID = 'test-prompt-456';
const TEST_USER_ID = 'test-user-789';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn()
  }))
}));

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let mockLogger: Logger;
  let mockRedisClient: any;

  // Test data fixtures
  const testMetricData = {
    promptId: TEST_PROMPT_ID,
    workspaceId: TEST_WORKSPACE_ID,
    userId: TEST_USER_ID,
    metricType: METRIC_TYPES.USAGE,
    value: 1
  };

  const testDateRange = {
    start: dayjs().subtract(7, 'days').toDate(),
    end: dayjs().toDate()
  };

  beforeAll(async () => {
    // Connect to test MongoDB
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test');

    // Initialize mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      http: jest.fn()
    } as unknown as Logger;

    mockRedisClient = createClient();

    // Initialize service
    metricsService = new MetricsService(mockLogger, MetricModel, {
      redisUrl: 'redis://localhost:6379',
      retryAttempts: 1,
      cacheExpiration: 60
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await MetricModel.deleteMany({});
    jest.clearAllMocks();
  });

  describe('recordMetric', () => {
    it('should successfully record a valid metric', async () => {
      const result = await metricsService.recordMetric(testMetricData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.promptId).toBe(TEST_PROMPT_ID);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should reject invalid metric data', async () => {
      const invalidData = { ...testMetricData, value: 'invalid' };
      const result = await metricsService.recordMetric(invalidData as any);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should handle concurrent metric recording', async () => {
      const metrics = Array(5).fill(testMetricData);
      const results = await Promise.all(metrics.map(m => metricsService.recordMetric(m)));

      expect(results.every(r => r.success)).toBe(true);
      const savedMetrics = await MetricModel.find({ promptId: TEST_PROMPT_ID });
      expect(savedMetrics).toHaveLength(5);
    });
  });

  describe('getPromptMetrics', () => {
    beforeEach(async () => {
      // Seed test metrics
      await MetricModel.create([
        { ...testMetricData, timestamp: dayjs().subtract(1, 'day').toDate() },
        { ...testMetricData, timestamp: dayjs().subtract(2, 'days').toDate() },
        { ...testMetricData, timestamp: dayjs().subtract(3, 'days').toDate() }
      ]);
    });

    it('should retrieve metrics for a prompt within date range', async () => {
      const result = await metricsService.getPromptMetrics(
        TEST_PROMPT_ID,
        testDateRange
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.every(m => m.promptId === TEST_PROMPT_ID)).toBe(true);
    });

    it('should return cached metrics when available', async () => {
      const cachedData = [{ ...testMetricData }];
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await metricsService.getPromptMetrics(
        TEST_PROMPT_ID,
        testDateRange
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(mockRedisClient.get).toHaveBeenCalled();
    });
  });

  describe('getWorkspaceAnalytics', () => {
    beforeEach(async () => {
      // Seed workspace metrics
      await MetricModel.create([
        { ...testMetricData, metricType: METRIC_TYPES.USAGE, value: 10 },
        { ...testMetricData, metricType: METRIC_TYPES.SUCCESS_RATE, value: 0.85 },
        { ...testMetricData, metricType: METRIC_TYPES.RESPONSE_TIME, value: 250 }
      ]);
    });

    it('should aggregate metrics by workspace', async () => {
      const result = await metricsService.getWorkspaceAnalytics(
        TEST_WORKSPACE_ID,
        testDateRange
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should apply metric type filters correctly', async () => {
      const result = await metricsService.getWorkspaceAnalytics(
        TEST_WORKSPACE_ID,
        testDateRange,
        { metricTypes: [METRIC_TYPES.USAGE] }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data[0]._id.metricType).toBe(METRIC_TYPES.USAGE);
    });
  });

  describe('calculateROI', () => {
    beforeEach(async () => {
      // Seed ROI metrics
      await MetricModel.create([
        { ...testMetricData, metricType: METRIC_TYPES.COST_SAVINGS, value: 1000 },
        { ...testMetricData, metricType: METRIC_TYPES.USAGE, value: 50 }
      ]);
    });

    it('should calculate ROI metrics correctly', async () => {
      const result = await metricsService.calculateROI(
        TEST_WORKSPACE_ID,
        testDateRange
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        totalSavings: 1000,
        totalUsage: 50,
        averageSavingsPerUse: 20
      });
    });

    it('should handle zero usage case', async () => {
      await MetricModel.deleteMany({});
      await MetricModel.create({
        ...testMetricData,
        metricType: METRIC_TYPES.COST_SAVINGS,
        value: 1000
      });

      const result = await metricsService.calculateROI(
        TEST_WORKSPACE_ID,
        testDateRange
      );

      expect(result.success).toBe(true);
      expect(result.data.averageSavingsPerUse).toBe(0);
    });
  });
});