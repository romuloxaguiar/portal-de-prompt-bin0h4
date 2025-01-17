/**
 * @fileoverview Controller handling HTTP endpoints for prompt version management
 * with enhanced monitoring, caching, and bulk operations support.
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express'; // v4.18.0
import rateLimit from 'express-rate-limit'; // v6.0.0
import cache from 'express-cache-middleware'; // v1.0.0
import { VersionService } from '../services/version.service';
import { IVersion } from '../interfaces/version.interface';
import { validateString, validatePrompt } from '../../common/utils/validation.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ApiResponse } from '../../common/types/api-response.type';

/**
 * Controller class handling version-related HTTP endpoints
 */
export class VersionController {
  private router: Router;
  private readonly versionRateLimit: any;
  private readonly cacheConfig: any;

  /**
   * Initializes version controller with dependencies and middleware
   */
  constructor(
    private readonly versionService: VersionService,
    private readonly logger: any,
    private readonly cacheManager: any,
    private readonly metricsCollector: any
  ) {
    this.router = Router();
    this.setupRateLimits();
    this.setupCaching();
    this.initializeRoutes();
  }

  /**
   * Configures rate limiting for version endpoints
   */
  private setupRateLimits(): void {
    this.versionRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per window
      message: 'Too many version requests, please try again later'
    });
  }

  /**
   * Configures caching for version endpoints
   */
  private setupCaching(): void {
    this.cacheConfig = cache({
      middleware: {
        handle: (req: Request, res: Response) => {
          return req.method === 'GET';
        }
      },
      engine: this.cacheManager,
      duration: 5 * 60 // 5 minutes cache
    });
  }

  /**
   * Initializes controller routes with middleware
   */
  private initializeRoutes(): void {
    // Create new version
    this.router.post('/', 
      this.versionRateLimit,
      this.validateVersionCreate.bind(this),
      this.createVersion.bind(this)
    );

    // Get version history
    this.router.get('/history/:promptId',
      this.cacheConfig,
      this.getVersionHistory.bind(this)
    );

    // Get specific version
    this.router.get('/:versionId',
      this.cacheConfig,
      this.getVersionById.bind(this)
    );

    // Compare versions
    this.router.get('/compare/:versionId1/:versionId2',
      this.compareVersions.bind(this)
    );

    // Revert to version
    this.router.post('/revert/:promptId/:versionId',
      this.versionRateLimit,
      this.revertToVersion.bind(this)
    );

    // Bulk create versions
    this.router.post('/bulk',
      this.versionRateLimit,
      this.validateBulkCreate.bind(this),
      this.bulkCreateVersions.bind(this)
    );

    // Prune old versions
    this.router.delete('/prune/:promptId',
      this.pruneVersions.bind(this)
    );
  }

  /**
   * Validates version creation request
   */
  private async validateVersionCreate(req: Request, res: Response, next: Function): Promise<void> {
    const startTime = Date.now();

    try {
      const { promptId, content } = req.body;

      // Validate promptId
      const promptIdValidation = validateString(promptId, {
        required: true,
        minLength: 24,
        maxLength: 24
      });

      if (!promptIdValidation.isValid) {
        this.metricsCollector.incrementCounter('version_validation_failures');
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid promptId',
            status: HttpStatus.BAD_REQUEST,
            timestamp: new Date(),
            details: promptIdValidation.errors
          }
        });
        return;
      }

      // Validate prompt content
      const contentValidation = validatePrompt(content, {
        maxTokens: 2000,
        allowedVariables: /\{[a-zA-Z0-9_]+\}/g,
        prohibitedPatterns: [
          /system:\s*override/i,
          /ignore\s+previous\s+instructions/i,
          /bypass\s+restrictions/i
        ]
      });

      if (!contentValidation.isValid) {
        this.metricsCollector.incrementCounter('version_validation_failures');
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: ErrorCode.PROMPT_VALIDATION_ERROR,
            message: 'Invalid prompt content',
            status: HttpStatus.BAD_REQUEST,
            timestamp: new Date(),
            details: contentValidation.errors
          }
        });
        return;
      }

      this.metricsCollector.recordTiming('version_validation_duration', Date.now() - startTime);
      next();
    } catch (error) {
      this.logger.error('Version validation error:', error);
      next(error);
    }
  }

  /**
   * Creates a new version with monitoring and caching
   */
  public async createVersion(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const versionData: Partial<IVersion> = req.body;
      const result = await this.versionService.createVersion(versionData);

      if (result.success) {
        // Invalidate related caches
        await this.cacheManager.del(`version_history_${versionData.promptId}`);
        
        // Record metrics
        this.metricsCollector.incrementCounter('version_created');
        this.metricsCollector.recordTiming('version_creation_duration', Date.now() - startTime);

        res.status(HttpStatus.CREATED).json({
          success: true,
          data: result.data,
          timestamp: new Date()
        });
      } else {
        this.metricsCollector.incrementCounter('version_creation_failures');
        res.status(result.error.status).json({
          success: false,
          error: result.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Version creation error:', error);
      this.metricsCollector.incrementCounter('version_creation_errors');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to create version',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      });
    }
  }

  /**
   * Retrieves version history with pagination and caching
   */
  public async getVersionHistory(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { promptId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await this.versionService.getVersionHistory(promptId, {
        page: Number(page),
        limit: Number(limit)
      });

      if (result.success) {
        this.metricsCollector.recordTiming('version_history_duration', Date.now() - startTime);
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date()
        });
      } else {
        this.metricsCollector.incrementCounter('version_history_failures');
        res.status(result.error.status).json({
          success: false,
          error: result.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Version history error:', error);
      this.metricsCollector.incrementCounter('version_history_errors');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve version history',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      });
    }
  }

  /**
   * Retrieves specific version by ID with caching
   */
  public async getVersionById(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { versionId } = req.params;
      const result = await this.versionService.getVersionById(versionId);

      if (result.success) {
        this.metricsCollector.recordTiming('version_retrieval_duration', Date.now() - startTime);
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date()
        });
      } else {
        this.metricsCollector.incrementCounter('version_retrieval_failures');
        res.status(result.error.status).json({
          success: false,
          error: result.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Version retrieval error:', error);
      this.metricsCollector.incrementCounter('version_retrieval_errors');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve version',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      });
    }
  }

  /**
   * Compares two versions with detailed change tracking
   */
  public async compareVersions(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { versionId1, versionId2 } = req.params;
      const result = await this.versionService.compareVersions(versionId1, versionId2);

      if (result.success) {
        this.metricsCollector.recordTiming('version_comparison_duration', Date.now() - startTime);
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date()
        });
      } else {
        this.metricsCollector.incrementCounter('version_comparison_failures');
        res.status(result.error.status).json({
          success: false,
          error: result.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Version comparison error:', error);
      this.metricsCollector.incrementCounter('version_comparison_errors');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to compare versions',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      });
    }
  }

  /**
   * Reverts prompt to a specific version
   */
  public async revertToVersion(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { promptId, versionId } = req.params;
      const result = await this.versionService.revertToVersion(promptId, versionId);

      if (result.success) {
        // Invalidate related caches
        await this.cacheManager.del(`version_history_${promptId}`);
        
        this.metricsCollector.incrementCounter('version_reverts');
        this.metricsCollector.recordTiming('version_revert_duration', Date.now() - startTime);

        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date()
        });
      } else {
        this.metricsCollector.incrementCounter('version_revert_failures');
        res.status(result.error.status).json({
          success: false,
          error: result.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Version revert error:', error);
      this.metricsCollector.incrementCounter('version_revert_errors');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to revert version',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      });
    }
  }

  /**
   * Validates bulk version creation request
   */
  private async validateBulkCreate(req: Request, res: Response, next: Function): Promise<void> {
    const startTime = Date.now();

    try {
      const { versions } = req.body;

      if (!Array.isArray(versions) || versions.length === 0) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid versions array',
            status: HttpStatus.BAD_REQUEST,
            timestamp: new Date()
          }
        });
        return;
      }

      // Validate each version
      for (const version of versions) {
        const contentValidation = validatePrompt(version.content, {
          maxTokens: 2000,
          allowedVariables: /\{[a-zA-Z0-9_]+\}/g,
          prohibitedPatterns: [
            /system:\s*override/i,
            /ignore\s+previous\s+instructions/i,
            /bypass\s+restrictions/i
          ]
        });

        if (!contentValidation.isValid) {
          res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: {
              code: ErrorCode.PROMPT_VALIDATION_ERROR,
              message: 'Invalid prompt content in bulk create',
              status: HttpStatus.BAD_REQUEST,
              timestamp: new Date(),
              details: contentValidation.errors
            }
          });
          return;
        }
      }

      this.metricsCollector.recordTiming('bulk_validation_duration', Date.now() - startTime);
      next();
    } catch (error) {
      this.logger.error('Bulk validation error:', error);
      next(error);
    }
  }

  /**
   * Creates multiple versions in bulk
   */
  public async bulkCreateVersions(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { versions } = req.body;
      const result = await this.versionService.bulkCreateVersions(versions);

      if (result.success) {
        // Invalidate related caches
        for (const version of versions) {
          await this.cacheManager.del(`version_history_${version.promptId}`);
        }

        this.metricsCollector.incrementCounter('bulk_versions_created', versions.length);
        this.metricsCollector.recordTiming('bulk_creation_duration', Date.now() - startTime);

        res.status(HttpStatus.CREATED).json({
          success: true,
          data: result.data,
          timestamp: new Date()
        });
      } else {
        this.metricsCollector.incrementCounter('bulk_creation_failures');
        res.status(result.error.status).json({
          success: false,
          error: result.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Bulk creation error:', error);
      this.metricsCollector.incrementCounter('bulk_creation_errors');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to create versions in bulk',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      });
    }
  }

  /**
   * Prunes old versions beyond retention limit
   */
  public async pruneVersions(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { promptId } = req.params;
      const result = await this.versionService.pruneVersions(promptId);

      if (result.success) {
        // Invalidate related caches
        await this.cacheManager.del(`version_history_${promptId}`);

        this.metricsCollector.incrementCounter('versions_pruned');
        this.metricsCollector.recordTiming('prune_duration', Date.now() - startTime);

        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date()
        });
      } else {
        this.metricsCollector.incrementCounter('prune_failures');
        res.status(result.error.status).json({
          success: false,
          error: result.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Version pruning error:', error);
      this.metricsCollector.incrementCounter('prune_errors');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to prune versions',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      });
    }
  }

  /**
   * Returns the configured router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}