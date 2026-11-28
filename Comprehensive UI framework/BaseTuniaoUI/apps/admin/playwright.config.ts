import { defineConfig } from '@playwright/test'

/**
 * 组件级 E2E：直接跑在 uni-app H5 dev server 上。
 * 本机默认复用系统 Chrome（channel: chrome），不额外下载浏览器；
 * CI 上设 PW_BROWSER=chromium，走 `playwright install` 装好的内置 Chromium。
 * 已有 dev server 时自动复用。
 */
const useSystemChrome = process.env.PW_BROWSER !== 'chromium'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: useSystemChrome ? 'chrome' : undefined,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
      testIgnore: '**/mobile.spec.ts',
    },
    {
      // 660×570 落在 <768 的 mobile 断点内：抽屉菜单 + 卡片列表
      name: 'mobile',
      use: { viewport: { width: 660, height: 570 } },
      testMatch: '**/mobile.spec.ts',
    },
  ],
  webServer: {
    command: 'npm run dev:h5',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
