/**
 * Analytics service for tracking, collecting, and managing analytics data in the frontend application.
 * Implements comprehensive tracking with privacy controls, offline support, and real-time capabilities.
 * @version 1.0.0
 */

import { apiService } from './api.service';
import { analyticsConfig } from '../config/analytics.config';
import { AppError } from '../utils/error.util';
import { storage, StorageKeys } from '../utils/storage.util';
import { MetricType, type IMetric, type IMetricFilter, type IAggregatedMetrics } from '../interfaces/analytics.interface';
import mixpanel from 'mixpanel-browser'; // v2.47.0
import { onCLS, onFID, onLCP, onTTFB, onFCP } from 'web-vitals'; // v3.0.0

// Analytics endpoints
const { ANALYTICS_ENDPOINTS } = analyticsConfig;

// Tracking configuration
const TRACKING_CONFIG = {
  sampleRate: 100,
  batchSize: 10,
  retryAttempts: 3,
  offlineStorage: true,
  debugMode: process.env.NODE_ENV !== 'production'
};

// Privacy settings
const PRIVACY_SETTINGS = {
  anonymizeIp: true,
  maskPII: true,
  dataRetention: 90,
  consentRequired: true
};

/**
 * Interface for tracking options
 */
interface ITrackingOptions {
  anonymous?: boolean;
  batch?: boolean;
  priority?: 'high' | 'normal' | 'low';
  offline?: boolean;
}

/**
 * Analytics service class implementing comprehensive tracking functionality
 */
