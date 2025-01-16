/**
 * Analytics Metrics Routes Configuration
 * Implements secure and validated routes for analytics metrics operations
 * with comprehensive error handling and monitoring capabilities.
 * 
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import { MetricsController } from '../controllers/metrics.controller';
import { AuthMiddleware } from '../../api-gateway/middleware/auth.middleware';
import { RequestValidator } from '../../common/middleware/request-validator.middleware';
import { Logger } from '../../common/utils/logger.util';

// Initialize router with strict routing and case sensitivity
const router = Router({
  strict: true,
  caseSensitive: true
});

// Initialize logger
const logger = new Logger('MetricsRoutes');

// Validation schemas for request payloads
const recordMetricSchema = {
  promptId: {
    type: 'string',
    required: true,
    pattern: /^[a-f\d]{24}$/i // MongoDB ObjectId format
  },
  workspaceId: {
    type: 'string',
    required: true,
    pattern: /^[a-f\d]{24}$/i
  },
  userId: {
    type: 'string',
    required: true,
    pattern: /^[a-f\d]{24}$/i
  },
  metricType: {
    type: 'string',
    required: true,
    pattern: /^(USAGE|SUCCESS_RATE|RESPONSE_TIME|ERROR_RATE|USER_SATISFACTION|ROI|COST_SAVINGS)$/
  },
  value: {
    type: 'number',
    required: true
  },
  metadata: {
    type: 'object',
    required: false
  }
};

const dateRangeSchema = {
  startDate: {
    type: 'string',
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
  },
  endDate: {
    type: 'string',
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
  }
};

// Initialize validators
const metricValidator = new RequestValidator(recordMetricSchema);
const dateRangeValidator = new RequestValidator(dateRangeSchema);

/**
 * Configure metrics routes with authentication, validation, and error handling
 */
export default function configureMetricsRoutes(
  metricsController: MetricsController,
  authMiddleware: AuthMiddleware
): Router {
  // Record new metric
  router.post('/',
    authMiddleware.authenticate,
    metricValidator.validate,
    async (req, res, next) => {
      try {
        logger.debug('Recording metric', { body: req.body });
        await metricsController.recordMetric(req, res);
      } catch (error) {
        logger.error('Error recording metric', { error });
        next(error);
      }
    }
  );

  // Get prompt-specific metrics
  router.get('/prompt/:promptId',
    authMiddleware.authenticate,
    dateRangeValidator.validate,
    async (req, res, next) => {
      try {
        logger.debug('Getting prompt metrics', { promptId: req.params.promptId });
        await metricsController.getPromptMetrics(req, res);
      } catch (error) {
        logger.error('Error retrieving prompt metrics', { error });
        next(error);
      }
    }
  );

  // Get workspace analytics
  router.get('/workspace/:workspaceId',
    authMiddleware.authenticate,
    dateRangeValidator.validate,
    async (req, res, next) => {
      try {
        logger.debug('Getting workspace analytics', { workspaceId: req.params.workspaceId });
        await metricsController.getWorkspaceAnalytics(req, res);
      } catch (error) {
        logger.error('Error retrieving workspace analytics', { error });
        next(error);
      }
    }
  );

  // Get ROI metrics
  router.get('/roi/:workspaceId',
    authMiddleware.authenticate,
    dateRangeValidator.validate,
    async (req, res, next) => {
      try {
        logger.debug('Getting ROI metrics', { workspaceId: req.params.workspaceId });
        await metricsController.getROIMetrics(req, res);
      } catch (error) {
        logger.error('Error retrieving ROI metrics', { error });
        next(error);
      }
    }
  );

  // Apply rate limiting to all routes
  router.use(authMiddleware.applyRateLimit());

  return router;
}

// Export configured router
export { router };