// Enhanced Error Boundary with Context Enrichment
// Provides better error reporting with contextual information for debugging

import * as React from 'react';
import * as Sentry from '@sentry/react';
import { logger } from './logger';

interface ErrorBoundaryProps {
  /** Fallback UI to show when an error occurs */
  fallback: React.ComponentType<{ error: Error; resetError: () => void }>;
  /** Children components to wrap */
  children: React.ReactNode;
  /** Optional prefix for error logging */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Enhanced Error Boundary that captures errors and provides rich context
 * for debugging while showing a fallback UI to users.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (import.meta && (import.meta as any).env && (import.meta as any).env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Enhance error with contextual information
    const enhancedError = this.enhanceError(error, errorInfo);

    // Send to Sentry (in production)
    if (!(import.meta && (import.meta as any).env && (import.meta as any).env.DEV)) {
      Sentry.captureException(enhancedError, {
        extra: {
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          ...this.getAdditionalContext()
        }
      });
    }

    // Log with our logger
    logger.error('ErrorBoundary caught error:', {
      error: enhancedError.message,
      stack: enhancedError.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href
    });

    // Update state to show fallback UI
    this.setState({
      hasError: true,
      error: enhancedError,
      errorInfo
    });
  }

  /**
   * Enhances the error with additional context information
   */
  private enhanceError(error: Error, errorInfo: React.ErrorInfo): Error {
    // Create a new error with enhanced message
    const enhancedError = new Error(
      `[${this.props.name || 'Component'}] ${error.message}`
    );

    // Preserve original stack trace
    enhancedError.stack = error.stack;

    // Add custom properties
    (enhancedError as any).componentStack = errorInfo.componentStack;
    (enhancedError as any).url = window.location.href;
    (enhancedError as any).timestamp = new Date().toISOString();

    return enhancedError;
  }

  /**
   * Gets additional context information for error reporting
   */
  private getAdditionalContext() {
    try {
      return {
        // Page information
        pathname: window.location.pathname,
        search: window.location.search,

        // Browser information
        language: navigator.language,
        platform: navigator.platform,

        // Performance information if available
        performance: (() => {
          if (performance && (performance as any).memory) {
            const mem = (performance as any).memory;
            return {
              usedJSHeapSize: mem.usedJSHeapSize,
              totalJSHeapSize: mem.totalJSHeapSize,
              jsHeapSizeLimit: mem.jsHeapSizeLimit,
            };
          }
          return undefined;
        })(),

        // Application state (if available from stores)
        // This would require importing store instances - be careful about circular deps
      };
    } catch (e) {
      // If gathering context fails, don't let it break error reporting
      return { contextError: String(e) };
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return React.createElement(FallbackComponent, {
        error: this.state.error,
        resetError: this.resetError.bind(this)
      });
    }

    return this.props.children;
  }

  /**
   * Resets the error state to allow recovery
   */
  resetError() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }
}

/**
 * Wrapper component that provides a default fallback UI
 */
function ErrorBoundaryWithFallback({
  children,
  name,
  fallbackComponent
}: {
  children: React.ReactNode;
  name?: string;
  fallbackComponent?: React.ComponentType<{ error: Error; resetError: () => void }>
}): React.ReactNode {
  const DefaultFallback = ({ error, resetError }: { error: Error; resetError: () => void }) =>
    React.createElement(
      'div',
      null,
      React.createElement('p', null, error.message),
      React.createElement('button', { onClick: resetError }, 'Try Again')
    );

  return React.createElement(
    ErrorBoundary,
    {
      name: name,
      fallback: fallbackComponent || DefaultFallback
    },
    children
  );
}

// Export both components
export { ErrorBoundary, ErrorBoundaryWithFallback };