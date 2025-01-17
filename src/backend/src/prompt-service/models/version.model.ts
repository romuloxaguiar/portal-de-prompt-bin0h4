/**
 * @fileoverview MongoDB model implementation for version control in the Prompts Portal system.
 * Provides schema definition, validation rules, and database operations for version entities
 * with enhanced metadata tracking and performance optimization.
 * 
 * @version 1.0.0
 */

import { Schema, model, Document } from 'mongoose'; // v7.0.0
import { IVersion } from '../interfaces/version.interface';
import { validateRequest } from '../../common/utils/validation.util';
import crypto from 'crypto';

/**
 * Extended interface for Version document with Mongoose specifics
 */
interface IVersionDocument extends IVersion, Document {}

/**
 * Schema definition for version control with enhanced metadata and indexing
 */
const versionSchema = new Schema<IVersionDocument>({
  promptId: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: (v: string) => /^[0-9a-fA-F]{24}$/.test(v),
      message: 'Invalid promptId format'
    }
  },
  versionNumber: {
    type: Number,
    required: true,
    min: 1,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxLength: 10000,
    validate: {
      validator: async function(content: string) {
        const result = await validateRequest(content, {
          maxTokens: 2000,
          allowedVariables: /\{[a-zA-Z0-9_]+\}/g,
          prohibitedPatterns: [
            /system:\s*override/i,
            /ignore\s+previous\s+instructions/i,
            /bypass\s+restrictions/i
          ]
        });
        return result.isValid;
      },
      message: 'Content validation failed'
    }
  },
  changes: {
    addedContent: [String],
    removedContent: [String],
    modifiedVariables: [{
      name: String,
      oldValue: Schema.Types.Mixed,
      newValue: Schema.Types.Mixed,
      type: String
    }],
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    checksum: {
      type: String,
      required: true
    }
  },
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  metadata: {
    aiModel: {
      type: String,
      required: true,
      enum: ['GPT-4', 'GPT-3.5', 'Claude', 'PaLM']
    },
    modelVersion: String,
    performance: {
      type: Number,
      min: 0,
      max: 1
    },
    usageCount: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    },
    processingTime: Number,
    tokenCount: Number
  }
}, {
  timestamps: true,
  collection: 'versions'
});

// Compound indexes for optimized queries
versionSchema.index({ promptId: 1, versionNumber: 1 }, { unique: true });
versionSchema.index({ createdAt: -1, promptId: 1 });
versionSchema.index({ 'metadata.aiModel': 1, promptId: 1 });

// Pre-save middleware for checksum generation
versionSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    this.changes.checksum = crypto
      .createHash('sha256')
      .update(this.content)
      .digest('hex');
  }
  next();
});

// Static methods for version management
versionSchema.statics.findByPromptId = async function(promptId: string): Promise<IVersionDocument[]> {
  return this.find({ promptId }).sort({ versionNumber: -1 });
};

versionSchema.statics.findLatestVersion = async function(promptId: string): Promise<IVersionDocument | null> {
  return this.findOne({ promptId }).sort({ versionNumber: -1 });
};

versionSchema.statics.compareVersions = async function(
  versionId1: string,
  versionId2: string
): Promise<{ additions: string[], deletions: string[], modifications: any[] }> {
  const [v1, v2] = await Promise.all([
    this.findById(versionId1),
    this.findById(versionId2)
  ]);
  
  if (!v1 || !v2) {
    throw new Error('One or both versions not found');
  }

  return {
    additions: v2.changes.addedContent,
    deletions: v2.changes.removedContent,
    modifications: v2.changes.modifiedVariables
  };
};

versionSchema.statics.getVersionMetrics = async function(promptId: string): Promise<{
  totalVersions: number,
  averagePerformance: number,
  successRate: number
}> {
  const metrics = await this.aggregate([
    { $match: { promptId } },
    {
      $group: {
        _id: null,
        totalVersions: { $sum: 1 },
        averagePerformance: { $avg: '$metadata.performance' },
        successRate: { $avg: '$metadata.successRate' }
      }
    }
  ]);

  return metrics[0] || {
    totalVersions: 0,
    averagePerformance: 0,
    successRate: 0
  };
};

// Create and export the Version model
const Version = model<IVersionDocument>('Version', versionSchema);
export default Version;