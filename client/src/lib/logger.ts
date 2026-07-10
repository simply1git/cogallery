// Simple logger service with environment-based logging levels
// In development: logs all levels to console
// In production: only errors and warnings to console, errors also sent to Sentry

import * as Sentry from '@sentry/react';

// Log levels
type LogLevel = 'log' | 'info' | 'warn' | 'error';

interface Logger {
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

// Determine if we're in development
const isDev = import.meta.env?.DEV === true;

// Set log level based on environment
// 0: error, 1: warn, 2: info, 3: log
const getLogLevel = (): number => {
  if (import.meta.env?.DEV === true) return 3; // Log everything in development
  return 1; // Only warn and error in production
};

// Check if a level should be logged based on current log level
const shouldLog = (level: LogLevel): boolean => {
  const levelMap: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    log: 3
  };
  return levelMap[level] <= getLogLevel();
};

// Initialize Sentry if DSN is available
const initSentry = () => {
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  const isDev = import.meta.env?.DEV === true;
  if (dsn && !isDev) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      tracesSampler: (samplingContext) => {
        // Adjust sampling rate based on transaction context
        return 0.1;
      },
    });
  }
};

// Initialize Sentry on module load (only in production)
if (import.meta.env?.DEV !== true) {
  initSentry();
}

// Log to console with timestamp
const consoleLog = (level: LogLevel, ...args: any[]) => {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const formattedArgs = [`[${timestamp}] [${label.toUpperCase()}]`, ...args];

  switch (level) {
    case 'error':
      console.error(...formattedArgs);
      break;
    case 'warn':
      console.warn(...formattedArgs);
      break;
    case 'info':
      console.info(...formattedArgs);
      break;
    default:
      console.log(...formattedArgs);
  }
};

const label = 'cogallery';

export const logger: Logger = {
  log: (...args: any[]) => {
    consoleLog('log', ...args);
  },
  info: (...args: any[]) => {
    consoleLog('info', ...args);
  },
  warn: (...args: any[]) => {
    consoleLog('warn', ...args);
  },
  error: (...args: any[]) => {
    consoleLog('error', ...args);
    // Send error to Sentry in production
    if (import.meta.env?.DEV !== true) {
      // If the last argument is an Error object, capture it directly
      // Otherwise, create a new Error from the message
      const errorArg = args.find(arg => arg instanceof Error);
      if (errorArg) {
        Sentry.captureException(errorArg);
      } else {
        const message = args.map(arg =>
          typeof arg === 'string' ? arg :
          typeof arg === 'object' ? JSON.stringify(arg) :
          String(arg)
        ).join(' ');
        Sentry.captureException(new Error(message));
      }
    }
  }
};

// Export a function to update the label if needed (for scoped logging)
export const setLoggerLabel = (newLabel: string) => {
  // Note: In a more advanced implementation, we might return a new logger instance
  // For simplicity, we're just updating the closure variable
  // This is a limitation - in practice, you might want to create a logger factory
  // But for our use case, a global logger is sufficient
  // We'll leave this as a no-op for now since we're using a singleton
  // In a real app, you might want to recreate the logger or use a different approach
};