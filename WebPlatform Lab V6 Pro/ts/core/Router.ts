// =====================================================================
// Router.ts —— 基于 History API 的自研路由系统
// 设计模式：单例（router 实例）、观察者（popstate 订阅）、
//           策略（history/hash 可切换）、命令（push/replace/go）、
//           装饰器（守卫 beforeEach）
// 演示 MDN：History API、popstate/hashchange、URL/URLSearchParams、
//           CustomEvent、正则、Symbol.iterator
// =====================================================================

import { parseQuery, stringifyQuery, is, uid } from './utils.js';
import { eventBus, EVENTS } from './EventBus.js';
import type {
  RouteConfig,
  RouteRecord,
  RouteLocation,
  NavigationGuard,
  RouterMode,
  ComponentConstructor,
  Props,
} from './types.js';
import type { Component } from './Component.js';

/** 路由策略接口 */
interface RouterStrategy {
  push(path: string, state: any): void;
  replace(path: string, state: any): void;
  readonly path: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

/** history 模式策略 */
const HISTORY_STRATEGY: RouterStrategy = {
  push(path, state) { window.history.pushState(state, '', path); },
  replace(path, state) { window.history.replaceState(state, '', path); },
  get path() { return window.location.pathname + window.location.search + window.location.hash; },
  get pathname() { return window.location.pathname; },
  get search() { return window.location.search; },
  get hash() { return window.location.hash; },
};

/** hash 模式策略 */
const HASH_STRATEGY: RouterStrategy = {
  push(path, state) {
    const hash = `#${path}`;
    window.history.pushState(state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },
  replace(path, state) {
    const hash = `#${path}`;
    window.history.replaceState(state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },
  get path() {
    return window.location.hash.slice(1) || '/';
  },
  get pathname() {
    const hash = window.location.hash.slice(1) || '/';
    return hash.split('?')[0];
  },
  get search() {
    const hash = window.location.hash.slice(1) || '/';
    const idx = hash.indexOf('?');
    return idx >= 0 ? hash.slice(idx) : '';
  },
  get hash() { return ''; },
};

export interface RouterOptions {
  mode?: RouterMode;
  base?: string;
  routes?: RouteConfig[];
}

export class Router {
  static _instance: Router | null = null;

  mode: RouterMode;
  strategy: RouterStrategy;
  base: string;
  routes: RouteRecord[];
  private _beforeGuards: NavigationGuard[];
  private _afterGuards: NavigationGuard[];
  private _current: RouteRecord | null;
  private _currentInstance: Component | null;
  private _currentParams: Record<string, string>;
  private _currentQuery: Record<string, string>;
  private _pending: any;
  private _instanceId: string;

  constructor(options: RouterOptions = {}) {
    if (Router._instance) {
      throw new Error('Router 已存在单例，请使用 router 实例');
    }
    Router._instance = this;

    this.mode = options.mode === 'hash' ? 'hash' : 'history';
    this.strategy = this.mode === 'hash' ? HASH_STRATEGY : HISTORY_STRATEGY;
    this.base = options.base || '';
    this.routes = [];
    this._beforeGuards = [];
    this._afterGuards = [];
    this._current = null;
    this._currentInstance = null;
    this._currentParams = {};
    this._currentQuery = {};
    this._pending = null;
    this._instanceId = uid('router');

    this._flattenRoutes(options.routes || [], '', []);
    this._bindPopState();
  }

  // —— 路由表处理 ——
  private _flattenRoutes(routes: RouteConfig[], parentPath: string, parentMatched: RouteRecord[]): void {
    for (const route of routes) {
      const fullPath = this._normalizePath(parentPath + '/' + (route.path || ''));
      const record: RouteRecord = {
        path: fullPath,
        regex: this._pathToRegex(fullPath),
        keys: this._extractKeys(fullPath),
        component: route.component,
        name: route.name,
        meta: route.meta || {},
        redirect: route.redirect,
        parent: parentMatched.length ? parentMatched[parentMatched.length - 1] : null,
        matched: [],
      };
      record.matched = [...parentMatched, record];
      this.routes.push(record);
      if (route.children?.length) {
        this._flattenRoutes(route.children, fullPath, record.matched);
      }
    }
  }

  private _normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  /** 把 /user/:id 转成正则 + 提取参数名 */
  private _pathToRegex(path: string): RegExp {
    if (path === '*') return /.*/;
    const pattern = path
      .replace(/\/$/, '')
      .replace(/\*/g, '.*')
      .replace(/:([^/]+)/g, '([^/]+)');
    return new RegExp('^' + pattern + '/?$', 'i');
  }

  private _extractKeys(path: string): string[] {
    if (path === '*') return [];
    const keys: string[] = [];
    const re = /:([^/]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(path)) !== null) keys.push(m[1]);
    return keys;
  }

  // —— 浏览器事件绑定 ——
  private _bindPopState(): void {
    if (this.mode === 'hash') {
      window.addEventListener('hashchange', this._onLocationChange);
    } else {
      window.addEventListener('popstate', this._onLocationChange);
    }
    document.addEventListener('click', this._onGlobalClick, true);
  }

  private _onLocationChange = (event: Event): void => {
    this._navigate(this.strategy.path, { type: 'pop', state: (event as PopStateEvent).state });
  };

  private _onGlobalClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const linkEl = target?.closest?.('[data-link]') as Element | null;
    if (!linkEl) return;
    const path = linkEl.getAttribute('data-link');
    if (!path) return;
    event.preventDefault();
    event.stopPropagation();
    this.push(path);
  };

  // —— 路由匹配 ——
  match(pathname?: string): { route: RouteRecord; params: Record<string, string> } | null {
    const path = pathname || this.strategy.pathname;
    for (const route of this.routes) {
      const match = route.regex.exec(path);
      if (match) {
        const params: Record<string, string> = {};
        route.keys.forEach((key, i) => {
          params[key] = decodeURIComponent(match[i + 1]);
        });
        return { route, params };
      }
    }
    return null;
  }

  // —— 编程式导航（命令模式） ——
  push(path: string, state?: any): void {
    this._navigate(path, { type: 'push', state });
  }

  replace(path: string, state?: any): void {
    this._navigate(path, { type: 'replace', state });
  }

  go(n: number): void { window.history.go(n); }
  back(): void { window.history.back(); }
  forward(): void { window.history.forward(); }

  /** 按名称跳转 + 参数 */
  pushByName(name: string, params: Record<string, string> = {}, query: Record<string, any> = {}): void {
    const route = this.routes.find((r) => r.name === name);
    if (!route) throw new Error(`[Router] 路由名 "${name}" 不存在`);
    let path = route.path;
    for (const [k, v] of Object.entries(params)) {
      path = path.replace(`:${k}`, encodeURIComponent(v));
    }
    path += stringifyQuery(query);
    this.push(path);
  }

  // —— 守卫（装饰器模式） ——
  beforeEach(fn: NavigationGuard): () => void {
    this._beforeGuards.push(fn);
    return () => this._removeGuard(this._beforeGuards, fn);
  }

  afterEach(fn: NavigationGuard): () => void {
    this._afterGuards.push(fn);
    return () => this._removeGuard(this._afterGuards, fn);
  }

  private _removeGuard(arr: NavigationGuard[], fn: NavigationGuard): void {
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  // —— 核心导航流程 ——
  private async _navigate(rawPath: string, { type = 'push', state = null }: { type?: string; state?: any } = {}): Promise<void> {
    const [pathname, search = ''] = rawPath.split('?');
    const query = parseQuery(search);
    const matched = this.match(pathname);

    if (!matched) {
      const notFound = this.routes.find((r) => r.path === '*');
      if (notFound && notFound !== this._current) {
        await this._navigate('*', { type: 'replace', state });
        return;
      }
      console.warn(`[Router] 未匹配路由: ${pathname}`);
      return;
    }

    const { route, params } = matched;
    const to: RouteLocation = {
      path: pathname,
      fullPath: rawPath,
      query,
      params,
      route,
      matched: route.matched,
    };
    const from: RouteLocation | null = this._current
      ? {
          path: this._current.path,
          fullPath: this._current.fullPath || this._current.path,
          query: this._currentQuery,
          params: this._currentParams,
          route: this._current,
          matched: this._current.matched,
        }
      : null;

    // 重定向处理
    if (route.redirect) {
      const target = typeof route.redirect === 'function'
        ? route.redirect({ to, from })
        : route.redirect;
      await this._navigate(target, { type: 'replace', state });
      return;
    }

    // 前置守卫
    eventBus.emit(EVENTS.ROUTER_BEFORE, { to, from });
    for (const guard of this._beforeGuards) {
      try {
        const result = await guard(to, from);
        if (result === false) return;
        if (is.str(result)) {
          await this._navigate(result, { type: 'replace', state });
          return;
        }
      } catch (err) {
        console.error('[Router] beforeEach guard error:', err);
        return;
      }
    }

    // 离开守卫：当前页面的 onRouteLeave
    if (this._currentInstance && typeof (this._currentInstance as any).onRouteLeave === 'function') {
      if ((this._currentInstance as any).onRouteLeave() === false) {
        return;
      }
    }

    // 写入 history
    if (type === 'push') this.strategy.push(rawPath, state);
    else if (type === 'replace') this.strategy.replace(rawPath, state);

    // 切换页面组件
    await this._renderPage(route, { to, from, params, query });

    this._current = route;
    this._currentParams = params;
    this._currentQuery = query;

    // 后置钩子
    for (const hook of this._afterGuards) {
      try { await hook(to, from); }
      catch (err) { console.error('[Router] afterEach error:', err); }
    }
    eventBus.emit(EVENTS.ROUTER_AFTER, { to, from });

    // 设置文档标题
    if (route.meta?.title) document.title = `${route.meta.title} · 原生 SPA`;
  }

  private async _renderPage(
    route: RouteRecord,
    { to, from, params, query }: { to: RouteLocation; from: RouteLocation | null; params: Record<string, string>; query: Record<string, string> },
  ): Promise<void> {
    const matchedChain = route.matched.filter(Boolean);
    if (matchedChain.length === 0) return;

    const TargetComponent = matchedChain[matchedChain.length - 1].component;
    if (!TargetComponent) return;

    const outlet = document.getElementById('router-outlet');
    if (!outlet) {
      console.error('[Router] 找不到 #router-outlet 挂载点');
      return;
    }

    // 快速连点导航兜底：清理上一轮尚未淡出完毕的残留旧页 DOM
    outlet.querySelectorAll('.page-leave').forEach((node) => node.remove());

    // —— 无感切换：旧页淡出 + 新页立即可见 ——
    const prevInstance = this._currentInstance;
    const prevEl = prevInstance?.el as Element | null | undefined;
    let leaveCleaned = false;
    const cleanupPrev = (): void => {
      if (leaveCleaned) return;
      leaveCleaned = true;
      try { prevInstance?.destroy(); }
      catch (err) { console.error('[Router] 旧页 destroy 失败', err); }
    };
    if (prevEl && prevInstance) {
      prevEl.classList.add('page-leave');
      const LEAVE_MS = 300;
      const timer = setTimeout(cleanupPrev, LEAVE_MS + 200);
      const onEnd = (): void => { clearTimeout(timer); cleanupPrev(); };
      prevEl.addEventListener('animationend', onEnd, { once: true });
      if (!prevEl.isConnected) {
        clearTimeout(timer);
        cleanupPrev();
      }
    } else {
      cleanupPrev();
    }

    // 实例化新页面并立即挂载
    const pageProps: Props = { router: this, route, params, query, to, from };
    const instance = new TargetComponent(pageProps);
    instance.mount(outlet);
    this._currentInstance = instance;

    // 调用页面级生命周期
    if (typeof (instance as any).onRouteEnter === 'function') {
      try { await (instance as any).onRouteEnter(params, query); }
      catch (err) { console.error('[Router] onRouteEnter error:', err); }
    }

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // —— 工具方法 ——
  get current(): RouteRecord | null { return this._current; }
  get currentPath(): string { return this.strategy.path; }
  get currentParams(): Record<string, string> { return this._currentParams || {}; }
  get currentQuery(): Record<string, string> { return this._currentQuery || {}; }

  /** 销毁路由器 */
  destroy(): void {
    window.removeEventListener('popstate', this._onLocationChange);
    window.removeEventListener('hashchange', this._onLocationChange);
    document.removeEventListener('click', this._onGlobalClick, true);
    this._currentInstance?.destroy();
    Router._instance = null;
  }

  /** 启动：处理初始 URL */
  start(): this {
    this._navigate(this.strategy.path, { type: 'replace' });
    return this;
  }
}

/** 工厂：创建或获取单例 */
export function createRouter(options: RouterOptions): Router {
  if (Router._instance) return Router._instance;
  return new Router(options);
}

export const router: Router | null = Router._instance;
