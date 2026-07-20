import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Show both Local and Network URLs in terminal
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
