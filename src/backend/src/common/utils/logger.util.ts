/**
 * Enhanced logging utility for the Prompts Portal application
 * Provides centralized logging with security, performance, and observability features
 * @version 1.0.0
 */

import winston from 'winston'; // v3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.1
import { appConfig } from '../config/app.config';
import { BaseError } from '../interfaces/error.interface';

// Define log levels with numeric priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for console output
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Configure Winston color scheme
winston.addColors(LOG_COLORS);

/**
 * Interface for logger options
 */
interface LoggerOptions {
  service?: string;
  correlationId?: string;
  maskFields?: string[];
  rotationConfig?: {
    maxSize: string;
    maxFiles: string;
  };
}

/**
 * Interface for log metadata
 */
interface LogMetadata {
  correlationId?: string;
  timestamp?: Date;
  service?: string;
  [key: string]: any;
}

/**
 * Formats error objects for consistent logging structure
 * @param error - Error object to format
 * @param metadata - Additional metadata to include
 */
const formatError = (error: BaseError | Error, metadata: LogMetadata = {}): object => {
  const formattedError: any = {
    timestamp: new Date().toISOString(),
    correlationId: metadata.correlationId || 'unknown',
    service: metadata.service || 'unknown',
    level: 'error'
  };

  if (error instanceof Error) {
    formattedError.message = error.message;
    formattedError.stack = error.stack;
    if ('code' in error) {
      formattedError.code = (error as any).code;
    }
  }

  if ((error as BaseError).status) {
    formattedError.status = (error as BaseError).status;
  }

  return { ...formattedError, ...metadata };
};

/**
 * Creates a configured Winston logger instance
 * @param options - Logger configuration options
 */
const createLogger = (options: LoggerOptions = {}): winston.Logger => {
  const {
    service = 'prompts-portal',
    rotationConfig = {
      maxSize: '20m',
      maxFiles: '14d'
    }
  } = options;

  // Create custom format
  const customFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.metadata()
  );

  // Configure console transport
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  });

  // Configure file rotation transport
  const fileTransport = new DailyRotateFile({
    filename: `logs/${service}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: rotationConfig.maxSize,
    maxFiles: rotationConfig.maxFiles,
    format: customFormat
  });

  return winston.createLogger({
    level: appConfig.logLevel || 'info',
    levels: LOG_LEVELS,
    format: customFormat,
    defaultMeta: { service },
    transports: [consoleTransport, fileTransport]
  });
};

/**
 * Enhanced Logger class with security and performance features
 */
export class Logger {
  private winstonLogger: winston.Logger;
  private serviceName: string;
  private performanceMetrics: Map<string, number>;

  constructor(serviceName: string, options: LoggerOptions = {}) {
    this.serviceName = serviceName;
    this.winstonLogger = createLogger({ ...options, service: serviceName });
    this.performanceMetrics = new Map();
  }

  /**
   * Logs error messages with enhanced context
   */
  error(message: string | BaseError, metadata: LogMetadata = {}): void {
    const errorObject = message instanceof Error
      ? formatError(message, { ...metadata, service: this.serviceName })
      : { message, ...metadata, service: this.serviceName };
    
    this.winstonLogger.error(errorObject);
  }

  /**
   * Logs warning messages
   */
  warn(message: string, metadata: LogMetadata = {}): void {
    this.winstonLogger.warn({ message, ...metadata, service: this.serviceName });
  }

  /**
   * Logs info messages
   */
  info(message: string, metadata: LogMetadata = {}): void {
    this.winstonLogger.info({ message, ...metadata, service: this.serviceName });
  }

  /**
   * Logs HTTP request/response details
   */
  http(message: string, metadata: LogMetadata = {}): void {
    this.winstonLogger.http({ message, ...metadata, service: this.serviceName });
  }

  /**
   * Logs debug messages
   */
  debug(message: string, metadata: LogMetadata = {}): void {
    this.winstonLogger.debug({ message, ...metadata, service: this.serviceName });
  }

  /**
   * Starts performance measurement
   */
  startPerformanceMetric(metricName: string): void {
    this.performanceMetrics.set(metricName, performance.now());
  }

  /**
   * Ends performance measurement and logs result
   */
  endPerformanceMetric(metricName: string): void {
    const startTime = this.performanceMetrics.get(metricName);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.info(`Performance metric: ${metricName}`, { 
        metric: metricName,
        duration,
        type: 'performance'
      });
      this.performanceMetrics.delete(metricName);
    }
  }
}

// Export singleton instance for global use
export const createLoggerInstance = (serviceName: string, options?: LoggerOptions): Logger => {
  return new Logger(serviceName, options);
};