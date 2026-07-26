// =====================================================================
// ModernDOMPage.js —— 现代平台 DOM 能力实验室
// 演示 MDN：
//   1. HTMLDialogElement —— showModal / show / close(returnValue) /
//      close & cancel 事件 / returnValue 属性 / ::backdrop 伪元素
//   2. Popover API —— popover 属性(auto/manual) / showPopover / hidePopover /
//      togglePopover / beforetoggle & toggle 事件 / ::backdrop
//   3. View Transitions API —— document.startViewTransition(callback) /
//      transition.ready / transition.finished / transition.updateCallbackDone /
//      ViewTransition.types / ::view-transition-* 伪元素
//   4. CSS @property —— CSS.registerProperty({name,syntax,inherits,initialValue}) /
//      @property at-rule / 类型化 vs 非类型化自定义属性过渡差异
//   5. Container Queries —— container-type / container-name / container /
//      @container at-rule / ResizeObserver 思路
//   6. CSS Anchor Positioning + Declarative Shadow DOM ——
//      anchor-name / position-anchor / position-try-fallbacks / anchor() 函数 /
//      <template shadowrootmode="open"> 声明式 Shadow DOM
// =====================================================================

import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ModernDOMPage extends Page {
  initialState() {
    return {
      logs: [],
      // —— 能力检测结果 ——
      dialogSupported: false,
      popoverSupported: false,
      vtSupported: false,
      registerPropertySupported: false,
      containerQuerySupported: false,
      anchorSupported: false,
      dsdSupported: false,
      // —— 演示状态 ——
      vtView: 'A',             // View Transitions 切换的视图标识
      vtTypesEnabled: false,   // 是否启用 ViewTransition.types
      containerWidth: 320,     // Container Queries 演示容器宽度
      typedColor: '#1677ff',   // 类型化自定义属性当前颜色
      untypedColor: '#1677ff', // 非类型化自定义属性当前颜色
      dialogReturnValue: '',   // dialog 关闭后的 returnValue
      dsdReady: false,         // 声明式 Shadow DOM 是否已渲染
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（全部用 typeof/in + try/catch，避免 jsdom 抛异常）——
    const dialogSupported = typeof HTMLDialogElement !== 'undefined'
      && typeof HTMLDialogElement.prototype.showModal === 'function';
    const popoverSupported = typeof HTMLElement !== 'undefined'
      && typeof HTMLElement.prototype.showPopover === 'function';
    const vtSupported = typeof document !== 'undefined'
      && typeof document.startViewTransition === 'function';
    const registerPropertySupported = typeof CSS !== 'undefined'
      && typeof CSS.registerProperty === 'function';
    const containerQuerySupported = (() => {
      try { return typeof CSS !== 'undefined' && CSS.supports('container-type', 'inline-size'); }
      catch { return false; }
    })();
    const anchorSupported = (() => {
      try { return typeof CSS !== 'undefined' && CSS.supports('position-anchor', '--x'); }
      catch { return false; }
    })();
    // Declarative Shadow DOM：检测 <template shadowrootmode> 解析后是否自动建立 shadowRoot
    const dsdSupported = (() => {
      try {
        const probe = document.createElement('div');
        probe.innerHTML = '<template shadowrootmode="open"><i></i></template>';
        return !!probe.shadowRoot;
      } catch { return false; }
    })();

    // —— 尝试注册类型化自定义属性 @property ——
    let propLog;
    if (registerPropertySupported) {
      try {
        CSS.registerProperty({
          name: '--typed-color',
          syntax: '<color>',
          inherits: false,
          initialValue: '#1677ff',
        });
        propLog = { type: 'info', content: 'CSS.registerProperty 成功注册 --typed-color (syntax: <color>, initialValue: #1677ff)' };
      } catch (err) {
        propLog = { type: 'error', content: `CSS.registerProperty 失败: ${err.message}` };
      }
    } else {
      propLog = { type: 'error', content: '当前环境不支持 CSS.registerProperty（jsdom 或旧浏览器）' };
    }

    const summary = `特性检测 → dialog=${dialogSupported}, popover=${popoverSupported}, `
      + `viewTransition=${vtSupported}, registerProperty=${registerPropertySupported}, `
      + `containerQuery=${containerQuerySupported}, anchor=${anchorSupported}, dsd=${dsdSupported}`;

    // —— 单次 setState：写入能力检测结果 + 初始日志，避免多次 rerender ——
    this.setState({
      dialogSupported,
      popoverSupported,
      vtSupported,
      registerPropertySupported,
      containerQuerySupported,
      anchorSupported,
      dsdSupported,
      logs: [
        ...this.state.logs,
        { type: 'info', content: summary, time: formatTime() },
        { ...propLog, time: formatTime() },
      ].slice(-40),
    });

    // —— 注入演示 CSS（仅一次；style 元素在 <head> 中，rerender 不会移除）——
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    // 清理：移除注入的 style 元素，关闭可能打开的 dialog/popover
    this._demoStyleEl?.remove();
    const dialog = this.$('#demo-dialog');
    if (dialog && typeof dialog.close === 'function') {
      try { dialog.close(); } catch { /* noop */ }
    }
    const popover = this.$('#demo-popover');
    if (popover && typeof popover.hidePopover === 'function') {
      try { popover.hidePopover(); } catch { /* noop */ }
    }
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 动态注入演示样式：dialog/popover backdrop、View Transitions、
  //    Container Queries、@property 类型化过渡、Anchor Positioning、DSD ——
  _injectDemoStyles() {
    if (this._demoStyleEl) this._demoStyleEl.remove();
    const style = document.createElement('style');
    style.id = 'modern-dom-demo-style';
    style.textContent = `
      /* <dialog> ::backdrop */
      #demo-dialog { border: 1px solid var(--color-border); border-radius: var(--radius-base);
        padding: var(--spacing-md); background: var(--color-bg-elevated); color: var(--color-text); max-width: 360px; }
      #demo-dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
      /* popover ::backdrop */
      #demo-popover { border: 1px solid var(--color-border); border-radius: var(--radius-base);
        padding: var(--spacing-md); background: var(--color-bg-elevated); color: var(--color-text); max-width: 280px; }
      #demo-popover::backdrop { background: rgba(0, 0, 0, 0.25); }
      /* View Transitions */
      #vt-view-box { view-transition-name: vt-view-box; }
      ::view-transition-old(vt-view-box), ::view-transition-new(vt-view-box) { animation-duration: 0.5s; }
      ::view-transition-group.custom-vt { animation-duration: 0.6s; }
      /* Container Queries */
      .cq-demo { container-type: inline-size; container-name: cqdemo; border: 1px dashed var(--color-border);
        border-radius: var(--radius-base); padding: var(--spacing-md); background: var(--color-bg-spotlight);
        transition: width 0.15s ease; }
      .cq-grid { display: grid; gap: var(--spacing-sm); }
      .cq-card { padding: var(--spacing-sm); border-radius: var(--radius-base);
        font-size: var(--font-size-sm); text-align: center; color: #fff; }
      @container cqdemo (max-width: 349px) { .cq-grid { grid-template-columns: 1fr; } .cq-card { background: var(--color-primary); } }
      @container cqdemo (min-width: 350px) and (max-width: 499px) { .cq-grid { grid-template-columns: 1fr 1fr; } .cq-card { background: var(--color-success); } }
      @container cqdemo (min-width: 500px) { .cq-grid { grid-template-columns: 1fr 1fr 1fr; } .cq-card { background: var(--color-warning); } }
      /* CSS @property 类型化 vs 非类型化 */
      .typed-box { background: var(--typed-color, #1677ff); transition: --typed-color 0.6s ease, background 0.6s ease;
        width: 80px; height: 80px; border-radius: var(--radius-base); }
      .untyped-box { background: var(--untyped-color, #1677ff); transition: background 0.6s ease;
        width: 80px; height: 80px; border-radius: var(--radius-base); }
      /* CSS Anchor Positioning */
      .anchor-btn { anchor-name: --anchor-demo; }
      .anchor-tooltip { position-anchor: --anchor-demo; position: absolute; position-try-fallbacks: flip-block;
        top: anchor(bottom); left: anchor(center); margin-top: 8px; transform: translateX(-50%);
        padding: 6px 10px; background: rgba(0, 0, 0, 0.75); color: #fff;
        border-radius: var(--radius-sm); font-size: var(--font-size-sm); white-space: nowrap; }
      /* Declarative Shadow DOM 宿主 */
      .dsd-host { display: inline-block; padding: var(--spacing-sm); border: 1px dashed var(--color-border);
        border-radius: var(--radius-base); min-height: 40px; min-width: 200px; }
    `;
    document.head.appendChild(style);
    this._demoStyleEl = style;
  }

  // ============================================================
  // Card 1: <dialog> 元素
  // ============================================================

  // 先 _addLog 触发 rerender，再在新元素上调用 showModal，避免 rerender 关闭已打开的 dialog
  _showModal() {
    this._addLog('info', '调用 dialog.showModal() —— 模态打开（显示 ::backdrop，阻塞背景）');
    const dialog = this.$('#demo-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') {
      this._addLog('error', '当前环境不支持 dialog.showModal()');
      return;
    }
    try {
      dialog.showModal();
    } catch (err) {
      setTimeout(() => this._addLog('error', `showModal 失败: ${err.message}`), 0);
    }
  }

  _showNonModal() {
    this._addLog('info', '调用 dialog.show() —— 非模态打开（无 ::backdrop，不阻塞）');
    const dialog = this.$('#demo-dialog');
    if (!dialog || typeof dialog.show !== 'function') {
      this._addLog('error', '当前环境不支持 dialog.show()');
      return;
    }
    try {
      dialog.show();
    } catch (err) {
      setTimeout(() => this._addLog('error', `show 失败: ${err.message}`), 0);
    }
  }

  _closeDialog(value) {
    const dialog = this.$('#demo-dialog');
    if (!dialog || typeof dialog.close !== 'function') {
      this._addLog('error', '当前环境不支持 dialog.close()');
      return;
    }
    const wasOpen = !!dialog.open;
    try {
      dialog.close(value);
    } catch (err) {
      this._addLog('error', `close 失败: ${err.message}`);
      return;
    }
    // close 事件的 onClose 回调会记录 returnValue；此处记录调用动作
    this._addLog('info', `dialog.close("${value}") 已调用（${wasOpen ? 'dialog 已打开，等待 close 事件' : 'dialog 未打开，无 close 事件'}）`);
  }

  _renderDialogCard() {
    const s = this.state;
    return h(Card, {
      title: '1. <dialog> 元素（HTMLDialogElement）',
      extra: h(Tag, { color: s.dialogSupported ? 'success' : 'error' },
        s.dialogSupported ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '<dialog> 是原生模态元素。showModal() 模态打开（显示 ::backdrop 遮罩、阻塞背景交互、Esc 触发 cancel）；show() 非模态打开；close(returnValue) 关闭并传回返回值。监听 close / cancel 事件。'),
      !s.dialogSupported && h(Alert, {
        type: 'warning',
        message: '当前环境不支持 <dialog>',
        description: 'jsdom 不实现 HTMLDialogElement；Chrome 37+ / Firefox 98+ / Safari 15.4+ 均已支持。',
      }),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn('showModal()', { type: 'primary', size: 'sm', onClick: () => this._showModal() }),
        this._btn('show() 非模态', { size: 'sm', onClick: () => this._showNonModal() }),
        this._btn('close("ok")', { size: 'sm', onClick: () => this._closeDialog('ok') }),
        this._btn('close("cancel")', { danger: true, size: 'sm', onClick: () => this._closeDialog('cancel') }),
      ),
      h('div', { class: 'fs-sm text-tertiary mt-sm' },
        `当前 returnValue: "${s.dialogReturnValue || '(空)'}" —— 按 Esc 触发 cancel 事件（默认会关闭 dialog）。`),
      // dialog 元素：close/cancel 事件通过 h() 的 onClose/onCancel 绑定，
      // 每次 rerender 自动重建监听；close 事件延迟记录以避免干扰默认关闭流程
      h('dialog', {
        id: 'demo-dialog',
        onClose: (e) => {
          const rv = (e.target && e.target.returnValue) || '';
          setTimeout(() => {
            this._addLog('info', `dialog close 事件触发，returnValue="${rv}"`);
            this.setState({ dialogReturnValue: rv });
          }, 0);
        },
        onCancel: (e) => {
          // 不阻止默认行为：Esc 会关闭 dialog，随后触发 close 事件
          setTimeout(() => this._addLog('info', 'dialog cancel 事件触发（Esc 键，将自动关闭）'), 0);
        },
      },
        h('h4', { style: { marginTop: '0', marginBottom: 'var(--spacing-xs)' } }, '对话框内容'),
        h('p', { class: 'fs-sm text-secondary' },
          '这是 <dialog> 元素。showModal() 时 ::backdrop 遮罩覆盖页面并阻塞背景交互；按 Esc 触发 cancel 事件并自动关闭。'),
        h('div', { class: 'flex gap-sm mt-sm' },
          h('button', {
            type: 'button',
            class: 'btn btn--sm btn--primary',
            onClick: () => this._closeDialog('ok'),
          }, '确认 (returnValue="ok")'),
          h('button', {
            type: 'button',
            class: 'btn btn--sm',
            onClick: () => this._closeDialog('cancel'),
          }, '取消 (returnValue="cancel")'),
        ),
      ),
      h('pre', { class: 'code-block mt-sm' }, `const dlg = document.querySelector('dialog');
dlg.showModal();            // 模态打开（::backdrop）
dlg.show();                 // 非模态打开
dlg.close('returnValue');   // 关闭并设置返回值
dlg.addEventListener('close', () => console.log(dlg.returnValue));
dlg.addEventListener('cancel', e => e.preventDefault()); // 阻止 Esc 关闭
::backdrop { background: rgba(0,0,0,.45); }`),
    );
  }

  // ============================================================
  // Card 2: Popover API
  // ============================================================

  _togglePopover() {
    this._addLog('info', '调用 popover.togglePopover() —— 切换弹出层状态');
    const popover = this.$('#demo-popover');
    if (!popover || !this.state.popoverSupported) {
      this._addLog('error', '当前环境不支持 Popover API（showPopover/hidePopover/togglePopover）');
      return;
    }
    try { popover.togglePopover(); } catch (err) {
      setTimeout(() => this._addLog('error', `togglePopover 失败: ${err.message}`), 0);
    }
  }

  _showPopover() {
    this._addLog('info', '调用 popover.showPopover() —— 显示弹出层');
    const popover = this.$('#demo-popover');
    if (!popover || !this.state.popoverSupported) return;
    try { popover.showPopover(); } catch (err) {
      setTimeout(() => this._addLog('error', `showPopover 失败: ${err.message}`), 0);
    }
  }

  _hidePopover() {
    this._addLog('info', '调用 popover.hidePopover() —— 隐藏弹出层');
    const popover = this.$('#demo-popover');
    if (!popover || !this.state.popoverSupported) return;
    try { popover.hidePopover(); } catch (err) {
      setTimeout(() => this._addLog('error', `hidePopover 失败: ${err.message}`), 0);
    }
  }

  _renderPopoverCard() {
    const s = this.state;
    return h(Card, {
      title: '2. Popover API（原生弹出层）',
      extra: h(Tag, { color: s.popoverSupported ? 'success' : 'error' },
        s.popoverSupported ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '通过 popover 属性（auto/manual）声明弹出层，浏览器自动处理 Top Layer 层级、焦点管理、Light Dismiss（auto 模式点击外部自动关闭）。监听 beforetoggle / toggle 事件获取 oldState / newState。'),
      !s.popoverSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 Popover API',
        description: 'showPopover / hidePopover / togglePopover 不可用。Chrome 114+ / Safari 17+ / Firefox 125+ 支持。',
      }),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn('togglePopover()', { type: 'primary', size: 'sm', onClick: () => this._togglePopover() }),
        this._btn('showPopover()', { size: 'sm', onClick: () => this._showPopover() }),
        this._btn('hidePopover()', { size: 'sm', onClick: () => this._hidePopover() }),
      ),
      h('div', { class: 'flex items-center gap-sm mt-sm' },
        // 声明式触发：button popovertarget="demo-popover"
        h('button', {
          type: 'button',
          class: 'btn btn--sm',
          popovertarget: 'demo-popover',
        }, '声明式触发（popovertarget）'),
        h('span', { id: 'popover-status', class: 'fs-sm text-tertiary' }, '状态: 关闭'),
      ),
      // popover 元素：beforetoggle/toggle 事件通过 h() 绑定，
      // 直接更新状态文本（不调用 setState），避免 rerender 导致 popover 被替换关闭
      h('div', {
        id: 'demo-popover',
        popover: 'auto',
        onbeforetoggle: (e) => {
          const status = this.$('#popover-status');
          if (status) status.textContent = `beforetoggle: ${e.oldState} → ${e.newState}`;
        },
        ontoggle: (e) => {
          const status = this.$('#popover-status');
          if (status) status.textContent = `状态: ${e.newState === 'open' ? '打开' : '关闭'}`;
        },
      },
        h('h4', { style: { marginTop: '0', marginBottom: 'var(--spacing-xs)' } }, 'Popover 内容'),
        h('p', { class: 'fs-sm text-secondary' },
          'popover="auto" 点击外部自动关闭（Light Dismiss）。beforetoggle 在切换前触发，toggle 在切换后触发，均提供 oldState / newState。'),
      ),
      h('pre', { class: 'code-block mt-sm' }, `<div popover="auto" id="p"></div>
<button popovertarget="p">触发</button>
el.showPopover();   el.hidePopover();   el.togglePopover();
el.addEventListener('beforetoggle', e => console.log(e.oldState, '→', e.newState));
el.addEventListener('toggle', e => console.log('now:', e.newState));`),
    );
  }

  // ============================================================
  // Card 3: View Transitions API
  // ============================================================

  _switchView() {
    const next = this.state.vtView === 'A' ? 'B' : 'A';
    if (!this.state.vtSupported) {
      this.setState({ vtView: next });
      this._addLog('info', `不支持 View Transitions，降级直接切换到视图 ${next}`);
      return;
    }
    const start = performance.now();
    // 用 startViewTransition 包裹 setState，浏览器捕获前后快照生成过渡动画
    const transition = document.startViewTransition(() => {
      this.setState({ vtView: next });
    });
    // 可选：设置 ViewTransition.types，配合 ::view-transition-group.<type> 自定义动画
    if (transition && this.state.vtTypesEnabled) {
      try {
        transition.types = new Set(['custom-vt']);
        this._addLog('info', '已设置 transition.types = new Set(["custom-vt"])');
      } catch (err) {
        this._addLog('error', `设置 ViewTransition.types 失败: ${err.message}`);
      }
    }
    // transition.updateCallbackDone：传入的回调完成（DOM 已更新）
    if (transition?.updateCallbackDone) {
      transition.updateCallbackDone
        .then(() => this._addLog('info', 'transition.updateCallbackDone —— DOM 更新回调已完成'))
        .catch((e) => this._addLog('error', `updateCallbackDone 失败: ${e.message}`));
    }
    // transition.ready：伪元素已创建，动画即将开始
    if (transition?.ready) {
      transition.ready
        .then(() => this._addLog('info', 'transition.ready —— ::view-transition-* 伪元素已就绪'))
        .catch((e) => this._addLog('error', `transition.ready 失败: ${e.message}`));
    }
    // transition.finished：整个过渡动画完全结束
    if (transition?.finished) {
      transition.finished
        .then(() => {
          const ms = (performance.now() - start).toFixed(1);
          this._addLog('info', `transition.finished —— 过渡完成（耗时 ${ms}ms）`);
        })
        .catch((e) => this._addLog('error', `transition.finished 失败: ${e.message}`));
    }
    this._addLog('info', `startViewTransition 已触发：视图 ${this.state.vtView} → ${next}`);
  }

  _toggleVtTypes() {
    const next = !this.state.vtTypesEnabled;
    this.setState({ vtTypesEnabled: next });
    this._addLog('info', `ViewTransition.types ${next ? '已启用（下次切换生效）' : '已禁用'}`);
  }

  _renderViewTransitionsCard() {
    const s = this.state;
    return h(Card, {
      title: '3. View Transitions API（视图过渡）',
      extra: h(Tag, { color: s.vtSupported ? 'success' : 'error' },
        s.vtSupported ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'document.startViewTransition(callback) 包裹 DOM 更新，浏览器自动捕获前后快照并通过 ::view-transition-old / ::view-transition-new 伪元素生成过渡动画。transition 对象提供 updateCallbackDone / ready / finished 三个 Promise 以及 types 集合。'),
      !s.vtSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 View Transitions',
        description: '已降级为直接 setState，无过渡动画。Chrome 111+ / Edge 111+ 支持。',
      }),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn('切换视图 A / B', { type: 'primary', size: 'sm', onClick: () => this._switchView() }),
        this._btn(
          s.vtTypesEnabled ? 'types: ON（点击关闭）' : 'types: OFF（点击开启）',
          { size: 'sm', onClick: () => this._toggleVtTypes() },
        ),
      ),
      h('div', { class: 'flex items-center gap-sm mt-sm' },
        h('div', {
          id: 'vt-view-box',
          style: {
            width: '140px', height: '80px',
            background: s.vtView === 'A' ? 'var(--color-primary)' : 'var(--color-success)',
            borderRadius: 'var(--radius-base)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 'bold',
          },
        }, `视图 ${s.vtView}`),
        h('span', { class: 'fs-sm text-tertiary' }, '← view-transition-name: vt-view-box'),
      ),
      h('pre', { class: 'code-block mt-sm' }, `const t = document.startViewTransition(() => {
  // DOM 更新（此处调用 setState 触发 rerender）
});
t.types = new Set(['slide']);  // 可选，配合 ::view-transition-group.slide
await t.updateCallbackDone;     // DOM 更新回调完成
await t.ready;                  // 伪元素已创建，动画即将开始
await t.finished;               // 动画完全结束

::view-transition-old(root),
::view-transition-new(root) { animation-duration: .4s; }`),
    );
  }

  // ============================================================
  // Card 4: CSS @property（类型化自定义属性）
  // ============================================================

  _toggleTypedColor() {
    const next = this.state.typedColor === '#1677ff' ? '#52c41a' : '#1677ff';
    this.setState({ typedColor: next });
    this._addLog('info', `类型化 --typed-color 切换 → ${next}（@property 注册 <color> 类型，浏览器可平滑插值过渡）`);
  }

  _toggleUntypedColor() {
    const next = this.state.untypedColor === '#1677ff' ? '#52c41a' : '#1677ff';
    this.setState({ untypedColor: next });
    this._addLog('info', `非类型化 --untyped-color 切换 → ${next}（无 @property 声明，过渡瞬间跳变）`);
  }

  _renderPropertyCard() {
    const s = this.state;
    return h(Card, {
      title: '4. CSS @property（类型化自定义属性）',
      extra: h(Tag, { color: s.registerPropertySupported ? 'success' : 'error' },
        s.registerPropertySupported ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'CSS.registerProperty() 或 @property at-rule 为自定义属性声明类型（<color>/<length>/<integer> 等）、初始值与继承性。类型化后浏览器可在过渡/动画中对值进行插值；未类型化只能离散跳变。'),
      !s.registerPropertySupported && h(Alert, {
        type: 'warning',
        message: '当前环境不支持 CSS.registerProperty',
        description: 'jsdom 不实现该 API。Chrome 85+ / Safari 16.4+ / Firefox 128+ 支持。下方演示仍可工作但无类型化过渡效果。',
      }),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn('切换类型化颜色', { type: 'primary', size: 'sm', onClick: () => this._toggleTypedColor() }),
        this._btn('切换非类型化颜色', { size: 'sm', onClick: () => this._toggleUntypedColor() }),
      ),
      h('div', { class: 'flex gap-sm mt-sm' },
        h('div', { class: 'flex flex-col items-center gap-xs' },
          h('div', {
            class: 'typed-box',
            style: { '--typed-color': s.typedColor, background: s.typedColor },
          }),
          h('span', { class: 'fs-sm text-tertiary' }, '类型化（@property）'),
        ),
        h('div', { class: 'flex flex-col items-center gap-xs' },
          h('div', {
            class: 'untyped-box',
            style: { '--untyped-color': s.untypedColor, background: s.untypedColor },
          }),
          h('span', { class: 'fs-sm text-tertiary' }, '非类型化（普通变量）'),
        ),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        '类型化方块应平滑过渡（0.6s），非类型化方块瞬间跳变。差异源于 @property 告诉浏览器该变量是 <color> 类型，可以在过渡中插值。'),
      h('pre', { class: 'code-block mt-sm' }, `/* JS 注册 */
CSS.registerProperty({
  name: '--typed-color',
  syntax: '<color>',
  inherits: false,
  initialValue: '#1677ff',
});

/* 等价 CSS at-rule */
@property --typed-color {
  syntax: '<color>';
  inherits: false;
  initial-value: #1677ff;
}

.typed-box {
  transition: --typed-color .6s;   /* 类型化后才可过渡自定义属性 */
  background: var(--typed-color);
}`),
    );
  }

  // ============================================================
  // Card 5: Container Queries（容器查询）
  // ============================================================

  _renderContainerQueriesCard() {
    const s = this.state;
    return h(Card, {
      title: '5. Container Queries（容器查询）',
      extra: h(Tag, { color: s.containerQuerySupported ? 'success' : 'error' },
        s.containerQuerySupported ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'container-type: inline-size 声明容器，@container 规则根据容器（而非视口）宽度响应式布局。jsdom 不响应 CSS 响应式，真实浏览器中拖动滑块即可看到列数与颜色变化。配合 ResizeObserver 可在 JS 中感知容器尺寸变化。'),
      !s.containerQuerySupported && h(Alert, {
        type: 'warning',
        message: '当前环境可能不支持 Container Queries',
        description: 'CSS.supports 在 jsdom 中返回 false。Chrome 105+ / Safari 16+ / Firefox 110+ 支持。',
      }),
      h('div', { class: 'flex items-center gap-sm mt-sm' },
        h('input', {
          id: 'cq-range',
          type: 'range',
          min: '200',
          max: '600',
          value: String(s.containerWidth),
          style: { flex: '1' },
          // 直接更新 DOM 宽度和显示文本，避免 setState rerender 打断拖动
          oninput: (e) => {
            const w = Number(e.target.value);
            const container = this.$('#cq-demo');
            if (container) container.style.width = w + 'px';
            const display = this.$('#cq-width-display');
            if (display) display.textContent = `${w}px`;
            // 真实浏览器中 @container 规则会自动响应宽度变化；
            // 也可用 ResizeObserver 在 JS 中监听容器尺寸（此处演示手动更新）
          },
        }),
        h('span', { id: 'cq-width-display', class: 'fs-sm text-tertiary' }, `${s.containerWidth}px`),
      ),
      h('div', {
        id: 'cq-demo',
        class: 'cq-demo mt-sm',
        style: { width: s.containerWidth + 'px' },
      },
        h('div', { class: 'cq-grid' },
          h('div', { class: 'cq-card' }, '卡片 1'),
          h('div', { class: 'cq-card' }, '卡片 2'),
          h('div', { class: 'cq-card' }, '卡片 3'),
          h('div', { class: 'cq-card' }, '卡片 4'),
        ),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        '容器 < 350px 单列（蓝），350-500px 双列（绿），> 500px 三列（橙）。@container 依据父容器宽度，而非视口宽度。'),
      h('pre', { class: 'code-block mt-sm' }, `.cq-demo {
  container-type: inline-size;
  container-name: cqdemo;
}
@container cqdemo (max-width: 349px) {
  .cq-grid { grid-template-columns: 1fr; }
}
@container cqdemo (min-width: 350px) and (max-width: 499px) {
  .cq-grid { grid-template-columns: 1fr 1fr; }
}
@container cqdemo (min-width: 500px) {
  .cq-grid { grid-template-columns: 1fr 1fr 1fr; }
}

/* JS 监听容器尺寸变化 */
const ro = new ResizeObserver(entries => {
  for (const e of entries) console.log(e.contentBoxSize);
});
ro.observe(containerEl);`),
    );
  }

  // ============================================================
  // Card 6: CSS Anchor Positioning + Declarative Shadow DOM
  // ============================================================

  _toggleAnchorTooltip() {
    if (!this.state.anchorSupported) {
      this._addLog('error', '当前环境不支持 CSS Anchor Positioning（position-anchor / anchor()）');
      return;
    }
    const tip = this.$('#anchor-tooltip');
    if (!tip) return;
    const visible = tip.style.visibility === 'visible';
    tip.style.visibility = visible ? 'hidden' : 'visible';
    this._addLog('info', `Anchor tooltip ${visible ? '隐藏' : '显示'}（基于 position-anchor: --anchor-demo 锚定到按钮）`);
  }

  _renderDsd() {
    const host = this.$('#dsd-host');
    if (!host) return;
    // 通过 innerHTML 设置含 <template shadowrootmode="open"> 的 HTML，
    // 支持的浏览器解析时会自动创建 shadow root（声明式 Shadow DOM，SSR 友好）
    host.innerHTML = `
      <template shadowrootmode="open">
        <style>
          :host { display: inline-block; }
          .label { font-weight: bold; color: #1677ff; }
          .val { color: #52c41a; margin-left: 8px; }
        </style>
        <span class="label" part="label">声明式 Shadow DOM</span>
        <span class="val">已渲染（shadowRoot 封装）</span>
      </template>
      <span style="color: #999;">这段 light DOM 内容在 shadowRoot 建立后被遮蔽</span>
    `;
    if (host.shadowRoot) {
      this.setState({ dsdReady: true });
      this._addLog('info', '声明式 Shadow DOM 渲染成功：host.shadowRoot 已建立，样式封装在 shadow 内，::part(label) 可被外部穿透');
    } else {
      this._addLog('error', '当前环境不支持声明式 Shadow DOM（<template shadowrootmode="open"> 未生效）');
    }
  }

  _renderAnchorDsdCard() {
    const s = this.state;
    return h(Card, {
      title: '6. CSS Anchor Positioning + Declarative Shadow DOM',
      extra: h(Tag, { color: s.anchorSupported ? 'success' : 'error' },
        s.anchorSupported ? 'Anchor 已支持' : 'Anchor 未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'anchor-name 为元素命名锚点，position-anchor 引用锚点，anchor() 函数获取锚点边/中心位置实现无需 JS 计算的相对定位；position-try-fallbacks 提供翻转回退。Declarative Shadow DOM 通过 <template shadowrootmode="open"> 实现服务端渲染式 shadow DOM。'),
      (!s.anchorSupported || !s.dsdSupported) && h(Alert, {
        type: 'warning',
        message: '兼容性提示',
        description: `Anchor Positioning: ${s.anchorSupported ? '已支持' : '未支持（Chrome 125+ 实验）'}。Declarative Shadow DOM: ${s.dsdSupported ? '已支持' : '未支持（Chrome 111+ / Safari 17+ / Firefox 123+）'}。`,
      }),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, 'Anchor Positioning'),
      h('div', {
        class: 'flex items-center gap-sm mt-sm',
        style: { position: 'relative' },
      },
        this._btn('Anchor 按钮（锚点）', {
          type: 'primary',
          size: 'sm',
          onClick: () => this._toggleAnchorTooltip(),
        }),
        // tooltip 用 position-anchor 定位到按钮（真实浏览器中生效）
        h('div', {
          id: 'anchor-tooltip',
          class: 'anchor-tooltip',
          style: { visibility: 'hidden' },
        }, '我通过 position-anchor 锚定到按钮'),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        'tooltip 样式：position-anchor: --anchor-demo; top: anchor(bottom); left: anchor(center); position-try-fallbacks: flip-block;'),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, 'Declarative Shadow DOM'),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn('渲染声明式 Shadow DOM', { type: 'primary', size: 'sm', onClick: () => this._renderDsd() }),
      ),
      h('div', { id: 'dsd-host', class: 'dsd-host mt-sm' },
        h('span', { class: 'fs-sm text-tertiary' }, '点击上方按钮后，此处通过 innerHTML 注入 <template shadowrootmode="open">'),
      ),
      s.dsdReady && h('p', { class: 'fs-sm mt-sm', style: { color: 'var(--color-success)' } },
        '✓ host.shadowRoot 已建立，内部样式封装在 shadow 内，::part(label) 可被外部 CSS 穿透。'),
      h('pre', { class: 'code-block mt-sm' }, `/* CSS Anchor Positioning */
.anchor-btn { anchor-name: --a; }
.tooltip {
  position-anchor: --a;
  top: anchor(bottom);
  left: anchor(center);
  position-try-fallbacks: flip-block;
}

<!-- Declarative Shadow DOM -->
<my-element>
  <template shadowrootmode="open">
    <style>.x { color: red; }</style>
    <span part="label">SSR Shadow DOM</span>
  </template>
</my-element>`,
      ),
    );
  }

  // ============================================================
  // 日志面板
  // ============================================================

  _renderLogPanel() {
    const s = this.state;
    return h(Card, {
      title: '事件日志',
      extra: h('span', { class: 'fs-sm text-tertiary' }, `${s.logs.length} 条`),
    },
      h('div', { class: 'log-panel' },
        s.logs.length === 0
          ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
          : s.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'error' ? 'error' : 'info'}` }, log.type),
              h('span', { class: 'log-panel__content' }, log.content),
            )),
      ),
    );
  }

  // ============================================================
  // 页面渲染入口
  // ============================================================

  renderPage() {
    return [
      h('h2', { class: 'section-title' }, '现代平台 DOM 能力实验室'),

      h(Alert, {
        type: 'info',
        message: '现代平台 DOM 能力',
        description: '演示 <dialog> 元素、Popover API、View Transitions API、CSS @property、Container Queries、CSS Anchor Positioning + Declarative Shadow DOM。所有 API 调用前均做能力检测，不支持时记日志说明而非抛异常。',
      }),

      this._renderDialogCard(),
      this._renderPopoverCard(),
      this._renderViewTransitionsCard(),
      this._renderPropertyCard(),
      this._renderContainerQueriesCard(),
      this._renderAnchorDsdCard(),

      this._renderLogPanel(),
    ];
  }
}
