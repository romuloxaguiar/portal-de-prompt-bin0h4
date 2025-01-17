import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/api-gateway/controllers/health.controller';
import { HttpStatus } from '../../src/common/constants/http-status.constant';
import { ApiResponse } from '../../src/common/types/api-response.type';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('HealthController', () => {
  let controller: HealthController;
  let module: TestingModule;

  beforeEach(async () => {
    // Create testing module
    module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);

    // Mock private methods
    const mockHealthyResponse = true;
    jest.spyOn<any, string>(controller, 'checkDependency').mockResolvedValue(mockHealthyResponse);
    jest.spyOn<any, string>(controller, 'getCpuUsage').mockReturnValue(50);
    jest.spyOn<any, string>(controller, 'getMemoryUsage').mockReturnValue(60);
    jest.spyOn<any, string>(controller, 'getEventLoopLag').mockReturnValue(100);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should return healthy status when all dependencies are up', async () => {
      const response = await controller.healthCheck();

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.success).toBe(true);
      expect(response.data.status).toBe('healthy');
      expect(response.data.dependencies).toBeDefined();
      expect(response.data.metrics).toBeDefined();
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should include all required metrics in response', async () => {
      const response = await controller.healthCheck();

      expect(response.data.metrics).toMatchObject({
        uptime: expect.any(Number),
        responseTime: expect.any(Number),
        memory: expect.any(Number),
        requestCount: expect.any(Number),
        errorRate: expect.any(Number),
      });
    });

    it('should handle dependency failures correctly', async () => {
      jest.spyOn<any, string>(controller, 'checkDependency').mockResolvedValue(false);
      
      const response = await controller.healthCheck();

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.data.status).toBe('degraded');
      expect(Object.values(response.data.dependencies)).toContain(false);
    });

    it('should track request counts accurately', async () => {
      const firstResponse = await controller.healthCheck();
      const secondResponse = await controller.healthCheck();

      expect(secondResponse.data.metrics.requestCount).toBe(
        firstResponse.data.metrics.requestCount + 1
      );
    });
  });

  describe('readinessCheck', () => {
    it('should return ready status when service is initialized', async () => {
      const response = await controller.readinessCheck();

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.success).toBe(true);
      expect(response.data.ready).toBe(true);
      expect(response.data.services).toBeDefined();
      expect(response.data.initialization).toBeDefined();
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should include status of all critical services', async () => {
      const response = await controller.readinessCheck();

      expect(response.data.services).toMatchObject({
        database: expect.any(Boolean),
        cache: expect.any(Boolean),
        messageQueue: expect.any(Boolean),
      });
    });

    it('should report not ready when critical services are down', async () => {
      jest.spyOn<any, string>(controller, 'checkDependency').mockResolvedValue(false);
      
      const response = await controller.readinessCheck();

      expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(response.success).toBe(false);
      expect(response.data.ready).toBe(false);
    });

    it('should include initialization progress', async () => {
      const response = await controller.readinessCheck();

      expect(response.data.initialization).toMatchObject({
        complete: expect.any(Boolean),
        progress: expect.any(Number),
      });
    });
  });

  describe('livenessCheck', () => {
    it('should return alive status when service is healthy', async () => {
      const response = await controller.livenessCheck();

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.success).toBe(true);
      expect(response.data.alive).toBe(true);
      expect(response.data.components).toBeDefined();
      expect(response.data.resources).toBeDefined();
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should include status of all critical components', async () => {
      const response = await controller.livenessCheck();

      expect(response.data.components).toMatchObject({
        processManager: expect.any(Boolean),
        eventLoop: expect.any(Boolean),
        memoryManager: expect.any(Boolean),
      });
    });

    it('should report resource utilization metrics', async () => {
      const response = await controller.livenessCheck();

      expect(response.data.resources).toMatchObject({
        cpu: expect.any(Number),
        memory: expect.any(Number),
        eventLoop: expect.any(Number),
      });
    });

    it('should report not alive when resources are overutilized', async () => {
      jest.spyOn<any, string>(controller, 'getCpuUsage').mockReturnValue(95);
      jest.spyOn<any, string>(controller, 'getMemoryUsage').mockReturnValue(95);
      
      const response = await controller.livenessCheck();

      expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(response.success).toBe(false);
      expect(response.data.alive).toBe(false);
    });

    it('should report not alive when critical components fail', async () => {
      jest.spyOn<any, string>(controller, 'getEventLoopLag').mockReturnValue(2000);
      
      const response = await controller.livenessCheck();

      expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(response.success).toBe(false);
      expect(response.data.components.eventLoop).toBe(false);
    });
  });

  describe('response type compliance', () => {
    it('should return responses compliant with ApiResponse type', async () => {
      const healthResponse = await controller.healthCheck();
      const readyResponse = await controller.readinessCheck();
      const liveResponse = await controller.livenessCheck();

      const responses: ApiResponse<unknown>[] = [
        healthResponse,
        readyResponse,
        liveResponse,
      ];

      responses.forEach(response => {
        expect(response).toMatchObject({
          status: expect.any(Number),
          success: expect.any(Boolean),
          timestamp: expect.any(Date),
          data: expect.any(Object),
        });
      });
    });
  });
});