const path = require('path');

module.exports = {
  apps: [{
    name: 'zylos-github-connector',
    script: 'src/index.js',
    cwd: path.join(__dirname), // Use project root directory
    env: {
      NODE_ENV: 'production'
    },
    // Restart on failure
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    // Logs managed by PM2 (relative to cwd)
    error_file: path.join(__dirname, 'logs/error.log'),
    out_file: path.join(__dirname, 'logs/out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
