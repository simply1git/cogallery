// Advanced Rate Limiting and Abuse Prevention Service
// Provides sophisticated rate limiting with abuse detection and automatic banning

const crypto = require('crypto');

class RateLimiterService {
  constructor(options = {}) {
    this.enabled = process.env.RATE_LIMIT_ENABLED !== 'false';

    // Default limits
    this.limits = {
      // Global IP-based limits
      global: {
        windowMs: 60 * 1000, // 1 minute
        max: 100,            // 100 requests per minute
        banThreshold: 5,     // Ban after 5 violations
        banDuration: 15 * 60 * 1000 // 15 minutes
      },

      // Authentication endpoints
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10,                  // 10 attempts per 15 minutes
        banThreshold: 3,          // Ban after 3 failures
        banDuration: 30 * 60 * 1000 // 30 minutes
      },

      // Upload endpoints
      upload: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 50,                 // 50 uploads per 5 minutes
        banThreshold: 3,         // Ban after 3 violations
        banDuration: 30 * 60 * 1000 // 30 minutes
      },

      // Media streaming
      media: {
        windowMs: 60 * 1000, // 1 minute
        max: 200,            // 200 requests per minute
        banThreshold: 10,    // Ban after 10 violations
        banDuration: 5 * 60 * 1000 // 5 minutes
      },

