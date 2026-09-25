module.exports = {
  apps: [{
    name: 'kinexy-api',
    cwd: '/www/wwwroot/kinexy/backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '500M',
    time: true,
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
