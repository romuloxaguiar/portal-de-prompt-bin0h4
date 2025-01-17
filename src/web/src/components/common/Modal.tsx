import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StyledModal } from '../../styles/components.styles';
import Button from './Button';

// Animation duration constant matching Material Design specifications
const ANIMATION_DURATION = 200;

// Modal size configurations
const MODAL_SIZES = {
  small: {
    width: '400px',
    maxHeight: '70vh'
  },
  medium: {
    width: '600px',
    maxHeight: '80vh'
  },
  large: {
    width: '800px',
    maxHeight: '90vh'
  }
} as const;

// Z-index for modal overlay and content
const Z_INDEX_MODAL = 1000;

// Focusable elements selector for focus trap
const FOCUS_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: keyof typeof MODAL_SIZES;
  children: React.ReactNode;
  actions?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  ariaLabel?: string;
  disableAnimation?: boolean;
}

const useModalKeyboard = (onClose: () => void) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

const Modal: React.FC<ModalProps> = React.memo(({
  isOpen,
  onClose,
  title,
  size = 'medium',
  children,
  actions,
  closeOnOverlayClick = true,
  ariaLabel,
  disableAnimation = false
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Handle keyboard interactions
  useModalKeyboard(onClose);

  // Focus trap implementation
  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (!modalRef.current || event.key !== 'Tab') return;

    const focusableElements = modalRef.current.querySelectorAll(FOCUS_SELECTOR);
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }, []);

  // Handle modal mounting and unmounting
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      
      // Focus first focusable element after animation
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector(FOCUS_SELECTOR) as HTMLElement;
        firstFocusable?.focus();
        setIsAnimating(false);
      }, disableAnimation ? 0 : ANIMATION_DURATION);
    }

    return () => {
      if (isOpen) {
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      }
    };
  }, [isOpen, disableAnimation]);

  // Add keyboard event listener for focus trap
  useEffect(() => {
    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [handleFocusTrap]);

  if (!isOpen && !isAnimating) return null;

  const modalContent = (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: Z_INDEX_MODAL,
        opacity: isAnimating ? 0 : 1,
        transition: disableAnimation ? 'none' : `opacity ${ANIMATION_DURATION}ms ease-in-out`,
      }}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <StyledModal
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        aria-describedby="modal-description"
        size={size}
        onClick={e => e.stopPropagation()}
        style={{
          opacity: isAnimating ? 0 : 1,
          transform: `translate(-50%, -50%) scale(${isAnimating ? 0.9 : 1})`,
          transition: disableAnimation ? 'none' : `all ${ANIMATION_DURATION}ms ease-in-out`,
        }}
      >
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 500,
              lineHeight: 1.6,
            }}
          >
            {title}
          </h2>
        </div>

        <div
          id="modal-description"
          style={{
            padding: '24px',
            overflowY: 'auto',
            maxHeight: MODAL_SIZES[size].maxHeight,
          }}
        >
          {children}
        </div>

        {actions && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(0, 0, 0, 0.12)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            {actions}
          </div>
        )}
      </StyledModal>
    </div>
  );

  return createPortal(modalContent, document.body);
});

Modal.displayName = 'Modal';

export default Modal;