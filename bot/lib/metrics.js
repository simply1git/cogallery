// Metrics utilities for CoGallery Bot Nodes
// Provides Prometheus-compatible metrics exposure

import os from 'os';

/**
 * Generate Prometheus-formatted metrics
 * @returns {string} Metrics in Prometheus text format
 */
export function generateMetrics() {
  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  // Calculate memory percentage
  const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100 || 0;

  // Get uptime
  const uptime = process.uptime();

  // Get load average (1min, 5min, 15min)
  const loadAvg = os.loadavg();

  // Build Prometheus metrics
  const metrics = [
    '',
    '# HELP cocogallery_status_status Status of the CoGallery service (1=up, 0=down)',
    '# TYPE cocogallery_status_status gauge',
    'cocogallery_status_status 1'
  ].join('\n');

  return metrics;
}

/**
 * Get metrics as JSON object (for internal use/API)
 * @returns {Object} Metrics as JSON
 */
export function getMetricsJson() {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        usagePercent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) || 0
      },
      cpu: {
        userTime: cpuUsage.user,
        systemTime: cpuUsage.system,
        loadAverage: os.loadavg()
      }
    },
    service: {
      name: 'CoGallery Oracle Backend',
      status: 'online'
    }
  };
}

// module.exports removed