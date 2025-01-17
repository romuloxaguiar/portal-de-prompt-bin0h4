import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { MockInstance } from 'jest-mock'; // v29.0.0
import { Container } from 'inversify'; // v6.0.1
import { performance } from 'perf_hooks'; // native

import { TemplateService } from '../../src/prompt-service/services/template.service';
import { TemplateValidator } from '../../src/prompt-service/validators/template.validator';
import { Template } from '../../src/prompt-service/models/template.model';
import { ErrorCode } from '../../src/common/constants/error-codes.constant';
import { HttpStatus } from '../../src/common/constants/http-status.constant';

describe('TemplateService', () => {
  let container: Container;
  let templateService: TemplateService;
  let templateValidator: TemplateValidator;
  let mockLogger: any;
  let mockCacheManager: any;
  let mockMetricsCollector: any;

  const mockTemplate = {
    id: 'test-template-id',
    name: 'Test Template',
    description: 'Test template description',
    content: 'Hello {name}, welcome to {company}',
    variables: [
      {
        name: 'name',
        type: 'string',
        description: 'User name',
        required: true,
        defaultValue: null,
        validationRules: {
          minLength: 2,
          maxLength: 50,
          pattern: '^[a-zA-Z\\s]+$'
        }
      },
      {
        name: 'company',
        type: 'string',
        description: 'Company name',
        required: true,
        defaultValue: null,
        validationRules: {
          minLength: 2,
          maxLength: 100
        }
      }
    ],
    category: 'greetings',
    creatorId: 'test-creator',
    teamId: 'test-team',
    isPublic: true,
    version: 1
  };

  beforeEach(() => {
    container = new Container();
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    mockMetricsCollector = {
      recordTemplateCreation: jest.fn(),
      recordTemplateUpdate: jest.fn(),
      recordTemplateProcessing: jest.fn()
    };

    container.bind(TemplateService).toSelf();
    container.bind(TemplateValidator).toSelf();
    container.bind('Logger').toConstantValue(mockLogger);
    container.bind('CacheManager').toConstantValue(mockCacheManager);
    container.bind('MetricsCollector').toConstantValue(mockMetricsCollector);

    templateService = container.get(TemplateService);
    templateValidator = container.get(TemplateValidator);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Template Creation', () => {
    test('should create template with valid data', async () => {
      const validateSpy = jest.spyOn(templateValidator, 'validate')
        .mockResolvedValue({ isValid: true, errors: [] });
      
      jest.spyOn(Template, 'findOne').mockResolvedValue(null);
      jest.spyOn(Template, 'create').mockResolvedValue(mockTemplate);

      const result = await templateService.createTemplate(mockTemplate);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockTemplate.name);
      expect(validateSpy).toHaveBeenCalledWith(mockTemplate);
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(mockMetricsCollector.recordTemplateCreation).toHaveBeenCalled();
    });

    test('should reject template with validation errors', async () => {
      const validationError = {
        isValid: false,
        errors: [{ field: 'name', message: 'Invalid name' }]
      };

      jest.spyOn(templateValidator, 'validate')
        .mockResolvedValue(validationError);

      await expect(templateService.createTemplate(mockTemplate))
        .rejects.toMatchObject({
          code: ErrorCode.TEMPLATE_ERROR,
          status: HttpStatus.BAD_REQUEST
        });
    });

    test('should prevent duplicate template names', async () => {
      jest.spyOn(templateValidator, 'validate')
        .mockResolvedValue({ isValid: true, errors: [] });
      
      jest.spyOn(Template, 'findOne').mockResolvedValue(mockTemplate);

      await expect(templateService.createTemplate(mockTemplate))
        .rejects.toMatchObject({
          code: ErrorCode.CONFLICT_ERROR,
          status: HttpStatus.CONFLICT
        });
    });
  });

  describe('Template Security Validation', () => {
    test('should detect and prevent XSS attempts', async () => {
      const maliciousTemplate = {
        ...mockTemplate,
        content: '<script>alert("xss")</script>{name}'
      };

      const result = await templateValidator.validate(maliciousTemplate);
      
      expect(result.isValid).toBe(false);
      expect(result.securityStatus.xssPassed).toBe(false);
    });

    test('should sanitize template content', async () => {
      const template = {
        ...mockTemplate,
        content: 'Hello <b>{name}</b>'
      };

      jest.spyOn(templateValidator, 'validate')
        .mockResolvedValue({ isValid: true, errors: [] });
      
      const result = await templateService.createTemplate(template);
      
      expect(result.content).not.toContain('<b>');
    });

    test('should validate variable injection patterns', async () => {
      const template = {
        ...mockTemplate,
        content: '{name}; DROP TABLE templates;'
      };

      const result = await templateValidator.validate(template);
      
      expect(result.isValid).toBe(false);
      expect(result.securityStatus.injectionPassed).toBe(false);
    });
  });

  describe('Template Version Control', () => {
    test('should increment version on content update', async () => {
      const updatedContent = 'Updated content {name}';
      
      jest.spyOn(Template, 'findById').mockResolvedValue(mockTemplate);
      jest.spyOn(Template, 'findByIdAndUpdate').mockResolvedValue({
        ...mockTemplate,
        content: updatedContent,
        version: 2
      });

      const result = await templateService.updateTemplate(mockTemplate.id, {
        content: updatedContent
      });

      expect(result.version).toBe(2);
      expect(mockCacheManager.del).toHaveBeenCalled();
    });

    test('should handle concurrent modifications', async () => {
      const template1 = { ...mockTemplate, version: 1 };
      const template2 = { ...mockTemplate, version: 2 };

      jest.spyOn(Template, 'findById')
        .mockResolvedValueOnce(template1)
        .mockResolvedValueOnce(template2);

      await expect(templateService.updateTemplate(mockTemplate.id, {
        content: 'New content'
      })).rejects.toMatchObject({
        code: ErrorCode.CONFLICT_ERROR
      });
    });
  });

  describe('Performance Monitoring', () => {
    test('should track template processing time', async () => {
      const startTime = performance.now();
      
      jest.spyOn(Template, 'findById').mockResolvedValue(mockTemplate);
      
      await templateService.processTemplate(mockTemplate.id, {
        name: 'John',
        company: 'Acme'
      });

      const processingTime = performance.now() - startTime;
      
      expect(mockMetricsCollector.recordTemplateProcessing)
        .toHaveBeenCalledWith(expect.objectContaining({
          templateId: mockTemplate.id,
          duration: expect.any(Number)
        }));
      
      expect(processingTime).toBeLessThan(1000); // Should process within 1s
    });

    test('should utilize cache for repeated processing', async () => {
      const variables = { name: 'John', company: 'Acme' };
      const processedContent = 'Hello John, welcome to Acme';
      
      mockCacheManager.get.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(processedContent);

      jest.spyOn(Template, 'findById').mockResolvedValue(mockTemplate);

      // First call - cache miss
      await templateService.processTemplate(mockTemplate.id, variables);
      
      // Second call - cache hit
      const result = await templateService.processTemplate(mockTemplate.id, variables);

      expect(result).toBe(processedContent);
      expect(mockCacheManager.get).toHaveBeenCalledTimes(2);
      expect(mockCacheManager.set).toHaveBeenCalledTimes(1);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});