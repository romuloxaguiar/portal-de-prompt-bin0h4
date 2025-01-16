import express, { Application, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import rateLimit from 'express-rate-limit'; // ^6.9.0
import { trace, context, SpanStatusCode } from '@opentelemetry/api'; // ^1.4.0
import CircuitBreaker from 'opossum'; // ^7.1.0

import { HealthController } from '../controllers/health.controller';
import { corsConfig, securityHeaders } from '../config/cors.config';
import { rateLimitConfig } from '../config/rate-limit.config';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { ApiResponse } from '../../common/types/api-response.type';

// Initialize OpenTelemetry tracer
const tracer = trace.getTracer('api-gateway');

/**
 * Circuit breaker configuration for service calls
 */
const circuitBreakerOptions = {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds
};

/**
 * Configures and returns the Express application with enhanced security,
 * monitoring, and routing features
 * @param app Express Application instance
 * @returns Configured Express application
 */
export default function configureRoutes(app: Application): Application {
  const healthController = new HealthController();

  // Enhanced security middleware
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

  // Security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    Object.entries(securityHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    next();
  });

  // Request tracing middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('http_request');
    context.with(trace.setSpan(context.active(), span), () => {
      // Add request details to span
      span.setAttribute('http.method', req.method);
      span.setAttribute('http.url', req.url);
      span.setAttribute('http.request_id', req.headers['x-request-id']);

      // Handle response
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

  // Rate limiting configuration
  app.use('/api/v1/auth', rateLimit(rateLimitConfig.authLimits));
  app.use('/api/v1/prompts', rateLimit(rateLimitConfig.promptLimits));
  app.use('/api', rateLimit(rateLimitConfig.defaultLimits));

  // Health check routes
  app.get('/health', healthController.healthCheck);
  app.get('/ready', healthController.readinessCheck);
  app.get('/live', healthController.livenessCheck);
  app.get('/metrics', healthController.metricsCheck);

  // API routes with circuit breakers
  const promptsBreaker = new CircuitBreaker(async (req) => {
    // Prompt service call implementation
  }, circuitBreakerOptions);

  const analyticsBreaker = new CircuitBreaker(async (req) => {
    // Analytics service call implementation
  }, circuitBreakerOptions);

  // Mount service routes
  app.use('/api/v1/prompts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await promptsBreaker.fire(req);
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/analytics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await analyticsBreaker.fire(req);
      next();
    } catch (error) {
      next(error);
    }
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    const span = trace.getSpan(context.active());
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });
    }

    const errorResponse: ApiResponse<never> = {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      timestamp: new Date(),
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date(),
        details: {
          error: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        },
      },
    };

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  });

  return app;
}