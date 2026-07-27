// =====================================================================
// Store.ts —— 单例模式 + 观察者模式的状态管理
// 类 Pinia / Vuex 的最小实现，支持模块化命名空间
// 演示 MDN：Proxy、Reflect、Map
// =====================================================================

import { eventBus } from './EventBus.js';
import type { StoreModule, StoreChangeEvent, StoreSubscriber, MutationFn } from './types.js';

interface InternalModule {
  state: Record<string, any>;
  rawState: Record<string, any>;
  mutations: Map<string, MutationFn>;
}

class Store {
  private _modules: Map<string, InternalModule>;
  private _subscribers: Set<StoreSubscriber>;

  constructor() {
    this._modules = new Map();
    this._subscribers = new Set();
  }

  /** 注册一个模块 */
  register<TState extends Record<string, any>>(
    name: string,
    { state = {} as TState, mutations = {} }: StoreModule<TState>,
  ): this {
    if (this._modules.has(name)) {
      console.warn(`[Store] module "${name}" already registered, will be overwritten.`);
    }
    // 用 Proxy 拦截写入，强制走 mutation
    const moduleState = new Proxy({ ...state }, {
      set(_target, key: string) {
        console.warn(`[Store] 直接修改 state.${name}.${key} 被禁止，请使用 commit。`);
        return true; // 静默失败
      },
    });
    this._modules.set(name, {
      state: moduleState,
      rawState: { ...state },
      mutations: new Map(Object.entries(mutations) as [string, MutationFn][]),
    });
    return this;
  }

  /** 读取 state */
  get(moduleName: string, key?: string): any {
    const mod = this._modules.get(moduleName);
    if (!mod) throw new Error(`[Store] module "${moduleName}" not found`);
    return key === undefined ? mod.rawState : mod.rawState[key];
  }

  /** 提交 mutation（命令模式） */
  commit(moduleName: string, type: string, payload?: any): void {
    const mod = this._modules.get(moduleName);
    if (!mod) throw new Error(`[Store] module "${moduleName}" not found`);
    const mutation = mod.mutations.get(type);
    if (!mutation) throw new Error(`[Store] mutation "${moduleName}/${type}" not found`);
    const prev = { ...mod.rawState };
    // mutation 执行时直接修改 rawState
    mutation(mod.rawState, payload);
    mod.state = new Proxy(mod.rawState, { set() { return true; } });
    const event: StoreChangeEvent = {
      module: moduleName,
      type,
      payload,
      prev,
      next: { ...mod.rawState },
    };
    this._subscribers.forEach((fn) => fn(event));
    eventBus.emit(`store:${moduleName}:${type}`, event);
    eventBus.emit(`store:change`, event);
  }

  /** 订阅变更 */
  subscribe(fn: StoreSubscriber): () => void {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  /** 重置模块 */
  reset(moduleName: string): void {
    const mod = this._modules.get(moduleName);
    if (!mod) return;
    for (const key of Object.keys(mod.rawState)) delete mod.rawState[key];
  }
}

/** 全局单例 */
export const store = new Store();

// —— 注册全局 app 模块 ——
interface AppState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  breadcrumb: any[];
  user: any;
}

store.register<AppState>('app', {
  state: {
    theme: 'light',
    sidebarCollapsed: false,
    sidebarOpen: false,
    breadcrumb: [],
    user: null,
  },
  mutations: {
    setTheme(state, theme: 'light' | 'dark') { state.theme = theme; },
    toggleTheme(state) { state.theme = state.theme === 'light' ? 'dark' : 'light'; },
    setSidebarCollapsed(state, v: boolean) { state.sidebarCollapsed = v; },
    toggleSidebar(state) { state.sidebarCollapsed = !state.sidebarCollapsed; },
    openSidebar(state) { state.sidebarOpen = true; },
    closeSidebar(state) { state.sidebarOpen = false; },
    setBreadcrumb(state, items: any[]) { state.breadcrumb = items; },
    setUser(state, user: any) { state.user = user; },
  },
});
