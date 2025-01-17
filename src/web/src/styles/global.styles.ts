import { createGlobalStyle, css } from 'styled-components'; // v5.3.0
import { typography, breakpoints, colors } from './theme.styles';

// CSS Reset and Accessibility Base Styles
const resetStyles = css`
  /* Box sizing rules */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Remove default margin and padding */
  html,
  body {
    margin: 0;
    padding: 0;
  }

  /* Set core root defaults */
  html {
    font-size: 16px;
    scroll-behavior: smooth;
    color-scheme: light dark;
  }

  /* Set core body defaults */
  body {
    min-height: 100vh;
    text-rendering: optimizeSpeed;
    line-height: 1.5;
    font-family: ${typography.fontFamily};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Remove list styles */
  ul,
  ol {
    list-style: none;
  }

  /* Remove default link styles */
  a {
    text-decoration: none;
    color: inherit;
  }

  /* Make images easier to work with */
  img,
  picture {
    max-width: 100%;
    display: block;
  }

  /* Inherit fonts for inputs and buttons */
  input,
  button,
  textarea,
  select {
    font: inherit;
  }

  /* Remove all animations and transitions for people that prefer not to see them */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

// Material Design 3.0 Base Styles
const baseStyles = css`
  /* Material Design Typography */
  h1 {
    font-size: clamp(2rem, 5vw, 2.5rem);
    font-weight: ${typography.fontWeights.bold};
    line-height: 1.2;
    margin-bottom: ${8 * 3}px;
  }

  h2 {
    font-size: clamp(1.75rem, 4vw, 2rem);
    font-weight: ${typography.fontWeights.bold};
    line-height: 1.3;
    margin-bottom: ${8 * 2}px;
  }

  h3 {
    font-size: clamp(1.5rem, 3vw, 1.75rem);
    font-weight: ${typography.fontWeights.medium};
    line-height: 1.4;
    margin-bottom: ${8 * 2}px;
  }

  h4 {
    font-size: clamp(1.25rem, 2.5vw, 1.5rem);
    font-weight: ${typography.fontWeights.medium};
    line-height: 1.4;
    margin-bottom: ${8 * 1.5}px;
  }

  h5 {
    font-size: clamp(1.125rem, 2vw, 1.25rem);
    font-weight: ${typography.fontWeights.medium};
    line-height: 1.4;
    margin-bottom: ${8}px;
  }

  h6 {
    font-size: clamp(1rem, 1.5vw, 1.125rem);
    font-weight: ${typography.fontWeights.medium};
    line-height: 1.4;
    margin-bottom: ${8}px;
  }

  /* Material Design Spacing */
  p {
    margin-bottom: ${8 * 2}px;
  }

  /* Responsive breakpoints */
  @media (min-width: ${breakpoints.values.xs}px) {
    body {
      font-size: clamp(14px, 2vw, 16px);
    }
  }

  @media (min-width: ${breakpoints.values.sm}px) {
    body {
      font-size: 16px;
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: more) {
    :root {
      --text-primary: #000000;
      --text-secondary: #000000;
      --background-primary: #FFFFFF;
      --background-secondary: #FFFFFF;
    }
  }
`;

// Accessibility Enhancements
const accessibilityStyles = css`
  /* Skip to main content link */
  .skip-link {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    &:focus {
      position: fixed;
      top: ${8}px;
      left: ${8}px;
      width: auto;
      height: auto;
      padding: ${8}px ${8 * 2}px;
      clip: auto;
      z-index: 100000;
      background: ${colors.primary.main};
      color: ${colors.primary.contrastText};
      text-decoration: none;
      border-radius: ${4}px;
    }
  }

  /* Focus styles */
  :focus-visible {
    outline: 2px solid ${colors.primary.main};
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.1);
  }

  /* Screen reader only text */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;

const GlobalStyles = createGlobalStyle`
  ${resetStyles}
  ${baseStyles}
  ${accessibilityStyles}
`;

export default GlobalStyles;