module.exports = {
  apps: [{
    name: 'cogallery-seedbox',
    script: './bot.js',
    instances: 1, // Single instance since it shares local state
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
