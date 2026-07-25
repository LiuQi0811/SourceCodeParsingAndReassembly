// =====================================================================
// AdvancedInputPage.js —— 高级输入 API 实验室
// 演示 MDN：
//   1. VirtualKeyboard API —— 虚拟键盘控制（show/hide/boundingRect/
//      overlaysContent/geometrychange）
//   2. Keyboard API —— 键盘锁定与布局映射（lock/getLayoutMap/unlock）
//   3. EyeDropper API —— 屏幕取色器（new EyeDropper / open / sRGBHex /
//      AbortSignal）
//   4. Document Picture-in-Picture API —— 文档画中画（requestWindow /
//      window / enter / leave），可放入任意 DOM
//   5. HTML Sanitizer API —— 安全 HTML 清理（allowElements / blockElements /
//      dropElements / sanitizeFor / sanitize）
//   6. InputDeviceCapabilities —— 输入设备能力（sourceCapabilities /
//      firesTouchEvents），区分鼠标 / 触摸 / 笔输入
// 说明：这些 API 主要面向真实浏览器（移动端 / 触屏 / 桌面），jsdom/Node 中多数
//       未实现或不完整，全部调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class AdvancedInputPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：VirtualKeyboard
      vkInfo: '',
      // Card 2：Keyboard lock + getLayoutMap
      keyboardInfo: '',
      // Card 3：EyeDropper
      eyeDropperResult: '',
      // Card 4：Document PiP
      pipInfo: '',
      // Card 5：HTML Sanitizer
      sanitizerInfo: '',
      // Card 6：InputDeviceCapabilities
      deviceCapInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._vkGeometryHandler = null;   // Card 1 virtualkeyboard.geometrychange 处理器
    this._eyeDropperAbort = null;     // Card 3 EyeDropper 的 AbortController
    this._pipWindow = null;           // Card 4 当前 PiP 窗口引用
    this._pipEnterHandler = null;     // Card 4 documentPictureInPicture 'enter' 处理器
    this._pipLeaveHandler = null;     // Card 4 documentPictureInPicture 'leave' 处理器
    this._pipMovedNodes = [];         // Card 4 已移动到 PiP window 的 DOM 节点引用
    this._sanitizer = null;           // Card 5 Sanitizer 实例
    this._tempElement = null;         // Card 6 临时监听元素
    this._tempElementHandler = null;  // Card 6 临时元素 click 处理器

    // 一次性能力检测：六组 API 全家桶
    const hasVK = typeof navigator !== 'undefined' && !!navigator.virtualKeyboard;
    const hasKB = typeof navigator !== 'undefined' && !!navigator.keyboard
      && typeof navigator.keyboard.lock === 'function';
    const hasEyeDropper = typeof EyeDropper !== 'undefined';
    const hasPiP = typeof documentPictureInPicture !== 'undefined';
    const hasSanitizer = typeof Sanitizer !== 'undefined';
    const hasIDC = typeof InputDeviceCapabilities !== 'undefined';

    const parts = [];
    parts.push(`VirtualKeyboard ${hasVK ? '✓' : '✗'}`);
    parts.push(`Keyboard.lock ${hasKB ? '✓' : '✗'}`);
    parts.push(`EyeDropper ${hasEyeDropper ? '✓' : '✗'}`);
    parts.push(`DocumentPiP ${hasPiP ? '✓' : '✗'}`);
    parts.push(`Sanitizer ${hasSanitizer ? '✓' : '✗'}`);
    parts.push(`InputDeviceCapabilities ${hasIDC ? '✓' : '✗'}`);

    const anySupported = hasVK || hasKB || hasEyeDropper || hasPiP || hasSanitizer || hasIDC;
    const summary = anySupported
      ? `高级输入 API 能力检测：${parts.join(' · ')}。当前环境部分 API 可用，可点击对应卡片按钮进行真实演示；未实现的 API 仍可点击按钮但仅记日志说明，不会抛异常。`
      : `高级输入 API 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）上述 API 全部未实现或未完整，所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（桌面 / 移动 Chrome / Edge）中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(anySupported ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasVK) this._addLog('warn', 'VirtualKeyboard 不可用（需移动端浏览器）');
    if (!hasKB) this._addLog('warn', 'Keyboard.lock 不可用（需桌面全屏场景）');
    if (!hasEyeDropper) this._addLog('warn', 'EyeDropper 不可用（需 Chrome / Edge 桌面版）');
    if (!hasPiP) this._addLog('warn', 'DocumentPiP 不可用（需 Chrome / Edge 桌面版）');
    if (!hasSanitizer) this._addLog('warn', 'Sanitizer 不可用（需 Firefox 实验性或 polyfill）');
    if (!hasIDC) this._addLog('warn', 'InputDeviceCapabilities 不可用（仅 Blink 内核，可能已 polyfill）');
  }

  componentWillUnmount() {
    // 释放 VirtualKeyboard geometrychange 监听
    if (this._vkGeometryHandler && typeof navigator !== 'undefined' && navigator.virtualKeyboard) {
      try { navigator.virtualKeyboard.removeEventListener('geometrychange', this._vkGeometryHandler); } catch { /* noop */ }
    }
    this._vkGeometryHandler = null;
    // 取消 EyeDropper（触发 AbortSignal）
    if (this._eyeDropperAbort) {
      try { this._eyeDropperAbort.abort(); } catch { /* noop */ }
    }
    this._eyeDropperAbort = null;
    // 关闭 Document PiP 窗口
    if (this._pipWindow) { try { this._pipWindow.close(); } catch { /* noop */ } }
    this._pipWindow = null;
    // 解绑 PiP enter / leave 事件
    if (typeof documentPictureInPicture !== 'undefined') {
      if (this._pipEnterHandler) {
        try { documentPictureInPicture.removeEventListener('enter', this._pipEnterHandler); } catch { /* noop */ }
      }
      if (this._pipLeaveHandler) {
        try { documentPictureInPicture.removeEventListener('leave', this._pipLeaveHandler); } catch { /* noop */ }
      }
    }
    this._pipEnterHandler = null;
    this._pipLeaveHandler = null;
    this._pipMovedNodes = [];
    // 移除临时监听元素
    if (this._tempElement && this._tempElementHandler) {
      try { this._tempElement.removeEventListener('click', this._tempElementHandler); } catch { /* noop */ }
    }
    this._tempElement = null;
    this._tempElementHandler = null;
    // Sanitizer 无显式释放 API，置空引用让引擎回收
    this._sanitizer = null;
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

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    return {
      vk: typeof navigator !== 'undefined' && !!navigator.virtualKeyboard,
      kb: typeof navigator !== 'undefined' && !!navigator.keyboard
        && typeof navigator.keyboard.lock === 'function',
      eyeDropper: typeof EyeDropper !== 'undefined',
      pip: typeof documentPictureInPicture !== 'undefined',
      sanitizer: typeof Sanitizer !== 'undefined',
      idc: typeof InputDeviceCapabilities !== 'undefined',
    };
  }

  // =================== Card 1：VirtualKeyboard API ===================

  // navigator.virtualKeyboard.boundingRect / overlaysContent：读取虚拟键盘状态
  _readVKInfo() {
    if (!this._caps().vk) {
      this._addLog('warn', 'navigator.virtualKeyboard 不可用，需真实移动端浏览器或显式启用');
      return;
    }
    try {
      const vk = navigator.virtualKeyboard;
      const rect = vk.boundingRect;         // { x, y, width, height }
      const overlays = vk.overlaysContent;  // boolean
      this.setState({
        vkInfo:
          `navigator.virtualKeyboard 状态读取：\n` +
          `vk.boundingRect = ${JSON.stringify(rect)}（键盘占用的屏幕区域，单位像素）\n` +
          `vk.overlaysContent = ${overlays}（true 时由网页自行处理布局，不挤压 viewport；boundingRect 为 0 表示键盘未显示）`,
      });
      this._addLog('vk', `读取 VirtualKeyboard：boundingRect=${JSON.stringify(rect)}，overlaysContent=${overlays}`);
    } catch (err) {
      this._addLog('warn', `读取 VirtualKeyboard 失败：${err.name} - ${err.message}`);
    }
  }

  // navigator.virtualKeyboard.show() / hide()：显式控制虚拟键盘（需 virtualkeyboardpolicy="manual"）
  _showVK() {
    if (!this._caps().vk) {
      this._addLog('warn', 'navigator.virtualKeyboard.show 不可用，需触屏设备且 virtualkeyboardpolicy="manual"');
      return;
    }
    try {
      navigator.virtualKeyboard.show();
      this._addLog('vk', '调用 virtualKeyboard.show() 请求显示虚拟键盘');
      this._readVKInfo();
    } catch (err) {
      this._addLog('warn', `show() 失败：${err.name} - ${err.message}`);
    }
  }

  _hideVK() {
    if (!this._caps().vk) {
      this._addLog('warn', 'navigator.virtualKeyboard.hide 不可用');
      return;
    }
    try {
      navigator.virtualKeyboard.hide();
      this._addLog('vk', '调用 virtualKeyboard.hide() 请求隐藏虚拟键盘');
      this._readVKInfo();
    } catch (err) {
      this._addLog('warn', `hide() 失败：${err.name} - ${err.message}`);
    }
  }

  // 切换 overlaysContent：true 时不挤压 viewport，由网页自行布局
  _toggleOverlays() {
    if (!this._caps().vk) {
      this._addLog('warn', 'navigator.virtualKeyboard.overlaysContent 不可用');
      return;
    }
    try {
      const vk = navigator.virtualKeyboard;
      const before = vk.overlaysContent;
      vk.overlaysContent = !before;
      const after = vk.overlaysContent;
      this._readVKInfo();
      this._addLog('vk', `overlaysContent：${before} → ${after}`);
    } catch (err) {
      this._addLog('warn', `切换 overlaysContent 失败：${err.name} - ${err.message}`);
    }
  }

  // 监听 geometrychange 事件：键盘高度变化时触发
  _listenGeometry() {
    if (!this._caps().vk) {
      this._addLog('warn', 'navigator.virtualKeyboard.geometrychange 不可用');
      return;
    }
    if (this._vkGeometryHandler) {
      this._addLog('warn', '已存在 geometrychange 监听器，请先关闭页面再演示');
      return;
    }
    try {
      const handler = (ev) => {
        const rect = ev.target.boundingRect;
        this._addLog('vk', `geometrychange 触发：boundingRect=${JSON.stringify(rect)}`);
        this._readVKInfo();
      };
      navigator.virtualKeyboard.addEventListener('geometrychange', handler);
      this._vkGeometryHandler = handler;
      this._addLog('vk', '已绑定 geometrychange 监听器，键盘高度变化时将记日志');
    } catch (err) {
      this._addLog('warn', `绑定 geometrychange 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. VirtualKeyboard API（虚拟键盘控制）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.vk ? 'success' : 'error' }, caps.vk ? 'VirtualKeyboard ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'show / hide / geometrychange'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.virtualKeyboard 提供对虚拟键盘的显式控制：show() / hide() 显示或隐藏键盘（需 virtualkeyboardpolicy="manual"）；boundingRect 返回键盘占用的屏幕区域 { x, y, width, height }；overlaysContent 为 true 时由网页自行处理布局而不挤压 viewport；geometrychange 事件在键盘高度变化时触发。常用于自定义输入框的虚拟键盘行为。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取状态', { type: 'primary', size: 'sm', disabled: !caps.vk, onClick: () => this._readVKInfo() }),
          this._btn('show()', { type: 'primary', size: 'sm', disabled: !caps.vk, onClick: () => this._showVK() }),
          this._btn('hide()', { size: 'sm', disabled: !caps.vk, onClick: () => this._hideVK() }),
          this._btn('切换 overlays', { size: 'sm', disabled: !caps.vk, onClick: () => this._toggleOverlays() }),
          this._btn('监听 geometrychange', { type: 'primary', size: 'sm', disabled: !caps.vk, onClick: () => this._listenGeometry() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'VirtualKeyboard 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.vkInfo || '（点击「读取状态」等按钮）')),
        h(Alert, {
          type: 'info',
          message: 'virtualkeyboardpolicy HTML 属性决定控制权',
          description: '默认 auto：浏览器自动管理；设为 manual：网页通过 show() / hide() 显式控制。overlaysContent=true 时不挤压 viewport。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Keyboard API（lock + getLayoutMap）===================

  // navigator.keyboard.lock([keyCodes...]) → Promise<void>：锁定按键，全屏下生效
  async _lockKeys() {
    if (!this._caps().kb) {
      this._addLog('warn', 'navigator.keyboard.lock 不可用，需桌面浏览器全屏场景');
      return;
    }
    try {
      this._addLog('kb', '调用 navigator.keyboard.lock(["AltLeft", "AltRight"])…');
      await navigator.keyboard.lock(['AltLeft', 'AltRight']);   // 锁定 Alt 键，全屏下生效
      this.setState({
        keyboardInfo:
          `navigator.keyboard.lock(["AltLeft", "AltRight"]) → Promise<void> ✓（已 resolve）\n` +
          `说明：lock 后浏览器快捷键被拦截（如 Alt+Tab）；仅 document.fullscreenElement 非空时真正生效。\n` +
          `keyCodes 取 KeyboardEvent.code 值（如 "KeyW" / "ArrowUp" / "AltLeft"）。`,
      });
      this._addLog('kb', 'keyboard.lock 成功（已锁定 AltLeft / AltRight，需全屏才生效）');
    } catch (err) {
      this._addLog('warn', `lock 失败：${err.name} - ${err.message}`);
      this.setState({ keyboardInfo: `lock 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.keyboard.getLayoutMap() → Promise<Map>：返回按键代码 → 标准名称映射
  async _getLayoutMap() {
    if (!this._caps().kb) {
      this._addLog('warn', 'navigator.keyboard.getLayoutMap 不可用');
      return;
    }
    try {
      this._addLog('kb', '调用 navigator.keyboard.getLayoutMap()…');
      const layoutMap = await navigator.keyboard.getLayoutMap();   // → Map<string, string>
      // 取几个常见按键的映射
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'Space', 'Digit1'];
      const entries = [];
      for (const code of keys) {
        const name = layoutMap.get(code);
        entries.push(`${code} → ${name === undefined ? '(无)' : `"${name}"`}`);
      }
      const size = layoutMap.size;
      this.setState({
        keyboardInfo:
          `navigator.keyboard.getLayoutMap() → Map(${size} 项) ✓\n` +
          `常见按键映射（code → 标准名称）：\n` +
          entries.map((e) => `  ${e}`).join('\n') +
          `\n\n说明：返回 code → 标准名称映射，可适配 QWERTY / AZERTY / Dvorak；\n` +
          `code 是物理按键位置（不受布局影响），key 是逻辑键值（受布局影响）。`,
      });
      this._addLog('kb', `getLayoutMap 成功：Map 共 ${size} 项，KeyW="${layoutMap.get('KeyW')}"`);
    } catch (err) {
      this._addLog('warn', `getLayoutMap 失败：${err.name} - ${err.message}`);
      this.setState({ keyboardInfo: `getLayoutMap 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.keyboard.unlock()：解锁按键
  _unlockKeys() {
    if (!this._caps().kb) {
      this._addLog('warn', 'navigator.keyboard.unlock 不可用');
      return;
    }
    try {
      navigator.keyboard.unlock();
      this._addLog('kb', '调用 keyboard.unlock() 解除按键锁定');
      this.setState({
        keyboardInfo:
          `navigator.keyboard.unlock() 已调用\n` +
          `说明：解除 lock() 设置的按键锁定，浏览器快捷键恢复正常；之前未 lock 则无副作用。`,
      });
    } catch (err) {
      this._addLog('warn', `unlock 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Keyboard API（键盘锁定与布局映射）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.kb ? 'success' : 'error' }, caps.kb ? 'Keyboard ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'lock / getLayoutMap / unlock'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.keyboard 提供键盘锁定与布局映射能力。lock([keyCodes...]) → Promise<void> 锁定特定按键（如 ["AltLeft", "AltRight"]），全屏下生效，锁定后浏览器快捷键被拦截；unlock() 解锁；getLayoutMap() → Promise<Map> 返回按键代码（KeyboardEvent.code）到标准名称的映射，用于游戏 / 自定义键盘布局检测。KeyboardEvent.code 是物理按键位置（不受布局影响），KeyboardEvent.key 是逻辑键值（受布局影响）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('lock 锁定 Alt', { type: 'primary', size: 'sm', disabled: !caps.kb, onClick: () => this._lockKeys() }),
          this._btn('getLayoutMap', { type: 'primary', size: 'sm', disabled: !caps.kb, onClick: () => this._getLayoutMap() }),
          this._btn('unlock 解锁', { size: 'sm', disabled: !caps.kb, onClick: () => this._unlockKeys() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Keyboard 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.keyboardInfo || '（点击「lock 锁定 Alt」「getLayoutMap」等按钮）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`await navigator.keyboard.lock(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown']);
const map = await navigator.keyboard.getLayoutMap();
map.get('KeyW');                    // QWERTY: "w"，AZERTY: "z"
navigator.keyboard.unlock();         // 退出游戏时解锁`)),
        h(Alert, {
          type: 'warning',
          message: 'lock 需要全屏 + 用户激活',
          description: 'keyboard.lock() 必须在 document.fullscreenElement 非空且由用户手势触发时才真正生效；非全屏调用 Promise 仍 resolve 但不拦截快捷键。锁定后浏览器快捷键被网页接管，需谨慎使用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：EyeDropper API ===================

  // new EyeDropper().open() → Promise<{ sRGBHex }>：打开屏幕取色器
  async _openEyeDropper() {
    if (!this._caps().eyeDropper) {
      this._addLog('warn', 'EyeDropper 不可用，需 Chrome / Edge 桌面版（typeof EyeDropper === "undefined"）');
      return;
    }
    try {
      this._addLog('eye', '调用 new EyeDropper().open()…');
      const eyeDropper = new EyeDropper();            // 构造器
      const result = await eyeDropper.open();         // → { sRGBHex: "#rrggbb" }
      const hex = result.sRGBHex;
      this.setState({
        eyeDropperResult:
          `new EyeDropper() → eyeDropper\n` +
          `eyeDropper.open() → { sRGBHex } ✓\n` +
          `返回值：{ sRGBHex: "${hex}" }\n` +
          `说明：用户选取颜色后 resolve 返回十六进制值；按 Esc 取消则 Promise reject（AbortError）。`,
      });
      this._addLog('eye', `取色成功：sRGBHex="${hex}"`);
    } catch (err) {
      this._addLog('warn', `EyeDropper 失败：${err.name} - ${err.message}（用户取消或环境不支持）`);
      this.setState({ eyeDropperResult: `EyeDropper 失败：${err.name} - ${err.message}` });
    }
  }

  // open({ signal }) 用 AbortSignal 取消取色
  async _openWithAbort() {
    if (!this._caps().eyeDropper) {
      this._addLog('warn', 'EyeDropper 不可用，无法演示 AbortSignal 取消');
      return;
    }
    // 释放旧的 AbortController
    if (this._eyeDropperAbort) {
      try { this._eyeDropperAbort.abort(); } catch { /* noop */ }
    }
    this._eyeDropperAbort = new AbortController();
    const signal = this._eyeDropperAbort.signal;
    try {
      this._addLog('eye', '调用 open({ signal })，3 秒后自动 abort…');
      const eyeDropper = new EyeDropper();
      // 3 秒后自动取消（演示 AbortSignal 用法）
      const timer = setTimeout(() => {
        try { this._eyeDropperAbort.abort(); } catch { /* noop */ }
        this._addLog('eye', 'AbortController.abort() 已触发，取色器应被取消');
      }, 3000);
      const result = await eyeDropper.open({ signal });
      clearTimeout(timer);
      this._eyeDropperAbort = null;
      this.setState({
        eyeDropperResult:
          `eyeDropper.open({ signal }) → { sRGBHex } ✓（在 3 秒内完成取色）\n` +
          `返回值：{ sRGBHex: "${result.sRGBHex}" }\n` +
          `说明：options.signal 接收 AbortSignal，abort() 后 Promise reject 为 AbortError，常用于切换页面 / 关闭弹窗时取消取色。`,
      });
      this._addLog('eye', `取色成功（带 AbortSignal）：sRGBHex="${result.sRGBHex}"`);
    } catch (err) {
      this._eyeDropperAbort = null;
      const isAbort = err.name === 'AbortError';
      this._addLog(isAbort ? 'eye' : 'warn',
        `open({ signal }) 结束：${err.name} - ${err.message}${isAbort ? '（AbortSignal 已生效）' : ''}`);
      this.setState({
        eyeDropperResult:
          `eyeDropper.open({ signal }) 结果：${err.name} - ${err.message}\n` +
          (isAbort ? '说明：AbortSignal 生效，取色被取消（演示成功）。\n' : '') +
          `AbortController.abort() 触发后，open() 的 Promise reject 为 AbortError。`,
      });
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. EyeDropper API（屏幕取色器）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.eyeDropper ? 'success' : 'error' }, caps.eyeDropper ? 'EyeDropper ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'open / sRGBHex / AbortSignal'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'EyeDropper API 让网页读取屏幕任意位置的颜色。new EyeDropper() 构造取色器实例；eyeDropper.open(options) → Promise<{ sRGBHex }> 打开取色器，用户选取颜色后 resolve 十六进制值（如 "#3a7bd5"）；options.signal 接收 AbortSignal 可中途取消。常用于设计工具 / 取色场景。需 Chrome / Edge 桌面版支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('open() 取色', { type: 'primary', size: 'sm', disabled: !caps.eyeDropper, onClick: () => this._openEyeDropper() }),
          this._btn('open({ signal }) 3秒取消', { type: 'primary', size: 'sm', disabled: !caps.eyeDropper, onClick: () => this._openWithAbort() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'EyeDropper 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.eyeDropperResult || '（点击「open() 取色」按钮）')),
        h(Alert, {
          type: 'info',
          message: 'EyeDropper 可读取屏幕任意位置颜色',
          description: '与 <input type="color"> 不同，EyeDropper 可取整个屏幕（含其他应用窗口）的像素颜色。权限由用户每次显式确认，ESC 可取消。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Document Picture-in-Picture ===================

  // documentPictureInPicture.requestWindow({ width, height }) → Promise<Window>
  async _requestPipWindow() {
    if (!this._caps().pip) {
      this._addLog('warn', 'documentPictureInPicture 不可用，需 Chrome / Edge 桌面版');
      return;
    }
    // 先关闭旧的 PiP 窗口
    if (this._pipWindow) {
      try { this._pipWindow.close(); } catch { /* noop */ }
      this._pipWindow = null;
    }
    try {
      this._addLog('pip', '调用 documentPictureInPicture.requestWindow({ width: 320, height: 240 })…');
      const pipWindow = await documentPictureInPicture.requestWindow({
        width: 320,
        height: 240,
      });                                              // → Window（独立 PiP 窗口）
      this._pipWindow = pipWindow;
      this.setState({
        pipInfo:
          `documentPictureInPicture.requestWindow({ width: 320, height: 240 }) → Window ✓\n` +
          `pipWindow === documentPictureInPicture.window: ${pipWindow === documentPictureInPicture.window}\n` +
          `pipWindow.document.body 初始为空，可 appendChild 移动 DOM 元素\n` +
          `说明：返回的 window 是独立 PiP 窗口（区别于 video PiP 仅限 video，文档 PiP 可放任意 DOM）。`,
      });
      this._addLog('pip', `PiP 窗口已创建：width=${pipWindow.innerWidth}, height=${pipWindow.innerHeight}`);
    } catch (err) {
      this._addLog('warn', `requestWindow 失败：${err.name} - ${err.message}`);
      this.setState({ pipInfo: `requestWindow 失败：${err.name} - ${err.message}` });
    }
  }

  // 向 PiP window.document.body 移动元素
  _moveToPip() {
    if (!this._caps().pip) {
      this._addLog('warn', 'documentPictureInPicture 不可用');
      return;
    }
    if (!this._pipWindow) {
      this._addLog('warn', '请先点击「requestWindow 创建 PiP」');
      return;
    }
    try {
      const pipDoc = this._pipWindow.document;
      // 构造一个简易内容元素并放入 PiP window
      const container = pipDoc.createElement('div');
      container.style.fontFamily = 'sans-serif';
      container.style.padding = '12px';
      container.style.color = '#222';
      container.innerHTML =
        '<h3 style="margin:0 0 8px">PiP 文档内容</h3>' +
        '<p style="margin:0 0 8px;font-size:14px">这是移动到画中画窗口的 DOM 元素，与原页面完全解耦。</p>' +
        '<button style="padding:6px 12px">PiP 内按钮</button>';
      pipDoc.body.appendChild(container);
      this._pipMovedNodes.push(container);
      this.setState({
        pipInfo:
          `已向 PiP window.document.body 移动 DOM 元素 ✓\n` +
          `pipWindow.document.body.childNodes.length = ${pipDoc.body.childNodes.length}\n` +
          `说明：PiP window 是独立 Window，appendChild 后元素"搬家"到 PiP 窗口，事件 / 样式需在 PiP 上下文处理。`,
      });
      this._addLog('pip', `已移动 DOM 到 PiP body，childNodes=${pipDoc.body.childNodes.length}`);
    } catch (err) {
      this._addLog('warn', `移动 DOM 到 PiP 失败：${err.name} - ${err.message}`);
    }
  }

  // 关闭 PiP 窗口
  _closePip() {
    if (!this._caps().pip) {
      this._addLog('warn', 'documentPictureInPicture 不可用');
      return;
    }
    if (!this._pipWindow) {
      this._addLog('warn', '当前无 PiP 窗口');
      return;
    }
    try {
      this._pipWindow.close();                          // 关闭 PiP 窗口
      this._addLog('pip', '已调用 pipWindow.close() 关闭 PiP 窗口');
      this._pipWindow = null;
      this._pipMovedNodes = [];
      this.setState({
        pipInfo:
          `pipWindow.close() 已调用\n` +
          `说明：关闭后 documentPictureInPicture.window 变为 null 并触发 'leave' 事件；移入 PiP 的 DOM 元素不会自动回到原页面（需手动 appendChild 回原 document.body）。`,
      });
    } catch (err) {
      this._addLog('warn', `close 失败：${err.name} - ${err.message}`);
    }
  }

  // 监听 enter / leave 事件
  _listenPipEvents() {
    if (!this._caps().pip) {
      this._addLog('warn', 'documentPictureInPicture 不可用');
      return;
    }
    if (this._pipEnterHandler && this._pipLeaveHandler) {
      this._addLog('warn', '已存在 enter / leave 监听器');
      return;
    }
    try {
      const enterHandler = () => {
        this._addLog('pip', 'documentPictureInPicture "enter" 事件触发（PiP 窗口已打开）');
      };
      const leaveHandler = () => {
        this._addLog('pip', 'documentPictureInPicture "leave" 事件触发（PiP 窗口已关闭）');
        this._pipWindow = null;
        this._pipMovedNodes = [];
      };
      documentPictureInPicture.addEventListener('enter', enterHandler);
      documentPictureInPicture.addEventListener('leave', leaveHandler);
      this._pipEnterHandler = enterHandler;
      this._pipLeaveHandler = leaveHandler;
      this._addLog('pip', '已绑定 enter / leave 事件监听器');
    } catch (err) {
      this._addLog('warn', `绑定 enter / leave 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Document Picture-in-Picture API（文档画中画）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.pip ? 'success' : 'error' }, caps.pip ? 'DocumentPiP ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'requestWindow / enter / leave'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Document Picture-in-Picture API 允许把任意 DOM 元素放入独立画中画窗口。documentPictureInPicture.requestWindow({ width, height }) → Promise<Window> 创建 PiP 窗口，返回的 window 是独立 Window，可向其 document.body appendChild 移动 DOM 元素；documentPictureInPicture.window 引用当前 PiP 窗口；enter / leave 事件在 PiP 窗口打开 / 关闭时触发。区别于 HTMLVideoElement.requestPictureInPicture（仅限 video），文档 PiP 可放任意 DOM（如字幕、控制面板、视频会议控件）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('requestWindow 创建 PiP', { type: 'primary', size: 'sm', disabled: !caps.pip, onClick: () => this._requestPipWindow() }),
          this._btn('移动 DOM 到 PiP', { type: 'primary', size: 'sm', disabled: !caps.pip, onClick: () => this._moveToPip() }),
          this._btn('监听 enter/leave', { size: 'sm', disabled: !caps.pip, onClick: () => this._listenPipEvents() }),
          this._btn('close 关闭 PiP', { danger: true, size: 'sm', disabled: !caps.pip, onClick: () => this._closePip() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Document PiP 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.pipInfo || '（点击「requestWindow 创建 PiP」按钮）')),
        h(Alert, {
          type: 'info',
          message: '文档 PiP 与视频 PiP 的区别',
          description: 'HTMLVideoElement.requestPictureInPicture 仅限 video 镜像；documentPictureInPicture 可放入任意 DOM（按钮 / 表单 / canvas / 字幕），PiP 窗口是完全独立的 Window 上下文。需用户激活且仅一个 PiP 同时存在。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：HTML Sanitizer API ===================

  // new Sanitizer(config) → sanitizer：创建带配置的清理器
  _createSanitizer() {
    if (!this._caps().sanitizer) {
      this._addLog('warn', 'Sanitizer 不可用，需 Firefox 实验性或 polyfill（typeof Sanitizer === "undefined"）');
      return;
    }
    try {
      // 自定义配置：允许特定元素与属性，屏蔽 script / iframe
      const sanitizer = new Sanitizer({
        allowElements: ['div', 'p', 'span', 'b', 'i', 'em', 'strong', 'a', 'ul', 'li', 'br'],
        blockElements: ['script', 'iframe', 'object', 'embed'],
        dropElements: ['style'],
        allowAttributes: {
          'a': ['href', 'title'],
          '*': ['class'],
        },
        dropAttributes: {
          '*': ['onerror', 'onclick', 'onload', 'onmouseover'],
        },
        allowComments: false,
        allowCustomElements: false,
      });
      this._sanitizer = sanitizer;
      this.setState({
        sanitizerInfo:
          `new Sanitizer(config) 创建清理器 ✓\n` +
          `config.allowElements = ['div', 'p', 'span', 'b', 'i', 'em', 'strong', 'a', 'ul', 'li', 'br']\n` +
          `config.blockElements = ['script', 'iframe', 'object', 'embed']（移除元素但保留子内容）\n` +
          `config.dropElements = ['style']（连同子内容一并删除）\n` +
          `config.allowAttributes = { a: ['href', 'title'], '*': ['class'] }\n` +
          `config.dropAttributes = { '*': ['onerror', 'onclick', 'onload'] }；allowComments / allowCustomElements = false\n` +
          `说明：blockElements 移除元素标签但保留子节点；dropElements 连同子节点删除。`,
      });
      this._addLog('san', '已创建带配置的 Sanitizer 实例');
    } catch (err) {
      this._addLog('warn', `创建 Sanitizer 失败：${err.name} - ${err.message}`);
    }
  }

  // sanitizer.sanitizeFor('div', input) → Element：清理并返回指定元素
  _sanitizeDiv() {
    if (!this._caps().sanitizer) {
      this._addLog('warn', 'Sanitizer 不可用');
      return;
    }
    try {
      // 构造含 XSS 的输入：onerror 脚本、script 标签、javascript: URL
      const evilInput =
        '<div class="ok" onclick="alert(1)">' +
        '<b>粗体</b><script>alert(2)</script>' +
        '<img src=x onerror=alert(3)>' +
        '<a href="javascript:alert(4)">恶意链接</a>' +
        '<a href="https://example.com" title="正常">正常链接</a>' +
        '</div>';
      // 使用已 _createSanitizer 创建的自定义配置，否则用默认配置
      const sanitizer = this._sanitizer || new Sanitizer();
      const cleaned = sanitizer.sanitizeFor('div', evilInput); // → HTMLDivElement
      const cleanedHtml = cleaned.innerHTML;
      this.setState({
        sanitizerInfo:
          `sanitizer.sanitizeFor('div', input) → HTMLDivElement ✓\n` +
          `原始输入（含 XSS）：\n${evilInput}\n\n` +
          `清理后 innerHTML：\n${cleanedHtml}\n\n` +
          `对比：onclick / onerror 等 on* 属性已移除（dropAttributes）；<script> 已移除（blockElements）；href="javascript:..." 已过滤；正常 <a> 保留。\n` +
          `说明：默认配置即可去除所有脚本相关内容；sanitizeFor 返回指定元素类型的 Element。`,
      });
      this._addLog('san', `sanitizeFor 完成：清理后长度 ${cleanedHtml.length}，已去除 script / on* / javascript:`);
    } catch (err) {
      this._addLog('warn', `sanitizeFor 失败：${err.name} - ${err.message}`);
    }
  }

  // sanitizer.sanitize(input) → DocumentFragment：返回文档片段
  _sanitizeFragment() {
    if (!this._caps().sanitizer) {
      this._addLog('warn', 'Sanitizer 不可用');
      return;
    }
    try {
      const input = '<p>段落</p><script>bad()</script><b>加粗</b><!--注释-->';
      const sanitizer = this._sanitizer || new Sanitizer();
      const fragment = sanitizer.sanitize(input);             // → DocumentFragment
      const childCount = fragment.childNodes.length;
      const html = Array.from(fragment.childNodes)
        .map((n) => (n.nodeType === 1 ? `<${n.nodeName.toLowerCase()}>` : n.nodeName))
        .join(', ');
      this.setState({
        sanitizerInfo:
          `sanitizer.sanitize(input) → DocumentFragment ✓\n` +
          `输入：${input}\n` +
          `返回 DocumentFragment，childNodes.length = ${childCount}\n` +
          `子节点序列：${html}\n\n` +
          `说明：sanitize 返回 DocumentFragment（轻量、可批量 appendChild）；sanitizeFor 返回指定元素。默认配置移除 script / 注释 / on* / javascript:。`,
      });
      this._addLog('san', `sanitize 返回 DocumentFragment，子节点 ${childCount} 个（已去除 script / 注释）`);
    } catch (err) {
      this._addLog('warn', `sanitize 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. HTML Sanitizer API（安全 HTML 清理）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.sanitizer ? 'success' : 'error' }, caps.sanitizer ? 'Sanitizer ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'allowElements / sanitizeFor / sanitize'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Sanitizer API 提供安全的 HTML 清理能力。new Sanitizer(config) 构造清理器，config.allowElements / blockElements / dropElements 控制元素白 / 黑名单；allowAttributes / dropAttributes 控制属性；allowComments / allowCustomElements 控制注释与自定义元素。sanitizer.sanitizeFor(elementName, input) → Element 返回指定元素类型的清理结果（如 sanitizeFor("div", html)）；sanitizer.sanitize(input) → DocumentFragment 返回文档片段。默认配置去除所有脚本相关内容（script / on* 属性 / javascript: URL），用于安全渲染用户输入 HTML。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Sanitizer', { type: 'primary', size: 'sm', disabled: !caps.sanitizer, onClick: () => this._createSanitizer() }),
          this._btn('sanitizeFor(div)', { type: 'primary', size: 'sm', disabled: !caps.sanitizer, onClick: () => this._sanitizeDiv() }),
          this._btn('sanitize(fragment)', { size: 'sm', disabled: !caps.sanitizer, onClick: () => this._sanitizeFragment() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Sanitizer 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.sanitizerInfo || '（点击「创建 Sanitizer」或「sanitizeFor(div)」按钮）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`const sanitizer = new Sanitizer({
  allowElements: ['div', 'p', 'b', 'i', 'a'],
  dropAttributes: { '*': ['onerror', 'onclick'] },
});
const userHTML = '<b>ok</b><script>bad()</script><img src=x onerror=alert(1)>';
const div = sanitizer.sanitizeFor('div', userHTML);  // script / onerror 已移除
container.replaceChildren(div);    // 安全插入（也可用 sanitize → DocumentFragment）`)),
        h(Alert, {
          type: 'warning',
          message: 'Sanitizer 优于手动 innerHTML 过滤',
          description: '相比正则 / DOM 手动剔除，Sanitizer 由浏览器实现，能正确处理嵌套、编码绕过、SVG / MathML 命名空间等边界。Element.setHTML(html, { sanitizer }) 是配套 API。当前 Firefox 实验性支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：InputDeviceCapabilities ===================

  // 检测 InputDeviceCapabilities 构造器与原型
  _checkCapabilities() {
    if (typeof InputDeviceCapabilities === 'undefined') {
      this._addLog('warn', 'InputDeviceCapabilities 不可用（仅 Blink 内核支持，可能已 polyfill）');
      this.setState({
        deviceCapInfo:
          `InputDeviceCapabilities 能力检测：\n` +
          `typeof InputDeviceCapabilities === "undefined"\n` +
          `说明：该 API 仅 Blink 内核（Chrome / Edge）支持，jsdom 中可能未定义或已 polyfill。\n` +
          `真实浏览器中可 new InputDeviceCapabilities({ firesTouchEvents: true }) 构造，但通常直接从 event.sourceCapabilities 读取。`,
      });
      return;
    }
    try {
      const caps2 = new InputDeviceCapabilities({ firesTouchEvents: false });
      const firesTouch = caps2.firesTouchEvents;
      const isFunc = typeof InputDeviceCapabilities === 'function';
      this.setState({
        deviceCapInfo:
          `InputDeviceCapabilities 能力检测 ✓\n` +
          `typeof InputDeviceCapabilities === "${typeof InputDeviceCapabilities}"（${isFunc ? '构造器' : '非构造器'}）\n` +
          `new InputDeviceCapabilities({ firesTouchEvents: false }) → 实例\n` +
          `caps.firesTouchEvents = ${firesTouch}\n` +
          `说明：firesTouchEvents 是唯一标准属性（true=触屏 / false=鼠标·笔），通常从 event.sourceCapabilities 读取。`,
      });
      this._addLog('idc', `InputDeviceCapabilities 可用：构造实例 firesTouchEvents=${firesTouch}`);
    } catch (err) {
      this._addLog('warn', `InputDeviceCapabilities 检测失败：${err.name} - ${err.message}`);
    }
  }

  // 创建临时元素并监听 click，读取 event.sourceCapabilities.firesTouchEvents
  _createTempElement() {
    if (typeof document === 'undefined') {
      this._addLog('warn', 'document 不可用');
      return;
    }
    try {
      // 先清理旧的临时元素与监听器
      if (this._tempElement && this._tempElementHandler) {
        try { this._tempElement.removeEventListener('click', this._tempElementHandler); } catch { /* noop */ }
      }
      const el = document.createElement('div');
      el.textContent = '点击此区域以触发事件（事件来源会被记录）';
      const idcType = typeof InputDeviceCapabilities !== 'undefined' ? '"function"' : '"undefined"';
      const handler = (ev) => {
        // event.sourceCapabilities：InputDeviceCapabilities 实例或 null（jsdom 中通常为 null）
        const srcCaps = ev.sourceCapabilities;
        const firesTouch = srcCaps ? srcCaps.firesTouchEvents : null;
        this._addLog('idc',
          `click 事件：sourceCapabilities = ${srcCaps ? 'InputDeviceCapabilities' : 'null'}，firesTouchEvents = ${firesTouch}`);
        this.setState({
          deviceCapInfo:
            `event.sourceCapabilities 读取 ✓\n` +
            `事件类型：${ev.type}\n` +
            `event.sourceCapabilities = ${srcCaps ? 'InputDeviceCapabilities 实例' : 'null'}\n` +
            `firesTouchEvents = ${firesTouch === null ? 'null（无能力信息）' : firesTouch}\n` +
            `typeof InputDeviceCapabilities = ${idcType}\n` +
            `说明：true=触屏 / false=鼠标·笔；null（如 jsdom）表示未提供设备来源信息。若已 polyfill 可点击「检测 InputDeviceCapabilities」。`,
        });
      };
      el.addEventListener('click', handler);
      this._tempElement = el;
      this._tempElementHandler = handler;
      // 派发一个合成事件以验证（jsdom 中 sourceCapabilities 通常为 null）
      try {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        this._addLog('idc', '已派发合成 MouseEvent("click")，回调已触发');
      } catch (err) {
        this._addLog('warn', `派发合成事件失败：${err.message}`);
        this.setState({
          deviceCapInfo:
            `已创建临时 <div> 元素并监听 click 事件 ✓\n` +
            `typeof InputDeviceCapabilities = ${idcType}\n` +
            `说明：在真实浏览器中点击该元素，回调会读取 ev.sourceCapabilities.firesTouchEvents；\n` +
            `jsdom 中 sourceCapabilities 通常为 null。`,
        });
      }
    } catch (err) {
      this._addLog('warn', `创建临时元素失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. InputDeviceCapabilities（输入设备能力）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.idc ? 'success' : 'error' }, caps.idc ? 'InputDeviceCapabilities ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'sourceCapabilities / firesTouchEvents'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'InputDeviceCapabilities 描述触发事件的输入设备能力。event.sourceCapabilities 是 InputDeviceCapabilities 实例（或 null），其 firesTouchEvents 属性为 boolean：true 表示事件来自触屏，false 表示来自鼠标 / 笔。用于在 click / mousedown 等事件中区分输入设备类型，避免触屏与鼠标重复触发。仅 Blink 内核（Chrome / Edge）原生支持，可能已通过 polyfill 提供。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 InputDeviceCapabilities', { type: 'primary', size: 'sm', disabled: !caps.idc, onClick: () => this._checkCapabilities() }),
          this._btn('创建临时元素监听 click', { type: 'primary', size: 'sm', onClick: () => this._createTempElement() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'InputDeviceCapabilities 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {}, s.deviceCapInfo || '（点击「检测 InputDeviceCapabilities」按钮）')),
        h(Alert, {
          type: 'info',
          message: '区分鼠标 / 触摸 / 笔输入',
          description: '触屏设备上点击会同时触发 touch / mouse / click，sourceCapabilities.firesTouchEvents 让回调判断本次 click 是否源自触屏，避免重复响应。仅 Blink 内核支持，需做 null 检查与降级。',
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
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '高级输入 API 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 VirtualKeyboard / Keyboard / EyeDropper / Document PiP / Sanitizer / InputDeviceCapabilities 等 MDN 输入相关 API。jsdom 中多数未实现，所有调用前做 typeof 检测，不可用仅记日志。'),
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
