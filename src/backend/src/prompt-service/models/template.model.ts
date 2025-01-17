import { Schema, model, Document } from 'mongoose'; // v7.0.0
import { ITemplate } from '../interfaces/template.interface';
import crypto from 'crypto';

/**
 * Schema definition for template variable validation rules
 */
const templateVariableValidationSchema = new Schema({
  minLength: { type: Number, min: 0 },
  maxLength: { type: Number, min: 0 },
  pattern: { type: String },
  minValue: { type: Number },
  maxValue: { type: Number },
  enum: [Schema.Types.Mixed],
  customValidator: { type: String },
  errorMessage: { type: String },
  format: { type: String },
  dependencies: [{ type: String }]
}, { _id: false });

/**
 * Schema definition for template variables with comprehensive validation
 */
const templateVariableSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    validate: {
      validator: (name: string) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name),
      message: 'Variable name must start with a letter and contain only alphanumeric characters and underscores'
    }
  },
  type: { 
    type: String, 
    required: true,
    enum: ['string', 'number', 'boolean', 'array', 'object', 'date', 'email', 'url', 'regex', 'custom']
  },
  description: { type: String, required: true },
  required: { type: Boolean, default: false },
  defaultValue: { type: Schema.Types.Mixed },
  validationRules: { type: templateVariableValidationSchema },
  examples: [{ type: String }],
  placeholder: { type: String },
  group: { type: String },
  order: { type: Number, default: 0 }
}, { _id: false });

/**
 * Schema definition for template metadata with usage analytics
 */
const templateMetadataSchema = new Schema({
  usageCount: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 },
  lastUsed: { type: Date },
  averagePromptLength: { type: Number, default: 0 },
  averageResponseTime: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  popularVariables: [{
    name: { type: String },
    useCount: { type: Number, default: 0 }
  }],
  userRating: { type: Number, min: 0, max: 5 },
  costEstimate: { type: Number, default: 0 }
}, { _id: false });

/**
 * Enhanced MongoDB schema for prompt templates with comprehensive features
 */
const templateSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  variables: [templateVariableSchema],
  category: {
    type: String,
    required: true,
    index: true
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
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    type: templateMetadataSchema,
    default: () => ({})
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  parentTemplateId: {
    type: String,
    default: null,
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  contentHash: {
    type: String,
    select: false
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Pre-save middleware for template validation and processing
 */
templateSchema.pre('save', async function(next) {
  if (this.isModified('content') || this.isModified('variables')) {
    // Generate content hash for version tracking
    this.contentHash = crypto
      .createHash('sha256')
      .update(this.content + JSON.stringify(this.variables))
      .digest('hex');

    // Validate variable references in content
    const variableNames = this.variables.map(v => v.name);
    const contentVariables = this.content.match(/\{([^}]+)\}/g) || [];
    const invalidVariables = contentVariables
      .map(v => v.slice(1, -1))
      .filter(v => !variableNames.includes(v));

    if (invalidVariables.length > 0) {
      next(new Error(`Invalid variable references: ${invalidVariables.join(', ')}`));
      return;
    }
  }

  // Update version if content changed
  if (this.isModified('content') && !this.isNew) {
    this.version += 1;
  }

  next();
});

/**
 * Static method to find templates by category with advanced filtering
 */
templateSchema.statics.findByCategory = async function(
  category: string,
  filters: Record<string, any> = {}
): Promise<ITemplate[]> {
  const query = {
    category,
    ...filters,
    isPublic: true
  };
  
  return this.find(query)
    .sort({ updatedAt: -1 })
    .select('-contentHash');
};

/**
 * Static method to find templates by team with pagination
 */
templateSchema.statics.findByTeam = async function(
  teamId: string,
  page: number = 1,
  limit: number = 20
): Promise<ITemplate[]> {
  return this.find({ teamId })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('-contentHash');
};

/**
 * Static method to validate template content and structure
 */
templateSchema.statics.validateTemplate = async function(
  template: Partial<ITemplate>
): Promise<{ isValid: boolean; errors: string[] }> {
  try {
    const doc = new this(template);
    await doc.validate();
    return { isValid: true, errors: [] };
  } catch (error) {
    return {
      isValid: false,
      errors: Object.values(error.errors).map((err: any) => err.message)
    };
  }
};

/**
 * Method to update template metadata based on usage
 */
templateSchema.methods.updateMetadata = async function(
  success: boolean,
  responseTime: number
): Promise<void> {
  this.metadata.usageCount += 1;
  this.metadata.lastUsed = new Date();
  
  if (success) {
    const totalSuccess = (this.metadata.successRate * (this.metadata.usageCount - 1)) + 1;
    this.metadata.successRate = totalSuccess / this.metadata.usageCount;
  } else {
    this.metadata.failureCount += 1;
  }

  this.metadata.averageResponseTime = 
    ((this.metadata.averageResponseTime * (this.metadata.usageCount - 1)) + responseTime) 
    / this.metadata.usageCount;

  await this.save();
};

// Create and export the Template model
export const Template = model<ITemplate>('Template', templateSchema);