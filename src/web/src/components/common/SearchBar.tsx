import React, { useState, useCallback, useRef } from 'react';
import { debounce } from 'lodash'; // v4.17.21
import { SearchIcon } from '@mui/icons-material'; // v5.0.0
import { CircularProgress } from '@mui/material'; // v5.0.0
import { StyledInput } from '../../styles/components.styles';
import { sanitizeInput } from '../../utils/validation.util';
import { useTheme } from '../../hooks/useTheme';

// Constants for search behavior
const DEFAULT_DEBOUNCE_TIME = 300;
const DEFAULT_PLACEHOLDER = 'Search...';
const MAX_QUERY_LENGTH = 100;
const MIN_QUERY_LENGTH = 2;

// Props interface for the SearchBar component
interface SearchBarProps {
  /** Current search value */
  value: string;
  /** Callback function triggered on search */
  onSearch: (searchTerm: string) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Debounce time in milliseconds */
  debounceTime?: number;
  /** Optional CSS class name */
  className?: string;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Error message for validation failures */
  error?: string;
  /** Maximum length of search query */
  maxLength?: number;
  /** Accessibility label */
  ariaLabel?: string;
}

/**
 * A reusable search bar component with real-time search functionality,
 * debouncing, accessibility features, and Material Design 3.0 styling.
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onSearch,
  placeholder = DEFAULT_PLACEHOLDER,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  className,
  isLoading = false,
  error,
  maxLength = MAX_QUERY_LENGTH,
  ariaLabel = 'Search input field'
}) => {
  // Local state for controlled input
  const [searchTerm, setSearchTerm] = useState<string>(value);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Theme context for styling
  const { theme, mode } = useTheme();

  // Ref for the input element
  const inputRef = useRef<HTMLInputElement>(null);

  // Status message for screen readers
  const statusRef = useRef<HTMLDivElement>(null);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      if (term.length >= MIN_QUERY_LENGTH || term.length === 0) {
        onSearch(term);
        // Update aria-live region for screen readers
        if (statusRef.current) {
          statusRef.current.textContent = term.length > 0 
            ? `Search results updating for ${term}`
            : 'Search cleared';
        }
      }
    }, debounceTime),
    [onSearch, debounceTime]
  );

  // Input change handler with validation and sanitization
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    
    // Prevent input if exceeding max length
    if (rawValue.length > maxLength) {
      event.preventDefault();
      return;
    }

    // Sanitize input to prevent XSS
    const sanitizedValue = sanitizeInput(rawValue);
    setSearchTerm(sanitizedValue);
    debouncedSearch(sanitizedValue);
  };

  // Keyboard event handler for accessibility
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (searchTerm.length >= MIN_QUERY_LENGTH || searchTerm.length === 0) {
        debouncedSearch.flush();
        // Update aria-live region
        if (statusRef.current) {
          statusRef.current.textContent = 'Search submitted';
        }
      }
    }
  };

  // Focus handlers for visual feedback
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '600px'
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <SearchIcon
          sx={{
            position: 'absolute',
            left: '12px',
            color: error ? theme.palette.error.main :
              isFocused ? theme.palette.primary.main :
              theme.palette.text.secondary,
            transition: 'color 0.2s ease'
          }}
        />
        <StyledInput
          ref={inputRef}
          type="search"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          error={!!error}
          disabled={isLoading}
          aria-label={ariaLabel}
          aria-invalid={!!error}
          aria-describedby={error ? 'search-error' : undefined}
          style={{
            paddingLeft: '44px',
            paddingRight: isLoading ? '44px' : '12px'
          }}
        />
        {isLoading && (
          <CircularProgress
            size={20}
            sx={{
              position: 'absolute',
              right: '12px',
              color: theme.palette.primary.main
            }}
          />
        )}
      </div>
      {error && (
        <div
          id="search-error"
          role="alert"
          style={{
            color: theme.palette.error.main,
            fontSize: '0.75rem',
            marginTop: '4px',
            marginLeft: '12px'
          }}
        >
          {error}
        </div>
      )}
      {/* Hidden status element for screen readers */}
      <div
        ref={statusRef}
        role="status"
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          border: '0'
        }}
      />
    </div>
  );
};

export default SearchBar;