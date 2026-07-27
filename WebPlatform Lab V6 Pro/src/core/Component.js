// =====================================================================
// Component.js —— 所有组件的抽象基类
// 设计模式：模板方法（生命周期钩子）、观察者（事件）、组合（props）
// 演示 MDN：DOM API、CustomEvent、WeakMap、Symbol
// =====================================================================

import { h, empty, is, _setRecycleContext, _getRecycleContext, _propsEqual } from './utils.js';

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
      // 实例复用：如果被 registerChild 标记为复用旧实例，
      // 直接返回 old.el（已在 DOM 中的真实节点），让调用方可以
      // 直接操作 DOM（classList.add 等）。
      // h() 的 children 处理会识别"已在 DOM 中的节点"并用占位注释替换，
      // 避免 append 导致 old.el 被移动出旧树。
      // _patchChildren 会识别占位符并保留 old.el 在原位。
      if (this._recycleFrom) {
        return this._recycleFrom.el;
      }
      // 关键：确保 render() 执行期间 _recycleContext === this，
      // 让本组件 render() 内部 h(子组件) 创建的子组件实例注册到本组件 _children。
      // 之前只在 prevCtx 为 null 时设置，导致 `new Comp({children: h(Tag)})` 模式中
      // （props 在 new 之前已求值，h(Tag) 在外层 context 下执行）
      // 一旦改用 lazy children 函数，children() 在本 render() 内求值，
      // 此时必须 context = this 才能让 Tag 注册到本组件而非外层。
      // 用 needSetCtx 避免重复设置（h() 和 _rerender 已经设置了 context=this 的情况）。
      const prevCtx = _getRecycleContext();
      const needSetCtx = prevCtx !== this;
      if (needSetCtx) _setRecycleContext(this);
      const node = userRender(...args);
      if (needSetCtx) _setRecycleContext(prevCtx);
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

  /** 挂载尚未挂载的子组件（它们的 DOM 已在父组件 render 树中） */
  _mountChildren() {
    for (const child of this._children) {
      if (!child._mounted && child.el) child._attach();
    }
  }

  _triggerDidMount() {
    this._mountChildren();
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

  /** 注册子组件（自动管理销毁）。
   *  rerender 时若发现同类型旧子组件可复用，则复用旧实例（更新 props + _rerender），
   *  新实例标记 _recycleFrom 后返回，其 render() 会直接返回旧实例的 el。
   *  这让 `new Card({...}) + registerChild(card) + card.render()` 模式也能复用。 */
  registerChild(child) {
    // rerender 上下文中：按类型从回收池找未使用的旧实例复用
    // 用 _recycleUsed Set 标记已用索引，避免类型不匹配时消耗索引
    if (this._recyclePool) {
      for (let i = 0; i < this._recyclePool.length; i++) {
        if (this._recycleUsed.has(i)) continue;
        const old = this._recyclePool[i];
        if (old && old.constructor === child.constructor && !old._destroyed) {
          this._recycleUsed.add(i);
          this._children.push(old); // 保留旧实例引用以便后续销毁
          // props 浅比较：相同则跳过 _rerender（消除"父 rerender → 所有子 rerender"闪屏）
          if (_propsEqual(old.props, child.props)) {
            child.el = old.el;
            child._mounted = true;
            child._recycleFrom = old;
            return child;
          }
          // 子类 shouldComponentUpdate 做更细粒度判断（如 Pagination 检测 onChange 回流）
          if (typeof old.shouldComponentUpdate === 'function'
              && !old.shouldComponentUpdate(child.props, old.state)) {
            old.props = { ...child.props };
            child.el = old.el;
            child._mounted = true;
            child._recycleFrom = old;
            return child;
          }
          // 复用：更新旧实例 props 并 rerender
          old.props = { ...child.props };
          old._rerender();
          // 新实例指向旧 DOM，标记复用来源；后续 child.render() 会直接返回 old.el
          child.el = old.el;
          child._mounted = true;
          child._recycleFrom = old;
          return child;
        }
      }
    }
    this._children.push(child);
    return child;
  }

  /** 销毁
   *  @param {object} [options]
   *  @param {boolean} [options.removeDom=true] 是否从父节点移除 DOM。
   *    _rerender 中销毁未复用子组件时传 { removeDom: false }：
   *    保留 DOM 引用让 _patchChildren 通过类型匹配原地修补或统一移除，
   *    避免 destroy 提前移除 DOM 破坏 _patchChildren 的引用匹配 → DOM 重建 → 闪屏。 */
  destroy(options = {}) {
    const { removeDom = true } = options;
    if (this._destroyed) return;
    try { this.componentWillUnmount(); }
    catch (err) { console.error(`[${this.constructor.name}.componentWillUnmount]`, err); }
    // 递归销毁子组件时传递相同 options，保持整条销毁链的 DOM 处理策略一致
    this._children.forEach((c) => c.destroy?.(options));
    this._eventBindings.forEach(({ target, type, handler, options: opts }) => {
      // 部分运行时（如 jsdom mock 对象）的 target 可能不是真实 EventTarget，
      // 缺少 removeEventListener 方法；逐个 try/catch 避免单个失败中断整个销毁流程。
      try { if (target && typeof target.removeEventListener === 'function') target.removeEventListener(type, handler, opts); }
      catch { /* noop */ }
    });
    this._eventBindings = [];
    this._storeUnsub?.();
    if (removeDom && this.el?.parentNode) this.el.parentNode.removeChild(this.el);
    this._mounted = false;
    this._destroyed = true;
  }

  // —— 内部 ——

  /** 重新渲染（原地修补，不替换根 DOM）。
   *  实例复用机制：旧子组件放入 _recyclePool，render() 中 h()/registerChild()
   *  会按顺序复用同类型旧实例（更新 props + _rerender），而非每次 new 新实例。
   *  关键改进：_rerender 不再用 oldEl.replaceWith(newEl)（会重建整棵 DOM 树→闪屏），
   *  而是用 _patchInPlace 原地修补 oldEl：只更新变化的属性/文本/子节点，
   *  复用的子组件 DOM 保持原引用不动，彻底消除闪屏。 */
  _rerender() {
    if (!this._mounted || !this.el) return;
    const oldEl = this.el;
    const wasLeaving = oldEl.classList && oldEl.classList.contains('page-leave');

    // 把旧子组件放入回收池，供 h() 和 registerChild() 按类型复用
    // 用 _recycleUsed Set 标记已复用的实例索引，避免类型不匹配时
    // 消耗索引导致后续无法复用（h() 和 registerChild 共用池子）
    this._recyclePool = this._children;
    this._recycleUsed = new Set();
    this._children = [];

    // 设置全局复用上下文，让 h() 能访问到本组件的回收池
    const prevCtx = _getRecycleContext();
    _setRecycleContext(this);

    // 重新渲染：render() 内部 h()/registerChild() 会复用旧实例
    // 复用的子组件返回占位注释（带 _reusedRef），不会移动 old.el
    const node = this.render();
    const newEl = node.nodeType ? node : this._wrapHTML(node);

    _setRecycleContext(prevCtx);

    // 销毁未被复用的旧子组件（_recycleUsed 中没有标记的）
    // 关键：传 { removeDom: false }，保留 DOM 引用。
    // 否则 destroy 移除 DOM 后，_patchChildren 的 oldKids 数组缺失该节点，
    // 引用匹配失败 → 新节点被当作"无匹配新节点"插入 → DOM 重建 → 闪屏。
    // 保留的 DOM 由后续 _patchInPlace/_patchChildren 通过类型匹配原地修补
    // 或统一移除多余旧子节点处理。
    for (let i = 0; i < this._recyclePool.length; i++) {
      if (!this._recycleUsed.has(i)) {
        try { this._recyclePool[i].destroy({ removeDom: false }); } catch { /* noop */ }
      }
    }
    this._recyclePool = null;
    this._recycleUsed = null;

    // 关键：原地修补 oldEl，而非 replaceWith。
    // 注意：render() 内部的 Component render 包装会把 this.el 设为 newEl
    // （新创建的临时节点，不在 DOM 中）。_patchInPlace 修补的是 oldEl，
    // 所以修补成功后必须恢复 this.el = oldEl，否则 this.el 会指向不在 DOM 中的 newEl，
    // 导致后续交互失效、page.el.parentNode 为 null 等问题。
    const patched = this._patchInPlace(oldEl, newEl);
    if (!patched) {
      // 标签名不同等无法原地修补的情况，回退到替换
      oldEl.replaceWith(newEl);
      this.el = newEl;
    } else {
      // 原地修补成功：this.el 恢复为 oldEl（oldEl 在 DOM 中，newEl 只是临时节点）
      this.el = oldEl;
    }
    if (wasLeaving && this.el) this.el.classList.add('page-leave');
    // 只挂载新子组件；不重复触发本组件的 componentDidMount，
    // 否则事件订阅会重复累积（如 ROUTER_AFTER 监听被反复注册）。
    this._mountChildren();
    // 通知子类重渲染完成：portal 组件可在此重新 portal 弹层，
    // 避免setState 后 body 里的旧 dropdown 变成孤儿（根因 B）
    try { this.componentDidUpdate(); }
    catch (err) { console.error(`[${this.constructor.name}.componentDidUpdate]`, err); }
  }

  /** 重渲染后钩子（子类可覆盖，用于重新 portal、同步 DOM 等） */
  componentDidUpdate() {}

  /** 原地修补：用 newEl 的内容更新 oldEl，不替换 oldEl 本身。
   *  返回 true 表示成功修补（oldEl 保留），false 表示无法修补需替换。 */
  _patchInPlace(oldEl, newEl) {
    if (!oldEl || !newEl) return false;
    if (oldEl === newEl) return true;
    if (oldEl.nodeType !== newEl.nodeType) return false;

    // 文本节点：直接更新 textContent
    if (oldEl.nodeType === 3) {
      if (oldEl.textContent !== newEl.textContent) {
        oldEl.textContent = newEl.textContent;
      }
      return true;
    }

    // 注释节点：更新 textContent
    if (oldEl.nodeType === 8) {
      if (oldEl.textContent !== newEl.textContent) {
        oldEl.textContent = newEl.textContent;
      }
      return true;
    }

    // 只处理元素节点
    if (oldEl.nodeType !== 1) return false;
    // 标签名不同：无法原地修补
    if (oldEl.tagName !== newEl.tagName) return false;

    // 1. 修补属性
    this._patchAttributes(oldEl, newEl);
    // 2. 修补属性（value/checked/on* 等）
    this._patchProperties(oldEl, newEl);
    // 3. 修补子节点
    this._patchChildren(oldEl, newEl);

    return true;
  }

  /** 同步属性 */
  _patchAttributes(oldEl, newEl) {
    const oldAttrs = new Map();
    for (const a of oldEl.attributes) oldAttrs.set(a.name, a.value);
    for (const a of newEl.attributes) {
      if (oldEl.getAttribute(a.name) !== a.value) {
        if (a.name === 'class' || a.name === 'className') oldEl.className = a.value;
        else oldEl.setAttribute(a.name, a.value);
      }
      oldAttrs.delete(a.name);
    }
    for (const [name] of oldAttrs) oldEl.removeAttribute(name);
  }

  /** 同步 JS 属性（value/checked/disabled/on* 事件处理器等）。
   *  事件处理器用属性赋值（el.onclick = fn），复制时自动替换旧 handler。
   *  value/checked 特殊处理：元素有焦点时（用户正在交互）跳过重置，
   *  避免 rerender 时用旧 state 值覆盖用户当前输入（光标跳转/闪屏根因之一）。 */
  _patchProperties(oldEl, newEl) {
    // 表单状态属性
    const formProps = ['value', 'checked', 'selected', 'disabled', 'readOnly', 'indeterminate'];
    const hasFocus = typeof document !== 'undefined' && document.activeElement === oldEl;
    for (const p of formProps) {
      if (newEl[p] === oldEl[p]) continue;
      // value/checked 在元素有焦点时跳过：用户正在输入/勾选，不能用旧 state 覆盖
      if (hasFocus && (p === 'value' || p === 'checked')) continue;
      try { oldEl[p] = newEl[p]; } catch { /* noop */ }
    }
    // 事件处理器属性（oninput/onclick/onchange 等）
    // h() 现在用 el.onclick = fn 赋值，复制属性即可替换旧 handler
    for (const key in newEl) {
      if (key.startsWith('on') && key.length > 2 && typeof newEl[key] === 'function') {
        if (oldEl[key] !== newEl[key]) {
          try { oldEl[key] = newEl[key]; } catch { /* noop */ }
        }
      }
    }
  }

  /** 修补子节点：引用匹配优先，其次按类型匹配原地修补，最后增删。 */
  _patchChildren(oldEl, newEl) {
    const oldKids = Array.from(oldEl.childNodes);
    const newKids = Array.from(newEl.childNodes);

    // 标记已被使用的旧子节点
    const oldUsed = new Set();
    // 记录每个 newKid 对应的"实际 DOM 节点"（可能是 oldKids 中的引用，或 newKid 本身）
    const resolved = [];

    // 第一遍：处理占位注释（复用组件）和引用匹配
    for (let i = 0; i < newKids.length; i++) {
      const newKid = newKids[i];

      // 占位注释：_reusedRef 指向真正要保留的旧 DOM 元素
      if (newKid.nodeType === 8 && newKid._reusedRef) {
        const reusedEl = newKid._reusedRef;
        // 在 oldKids 中查找 reusedEl
        const idx = oldKids.indexOf(reusedEl);
        if (idx >= 0 && !oldUsed.has(idx)) {
          oldUsed.add(idx);
          resolved.push({ el: reusedEl, isNew: false });
        } else {
          // reusedEl 不在 oldKids 中（可能已被移除），直接使用 reusedEl
          resolved.push({ el: reusedEl, isNew: true });
        }
        continue;
      }

      // 引用相同（同一 DOM 节点）
      let refMatched = false;
      for (let j = 0; j < oldKids.length; j++) {
        if (oldUsed.has(j)) continue;
        if (oldKids[j] === newKid) {
          oldUsed.add(j);
          resolved.push({ el: newKid, isNew: false });
          refMatched = true;
          break;
        }
      }
      if (refMatched) continue;

      // 类型匹配：找同类型旧节点原地修补
      let typeMatched = false;
      for (let j = 0; j < oldKids.length; j++) {
        if (oldUsed.has(j)) continue;
        if (this._canPatch(oldKids[j], newKid)) {
          this._patchInPlace(oldKids[j], newKid);
          oldUsed.add(j);
          resolved.push({ el: oldKids[j], isNew: false });
          typeMatched = true;
          break;
        }
      }
      if (typeMatched) continue;

      // 无匹配：作为新节点插入
      resolved.push({ el: newKid, isNew: true });
    }

    // 第二遍：按 resolved 顺序重排 oldEl 的子节点
    // 先收集所有要保留的节点
    const keptEls = resolved.map((r) => r.el);

    // 移除不再需要的旧子节点（未被使用的）
    for (let j = 0; j < oldKids.length; j++) {
      if (!oldUsed.has(j)) {
        const kid = oldKids[j];
        // 不在 keptEls 中的才移除
        if (!keptEls.includes(kid) && kid.parentNode === oldEl) {
          oldEl.removeChild(kid);
        }
      }
    }

    // 按 keptEls 顺序重排：确保每个节点在正确位置
    for (let i = 0; i < keptEls.length; i++) {
      const el = keptEls[i];
      const current = oldEl.childNodes[i];
      if (current !== el) {
        // insertBefore 会自动处理：如果 el 已在 DOM 中则移动，否则插入
        oldEl.insertBefore(el, current || null);
      }
    }

    // 移除多余的旧子节点（在 keptEls 之后的）
    while (oldEl.childNodes.length > keptEls.length) {
      oldEl.removeChild(oldEl.lastChild);
    }
  }

  /** 判断 oldKid 能否原地修补成 newKid（同类型节点） */
  _canPatch(oldKid, newKid) {
    if (!oldKid || !newKid) return false;
    if (oldKid.nodeType !== newKid.nodeType) return false;
    if (oldKid.nodeType === 1) return oldKid.tagName === newKid.tagName;
    return true; // 文本/注释节点都可修补
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
    // 子类若直接覆盖 render() 而绕过 renderPage()，
    // 返回的根元素可能缺少 .page / .fade-enter 类——
    // 这会导致路由切换时无法识别为"页面节点"、丢失进入动画、
    // 切换瞬间旧页 .page-leave 与新页对不上号，造成"一闪的空白"。
    // 这里在 Component 已包装的 render 之上再加一层：
    // 若返回的根节点缺少 .page 类，则补上 .page .fade-enter。
    const prevRender = this.render.bind(this);
    this.render = (...args) => {
      const node = prevRender(...args);
      if (node && node.nodeType === 1 && !node.classList.contains('page')) {
        node.classList.add('page', 'fade-enter');
      }
      return node;
    };
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
