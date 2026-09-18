// Immutable Audit Logging Service for Security Events
// Provides tamper-evident logging for security-sensitive events

const crypto = require('crypto');
const { createHash } = crypto;

class AuditLogger {
  constructor(options = {}) {
    this.enabled = process.env.AUDIT_LOG_ENABLED !== 'false';
    this.store = []; // In-memory store (or external append-only log)
    this.chainId = null; // Hash of previous entry for chaining
    this.maxSize = options.maxSize || 10000;

    try {
      this.logger = require('./logger');
    } catch (err) {
      this.logger = {
        info: () => {},
        warn: () => {},
        error: () => {}
      };
    }

    this._createGenesisBlock();
  }

  /**
   * Create genesis block for the audit chain
   */
  _createGenesisBlock() {
    const timestamp = new Date().toISOString();
    const data = { action: 'SYSTEM_START', message: 'Audit log initialized' };
    const prevHash = '0'.repeat(64);
    const hash = this._calculateHash(0, timestamp, data, prevHash);

    const genesisBlock = {
      index: 0,
      timestamp,
      data,
      previousHash: prevHash,
      hash
    };

    this.store.push(genesisBlock);
    this.chainId = genesisBlock.hash;
  }

  /**
   * Calculate SHA-256 hash of a block
   */
  _calculateHash(index, timestamp, data, previousHash) {
    const dataString = JSON.stringify({ index, timestamp, data, previousHash });
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Log an audit event
   * @param {string} action - Event type
   * @param {object} data - Event payload/details
   * @returns {object} The created audit block
   */
  log(action, data = {}) {
    if (!this.enabled) return null;

    const index = this.store.length;
    const timestamp = new Date().toISOString();
    const previousHash = this.chainId || '0'.repeat(64);
    const eventData = { action, ...data };
    const hash = this._calculateHash(index, timestamp, eventData, previousHash);

    const block = {
      index,
      timestamp,
      data: eventData,
      previousHash,
      hash
    };

    if (this.store.length >= this.maxSize) {
      this.store.shift(); // Evict oldest if exceeding capacity
    }

    this.store.push(block);
    this.chainId = hash;

    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(`[AUDIT] ${action}`, { hash, index, timestamp });
    }

    return block;
  }

  /**
   * Verify the integrity of the audit chain
   * @returns {{ valid: boolean, error?: string, brokenIndex?: number }}
   */
  verifyChain() {
    for (let i = 1; i < this.store.length; i++) {
      const currentBlock = this.store[i];
      const previousBlock = this.store[i - 1];

      if (currentBlock.previousHash !== previousBlock.hash) {
        return {
          valid: false,
          error: 'Broken hash linkage',
          brokenIndex: i
        };
      }

      const recalculatedHash = this._calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash
      );

      if (currentBlock.hash !== recalculatedHash) {
        return {
          valid: false,
          error: 'Tampered block content',
          brokenIndex: i
        };
      }
    }

    return { valid: true };
  }

  /**
   * Retrieve recent logs
   */
  getRecentLogs(limit = 100) {
    return this.store.slice(-limit);
  }
}

module.exports = new AuditLogger();