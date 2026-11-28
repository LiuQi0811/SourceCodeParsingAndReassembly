import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 写死端口：与 Vue 端 5180 错开，冲突时直接报错而不是静默顺延
    port: 5190,
    strictPort: true,
    open: false,
  },
});
