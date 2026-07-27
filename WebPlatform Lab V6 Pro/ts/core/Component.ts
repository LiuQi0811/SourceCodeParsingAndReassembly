// =====================================================================
// Component.ts —— 所有组件的抽象基类
// 设计模式：模板方法（生命周期钩子）、观察者（事件）、组合（props）
// 演示 MDN：DOM API、CustomEvent、WeakMap、Symbol
// =====================================================================

import { h, is } from './utils.js';
import type { Props, State, EventBinding } from './types.js';

const PRIVATE = new WeakMap<object, { renderToken: number }>();

/** 抽象基类：不可直接实例化 */
export class Component {
  props: Props;
  state: State;
  el: Element | null;
  _mounted: boolean;
  _destroyed: boolean;
  _eventBindings: EventBinding[];
  _children: Component[];
  _storeUnsub: (() => void) | null;
  _renderedNode: Node | null;

  constructor(props: Props = {}) {
    if ((this as any).constructor === Component) {
      throw new TypeError('Component 是抽象类，不能直接实例化');
    }
    this.props = props;
    this.state = this.initialState ? this.initialState() : {};
    this.el = null;
    this._mounted = false;
    this._destroyed = false;
    this._eventBindings = [];
    this._children = [];
    this._storeUnsub = null;
    this._renderedNode = null;
    PRIVATE.set(this, { renderToken: Math.random() });

    // 包装 render：每次渲染后缓存 this.el 并绑定自动事件
    const userRender = this.render.bind(this);
    this.render = (...args: any[]): Node => {
      const node = userRender(...args);
      if (node && (node as Node).nodeType) {
        this.el = node as Element;
        this._bindAutoEvents();
      }
      return node as Node;
    };
  }

  // —— 模板方法：子类可覆盖 ——
  /** 初始化 state 钩子 */
  initialState(): State {
    return {};
  }

  /** 渲染：返回 DOM 元素或字符串 HTML。子类必须实现（多态） */
  render(..._args: any[]): Node | string {
    throw new Error(`${(this as any).constructor.name} 必须实现 render() 方法`);
  }

  /** 挂载后钩子 */
  componentDidMount(): void {}

  /** 卸载前钩子 */
  componentWillUnmount(): void {}

  /** state 变更钩子（用于细粒度更新） */
  shouldComponentUpdate(_nextProps: Props, _nextState: State): boolean {
    return true;
  }

  // —— 公共 API ——

  /** 挂载到父节点 */
  mount(parent: Node): this {
    if (this._mounted) return this;
    const node = this.render();
    this.el = (node as Node).nodeType ? (node as Element) : this._wrapHTML(node as string);
    this._bindAutoEvents();
    parent.appendChild(this.el);
    this._mounted = true;
    this._triggerDidMount();
    return this;
  }

  /**
   * 标记组件已挂载并触发 componentDidMount（含子组件）。
   * 用于「已通过 render() 直接插入 DOM 但未走 mount()」的子组件。
   */
  _attach(): void {
    if (this._mounted) return;
    this._mounted = true;
    this.el = this.el || (this._renderedNode && (this._renderedNode as Node).nodeType ? (this._renderedNode as Element) : null);
    this._bindAutoEvents();
    this._triggerDidMount();
  }

  /** 挂载尚未挂载的子组件（它们的 DOM 已在父组件 render 树中） */
  _mountChildren(): void {
    for (const child of this._children) {
      if (!child._mounted && child.el) child._attach();
    }
  }

  _triggerDidMount(): void {
    this._mountChildren();
    requestAnimationFrame(() => {
      if (this._destroyed) return;
      try { this.componentDidMount(); }
      catch (err) { console.error(`[${(this as any).constructor.name}.componentDidMount]`, err); }
    });
  }

  /** 更新 props 并重渲染 */
  setProps(partial: Props = {}): void {
    const nextProps = { ...this.props, ...partial };
    if (!this.shouldComponentUpdate(nextProps, this.state)) return;
    this.props = nextProps;
    this._rerender();
  }

  /** 更新 state 并重渲染 */
  setState(partial: Partial<State> | ((state: State) => Partial<State>)): void {
    const nextState = typeof partial === 'function' ? partial(this.state) : { ...this.state, ...partial };
    if (!this.shouldComponentUpdate(this.props, nextState)) return;
    this.state = nextState;
    this._rerender();
  }

  /** 查询子元素 */
  $<T extends Element = HTMLElement>(selector: string): T | null {
    return (this.el as ParentNode | null)?.querySelector<T>(selector) ?? null;
  }