      // Admin endpoints
      admin: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 20,                 // 20 requests per 5 minutes
        banThreshold: 2,         // Ban after 2 violations
        banDuration: 60 * 60 * 1000 // 1 hour
      }
    };

    // Override defaults with provided options
    if (options.limits) {
      this.limits = { ...this.limits, ...options.limits };
    }

    // Storage for tracking requests and bans
    this.requestHistory = new Map(); // Key: identifier, Value: array of timestamps
    this.bannedIPs = new Map();      // Key: IP, Value: { expiry: timestamp, reason: string }
    this.failureCounts = new Map();  // Key: identifier, Value: count of consecutive failures

    // Cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

    // Import logger if available
    try {
      this.logger = require('./logger');
    } catch (err) {
      this.logger = {
        info: () => {},
        warn: () => {},
        error: () => {}
      };
    }
  }

  /**
   * Generate a unique identifier for rate limiting
   * @param {Object} req - Express request object
   * @param {string} type - Type of rate limit (e.g., 'ip', 'user')
   * @returns {string} - Unique identifier
   */
  getIdentifier(req, type = 'ip') {
    switch (type) {
      case 'user':
        return req.user?.sub || req.headers['x-user-id'] || 'anonymous';
      case 'api-key':
        return req.headers['x-api-key'] || 'no-key';
      case 'ip':
      default:
        // Get real IP behind proxies
        return req.headers['x-forwarded-for'] ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               'unknown';
    }
  }

  /**
   * Check if an identifier is currently banned
   * @param {string} identifier - The identifier to check
   * @returns {boolean|null} - True if banned, null if not banned, false if expired
   */
  isBanned(identifier) {
    if (!this.enabled) return false;

    const banInfo = this.bannedIPs.get(identifier);
    if (!banInfo) return false;

    if (Date.now() > banInfo.expiry) {
      // Ban expired, remove it
      this.bannedIPs.delete(identifier);
      this.logger.info({ identifier, reason: banInfo.reason }, 'Ban expired');
      return false;
    }

    return true;
  }

  /**
   * Ban an identifier for a specified duration
   * @param {string} identifier - The identifier to ban
   * @param {number} durationMs - Ban duration in milliseconds
   * @param {string} reason - Reason for the ban
   */
  ban(identifier, durationMs, reason = 'Rate limit exceeded') {
    if (!this.enabled) return;

    const expiry = Date.now() + durationMs;
    this.bannedIPs.set(identifier, { expiry, reason });

    this.logger.warn({
      identifier,
      durationMs,
      reason,
      expiry: new Date(expiry).toISOString()
    }, 'User banned due to rate limit violation');
  }

  /**
   * Clean up old records to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();

    // Clean request history (older than 1 hour)
    for (const [key, timestamps] of this.requestHistory.entries()) {
      const oneHourAgo = now - 3600 * 1000;
      const filtered = timestamps.filter(t => t > oneHourAgo);
      if (filtered.length === 0) {
        this.requestHistory.delete(key);
      } else {
        this.requestHistory.set(key, filtered);
      }
    }

    // Clean expired bans
    for (const [key, banInfo] of this.bannedIPs.entries()) {
      if (now > banInfo.expiry) {
        this.bannedIPs.delete(key);
        this.logger.info({ identifier: key }, 'Expired ban removed during cleanup');
      }
    }

    // Clean failure counts (older than 1 hour)
    for (const [key, count] of this.failureCounts.entries()) {
      // In a real implementation, we'd track timestamps for failures too
      // For simplicity, we'll keep this as is and rely on periodic cleanup
    }
  }

  /**
   * Check if a request is allowed based on rate limits
   * @param {Object} req - Express request object
   * @param {string} limitType - Type of limit to apply (from this.limits)
   * @param {Object} options - Additional options
   * @returns {Object} - Result with allowed boolean and headers info
   */
  checkRateLimit(req, limitType = 'global', options = {}) {
    if (!this.enabled) {
      return { allowed: true, limit: 0, remaining: Infinity, resetTime: 0 };
    }

    const limits = this.limits[limitType] || this.limits.global;
    const identifier = this.getIdentifier(req, options.identifierType || 'ip');

    // Check if IP is banned
    if (this.isBanned(identifier)) {
      const banInfo = this.bannedIPs.get(identifier);
      return {
        allowed: false,
        reason: 'banned',
        message: `IP banned due to ${banInfo.reason}. Try again after ${new Date(banInfo.expiry).toLocaleTimeString()}`,
        retryAfter: Math.ceil((banInfo.expiry - Date.now()) / 1000)
      };
    }

    // Initialize request history for this identifier if not exists
    if (!this.requestHistory.has(identifier)) {
      this.requestHistory.set(identifier, []);
    }

    const requests = this.requestHistory.get(identifier);
    const now = Date.now();
    const windowStart = now - (limits.windowMs || 60000);

    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    this.requestHistory.set(identifier, validRequests);

    // Check if limit exceeded
    if (validRequests.length >= (limits.max || 100)) {
      // Increment failure count for abuse detection
      const failureCount = (this.failureCounts.get(identifier) || 0) + 1;
      this.failureCounts.set(identifier, failureCount);

      // Check if we should ban for abuse
      if (failureCount >= (limits.banThreshold || 5)) {
        this.ban(
          identifier,
          limits.banDuration || (15 * 60 * 1000),
          `Exceeded ${limitType} rate limit ${failureCount} times`
        );

        return {
          allowed: false,
          reason: 'banned',
          message: `IP banned due to repeated ${limitType} rate limit violations`,
          retryAfter: Math.ceil((limits.banDuration || (15 * 60 * 1000)) / 1000)
        };
      }

      // Rate limit exceeded but not yet banned
      return {
        allowed: false,
        reason: 'rate_limited',
        message: `Too many requests, please try again later`,
        retryAfter: Math.ceil((windowStart + (limits.windowMs || 60000) - now) / 1000)
      };
    }

    // Add current request timestamp
    validRequests.push(now);
    this.requestHistory.set(identifier, validRequests);

    // Reset failure count on successful request
    this.failureCounts.set(identifier, 0);

    // Calculate reset time
    const resetTime = new Date(now + (limits.windowMs || 60000));

    return {
      allowed: true,
      limit: limits.max || 100,
      remaining: (limits.max || 100) - validRequests.length,
      resetTime: resetTime.getTime()
    };
  }

  /**
   * Record a failed attempt (for auth endpoints, etc.)
   * @param {Object} req - Express request object
   * @param {string} failureType - Type of failure (e.g., 'invalid_password')
   */
  recordFailure(req, failureType = 'unknown') {
    if (!this.enabled) return;

    const identifier = this.getIdentifier(req, 'ip');
    const failureCount = (this.failureCounts.get(identifier) || 0) + 1;
    this.failureCounts.set(identifier, failureCount);

    this.logger.warn({
      identifier,
      failureType,
      failureCount
    }, `Authentication failure recorded for ${identifier}`);

    // Check if we should ban for excessive failures
    const authLimits = this.limits.auth;
    if (failureCount >= (authLimits.banThreshold || 3)) {
      this.ban(
        identifier,
        authLimits.banDuration || (30 * 60 * 1000),
        `Exceeded authentication failure limit (${failureCount} failures)`
      );
    }
  }

  /**
   * Express middleware for rate limiting
   * @param {string} limitType - Type of limit to apply
   * @param {Object} options - Additional options
   * @returns {Function} - Express middleware function
   */
  middleware(limitType = 'global', options = {}) {
    return (req, res, next) => {
      const result = this.checkRateLimit(req, limitType, options);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit || 0);
      res.setHeader('X-RateLimit-Remaining', result.remaining || 0);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime || Date.now()).toISOString());

      if (result.allowed) {
        // Reset retry-after header on success
        res.removeHeader('Retry-After');
        next();
      } else {
        // Set retry-after header for rate limiting
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }

        // Log the rate limit violation
        this.logger.warn({
          ip: this.getIdentifier(req, 'ip'),
          user: req.user?.sub || 'unknown',
          path: req.path,
          method: req.method,
          reason: result.reason,
          details: result.message
        }, `Rate limit exceeded: ${result.reason}`);

        // Send appropriate response
        const statusCode = result.reason === 'banned' ? 403 : 429;
        res.status(statusCode).json({
          error: result.message || 'Too many requests',
          type: result.reason
        });
      }
    };
  }

  /**
   * Shutdown the rate limiter (clean up intervals)
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
const rateLimiterService = new RateLimiterService();
module.exports = rateLimiterService;

// Also export class for creating additional instances
module.exports.RateLimiterService = RateLimiterService;