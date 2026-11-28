import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  base: './',
  resolve: {
    // tsconfig 里声明了 @/* 指向 src，这里必须同步，否则运行期解析不到
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // 工作区包是源码直出，不走依赖预构建，否则新增导出要清缓存才能生效
    exclude: ['@btn/deco', '@btn/shared'],
  },
})
