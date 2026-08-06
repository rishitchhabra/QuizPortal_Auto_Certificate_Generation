module.exports = {
  apps: [
    {
      name: 'quiz-arena-api',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      // Two dedicated worker processes. Each runs up to WORKER_CONCURRENCY
      // certificate jobs at once (default 3), capping concurrent LibreOffice
      // conversions at ~6 on the 2-vCPU VPS. BullMQ applies backpressure by only
      // pulling a job into a free concurrency slot.
      name: 'quiz-arena-worker',
      script: 'server/worker.js',
      exec_mode: 'cluster',
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        WORKER_CONCURRENCY: '3',
      },
    },
  ],
};
