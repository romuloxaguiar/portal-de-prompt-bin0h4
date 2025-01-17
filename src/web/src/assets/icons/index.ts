import React from 'react'; // ^18.0.0
import styled, { useTheme } from 'styled-components'; // ^6.0.0

// Interface for icon component props with comprehensive accessibility support
export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  title?: string;
  role?: string;
  testId?: string;
}

// Styled SVG component with theme awareness and accessibility features
const StyledSvg = styled.svg<IconProps>`
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  fill: ${props => props.theme.mode === 'dark' ? props.theme.colors.iconDark : props.theme.colors.iconLight};
  transition: fill 0.2s ease, transform 0.2s ease;
  vertical-align: middle;
  cursor: inherit;
  min-width: 48px;
  min-height: 48px;
  padding: 12px;
  box-sizing: border-box;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  [dir='rtl'] & {
    transform: scaleX(-1);
  }
`;

// Factory function to create accessible, theme-aware icon components
export const createIconComponent = (
  path: string,
  viewBox: string = '0 0 24 24',
  defaultTitle: string
): React.FC<IconProps> => {
  const IconComponent: React.FC<IconProps> = ({
    size = 24,
    color,
    className,
    title = defaultTitle,
    role = 'img',
    testId,
    ...props
  }) => {
    const theme = useTheme();
    
    return (
      <StyledSvg
        viewBox={viewBox}
        size={size}
        className={className}
        role={role}
        aria-label={title}
        data-testid={testId}
        color={color}
        {...props}
      >
        {title && <title>{title}</title>}
        <path d={path} />
      </StyledSvg>
    );
  };

  IconComponent.displayName = `Icon${defaultTitle.replace(/\s+/g, '')}`;
  
  return IconComponent;
};

// Common icon components using Material Design paths
export const AddIcon = createIconComponent(
  'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  '0 0 24 24',
  'Add'
);

export const EditIcon = createIconComponent(
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  '0 0 24 24',
  'Edit'
);

export const DeleteIcon = createIconComponent(
  'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  '0 0 24 24',
  'Delete'
);

export const SaveIcon = createIconComponent(
  'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
  '0 0 24 24',
  'Save'
);

export const SearchIcon = createIconComponent(
  'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  '0 0 24 24',
  'Search'
);

export const MenuIcon = createIconComponent(
  'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  '0 0 24 24',
  'Menu'
);

export const CloseIcon = createIconComponent(
  'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  '0 0 24 24',
  'Close'
);

export const SettingsIcon = createIconComponent(
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  '0 0 24 24',
  'Settings'
);

export const NotificationIcon = createIconComponent(
  'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  '0 0 24 24',
  'Notifications'
);

export const UserIcon = createIconComponent(
  'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  '0 0 24 24',
  'User'
);