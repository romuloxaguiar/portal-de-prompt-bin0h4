import { useCallback, useEffect, useState } from 'react'; // v18.0.0
import { useMediaQuery } from '@mui/material'; // v5.14.0
import { createCustomTheme } from '../config/theme.config';
import { StorageKeys, getItem, setItem } from '../utils/storage.util';

// Theme mode type definitions
type ThemeMode = 'light' | 'dark' | 'high-contrast';
type ThemePreference = 'system' | ThemeMode;

/**
 * Custom hook for managing application theme state, preferences, and accessibility modes
 * with system preference detection and persistence.
 * 
 * Features:
 * - System theme preference detection and monitoring
 * - Theme persistence across sessions
 * - High contrast mode support for accessibility
 * - Material Design 3.0 integration
 * - Smooth theme transitions
 */
export const useTheme = () => {
  // Initialize theme preference state
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [mode, setMode] = useState<ThemeMode>('light');

  // System preference detection using media query
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', {
    noSsr: true
  });

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedPreference = await getItem<ThemePreference>(StorageKeys.THEME);
        if (savedPreference) {
          setPreference(savedPreference);
          if (savedPreference !== 'system') {
            setMode(savedPreference);
          }
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };

    loadThemePreference();
  }, []);

  // Monitor system theme preference changes
  useEffect(() => {
    if (preference === 'system') {
      setMode(prefersDarkMode ? 'dark' : 'light');
    }
  }, [prefersDarkMode, preference]);

  // Create theme object based on current mode
  const theme = createCustomTheme(mode === 'high-contrast' ? 'dark' : mode, {
    palette: mode === 'high-contrast' ? {
      // High contrast mode overrides
      primary: {
        main: '#FFFFFF',
        contrastText: '#000000',
      },
      background: {
        default: '#000000',
        paper: '#000000',
      },
      text: {
        primary: '#FFFFFF',
        secondary: '#FFFFFF',
      },
      action: {
        active: '#FFFFFF',
        hover: 'rgba(255, 255, 255, 0.2)',
      },
    } : undefined,
    components: mode === 'high-contrast' ? {
      MuiButton: {
        styleOverrides: {
          root: {
            border: '2px solid #FFFFFF',
            '&:focus': {
              outline: '3px solid #FFFFFF',
              outlineOffset: '2px',
            },
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            textDecoration: 'underline',
            '&:focus': {
              outline: '3px solid #FFFFFF',
              outlineOffset: '2px',
            },
          },
        },
      },
    } : undefined,
  });

  // Theme preference update handler with persistence
  const setThemePreference = useCallback(async (newPreference: ThemePreference) => {
    try {
      await setItem(StorageKeys.THEME, newPreference);
      setPreference(newPreference);
      if (newPreference !== 'system') {
        setMode(newPreference);
      } else {
        setMode(prefersDarkMode ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, [prefersDarkMode]);

  // Theme toggle handler for cycling through modes
  const toggleTheme = useCallback(() => {
    const modes: ThemeMode[] = ['light', 'dark', 'high-contrast'];
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setThemePreference(nextMode);
  }, [mode, setThemePreference]);

  return {
    theme,
    mode,
    preference,
    setThemePreference,
    toggleTheme,
    isHighContrast: mode === 'high-contrast',
  };
};

export type { ThemeMode, ThemePreference };