import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useMediaQuery } from '@mui/material';
import Header from './Header';
import Sidebar from '../common/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useTheme } from '../../hooks/useTheme';

// Styled components with Material Design 3.0 principles
const LayoutContainer = styled.div<{ highContrastMode: boolean }>`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.palette.background.default};
  color: ${({ theme }) => theme.palette.text.primary};
  transition: background-color 0.3s ease;
  ${({ highContrastMode }) => highContrastMode && `
    border: 2px solid #000;
    background-color: #FFFFFF;
    color: #000000;
  `}
`;

const MainContent = styled.main<{ 
  sidebarCollapsed: boolean;
  highContrastMode: boolean;
}>`
  flex: 1;
  margin-left: ${({ sidebarCollapsed }) => sidebarCollapsed ? '64px' : '240px'};
  margin-top: 64px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow-x: hidden;

  @media (max-width: 768px) {
    margin-left: 0;
    padding: 16px;
  }

  @media (min-width: 2560px) {
    max-width: 2000px;
    margin: 64px auto 0;
  }

  ${({ highContrastMode }) => highContrastMode && `
    border-left: 2px solid #000;
    border-top: 2px solid #000;
  `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Footer = styled.footer<{ highContrastMode: boolean }>`
  padding: 16px 24px;
  background-color: ${({ theme }) => theme.palette.background.paper};
  color: ${({ theme }) => theme.palette.text.secondary};
  text-align: center;
  border-top: 1px solid ${({ theme }) => theme.palette.divider};

  ${({ highContrastMode }) => highContrastMode && `
    border-top: 2px solid #000;
    background-color: #FFFFFF;
    color: #000000;
  `}
`;

// Props interface
interface AppLayoutProps {
  children: React.ReactNode;
  collaborationEnabled?: boolean;
  highContrastMode?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  collaborationEnabled = true,
  highContrastMode = false
}) => {
  // Hooks
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { connectionHealth } = useCollaboration('global', {
    autoConnect: collaborationEnabled,
    enablePresence: true,
    heartbeatInterval: 30000
  });

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);

  // Handle sidebar toggle with touch support
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Update sidebar state on screen resize
  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'b') {
        event.preventDefault();
        handleSidebarToggle();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleSidebarToggle]);

  return (
    <LayoutContainer 
      highContrastMode={highContrastMode}
      role="application"
      aria-label="Prompts Portal Application"
    >
      <Header
        collaborationStatus={connectionHealth}
        onThemeToggle={toggleTheme}
        highContrastMode={highContrastMode}
      />

      {isAuthenticated && (
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
          highContrastMode={highContrastMode}
          customBreakpoint={768}
        />
      )}

      <MainContent
        sidebarCollapsed={sidebarCollapsed}
        highContrastMode={highContrastMode}
        role="main"
        aria-label="Main content area"
      >
        {children}
      </MainContent>

      <Footer 
        highContrastMode={highContrastMode}
        role="contentinfo"
      >
        <p>© {new Date().getFullYear()} Prompts Portal. All rights reserved.</p>
        {collaborationEnabled && connectionHealth.isHealthy && (
          <p>Real-time collaboration enabled</p>
        )}
      </Footer>
    </LayoutContainer>
  );
};

export default AppLayout;