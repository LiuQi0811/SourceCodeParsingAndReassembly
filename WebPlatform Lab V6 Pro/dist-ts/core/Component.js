// =====================================================================
// Component.ts —— 所有组件的抽象基类
// 设计模式：模板方法（生命周期钩子）、观察者（事件）、组合（props）
// 演示 MDN：DOM API、CustomEvent、WeakMap、Symbol
// =====================================================================
import { h, is } from './utils.js';
const PRIVATE = new WeakMap();
/** 抽象基类：不可直接实例化 */
export class Component {
    props;
    state;
    el;
    _mounted;
    _destroyed;
    _eventBindings;
    _children;
    _storeUnsub;
    _renderedNode;
    constructor(props = {}) {
        if (this.constructor === Component) {
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
    initialState() {
        return {};
    }
    /** 渲染：返回 DOM 元素或字符串 HTML。子类必须实现（多态） */
    render(..._args) {
        throw new Error(`${this.constructor.name} 必须实现 render() 方法`);
    }
    /** 挂载后钩子 */
    componentDidMount() { }
    /** 卸载前钩子 */
    componentWillUnmount() { }
    /** state 变更钩子（用于细粒度更新） */
    shouldComponentUpdate(_nextProps, _nextState) {
        return true;
    }
    // —— 公共 API ——
    /** 挂载到父节点 */
    mount(parent) {
        if (this._mounted)
            return this;
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
        if (this._mounted)
            return;
        this._mounted = true;
        this.el = this.el || (this._renderedNode && this._renderedNode.nodeType ? this._renderedNode : null);
        this._bindAutoEvents();
        this._triggerDidMount();
    }
    /** 挂载尚未挂载的子组件（它们的 DOM 已在父组件 render 树中） */
    _mountChildren() {
        for (const child of this._children) {
            if (!child._mounted && child.el)
                child._attach();
        }
    }
    _triggerDidMount() {
        this._mountChildren();
        requestAnimationFrame(() => {
            if (this._destroyed)
                return;
            try {
                this.componentDidMount();
            }
            catch (err) {
                console.error(`[${this.constructor.name}.componentDidMount]`, err);
            }
        });
    }
    /** 更新 props 并重渲染 */
    setProps(partial = {}) {
        const nextProps = { ...this.props, ...partial };
        if (!this.shouldComponentUpdate(nextProps, this.state))
            return;
        this.props = nextProps;
        this._rerender();
    }
    /** 更新 state 并重渲染 */
    setState(partial) {
        const nextState = typeof partial === 'function' ? partial(this.state) : { ...this.state, ...partial };
        if (!this.shouldComponentUpdate(this.props, nextState))
            return;
        this.state = nextState;
        this._rerender();
    }
    /** 查询子元素 */
    $(selector) {
        return this.el?.querySelector(selector) ?? null;
    }
    $$(selector) {
        return this.el ? Array.from(this.el.querySelectorAll(selector)) : [];
    }
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
        this._eventBindings = this._eventBindings.filter((b) => !(b.target === target && b.type === type && b.handler === handler));
    }
    /** 触发组件自定义事件，向父级冒泡 */
    emit(event, detail) {
        if (!this.el)
            return;
        this.el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true }));
    }
    /** 注册子组件（自动管理销毁） */
    registerChild(child) {
        this._children.push(child);
        return child;
    }
    /** 销毁 */
    destroy() {
        if (this._destroyed)
            return;
        try {
            this.componentWillUnmount();
        }
        catch (err) {
            console.error(`[${this.constructor.name}.componentWillUnmount]`, err);
        }
        this._children.forEach((c) => c.destroy?.());
        this._eventBindings.forEach(({ target, type, handler, options }) => {
            try {
                if (target && typeof target.removeEventListener === 'function') {
                    target.removeEventListener(type, handler, options);
                }
            }
            catch { /* noop */ }
        });
        this._eventBindings = [];
        this._storeUnsub?.();
        if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }
        this._mounted = false;
        this._destroyed = true;
    }
    // —— 内部 ——
    /** 重新渲染（保留挂载位置） */
    _rerender() {
        if (!this._mounted || !this.el)
            return;
        const oldEl = this.el;
        const wasLeaving = oldEl.classList && oldEl.classList.contains('page-leave');
        for (const child of this._children) {
            try {
                child.destroy();
            }
            catch { /* noop */ }
        }
        this._children = [];
        const node = this.render();
        const newEl = node.nodeType ? node : this._wrapHTML(node);
        oldEl.replaceWith(newEl);
        this.el = newEl;
        if (wasLeaving && newEl.classList) {
            newEl.classList.add('page-leave');
        }
        this._mountChildren();
    }
    /** 把字符串 HTML 包成 DOM */
    _wrapHTML(html) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        if (wrapper.childNodes.length !== 1) {
            const container = h('div', { class: 'component-wrapper' });
            while (wrapper.firstChild)
                container.appendChild(wrapper.firstChild);
            return container;
        }
        return wrapper.firstChild;
    }
    /** 解析 props.events 自动绑定 */
    _bindAutoEvents() {
        const events = this.props?.events;
        if (!is.obj(events) || !this.el)
            return;
        for (const [type, handler] of Object.entries(events)) {
            if (typeof handler === 'function') {
                this.on(this.el, type, handler);
            }
        }
    }
}
/** Page 基类：业务页面继承此类，体现多态 */
export class Page extends Component {
    constructor(props = {}) {
        super({ ...props, isPage: true });
        const prevRender = this.render.bind(this);
        this.render = (...args) => {
            const node = prevRender(...args);
            if (node && node.nodeType === 1 && !node.classList.contains('page')) {
                node.classList.add('page', 'fade-enter');
            }
            return node;
        };
    }
    onRouteEnter(_params, _query) { }
    onRouteLeave() {
        return true;
    }
    /** 默认页面包裹一层进入动画 */
    render(..._args) {
        const inner = this.renderPage?.() ?? '';
        const children = Array.isArray(inner) ? inner : [inner];
        return h('div', { class: 'page fade-enter' }, ...children);
    }
    renderPage() {
        return '';
    }
}
//# sourceMappingURL=Component.js.map