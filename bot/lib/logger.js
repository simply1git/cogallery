// Structured logging service for CoGallery Bot
// Provides consistent logging with levels, context, and transport options

import pino from 'pino';
import os from 'os';

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';

// Create logger instance
const logger = pino({
  level: logLevel,
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        }
      }
    : undefined,
  // Add timestamp and hostname automatically
  base: {
    pid: process.pid,
    hostname: os.hostname()
  },
  // Custom serializers for common objects
  serializers: {
    req: (req) => {
      return {
        method: req.method,
        url: req.url,
        headers: req.headers
      };
    },
    res: (res) => {
      return {
        statusCode: res.statusCode,
        headers: res.getHeaders ? res.getHeaders() : {}
      };
    },
    error: pino.stdSerializers.err
  }
});

// Logger wrapper with context enrichment
export class LoggerService {
  constructor() {
    this.logger = logger;
  }

  // Create a child logger with additional bindings
  child(bindings) {
    return new LoggerService(this.logger.child(bindings));
  }

  // Logging methods with automatic error serialization
  trace(msg, ...args) {
    this.logger.trace(this.formatArgs(msg, args));
  }

  debug(msg, ...args) {
    this.logger.debug(this.formatArgs(msg, args));
  }

  info(msg, ...args) {
    this.logger.info(this.formatArgs(msg, args));
  }

  warn(msg, ...args) {
    this.logger.warn(this.formatArgs(msg, args));
  }

  error(msg, ...args) {
    this.logger.error(this.formatArgs(msg, args));
  }

  fatal(msg, ...args) {
    this.logger.fatal(this.formatArgs(msg, args));
  }

  // Format arguments similar to console.log
  formatArgs(msg, args) {
    if (args.length === 0) return msg;

    // If msg is an object, Pino will treat it as a bindings object.
    // In that case, we should just return an array of [msg, ...args] for pino to handle.
    // Or, for wrapper compatibility, we can just return [msg, ...args].
    // Wait, Pino allows multiple args. The wrapper calls `this.logger.info(this.formatArgs(msg, args))`
    // If formatArgs returns an array, wait, `this.logger.info` expects arguments, not an array.
    // Let's just return msg if it's an object and merge args, but actually we need to return an array of args or an object.
    // Since `this.logger.info` doesn't spread, wait, the wrapper says:
    // `this.logger.info(this.formatArgs(msg, args))` so formatArgs must return a SINGLE argument or we can't do that.
    // Actually Pino supports `logger.info(obj, msg, ...args)`.
    
    // Let's rewrite trace, debug, info, etc. instead to use spread, but wait, I can just do:
    if (typeof msg === 'object') {
      return Object.assign({}, msg, { args });
    }

    // If first arg is an Error object, let pino serialize it properly
    if (args.length === 1 && args[0] instanceof Error) {
      return { msg, err: args[0] };
    }

    // Otherwise, format as message with additional parameters
    let formatted = String(msg);
    formatted = args.reduce((formattedMsg, arg, index) => {
      // Replace placeholders like %s, %d, %j
      return formattedMsg.replace(/%[sdj]/,
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg));
    }, formatted);

    // If there are remaining args, attach them as an object
    if (args.length > 1) {
      return { msg: formatted, args: args.slice(1) };
    }

    return { msg: formatted };
  }

  // Specialized logging methods
  http(req, res) {
    this.logger.info({
      req: {
        method: req.method,
        url: req.url,
        headers: req.headers
      },
      res: {
        statusCode: res.statusCode
      }
    }, 'HTTP request');
  }

  // Performance timing utility
  time(name) {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.logger.info({ duration_ms: duration, operation: name }, `Operation completed`);
    };
  }
}

// Export singleton instance
const loggerService = new LoggerService();
export default loggerService;