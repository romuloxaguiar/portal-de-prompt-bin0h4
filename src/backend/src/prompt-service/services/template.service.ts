import { injectable } from 'inversify'; // v6.0.1
import { Logger } from 'winston'; // v3.8.2
import { ITemplate, ITemplateVariable } from '../interfaces/template.interface';
import { Template } from '../models/template.model';
import { TemplateValidator } from '../validators/template.validator';
import { parseTemplate, SecurityLevel, ITemplateValidationOptions } from '../utils/template-parser.util';
import { ValidationResult } from '../../common/utils/validation.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * Service class implementing core business logic for template management
 * with enhanced security, performance monitoring, and error handling
 */
@injectable()
export class TemplateService {
  private readonly MAX_TEMPLATE_SIZE = 10000;
  private readonly DEFAULT_VALIDATION_OPTIONS: ITemplateValidationOptions = {
    strictMode: true,
    maxLength: this.MAX_TEMPLATE_SIZE,
    allowedVariableTypes: ['string', 'number', 'boolean', 'date', 'email', 'url'],
    securityLevel: SecurityLevel.ENTERPRISE,
    sanitizationRules: {
      stripHtml: true,
      normalizeWhitespace: true,
      removeScriptTags: true,
      encodeSpecialChars: true
    },
    maxRecursionDepth: 3
  };

  constructor(
    private readonly validator: TemplateValidator,
    private readonly logger: Logger,
    private readonly cacheManager: any, // Type would be defined by cache implementation
    private readonly metricsCollector: any // Type would be defined by metrics implementation
  ) {}

  /**
   * Creates a new template with comprehensive validation and security checks
   */
  public async createTemplate(templateData: ITemplate): Promise<ITemplate> {
    const startTime = process.hrtime();

    try {
      // Validate template structure and content
      const validationResult = await this.validator.validate(templateData);
      if (!validationResult.isValid) {
        this.logger.error('Template validation failed', {
          errors: validationResult.errors,
          templateId: templateData.id
        });
        throw {
          code: ErrorCode.TEMPLATE_ERROR,
          message: 'Template validation failed',
          status: HttpStatus.BAD_REQUEST,
          validationErrors: validationResult.errors
        };
      }

      // Check for duplicate templates
      const existingTemplate = await Template.findOne({ name: templateData.name });
      if (existingTemplate) {
        throw {
          code: ErrorCode.CONFLICT_ERROR,
          message: 'Template with this name already exists',
          status: HttpStatus.CONFLICT
        };
      }

      // Create template with initial version
      const template = await Template.create({
        ...templateData,
        version: 1,
        metadata: {
          usageCount: 0,
          successRate: 0,
          lastUsed: null,
          averagePromptLength: 0,
          averageResponseTime: 0,
          failureCount: 0,
          popularVariables: [],
          userRating: 0,
          costEstimate: 0
        }
      });

      // Cache template
      await this.cacheManager.set(
        `template:${template.id}`,
        template,
        { ttl: 3600 }
      );

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metricsCollector.recordTemplateCreation({
        templateId: template.id,
        duration: seconds * 1000 + nanoseconds / 1000000,
        size: template.content.length,
        variableCount: template.variables.length
      });

      return template;
    } catch (error) {
      this.logger.error('Failed to create template', { error });
      throw error;
    }
  }

  /**
   * Updates existing template with version control and security validation
   */
  public async updateTemplate(
    id: string,
    updateData: Partial<ITemplate>
  ): Promise<ITemplate> {
    const startTime = process.hrtime();

    try {
      // Validate update data
      if (updateData.content || updateData.variables) {
        const validationResult = await this.validator.validate({
          ...updateData,
          id
        } as ITemplate);
        
        if (!validationResult.isValid) {
          throw {
            code: ErrorCode.TEMPLATE_ERROR,
            message: 'Template validation failed',
            status: HttpStatus.BAD_REQUEST,
            validationErrors: validationResult.errors
          };
        }
      }

      // Find and update template with version increment
      const template = await Template.findById(id);
      if (!template) {
        throw {
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Template not found',
          status: HttpStatus.NOT_FOUND
        };
      }

      // Increment version if content or variables changed
      if (updateData.content || updateData.variables) {
        updateData.version = template.version + 1;
      }

      const updatedTemplate = await Template.findByIdAndUpdate(
        id,
        { ...updateData },
        { new: true }
      );

      // Invalidate cache
      await this.cacheManager.del(`template:${id}`);

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metricsCollector.recordTemplateUpdate({
        templateId: id,
        duration: seconds * 1000 + nanoseconds / 1000000,
        newVersion: updatedTemplate.version
      });

      return updatedTemplate;
    } catch (error) {
      this.logger.error('Failed to update template', { error, templateId: id });
      throw error;
    }
  }

  /**
   * Processes template with variable substitution and security checks
   */
  public async processTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<string> {
    const startTime = process.hrtime();

    try {
      // Check cache first
      const cacheKey = `processed:${templateId}:${JSON.stringify(variables)}`;
      const cachedResult = await this.cacheManager.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Get template
      const template = await Template.findById(templateId);
      if (!template) {
        throw {
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Template not found',
          status: HttpStatus.NOT_FOUND
        };
      }

      // Process template with security checks
      const result = await parseTemplate(
        template,
        variables,
        this.DEFAULT_VALIDATION_OPTIONS
      );

      if (result.securityWarnings.length > 0) {
        this.logger.warn('Security warnings during template processing', {
          templateId,
          warnings: result.securityWarnings
        });
      }

      if (result.invalidVariables.length > 0) {
        throw {
          code: ErrorCode.TEMPLATE_ERROR,
          message: 'Invalid template variables',
          status: HttpStatus.BAD_REQUEST,
          details: { invalidVariables: result.invalidVariables }
        };
      }

      // Cache processed result
      await this.cacheManager.set(cacheKey, result.processedContent, { ttl: 1800 });

      // Update template metadata
      await template.updateMetadata(true, result.processingMetrics.duration);

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metricsCollector.recordTemplateProcessing({
        templateId,
        duration: seconds * 1000 + nanoseconds / 1000000,
        outputSize: result.processedContent.length,
        complexity: result.processingMetrics.complexity
      });

      return result.processedContent;
    } catch (error) {
      this.logger.error('Failed to process template', {
        error,
        templateId,
        variables
      });
      throw error;
    }
  }
}