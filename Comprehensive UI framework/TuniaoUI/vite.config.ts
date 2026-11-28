import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [uni()],
	base: './',
	// 把 Vite 的缓存放到系统临时目录，避免污染项目目录
	cacheDir: process.env.UNI_VITE_CACHE_DIR || path.join(os.tmpdir(), 'tuniaoui-vite-cache'),
	// 使用 `@/xxx` 指向 src，和 tsconfig 中的 paths 保持一致
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			// 仅小程序端：组件内的 tn-icon CSS 会被抽成独立 wxss，CDN 字体无法离线加载。
			// 指向 base64 版本，保证图标字体内嵌进包体；H5 继续用 App.vue 的全局 base64 声明。
			...(process.env.UNI_PLATFORM === 'mp-weixin'
				? {
						'@tuniao/tn-icon/dist/index.css': path.resolve(
							__dirname,
							'node_modules/@tuniao/tn-icon/dist/base64/index.css'
						),
				  }
				: {}),
		},
	},
	server: {
		host: '0.0.0.0',
		port: 5173,
	},
})
