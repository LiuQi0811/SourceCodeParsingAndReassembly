import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// 路径别名(与 tsconfig.json paths 保持一致)
// 用 new URL().pathname 避免 @types/node 依赖
const alias = {
  '@stores': new URL('./src/stores', import.meta.url).pathname,
  '@lib': new URL('./src/lib', import.meta.url).pathname,
  '@components': new URL('./src/components', import.meta.url).pathname,
  '@assets': new URL('./src/assets', import.meta.url).pathname,
};

// 1:1 还原原 manifest.json 配置
// Chrome MV3 + Firefox MV3 兼容:
// - WXT 自动把 background.service_worker 转 background.scripts(Firefox)
// - 浏览器差异通过 manifest 函数条件化(sidePanel / gecko / CSP)
export default defineConfig({
  srcDir: 'src',
  // 静态资源目录(_locales / img / lib 等),WXT 默认 'public' (项目根),
  // 此处指向 srcDir 下的 public,与现有目录布局一致
  publicDir: 'src/public',
  // manifest_version 由 WXT 的 --mv3 / --mv2 CLI flag 控制,不在 manifest 中声明
  manifest: ({ browser }) => {
    const isFirefox = browser === 'firefox';
    // 通用 commands(Firefox 113+ MV3 支持 _execute_action)
    const commands = {
      _execute_action: {},
      enable: { description: '__MSG_pause__ / __MSG_enable__' },
      auto_down: { description: '__MSG_autoDownload__' },
      catch: { description: '__MSG_cacheCapture__' },
      m3u8: { description: '__MSG_m3u8Parser__' },
      clear: { description: '__MSG_clear__' },
      reboot: { description: '__MSG_restartExtension__' },
      deepSearch: { description: '__MSG_deepSearch__' },
      preview: { description: '__MSG_preview__' },
    } as const;

    return {
      name: '__MSG_catCatch__',
      description: '__MSG_description__',
      default_locale: 'en',
      homepage_url: 'https://github.com/xifangczy/cat-catch',
      incognito: 'split',
      // Chrome 特有 sidePanel permission;Firefox 无需(Firefox 用 sidebar_action,原项目 Firefox 版未启用)
      permissions: isFirefox
        ? ['tabs', 'webRequest', 'downloads', 'storage', 'webNavigation', 'alarms', 'scripting', 'declarativeNetRequest', 'contextMenus']
        : ['tabs', 'webRequest', 'downloads', 'storage', 'webNavigation', 'alarms', 'declarativeNetRequest', 'scripting', 'sidePanel', 'contextMenus'],
      host_permissions: ['*://*/*', '<all_urls>'],
      commands,
      action: {
        default_icon: 'img/icon.png',
        default_title: '__MSG_catCatch__',
      },
      icons: {
        64: 'img/icon.png',
        128: 'img/icon128.png',
      },
      // 浏览器特有字段
      ...(isFirefox
        ? {
            browser_specific_settings: {
              gecko: { id: 'xifangczy@gmail.com', strict_min_version: '113.0' },
            },
            content_security_policy: {
              extension_pages: "script-src 'self'; object-src 'self'",
            },
          }
        : {
            minimum_chrome_version: '93',
            side_panel: { default_path: 'sidepanel.html' },
          }),
    };
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: { alias },
  }),
});
