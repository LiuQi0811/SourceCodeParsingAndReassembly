// =====================================================================
// WebComponentsAdvancedPage.js —— Web Components 高级特性 实验室
// 演示 MDN：Declarative Shadow DOM、formAssociated 与表单集成、customStateSet 与 :state()、
//   :defined 伪类与 CustomElementRegistry（define/get/getName/upgrade/whenDefined、extends/is=）、
//   Shadow DOM 事件重定向与 composedPath、CSS 自定义属性穿透与 ::part()。
// 说明：所有 API 调用前做 typeof / in 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//   jsdom 中 customElements 已被 mock（define/whenDefined no-op），attachShadow 部分支持，
//   attachInternals / Declarative Shadow DOM / customStateSet 多为 stub；需 try/catch + <pre> 代码示例。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class WebComponentsAdvancedPage extends Page {
  initialState() {
    return {
      logs: [], capsSummary: '',
      dsdInfo: '',            // Card 1：Declarative Shadow DOM
      formAssociatedInfo: '', // Card 2：formAssociated 与表单集成
      stateInfo: '',          // Card 3：customStateSet 与 :state() 伪类
      definedInfo: '',        // Card 4：:defined 伪类与 CustomElementRegistry
      composedInfo: '',       // Card 5：Shadow DOM 事件重定向与 composedPath
      cssPartInfo: '',        // Card 6：CSS 自定义属性穿透与 ::part()
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;
    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dsdEl = null; this._formEl = null; this._stateEl = null;
    this._stateInternals = null; this._definedEl = null;
    this._composedEl = null; this._cssPartEl = null; this._observer = null;

    // 一次性能力检测：Web Components 进阶特性全家桶
    const d = this._detected();
    const parts = [
      `customElements ${d.ce ? '✓' : '✗'}`, `attachInternals ${d.attachInternals ? '✓' : '✗'}`,
      `attachShadow ${d.attachShadow ? '✓' : '✗'}`, `DeclarativeShadowDOM ${d.dsd ? '✓' : '✗'}`,
      `getHTML ${d.getHTML ? '✓' : '✗'}`, `ShadowRoot ${d.shadowRoot ? '✓' : '✗'}`,
      `customElements.get ${d.get ? '✓' : '✗'}`, `getName ${d.getName ? '✓' : '✗'}`,
      `upgrade ${d.upgrade ? '✓' : '✗'}`, `whenDefined ${d.whenDefined ? '✓' : '✗'}`,
    ];
    const anyAvailable = d.ce || d.attachShadow || d.shadowRoot;
    const summary = anyAvailable
      ? `Web Components 进阶能力检测：${parts.join(' · ')}。jsdom 中 customElements 已被 mock（define/whenDefined 为 no-op，不真正注册元素），attachShadow 部分支持，Declarative Shadow DOM / attachInternals / customStateSet 多为 stub 或不可用；所有按钮点击均做 try/catch，不可用能力以 <pre> 代码示例与日志说明，不会抛异常。在真实浏览器中可完整演示。`
      : '当前环境不支持 customElements / attachShadow / ShadowRoot（typeof 均为 "undefined"）；所有按钮点击将仅记日志与代码示例说明，不会抛异常。在真实浏览器中打开可完整演示。';
    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!d.attachInternals) this._addLog('warn', 'Element.prototype.attachInternals 不可用（jsdom 通常不支持），form-associated / customStateSet 演示将回退到代码示例');
    if (!d.dsd) this._addLog('warn', 'Declarative Shadow DOM 不可用（HTMLTemplateElement.prototype 无 shadowRootMode），DSD 演示将回退到 polyfill 与代码示例');
    if (!d.getHTML) this._addLog('warn', 'Element.prototype.getHTML 不可用，序列化演示将回退到 outerHTML');
    if (!d.getName) this._addLog('warn', 'customElements.getName 不可用（较新 API，部分浏览器无）');
    if (!d.upgrade) this._addLog('warn', 'customElements.upgrade 不可用（较新 API）');
  }

  componentWillUnmount() {
    // 移除已创建的自定义元素实例引用（customElements.define 不可逆，卸载时不撤销定义）
    this._dsdEl = null; this._formEl = null; this._stateEl = null;
    this._stateInternals = null; this._definedEl = null;
    this._composedEl = null; this._cssPartEl = null;
    if (this._observer) { try { this._observer.disconnect(); } catch { /* noop */ } this._observer = null; }
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 能力检测对象（供按钮 disabled 判定使用）——
  _detected() {
    return {
      ce: typeof customElements !== 'undefined' && typeof customElements.define === 'function',
      attachInternals: typeof Element !== 'undefined' && typeof Element.prototype.attachInternals === 'function',
      attachShadow: typeof Element !== 'undefined' && typeof Element.prototype.attachShadow === 'function',
      dsd: typeof HTMLTemplateElement !== 'undefined' && 'shadowRootMode' in HTMLTemplateElement.prototype,
      getHTML: typeof Element !== 'undefined' && typeof Element.prototype.getHTML === 'function',
      shadowRoot: typeof ShadowRoot !== 'undefined',
      get: typeof customElements !== 'undefined' && typeof customElements.get === 'function',
      getName: typeof customElements !== 'undefined' && typeof customElements.getName === 'function',
      upgrade: typeof customElements !== 'undefined' && typeof customElements.upgrade === 'function',
      whenDefined: typeof customElements !== 'undefined' && typeof customElements.whenDefined === 'function',
    };
  }

  // —— _caps(items)：把能力项渲染为 Tag 组件（items: [{label, ok}, ...]）——
  _caps(items) {
    return items.map((it) => h(Tag, { color: it.ok ? 'success' : 'error' }, `${it.label} ${it.ok ? '✓' : '✗'}`));
  }

  // =================== Card 1：Declarative Shadow DOM ===================

  _checkDSD() {
    const d = this._detected();
    this.setState({ dsdInfo: `Declarative Shadow DOM 能力检测：\n  'shadowRootMode' in HTMLTemplateElement.prototype = ${d.dsd ? 'true（支持）' : 'false（不支持）'}\n  typeof Element.prototype.getHTML = ${d.getHTML ? 'function（可用）' : 'undefined（不可用）'}\n  typeof Element.prototype.attachShadow = ${d.attachShadow ? 'function（可用）' : 'undefined（不可用）'}\n  typeof ShadowRoot = ${d.shadowRoot ? 'function（可用）' : 'undefined（不可用）'}\n\n说明：<template shadowrootmode="open"> 让服务端在 HTML 中声明 Shadow DOM，无需 JS；shadowRootMode 是 DSD 检测特征；element.getHTML({ serializable: true }) 序列化 Shadow DOM 含声明式模板；jsdom 中 DSD 通常不支持，shadowRootMode 不存在；attachShadow 可能为 stub。` });
    this._addLog('dsd', `DSD 检测：shadowRootMode=${d.dsd}, getHTML=${d.getHTML}, attachShadow=${d.attachShadow}`);
  }

  _injectDSD() {
    const d = this._detected();
    const container = this.$('.wc-adv-dsd-host');
    if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
    try {
      container.innerHTML = '';
      const host = document.createElement('div');
      host.className = 'wc-adv-dsd-host-inner';
      host.textContent = '宿主元素';
      container.appendChild(host);
      if (d.dsd) {
        // DSD 支持：真实注入 <template shadowrootmode="open">
        const tpl = document.createElement('template');
        tpl.setAttribute('shadowrootmode', 'open');
        tpl.innerHTML = '<style>:host{display:block;padding:8px;border:2px dashed #1677ff;}</style><p>真实 Declarative Shadow DOM</p>';
        host.appendChild(tpl);
        const sr = host.shadowRoot;
        this._dsdEl = host;
        this.setState({ dsdInfo: `真实注入 Declarative Shadow DOM：\n\n<my-dsd-host>\n  <template shadowrootmode="open">\n    <style>:host{...}</style><p>...</p>\n  </template>\n</my-dsd-host>\n\n解析后 host.shadowRoot = ${sr ? '[object ShadowRoot] ✓' : 'null ✗（jsdom 可能未解析 DSD）'}\nsr.serializable = ${sr && 'serializable' in sr ? sr.serializable : '（不可读）'}\nsr.delegatesFocus = ${sr && 'delegatesFocus' in sr ? sr.delegatesFocus : '（不可读）'}` });
        this._addLog('dsd', `真实注入 DSD：host.shadowRoot = ${sr ? 'ShadowRoot' : 'null'}`);
      } else if (d.attachShadow && typeof host.attachShadow === 'function') {
        // polyfill 思路：attachShadow + template.content
        const tpl = document.createElement('template');
        tpl.innerHTML = '<style>:host{display:block;padding:8px;border:2px dashed #1677ff;}</style><p>Shadow DOM 内部（模拟 DSD）</p>';
        const sr = host.attachShadow({ mode: 'open' });
        sr.appendChild(tpl.content.cloneNode(true));
        this._dsdEl = host;
        this.setState({ dsdInfo: `Declarative Shadow DOM 不可用，已用 polyfill 思路（attachShadow + template.content）模拟：\n\n// polyfill：解析 <template shadowrootmode> 并手动 attachShadow\ndocument.querySelectorAll('template[shadowrootmode]').forEach((t) => {\n  const mode = t.getAttribute('shadowrootmode');\n  const sr = t.parentNode.attachShadow({ mode });\n  sr.appendChild(t.content);\n});\n\n当前环境：host.attachShadow({ mode: 'open' }) → ${sr ? 'ShadowRoot ✓' : 'null ✗'}\nhost.shadowRoot = ${host.shadowRoot ? '[object ShadowRoot]' : 'null'}\n\n说明：真实 DSD 用 <template shadowrootmode="open"> 嵌入 HTML，浏览器解析时自动 attachShadow；polyfill 用 querySelectorAll + 手动 attachShadow 模拟。jsdom 中 attachShadow 可能为 stub。` });
        this._addLog('dsd', '已用 polyfill 思路注入模拟 Shadow DOM（attachShadow + template.content）');
      } else {
        this.setState({ dsdInfo: `attachShadow 也不可用，仅记录 DSD 用法说明：\n\n<!-- 服务端渲染 HTML，无需 JS 即可声明 Shadow DOM -->\n<my-element>\n  <template shadowrootmode="open">\n    <style>:host{...}</style><p>Shadow DOM 内部内容</p>\n  </template>\n</my-element>\n\n// polyfill（旧浏览器）：\ndocument.querySelectorAll('template[shadowrootmode]').forEach((t) => {\n  const sr = t.parentNode.attachShadow({ mode: t.getAttribute('shadowrootmode') });\n  sr.appendChild(t.content);\n});` });
        this._addLog('warn', 'attachShadow 不可用，仅记录 DSD 用法（<template shadowrootmode="open">）');
      }
    } catch (err) {
      this._addLog('warn', `注入 DSD 失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _serializeDSD() {
    const d = this._detected();
    if (!this._dsdEl) { this._addLog('warn', '请先点击「注入 DSD」'); return; }
    try {
      const el = this._dsdEl;
      let serialized = '';
      let method = '';
      if (d.getHTML && typeof el.getHTML === 'function') {
        serialized = el.getHTML({ serializable: true });
        method = 'getHTML({ serializable: true })';
      } else {
        serialized = el.outerHTML;
        method = 'outerHTML（回退，不含 Shadow）';
        this._addLog('warn', 'getHTML 不可用，回退到 outerHTML（不含 Shadow DOM）');
      }
      this.setState({ dsdInfo: `Shadow DOM 序列化（${method}）：\n\ntypeof el.getHTML = ${typeof el.getHTML}\n输出（前 500 字符）：\n${serialized.slice(0, 500)}\n\n说明：\n  - getHTML({ serializable: true }) 序列化 Shadow DOM，含 <template shadowrootmode> 声明式部分\n  - shadowRoot.serializable（boolean）：标记 Shadow Root 是否可序列化\n  - shadowRoot.innerHTML（getter/setter）：直接读写 Shadow 内容\n  - outerHTML 只含 Light DOM，不含 Shadow（需用 getHTML 才能拿到 Shadow 内容）` });
      if (method.startsWith('getHTML')) this._addLog('dsd', `getHTML({ serializable: true }) → ${serialized.length} 字符`);
    } catch (err) {
      this._addLog('warn', `序列化 DSD 失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _showPolyfill() {
    this.setState({ dsdInfo: `Declarative Shadow DOM polyfill 与 SSR 收益：\n\n// 1. polyfill：在旧浏览器解析 <template shadowrootmode>\n(function polyfillDSD() {\n  if ('shadowRootMode' in HTMLTemplateElement.prototype) return; // 原生支持\n  document.querySelectorAll('template[shadowrootmode]').forEach((t) => {\n    const mode = t.getAttribute('shadowrootmode'); // 'open' | 'closed'\n    const sr = t.parentNode.attachShadow({ mode });\n    sr.appendChild(t.content); t.remove();\n  });\n})();\n\n// 2. SSR 收益：无 FOUC（HTML 解析时即含 Shadow DOM 与样式）；无需 JS 即可渲染（禁用 JS 仍可展示）；\n//   流式解析（无需等 customElements.define）；SEO 友好（爬虫拿到完整 Shadow DOM）\n\n// 3. 与 attachShadow 的对应关系：\n//   <template shadowrootmode="open">  ←→  element.attachShadow({ mode: "open" })\n//   <template shadowrootmode="closed"> ←→ element.attachShadow({ mode: "closed" })\n//   shadowrootserializable 属性         ←→ attachShadow({ serializable: true })\n//   shadowrootdelegatesfocus 属性       ←→ attachShadow({ delegatesFocus: true })` });
    this._addLog('dsd', '已显示 DSD polyfill 与 SSR 收益说明');
  }

  _renderCard1() {
    const s = this.state;
    const d = this._detected();
    const card = new Card({
      title: '1. Declarative Shadow DOM 声明式 Shadow DOM',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          { label: 'DSD', ok: d.dsd },
          { label: 'getHTML', ok: d.getHTML },
          { label: 'attachShadow', ok: d.attachShadow },
        ]),
        h(Tag, { color: 'primary' }, 'shadowrootmode'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<template shadowrootmode="open|closed"> 让服务端在 HTML 中声明 Shadow DOM，无需 JS 即可渲染（无 FOUC，禁用 JS 仍可展示）。Element.prototype.attachShadow({ mode }) 是其 JS 等价物。检测：HTMLTemplateElement.prototype 有 shadowRootMode 属性即支持。element.getHTML({ serializable: true }) 序列化 Shadow DOM 含声明式模板；shadowRoot.serializable / delegatesFocus 控制序列化与焦点委托。jsdom 通常不支持 DSD。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkDSD() }),
          this._btn('注入 DSD', { size: 'sm', onClick: () => this._injectDSD() }),
          this._btn('序列化 getHTML', { size: 'sm', disabled: !d.getHTML, onClick: () => this._serializeDSD() }),
          this._btn('polyfill 说明', { size: 'sm', onClick: () => this._showPolyfill() }),
        ),
        h('div', { class: 'wc-adv-dsd-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Declarative Shadow DOM 状态 / 序列化：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.dsdInfo || '（点击「检测能力」或「注入 DSD」开始 DSD 演示）')),
        h(Alert, {
          type: 'info',
          message: 'Declarative Shadow DOM 实现 SSR 友好的 Shadow DOM',
          description: 'DSD 把 Shadow DOM 声明直接嵌入 HTML，浏览器解析时自动构建，无需等 customElements.define，避免 FOUC。shadowrootmode 取代了已废弃的 shadowroot 属性。getHTML({ serializable: true }) 是序列化 Shadow DOM 的官方 API（outerHTML 不含 Shadow）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：formAssociated 与表单集成 ===================

  _checkFormAssociated() {
    const d = this._detected();
    this.setState({ formAssociatedInfo: `formAssociated 能力检测：\n  typeof Element.prototype.attachInternals = ${d.attachInternals ? 'function（可用）' : 'undefined（不可用）'}\n  typeof customElements.define = ${d.ce ? 'function（可用）' : 'undefined（不可用，jsdom mock）'}\n\nElementInternals 接口（form-associated 元素通过 attachInternals() 获取）：\n  .form / .name / .type / .value（get/set）/ .validity（ValidityState）\n  .validationMessage / .willValidate / .labels（NodeList）\n  .setValidity(flags, message, anchor) / .checkValidity() / .reportValidity()\n  .setFormValue(value, state) —— value 提交，state 用于浏览器恢复\n\nform-associated 生命周期回调：\n  formDisabledCallback(disabled)        —— fieldset[disabled] 状态变化\n  formStateRestoreCallback(state, mode) —— mode='restore' | 'autocomplete'\n  formResetCallback()                    —— 表单 reset 时触发` });
    this._addLog('form', `formAssociated 检测：attachInternals=${d.attachInternals}, customElements.define=${d.ce}`);
  }

  _defineFormAssociated() {
    const d = this._detected();
    if (!d.ce) {
      this.setState({ formAssociatedInfo: `form-associated 自定义元素定义用法（customElements 不可用，仅说明）：\n\nclass MyField extends HTMLElement {\n  static formAssociated = true;   // 声明为表单关联元素（等价 static get formAssociated() { return true; }）\n  constructor() { super(); this._internals = this.attachInternals(); }\n  get value() { return this._v || ""; }\n  set value(v) { this._v = v; this._internals.setFormValue(v); }  // 提交给 <form>\n  formDisabledCallback(disabled) { /* fieldset[disabled] 变化 */ }\n  formStateRestoreCallback(state, mode) { /* mode="restore"|"autocomplete" */ }\n  formResetCallback() { this.value = ""; }\n}\ncustomElements.define('my-field', MyField, { formAssociated: true });\n\n关键：static formAssociated 必须为静态 getter 返回 true；attachInternals() 在非 form-associated 元素中调用会抛 NotSupportedError。` });
      this._addLog('warn', 'customElements.define 不可用（jsdom mock），已记录 form-associated 用法说明');
      return;
    }
    try {
      if (typeof customElements.get === 'function' && customElements.get('wc-adv-field')) {
        this._addLog('form', "customElements.get('wc-adv-field') 已存在，跳过定义");
        return;
      }
      const self = this;
      class WcAdvField extends HTMLElement {
        static formAssociated = true;
        constructor() {
          super();
          this._v = '';
          this._internals = null;
          if (typeof this.attachInternals === 'function') {
            this._internals = this.attachInternals();
            self._addLog('form', 'attachInternals() → 返回 ElementInternals');
          } else {
            self._addLog('warn', 'attachInternals 不可用（jsdom 通常不支持）');
          }
        }
        get value() { return this._v; }
        set value(v) {
          this._v = v;
          if (this._internals && typeof this._internals.setFormValue === 'function') {
            this._internals.setFormValue(v);
          }
        }
        formResetCallback() { this.value = ''; }
        formDisabledCallback(_d) { /* noop */ }
        formStateRestoreCallback(_s, _m) { /* noop */ }
      }
      customElements.define('wc-adv-field', WcAdvField, { formAssociated: true });
      this._addLog('form', "customElements.define('wc-adv-field', ..., { formAssociated: true }) ✓");
      this.setState({ formAssociatedInfo: `已定义 form-associated 元素 <wc-adv-field>（jsdom mock 下 define 为 no-op）：\n\nclass WcAdvField extends HTMLElement {\n  static formAssociated = true;          // 静态属性声明表单关联\n  constructor() { super(); this._internals = this.attachInternals(); }\n  get value() { return this._v; }\n  set value(v) { this._v = v; this._internals.setFormValue(v); }\n  formResetCallback() { this.value = ""; }\n  formDisabledCallback(disabled) { /* fieldset[disabled] 变化 */ }\n  formStateRestoreCallback(state, mode) { /* mode="restore"|"autocomplete" */ }\n}\ncustomElements.define('wc-adv-field', WcAdvField, { formAssociated: true });\n\nstatic formAssociated 必须为静态 getter 返回 true；非 form-associated 元素调用 attachInternals() 会抛 NotSupportedError。` });
    } catch (err) {
      this._addLog('warn', `define <wc-adv-field> 失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _setFormValue() {
    const d = this._detected();
    if (!d.attachInternals) {
      this.setState({ formAssociatedInfo: `setFormValue / setValidity 用法（attachInternals 不可用，仅说明）：\n\nconst internals = this.attachInternals();\ninternals.setFormValue("hello");                                     // value 提交给 form\ninternals.setFormValue("hello", { raw:"hello", display:"Hello" });   // state 用于浏览器恢复\ninternals.setValidity({ valueMissing: true }, "请填写此字段", this);  // 设置校验失败\ninternals.setValidity({});                                           // 清除所有错误标记\ninternals.setValidity({ valid: true });                              // 标记有效\nconsole.log(internals.validity.valid, internals.validationMessage, internals.willValidate);\nconsole.log(internals.checkValidity(), internals.reportValidity());   // 触发校验\nconsole.log(internals.form, internals.labels);                       // 父 form / 关联 label` });
      this._addLog('warn', 'attachInternals 不可用，已记录 setFormValue / setValidity 用法说明');
      return;
    }
    if (!this._formEl) { this._addLog('warn', '请先点击「定义 form-associated 元素」'); return; }
    try {
      const el = this._formEl;
      const internals = el._internals;
      if (!internals) { this._addLog('warn', 'ElementInternals 不可用（元素未升级或 attachInternals 未执行）'); return; }
      const newValue = 'value-' + Date.now().toString(36);
      el.value = newValue;
      if (typeof internals.setFormValue === 'function') internals.setFormValue(newValue);
      if (typeof internals.setValidity === 'function') {
        try { internals.setValidity({ valid: true }); } catch { /* jsdom 可能不支持 */ }
      }
      const lines = [];
      if ('willValidate' in internals) lines.push(`internals.willValidate = ${internals.willValidate}`);
      if (internals.validity && 'valid' in internals.validity) lines.push(`internals.validity.valid = ${internals.validity.valid}`);
      if (typeof internals.form !== 'undefined') lines.push(`internals.form = ${internals.form ? '<form>' : 'null'}`);
      this.setState({ formAssociatedInfo: `已设置表单值与校验状态：\n  el.value = '${newValue}'\n  internals.setFormValue('${newValue}')\n  internals.setValidity({ valid: true })\n\n${lines.join('\n')}` });
      this._addLog('form', `setFormValue('${newValue}') + setValidity({ valid: true })`);
    } catch (err) {
      this._addLog('warn', `设置表单值失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const d = this._detected();
    const card = new Card({
      title: '2. formAssociated 与表单集成',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          { label: 'attachInternals', ok: d.attachInternals },
          { label: 'customElements', ok: d.ce },
        ]),
        h(Tag, { color: 'primary' }, 'ElementInternals'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'static formAssociated = true 声明自定义元素为表单关联；this.attachInternals() 返回 ElementInternals，含 .form / .name / .type / .value / .validity / .validationMessage / .willValidate / .setValidity / .checkValidity / .reportValidity / .labels / .setFormValue(value, state)。回调：formDisabledCallback（fieldset[disabled] 变化）、formStateRestoreCallback(state, mode)（mode="restore"|"autocomplete"）。static formAssociated 必须为静态 getter 返回 true。jsdom 中 attachInternals 通常不可用。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkFormAssociated() }),
          this._btn('定义 form-associated', { size: 'sm', disabled: !d.ce, onClick: () => this._defineFormAssociated() }),
          this._btn('设置表单值', { size: 'sm', disabled: !d.attachInternals, onClick: () => this._setFormValue() }),
        ),
        h('div', { class: 'wc-adv-field-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'form-associated / ElementInternals 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.formAssociatedInfo || '（点击「检测能力」或「定义 form-associated 元素」）')),
        h(Alert, {
          type: 'info',
          message: 'form-associated 让自定义元素像原生表单控件一样参与 form 提交',
          description: 'attachInternals() 必须在 formAssociated: true 的元素中调用（否则抛 NotSupportedError）；setFormValue(value, state) 的 value 提交给 FormData，state 用于浏览器恢复；setValidity({ valueMissing: true }, msg, anchor) 设置校验状态，checkValidity / reportValidity 触发校验。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：customStateSet 与 :state() 伪类 ===================

  _checkState() {
    const d = this._detected();
    let statesSupported = false;
    if (d.attachInternals) {
      try {
        const probe = document.createElement('div');
        if (typeof probe.attachInternals === 'function') {
          const internals = probe.attachInternals();
          statesSupported = !!internals && 'states' in internals && typeof internals.states.add === 'function';
        }
      } catch { /* jsdom 可能抛错 */ }
    }
    this.setState({ stateInfo: `customStateSet 能力检测：\n  typeof Element.prototype.attachInternals = ${d.attachInternals ? 'function' : 'undefined'}\n  internals.states 存在 + .add 是函数 = ${statesSupported ? 'true（支持）' : 'false（不支持 / 不可用）'}\n\ncustomStateSet（Set-like）API：\n  internals.states.add('error')      / .delete('error')\n  internals.states.has('error')       / .size / .clear()\n  for (const s of internals.states)  —— 可迭代（Set 风格）\n\nCSS :state() 伪类（自定义状态伪类）：\n  my-el:state(loading) { opacity: 0.5; }   /* 加载中 */\n  my-el:state(error) { color: red; }       /* 出错 */\n  my-el:state(loaded) { color: green; }    /* 加载完成 */\n\n说明：:state() 是自定义元素的 :checked / :disabled 等价物，替代 hacky 的 [data-error] 属性样式化；状态由作者定义，不暴露给外部 JS 读取（只有元素自己能 set）；安全：外部 querySelector 无法读取` });
    this._addLog('state', `customStateSet 检测：attachInternals=${d.attachInternals}, states=${statesSupported}`);
    if (!statesSupported) this._addLog('warn', 'customStateSet 不可用（jsdom 通常不支持），:state() 演示将回退到代码示例');
  }

  _addStates() {
    const d = this._detected();
    if (!d.attachInternals) {
      this.setState({ stateInfo: `customStateSet 操作用法（attachInternals 不可用，仅说明）：\n\nclass MyEl extends HTMLElement {\n  static formAssociated = true; // states 需 form-associated 元素\n  constructor() { super(); this._internals = this.attachInternals(); }\n  set loading(v) { v ? this._internals.states.add('loading') : this._internals.states.delete('loading'); }\n  setError(msg) { this._internals.states.add('error'); this._internals.setValidity({ valueMissing: true }, msg); }\n}\n\n/* 外部 CSS 用 :state() 选择 */\nmy-el:state(loading) { opacity: 0.5; pointer-events: none; }\nmy-el:state(error) { border-color: red; }\nmy-el:state(loaded) { border-color: green; }` });
      this._addLog('warn', 'attachInternals 不可用，已记录 customStateSet 用法说明');
      return;
    }
    try {
      if (!this._stateEl) {
        this._stateEl = document.createElement('div');
        this._stateInternals = this._stateEl.attachInternals();
      }
      const states = this._stateInternals && this._stateInternals.states;
      if (!states || typeof states.add !== 'function') {
        this._addLog('warn', 'internals.states 不可用（CustomStateSet 不支持）');
        return;
      }
      states.add('loading');
      states.add('loaded');
      states.add('error');
      const list = [];
      for (const s of states) list.push(s);
      this.setState({ stateInfo: `已添加状态：states.add('loading' / 'loaded' / 'error')\n\n当前 states.size = ${states.size}\n当前 states 内容：${list.join(', ')}\n\n对应 CSS：my-el:state(loading) { opacity: 0.5; } / :state(loaded) { color: green; } / :state(error) { color: red; }` });
      this._addLog('state', `states.add('loading'/'loaded'/'error')，size=${states.size}`);
    } catch (err) {
      this._addLog('warn', `添加状态失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _toggleState() {
    if (!this._stateInternals || !this._stateInternals.states) {
      this._addLog('warn', '请先点击「添加状态」');
      return;
    }
    try {
      const states = this._stateInternals.states;
      if (states.has('error')) {
        states.delete('error');
        this._addLog('state', "states.delete('error') —— 移除 error 状态");
      } else {
        states.add('error');
        this._addLog('state', "states.add('error') —— 添加 error 状态");
      }
      const list = [];
      for (const s of states) list.push(s);
      this.setState({ stateInfo: `切换 error 状态：states.has('error') = ${states.has('error')}, states.size = ${states.size}\nstates 内容：${list.join(', ')}` });
    } catch (err) {
      this._addLog('warn', `切换状态失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _clearStates() {
    if (!this._stateInternals || !this._stateInternals.states) {
      this._addLog('warn', '请先点击「添加状态」');
      return;
    }
    try {
      this._stateInternals.states.clear();
      this.setState({ stateInfo: `已清空所有状态：states.clear(), states.size = ${this._stateInternals.states.size}` });
      this._addLog('state', 'states.clear() —— 清空所有自定义状态');
    } catch (err) {
      this._addLog('warn', `清空状态失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const d = this._detected();
    const card = new Card({
      title: '3. customStateSet 与 :state() 伪类',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([{ label: 'attachInternals', ok: d.attachInternals }]),
        h(Tag, { color: 'primary' }, ':state()'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'this.attachInternals().states 返回 customStateSet（Set-like）：.add(state) / .delete(state) / .has(state) / .size / .clear() / 可迭代。CSS 用 my-el:state(loading) 选择，是自定义元素的 :checked / :disabled 等价物，替代 hacky 的 [data-error] 属性样式化。状态由作者定义，不暴露给外部 JS 读取（只有元素自己能 set），安全。jsdom 通常不支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkState() }),
          this._btn('添加状态', { size: 'sm', disabled: !d.attachInternals, onClick: () => this._addStates() }),
          this._btn('切换 error', { size: 'sm', disabled: !d.attachInternals, onClick: () => this._toggleState() }),
          this._btn('清空状态', { danger: true, size: 'sm', disabled: !d.attachInternals, onClick: () => this._clearStates() }),
        ),
        h('div', { class: 'wc-adv-state-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'customStateSet / :state() 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.stateInfo || '（点击「检测能力」或「添加状态」开始 :state() 演示）')),
        h(Alert, {
          type: 'info',
          message: ':state() 是自定义元素的状态伪类',
          description: ':state(loading) 类似 :checked，由元素通过 internals.states.add 控制；状态名不带 -- 前缀（旧规范曾要求 -- 前缀，新规范已取消）。安全：states 是 CustomStateSet，外部 querySelector 无法读取，只有元素自己能 set，避免被外部脚本窥探内部状态。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：:defined 伪类与 CustomElementRegistry ===================

  _checkDefined() {
    const d = this._detected();
    this.setState({ definedInfo: `:defined 与 CustomElementRegistry 能力检测：\n  typeof customElements = ${typeof customElements}\n  customElements.define = ${d.ce ? 'function（可用）' : 'no-op mock（jsdom）'}\n  .get = ${d.get ? 'function' : '不可用'} / .getName = ${d.getName ? 'function（较新）' : '不可用'}\n  .upgrade = ${d.upgrade ? 'function' : '不可用'} / .whenDefined = ${d.whenDefined ? 'function' : '不可用'}\n\n:defined 伪类：\n  my-el:not(:defined) { visibility: hidden; }   /* 注册前隐藏，防 FOUC */\n  my-el:defined { visibility: visible; }        /* 注册后显示 */\n\nCustomElementRegistry 方法：\n  .define(name, ctor, { extends: "div" })  —— 注册（extends 指定自定义内置元素基类）\n  .get(name) → constructor                  —— 按名称取构造器\n  .getName(ctor) → name                     —— 按构造器取名称（较新 API）\n  .upgrade(node)                            —— 同步升级节点树（即使未连接）\n  .whenDefined(name) → Promise<ctor>        —— 等待元素定义\n\n自定义内置元素：<div is="my-div"> + define(name, class extends HTMLDivElement, { extends: "div" })\n说明：Safari 曾长期拒绝 is= 语法（要求用 autonomous custom element 替代），现已支持。` });
    this._addLog('defined', `:defined 检测：customElements=${typeof customElements}, get=${d.get}, getName=${d.getName}, upgrade=${d.upgrade}, whenDefined=${d.whenDefined}`);
  }

  _demoIsAttribute() {
    const d = this._detected();
    if (!d.ce) {
      this.setState({ definedInfo: `自定义内置元素（is=）用法（customElements 不可用，仅说明）：\n\n// 1. 定义：extends 指定基类（如 HTMLDivElement）\ncustomElements.define('my-button', class extends HTMLButtonElement {\n  constructor() { super(); this.addEventListener("click", () => alert("自定义按钮")); }\n}, { extends: 'button' });   // 注意第三参 { extends: 'button' }\n\n<!-- 2. 使用：原生标签 + is= 属性 -->\n<button is="my-button">点我</button>\n<div is="my-div"></div>\n\n区别：\n  autonomous: <my-button>（自定义标签名，extends HTMLElement）\n  customized built-in: <button is="my-button">（原生标签 + is=，extends HTMLButtonElement）\n  customized built-in 复用原生语义与无障碍行为，但 Safari 曾长期不支持 is=` });
      this._addLog('warn', 'customElements.define 不可用（jsdom mock），已记录 is= 用法说明');
      return;
    }
    try {
      if (typeof customElements.get === 'function' && customElements.get('wc-adv-div-builtin')) {
        this._addLog('defined', "customElements.get('wc-adv-div-builtin') 已存在，跳过定义");
      } else {
        class WcAdvDiv extends HTMLDivElement { constructor() { super(); } }
        customElements.define('wc-adv-div-builtin', WcAdvDiv, { extends: 'div' });
        this._addLog('defined', "customElements.define('wc-adv-div-builtin', ..., { extends: 'div' }) ✓");
      }
      const container = this.$('.wc-adv-defined-host');
      if (container) {
        container.innerHTML = '';
        const el = document.createElement('div', { is: 'wc-adv-div-builtin' });
        el.textContent = '自定义内置元素 <div is="wc-adv-div-builtin">';
        container.appendChild(el);
        this._definedEl = el;
        let definedMatch = '（无法检测）';
        try {
          if (typeof el.matches === 'function') definedMatch = el.matches(':defined') ? 'true（已定义）' : 'false（未定义）';
        } catch { /* :defined 在 jsdom 可能不支持 */ }
        this.setState({ definedInfo: `已定义自定义内置元素 <div is="wc-adv-div-builtin">：\n\ncustomElements.define('wc-adv-div-builtin', class extends HTMLDivElement {}, { extends: 'div' });\ndocument.createElement("div", { is: "wc-adv-div-builtin" })  ← 注意第二参 { is: ... }\n\nelement.matches(":defined") = ${definedMatch}\n（jsdom mock 下 define 为 no-op，元素未真正升级，:defined 可能返回 false）` });
        this._addLog('defined', `自定义内置元素 <div is="wc-adv-div-builtin">：matches(':defined')=${definedMatch}`);
      }
    } catch (err) {
      this._addLog('warn', `is= 演示失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _demoUpgrade() {
    const d = this._detected();
    if (!d.upgrade) {
      this.setState({ definedInfo: `customElements.upgrade 用法（不可用，仅说明）：\n\nconst el = document.createElement('my-el');\nconsole.log(el.constructor); // HTMLElement（升级前）\n\ncustomElements.define('my-el', class extends HTMLElement { /* ... */ });\ncustomElements.upgrade(el);  // ← 同步升级（即使未插入 DOM）\nconsole.log(el.constructor); // MyEl（升级后）\n\n区别：connectedCallback 仅在插入 DOM 时触发（异步）；upgrade(node) 立即升级（同步）\n\ncustomElements.whenDefined('my-el').then((Ctor) => { console.log('已定义', Ctor); }); // Promise（异步）` });
      this._addLog('warn', 'customElements.upgrade 不可用，已记录 upgrade / whenDefined 用法说明');
      return;
    }
    try {
      const el = document.createElement('div');
      const beforeCtor = el.constructor.name;
      if (typeof customElements.upgrade === 'function') customElements.upgrade(el);
      const afterCtor = el.constructor.name;
      this.setState({ definedInfo: `customElements.upgrade 演示：\n  document.createElement("div") → el\n  el.constructor.name（升级前）= ${beforeCtor}\n  customElements.upgrade(el)\n  el.constructor.name（升级后）= ${afterCtor}\n\n说明：upgrade 同步升级节点树（含子节点），即使未连接到 DOM。` });
      this._addLog('defined', `upgrade 演示：constructor ${beforeCtor} → ${afterCtor}`);
    } catch (err) {
      this._addLog('warn', `upgrade 演示失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const d = this._detected();
    const card = new Card({
      title: '4. :defined 伪类与 CustomElementRegistry',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          { label: 'customElements', ok: d.ce },
          { label: 'upgrade', ok: d.upgrade },
          { label: 'getName', ok: d.getName },
        ]),
        h(Tag, { color: 'primary' }, 'is= / :defined'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          ':defined 伪类匹配已注册定义的自定义元素（注册前用 :not(:defined) 隐藏防 FOUC）。CustomElementRegistry：.define(name, ctor, { extends }) 注册（extends 指定自定义内置元素基类）、.get(name) 按名取构造器、.getName(ctor) 按构造器取名（较新）、.upgrade(node) 同步升级未连接节点、.whenDefined(name) → Promise。自定义内置元素：<div is="my-div"> + define({ extends: "div" })。Safari 曾长期拒绝 is=（现已支持）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkDefined() }),
          this._btn('is= 自定义内置元素', { size: 'sm', disabled: !d.ce, onClick: () => this._demoIsAttribute() }),
          this._btn('upgrade 演示', { size: 'sm', disabled: !d.upgrade, onClick: () => this._demoUpgrade() }),
        ),
        h('div', { class: 'wc-adv-defined-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, ':defined / CustomElementRegistry 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.definedInfo || '（点击「检测能力」或「is= 自定义内置元素」）')),
        h(Alert, {
          type: 'info',
          message: ':defined 是防自定义元素 FOUC 的官方机制',
          description: 'my-el:not(:defined) { visibility: hidden; } 让元素在 customElements.define 注册前隐藏，避免显示未升级的原始 Light DOM；注册后 :defined 自动显示。upgrade(node) 与 whenDefined(name) 的区别：upgrade 同步升级单节点树，whenDefined 异步等待定义（返回 Promise）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Shadow DOM 事件重定向与 composedPath ===================

  _checkComposed() {
    const d = this._detected();
    this.setState({ composedInfo: `Shadow DOM 事件能力检测：\n  typeof Element.prototype.attachShadow = ${d.attachShadow ? 'function（可用）' : 'undefined'}\n  typeof ShadowRoot = ${d.shadowRoot ? 'function（可用）' : 'undefined'}\n  typeof CustomEvent = ${typeof CustomEvent}\n\nShadow DOM 事件规则：\n  1. 默认 custom event 不跨 Shadow 边界（停在 shadow root）\n  2. composed: true 让事件跨 Shadow 边界冒泡到主文档\n  3. event.composedPath() 返回完整路径（含 Shadow 内节点，从 target 到 window）\n  4. event.target 在跨边界时被重定向为 shadow host（不是内部节点）\n  5. event.composed（boolean）：是否可跨边界\n  6. slotchange 事件：<slot> 分发内容变化时触发\n  7. event.getRelatedTarget()（focus/mouse 跨边界时的相关目标）\n\n用法：const ev = new CustomEvent('my-event', { bubbles: true, composed: true });\n  shadowInner.dispatchEvent(ev);  // 从 Shadow 内部分发\n  // 外部监听：host.addEventListener("my-event", (e) => { e.composedPath(); e.target; })` });
    this._addLog('composed', `事件检测：attachShadow=${d.attachShadow}, ShadowRoot=${d.shadowRoot}, CustomEvent=${typeof CustomEvent}`);
  }

  _dispatchComposed() {
    const d = this._detected();
    if (!d.attachShadow || typeof CustomEvent === 'undefined') {
      this.setState({ composedInfo: `composed 事件分发用法（不可用，仅说明）：\n\nclass MyHost extends HTMLElement {\n  constructor() {\n    super();\n    const sr = this.attachShadow({ mode: 'open' });\n    sr.innerHTML = '<button id="inner">内部按钮</button>';\n    sr.querySelector('#inner').addEventListener('click', () => {\n      const ev = new CustomEvent('inner-action', { bubbles: true, composed: true, detail: { from: 'shadow' } });\n      this.dispatchEvent(ev); // 从内部节点分发\n    });\n  }\n}\n\nhost.addEventListener('inner-action', (e) => {\n  console.log(e.composed);          // true\n  console.log(e.target);            // 重定向为 host（不是内部 button）\n  console.log(e.composedPath());    // [button, shadow-root, host, body, html, document, window]\n  console.log(e.detail.from);       // "shadow"\n});` });
      this._addLog('warn', 'attachShadow / CustomEvent 不可用，已记录 composed 事件用法');
      return;
    }
    try {
      const container = this.$('.wc-adv-composed-host');
      if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
      container.innerHTML = '';
      const host = document.createElement('div');
      host.className = 'wc-adv-composed-host-inner';
      const sr = host.attachShadow({ mode: 'open' });
      sr.innerHTML = '<button id="inner-btn">Shadow 内部按钮</button>';
      const innerBtn = sr.querySelector('#inner-btn');
      let receivedCount = 0;
      host.addEventListener('inner-action', (e) => {
        receivedCount += 1;
        let pathInfo = '（不可读）';
        let targetInfo = '（不可读）';
        try { pathInfo = e.composedPath ? e.composedPath().map((n) => n.nodeName || String(n)).join(' → ') : '（无 composedPath）'; } catch { /* noop */ }
        try { targetInfo = e.target ? (e.target.nodeName || String(e.target)) : 'null'; } catch { /* noop */ }
        this._addLog('composed', `host 收到 inner-action 第 ${receivedCount} 条：composed=${e.composed}，target=${targetInfo}，path=${pathInfo}`);
      });
      if (innerBtn && typeof innerBtn.addEventListener === 'function') {
        innerBtn.addEventListener('click', () => {
          const ev = new CustomEvent('inner-action', { bubbles: true, composed: true, detail: { from: 'shadow' } });
          innerBtn.dispatchEvent(ev);
        });
      }
      container.appendChild(host);
      this._composedEl = host;
      this.setState({ composedInfo: `已创建 Shadow DOM 含内部按钮，绑定 composed 事件分发：\n\n  host.attachShadow({ mode: "open" }) → sr\n  sr.innerHTML = '<button id="inner-btn">...</button>'\n  innerBtn.addEventListener("click", () => {\n    const ev = new CustomEvent("inner-action", { bubbles: true, composed: true, detail: { from: "shadow" } });\n    innerBtn.dispatchEvent(ev);\n  });\n  host.addEventListener("inner-action", (e) => { /* 接收，记录 composedPath / target */ });\n\n点击 Shadow 内部按钮（如可点击）将触发 composed 事件，host 收到后记录 composedPath / target。` });
      this._addLog('composed', '已创建 Shadow DOM + 绑定 composed 事件分发');
    } catch (err) {
      this._addLog('warn', `composed 事件演示失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _showComposedPath() {
    this.setState({ composedInfo: `composedPath 与事件重定向说明：\n\nevent.composedPath() 返回事件传播的完整路径（数组，从 target 到 window）：\n  - 含 Shadow DOM 内部节点（如 [button, #shadow-root, host, body, html, document, window]）\n  - 普通事件（无 composed）的 composedPath 在 Shadow 边界处截断\n  - composed: true 的事件路径完整跨越 Shadow 边界\n\nevent.target 重定向：事件在 Shadow 内部分发时 target 是内部节点；跨越 Shadow 边界后，\n  外部监听器看到的 target 被重定向为 shadow host（Shadow DOM 封装的体现：外部不应感知内部实现）\n\nevent.composed（boolean）：true 时事件可跨 Shadow 边界（如 focus、click、CustomEvent composed:true）；\n  false 时事件停在 Shadow root（大多数 custom event 默认）\n\nslotchange 事件：<slot> 元素专属，分发内容变化时触发；slot.addEventListener("slotchange", ...)\n\nevent.getRelatedTarget()（focus/mouse 跨边界）：focus/blur/mouseenter/mouseleave 跨 Shadow 边界时，\n  relatedTarget 跨边界会被重定向为 null（防泄露内部节点）` });
    this._addLog('composed', '已显示 composedPath / target 重定向 / slotchange / getRelatedTarget 说明');
  }

  _renderCard5() {
    const s = this.state;
    const d = this._detected();
    const card = new Card({
      title: '5. Shadow DOM 事件重定向与 composedPath',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          { label: 'attachShadow', ok: d.attachShadow },
          { label: 'ShadowRoot', ok: d.shadowRoot },
        ]),
        h(Tag, { color: 'primary' }, 'composed / composedPath'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Shadow DOM 内事件默认不跨边界；new CustomEvent(name, { composed: true }) 让事件跨 Shadow 边界冒泡。event.composedPath() 返回完整路径（含 Shadow 节点，从 target 到 window）；event.target 跨边界时被重定向为 shadow host（不是内部节点）；event.composed（boolean）标记是否可跨边界。slotchange 在 <slot> 分发内容变化时触发；getRelatedTarget() 在 focus/mouse 跨边界时返回相关目标（防泄露内部节点）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkComposed() }),
          this._btn('分发 composed 事件', { size: 'sm', disabled: !d.attachShadow, onClick: () => this._dispatchComposed() }),
          this._btn('composedPath 说明', { size: 'sm', onClick: () => this._showComposedPath() }),
        ),
        h('div', { class: 'wc-adv-composed-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Shadow DOM 事件 / composedPath 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.composedInfo || '（点击「检测能力」或「分发 composed 事件」）')),
        h(Alert, {
          type: 'info',
          message: 'composed: true 是让事件跨 Shadow 边界的关键',
          description: 'Shadow DOM 的封装特性要求事件默认不外泄；composed: true 让 CustomEvent 跨边界冒泡（如 click、focus 等原生事件天然 composed）。composedPath() 在事件处理器中调用可拿到完整路径；target 重定向保护内部节点不被外部直接访问。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：CSS 自定义属性穿透与 ::part() ===================

  _checkCssPart() {
    const d = this._detected();
    this.setState({ cssPartInfo: `CSS 自定义属性穿透与 ::part() 能力检测：\n  typeof Element.prototype.attachShadow = ${d.attachShadow ? 'function（可用）' : 'undefined'}\n  typeof ShadowRoot = ${d.shadowRoot ? 'function（可用）' : 'undefined'}\n  typeof CSSStyleSheet = ${typeof CSSStyleSheet}\n\n【CSS 自定义属性穿透】—— 继承机制：\n  :host { --main-color: #1677ff; }   /* 宿主上设置 */\n  .inner { color: var(--main-color); } /* Shadow 内部读取（继承穿透） */\n  ★ 自定义属性（--var）通过继承穿透 Shadow DOM，普通属性不穿透\n\n【:host 选择器族】：:host / :host(.active) / :host([disabled]) / :host-context(.dark)（祖先匹配，部分浏览器支持）\n\n【::part() 外部样式化】：<div part="title"> + my-el::part(title) { color: red; } / my-el::part(title):hover { ... }\n\n【exportparts 转发嵌套 part】：<my-inner exportparts="title: inner-title"> → my-outer::part(inner-title)\n\n【::slotted(*)】::slotted(span) { color: orange; } 样式化被 slot 分发的 Light DOM 节点\n\n穿透规则总结：\n  ✓ 穿透：CSS 自定义属性（--var，继承）、inherit 属性（color/font-family）\n  ✗ 不穿透：普通 CSS 属性、class/id/元素选择器（除 ::part）` });
    this._addLog('css', `CSS / ::part 检测：attachShadow=${d.attachShadow}, ShadowRoot=${d.shadowRoot}`);
  }

  _injectPartStyle() {
    const d = this._detected();
    if (!d.attachShadow) {
      this.setState({ cssPartInfo: `::part() / :host-context() 用法（attachShadow 不可用，仅说明）：\n\nclass MyEl extends HTMLElement {\n  constructor() {\n    super();\n    const sr = this.attachShadow({ mode: 'open' });\n    sr.innerHTML = \`\n      <style>:host { --main-color: #1677ff; } :host(.active) { border-color: red; } :host-context(.dark) { background:#1f1f1f; } .title { color: var(--main-color); }</style>\n      <div class="title" part="title">标题</div><div part="body">内容</div>\`;\n  }\n}\n\n/* 外部 CSS 穿透 ::part() */\nmy-el::part(title) { font-weight: bold; color: purple; }\nmy-el::part(body) { font-style: italic; }\nmy-el::part(title):hover { text-decoration: underline; }\n\n/* exportparts 转发嵌套 Shadow 的 part */\n<my-outer><template shadowrootmode="open"><my-inner exportparts="title: inner-title"></template></my-outer>\nmy-outer::part(inner-title) { color: blue; }` });
      this._addLog('warn', 'attachShadow 不可用，已记录 ::part() / :host-context() 用法说明');
      return;
    }
    try {
      const container = this.$('.wc-adv-css-host');
      if (!container) { this._addLog('warn', '找不到挂载容器'); return; }
      container.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'wc-adv-css-part-el';
      const sr = el.attachShadow({ mode: 'open' });
      sr.innerHTML =
        '<style>:host{display:block;--main-color:#1677ff;padding:8px;border:1px solid #d9d9d9;}:host(.active){border-color:red;}:host-context(.dark){background:#1f1f1f;color:white;}.title{color:var(--main-color);font-weight:bold;}</style>' +
        '<div class="title" part="title">part=title 的元素</div><div part="body">part=body 的元素</div>';
      container.appendChild(el);
      const style = document.createElement('style');
      style.textContent =
        '.wc-adv-css-part-el::part(title){color:#722ed1;font-weight:bold;border-left:4px solid #722ed1;padding-left:6px;}' +
        '.wc-adv-css-part-el::part(body){color:#fa541c;font-style:italic;}' +
        '.wc-adv-css-part-el::part(title):hover{background:#f9f0ff;}';
      container.appendChild(style);
      this._cssPartEl = el;
      this.setState({ cssPartInfo: `已创建 Shadow DOM + 注入外部 ::part() 样式：\n\n/* Shadow 内部 */\n:host { --main-color: #1677ff; }\n:host(.active) { border-color: red; }\n:host-context(.dark) { background: #1f1f1f; }\n<div part="title">...</div><div part="body">...</div>\n\n/* 外部 CSS 穿透 ::part() */\n.wc-adv-css-part-el::part(title) { color: #722ed1; ... }\n.wc-adv-css-part-el::part(body) { color: #fa541c; font-style: italic; }\n.wc-adv-css-part-el::part(title):hover { background: #f9f0ff; }\n\n说明：::part() 是穿透 Shadow 样式隔离的唯一官方机制（除继承的 CSS 变量）；part 属性需在 Shadow 内部元素声明；可叠加 :hover 等伪类。` });
      this._addLog('css', '已注入 Shadow DOM + 外部 <style> 用 ::part(title) / ::part(body) 设置样式');
    } catch (err) {
      this._addLog('warn', `::part 注入失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _demoCustomProp() {
    this.setState({ cssPartInfo: `CSS 自定义属性穿透与 ::part() 穿透规则：\n\n【穿透 Shadow DOM（继承机制）】\n  ✓ CSS 自定义属性（--main-color、--spacing 等）：通过继承穿透 Shadow\n  ✓ inherit 属性（color、font-family、font-size、line-height、direction 等）\n  ✓ CSS 变量在 :host 设置，Shadow 内部 var() 读取；adoptedStyleSheets 注入的样式也遵循\n\n【不穿透 Shadow DOM】\n  ✗ 普通 CSS 属性（width、border、background 等）：Shadow 隔离\n  ✗ class / id / 元素选择器：不影响 Shadow 内部\n\n【样式化 Shadow 内部的官方机制】\n  1. ::part(name) —— 外部用 ::part() 样式化 part="name" 的内部元素（唯一穿透方式）\n  2. ::slotted(*) —— Shadow 内部样式化被 slot 分发的 Light DOM 节点\n  3. CSS 变量 —— 宿主设置 :host { --var: value; }，内部 var(--var) 读取\n  4. adoptedStyleSheets —— 共享 Constructable Stylesheet\n\n【:host-context() 兼容性】Chromium 系支持，Firefox / Safari 部分支持或未实现；\n  替代方案：宿主 class 切换（host.classList.toggle("dark")）` });
    this._addLog('css', '已显示 CSS 自定义属性穿透与 ::part() 穿透规则说明');
  }

  _aggregateDetect() {
    const d = this._detected();
    const items = [
      { label: 'Declarative Shadow DOM', ok: d.dsd },
      { label: 'formAssociated (attachInternals)', ok: d.attachInternals },
      { label: 'customStateSet', ok: false }, // 需运行时检测，默认 false
      { label: ':defined', ok: typeof document !== 'undefined' && typeof document.createElement === 'function' },
      { label: 'is= (customized built-in)', ok: d.ce },
      { label: 'composedPath', ok: typeof CustomEvent !== 'undefined' },
      { label: '::part()', ok: d.attachShadow },
    ];
    const lines = items.map((it) => `${it.label}：${it.ok ? '✓ 支持' : '✗ 不支持 / 不可用'}`);
    this.setState({ cssPartInfo: `===== Web Components 进阶特性 聚合能力检测 =====\n\n${lines.join('\n')}\n\n说明：\n  - Declarative Shadow DOM：HTMLTemplateElement.prototype.shadowRootMode 属性\n  - formAssociated：Element.prototype.attachInternals 方法\n  - customStateSet：internals.states 存在 + .add 是函数（需 attachInternals 后检测）\n  - :defined：document.createElement + matches(":defined")\n  - is=：customElements.define + extends 选项\n  - composedPath：CustomEvent 构造器（事件 API）\n  - ::part()：attachShadow（Shadow DOM 支持）\n\njsdom 中 customElements 已被 mock（define/whenDefined no-op），attachShadow 部分支持，\nattachInternals / Declarative Shadow DOM / customStateSet 多为 stub 或不可用。\n所有特性在真实浏览器（Chrome 111+ / Firefox 118+ / Safari 16.4+）可完整演示。` });
    this._addLog('css', `聚合能力检测：${items.filter((it) => it.ok).length}/${items.length} 项支持`);
  }

  _renderCard6() {
    const s = this.state;
    const d = this._detected();
    const card = new Card({
      title: '6. CSS 自定义属性穿透与 ::part()',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          { label: 'attachShadow', ok: d.attachShadow },
          { label: 'ShadowRoot', ok: d.shadowRoot },
        ]),
        h(Tag, { color: 'primary' }, '::part / :host-context'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS 自定义属性（--var）通过继承穿透 Shadow DOM（在 :host 设置，内部 var() 读取）。:host 选择宿主；:host(.class) 匹配带类宿主；:host-context(.dark) 祖先匹配。::part(name) 外部样式化 part="name" 的内部元素（唯一穿透方式，除继承变量）；::part(name):hover 可叠加伪类。exportparts 转发嵌套 Shadow 的 part。::slotted(*) 样式化被分发节点。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkCssPart() }),
          this._btn('注入 ::part 样式', { size: 'sm', disabled: !d.attachShadow, onClick: () => this._injectPartStyle() }),
          this._btn('自定义属性穿透', { size: 'sm', onClick: () => this._demoCustomProp() }),
          this._btn('聚合能力检测', { type: 'primary', size: 'sm', onClick: () => this._aggregateDetect() }),
        ),
        h('div', { class: 'wc-adv-css-host mt-sm' }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'CSS 穿透与 ::part() 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.cssPartInfo || '（点击「检测能力」或「注入 ::part 样式」）')),
        h(Alert, {
          type: 'info',
          message: '::part() 与 CSS 变量是穿透 Shadow DOM 样式隔离的两大官方机制',
          description: '::part(name) 外部样式化 part="name" 的内部元素（唯一穿透方式）；CSS 自定义属性通过继承穿透（在 :host 设置，内部 var() 读取）。exportparts 转发嵌套 Shadow 的 part 给外层；:host-context() 上下文匹配兼容性较差，替代方案是宿主 class 切换。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page web-components-advanced-page' },
      h('h2', { class: 'section-title' }, 'Web Components 高级特性 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '深入 Declarative Shadow DOM、formAssociated 表单集成、customStateSet :state() 伪类、:defined 与 CustomElementRegistry、Shadow DOM 事件 composedPath、CSS 自定义属性穿透与 ::part()。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
