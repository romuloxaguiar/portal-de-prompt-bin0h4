import { Schema, model, Document } from 'mongoose'; // v7.0.0
import { IPrompt, PromptStatus, IPromptVariable, IPromptMetadata } from '../interfaces/prompt.interface';
import { validatePrompt } from '../../common/utils/validation.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';

/**
 * Interface extending IPrompt with Mongoose Document functionality
 */
interface IPromptDocument extends IPrompt, Document {}

/**
 * Schema definition for prompt variables with comprehensive validation
 */
const promptVariableSchema = new Schema<IPromptVariable>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    validate: {
      validator: (name: string) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name),
      message: 'Variable name must start with a letter and contain only alphanumeric characters and underscores'
    }
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['string', 'number', 'boolean', 'array', 'object'],
    validate: {
      validator: (type: string) => ['string', 'number', 'boolean', 'array', 'object'].includes(type),
      message: 'Invalid variable type'
    }
  }
});

/**
 * Schema definition for prompt metadata with analytics tracking
 */
const promptMetadataSchema = new Schema<IPromptMetadata>({
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastUsed: {
    type: Date,
    default: null
  },
  aiModel: {
    type: String,
    required: true
  },
  averageResponseTime: {
    type: Number,
    default: 0,
    min: 0
  }
});

/**
 * Comprehensive Mongoose schema for prompts with enhanced validation and indexing
 */
const promptSchema = new Schema<IPromptDocument>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000,
    validate: {
      validator: async function(content: string) {
        const validationResult = validatePrompt(content, {
          maxTokens: 4000,
          allowedVariables: /{[a-zA-Z][a-zA-Z0-9_]*}/g,
          prohibitedPatterns: [
            /system:\s*override/i,
            /ignore\s+previous\s+instructions/i,
            /bypass\s+restrictions/i
          ]
        });
        return validationResult.isValid;
      },
      message: 'Invalid prompt content'
    }
  },
  templateId: {
    type: String,
    required: false,
    index: true
  },
  variables: {
    type: [promptVariableSchema],
    validate: {
      validator: function(variables: IPromptVariable[]) {
        const uniqueNames = new Set(variables.map(v => v.name));
        return uniqueNames.size === variables.length;
      },
      message: 'Variable names must be unique'
    }
  },
  creatorId: {
    type: String,
    required: true,
    index: true
  },
  teamId: {
    type: String,
    required: true,
    index: true
  },
  currentVersion: {
    id: { type: String, required: true },
    versionNumber: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    changes: { type: [Schema.Types.Mixed], default: [] }
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(PromptStatus),
    default: PromptStatus.DRAFT,
    index: true
  },
  metadata: {
    type: promptMetadataSchema,
    required: true,
    default: () => ({
      usageCount: 0,
      successRate: 0,
      lastUsed: null,
      aiModel: 'gpt-3.5-turbo',
      averageResponseTime: 0
    })
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  collection: 'prompts'
});

// Compound indexes for performance optimization
promptSchema.index({ teamId: 1, status: 1 });
promptSchema.index({ creatorId: 1, createdAt: -1 });
promptSchema.index({ templateId: 1, status: 1 });
promptSchema.index({ 'metadata.lastUsed': -1 });

// Static methods for common queries
promptSchema.statics.findByCreator = async function(creatorId: string) {
  return this.find({ creatorId }).sort({ createdAt: -1 });
};

promptSchema.statics.findByTeam = async function(teamId: string, status?: PromptStatus) {
  const query = status ? { teamId, status } : { teamId };
  return this.find(query).sort({ 'metadata.lastUsed': -1 });
};

promptSchema.statics.findByTemplate = async function(templateId: string) {
  return this.find({ templateId, status: PromptStatus.ACTIVE });
};

promptSchema.statics.findWithMetrics = async function(filter: Record<string, any>) {
  return this.find(filter)
    .select('+metadata')
    .sort({ 'metadata.usageCount': -1 });
};

// Methods for analytics tracking
promptSchema.methods.updateAnalytics = async function(success: boolean, responseTime: number) {
  const totalUses = this.metadata.usageCount + 1;
  const successCount = success ? 
    (this.metadata.successRate * this.metadata.usageCount / 100) + 1 :
    (this.metadata.successRate * this.metadata.usageCount / 100);

  this.metadata.usageCount = totalUses;
  this.metadata.successRate = (successCount / totalUses) * 100;
  this.metadata.lastUsed = new Date();
  this.metadata.averageResponseTime = 
    ((this.metadata.averageResponseTime * (totalUses - 1)) + responseTime) / totalUses;

  return this.save();
};

// Pre-save middleware for validation
promptSchema.pre('save', async function(next) {
  if (this.isModified('content')) {
    const validationResult = validatePrompt(this.content, {
      maxTokens: 4000,
      allowedVariables: /{[a-zA-Z][a-zA-Z0-9_]*}/g,
      prohibitedPatterns: [
        /system:\s*override/i,
        /ignore\s+previous\s+instructions/i,
        /bypass\s+restrictions/i
      ]
    });

    if (!validationResult.isValid) {
      next(new Error(ErrorCode.PROMPT_VALIDATION_ERROR));
      return;
    }
  }
  next();
});

// Export the Prompt model
export const Prompt = model<IPromptDocument>('Prompt', promptSchema);