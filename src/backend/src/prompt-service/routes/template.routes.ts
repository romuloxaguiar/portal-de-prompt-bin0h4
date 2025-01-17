import { Router } from 'express'; // v4.18.2
import { injectable } from 'inversify'; // v6.0.1
import { interfaces } from 'inversify-express-utils'; // v6.4.3
import { RateLimit } from 'express-rate-limit'; // v6.7.0
import { CacheManager } from 'cache-manager'; // v5.2.0

import { TemplateController } from '../controllers/template.controller';
import { TemplateValidator } from '../validators/template.validator';
import { RequestValidator } from '../../../common/middleware/request-validator.middleware';
import { ValidationError } from '../../../common/interfaces/error.interface';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { HttpStatus } from '../../../common/constants/http-status.constant';

const TEMPLATE_BASE_PATH = '/api/v1/templates';

/**
 * Configures and manages template-related routes with comprehensive security,
 * monitoring, and caching features.
 */
@injectable()
export class TemplateRoutes {
  private readonly router: Router;

  constructor(
    private readonly templateController: TemplateController,
    private readonly templateValidator: TemplateValidator,
    private readonly requestValidator: RequestValidator,
    private readonly rateLimiter: RateLimit,
    private readonly cacheManager: CacheManager
  ) {
    this.router = Router();
    this.configureRoutes();
  }

  /**
   * Configures all template-related routes with comprehensive middleware chains
   */
  public configureRoutes(): Router {
    // Rate limiting configuration per endpoint
    const createRateLimit = this.rateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 requests per minute
      message: 'Too many template creation requests'
    });

    const updateRateLimit = this.rateLimiter({
      windowMs: 60 * 1000,
      max: 20,
      message: 'Too many template update requests'
    });

    const processRateLimit = this.rateLimiter({
      windowMs: 60 * 1000,
      max: 50,
      message: 'Too many template processing requests'
    });

    // Cache configuration
    const cacheMiddleware = async (req: any, res: any, next: any) => {
      const key = `template:${req.params.id}`;
      const cached = await this.cacheManager.get(key);
      if (cached) {
        return res.json(cached);
      }
      next();
    };

    // Create template
    this.router.post(
      TEMPLATE_BASE_PATH,
      createRateLimit,
      this.requestValidator.validate,
      async (req, res, next) => {
        try {
          const result = await this.templateController.createTemplate(req, res);
          res.status(HttpStatus.CREATED).json(result);
        } catch (error) {
          next(error);
        }
      }
    );

    // Update template
    this.router.put(
      `${TEMPLATE_BASE_PATH}/:id`,
      updateRateLimit,
      this.requestValidator.validate,
      async (req, res, next) => {
        try {
          const result = await this.templateController.updateTemplate(req, res);
          await this.cacheManager.del(`template:${req.params.id}`);
          res.status(HttpStatus.OK).json(result);
        } catch (error) {
          next(error);
        }
      }
    );

    // Get template by ID
    this.router.get(
      `${TEMPLATE_BASE_PATH}/:id`,
      cacheMiddleware,
      async (req, res, next) => {
        try {
          const result = await this.templateController.getTemplateById(req, res);
          await this.cacheManager.set(`template:${req.params.id}`, result, { ttl: 3600 });
          res.status(HttpStatus.OK).json(result);
        } catch (error) {
          next(error);
        }
      }
    );

    // Get templates by category
    this.router.get(
      `${TEMPLATE_BASE_PATH}/category/:category`,
      cacheMiddleware,
      async (req, res, next) => {
        try {
          const result = await this.templateController.getTemplatesByCategory(req, res);
          await this.cacheManager.set(
            `templates:category:${req.params.category}`,
            result,
            { ttl: 1800 }
          );
          res.status(HttpStatus.OK).json(result);
        } catch (error) {
          next(error);
        }
      }
    );

    // Delete template
    this.router.delete(
      `${TEMPLATE_BASE_PATH}/:id`,
      async (req, res, next) => {
        try {
          await this.templateController.deleteTemplate(req, res);
          await this.cacheManager.del(`template:${req.params.id}`);
          res.status(HttpStatus.NO_CONTENT).send();
        } catch (error) {
          next(error);
        }
      }
    );

    // Process template
    this.router.post(
      `${TEMPLATE_BASE_PATH}/:id/process`,
      processRateLimit,
      this.requestValidator.validate,
      async (req, res, next) => {
        try {
          const result = await this.templateController.processTemplate(req, res);
          res.status(HttpStatus.OK).json(result);
        } catch (error) {
          next(error);
        }
      }
    );

    // Error handling middleware
    this.router.use((error: Error, req: any, res: any, next: any) => {
      if (error instanceof ValidationError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: error.message,
          validationErrors: error.validationErrors,
          timestamp: new Date()
        });
      }

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: new Date()
      });
    });

    return this.router;
  }
}