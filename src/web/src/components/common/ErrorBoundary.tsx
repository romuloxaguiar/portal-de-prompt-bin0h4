/**
 * @fileoverview React Error Boundary component for standardized error handling
 * Provides fallback UI, error reporting, and recovery mechanisms for React component errors
 * @version 1.0.0
 */

import React, { Component, ErrorInfo } from 'react'; // v18.0.0
import { handleError } from '../../utils/error.util';
import { ErrorCode } from '../../constants/error.constant';

/**
 * Props interface for ErrorBoundary component
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnRouteChange?: boolean;
}

/**
 * State interface for ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary component that catches JavaScript errors anywhere in the
 * child component tree and displays a fallback UI
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount: number = 0;
  private readonly MAX_RETRIES: number = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };

    this.resetErrorBoundary = this.resetErrorBoundary.bind(this);

    // Set up route change listener if resetOnRouteChange is enabled
    if (props.resetOnRouteChange) {
      window.addEventListener('popstate', this.resetErrorBoundary);
    }
  }

  /**
   * Static method to derive error state from caught errors
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  /**
   * Lifecycle method called when an error is caught
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update component state with error details
    this.setState({
      errorInfo
    });

    // Process error through central error handling utility
    const processedError = handleError(error);

    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Detailed logging in development environment
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', {
        error: processedError,
        componentStack: errorInfo.componentStack
      });
    }

    // Handle network errors with automatic retry
    if (processedError.code === ErrorCode.NETWORK_ERROR && this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      setTimeout(() => {
        this.resetErrorBoundary();
      }, Math.pow(2, this.retryCount) * 1000); // Exponential backoff
    }
  }

  /**
   * Cleanup event listeners on unmount
   */
  componentWillUnmount(): void {
    if (this.props.resetOnRouteChange) {
      window.removeEventListener('popstate', this.resetErrorBoundary);
    }
  }

  /**
   * Resets the error boundary state
   */
  resetErrorBoundary(): void {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    this.retryCount = 0;
  }

  /**
   * Default fallback UI component
   */
  private renderDefaultFallback(): React.ReactNode {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="error-boundary-fallback"
      >
        <h2>Something went wrong</h2>
        <p>We apologize for the inconvenience. Please try again or contact support if the issue persists.</p>
        <button
          onClick={this.resetErrorBoundary}
          aria-label="Retry"
          className="error-boundary-retry"
        >
          Try Again
        </button>
      </div>
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided, otherwise use default
      return (
        <div role="alert" aria-live="assertive">
          {this.props.fallback || this.renderDefaultFallback()}
        </div>
      );
    }

    // Render children if no error
    return this.props.children;
  }
}

export default ErrorBoundary;