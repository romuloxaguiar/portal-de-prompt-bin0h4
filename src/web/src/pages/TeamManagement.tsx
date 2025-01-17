import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import AppLayout from '../components/layout/AppLayout';
import TeamManager from '../components/workspace/TeamManager';
import { useAuth } from '../hooks/useAuth';
import { useCollaboration } from '../hooks/useCollaboration';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceRole, type WorkspaceMember } from '../interfaces/workspace.interface';
import { ErrorCode } from '../constants/error.constant';
import { createError } from '../utils/error.util';

// Styled components
const PageContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(3)}px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
`;

const PageHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(3)}px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  padding-bottom: ${({ theme }) => theme.spacing(2)}px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.h4.fontSize};
  font-weight: ${({ theme }) => theme.typography.fontWeights.medium};
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0;
`;

const TeamManagementPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, checkPermission } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole>(WorkspaceRole.VIEWER);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize collaboration hook for real-time updates
  const { workspace, connectionHealth, sendCollaborationEvent } = useCollaboration(workspaceId, {
    autoConnect: true,
    enablePresence: true,
    heartbeatInterval: 30000
  });

  // Initialize workspace service
  const workspaceService = React.useMemo(() => new WorkspaceService(window.wsService), []);

  // Load workspace members
  useEffect(() => {
    const loadWorkspaceMembers = async () => {
      if (!workspaceId || !isAuthenticated) return;

      try {
        setIsLoading(true);
        const workspace = await workspaceService.getWorkspace(workspaceId);
        
        if (!workspace) {
          throw createError(ErrorCode.NOT_FOUND_ERROR, {
            message: 'Workspace not found',
            workspaceId
          });
        }

        // Set members and determine current user's role
        setMembers(workspace.members);
        const userMember = workspace.members.find(member => member.userId === user?.id);
        if (userMember) {
          setCurrentUserRole(userMember.role);
        }
      } catch (error) {
        throw createError(ErrorCode.WORKSPACE_ERROR, {
          message: 'Failed to load workspace members',
          workspaceId,
          error
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspaceMembers();
  }, [workspaceId, isAuthenticated, user?.id, workspaceService]);

  // Handle member updates
  const handleMemberUpdate = useCallback(async (updatedMembers: WorkspaceMember[]) => {
    try {
      // Validate user permissions
      if (!checkPermission(['MANAGE_MEMBERS'])) {
        throw createError(ErrorCode.AUTHORIZATION_ERROR, {
          message: 'Insufficient permissions to manage members'
        });
      }

      setMembers(updatedMembers);

      // Notify other users of the update
      sendCollaborationEvent('member_update', {
        workspaceId,
        members: updatedMembers,
        timestamp: Date.now()
      });

    } catch (error) {
      throw createError(ErrorCode.WORKSPACE_ERROR, {
        message: 'Failed to update workspace members',
        error
      });
    }
  }, [workspaceId, checkPermission, sendCollaborationEvent]);

  // Handle role changes
  const handleRoleChange = useCallback(async (memberId: string, newRole: WorkspaceRole) => {
    try {
      // Validate user permissions
      if (!checkPermission(['MANAGE_ROLES'])) {
        throw createError(ErrorCode.AUTHORIZATION_ERROR, {
          message: 'Insufficient permissions to manage roles'
        });
      }

      await workspaceService.updateWorkspaceMember(workspaceId!, memberId, newRole);
      
      // Update local state
      setMembers(prevMembers => 
        prevMembers.map(member => 
          member.userId === memberId 
            ? { ...member, role: newRole }
            : member
        )
      );

      // Notify other users of the role change
      sendCollaborationEvent('role_change', {
        workspaceId,
        memberId,
        role: newRole,
        timestamp: Date.now()
      });

    } catch (error) {
      throw createError(ErrorCode.WORKSPACE_ERROR, {
        message: 'Failed to update member role',
        memberId,
        role: newRole,
        error
      });
    }
  }, [workspaceId, checkPermission, workspaceService, sendCollaborationEvent]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <ErrorBoundary>
      <AppLayout>
        <PageContainer>
          <PageHeader>
            <Title>Team Management</Title>
            {connectionHealth.isHealthy && (
              <span role="status" aria-live="polite">
                Real-time collaboration enabled
              </span>
            )}
          </PageHeader>

          <TeamManager
            workspaceId={workspaceId!}
            members={members}
            currentUserRole={currentUserRole}
            onMemberUpdate={handleMemberUpdate}
            onRoleChange={handleRoleChange}
            isLoading={isLoading}
          />
        </PageContainer>
      </AppLayout>
    </ErrorBoundary>
  );
};

export default TeamManagementPage;