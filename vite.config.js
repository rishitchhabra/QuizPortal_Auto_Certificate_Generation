import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Proxy all /api requests to the Express backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
