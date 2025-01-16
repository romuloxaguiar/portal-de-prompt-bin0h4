/**
 * Workspace service implementation for the Prompts Portal collaboration service
 * Handles workspace operations with caching, real-time updates, and role-based access control
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import Redis from 'ioredis'; // v5.3.0
import { Logger } from 'winston'; // v3.10.0
import { Server as SocketServer } from 'socket.io'; // v4.7.0

import { WorkspaceModel, WorkspaceDocument } from '../models/workspace.model';
import { BaseResponse, SuccessResponse } from '../../common/interfaces/response.interface';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { BaseError } from '../../common/interfaces/error.interface';

// Cache TTL in seconds
const WORKSPACE_CACHE_TTL = 3600;

/**
 * Interface for workspace service operations
 */
export interface WorkspaceService {
  createWorkspace(workspaceData: WorkspaceDocument, userId: string): Promise<SuccessResponse<WorkspaceDocument>>;
  getWorkspaceById(workspaceId: string, userId: string): Promise<SuccessResponse<WorkspaceDocument>>;
  updateWorkspace(workspaceId: string, updateData: Partial<WorkspaceDocument>, userId: string): Promise<SuccessResponse<WorkspaceDocument>>;
  deleteWorkspace(workspaceId: string, userId: string): Promise<SuccessResponse<void>>;
  addMember(workspaceId: string, memberId: string, role: string, userId: string): Promise<SuccessResponse<WorkspaceDocument>>;
  removeMember(workspaceId: string, memberId: string, userId: string): Promise<SuccessResponse<WorkspaceDocument>>;
  getActiveMembers(workspaceId: string): Promise<SuccessResponse<string[]>>;
}

/**
 * Implementation of the WorkspaceService interface
 */
@injectable()
export class WorkspaceServiceImpl implements WorkspaceService {
  private readonly cacheKeyPrefix = 'workspace:';
  private readonly activeMembersPrefix = 'workspace:active:';
  
  constructor(
    private readonly workspaceModel: typeof WorkspaceModel,
    private readonly redisClient: Redis,
    private readonly logger: Logger,
    private readonly socketServer: SocketServer
  ) {}

  /**
   * Creates a new workspace with role validation and real-time updates
   */
  public async createWorkspace(
    workspaceData: WorkspaceDocument,
    userId: string
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    try {
      // Validate workspace data
      if (!workspaceData.name || !workspaceData.teamId) {
        throw {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Workspace name and team ID are required',
          status: HttpStatus.BAD_REQUEST
        } as BaseError;
      }

      // Add creator as admin
      workspaceData.members = [{
        userId,
        role: 'admin',
        joinedAt: new Date()
      }];

      // Create workspace
      const workspace = await this.workspaceModel.create(workspaceData);

      // Cache workspace data
      await this.cacheWorkspace(workspace);

      // Emit real-time update
      this.socketServer.to(workspace.teamId).emit('workspace:created', {
        workspaceId: workspace.id,
        name: workspace.name
      });

      // Log creation
      this.logger.info(`Workspace created: ${workspace.id}`, {
        userId,
        teamId: workspace.teamId
      });

      return {
        status: HttpStatus.CREATED,
        success: true,
        timestamp: new Date(),
        data: workspace
      };
    } catch (error) {
      this.logger.error('Workspace creation failed', { error, userId });
      throw error;
    }
  }

  /**
   * Retrieves workspace by ID with caching
   */
  public async getWorkspaceById(
    workspaceId: string,
    userId: string
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    try {
      // Check cache first
      const cached = await this.getCachedWorkspace(workspaceId);
      if (cached) {
        return {
          status: HttpStatus.OK,
          success: true,
          timestamp: new Date(),
          data: cached
        };
      }

      // Get from database
      const workspace = await this.workspaceModel.findById(workspaceId);
      if (!workspace) {
        throw {
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Workspace not found',
          status: HttpStatus.NOT_FOUND
        } as BaseError;
      }

      // Verify member access
      if (!this.hasAccess(workspace, userId)) {
        throw {
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: 'Access denied to workspace',
          status: HttpStatus.FORBIDDEN
        } as BaseError;
      }

      // Cache workspace
      await this.cacheWorkspace(workspace);

      return {
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: workspace
      };
    } catch (error) {
      this.logger.error('Workspace retrieval failed', { error, workspaceId, userId });
      throw error;
    }
  }

  /**
   * Updates workspace with optimistic locking and real-time notifications
   */
  public async updateWorkspace(
    workspaceId: string,
    updateData: Partial<WorkspaceDocument>,
    userId: string
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    try {
      const workspace = await this.workspaceModel.findById(workspaceId);
      if (!workspace) {
        throw {
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Workspace not found',
          status: HttpStatus.NOT_FOUND
        } as BaseError;
      }

      // Verify admin access
      if (!this.isAdmin(workspace, userId)) {
        throw {
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: 'Admin access required',
          status: HttpStatus.FORBIDDEN
        } as BaseError;
      }

      // Update workspace
      const updated = await this.workspaceModel.findByIdAndUpdate(
        workspaceId,
        { ...updateData, version: workspace.version + 1 },
        { new: true }
      );

      // Invalidate cache
      await this.invalidateWorkspaceCache(workspaceId);

      // Emit update event
      this.socketServer.to(workspace.teamId).emit('workspace:updated', {
        workspaceId,
        updates: updateData
      });

      return {
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: updated
      };
    } catch (error) {
      this.logger.error('Workspace update failed', { error, workspaceId, userId });
      throw error;
    }
  }

