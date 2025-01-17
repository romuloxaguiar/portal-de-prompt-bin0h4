/**
 * Comprehensive test suite for API service implementation
 * Tests HTTP methods, error handling, retry logic, and performance requirements
 * @version 1.0.0
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // ^29.0.0
import MockAdapter from 'axios-mock-adapter'; // ^1.21.0
import axios from 'axios';
import { 
  apiService, 
  type ApiResponse 
} from '../../src/services/api.service';
import { API_ENDPOINTS, API_METHODS } from '../../src/constants/api.constant';
import { appConfig } from '../../src/config/app.config';
import { ErrorCode } from '../../src/constants/error.constant';

describe('ApiService', () => {
  let mockAxios: MockAdapter;

  const TEST_PROMPT = {
    id: '123',
    title: 'Test Prompt',
    content: 'Test content'
  };

  const MOCK_RESPONSE = {
    data: TEST_PROMPT,
    status: 200,
    message: 'Success',
    metadata: {},
    timestamp: Date.now(),
    requestId: 'test-123'
  };

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockAxios.reset();
    jest.clearAllTimers();
  });

  describe('HTTP Methods', () => {
    it('should successfully make GET request', async () => {
      mockAxios.onGet(`${API_ENDPOINTS.PROMPTS.BASE}/123`).reply(200, MOCK_RESPONSE);

      const response = await apiService.get(`${API_ENDPOINTS.PROMPTS.BASE}/123`);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(TEST_PROMPT);
      expect(response.requestId).toBeDefined();
    });

    it('should successfully make POST request with data', async () => {
      mockAxios.onPost(API_ENDPOINTS.PROMPTS.BASE).reply(201, MOCK_RESPONSE);

      const response = await apiService.post(API_ENDPOINTS.PROMPTS.BASE, TEST_PROMPT);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(TEST_PROMPT);
    });

    it('should successfully make PUT request for updates', async () => {
      mockAxios.onPut(`${API_ENDPOINTS.PROMPTS.BASE}/123`).reply(200, MOCK_RESPONSE);

      const response = await apiService.put(`${API_ENDPOINTS.PROMPTS.BASE}/123`, TEST_PROMPT);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(TEST_PROMPT);
    });

    it('should successfully make DELETE request', async () => {
      mockAxios.onDelete(`${API_ENDPOINTS.PROMPTS.BASE}/123`).reply(204);

      const response = await apiService.delete(`${API_ENDPOINTS.PROMPTS.BASE}/123`);
      expect(response.status).toBe(204);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry logic', async () => {
      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE)
        .replyOnce(500)
        .replyOnce(500)
        .replyOnce(200, MOCK_RESPONSE);

      const response = await apiService.get(API_ENDPOINTS.PROMPTS.BASE);
      expect(response.status).toBe(200);
      expect(mockAxios.history.get.length).toBe(3);
    });

    it('should handle timeout errors', async () => {
      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE).timeout();

      try {
        await apiService.get(API_ENDPOINTS.PROMPTS.BASE);
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });

    it('should handle rate limiting responses', async () => {
      mockAxios.onPost(API_ENDPOINTS.PROMPTS.BASE).reply(429, {
        message: 'Too Many Requests'
      });

      try {
        await apiService.post(API_ENDPOINTS.PROMPTS.BASE, TEST_PROMPT);
      } catch (error: any) {
        expect(error.status).toBe(429);
      }
    });

    it('should handle invalid endpoints', async () => {
      try {
        await apiService.get('/invalid/endpoint');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should complete requests within 2 second SLA', async () => {
      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE).reply(200, MOCK_RESPONSE);

      const startTime = Date.now();
      await apiService.get(API_ENDPOINTS.PROMPTS.BASE);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(appConfig.performance.targetResponseTime);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE).reply(200, MOCK_RESPONSE);

      const requests = Array(10).fill(null).map(() => 
        apiService.get(API_ENDPOINTS.PROMPTS.BASE)
      );

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should respect request timeout settings', async () => {
      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE).reply(() => {
        return new Promise(resolve => setTimeout(resolve, 3000));
      });

      try {
        await apiService.get(API_ENDPOINTS.PROMPTS.BASE, { timeout: 1000 });
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });
  });

  describe('Response Formatting', () => {
    it('should return properly formatted API responses', async () => {
      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE).reply(200, MOCK_RESPONSE);

      const response = await apiService.get(API_ENDPOINTS.PROMPTS.BASE);
      expect(response).toMatchObject({
        data: expect.any(Object),
        status: expect.any(Number),
        message: expect.any(String),
        timestamp: expect.any(Number),
        requestId: expect.any(String)
      });
    });

    it('should include request metadata in responses', async () => {
      const headers = {
        'x-request-id': 'test-123',
        'x-response-time': '100ms'
      };

      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE).reply(200, MOCK_RESPONSE, headers);

      const response = await apiService.get(API_ENDPOINTS.PROMPTS.BASE);
      expect(response.metadata).toMatchObject(headers);
    });
  });

  describe('Cache Behavior', () => {
    it('should cache GET requests when enabled', async () => {
      mockAxios.onGet(API_ENDPOINTS.PROMPTS.BASE).reply(200, MOCK_RESPONSE);

      await apiService.get(API_ENDPOINTS.PROMPTS.BASE, { cache: true });
      await apiService.get(API_ENDPOINTS.PROMPTS.BASE, { cache: true });

      expect(mockAxios.history.get.length).toBe(1);
    });

    it('should bypass cache for non-GET requests', async () => {
      mockAxios.onPost(API_ENDPOINTS.PROMPTS.BASE).reply(200, MOCK_RESPONSE);

      await apiService.post(API_ENDPOINTS.PROMPTS.BASE, TEST_PROMPT, { cache: true });
      await apiService.post(API_ENDPOINTS.PROMPTS.BASE, TEST_PROMPT, { cache: true });

      expect(mockAxios.history.post.length).toBe(2);
    });
  });
});