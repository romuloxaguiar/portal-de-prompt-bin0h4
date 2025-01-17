import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useMediaQuery } from '@mui/material';
import { Navigation } from './Navigation';
import { SearchBar } from '../common/SearchBar';
import { NotificationContainer } from '../common/Notification';
import { useAuth } from '../../hooks/useAuth';
import { useCollaboration } from '../../hooks/useCollaboration';

// Constants for responsive design
const MOBILE_BREAKPOINT = '768px';
const SEARCH_DEBOUNCE = 300;

// Styled components with Material Design 3.0 principles
const HeaderContainer = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background-color: ${({ theme }) => theme.palette.background.paper};
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 1200;
  display: flex;
  align-items: center;
  padding: 0 16px;
  justify-content: space-between;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    height: 56px;
    padding: 0 8px;
  }
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Logo = styled.img`
  height: 32px;
  width: auto;
`;

const Title = styled.h1`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: none;
  }
`;

const SearchSection = styled.div`
  flex: 1;
  max-width: 600px;
  margin: 0 24px;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    margin: 0 12px;
  }
`;

const ActionSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CollaborationStatus = styled.div<{ isConnected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme, isConnected }) => 
    isConnected ? theme.palette.success.main : theme.palette.error.main};
  font-size: 0.875rem;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: currentColor;
  }
`;

// Props interface with enhanced accessibility options
interface HeaderProps {
  className?: string;
  highContrastMode?: boolean;
  onThemeToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  className,
  highContrastMode = false,
  onThemeToggle
}) => {
  // State management
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Hooks
  const { isAuthenticated, user } = useAuth();
  const { connectionHealth } = useCollaboration('global');
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT})`);

  // Search handler with debouncing
  const handleSearch = useCallback((query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    // Implement actual search logic here
    setIsSearching(false);
  }, []);

  // Effect for handling connection status announcements
  useEffect(() => {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.setAttribute('aria-live', 'polite');
    }
  }, [connectionHealth.isHealthy]);

  return (
    <HeaderContainer className={className} role="banner">
      <LogoSection>
        <Logo 
          src="/logo.svg" 
          alt="Prompts Portal Logo"
          width="32"
          height="32"
        />
        <Title>Prompts Portal</Title>
      </LogoSection>

      <SearchSection>
        <SearchBar
          value={searchQuery}
          onSearch={handleSearch}
          placeholder="Search prompts, templates, and more..."
          isLoading={isSearching}
          debounceTime={SEARCH_DEBOUNCE}
          maxLength={100}
          ariaLabel="Global search"
        />
      </SearchSection>

      <ActionSection>
        {isAuthenticated && (
          <CollaborationStatus 
            isConnected={connectionHealth.isHealthy}
            id="connection-status"
            role="status"
            aria-live="polite"
          >
            {connectionHealth.isHealthy ? 'Connected' : 'Disconnected'}
          </CollaborationStatus>
        )}

        <NotificationContainer />

        <Navigation
          user={user}
          isAuthenticated={isAuthenticated}
          highContrastMode={highContrastMode}
          onThemeToggle={onThemeToggle}
        />
      </ActionSection>
    </HeaderContainer>
  );
};

export default Header;