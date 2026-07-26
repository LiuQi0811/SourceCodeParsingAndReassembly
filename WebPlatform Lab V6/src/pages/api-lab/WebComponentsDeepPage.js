// =====================================================================
// WebComponentsDeepPage.js —— Web Components 深度实验室
// 演示 MDN：
//   1. customElements.define + 自定义元素生命周期（connectedCallback /
//      disconnectedCallback / attributeChangedCallback / adoptedCallback /
//      observedAttributes / customElements.get / whenDefined / upgrade）
//   2. Shadow DOM attachShadow（mode: open / closed / shadowRoot 访问 / slot 分发）
//   3. HTMLSlotElement + slotchange 事件 + assignedNodes / assignedElements
//   4. CSS Shadow Parts ::part() + :host / :host() / :host-context() + adoptedStyleSheets
//   5. HTMLTemplateElement + DocumentFragment + form-associated + ElementInternals
// 兼容性：jsdom 中 customElements 已被 mock（define 为 no-op，不抛错但不真正注册），
//   HTMLElement 存在但 attachShadow 可能不存在或返回 mock，HTMLSlotElement 可能不存在，
//   attachInternals 通常不存在。所有 define 自定义元素的尝试会失败或被 mock 忽略，
//   需 try/catch + _addLog('warn', ...)。绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// Shadow DOM mode 由模块变量控制（class 只能 define 一次，但每次实例化读取最新值，
// 从而演示 open / closed 的差异；与 WebComponentsPage.js 同款手法）
let wcDeepShadowMode = 'open';

