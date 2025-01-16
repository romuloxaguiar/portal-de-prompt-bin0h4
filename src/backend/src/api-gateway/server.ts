/**
 * API Gateway Server
 * Main entry point for the API Gateway service that handles routing, security, and monitoring
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import compression from 'compression'; // v1.7.4
import { trace, context, SpanStatusCode } from '@opentelemetry/api'; // v1.4.1
import rateLimit from 'express-rate-limit'; // v6.9.0
import winston from 'winston'; // v3.8.2

import { corsConfig } from './config/cors.config';
import { rateLimitConfig } from './config/rate-limit.config';
import configureRoutes from './routes';
import { AuthMiddleware } from './middleware/auth.middleware';
import { Logger } from '../common/utils/logger.util';
import { HttpStatus } from '../common/constants/http-status.constant';
import { ErrorCode } from '../common/constants/error-codes.constant';
import { ApiResponse } from '../common/types/api-response.type';

// Initialize logger
const logger = new Logger('APIGateway');

/**
 * Initializes and configures the Express application with security and monitoring features
 */
export function initializeServer(): Express {
  const app = express();
  const authMiddleware = new AuthMiddleware();

  // Initialize OpenTelemetry tracing
  const tracer = trace.getTracer('api-gateway');

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  }));

  // CORS configuration
  app.use(cors(corsConfig));

  // Compression middleware
  app.use(compression({
    level: 6,
    threshold: 100 * 1024, // 100kb
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Body parser with size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request tracing middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('http_request');
    context.with(trace.setSpan(context.active(), span), () => {
      span.setAttribute('http.method', req.method);
      span.setAttribute('http.url', req.url);
      span.setAttribute('http.request_id', req.headers['x-request-id']);

      res.on('finish', () => {
        span.setAttribute('http.status_code', res.statusCode);
        span.setStatus({
          code: res.statusCode < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        });
        span.end();
      });

      next();
    });
  });

  // Rate limiting
  app.use('/api/v1/auth', rateLimit(rateLimitConfig.authLimits));
  app.use('/api/v1/prompts', rateLimit(rateLimitConfig.promptLimits));
  app.use('/api', rateLimit(rateLimitConfig.defaultLimits));

  // Configure routes and middleware
  configureRoutes(app);

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    const span = trace.getSpan(context.active());
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });
    }

    logger.error('Unhandled error', {
      error: err,
      path: req.path,
      method: req.method,
      code: ErrorCode.INTERNAL_SERVER_ERROR
    });

    const errorResponse: ApiResponse<never> = {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      timestamp: new Date(),
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date(),
        details: process.env.NODE_ENV === 'development' ? {
          error: err.message,
          stack: err.stack
        } : undefined
      }
    };

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  });

  return app;
}

/**
 * Starts the API Gateway server with graceful shutdown support
 */
export async function startServer(app: Express): Promise<void> {
  const port = process.env.PORT || 3000;
  let server: any;

  try {
    server = app.listen(port, () => {
      logger.info(`API Gateway started`, {
        port,
        environment: process.env.NODE_ENV,
        timestamp: new Date()
      });
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);

      // Stop accepting new connections
      server.close(async () => {
        try {
          logger.info('HTTP server closed, cleaning up resources');
          // Additional cleanup (e.g., database connections, redis, etc.)
          process.exit(0);
        } catch (error) {
          logger.error('Error during cleanup', { error });
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, parseInt(process.env.SHUTDOWN_TIMEOUT || '10000'));
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Promise rejection', { reason });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start API Gateway', { error });
    process.exit(1);
  }
}

// Export configured app for testing
export const app = initializeServer();

// Start server if running directly
if (require.main === module) {
  startServer(app).catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}