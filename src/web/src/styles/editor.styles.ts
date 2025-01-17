import styled, { css } from 'styled-components'; // v5.3.0
import { getSpacing, getBreakpoint } from './theme.styles';

// Constants for editor sizing and layout
const EDITOR_SIZES = {
  min_height: '400px',
  preview_width: 'clamp(320px, 45%, 600px)',
  toolbar_height: '48px',
  variable_panel_height: 'clamp(120px, 20vh, 200px)'
} as const;

const TRANSITION_DURATION = '0.3s';

const BREAKPOINTS = {
  xs: '320px',
  sm: '768px',
  md: '1024px',
  lg: '1440px'
} as const;

// Dynamic height calculation utility
const getEditorHeight = (contentLength: number, viewportHeight: number): string => {
  const baseHeight = Math.max(viewportHeight * 0.6, parseInt(EDITOR_SIZES.min_height));
  const contentMultiplier = Math.min(contentLength / 500, 2);
  return `clamp(${EDITOR_SIZES.min_height}, ${baseHeight * contentMultiplier}px, 80vh)`;
};

// Responsive spacing utility
const getResponsiveSpacing = (baseSpacing: number): string => {
  return `clamp(${baseSpacing * 0.75}px, ${baseSpacing}px, ${baseSpacing * 1.25}px)`;
};

// Main editor container
export const EditorContainer = styled.div<{ isFullscreen: boolean; contentLength: number }>`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: ${({ isFullscreen }) => isFullscreen ? '100vh' : 'auto'};
  min-height: ${({ contentLength }) => getEditorHeight(contentLength, window.innerHeight)};
  background-color: ${({ theme }) => theme.palette.background.default};
  transition: all ${TRANSITION_DURATION} ${theme.transitions.easing.easeInOut};
  position: relative;
  overflow: hidden;
  border-radius: ${({ isFullscreen }) => isFullscreen ? '0' : getResponsiveSpacing(8)};
  box-shadow: ${({ theme }) => theme.shadows[4]};

  @media (max-width: ${BREAKPOINTS.sm}) {
    border-radius: 0;
    height: 100vh;
  }
`;

// Editor toolbar
export const EditorToolbar = styled.div<{ isSticky: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: ${EDITOR_SIZES.toolbar_height};
  padding: ${getResponsiveSpacing(8)} ${getResponsiveSpacing(16)};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  position: ${({ isSticky }) => isSticky ? 'sticky' : 'relative'};
  top: 0;
  z-index: 10;
  transition: all ${TRANSITION_DURATION};

  @media (max-width: ${BREAKPOINTS.sm}) {
    padding: ${getResponsiveSpacing(8)};
  }
`;

// Main editor content area
export const EditorContent = styled.div<{ fontSize: string }>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${getResponsiveSpacing(16)};
  padding: ${getResponsiveSpacing(16)};
  font-size: ${({ fontSize }) => fontSize};
  line-height: 1.6;
  overflow: auto;
  
  @media (max-width: ${BREAKPOINTS.md}) {
    grid-template-columns: 1fr;
    padding: ${getResponsiveSpacing(8)};
  }

  * {
    font-family: ${({ theme }) => theme.typography.fontFamily};
  }

  &:focus-within {
    background-color: ${({ theme }) => theme.palette.background.paper};
  }
`;

// Preview panel
export const PreviewPanel = styled.div<{ isVisible: boolean; width: string }>`
  width: ${({ width }) => width || EDITOR_SIZES.preview_width};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-left: 1px solid ${({ theme }) => theme.palette.divider};
  padding: ${getResponsiveSpacing(16)};
  overflow: auto;
  transition: all ${TRANSITION_DURATION};
  opacity: ${({ isVisible }) => isVisible ? 1 : 0};
  visibility: ${({ isVisible }) => isVisible ? 'visible' : 'hidden'};
  transform: translateX(${({ isVisible }) => isVisible ? 0 : '100%'});

  @media (max-width: ${BREAKPOINTS.md}) {
    position: fixed;
    right: 0;
    top: ${EDITOR_SIZES.toolbar_height};
    bottom: 0;
    width: min(${EDITOR_SIZES.preview_width}, 100%);
    border-left: 1px solid ${({ theme }) => theme.palette.divider};
    box-shadow: ${({ theme }) => theme.shadows[8]};
  }
`;

// Variable management panel
export const VariablePanel = styled.div<{ isCollapsed: boolean }>`
  height: ${({ isCollapsed }) => isCollapsed ? '48px' : EDITOR_SIZES.variable_panel_height};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-top: 1px solid ${({ theme }) => theme.palette.divider};
  padding: ${getResponsiveSpacing(8)} ${getResponsiveSpacing(16)};
  overflow: hidden;
  transition: height ${TRANSITION_DURATION} ${theme.transitions.easing.easeInOut};

  @media (max-width: ${BREAKPOINTS.sm}) {
    padding: ${getResponsiveSpacing(8)};
    height: ${({ isCollapsed }) => isCollapsed ? '48px' : '50vh'};
  }
`;