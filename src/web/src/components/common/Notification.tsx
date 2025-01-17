import React, { useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components'; // v5.3.0
import { motion, AnimatePresence } from 'framer-motion'; // v6.0.0
import { useNotification } from '../../hooks/useNotification';
import { StyledCard } from '../../styles/components.styles';

// Animation variants for notification transitions
const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95, x: 100 }
};

// Notification style configurations based on type
const NOTIFICATION_STYLES = {
  success: {
    backgroundColor: 'var(--color-success-bg, #E8F5E9)',
    color: 'var(--color-success-text, #1B5E20)',
    borderLeft: '4px solid var(--color-success-border, #4CAF50)'
  },
  error: {
    backgroundColor: 'var(--color-error-bg, #FFEBEE)',
    color: 'var(--color-error-text, #B71C1C)',
    borderLeft: '4px solid var(--color-error-border, #F44336)'
  },
  warning: {
    backgroundColor: 'var(--color-warning-bg, #FFF3E0)',
    color: 'var(--color-warning-text, #E65100)',
    borderLeft: '4px solid var(--color-warning-border, #FF9800)'
  },
  info: {
    backgroundColor: 'var(--color-info-bg, #E3F2FD)',
    color: 'var(--color-info-text, #0D47A1)',
    borderLeft: '4px solid var(--color-info-border, #2196F3)'
  }
};

// Styled components
const NotificationWrapper = styled(motion.div)`
  position: relative;
  margin-bottom: 8px;
  min-width: 300px;
  max-width: 500px;

  @media (max-width: 768px) {
    min-width: auto;
    max-width: calc(100vw - 32px);
  }
`;

const NotificationContent = styled(StyledCard)<{ type: keyof typeof NOTIFICATION_STYLES }>`
  ${({ type }) => ({ ...NOTIFICATION_STYLES[type] })};
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

const Message = styled.div`
  flex: 1;
  margin: 0 12px;
  font-size: 14px;
  line-height: 1.5;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

// Component interfaces
interface NotificationProps {
  id: string;
  type: keyof typeof NOTIFICATION_STYLES;
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

export const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  message,
  duration = 5000,
  onDismiss
}) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleDismiss = useCallback(() => {
    onDismiss(id);
  }, [id, onDismiss]);

  useEffect(() => {
    if (duration > 0) {
      timeoutRef.current = setTimeout(handleDismiss, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration, handleDismiss]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleDismiss();
    }
  }, [handleDismiss]);

  return (
    <NotificationWrapper
      initial="initial"
      animate="animate"
      exit="exit"
      variants={ANIMATION_VARIANTS}
      layout
    >
      <NotificationContent
        type={type}
        role="alert"
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <Message>{message}</Message>
        <CloseButton
          onClick={handleDismiss}
          aria-label="Close notification"
          title="Close notification"
        >
          ✕
        </CloseButton>
      </NotificationContent>
    </NotificationWrapper>
  );
};

const NotificationContainer = styled(motion.div)`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }

  @media (max-width: 768px) {
    left: 16px;
  }
`;

export const NotificationManager: React.FC = () => {
  const { notifications, dismissNotification } = useNotification();

  return (
    <NotificationContainer role="region" aria-label="Notifications">
      <AnimatePresence mode="sync">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            id={notification.id}
            type={notification.type}
            message={notification.message}
            duration={notification.duration}
            onDismiss={dismissNotification}
          />
        ))}
      </AnimatePresence>
    </NotificationContainer>
  );
};

export type { NotificationProps };