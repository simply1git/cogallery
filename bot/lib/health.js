// Health check utilities for CoGallery Bot Nodes
// Provides functions for monitoring node health and dependencies

const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Get comprehensive health status of the bot node
 * @returns {Object} Health status object
 */
function getHealthStatus() {
  return {
    timestamp: new Date().toISOString(),
    service: 'CoGallery Oracle Backend',
    status: 'online',
    uptime: process.uptime(),
    system: getSystemInfo(),
    dependencies: checkDependencies(),
    resources: getResourceUsage()
  };
}

/**
 * Get system information
 * @returns {Object} System info
 */
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    cpus: os.cpus().length
  };
}

/**
 * Check critical dependencies
 * @returns {Object} Dependency status
 */
function checkDependencies() {
  const status = {
    database: false,
    storage: false,
    memory: false
  };

  // Check database connectivity (would need actual DB connection in real implementation)
  // For now, we'll check if we can access the uploads directory as a proxy for storage
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    fs.accessSync(uploadsDir, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK);
    status.storage = true;
  } catch (err) {
    // Directory doesn't exist or no access
    status.storage = false;
  }

  // Check memory availability
  const freeMemPercent = (os.freemem() / os.totalmem()) * 100;
  status.memory = freeMemPercent > 10; // At least 10% free memory

  // In a real implementation, we would check actual database connectivity here
  // For now, we'll assume it's OK if we're running
  status.database = true;

  return status;
}

/**
 * Get resource usage statistics
 * @returns {Object} Resource usage
 */
function getResourceUsage() {
  const usage = process.memoryUsage();

  return {
    memory: {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: typeof ArrayBuffer !== 'undefined' ? 0 : 0 // Simplified
    },
    cpu: {
      userTime: process.cpuUsage().user,
      systemTime: process.cpuUsage().system,
      loadAverage: os.loadavg()
    },
    disk: getDiskUsage()
  };
}

/**
 * Get disk usage for the uploads directory
 * @returns {Object} Disk usage info
 */
function getDiskUsage() {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const stats = fs.statfsSync(uploadsDir);

    const blockSize = stats.bsize || 4096; // Fallback to 4K if not provided
    const totalBytes = stats.blocks * blockSize;
    const freeBytes = stats.bfree * blockSize;
    const usedBytes = totalBytes - freeBytes;

    return {
      total: totalBytes,
      free: freeBytes,
      used: usedBytes,
      usagePercentage: (usedBytes / totalBytes) * 100
    };
  } catch (err) {
    // Fallback if statfs is not available
    return {
      total: 0,
      free: 0,
      used: 0,
      usagePercentage: 0
    };
  }
}

/**
 * Perform a quick health check (lighter version)
 * @returns {Object} Basic health status
 */
function getQuickHealth() {
  return {
    timestamp: new Date().toISOString(),
    status: 'online',
    uptime: process.uptime(),
    memory: {
      usage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
    }
  };
}

module.exports = {
  getHealthStatus,
  getQuickHealth,
  getSystemInfo,
  checkDependencies,
  getResourceUsage
};