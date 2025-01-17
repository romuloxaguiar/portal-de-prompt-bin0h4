import React, { useRef, useState, useCallback, useMemo } from 'react';
import styled from 'styled-components'; // v5.3.0
import useClickOutside from 'react-click-outside-hook'; // v1.1.0
import { palette, spacing, typography } from '../../styles/theme.styles';
import { StyledInput } from '../../styles/components.styles';

// Types
interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  size?: keyof typeof DROPDOWN_SIZES;
  variant?: keyof typeof DROPDOWN_VARIANTS;
  highContrast?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

// Constants
const DROPDOWN_SIZES = {
  small: {
    height: '32px',
    fontSize: '14px',
    touchTarget: '44px'
  },
  medium: {
    height: '40px',
    fontSize: '16px',
    touchTarget: '48px'
  },
  large: {
    height: '48px',
    fontSize: '18px',
    touchTarget: '52px'
  }
} as const;

const DROPDOWN_VARIANTS = {
  outlined: {
    border: '1px solid',
    borderRadius: '4px',
    padding: '8px 16px'
  },
  filled: {
    background: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '4px',
    padding: '8px 16px'
  },
  standard: {
    borderBottom: '1px solid',
    padding: '4px 0'
  }
} as const;

// Styled Components
const DropdownContainer = styled.div<{
  size: keyof typeof DROPDOWN_SIZES;
  variant: keyof typeof DROPDOWN_VARIANTS;
  disabled: boolean;
  error: boolean;
  highContrast: boolean;
}>`
  position: relative;
  width: 100%;
  height: ${({ size }) => DROPDOWN_SIZES[size].height};
  font-size: ${({ size }) => DROPDOWN_SIZES[size].fontSize};
  ${({ variant }) => DROPDOWN_VARIANTS[variant]};
  border-color: ${({ error, highContrast, theme }) => 
    error ? theme.palette.error.main : 
    highContrast ? '#000000' : 
    theme.palette.grey[300]};
  background-color: ${({ theme, disabled }) => 
    disabled ? theme.palette.action.disabledBackground : 
    theme.palette.background.paper};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.6 : 1};
  transition: all 0.2s ease-in-out;

  &:focus-within {
    outline: none;
    border-color: ${({ theme, highContrast }) => 
      highContrast ? '#000000' : theme.palette.primary.main};
    box-shadow: 0 0 0 3px ${({ theme, highContrast }) => 
      highContrast ? 'rgba(0,0,0,0.2)' : `${theme.palette.primary.main}33`};
  }
`;

const DropdownTrigger = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: inherit;
`;

const DropdownMenu = styled.ul<{ highContrast: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  margin-top: ${spacing(1)}px;
  padding: ${spacing(1)}px 0;
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: 4px;
  box-shadow: ${({ highContrast }) => 
    highContrast ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)'};
  z-index: 1000;
  list-style: none;
`;

const DropdownOption = styled.li<{
  selected: boolean;
  disabled: boolean;
  highContrast: boolean;
}>`
  padding: ${spacing(1)}px ${spacing(2)}px;
  background-color: ${({ selected, theme, highContrast }) => 
    selected ? (highContrast ? '#000000' : theme.palette.primary.light) : 'transparent'};
  color: ${({ selected, theme, highContrast }) => 
    selected ? (highContrast ? '#FFFFFF' : theme.palette.primary.contrastText) : theme.palette.text.primary};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.6 : 1};
  
  &:hover:not(:disabled) {
    background-color: ${({ theme, highContrast }) => 
      highContrast ? 'rgba(0,0,0,0.1)' : theme.palette.action.hover};
  }
`;

const SearchInput = styled(StyledInput)`
  margin: ${spacing(1)}px;
  width: calc(100% - ${spacing(2)}px);
`;

// Component
export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  multiple = false,
  searchable = false,
  placeholder = 'Select option',
  disabled = false,
  error = false,
  size = 'medium',
  variant = 'outlined',
  highContrast = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Click outside handler
  useClickOutside(containerRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setSearchTerm('');
      setActiveIndex(-1);
    }
  });

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Handle option selection
  const handleSelect = useCallback((option: DropdownOption) => {
    if (disabled || option.disabled) return;

    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      const newValue = values.includes(option.value)
        ? values.filter(v => v !== option.value)
        : [...values, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
      setSearchTerm('');
    }
  }, [disabled, multiple, value, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          setIsOpen(true);
          e.preventDefault();
        } else if (activeIndex >= 0) {
          handleSelect(filteredOptions[activeIndex]);
          e.preventDefault();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setActiveIndex(-1);
        break;
    }
  }, [disabled, isOpen, activeIndex, filteredOptions, handleSelect]);

  // Selected option labels
  const selectedLabels = useMemo(() => {
    const values = Array.isArray(value) ? value : [value];
    return options
      .filter(option => values.includes(option.value))
      .map(option => option.label)
      .join(', ');
  }, [value, options]);

  return (
    <DropdownContainer
      ref={containerRef}
      size={size}
      variant={variant}
      disabled={disabled}
      error={error}
      highContrast={highContrast}
      onClick={() => !disabled && setIsOpen(true)}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-controls={isOpen ? 'dropdown-menu' : undefined}
      aria-activedescendant={activeIndex >= 0 ? `option-${activeIndex}` : undefined}
    >
      <DropdownTrigger>
        <span>{selectedLabels || placeholder}</span>
        <span aria-hidden="true">▼</span>
      </DropdownTrigger>

      {isOpen && (
        <DropdownMenu
          ref={menuRef}
          highContrast={highContrast}
          id="dropdown-menu"
          role="listbox"
          aria-multiselectable={multiple}
        >
          {searchable && (
            <SearchInput
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search..."
              aria-label="Search options"
              variant="outlined"
              size={size}
            />
          )}
          
          {filteredOptions.map((option, index) => {
            const isSelected = Array.isArray(value) 
              ? value.includes(option.value)
              : value === option.value;

            return (
              <DropdownOption
                key={option.value}
                id={`option-${index}`}
                selected={isSelected}
                disabled={!!option.disabled}
                highContrast={highContrast}
                onClick={() => handleSelect(option)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
              >
                {option.label}
              </DropdownOption>
            );
          })}
        </DropdownMenu>
      )}
    </DropdownContainer>
  );
};

export default Dropdown;