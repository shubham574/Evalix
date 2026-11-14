module.exports = {
  apps: [
    {
      name: 'evalix-server',
      script: './server.js',
      instances: 'max',       // Utilize all available logical CPU cores (12 on Ryzen 5 5500U)
      exec_mode: 'cluster',   // Node cluster mode for high throughput load balancing
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOAD_TEST: 'true',
      },
      env_loadtest: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOAD_TEST: 'true',
      },
    },
  ],
};
