import React, { useCallback, memo } from 'react'; // v18.0.0
import { StyledCard } from '../../styles/components.styles';
import { theme } from '../../styles/theme.styles';

interface CardProps {
  children: React.ReactNode;
  elevation?: number;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => void;
  clickable?: boolean;
  noPadding?: boolean;
  borderRadius?: number;
  fullWidth?: boolean;
  ariaLabel?: string;
  highContrast?: boolean;
  customTransition?: string;
  testId?: string;
}

const Card: React.FC<CardProps> = memo(({
  children,
  elevation = 1,
  className,
  onClick,
  clickable = false,
  noPadding = false,
  borderRadius = 4,
  fullWidth = false,
  ariaLabel,
  highContrast = false,
  customTransition,
  testId,
}) => {
  // Handle click events with keyboard support
  const handleClick = useCallback((
    event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>
  ) => {
    // Only handle keyboard events for Enter or Space
    if (
      event.type === 'keydown' && 
      (event as React.KeyboardEvent).key !== 'Enter' && 
      (event as React.KeyboardEvent).key !== ' '
    ) {
      return;
    }

    // Prevent default space scrolling
    if (event.type === 'keydown' && (event as React.KeyboardEvent).key === ' ') {
      event.preventDefault();
    }

    onClick?.(event);
  }, [onClick]);

  return (
    <StyledCard
      className={className}
      onClick={clickable || onClick ? handleClick : undefined}
      onKeyDown={clickable || onClick ? handleClick : undefined}
      role={clickable || onClick ? 'button' : undefined}
      tabIndex={clickable || onClick ? 0 : undefined}
      elevation={elevation}
      style={{
        padding: noPadding ? 0 : theme.spacing(2),
        borderRadius: borderRadius,
        width: fullWidth ? '100%' : 'auto',
        cursor: (clickable || onClick) ? 'pointer' : 'default',
        transition: customTransition || theme.transitions.create([
          'transform', 
          'box-shadow'
        ], {
          duration: theme.transitions.duration.standard
        }),
        backgroundColor: highContrast ? '#FFFFFF' : theme.palette.background.paper,
        border: highContrast ? '2px solid #000000' : 'none',
      }}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </StyledCard>
  );
});

// Display name for debugging
Card.displayName = 'Card';

// Export component and props interface
export type { CardProps };
export default Card;