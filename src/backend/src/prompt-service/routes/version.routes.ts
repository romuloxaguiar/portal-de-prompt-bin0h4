/**
 * @fileoverview Express router configuration for prompt version management endpoints.
 * Implements comprehensive version control functionality with secure access control,
 * request validation, and standardized responses.
 * 
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v6.7.0
import { VersionController } from '../controllers/version.controller';
import { authenticate } from '../../api-gateway/middleware/auth.middleware';
import { validateRequest } from '../../common/middleware/request-validator.middleware';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * Rate limiting configuration for version management operations
 */
const versionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    code: ErrorCode.RATE_LIMIT_ERROR,
    message: 'Too many version requests, please try again later',
    status: HttpStatus.TOO_MANY_REQUESTS,
    timestamp: new Date()
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Validation schema for version creation
 */
const versionCreateSchema = {
  promptId: {
    type: 'string',
    required: true,
    minLength: 24,
    maxLength: 24
  },
  content: {
    type: 'string',
    required: true,
    maxLength: 10000
  }
};

/**
 * Validation schema for version revert
 */
const versionRevertSchema = {
  promptId: {
    type: 'string',
    required: true,
    minLength: 24,
    maxLength: 24
  },
  versionId: {
    type: 'string',
    required: true,
    minLength: 24,
    maxLength: 24
  }
};

/**
 * Configures and returns version management router with protected endpoints
 * @param versionController - Initialized version controller instance
 * @returns Configured Express router
 */
export function configureVersionRoutes(versionController: VersionController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  // Create new version
  router.post('/',
    versionRateLimiter,
    validateRequest(versionCreateSchema),
    versionController.createVersion
  );

  // Get version history with pagination
  router.get('/:promptId/history',
    versionController.getVersionHistory
  );

  // Get specific version
  router.get('/:versionId',
    versionController.getVersionById
  );

  // Compare versions
  router.get('/compare/:versionId1/:versionId2',
    versionRateLimiter,
    versionController.compareVersions
  );

  // Revert to version
  router.post('/:promptId/revert/:versionId',
    versionRateLimiter,
    validateRequest(versionRevertSchema),
    versionController.revertToVersion
  );

  // Bulk create versions
  router.post('/bulk',
    versionRateLimiter,
    validateRequest({
      versions: {
        type: 'array',
        required: true
      }
    }),
    versionController.bulkCreateVersions
  );

  // Prune old versions
  router.delete('/:promptId/prune',
    versionRateLimiter,
    versionController.pruneVersions
  );

  return router;
}

/**
 * Export configured version router for use in main application
 */
export const versionRouter = configureVersionRoutes(new VersionController());