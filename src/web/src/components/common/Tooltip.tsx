import React, { useCallback, useEffect, useRef, useState } from 'react'; // v18.0.0
import styled from 'styled-components'; // v5.3.0
import { theme } from '../../styles/theme.styles';

// Constants
const TOOLTIP_POSITIONS = {
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  topLeft: 'translate(-50%, -100%)',
  topRight: 'translate(50%, -100%)',
  bottomLeft: 'translate(-50%, 100%)',
  bottomRight: 'translate(50%, 100%)'
};

const TOOLTIP_OFFSET = 8;
const TOOLTIP_ANIMATION_DURATION = 200;
const TOOLTIP_SHOW_DELAY = 200;
const TOOLTIP_HIDE_DELAY = 100;

// Interfaces
interface TooltipProps {
  content: string | React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  delay?: number;
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
  interactive?: boolean;
  theme?: TooltipTheme;
  onShow?: () => void;
  onHide?: () => void;
}

interface TooltipTheme {
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  padding?: string;
  maxWidth?: string;
  zIndex?: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  transform: string;
}

// Styled Components
const TooltipContainer = styled.div<{ $theme: TooltipTheme }>`
  position: fixed;
  z-index: ${props => props.$theme.zIndex || 1500};
  max-width: ${props => props.$theme.maxWidth || '200px'};
  padding: ${props => props.$theme.padding || theme.spacing(1)};
  background-color: ${props => props.$theme.backgroundColor || 'rgba(33, 33, 33, 0.9)'};
  color: ${props => props.$theme.textColor || '#ffffff'};
  border-radius: ${props => props.$theme.borderRadius || '4px'};
  font-size: 0.875rem;
  line-height: 1.4;
  pointer-events: ${props => props.interactive ? 'auto' : 'none'};
  opacity: 0;
  visibility: hidden;
  transition: opacity ${TOOLTIP_ANIMATION_DURATION}ms ${theme.transitions.easing.easeInOut},
              visibility ${TOOLTIP_ANIMATION_DURATION}ms ${theme.transitions.easing.easeInOut};

  &[data-show="true"] {
    opacity: 1;
    visibility: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const TooltipTrigger = styled.div`
  display: inline-block;
`;

// Utility Functions
const calculateContrastRatio = (backgroundColor: string, textColor: string): number => {
  const getLuminance = (color: string): number => {
    const rgb = color.startsWith('#') 
      ? [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map(x => parseInt(x, 16) / 255)
      : color.match(/\d+/g)?.map(x => parseInt(x) / 255) || [];

    const [r, g, b] = rgb.map(val => 
      val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(backgroundColor);
  const l2 = getLuminance(textColor);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
};

const getTooltipPosition = (
  placement: TooltipProps['placement'],
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  viewportSize: { width: number; height: number }
): TooltipPosition => {
  let top = 0;
  let left = 0;
  let transform = TOOLTIP_POSITIONS[placement || 'top'];

  const triggerCenter = {
    x: triggerRect.left + triggerRect.width / 2,
    y: triggerRect.top + triggerRect.height / 2
  };

  switch (placement) {
    case 'top':
    case 'topLeft':
    case 'topRight':
      top = triggerRect.top - TOOLTIP_OFFSET;
      left = triggerCenter.x;
      // Check if tooltip would go above viewport
      if (top - tooltipRect.height < 0) {
        top = triggerRect.bottom + TOOLTIP_OFFSET;
        transform = TOOLTIP_POSITIONS[placement.replace('top', 'bottom') as keyof typeof TOOLTIP_POSITIONS];
      }
      break;

    case 'bottom':
    case 'bottomLeft':
    case 'bottomRight':
      top = triggerRect.bottom + TOOLTIP_OFFSET;
      left = triggerCenter.x;
      // Check if tooltip would go below viewport
      if (top + tooltipRect.height > viewportSize.height) {
        top = triggerRect.top - TOOLTIP_OFFSET;
        transform = TOOLTIP_POSITIONS[placement.replace('bottom', 'top') as keyof typeof TOOLTIP_POSITIONS];
      }
      break;

    case 'left':
      top = triggerCenter.y;
      left = triggerRect.left - TOOLTIP_OFFSET;
      // Check if tooltip would go beyond left viewport edge
      if (left - tooltipRect.width < 0) {
        left = triggerRect.right + TOOLTIP_OFFSET;
        transform = TOOLTIP_POSITIONS.right;
      }
      break;

    case 'right':
      top = triggerCenter.y;
      left = triggerRect.right + TOOLTIP_OFFSET;
      // Check if tooltip would go beyond right viewport edge
      if (left + tooltipRect.width > viewportSize.width) {
        left = triggerRect.left - TOOLTIP_OFFSET;
        transform = TOOLTIP_POSITIONS.left;
      }
      break;
  }

  return { top, left, transform };
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  delay = TOOLTIP_SHOW_DELAY,
  children,
  className,
  visible: controlledVisible,
  interactive = false,
  theme: customTheme = {},
  onShow,
  onHide
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0, transform: TOOLTIP_POSITIONS.top });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<number>();
  const hideTimeoutRef = useRef<number>();

  const mergedTheme: TooltipTheme = {
    backgroundColor: 'rgba(33, 33, 33, 0.9)',
    textColor: '#ffffff',
    borderRadius: '4px',
    padding: theme.spacing(1),
    maxWidth: '200px',
    zIndex: 1500,
    ...customTheme
  };

  // Ensure sufficient contrast ratio
  if (mergedTheme.backgroundColor && mergedTheme.textColor) {
    const contrastRatio = calculateContrastRatio(mergedTheme.backgroundColor, mergedTheme.textColor);
    if (contrastRatio < 4.5) {
      mergedTheme.textColor = '#ffffff';
    }
  }

  const updatePosition = useCallback(() => {
    if (triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportSize = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      setPosition(getTooltipPosition(placement, triggerRect, tooltipRect, viewportSize));
    }
  }, [placement]);

  const handleShow = useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
      updatePosition();
      onShow?.();
    }, delay);
  }, [delay, updatePosition, onShow]);

  const handleHide = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      onHide?.();
    }, TOOLTIP_HIDE_DELAY);
  }, [onHide]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isVisible) {
      handleHide();
    }
  }, [isVisible, handleHide]);

  useEffect(() => {
    if (typeof controlledVisible !== 'undefined') {
      setIsVisible(controlledVisible);
      if (controlledVisible) {
        updatePosition();
      }
    }
  }, [controlledVisible, updatePosition]);

  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        updatePosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(showTimeoutRef.current);
      clearTimeout(hideTimeoutRef.current);
    };
  }, [isVisible, updatePosition, handleKeyDown]);

  return (
    <>
      <TooltipTrigger
        ref={triggerRef}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
        className={className}
        role="tooltip"
        aria-describedby={isVisible ? 'tooltip' : undefined}
      >
        {children}
      </TooltipTrigger>
      <TooltipContainer
        ref={tooltipRef}
        $theme={mergedTheme}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: position.transform
        }}
        data-show={isVisible}
        id="tooltip"
        role="tooltip"
        aria-hidden={!isVisible}
        onMouseEnter={interactive ? handleShow : undefined}
        onMouseLeave={interactive ? handleHide : undefined}
      >
        {content}
      </TooltipContainer>
    </>
  );
};

export type { TooltipProps, TooltipTheme };