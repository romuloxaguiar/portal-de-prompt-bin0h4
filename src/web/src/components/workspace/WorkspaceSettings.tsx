import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Switch,
  FormGroup,
  FormControlLabel,
  Button,
  CircularProgress,
  Tooltip
} from '@mui/material'; // ^5.0.0
import { WorkspaceService } from '../../services/workspace.service';
import { useNotification } from '../../hooks/useNotification';
import { WorkspaceSettings as IWorkspaceSettings } from '../../interfaces/workspace.interface';

/**
 * Props interface for WorkspaceSettings component
 */
interface WorkspaceSettingsProps {
  workspaceId: string;
  currentSettings: IWorkspaceSettings;
  onSettingsUpdate: (settings: IWorkspaceSettings) => void;
  isAdmin: boolean;
}

/**
 * WorkspaceSettings component for managing workspace configuration
 * Implements real-time updates and accessibility features
 */
const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({
  workspaceId,
  currentSettings,
  onSettingsUpdate,
  isAdmin
}) => {
  // State management
  const [settings, setSettings] = useState<IWorkspaceSettings>(currentSettings);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hooks
  const { showNotification, showError } = useNotification();
  const workspaceService = new WorkspaceService();

  // Subscribe to real-time workspace updates
  useEffect(() => {
    const unsubscribe = workspaceService.subscribeToWorkspaceUpdates(
      workspaceId,
      (updatedSettings: IWorkspaceSettings) => {
        setSettings(updatedSettings);
        onSettingsUpdate(updatedSettings);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [workspaceId, onSettingsUpdate]);

  /**
   * Handles individual setting changes with validation
   */
  const handleSettingChange = useCallback(async (
    settingName: keyof IWorkspaceSettings,
    value: boolean
  ) => {
    if (!isAdmin) {
      showError({
        type: 'error',
        message: 'You do not have permission to modify workspace settings.'
      });
      return;
    }

    try {
      // Update loading state for specific setting
      setLoadingSettings(prev => ({ ...prev, [settingName]: true }));
      setErrors(prev => ({ ...prev, [settingName]: '' }));

      // Validate setting change
      const validationResult = await workspaceService.validateSettings({
        ...settings,
        [settingName]: value
      });

      if (!validationResult.isValid) {
        throw new Error(validationResult.error);
      }

      // Optimistic update
      const updatedSettings = {
        ...settings,
        [settingName]: value
      };
      setSettings(updatedSettings);

      // Update backend
      await workspaceService.updateWorkspace(workspaceId, {
        settings: updatedSettings
      });

      showNotification({
        type: 'success',
        message: 'Setting updated successfully',
        duration: 3000
      });

    } catch (error) {
      // Revert optimistic update
      setSettings(currentSettings);
      setErrors(prev => ({
        ...prev,
        [settingName]: error instanceof Error ? error.message : 'Failed to update setting'
      }));

      showError({
        type: 'error',
        message: `Failed to update ${settingName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

    } finally {
      setLoadingSettings(prev => ({ ...prev, [settingName]: false }));
    }
  }, [workspaceId, settings, currentSettings, isAdmin, showNotification, showError]);

  /**
   * Handles saving all settings
   */
  const handleSaveSettings = async () => {
    if (!isAdmin) return;

    try {
      setIsSaving(true);
      setErrors({});

      // Validate all settings
      const validationResult = await workspaceService.validateSettings(settings);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error);
      }

      // Update workspace settings
      await workspaceService.updateWorkspace(workspaceId, { settings });

      showNotification({
        type: 'success',
        message: 'Workspace settings updated successfully',
        duration: 3000
      });

      onSettingsUpdate(settings);

    } catch (error) {
      setSettings(currentSettings);
      showError({
        type: 'error',
        message: `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      component="section"
      aria-label="Workspace Settings"
      sx={{ padding: 3 }}
    >
      <FormGroup>
        <FormControlLabel
          control={
            <Tooltip title={errors.isPublic || ''}>
              <Switch
                checked={settings.isPublic}
                onChange={(e) => handleSettingChange('isPublic', e.target.checked)}
                disabled={!isAdmin || loadingSettings.isPublic}
                color="primary"
                inputProps={{
                  'aria-label': 'Toggle workspace visibility',
                  'aria-describedby': 'public-workspace-description'
                }}
              />
            </Tooltip>
          }
          label="Public Workspace"
          id="public-workspace-description"
        />
        {loadingSettings.isPublic && <CircularProgress size={20} />}

        <FormControlLabel
          control={
            <Tooltip title={errors.allowComments || ''}>
              <Switch
                checked={settings.allowComments}
                onChange={(e) => handleSettingChange('allowComments', e.target.checked)}
                disabled={!isAdmin || loadingSettings.allowComments}
                color="primary"
                inputProps={{
                  'aria-label': 'Toggle comments',
                  'aria-describedby': 'comments-description'
                }}
              />
            </Tooltip>
          }
          label="Allow Comments"
          id="comments-description"
        />
        {loadingSettings.allowComments && <CircularProgress size={20} />}

        <FormControlLabel
          control={
            <Tooltip title={errors.autoSave || ''}>
              <Switch
                checked={settings.autoSave}
                onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                disabled={!isAdmin || loadingSettings.autoSave}
                color="primary"
                inputProps={{
                  'aria-label': 'Toggle auto-save',
                  'aria-describedby': 'auto-save-description'
                }}
              />
            </Tooltip>
          }
          label="Auto-Save"
          id="auto-save-description"
        />
        {loadingSettings.autoSave && <CircularProgress size={20} />}

        <FormControlLabel
          control={
            <Tooltip title={errors.realTimeCollaboration || ''}>
              <Switch
                checked={settings.realTimeCollaboration}
                onChange={(e) => handleSettingChange('realTimeCollaboration', e.target.checked)}
                disabled={!isAdmin || loadingSettings.realTimeCollaboration}
                color="primary"
                inputProps={{
                  'aria-label': 'Toggle real-time collaboration',
                  'aria-describedby': 'real-time-description'
                }}
              />
            </Tooltip>
          }
          label="Real-Time Collaboration"
          id="real-time-description"
        />
        {loadingSettings.realTimeCollaboration && <CircularProgress size={20} />}

        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveSettings}
          disabled={!isAdmin || isSaving}
          sx={{ mt: 2 }}
          aria-label="Save workspace settings"
        >
          {isSaving ? <CircularProgress size={24} /> : 'Save Settings'}
        </Button>
      </FormGroup>
    </Card>
  );
};

export default WorkspaceSettings;