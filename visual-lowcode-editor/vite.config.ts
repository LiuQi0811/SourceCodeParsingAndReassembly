import { defineConfig } from 'vite';

const port = Number(process.env.DEPLOY_RUN_PORT ?? 5000);

export default defineConfig({
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: {
      overlay: true,
      path: '/hot/vite-hmr',
      port: 6000,
      clientPort: 443,
      timeout: 30000,
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  preview: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
