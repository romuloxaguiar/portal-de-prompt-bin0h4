import React, { useEffect, useCallback, memo } from 'react';
import styled from 'styled-components';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../../hooks/useNotification';
import { StyledCard } from '../../styles/components.styles';
import { useTheme } from '../../hooks/useTheme';

// Types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type ToastPriority = 'high' | 'medium' | 'low';

export interface ToastAction {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}

export interface ToastProps {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
  priority?: ToastPriority;
  action?: ToastAction;
}

// Animation variants with reduced motion support
const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95, x: 100 }
};

// Toast style configurations following Material Design 3.0
const TOAST_STYLES = {
  success: {
    backgroundColor: 'var(--color-success-bg)',
    color: 'var(--color-success-text)',
    icon: '✓',
    highContrast: {
      backgroundColor: 'var(--color-success-bg-hc)',
      color: 'var(--color-success-text-hc)'
    }
  },
  error: {
    backgroundColor: 'var(--color-error-bg)',
    color: 'var(--color-error-text)',
    icon: '!',
    highContrast: {
      backgroundColor: 'var(--color-error-bg-hc)',
      color: 'var(--color-error-text-hc)'
    }
  },
  warning: {
    backgroundColor: 'var(--color-warning-bg)',
    color: 'var(--color-warning-text)',
    icon: '⚠',
    highContrast: {
      backgroundColor: 'var(--color-warning-bg-hc)',
      color: 'var(--color-warning-text-hc)'
    }
  },
  info: {
    backgroundColor: 'var(--color-info-bg)',
    color: 'var(--color-info-text)',
    icon: 'ℹ',
    highContrast: {
      backgroundColor: 'var(--color-info-bg-hc)',
      color: 'var(--color-info-text-hc)'
    }
  }
};

// Styled components
const ToastWrapper = styled(motion.div)<{ $type: NotificationType; $highContrast: boolean }>`
  position: relative;
  min-width: 300px;
  max-width: 600px;
  margin: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: ${({ $type, $highContrast }) =>
    $highContrast
      ? TOAST_STYLES[$type].highContrast.backgroundColor
      : TOAST_STYLES[$type].backgroundColor};
  color: ${({ $type, $highContrast }) =>
    $highContrast
      ? TOAST_STYLES[$type].highContrast.color
      : TOAST_STYLES[$type].color};
  box-shadow: ${({ theme }) => theme.shadows[3]};
  
  @media (max-width: 768px) {
    min-width: calc(100vw - 32px);
    margin: 8px 16px;
  }
`;

const ToastIcon = styled.span`
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ToastContent = styled.div`
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
`;

const ToastAction = styled.button`
  background: none;
  border: none;
  padding: 8px;
  margin-left: 8px;
  color: inherit;
  font-weight: 500;
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  color: inherit;
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
`;

// Toast component
export const Toast = memo(({
  id,
  type,
  message,
  duration = 5000,
  onDismiss,
  priority = 'medium',
  action
}: ToastProps) => {
  const shouldReduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const isHighContrast = theme.palette.mode === 'high-contrast';

  // Auto-dismiss effect
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onDismiss(id), duration);
      return () => clearTimeout(timer);
    }
  }, [duration, id, onDismiss]);

  // Keyboard handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onDismiss(id);
    }
  }, [id, onDismiss]);

  return (
    <ToastWrapper
      $type={type}
      $highContrast={isHighContrast}
      role="alert"
      aria-live={priority === 'high' ? 'assertive' : 'polite'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      initial={shouldReduceMotion ? { opacity: 0 } : 'initial'}
      animate={shouldReduceMotion ? { opacity: 1 } : 'animate'}
      exit={shouldReduceMotion ? { opacity: 0 } : 'exit'}
      variants={ANIMATION_VARIANTS}
      transition={{ duration: 0.2 }}
    >
      <ToastIcon role="img" aria-hidden="true">
        {TOAST_STYLES[type].icon}
      </ToastIcon>
      <ToastContent>{message}</ToastContent>
      {action && (
        <ToastAction
          onClick={action.onClick}
          aria-label={action.ariaLabel || action.label}
        >
          {action.label}
        </ToastAction>
      )}
      <CloseButton
        onClick={() => onDismiss(id)}
        aria-label="Close notification"
      >
        ✕
      </CloseButton>
    </ToastWrapper>
  );
});

Toast.displayName = 'Toast';

// Toast container component
export const ToastContainer = () => {
  const { notifications, dismissNotification } = useNotification();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        padding: '16px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      <AnimatePresence mode="sync">
        {notifications.map((notification) => (
          <div key={notification.id} style={{ pointerEvents: 'auto' }}>
            <Toast
              id={notification.id}
              type={notification.type}
              message={notification.message}
              duration={notification.duration}
              onDismiss={dismissNotification}
              priority={notification.priority === 3 ? 'high' : 'medium'}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};