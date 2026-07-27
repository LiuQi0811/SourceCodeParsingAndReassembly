// =====================================================================
// Store.ts —— 单例模式 + 观察者模式的状态管理
// 类 Pinia / Vuex 的最小实现，支持模块化命名空间
// 演示 MDN：Proxy、Reflect、Map
// =====================================================================
import { eventBus } from './EventBus.js';
class Store {
    _modules;
    _subscribers;
    constructor() {
        this._modules = new Map();
        this._subscribers = new Set();
    }
    /** 注册一个模块 */
    register(name, { state = {}, mutations = {} }) {
        if (this._modules.has(name)) {
            console.warn(`[Store] module "${name}" already registered, will be overwritten.`);
        }
        // 用 Proxy 拦截写入，强制走 mutation
        const moduleState = new Proxy({ ...state }, {
            set(_target, key) {
                console.warn(`[Store] 直接修改 state.${name}.${key} 被禁止，请使用 commit。`);
                return true; // 静默失败
            },
        });
        this._modules.set(name, {
            state: moduleState,
            rawState: { ...state },
            mutations: new Map(Object.entries(mutations)),
        });
        return this;
    }
    /** 读取 state */
    get(moduleName, key) {
        const mod = this._modules.get(moduleName);
        if (!mod)
            throw new Error(`[Store] module "${moduleName}" not found`);
        return key === undefined ? mod.rawState : mod.rawState[key];
    }
    /** 提交 mutation（命令模式） */
    commit(moduleName, type, payload) {
        const mod = this._modules.get(moduleName);
        if (!mod)
            throw new Error(`[Store] module "${moduleName}" not found`);
        const mutation = mod.mutations.get(type);
        if (!mutation)
            throw new Error(`[Store] mutation "${moduleName}/${type}" not found`);
        const prev = { ...mod.rawState };
        // mutation 执行时直接修改 rawState
        mutation(mod.rawState, payload);
        mod.state = new Proxy(mod.rawState, { set() { return true; } });
        const event = {
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
    subscribe(fn) {
        this._subscribers.add(fn);
        return () => this._subscribers.delete(fn);
    }
    /** 重置模块 */
    reset(moduleName) {
        const mod = this._modules.get(moduleName);
        if (!mod)
            return;
        for (const key of Object.keys(mod.rawState))
            delete mod.rawState[key];
    }
}
/** 全局单例 */
export const store = new Store();
store.register('app', {
    state: {
        theme: 'light',
        sidebarCollapsed: false,
        sidebarOpen: false,
        breadcrumb: [],
        user: null,
    },
    mutations: {
        setTheme(state, theme) { state.theme = theme; },
        toggleTheme(state) { state.theme = state.theme === 'light' ? 'dark' : 'light'; },
        setSidebarCollapsed(state, v) { state.sidebarCollapsed = v; },
        toggleSidebar(state) { state.sidebarCollapsed = !state.sidebarCollapsed; },
        openSidebar(state) { state.sidebarOpen = true; },
        closeSidebar(state) { state.sidebarOpen = false; },
        setBreadcrumb(state, items) { state.breadcrumb = items; },
        setUser(state, user) { state.user = user; },
    },
});
//# sourceMappingURL=Store.js.map