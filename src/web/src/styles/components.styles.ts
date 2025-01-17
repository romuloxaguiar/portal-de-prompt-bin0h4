import styled, { css } from 'styled-components'; // v5.3.0
import { getSpacing, breakpoints, palette, typography } from './theme.styles';

// Button size configurations with touch targets
const BUTTON_SIZES = {
  small: {
    padding: '8px 16px',
    fontSize: '14px',
    minHeight: '44px',
    touchTarget: '48px'
  },
  medium: {
    padding: '12px 24px',
    fontSize: '16px',
    minHeight: '48px',
    touchTarget: '48px'
  },
  large: {
    padding: '16px 32px',
    fontSize: '18px',
    minHeight: '56px',
    touchTarget: '56px'
  }
} as const;

// Elevation levels with high contrast support
const ELEVATION_LEVELS = {
  1: '0 2px 4px rgba(0,0,0,0.2)',
  2: '0 4px 8px rgba(0,0,0,0.2)',
  3: '0 8px 16px rgba(0,0,0,0.2)',
  highContrast: {
    1: '0 2px 4px rgba(0,0,0,0.4)',
    2: '0 4px 8px rgba(0,0,0,0.4)',
    3: '0 8px 16px rgba(0,0,0,0.4)'
  }
} as const;

// Helper function for generating button styles
const getButtonStyles = (variant: string, size: string, highContrast: boolean) => css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${BUTTON_SIZES[size as keyof typeof BUTTON_SIZES].touchTarget};
  min-height: ${BUTTON_SIZES[size as keyof typeof BUTTON_SIZES].minHeight};
  padding: ${BUTTON_SIZES[size as keyof typeof BUTTON_SIZES].padding};
  font-size: ${BUTTON_SIZES[size as keyof typeof BUTTON_SIZES].fontSize};
  font-family: ${typography.fontFamily};
  font-weight: ${typography.fontWeights.medium};
  line-height: 1.5;
  border-radius: ${getSpacing(1)}px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  
  /* Variant styles */
  ${variant === 'primary' && css`
    background-color: ${highContrast ? '#000000' : palette.primary.main};
    color: ${highContrast ? '#FFFFFF' : palette.primary.contrastText};
  `}
  
  ${variant === 'secondary' && css`
    background-color: ${highContrast ? '#FFFFFF' : palette.secondary.main};
    color: ${highContrast ? '#000000' : palette.secondary.contrastText};
  `}
  
  /* Accessibility and interaction states */
  &:focus-visible {
    outline: 3px solid ${highContrast ? '#000000' : palette.primary.main};
    outline-offset: 2px;
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${highContrast ? ELEVATION_LEVELS.highContrast[1] : ELEVATION_LEVELS[1]};
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  /* Touch target for mobile */
  @media (pointer: coarse) {
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${BUTTON_SIZES[size as keyof typeof BUTTON_SIZES].touchTarget};
      height: ${BUTTON_SIZES[size as keyof typeof BUTTON_SIZES].touchTarget};
    }
  }
`;

// Helper function for elevation styles
const getElevation = (level: number, highContrast: boolean) => {
  const elevationLevel = Math.min(Math.max(level, 1), 3) as 1 | 2 | 3;
  return highContrast ? ELEVATION_LEVELS.highContrast[elevationLevel] : ELEVATION_LEVELS[elevationLevel];
};

// Styled Button Component
export const StyledButton = styled.button<{
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  highContrast?: boolean;
}>`
  ${({ variant = 'primary', size = 'medium', highContrast = false }) => 
    getButtonStyles(variant, size, highContrast)}
`;

// Styled Card Component
export const StyledCard = styled.div<{
  elevation?: number;
  interactive?: boolean;
}>`
  position: relative;
  padding: ${getSpacing(3)}px;
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${getSpacing(2)}px;
  box-shadow: ${({ elevation = 1, theme }) => 
    getElevation(elevation, theme.palette.mode === 'high-contrast')};
  transition: all 0.2s ease-in-out;
  
  ${({ interactive }) => interactive && css`
    cursor: pointer;
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${({ theme }) => 
        getElevation(2, theme.palette.mode === 'high-contrast')};
    }
  `}
  
  @media ${breakpoints.up('sm')} {
    padding: ${getSpacing(4)}px;
  }
`;

// Styled Input Component
export const StyledInput = styled.input<{
  variant?: 'outlined' | 'filled';
  error?: boolean;
  labelId?: string;
}>`
  width: 100%;
  min-height: 44px;
  padding: ${getSpacing(2)}px;
  font-family: ${typography.fontFamily};
  font-size: ${typography.body1.fontSize};
  line-height: 1.5;
  border-radius: ${getSpacing(1)}px;
  border: 2px solid ${({ error, theme }) => 
    error ? theme.palette.error.main : theme.palette.mode === 'high-contrast' 
      ? '#000000' 
      : theme.palette.grey[300]};
  background-color: ${({ theme }) => theme.palette.background.paper};
  color: ${({ theme }) => theme.palette.text.primary};
  transition: all 0.2s ease-in-out;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => 
      theme.palette.mode === 'high-contrast' ? '#000000' : theme.palette.primary.main};
    box-shadow: 0 0 0 3px ${({ theme }) => 
      theme.palette.mode === 'high-contrast' 
        ? 'rgba(0,0,0,0.2)' 
        : `${theme.palette.primary.main}33`};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  ${({ variant }) => variant === 'filled' && css`
    background-color: ${({ theme }) => 
      theme.palette.mode === 'high-contrast' 
        ? '#FFFFFF' 
        : theme.palette.grey[100]};
  `}
  
  /* Accessibility */
  &[aria-invalid="true"] {
    border-color: ${({ theme }) => theme.palette.error.main};
  }
`;

// Styled Modal Component
export const StyledModal = styled.div<{
  size?: 'small' | 'medium' | 'large';
  role?: string;
}>`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${getSpacing(2)}px;
  box-shadow: ${({ theme }) => 
    getElevation(3, theme.palette.mode === 'high-contrast')};
  max-height: 90vh;
  overflow-y: auto;
  
  ${({ size = 'medium' }) => {
    const sizes = {
      small: '400px',
      medium: '600px',
      large: '800px'
    };
    return css`
      width: calc(100% - ${getSpacing(4)}px);
      max-width: ${sizes[size]};
    `;
  }}
  
  /* Accessibility */
  &:focus {
    outline: none;
  }
  
  @media ${breakpoints.down('sm')} {
    width: calc(100% - ${getSpacing(2)}px);
    max-height: calc(100% - ${getSpacing(2)}px);
  }
`;