import { injectable } from 'inversify'; // v6.0.1
import { 
  controller, httpGet, httpPost, httpPut, httpDelete, 
  authorize, rateLimit 
} from 'inversify-express-utils'; // v6.4.3
import { Request, Response } from 'express'; // v4.18.2
import { cache } from 'express-cache-middleware'; // v1.0.0
import { MetricsService } from '@opentelemetry/api'; // v1.4.0

import { TemplateService } from '../services/template.service';
import { TemplateValidator } from '../validators/template.validator';
import { ITemplate } from '../interfaces/template.interface';
import { ValidationError } from '../../common/interfaces/error.interface';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { sanitizeInput } from '../../common/utils/validation.util';

interface ApiResponse<T> {
  status: string;
  data: T;
  metadata?: {
    timestamp: Date;
    processingTime: number;
  };
}

/**
 * Enhanced controller for managing prompt templates with comprehensive security,
 * monitoring, and caching features.
 */
@injectable()
@controller('/api/v1/templates')
@rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly templateValidator: TemplateValidator,
    private readonly metricsService: MetricsService
  ) {}

  /**
   * Creates a new prompt template with validation and security checks
   */
  @httpPost('/')
  @authorize('template:create')
  @rateLimit({ windowMs: 60 * 1000, max: 10 })
  async createTemplate(req: Request, res: Response): Promise<ApiResponse<ITemplate>> {
    const startTime = process.hrtime();

    try {
      // Sanitize and validate input
      const sanitizedInput = {
        ...req.body,
        name: sanitizeInput(req.body.name, { stripHtml: true, normalizeWhitespace: true }),
        content: sanitizeInput(req.body.content, { 
          stripHtml: true, 
          normalizeWhitespace: true,
          removeScriptTags: true
        })
      };

      const validationResult = await this.templateValidator.validate(sanitizedInput);
      if (!validationResult.isValid) {
        const error: ValidationError = {
          code: ErrorCode.TEMPLATE_ERROR,
          message: 'Template validation failed',
          status: HttpStatus.BAD_REQUEST,
          timestamp: new Date(),
          validationErrors: validationResult.errors.map(e => ({
            field: e.field,
            message: e.message
          }))
        };
        throw error;
      }

      // Create template
      const template = await this.templateService.createTemplate(sanitizedInput);

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      
      this.metricsService.recordMetric('template.create', {
        duration,
        success: true,
        templateId: template.id,
        userId: req.user?.id
      });

      return {
        status: 'success',
        data: template,
        metadata: {
          timestamp: new Date(),
          processingTime: duration
        }
      };

    } catch (error) {
      // Record error metrics
      this.metricsService.recordMetric('template.create.error', {
        error: error.code,
        userId: req.user?.id
      });

      throw error;
    }
  }

  /**
   * Updates an existing template with version control
   */
  @httpPut('/:id')
  @authorize('template:update')
  @rateLimit({ windowMs: 60 * 1000, max: 20 })
  async updateTemplate(req: Request, res: Response): Promise<ApiResponse<ITemplate>> {
    const startTime = process.hrtime();

    try {
      const templateId = req.params.id;
      
      // Sanitize and validate input
      const sanitizedInput = {
        ...req.body,
        name: sanitizeInput(req.body.name, { stripHtml: true }),
        content: sanitizeInput(req.body.content, { 
          stripHtml: true,
          removeScriptTags: true
        })
      };

      const validationResult = await this.templateValidator.validate(sanitizedInput);
      if (!validationResult.isValid) {
        throw {
          code: ErrorCode.TEMPLATE_ERROR,
          message: 'Template validation failed',
          status: HttpStatus.BAD_REQUEST,
          validationErrors: validationResult.errors
        };
      }

      const template = await this.templateService.updateTemplate(templateId, sanitizedInput);

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      this.metricsService.recordMetric('template.update', {
        duration,
        success: true,
        templateId,
        userId: req.user?.id
      });

      return {
        status: 'success',
        data: template,
        metadata: {
          timestamp: new Date(),
          processingTime: duration
        }
      };

    } catch (error) {
      this.metricsService.recordMetric('template.update.error', {
        error: error.code,
        templateId: req.params.id,
        userId: req.user?.id
      });

      throw error;
    }
  }

  /**
   * Retrieves a template by ID with caching
   */
  @httpGet('/:id')
  @authorize('template:read')
  @cache({ ttl: 3600 })
  async getTemplateById(req: Request, res: Response): Promise<ApiResponse<ITemplate>> {
    const startTime = process.hrtime();

    try {
      const template = await this.templateService.getTemplateById(req.params.id);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      this.metricsService.recordMetric('template.get', {
        duration,
        success: true,
        templateId: req.params.id,
        userId: req.user?.id
      });

      return {
        status: 'success',
        data: template,
        metadata: {
          timestamp: new Date(),
          processingTime: duration
        }
      };

    } catch (error) {
      this.metricsService.recordMetric('template.get.error', {
        error: error.code,
        templateId: req.params.id,
        userId: req.user?.id
      });

      throw error;
    }
  }

  /**
   * Retrieves templates by category with pagination
   */
  @httpGet('/category/:category')
  @authorize('template:read')
  @cache({ ttl: 1800 })
  async getTemplatesByCategory(req: Request, res: Response): Promise<ApiResponse<ITemplate[]>> {
    const startTime = process.hrtime();

    try {
      const { category } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const templates = await this.templateService.getTemplatesByCategory(
        category,
        Number(page),
        Number(limit)
      );

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      this.metricsService.recordMetric('template.list', {
        duration,
        success: true,
        category,
        userId: req.user?.id
      });

      return {
        status: 'success',
        data: templates,
        metadata: {
          timestamp: new Date(),
          processingTime: duration
        }
      };

    } catch (error) {
      this.metricsService.recordMetric('template.list.error', {
        error: error.code,
        category: req.params.category,
        userId: req.user?.id
      });

      throw error;
    }
  }

  /**
   * Deletes a template with security checks
   */
  @httpDelete('/:id')
  @authorize('template:delete')
  async deleteTemplate(req: Request, res: Response): Promise<ApiResponse<void>> {
    const startTime = process.hrtime();

    try {
      await this.templateService.deleteTemplate(req.params.id);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      this.metricsService.recordMetric('template.delete', {
        duration,
        success: true,
        templateId: req.params.id,
        userId: req.user?.id
      });

      return {
        status: 'success',
        data: null,
        metadata: {
          timestamp: new Date(),
          processingTime: duration
        }
      };

    } catch (error) {
      this.metricsService.recordMetric('template.delete.error', {
        error: error.code,
        templateId: req.params.id,
        userId: req.user?.id
      });

      throw error;
    }
  }

  /**
   * Processes a template with variable substitution
   */
  @httpPost('/:id/process')
  @authorize('template:process')
  @rateLimit({ windowMs: 60 * 1000, max: 50 })
  async processTemplate(req: Request, res: Response): Promise<ApiResponse<string>> {
    const startTime = process.hrtime();

    try {
      const { variables } = req.body;
      
      // Sanitize variables
      const sanitizedVariables = Object.entries(variables).reduce((acc, [key, value]) => ({
        ...acc,
        [key]: sanitizeInput(String(value), { 
          stripHtml: true,
          removeScriptTags: true
        })
      }), {});

      const result = await this.templateService.processTemplate(
        req.params.id,
        sanitizedVariables
      );

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      this.metricsService.recordMetric('template.process', {
        duration,
        success: true,
        templateId: req.params.id,
        userId: req.user?.id
      });

      return {
        status: 'success',
        data: result,
        metadata: {
          timestamp: new Date(),
          processingTime: duration
        }
      };

    } catch (error) {
      this.metricsService.recordMetric('template.process.error', {
        error: error.code,
        templateId: req.params.id,
        userId: req.user?.id
      });

      throw error;
    }
  }
}