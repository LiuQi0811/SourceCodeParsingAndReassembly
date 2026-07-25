// =====================================================================
// InvokerAPIPage.js —— Invoker 声明式交互 API 实验室
// 演示 MDN：
//   1. commandfor / command —— 声明式 Popover 触发（HTMLButtonElement.commandForElement /
//      command / show-popover|hide-popover|toggle-popover / vs popovertarget 旧 API）
//   2. invoketarget / invokeaction —— 声明式 Dialog 触发（HTMLButtonElement.invokeTargetElement /
//      invokeAction / show-modal|show|close / vs 手动 dialog.showModal()）
//   3. commandForElement / command / invokeAction / invokeTargetElement —— DOM 属性读写
//   4. CommandEvent —— command 事件 / event.command / event.invoker / event.type
//   5. interesttarget / interestfocusdelay —— 悬停兴趣元素（interestTargetElement /
//      interestevent / toggle 事件 oldState|newState: 'active'|'inactive'）
//   6. 端到端对比 —— 声明式 vs 手动 JS / 渐进增强（能力检测回退）/ 浏览器支持矩阵
// 说明：所有 API 调用前做 typeof/in 能力检测，不可用时仅 _addLog('warn', ...)，绝不抛异常。
//       jsdom/Node 中 commandForElement / invokeAction / CommandEvent / interestTargetElement
//       通常未实现，showPopover/hidePopover/togglePopover 已 polyfill 可用。
// =====================================================================

