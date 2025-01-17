import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import {
  AppBar,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  LibraryBooks as PromptsIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Help as HelpIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';

import { ROUTES } from '../../constants/routes.constant';
import { useAuth } from '../../hooks/useAuth';

// Constants for responsive design
const DRAWER_WIDTH = 240;
const COLLAPSED_DRAWER_WIDTH = 64;
const MOBILE_BREAKPOINT = '768px';

// Styled components
const NavigationContainer = styled.div`
  display: flex;
  min-height: 100vh;
  position: relative;
`;

const MainContent = styled.main<{ isDrawerOpen: boolean }>`
  flex-grow: 1;
  margin-left: ${({ isDrawerOpen }) => 
    isDrawerOpen ? `${DRAWER_WIDTH}px` : `${COLLAPSED_DRAWER_WIDTH}px`};
  transition: margin-left 0.3s ease;
  padding: 24px;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    margin-left: 0;
    padding: 16px;
  }
`;

const StyledAppBar = styled(AppBar)`
  z-index: 1201;
`;

const StyledDrawer = styled(Drawer)`
  width: ${DRAWER_WIDTH}px;
  flex-shrink: 0;

  & .MuiDrawer-paper {
    width: ${DRAWER_WIDTH}px;
    box-sizing: border-box;
    transition: width 0.3s ease;
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  min-height: 64px;
`;

const CollaborationIndicator = styled.div`
  display: flex;
  align-items: center;
  margin-left: 16px;
  gap: 8px;
`;

interface NavigationProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
  analyticsEnabled?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  children,
  onError,
  analyticsEnabled = true
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT})`);

  // State management
  const [isDrawerOpen, setIsDrawerOpen] = useState(!isMobile);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);

  // Navigation items configuration
  const navigationItems = [
    { icon: <DashboardIcon />, text: 'Dashboard', path: ROUTES.DASHBOARD },
    { icon: <PromptsIcon />, text: 'Prompt Library', path: ROUTES.PROMPT_LIBRARY },
    { icon: <AnalyticsIcon />, text: 'Analytics', path: ROUTES.ANALYTICS },
    { icon: <SettingsIcon />, text: 'Settings', path: ROUTES.SETTINGS }
  ];

  // Handle drawer toggle
  const handleDrawerToggle = useCallback(() => {
    setIsDrawerOpen(prev => !prev);
  }, []);

  // Handle user menu
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  // Handle notifications
  const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationAnchor(null);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate(ROUTES.LOGIN);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  // Update drawer state on mobile breakpoint change
  useEffect(() => {
    setIsDrawerOpen(!isMobile);
  }, [isMobile]);

  return (
    <NavigationContainer>
      <StyledAppBar position="fixed">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={handleDrawerToggle}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Prompts Portal
          </Typography>

          <CollaborationIndicator>
            <Badge color="success" variant="dot">
              <Typography variant="body2">Connected</Typography>
            </Badge>
          </CollaborationIndicator>

          <IconButton color="inherit" onClick={handleNotificationsOpen}>
            <Badge badgeContent={4} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <IconButton color="inherit" onClick={handleUserMenuOpen}>
            <Avatar src={user?.avatarUrl || undefined}>
              <PersonIcon />
            </Avatar>
          </IconButton>
        </Toolbar>
      </StyledAppBar>

      <StyledDrawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isDrawerOpen}
        onClose={handleDrawerToggle}
      >
        <DrawerHeader>
          <Typography variant="h6">Navigation</Typography>
          {!isMobile && (
            <IconButton onClick={handleDrawerToggle}>
              <ChevronLeftIcon />
            </IconButton>
          )}
        </DrawerHeader>
        <Divider />
        <List>
          {navigationItems.map(item => (
            <ListItem
              button
              key={item.path}
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </StyledDrawer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleUserMenuClose}
      >
        <MenuItem onClick={() => navigate('/profile')}>Profile</MenuItem>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>

      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleNotificationsClose}
      >
        <MenuItem>New prompt comment</MenuItem>
        <MenuItem>Template updated</MenuItem>
        <MenuItem>Team invitation</MenuItem>
        <Divider />
        <MenuItem onClick={() => navigate('/notifications')}>
          View all notifications
        </MenuItem>
      </Menu>

      <MainContent isDrawerOpen={isDrawerOpen}>
        <Toolbar /> {/* Spacer for fixed AppBar */}
        {children}
      </MainContent>
    </NavigationContainer>
  );
};

export default Navigation;