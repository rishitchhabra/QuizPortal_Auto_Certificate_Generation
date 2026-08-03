module.exports = {
  apps: [
    {
      name: 'quiz-arena',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: max,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
