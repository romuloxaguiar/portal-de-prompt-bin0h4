import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes.constant';
import { StyledCard } from '../../styles/components.styles';
import { useTheme } from '../../hooks/useTheme';

// Interface definitions
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  highContrastMode?: boolean;
  customBreakpoint?: number;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  ariaLabel: string;
  shortcut?: string;
}

// Styled components with accessibility and responsive design
const SidebarContainer = styled.nav<{ isCollapsed: boolean; highContrast: boolean }>`
  position: fixed;
  top: 64px;
  left: 0;
  bottom: 0;
  width: ${({ isCollapsed }) => (isCollapsed ? '64px' : '240px')};
  background-color: ${({ theme }) => theme.palette.background.paper};
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows[2]};
  border-right: ${({ highContrast }) => highContrast ? '2px solid #000' : 'none'};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (max-width: 768px) {
    transform: ${({ isCollapsed }) => isCollapsed ? 'translateX(-100%)' : 'translateX(0)'};
    width: 240px;
  }
`;

const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
`;

const NavItemContainer = styled.li<{ isActive: boolean; highContrast: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  min-height: 48px;
  touch-action: manipulation;
  color: ${({ theme, isActive }) => isActive ? theme.palette.primary.main : theme.palette.text.primary};
  background-color: ${({ theme, isActive }) => isActive ? theme.palette.action.selected : 'transparent'};
  border-left: ${({ isActive, highContrast }) => isActive && highContrast ? '4px solid #000' : 'none'};

  &:hover {
    background-color: ${({ theme }) => theme.palette.action.hover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: -2px;
  }

  @media (max-width: 768px) {
    min-height: 56px;
  }
`;

const NavLabel = styled.span<{ isCollapsed: boolean }>`
  white-space: nowrap;
  opacity: ${({ isCollapsed }) => isCollapsed ? 0 : 1};
  transition: opacity 0.2s ease;
  font-size: ${({ theme }) => theme.typography.body2.fontSize};
  font-weight: 500;
`;

const Sidebar: React.FC<SidebarProps> = memo(({ 
  isCollapsed, 
  onToggle, 
  highContrastMode = false,
  customBreakpoint = 768 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const sidebarRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= customBreakpoint);

  // Navigation items with accessibility labels
  const navItems = useMemo<NavItem[]>(() => [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: ROUTES.DASHBOARD,
      icon: '📊',
      ariaLabel: 'Navigate to Dashboard',
      shortcut: 'Alt+D'
    },
    {
      id: 'prompts',
      label: 'Prompt Library',
      path: ROUTES.PROMPT_LIBRARY,
      icon: '📚',
      ariaLabel: 'Navigate to Prompt Library',
      shortcut: 'Alt+P'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      path: ROUTES.ANALYTICS,
      icon: '📈',
      ariaLabel: 'Navigate to Analytics',
      shortcut: 'Alt+A'
    },
    {
      id: 'settings',
      label: 'Settings',
      path: ROUTES.SETTINGS,
      icon: '⚙️',
      ariaLabel: 'Navigate to Settings',
      shortcut: 'Alt+S'
    }
  ], []);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= customBreakpoint);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (sidebarRef.current) {
      resizeObserver.observe(sidebarRef.current);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [customBreakpoint]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.altKey) {
        const item = navItems.find(
          item => item.shortcut?.toLowerCase() === `alt+${event.key.toLowerCase()}`
        );
        if (item) {
          event.preventDefault();
          navigate(item.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [navItems, navigate]);

  // Navigation handler with analytics and accessibility
  const handleNavigation = useCallback((path: string, ariaLabel: string) => {
    navigate(path);
    if (isMobile) {
      onToggle();
    }
    // Announce route change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = `Navigated to ${ariaLabel}`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, [navigate, isMobile, onToggle]);

  return (
    <SidebarContainer
      ref={sidebarRef}
      isCollapsed={isCollapsed}
      highContrast={highContrastMode}
      role="navigation"
      aria-label="Main navigation"
    >
      <StyledCard elevation={2}>
        <NavList>
          {navItems.map((item) => (
            <NavItemContainer
              key={item.id}
              isActive={location.pathname === item.path}
              highContrast={highContrastMode}
              onClick={() => handleNavigation(item.path, item.ariaLabel)}
              onKeyPress={(e) => e.key === 'Enter' && handleNavigation(item.path, item.ariaLabel)}
              tabIndex={0}
              role="menuitem"
              aria-label={item.ariaLabel}
              title={`${item.label} ${item.shortcut ? `(${item.shortcut})` : ''}`}
            >
              <span role="img" aria-hidden="true">{item.icon}</span>
              <NavLabel isCollapsed={isCollapsed}>{item.label}</NavLabel>
            </NavItemContainer>
          ))}
        </NavList>
      </StyledCard>
    </SidebarContainer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;