/**
 * @fileoverview Service implementation for version control functionality in the Prompts Portal.
 * Handles version creation, comparison, history tracking, and version management with
 * enhanced change tracking capabilities.
 * 
 * @version 1.0.0
 */

import { diffChars } from 'diff'; // v5.1.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { IVersion, IVersionChanges } from '../interfaces/version.interface';
import Version from '../models/version.model';
import { ServiceResponse } from '../../common/types/service-response.type';
import { validatePrompt } from '../../common/utils/validation.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * Interface for version comparison results
 */
interface IVersionComparison {
  additions: string[];
  deletions: string[];
  modifications: any[];
  metadata: {
    versionNumbers: [number, number];
    timestamps: [Date, Date];
  };
}

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Interface for paginated version response
 */
interface PaginatedVersions {
  versions: IVersion[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Service class implementing version control functionality for prompts
 */
export class VersionService {
  private readonly maxVersionRetention: number;

  /**
   * Initializes the version service with configuration
   * @param versionModel - Version model instance
   * @param maxVersionRetention - Maximum number of versions to retain
   */
  constructor(
    private readonly versionModel: typeof Version,
    maxVersionRetention: number = 100
  ) {
    this.maxVersionRetention = maxVersionRetention;
  }

  /**
   * Creates a new version for a prompt with automatic change tracking
   * @param versionData - Version data to create
   * @returns Promise resolving to created version or error
   */
  public async createVersion(versionData: Partial<IVersion>): Promise<ServiceResponse<IVersion>> {
    try {
      // Validate prompt content
      const validationResult = validatePrompt(versionData.content!, {
        maxTokens: 2000,
        allowedVariables: /\{[a-zA-Z0-9_]+\}/g,
        prohibitedPatterns: [
          /system:\s*override/i,
          /ignore\s+previous\s+instructions/i,
          /bypass\s+restrictions/i
        ]
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: ErrorCode.PROMPT_VALIDATION_ERROR,
            message: 'Invalid prompt content',
            status: HttpStatus.BAD_REQUEST,
            timestamp: new Date(),
            details: validationResult.errors
          }
        };
      }

      // Generate unique version ID
      const versionId = uuidv4();

      // Get latest version number
      const latestVersion = await this.versionModel.findLatestVersion(versionData.promptId!);
      const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Compute changes from previous version
      const changes: IVersionChanges = {
        addedContent: [],
        removedContent: [],
        modifiedVariables: [],
        description: '',
        timestamp: new Date()
      };

      if (latestVersion) {
        const diff = diffChars(latestVersion.content, versionData.content!);
        diff.forEach(part => {
          if (part.added) {
            changes.addedContent.push(part.value);
          }
          if (part.removed) {
            changes.removedContent.push(part.value);
          }
        });

        // Track variable changes
        const oldVars = latestVersion.content.match(/\{[a-zA-Z0-9_]+\}/g) || [];
        const newVars = versionData.content!.match(/\{[a-zA-Z0-9_]+\}/g) || [];
        
        changes.modifiedVariables = this.computeVariableChanges(oldVars, newVars);
        changes.description = this.generateChangeDescription(changes);
      }

      // Create new version
      const newVersion = await this.versionModel.create({
        id: versionId,
        promptId: versionData.promptId,
        content: versionData.content,
        changes,
        versionNumber: newVersionNumber,
        createdBy: versionData.createdBy,
        createdAt: new Date()
      });

      // Clean up old versions if beyond retention limit
      await this.cleanupOldVersions(versionData.promptId!);

      return {
        success: true,
        data: newVersion
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to create version',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      };
    }
  }

  /**
   * Retrieves version history with pagination
   * @param promptId - ID of the prompt
   * @param options - Pagination options
   * @returns Promise resolving to paginated version history
   */
  public async getVersionHistory(
    promptId: string,
    options: PaginationOptions
  ): Promise<ServiceResponse<PaginatedVersions>> {
    try {
      const { page = 1, limit = 10 } = options;
      const skip = (page - 1) * limit;

      const [versions, total] = await Promise.all([
        this.versionModel.find({ promptId })
          .sort({ versionNumber: -1 })
          .skip(skip)
          .limit(limit),
        this.versionModel.countDocuments({ promptId })
      ]);

      return {
        success: true,
        data: {
          versions,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve version history',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      };
    }
  }

  /**
   * Compares two versions with detailed change tracking
   * @param versionId1 - First version ID
   * @param versionId2 - Second version ID
   * @returns Promise resolving to version comparison
   */
  public async compareVersions(
    versionId1: string,
    versionId2: string
  ): Promise<ServiceResponse<IVersionComparison>> {
    try {
      const [v1, v2] = await Promise.all([
        this.versionModel.findById(versionId1),
        this.versionModel.findById(versionId2)
      ]);

      if (!v1 || !v2) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND_ERROR,
            message: 'One or both versions not found',
            status: HttpStatus.NOT_FOUND,
            timestamp: new Date()
          }
        };
      }

      const comparison: IVersionComparison = {
        additions: v2.changes.addedContent,
        deletions: v2.changes.removedContent,
        modifications: v2.changes.modifiedVariables,
        metadata: {
          versionNumbers: [v1.versionNumber, v2.versionNumber],
          timestamps: [v1.createdAt, v2.createdAt]
        }
      };

      return {
        success: true,
        data: comparison
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to compare versions',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      };
    }
  }

  /**
   * Reverts a prompt to a specific version
   * @param promptId - ID of the prompt
   * @param versionId - ID of the version to revert to
   * @returns Promise resolving to new version created from reversion
   */
  public async revertToVersion(
    promptId: string,
    versionId: string
  ): Promise<ServiceResponse<IVersion>> {
    try {
      const targetVersion = await this.versionModel.findById(versionId);

      if (!targetVersion || targetVersion.promptId !== promptId) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND_ERROR,
            message: 'Version not found or does not belong to prompt',
            status: HttpStatus.NOT_FOUND,
            timestamp: new Date()
          }
        };
      }

      return this.createVersion({
        promptId,
        content: targetVersion.content,
        createdBy: targetVersion.createdBy
      });
    } catch (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to revert version',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date(),
          details: { error }
        }
      };
    }
  }

  /**
   * Computes changes between two sets of variables
   * @private
   */
  private computeVariableChanges(oldVars: string[], newVars: string[]): any[] {
    const changes = [];
    const oldSet = new Set(oldVars);
    const newSet = new Set(newVars);

    for (const v of oldVars) {
      if (!newSet.has(v)) {
        changes.push({ name: v, type: 'removed' });
      }
    }

    for (const v of newVars) {
      if (!oldSet.has(v)) {
        changes.push({ name: v, type: 'added' });
      }
    }

    return changes;
  }

  /**
   * Generates human-readable change description
   * @private
   */
  private generateChangeDescription(changes: IVersionChanges): string {
    const parts = [];
    
    if (changes.addedContent.length) {
      parts.push(`Added ${changes.addedContent.length} content segments`);
    }
    if (changes.removedContent.length) {
      parts.push(`Removed ${changes.removedContent.length} content segments`);
    }
    if (changes.modifiedVariables.length) {
      parts.push(`Modified ${changes.modifiedVariables.length} variables`);
    }

    return parts.join(', ') || 'No changes detected';
  }

  /**
   * Cleans up old versions beyond retention limit
   * @private
   */
  private async cleanupOldVersions(promptId: string): Promise<void> {
    const totalVersions = await this.versionModel.countDocuments({ promptId });
    
    if (totalVersions > this.maxVersionRetention) {
      const versionsToDelete = totalVersions - this.maxVersionRetention;
      await this.versionModel
        .find({ promptId })
        .sort({ versionNumber: 1 })
        .limit(versionsToDelete)
        .deleteMany();
    }
  }
}