/// <reference types="vite/client" />

/**
 * Type definition for imported image assets
 * Used for static asset imports in the web application
 */
interface ImageAsset {
  src: string;
  width: number;
  height: number;
}

/**
 * Type augmentation for Vite's ImportMetaEnv
 * Provides type definitions for environment variables used in the application
 */
interface ImportMetaEnv {
  /**
   * Base URL for API endpoints
   */
  readonly VITE_API_URL: string;

  /**
   * WebSocket server URL for real-time features
   */
  readonly VITE_WS_URL: string;

  /**
   * OAuth 2.0 client identifier
   */
  readonly VITE_OAUTH_CLIENT_ID: string;

  /**
   * OAuth 2.0 redirect URI after authentication
   */
  readonly VITE_OAUTH_REDIRECT_URI: string;

  /**
   * Google Analytics tracking identifier
   */
  readonly VITE_GA_TRACKING_ID: string;
}

/**
 * Type augmentation for Vite's ImportMeta interface
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Type declarations for various static asset imports
 */
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: ImageAsset;
  export default content;
}

declare module '*.jpg' {
  const content: ImageAsset;
  export default content;
}

declare module '*.jpeg' {
  const content: ImageAsset;
  export default content;
}

declare module '*.gif' {
  const content: ImageAsset;
  export default content;
}

declare module '*.webp' {
  const content: ImageAsset;
  export default content;
}