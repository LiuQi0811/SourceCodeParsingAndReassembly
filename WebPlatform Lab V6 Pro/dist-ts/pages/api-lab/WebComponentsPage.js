// WebComponentsPage.ts —— Web Components 实验室
// 演示 MDN：Custom Elements（自定义元素）、Shadow DOM（影子 DOM）、
//           HTML template（模板）、slot（插槽）、生命周期回调
//
// 覆盖 API：
//   1. customElements.define / get / 自定义元素类（constructor / connectedCallback /
//      disconnectedCallback / attributeChangedCallback / observedAttributes）
//   2. Element.attachShadow / shadowRoot / :host / ::slotted / 样式隔离
//   3. HTMLTemplateElement.content / cloneNode / slot 分发
//   4. adoptedCallback（Document.adoptNode 跨文档移动）
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// ---------------------------------------------------------------------------
// 模块顶层定义自定义元素类（用 customElements.get 守卫，避免重复 define —— 不可逆）
// 用 typeof 守卫，避免在无 customElements 的环境（如部分测试环境）下抛错
// ---------------------------------------------------------------------------
const _hasCE = typeof customElements !== 'undefined';
// 1) <mdn-counter> —— 演示 Custom Elements + attributeChangedCallback
if (_hasCE && !customElements.get('mdn-counter')) {
    class MdnCounter extends HTMLElement {
        _count = 0;
        constructor() {
            super();
            this._count = 0;
        }
        connectedCallback() {
            this.render();
        }
        static get observedAttributes() { return ['count']; }
        attributeChangedCallback(name, _oldVal, newVal) {
            if (name === 'count') {
                this._count = Number(newVal);
                this.render();
            }
        }
        disconnectedCallback() {
            // 这里只做日志输出，页面侧通过按钮记录
            console.log('[mdn-counter] 已从 DOM 移除');
        }
        render() {
            this.innerHTML = `<div class="wc-counter">计数: ${this._count}</div>`;
        }
        increment() {
            this.setAttribute('count', String(this._count + 1));
        }
        decrement() {
            this.setAttribute('count', String(this._count - 1));
        }
    }
    customElements.define('mdn-counter', MdnCounter);
}
// Shadow DOM 的 attachShadow mode 由该模块变量控制（class 只能 define 一次，
// 但每次实例化都会读取最新值，从而演示 open / closed 的差异）
let wcShadowMode = 'open';
// 2) <mdn-shadow-box> —— 演示 Shadow DOM + :host + ::slotted + 样式隔离
if (_hasCE && !customElements.get('mdn-shadow-box')) {
    class MdnShadowBox extends HTMLElement {
        constructor() {
            super();
            const shadow = this.attachShadow({ mode: wcShadowMode });
            shadow.innerHTML = `
        <style>
          :host { display: block; padding: 16px; border: 2px dashed #1677ff; border-radius: 8px; margin-top: 8px; }
          .inner { color: #1677ff; font-weight: bold; }
          ::slotted(span) { color: #fa541c; }
        </style>
        <p class="inner">Shadow DOM 内部内容（外部 CSS 无法影响这里）</p>
        <slot name="content"></slot>
      `;
        }
    }
    customElements.define('mdn-shadow-box', MdnShadowBox);
}
// 3) <mdn-lifecycle> —— 完整生命周期回调演示
//    constructor / connected / disconnected / adopted / attributeChanged
if (_hasCE && !customElements.get('mdn-lifecycle')) {
    class MdnLifecycle extends HTMLElement {
        constructor() {
            super();
            console.log('[mdn-lifecycle] constructor —— 元素创建');
            this._render();
        }
        connectedCallback() {
            console.log('[mdn-lifecycle] connectedCallback —— 插入 DOM');
            this._render();
        }
        disconnectedCallback() {
            console.log('[mdn-lifecycle] disconnectedCallback —— 从 DOM 移除');
        }
        adoptedCallback() {
            console.log('[mdn-lifecycle] adoptedCallback —— 移到新文档');
            this._render();
        }
        static get observedAttributes() { return ['data-status']; }
        attributeChangedCallback(name, oldVal, newVal) {
            console.log(`[mdn-lifecycle] attributeChangedCallback: ${name} ${oldVal} → ${newVal}`);
            this._render();
        }
        // 内部渲染：把当前 data-status 回显到元素上，便于观察回调确实执行
        _render() {
            const s = this.getAttribute('data-status') || '(未设置)';
            this.innerHTML = `<div class="wc-lifecycle-box">mdn-lifecycle · data-status = ${s}</div>`;
        }
    }
    customElements.define('mdn-lifecycle', MdnLifecycle);
}
const TEMPLATE_SLOT_SAMPLES = [
    { title: '卡片 #1', body: '这是通过 template.content.cloneNode(true) 克隆出来的第一张卡片' },
    { title: '卡片 #2', body: '同一个 <template> 可以被多次克隆，每次填充不同 slot 内容' },
    { title: '卡片 #3', body: '模板内的 <slot> 提供默认内容，也可被 Light DOM 覆盖' },
];
// <template> 元素的内部 HTML（含 <style> 与带 slot 的结构）
const CARD_TEMPLATE_HTML = `
  <style>
    .tpl-card { padding: 16px; border: 1px solid #d9d9d9; border-radius: 8px; background: #fafafa; }
    .tpl-card__title { font-weight: bold; margin-bottom: 8px; }
    .tpl-card__body { color: #595959; }
  </style>
  <div class="tpl-card">
    <div class="tpl-card__title"><slot name="title">默认标题</slot></div>
    <div class="tpl-card__body"><slot>默认内容</slot></div>
  </div>
`;
export class WebComponentsPage extends Page {
    _counterEl = null;
    _shadowEl = null;
    _lifecycleEl = null;
    _adoptIframe = null;
    initialState() {
        return {
            counterValue: 0, // mdn-counter 当前计数（用于跨重渲染恢复）
            counterRemoved: false, // 计数器是否被移除
            counterLog: [], // 自定义元素生命周期回调记录
            shadowMode: 'open', // Shadow DOM 当前 mode
            shadowLog: [], // shadowRoot 访问记录
            lifecycleAttached: false, // 生命周期元素是否已挂载
            lifecycleStatus: 'none', // 生命周期元素当前 data-status
            lifecycleLogs: [], // 生命周期回调记录
            templateCount: 0, // 已克隆的模板实例数
            templateInstances: [], // 已克隆实例数据（用于跨重渲染恢复）
        };
    }
    // 每次 render（含 setState 触发的重渲染）后都会调用：
    // 依据 state 把自定义元素实例重新挂载到（已被重建的）容器中
    componentDidMount() {
        this._restoreCounter();
        this._restoreShadow();
        this._restoreLifecycle();
        this._restoreTemplates();
    }
    componentWillUnmount() {
        // 清理自定义元素实例引用（customElements.define 不可逆，这里不撤销）
        this._counterEl = null;
        this._shadowEl = null;
        this._lifecycleEl = null;
        if (this._adoptIframe) {
            this._adoptIframe.remove();
            this._adoptIframe = null;
        }
    }
    // —— 通用辅助 ——
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _logEntry(tag, text) {
        return { time: formatTime(), text, tag };
    }
    // —— 1) Custom Elements：mdn-counter 恢复 ——
    _restoreCounter() {
        this._counterEl = null;
        if (this.state.counterRemoved)
            return;
        const container = this.$('.wc-counter-container');
        if (!container)
            return;
        const el = document.createElement('mdn-counter');
        el.setAttribute('count', String(this.state.counterValue));
        container.appendChild(el);
        this._counterEl = el;
    }
    _counterStep(delta) {
        if (!this._counterEl)
            return;
        // 部分运行时（如 jsdom）customElements.define 可能未真正升级元素，
        // 此时 _counterEl 上没有 increment/decrement 方法，回退到直接 setAttribute。
        if (delta > 0) {
            if (typeof this._counterEl.increment === 'function')
                this._counterEl.increment();
            else
                this._counterEl.setAttribute('count', String(Number(this._counterEl.getAttribute('count') || '0') + 1));
        }
        else {
            if (typeof this._counterEl.decrement === 'function')
                this._counterEl.decrement();
            else
                this._counterEl.setAttribute('count', String(Number(this._counterEl.getAttribute('count') || '0') - 1));
        }
        const v = Number(this._counterEl.getAttribute('count'));
        this.setState({
            counterValue: v,
            counterLog: [...this.state.counterLog,
                this._logEntry('mutate', `${delta > 0 ? '+1' : '-1'} → setAttribute('count', ${v})，触发 attributeChangedCallback → render()`),
            ].slice(-20),
        });
    }
    _counterRemove() {
        if (!this._counterEl)
            return;
        this._counterEl.remove(); // 触发 disconnectedCallback
        this._counterEl = null;
        this.setState({
            counterRemoved: true,
            counterLog: [...this.state.counterLog,
                this._logEntry('pop', 'remove() → 元素从 DOM 移除（触发 disconnectedCallback）'),
            ].slice(-20),
        });
    }
    _counterReadd() {
        this.setState({
            counterRemoved: false,
            counterLog: [...this.state.counterLog,
                this._logEntry('push', '重新 createElement + appendChild（触发 constructor + connectedCallback）'),
            ].slice(-20),
        });
    }
    // —— 2) Shadow DOM：mdn-shadow-box 恢复 ——
    _restoreShadow() {
        this._shadowEl = null;
        wcShadowMode = this.state.shadowMode;
        const container = this.$('.wc-shadow-container');
        if (!container)
            return;
        container.appendChild(this._buildShadowBox());
    }
    _buildShadowBox() {
        const box = document.createElement('mdn-shadow-box');
        const span = document.createElement('span');
        span.setAttribute('slot', 'content');
        span.textContent = '这是通过 slot 分发的 Light DOM（::slotted 将其染为橙色）';
        box.appendChild(span);
        this._shadowEl = box;
        return box;
    }
    _shadowToggle() {
        const next = this.state.shadowMode === 'open' ? 'closed' : 'open';
        wcShadowMode = next;
        // 立即重建以应用新 mode（setState 触发的重渲染随后会再次恢复，结果一致）
        const container = this.$('.wc-shadow-container');
        if (container) {
            container.innerHTML = '';
            container.appendChild(this._buildShadowBox());
        }
        const accessible = !!(this._shadowEl && this._shadowEl.shadowRoot);
        this.setState({
            shadowMode: next,
            shadowLog: [...this.state.shadowLog,
                this._logEntry('info', `切换 mode=${next} → element.shadowRoot = ${accessible ? 'ShadowRoot 对象（外部可访问）' : 'null（mode=closed 时外部无法访问）'}`),
            ].slice(-20),
        });
    }
    _shadowInspect() {
        if (!this._shadowEl)
            return;
        const sr = this._shadowEl.shadowRoot;
        this.setState({
            shadowLog: [...this.state.shadowLog,
                this._logEntry('info', sr
                    ? `element.shadowRoot = [object ShadowRoot]，host=<${sr.host.localName}>，mode=${this.state.shadowMode}`
                    : `element.shadowRoot = null（mode=closed，外部无法访问 Shadow 树）`),
            ].slice(-20),
        });
    }
    // —— 3) HTML template + slot：克隆与恢复 ——
    _cloneTemplate(title, body) {
        const tpl = document.getElementById('mdn-card-template');
        if (!tpl || !tpl.content)
            return null;
        // 关键：通过 template.content.cloneNode(true) 复制模板内容
        const content = tpl.content.cloneNode(true);
        // 用实际内容替换命名插槽
        const titleSlot = content.querySelector('slot[name="title"]');
        if (titleSlot)
            titleSlot.replaceWith(h('span', {}, title));
        // 替换默认插槽（无名 slot）
        const defaultSlot = content.querySelector('slot:not([name])');
        if (defaultSlot)
            defaultSlot.replaceWith(h('span', {}, body));
        return content; // DocumentFragment：appendChild 后其子节点被移入目标容器
    }
    _restoreTemplates() {
        const container = this.$('.wc-template-container');
        if (!container)
            return;
        for (const inst of this.state.templateInstances) {
            const node = this._cloneTemplate(inst.title, inst.body);
            if (node)
                container.appendChild(node);
        }
    }
    _templateInstantiate() {
        const n = this.state.templateCount + 1;
        const sample = TEMPLATE_SLOT_SAMPLES[(n - 1) % TEMPLATE_SLOT_SAMPLES.length];
        const title = sample.title.replace('#1', `#${n}`);
        const body = `${sample.body}（第 ${n} 次克隆，${formatTime()}）`;
        // 立即克隆并插入（可视化），同时写入 state 以便重渲染后恢复
        const container = this.$('.wc-template-container');
        if (container) {
            const node = this._cloneTemplate(title, body);
            if (node)
                container.appendChild(node);
        }
        this.setState({
            templateCount: n,
            templateInstances: [...this.state.templateInstances, { title, body }],
        });
    }
    _templateClear() {
        const container = this.$('.wc-template-container');
        if (container)
            container.innerHTML = '';
        this.setState({ templateCount: 0, templateInstances: [] });
    }
    // —— 4) 生命周期：mdn-lifecycle 恢复与操作 ——
    _restoreLifecycle() {
        this._lifecycleEl = null;
        if (!this.state.lifecycleAttached)
            return;
        const container = this.$('.wc-lifecycle-container');
        if (!container)
            return;
        const el = document.createElement('mdn-lifecycle');
        if (this.state.lifecycleStatus && this.state.lifecycleStatus !== 'none') {
            el.setAttribute('data-status', this.state.lifecycleStatus);
        }
        container.appendChild(el);
        this._lifecycleEl = el;
    }
    _lifecycleAdd() {
        const container = this.$('.wc-lifecycle-container');
        if (!container)
            return;
        const el = document.createElement('mdn-lifecycle'); // constructor
        container.appendChild(el); // connectedCallback
        this._lifecycleEl = el;
        this.setState({
            lifecycleAttached: true,
            lifecycleStatus: this.state.lifecycleStatus !== 'none' ? this.state.lifecycleStatus : 'none',
            lifecycleLogs: [...this.state.lifecycleLogs,
                this._logEntry('push', '添加元素 → constructor() + connectedCallback() 触发'),
            ].slice(-30),
        });
    }
    _lifecycleRemove() {
        if (!this._lifecycleEl) {
            this._lifecycleNoop('当前没有 mdn-lifecycle 元素可移除');
            return;
        }
        this._lifecycleEl.remove(); // disconnectedCallback
        this._lifecycleEl = null;
        this.setState({
            lifecycleAttached: false,
            lifecycleLogs: [...this.state.lifecycleLogs,
                this._logEntry('pop', 'remove() → disconnectedCallback() 触发'),
            ].slice(-30),
        });
    }
    _lifecycleAttr() {
        if (!this._lifecycleEl) {
            this._lifecycleNoop('请先“添加元素”');
            return;
        }
        const next = this.state.lifecycleStatus === 'updated' ? 'synced' : 'updated';
        this._lifecycleEl.setAttribute('data-status', next); // attributeChangedCallback
        this.setState({
            lifecycleStatus: next,
            lifecycleLogs: [...this.state.lifecycleLogs,
                this._logEntry('mutate', `setAttribute('data-status', '${next}') → attributeChangedCallback() 触发`),
            ].slice(-30),
        });
    }
    _lifecycleAdopt() {
        if (!this._lifecycleEl) {
            this._lifecycleNoop('请先“添加元素”');
            return;
        }
        // 创建隐藏 iframe 作为“新文档”
        if (!this._adoptIframe || !this._adoptIframe.contentDocument) {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            const host = this.$('.wc-adopt-container');
            if (host)
                host.appendChild(iframe);
            else
                document.body.appendChild(iframe);
            this._adoptIframe = iframe;
        }
        const iframeDoc = this._adoptIframe.contentDocument;
        if (!iframeDoc)
            return;
        // Document.adoptNode：把元素从当前文档移入 iframe 文档，触发 adoptedCallback
        const adopted = iframeDoc.adoptNode(this._lifecycleEl);
        iframeDoc.body.appendChild(adopted);
        // 元素已移入 iframe，主容器不再持有；标记为未挂载以避免重渲染时重建
        this._lifecycleEl = adopted;
        this.setState({
            lifecycleAttached: false,
            lifecycleLogs: [...this.state.lifecycleLogs,
                this._logEntry('guard', 'iframeDoc.adoptNode(el) → adoptedCallback() 触发（元素移入新文档）'),
            ].slice(-30),
        });
    }
    _lifecycleNoop(msg) {
        this.setState({
            lifecycleLogs: [...this.state.lifecycleLogs,
                this._logEntry('info', msg),
            ].slice(-30),
        });
    }
    // —— 渲染 ——
    renderPage() {
        return [
            h('h2', { class: 'section-title' }, 'Web Components 实验室'),
            h(Alert, {
                type: 'info',
                message: 'Custom Elements + Shadow DOM + template/slot + 生命周期回调',
                description: 'Web Components 是浏览器原生组件化方案。下方四个卡片分别演示自定义元素、影子 DOM 隔离、模板克隆与插槽、以及完整的生命周期回调（含 adoptedCallback）。',
            }),
            // —— 1. Custom Elements ——
            h(Card, {
                title: '1. Custom Elements（自定义元素）',
                extra: h(Tag, { color: 'primary' }, `count: ${this.state.counterValue}`),
            }, h('p', { class: 'fs-sm text-secondary' }, '自定义元素 ', h('code', {}, '<mdn-counter>'), ' 实现了 observedAttributes / attributeChangedCallback / disconnectedCallback。+1 / -1 通过 setAttribute 改变 count 属性，元素内部自动 re-render。'), h('div', { class: 'flex gap-sm' }, this._btn('+1', { size: 'sm', type: 'primary', onClick: () => this._counterStep(1) }), this._btn('-1', { size: 'sm', onClick: () => this._counterStep(-1) }), this._btn('移除元素', { size: 'sm', danger: true, onClick: () => this._counterRemove() }), this._btn('重新添加', { size: 'sm', onClick: () => this._counterReadd() })), h('div', { class: 'wc-counter-container mt-sm' }), h('p', { class: 'fs-sm text-tertiary mt-sm' }, '调用 element.remove() 会触发 disconnectedCallback；customElements.define 不可逆，组件卸载时不撤销定义。'), h('div', { class: 'log-panel mt-sm', style: { maxHeight: '140px' } }, ...this.state.counterLog.map((l) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, l.time), h('span', { class: `log-panel__tag log-panel__tag--${l.tag}` }, 'ce'), h('span', {}, l.text))))),
            // —— 2. Shadow DOM ——
            h(Card, {
                title: '2. Shadow DOM（影子 DOM）',
                extra: h(Tag, { color: 'warning' }, `mode: ${this.state.shadowMode}`),
            }, h('p', { class: 'fs-sm text-secondary' }, '自定义元素 ', h('code', {}, '<mdn-shadow-box>'), ' 在 constructor 中 attachShadow，内部样式（:host / .inner / ::slotted）与外部隔离。'), h('div', { class: 'flex gap-sm' }, this._btn('切换 mode: open/closed', { size: 'sm', type: 'primary', onClick: () => this._shadowToggle() }), this._btn('查看 element.shadowRoot', { size: 'sm', onClick: () => this._shadowInspect() })), 
            // 外部样式：尝试修改 .inner 颜色，但因 Shadow DOM 隔离无法穿透
            h('style', {}, '/* 外部规则：试图改 .inner 颜色，但无法穿透 Shadow DOM */\n.wc-shadow-section .inner { color: #fa541c !important; border: 2px solid #fa541c; }'), h('div', { class: 'wc-shadow-section' }, h('div', { class: 'wc-shadow-container' }), h('p', { class: 'fs-sm text-tertiary mt-sm' }, '上方虚线框内蓝色 .inner 文本不受外部 .inner 规则影响；通过 slot 分发的 span 被 ::slotted 染为橙色。')), h('p', { class: 'fs-sm text-tertiary' }, 'mode=closed 时 element.shadowRoot 返回 null，外部 JS 无法访问 Shadow 树。'), h('div', { class: 'log-panel mt-sm', style: { maxHeight: '140px' } }, ...this.state.shadowLog.map((l) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, l.time), h('span', { class: `log-panel__tag log-panel__tag--${l.tag}` }, 'shadow'), h('span', {}, l.text))))),
            // —— 3. HTML template + slot ——
            h(Card, {
                title: '3. HTML template 与 slot（模板与插槽）',
                extra: h(Tag, { color: 'success' }, `已克隆: ${this.state.templateCount}`),
            }, h('p', { class: 'fs-sm text-secondary' }, '下方 ', h('code', {}, '<template>'), ' 是惰性的，其内容不在渲染树中。点击“实例化模板”会通过 ', h('code', {}, 'template.content.cloneNode(true)'), ' 克隆内容，并用实际文本替换其中的 ', h('code', {}, '<slot>'), '。'), h('div', { class: 'flex gap-sm' }, this._btn('实例化模板', { size: 'sm', type: 'primary', onClick: () => this._templateInstantiate() }), this._btn('清空', { size: 'sm', danger: true, onClick: () => this._templateClear() })), 
            // 模板元素本身：用 html prop 填充 innerHTML（template 的 .content 会被填充）
            h('template', { id: 'mdn-card-template', html: CARD_TEMPLATE_HTML }), h('div', { class: 'wc-template-container mt-sm' }), h('p', { class: 'fs-sm text-tertiary mt-sm' }, '同一个 ', h('code', {}, '<template>'), ' 可被多次克隆；每次克隆可填充不同的 slot 内容。')),
            // —— 4. 生命周期回调 ——
            h(Card, {
                title: '4. 生命周期回调（Lifecycle）',
                extra: h(Tag, { color: this.state.lifecycleAttached ? 'success' : 'default' }, this.state.lifecycleAttached ? '已挂载' : '未挂载'),
            }, h('p', { class: 'fs-sm text-secondary' }, '自定义元素 ', h('code', {}, '<mdn-lifecycle>'), ' 完整实现 constructor / connected / disconnected / adopted / attributeChanged 五个回调。'), h('div', { class: 'flex gap-sm' }, this._btn('添加元素', { size: 'sm', type: 'primary', onClick: () => this._lifecycleAdd() }), this._btn('移除元素', { size: 'sm', onClick: () => this._lifecycleRemove() }), this._btn('修改属性', { size: 'sm', onClick: () => this._lifecycleAttr() }), this._btn('adopt 到 iframe', { size: 'sm', onClick: () => this._lifecycleAdopt() })), h('div', { class: 'wc-lifecycle-container mt-sm' }), 
            // 隐藏容器，用于承载 adopt 演示所需的 iframe（新文档）
            h('div', { class: 'wc-adopt-container', style: { display: 'none' } }), h('p', { class: 'fs-sm text-tertiary mt-sm' }, h('code', {}, 'adoptedCallback'), ' 通过 Document.adoptNode 跨文档移动元素触发（此处移入一个隐藏 iframe 的文档）。'), h('div', { class: 'log-panel mt-sm', style: { maxHeight: '160px' } }, ...this.state.lifecycleLogs.map((l) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, l.time), h('span', { class: `log-panel__tag log-panel__tag--${l.tag}` }, 'lc'), h('span', {}, l.text))))),
        ];
    }
}
//# sourceMappingURL=WebComponentsPage.js.map