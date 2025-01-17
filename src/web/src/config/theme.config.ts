import { createTheme, ThemeOptions } from '@mui/material';

// Constants
const SPACING_UNIT = 8;
const TRANSITION_DURATION = '0.3s';

// Theme mode type
type ThemeMode = 'light' | 'dark';

// Default palette configurations
const lightPalette = {
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
  error: {
    main: '#F44336',
    light: '#E57373',
    dark: '#D32F2F',
  },
  warning: {
    main: '#FFA726',
    light: '#FFB74D',
    dark: '#F57C00',
  },
  success: {
    main: '#66BB6A',
    light: '#81C784',
    dark: '#388E3C',
  },
  info: {
    main: '#29B6F6',
    light: '#4FC3F7',
    dark: '#0288D1',
  },
  background: {
    default: '#FFFFFF',
    paper: '#F5F5F5',
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
  },
};

const darkPalette = {
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
  error: {
    main: '#EF5350',
    light: '#E57373',
    dark: '#D32F2F',
  },
  warning: {
    main: '#FFB74D',
    light: '#FFA726',
    dark: '#F57C00',
  },
  success: {
    main: '#81C784',
    light: '#A5D6A7',
    dark: '#388E3C',
  },
  info: {
    main: '#4FC3F7',
    light: '#81D4FA',
    dark: '#0288D1',
  },
  background: {
    default: '#121212',
    paper: '#1E1E1E',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
  },
};

// Typography configuration
const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: 16,
  fontWeights: {
    light: 300,
    regular: 400,
    medium: 500,
    bold: 700,
  },
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.3,
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
};

// Breakpoint configuration
const breakpoints = {
  values: {
    xs: 320,
    sm: 768,
    md: 1024,
    lg: 1440,
    xl: 1920,
  },
};

// Transition configuration
const transitions = {
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
};

/**
 * Creates a customized Material UI theme with application-specific settings
 * @param mode - Theme mode ('light' | 'dark')
 * @param options - Optional theme customization options
 * @returns Material UI theme object with custom configurations
 */
const createCustomTheme = (mode: ThemeMode, options: Partial<ThemeOptions> = {}) => {
  const baseTheme = {
    palette: mode === 'light' ? lightPalette : darkPalette,
    typography,
    breakpoints,
    spacing: SPACING_UNIT,
    transitions,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
          },
          html: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            height: '100%',
            width: '100%',
          },
          body: {
            height: '100%',
            width: '100%',
          },
          '#root': {
            height: '100%',
            width: '100%',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: SPACING_UNIT,
            transition: `all ${TRANSITION_DURATION}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            transition: `all ${TRANSITION_DURATION}`,
          },
        },
      },
    },
  };

  return createTheme(baseTheme, options);
};

// Export theme configuration and utilities
export const themeConfig = {
  palette: {
    light: lightPalette,
    dark: darkPalette,
  },
  typography,
  breakpoints,
  createCustomTheme,
};