import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class InvokerAPIPage extends Page {
  initialState() {
    return {
      logs: [],
      // —— 能力检测结果 ——
      commandForSupported: false,     // commandfor / command（统一后新 API）
      invokeTargetSupported: false,   // invoketarget / invokeaction（较早期提案）
      commandEventSupported: false,   // CommandEvent 构造器
      interestTargetSupported: false, // interesttarget / interestTargetElement
      popoverSupported: false,        // showPopover/hidePopover/togglePopover（jsdom polyfill）
      dialogSupported: false,         // HTMLDialogElement
      showModalSupported: false,      // HTMLDialogElement.prototype.showModal
      // —— 演示状态 ——
      commandLastAction: '',   // Card 1 最近一次 command 动作描述
      invokeLastAction: '',    // Card 2 最近一次 invokeaction 动作描述
      jsApiInfo: '',           // Card 3 JS 接口读写结果
      commandEventInfo: '',    // Card 4 CommandEvent 监听结果
      interestInfo: '',        // Card 5 interesttarget 监听结果
      e2eInfo: '',             // Card 6 端到端对比结果
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（全部用 typeof/in + try/catch，避免 jsdom 抛异常）——
    const commandForSupported = typeof HTMLElement !== 'undefined'
      && 'commandForElement' in HTMLElement.prototype;
    const invokeTargetSupported = typeof HTMLElement !== 'undefined'
      && ('invokeAction' in HTMLElement.prototype || 'invokeTargetElement' in HTMLElement.prototype);
    const commandEventSupported = typeof window !== 'undefined'
      && typeof window.CommandEvent === 'function';
    const interestTargetSupported = typeof HTMLElement !== 'undefined'
      && 'interestTargetElement' in HTMLElement.prototype;
    const popoverSupported = typeof HTMLElement !== 'undefined'
      && typeof HTMLElement.prototype.showPopover === 'function';
    const dialogSupported = typeof HTMLDialogElement !== 'undefined';
    const showModalSupported = dialogSupported
      && typeof HTMLDialogElement.prototype.showModal === 'function';

    // —— 实例引用初始化（componentWillUnmount 中清理）——
    this._dynamicBtn = null; this._dynamicPopover = null;            // Card 3 动态 button + popover
    this._commandTarget = null; this._commandHandler = null; this._commandBtn = null; // Card 4
    this._interestBtn = null; this._interestTarget = null; this._interestHandler = null; // Card 5
    this._e2eDeclBtn = null; this._e2eDeclPopover = null;            // Card 6 声明式
    this._e2eJsBtn = null; this._e2eJsPopover = null; this._e2eJsHandler = null; // Card 6 手动 JS

    const parts = [
      `commandfor ${commandForSupported ? '✓' : '✗'}`,
      `invoketarget ${invokeTargetSupported ? '✓' : '✗'}`,
      `CommandEvent ${commandEventSupported ? '✓' : '✗'}`,
      `interesttarget ${interestTargetSupported ? '✓' : '✗'}`,
      `popover ${popoverSupported ? '✓' : '✗'}`,
      `<dialog> ${dialogSupported ? '✓' : '✗'}`,
      `showModal ${showModalSupported ? '✓' : '✗'}`,
    ];
    const summary = `特性检测 → ${parts.join(' · ')}。`
      + (commandForSupported
        ? 'commandfor/command 已支持，可执行真实声明式触发。'
        : 'jsdom/旧浏览器不支持 commandfor/command，声明式按钮点击无效，演示仅记日志说明用法。');

    // —— 单次 setState：写入能力检测结果 + 初始日志，避免多次 rerender ——
    this.setState({
      commandForSupported,
      invokeTargetSupported,
      commandEventSupported,
      interestTargetSupported,
      popoverSupported,
      dialogSupported,
      showModalSupported,
      logs: [
        ...this.state.logs,
        { type: 'info', content: summary, time: formatTime() },
        { type: 'info', content: 'Invoker API：commandfor/command 是统一后的新 API（Chrome 126+，2024.6）；invoketarget/invokeaction 是较早期提案；interesttarget 仍为实验性（Chrome 133+ 部分支持）。', time: formatTime() },
      ].slice(-40),
    });

    // —— 注入演示 CSS（仅一次）——
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    // 清理：移除注入样式、动态创建的元素、事件监听（每个调用包 try/catch）
    this._demoStyleEl?.remove();
    const detach = (target, type, handler) => {
      if (target && handler) { try { target.removeEventListener(type, handler); } catch { /* noop */ } }
    };
    const remove = (el) => {
      if (el && el.parentNode) { try { el.parentNode.removeChild(el); } catch { /* noop */ } }
    };
    const closePopover = (el) => {
      if (el && typeof el.hidePopover === 'function') {
        try { el.hidePopover(); } catch { /* noop */ }
      }
    };
    const closeDialog = (el) => {
      if (el && typeof el.close === 'function') {
        try { el.close(); } catch { /* noop */ }
      }
    };
    // Card 3
    remove(this._dynamicBtn); remove(this._dynamicPopover);
    // Card 4
    detach(this._commandTarget, 'command', this._commandHandler);
    remove(this._commandTarget); remove(this._commandBtn);
    // Card 5
    detach(this._interestTarget, 'toggle', this._interestHandler);
    remove(this._interestBtn); remove(this._interestTarget);
    // Card 6
    detach(this._e2eJsBtn, 'click', this._e2eJsHandler);
    closePopover(this._e2eDeclPopover); closePopover(this._e2eJsPopover);
    remove(this._e2eDeclBtn); remove(this._e2eDeclPopover);
    remove(this._e2eJsBtn); remove(this._e2eJsPopover);
    // 关闭内联 dialog/popover（Card 1 / Card 2 渲染在 DOM 树中）
    closeDialog(this.$('#invoker-demo-dialog'));
    closePopover(this.$('#invoker-demo-popover'));
    // 释放引用
    this._dynamicBtn = null; this._dynamicPopover = null;
    this._commandTarget = null; this._commandHandler = null; this._commandBtn = null;
    this._interestBtn = null; this._interestTarget = null; this._interestHandler = null;
    this._e2eDeclBtn = null; this._e2eDeclPopover = null;
    this._e2eJsBtn = null; this._e2eJsPopover = null; this._e2eJsHandler = null;
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    const tryProbe = (fn) => { try { return fn(); } catch { return false; } };
    const commandFor = typeof HTMLElement !== 'undefined' && 'commandForElement' in HTMLElement.prototype;
    const invokeTarget = typeof HTMLElement !== 'undefined'
      && ('invokeAction' in HTMLElement.prototype || 'invokeTargetElement' in HTMLElement.prototype);
    const commandEvent = typeof window !== 'undefined' && typeof window.CommandEvent === 'function';
    const interestTarget = typeof HTMLElement !== 'undefined' && 'interestTargetElement' in HTMLElement.prototype;
    const popover = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
    const dialog = typeof HTMLDialogElement !== 'undefined';
    const showModal = tryProbe(() => dialog && typeof HTMLDialogElement.prototype.showModal === 'function');
    return { commandFor, invokeTarget, commandEvent, interestTarget, popover, dialog, showModal };
  }

  // —— 注入演示 CSS ——
  _injectDemoStyles() {
    if (this._demoStyleEl) this._demoStyleEl.remove();
    const style = document.createElement('style');
    style.id = 'invoker-api-demo-style';
    style.textContent = `
      #invoker-demo-popover { border: 1px solid var(--color-border); border-radius: var(--radius-base);
        padding: var(--spacing-md); background: var(--color-bg-elevated); color: var(--color-text); max-width: 280px; }
      #invoker-demo-popover::backdrop { background: rgba(0, 0, 0, 0.25); }
      #invoker-demo-dialog { border: 1px solid var(--color-border); border-radius: var(--radius-base);
        padding: var(--spacing-md); background: var(--color-bg-elevated); color: var(--color-text); max-width: 360px; }
      #invoker-demo-dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
      .invoker-target { display: inline-flex; align-items: center; justify-content: center;
        padding: var(--spacing-sm); border: 1px dashed var(--color-border); border-radius: var(--radius-base);
        background: var(--color-bg-spotlight); min-width: 220px; min-height: 40px; }
      .invoker-tooltip { padding: 6px 10px; background: rgba(0, 0, 0, 0.75); color: #fff;
        border-radius: var(--radius-sm); font-size: var(--font-size-sm); max-width: 240px; }
      .e2e-popover { border: 1px solid var(--color-border); border-radius: var(--radius-base);
        padding: var(--spacing-sm); background: var(--color-bg-elevated); color: var(--color-text); max-width: 240px; }
      .e2e-popover::backdrop { background: rgba(0, 0, 0, 0.2); }
    `;
    document.head.appendChild(style);
    this._demoStyleEl = style;
  }

  // ============================================================
  // Card 1: commandfor / command 基础（声明式 Popover 触发）
  // ============================================================

  _cmdToggleViaJs() {
    // 能力检测：commandfor 不可用时回退 JS 调用 togglePopover（渐进增强）
    const caps = this._caps();
    const popover = this.$('#invoker-demo-popover');
    if (!popover) return;
    if (!caps.popover) {
      this._addLog('warn', 'Popover API（togglePopover）不可用：测试环境不支持');
      return;
    }
    try {
      const result = popover.togglePopover();
      this._addLog('info', `JS 回退：popover.togglePopover() → ${result}（commandfor 不可用时的渐进增强）`);
    } catch (err) {
      this._addLog('warn', `togglePopover 失败: ${err.message}`);
    }
  }

  _cmdInspectAttrs() {
    // 读取按钮上的 commandfor / command 属性，演示 HTML 属性 vs DOM 属性的差异
    const btn = this.$('#invoker-demo-btn');
    if (!btn) return;
    const caps = this._caps();
    const htmlCommandFor = btn.getAttribute('commandfor') || '(未设置)';
    const htmlCommand = btn.getAttribute('command') || '(未设置)';
    let idlLine = '';
    if (caps.commandFor) {
      try {
        const target = btn.commandForElement;
        const cmd = btn.command;
        idlLine = `；IDL：btn.commandForElement = ${target ? `<${target.tagName.toLowerCase()}#${target.id}>` : 'null'}，btn.command = "${cmd}"`;
      } catch (err) {
        idlLine = `；读取 IDL 属性抛错: ${err.message}`;
      }
    } else {
      idlLine = '；IDL 属性 commandForElement/command 不可用（仅 HTML 属性可读）';
    }
    const line = `按钮属性检查：HTML commandfor="${htmlCommandFor}"，command="${htmlCommand}"${idlLine}`;
    this._addLog('info', line);
    this.setState({ commandLastAction: line });
  }

  _renderCard1() {
    const s = this.state;
    return h(Card, {
      title: '1. commandfor / command 基础（声明式 Popover 触发）',
      extra: h(Tag, { color: s.commandForSupported ? 'success' : 'error' },
        s.commandForSupported ? 'commandfor 已支持' : 'commandfor 未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'HTML 属性 commandfor="popover-id" + command="show-popover|hide-popover|toggle-popover" 即可声明式触发 popover，无需 JS。commandfor/command 是泛化的 Invoker API（不仅限 popover），替代旧 popovertarget/popovertargetaction。Chrome 126+（2024.6）支持，用 HTMLElement.prototype.commandForElement 检测。'),
      !s.commandForSupported && h(Alert, {
        type: 'warning',
        message: '当前环境不支持 commandfor / command',
        description: 'jsdom 或旧浏览器未实现 commandForElement。Chrome 126+ 支持。下方"声明式触发"按钮在支持的浏览器中点击会切换 popover，不支持时请用"JS 回退 togglePopover"按钮。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        // 声明式触发按钮：commandfor + command 属性（支持浏览器点击即切换 popover）
        h('button', {
          id: 'invoker-demo-btn',
          type: 'button',
          class: 'btn btn--sm btn--primary',
          commandfor: 'invoker-demo-popover',
          command: 'toggle-popover',
        }, '声明式触发（commandfor + command="toggle-popover"）'),
        this._btn('JS 回退 togglePopover()', { size: 'sm', onClick: () => this._cmdToggleViaJs() }),
        this._btn('检查按钮属性', { size: 'sm', onClick: () => this._cmdInspectAttrs() }),
      ),
      h('div', { class: 'flex items-center gap-sm mt-sm' },
        // 对照：旧 API popovertarget（仍可用，但仅限 popover）
        h('button', {
          type: 'button',
          class: 'btn btn--sm',
          popovertarget: 'invoker-demo-popover',
        }, '旧 API：popovertarget 触发'),
        h('span', { id: 'invoker-popover-status', class: 'fs-sm text-tertiary' }, '状态: 关闭'),
      ),
      // popover 元素：toggle/beforetoggle 事件通过 h() 绑定，
      // 直接更新状态文本（不调用 setState），避免 rerender 导致 popover 被替换关闭
      h('div', {
        id: 'invoker-demo-popover',
        popover: 'auto',
        onbeforetoggle: (e) => {
          const status = this.$('#invoker-popover-status');
          if (status) status.textContent = `beforetoggle: ${e.oldState} → ${e.newState}`;
          this._addLog('info', `popover beforetoggle：${e.oldState} → ${e.newState}`);
        },
        ontoggle: (e) => {
          const status = this.$('#invoker-popover-status');
          if (status) status.textContent = `状态: ${e.newState === 'open' ? '打开' : '关闭'}`;
          this._addLog('info', `popover toggle：now ${e.newState}（由 command 触发或 JS 触发）`);
        },
      },
        h('h4', { style: { marginTop: '0', marginBottom: 'var(--spacing-xs)' } }, 'Popover 内容'),
        h('p', { class: 'fs-sm text-secondary' },
          '此 popover 由 button 的 commandfor="invoker-demo-popover" + command="toggle-popover" 声明式触发。command 取值：show-popover / hide-popover / toggle-popover（对应 Popover API）。'),
      ),
      s.commandLastAction && h('p', { class: 'fs-sm text-tertiary mt-sm' }, s.commandLastAction),
      h('pre', { class: 'code-block mt-sm' }, `<!-- 声明式触发：commandfor + command（新 API，Chrome 126+） -->
<button commandfor="my-popover" command="toggle-popover">打开</button>
<div id="my-popover" popover>内容</div>

<!-- 旧 API：popovertarget / popovertargetaction（仅限 popover） -->
<button popovertarget="my-popover" popovertargetaction="toggle">打开</button>

<!-- command 取值（popover 目标）：-->
<!--   "show-popover" | "hide-popover" | "toggle-popover" -->

// 能力检测
'commandForElement' in HTMLElement.prototype  // Chrome 126+`),
    );
  }

  // ============================================================
  // Card 2: invoketarget / invokeaction（声明式 Dialog 触发）
  // ============================================================

  _invokeShowModalJs() {
    // 能力检测：invoketarget 不可用时回退 JS 调用 showModal
    const caps = this._caps();
    const dialog = this.$('#invoker-demo-dialog');
    if (!dialog) return;
    if (!caps.showModal) {
      this._addLog('warn', 'dialog.showModal() 不可用：测试环境不支持');
      return;
    }
    try {
      dialog.showModal();
      this._addLog('info', 'JS 回退：dialog.showModal()（invoketarget 不可用时的渐进增强）');
      this.setState({ invokeLastAction: 'JS 回退：dialog.showModal() 已调用' });
    } catch (err) {
      this._addLog('warn', `showModal 失败: ${err.message}`);
    }
  }

  _invokeCloseJs() {
    const dialog = this.$('#invoker-demo-dialog');
    if (!dialog || typeof dialog.close !== 'function') {
      this._addLog('warn', 'dialog.close() 不可用');
      return;
    }
    try {
      dialog.close();
      this._addLog('info', 'JS 回退：dialog.close()');
      this.setState({ invokeLastAction: 'JS 回退：dialog.close() 已调用' });
    } catch (err) {
      this._addLog('warn', `close 失败: ${err.message}`);
    }
  }

  _invokeInspectAttrs() {
    const btn = this.$('#invoker-demo-invoke-btn');
    if (!btn) return;
    const caps = this._caps();
    const htmlInvokeTarget = btn.getAttribute('invoketarget') || '(未设置)';
    const htmlInvokeAction = btn.getAttribute('invokeaction') || '(未设置)';
    let idlLine = '';
    if (caps.invokeTarget) {
      try {
        const target = btn.invokeTargetElement;
        const action = btn.invokeAction;
        idlLine = `；IDL：btn.invokeTargetElement = ${target ? `<${target.tagName.toLowerCase()}#${target.id}>` : 'null'}，btn.invokeAction = "${action}"`;
      } catch (err) {
        idlLine = `；读取 IDL 属性抛错: ${err.message}`;
      }
    } else {
      idlLine = '；IDL 属性 invokeTargetElement/invokeAction 不可用（仅 HTML 属性可读）';
    }
    const line = `按钮属性检查：HTML invoketarget="${htmlInvokeTarget}"，invokeaction="${htmlInvokeAction}"${idlLine}`;
    this._addLog('info', line);
    this.setState({ invokeLastAction: line });
  }

  _renderCard2() {
    const s = this.state;
    return h(Card, {
      title: '2. invoketarget / invokeaction（声明式 Dialog 触发）',
      extra: h(Tag, { color: s.invokeTargetSupported ? 'success' : 'error' },
        s.invokeTargetSupported ? 'invoketarget 已支持' : 'invoketarget 未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'HTML 属性 invoketarget="dialog-id" + invokeaction="show-modal|show|close" 声明式触发 <dialog>，无需 JS。invokeaction 取值：show-modal（模态，含 ::backdrop）/ show（非模态）/ close（关闭）。invoketarget/invokeaction 是较早期的 Invoker API 提案，commandfor/command 是统一后的新 API（推荐）。vs 手动 dialog.showModal()：声明式 HTML 属性即完成绑定。'),
      !s.invokeTargetSupported && h(Alert, {
        type: 'warning',
        message: '当前环境不支持 invoketarget / invokeaction',
        description: 'jsdom 或旧浏览器未实现 invokeAction/invokeTargetElement。Chrome 126+ 支持。下方"声明式触发"按钮在支持的浏览器中点击会打开 dialog，不支持时请用"JS 回退 showModal"按钮。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        // 声明式触发按钮：invoketarget + invokeaction 属性
        h('button', {
          id: 'invoker-demo-invoke-btn',
          type: 'button',
          class: 'btn btn--sm btn--primary',
          invoketarget: 'invoker-demo-dialog',
          invokeaction: 'show-modal',
        }, '声明式触发（invoketarget + invokeaction="show-modal"）'),
        this._btn('JS 回退 showModal()', { size: 'sm', onClick: () => this._invokeShowModalJs() }),
        this._btn('JS 回退 close()', { danger: true, size: 'sm', onClick: () => this._invokeCloseJs() }),
        this._btn('检查按钮属性', { size: 'sm', onClick: () => this._invokeInspectAttrs() }),
      ),
      // dialog 元素：close/cancel 事件通过 h() 绑定
      h('dialog', {
        id: 'invoker-demo-dialog',
        onClose: (e) => {
          const rv = (e.target && e.target.returnValue) || '';
          setTimeout(() => {
            this._addLog('info', `dialog close 事件触发，returnValue="${rv}"`);
            this.setState({ invokeLastAction: `dialog close 事件：returnValue="${rv}"` });
          }, 0);
        },
        onCancel: () => {
          setTimeout(() => this._addLog('info', 'dialog cancel 事件触发（Esc 键，将自动关闭）'), 0);
        },
      },
        h('h4', { style: { marginTop: '0', marginBottom: 'var(--spacing-xs)' } }, 'Dialog 内容'),
        h('p', { class: 'fs-sm text-secondary' },
          '此 dialog 由 button 的 invoketarget="invoker-demo-dialog" + invokeaction="show-modal" 声明式触发（模态打开）。invokeaction 取值：show-modal / show / close。'),
        h('div', { class: 'flex gap-sm mt-sm' },
          h('button', {
            type: 'button',
            class: 'btn btn--sm btn--primary',
            invoketarget: 'invoker-demo-dialog',
            invokeaction: 'close',
          }, '声明式关闭（invokeaction="close"）'),
          h('button', {
            type: 'button',
            class: 'btn btn--sm',
            onClick: () => this._invokeCloseJs(),
          }, 'JS 关闭'),
        ),
      ),
      s.invokeLastAction && h('p', { class: 'fs-sm text-tertiary mt-sm' }, s.invokeLastAction),
      h('pre', { class: 'code-block mt-sm' }, `<!-- 声明式触发 dialog（invoketarget + invokeaction） -->
<button invoketarget="my-dialog" invokeaction="show-modal">打开对话框</button>
<dialog id="my-dialog">内容</dialog>

<!-- invokeaction 取值：-->
<!--   "show-modal"（模态，::backdrop）| "show"（非模态）| "close"（关闭）-->

<!-- vs 手动 JS -->
<button onclick="document.getElementById('my-dialog').showModal()">打开</button>

<!-- 注意：invoketarget/invokeaction 是较早期提案； -->
<!-- commandfor/command 是统一后的新 API（推荐）。 -->

// 能力检测
'invokeAction' in HTMLElement.prototype        // 旧 API
'invokeTargetElement' in HTMLElement.prototype // 旧 API`),
    );
  }

  // ============================================================
  // Card 3: commandfor 与 command 的 JS 接口（DOM 属性）
  // ============================================================

  _createDynamicButton() {
    // 动态创建 button + popover，用 JS 设置 commandForElement / command
    const caps = this._caps();
    const container = this.$('#invoker-js-api-container');
    if (!container) return;
    // 清理旧元素
    if (this._dynamicBtn && this._dynamicBtn.parentNode) this._dynamicBtn.parentNode.removeChild(this._dynamicBtn);
    if (this._dynamicPopover && this._dynamicPopover.parentNode) this._dynamicPopover.parentNode.removeChild(this._dynamicPopover);

    if (!caps.commandFor) {
      this._addLog('warn', 'commandForElement 不可用：无法用 JS 动态设置 commandForElement（jsdom/旧浏览器）');
      this.setState({
        jsApiInfo: '当前环境不支持 commandForElement / command IDL 属性。\n'
          + '请用 Chrome 126+ 真实浏览器打开本页。\n'
          + '本应演示：\n'
          + '  const btn = document.createElement("button");\n'
          + '  btn.commandForElement = popoverEl;  // 等价 commandfor 属性\n'
          + '  btn.command = "toggle-popover";      // 等价 command 属性\n'
          + '  btn.invokeAction = "show-modal";     // 等价 invokeaction 属性（旧 API）\n'
          + '  btn.invokeTargetElement = dialogEl;  // 等价 invoketarget 属性（旧 API）',
      });
      return;
    }
    try {
      // 创建 popover 目标
      const popover = document.createElement('div');
      popover.id = 'invoker-dyn-popover';
      popover.setAttribute('popover', 'auto');
      popover.textContent = '我是动态创建的 popover，由 JS 设置 commandForElement 绑定的按钮触发。';
      popover.className = 'e2e-popover';
      popover.addEventListener('toggle', (e) => {
        this._addLog('info', `动态 popover toggle：${e.oldState} → ${e.newState}`);
      });
      // 创建按钮
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--sm btn--primary';
      btn.textContent = '动态按钮（JS 设置 commandForElement）';
      // ★ 核心：用 JS IDL 属性设置 commandfor + command
      btn.commandForElement = popover;
      btn.command = 'toggle-popover';
      container.appendChild(btn);
      container.appendChild(popover);
      this._dynamicBtn = btn;
      this._dynamicPopover = popover;
      // 验证读取
      const readTarget = btn.commandForElement;
      const readCommand = btn.command;
      this._addLog('info', `动态创建成功：btn.commandForElement = <${readTarget?.tagName.toLowerCase()}#${readTarget?.id}>, btn.command = "${readCommand}"`);
      this.setState({
        jsApiInfo:
          '动态创建 button + popover，用 JS IDL 属性绑定：\n'
          + '  const popover = document.createElement("div"); popover.popover = "auto";\n'
          + '  const btn = document.createElement("button");\n'
          + '  btn.commandForElement = popover;      // 等价 commandfor="invoker-dyn-popover"\n'
          + '  btn.command = "toggle-popover";        // 等价 command="toggle-popover"\n'
          + '  container.appendChild(btn); container.appendChild(popover);\n\n'
          + `读取验证：btn.commandForElement = <${readTarget?.tagName.toLowerCase()}#${readTarget?.id}>\n`
          + `           btn.command = "${readCommand}"\n\n`
          + 'IDL 属性对照：\n'
          + '  commandForElement（读写 element） ↔ HTML commandfor（id 字符串）\n'
          + '  command（读写 string）           ↔ HTML command\n'
          + '  invokeTargetElement（读写 element）↔ HTML invoketarget（旧 API）\n'
          + '  invokeAction（读写 string）       ↔ HTML invokeaction（旧 API）',
      });
    } catch (err) {
      this._addLog('warn', `动态创建抛错：${err.name} - ${err.message}`);
    }
  }

  _readJsApiProps() {
    // 读取所有 Invoker 相关 IDL 属性，演示 4 个属性的当前值
    const caps = this._caps();
    if (!caps.commandFor && !caps.invokeTarget) {
      this._addLog('warn', 'commandForElement / invokeAction 均不可用：无法读取 IDL 属性');
      this.setState({ jsApiInfo: '当前环境不支持任何 Invoker IDL 属性，无法读取。' });
      return;
    }
    const btn = this._dynamicBtn || this.$('#invoker-demo-btn');
    if (!btn) return;
    const lines = [];
    const readProp = (prop, label) => {
      try {
        const val = btn[prop];
        if (val && val.nodeType) {
          lines.push(`${label}（${prop}）= <${val.tagName.toLowerCase()}#${val.id || '(no id)'}>`);
        } else {
          lines.push(`${label}（${prop}）= ${JSON.stringify(val)}`);
        }
      } catch (err) {
        lines.push(`${label}（${prop}）读取抛错: ${err.message}`);
      }
    };
    if (caps.commandFor) {
      readProp('commandForElement', 'commandForElement');
      readProp('command', 'command');
    } else {
      lines.push('commandForElement / command：不可用（jsdom/旧浏览器）');
    }
    if (caps.invokeTarget) {
      readProp('invokeTargetElement', 'invokeTargetElement');
      readProp('invokeAction', 'invokeAction');
    } else {
      lines.push('invokeTargetElement / invokeAction：不可用（jsdom/旧浏览器）');
    }
    const info = '读取按钮的 Invoker IDL 属性：\n  ' + lines.join('\n  ');
    this._addLog('info', info.replace(/\n\s*/g, ' | '));
    this.setState({ jsApiInfo: info });
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: '3. commandfor 与 command 的 JS 接口（DOM 属性）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.commandFor ? 'success' : 'error' }, caps.commandFor ? 'commandForElement ✓' : '不可用'),
        h(Tag, { color: caps.invokeTarget ? 'success' : 'error' }, caps.invokeTarget ? 'invokeAction ✓' : '不可用'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'Invoker API 提供 4 个 IDL 属性（DOM 属性）：commandForElement（读写 button 的目标元素，对应 commandfor）、command（读写命令字符串，对应 command）、invokeTargetElement（读写调用目标，对应 invoketarget，旧 API）、invokeAction（读写调用动作，对应 invokeaction，旧 API）。实战：动态创建 button 后用 JS 设置 btn.commandForElement = popoverEl; btn.command = "toggle-popover"; 即可绑定，无需 setAttribute。'),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn('动态创建 button + popover', { type: 'primary', size: 'sm', onClick: () => this._createDynamicButton() }),
        this._btn('读取 IDL 属性', { size: 'sm', onClick: () => this._readJsApiProps() }),
      ),
      h('div', { id: 'invoker-js-api-container', class: 'flex gap-sm mt-sm flex-wrap' },
        h('span', { class: 'fs-sm text-tertiary' }, '点击"动态创建"后，按钮和 popover 会插入此处：'),
      ),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '280px', overflow: 'auto' } },
        h('code', {}, s.jsApiInfo || '（点击"动态创建 button + popover"用 JS 设置 commandForElement / command）')),
      h('pre', { class: 'code-block mt-sm' }, `// 动态创建并用 JS 绑定（无需 setAttribute）
const popover = document.createElement('div');
popover.popover = 'auto';
document.body.appendChild(popover);

const btn = document.createElement('button');
btn.textContent = '打开';
btn.commandForElement = popover;       // 等价 commandfor="..."
btn.command = 'toggle-popover';         // 等价 command="toggle-popover"
// 读取
console.log(btn.commandForElement);    // → popover 元素
console.log(btn.command);              // → "toggle-popover"

// 旧 API（invokeTargetElement / invokeAction）
btn.invokeTargetElement = dialogEl;
btn.invokeAction = 'show-modal';

// 能力检测
'commandForElement' in HTMLElement.prototype
'invokeAction' in HTMLElement.prototype`),
    );
  }

  // ============================================================
  // Card 4: CommandEvent 事件（命令事件）
  // ============================================================

  _attachCommandHandler() {
    // 创建自定义目标元素，监听 command 事件
    const caps = this._caps();
    const container = this.$('#invoker-command-container');
    if (!container) return;
    // 清理旧监听（先 detach 再清空 DOM）
    if (this._commandTarget && this._commandHandler) {
      try { this._commandTarget.removeEventListener('command', this._commandHandler); } catch { /* noop */ }
    }
    if (this._commandTarget && this._commandTarget.parentNode) this._commandTarget.parentNode.removeChild(this._commandTarget);
    if (this._commandBtn && this._commandBtn.parentNode) this._commandBtn.parentNode.removeChild(this._commandBtn);

    if (!caps.commandFor) {
      this._addLog('warn', 'commandfor 不可用：无法触发真实的 command 事件（jsdom/旧浏览器）');
      this.setState({
        commandEventInfo:
          '当前环境不支持 CommandEvent / commandfor，无法演示真实的 command 事件。\n'
          + '请用 Chrome 126+ 真实浏览器打开本页。\n'
          + '本应演示：\n'
          + '  // 自定义元素或普通 div 监听 command 事件\n'
          + '  target.addEventListener("command", (e) => {\n'
          + '    console.log(e.type);      // "command"\n'
          + '    console.log(e.command);   // 命令字符串，如 "toggle-popover" 或自定义\n'
          + '    console.log(e.invoker);   // 触发命令的 button 元素（反向引用）\n'
          + '  });\n'
          + '  // <button commandfor="target" command="--my-action">触发</button>\n'
          + '  // 点击 button → target 收到 command 事件，e.command="--my-action"\n\n'
          + '说明：popover/dialog 目标内置处理 command 事件（show/hide/toggle）。\n'
          + '仅自定义元素或非 popover/dialog 元素需要手动监听 command 事件实现自定义交互。',
      });
      return;
    }
    try {
      // 创建自定义目标（普通 div，非 popover/dialog）
      const target = document.createElement('div');
      target.id = 'invoker-command-target';
      target.className = 'invoker-target';
      target.textContent = '我是 command 事件目标（点击下方按钮触发）';
      // 监听 command 事件
      this._commandHandler = (e) => {
        const cmd = e.command || '(无)';
        const invoker = e.invoker;
        const invokerDesc = invoker ? `<button${invoker.id ? ` id="${invoker.id}"` : ''}>` : 'null';
        this._addLog('info', `command 事件触发：type="${e.type}", command="${cmd}", invoker=${invokerDesc}`);
        target.textContent = `收到 command: "${cmd}"，invoker=${invokerDesc}`;
        this.setState({
          commandEventInfo:
            `command 事件已触发：\n`
            + `  event.type = "${e.type}"\n`
            + `  event.command = "${cmd}"\n`
            + `  event.invoker = ${invokerDesc}\n\n`
            + `说明：command 事件由 button 的 commandfor+command 点击触发，目标元素接收。\n`
            + `popover/dialog 目标内置处理；自定义元素需手动监听实现自定义交互。`,
        });
      };
      target.addEventListener('command', this._commandHandler);
      // 创建触发按钮（用 commandfor + 自定义 command 字符串）
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--sm btn--primary';
      btn.textContent = '触发 command 事件（command="--greet"）';
      btn.commandForElement = target;
      btn.command = '--greet';
      container.innerHTML = '';
      container.appendChild(target);
      container.appendChild(btn);
      this._commandTarget = target;
      this._commandBtn = btn;
      this._addLog('info', '已创建 command 事件目标 + 触发按钮（command="--greet"），点击按钮触发');
      this.setState({
        commandEventInfo:
          '已创建目标 div + 触发按钮：\n'
          + '  target.addEventListener("command", handler);\n'
          + '  btn.commandForElement = target; btn.command = "--greet";\n\n'
          + '点击按钮后，target 收到 command 事件：\n'
          + '  e.type = "command"\n'
          + '  e.command = "--greet"\n'
          + '  e.invoker = 触发按钮\n\n'
          + '说明：popover/dialog 目标内置处理 command 事件；\n'
          + '自定义元素或非 popover/dialog 元素需手动监听实现自定义交互。',
      });
    } catch (err) {
      this._addLog('warn', `创建 command 事件目标抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: '4. CommandEvent 事件（命令事件）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.commandEvent ? 'success' : 'error' }, caps.commandEvent ? 'CommandEvent ✓' : '不可用'),
        h(Tag, { color: caps.commandFor ? 'success' : 'error' }, caps.commandFor ? 'command 触发 ✓' : '不可用'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '当 button（带 commandfor+command）被点击时，目标元素接收 CommandEvent（command 事件）。event.command 是命令字符串（如 "show-popover" 或自定义 "--greet"），event.invoker 是触发命令的 button 元素（反向引用），event.type 为 "command"。popover/dialog 目标内置处理 command 事件；仅自定义元素或非 popover/dialog 元素需要手动 addEventListener("command", ...) 实现自定义交互。'),
      (!caps.commandEvent || !caps.commandFor) && h(Alert, {
        type: 'warning',
        message: '当前环境不支持 CommandEvent',
        description: `CommandEvent 构造器：${caps.commandEvent ? '✓' : '✗'}；commandfor 触发：${caps.commandFor ? '✓' : '✗'}。jsdom 通常未实现。Chrome 126+ 支持。点击下方按钮仅记日志说明用法。`,
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn('创建 command 事件目标', { type: 'primary', size: 'sm', onClick: () => this._attachCommandHandler() }),
      ),
      h('div', { id: 'invoker-command-container', class: 'flex gap-sm mt-sm flex-wrap' },
        h('span', { class: 'fs-sm text-tertiary' }, '点击"创建 command 事件目标"后，目标与触发按钮插入此处：'),
      ),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '280px', overflow: 'auto' } },
        h('code', {}, s.commandEventInfo || '（点击"创建 command 事件目标"，然后点击触发按钮观察 command 事件）')),
      h('pre', { class: 'code-block mt-sm' }, `// 目标元素监听 command 事件
target.addEventListener('command', (e) => {
  console.log(e.type);    // "command"
  console.log(e.command); // 命令字符串，如 "toggle-popover" 或自定义 "--greet"
  console.log(e.invoker); // 触发命令的 button 元素（反向引用）
});

<!-- 触发：button 的 commandfor + command -->
<button commandfor="my-target" command="--greet">触发</button>
<div id="my-target">我会收到 command 事件</div>

// 说明：
// - popover/dialog 目标内置处理 command 事件（show/hide/toggle）
// - 仅自定义元素或非 popover/dialog 元素需要手动监听
// - event.invoker 是反向引用，可从目标回溯到触发按钮
// - 自定义 command 字符串（如 --greet）可用于实现任意交互

// 能力检测
typeof window.CommandEvent === 'function'  // Chrome 126+`),
    );
  }

  // ============================================================
  // Card 5: interesttarget / interestfocusdelay（悬停兴趣元素）
  // ============================================================

  _attachInterestTarget() {
    // 创建 button + tooltip，用 interesttarget 建立悬停兴趣关系
    const caps = this._caps();
    const container = this.$('#invoker-interest-container');
    if (!container) return;
    // 清理旧监听与元素
    if (this._interestTarget && this._interestHandler) {
      try { this._interestTarget.removeEventListener('toggle', this._interestHandler); } catch { /* noop */ }
    }
    if (this._interestBtn && this._interestBtn.parentNode) this._interestBtn.parentNode.removeChild(this._interestBtn);
    if (this._interestTarget && this._interestTarget.parentNode) this._interestTarget.parentNode.removeChild(this._interestTarget);

    if (!caps.interestTarget) {
      this._addLog('warn', 'interesttarget 不可用：测试环境不支持（实验性，Chrome 133+ 部分支持）');
      this.setState({
        interestInfo:
          '当前环境不支持 interesttarget / interestTargetElement。\n'
          + '该 API 仍为实验性，Chrome 133+ 部分支持。\n'
          + '本应演示：\n'
          + '  <button interesttarget="my-tooltip">按钮</button>\n'
          + '  <div id="my-tooltip" role="tooltip">提示文字</div>\n\n'
          + '  // 目标元素接收 interestevent（toggle 类型）：\n'
          + '  tooltip.addEventListener("toggle", (e) => {\n'
          + '    console.log(e.oldState, "→", e.newState);  // "inactive" → "active"\n'
          + '  });\n\n'
          + '  // interestfocusdelay 属性：从 focus 到 interest 激活的延迟（毫秒）\n'
          + '  <button interesttarget="tip" interestfocusdelay="300">按钮</button>\n\n'
          + '用途：替代 JS hover/focus 管理 tooltip 显示，声明式处理鼠标与键盘焦点兴趣。',
      });
      return;
    }
    try {
      // 创建 tooltip 目标
      const tooltip = document.createElement('div');
      tooltip.id = 'invoker-interest-tooltip';
      tooltip.className = 'invoker-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.textContent = '我是 tooltip，由 interesttarget 声明式建立兴趣关系';
      tooltip.style.display = 'none';
      // 监听 toggle 事件（interestevent 的 toggle 类型）
      this._interestHandler = (e) => {
        this._addLog('info', `interest toggle 事件：${e.oldState} → ${e.newState}`);
        tooltip.style.display = e.newState === 'active' ? 'block' : 'none';
        this.setState({
          interestInfo:
            `interest toggle 事件触发：\n`
            + `  e.oldState = "${e.oldState}"\n`
            + `  e.newState = "${e.newState}"\n\n`
            + `说明：interesttarget 建立悬停/焦点兴趣关系。\n`
            + `鼠标 hover 或键盘 focus 按钮时，tooltip 进入 "active" 态；离开时回到 "inactive"。\n`
            + `interestfocusdelay 控制 focus 到激活的延迟（毫秒）。`,
        });
      };
      tooltip.addEventListener('toggle', this._interestHandler);
      // 创建按钮（interesttarget + interestfocusdelay）
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--sm btn--primary';
      btn.textContent = '悬停/聚焦我（interesttarget）';
      btn.setAttribute('interesttarget', 'invoker-interest-tooltip');
      btn.setAttribute('interestfocusdelay', '300');
      // 也可用 IDL 属性：btn.interestTargetElement = tooltip;
      try { btn.interestTargetElement = tooltip; } catch { /* IDL 属性可能不可用，回退 setAttribute */ }
      container.innerHTML = '';
      container.appendChild(btn);
      container.appendChild(tooltip);
      this._interestBtn = btn;
      this._interestTarget = tooltip;
      this._addLog('info', '已创建 interesttarget 按钮与 tooltip（interestfocusdelay=300ms），hover/focus 按钮触发');
      this.setState({
        interestInfo:
          '已创建按钮 + tooltip：\n'
          + '  <button interesttarget="tip" interestfocusdelay="300">按钮</button>\n'
          + '  <div id="tip" role="tooltip">提示</div>\n\n'
          + 'hover 或 focus 按钮时，tooltip 收到 toggle 事件：\n'
          + '  e.oldState = "inactive" → e.newState = "active"\n\n'
          + 'interestfocusdelay=300：从键盘 focus 到 interest 激活延迟 300ms。\n'
          + '用途：声明式 tooltip / 菜单悬停管理，替代 JS hover/focus 逻辑。',
      });
    } catch (err) {
      this._addLog('warn', `创建 interesttarget 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: '5. interesttarget / interestfocusdelay（悬停兴趣元素）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.interestTarget ? 'success' : 'error' }, caps.interestTarget ? 'interesttarget ✓' : '实验性'),
        h(Tag, { color: 'warning' }, 'Chrome 133+ 部分支持'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'HTML 属性 interesttarget="target-id" 声明式建立 hover 兴趣关系（如 tooltip 指向元素）。目标元素接收 interestevent（toggle 类型），e.oldState/e.newState 为 "active"/"inactive"。interestfocusdelay 属性控制从 focus 到 interest 激活的延迟（毫秒）。用途：替代 JS hover/focus 管理 tooltip 显示，声明式处理鼠标与键盘焦点兴趣。浏览器支持：实验性，Chrome 133+ 部分支持。'),
      !caps.interestTarget && h(Alert, {
        type: 'warning',
        message: '当前环境不支持 interesttarget',
        description: '该 API 仍为实验性，Chrome 133+ 部分支持。jsdom 完全未实现。点击下方按钮仅记日志说明用法。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn('创建 interesttarget 按钮', { type: 'primary', size: 'sm', onClick: () => this._attachInterestTarget() }),
      ),
      h('div', { id: 'invoker-interest-container', class: 'flex gap-sm mt-sm flex-wrap' },
        h('span', { class: 'fs-sm text-tertiary' }, '点击"创建 interesttarget 按钮"后，按钮与 tooltip 插入此处（hover/focus 触发）：'),
      ),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '300px', overflow: 'auto' } },
        h('code', {}, s.interestInfo || '（点击"创建 interesttarget 按钮"，然后 hover/focus 按钮观察 toggle 事件）')),
      h('pre', { class: 'code-block mt-sm' }, `<!-- 声明式 tooltip：interesttarget -->
<button interesttarget="my-tooltip"
        interestfocusdelay="300">按钮</button>
<div id="my-tooltip" role="tooltip">提示文字</div>

// 目标元素监听 toggle 事件（interestevent）
tooltip.addEventListener('toggle', (e) => {
  console.log(e.oldState, '→', e.newState);
  // 'inactive' → 'active'（hover/focus 进入）
  // 'active' → 'inactive'（离开）
});

// interestfocusdelay：从 focus 到 interest 激活的延迟（毫秒）
//   键盘 focus 按钮后，延迟 300ms 才激活 tooltip
//   避免 Tab 切换时 tooltip 频繁闪烁

// IDL 属性
btn.interestTargetElement = tooltipEl;

// 用途：替代 JS hover/focus 管理 tooltip 显示
// 声明式处理鼠标与键盘焦点兴趣

// 能力检测
'interestTargetElement' in HTMLElement.prototype  // 实验性，Chrome 133+`),
    );
  }

  // ============================================================
  // Card 6: 完整实战与 vs 手动 JS（End-to-End Comparison）
  // ============================================================

  _e2eDeclarative() {
    // 声明式方式：创建 button + popover，用 commandfor + command 属性
    const caps = this._caps();
    const container = this.$('#invoker-e2e-decl-container');
    if (!container) return;
    if (this._e2eDeclBtn && this._e2eDeclBtn.parentNode) this._e2eDeclBtn.parentNode.removeChild(this._e2eDeclBtn);
    if (this._e2eDeclPopover && this._e2eDeclPopover.parentNode) this._e2eDeclPopover.parentNode.removeChild(this._e2eDeclPopover);
    try {
      const popover = document.createElement('div');
      popover.id = 'e2e-decl-popover';
      popover.setAttribute('popover', 'auto');
      popover.className = 'e2e-popover';
      popover.textContent = '声明式 popover：由 commandfor+command 触发，无 JS 依赖，可 SSR。';
      popover.addEventListener('toggle', (e) => {
        this._addLog('info', `[声明式] popover toggle：${e.oldState} → ${e.newState}`);
      });
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--sm btn--primary';
      btn.textContent = '声明式触发（commandfor）';
      if (caps.commandFor) {
        // 用 IDL 属性绑定（也可用 setAttribute）
        btn.commandForElement = popover;
        btn.command = 'toggle-popover';
      } else {
        // 降级：用 setAttribute（浏览器支持时仍生效）
        btn.setAttribute('commandfor', 'e2e-decl-popover');
        btn.setAttribute('command', 'toggle-popover');
      }
      container.innerHTML = '';
      container.appendChild(btn);
      container.appendChild(popover);
      this._e2eDeclBtn = btn;
      this._e2eDeclPopover = popover;
      const bindLine = caps.commandFor
        ? 'btn.commandForElement = popover; btn.command = "toggle-popover";（IDL 属性）'
        : 'setAttribute("commandfor", ...) + setAttribute("command", ...)（HTML 属性，浏览器支持时生效）';
      this._addLog('info', `[声明式] 已创建 button + popover，绑定方式：${bindLine}`);
      this.setState({
        e2eInfo:
          '【声明式方式】\n'
          + '  <button commandfor="p" command="toggle-popover">打开</button>\n'
          + '  <div id="p" popover>内容</div>\n'
          + `  绑定：${bindLine}\n\n`
          + '优点：\n'
          + '  • 代码更少（1 行 HTML 属性）\n'
          + '  • 无 JS 依赖（禁用 JS 仍工作）\n'
          + '  • 可 SSR（服务端渲染输出 HTML 即可用）\n'
          + '  • 浏览器原生处理焦点、Top Layer、Light Dismiss\n\n'
          + '缺点：\n'
          + '  • 灵活性低（难以加条件判断、动画）\n'
          + '  • 浏览器支持需 Chrome 126+',
      });
    } catch (err) {
      this._addLog('warn', `[声明式] 创建抛错：${err.name} - ${err.message}`);
    }
  }

  _e2eManualJs() {
    // 手动 JS 方式：创建 button + popover，用 addEventListener + togglePopover
    const caps = this._caps();
    const container = this.$('#invoker-e2e-js-container');
    if (!container) return;
    if (this._e2eJsBtn && this._e2eJsBtn.parentNode) this._e2eJsBtn.parentNode.removeChild(this._e2eJsBtn);
    if (this._e2eJsPopover && this._e2eJsPopover.parentNode) this._e2eJsPopover.parentNode.removeChild(this._e2eJsPopover);
    if (!caps.popover) {
      this._addLog('warn', '[手动 JS] Popover API（togglePopover）不可用：无法演示手动 JS 方式');
      this.setState({
        e2eInfo:
          '【手动 JS 方式】\n'
          + '  当前环境不支持 togglePopover，无法演示。\n'
          + '  本应演示：\n'
          + '    btn.addEventListener("click", () => popover.togglePopover());\n\n'
          + '优点：\n'
          + '  • 灵活（可加条件判断、动画、异步逻辑）\n'
          + '  • 浏览器支持广（Chrome 114+ 即可，无需 126+）\n'
          + '缺点：\n'
          + '  • 需写 JS（无法 SSR，禁用 JS 失效）\n'
          + '  • 需手动管理焦点、事件清理',
      });
      return;
    }
    try {
      const popover = document.createElement('div');
      popover.id = 'e2e-js-popover';
      popover.setAttribute('popover', 'auto');
      popover.className = 'e2e-popover';
      popover.textContent = '手动 JS popover：由 addEventListener("click") + togglePopover() 触发，更灵活。';
      popover.addEventListener('toggle', (e) => {
        this._addLog('info', `[手动 JS] popover toggle：${e.oldState} → ${e.newState}`);
      });
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--sm btn--primary';
      btn.textContent = '手动 JS 触发（addEventListener）';
      this._e2eJsHandler = () => {
        try {
          const result = popover.togglePopover();
          this._addLog('info', `[手动 JS] popover.togglePopover() → ${result}`);
        } catch (err) {
          this._addLog('warn', `[手动 JS] togglePopover 失败: ${err.message}`);
        }
      };
      btn.addEventListener('click', this._e2eJsHandler);
      container.innerHTML = '';
      container.appendChild(btn);
      container.appendChild(popover);
      this._e2eJsBtn = btn;
      this._e2eJsPopover = popover;
      this._addLog('info', '[手动 JS] 已创建 button + popover，绑定：btn.addEventListener("click", () => popover.togglePopover())');
      this.setState({
        e2eInfo:
          '【手动 JS 方式】\n'
          + '  const popover = document.createElement("div"); popover.popover = "auto";\n'
          + '  const btn = document.createElement("button");\n'
          + '  btn.addEventListener("click", () => popover.togglePopover());\n\n'
          + '优点：\n'
          + '  • 灵活（可加条件判断、动画、异步逻辑）\n'
          + '  • 浏览器支持广（Chrome 114+ 即可，无需 126+）\n'
          + '缺点：\n'
          + '  • 需写 JS（无法 SSR，禁用 JS 失效）\n'
          + '  • 需手动管理焦点、事件清理',
      });
    } catch (err) {
      this._addLog('warn', `[手动 JS] 创建抛错：${err.name} - ${err.message}`);
    }
  }

  _e2eProgressive() {
    // 渐进增强：能力检测 + 回退
    const caps = this._caps();
    const useDeclarative = caps.commandFor;
    this._addLog('info', `渐进增强策略：commandForElement ${useDeclarative ? '可用 → 声明式' : '不可用 → 回退手动 JS'}`);
    this.setState({
      e2eInfo:
        '【渐进增强策略】\n'
        + `  能力检测：'commandForElement' in HTMLElement.prototype → ${useDeclarative ? 'true' : 'false'}\n`
        + `  策略：${useDeclarative ? '使用声明式 commandfor+command（更简洁、可 SSR）' : '回退手动 JS addEventListener+togglePopover（兼容性更好）'}\n\n`
        + '  // 代码示例：\n'
        + '  if (\'commandForElement\' in HTMLElement.prototype) {\n'
        + '    btn.commandForElement = popover;   // 声明式\n'
        + '    btn.command = \'toggle-popover\';\n'
        + '  } else {\n'
        + '    btn.addEventListener(\'click\', () => popover.togglePopover());  // 回退 JS\n'
        + '  }\n\n'
        + '浏览器支持矩阵：\n'
        + '  • commandfor / command：Chrome 126+（2024.6）\n'
        + '  • invoketarget / invokeaction：Chrome 126+（2024.6）\n'
        + '  • interesttarget：实验性，Chrome 133+ 部分支持\n'
        + '  • Popover API（showPopover 等）：Chrome 114+ / Safari 17+ / Firefox 125+\n'
        + '  • <dialog>：Chrome 37+ / Firefox 98+ / Safari 15.4+',
    });
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: '6. 完整实战与 vs 手动 JS（End-to-End Comparison）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.commandFor ? 'success' : 'error' }, caps.commandFor ? '声明式 ✓' : '声明式 ✗'),
        h(Tag, { color: caps.popover ? 'success' : 'error' }, caps.popover ? '手动 JS ✓' : '手动 JS ✗'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '对比声明式（commandfor+command，纯 HTML）与手动 JS（addEventListener+togglePopover）。声明式代码更少、无 JS 依赖、可 SSR；手动 JS 更灵活（可加条件判断、动画）。能力检测 + 渐进增强：\'commandForElement\' in HTMLElement.prototype 为 true 用声明式，否则回退 JS。'),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn('声明式方式', { type: 'primary', size: 'sm', onClick: () => this._e2eDeclarative() }),
        this._btn('手动 JS 方式', { type: 'primary', size: 'sm', onClick: () => this._e2eManualJs() }),
        this._btn('渐进增强策略', { size: 'sm', onClick: () => this._e2eProgressive() }),
      ),
      h('div', { class: 'flex gap-md mt-sm flex-wrap' },
        h('div', { class: 'flex flex-col gap-xs' },
          h('span', { class: 'fs-sm text-secondary' }, '声明式（commandfor）：'),
          h('div', { id: 'invoker-e2e-decl-container', class: 'flex gap-xs flex-wrap' }),
        ),
        h('div', { class: 'flex flex-col gap-xs' },
          h('span', { class: 'fs-sm text-secondary' }, '手动 JS（addEventListener）：'),
          h('div', { id: 'invoker-e2e-js-container', class: 'flex gap-xs flex-wrap' }),
        ),
      ),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '320px', overflow: 'auto' } },
        h('code', {}, s.e2eInfo || '（点击"声明式方式"和"手动 JS 方式"创建对照演示，"渐进增强策略"查看能力检测回退方案）')),
      h('pre', { class: 'code-block mt-sm' }, `<!-- 声明式：纯 HTML -->
<button commandfor="p" command="toggle-popover">打开</button>
<div id="p" popover>内容</div>

// 手动 JS
const btn = document.querySelector('#btn');
const popover = document.querySelector('#p');
btn.addEventListener('click', () => popover.togglePopover());

// 渐进增强：能力检测 + 回退
if ('commandForElement' in HTMLElement.prototype) {
  btn.commandForElement = popover;        // 声明式
  btn.command = 'toggle-popover';
} else {
  btn.addEventListener('click', () => popover.togglePopover());  // 回退 JS
}

/* 浏览器支持矩阵：
 * commandfor / command       Chrome 126+ (2024.6)
 * invoketarget / invokeaction Chrome 126+ (2024.6)
 * interesttarget              实验，Chrome 133+ 部分支持
 * Popover API                 Chrome 114+ / Safari 17+ / Firefox 125+
 * <dialog>                    Chrome 37+ / Firefox 98+ / Safari 15.4+
 */`),
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
          : s.logs.map((log) => {
            const tagClass = log.type === 'error' ? 'error' : log.type === 'warn' ? 'warn' : 'info';
            return h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${tagClass}` }, log.type),
              h('span', { class: 'log-panel__content' }, log.content),
            );
          }),
      ),
    );
  }

  // ============================================================
  // 页面渲染入口
  // ============================================================

  renderPage() {
    const caps = this._caps();
    const capsSummary = `能力检测：commandfor ${caps.commandFor ? '✓' : '✗'} · invoketarget ${caps.invokeTarget ? '✓' : '✗'} · CommandEvent ${caps.commandEvent ? '✓' : '✗'} · interesttarget ${caps.interestTarget ? '✓' : '✗'} · popover ${caps.popover ? '✓' : '✗'} · <dialog> ${caps.dialog ? '✓' : '✗'}。所有 API 调用前做能力检测，不可用时仅记日志说明用法，绝不抛异常。`;
    return [
      h('h2', { class: 'section-title' }, 'Invoker 声明式交互 API'),

      h(Alert, {
        type: 'info',
        message: 'Invoker 声明式交互 API',
        description: capsSummary,
      }),

      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),

      this._renderLogPanel(),
    ];
  }
}