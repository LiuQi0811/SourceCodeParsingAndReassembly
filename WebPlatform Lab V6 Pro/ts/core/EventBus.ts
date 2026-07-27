// =====================================================================
// EventBus.ts —— 观察者模式实现的事件总线
// 演示 MDN：CustomEvent、Map、WeakMap
// =====================================================================

type EventHandler<T = any> = (payload: T) => void;

export class EventBus {
  private _listeners: Map<string, Set<EventHandler>>;
  private _onceWrappers: WeakMap<EventHandler, EventHandler>;

  constructor() {
    this._listeners = new Map();
    this._onceWrappers = new WeakMap();
  }

  /** 订阅事件 */
  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler);
  }

  /** 订阅一次 */
  once<T = any>(event: string, handler: EventHandler<T>): () => void {
    const wrapper: EventHandler = (payload: T) => {
      this.off(event, wrapper);
      (handler as EventHandler)(payload);
    };
    this._onceWrappers.set(wrapper, handler as EventHandler);
    this.on(event, wrapper);
    return () => this.off(event, wrapper);
  }

  /** 取消订阅 */
  off(event: string, handler?: EventHandler): void {
    const set = this._listeners.get(event);
    if (!set) return;
    if (handler) set.delete(handler);
    else set.clear();
    if (set.size === 0) this._listeners.delete(event);
  }

  /** 派发事件（同步） */
  emit<T = any>(event: string, payload?: T): void {
    const set = this._listeners.get(event);
    if (!set) return;
    // 复制一份避免在回调中增删导致迭代异常
    for (const fn of [...set]) {
      try { (fn as EventHandler<T>)(payload as T); }
      catch (err) { console.error(`[EventBus] handler error for "${event}":`, err); }
    }
  }

  /** 清空所有订阅 */
  clear(): void {
    this._listeners.clear();
  }

  /** 监听数量 */
  size(event?: string): number {
    if (event) return this._listeners.get(event)?.size ?? 0;
    let total = 0;
    for (const set of this._listeners.values()) total += set.size;
    return total;
  }
}

/** 全局单例 */
export const eventBus = new EventBus();

/** 支持的跨组件通信事件名常量，避免魔法字符串 */
export const EVENTS = Object.freeze({
  ROUTER_BEFORE: 'router:before',
  ROUTER_AFTER: 'router:after',
  THEME_CHANGE: 'theme:change',
  SIDEBAR_TOGGLE: 'sidebar:toggle',
  LOCALE_CHANGE: 'locale:change',
} as const);

export type EventName = typeof EVENTS[keyof typeof EVENTS];
