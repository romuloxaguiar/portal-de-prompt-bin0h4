/**
 * Workspace Controller
 * Handles HTTP requests for workspace management with real-time collaboration features
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { 
  controller, 
  httpGet, 
  httpPost, 
  httpPut, 
  httpDelete,
  request,
  response
} from 'routing-controllers'; // v0.10.0
import { RateLimit } from 'express-rate-limit'; // v6.7.0
import { OpenAPI } from 'routing-controllers-openapi'; // v4.0.0
import { Server as SocketServer } from 'socket.io'; // v4.7.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceDocument } from '../models/workspace.model';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { SuccessResponse, ErrorResponse } from '../../common/interfaces/response.interface';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { Logger } from '../../common/services/logger.service';

/**
 * Rate limiting configuration for workspace operations
 */
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  max: 30 // 30 requests per minute
};

/**
 * Controller for handling workspace-related HTTP requests
 */
@injectable()
@controller('/api/v1/workspaces')
@OpenAPI({ security: [{ bearerAuth: [] }] })
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly socketServer: SocketServer,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new workspace
   */
  @httpPost('/')
  @RateLimit(RATE_LIMIT_CONFIG)
  @OpenAPI({ summary: 'Create new workspace' })
  async createWorkspace(
    @request() req: AuthenticatedRequest,
    @response() res: any
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    const correlationId = uuidv4();
    this.logger.info('Creating workspace', { correlationId, userId: req.userId });

    try {
      const workspace = await this.workspaceService.createWorkspace({
        name: req.body.name,
        description: req.body.description,
        teamId: req.body.teamId,
        settings: req.body.settings || {}
      }, req.userId);

      // Set ETag for optimistic concurrency
      res.setHeader('ETag', `"${workspace.data.version}"`);

      return workspace;
    } catch (error) {
      this.logger.error('Workspace creation failed', { 
        correlationId, 
        error, 
        userId: req.userId 
      });
      throw error;
    }
  }

  /**
   * Get workspace by ID
   */
  @httpGet('/:id')
  @RateLimit(RATE_LIMIT_CONFIG)
  @OpenAPI({ summary: 'Get workspace by ID' })
  async getWorkspace(
    @request() req: AuthenticatedRequest,
    @response() res: any
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    const correlationId = uuidv4();
    const workspaceId = req.params.id;

    try {
      const workspace = await this.workspaceService.getWorkspaceById(
        workspaceId,
        req.userId
      );

      // Set ETag and cache headers
      res.setHeader('ETag', `"${workspace.data.version}"`);
      res.setHeader('Cache-Control', 'private, max-age=30');

      return workspace;
    } catch (error) {
      this.logger.error('Workspace retrieval failed', {
        correlationId,
        workspaceId,
        error,
        userId: req.userId
      });
      throw error;
    }
  }

  /**
   * Update workspace
   */
  @httpPut('/:id')
  @RateLimit(RATE_LIMIT_CONFIG)
  @OpenAPI({ summary: 'Update workspace' })
  async updateWorkspace(
    @request() req: AuthenticatedRequest
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    const correlationId = uuidv4();
    const workspaceId = req.params.id;
    const ifMatch = req.headers['if-match'];

    if (!ifMatch) {
      throw {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'ETag header is required',
        status: HttpStatus.BAD_REQUEST
      };
    }

    try {
      const workspace = await this.workspaceService.updateWorkspace(
        workspaceId,
        {
          name: req.body.name,
          description: req.body.description,
          settings: req.body.settings
        },
        req.userId
      );

      return workspace;
    } catch (error) {
      this.logger.error('Workspace update failed', {
        correlationId,
        workspaceId,
        error,
        userId: req.userId
      });
      throw error;
    }
  }

  /**
   * Delete workspace
   */
  @httpDelete('/:id')
  @RateLimit(RATE_LIMIT_CONFIG)
  @OpenAPI({ summary: 'Delete workspace' })
  async deleteWorkspace(
    @request() req: AuthenticatedRequest
  ): Promise<SuccessResponse<void>> {
    const correlationId = uuidv4();
    const workspaceId = req.params.id;

    try {
      const result = await this.workspaceService.deleteWorkspace(
        workspaceId,
        req.userId
      );

      return result;
    } catch (error) {
      this.logger.error('Workspace deletion failed', {
        correlationId,
        workspaceId,
        error,
        userId: req.userId
      });
      throw error;
    }
  }

  /**
   * Add member to workspace
   */
  @httpPost('/:id/members')
  @RateLimit(RATE_LIMIT_CONFIG)
  @OpenAPI({ summary: 'Add member to workspace' })
  async addMember(
    @request() req: AuthenticatedRequest
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    const correlationId = uuidv4();
    const workspaceId = req.params.id;
    const { memberId, role } = req.body;

    try {
      const workspace = await this.workspaceService.addMember(
        workspaceId,
        memberId,
        role,
        req.userId
      );

      return workspace;
    } catch (error) {
      this.logger.error('Member addition failed', {
        correlationId,
        workspaceId,
        memberId,
        error,
        userId: req.userId
      });
      throw error;
    }
  }

  /**
   * Remove member from workspace
   */
  @httpDelete('/:id/members/:memberId')
  @RateLimit(RATE_LIMIT_CONFIG)
  @OpenAPI({ summary: 'Remove member from workspace' })
  async removeMember(
    @request() req: AuthenticatedRequest
  ): Promise<SuccessResponse<WorkspaceDocument>> {
    const correlationId = uuidv4();
    const workspaceId = req.params.id;
    const memberId = req.params.memberId;

    try {
      const workspace = await this.workspaceService.removeMember(
        workspaceId,
        memberId,
        req.userId
      );

      return workspace;
    } catch (error) {
      this.logger.error('Member removal failed', {
        correlationId,
        workspaceId,
        memberId,
        error,
        userId: req.userId
      });
      throw error;
    }
  }

  /**
   * Get active members in workspace
   */
  @httpGet('/:id/members/active')
  @RateLimit(RATE_LIMIT_CONFIG)
  @OpenAPI({ summary: 'Get active workspace members' })
  async getActiveMembers(
    @request() req: AuthenticatedRequest
  ): Promise<SuccessResponse<string[]>> {
    const correlationId = uuidv4();
    const workspaceId = req.params.id;

    try {
      const members = await this.workspaceService.getActiveMembers(workspaceId);
      return members;
    } catch (error) {
      this.logger.error('Active members retrieval failed', {
        correlationId,
        workspaceId,
        error,
        userId: req.userId
      });
      throw error;
    }
  }
}