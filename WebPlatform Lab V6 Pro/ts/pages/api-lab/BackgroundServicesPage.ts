// =====================================================================
// BackgroundServicesPage.ts —— 后台服务类 Web API 实验室
// 演示 MDN：Service Worker API、Cache API、Notifications API、
//           Push API、Background Sync API、Cookie Store API、StorageManager API
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { Input } from '../../components/ui/Input.js';
import type { Props, State } from '../../core/types.js';

// Service Worker 生命周期状态
const SW_STATES: string[] = ['parsed', 'installing', 'installed', 'activating', 'activated', 'redundant'];

// Cookie 项
interface CookieItem {
  name: string;
  value: string;
  [key: string]: any;
}

// Storage 估算结果
interface StorageEstimateInfo {
  quota?: number;
  usage?: number;
}

export interface BackgroundServicesPageProps extends Props {}

export interface BackgroundServicesLog {
  type: string;
  content: string;
  time: string;
}

export interface BackgroundServicesPageState extends State {
  logs: BackgroundServicesLog[];
  swState: string;
  swError: string;
  swScope: string;
  cacheList: string[];
  cacheContent: string;
  cacheKey: string;
  cacheValue: string;
  notifPermission: string;
  notifTitle: string;
  notifBody: string;
  pushState: string;
  pushDetail: string;
  syncState: string;
  syncTags: string[];
  cookieList: CookieItem[];
  cookieName: string;
  cookieValue: string;
  storageEstimate: StorageEstimateInfo | null;
  persisted: boolean;
}

export class BackgroundServicesPage extends Page {
  declare props: BackgroundServicesPageProps;
  declare state: BackgroundServicesPageState;
  _inited: boolean = false;
  _onCookieChange: ((event: any) => void) | null = null;