  /**
   * Deletes workspace with member cleanup
   */
  public async deleteWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<SuccessResponse<void>> {
    try {
      const workspace = await this.workspaceModel.findById(workspaceId);
      if (!workspace) {
        throw {
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Workspace not found',
          status: HttpStatus.NOT_FOUND
        } as BaseError;
      }

      // Verify admin access
      if (!this.isAdmin(workspace, userId)) {
        throw {
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: 'Admin access required',
          status: HttpStatus.FORBIDDEN
        } as BaseError;
      }

      // Soft delete
      await this.workspaceModel.findByIdAndUpdate(workspaceId, {
        isActive: false,
        version: workspace.version + 1
      });

      // Clear cache and active members
      await Promise.all([
        this.invalidateWorkspaceCache(workspaceId),
        this.redisClient.del(`${this.activeMembersPrefix}${workspaceId}`)
      ]);

      // Notify members
      this.socketServer.to(workspace.teamId).emit('workspace:deleted', {
        workspaceId,
        teamId: workspace.teamId
      });

      return {
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Workspace deletion failed', { error, workspaceId, userId });
      throw error;
    }
  }

  /**
   * Adds member to workspace with role assignment
   */
  public async addMember(
    workspaceId: string,
    memberId: string,
    role: string,
    userId: string
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    try {
      const workspace = await this.workspaceModel.findById(workspaceId);
      if (!workspace) {
        throw {
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Workspace not found',
          status: HttpStatus.NOT_FOUND
        } as BaseError;
      }

      // Verify admin access
      if (!this.isAdmin(workspace, userId)) {
        throw {
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: 'Admin access required',
          status: HttpStatus.FORBIDDEN
        } as BaseError;
      }

      // Add member
      workspace.members.push({
        userId: memberId,
        role,
        joinedAt: new Date()
      });

      const updated = await workspace.save();

      // Invalidate cache
      await this.invalidateWorkspaceCache(workspaceId);

      // Notify members
      this.socketServer.to(workspace.teamId).emit('workspace:member:added', {
        workspaceId,
        memberId,
        role
      });

      return {
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: updated
      };
    } catch (error) {
      this.logger.error('Member addition failed', { error, workspaceId, memberId, userId });
      throw error;
    }
  }

  /**
   * Removes member from workspace
   */
  public async removeMember(
    workspaceId: string,
    memberId: string,
    userId: string
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    try {
      const workspace = await this.workspaceModel.findById(workspaceId);
      if (!workspace) {
        throw {
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Workspace not found',
          status: HttpStatus.NOT_FOUND
        } as BaseError;
      }

      // Verify admin access
      if (!this.isAdmin(workspace, userId)) {
        throw {
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: 'Admin access required',
          status: HttpStatus.FORBIDDEN
        } as BaseError;
      }

      // Remove member
      workspace.members = workspace.members.filter(m => m.userId !== memberId);
      const updated = await workspace.save();

      // Invalidate cache and remove from active members
      await Promise.all([
        this.invalidateWorkspaceCache(workspaceId),
        this.redisClient.srem(`${this.activeMembersPrefix}${workspaceId}`, memberId)
      ]);

      // Notify members
      this.socketServer.to(workspace.teamId).emit('workspace:member:removed', {
        workspaceId,
        memberId
      });

      return {
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: updated
      };
    } catch (error) {
      this.logger.error('Member removal failed', { error, workspaceId, memberId, userId });
      throw error;
    }
  }

  /**
   * Gets currently active members in workspace
   */
  public async getActiveMembers(
    workspaceId: string
  ): Promise<SuccessResponse<string[]>> {
    try {
      const members = await this.redisClient.smembers(
        `${this.activeMembersPrefix}${workspaceId}`
      );

      return {
        status: HttpStatus.OK,
        success: true,
        timestamp: new Date(),
        data: members
      };
    } catch (error) {
      this.logger.error('Active members retrieval failed', { error, workspaceId });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async cacheWorkspace(workspace: WorkspaceDocument): Promise<void> {
    await this.redisClient.setex(
      `${this.cacheKeyPrefix}${workspace.id}`,
      WORKSPACE_CACHE_TTL,
      JSON.stringify(workspace)
    );
  }

  private async getCachedWorkspace(workspaceId: string): Promise<WorkspaceDocument | null> {
    const cached = await this.redisClient.get(`${this.cacheKeyPrefix}${workspaceId}`);
    return cached ? JSON.parse(cached) : null;
  }

  private async invalidateWorkspaceCache(workspaceId: string): Promise<void> {
    await this.redisClient.del(`${this.cacheKeyPrefix}${workspaceId}`);
  }

  private hasAccess(workspace: WorkspaceDocument, userId: string): boolean {
    return workspace.members.some(m => m.userId === userId);
  }

  private isAdmin(workspace: WorkspaceDocument, userId: string): boolean {
    return workspace.members.some(m => m.userId === userId && m.role === 'admin');
  }
}