  $$<T extends Element = HTMLElement>(selector: string): T[] {
    return this.el ? Array.from((this.el as ParentNode).querySelectorAll<T>(selector)) : [];
  }

  // —— 事件系统 ——

  /** 绑定事件（自动在 destroy 时解绑） */
  on(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): () => void {
    target.addEventListener(type, handler, options);
    this._eventBindings.push({ target, type, handler, options });
    return () => this.off(target, type, handler, options);
  }

  /** 解绑单个事件 */
  off(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void {
    target.removeEventListener(type, handler, options);
    this._eventBindings = this._eventBindings.filter(
      (b) => !(b.target === target && b.type === type && b.handler === handler),
    );
  }

  /** 触发组件自定义事件，向父级冒泡 */
  emit(event: string, detail?: any): void {
    if (!this.el) return;
    this.el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true }));
  }

  /** 注册子组件（自动管理销毁） */
  registerChild<T extends Component>(child: T): T {
    this._children.push(child);
    return child;
  }

  /** 销毁 */
  destroy(): void {
    if (this._destroyed) return;
    try { this.componentWillUnmount(); }
    catch (err) { console.error(`[${(this as any).constructor.name}.componentWillUnmount]`, err); }
    this._children.forEach((c) => c.destroy?.());
    this._eventBindings.forEach(({ target, type, handler, options }) => {
      try {
        if (target && typeof target.removeEventListener === 'function') {
          target.removeEventListener(type, handler, options);
        }
      } catch { /* noop */ }
    });
    this._eventBindings = [];
    this._storeUnsub?.();
    if (this.el && (this.el as Node).parentNode) {
      (this.el as Node).parentNode!.removeChild(this.el);
    }
    this._mounted = false;
    this._destroyed = true;
  }

  // —— 内部 ——

  /** 重新渲染（保留挂载位置） */
  _rerender(): void {
    if (!this._mounted || !this.el) return;
    const oldEl = this.el as Element;
    const wasLeaving = oldEl.classList && oldEl.classList.contains('page-leave');
    for (const child of this._children) {
      try { child.destroy(); } catch { /* noop */ }
    }
    this._children = [];
    const node = this.render();
    const newEl = (node as Node).nodeType ? (node as Element) : this._wrapHTML(node as string);
    oldEl.replaceWith(newEl);
    this.el = newEl;
    if (wasLeaving && (newEl as Element).classList) {
      (newEl as Element).classList.add('page-leave');
    }
    this._mountChildren();
    // 通知子类重渲染完成：portal 组件可在此重新 portal 弹层，
    // 避免 setState 后 body 里的旧 dropdown 变成孤儿（根因 B）
    try { this.componentDidUpdate(); }
    catch (err) { console.error(`[${(this as any).constructor.name}.componentDidUpdate]`, err); }
  }

  /** 重渲染后钩子（子类可覆盖，用于重新 portal、同步 DOM 等） */
  componentDidUpdate(): void {}

  /** 把字符串 HTML 包成 DOM */
  _wrapHTML(html: string): Element {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    if (wrapper.childNodes.length !== 1) {
      const container = h('div', { class: 'component-wrapper' }) as HTMLElement;
      while (wrapper.firstChild) container.appendChild(wrapper.firstChild);
      return container;
    }
    return wrapper.firstChild as Element;
  }

  /** 解析 props.events 自动绑定 */
  _bindAutoEvents(): void {
    const events = (this.props as Props)?.events;
    if (!is.obj(events) || !this.el) return;
    for (const [type, handler] of Object.entries(events)) {
      if (typeof handler === 'function') {
        this.on(this.el as EventTarget, type, handler as EventListener);
      }
    }
  }
}

/** Page 基类：业务页面继承此类，体现多态 */
export class Page extends Component {
  constructor(props: Props = {}) {
    super({ ...props, isPage: true });
    const prevRender = this.render.bind(this);
    this.render = (...args: any[]): Node => {
      const node = prevRender(...args) as Element;
      if (node && node.nodeType === 1 && !node.classList.contains('page')) {
        node.classList.add('page', 'fade-enter');
      }
      return node as Node;
    };
  }

  onRouteEnter(_params: Record<string, string>, _query: Record<string, string>): void | Promise<void> {}

  onRouteLeave(): boolean {
    return true;
  }

  /** 默认页面包裹一层进入动画 */
  render(..._args: any[]): Node {
    const inner = (this as any).renderPage?.() ?? '';
    const children = Array.isArray(inner) ? inner : [inner];
    return h('div', { class: 'page fade-enter' }, ...children) as Node;
  }

  renderPage(): Node | string | null | (Node | string | null)[] {
    return '';
  }
}