  initialState(): BackgroundServicesPageState {
    return {
      logs: [],
      swState: 'unregistered',
      swError: '',
      swScope: '',
      cacheList: [],
      cacheContent: '',
      cacheKey: 'demo-key',
      cacheValue: '{"hello":"world","n":42}',
      notifPermission: 'default',
      notifTitle: 'API 实验室通知',
      notifBody: '来自 BackgroundServicesPage 的演示',
      pushState: '未订阅',
      pushDetail: '',
      syncState: '未注册',
      syncTags: [],
      cookieList: [],
      cookieName: 'bg-svc-cookie',
      cookieValue: 'lab-' + Math.random().toString(36).slice(2, 8),
      storageEstimate: null,
      persisted: false,
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    const patch: Partial<BackgroundServicesPageState> = {};
    if ('Notification' in window) {
      patch.notifPermission = Notification.permission;
    }
    if ((Object as any).keys(patch).length) this.setState(patch);

    if ('cookieStore' in window && (window as any).cookieStore) {
      this._onCookieChange = (event: any) => {
        try {
          const changed: CookieItem[] = (event.changed || []).map((c: any) => c as CookieItem);
          const deleted: CookieItem[] = (event.deleted || []).map((c: any) => c as CookieItem);
          if (changed.length) this._addLog('cookie', `change 事件：变更 [${changed.map((c) => c.name).join(', ')}]`);
          if (deleted.length) this._addLog('cookie', `change 事件：删除 [${deleted.map((c) => c.name).join(', ')}]`);
        } catch { /* noop */ }
      };
      try {
        (window as any).cookieStore.addEventListener('change', this._onCookieChange);
        this._addLog('cookie', 'cookieStore change 监听已注册');
      } catch (err: any) {
        this._addLog('err', `cookieStore change 监听注册失败：${err.message}`);
      }
    }

    if ('caches' in window) {
      (caches as any).keys().then((names: string[]) => {
        if (this._destroyed || !names.length) return;
        this.setState({ cacheList: names });
      }).catch(() => { /* noop */ });
    }

    if (navigator.storage && typeof navigator.storage.persisted === 'function') {
      navigator.storage.persisted().then((p: boolean) => {
        if (this._destroyed) return;
        this.setState({ persisted: !!p });
      }).catch(() => { /* noop */ });
    }
    this._logCapabilities();
  }

  componentWillUnmount(): void {
    if (this._onCookieChange && 'cookieStore' in window && (window as any).cookieStore) {
      try { (window as any).cookieStore.removeEventListener('change', this._onCookieChange); }
      catch { /* noop */ }
    }
    this._onCookieChange = null;
  }

  _addLog(type: string, content: string): void {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
    });
  }
  _btn(label: string, opts: Props): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  _input(field: string, opts: Props = {}): Node {
    const input = new Input({
      value: this.state[field] ?? '',
      size: 'sm',
      style: { width: '200px' },
      ...opts,
      onChange: opts.onChange || ((v: string) => { this.state[field] = v; }),
    });
    this.registerChild(input);
    return input.render() as Node;
  }
  _formatBytes(bytes: number | undefined | null): string {
    if (bytes == null || Number.isNaN(bytes)) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  _logCapabilities(): void {
    const caps: [string, boolean][] = [
      ['serviceWorker', 'serviceWorker' in navigator],
      ['caches', 'caches' in window],
      ['Notification', 'Notification' in window],
      ['PushManager', 'PushManager' in window],
      ['cookieStore', 'cookieStore' in window],
      ['storage.estimate', !!(navigator.storage && typeof navigator.storage.estimate === 'function')],
    ];
    const summary = caps.map(([n, ok]: [string, boolean]) => `${n}:${ok ? '✓' : '✗'}`).join('  ');
    this._addLog('sw', `能力检测：${summary}`);
  }

  // =================== 1. Service Worker API ===================

  async _registerSW(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return this._addLog('sw', '当前环境不支持 Service Worker API');
    }
    this.setState({ swState: 'registering', swError: '' });
    this._addLog('sw', '【register】尝试注册 /sw-lab.js（scope: ./）');
    try {
      const reg = await navigator.serviceWorker.register('/sw-lab.js', { scope: './' });
      this._addLog('sw', `注册成功：scope=${reg.scope}`);
      this._addLog('sw', `installing=${reg.installing?.state || 'null'} waiting=${reg.waiting?.state || 'null'} active=${reg.active?.state || 'null'}`);
      this.setState({ swState: 'registered', swScope: reg.scope });
    } catch (err: any) {
      this._addLog('sw', `注册失败（沙箱需 HTTPS + 独立脚本）：${err.name} - ${err.message}`);
      this.setState({ swState: 'error', swError: err.message });
    }
  }
  async _unregisterSW(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return this._addLog('sw', '当前环境不支持 Service Worker API');
    }
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) {
        this._addLog('sw', '没有已注册的 ServiceWorker，无需 unregister');
        this.setState({ swState: 'unregistered', swScope: '' });
        return;
      }
      for (const r of regs) {
        await r.unregister();
        this._addLog('sw', `unregister 完成：scope=${r.scope}`);
      }
      this.setState({ swState: 'unregistered', swScope: '' });
    } catch (err: any) {
      this._addLog('err', `unregister 异常：${err.message}`);
    }
  }
  async _updateSW(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return this._addLog('sw', '当前环境不支持 Service Worker API');
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return this._addLog('sw', '无注册，无法调用 update()');
      await reg.update();
      this._addLog('sw', `update() 已调用，scope=${reg.scope}`);
    } catch (err: any) {
      this._addLog('sw', `update 失败（环境限制）：${err.message}`);
    }
  }
  _logController(): void {
    if (!('serviceWorker' in navigator)) return;
    const ctrl = navigator.serviceWorker.controller;
    this._addLog('sw', ctrl
      ? `controller 存在：state=${ctrl.state} scriptURL=${ctrl.scriptURL}`
      : 'controller 为 null（无活动控制器，页面未受 SW 控制）');
  }

  // =================== 2. Cache API ===================

  async _cachePut(): Promise<void> {
    if (!('caches' in window)) return this._addLog('err', 'Cache API 不可用');
    const key = this.state.cacheKey || 'demo-key';
    const value = this.state.cacheValue || '{}';
    try {
      const cache = await caches.open('bg-svc-cache-v1');
      const resp = new Response(value, { headers: { 'content-type': 'application/json' } });
      await cache.put(new Request(key), resp);
      this._addLog('cache', `put 成功：key=${key}，value=${value}`);
    } catch (err: any) {
      this._addLog('err', `cache.put 异常：${err.message}`);
    }
  }
  async _cacheRead(): Promise<void> {
    if (!('caches' in window)) return this._addLog('err', 'Cache API 不可用');
    const key = this.state.cacheKey || 'demo-key';
    try {
      const cache = await caches.open('bg-svc-cache-v1');
      const resp = await cache.match(new Request(key));
      if (!resp) {
        this._addLog('cache', `match 未命中：key=${key}`);
        this.setState({ cacheContent: '（未命中）' });
        return;
      }
      const text = await resp.text();
      this._addLog('cache', `match 命中：key=${key} => ${text}`);
      this.setState({ cacheContent: text });
    } catch (err: any) {
      this._addLog('err', `cache.match 异常：${err.message}`);
    }
  }
  async _cacheListAll(): Promise<void> {
    if (!('caches' in window)) return this._addLog('err', 'Cache API 不可用');
    try {
      const names = await (caches as any).keys();
      this.setState({ cacheList: names });
      this._addLog('cache', `(caches as any).keys() => 共 ${names.length} 个：[${names.join(', ') || '空'}]`);
    } catch (err: any) {
      this._addLog('err', `caches.keys 异常：${err.message}`);
    }
  }
  async _cacheKeysInOne(): Promise<void> {
    if (!('caches' in window)) return this._addLog('err', 'Cache API 不可用');
    try {
      const cache = await caches.open('bg-svc-cache-v1');
      const reqs = await (cache as any).keys();
      this._addLog('cache', `(cache as any).keys() => ${reqs.length} 条 Request：[${reqs.map((r: any) => r.url).join(', ') || '空'}]`);
    } catch (err: any) {
      this._addLog('err', `cache.keys 异常：${err.message}`);
    }
  }
  async _cacheDeleteAll(): Promise<void> {
    if (!('caches' in window)) return this._addLog('err', 'Cache API 不可用');
    try {
      const names = await (caches as any).keys();
      if (!names.length) return this._addLog('cache', '无缓存可删除');
      for (const n of names) {
        const ok = await caches.delete(n);
        this._addLog('cache', `caches.delete(${n}) => ${ok}`);
      }
      this.setState({ cacheList: [], cacheContent: '' });
    } catch (err: any) {
      this._addLog('err', `caches.delete 异常：${err.message}`);
    }
  }

  // =================== 3. Notifications API ===================

  async _reqNotifPermission(): Promise<void> {
    if (!('Notification' in window)) return this._addLog('err', 'Notifications API 不可用');
    try {
      const perm = await Notification.requestPermission();
      this.setState({ notifPermission: perm });
      this._addLog('notif', `requestPermission() => ${perm}`);
    } catch (err: any) {
      this._addLog('err', `requestPermission 异常：${err.message}`);
    }
  }
  _showNotification(): void {
    if (!('Notification' in window)) return this._addLog('err', 'Notifications API 不可用');
    if (Notification.permission !== 'granted') {
      return this._addLog('notif', `权限为 ${Notification.permission}，需先 requestPermission 并获 granted`);
    }
    try {
      const title = this.state.notifTitle || '通知';
      const body = this.state.notifBody || '';
      const n = new Notification(title, {
        body,
        tag: 'bg-svc-notif',
        silent: false,
        requireInteraction: false,
        data: { from: 'BackgroundServicesPage', ts: Date.now() },
      });
      n.onshow = () => this._addLog('notif', `onshow 触发（title=${title}）`);
      n.onclick = () => { this._addLog('notif', 'onclick 触发，调用 close()'); n.close(); };
      n.onerror = () => this._addLog('err', 'notification onerror 触发');
      n.onclose = () => this._addLog('notif', 'onclose 触发');
      this._addLog('notif', `new Notification(${JSON.stringify(title)}) 已创建，tag=${n.tag}`);
    } catch (err: any) {
      this._addLog('err', `new Notification 异常：${err.message}`);
    }
  }

  // =================== 4. Push API ===================

  async _pushSubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return this._addLog('push', 'Push API 不可用（需 serviceWorker + PushManager）');
    }
    this._addLog('push', '【subscribe】尝试订阅（需真实 SW + VAPID 公钥）');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        this._addLog('push', '无 SW 注册，无法 pushManager.subscribe（沙箱限制，记为环境限制）');
        this.setState({ pushState: '失败', pushDetail: '无 SW 注册' });
        return;
      }
      const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: (this as any)._urlBase64ToUint8Array(vapidPublicKey),
      });
      this._addLog('push', `订阅成功：endpoint=${sub.endpoint}`);
      this._addLog('push', `expirationTime=${sub.expirationTime}，getKey p256dh=${!!sub.getKey('p256dh')} auth=${!!sub.getKey('auth')}`);
      this.setState({ pushState: '已订阅', pushDetail: sub.endpoint });
    } catch (err: any) {
      this._addLog('push', `订阅失败（需真实 SW + 有效 VAPID）：${err.name} - ${err.message}`);
      this.setState({ pushState: '失败', pushDetail: err.message });
    }
  }
  async _pushGetSub(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return this._addLog('push', 'Push API 不可用');
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return this._addLog('push', '无 SW 注册，无法查询订阅');
      const sub = await reg.pushManager.getSubscription();
      const perm = await reg.pushManager.permissionState({ userVisibleOnly: true });
      if (sub) {
        this._addLog('push', `已有订阅：endpoint=${sub.endpoint}`);
        this.setState({ pushState: '已订阅', pushDetail: sub.endpoint });
      } else {
        this._addLog('push', `无订阅；permissionState=${perm}`);
        this.setState({ pushState: '未订阅', pushDetail: `permissionState=${perm}` });
      }
    } catch (err: any) {
      this._addLog('push', `查询订阅失败（环境限制）：${err.message}`);
    }
  }
  async _pushUnsubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return this._addLog('push', 'Push API 不可用');
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return this._addLog('push', '无 SW 注册');
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        this._addLog('push', '无订阅可取消');
        this.setState({ pushState: '未订阅', pushDetail: '' });
        return;
      }
      const ok = await sub.unsubscribe();
      this._addLog('push', `unsubscribe() => ${ok}`);
      this.setState({ pushState: '未订阅', pushDetail: '' });
    } catch (err: any) {
      this._addLog('push', `unsubscribe 失败（环境限制）：${err.message}`);
    }
  }

  _urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // =================== 5. Background Sync API ===================

  async _syncRegister(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return this._addLog('sync', 'Background Sync 需要 Service Worker（当前环境不支持）');
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg || !(reg as any).sync) {
        this._addLog('sync', '无 SW 注册或不支持 Background Sync（registration.sync 不可用）');
        this.setState({ syncState: '失败' });
        return;
      }
      await (reg as any).sync.register('bg-sync-tag');
      this._addLog('sync', `sync.register('bg-sync-tag') 完成`);
      this.setState({ syncState: '已注册' });
    } catch (err: any) {
      this._addLog('sync', `sync.register 失败（环境限制）：${err.message}`);
      this.setState({ syncState: '失败' });
    }
  }
  async _syncGetTags(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return this._addLog('sync', 'Background Sync 需要 Service Worker');
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg || !(reg as any).sync) {
        return this._addLog('sync', '无 SW 或不支持 sync，无法 getTags()');
      }
      const tags: string[] = await (reg as any).sync.getTags();
      this.setState({ syncTags: tags });
      this._addLog('sync', `sync.getTags() => [${tags.join(', ') || '空'}]`);
    } catch (err: any) {
      this._addLog('sync', `sync.getTags 失败（环境限制）：${err.message}`);
    }
  }
  async _periodicSyncRegister(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return this._addLog('sync', 'Periodic Sync 需要 Service Worker');
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg || !(reg as any).periodicSync) {
        this._addLog('sync', '无 SW 或不支持 Periodic Background Sync（registration.periodicSync 不可用）');
        return;
      }
      await (reg as any).periodicSync.register('periodic-sync-tag', { minInterval: 24 * 60 * 60 * 1000 });
      this._addLog('sync', `periodicSync.register('periodic-sync-tag', { minInterval: 24h }) 完成`);
    } catch (err: any) {
      this._addLog('sync', `periodicSync.register 失败（环境限制）：${err.message}`);
    }
  }

  // =================== 6. Cookie Store API ===================

  async _cookieSet(): Promise<void> {
    if (!('cookieStore' in window) || !(window as any).cookieStore) {
      return this._addLog('err', 'Cookie Store API 不可用（需安全上下文 HTTPS/localhost）');
    }
    const name = this.state.cookieName || 'demo';
    const value = this.state.cookieValue || 'val';
    try {
      await (window as any).cookieStore.set({ name, value, path: '/', sameSite: 'lax' });
      this._addLog('cookie', `set({ name:${name}, value:${value}, path:/, sameSite:lax })`);
    } catch (err: any) {
      this._addLog('err', `cookieStore.set 异常：${err.message}`);
    }
  }
  async _cookieGetAll(): Promise<void> {
    if (!('cookieStore' in window) || !(window as any).cookieStore) {
      return this._addLog('err', 'Cookie Store API 不可用');
    }
    try {
      const all: CookieItem[] = await (window as any).cookieStore.getAll();
      this.setState({ cookieList: all });
      this._addLog('cookie', `getAll() => 共 ${all.length} 条：[${all.map((c) => c.name).join(', ') || '空'}]`);
    } catch (err: any) {
      this._addLog('err', `cookieStore.getAll 异常：${err.message}`);
    }
  }
  async _cookieDelete(): Promise<void> {
    if (!('cookieStore' in window) || !(window as any).cookieStore) {
      return this._addLog('err', 'Cookie Store API 不可用');
    }
    const name = this.state.cookieName || 'demo';
    try {
      await (window as any).cookieStore.delete(name);
      this._addLog('cookie', `delete(${name}) 已调用（change 事件将随后触发）`);
    } catch (err: any) {
      this._addLog('err', `cookieStore.delete 异常：${err.message}`);
    }
  }

  // =================== 7. StorageManager API ===================

  async _storageEstimate(): Promise<void> {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return this._addLog('err', 'StorageManager.estimate 不可用');
    }
    try {
      const est = await navigator.storage.estimate();
      this.setState({ storageEstimate: { quota: est.quota, usage: est.usage } });
      this._addLog('storage', `estimate() => quota=${this._formatBytes(est.quota)} usage=${this._formatBytes(est.usage)}`);
    } catch (err: any) {
      this._addLog('err', `storage.estimate 异常：${err.message}`);
    }
  }
  async _storagePersist(): Promise<void> {
    if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
      return this._addLog('err', 'StorageManager.persist 不可用');
    }
    try {
      const ok = await navigator.storage.persist();
      this.setState({ persisted: ok });
      this._addLog('storage', `persist() => ${ok}（${ok ? '已获持久化，不会被自动清除' : '未获持久化授权'}）`);
    } catch (err: any) {
      this._addLog('err', `storage.persist 异常：${err.message}`);
    }
  }
  async _storagePersisted(): Promise<void> {
    if (!navigator.storage || typeof navigator.storage.persisted !== 'function') {
      return this._addLog('err', 'StorageManager.persisted 不可用');
    }
    try {
      const p = await navigator.storage.persisted();
      this.setState({ persisted: p });
      this._addLog('storage', `persisted() => ${p}`);
    } catch (err: any) {
      this._addLog('err', `storage.persisted 异常：${err.message}`);
    }
  }

  // =================== 渲染 ===================
  renderPage(): Node | string | (Node | string)[] {
    const hasSW = 'serviceWorker' in navigator;
    const hasCaches = 'caches' in window;
    const hasNotif = 'Notification' in window;
    const hasPush = 'serviceWorker' in navigator && 'PushManager' in window;
    const hasCookie = 'cookieStore' in window && !!(window as any).cookieStore;
    const hasStorage = !!(navigator.storage && typeof navigator.storage.estimate === 'function');

    const ctrl = hasSW ? navigator.serviceWorker.controller : null;
    const est = this.state.storageEstimate;
    const usedPct = est && est.quota ? Math.min(100, ((est.usage || 0) / est.quota) * 100) : 0;

    return [
      h('h2', { class: 'section-title' }, '后台服务类 Web API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'Service Worker / Cache / Notifications / Push / Background Sync / Cookie Store / StorageManager',
        description: '七大后台与存储类 Web API 综合演示。Service Worker、Push、Background Sync 需要 HTTPS（或 localhost）与独立脚本作用域；沙箱中相关注册将优雅失败，重点展示 API 形态与能力检测。所有操作日志输出在页面底部。',
      }),

      h(Card, {
        title: '1. Service Worker API（navigator.serviceWorker）',
        extra: h(Tag, { color: hasSW ? 'success' : 'default' }, hasSW ? '可用' : '不可用'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'navigator.serviceWorker.register(swUrl, { scope }) 返回 Promise<ServiceWorkerRegistration>，含 .installing/.waiting/.active 三个 ServiceWorker 实例与 .scope/.update()/.unregister()。SW 状态：parsed → installing → installed → activating → activated → redundant。controller 指向当前控制页面的活动 SW（无则为 null）。可监听 navigator.serviceWorker 的 controllerchange（控制器变更）与 registration 的 updatefound（发现新版本 SW）事件。SW 是离线、Push、Background Sync 的基础，但需要 HTTPS + 独立脚本。'),
          !hasSW
            ? h(Alert, { type: 'warning', message: '当前环境不支持 Service Worker API（navigator.serviceWorker 未定义）' })
            : h('div', { class: 'flex flex-col gap-sm' },
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._btn('注册 SW', { type: 'primary', size: 'sm', onClick: () => this._registerSW() }),
                  this._btn('取消注册', { danger: true, size: 'sm', onClick: () => this._unregisterSW() }),
                  this._btn('update()', { size: 'sm', onClick: () => this._updateSW() }),
                  this._btn('查看 controller', { size: 'sm', onClick: () => this._logController() }),
                ),
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  h(Tag, { color: this.state.swState === 'registered' ? 'success' : this.state.swState === 'error' ? 'warning' : 'default' }, `状态：${this.state.swState}`),
                  this.state.swScope ? h(Tag, { color: 'primary' }, `scope: ${this.state.swScope}`) : null as any,
                  h(Tag, { color: ctrl ? 'success' : 'default' }, `controller: ${ctrl ? ctrl.state : 'null'}`),
                ),
                this.state.swError ? h('div', { class: 'fs-sm', style: { color: '#ff5555' } }, `错误：${this.state.swError}`) : null as any,
                h('div', { class: 'fs-sm text-tertiary' }, `SW 生命周期状态：${SW_STATES.join(' → ')}`),
              ),
        ),
      ),

      h(Card, {
        title: '2. Cache API（caches —— 无需 SW 即可使用）',
        extra: h(Tag, { color: hasCaches ? 'success' : 'default' }, hasCaches ? '可用' : '不可用'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'caches.open(name) 打开 Cache 对象；cache.put(request, response) 写入；cache.add(url) 自动 fetch+put；cache.addAll([...]) 批量；cache.match(request) 读取 Response；cache.matchAll() 读取全部；(cache as any).keys() 列出所有 Request；(caches as any).keys() 列出所有缓存名；caches.delete(name) 删除整个缓存。Cache API 独立于 SW，可在普通页面直接使用。'),
          !hasCaches
            ? h(Alert, { type: 'warning', message: '当前环境不支持 Cache API（caches 未定义）' })
            : h('div', { class: 'flex flex-col gap-sm' },
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._input('cacheKey', { placeholder: '缓存 key', style: { width: '160px' } }),
                  this._input('cacheValue', { placeholder: '缓存 value（JSON 字符串）', style: { width: '260px' } }),
                ),
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._btn('写入缓存', { type: 'primary', size: 'sm', onClick: () => this._cachePut() }),
                  this._btn('读取缓存', { type: 'primary', size: 'sm', onClick: () => this._cacheRead() }),
                  this._btn('列出所有缓存', { size: 'sm', onClick: () => this._cacheListAll() }),
                  this._btn('列出缓存内 Request', { size: 'sm', onClick: () => this._cacheKeysInOne() }),
                  this._btn('删除全部缓存', { danger: true, size: 'sm', onClick: () => this._cacheDeleteAll() }),
                ),
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  h(Tag, { color: 'primary' }, `缓存名：${this.state.cacheList.length ? this.state.cacheList.join(', ') : '(空)'}`),
                ),
                this.state.cacheContent ? h('pre', { class: 'code-block', style: { maxHeight: '100px' } },
                  `cache.match => ${this.state.cacheContent}`) : null,
              ),
        ),
      ),

      h(Card, {
        title: '3. Notifications API（Notification）',
        extra: h(Tag, { color: hasNotif ? 'success' : 'default' }, hasNotif ? `权限：${this.state.notifPermission}` : '不可用'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Notification.requestPermission() 返回 Promise<default|granted|denied>；Notification.permission 反映当前状态。new Notification(title, { body, icon, badge, tag, renotify, requireInteraction, silent, vibrate, dir, lang, data, actions }) 创建通知，实例有 onclick/onshow/onerror/onclose 与 close()。SW 作用域下可用 registration.showNotification()。'),
          !hasNotif
            ? h(Alert, { type: 'warning', message: '当前环境不支持 Notifications API（Notification 未定义）' })
            : h('div', { class: 'flex flex-col gap-sm' },
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._input('notifTitle', { placeholder: '通知标题', style: { width: '200px' } }),
                  this._input('notifBody', { placeholder: '通知正文', style: { width: '280px' } }),
                ),
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._btn('请求权限', { type: 'primary', size: 'sm', onClick: () => this._reqNotifPermission() }),
                  this._btn('显示通知', { type: 'primary', size: 'sm', onClick: () => this._showNotification() }),
                ),
                h('div', { class: 'fs-sm text-tertiary' }, '选项说明：body 正文 / icon 大图标 / badge 小图标 / tag 分组 / renotify 重新提醒 / requireInteraction 不自动关闭 / silent 静默 / vibrate 震动 / data 附带数据 / actions 按钮动作。'),
              ),
        ),
      ),

      h(Card, {
        title: '4. Push API（PushManager）',
        extra: h(Tag, { color: hasPush ? 'success' : 'default' }, hasPush ? this.state.pushState : '不可用'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'registration.pushManager.subscribe({ userVisibleOnly, applicationServerKey }) 返回 Promise<PushSubscription>。订阅对象含 .endpoint / .expirationTime / .options / .getKey(name)（name 取 p256dh 或 auth）。subscription.unsubscribe() 取消；getSubscription() 查询已有；permissionState() 返回 granted/denied/prompt。applicationServerKey 必须是 base64url 编码的 VAPID 公钥。'),
          !hasPush
            ? h(Alert, { type: 'warning', message: '当前环境不支持 Push API（需 serviceWorker + PushManager）' })
            : h('div', { class: 'flex flex-col gap-sm' },
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._btn('订阅', { type: 'primary', size: 'sm', onClick: () => this._pushSubscribe() }),
                  this._btn('查询订阅', { size: 'sm', onClick: () => this._pushGetSub() }),
                  this._btn('取消订阅', { danger: true, size: 'sm', onClick: () => this._pushUnsubscribe() }),
                ),
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  h(Tag, { color: 'primary' }, `状态：${this.state.pushState}`),
                ),
                this.state.pushDetail ? h('div', { class: 'fs-sm text-tertiary', style: { wordBreak: 'break-all' } }, `详情：${this.state.pushDetail}`) : null as any,
                h('div', { class: 'fs-sm text-tertiary' }, '提示：Push 订阅必须依赖真实 Service Worker 注册 + 有效 VAPID 公钥；沙箱无 SW，订阅将优雅失败。'),
              ),
        ),
      ),

      h(Card, {
        title: '5. Background Sync API（registration.sync / periodicSync）',
        extra: h(Tag, { color: 'success' }, this.state.syncState),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'registration.sync.register(tag) 注册一次性后台同步；sync.getTags() 列出标签。Periodic Sync：periodicSync.register(tag, { minInterval }) 周期性同步；periodicSync.getTags() 列出。当网络恢复时，SW 中触发 sync 事件，可延迟执行直至联网。两类 sync 均需活动 SW。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('注册 sync', { type: 'primary', size: 'sm', onClick: () => this._syncRegister() }),
            this._btn('getTags()', { size: 'sm', onClick: () => this._syncGetTags() }),
            this._btn('注册 periodicSync', { size: 'sm', onClick: () => this._periodicSyncRegister() }),
          ),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            h(Tag, { color: 'primary' }, `sync tags：${this.state.syncTags.length ? this.state.syncTags.join(', ') : '(空)'}`),
          ),
          h('div', { class: 'fs-sm text-tertiary' }, '提示：Background Sync 依赖活动 Service Worker；沙箱无 SW，注册将优雅失败（记为环境限制）。'),
        ),
      ),

      h(Card, {
        title: '6. Cookie Store API（cookieStore）',
        extra: h(Tag, { color: hasCookie ? 'success' : 'default' }, hasCookie ? '可用' : '不可用'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'cookieStore.set({ name, value, domain, path, expires, maxAge, secure, sameSite, httpOnly }) 或 set(name, value) 写入；get(name) / getAll() 读取；delete(name) 删除。change 事件含 event.changed / event.deleted 两个数组。需安全上下文（HTTPS/localhost）。'),
          !hasCookie
            ? h(Alert, { type: 'warning', message: '当前环境不支持 Cookie Store API（需安全上下文 HTTPS/localhost）' })
            : h('div', { class: 'flex flex-col gap-sm' },
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._input('cookieName', { placeholder: 'cookie 名', style: { width: '160px' } }),
                  this._input('cookieValue', { placeholder: 'cookie 值', style: { width: '220px' } }),
                ),
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._btn('写入 cookie', { type: 'primary', size: 'sm', onClick: () => this._cookieSet() }),
                  this._btn('获取全部', { type: 'primary', size: 'sm', onClick: () => this._cookieGetAll() }),
                  this._btn('删除 cookie', { danger: true, size: 'sm', onClick: () => this._cookieDelete() }),
                ),
                h('div', { class: 'fs-sm text-tertiary' }, `当前 cookie 列表：${this.state.cookieList.length ? this.state.cookieList.map((c) => `${c.name}=${c.value}`).join('; ') : '(空，点击「获取全部」)'}`),
                h('div', { class: 'fs-sm text-tertiary' }, '提示：cookieStore change 事件监听已在挂载时注册，写入/删除会触发日志。'),
              ),
        ),
      ),

      h(Card, {
        title: '7. StorageManager API（navigator.storage）',
        extra: h(Tag, { color: hasStorage ? 'success' : 'default' }, hasStorage ? (this.state.persisted ? '已持久化' : '未持久化') : '不可用'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'navigator.storage.estimate() 返回 { quota, usage }；persist() 请求持久化存储（不被自动清除）；persisted() 查询当前状态。持久化存储可保护数据免受存储压力下的自动清除。'),
          !hasStorage
            ? h(Alert, { type: 'warning', message: '当前环境不支持 StorageManager.estimate' })
            : h('div', { class: 'flex flex-col gap-sm' },
                h('div', { class: 'flex items-center gap-sm flex-wrap' },
                  this._btn('获取 estimate', { type: 'primary', size: 'sm', onClick: () => this._storageEstimate() }),
                  this._btn('请求 persist', { type: 'primary', size: 'sm', onClick: () => this._storagePersist() }),
                  this._btn('查询 persisted', { size: 'sm', onClick: () => this._storagePersisted() }),
                ),
                est ? h('div', { class: 'flex flex-col gap-xs' },
                  h('div', { class: 'fs-sm' },
                    `配额 quota：${this._formatBytes(est.quota)}，已用 usage：${this._formatBytes(est.usage)}（${(usedPct as any).toFixed(2)}%）`),
                  h('div', { style: { background: '#1e1e1e', borderRadius: '4px', height: '10px', overflow: 'hidden' } },
                    h('div', { style: { background: '#50fa7b', height: '100%', width: `${usedPct}%` } }),
                  ),
                  h('div', { class: 'fs-sm text-tertiary' }, `持久化状态：${this.state.persisted ? '已持久化（persisted=true）' : '未持久化（persisted=false）'}`),
                ) : null,
              ),
        ),
      ),

      h(Card, {
        title: '事件日志',
        extra: h(Tag, { color: 'primary' }, `${this.state.logs.length} 条`),
      },
        this.state.logs.length === 0
          ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无日志）')
          : h('div', { class: 'log-panel' },
            ...this.state.logs.map((log: BackgroundServicesLog) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
              h('span', {}, log.content),
            )),
          ),
      ),
    ];
  }
}
