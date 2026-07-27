// =====================================================================
// ServiceWorkerPage.js —— Service Worker 深度实验室
// 演示 MDN：
//   1. Service Worker 生命周期  —— register/install/activate/skipWaiting/clients.claim
//        registration.installing/waiting/active、update()/unregister()、updatefound/controllerchange
//   2. fetch 拦截 + Cache 策略  —— event.respondWith、Cache First/Network First/SWR/Cache Only/Network Only
//        caches.open/match/put/delete/keys、event.request.method/url/mode/headers
//   3. Background Sync 后台同步 —— registration.sync.register(tag)、sync 事件、event.waitUntil、getTags
//   4. Push API 推送            —— pushManager.subscribe、PushSubscription(endpoint/expirationTime/keys)
//        getSubscription/unsubscribe、push 事件、event.data.json()/text()/blob()、showNotification
//   5. Notification + Periodic Sync —— requestPermission/permission、new Notification
//        onclick/onshow/onclose/onerror、registration.showNotification vs new Notification、periodicSync
// 说明：Service Worker 需要 HTTPS（或 localhost）+ 独立脚本作用域；
//       jsdom 中 navigator.serviceWorker 通常不存在（已 mock），caches/Notification 已 mock，
//       SyncManager/PushManager 通常不存在。所有注册 SW 的尝试都会失败，
//       本页 try/catch + _addLog('warn', ...) 优雅降级，绝不抛异常。
//       Blob URL 内联 SW 脚本可以构造，但 register 会失败。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// —— 内联 SW 脚本：通过 Blob URL 注册（jsdom 中 register 仍会失败，但脚本可构造展示）——

// Card 1：生命周期演示脚本（install / activate / skipWaiting / clients.claim）
const SW_LIFECYCLE_SRC = `// SW 生命周期演示脚本
self.addEventListener("install", (event) => {
  console.log("[SW] install", event);
  // self.skipWaiting(); // 跳过等待，立即激活新 SW
});
self.addEventListener("activate", (event) => {
  console.log("[SW] activate", event);
  // clients.claim() 立即控制所有客户端
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  // 默认不拦截，交给浏览器网络栈
});
`;

// Card 2：Cache First 策略（先查缓存，无则请求并存缓存）
const SW_CACHE_FIRST_SRC = `// Cache First 策略
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = resp.clone();
          caches.open("cf-cache-v1").then((c) => c.put(event.request, copy));
        }
        return resp;
      });
    })
  );
});
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
`;

// Card 2：Network First 策略（先请求，失败回退缓存）
const SW_NETWORK_FIRST_SRC = `// Network First 策略
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).then((resp) => {
      if (resp.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = resp.clone();
        caches.open("nf-cache-v1").then((c) => c.put(event.request, copy));
      }
      return resp;
    }).catch(() => caches.match(event.request))
  );
});
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
`;

// Card 2：Stale While Revalidate 策略（返回缓存同时后台更新）
const SW_SWR_SRC = `// Stale While Revalidate 策略
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((resp) => {
        if (resp.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = resp.clone();
          caches.open("swr-cache-v1").then((c) => c.put(event.request, copy));
        }
        return resp;
      });
      // 有缓存立即返回，同时后台更新；无缓存则等网络
      return cached || networkFetch;
    })
  );
});
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
`;

// Card 6：Service Worker Static Routing API（W3C 静态路由 / Chrome 123+）
// 在 SW 启动前声明静态路由，跳过 SW 启动开销；运行时动态路由仍需 fetch 事件
const SW_STATIC_ROUTING_SRC = `// Service Worker Static Routing API（Chrome 123+）
// 在 SW 启动前声明静态路由：跳过 SW 启动开销，浏览器直接按 source 分流
self.addEventListener("install", (event) => {
  // self.registration.addRoutes 在 install 阶段声明路由表
  if (self.registration && self.registration.addRoutes) {
    self.registration.addRoutes([
      // 1) 图片静态资源直接走 cache（跳过 SW 启动）
      { condition: { urlPattern: new URLPattern({ pathname: "/assets/*.{png,jpg,webp,svg}" }) }, source: "cache" },
      // 2) JS/CSS 直接走 network（不进 SW，省启动开销）
      { condition: { urlPattern: new URLPattern({ pathname: "/*.{js,css}" }) }, source: "network" },
      // 3) API 请求走 fetch-event（仍由 SW fetch 事件处理）
      { condition: { urlPattern: new URLPattern({ pathname: "/api/*" }) }, source: "fetch-event" },
      // 4) 文档导航请求走 fetch-event（可与 navigation prefetch 协同）
      { condition: { requestDestination: "document" }, source: "fetch-event" },
    ]);
  }
  self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// 保留 fetch 事件用于运行时动态路由（Static Routing 不能覆盖的逻辑）
self.addEventListener("fetch", (event) => {
  // 仅 source: "fetch-event" 的请求会到达这里（/api/* 与 document）
  // 可在此处做 Network First / SWR 等动态策略
});
`;

