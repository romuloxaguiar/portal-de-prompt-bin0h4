import React, { useRef, useState, useCallback, useEffect } from 'react';
import styled from 'styled-components'; // v5.3.0
import { theme } from '../../styles/theme.styles';
import { StyledTabs } from '../../styles/components.styles';

// Interfaces
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  panelId?: string;
}

export interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'standard' | 'contained' | 'fullWidth';
  orientation?: 'horizontal' | 'vertical';
  scrollable?: boolean;
  touchEnabled?: boolean;
}

// Styled Components
const TabsContainer = styled.div<{ orientation?: string }>`
  display: flex;
  flex-direction: ${({ orientation }) => orientation === 'vertical' ? 'column' : 'row'};
  position: relative;
  width: 100%;
  min-height: ${theme.spacing(6)}px;
`;

const TabList = styled.div<{ 
  orientation?: string;
  scrollable?: boolean;
  variant?: string;
}>`
  display: flex;
  flex-direction: ${({ orientation }) => orientation === 'vertical' ? 'column' : 'row'};
  position: relative;
  width: ${({ orientation }) => orientation === 'vertical' ? 'auto' : '100%'};
  overflow-x: ${({ scrollable, orientation }) => 
    scrollable && orientation !== 'vertical' ? 'auto' : 'hidden'};
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: ${theme.palette.background.paper};
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.palette.primary.main};
    border-radius: 2px;
  }
`;

const Tab = styled.button<{
  active?: boolean;
  disabled?: boolean;
  variant?: string;
  orientation?: string;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: ${theme.spacing(1.5)}px ${theme.spacing(2)}px;
  border: none;
  background: none;
  color: ${({ active, theme }) => 
    active ? theme.palette.primary.main : theme.palette.text.primary};
  font-family: inherit;
  font-size: 1rem;
  font-weight: ${({ active }) => active ? 600 : 400};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  position: relative;
  transition: all ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut};
  flex: ${({ variant }) => variant === 'fullWidth' ? 1 : 'none'};
  
  &:focus-visible {
    outline: 2px solid ${theme.palette.primary.main};
    outline-offset: -2px;
  }

  &:hover:not(:disabled) {
    background-color: ${theme.palette.action?.hover};
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: ${({ active, orientation }) => 
      active ? (orientation === 'vertical' ? '3px' : '100%') : '0'};
    height: ${({ active, orientation }) => 
      active ? (orientation === 'vertical' ? '100%' : '3px') : '0'};
    background-color: ${theme.palette.primary.main};
    transition: all ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut};
  }
`;

const TabIndicator = styled.span<{
  orientation?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}>`
  position: absolute;
  background-color: ${theme.palette.primary.main};
  transition: all ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut};
  ${({ orientation, left, top, width, height }) => 
    orientation === 'vertical' 
      ? `
        left: 0;
        top: ${top}px;
        width: 3px;
        height: ${height}px;
      `
      : `
        bottom: 0;
        left: ${left}px;
        width: ${width}px;
        height: 3px;
      `
  }
`;

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onChange,
  variant = 'standard',
  orientation = 'horizontal',
  scrollable = false,
  touchEnabled = true,
}) => {
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const updateIndicator = useCallback(() => {
    const activeTabElement = tabRefs.current.get(activeTab);
    if (activeTabElement && tabListRef.current) {
      const tabRect = activeTabElement.getBoundingClientRect();
      const listRect = tabListRef.current.getBoundingClientRect();

      setIndicatorStyle({
        left: orientation === 'horizontal' ? tabRect.left - listRect.left : 0,
        top: orientation === 'vertical' ? tabRect.top - listRect.top : 0,
        width: orientation === 'horizontal' ? tabRect.width : 3,
        height: orientation === 'vertical' ? tabRect.height : 3,
      });
    }
  }, [activeTab, orientation]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const currentIndex = items.findIndex(item => item.id === activeTab);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = currentIndex - 1;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
    }

    // Find next non-disabled tab
    while (newIndex >= 0 && newIndex < items.length && items[newIndex].disabled) {
      newIndex += newIndex > currentIndex ? 1 : -1;
    }

    if (newIndex >= 0 && newIndex < items.length && !items[newIndex].disabled) {
      onChange(items[newIndex].id);
      tabRefs.current.get(items[newIndex].id)?.focus();
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (touchEnabled && orientation === 'horizontal') {
      setTouchStart(event.touches[0].clientX);
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (!touchEnabled || !touchStart || orientation !== 'horizontal') return;

    const currentTouch = event.touches[0].clientX;
    const diff = touchStart - currentTouch;

    if (Math.abs(diff) > 50) {
      const currentIndex = items.findIndex(item => item.id === activeTab);
      const newIndex = diff > 0 ? currentIndex + 1 : currentIndex - 1;

      if (newIndex >= 0 && newIndex < items.length && !items[newIndex].disabled) {
        onChange(items[newIndex].id);
      }
      setTouchStart(null);
    }
  };

  return (
    <TabsContainer orientation={orientation}>
      <TabList
        role="tablist"
        ref={tabListRef}
        orientation={orientation}
        scrollable={scrollable}
        variant={variant}
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {items.map(tab => (
          <Tab
            key={tab.id}
            ref={el => el && tabRefs.current.set(tab.id, el)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={tab.panelId}
            aria-label={tab.ariaLabel || tab.label}
            aria-disabled={tab.disabled}
            tabIndex={activeTab === tab.id ? 0 : -1}
            active={activeTab === tab.id}
            disabled={tab.disabled}
            variant={variant}
            orientation={orientation}
            onClick={() => !tab.disabled && onChange(tab.id)}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            <span className="tab-label">{tab.label}</span>
          </Tab>
        ))}
        <TabIndicator
          role="presentation"
          orientation={orientation}
          {...indicatorStyle}
        />
      </TabList>
    </TabsContainer>
  );
};

export default Tabs;