import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import MockRedis from 'ioredis-mock';
import SocketMock from 'socket.io-mock';
import { Server as SocketServer } from 'socket.io';
import { WorkspaceService, WorkspaceServiceImpl } from '../../src/collaboration-service/services/workspace.service';
import { WorkspaceModel, WorkspaceDocument } from '../../src/collaboration-service/models/workspace.model';
import { HttpStatus } from '../../src/common/constants/http-status.constant';
import { ErrorCode } from '../../src/common/constants/error-codes.constant';

describe('WorkspaceService', () => {
  let workspaceService: WorkspaceService;
  let mockWorkspaceModel: jest.Mocked<typeof WorkspaceModel>;
  let mockRedisClient: MockRedis;
  let mockLogger: any;
  let mockSocketServer: jest.Mocked<SocketServer>;
  let socketMock: SocketMock;

  const mockWorkspace: WorkspaceDocument = {
    id: 'workspace-123',
    name: 'Test Workspace',
    description: 'Test workspace for unit tests',
    teamId: 'team-123',
    members: [
      { userId: 'user-123', role: 'admin', joinedAt: new Date('2023-01-01') },
      { userId: 'user-456', role: 'editor', joinedAt: new Date('2023-01-02') }
    ],
    settings: {
      isPublic: false,
      allowComments: true,
      autoSave: true,
      versionControl: true,
      realTimeCollaboration: true
    },
    isActive: true,
    version: 1,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02')
  } as WorkspaceDocument;

  beforeEach(() => {
    // Setup mocks
    mockWorkspaceModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByTeamId: jest.fn(),
      findActiveWorkspaces: jest.fn()
    } as any;

    mockRedisClient = new MockRedis();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    socketMock = new SocketMock();
    mockSocketServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as any;

    workspaceService = new WorkspaceServiceImpl(
      mockWorkspaceModel,
      mockRedisClient,
      mockLogger,
      mockSocketServer
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockRedisClient.flushall();
  });

  describe('Workspace CRUD Operations', () => {
    it('should create workspace with valid data', async () => {
      const userId = 'user-123';
      const workspaceData = {
        name: 'New Workspace',
        teamId: 'team-123',
        settings: { isPublic: false }
      };

      mockWorkspaceModel.create.mockResolvedValue({ ...mockWorkspace, ...workspaceData });

      const result = await workspaceService.createWorkspace(workspaceData as any, userId);

      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe(workspaceData.name);
      expect(mockSocketServer.emit).toHaveBeenCalledWith('workspace:created', expect.any(Object));
    });

    it('should validate required fields on creation', async () => {
      const userId = 'user-123';
      const invalidData = { description: 'Missing required fields' };

      await expect(workspaceService.createWorkspace(invalidData as any, userId))
        .rejects
        .toMatchObject({
          code: ErrorCode.VALIDATION_ERROR,
          status: HttpStatus.BAD_REQUEST
        });
    });

    it('should retrieve workspace by ID with cache hit', async () => {
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      await mockRedisClient.set(
        `workspace:${workspaceId}`,
        JSON.stringify(mockWorkspace)
      );

      const result = await workspaceService.getWorkspaceById(workspaceId, userId);

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toMatchObject(mockWorkspace);
      expect(mockWorkspaceModel.findById).not.toHaveBeenCalled();
    });

    it('should handle workspace not found', async () => {
      const workspaceId = 'non-existent';
      const userId = 'user-123';

      mockWorkspaceModel.findById.mockResolvedValue(null);

      await expect(workspaceService.getWorkspaceById(workspaceId, userId))
        .rejects
        .toMatchObject({
          code: ErrorCode.NOT_FOUND_ERROR,
          status: HttpStatus.NOT_FOUND
        });
    });
  });

  describe('Member Management', () => {
    it('should add member with valid role', async () => {
      const workspaceId = 'workspace-123';
      const memberId = 'new-user';
      const role = 'editor';
      const adminId = 'user-123';

      mockWorkspaceModel.findById.mockResolvedValue({
        ...mockWorkspace,
        save: jest.fn().mockResolvedValue(mockWorkspace)
      });

      const result = await workspaceService.addMember(workspaceId, memberId, role, adminId);

      expect(result.status).toBe(HttpStatus.OK);
      expect(mockSocketServer.emit).toHaveBeenCalledWith('workspace:member:added', expect.any(Object));
    });

    it('should prevent non-admin from adding members', async () => {
      const workspaceId = 'workspace-123';
      const memberId = 'new-user';
      const role = 'editor';
      const nonAdminId = 'user-456';

      mockWorkspaceModel.findById.mockResolvedValue(mockWorkspace);

      await expect(workspaceService.addMember(workspaceId, memberId, role, nonAdminId))
        .rejects
        .toMatchObject({
          code: ErrorCode.AUTHORIZATION_ERROR,
          status: HttpStatus.FORBIDDEN
        });
    });
  });

  describe('Real-time Updates', () => {
    it('should emit workspace update event', async () => {
      const workspaceId = 'workspace-123';
      const adminId = 'user-123';
      const updateData = { name: 'Updated Workspace' };

      mockWorkspaceModel.findById.mockResolvedValue(mockWorkspace);
      mockWorkspaceModel.findByIdAndUpdate.mockResolvedValue({
        ...mockWorkspace,
        ...updateData
      });

      await workspaceService.updateWorkspace(workspaceId, updateData, adminId);

      expect(mockSocketServer.emit).toHaveBeenCalledWith('workspace:updated', expect.any(Object));
    });

    it('should broadcast member removal', async () => {
      const workspaceId = 'workspace-123';
      const memberId = 'user-456';
      const adminId = 'user-123';

      mockWorkspaceModel.findById.mockResolvedValue({
        ...mockWorkspace,
        save: jest.fn().mockResolvedValue(mockWorkspace)
      });

      await workspaceService.removeMember(workspaceId, memberId, adminId);

      expect(mockSocketServer.emit).toHaveBeenCalledWith('workspace:member:removed', {
        workspaceId,
        memberId
      });
    });
  });

  describe('Caching Behavior', () => {
    it('should invalidate cache on workspace update', async () => {
      const workspaceId = 'workspace-123';
      const adminId = 'user-123';
      const updateData = { name: 'Updated Workspace' };

      await mockRedisClient.set(
        `workspace:${workspaceId}`,
        JSON.stringify(mockWorkspace)
      );

      mockWorkspaceModel.findById.mockResolvedValue(mockWorkspace);
      mockWorkspaceModel.findByIdAndUpdate.mockResolvedValue({
        ...mockWorkspace,
        ...updateData
      });

      await workspaceService.updateWorkspace(workspaceId, updateData, adminId);

      const cached = await mockRedisClient.get(`workspace:${workspaceId}`);
      expect(cached).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      mockRedisClient.get = jest.fn().mockRejectedValue(new Error('Redis error'));
      mockWorkspaceModel.findById.mockResolvedValue(mockWorkspace);

      const result = await workspaceService.getWorkspaceById(workspaceId, userId);

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toMatchObject(mockWorkspace);
    });
  });
});