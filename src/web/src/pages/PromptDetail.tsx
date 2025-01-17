import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Skeleton
} from '@mui/material';

import { usePrompt } from '../../hooks/usePrompt';
import PromptEditor from '../../components/editor/PromptEditor';
import VersionHistory from '../../components/editor/VersionHistory';
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { IPrompt } from '../../interfaces/prompt.interface';
import { ErrorCode } from '../../constants/error.constant';

interface PromptDetailParams {
  promptId: string;
  workspaceId: string;
}

const PromptDetail: React.FC = React.memo(() => {
  // Router hooks
  const navigate = useNavigate();
  const { promptId, workspaceId } = useParams<PromptDetailParams>();
  const location = useLocation();

  // State
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Custom hooks
  const {
    selectedPrompt,
    loading,
    error,
    savePrompt,
    collaborators,
    fetchPromptById
  } = usePrompt(workspaceId || '', {
    enableCache: true,
    analyticsEnabled: true,
    autoSave: true
  });

  // Fetch prompt data on mount
  useEffect(() => {
    if (promptId) {
      fetchPromptById(promptId);
    }
  }, [promptId, fetchPromptById]);

  // Handle prompt save with validation and error handling
  const handlePromptSave = useCallback(async (updatedPrompt: IPrompt) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await savePrompt(updatedPrompt);
      
      // Update URL if new prompt
      if (!promptId) {
        navigate(`/workspace/${workspaceId}/prompts/${updatedPrompt.id}`, {
          replace: true
        });
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  }, [promptId, workspaceId, navigate, savePrompt]);

  // Handle version restore
  const handleVersionRestore = useCallback(async (versionId: string) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      if (!selectedPrompt) return;

      const updatedPrompt = {
        ...selectedPrompt,
        currentVersion: { id: versionId }
      };

      await savePrompt(updatedPrompt);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to restore version');
    } finally {
      setIsSaving(false);
    }
  }, [selectedPrompt, savePrompt]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    setSaveError(error.message);
  }, []);

  if (error) {
    return (
      <Alert 
        severity="error"
        action={
          <Button color="inherit" onClick={() => navigate('/workspace/' + workspaceId)}>
            Return to Workspace
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <ErrorBoundary onError={handleError}>
      <Box sx={{ p: 3 }}>
        {/* Breadcrumb Navigation */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Button onClick={() => navigate('/workspace/' + workspaceId)}>
            Workspace
          </Button>
          <Typography color="text.primary">
            {loading ? <Skeleton width={100} /> : selectedPrompt?.title || 'New Prompt'}
          </Typography>
        </Breadcrumbs>

        <Grid container spacing={3}>
          {/* Main Editor Section */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              {loading ? (
                <Skeleton variant="rectangular" height={400} />
              ) : (
                <PromptEditor
                  workspaceId={workspaceId || ''}
                  promptId={promptId}
                  onSave={handlePromptSave}
                  onError={handleError}
                  collaborators={collaborators}
                />
              )}

              {saveError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {saveError}
                </Alert>
              )}

              {isSaving && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Sidebar Section */}
          <Grid item xs={12} md={4}>
            {/* Version History */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Version History
              </Typography>
              <VersionHistory
                promptId={promptId || ''}
                onRestore={handleVersionRestore}
                onError={handleError}
              />
            </Paper>

            {/* Analytics Dashboard */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Analytics
              </Typography>
              {promptId && (
                <AnalyticsDashboard
                  workspaceId={workspaceId || ''}
                  onError={handleError}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
});

PromptDetail.displayName = 'PromptDetail';

export default PromptDetail;