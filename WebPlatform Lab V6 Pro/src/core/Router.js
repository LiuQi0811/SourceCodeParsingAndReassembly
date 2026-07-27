// =====================================================================
// Router.js —— 基于 History API 的自研路由系统
// 设计模式：单例（router 实例）、观察者（popstate 订阅）、
//           策略（history/hash 可切换）、命令（push/replace/go）、
//           装饰器（守卫 beforeEach）
// 演示 MDN：History API、popstate/hashchange、URL/URLSearchParams、
//           CustomEvent、正则、Symbol.iterator
// =====================================================================

import { parseQuery, stringifyQuery, is, uid } from './utils.js';
import { eventBus, EVENTS } from './EventBus.js';

/** 路由模式：策略模式 */
const HISTORY_STRATEGY = {
  push(path, state) { window.history.pushState(state, '', path); },
  replace(path, state) { window.history.replaceState(state, '', path); },
  get path() { return window.location.pathname + window.location.search + window.location.hash; },
  get pathname() { return window.location.pathname; },
  get search() { return window.location.search; },
  get hash() { return window.location.hash; },
};

const HASH_STRATEGY = {
  push(path, state) {
    const hash = `#${path}`;
    window.history.pushState(state, '', hash);
    // hash 模式 pushState 不会触发 hashchange，手动派发
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },
  replace(path, state) {
    const hash = `#${path}`;
    window.history.replaceState(state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },
  get path() {
    const hash = window.location.hash.slice(1) || '/';
    return hash;
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

export class Router {
  constructor(options = {}) {
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
    this._current = null;       // 当前匹配的路由记录
    this._currentInstance = null; // 当前页面组件实例
    this._pending = null;
    this._instanceId = uid('router');

    this._flattenRoutes(options.routes || []);
    this._bindPopState();
  }

  // —— 路由表处理 ——
  _flattenRoutes(routes, parentPath = '', parentMatched = []) {
    for (const route of routes) {
      const fullPath = this._normalizePath(parentPath + '/' + (route.path || ''));
      const record = {
        path: fullPath,
        regex: this._pathToRegex(fullPath),
        keys: this._extractKeys(fullPath),
        component: route.component,
        name: route.name,
        meta: route.meta || {},
        redirect: route.redirect,
        parent: parentMatched.length ? parentMatched[parentMatched.length - 1] : null,
        matched: [...parentMatched, null], // 占位，下面替换
      };
      record.matched = [...parentMatched, record];
      this.routes.push(record);
      if (route.children?.length) {
        this._flattenRoutes(route.children, fullPath, record.matched);
      }
    }
  }

  _normalizePath(path) {
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  /** 把 /user/:id 转成正则 + 提取参数名 */
  _pathToRegex(path) {
    if (path === '*') return /.*/;
    const pattern = path
      .replace(/\/$/, '')
      .replace(/\*/g, '.*')
      .replace(/:([^/]+)/g, '([^/]+)');
    return new RegExp('^' + pattern + '/?$', 'i');
  }

  _extractKeys(path) {
    if (path === '*') return [];
    const keys = [];
    const re = /:([^/]+)/g;
    let m;
    while ((m = re.exec(path)) !== null) keys.push(m[1]);
    return keys;
  }

  // —— 浏览器事件绑定 ——
  _bindPopState() {
    // history 模式监听 popstate；hash 模式监听 hashchange
    if (this.mode === 'hash') {
      window.addEventListener('hashchange', this._onLocationChange);
    } else {
      window.addEventListener('popstate', this._onLocationChange);
    }
    // 拦截全局点击：data-link 属性的元素走编程式导航
    document.addEventListener('click', this._onGlobalClick, true);
  }

  _onLocationChange = (event) => {
    this._navigate(this.strategy.path, { type: 'pop', state: event.state });
  };

  _onGlobalClick = (event) => {
    // 演示事件委托：拦截带 [data-link] 的元素
    const linkEl = event.target.closest?.('[data-link]');
    if (!linkEl) return;
    const path = linkEl.getAttribute('data-link');
    if (!path) return;
    event.preventDefault();
    event.stopPropagation();
    this.push(path);
  };

  // —— 路由匹配 ——
  match(pathname) {
    const path = pathname || this.strategy.pathname;
    for (const route of this.routes) {
      const match = route.regex.exec(path);
      if (match) {
        const params = {};
        route.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
        return { route, params };
      }
    }
    return null;
  }

  // —— 编程式导航（命令模式） ——
  push(path, state) { this._navigate(path, { type: 'push', state }); }
  replace(path, state) { this._navigate(path, { type: 'replace', state }); }
  go(n) { window.history.go(n); }
  back() { window.history.back(); }
  forward() { window.history.forward(); }

  /** 按名称跳转 + 参数 */
  pushByName(name, params = {}, query = {}) {
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
  beforeEach(fn) { this._beforeGuards.push(fn); return () => this._removeGuard(this._beforeGuards, fn); }
  afterEach(fn) { this._afterGuards.push(fn); return () => this._removeGuard(this._afterGuards, fn); }
  _removeGuard(arr, fn) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }

  // —— 核心导航流程 ——
  async _navigate(rawPath, { type = 'push', state = null } = {}) {
    // 解析 path 与 query
    const [pathname, search = ''] = rawPath.split('?');
    const query = parseQuery(search);
    const matched = this.match(pathname);

    if (!matched) {
      // 未匹配：跳到 404
      const notFound = this.routes.find((r) => r.path === '*');
      if (notFound && notFound !== this._current) {
        return this._navigate('*', { type: 'replace', state });
      }
      console.warn(`[Router] 未匹配路由: ${pathname}`);
      return;
    }

    const { route, params } = matched;
    const to = { path: pathname, fullPath: rawPath, query, params, route, matched: route.matched };
    const from = this._current
      ? { path: this._current.path, fullPath: this._current.fullPath, query: this._currentQuery, params: this._currentParams, route: this._current, matched: this._current.matched }
      : null;

    // 重定向处理
    if (route.redirect) {
      const target = is.func(route.redirect) ? route.redirect({ to, from }) : route.redirect;
      return this._navigate(target, { type: 'replace', state });
    }

    // 前置守卫
    eventBus.emit(EVENTS.ROUTER_BEFORE, { to, from });
    for (const guard of this._beforeGuards) {
      try {
        const result = await guard(to, from);
        if (result === false) return;                       // 取消导航
        if (is.str(result)) return this._navigate(result, { type: 'replace', state }); // 重定向
      } catch (err) {
        console.error('[Router] beforeEach guard error:', err);
        return;
      }
    }

    // 离开守卫：当前页面的 onRouteLeave
    if (this._currentInstance?.onRouteLeave?.() === false) {
      return;
    }

    // 写入 history
    if (type === 'push') this.strategy.push(rawPath, state);
    else if (type === 'replace') this.strategy.replace(rawPath, state);
    // type === 'pop' 已由浏览器触发，无需手动写

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

    // 设置文档标题（演示 document.title）
    if (route.meta?.title) document.title = `${route.meta.title} · 原生 SPA`;
  }

  async _renderPage(route, { to, from, params, query }) {
    // 渲染 matched 链：父级 -> 子级
    const matchedChain = route.matched.filter(Boolean);
    if (matchedChain.length === 0) return;

    // 简化版：只渲染最深一级组件，父级通过 <slot> 概念由子组件自行处理
    // 真正的嵌套渲染在 ComponentsPage / ApiLabPage 内部用 Outlet 实现
    const TargetComponent = matchedChain[matchedChain.length - 1].component;
    if (!TargetComponent) return;

    const outlet = document.getElementById('router-outlet');
    if (!outlet) {
      console.error('[Router] 找不到 #router-outlet 挂载点');
      return;
    }

    // 快速连点导航兜底：清理上一轮尚未淡出完毕的残留旧页 DOM，
    // 避免多次切换导致多个 .page-leave 节点叠加（实例引用已随上次 destroy 丢失）。
    outlet.querySelectorAll('.page-leave').forEach((node) => node.remove());

    // —— 无感切换：旧页淡出 + 新页立即可见 ——
    // 旧实例不立即销毁，先标记 .page-leave 播放淡出动画，
    // 动画结束后再 destroy() 释放监听器与 DOM，避免页面出现空白一闪。
    // 期间新旧两页共存于 outlet：新页在下、旧页半透明叠在上层但不响应交互。
    const prevInstance = this._currentInstance;
    const prevEl = prevInstance?.el;
    let leaveCleaned = false;
    const cleanupPrev = () => {
      if (leaveCleaned) return;
      leaveCleaned = true;
      try { prevInstance?.destroy(); } catch (err) { console.error('[Router] 旧页 destroy 失败', err); }
    };
    if (prevEl && prevInstance) {
      prevEl.classList.add('page-leave');
      // 监听淡出动画结束：兼容 animationend 与超时兜底（防止环境不支持动画导致残留）
      const LEAVE_MS = 300;
      const timer = setTimeout(cleanupPrev, LEAVE_MS + 200);
      const onEnd = () => { clearTimeout(timer); cleanupPrev(); };
      prevEl.addEventListener('animationend', onEnd, { once: true });
      // 若旧页因为某种原因已脱离文档，立即清理
      if (!prevEl.isConnected) { clearTimeout(timer); cleanupPrev(); }
    } else {
      // 首次渲染无旧页
      cleanupPrev();
    }

    // 实例化新页面并立即挂载（渲染到 outlet，叠在旧页之上）
    const instance = new TargetComponent({ router: this, route, params, query, to, from });
    instance.mount(outlet);
    this._currentInstance = instance;

    // 调用页面级生命周期
    if (is.func(instance.onRouteEnter)) {
      try { await instance.onRouteEnter(params, query); }
      catch (err) { console.error('[Router] onRouteEnter error:', err); }
    }

    // 滚动到顶部（平滑过渡，避免硬切跳动感）
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // —— 工具方法 ——
  get current() { return this._current; }
  get currentPath() { return this.strategy.path; }
  get currentParams() { return this._currentParams || {}; }
  get currentQuery() { return this._currentQuery || {}; }

  /** 销毁路由器 */
  destroy() {
    window.removeEventListener('popstate', this._onLocationChange);
    window.removeEventListener('hashchange', this._onLocationChange);
    document.removeEventListener('click', this._onGlobalClick, true);
    this._currentInstance?.destroy();
    Router._instance = null;
  }

  /** 启动：处理初始 URL */
  start() {
    this._navigate(this.strategy.path, { type: 'replace' });
    return this;
  }
}

/** 工厂：创建或获取单例 */
export function createRouter(options) {
  if (Router._instance) return Router._instance;
  return new Router(options);
}

export const router = Router._instance;
