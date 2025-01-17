import React, { useCallback, useState, useEffect } from 'react'; // v18.0.0
import { 
  Switch, 
  FormControlLabel, 
  Typography, 
  Skeleton,
  Stack,
  Divider,
  Box
} from '@mui/material'; // v5.14.0
import debounce from 'lodash/debounce'; // v4.17.21

import Card from '../components/common/Card';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { appConfig } from '../config/app.config';

// Interface for component props
interface SettingsProps {
  className?: string;
}

// Interface for user preferences
interface UserPreferences {
  themeMode: 'light' | 'dark' | 'high-contrast';
  notifications: boolean;
  emailUpdates: boolean;
  autoSave: boolean;
  highContrastMode: boolean;
  fontSize: number;
  keyboardNavigation: boolean;
}

/**
 * Settings page component that provides user interface for managing application preferences,
 * theme settings, workspace configurations, and notification preferences.
 * Implements WCAG 2.1 Level AA compliance and real-time persistence.
 */
const Settings: React.FC<SettingsProps> = ({ className }) => {
  const { theme, mode, setThemePreference } = useTheme();
  const { user, updateUserPreferences } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    themeMode: mode,
    notifications: true,
    emailUpdates: true,
    autoSave: true,
    highContrastMode: false,
    fontSize: 16,
    keyboardNavigation: true
  });

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (user) {
        setLoading(true);
        try {
          // Load preferences from user profile
          const userPrefs = user.preferences;
          if (userPrefs) {
            setPreferences(prev => ({
              ...prev,
              ...userPrefs
            }));
          }
        } catch (error) {
          console.error('Failed to load preferences:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadPreferences();
  }, [user]);

  // Debounced preference update handler
  const debouncedUpdate = useCallback(
    debounce(async (key: string, value: any) => {
      try {
        await updateUserPreferences({ [key]: value });
      } catch (error) {
        console.error('Failed to update preference:', error);
      }
    }, 500),
    [updateUserPreferences]
  );

  // Theme change handler
  const handleThemeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const isDark = event.target.checked;
    const newMode = isDark ? 'dark' : 'light';
    setThemePreference(newMode);
    setPreferences(prev => ({
      ...prev,
      themeMode: newMode
    }));
    debouncedUpdate('themeMode', newMode);
  }, [setThemePreference, debouncedUpdate]);

  // High contrast mode handler
  const handleHighContrastChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const isHighContrast = event.target.checked;
    setThemePreference(isHighContrast ? 'high-contrast' : preferences.themeMode);
    setPreferences(prev => ({
      ...prev,
      highContrastMode: isHighContrast
    }));
    debouncedUpdate('highContrastMode', isHighContrast);
  }, [setThemePreference, preferences.themeMode, debouncedUpdate]);

  // Generic preference change handler
  const handlePreferenceChange = useCallback((key: keyof UserPreferences) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.checked;
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    debouncedUpdate(key, value);
  }, [debouncedUpdate]);

  if (loading) {
    return <Skeleton variant="rectangular" height={400} />;
  }

  return (
    <Stack spacing={3} className={className}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      {/* Theme Settings */}
      <Card elevation={1}>
        <Typography variant="h6" gutterBottom>
          Theme & Appearance
        </Typography>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={handleThemeChange}
                inputProps={{
                  'aria-label': 'Toggle dark mode',
                  role: 'switch'
                }}
              />
            }
            label="Dark Mode"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.highContrastMode}
                onChange={handleHighContrastChange}
                inputProps={{
                  'aria-label': 'Toggle high contrast mode',
                  role: 'switch'
                }}
              />
            }
            label="High Contrast Mode"
          />
        </Stack>
      </Card>

      {/* Notification Settings */}
      <Card elevation={1}>
        <Typography variant="h6" gutterBottom>
          Notifications
        </Typography>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.notifications}
                onChange={handlePreferenceChange('notifications')}
                inputProps={{
                  'aria-label': 'Toggle notifications',
                  role: 'switch'
                }}
              />
            }
            label="Enable Notifications"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.emailUpdates}
                onChange={handlePreferenceChange('emailUpdates')}
                inputProps={{
                  'aria-label': 'Toggle email updates',
                  role: 'switch'
                }}
              />
            }
            label="Email Updates"
          />
        </Stack>
      </Card>

      {/* Workspace Settings */}
      <Card elevation={1}>
        <Typography variant="h6" gutterBottom>
          Workspace Preferences
        </Typography>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.autoSave}
                onChange={handlePreferenceChange('autoSave')}
                inputProps={{
                  'aria-label': 'Toggle auto-save',
                  role: 'switch'
                }}
              />
            }
            label="Auto-save Changes"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.keyboardNavigation}
                onChange={handlePreferenceChange('keyboardNavigation')}
                inputProps={{
                  'aria-label': 'Toggle keyboard navigation',
                  role: 'switch'
                }}
              />
            }
            label="Enhanced Keyboard Navigation"
          />
        </Stack>
      </Card>

      {/* Feature Flags */}
      {appConfig.features.enableAnalytics && (
        <Box>
          <Divider />
          <Typography variant="caption" color="textSecondary">
            Analytics and feature tracking are enabled for this workspace
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default Settings;