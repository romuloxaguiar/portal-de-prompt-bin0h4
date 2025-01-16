/**
 * Workspace model definition for the Prompts Portal collaboration service
 * Handles team workspace data structure and operations with MongoDB/Cosmos DB
 * @version 1.0.0
 */

import { Schema, model, Document } from 'mongoose'; // v7.0.0
import { DatabaseConfig } from '../../common/interfaces/config.interface';

/**
 * Enum for workspace member roles with strict access levels
 */
enum WorkspaceRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer'
}

/**
 * Interface for workspace member details
 */
interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

/**
 * Interface for workspace settings configuration
 */
interface WorkspaceSettings {
  isPublic: boolean;
  allowComments: boolean;
  autoSave: boolean;
  versionControl: boolean;
  realTimeCollaboration: boolean;
}

/**
 * Interface extending MongoDB Document for workspace type safety
 */
export interface WorkspaceDocument extends Document {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  version: number;
}

/**
 * Mongoose schema definition for workspace documents
 */
const workspaceSchema = new Schema<WorkspaceDocument>({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500
  },
  teamId: {
    type: String,
    required: true,
    index: true
  },
  members: [{
    userId: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(WorkspaceRole),
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    autoSave: {
      type: Boolean,
      default: true
    },
    versionControl: {
      type: Boolean,
      default: true
    },
    realTimeCollaboration: {
      type: Boolean,
      default: true
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  version: {
    type: Number,
    default: 1,
    required: true
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  collection: 'workspaces'
});

// Create compound indexes for efficient querying
workspaceSchema.index({ teamId: 1, isActive: 1 });
workspaceSchema.index({ 'members.userId': 1, isActive: 1 });

/**
 * Static method to find all workspaces for a team
 * @param teamId - The team's unique identifier
 * @returns Promise resolving to array of workspace documents
 */
workspaceSchema.statics.findByTeamId = async function(teamId: string): Promise<WorkspaceDocument[]> {
  if (!teamId?.match(/^[0-9a-fA-F]{24}$/)) {
    throw new Error('Invalid team ID format');
  }
  
  return this.find({
    teamId,
    isActive: true
  }).sort({ updatedAt: -1 });
};

/**
 * Static method to find all active workspaces
 * @returns Promise resolving to array of active workspace documents
 */
workspaceSchema.statics.findActiveWorkspaces = async function(): Promise<WorkspaceDocument[]> {
  return this.find({
    isActive: true
  }).sort({ updatedAt: -1 });
};

// Pre-save middleware for validation
workspaceSchema.pre('save', function(next) {
  if (this.isNew && (!this.members || this.members.length === 0)) {
    throw new Error('Workspace must have at least one member');
  }
  next();
});

// Create and export the workspace model
export const WorkspaceModel = model<WorkspaceDocument>('Workspace', workspaceSchema);