class AnalyticsService {
  private initialized: boolean = false;
  private consentGranted: boolean = false;
  private offlineQueue: IMetric[] = [];
  private batchQueue: IMetric[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Initializes analytics services and configurations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Mixpanel
      mixpanel.init(analyticsConfig.mixpanel.token, analyticsConfig.mixpanel.config);

      // Initialize Web Vitals tracking
      this.initializeWebVitals();

      // Load offline queue
      await this.loadOfflineQueue();

      // Initialize consent status
      this.consentGranted = await this.loadConsentStatus();

      this.initialized = true;
    } catch (error) {
      throw new AppError('Analytics initialization failed', { error });
    }
  }

  /**
   * Tracks a metric with privacy controls and offline support
   */
  async trackMetric(metric: IMetric, options: ITrackingOptions = {}): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.consentGranted && !options.anonymous) {
      return;
    }

    try {
      const sanitizedMetric = this.sanitizeMetricData(metric);

      if (options.offline || !navigator.onLine) {
        await this.queueOfflineMetric(sanitizedMetric);
        return;
      }

      if (options.batch) {
        this.queueBatchMetric(sanitizedMetric);
        return;
      }

      await this.sendMetric(sanitizedMetric);
    } catch (error) {
      if (options.offline || !navigator.onLine) {
        await this.queueOfflineMetric(metric);
      }
      throw new AppError('Metric tracking failed', { error });
    }
  }

  /**
   * Retrieves metrics with filtering and aggregation
   */
  async getMetrics(filter: IMetricFilter): Promise<IAggregatedMetrics> {
    try {
      const response = await apiService.post(ANALYTICS_ENDPOINTS.METRICS, filter);
      return response.data;
    } catch (error) {
      throw new AppError('Failed to retrieve metrics', { error });
    }
  }

  /**
   * Updates privacy consent status and handles data retention
   */
  async updateConsent(granted: boolean): Promise<void> {
    this.consentGranted = granted;
    await storage.setItem(StorageKeys.ANALYTICS_CONSENT, granted);

    if (!granted) {
      await this.clearAnalyticsData();
    }
  }

  /**
   * Initializes Web Vitals tracking
   */
  private initializeWebVitals(): void {
    const vitalsCallback = ({ name, value, id }: { name: string, value: number, id: string }): void => {
      this.trackMetric({
        id,
        type: MetricType.PERFORMANCE,
        value,
        timestamp: new Date(),
        metadata: { metric: name },
        tags: ['web-vitals']
      } as IMetric);
    };

    onCLS(vitalsCallback);
    onFID(vitalsCallback);
    onLCP(vitalsCallback);
    onTTFB(vitalsCallback);
    onFCP(vitalsCallback);
  }

  /**
   * Sanitizes metric data according to privacy settings
   */
  private sanitizeMetricData(metric: IMetric): IMetric {
    const sanitized = { ...metric };

    if (PRIVACY_SETTINGS.maskPII) {
      if (sanitized.userId) {
        sanitized.userId = this.hashIdentifier(sanitized.userId);
      }
      if (sanitized.metadata?.userEmail) {
        delete sanitized.metadata.userEmail;
      }
    }

    if (PRIVACY_SETTINGS.anonymizeIp && sanitized.metadata?.ipAddress) {
      sanitized.metadata.ipAddress = this.anonymizeIp(sanitized.metadata.ipAddress);
    }

    return sanitized;
  }

  /**
   * Queues metrics for batch processing
   */
  private queueBatchMetric(metric: IMetric): void {
    this.batchQueue.push(metric);

    if (this.batchQueue.length >= TRACKING_CONFIG.batchSize) {
      this.flushBatchQueue();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flushBatchQueue(), 2000);
    }
  }

  /**
   * Sends batched metrics to analytics endpoint
   */
  private async flushBatchQueue(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) return;

    const metrics = [...this.batchQueue];
    this.batchQueue = [];

    try {
      await apiService.post(ANALYTICS_ENDPOINTS.METRICS, { metrics });
    } catch (error) {
      // On failure, queue metrics for offline storage
      await Promise.all(metrics.map(metric => this.queueOfflineMetric(metric)));
    }
  }

  /**
   * Manages offline storage of metrics
   */
  private async queueOfflineMetric(metric: IMetric): Promise<void> {
    this.offlineQueue.push(metric);
    await storage.setItem(StorageKeys.OFFLINE_METRICS, this.offlineQueue, {
      encrypt: true,
      compress: true
    });
  }

  /**
   * Loads and processes offline queue
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const offlineMetrics = await storage.getItem<IMetric[]>(StorageKeys.OFFLINE_METRICS);
      if (offlineMetrics) {
        this.offlineQueue = offlineMetrics;
        if (navigator.onLine) {
          await this.processOfflineQueue();
        }
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  /**
   * Processes and sends offline queued metrics
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    const metrics = [...this.offlineQueue];
    this.offlineQueue = [];

    try {
      await apiService.post(ANALYTICS_ENDPOINTS.METRICS, { metrics });
      await storage.removeItem(StorageKeys.OFFLINE_METRICS);
    } catch (error) {
      this.offlineQueue = metrics;
      throw new AppError('Failed to process offline queue', { error });
    }
  }

  /**
   * Sends individual metric to analytics endpoint
   */
  private async sendMetric(metric: IMetric): Promise<void> {
    await apiService.post(ANALYTICS_ENDPOINTS.METRICS, { metric });

    // Track in third-party analytics if configured
    if (analyticsConfig.mixpanel.token) {
      mixpanel.track(metric.type, {
        ...metric.metadata,
        value: metric.value,
        timestamp: metric.timestamp
      });
    }
  }

  /**
   * Hashes identifier for privacy
   */
  private hashIdentifier(identifier: string): string {
    return btoa(identifier).slice(0, 24);
  }

  /**
   * Anonymizes IP address
   */
  private anonymizeIp(ip: string): string {
    return ip.replace(/\d+$/, '0');
  }

  /**
   * Loads analytics consent status
   */
  private async loadConsentStatus(): Promise<boolean> {
    return await storage.getItem(StorageKeys.ANALYTICS_CONSENT) ?? false;
  }

  /**
   * Clears analytics data on consent withdrawal
   */
  private async clearAnalyticsData(): Promise<void> {
    await storage.removeItem(StorageKeys.OFFLINE_METRICS);
    this.offlineQueue = [];
    this.batchQueue = [];
    if (analyticsConfig.mixpanel.token) {
      mixpanel.reset();
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();