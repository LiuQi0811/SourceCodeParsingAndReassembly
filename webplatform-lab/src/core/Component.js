// =====================================================================
// Component.js —— 所有组件的抽象基类
// 设计模式：模板方法（生命周期钩子）、观察者（事件）、组合（props）
// 演示 MDN：DOM API、CustomEvent、WeakMap、Symbol
// =====================================================================

import { h, empty, is } from './utils.js';

const PRIVATE = new WeakMap();

/** 抽象基类：不可直接实例化 */
export class Component {
  /** @type {symbol} 子类必须实现 render */
  static get ABSTRACT() { return Symbol('abstract'); }

  constructor(props = {}) {
    if (this.constructor === Component) {
      throw new TypeError('Component 是抽象类，不能直接实例化');
    }
    this.props = props;
    this.state = this.initialState ? this.initialState() : {};
    this.el = null;           // 根 DOM 元素
    this._mounted = false;
    this._destroyed = false;
    this._eventBindings = []; // [{target, type, handler, options}]
    this._children = [];      // 子组件引用，便于销毁
    this._storeUnsub = null;
    PRIVATE.set(this, { renderToken: Math.random() });

    // 包装 render：每次渲染后缓存 this.el 并绑定自动事件，
    // 这样无论通过 h() / new X().render() / mount() 调用都能正确建立 el 引用。
    const userRender = this.render.bind(this);
    this.render = (...args) => {
      const node = userRender(...args);
      if (node && node.nodeType) {
        this.el = node;
        this._bindAutoEvents();
      }
      return node;
    };
  }

  // —— 模板方法：子类可覆盖 ——
  /** 初始化 state 钩子 */
  initialState() { return {}; }

  /** 渲染：返回 DOM 元素或字符串 HTML。子类必须实现（多态） */
  render() {
    throw new Error(`${this.constructor.name} 必须实现 render() 方法`);
  }

  /** 挂载后钩子 */
  componentDidMount() {}

  /** 卸载前钩子 */
  componentWillUnmount() {}

  /** state 变更钩子（用于细粒度更新） */
  shouldComponentUpdate(nextProps, nextState) { return true; }

  // —— 公共 API ——

  /** 挂载到父节点 */
  mount(parent) {
    if (this._mounted) return this;
    const node = this.render();
    this.el = node.nodeType ? node : this._wrapHTML(node);
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
  _attach() {
    if (this._mounted) return;
    this._mounted = true;
    this.el = this.el || (this._renderedNode && this._renderedNode.nodeType ? this._renderedNode : null);
    this._bindAutoEvents();
    this._triggerDidMount();
  }

  _triggerDidMount() {
    // 先递归挂载子组件（它们的 DOM 已在父组件 render 树中）
    for (const child of this._children) {
      if (!child._mounted && child.el) child._attach();
    }
    requestAnimationFrame(() => {
      if (this._destroyed) return;
      try { this.componentDidMount(); }
      catch (err) { console.error(`[${this.constructor.name}.componentDidMount]`, err); }
    });
  }

  /** 更新 props 并重渲染 */
  setProps(partial = {}) {
    const nextProps = { ...this.props, ...partial };
    if (!this.shouldComponentUpdate(nextProps, this.state)) return;
    this.props = nextProps;
    this._rerender();
  }

  /** 更新 state 并重渲染 */
  setState(partial = {}) {
    const nextState = typeof partial === 'function' ? partial(this.state) : { ...this.state, ...partial };
    if (!this.shouldComponentUpdate(this.props, nextState)) return;
    this.state = nextState;
    this._rerender();
  }

  /** 查询子元素 */
  $(selector) { return this.el?.querySelector(selector) ?? null; }
  $$(selector) { return this.el ? Array.from(this.el.querySelectorAll(selector)) : []; }

  // —— 事件系统 ——

  /** 绑定事件（自动在 destroy 时解绑） */
  on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._eventBindings.push({ target, type, handler, options });
    return () => this.off(target, type, handler, options);
  }

  /** 解绑单个事件 */
  off(target, type, handler, options) {
    target.removeEventListener(type, handler, options);
    this._eventBindings = this._eventBindings.filter(
      (b) => !(b.target === target && b.type === type && b.handler === handler)
    );
  }

  /** 触发组件自定义事件，向父级冒泡 */
  emit(event, detail) {
    if (!this.el) return;
    this.el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true }));
  }

  /** 注册子组件（自动管理销毁） */
  registerChild(child) {
    this._children.push(child);
    return child;
  }

  /** 销毁 */
  destroy() {
    if (this._destroyed) return;
    try { this.componentWillUnmount(); }
    catch (err) { console.error(`[${this.constructor.name}.componentWillUnmount]`, err); }
    this._children.forEach((c) => c.destroy?.());
    this._eventBindings.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    this._eventBindings = [];
    this._storeUnsub?.();
    if (this.el?.parentNode) this.el.parentNode.removeChild(this.el);
    this._mounted = false;
    this._destroyed = true;
  }

  // —— 内部 ——

  /** 重新渲染（保留挂载位置） */
  _rerender() {
    if (!this._mounted || !this.el) return;
    // 先销毁旧子组件实例（它们的 DOM 会被替换）
    for (const child of this._children) {
      try { child.destroy(); } catch { /* noop */ }
    }
    this._children = [];
    // 重新渲染：render() 内部会再次 registerChild 新实例
    const node = this.render();
    const newEl = node.nodeType ? node : this._wrapHTML(node);
    this.el.replaceWith(newEl);
    this.el = newEl;
    this._triggerDidMount();
  }

  /** 把字符串 HTML 包成 DOM */
  _wrapHTML(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    if (wrapper.childNodes.length !== 1) {
      // 多节点：返回包装容器
      const container = h('div', { class: 'component-wrapper' });
      while (wrapper.firstChild) container.appendChild(wrapper.firstChild);
      return container;
    }
    return wrapper.firstChild;
  }

  /** 解析 props.events 自动绑定 */
  _bindAutoEvents() {
    const events = this.props?.events;
    if (!is.obj(events) || !this.el) return;
    for (const [type, handler] of Object.entries(events)) {
      if (is.func(handler)) this.on(this.el, type, handler);
    }
  }
}

/**
 * 接口契约（鸭子类型）：Page 组件必须实现 onRouteEnter / onRouteLeave
 * 这里用 JSDoc 接口注释表达，JS 无原生 interface
 */

/**
 * @interface IRoutePage
 * @extends Component
 */
// class IRoutePage extends Component {
//   /** 进入路由时调用，可接收路由参数 */
//   onRouteEnter(params, query) {}
//   /** 离开路由时调用，可阻止 */
//   onRouteLeave() { return true; }
// }

/** Page 基类：业务页面继承此类，体现多态 */
export class Page extends Component {
  constructor(props = {}) {
    super({ ...props, isPage: true });
  }
  onRouteEnter(_params, _query) {}
  onRouteLeave() { return true; }
  /** 默认页面包裹一层进入动画 */
  render() {
    const inner = this.renderPage?.() ?? '';
    return h('div', { class: 'page fade-enter' }, ...(Array.isArray(inner) ? inner : [inner]));
  }
  renderPage() { return ''; }
}
