/**
 * Workspace Routes Configuration
 * Configures Express router for workspace-related endpoints with REST and WebSocket support
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import { Server } from 'socket.io'; // v4.7.2
import rateLimit from 'express-rate-limit'; // v6.7.0
import { validateRequest } from '../../common/middleware/request-validator.middleware';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import { WorkspaceController } from '../controllers/workspace.controller';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ErrorCode } from '../../common/constants/error-codes.constant';

// Rate limiting configuration for workspace endpoints
const WORKSPACE_RATE_LIMIT = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 requests per minute
  message: {
    code: ErrorCode.RATE_LIMIT_ERROR,
    message: 'Too many requests, please try again later',
    status: HttpStatus.TOO_MANY_REQUESTS
  }
});

/**
 * Configures and returns the workspace router with all routes and middleware
 * @param controller - Workspace controller instance
 * @param io - Socket.IO server instance
 * @returns Configured Express router
 */
export const configureWorkspaceRoutes = (
  controller: WorkspaceController,
  io: Server
): Router => {
  const router = Router();

  // Apply rate limiting to all workspace routes
  router.use(WORKSPACE_RATE_LIMIT);

  // REST Routes
  router.get('/', 
    validateRequest,
    controller.getWorkspaces.bind(controller)
  );

  router.post('/',
    validateRequest,
    controller.createWorkspace.bind(controller)
  );

  router.get('/:id',
    validateRequest,
    controller.getWorkspace.bind(controller)
  );

  router.put('/:id',
    validateRequest,
    controller.updateWorkspace.bind(controller)
  );

  router.delete('/:id',
    validateRequest,
    controller.deleteWorkspace.bind(controller)
  );

  // Member Management Routes
  router.post('/:id/members',
    validateRequest,
    controller.addMember.bind(controller)
  );

  router.delete('/:id/members/:memberId',
    validateRequest,
    controller.removeMember.bind(controller)
  );

  router.get('/:id/members/active',
    validateRequest,
    controller.getActiveMembers.bind(controller)
  );

  // Configure WebSocket namespace for workspaces
  const workspaceNamespace = io.of('/workspace');

  workspaceNamespace.on('connection', (socket) => {
    // Join workspace room
    socket.on('workspace:join', async (data: { workspaceId: string; userId: string }) => {
      socket.join(`workspace:${data.workspaceId}`);
      socket.to(`workspace:${data.workspaceId}`).emit('user:joined', {
        userId: data.userId,
        timestamp: new Date()
      });
    });

    // Leave workspace room
    socket.on('workspace:leave', (data: { workspaceId: string; userId: string }) => {
      socket.leave(`workspace:${data.workspaceId}`);
      socket.to(`workspace:${data.workspaceId}`).emit('user:left', {
        userId: data.userId,
        timestamp: new Date()
      });
    });

    // Real-time collaboration events
    socket.on('workspace:update', (data: { 
      workspaceId: string;
      userId: string;
      changes: any;
    }) => {
      socket.to(`workspace:${data.workspaceId}`).emit('workspace:updated', {
        userId: data.userId,
        changes: data.changes,
        timestamp: new Date()
      });
    });

    // Presence detection
    socket.on('workspace:presence', (data: {
      workspaceId: string;
      userId: string;
      status: 'active' | 'idle' | 'offline';
    }) => {
      socket.to(`workspace:${data.workspaceId}`).emit('presence:updated', {
        userId: data.userId,
        status: data.status,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room.startsWith('workspace:')) {
          const workspaceId = room.split(':')[1];
          socket.to(room).emit('user:disconnected', {
            socketId: socket.id,
            timestamp: new Date()
          });
        }
      });
    });
  });

  // Apply error handling middleware last
  router.use(errorHandler);

  return router;
};

// Export configured router
export default configureWorkspaceRoutes;