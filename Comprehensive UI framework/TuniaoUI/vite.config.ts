import os from 'node:os';
import path from 'node:path';
import {defineConfig} from 'vite';
import uni from '@dcloudio/vite-plugin-uni';


// https://vitejs.dev/config/
export default defineConfig({
	plugins: [uni()], 
	base: "./",
	cacheDir: process.env.UNI_VITE_CACHE_DIR || path.join(os.tmpdir(), 'tuniaoui-vite-cache')
})