export class ServiceWorkerPage extends Page {
  // —— 初始 state ——
  // capsSummary 初始为 ''，能力检测完成后填入字符串，触发条件渲染 Alert
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      regStatus: 'unregistered',   // unregistered | registering | registered | error
      swState: '',                 // installing/waiting/active 状态描述
      cacheStats: '',              // 缓存统计描述
      syncTags: [],                // Background Sync tags 列表
      pushStatus: '未订阅',         // push 订阅状态
      notifPermission: 'default',  // Notification 权限
      staticRoutingInfo: '',       // Static Routing API 演示结果描述
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ CRITICAL 守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 实例引用初始化（render 中通过 state 读取，此处仅初始化事件句柄）
    this._registration = null;
    this._updateFoundHandler = null;
    this._controllerChangeHandler = null;
    this._abortController = (typeof AbortController !== 'undefined')
      ? new AbortController() : null;

    // 同步能力检测，写入 capsSummary
    this._detectCapabilities();
  }

  componentWillUnmount() {
    // 1. 移除 registration updatefound 事件监听
    if (this._registration && this._updateFoundHandler) {
      try {
        this._registration.removeEventListener('updatefound', this._updateFoundHandler);
      } catch { /* noop */ }
    }
    // 2. 移除 navigator.serviceWorker controllerchange 事件监听
    if (typeof navigator !== 'undefined' && navigator.serviceWorker && this._controllerChangeHandler) {
      try {
        navigator.serviceWorker.removeEventListener('controllerchange', this._controllerChangeHandler);
      } catch { /* noop */ }
    }
    // 3. AbortController abort（中止可能的 fetch 等）
    if (this._abortController) {
      try { this._abortController.abort(); } catch { /* noop */ }
    }
    this._registration = null;
    this._updateFoundHandler = null;
    this._controllerChangeHandler = null;
    this._abortController = null;
  }

  // —— 日志辅助（最多保留 40 条，与项目其它页一致）——
  _addLog(type, content) {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
    });
  }

  // —— 按钮辅助（统一注册子组件，便于销毁）——
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 能力检测（typeof / in，绝不抛异常）——
  _caps() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    // safe 包装：避免 typeof 引用未声明标识符（如 ServiceWorkerRegistration 在 jsdom 中可能未定义）
    const safe = (fn) => { try { return !!fn(); } catch { return false; } };
    return {
      hasSW: typeof nav.serviceWorker !== 'undefined'
        && typeof nav.serviceWorker.register === 'function',
      hasCaches: typeof caches !== 'undefined',
      hasNotif: typeof Notification !== 'undefined',
      hasSync: typeof SyncManager !== 'undefined',
      hasPush: typeof PushManager !== 'undefined',
      // Service Worker Static Routing API（W3C / Chrome 123+）
      hasAddRoutes: safe(() => typeof window !== 'undefined'
          && typeof window.registration !== 'undefined'
          && typeof window.registration.addRoutes !== 'undefined')
        || safe(() => typeof ServiceWorkerRegistration !== 'undefined'
          && typeof ServiceWorkerRegistration.prototype.addRoutes === 'function'),
      // URLPattern 协同（condition.urlPattern 通常用 URLPattern 实例）
      hasURLPattern: safe(() => typeof URLPattern !== 'undefined'),
    };
  }

  _detectCapabilities() {
    const c = this._caps();
    const parts = [
      `serviceWorker:${c.hasSW ? '✓' : '✗'}`,
      `caches:${c.hasCaches ? '✓' : '✗'}`,
      `Notification:${c.hasNotif ? '✓' : '✗'}`,
      `SyncManager:${c.hasSync ? '✓' : '✗'}`,
      `PushManager:${c.hasPush ? '✓' : '✗'}`,
      `addRoutes:${c.hasAddRoutes ? '✓' : '✗'}`,
      `URLPattern:${c.hasURLPattern ? '✓' : '✗'}`,
    ];
    const summary = `能力检测：${parts.join('  ')}`;
    this.setState({ capsSummary: summary });
    this._addLog('cap', summary);
    // jsdom 中 navigator.serviceWorker 通常不存在（已 mock），caches 已 mock，
    // Notification 已 mock，SyncManager/PushManager 通常不存在
    if (!c.hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
    }
    if (c.hasNotif) {
      try { this.setState({ notifPermission: Notification.permission }); } catch { /* noop */ }
    }
    if (!c.hasSync) {
      this._addLog('warn', 'SyncManager 不可用，Background Sync 仅做演示');
    }
    if (!c.hasPush) {
      this._addLog('warn', 'PushManager 不可用，Push API 仅做演示');
    }
    if (!c.hasAddRoutes) {
      this._addLog('warn', 'Static Routing API 不可用，需 Chrome 123+ 与真实 SW 注册');
    }
    if (!c.hasURLPattern) {
      this._addLog('warn', 'URLPattern 不可用，Static Routing condition 需改用 urlPatternString');
    }
  }

  // 能力 Tag 辅助
  _capTag(ok) {
    return ok
      ? h(Tag, { color: 'success' }, '支持')
      : h(Tag, { color: 'error' }, '不支持');
  }

  // 代码块（展示 SW 源码）
  _preCode(text, maxHeight = '260px') {
    return h('pre', { class: 'code-block', style: { maxHeight, overflow: 'auto' } },
      h('code', {}, text),
    );
  }

  // VAPID base64url → Uint8Array（applicationServerKey 要求）
  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // 构造内联 SW 的 Blob URL（脚本可构造，但 register 会失败）
  _makeSwBlobUrl(src) {
    try {
      if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        this._addLog('warn', 'Blob / URL.createObjectURL 不可用，无法构造内联 SW');
        return null;
      }
      const blob = new Blob([src], { type: 'text/javascript' });
      return URL.createObjectURL(blob);
    } catch (err) {
      this._addLog('warn', `构造 Blob URL 失败：${err.message}`);
      return null;
    }
  }

  // ============ Card 1: Service Worker 生命周期 ============

  async _registerSW() {
    if (!this._caps().hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
      return;
    }
    this.setState({ regStatus: 'registering' });
    this._addLog('sw', '【register】尝试通过 Blob URL 注册内联 SW（scope: ./）');
    const blobUrl = this._makeSwBlobUrl(SW_LIFECYCLE_SRC);
    if (!blobUrl) {
      this.setState({ regStatus: 'error' });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register(blobUrl, { scope: './' });
      this._registration = reg;
      this._addLog('sw', `注册成功：scope=${reg.scope}`);
      this._addLog('lifecycle',
        `installing=${reg.installing?.state || 'null'} waiting=${reg.waiting?.state || 'null'} active=${reg.active?.state || 'null'}`);
      this.setState({
        regStatus: 'registered',
        swState: `active=${reg.active?.state || 'null'} waiting=${reg.waiting?.state || 'null'} installing=${reg.installing?.state || 'null'}`,
      });
      // 监听 updatefound 事件（发现新版本 SW）
      this._updateFoundHandler = () => {
        this._addLog('lifecycle',
          `updatefound 触发：installing.state=${reg.installing?.state || 'null'}`);
        if (reg.installing) {
          try {
            reg.installing.addEventListener('statechange', () => {
              this._addLog('lifecycle',
                `ServiceWorker.statechange → ${reg.installing?.state || 'null'}`);
            });
          } catch { /* noop */ }
        }
      };
      try { reg.addEventListener('updatefound', this._updateFoundHandler); } catch { /* noop */ }
      // 监听 controllerchange 事件（页面控制器变更）
      this._controllerChangeHandler = () => {
        this._addLog('lifecycle', 'controllerchange 触发：页面控制器已变更');
      };
      try {
        navigator.serviceWorker.addEventListener('controllerchange', this._controllerChangeHandler);
      } catch { /* noop */ }
    } catch (err) {
      // jsdom 中 SW 不可用：环境限制，记 warn 不抛异常
      this._addLog('warn',
        `Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS（${err.name}: ${err.message}）`);
      this.setState({ regStatus: 'error' });
    }
  }

  async _updateSW() {
    if (!this._caps().hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
      return;
    }
    try {
      const reg = this._registration || await navigator.serviceWorker.getRegistration();
      if (!reg) {
        this._addLog('sw', '无注册，无法调用 update()');
        return;
      }
      await reg.update();
      this._addLog('sw', `registration.update() 已调用，scope=${reg.scope}`);
    } catch (err) {
      this._addLog('warn', `update 失败（环境限制）：${err.message}`);
    }
  }

  async _unregisterSW() {
    if (!this._caps().hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
      return;
    }
    try {
      if (this._registration) {
        const ok = await this._registration.unregister();
        this._addLog('sw',
          `registration.unregister() => ${ok}，scope=${this._registration.scope}`);
        // 移除 updatefound 监听（componentWillUnmount 也会兜底）
        if (this._updateFoundHandler) {
          try {
            this._registration.removeEventListener('updatefound', this._updateFoundHandler);
          } catch { /* noop */ }
        }
        this._registration = null;
        this._updateFoundHandler = null;
        this.setState({ regStatus: 'unregistered', swState: '' });
        return;
      }
      const regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) {
        this._addLog('sw', '没有已注册的 ServiceWorker，无需 unregister');
        this.setState({ regStatus: 'unregistered' });
        return;
      }
      for (const r of regs) {
        await r.unregister();
        this._addLog('sw', `unregister 完成：scope=${r.scope}`);
      }
      this.setState({ regStatus: 'unregistered', swState: '' });
    } catch (err) {
      this._addLog('warn', `unregister 失败（环境限制）：${err.message}`);
    }
  }

  // ============ Card 2: fetch 事件拦截 + Cache 策略 ============

  async _registerStrategySW(strategy) {
    if (!this._caps().hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
      return;
    }
    const srcMap = {
      'cache-first': { src: SW_CACHE_FIRST_SRC, name: 'Cache First', cache: 'cf-cache-v1' },
      'network-first': { src: SW_NETWORK_FIRST_SRC, name: 'Network First', cache: 'nf-cache-v1' },
      'swr': { src: SW_SWR_SRC, name: 'Stale While Revalidate', cache: 'swr-cache-v1' },
    };
    const conf = srcMap[strategy];
    if (!conf) {
      this._addLog('strategy', `未知策略：${strategy}`);
      return;
    }
    this._addLog('strategy', `注册 ${conf.name} SW（Blob URL，cache: ${conf.cache}）`);
    const blobUrl = this._makeSwBlobUrl(conf.src);
    if (!blobUrl) return;
    try {
      const reg = await navigator.serviceWorker.register(blobUrl, { scope: './' });
      this._registration = reg;
      this._addLog('fetch', `${conf.name} SW 注册成功：scope=${reg.scope}`);
      this._addLog('strategy',
        `${conf.name}：self.addEventListener("fetch") 拦截请求 → event.respondWith(...)`);
      this.setState({ regStatus: 'registered' });
    } catch (err) {
      // Blob URL 内联 SW 脚本可以构造，但 register 会失败
      this._addLog('warn',
        `Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS（${conf.name}: ${err.message}）`);
      this._addLog('strategy', `${conf.name} 注册失败，但脚本可读，策略说明：`);
      this._addLog('fetch', conf.src.split('\n').slice(0, 3).join(' | '));
    }
  }

  async _clearCache() {
    if (!this._caps().hasCaches) {
      this._addLog('warn', 'Cache API 不可用');
      return;
    }
    try {
      const names = await caches.keys();
      if (!names.length) {
        this._addLog('cache', '无缓存可清空');
        this.setState({ cacheStats: '缓存数：0' });
        return;
      }
      for (const n of names) {
        const ok = await caches.delete(n);
        this._addLog('cache', `caches.delete(${n}) => ${ok}`);
      }
      this.setState({ cacheStats: `缓存数：0（已清空 ${names.length} 个）` });
    } catch (err) {
      this._addLog('warn', `清空缓存失败：${err.message}`);
    }
  }

  async _listCacheStats() {
    if (!this._caps().hasCaches) {
      this._addLog('warn', 'Cache API 不可用');
      return;
    }
    try {
      const names = await caches.keys();
      let total = 0;
      for (const n of names) {
        const cache = await caches.open(n);
        const reqs = await cache.keys();
        total += reqs.length;
        this._addLog('cache',
          `cache[${n}] => ${reqs.length} 条 Request：[${reqs.map((r) => r.url).join(', ') || '空'}]`);
      }
      this.setState({ cacheStats: `缓存 ${names.length} 个，共 ${total} 条 Request` });
    } catch (err) {
      this._addLog('warn', `统计缓存失败：${err.message}`);
    }
  }

  // ============ Card 3: Background Sync 后台同步 ============

  async _registerBgSync() {
    if (!this._caps().hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
      return;
    }
    try {
      const reg = this._registration || await navigator.serviceWorker.getRegistration();
      if (!reg || !reg.sync) {
        this._addLog('sync', '无 SW 注册或不支持 Background Sync（registration.sync 不可用）');
        return;
      }
      const tag = 'bg-sync-tag-' + Date.now();
      await reg.sync.register(tag);
      this._addLog('bg', `sync.register('${tag}') 完成，等待网络恢复时触发 sync 事件`);
      this._addLog('sync',
        '用途：网络恢复时自动同步数据（离线发消息、表单提交），SW 中 self.addEventListener("sync") 监听');
    } catch (err) {
      this._addLog('warn', `sync.register 失败（环境限制）：${err.message}`);
    }
  }

  async _syncGetTags() {
    if (!this._caps().hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
      return;
    }
    try {
      const reg = this._registration || await navigator.serviceWorker.getRegistration();
      if (!reg || !reg.sync) {
        this._addLog('sync', '无 SW 或不支持 sync，无法 getTags()');
        return;
      }
      const tags = await reg.sync.getTags();
      this.setState({ syncTags: tags });
      this._addLog('bg', `sync.getTags() => [${tags.join(', ') || '空'}]`);
    } catch (err) {
      this._addLog('warn', `sync.getTags 失败（环境限制）：${err.message}`);
    }
  }

  _simulateSync() {
    this._addLog('sync',
      '【模拟】网络恢复 → SW 中 sync 事件触发 → event.tag=bg-sync-tag-* → event.waitUntil(promise) 执行同步任务');
    this._addLog('bg',
      '说明：真实触发需浏览器在 online 时派发 sync 事件；jsdom 无法模拟底层网络状态机，仅展示事件形态');
  }

  // ============ Card 4: Push API 推送 ============

  async _pushSubscribe() {
    if (!this._caps().hasSW || !this._caps().hasPush) {
      this._addLog('warn', 'Push API 不可用（需 serviceWorker + PushManager）');
      return;
    }
    this._addLog('push', '【subscribe】尝试订阅（mock VAPID key）');
    try {
      const reg = this._registration || await navigator.serviceWorker.getRegistration();
      if (!reg) {
        this._addLog('push', '无 SW 注册，无法 pushManager.subscribe（沙箱限制）');
        this.setState({ pushStatus: '失败：无 SW' });
        return;
      }
      // VAPID 公钥示例（base64url）；真实场景由推送服务端生成
      const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(vapidPublicKey),
      });
      this._addLog('sub', `订阅成功：endpoint=${sub.endpoint}`);
      this._addLog('push',
        `expirationTime=${sub.expirationTime}，keys: p256dh=${!!sub.getKey('p256dh')} auth=${!!sub.getKey('auth')}`);
      this.setState({ pushStatus: '已订阅' });
    } catch (err) {
      // 沙箱无真实 SW + VAPID：环境限制，记 warn 不抛异常
      this._addLog('warn', `订阅失败（需真实 SW + 有效 VAPID）：${err.message}`);
      this.setState({ pushStatus: '失败' });
    }
  }

  async _pushGetSub() {
    if (!this._caps().hasSW || !this._caps().hasPush) {
      this._addLog('warn', 'Push API 不可用');
      return;
    }
    try {
      const reg = this._registration || await navigator.serviceWorker.getRegistration();
      if (!reg) {
        this._addLog('push', '无 SW 注册，无法查询订阅');
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        this._addLog('sub', `已有订阅：endpoint=${sub.endpoint}`);
        this.setState({ pushStatus: '已订阅' });
      } else {
        this._addLog('sub', '无订阅');
        this.setState({ pushStatus: '未订阅' });
      }
    } catch (err) {
      this._addLog('warn', `查询订阅失败（环境限制）：${err.message}`);
    }
  }

  async _pushUnsubscribe() {
    if (!this._caps().hasSW || !this._caps().hasPush) {
      this._addLog('warn', 'Push API 不可用');
      return;
    }
    try {
      const reg = this._registration || await navigator.serviceWorker.getRegistration();
      if (!reg) {
        this._addLog('push', '无 SW 注册');
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        this._addLog('sub', '无订阅可取消');
        this.setState({ pushStatus: '未订阅' });
        return;
      }
      const ok = await sub.unsubscribe();
      this._addLog('sub', `subscription.unsubscribe() => ${ok}`);
      this.setState({ pushStatus: '未订阅' });
    } catch (err) {
      this._addLog('warn', `unsubscribe 失败（环境限制）：${err.message}`);
    }
  }

  _simulatePush() {
    this._addLog('push',
      '【模拟】收到 push 事件：SW 中 self.addEventListener("push", event) 触发');
    this._addLog('sub',
      'event.data.json()/text()/blob()/arrayBuffer() 解析负载；self.registration.showNotification(title, options) 显示通知');
  }

  // ============ Card 5: Notification 通知 + Periodic Sync ============

  async _reqNotifPermission() {
    if (!this._caps().hasNotif) {
      this._addLog('warn', 'Notifications API 不可用');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      this.setState({ notifPermission: perm });
      this._addLog('notif', `Notification.requestPermission() => ${perm}`);
    } catch (err) {
      this._addLog('warn', `requestPermission 异常：${err.message}`);
    }
  }

  // 显示一个通知（页面中 new Notification vs SW 中 registration.showNotification）
  _showNotification() {
    if (!this._caps().hasNotif) {
      this._addLog('warn', 'Notifications API 不可用');
      return;
    }
    try {
      if (Notification.permission !== 'granted') {
        this._addLog('notif',
          `权限为 ${Notification.permission}，需先 requestPermission 并获 granted`);
        return;
      }
      const n = new Notification('Service Worker 实验室', {
        body: '来自 ServiceWorkerPage 的通知演示',
        tag: 'sw-lab-notif',
        requireInteraction: false,
        silent: false,
        data: { from: 'ServiceWorkerPage', ts: Date.now() },
      });
      n.onshow = () => this._addLog('notif', 'notification.onshow 触发');
      n.onclick = () => {
        this._addLog('notif', 'notification.onclick 触发，调用 close()');
        n.close();
      };
      n.onerror = () => this._addLog('warn', 'notification.onerror 触发');
      n.onclose = () => this._addLog('notif', 'notification.onclose 触发');
      this._addLog('notif',
        `new Notification 已创建，tag=${n.tag}（页面中 new Notification vs SW 中 registration.showNotification）`);
    } catch (err) {
      this._addLog('warn', `new Notification 异常：${err.message}`);
    }
  }

  // 注册 Periodic Background Sync
  async _registerPeriodicSync() {
    if (!this._caps().hasSW) {
      this._addLog('warn', 'Service Worker 在 jsdom 不可用，需真实浏览器+HTTPS');
      return;
    }
    try {
      const reg = this._registration || await navigator.serviceWorker.getRegistration();
      if (!reg || !reg.periodicSync) {
        this._addLog('periodic',
          '无 SW 或不支持 Periodic Background Sync（registration.periodicSync 不可用）');
        return;
      }
      await reg.periodicSync.register('periodic-sync-tag', { minInterval: 24 * 60 * 60 * 1000 });
      this._addLog('periodic',
        `periodicSync.register('periodic-sync-tag', { minInterval: 24h }) 完成`);
      this._addLog('notif',
        'SW 中 self.addEventListener("periodicsync", event) 接收周期同步事件，event.tag 区分任务');
    } catch (err) {
      this._addLog('warn', `periodicSync.register 失败（环境限制）：${err.message}`);
    }
  }

  // ============ Card 6: Service Worker Static Routing API ============

  // 演示 registration.addRoutes([{ condition, source }]) 静态路由声明
  // 与传统 fetch 事件路由对比：addRoutes 在 SW 启动前声明，浏览器直接按 source 分流
  async _runStaticRoutingDemo() {
    const c = this._caps();
    if (!c.hasAddRoutes) {
      this._addLog('warn', 'Static Routing API 不可用，需 Chrome 123+ 与真实 SW 注册');
      this.setState({ staticRoutingInfo: '不支持 addRoutes（需 Chrome 123+）' });
      return;
    }
    this._addLog('routing', '【addRoutes】尝试声明静态路由（W3C Static Routing API）');
    try {
      const reg = this._registration
        || (typeof navigator !== 'undefined' && navigator.serviceWorker
          ? await navigator.serviceWorker.getRegistration() : null);
      if (!reg || typeof reg.addRoutes !== 'function') {
        this._addLog('routing', '无活动 SW 注册或 addRoutes 不可用（需先注册 SW 后调用）');
        this.setState({ staticRoutingInfo: '需先注册 SW 后调用 addRoutes' });
        return;
      }
      // 构造静态路由表：condition 支持 URLPattern / URL / urlPatternString / or|and|not
      // source 路由源：fetch-event（默认走 SW）/ network（直接网络跳过 SW）/ cache（直接缓存）/ race-network-and-fetch
      const makePattern = (pathname) =>
        (c.hasURLPattern ? new URLPattern({ pathname }) : pathname);
      const routes = [
        // 1) 图片静态资源直接走 cache（与 Cache API 协同，跳过 SW 启动开销）
        { condition: { urlPattern: makePattern('/assets/*.{png,jpg,webp,svg}') }, source: 'cache' },
        // 2) JS/CSS 直接走 network（首屏关键资源直连，省 SW 启动延迟）
        { condition: { urlPattern: makePattern('/*.{js,css}') }, source: 'network' },
        // 3) API 请求走 fetch-event（仍由 SW fetch 事件处理动态逻辑）
        { condition: { urlPattern: makePattern('/api/*') }, source: 'fetch-event' },
        // 4) 文档导航请求走 fetch-event（可与 Navigation Prefetch 协同）
        { condition: { requestDestination: 'document' }, source: 'fetch-event' },
      ];
      await reg.addRoutes(routes);
      this._addLog('routing', `addRoutes(${routes.length} 条) 声明完成`);
      this._addLog('routing',
        '路由源：cache（图片直读缓存）/ network（JS/CSS 直连网络）/ fetch-event（API/文档进 SW）');
      this._addLog('routing',
        '与 fetch 事件路由对比：addRoutes 在 SW 启动前声明，浏览器直接按 source 分流，跳过 SW 启动开销');
      this.setState({
        staticRoutingInfo: `已声明 ${routes.length} 条静态路由：cache/network/fetch-event`,
      });
    } catch (err) {
      this._addLog('warn', `addRoutes 失败（环境限制）：${err.message}`);
      this.setState({ staticRoutingInfo: `失败：${err.message}` });
    }
  }

  // ============ 渲染：6 张 Card ============

  _renderCard1() {
    const c = this._caps();
    const card = new Card({
      title: '1. Service Worker 生命周期',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.serviceWorker'),
        this._capTag(c.hasSW),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.serviceWorker.register(scriptURL, options) 返回 Promise<ServiceWorkerRegistration>。options.scope 控制作用域。生命周期事件：install（self.addEventListener("install", e)）、activate（self.addEventListener("activate", e)）。self.skipWaiting() 跳过等待立即激活新 SW；clients.claim() 立即控制所有客户端。registration.installing / waiting / active 三个 ServiceWorker 实例反映当前阶段；registration.update() 检查更新、registration.unregister() 注销。updatefound 事件在发现新版本 SW 时触发，controllerchange 在页面控制器变更时触发。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('注册 SW', {
            type: 'primary', size: 'sm',
            onClick: () => this._registerSW(),
            disabled: !c.hasSW,
          }),
          this._btn('update 检查更新', {
            size: 'sm',
            onClick: () => this._updateSW(),
            disabled: !c.hasSW,
          }),
          this._btn('unregister 注销', {
            size: 'sm', danger: true,
            onClick: () => this._unregisterSW(),
            disabled: !c.hasSW,
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, {
            color: this.state.regStatus === 'registered' ? 'success'
              : (this.state.regStatus === 'error' ? 'error'
                : (this.state.regStatus === 'registering' ? 'warning' : 'default')),
          }, `regStatus: ${this.state.regStatus}`),
          this.state.swState
            ? h(Tag, { color: 'primary' }, this.state.swState)
            : null,
        ),
        !c.hasSW && h(Alert, {
          type: 'warning',
          message: '当前环境不支持 Service Worker API',
          description: 'navigator.serviceWorker 在 jsdom 中通常不存在（已 mock）。需真实浏览器 + HTTPS（或 localhost）+ 独立脚本作用域。所有注册尝试将优雅失败，仅记 warn 日志。',
        }),
        h('div', { class: 'fs-sm text-secondary mt-xs' }, '内联 SW 脚本（通过 Blob URL 注册，演示生命周期）：'),
        this._preCode(SW_LIFECYCLE_SRC),
        h('p', { class: 'fs-xs text-tertiary' },
          '注：Blob URL 内联 SW 脚本可以构造，但 register 仍需安全上下文与同源；jsdom 中 register 会失败。this._registration 持有注册引用，componentWillUnmount 移除 updatefound 监听。'),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const c = this._caps();
    const card = new Card({
      title: '2. fetch 事件拦截 + Cache 策略',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'self.addEventListener("fetch")'),
        h(Tag, { color: 'primary' }, 'Cache API'),
        this._capTag(c.hasCaches),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'SW 中 self.addEventListener("fetch", event) 拦截作用域内所有请求，event.respondWith(response) 自定义响应。Cache 策略对比：Cache First（先查缓存，无则请求并存缓存）/ Network First（先请求，失败回退缓存）/ Stale While Revalidate（返回缓存同时后台更新）/ Cache Only / Network Only。caches.open(cacheName) / cache.match(request) / cache.put(request, response) / cache.delete(request) / cache.keys() 操作缓存；event.request.method / url / mode / headers 反映请求信息。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('注册 Cache First SW', {
            type: 'primary', size: 'sm',
            onClick: () => this._registerStrategySW('cache-first'),
            disabled: !c.hasSW,
          }),
          this._btn('注册 Network First SW', {
            type: 'primary', size: 'sm',
            onClick: () => this._registerStrategySW('network-first'),
            disabled: !c.hasSW,
          }),
          this._btn('注册 SWR SW', {
            type: 'primary', size: 'sm',
            onClick: () => this._registerStrategySW('swr'),
            disabled: !c.hasSW,
          }),
          this._btn('清空缓存', {
            size: 'sm', danger: true,
            onClick: () => this._clearCache(),
            disabled: !c.hasCaches,
          }),
          this._btn('列出缓存统计', {
            size: 'sm',
            onClick: () => this._listCacheStats(),
            disabled: !c.hasCaches,
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, { color: 'primary' },
            this.state.cacheStats ? this.state.cacheStats : 'cacheStats: （未查询）'),
        ),
        this._preCode(SW_CACHE_FIRST_SRC, '180px'),
        this._preCode(SW_NETWORK_FIRST_SRC, '180px'),
        this._preCode(SW_SWR_SRC, '200px'),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const c = this._caps();
    const card = new Card({
      title: '3. Background Sync 后台同步',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.sync'),
        this._capTag(c.hasSync),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'registration.sync.register(tag) 注册一次性后台同步事件；self.addEventListener("sync", event) 在 SW 中监听，event.tag 标识任务，event.waitUntil(promise) 保持 SW 存活直至任务完成。SyncManager：registration.sync.getTags() 列出已注册标签。用途：网络恢复时自动同步数据（离线发消息、表单提交），可延迟执行直至联网。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('注册 Background Sync', {
            type: 'primary', size: 'sm',
            onClick: () => this._registerBgSync(),
            disabled: !c.hasSW,
          }),
          this._btn('getTags 列出', {
            size: 'sm',
            onClick: () => this._syncGetTags(),
            disabled: !c.hasSW,
          }),
          this._btn('模拟 sync 触发（说明）', {
            size: 'sm',
            onClick: () => this._simulateSync(),
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, { color: 'primary' },
            `sync tags：${this.state.syncTags.length ? this.state.syncTags.join(', ') : '(空)'}`),
        ),
        !c.hasSync && h(Alert, {
          type: 'warning',
          message: '当前环境不支持 Background Sync',
          description: 'SyncManager 在 jsdom 中通常不存在。需真实浏览器 + HTTPS + 活动 Service Worker 注册。能力检测：registration.sync 存在方可调用。',
        }),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const c = this._caps();
    const card = new Card({
      title: '4. Push API 推送',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.pushManager'),
        this._capTag(c.hasPush),
        h(Tag, {
          color: this.state.pushStatus === '已订阅' ? 'success'
            : (this.state.pushStatus.startsWith('失败') ? 'error' : 'default'),
        }, `push: ${this.state.pushStatus}`),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }) 订阅推送，返回 PushSubscription。订阅对象含 endpoint（推送服务端 URL）/ expirationTime / keys（p256dh / auth，通过 getKey(name) 读取）。subscription.unsubscribe() 取消；getSubscription() 查询已有。SW 中 self.addEventListener("push", event) 接收推送，event.data.json() / text() / blob() / arrayBuffer() 解析负载；self.registration.showNotification(title, options) 显示通知。applicationServerKey 必须是 base64url 编码的 VAPID 公钥。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('订阅推送', {
            type: 'primary', size: 'sm',
            onClick: () => this._pushSubscribe(),
            disabled: !c.hasSW || !c.hasPush,
          }),
          this._btn('getSubscription', {
            size: 'sm',
            onClick: () => this._pushGetSub(),
            disabled: !c.hasSW || !c.hasPush,
          }),
          this._btn('取消订阅', {
            size: 'sm', danger: true,
            onClick: () => this._pushUnsubscribe(),
            disabled: !c.hasSW || !c.hasPush,
          }),
          this._btn('模拟 push 事件', {
            size: 'sm',
            onClick: () => this._simulatePush(),
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, { color: 'primary' }, `状态：${this.state.pushStatus}`),
        ),
        (!c.hasSW || !c.hasPush) && h(Alert, {
          type: 'warning',
          message: '当前环境不支持 Push API',
          description: 'Push 订阅必须依赖真实 Service Worker 注册 + 有效 VAPID 公钥。需 serviceWorker + PushManager 同时可用。沙箱无 SW，订阅将优雅失败（记 warn 日志）。',
        }),
        h('p', { class: 'fs-xs text-tertiary' },
          '注：演示用 mock VAPID key；真实场景由推送服务端生成密钥对，公钥传给前端 subscribe。'),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const c = this._caps();
    const card = new Card({
      title: '5. Notification 通知 + Periodic Sync',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'Notification'),
        this._capTag(c.hasNotif),
        h(Tag, {
          color: this.state.notifPermission === 'granted' ? 'success'
            : (this.state.notifPermission === 'denied' ? 'error' : 'default'),
        }, `permission: ${this.state.notifPermission}`),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'Notification.requestPermission() 返回 Promise<default|granted|denied>；Notification.permission 反映当前状态。new Notification(title, { body, icon, badge, tag, data, vibrate, requireInteraction, actions }) 创建通知，实例有 onclick / onshow / onclose / onerror 与 close()。registration.showNotification（SW 中）vs new Notification（页面中）：前者由 SW 触发可在页面关闭后显示，后者需页面打开。Periodic Background Sync：registration.periodicSync.register(tag, { minInterval }) 周期性同步，self.addEventListener("periodicsync", event) 监听。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('请求权限', {
            type: 'primary', size: 'sm',
            onClick: () => this._reqNotifPermission(),
            disabled: !c.hasNotif,
          }),
          this._btn('显示通知', {
            type: 'primary', size: 'sm',
            onClick: () => this._showNotification(),
            disabled: !c.hasNotif,
          }),
          this._btn('注册 Periodic Sync', {
            size: 'sm',
            onClick: () => this._registerPeriodicSync(),
            disabled: !c.hasSW,
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, {
            color: this.state.notifPermission === 'granted' ? 'success' : 'default',
          }, `Notification.permission: ${this.state.notifPermission}`),
        ),
        !c.hasNotif && h(Alert, {
          type: 'warning',
          message: '当前环境不支持 Notifications API',
          description: 'Notification 在 jsdom 中已 mock，但实际显示需真实浏览器 + 用户授权。Periodic Sync 需真实 SW + HTTPS。',
        }),
        h('p', { class: 'fs-xs text-tertiary' },
          '注：Notification 选项：body 正文 / icon 大图标 / badge 小图标 / tag 分组 / data 附带数据 / vibrate 震动 / requireInteraction 不自动关闭 / actions 按钮动作。'),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard6() {
    const c = this._caps();
    const card = new Card({
      title: '6. Service Worker Static Routing API',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.addRoutes'),
        this._capTag(c.hasAddRoutes),
        h(Tag, { color: 'primary' }, 'URLPattern'),
        this._capTag(c.hasURLPattern),
        h(Tag, { color: 'warning' }, 'Chrome 123+'),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'W3C Service Worker 静态路由 API：在 SW 启动前声明静态路由，跳过 SW 启动开销。浏览器支持 Chrome 123+。registration.addRoutes([{ condition, source }]) 声明路由表：condition 支持 URLPattern / URL / urlPatternString / or / and / not 复合条件；source 路由源 fetch-event（默认走 SW fetch 事件）/ network（直接网络跳过 SW）/ cache（直接缓存）/ race-network-and-fetch（网络与 SW 竞速）。与现有 fetch 事件路由对比：静态路由在 SW 启动前生效，浏览器直接按 source 分流，省去 SW 冷启动延迟；运行时动态路由仍需 fetch 事件兜底。'),
        h('p', { class: 'fs-sm text-secondary' },
          '实战·静态资源缓存：图片/JS/CSS 直接走 cache 或 network，跳过 SW 启动；API 请求走 fetch-event 由 SW 处理动态逻辑；文档请求走 fetch-event 与 Navigation Prefetch 协同。实战·性能优化：跳过 SW 启动延迟 / 首屏关键资源直连 / 与 Preload/Prefetch 协同 / 区别 Navigation Prefetch（后者预取导航请求，前者声明静态路由源）。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('演示 addRoutes 声明静态路由', {
            type: 'primary', size: 'sm',
            onClick: () => this._runStaticRoutingDemo(),
            disabled: !c.hasAddRoutes,
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, { color: 'primary' },
            this.state.staticRoutingInfo ? this.state.staticRoutingInfo : 'staticRouting: （未演示）'),
        ),
        !c.hasAddRoutes && h(Alert, {
          type: 'warning',
          message: '当前环境不支持 Static Routing API',
          description: 'registration.addRoutes 需 Chrome 123+ 与真实 SW 注册。能力检测：typeof ServiceWorkerRegistration.prototype.addRoutes === "function"。jsdom 中不可用，演示按钮将优雅失败（记 warn 日志）。降级方案：用传统 fetch 事件路由（self.addEventListener("fetch")）实现等价分流。',
        }),
        h('div', { class: 'fs-sm text-secondary mt-xs' }, '内联 SW 脚本（声明静态路由 + 兼容降级到 fetch 事件）：'),
        this._preCode(SW_STATIC_ROUTING_SRC, '320px'),
        h('p', { class: 'fs-xs text-tertiary' },
          '陷阱：Chrome 123+ 仅 / 与 URLPattern 协同（无 URLPattern 时改用 urlPatternString）/ 运行时动态路由仍需 fetch 事件 / 不支持时降级到传统 fetch 事件路由 / DevTools Application > Service Workers 可调试 addRoutes 路由表 / source: race-network-and-fetch 仅部分版本支持。'),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  // ============ 日志面板 ============
  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 渲染入口 ===================
  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Service Worker 深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Service Worker：生命周期(install/activate/skipWaiting) / fetch 拦截+Cache 策略(Cache First/Network First/SWR) / Background Sync / Push API / Notification+Periodic Sync / Static Routing API(Chrome 123+, 在 SW 启动前声明静态路由)。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
