/**
 * Prompt Management Routes
 * 
 * Configures secure, validated, and monitored REST endpoints for prompt management
 * in the Prompts Portal system. Implements comprehensive security controls,
 * request validation, and performance optimization.
 * 
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.0
import { authenticate } from '@nestjs/passport'; // ^10.0.0
import compression from 'compression'; // ^1.7.4
import helmet from 'helmet'; // ^7.0.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { auditLog } from '@company/audit-logger'; // ^1.0.0

import { PromptController } from '../controllers/prompt.controller';
import { validateRequest } from '../../common/middleware/request-validator.middleware';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ErrorCode } from '../../common/constants/error-codes.constant';

// Base path for prompt management endpoints
const BASE_PATH = '/api/v1/prompts';

// Rate limiting configurations
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100;

/**
 * Configures and returns the Express router with secure prompt management routes
 */
export function configureRoutes(): Router {
    const router = Router();
    const promptController = new PromptController();

    // Apply global middleware
    router.use(compression());
    router.use(helmet());
    router.use(auditLog());

    // Configure rate limiters
    const defaultRateLimit = rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: RATE_LIMIT_MAX,
        message: {
            code: ErrorCode.RATE_LIMIT_ERROR,
            message: 'Too many requests, please try again later',
            status: HttpStatus.TOO_MANY_REQUESTS
        }
    });

    const createPromptLimit = rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: 10,
        message: {
            code: ErrorCode.RATE_LIMIT_ERROR,
            message: 'Create prompt rate limit exceeded',
            status: HttpStatus.TOO_MANY_REQUESTS
        }
    });

    // Create new prompt
    router.post('/',
        authenticate('jwt'),
        createPromptLimit,
        validateRequest,
        auditLog({ action: 'create_prompt' }),
        async (req, res, next) => {
            try {
                const result = await promptController.createPrompt(req.body);
                res.status(HttpStatus.CREATED).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Update existing prompt
    router.put('/:id',
        authenticate('jwt'),
        defaultRateLimit,
        validateRequest,
        auditLog({ action: 'update_prompt' }),
        async (req, res, next) => {
            try {
                const result = await promptController.updatePrompt(req.params.id, req.body);
                res.status(HttpStatus.OK).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Get prompts by team
    router.get('/team/:teamId',
        authenticate('jwt'),
        defaultRateLimit,
        auditLog({ action: 'get_team_prompts' }),
        async (req, res, next) => {
            try {
                const result = await promptController.getPromptsByTeam(
                    req.params.teamId,
                    req.query.status,
                    {
                        page: parseInt(req.query.page as string) || 1,
                        limit: parseInt(req.query.limit as string) || 20
                    }
                );
                res.status(HttpStatus.OK).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Execute prompt
    router.post('/:id/execute',
        authenticate('jwt'),
        defaultRateLimit,
        validateRequest,
        auditLog({ action: 'execute_prompt' }),
        async (req, res, next) => {
            try {
                const result = await promptController.executePrompt(req.params.id, req.body);
                res.status(HttpStatus.OK).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Optimize prompt
    router.post('/:id/optimize',
        authenticate('jwt'),
        defaultRateLimit,
        validateRequest,
        auditLog({ action: 'optimize_prompt' }),
        async (req, res, next) => {
            try {
                const result = await promptController.optimizePrompt(req.params.id, req.body);
                res.status(HttpStatus.OK).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Error handling middleware
    router.use((err: any, req: any, res: any, next: any) => {
        console.error('Route Error:', err);
        res.status(err.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
            code: err.code || ErrorCode.INTERNAL_SERVER_ERROR,
            message: err.message || 'Internal server error',
            timestamp: new Date(),
            path: req.path
        });
    });

    return router;
}

// Export configured router
export const promptRouter = configureRoutes();