export class WebComponentsDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],                // 共享事件日志（所有卡片写入同一面板）
      capsSummary: '',         // 能力检测摘要（componentDidMount 中填充，非空才显示 Alert）
      lifecycleLog: '',        // Card 1 生命周期回调累积轨迹文本
      shadowStatus: '未创建',   // Card 2 当前 Shadow DOM 状态文本
      slotNodes: '',           // Card 3 assignedNodes 列表文本
      partStatus: '未应用',     // Card 4 当前 part / host / 样式表状态文本
      internalsStatus: '未创建', // Card 5 form-associated / ElementInternals 状态文本
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // —— 幂等初始化实例引用（render 在 componentDidMount 之前执行，需安全读取）——
    if (this._counterEl === undefined) this._counterEl = null;
    if (this._shadowEl === undefined) this._shadowEl = null;
    if (this._slotHost === undefined) this._slotHost = null;
    if (this._partEl === undefined) this._partEl = null;
    if (this._inputEl === undefined) this._inputEl = null;
    if (this._adoptIframe === undefined) this._adoptIframe = null;
    if (this._counterDefined === undefined) this._counterDefined = false;
    if (this._cardDefined === undefined) this._cardDefined = false;
    if (this._slotHostDefined === undefined) this._slotHostDefined = false;
    if (this._partElDefined === undefined) this._partElDefined = false;
    if (this._inputDefined === undefined) this._inputDefined = false;

    // ★★★ 关键守卫：必须存在！否则 setState → rerender → componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（仅 typeof 判定，绝不抛异常）——
    const ceSupported = typeof customElements !== 'undefined' && typeof customElements.define === 'function';
    const htmlElSupported = typeof HTMLElement !== 'undefined';
    const attachShadowSupported = typeof Element !== 'undefined' && typeof Element.prototype.attachShadow === 'function';
    const templateSupported = typeof HTMLTemplateElement !== 'undefined';
    const attachInternalsSupported = typeof Element !== 'undefined' && typeof Element.prototype.attachInternals === 'function';
    const shadowRootSupported = typeof ShadowRoot !== 'undefined';

    const summary =
      '能力检测：customElements.define=' + (ceSupported ? '✓' : '✗') +
      '，HTMLElement=' + (htmlElSupported ? '✓' : '✗') +
      '，attachShadow=' + (attachShadowSupported ? '✓' : '✗') +
      '，HTMLTemplateElement=' + (templateSupported ? '✓' : '✗') +
      '，attachInternals=' + (attachInternalsSupported ? '✓' : '✗') +
      '，ShadowRoot=' + (shadowRootSupported ? '✓' : '✗') +
      '（注：jsdom 中 customElements 已被 mock，define 为 no-op；attachShadow / attachInternals / HTMLSlotElement 多为 stub）';
    this.setState({ capsSummary: summary });
    this._addLog('info', summary);

    // 不可用能力统一记录 warn
    [
      [ceSupported, 'customElements.define 不可用，自定义元素注册演示将跳过'],
      [htmlElSupported, 'HTMLElement 类型不可用，无法定义自定义元素'],
      [attachShadowSupported, 'Element.prototype.attachShadow 不可用，Shadow DOM 演示将回退'],
      [templateSupported, 'HTMLTemplateElement 不可用，模板克隆演示将回退'],
      [attachInternalsSupported, 'Element.prototype.attachInternals 不可用，form-associated 演示将回退'],
      [shadowRootSupported, 'ShadowRoot 类型不可用，Shadow DOM 操作受限'],
    ].forEach(([ok, msg]) => { if (!ok) this._addLog('warn', msg); });
  }

  componentWillUnmount() {
    // 移除已创建的自定义元素实例引用，清理 createdCallback 句柄（便于 GC）
    // 注：customElements.define 不可逆（真实浏览器），卸载时不撤销定义
    this._counterEl = null;
    this._shadowEl = null;
    this._slotHost = null;
    this._partEl = null;
    this._inputEl = null;
    if (this._adoptIframe) {
      try { this._adoptIframe.remove(); } catch { /* noop */ }
      this._adoptIframe = null;
    }
    this._counterDefined = false;
    this._cardDefined = false;
    this._slotHostDefined = false;
    this._partElDefined = false;
    this._inputDefined = false;
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type, content) {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
    });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    return {
      ce: typeof customElements !== 'undefined' && typeof customElements.define === 'function',
      htmlEl: typeof HTMLElement !== 'undefined',
      attachShadow: typeof Element !== 'undefined' && typeof Element.prototype.attachShadow === 'function',
      template: typeof HTMLTemplateElement !== 'undefined',
      attachInternals: typeof Element !== 'undefined' && typeof Element.prototype.attachInternals === 'function',
      shadowRoot: typeof ShadowRoot !== 'undefined',
      cssSheet: typeof CSSStyleSheet !== 'undefined' &&
        typeof CSSStyleSheet.prototype.replaceSync === 'function',
      slotEl: typeof HTMLSlotElement !== 'undefined',
    };
  }

  // —— Card 1：customElements.define + 自定义元素生命周期 ——

  // 定义 <wc-deep-counter> 元素（含完整生命周期回调）
  _defineCounter() {
    if (!this._caps().ce) {
      this._addLog('warn', 'customElements.define 不可用（jsdom mock），无法注册 <wc-deep-counter>');
      return;
    }
    if (this._counterDefined) { this._addLog('define', '<wc-deep-counter> 已定义（跳过）'); return; }
    if (typeof customElements.get === 'function' && customElements.get('wc-deep-counter')) {
      this._counterDefined = true;
      this._addLog('define', "customElements.get('wc-deep-counter') 返回构造器，已注册");
      return;
    }
    try {
      const self = this;
      class WcDeepCounter extends HTMLElement {
        constructor() {
          super();
          self._addLog('lifecycle', 'constructor —— 元素实例化（构造期不可设属性 / 不可加子节点）');
          self._appendLifecycle('constructor()');
        }
        connectedCallback() {
          self._addLog('lifecycle', 'connectedCallback —— 元素插入 DOM');
          self._appendLifecycle('connectedCallback()');
        }
        disconnectedCallback() {
          self._addLog('lifecycle', 'disconnectedCallback —— 元素从 DOM 移除');
          self._appendLifecycle('disconnectedCallback()');
        }
        adoptedCallback() {
          self._addLog('lifecycle', 'adoptedCallback —— 元素被 adopt 到新文档');
          self._appendLifecycle('adoptedCallback()');
        }
        static get observedAttributes() { return ['count', 'data-status']; }
        attributeChangedCallback(name, oldValue, newValue) {
          self._addLog('lifecycle', `attributeChangedCallback: name=${name}, old=${oldValue}, new=${newValue}`);
          self._appendLifecycle(`attributeChanged(${name}: ${oldValue}→${newValue})`);
        }
      }
      customElements.define('wc-deep-counter', WcDeepCounter);
      this._counterDefined = true;
      this._addLog('define', "customElements.define('wc-deep-counter', class extends HTMLElement) ✓");
      // 演示 customElements.get / whenDefined / upgrade
      if (typeof customElements.get === 'function') {
        const ctor = customElements.get('wc-deep-counter');
        this._addLog('define', `customElements.get() → ${ctor ? ctor.name : 'undefined'}`);
      }
      if (typeof customElements.whenDefined === 'function') {
        customElements.whenDefined('wc-deep-counter')
          .then(() => this._addLog('define', "whenDefined('wc-deep-counter') Promise resolved ✓"))
          .catch(() => { /* jsdom 可能不 resolve */ });
      }
      if (typeof customElements.upgrade === 'function') {
        this._addLog('define', 'customElements.upgrade(node) 可升级未注册时创建的元素实例');
      }
    } catch (err) {
      this._addLog('warn', `define <wc-deep-counter> 失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _appendLifecycle(line) {
    const parts = (this.state.lifecycleLog || '').split('\n').filter(Boolean);
    parts.push(`[${formatTime()}] ${line}`);
    this.setState({ lifecycleLog: parts.slice(-12).join('\n') });
  }

  _insertCounter() {
    if (!this._caps().ce) { this._addLog('warn', 'customElements 不可用'); return; }
    if (!this._counterDefined) { this._addLog('warn', '请先点击「定义元素」'); return; }
    const container = this.$('.wc-deep-counter-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      const el = document.createElement('wc-deep-counter');
      el.setAttribute('count', '0');
      container.appendChild(el); // 触发 constructor + connectedCallback
      this._counterEl = el;
      this._addLog('lifecycle', "createElement + appendChild → 触发 constructor + connectedCallback");
      if (el.constructor === HTMLElement) {
        this._addLog('warn', '当前环境（jsdom mock）元素未被升级，生命周期回调不会触发；真实浏览器中可完整演示');
      }
    } catch (err) {
      this._addLog('warn', '插入元素失败：' + (err && err.message));
    }
  }

  _changeCounterAttr() {
    if (!this._counterEl) { this._addLog('warn', '请先点击「插入元素」'); return; }
    try {
      const next = Number(this._counterEl.getAttribute('count') || '0') + 1;
      this._counterEl.setAttribute('count', String(next));
      this._counterEl.setAttribute('data-status', next % 2 === 0 ? 'even' : 'odd');
      this._addLog('lifecycle', `setAttribute('count', ${next}) + setAttribute('data-status', ...) → 应触发 attributeChangedCallback ×2`);
    } catch (err) {
      this._addLog('warn', '改属性失败：' + (err && err.message));
    }
  }

  _removeCounter() {
    if (!this._counterEl) { this._addLog('warn', '当前没有 <wc-deep-counter> 元素可移除'); return; }
    try {
      this._counterEl.remove(); // 触发 disconnectedCallback
      this._addLog('lifecycle', 'element.remove() → 触发 disconnectedCallback');
      this._counterEl = null;
    } catch (err) {
      this._addLog('warn', '移除元素失败：' + (err && err.message));
    }
  }

  // —— Card 2：Shadow DOM + attachShadow ——

  _ensureShadowCardDefined() {
    if (!this._caps().ce || !this._caps().htmlEl) {
      this._addLog('warn', 'customElements / HTMLElement 不可用，无法定义 <wc-deep-card>');
      return false;
    }
    if (this._cardDefined) return true;
    if (typeof customElements.get === 'function' && customElements.get('wc-deep-card')) {
      this._cardDefined = true; return true;
    }
    try {
      const self = this;
      class WcDeepCard extends HTMLElement {
        constructor() {
          super();
          if (typeof this.attachShadow === 'function') {
            const sr = this.attachShadow({ mode: wcDeepShadowMode });
            sr.innerHTML =
              '<style>:host{display:block;padding:12px;border:2px dashed #1677ff;border-radius:8px;margin-top:8px;}' +
              '.inner{color:#1677ff;font-weight:bold;}::slotted(span){color:#fa541c;}</style>' +
              '<p class="inner">Shadow DOM 内部（外部 CSS 无法穿透）</p>' +
              '<slot name="header">默认 header</slot><slot>默认内容</slot>';
            self._addLog('shadow', `attachShadow({ mode: '${wcDeepShadowMode}' }) → 返回 ShadowRoot`);
          } else {
            self._addLog('warn', 'attachShadow 不可用（jsdom stub），Shadow DOM 未附加');
          }
        }
      }
      customElements.define('wc-deep-card', WcDeepCard);
      this._cardDefined = true;
      this._addLog('shadow', "customElements.define('wc-deep-card', ...) ✓");
      return true;
    } catch (err) {
      this._addLog('warn', `define <wc-deep-card> 失败：${err && err.name} - ${err && err.message}`);
      return false;
    }
  }

  // attachShadow 指定 mode，创建元素并检测 element.shadowRoot 可访问性
  _attachShadowMode(mode) {
    if (!this._ensureShadowCardDefined()) return;
    wcDeepShadowMode = mode;
    const container = this.$('.wc-deep-shadow-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      const el = document.createElement('wc-deep-card');
      container.innerHTML = '';
      container.appendChild(el);
      this._shadowEl = el;
      const sr = el.shadowRoot;
      const accessible = !!sr;
      this._addLog('attach', `mode='${mode}' → element.shadowRoot = ${accessible ? '[object ShadowRoot]' : 'null'}`);
      this.setState({ shadowStatus: `mode=${mode}，shadowRoot ${accessible ? '可访问 ✓' : (mode === 'closed' ? 'null（隔离）' : '不可访问 ✗')}` });
      if (el.constructor === HTMLElement) {
        this._addLog('warn', '当前环境（jsdom mock）元素未升级，attachShadow 可能未执行');
      }
    } catch (err) {
      this._addLog('warn', `attachShadow ${mode} 失败：` + (err && err.message));
    }
  }

  _attachShadowOpen() { this._attachShadowMode('open'); }
  _attachShadowClosed() { this._attachShadowMode('closed'); }

  _slotDistribute() {
    if (!this._ensureShadowCardDefined()) return;
    wcDeepShadowMode = 'open';
    const container = this.$('.wc-deep-shadow-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      const el = document.createElement('wc-deep-card');
      const header = document.createElement('span');
      header.setAttribute('slot', 'header');
      header.textContent = '这是分发到 header 插槽的 Light DOM';
      const body = document.createElement('span');
      body.textContent = '这是分发到默认插槽的 Light DOM';
      el.appendChild(header);
      el.appendChild(body);
      container.innerHTML = '';
      container.appendChild(el);
      this._shadowEl = el;
      this._addLog('shadow', 'slot 分发：<span slot="header"> → <slot name="header">；无 slot 属性 → 默认 <slot>');
      this._addLog('shadow', '::slotted(span) 可在 Shadow 内样式化被分发的 Light DOM 节点');
      this.setState({ shadowStatus: 'slot 分发已演示（header + 默认插槽）' });
    } catch (err) {
      this._addLog('warn', 'slot 分发失败：' + (err && err.message));
    }
  }

  // —— Card 3：HTMLSlotElement + slotchange 事件 + assignedNodes ——

  _ensureSlotHostDefined() {
    if (!this._caps().ce || !this._caps().htmlEl) {
      this._addLog('warn', 'customElements / HTMLElement 不可用，无法定义 <wc-deep-slot-host>');
      return false;
    }
    if (this._slotHostDefined) return true;
    if (typeof customElements.get === 'function' && customElements.get('wc-deep-slot-host')) {
      this._slotHostDefined = true; return true;
    }
    try {
      const self = this;
      class WcDeepSlotHost extends HTMLElement {
        constructor() {
          super();
          if (typeof this.attachShadow === 'function') {
            const sr = this.attachShadow({ mode: 'open' });
            sr.innerHTML =
              '<style>:host{display:block;padding:10px;border:1px solid #52c41a;border-radius:6px;margin-top:8px;}</style>' +
              '<slot name="header">默认 header</slot><slot>默认内容</slot>';
            // 监听 slotchange：分发内容变化时触发
            sr.querySelectorAll('slot').forEach((slot) => {
              if (typeof slot.addEventListener === 'function') {
                slot.addEventListener('slotchange', () => {
                  const name = slot.getAttribute('name') || '(default)';
                  let count = 0;
                  try {
                    count = slot.assignedNodes
                      ? slot.assignedNodes({ flatten: true }).length
                      : (slot.assignedElements ? slot.assignedElements().length : 0);
                  } catch { /* jsdom 可能不支持 assignedNodes */ }
                  self._addLog('change', `slotchange 触发：slot name=${name}，assignedNodes=${count}`);
                });
              }
            });
            self._addLog('slot', '已为 <slot> 绑定 slotchange 事件监听');
          } else {
            self._addLog('warn', 'attachShadow 不可用，<wc-deep-slot-host> 未附加 Shadow DOM');
          }
        }
      }
      customElements.define('wc-deep-slot-host', WcDeepSlotHost);
      this._slotHostDefined = true;
      this._addLog('slot', "customElements.define('wc-deep-slot-host', ...) ✓");
      return true;
    } catch (err) {
      this._addLog('warn', `define <wc-deep-slot-host> 失败：${err && err.name} - ${err && err.message}`);
      return false;
    }
  }

  _triggerSlotchange() {
    if (!this._ensureSlotHostDefined()) return;
    const container = this.$('.wc-deep-slot-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      if (!this._slotHost) {
        this._slotHost = document.createElement('wc-deep-slot-host');
        container.innerHTML = '';
        container.appendChild(this._slotHost);
        this._addLog('slot', '已创建 <wc-deep-slot-host>（含 header + 默认插槽）');
      }
      const span = document.createElement('span');
      span.setAttribute('slot', 'header');
      span.textContent = 'slotchange 触发项 #' + Date.now();
      this._slotHost.appendChild(span);
      this._addLog('change', '已 appendChild <span slot="header">，分发内容变化应触发 slotchange');
      setTimeout(() => {
        try { span.remove(); this._addLog('change', '已 removeChild，分发内容再次变化应触发 slotchange'); }
        catch { /* noop */ }
      }, 100);
      if (this._slotHost.constructor === HTMLElement) {
        this._addLog('warn', '当前环境（jsdom mock）元素未升级，slotchange 可能不触发');
      }
    } catch (err) {
      this._addLog('warn', '触发 slotchange 失败：' + (err && err.message));
    }
  }

  _listAssignedNodes() {
    if (!this._slotHost) { this._addLog('warn', '请先点击「触发 slotchange」创建 <wc-deep-slot-host>'); return; }
    const caps = this._caps();
    try {
      const sr = this._slotHost.shadowRoot;
      if (!sr) { this._addLog('warn', 'element.shadowRoot 为 null（mode=closed 或未升级）'); return; }
      const lines = [];
      const readSlot = (slot, label) => {
        if (!slot) { lines.push(`未找到 ${label}（HTMLSlotElement 可能不可用）`); return; }
        let nodes = [], elems = [];
        if (typeof slot.assignedNodes === 'function') nodes = slot.assignedNodes({ flatten: true });
        if (typeof slot.assignedElements === 'function') elems = slot.assignedElements();
        lines.push(`${label} assignedNodes({flatten:true}): ${nodes.length} 个`);
        nodes.forEach((n, i) => lines.push(`  [${i}] ${n.nodeName}: ${(n.textContent || '').slice(0, 40)}`));
        lines.push(`${label} assignedElements(): ${elems.length} 个`);
      };
      readSlot(sr.querySelector('slot[name="header"]'), 'header 插槽');
      readSlot(sr.querySelector('slot:not([name])'), '默认插槽');
      this.setState({ slotNodes: lines.join('\n') });
      this._addLog('slot', '已读取 assignedNodes / assignedElements（详见下方输出）');
      if (!caps.slotEl) this._addLog('warn', 'HTMLSlotElement 类型不可用，assignedNodes 可能为 stub');
    } catch (err) {
      this._addLog('warn', '读取 assignedNodes 失败：' + (err && err.message));
    }
  }

  // —— Card 4：CSS Shadow Parts + ::part() + adoptedStyleSheets ——

  _ensurePartElDefined() {
    if (!this._caps().ce || !this._caps().htmlEl) {
      this._addLog('warn', 'customElements / HTMLElement 不可用，无法定义 <wc-deep-part>');
      return false;
    }
    if (this._partElDefined) return true;
    if (typeof customElements.get === 'function' && customElements.get('wc-deep-part')) {
      this._partElDefined = true; return true;
    }
    try {
      const self = this;
      class WcDeepPart extends HTMLElement {
        constructor() {
          super();
          if (typeof this.attachShadow === 'function') {
            const sr = this.attachShadow({ mode: 'open' });
            // :host 选择 Shadow 宿主；内部元素用 part 属性暴露给外部 ::part()
            sr.innerHTML =
              '<style>:host{display:block;padding:12px;border:1px solid #722ed1;border-radius:8px;margin-top:8px;}' +
              ':host([disabled]){opacity:0.5;}.box{padding:8px;margin:4px 0;background:#fafafa;}</style>' +
              '<div class="box" part="title">part=title 的元素</div>' +
              '<div class="box" part="body">part=body 的元素</div>';
            self._addLog('part', '<wc-deep-part> 内部元素已设 part 属性（part="title" / part="body"）');
          } else {
            self._addLog('warn', 'attachShadow 不可用，<wc-deep-part> 未附加 Shadow DOM');
          }
        }
      }
      customElements.define('wc-deep-part', WcDeepPart);
      this._partElDefined = true;
      this._addLog('part', "customElements.define('wc-deep-part', ...) ✓");
      return true;
    } catch (err) {
      this._addLog('warn', `define <wc-deep-part> 失败：${err && err.name} - ${err && err.message}`);
      return false;
    }
  }

  _setPart() {
    if (!this._ensurePartElDefined()) return;
    const container = this.$('.wc-deep-part-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      const el = document.createElement('wc-deep-part');
      container.innerHTML = '';
      container.appendChild(el);
      this._partEl = el;
      // 注入外部 <style>，用 ::part(title) / ::part(body) 设置 Shadow 内部 part 元素样式
      const style = document.createElement('style');
      style.textContent =
        'wc-deep-part::part(title) { color:#722ed1; font-weight:bold; border-left:4px solid #722ed1; }' +
        'wc-deep-part::part(body) { color:#fa541c; font-style:italic; }';
      container.appendChild(style);
      this._addLog('part', '已注入外部 <style>：::part(title) / ::part(body) 设置 Shadow 内部 part 元素样式');
      this._addLog('part', 'element.part / setAttribute("part", ...) 在 Shadow 内部元素上声明 part 名');
      this.setState({ partStatus: '已设置 part + ::part() 外部样式（title 紫色 / body 橙色斜体）' });
      if (el.constructor === HTMLElement) {
        this._addLog('warn', '当前环境（jsdom mock）元素未升级，::part() 样式可能不生效');
      }
    } catch (err) {
      this._addLog('warn', '设置 part 失败：' + (err && err.message));
    }
  }

  _hostSelector() {
    if (!this._ensurePartElDefined()) return;
    const container = this.$('.wc-deep-part-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      const el = document.createElement('wc-deep-part');
      el.setAttribute('disabled', '');
      container.innerHTML = '';
      container.appendChild(el);
      this._partEl = el;
      this._addLog('host', ':host 选择 Shadow 宿主元素本身（相当于 this）');
      this._addLog('host', ':host([disabled]) 匹配带 disabled 属性的宿主（设 opacity:0.5）');
      this._addLog('host', ':host-context(.dark) 匹配祖先含 .dark 类的宿主（上下文匹配，部分浏览器支持）');
      this.setState({ partStatus: ':host / :host([disabled]) / :host-context() 演示已应用' });
      if (el.constructor === HTMLElement) {
        this._addLog('warn', '当前环境（jsdom mock）元素未升级，:host 样式可能不生效');
      }
    } catch (err) {
      this._addLog('warn', ':host 演示失败：' + (err && err.message));
    }
  }

  _adoptedStyleSheets() {
    if (!this._caps().cssSheet) {
      this._addLog('warn', 'CSSStyleSheet 不可用或 replaceSync 不支持（需较新 Chromium），adoptedStyleSheets 演示跳过');
      return;
    }
    if (!this._partEl) { this._addLog('warn', '请先点击「设置 part」创建 <wc-deep-part>'); return; }
    try {
      // 构造 Constructable Stylesheet：new CSSStyleSheet() + replaceSync(cssText)
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(
        ':host { border-color:#13c2c2 !important; background:#e6fffb; }' +
        '::part(title) { color:#13c2c2 !important; border-left-color:#13c2c2 !important; }'
      );
      const sr = this._partEl.shadowRoot;
      if (!sr) { this._addLog('warn', 'element.shadowRoot 为 null（未升级或 closed）'); return; }
      // adoptedStyleSheets 是数组赋值（非 push），可多 sheet 共享
      sr.adoptedStyleSheets = [...(sr.adoptedStyleSheets || []), sheet];
      this._addLog('host', 'new CSSStyleSheet() + replaceSync(cssText) → Constructable Stylesheet');
      this._addLog('host', 'shadowRoot.adoptedStyleSheets = [sheet] 已注入（青色边框 + 青色 title）');
      this._addLog('host', 'adoptedStyleSheets 可跨多个 ShadowRoot 共享同一 sheet，修改 sheet 全部生效');
      this.setState({ partStatus: 'adoptedStyleSheets 已注入（Constructable Stylesheet）' });
    } catch (err) {
      this._addLog('warn', 'adoptedStyleSheets 注入失败：' + (err && err.message));
    }
  }

  // —— Card 5：HTMLTemplateElement + DocumentFragment + form-associated ——

  _cloneTemplate() {
    if (!this._caps().template) {
      this._addLog('warn', 'HTMLTemplateElement 不可用，模板克隆演示跳过');
      return;
    }
    try {
      const tpl = this.$('#wc-deep-template');
      if (!tpl || !tpl.content) { this._addLog('warn', '找不到 <template> 或 .content 为空'); return; }
      // template.content 返回 DocumentFragment（惰性）；cloneNode(true) 深拷贝
      const fragment = tpl.content.cloneNode(true);
      const fillSlot = (sel, text) => {
        const slot = fragment.querySelector(sel);
        if (slot) {
          const span = document.createElement('span');
          span.textContent = text;
          slot.replaceWith(span);
        }
      };
      fillSlot('slot[name="t-title"]', '克隆实例 #' + Date.now().toString(36));
      fillSlot('slot:not([name])', '通过 template.content.cloneNode(true) 克隆的 DocumentFragment');
      const container = this.$('.wc-deep-template-host');
      if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
      container.appendChild(fragment);
      this._addLog('template', 'template.content.cloneNode(true) → DocumentFragment 已克隆并插入');
      this._addLog('template', 'DocumentFragment 是轻量容器，appendChild 后子节点移入目标（fragment 本身不留）');
      this.setState({ internalsStatus: '模板已克隆（DocumentFragment + cloneNode）' });
    } catch (err) {
      this._addLog('warn', '克隆 template 失败：' + (err && err.message));
    }
  }

  _defineFormAssociated() {
    if (!this._caps().ce || !this._caps().htmlEl) {
      this._addLog('warn', 'customElements / HTMLElement 不可用，无法定义 <wc-deep-input>');
      return;
    }
    if (this._inputDefined) { this._addLog('template', '<wc-deep-input> 已定义（跳过）'); return; }
    if (typeof customElements.get === 'function' && customElements.get('wc-deep-input')) {
      this._inputDefined = true;
      this._addLog('template', "customElements.get('wc-deep-input') 已存在");
      return;
    }
    try {
      const self = this;
      // formAssociated: true 通过 options 第三参传入；static formAssociated = true 亦可
      class WcDeepInput extends HTMLElement {
        static formAssociated = true; // 声明为表单关联元素

        constructor() {
          super();
          // form-associated 元素在 constructor 中可调用 attachInternals() 获取 ElementInternals
          this._internals = null;
          if (typeof this.attachInternals === 'function') {
            this._internals = this.attachInternals();
            self._addLog('internals', 'attachInternals() → 返回 ElementInternals 对象');
          } else {
            self._addLog('warn', 'attachInternals 不可用（jsdom 通常不支持），ElementInternals 演示将回退');
          }
          if (typeof this.attachShadow === 'function') {
            const sr = this.attachShadow({ mode: 'open' });
            sr.innerHTML =
              '<style>:host{display:inline-block;border:1px solid #d9d9d9;border-radius:4px;padding:4px 8px;}</style>' +
              '<input type="text" placeholder="form-associated 自定义元素">';
          }
        }

        // 表单关联元素需实现 value 的 getter / setter（form 会读写）
        get value() { return this._v || ''; }
        set value(v) {
          this._v = v;
          if (this._internals && typeof this._internals.setFormValue === 'function') {
            this._internals.setFormValue(v); // setFormValue 把值提交给宿主 <form>
          }
        }

        // formAssociated 元素的表单回调
        formResetCallback() { this.value = ''; self._addLog('internals', 'formResetCallback —— 表单 reset 时触发'); }
        formStateRestoreCallback(state, mode) {
          self._addLog('internals', `formStateRestoreCallback(state, mode=${mode}) —— 浏览器恢复表单状态`);
        }
      }
      customElements.define('wc-deep-input', WcDeepInput, { formAssociated: true });
      this._inputDefined = true;
      this._addLog('template', "customElements.define('wc-deep-input', ..., { formAssociated: true }) ✓");
      this._addLog('template', 'static formAssociated = true / options.formAssociated 声明表单关联');
      this.setState({ internalsStatus: '已定义 form-associated 元素 <wc-deep-input>' });
    } catch (err) {
      this._addLog('warn', `define <wc-deep-input> 失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _attachInternalsDemo() {
    if (!this._caps().attachInternals) {
      this._addLog('warn', 'Element.prototype.attachInternals 不可用（jsdom 通常不支持），ElementInternals 演示跳过');
      return;
    }
    if (!this._inputDefined) { this._addLog('warn', '请先点击「定义 form-associated 元素」'); return; }
    const container = this.$('.wc-deep-input-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      if (!this._inputEl) {
        this._inputEl = document.createElement('wc-deep-input');
        container.innerHTML = '';
        container.appendChild(this._inputEl);
      }
      const el = this._inputEl;
      el.value = 'hello-' + Date.now().toString(36); // setFormValue 提交给宿主 form
      const internals = el._internals;
      if (!internals) { this._addLog('warn', '元素未升级或 attachInternals 未执行，ElementInternals 不可用'); return; }
      const lines = [];
      if (typeof internals.setFormValue === 'function') {
        internals.setFormValue(el.value);
        lines.push(`setFormValue('${el.value}') ✓`);
      }
      if (internals.states && typeof internals.states.add === 'function') {
        internals.states.add('--valid'); // CustomStateSet，驱动 :--valid 伪类
        lines.push('internals.states.add("--valid") → 驱动 :--valid 伪类');
      }
      if ('willValidate' in internals) lines.push(`internals.willValidate = ${internals.willValidate}`);
      if (internals.validity && typeof internals.validity.valid !== 'undefined') {
        lines.push(`internals.validity.valid = ${internals.validity.valid}`);
      }
      if (typeof internals.form !== 'undefined') {
        lines.push(`internals.form = ${internals.form ? '<form>' : 'null（未在 form 内）'}`);
      }
      this.setState({ internalsStatus: 'attachInternals 演示已执行\n' + lines.join('\n') });
      this._addLog('internals', 'attachInternals 演示完成：setFormValue / states / willValidate / validity');
      if (el.constructor === HTMLElement) {
        this._addLog('warn', '当前环境（jsdom mock）元素未升级，attachInternals 可能返回 stub');
      }
    } catch (err) {
      this._addLog('warn', 'attachInternals 演示失败：' + (err && err.message));
    }
  }

  // —— 渲染 ——

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. customElements.define + 自定义元素生命周期',
      desc: 'customElements.define(name, constructor, options) 注册自定义元素；name 必须含连字符（如 wc-deep-counter）；constructor extends HTMLElement。生命周期回调：connectedCallback / disconnectedCallback / attributeChangedCallback / adoptedCallback；static get observedAttributes() 返回要观察的属性数组；customElements.get(name) / whenDefined(name) → Promise；customElements.upgrade(node) 升级未注册时创建的元素。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.ce ? 'success' : 'warning' }, caps.ce ? 'customElements 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'wc-deep-counter'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'customElements.define(name, constructor, options) 注册自定义元素；name 必须含连字符（如 \'wc-deep-counter\'）。生命周期回调：connectedCallback（插入 DOM）/ disconnectedCallback（移除）/ attributeChangedCallback（observedAttributes 属性变化）/ adoptedCallback（adopt 到新文档）。static get observedAttributes() 返回要观察的属性数组；customElements.get / whenDefined → Promise / upgrade(node) 升级未注册元素。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('定义元素', { type: 'primary', size: 'sm', disabled: !caps.ce, onClick: () => this._defineCounter() }),
          this._btn('插入元素触发 connectedCallback', { size: 'sm', disabled: !caps.ce, onClick: () => this._insertCounter() }),
          this._btn('改属性触发 attributeChangedCallback', { size: 'sm', disabled: !caps.ce, onClick: () => this._changeCounterAttr() }),
          this._btn('移除元素触发 disconnectedCallback', { size: 'sm', danger: true, disabled: !caps.ce, onClick: () => this._removeCounter() }),
        ),
        h('div', { class: 'wc-deep-counter-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '生命周期回调轨迹（最近 12 条）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.lifecycleLog || '（点击「定义元素」→「插入元素」→「改属性」→「移除元素」）')),
        h(Alert, {
          type: 'info',
          message: 'constructor 中不可设属性 / 不可加子节点',
          description: 'W3C 规范要求 constructor 只做最小初始化（设内部状态），DOM 操作 / 属性读写应在 connectedCallback 中进行；attributeChangedCallback 仅对 observedAttributes 列出的属性触发。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Shadow DOM + attachShadow',
      desc: 'element.attachShadow({ mode: \'open\' | \'closed\' }) 返回 ShadowRoot；open 模式 element.shadowRoot 可访问，closed 返回 null。shadowRoot.innerHTML / appendChild 设置内容；Shadow DOM 隔离：样式不外泄、DOM 查询不到内部。slot 分发：<slot name="x"></slot> + <span slot="x">。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.attachShadow ? 'success' : 'warning' }, caps.attachShadow ? 'attachShadow 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'wc-deep-card'),
        h(Tag, { color: 'warning' }, s.shadowStatus),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.attachShadow({ mode: \'open\' | \'closed\' }) 返回 ShadowRoot；open 时 element.shadowRoot 可访问，closed 返回 null。Shadow DOM 提供样式隔离（内部 <style> 不外泄）与 DOM 隔离（querySelector 查不到内部）。slot 分发：Light DOM 子节点带 slot="x" → 分发到 <slot name="x">；无 slot 属性 → 默认 <slot>。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('attachShadow open', { type: 'primary', size: 'sm', disabled: !caps.attachShadow, onClick: () => this._attachShadowOpen() }),
          this._btn('attachShadow closed', { size: 'sm', disabled: !caps.attachShadow, onClick: () => this._attachShadowClosed() }),
          this._btn('slot 分发演示', { size: 'sm', disabled: !caps.attachShadow, onClick: () => this._slotDistribute() }),
        ),
        h('div', { class: 'wc-deep-shadow-host mt-sm' }),
        h('p', { class: 'fs-sm text-tertiary mt-sm' },
          'open 模式 element.shadowRoot 返回 ShadowRoot 对象；closed 模式返回 null，外部无法访问 Shadow 树。::slotted(span) 可在 Shadow 内样式化被分发的 Light DOM 节点。'),
        h(Alert, {
          type: 'info',
          message: 'Shadow DOM 实现样式与 DOM 双重隔离',
          description: '内部 <style> 不会影响外部，外部样式也不会穿透进 Shadow（除 CSS 变量 / inherit 属性）；外部 querySelector 无法查到 Shadow 内节点。open / closed 仅影响外部 JS 访问，不影响样式隔离。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. HTMLSlotElement + slotchange 事件 + assignedNodes',
      desc: '<slot> 元素的 slotchange 事件在分发内容变化时触发；slot.assignedNodes({ flatten: true }) / assignedElements() 返回分发到该插槽的节点。<slot name="header"> 命名插槽 vs 默认插槽 <slot></slot>。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.slotEl ? 'success' : 'warning' }, caps.slotEl ? 'HTMLSlotElement 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'slotchange / assignedNodes'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<slot> 元素的 slotchange 事件在分发内容变化时触发；slot.assignedNodes({ flatten: true }) 返回分发节点数组（flatten 递归展开嵌套 slot）；assignedElements() 仅返回 Element。<slot name="header"> 命名插槽 vs 默认插槽 <slot></slot>。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('触发 slotchange', { type: 'primary', size: 'sm', disabled: !caps.attachShadow, onClick: () => this._triggerSlotchange() }),
          this._btn('assignedNodes 列表', { size: 'sm', disabled: !caps.attachShadow, onClick: () => this._listAssignedNodes() }),
        ),
        h('div', { class: 'wc-deep-slot-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'assignedNodes / assignedElements 输出：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {}, s.slotNodes || '（点击「触发 slotchange」→「assignedNodes 列表」）')),
        h(Alert, {
          type: 'info',
          message: 'slotchange 在微任务中触发，比 MutationObserver 更精准',
          description: 'slotchange 是 slot 专属事件，仅当分发到该 slot 的节点变化时触发；assignedNodes({ flatten: true }) 的 flatten 选项会递归展开嵌套 <slot> 的分发内容。命名插槽与默认插槽互斥：带 slot 属性的子节点只分发到同名插槽。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. CSS Shadow Parts + ::part() + adoptedStyleSheets',
      desc: 'element.part = \'foo bar\' 或 setAttribute(\'part\', \'foo\') 暴露 Shadow 内部元素；外部 CSS 用 ::part(foo) { ... } 设置样式。:host / :host() / :host-context() 选择器。ShadowRoot.adoptedStyleSheets = [sheet] 应用 Constructable Stylesheet。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.cssSheet ? 'success' : 'warning' }, caps.cssSheet ? 'CSSStyleSheet 可用' : '不可用'),
        h(Tag, { color: 'primary' }, '::part() / :host()'),
        h(Tag, { color: 'warning' }, s.partStatus),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.part = \'foo bar\' 或 setAttribute(\'part\', \'foo\') 暴露 Shadow 内部元素；外部 CSS 用 ::part(foo) { ... } 设置样式（穿透 Shadow 样式隔离）。:host 选择宿主；:host([disabled]) 匹配带属性宿主；:host-context(.dark) 上下文匹配。shadowRoot.adoptedStyleSheets = [sheet] 应用 Constructable Stylesheet（new CSSStyleSheet() + replaceSync），可跨 ShadowRoot 共享。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('设置 part', { type: 'primary', size: 'sm', disabled: !caps.attachShadow, onClick: () => this._setPart() }),
          this._btn(':host 选择器演示', { size: 'sm', disabled: !caps.attachShadow, onClick: () => this._hostSelector() }),
          this._btn('adoptedStyleSheets 注入', { size: 'sm', disabled: !caps.cssSheet || !caps.attachShadow, onClick: () => this._adoptedStyleSheets() }),
        ),
        h('div', { class: 'wc-deep-part-host mt-sm' }),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '120px', overflow: 'auto' } },
`/* Shadow 内部 */
<div part="title">...</div>
/* 外部 CSS 穿透 ::part() */
wc-deep-part::part(title) { color: #722ed1; }
:host { ... }              /* 宿主 */
:host([disabled]) { ... } /* 带属性的宿主 */
:host-context(.dark) { ... } /* 上下文匹配 */
/* Constructable Stylesheet */
const sheet = new CSSStyleSheet();
sheet.replaceSync(':host { ... }');
shadowRoot.adoptedStyleSheets = [sheet];`),
        h(Alert, {
          type: 'info',
          message: '::part() 是穿透 Shadow DOM 样式隔离的唯一官方机制',
          description: 'part 属性需在 Shadow 内部元素上声明，外部用 ::part(name) 匹配；可设多个 part 名（空格分隔）。adoptedStyleSheets 可跨 ShadowRoot 共享同一 sheet，修改 sheet 内容所有引用处即时生效，比 <style> innerHTML 更高效。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. HTMLTemplateElement + DocumentFragment + form-associated',
      desc: '<template>.content 返回 DocumentFragment；template.content.cloneNode(true) 克隆。customElements.define with formAssociated: true；ElementInternals：element.attachInternals() 返回 internals；internals.setFormValue(value) / internals.states / internals.willValidate；static formAssociated = true。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.template ? 'success' : 'warning' }, caps.template ? 'template 可用' : '不可用'),
        h(Tag, { color: caps.attachInternals ? 'success' : 'warning' }, caps.attachInternals ? 'attachInternals 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'wc-deep-input'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<template>.content 返回 DocumentFragment（惰性）；cloneNode(true) 深拷贝。customElements.define(name, ctor, { formAssociated: true }) 或 static formAssociated = true 声明表单关联元素；element.attachInternals() 返回 ElementInternals；internals.setFormValue(value) 提交给 <form>；internals.states（CustomStateSet）驱动 :--valid 伪类；willValidate / validity 表单校验；formResetCallback / formStateRestoreCallback 等回调。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('克隆 template', { type: 'primary', size: 'sm', disabled: !caps.template, onClick: () => this._cloneTemplate() }),
          this._btn('定义 form-associated 元素', { size: 'sm', disabled: !caps.ce, onClick: () => this._defineFormAssociated() }),
          this._btn('attachInternals 演示', { size: 'sm', disabled: !caps.attachInternals, onClick: () => this._attachInternalsDemo() }),
        ),
        // <template> 元素：用 html prop 填充 .content
        h('template', { id: 'wc-deep-template', html:
          '<style>' +
          '.tpl-item{padding:8px;border:1px solid #d9d9d9;border-radius:6px;background:#fafafa;margin:4px 0;}' +
          '.tpl-item__title{font-weight:bold;color:#1677ff;}' +
          '.tpl-item__body{color:#595959;font-size:12px;}' +
          '</style>' +
          '<div class="tpl-item">' +
          '<div class="tpl-item__title"><slot name="t-title">默认标题</slot></div>' +
          '<div class="tpl-item__body"><slot>默认内容</slot></div>' +
          '</div>'
        }),
        h('div', { class: 'wc-deep-template-host mt-sm' }),
        h('div', { class: 'wc-deep-input-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'form-associated / ElementInternals 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap' } },
          h('code', {}, s.internalsStatus || '（点击「定义 form-associated 元素」→「attachInternals 演示」）')),
        h(Alert, {
          type: 'info',
          message: 'form-associated 让自定义元素像原生表单控件一样参与 form 提交',
          description: 'attachInternals() 必须在 formAssociated: true 的元素中调用（否则抛 NotSupportedError）；setFormValue 提交的值会包含在 FormData 中；states（CustomStateSet）驱动 :--valid / :--invalid 等自定义状态伪类；formResetCallback 在表单 reset 时触发。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Web Components 深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Web Components：customElements.define 生命周期 / Shadow DOM attachShadow / HTMLSlotElement slotchange / CSS ::part()+:host()+adoptedStyleSheets / HTMLTemplateElement+form-associated+ElementInternals。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
