import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { Model } from 'mongoose'; // ^7.0.0
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // ^29.0.0
import { PromptService } from '../../src/prompt-service/services/prompt.service';
import { AIIntegrationService } from '../../src/prompt-service/services/ai-integration.service';
import { IPrompt, PromptStatus } from '../../src/prompt-service/interfaces/prompt.interface';
import { HttpStatus } from '../../src/common/constants/http-status.constant';
import { ErrorCode } from '../../src/common/constants/error-codes.constant';

describe('PromptService', () => {
  let module: TestingModule;
  let promptService: PromptService;
  let promptModel: Model<IPrompt>;
  let aiIntegrationService: AIIntegrationService;
  let mockMetricsService: any;
  let mockSecurityService: any;

  // Mock data
  const mockPrompt: IPrompt = {
    id: 'test-prompt-id',
    title: 'Test Prompt',
    content: 'This is a test prompt with {variable}',
    templateId: 'test-template-id',
    variables: [
      { name: 'variable', value: 'test', type: 'string' }
    ],
    creatorId: 'test-user-id',
    teamId: 'test-team-id',
    status: PromptStatus.ACTIVE,
    currentVersion: {
      id: 'v1',
      promptId: 'test-prompt-id',
      content: 'This is a test prompt with {variable}',
      versionNumber: 1,
      changes: {
        addedContent: [],
        removedContent: [],
        modifiedVariables: [],
        description: 'Initial version',
        timestamp: new Date()
      },
      createdBy: 'test-user-id',
      createdAt: new Date()
    },
    metadata: {
      usageCount: 0,
      successRate: 0,
      lastUsed: null,
      aiModel: 'gpt-4',
      averageResponseTime: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    // Mock services
    mockMetricsService = {
      recordLatency: jest.fn(),
      trackRateLimit: jest.fn(),
      monitorCircuitBreaker: jest.fn()
    };

    mockSecurityService = {
      validateAccess: jest.fn().mockResolvedValue(true),
      checkPermissions: jest.fn().mockResolvedValue(true),
      auditOperation: jest.fn()
    };

    // Create test module
    module = await Test.createTestingModule({
      providers: [
        PromptService,
        {
          provide: 'PromptModel',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            find: jest.fn(),
            aggregate: jest.fn()
          }
        },
        {
          provide: AIIntegrationService,
          useValue: {
            executePrompt: jest.fn(),
            checkModelHealth: jest.fn(),
            validateRateLimits: jest.fn()
          }
        },
        {
          provide: 'MetricsService',
          useValue: mockMetricsService
        },
        {
          provide: 'SecurityService',
          useValue: mockSecurityService
        }
      ]
    }).compile();

    promptService = module.get<PromptService>(PromptService);
    promptModel = module.get<Model<IPrompt>>('PromptModel');
    aiIntegrationService = module.get<AIIntegrationService>(AIIntegrationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPrompt', () => {
    it('should create prompt with security validation', async () => {
      const startTime = Date.now();
      const createPromptDto = {
        title: 'New Prompt',
        content: 'Test content with {variable}',
        templateId: 'template-id',
        variables: [{ name: 'variable', value: 'test', type: 'string' }],
        creatorId: 'user-id'
      };

      jest.spyOn(promptModel, 'create').mockResolvedValue(mockPrompt);
      jest.spyOn(mockSecurityService, 'validateAccess').mockResolvedValue(true);

      const result = await promptService.createPrompt(createPromptDto, 'team-id');

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPrompt.id);
      expect(mockSecurityService.validateAccess).toHaveBeenCalled();
      expect(mockMetricsService.recordLatency).toHaveBeenCalled();
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(2000); // Performance SLA check
    });

    it('should handle validation errors during prompt creation', async () => {
      const invalidPromptDto = {
        title: '', // Invalid empty title
        content: 'Test content',
        templateId: 'template-id',
        variables: [],
        creatorId: 'user-id'
      };

      await expect(promptService.createPrompt(invalidPromptDto, 'team-id'))
        .rejects
        .toThrow('Validation failed');
    });
  });

  describe('executePrompt', () => {
    it('should execute prompt with circuit breaker pattern', async () => {
      const executeOptions = {
        model: 'gpt-4',
        variables: { test: 'value' }
      };

      jest.spyOn(promptModel, 'findById').mockResolvedValue(mockPrompt);
      jest.spyOn(aiIntegrationService, 'executePrompt').mockResolvedValue({
        content: 'AI response',
        tokens: 100,
        success: true
      });

      const result = await promptService.executePrompt(
        mockPrompt.id,
        executeOptions,
        'team-id'
      );

      expect(result).toBeDefined();
      expect(result.content).toBe('AI response');
      expect(mockMetricsService.monitorCircuitBreaker).toHaveBeenCalled();
    });

    it('should handle rate limiting correctly', async () => {
      jest.spyOn(aiIntegrationService, 'validateRateLimits')
        .mockRejectedValue({
          code: ErrorCode.RATE_LIMIT_ERROR,
          status: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded'
        });

      await expect(promptService.executePrompt(
        mockPrompt.id,
        { model: 'gpt-4', variables: {} },
        'team-id'
      )).rejects.toThrow('Rate limit exceeded');

      expect(mockMetricsService.trackRateLimit).toHaveBeenCalled();
    });
  });

  describe('updatePrompt', () => {
    it('should update prompt with version control', async () => {
      const updateDto = {
        content: 'Updated content',
        variables: [{ name: 'variable', value: 'updated', type: 'string' }],
        userId: 'user-id'
      };

      jest.spyOn(promptModel, 'findByIdAndUpdate').mockResolvedValue({
        ...mockPrompt,
        content: updateDto.content,
        variables: updateDto.variables
      });

      const result = await promptService.updatePrompt(
        mockPrompt.id,
        updateDto,
        'team-id'
      );

      expect(result).toBeDefined();
      expect(result.content).toBe(updateDto.content);
      expect(result.currentVersion.versionNumber).toBeGreaterThan(
        mockPrompt.currentVersion.versionNumber
      );
    });

    it('should handle concurrent update conflicts', async () => {
      jest.spyOn(promptModel, 'findByIdAndUpdate').mockRejectedValue({
        code: ErrorCode.CONFLICT_ERROR,
        status: HttpStatus.CONFLICT,
        message: 'Concurrent update detected'
      });

      await expect(promptService.updatePrompt(
        mockPrompt.id,
        { content: 'test', variables: [], userId: 'user-id' },
        'team-id'
      )).rejects.toThrow('Concurrent update detected');
    });
  });

  describe('getPromptsByTeam', () => {
    it('should return prompts with pagination', async () => {
      const mockPrompts = [mockPrompt];
      const mockCount = 1;

      jest.spyOn(promptModel, 'find').mockResolvedValue(mockPrompts);
      jest.spyOn(promptModel, 'aggregate').mockResolvedValue([{ count: mockCount }]);

      const result = await promptService.getPromptsByTeam('team-id', {
        page: 1,
        limit: 10
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(mockCount);
    });
  });

  describe('optimizePrompt', () => {
    it('should optimize prompt using AI suggestions', async () => {
      const optimizationOptions = {
        target: 'clarity',
        maxTokens: 1000
      };

      jest.spyOn(aiIntegrationService, 'executePrompt').mockResolvedValue({
        content: 'Optimized content',
        tokens: 50,
        success: true
      });

      const result = await promptService.optimizePrompt(
        mockPrompt.id,
        optimizationOptions,
        'team-id'
      );

      expect(result).toBeDefined();
      expect(result.content).toBe('Optimized content');
      expect(mockMetricsService.recordLatency).toHaveBeenCalled();
    });
  });

  describe('validatePromptSecurity', () => {
    it('should validate prompt security settings', async () => {
      const securityOptions = {
        checkInjection: true,
        validateVariables: true
      };

      const result = await promptService.validatePromptSecurity(
        mockPrompt.id,
        securityOptions
      );

      expect(result.isValid).toBe(true);
      expect(mockSecurityService.checkPermissions).toHaveBeenCalled();
    });
  });
});