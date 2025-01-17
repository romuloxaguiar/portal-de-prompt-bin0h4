import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import Button from './Button';
import { StyledButton } from '../../styles/components.styles';

// Interface for pagination props with enhanced accessibility features
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  size?: 'small' | 'medium' | 'large';
  showFirstLast?: boolean;
  disabled?: boolean;
  highContrast?: boolean;
  ariaLabels?: {
    next?: string;
    previous?: string;
    first?: string;
    last?: string;
    page?: string;
  };
}

// Styled components for pagination
const StyledPaginationContainer = styled.nav<{ $size?: string; $highContrast?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 2vw, 8px);
  padding: clamp(4px, 2vw, 8px);
  flex-wrap: wrap;
  touch-action: manipulation;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  ${({ $highContrast }) => $highContrast && `
    @media (forced-colors: active) {
      border: 2px solid currentColor;
      padding: 4px;
    }
  `}
`;

const StyledPageButton = styled(StyledButton)<{ $active?: boolean; $highContrast?: boolean }>`
  min-width: clamp(36px, 10vw, 40px);
  height: clamp(36px, 10vw, 40px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  user-select: none;

  ${({ $active, $highContrast, theme }) => $active && `
    background-color: ${$highContrast ? '#000000' : theme.palette.primary.main};
    color: ${$highContrast ? '#FFFFFF' : theme.palette.primary.contrastText};
    font-weight: ${theme.typography.fontWeights.bold};
  `}

  @media (hover: hover) {
    transition: background-color 0.2s;
  }

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
`;

// Helper function to calculate page range
const getPageRange = (currentPage: number, totalPages: number, viewportWidth: number): number[] => {
  const range: number[] = [];
  const maxVisiblePages = viewportWidth < 768 ? 3 : viewportWidth < 1024 ? 5 : 7;
  
  let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let end = Math.min(totalPages, start + maxVisiblePages - 1);
  
  if (end - start + 1 < maxVisiblePages) {
    start = Math.max(1, end - maxVisiblePages + 1);
  }
  
  for (let i = start; i <= end; i++) {
    range.push(i);
  }
  
  return range;
};

const Pagination = React.memo(({
  currentPage,
  totalPages,
  onPageChange,
  size = 'medium',
  showFirstLast = true,
  disabled = false,
  highContrast = false,
  ariaLabels = {
    next: 'Next page',
    previous: 'Previous page',
    first: 'First page',
    last: 'Last page',
    page: 'Page'
  }
}: PaginationProps): JSX.Element => {
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Handle viewport resize
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounced page change handler
  const debouncedPageChange = useCallback((page: number) => {
    if (disabled || page === currentPage) return;
    
    const handler = setTimeout(() => {
      onPageChange(page);
      
      // Announce page change to screen readers
      const announcement = `Page ${page} of ${totalPages}`;
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      liveRegion.textContent = announcement;
      document.body.appendChild(liveRegion);
      
      setTimeout(() => {
        document.body.removeChild(liveRegion);
      }, 1000);
    }, prefersReducedMotion ? 0 : 150);

    return () => clearTimeout(handler);
  }, [currentPage, disabled, onPageChange, prefersReducedMotion, totalPages]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        if (currentPage > 1) debouncedPageChange(currentPage - 1);
        break;
      case 'ArrowRight':
        if (currentPage < totalPages) debouncedPageChange(currentPage + 1);
        break;
      case 'Home':
        debouncedPageChange(1);
        break;
      case 'End':
        debouncedPageChange(totalPages);
        break;
    }
  }, [currentPage, debouncedPageChange, disabled, totalPages]);

  const pageRange = getPageRange(currentPage, totalPages, viewportWidth);

  return (
    <StyledPaginationContainer
      ref={containerRef}
      $size={size}
      $highContrast={highContrast}
      role="navigation"
      aria-label="Pagination"
      onKeyDown={handleKeyDown}
    >
      {showFirstLast && (
        <StyledPageButton
          variant="outlined"
          size={size}
          onClick={() => debouncedPageChange(1)}
          disabled={disabled || currentPage === 1}
          aria-label={ariaLabels.first}
          $highContrast={highContrast}
        >
          «
        </StyledPageButton>
      )}
      
      <StyledPageButton
        variant="outlined"
        size={size}
        onClick={() => debouncedPageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        aria-label={ariaLabels.previous}
        $highContrast={highContrast}
      >
        ‹
      </StyledPageButton>

      {pageRange.map((page) => (
        <StyledPageButton
          key={page}
          variant="outlined"
          size={size}
          onClick={() => debouncedPageChange(page)}
          disabled={disabled}
          $active={page === currentPage}
          $highContrast={highContrast}
          aria-label={`${ariaLabels.page} ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </StyledPageButton>
      ))}

      <StyledPageButton
        variant="outlined"
        size={size}
        onClick={() => debouncedPageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
        aria-label={ariaLabels.next}
        $highContrast={highContrast}
      >
        ›
      </StyledPageButton>

      {showFirstLast && (
        <StyledPageButton
          variant="outlined"
          size={size}
          onClick={() => debouncedPageChange(totalPages)}
          disabled={disabled || currentPage === totalPages}
          aria-label={ariaLabels.last}
          $highContrast={highContrast}
        >
          »
        </StyledPageButton>
      )}
    </StyledPaginationContainer>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;