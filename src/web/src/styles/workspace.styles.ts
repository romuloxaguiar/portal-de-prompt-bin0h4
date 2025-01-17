import styled, { css } from 'styled-components'; // v5.3.0
import { theme } from './theme.styles';
import { StyledCard } from './components.styles';

// Global constants for workspace layout
const SIDEBAR_WIDTH = {
  expanded: '280px',
  collapsed: '64px',
  mobile: '100%'
} as const;

const WORKSPACE_HEADER_HEIGHT = {
  desktop: '64px',
  mobile: '56px'
} as const;

const TRANSITION_DURATION = {
  default: '0.3s',
  reducedMotion: '0s'
} as const;

const TOUCH_TARGET_SIZE = '48px';

// Helper function for responsive styles
const getResponsiveStyles = (breakpoint: string, touchEnabled: boolean = false) => css`
  @media (min-width: ${theme.breakpoints.values[breakpoint]}px) {
    ${touchEnabled && css`
      cursor: pointer;
      &::after {
        content: '';
        position: absolute;
        width: ${TOUCH_TARGET_SIZE};
        height: ${TOUCH_TARGET_SIZE};
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
    `}
  }
`;

// Main workspace container
export const WorkspaceContainer = styled.div<{
  isCollapsed?: boolean;
  isRTL?: boolean;
  reducedMotion?: boolean;
}>`
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: ${({ theme }) => theme.palette.background.default};
  direction: ${({ isRTL }) => isRTL ? 'rtl' : 'ltr'};
  transition: ${({ reducedMotion }) => 
    reducedMotion ? 'none' : `all ${TRANSITION_DURATION.default}`};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    flex-direction: column;
  }
`;

// Workspace sidebar
export const WorkspaceSidebar = styled(StyledCard)<{
  width?: number;
  isCollapsed?: boolean;
  touchTargetSize?: number;
}>`
  position: relative;
  flex-shrink: 0;
  width: ${({ isCollapsed }) => 
    isCollapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded};
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1200;
  transition: ${({ theme }) => theme.transitions.create(['width', 'transform'])};
  
  ${({ theme }) => css`
    border-radius: 0;
    border-right: 1px solid ${theme.palette.divider};
    
    ${theme.palette.mode === 'high-contrast' && css`
      border-right: 2px solid ${theme.palette.common.black};
    `}
  `}

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    width: ${SIDEBAR_WIDTH.mobile};
    height: auto;
    border-right: none;
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
    transform: translateY(${({ isCollapsed }) => isCollapsed ? '-100%' : '0'});
  }

  /* Touch optimization */
  @media (pointer: coarse) {
    & > * {
      min-height: ${({ touchTargetSize }) => touchTargetSize || TOUCH_TARGET_SIZE};
    }
  }
`;

// Main content area
export const WorkspaceContent = styled.main<{
  hasMargin?: boolean;
  isVirtualized?: boolean;
}>`
  flex: 1;
  height: 100%;
  overflow-y: ${({ isVirtualized }) => isVirtualized ? 'hidden' : 'auto'};
  overflow-x: hidden;
  padding: ${({ theme }) => theme.spacing(3)}px;
  
  ${({ hasMargin }) => hasMargin && css`
    margin-top: ${WORKSPACE_HEADER_HEIGHT.desktop};
    
    @media (max-width: ${theme.breakpoints.values.sm}px) {
      margin-top: ${WORKSPACE_HEADER_HEIGHT.mobile};
    }
  `}

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => theme.spacing(2)}px;
  }

  /* High contrast mode */
  ${({ theme }) => theme.palette.mode === 'high-contrast' && css`
    border: 2px solid ${theme.palette.common.black};
    border-radius: ${theme.spacing(1)}px;
  `}
`;

// Workspace header
export const WorkspaceHeader = styled.header<{
  isSticky?: boolean;
  showSkeleton?: boolean;
}>`
  display: flex;
  align-items: center;
  height: ${WORKSPACE_HEADER_HEIGHT.desktop};
  padding: ${({ theme }) => theme.spacing(2, 3)};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  
  ${({ isSticky }) => isSticky && css`
    position: sticky;
    top: 0;
    z-index: 1100;
  `}

  ${({ showSkeleton }) => showSkeleton && css`
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        ${({ theme }) => theme.palette.background.paper} 0%,
        ${({ theme }) => theme.palette.action.hover} 50%,
        ${({ theme }) => theme.palette.background.paper} 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `}

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    height: ${WORKSPACE_HEADER_HEIGHT.mobile};
    padding: ${({ theme }) => theme.spacing(1, 2)};
  }

  /* High contrast mode */
  ${({ theme }) => theme.palette.mode === 'high-contrast' && css`
    border-bottom: 2px solid ${theme.palette.common.black};
  `}
`;