import { createTheme, ThemeOptions } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { createCustomTheme } from '../config/theme.config';

// Global constants
const SPACING_UNIT = 8;
const TRANSITION_DURATION = '0.3s';
const HIGH_CONTRAST_RATIO = 7;
const FLUID_TYPOGRAPHY_SCALE = 1.2;

// Theme mode type
type ThemeMode = 'light' | 'dark' | 'high-contrast';

/**
 * Creates an enhanced Material UI theme with accessibility and responsive features
 * @param mode - Theme mode ('light' | 'dark' | 'high-contrast')
 * @param options - Optional theme customization options
 * @returns Enhanced Material UI theme object
 */
const createEnhancedTheme = (mode: ThemeMode, options: Partial<ThemeOptions> = {}) => {
  // Base theme configuration
  const baseTheme = createCustomTheme(mode === 'high-contrast' ? 'light' : mode, {
    ...options,
    palette: {
      ...(mode === 'light' ? {
        primary: {
          main: '#2196F3',
          light: '#64B5F6',
          dark: '#1976D2',
          contrastText: '#FFFFFF',
        },
        secondary: {
          main: '#FF4081',
          light: '#FF80AB',
          dark: '#F50057',
          contrastText: '#FFFFFF',
        },
        background: {
          default: '#FFFFFF',
          paper: '#F5F5F5',
          surface: '#FAFAFA',
        },
        text: {
          primary: 'rgba(0, 0, 0, 0.87)',
          secondary: 'rgba(0, 0, 0, 0.6)',
        },
      } : {
        primary: {
          main: '#90CAF9',
          light: '#BBDEFB',
          dark: '#42A5F5',
          contrastText: 'rgba(0, 0, 0, 0.87)',
        },
        secondary: {
          main: '#FF80AB',
          light: '#FF4081',
          dark: '#F50057',
          contrastText: 'rgba(0, 0, 0, 0.87)',
        },
        background: {
          default: '#121212',
          paper: '#1E1E1E',
          surface: '#262626',
        },
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.7)',
        },
      }),
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      fontSize: 16,
      fontWeights: {
        light: 300,
        regular: 400,
        medium: 500,
        bold: 700,
      },
      h1: {
        fontSize: 'clamp(2rem, 5vw, 2.5rem)',
        fontWeight: 700,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: 'clamp(1.75rem, 4vw, 2rem)',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: 'clamp(1.125rem, 2vw, 1.25rem)',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      body1: {
        fontSize: 'clamp(1rem, 2vw, 1.125rem)',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
        lineHeight: 1.5,
      },
    },
    breakpoints: {
      values: {
        xs: 320,
        sm: 768,
        md: 1024,
        lg: 1440,
        xl: 1920,
      },
    },
    spacing: SPACING_UNIT,
    transitions: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },
  });

  // Apply high contrast adjustments if needed
  if (mode === 'high-contrast') {
    return createTheme(baseTheme, {
      palette: {
        primary: {
          main: '#000000',
          contrastText: '#FFFFFF',
        },
        secondary: {
          main: '#FFFFFF',
          contrastText: '#000000',
        },
        background: {
          default: '#FFFFFF',
          paper: '#FFFFFF',
          surface: '#FFFFFF',
        },
        text: {
          primary: '#000000',
          secondary: '#000000',
        },
      },
      typography: {
        ...baseTheme.typography,
        body1: {
          ...baseTheme.typography.body1,
          fontWeight: 500,
        },
        body2: {
          ...baseTheme.typography.body2,
          fontWeight: 500,
        },
      },
    });
  }

  return baseTheme;
};

// Create theme instances
export const theme = createEnhancedTheme('light');
export const darkTheme = createEnhancedTheme('dark');
export const highContrastTheme = createEnhancedTheme('high-contrast');

// Styled components with theme-aware styles
export const StyledContainer = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(4),
  },
}));

export const StyledPaper = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(2),
  transition: theme.transitions.create(['background-color', 'box-shadow']),
}));

// Export theme configuration
export { createEnhancedTheme };
export type { ThemeMode };