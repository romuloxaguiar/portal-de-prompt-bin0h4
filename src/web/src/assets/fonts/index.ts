/**
 * @fileoverview Font assets and configurations for the application's typography system
 * Implements Material Design 3.0 font standards with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

// Font file paths for Inter font family (WOFF2 format for optimal performance)
export const InterLight = '/assets/fonts/Inter-Light.woff2';
export const InterRegular = '/assets/fonts/Inter-Regular.woff2';
export const InterRegularItalic = '/assets/fonts/Inter-RegularItalic.woff2';
export const InterMedium = '/assets/fonts/Inter-Medium.woff2';
export const InterSemiBold = '/assets/fonts/Inter-SemiBold.woff2';
export const InterBold = '/assets/fonts/Inter-Bold.woff2';

/**
 * Standardized font weights following Material Design 3.0 typography guidelines
 * Ensures consistent visual hierarchy and readability across the application
 */
export const fontWeights = {
  light: 300,     // Subtle and decorative text
  regular: 400,   // Primary body text
  medium: 500,    // Emphasized content
  semibold: 600,  // Strong emphasis
  bold: 700       // Primary headings
} as const;

/**
 * Font style constants for consistent typography styling
 * Supports both normal and italic text variations
 */
export const fontStyles = {
  normal: 'normal',
  italic: 'italic'
} as const;

/**
 * Type definitions for font weights to ensure type safety
 */
export type FontWeight = typeof fontWeights[keyof typeof fontWeights];

/**
 * Type definitions for font styles to ensure type safety
 */
export type FontStyle = typeof fontStyles[keyof typeof fontStyles];

/**
 * Font configuration object for Material Design 3.0 typography scale
 * Base size: 16px (1rem) for optimal readability
 */
export const fontConfig = {
  family: {
    primary: 'Inter, system-ui, -apple-system, sans-serif',
    fallback: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif'
  },
  baseSize: '16px',
  scaleRatio: 1.2, // Perfect fourth scale for harmonious typography
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em'
  }
} as const;

/**
 * Font loading configuration for optimal performance
 * Implements font-display: swap for faster initial render
 */
export const fontLoadingConfig = {
  display: 'swap',
  unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  formats: ['woff2']
} as const;