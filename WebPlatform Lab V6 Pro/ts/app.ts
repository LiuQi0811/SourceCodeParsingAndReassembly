// app.ts —— 应用入口
// 职责：创建 Router 单例、挂载 Layout、注册 beforeEach 守卫、启动路由
// 演示 MDN：ES Module、Promise、PerformanceObserver（开发调试）、CSS Custom Properties
import { createRouter } from './core/Router.js';
import { routes } from './routes.js';
import { Layout } from './components/layout/Layout.js';
import { store } from './core/Store.js';
import { eventBus, EVENTS } from './core/EventBus.js';
import { $ } from './core/utils.js';
import type { RouteLocation } from './core/types.js';
import type { Router } from './core/Router.js';

declare global {
  interface Window {
    __app?: {
      router: Router;
      store: typeof store;
      eventBus: typeof eventBus;
      layout: Layout;
      EVENTS: typeof EVENTS;
    };
  }
}

// —— 1. 创建路由器单例 ——
const router = createRouter({ mode: 'history', routes });

// —— 2. 注册全局前置守卫（装饰器模式） ——
// 演示：访问 /router/secret 时拦截，重定向到 /about
router.beforeEach((to: RouteLocation, from: RouteLocation | null): boolean | string => {
  if (to.path === '/router/secret') {
    // 真实场景可在这里检查登录态：if (!store.get('app', 'user')) return '/login';
    console.warn('[守卫] 拦截受限路由 /router/secret，重定向到 /about');
    return '/about';
  }
  return true;
});

// 演示：afterEach 记录访问历史到 localStorage（Storage API）
const HISTORY_KEY = 'mdn-lab:visit-history';
router.afterEach((to: RouteLocation): boolean => {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as Array<{ path: string; time: number }>;
    list.push({ path: to.path, time: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-20)));
  } catch { /* noop */ }
  return true;
});

// —— 3. 应用主题（从 store 读取，写入 <html data-theme>） ——
const theme = store.get('app', 'theme');
document.documentElement.setAttribute('data-theme', theme);

// —— 4. 挂载 Layout ——
const appEl = $('#app')!;
// 清空 boot loading
while (appEl.firstChild) appEl.removeChild(appEl.firstChild);

const layout = new Layout({ router });
layout.mount(appEl);

// —— 5. 全局错误捕获（演示 window.error / unhandledrejection） ——
window.addEventListener('error', (e) => {
  console.error('[全局 error]', e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[未处理 Promise rejection]', e.reason);
});

// —— 6. 启动路由 ——
router.start();

// —— 7. 开发期：导出到 window 便于调试 ——
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  Object.assign(window, { __app: { router, store, eventBus, layout, EVENTS } });
  console.info('%c[原生 SPA]', 'color:#1677ff;font-weight:bold',
    '已启动。调试：window.__app.router / window.__app.store / window.__app.eventBus');
}
