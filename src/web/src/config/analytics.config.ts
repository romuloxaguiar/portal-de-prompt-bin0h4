import { MetricType } from '../interfaces/analytics.interface';
import mixpanel from 'mixpanel-browser'; // v2.45.0
// Google Analytics 4 types are provided by gtag.js

/**
 * Analytics endpoints for API calls
 */
export const ANALYTICS_ENDPOINTS = {
  METRICS: '/api/v1/analytics/metrics',
  AGGREGATED: '/api/v1/analytics/metrics/aggregated',
  EVENTS: '/api/v1/analytics/events',
  USAGE: '/api/v1/analytics/usage',
  PERFORMANCE: '/api/v1/analytics/performance',
  ERROR_TRACKING: '/api/v1/analytics/errors',
  USER_JOURNEY: '/api/v1/analytics/journey'
} as const;

/**
 * Environment-specific tracking IDs
 */
const TRACKING_IDS = {
  development: {
    ga4: 'G-DEV123456',
    mixpanel: 'dev_token123',
  },
  staging: {
    ga4: 'G-STG789012',
    mixpanel: 'staging_token456',
  },
  production: {
    ga4: 'G-PROD345678',
    mixpanel: 'prod_token789',
  }
} as const;

/**
 * Default configuration for analytics tracking
 */
const DEFAULT_TRACKING_CONFIG = {
  sampleRate: 100,
  includeDebugEvents: false,
  anonymizeIp: true,
  cookieExpiration: 365,
  userIdHash: true,
  dataRetentionDays: 90,
  batchSize: 10,
  batchInterval: 2000
} as const;

/**
 * Retrieves the appropriate tracking ID based on environment
 */
const getTrackingId = (service: 'ga4' | 'mixpanel'): string => {
  const environment = process.env.NODE_ENV || 'development';
  return TRACKING_IDS[environment as keyof typeof TRACKING_IDS][service];
};

/**
 * Analytics configuration object for the Prompts Portal
 */
export const analyticsConfig = {
  /**
   * Google Analytics 4 Configuration
   */
  ga4: {
    trackingId: getTrackingId('ga4'),
    config: {
      send_page_view: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      anonymize_ip: true,
      cookie_expires: DEFAULT_TRACKING_CONFIG.cookieExpiration * 24 * 60 * 60, // days to seconds
      custom_map: {
        dimension1: 'workspace_id',
        dimension2: 'prompt_type',
        dimension3: 'user_role',
        metric1: 'prompt_success_rate',
        metric2: 'response_time'
      },
      debug_mode: process.env.NODE_ENV !== 'production'
    },
    events: {
      prompt_created: {
        category: 'Prompt',
        action: 'Created'
      },
      prompt_edited: {
        category: 'Prompt',
        action: 'Edited'
      },
      prompt_executed: {
        category: 'Prompt',
        action: 'Executed'
      }
    }
  },

  /**
   * Mixpanel Configuration
   */
  mixpanel: {
    token: getTrackingId('mixpanel'),
    config: {
      debug: process.env.NODE_ENV !== 'production',
      api_host: 'https://api.mixpanel.com',
      persistence: 'localStorage',
      upgrade: true,
      batch_requests: true,
      property_blacklist: ['$current_url', '$initial_referrer'],
      batch_size: DEFAULT_TRACKING_CONFIG.batchSize,
      batch_flush_interval_ms: DEFAULT_TRACKING_CONFIG.batchInterval,
      loaded: (mixpanel: any) => {
        mixpanel.register({
          'Platform': 'Web',
          'Environment': process.env.NODE_ENV
        });
      }
    },
    events: {
      user_engagement: ['time_spent', 'features_used', 'interactions'],
      prompt_performance: ['success_rate', 'completion_time', 'iterations'],
      team_collaboration: ['shares', 'comments', 'template_usage']
    }
  },

  /**
   * Web Vitals Configuration
   */
  webVitals: {
    reportingEndpoint: ANALYTICS_ENDPOINTS.PERFORMANCE,
    metrics: ['CLS', 'FID', 'LCP', 'TTFB', 'FCP'],
    reportAllChanges: false,
    reportSummary: true,
    analyticsTracker: (metric: { name: string, value: number, id: string }) => {
      window.gtag?.('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: metric.name,
        value: Math.round(metric.value),
        metric_id: metric.id,
        non_interaction: true
      });
    }
  },

  /**
   * Custom Analytics Configuration
   */
  customAnalytics: {
    endpoints: ANALYTICS_ENDPOINTS,
    metrics: {
      usage: {
        type: MetricType.USAGE,
        aggregation: 'sum',
        retention: DEFAULT_TRACKING_CONFIG.dataRetentionDays
      },
      successRate: {
        type: MetricType.SUCCESS_RATE,
        aggregation: 'average',
        retention: DEFAULT_TRACKING_CONFIG.dataRetentionDays
      }
    },
    sampling: {
      enabled: true,
      rate: DEFAULT_TRACKING_CONFIG.sampleRate
    },
    privacy: {
      anonymizeIp: DEFAULT_TRACKING_CONFIG.anonymizeIp,
      hashUserId: DEFAULT_TRACKING_CONFIG.userIdHash
    },
    errorTracking: {
      endpoint: ANALYTICS_ENDPOINTS.ERROR_TRACKING,
      captureUnhandledRejections: true,
      captureUncaughtExceptions: true,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Network request failed'
      ]
    },
    userJourney: {
      endpoint: ANALYTICS_ENDPOINTS.USER_JOURNEY,
      trackRouteChanges: true,
      trackInteractions: true,
      sessionTimeout: 30 // minutes
    }
  }
};

/**
 * Initialize all analytics services
 */
export const initializeAnalytics = async (): Promise<void> => {
  // Initialize GA4
  window.gtag?.('config', analyticsConfig.ga4.trackingId, analyticsConfig.ga4.config);

  // Initialize Mixpanel
  mixpanel.init(analyticsConfig.mixpanel.token, analyticsConfig.mixpanel.config);

  // Initialize custom analytics endpoints
  // Implementation will be handled by the analytics service
};

export default analyticsConfig;