/**
 * Analytics Report Model
 * Handles storage and retrieval of analytics reports with support for various report types,
 * archival, and expiration management
 * @version 1.0.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose'; // v7.0.0
import dayjs from 'dayjs'; // v1.11.9
import { Logger } from '../../../common/utils/logger.util';
import { MetricModel } from './metric.model';

const logger = new Logger('ReportModel');

/**
 * Supported report types for analytics
 */
export enum ReportType {
  USAGE_SUMMARY = 'USAGE_SUMMARY',
  PERFORMANCE_METRICS = 'PERFORMANCE_METRICS',
  ROI_ANALYSIS = 'ROI_ANALYSIS',
  TEAM_ANALYTICS = 'TEAM_ANALYTICS'
}

/**
 * Interface for report configuration
 */
interface ReportConfig {
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: string[];
  aggregation?: string[];
  filters?: Record<string, any>;
}

/**
 * Interface for report metadata
 */
interface ReportMetadata {
  generatedBy: string;
  version: string;
  archivalReason?: string;
  archivalDate?: Date;
}

/**
 * Interface for report data structure
 */
interface ReportData {
  summary: {
    totalMetrics: number;
    dateRange: {
      start: Date;
      end: Date;
    };
  };
  metrics: any[];
  insights: string[];
}

/**
 * Interface for report filtering
 */
interface ReportFilter {
  reportType?: ReportType;
  dateRange?: {
    start: Date;
    end: Date;
  };
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Interface for report document structure
 */
export interface IReport extends Document {
  title: string;
  description: string;
  workspaceId: string;
  userId: string;
  reportType: ReportType;
  configuration: ReportConfig;
  data: ReportData;
  generatedAt: Date;
  validUntil: Date;
  isArchived: boolean;
  metadata: ReportMetadata;
}

// Default report validity period in days
const DEFAULT_REPORT_VALIDITY_DAYS = 30;

/**
 * Mongoose schema for analytics reports
 */
const ReportSchema = new Schema<IReport>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  workspaceId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  reportType: {
    type: String,
    enum: Object.values(ReportType),
    required: true,
    index: true
  },
  configuration: {
    dateRange: {
      start: { type: Date, required: true },
      end: { type: Date, required: true }
    },
    metrics: [{ type: String }],
    aggregation: [{ type: String }],
    filters: Schema.Types.Mixed
  },
  data: {
    summary: {
      totalMetrics: Number,
      dateRange: {
        start: Date,
        end: Date
      }
    },
    metrics: [Schema.Types.Mixed],
    insights: [String]
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  validUntil: {
    type: Date,
    required: true,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    generatedBy: String,
    version: String,
    archivalReason: String,
    archivalDate: Date
  }
}, {
  timestamps: true,
  collection: 'reports'
});

// Create compound indexes for common query patterns
ReportSchema.index({ workspaceId: 1, reportType: 1, generatedAt: -1 });
ReportSchema.index({ workspaceId: 1, isArchived: 1, validUntil: 1 });

/**
 * Report model class with enhanced operations
 */
export class ReportModel {
  private static model: Model<IReport> = mongoose.model<IReport>('Report', ReportSchema);

  /**
   * Finds reports for a specific workspace with filtering and pagination
   */
  static async findByWorkspace(workspaceId: string, filter: ReportFilter = {}): Promise<IReport[]> {
    try {
      logger.debug('Finding reports by workspace', { workspaceId, filter });

      const query: any = { workspaceId };

      if (filter.reportType) {
        query.reportType = filter.reportType;
      }

      if (filter.dateRange) {
        query.generatedAt = {
          $gte: filter.dateRange.start,
          $lte: filter.dateRange.end
        };
      }

      if (typeof filter.isArchived === 'boolean') {
        query.isArchived = filter.isArchived;
      }

      const page = filter.page || 1;
      const limit = filter.limit || 10;
      const skip = (page - 1) * limit;

      return await this.model
        .find(query)
        .sort({ generatedAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      logger.error('Error finding reports by workspace', { error, workspaceId });
      throw error;
    }
  }

  /**
   * Generates a new report by aggregating and analyzing metrics data
   */
  static async generateReport(config: ReportConfig, workspaceId: string, userId: string): Promise<IReport> {
    try {
      logger.debug('Generating new report', { config, workspaceId });

      // Fetch metrics using MetricModel
      const metrics = await MetricModel.aggregateByWorkspace(workspaceId, {
        dateRange: config.dateRange,
        metricTypes: config.metrics as any[],
        groupBy: config.aggregation
      });

      // Generate insights based on metrics
      const insights = this.generateInsights(metrics);

      const reportData: ReportData = {
        summary: {
          totalMetrics: metrics.length,
          dateRange: config.dateRange
        },
        metrics,
        insights
      };

      const report = new this.model({
        title: `Analytics Report - ${dayjs().format('YYYY-MM-DD')}`,
        description: `Generated report for workspace ${workspaceId}`,
        workspaceId,
        userId,
        reportType: ReportType.PERFORMANCE_METRICS,
        configuration: config,
        data: reportData,
        validUntil: dayjs().add(DEFAULT_REPORT_VALIDITY_DAYS, 'day').toDate(),
        metadata: {
          generatedBy: userId,
          version: '1.0'
        }
      });

      await report.validate();
      return await report.save();
    } catch (error) {
      logger.error('Error generating report', { error, workspaceId });
      throw error;
    }
  }

  /**
   * Archives a report and updates its metadata
   */
  static async archiveReport(reportId: string, reason?: string): Promise<void> {
    try {
      logger.debug('Archiving report', { reportId, reason });

      const report = await this.model.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      report.isArchived = true;
      report.metadata.archivalReason = reason;
      report.metadata.archivalDate = new Date();

      await report.save();
    } catch (error) {
      logger.error('Error archiving report', { error, reportId });
      throw error;
    }
  }

  /**
   * Generates insights based on metrics data
   */
  private static generateInsights(metrics: any[]): string[] {
    const insights: string[] = [];

    if (metrics.length === 0) {
      return ['No metrics data available for analysis'];
    }

    // Add basic statistical insights
    const averages = metrics.reduce((acc, m) => ({
      ...acc,
      [m.metricType]: (acc[m.metricType] || 0) + m.value / metrics.length
    }), {});

    Object.entries(averages).forEach(([metric, value]) => {
      insights.push(`Average ${metric}: ${value.toFixed(2)}`);
    });

    // Add trend analysis
    const sortedMetrics = [...metrics].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (sortedMetrics.length > 1) {
      const firstValue = sortedMetrics[0].value;
      const lastValue = sortedMetrics[sortedMetrics.length - 1].value;
      const change = ((lastValue - firstValue) / firstValue) * 100;

      insights.push(`Overall trend shows ${change > 0 ? 'increase' : 'decrease'} of ${Math.abs(change).toFixed(2)}%`);
    }

    return insights;
  }
}

export default ReportModel;