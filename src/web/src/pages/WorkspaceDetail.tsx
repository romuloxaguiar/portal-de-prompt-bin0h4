import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Skeleton
} from '@mui/material';
import { WorkspaceSettings } from '../components/workspace/WorkspaceSettings';
import { TeamManager } from '../components/workspace/TeamManager';
import { WorkspaceService } from '../services/workspace.service';
import { useWebSocket } from '../hooks/useWebSocket';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Workspace, WorkspaceRole, WorkspaceMember } from '../interfaces/workspace.interface';
import { ErrorCode } from '../constants/error.constant';
import { createError } from '../utils/error.util';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`workspace-tabpanel-${index}`}
    aria-labelledby={`workspace-tab-${index}`}
  >
    {value === index && children}
  </div>
);

const WorkspaceDetail: React.FC = () => {
  const { id: workspaceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceService = useMemo(() => new WorkspaceService(), []);

  // State management
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole>(WorkspaceRole.VIEWER);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const {
    isConnected,
    subscribe,
    unsubscribe,
    emit
  } = useWebSocket(`${process.env.REACT_APP_WS_URL}/workspaces`);

  // Load workspace data
  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) {
      navigate('/workspaces');
      return;
    }

    try {
      setLoading(true);
      const data = await workspaceService.getWorkspace(workspaceId);
      setWorkspace(data);
      
      // Determine current user's role
      const userRole = data.members.find(
        member => member.userId === localStorage.getItem('userId')
      )?.role;
      setCurrentUserRole(userRole || WorkspaceRole.VIEWER);
      
    } catch (error) {
      setError('Failed to load workspace details');
      throw createError(ErrorCode.WORKSPACE_ERROR, { 
        message: 'Failed to load workspace',
        workspaceId 
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, navigate, workspaceService]);

  // Handle real-time workspace updates
  const handleWorkspaceUpdate = useCallback((update: any) => {
    if (update.workspaceId === workspaceId) {
      setWorkspace(prevWorkspace => ({
        ...prevWorkspace!,
        ...update.data
      }));
    }
  }, [workspaceId]);

  // Handle member updates
  const handleMemberUpdate = useCallback((members: WorkspaceMember[]) => {
    setWorkspace(prevWorkspace => prevWorkspace ? {
      ...prevWorkspace,
      members
    } : null);
  }, []);

  // Handle settings updates
  const handleSettingsUpdate = useCallback((settings: any) => {
    setWorkspace(prevWorkspace => prevWorkspace ? {
      ...prevWorkspace,
      settings
    } : null);

    // Notify other users of settings change
    if (isConnected) {
      emit('workspace_settings_update', {
        workspaceId,
        settings
      });
    }
  }, [workspaceId, isConnected, emit]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (isConnected && workspaceId) {
      subscribe('workspace_update', handleWorkspaceUpdate);
      subscribe('member_update', handleMemberUpdate);
    }

    return () => {
      if (workspaceId) {
        unsubscribe('workspace_update');
        unsubscribe('member_update');
      }
    };
  }, [workspaceId, isConnected, subscribe, unsubscribe, handleWorkspaceUpdate, handleMemberUpdate]);

  // Initial data load
  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Handle tab changes
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="text" height={50} sx={{ mt: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mt: 2 }} />
      </Container>
    );
  }

  if (error || !workspace) {
    return (
      <Container maxWidth="lg">
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="error">
            {error || 'Workspace not found'}
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h4" component="h1" gutterBottom>
                {workspace.name}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {workspace.description}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ mb: 3 }}>
              <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                aria-label="Workspace management tabs"
                variant="fullWidth"
              >
                <Tab 
                  label="Settings" 
                  id="workspace-tab-0"
                  aria-controls="workspace-tabpanel-0"
                />
                <Tab 
                  label="Team" 
                  id="workspace-tab-1"
                  aria-controls="workspace-tabpanel-1"
                />
              </Tabs>
            </Paper>

            <TabPanel value={selectedTab} index={0}>
              <WorkspaceSettings
                workspaceId={workspaceId!}
                currentSettings={workspace.settings}
                onSettingsUpdate={handleSettingsUpdate}
                isAdmin={currentUserRole === WorkspaceRole.ADMIN}
              />
            </TabPanel>

            <TabPanel value={selectedTab} index={1}>
              <TeamManager
                workspaceId={workspaceId!}
                members={workspace.members}
                currentUserRole={currentUserRole}
                onMemberUpdate={handleMemberUpdate}
              />
            </TabPanel>
          </Grid>
        </Grid>
      </Container>
    </ErrorBoundary>
  );
};

export default WorkspaceDetail;