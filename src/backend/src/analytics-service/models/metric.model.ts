/**
 * Analytics Metric Model
 * Handles storage and retrieval of performance, usage, and ROI metrics for the Prompts Portal platform
 * @version 1.0.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose'; // v7.0.0
import dayjs from 'dayjs'; // v1.11.9
import { Logger } from '../../../common/utils/logger.util';

const logger = new Logger('MetricModel');

/**
 * Supported metric types for analytics tracking
 */
export enum METRIC_TYPES {
  USAGE = 'USAGE',
  SUCCESS_RATE = 'SUCCESS_RATE',
  RESPONSE_TIME = 'RESPONSE_TIME',
  ERROR_RATE = 'ERROR_RATE',
  USER_SATISFACTION = 'USER_SATISFACTION',
  ROI = 'ROI',
  COST_SAVINGS = 'COST_SAVINGS'
}

/**
 * Interface for date range filtering
 */
interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Interface for metric aggregation options
 */
interface AggregateOptions {
  groupBy?: string[];
  metricTypes?: METRIC_TYPES[];
  dateRange?: DateRange;
}

/**
 * Interface for metric filtering
 */
interface MetricFilter {
  promptId?: string;
  workspaceId?: string;
  userId?: string;
  metricType?: METRIC_TYPES;
  dateRange?: DateRange;
}

/**
 * Interface for metric document structure
 */
export interface IMetric extends Document {
  promptId: string;
  workspaceId: string;
  userId: string;
  metricType: METRIC_TYPES;
  value: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * Mongoose schema for analytics metrics
 */
const MetricSchema = new Schema<IMetric>({
  promptId: {
    type: String,
    required: true,
    index: true
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
  metricType: {
    type: String,
    enum: Object.values(METRIC_TYPES),
    required: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'metrics'
});

// Create compound indexes for common query patterns
MetricSchema.index({ workspaceId: 1, metricType: 1, timestamp: -1 });
MetricSchema.index({ promptId: 1, timestamp: -1 });

/**
 * Metric model class with enhanced operations
 */
export class MetricModel {
  private static model: Model<IMetric> = mongoose.model<IMetric>('Metric', MetricSchema);

  /**
   * Creates a new metric record
   */
  static async create(data: Partial<IMetric>): Promise<IMetric> {
    try {
      logger.debug('Creating new metric', { data });
      const metric = new this.model(data);
      await metric.validate();
      return await metric.save();
    } catch (error) {
      logger.error('Error creating metric', { error, data });
      throw error;
    }
  }

  /**
   * Finds metrics by prompt ID with optional date range
   */
  static async findByPromptId(promptId: string, dateRange?: DateRange): Promise<IMetric[]> {
    try {
      logger.debug('Finding metrics by promptId', { promptId, dateRange });
      
      const query: any = { promptId };
      
      if (dateRange) {
        query.timestamp = {
          $gte: dateRange.start,
          $lte: dateRange.end
        };
      }

      return await this.model.find(query).sort({ timestamp: -1 });
    } catch (error) {
      logger.error('Error finding metrics by promptId', { error, promptId });
      throw error;
    }
  }

  /**
   * Aggregates metrics by workspace with custom options
   */
  static async aggregateByWorkspace(workspaceId: string, options: AggregateOptions = {}): Promise<any> {
    try {
      logger.debug('Aggregating workspace metrics', { workspaceId, options });

      const pipeline: any[] = [
        { $match: { workspaceId } }
      ];

      if (options.dateRange) {
        pipeline.push({
          $match: {
            timestamp: {
              $gte: options.dateRange.start,
              $lte: options.dateRange.end
            }
          }
        });
      }

      if (options.metricTypes) {
        pipeline.push({
          $match: {
            metricType: { $in: options.metricTypes }
          }
        });
      }

      const groupBy: any = {
        _id: options.groupBy ? {} : null
      };

      if (options.groupBy) {
        options.groupBy.forEach(field => {
          groupBy._id[field] = `$${field}`;
        });
      }

      pipeline.push({
        $group: {
          ...groupBy,
          average: { $avg: '$value' },
          sum: { $sum: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          count: { $sum: 1 }
        }
      });

      return await this.model.aggregate(pipeline);
    } catch (error) {
      logger.error('Error aggregating workspace metrics', { error, workspaceId });
      throw error;
    }
  }

  /**
   * Deletes metrics based on filter criteria
   */
  static async deleteByFilter(filter: MetricFilter): Promise<void> {
    try {
      logger.debug('Deleting metrics by filter', { filter });

      const query: any = {};

      if (filter.promptId) query.promptId = filter.promptId;
      if (filter.workspaceId) query.workspaceId = filter.workspaceId;
      if (filter.userId) query.userId = filter.userId;
      if (filter.metricType) query.metricType = filter.metricType;
      
      if (filter.dateRange) {
        query.timestamp = {
          $gte: filter.dateRange.start,
          $lte: filter.dateRange.end
        };
      }

      await this.model.deleteMany(query);
    } catch (error) {
      logger.error('Error deleting metrics', { error, filter });
      throw error;
    }
  }

  /**
   * Retrieves metrics within a specific date range
   */
  static async findByDateRange(dateRange: DateRange, filter: Partial<MetricFilter> = {}): Promise<IMetric[]> {
    try {
      logger.debug('Finding metrics by date range', { dateRange, filter });

      const query: any = {
        timestamp: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      };

      if (filter.workspaceId) query.workspaceId = filter.workspaceId;
      if (filter.promptId) query.promptId = filter.promptId;
      if (filter.metricType) query.metricType = filter.metricType;

      return await this.model.find(query).sort({ timestamp: -1 });
    } catch (error) {
      logger.error('Error finding metrics by date range', { error, dateRange });
      throw error;
    }
  }
}

export default MetricModel;