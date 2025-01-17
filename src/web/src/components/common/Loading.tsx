import React from 'react'; // v18.0.0
import styled from 'styled-components'; // v5.3.0
import { CircularProgress } from '@mui/material'; // v5.14.0
import { theme } from '../../styles/theme.styles';

// Size mapping following 8px grid system
const sizeMap = {
  small: 24,
  medium: 40,
  large: 56
} as const;

interface LoadingProps {
  /**
   * Size of the loading spinner
   * @default 'medium'
   */
  size?: keyof typeof sizeMap;
  /**
   * Color theme of the spinner
   * @default 'primary'
   */
  color?: 'primary' | 'secondary' | string;
  /**
   * Whether to show spinner with overlay
   * @default false
   */
  overlay?: boolean;
  /**
   * Accessibility label for screen readers
   * @default 'Loading'
   */
  ariaLabel?: string;
}

const LoadingContainer = styled.div<{ overlay?: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${props => props.overlay ? '100%' : 'auto'};
  height: ${props => props.overlay ? '100%' : 'auto'};
  position: ${props => props.overlay ? 'fixed' : 'relative'};
  top: 0;
  left: 0;
  background: ${props => props.overlay ? 'rgba(0, 0, 0, 0.5)' : 'transparent'};
  z-index: 9999;
  transition: ${theme.transitions.create(['background'])};
`;

const StyledCircularProgress = styled(CircularProgress)<{ size: keyof typeof sizeMap; color: string }>`
  && {
    width: ${props => sizeMap[props.size]}px;
    height: ${props => sizeMap[props.size]}px;
    color: ${props => 
      props.color === 'primary' ? theme.palette.primary.main :
      props.color === 'secondary' ? theme.palette.secondary.main :
      props.color
    };
    transition: ${theme.transitions.create(['transform', 'color'])};

    @media (prefers-reduced-motion: reduce) {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

/**
 * Loading spinner component with accessibility and theme support
 * @param props - Loading component props
 * @returns Loading spinner with optional overlay
 */
const Loading: React.FC<LoadingProps> = React.memo(({
  size = 'medium',
  color = 'primary',
  overlay = false,
  ariaLabel = 'Loading'
}) => {
  // Handle body scroll lock when overlay is active
  React.useEffect(() => {
    if (overlay) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [overlay]);

  return (
    <LoadingContainer 
      overlay={overlay}
      role="progressbar"
      aria-label={ariaLabel}
      data-testid="loading-container"
    >
      <StyledCircularProgress
        size={size}
        color={color}
        data-testid="loading-spinner"
        aria-busy="true"
      />
    </LoadingContainer>
  );
});

Loading.displayName = 'Loading';

export default Loading;