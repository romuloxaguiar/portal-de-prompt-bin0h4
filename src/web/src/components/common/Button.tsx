import React from 'react';
import { ButtonProps as MuiButtonProps } from '@mui/material';
import { StyledButton } from '../../styles/components.styles';
import { theme } from '../../styles/theme.styles';

interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  role?: string;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}

const Button = React.memo(({
  variant = 'contained',
  size = 'medium',
  disabled = false,
  loading = false,
  ariaLabel,
  role = 'button',
  fullWidth = false,
  startIcon,
  endIcon,
  onClick,
  children,
  ...props
}: ButtonProps): JSX.Element => {
  // Handle reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Handle loading state with ARIA
  const buttonProps = {
    'aria-busy': loading,
    'aria-disabled': disabled || loading,
    'aria-label': ariaLabel,
    role,
    disabled: disabled || loading,
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading && onClick) {
        onClick(e);
      }
    },
    style: {
      width: fullWidth ? '100%' : 'auto',
      transition: prefersReducedMotion ? 'none' : theme.transitions.create(['background-color', 'box-shadow', 'transform']),
    },
    ...props,
  };

  // Loading spinner styles
  const spinnerStyles = {
    width: '20px',
    height: '20px',
    marginRight: theme.spacing(1),
    color: 'inherit',
  };

  return (
    <StyledButton
      variant={variant}
      size={size}
      {...buttonProps}
      css={`
        min-width: ${size === 'small' ? '64px' : '80px'};
        min-height: ${size === 'small' ? '32px' : size === 'large' ? '48px' : '40px'};
        padding: ${size === 'small' ? '4px 8px' : size === 'large' ? '16px 24px' : '8px 16px'};
        font-size: ${size === 'small' ? '0.875rem' : size === 'large' ? '1.125rem' : '1rem'};
        
        /* High contrast mode support */
        @media (forced-colors: active) {
          border: 2px solid currentColor;
        }
        
        /* Focus visible styles */
        &:focus-visible {
          outline: 3px solid ${theme.palette.primary.main};
          outline-offset: 2px;
        }
        
        /* Touch target size */
        @media (pointer: coarse) {
          &::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 44px;
            height: 44px;
          }
        }
      `}
    >
      {loading && (
        <svg
          style={spinnerStyles}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="32"
            strokeDashoffset="32"
            css={`
              animation: ${prefersReducedMotion ? 'none' : 'spin 1s linear infinite'};
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}
          />
        </svg>
      )}
      {!loading && startIcon && (
        <span
          aria-hidden="true"
          style={{ marginRight: theme.spacing(1) }}
        >
          {startIcon}
        </span>
      )}
      {children}
      {!loading && endIcon && (
        <span
          aria-hidden="true"
          style={{ marginLeft: theme.spacing(1) }}
        >
          {endIcon}
        </span>
      )}
    </StyledButton>
  );
});

Button.displayName = 'Button';

export default Button;