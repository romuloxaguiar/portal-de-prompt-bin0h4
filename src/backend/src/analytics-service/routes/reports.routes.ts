/**
 * Reports Routes Configuration
 * Implements secure routes for analytics report generation, retrieval, archival and scheduling
 * with comprehensive validation, authentication, and error handling.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // v4.18.2
import { ReportsController } from '../controllers/reports.controller';
import { RequestValidator } from '../../../common/middleware/request-validator.middleware';
import { jwtMiddleware } from '../../../security/middleware/jwt.middleware';
import { ValidationSchema } from '../../../common/middleware/request-validator.middleware';

// Validation schemas for report endpoints
const generateReportSchema: ValidationSchema = {
  title: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 100
  },
  description: {
    type: 'string',
    required: true,
    maxLength: 500
  },
  reportType: {
    type: 'string',
    required: true,
    pattern: /^(USAGE_SUMMARY|PERFORMANCE_METRICS|ROI_ANALYSIS|TEAM_ANALYTICS)$/
  },
  dateRange: {
    type: 'object',
    required: true
  },
  metrics: {
    type: 'array',
    required: true
  },
  visualization: {
    type: 'object',
    required: false
  },
  exportFormat: {
    type: 'string',
    required: false,
    pattern: /^(PDF|CSV|JSON)$/
  }
};

const workspaceReportsSchema: ValidationSchema = {
  page: {
    type: 'number',
    required: false
  },
  limit: {
    type: 'number',
    required: false
  },
  reportType: {
    type: 'string',
    required: false,
    pattern: /^(USAGE_SUMMARY|PERFORMANCE_METRICS|ROI_ANALYSIS|TEAM_ANALYTICS)$/
  },
  isArchived: {
    type: 'boolean',
    required: false
  }
};

const archiveReportSchema: ValidationSchema = {
  reportId: {
    type: 'string',
    required: true,
    pattern: /^[0-9a-fA-F]{24}$/
  },
  reason: {
    type: 'string',
    required: true,
    maxLength: 200
  }
};

const scheduleReportSchema: ValidationSchema = {
  title: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 100
  },
  description: {
    type: 'string',
    required: true,
    maxLength: 500
  },
  reportType: {
    type: 'string',
    required: true,
    pattern: /^(USAGE_SUMMARY|PERFORMANCE_METRICS|ROI_ANALYSIS|TEAM_ANALYTICS)$/
  },
  frequency: {
    type: 'string',
    required: true,
    pattern: /^(DAILY|WEEKLY|MONTHLY|QUARTERLY)$/
  },
  startDate: {
    type: 'string',
    required: true
  },
  endDate: {
    type: 'string',
    required: false
  },
  timezone: {
    type: 'string',
    required: true
  },
  metrics: {
    type: 'array',
    required: true
  },
  visualization: {
    type: 'object',
    required: false
  },
  exportFormat: {
    type: 'string',
    required: false,
    pattern: /^(PDF|CSV|JSON)$/
  }
};

/**
 * Initializes report routes with authentication, validation and error handling
 * @param reportsController - Instance of ReportsController for handling report operations
 * @returns Configured Express router instance
 */
export const initializeRoutes = (reportsController: ReportsController): Router => {
  const router = express.Router();

  // Apply JWT authentication to all routes
  router.use(jwtMiddleware);

  // Generate report route
  router.post(
    '/generate',
    RequestValidator.validate(generateReportSchema),
    reportsController.generateReport
  );

  // Get workspace reports route with pagination
  router.get(
    '/workspace',
    RequestValidator.validate(workspaceReportsSchema),
    reportsController.getWorkspaceReports
  );

  // Archive report route
  router.put(
    '/archive/:reportId',
    RequestValidator.validate(archiveReportSchema),
    reportsController.archiveReport
  );

  // Schedule report route
  router.post(
    '/schedule',
    RequestValidator.validate(scheduleReportSchema),
    reportsController.scheduleReport
  );

  return router;
};

// Export configured router
export default initializeRoutes;