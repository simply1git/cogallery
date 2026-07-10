// Metrics utilities for CoGallery Bot Nodes
// Provides Prometheus-compatible metrics exposure

const os = require('os');

/**
 * Generate Prometheus-formatted metrics
 * @returns {string} Metrics in Prometheus text format
 */
function generateMetrics() {
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
    // Process metrics
    '# HELP nodejs_process_uptime_seconds Number of seconds the Node.js process has been running',
    '# TYPE nodejs_process_uptime_seconds gauge',
    `nodejs_process_uptime_seconds ${uptime.toFixed(3)}`,
    '',
    '# HELP nodejs_memory_rss_bytes Resident Set Size memory usage',
    '# TYPE nodejs_memory_rss_bytes gauge',
    `nodejs_memory_rss_bytes ${memoryUsage.rss}`,
    '',
    '# HELP nodejs_memory_heap_total_bytes Total heap size',
    '# TYPE nodejs_memory_heap_total_bytes gauge',
    `nodejs_memory_heap_total_bytes ${memoryUsage.heapTotal}`,
    '',
    '# HELP nodejs_memory_heap_used_bytes Used heap size',
    '# TYPE nodejs_memory_heap_used_bytes gauge',
    `nodejs_memory_heap_used_bytes ${memoryUsage.heapUsed}`,
    '',
    '# HELP nodejs_memory_usage_percent Memory usage percentage',
    '# TYPE nodejs_memory_usage_percent gauge',
    `nodejs_memory_usage_percent ${memoryPercent.toFixed(2)}`,
    '',
    '# HELP nodejs_cpu_user_seconds_total Total user CPU time used',
    '# TYPE nodejs_cpu_user_seconds_total counter',
    `nodejs_cpu_user_seconds_total ${(cpuUsage.user / 1000000).toFixed(3)}`,
    '',
    '# HELP nodejs_cpu_system_seconds_total Total system CPU time used',
    '# TYPE nodejs_cpu_system_seconds_total counter',
    `nodejs_cpu_system_seconds_total ${(cpuUsage.system / 1000000).toFixed(3)}`,
    '',
    '# HELP nodejs_cpu_load_average_1m 1-minute load average',
    '# TYPE nodejs_cpu_load_average_1m gauge',
    `nodejs_cpu_load_average_1m ${loadAvg[0].toFixed(3)}`,
    '',
    '# HELP nodejs_cpu_load_average_5m 5-minute load average',
    '# TYPE nodejs_cpu_load_average_5m gauge',
    `nodejs_cpu_load_average_5m ${loadAvg[1].toFixed(3)}`,
    '',
    '# HELP nodejs_cpu_load_average_15m 15-minute load average',
    '# TYPE nodejs_cpu_load_average_15m gauge',
    `nodejs_cpu_load_average_15m ${loadAvg[2].toFixed(3)}`,
    '',
    '# HELP cocogallery_uptime_seconds Uptime of the CoGallery service',
    '# TYPE cocogallery_uptime_seconds gauge',
    `cocogallery_uptime_seconds ${uptime.toFixed(3)}`,
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
function getMetricsJson() {
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

module.exports = {
  generateMetrics,
  getMetricsJson
};