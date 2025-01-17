import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material'; // v5.14.0
import { StyledInput } from '../../styles/components.styles';
import { theme } from '../../styles/theme.styles';
import { sanitizeInput } from '../../utils/validation.util';

// Input component props interface with comprehensive type definitions
export interface InputProps {
  /** Input value for controlled components */
  value?: string;
  /** Default value for uncontrolled components */
  defaultValue?: string;
  /** Input placeholder text */
  placeholder?: string;
  /** HTML input type */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
  /** Input name attribute */
  name?: string;
  /** Input id attribute */
  id?: string;
  /** Disables the input */
  disabled?: boolean;
  /** Makes the input required */
  required?: boolean;
  /** Shows error state */
  error?: boolean;
  /** Helper text displayed below input */
  helperText?: string;
  /** Input variant */
  variant?: 'outlined' | 'filled';
  /** Input size */
  size?: 'small' | 'medium' | 'large';
  /** Regular expression pattern for validation */
  pattern?: string;
  /** Maximum length of input value */
  maxLength?: number;
  /** Input mask pattern */
  mask?: string;
  /** Shows clear button when input has value */
  clearable?: boolean;
  /** Shows loading indicator */
  loading?: boolean;
  /** Content to show before input */
  prefix?: React.ReactNode;
  /** Content to show after input */
  suffix?: React.ReactNode;
  /** Change event handler */
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Focus event handler */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Blur event handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Custom validation function */
  validate?: (value: string) => boolean;
}

/**
 * A reusable, accessible input component following Material Design 3.0 specifications.
 * Supports different variants, states, validation, and theming.
 * Implements WCAG 2.1 Level AA compliance with comprehensive ARIA support.
 */
export const Input = React.memo(({
  value,
  defaultValue = '',
  placeholder,
  type = 'text',
  name,
  id,
  disabled = false,
  required = false,
  error = false,
  helperText,
  variant = 'outlined',
  size = 'medium',
  pattern,
  maxLength,
  mask,
  clearable = false,
  loading = false,
  prefix,
  suffix,
  onChange,
  onFocus,
  onBlur,
  validate,
}: InputProps) => {
  // Theme and refs
  const muiTheme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputId] = useState(`input-${Math.random().toString(36).substr(2, 9)}`);
  
  // Internal state
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const [internalError, setInternalError] = useState(error);
  const [errorMessage, setErrorMessage] = useState(helperText);

  // Apply mask to value if specified
  const applyMask = useCallback((value: string): string => {
    if (!mask) return value;
    
    let maskedValue = '';
    let valueIndex = 0;
    
    for (let i = 0; i < mask.length && valueIndex < value.length; i++) {
      if (mask[i] === '#') {
        maskedValue += value[valueIndex];
        valueIndex++;
      } else {
        maskedValue += mask[i];
      }
    }
    
    return maskedValue;
  }, [mask]);

  // Validate input value
  const validateInput = useCallback((value: string): boolean => {
    if (pattern && !new RegExp(pattern).test(value)) {
      setErrorMessage('Input format is invalid');
      return false;
    }

    if (maxLength && value.length > maxLength) {
      setErrorMessage(`Maximum length is ${maxLength} characters`);
      return false;
    }

    if (validate && !validate(value)) {
      setErrorMessage(helperText || 'Invalid input');
      return false;
    }

    setErrorMessage(helperText);
    return true;
  }, [pattern, maxLength, validate, helperText]);

  // Handle input change
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    
    let newValue = sanitizeInput(event.target.value);
    if (mask) {
      newValue = applyMask(newValue);
    }

    const isValid = validateInput(newValue);
    setInternalError(!isValid);

    if (!value) {
      setInternalValue(newValue);
    }

    onChange?.(newValue, event);
  }, [value, onChange, applyMask, validateInput, mask]);

  // Handle input focus
  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    
    // Announce to screen readers
    if (required) {
      inputRef.current?.setAttribute('aria-required', 'true');
    }
    
    onFocus?.(event);
  }, [required, onFocus]);

  // Handle input blur
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    
    const currentValue = value || internalValue;
    const isValid = validateInput(currentValue);
    setInternalError(!isValid);
    
    // Announce validation errors to screen readers
    if (!isValid) {
      inputRef.current?.setAttribute('aria-invalid', 'true');
    }
    
    onBlur?.(event);
  }, [value, internalValue, validateInput, onBlur]);

  // Handle clear button click
  const handleClear = useCallback(() => {
    if (disabled) return;
    
    if (!value) {
      setInternalValue('');
    }
    
    onChange?.('', new Event('change') as any);
    inputRef.current?.focus();
  }, [disabled, value, onChange]);

  // Update internal error state when error prop changes
  useEffect(() => {
    setInternalError(error);
  }, [error]);

  // Update error message when helperText changes
  useEffect(() => {
    setErrorMessage(helperText);
  }, [helperText]);

  return (
    <div
      className="input-container"
      style={{
        position: 'relative',
        width: '100%',
        marginBottom: theme.spacing(2)
      }}
    >
      {prefix && (
        <div className="input-prefix" aria-hidden="true">
          {prefix}
        </div>
      )}
      
      <StyledInput
        ref={inputRef}
        id={id || inputId}
        name={name}
        type={type}
        value={value !== undefined ? value : internalValue}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        pattern={pattern}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        variant={variant}
        error={internalError}
        aria-invalid={internalError}
        aria-describedby={`${inputId}-helper-text`}
        data-focused={isFocused}
        style={{
          paddingLeft: prefix ? '2.5rem' : undefined,
          paddingRight: (suffix || clearable || loading) ? '2.5rem' : undefined
        }}
      />

      {(suffix || clearable || loading) && (
        <div className="input-suffix" aria-hidden="true">
          {loading && <div className="input-loading-indicator" />}
          {clearable && value && (
            <button
              type="button"
              className="input-clear-button"
              onClick={handleClear}
              aria-label="Clear input"
              tabIndex={-1}
            >
              ✕
            </button>
          )}
          {suffix}
        </div>
      )}

      {errorMessage && (
        <div
          id={`${inputId}-helper-text`}
          className="input-helper-text"
          role="alert"
          aria-live="polite"
          style={{
            color: internalError ? muiTheme.palette.error.main : muiTheme.palette.text.secondary,
            fontSize: '0.75rem',
            marginTop: '0.25rem'
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';