import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { debounce } from 'lodash';
import Table from '../common/Table';
import Modal from '../common/Modal';
import { WorkspaceService } from '../../services/workspace.service';
import { ErrorCode } from '../../constants/error.constant';
import { createError } from '../../utils/error.util';

// Role definitions with descriptions for accessibility
const WORKSPACE_ROLES = {
  owner: { label: 'Owner', description: 'Full control over workspace and members' },
  admin: { label: 'Admin', description: 'Can manage members and content' },
  editor: { label: 'Editor', description: 'Can create and edit prompts' },
  viewer: { label: 'Viewer', description: 'Can view prompts only' }
} as const;

type WorkspaceRole = keyof typeof WORKSPACE_ROLES;

interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  name: string;
  email: string;
  joinedAt: Date;
  lastActive: Date;
}

interface TeamManagerProps {
  workspaceId: string;
  members: WorkspaceMember[];
  currentUserRole: WorkspaceRole;
  onMemberUpdate: (members: WorkspaceMember[]) => void;
  highContrastMode?: boolean;
}

// Styled components with accessibility enhancements
const StyledTeamManager = styled.div<{ $highContrast?: boolean }>`
  padding: 24px;
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: 4px;
  outline: ${({ $highContrast }) => $highContrast ? '2px solid currentColor' : 'none'};
  position: relative;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
`;

const TeamManager: React.FC<TeamManagerProps> = React.memo(({
  workspaceId,
  members,
  currentUserRole,
  onMemberUpdate,
  highContrastMode = false
}) => {
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'add' | 'edit' | 'remove'>('add');
  const workspaceService = useMemo(() => new WorkspaceService(window.wsService), []);

  // Table column definitions with accessibility labels
  const columns = useMemo(() => [
    {
      id: 'name',
      label: 'Name',
      accessor: 'name',
      sortable: true,
      width: '25%'
    },
    {
      id: 'email',
      label: 'Email',
      accessor: 'email',
      sortable: true,
      width: '30%'
    },
    {
      id: 'role',
      label: 'Role',
      accessor: 'role',
      sortable: true,
      width: '15%',
      render: (value: WorkspaceRole) => WORKSPACE_ROLES[value].label
    },
    {
      id: 'lastActive',
      label: 'Last Active',
      accessor: 'lastActive',
      sortable: true,
      width: '20%',
      render: (value: Date) => new Date(value).toLocaleDateString()
    },
    {
      id: 'actions',
      label: 'Actions',
      accessor: 'userId',
      width: '10%',
      render: (_: string, row: WorkspaceMember) => (
        <div role="group" aria-label={`Actions for ${row.name}`}>
          {currentUserRole === 'owner' || currentUserRole === 'admin' ? (
            <>
              <button
                onClick={() => handleEditMember(row)}
                aria-label={`Edit ${row.name}'s role`}
              >
                Edit
              </button>
              <button
                onClick={() => handleRemoveMember(row)}
                aria-label={`Remove ${row.name}`}
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
      )
    }
  ], [currentUserRole]);

  // Real-time updates subscription
  useEffect(() => {
    const handleMemberUpdate = (update: any) => {
      if (update.workspaceId === workspaceId) {
        onMemberUpdate(update.members);
      }
    };

    workspaceService.subscribeToMemberUpdates(handleMemberUpdate);
    return () => {
      workspaceService.unsubscribe('member_update', handleMemberUpdate);
    };
  }, [workspaceId, workspaceService, onMemberUpdate]);

  // Debounced member role update
  const updateMemberRole = useCallback(
    debounce(async (userId: string, role: WorkspaceRole) => {
      try {
        await workspaceService.updateMemberRole(workspaceId, userId, role);
      } catch (error) {
        throw createError(ErrorCode.WORKSPACE_ERROR, {
          message: 'Failed to update member role',
          userId,
          role
        });
      }
    }, 500),
    [workspaceId, workspaceService]
  );

  const handleAddMember = useCallback(() => {
    setModalAction('add');
    setSelectedMember(null);
    setIsModalOpen(true);
  }, []);

  const handleEditMember = useCallback((member: WorkspaceMember) => {
    setModalAction('edit');
    setSelectedMember(member);
    setIsModalOpen(true);
  }, []);

  const handleRemoveMember = useCallback((member: WorkspaceMember) => {
    setModalAction('remove');
    setSelectedMember(member);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedMember(null);
  }, []);

  const handleModalConfirm = useCallback(async (data?: Partial<WorkspaceMember>) => {
    try {
      switch (modalAction) {
        case 'add':
          if (data) {
            await workspaceService.addMember(workspaceId, data);
          }
          break;
        case 'edit':
          if (selectedMember && data?.role) {
            await updateMemberRole(selectedMember.userId, data.role);
          }
          break;
        case 'remove':
          if (selectedMember) {
            await workspaceService.removeMember(workspaceId, selectedMember.userId);
          }
          break;
      }
      handleModalClose();
    } catch (error) {
      throw createError(ErrorCode.WORKSPACE_ERROR, {
        action: modalAction,
        memberId: selectedMember?.userId,
        data
      });
    }
  }, [modalAction, selectedMember, workspaceId, workspaceService, updateMemberRole, handleModalClose]);

  return (
    <StyledTeamManager $highContrast={highContrastMode}>
      <ActionButtons>
        {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
          <button
            onClick={handleAddMember}
            aria-label="Add new team member"
          >
            Add Member
          </button>
        )}
      </ActionButtons>

      <Table
        data={members}
        columns={columns}
        ariaLabel="Team members list"
        sortable
        pagination
        highContrast={highContrastMode}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={`${modalAction.charAt(0).toUpperCase() + modalAction.slice(1)} Team Member`}
        ariaLabel={`${modalAction} team member dialog`}
      >
        {/* Modal content based on action */}
        {/* Implementation details omitted for brevity */}
      </Modal>
    </StyledTeamManager>
  );
});

TeamManager.displayName = 'TeamManager';

export default TeamManager;