/**
 * Central index file for managing and exporting all application image assets
 * Supports theme variants (light/dark) and responsive sizes
 * @version 1.0.0
 */

// Base path for all image assets
export const IMAGE_BASE_PATH = '/assets/images';

// Theme mode enum for type safety
export enum ThemeMode {
  Light = 'light',
  Dark = 'dark'
}

// Interface for image path generation options
export interface ImagePathOptions {
  theme?: ThemeMode;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Utility function to generate full image path with theme and size support
 * @param imageName - Base name of the image file
 * @param options - Optional theme and size configuration
 * @returns Full path to the requested image
 */
export const getImagePath = (imageName: string, options: ImagePathOptions = {}): string => {
  if (!imageName) {
    throw new Error('Image name is required');
  }

  const { theme, size } = options;
  let path = `${IMAGE_BASE_PATH}/${imageName}`;

  // Apply theme-specific path if theme variant exists
  if (theme) {
    path = `${path}-${theme}`;
  }

  // Apply size-specific suffix if size variant exists
  if (size) {
    path = `${path}-${size}`;
  }

  return `${path}.png`;
};

/**
 * Application logo assets with theme and size variants
 */
export const appLogo = {
  light: getImagePath('logo', { theme: ThemeMode.Light }),
  dark: getImagePath('logo', { theme: ThemeMode.Dark }),
  small: getImagePath('logo', { size: 'small' })
};

/**
 * Prompt creation illustration with responsive variants
 */
export const promptIllustration = {
  default: getImagePath('prompt-illustration'),
  small: getImagePath('prompt-illustration', { size: 'small' }),
  medium: getImagePath('prompt-illustration', { size: 'medium' }),
  large: getImagePath('prompt-illustration', { size: 'large' })
};

/**
 * Empty state and error illustrations with theme support
 */
export const emptyState = {
  noResults: getImagePath('empty-search'),
  noPrompts: getImagePath('empty-prompts'),
  error: getImagePath('error'),
  light: {
    noData: getImagePath('empty-data', { theme: ThemeMode.Light }),
    noAccess: getImagePath('no-access', { theme: ThemeMode.Light })
  },
  dark: {
    noData: getImagePath('empty-data', { theme: ThemeMode.Dark }),
    noAccess: getImagePath('no-access', { theme: ThemeMode.Dark })
  }
};

/**
 * Onboarding and tutorial illustrations with responsive variants
 */
export const onboarding = {
  welcome: getImagePath('onboarding-welcome'),
  features: getImagePath('onboarding-features'),
  getStarted: getImagePath('onboarding-start'),
  responsive: {
    small: getImagePath('onboarding-welcome', { size: 'small' }),
    medium: getImagePath('onboarding-welcome', { size: 'medium' }),
    large: getImagePath('onboarding-welcome', { size: 'large' })
  }
};