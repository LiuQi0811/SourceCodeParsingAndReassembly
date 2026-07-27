// =====================================================================
// AccessibilityInteractionPage.js —— 无障碍与交互 API 实验室
// 演示 MDN：
//   1. Screen Wake Lock API              —— navigator.wakeLock
//        request('screen') 返回 WakeLockSentinel
//        sentinel.released / type / release()
//        visibilitychange → 隐藏自动释放 / 可见重新请求
//   2. Fullscreen API + Visual Viewport API
//        Element.requestFullscreen / document.exitFullscreen / fullscreenElement
//        fullscreenchange / fullscreenerror 事件
//        window.visualViewport：width/height/offsetLeft/offsetTop/pageLeft/scale
//        visualViewport.resize / scroll 事件
//   3. Clipboard API 深度（async）
//        readText / writeText（文本）
//        read / write([ClipboardItem])（富文本/图片）
//        new ClipboardItem({ 'text/plain': Blob, 'image/png': Blob })
//   4. Network Information API + Online/Offline
//        navigator.connection：effectiveType / downlink / rtt / saveData / type
//        connection.change 事件 / navigator.onLine / online / offline 事件
//   5. 输入设备能力 + ARIA 基础
//        PointerEvent.prototype.getPredictedEvents() / pointercancel
//        InputDeviceCapabilities: firesTouchEvents / sourceCapabilities
//        ARIA：role / aria-label / aria-pressed / aria-expanded / aria-live / aria-hidden
// 说明：以上 API 多数较新且要求安全上下文（HTTPS / localhost）与用户手势；
//       jsdom 等运行时通常不可用（navigator.connection 几乎必缺）。
//       所有调用前必须 typeof / in 检测，不可用时记日志说明，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class AccessibilityInteractionPage extends Page {
  // —— 初始 state ——
  // capsSummary 初始为 ''，能力检测完成后填入字符串，触发条件渲染 Alert
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      wakeStatus: 'idle',       // 'idle' | 'active' | 'released' | 'error'
      fsStatus: 'windowed',     // 'windowed' | 'fullscreen'
      vpInfo: null,             // { width, height, offsetLeft, offsetTop, pageLeft, scale }
      clipText: '',             // 最近一次剪贴板读/写内容
      connInfo: null,           // { effectiveType, downlink, rtt, saveData, type }
      onlineStatus: 'unknown',  // 'online' | 'offline' | 'unknown'
      inputInfo: null,          // { hasInputDeviceCapabilities, hasSourceCapabilities, hasGetPredictedEvents, firesTouchEvents }
      ariaPressed: false,       // ARIA toggle 演示状态
      readingFlowInfo: '',      // Card 9：reading-flow 焦点阅读顺序
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ CRITICAL 守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;
    // 注册 visibilitychange（用于 wakeLock 在页面恢复可见后重新获取）
    this._visibilityUnbind = this.on(document, 'visibilitychange', () => this._onVisibilityChange());
    // 同步能力检测，写入 capsSummary
    this._detectCapabilities();
  }

  componentWillUnmount() {
    // 1. 释放 WakeLockSentinel
    if (this._wakeLock) {
      try { this._wakeLock.release(); } catch { /* noop */ }
      this._wakeLock = null;
    }
    this._wakeLockAutoReacquire = false;
    // 2. 退出全屏（若仍处于全屏状态）
    if (typeof document !== 'undefined' && document.fullscreenElement &&
        typeof document.exitFullscreen === 'function') {
      try { document.exitFullscreen(); } catch { /* noop */ }
    }
    // 3. 移除 visualViewport.resize / scroll 事件
    if (typeof window !== 'undefined' && window.visualViewport && this._vvHandlers) {
      try {
        window.visualViewport.removeEventListener('resize', this._vvHandlers.onResize);
        window.visualViewport.removeEventListener('scroll', this._vvHandlers.onScroll);
      } catch { /* noop */ }
      this._vvHandlers = null;
    }
    // 3.1 移除 fullscreenchange / fullscreenerror 事件
    if (typeof document !== 'undefined' && this._fsHandlers) {
      try {
        document.removeEventListener('fullscreenchange', this._fsHandlers.onChange);
        document.removeEventListener('fullscreenerror', this._fsHandlers.onError);
      } catch { /* noop */ }
      this._fsHandlers = null;
    }
    // 4. 移除 navigator.connection.change 事件
    if (typeof navigator !== 'undefined' && navigator.connection && this._connHandler) {
      try { navigator.connection.removeEventListener('change', this._connHandler); } catch { /* noop */ }
      this._connHandler = null;
    }
    // 5. 移除 window online / offline 事件
    if (typeof window !== 'undefined') {
      if (this._onlineHandler) {
        try { window.removeEventListener('online', this._onlineHandler); } catch { /* noop */ }
        this._onlineHandler = null;
      }
      if (this._offlineHandler) {
        try { window.removeEventListener('offline', this._offlineHandler); } catch { /* noop */ }
        this._offlineHandler = null;
      }
    }
    // 6. 移除 pointercancel 监听（Card 5 演示）
    if (this._pointerCancelUnbind) {
      try { this._pointerCancelUnbind(); } catch { /* noop */ }
      this._pointerCancelUnbind = null;
    }
  }

  // —— 日志辅助（最多保留 40 条，与项目其它页一致）——
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 按钮辅助（统一注册子组件，便于销毁）——
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（一次性，写入 capsSummary）——
  _detectCapabilities() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const doc = typeof document !== 'undefined' ? document : {};
    const win = typeof window !== 'undefined' ? window : {};
    const caps = {
      wakeLock: typeof nav.wakeLock !== 'undefined' && !!nav.wakeLock,
      fullscreen: typeof doc.fullscreenEnabled !== 'undefined' && !!doc.fullscreenEnabled,
      visualViewport: typeof win.visualViewport !== 'undefined',
      clipboard: typeof nav.clipboard !== 'undefined',
      connection: typeof nav.connection !== 'undefined',
      inputDeviceCapabilities: typeof win.InputDeviceCapabilities !== 'undefined',
      readingFlow: (() => { try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('reading-flow', 'visual'); } catch { return false; } })(),
    };
    const parts = [
      `wakeLock:${caps.wakeLock ? '✓' : '✗'}`,
      `fullscreen:${caps.fullscreen ? '✓' : '✗'}`,
      `visualViewport:${caps.visualViewport ? '✓' : '✗'}`,
      `clipboard:${caps.clipboard ? '✓' : '✗'}`,
      `connection:${caps.connection ? '✓' : '✗'}`,
      `InputDeviceCapabilities:${caps.inputDeviceCapabilities ? '✓' : '✗'}`,
      `reading-flow:${caps.readingFlow ? '✓' : '✗'}`,
    ];
    const summary = `能力检测：${parts.join('  ')}`;
    this.setState({ capsSummary: summary });
    this._addLog('cap', summary);
    if (!caps.connection) {
      this._addLog('warn', 'navigator.connection 在 jsdom 中通常不存在，Network Information 卡片仅做演示');
    }
    if (!caps.wakeLock) {
      this._addLog('warn', 'navigator.wakeLock 不可用，Wake Lock 演示需真实浏览器（HTTPS / localhost）');
    }
    if (!caps.readingFlow) {
      this._addLog('warn', 'CSS reading-flow 不可用（Chrome 开发中，jsdom 不识别），仅展示文档与代码');
    }
  }

  // 能力 Tag 辅助
  _capTag(ok) {
    return ok
      ? h(Tag, { color: 'success' }, '支持')
      : h(Tag, { color: 'error' }, '不支持');
  }

  // 键值行（label + value）
  _kvRow(label, value) {
    const text = value == null ? 'N/A' : String(value);
    return h('div', { class: 'flex items-center gap-sm' },
      h('span', { class: 'fs-sm text-secondary', style: { minWidth: '180px' } }, label),
      h('span', { class: 'fs-sm fw-medium', style: { wordBreak: 'break-all' } }, text),
    );
  }

  // ============ Card 1: Screen Wake Lock API ============

  // 请求屏幕常亮锁：navigator.wakeLock.request('screen') → WakeLockSentinel
  async _wakeLockRequest() {
    if (typeof navigator.wakeLock === 'undefined' || !navigator.wakeLock) {
      this._addLog('warn', '当前浏览器不支持 Screen Wake Lock API（navigator.wakeLock 不可用）');
      return;
    }
    try {
      this._addLog('wake', '调用 navigator.wakeLock.request("screen") ...');
      const sentinel = await navigator.wakeLock.request('screen');
      this._wakeLock = sentinel;
      this._wakeLockAutoReacquire = true; // 标记后续 visibilitychange 可重新获取
      // 监听 sentinel 的 release 事件（页面隐藏或主动 release 时触发）
      try {
        sentinel.addEventListener('release', () => {
          this._addLog('wake', `WakeLockSentinel 触发 release 事件（released=${sentinel.released}, type=${sentinel.type}）`);
          this.setState({ wakeStatus: 'released' });
        });
      } catch { /* noop */ }
      this.setState({ wakeStatus: 'active' });
      this._addLog('wake', `已获取 WakeLockSentinel（type=${sentinel.type}, released=${sentinel.released}）`);
    } catch (err) {
      this._addLog('err', `wakeLock.request 失败：${err.name} — ${err.message}`);
      this.setState({ wakeStatus: 'error' });
    }
  }

  // 主动释放 wakeLock
  async _wakeLockRelease() {
    if (!this._wakeLock) {
      this._addLog('warn', '当前没有活跃的 WakeLockSentinel');
      return;
    }
    try {
      this._addLog('wake', '调用 sentinel.release() ...');
      await this._wakeLock.release();
      this._wakeLock = null;
      this._wakeLockAutoReacquire = false; // 主动释放后不再自动重新获取
      this.setState({ wakeStatus: 'released' });
      this._addLog('wake', 'WakeLockSentinel 已释放');
    } catch (err) {
      this._addLog('err', `release 失败：${err.name} — ${err.message}`);
    }
  }

  // visibilitychange 处理：可见时重新请求；隐藏时记录自动释放
  _onVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      // 页面恢复可见：若开启了自动重新获取且当前无 sentinel，重新请求
      if (this._wakeLockAutoReacquire && !this._wakeLock) {
        this._addLog('wake', 'visibilitychange → visible：检测到 wakeLock 已释放，尝试重新请求');
        this._wakeLockRequest();
      } else {
        this._addLog('wake', `visibilitychange → visible（当前 wakeStatus=${this.state.wakeStatus}）`);
      }
    } else if (document.visibilityState === 'hidden') {
      // 页面隐藏：浏览器会自动释放 wakeLock
      if (this._wakeLock) {
        this._addLog('wake', 'visibilitychange → hidden：浏览器将自动释放 wakeLock');
      }
    }
  }

  // ============ Card 2: Fullscreen API + Visual Viewport API ============

  // 让演示容器进入全屏
  _fsEnter() {
    if (typeof document.fullscreenEnabled === 'undefined' || !document.fullscreenEnabled) {
      this._addLog('warn', '当前浏览器不支持 Fullscreen API（document.fullscreenEnabled 不可用）');
      return;
    }
    const target = this.$('.fs-demo-box');
    if (!target || typeof target.requestFullscreen !== 'function') {
      this._addLog('err', '未找到全屏目标元素或 requestFullscreen 不可用');
      return;
    }
    this._addLog('fs', '调用 element.requestFullscreen() ...');
    target.requestFullscreen().then(() => {
      const fe = typeof document.fullscreenElement !== 'undefined' && document.fullscreenElement
        ? document.fullscreenElement.tagName : 'null';
      this._addLog('fs', `已进入全屏：fullscreenElement=${fe}`);
      this.setState({ fsStatus: 'fullscreen' });
    }).catch((err) => {
      this._addLog('err', `requestFullscreen 失败：${err.name} — ${err.message}`);
    });
  }

  // 退出全屏
  _fsExit() {
    if (typeof document === 'undefined' || !document.fullscreenElement) {
      this._addLog('warn', '当前未处于全屏状态');
      return;
    }
    if (typeof document.exitFullscreen !== 'function') {
      this._addLog('warn', 'document.exitFullscreen 不可用');
      return;
    }
    this._addLog('fs', '调用 document.exitFullscreen() ...');
    document.exitFullscreen().then(() => {
      this._addLog('fs', '已退出全屏');
      this.setState({ fsStatus: 'windowed' });
    }).catch((err) => {
      this._addLog('err', `exitFullscreen 失败：${err.name} — ${err.message}`);
    });
  }

  // 监听 fullscreenchange / fullscreenerror 事件
  _fsListenStart() {
    if (typeof document === 'undefined') {
      this._addLog('warn', 'document 不可用，无法监听 fullscreen 事件');
      return;
    }
    if (this._fsHandlers) {
      this._addLog('warn', '已在监听 fullscreenchange / fullscreenerror');
      return;
    }
    const onChange = () => {
      const fe = document.fullscreenElement ? document.fullscreenElement.tagName : 'null';
      this._addLog('fs', `fullscreenchange 事件：fullscreenElement=${fe}`);
      this.setState({ fsStatus: document.fullscreenElement ? 'fullscreen' : 'windowed' });
    };
    const onError = (e) => {
      this._addLog('err', `fullscreenerror 事件：${e?.type || '未知'}`);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('fullscreenerror', onError);
    this._fsHandlers = { onChange, onError };
    this._addLog('fs', '已监听 document.fullscreenchange / fullscreenerror');
  }

  // 停止监听 fullscreen 事件
  _fsListenStop() {
    if (typeof document === 'undefined' || !this._fsHandlers) {
      this._addLog('warn', '未在监听 fullscreen 事件');
      return;
    }
    try {
      document.removeEventListener('fullscreenchange', this._fsHandlers.onChange);
      document.removeEventListener('fullscreenerror', this._fsHandlers.onError);
    } catch { /* noop */ }
    this._fsHandlers = null;
    this._addLog('fs', '已停止监听 fullscreenchange / fullscreenerror');
  }

  // 读取当前 visualViewport 数值
  _vvRead() {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) {
      this._addLog('warn', '当前浏览器不支持 Visual Viewport API（window.visualViewport 不可用）');
      return;
    }
    const info = {
      width: vv.width,
      height: vv.height,
      offsetLeft: vv.offsetLeft,
      offsetTop: vv.offsetTop,
      pageLeft: vv.pageLeft,
      scale: vv.scale,
    };
    this.setState({ vpInfo: info });
    this._addLog('vp', `visualViewport: ${vv.width.toFixed(0)}×${vv.height.toFixed(0)} scale=${vv.scale.toFixed(2)} offset=(${vv.offsetLeft},${vv.offsetTop}) pageLeft=${vv.pageLeft}`);
  }

  // 开始监听 visualViewport.resize / scroll
  _vvListenStart() {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) {
      this._addLog('warn', 'window.visualViewport 不可用，无法监听');
      return;
    }
    if (this._vvHandlers) {
      this._addLog('warn', '已在监听 visualViewport.resize / scroll');
      return;
    }
    // rAF 节流 + 值变化判断：visualViewport.resize/scroll 在双指缩放/滚动时高频触发
    this._vvRAF = null;
    this._lastVpKey = '';
    this._lastVpLog = 0;
    const onResize = () => {
      if (this._vvRAF) return;
      this._vvRAF = requestAnimationFrame(() => {
        this._vvRAF = null;
        const v = window.visualViewport;
        const key = `${v.width.toFixed(0)},${v.height.toFixed(0)},${v.scale.toFixed(2)},${v.offsetTop}`;
        if (key === this._lastVpKey) return;
        this._lastVpKey = key;
        this._addLog('vp', `resize 事件：${v.width.toFixed(0)}×${v.height.toFixed(0)} scale=${v.scale.toFixed(2)} offsetTop=${v.offsetTop}`);
        this.setState({
          vpInfo: {
            width: v.width, height: v.height,
            offsetLeft: v.offsetLeft, offsetTop: v.offsetTop,
            pageLeft: v.pageLeft, scale: v.scale,
          },
        });
      });
    };
    const onScroll = () => {
      // scroll 事件高频，限流到 100ms 一条日志
      const now = Date.now();
      if (now - this._lastVpLog < 100) return;
      this._lastVpLog = now;
      const v = window.visualViewport;
      this._addLog('vp', `scroll 事件：pageLeft=${v.pageLeft} offsetTop=${v.offsetTop}`);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onScroll);
    this._vvHandlers = { onResize, onScroll };
    this._addLog('vp', '已监听 visualViewport.resize / scroll（pinch-zoom 时 scale 会变化）');
  }

  // 停止监听 visualViewport
  _vvListenStop() {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv || !this._vvHandlers) {
      this._addLog('warn', '未在监听 visualViewport');
      return;
    }
    try {
      vv.removeEventListener('resize', this._vvHandlers.onResize);
      vv.removeEventListener('scroll', this._vvHandlers.onScroll);
    } catch { /* noop */ }
    if (this._vvRAF) { cancelAnimationFrame(this._vvRAF); this._vvRAF = null; }
    this._vvHandlers = null;
    this._addLog('vp', '已停止监听 visualViewport.resize / scroll');
  }

  // ============ Card 3: Clipboard API 深度（async）============

  // 写入纯文本到剪贴板
  async _clipWriteText() {
    if (typeof navigator.clipboard === 'undefined' || !navigator.clipboard?.writeText) {
      this._addLog('warn', 'navigator.clipboard.writeText 不可用（需 HTTPS + 用户激活）');
      return;
    }
    try {
      this._addLog('clip', '调用 navigator.clipboard.writeText("Hello Clipboard") ...');
      await navigator.clipboard.writeText('Hello Clipboard');
      this.setState({ clipText: 'Hello Clipboard' });
      this._addLog('clip', '已写入文本 "Hello Clipboard"');
    } catch (err) {
      this._addLog('err', `writeText 失败：${err.name} — ${err.message}`);
    }
  }

  // 读取剪贴板文本
  async _clipReadText() {
    if (typeof navigator.clipboard === 'undefined' || !navigator.clipboard?.readText) {
      this._addLog('warn', 'navigator.clipboard.readText 不可用（需 HTTPS + 权限）');
      return;
    }
    try {
      this._addLog('clip', '调用 navigator.clipboard.readText() ...');
      const text = await navigator.clipboard.readText();
      this.setState({ clipText: text });
      this._addLog('clip', `读取到文本：${text === '' ? '(空)' : text}`);
    } catch (err) {
      this._addLog('err', `readText 失败：${err.name} — ${err.message}`);
    }
  }

  // 写入富文本：new ClipboardItem({ 'text/html': Blob, 'text/plain': Blob })
  async _clipWriteHtml() {
    if (typeof navigator.clipboard === 'undefined' || !navigator.clipboard?.write) {
      this._addLog('warn', 'navigator.clipboard.write 不可用（需 HTTPS + 用户激活）');
      return;
    }
    if (typeof ClipboardItem === 'undefined') {
      this._addLog('warn', 'ClipboardItem 构造器不可用');
      return;
    }
    try {
      const html = '<b>Hello</b> <i>Clipboard</i>';
      const text = 'Hello Clipboard';
      // new ClipboardItem({ 'text/html': Blob, 'text/plain': Blob })
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      this._addLog('clip', '调用 navigator.clipboard.write([ClipboardItem]) ...');
      await navigator.clipboard.write([item]);
      this.setState({ clipText: html });
      this._addLog('clip', `已写入富文本 ClipboardItem（text/html="${html}", text/plain="${text}"）`);
    } catch (err) {
      this._addLog('err', `write(ClipboardItem) 失败：${err.name} — ${err.message}`);
    }
  }

  // ============ Card 4: Network Information API + Online/Offline ============

  // 读取 navigator.connection 当前信息
  _connRead() {
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
    if (!conn) {
      this._addLog('warn', 'navigator.connection 不可用（jsdom 中通常不存在）');
      return;
    }
    const info = {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData,
      type: conn.type,
    };
    this.setState({ connInfo: info });
    this._addLog('net', `connection: effectiveType=${info.effectiveType} downlink=${info.downlink}Mbps rtt=${info.rtt}ms saveData=${info.saveData} type=${info.type ?? 'N/A'}`);
  }

  // 监听 connection.change 事件
  _connListenStart() {
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
    if (!conn) {
      this._addLog('warn', 'navigator.connection 不可用，无法监听 change');
      return;
    }
    if (this._connHandler) {
      this._addLog('warn', '已在监听 connection.change');
      return;
    }
    this._connHandler = () => {
      const c = navigator.connection;
      this._addLog('net', `change 事件：effectiveType=${c.effectiveType} downlink=${c.downlink}Mbps rtt=${c.rtt}ms saveData=${c.saveData}`);
      this.setState({
        connInfo: {
          effectiveType: c.effectiveType, downlink: c.downlink,
          rtt: c.rtt, saveData: c.saveData, type: c.type,
        },
      });
    };
    conn.addEventListener('change', this._connHandler);
    this._addLog('net', '已监听 navigator.connection.change');
  }

  // 模拟切换 effectiveType（实际 API 不允许直接修改，仅做日志记录演示）
  _connSimulate() {
    const types = ['4g', '3g', '2g', 'slow-2g'];
    const idx = Math.floor(Math.random() * types.length);
    const next = types[idx];
    this._addLog('net', `模拟切换 effectiveType → ${next}（实际 API 不支持直接修改，仅演示记录）`);
  }

  // 监听 window online / offline 事件
  _onlineOfflineListen() {
    if (typeof window === 'undefined') {
      this._addLog('warn', 'window 不可用，无法监听 online/offline');
      return;
    }
    if (this._onlineHandler) {
      this._addLog('warn', '已在监听 online/offline 事件');
      return;
    }
    this._onlineHandler = () => {
      const onLine = typeof navigator.onLine === 'boolean' ? navigator.onLine : 'unknown';
      this._addLog('online', `online 事件触发：navigator.onLine=${onLine}`);
      this.setState({ onlineStatus: 'online' });
    };
    this._offlineHandler = () => {
      const onLine = typeof navigator.onLine === 'boolean' ? navigator.onLine : 'unknown';
      this._addLog('offline', `offline 事件触发：navigator.onLine=${onLine}`);
      this.setState({ onlineStatus: 'offline' });
    };
    window.addEventListener('online', this._onlineHandler);
    window.addEventListener('offline', this._offlineHandler);
    const cur = typeof navigator.onLine === 'boolean'
      ? (navigator.onLine ? 'online' : 'offline') : 'unknown';
    this.setState({ onlineStatus: cur });
    this._addLog('net', `已监听 online/offline（当前 navigator.onLine=${navigator.onLine}）`);
  }

  // ============ Card 5: 输入设备能力 + ARIA 基础 ============

  // 检测 InputDeviceCapabilities / PointerEvent.getPredictedEvents / sourceCapabilities
  _detectInputDevice() {
    const win = typeof window !== 'undefined' ? window : {};
    const hasIDC = typeof win.InputDeviceCapabilities !== 'undefined';
    let hasSourceCapabilities = false;
    try {
      // 用一个普通 Event 探测 sourceCapabilities 字段是否存在
      const e = new Event('test');
      hasSourceCapabilities = 'sourceCapabilities' in e;
    } catch { /* noop */ }
    let hasGetPredictedEvents = false;
    try {
      hasGetPredictedEvents = typeof win.PointerEvent !== 'undefined' &&
        typeof win.PointerEvent.prototype.getPredictedEvents === 'function';
    } catch { /* noop */ }
    let firesTouchEvents = null;
    if (hasIDC) {
      try {
        // new InputDeviceCapabilities({ sourceMotion })
        const idc = new InputDeviceCapabilities({ sourceMotion: false });
        firesTouchEvents = idc.firesTouchEvents;
        this._addLog('input', `new InputDeviceCapabilities({sourceMotion:false}) → firesTouchEvents=${firesTouchEvents}`);
      } catch (err) {
        this._addLog('err', `InputDeviceCapabilities 构造失败：${err.name} — ${err.message}`);
      }
    } else {
      this._addLog('warn', 'InputDeviceCapabilities 不可用（多为 Chromium 内核浏览器支持）');
    }
    this._addLog('input', `PointerEvent.getPredictedEvents: ${hasGetPredictedEvents ? '支持' : '不支持'}；event.sourceCapabilities: ${hasSourceCapabilities ? '存在（已废弃）' : '不存在'}`);
    this.setState({
      inputInfo: {
        hasInputDeviceCapabilities: hasIDC,
        hasSourceCapabilities,
        hasGetPredictedEvents,
        firesTouchEvents,
      },
    });
  }

  // 监听 pointercancel（PointerEvent 事件，演示用）
  _pointerCancelListen() {
    if (typeof window === 'undefined' || typeof PointerEvent === 'undefined') {
      this._addLog('warn', 'PointerEvent 不可用，无法监听 pointercancel');
      return;
    }
    if (this._pointerCancelUnbind) {
      this._addLog('warn', '已在监听 pointercancel');
      return;
    }
    const handler = (e) => {
      this._addLog('input', `pointercancel 事件：pointerType=${e.pointerType} pointerId=${e.pointerId}`);
    };
    window.addEventListener('pointercancel', handler);
    this._pointerCancelUnbind = () => {
      try { window.removeEventListener('pointercancel', handler); } catch { /* noop */ }
    };
    this._addLog('input', '已监听 window.pointercancel（在指针被系统中断时触发）');
  }

  // ARIA toggle 演示：切换 aria-pressed，aria-live 区域朗读状态
  _toggleAria() {
    const next = !this.state.ariaPressed;
    this.setState({ ariaPressed: next });
    this._addLog('aria', `toggle 按钮 → aria-pressed=${next}，aria-live 区域朗读："${next ? '已开启' : '已关闭'}"`);
  }

  // ============ 渲染：5 张 Card ============

  _renderCard1() {
    const card = new Card({
      title: '1. Screen Wake Lock API（屏幕常亮）',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.wakeLock'),
        h(Tag, { color: this.state.wakeStatus === 'active' ? 'success' : 'default' }, `status: ${this.state.wakeStatus}`),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.wakeLock.request("screen") 返回 Promise<WakeLockSentinel>。sentinel.released / sentinel.type 反映状态，sentinel.release() 主动释放。页面隐藏（visibilitychange → hidden）时浏览器会自动释放；恢复可见后需重新 request 才能继续持锁。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('请求 wakeLock', {
            type: 'primary', size: 'sm',
            onClick: () => this._wakeLockRequest(),
          }),
          this._btn('release', {
            size: 'sm', danger: true,
            onClick: () => this._wakeLockRelease(),
            disabled: this.state.wakeStatus !== 'active',
          }),
        ),
        this._kvRow('当前状态', this.state.wakeStatus),
        h(Alert, {
          type: 'info',
          message: 'visibilitychange 重新获取模式',
          description: '本页在 componentDidMount 中已注册 document.visibilitychange 监听。当页面从 hidden 切回 visible 且此前已请求过 wakeLock 时，会自动重新调用 request("screen")。点击 release 后该自动重获取行为关闭。',
        }),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const card = new Card({
      title: '2. Fullscreen API + Visual Viewport API',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'requestFullscreen'),
        h(Tag, { color: 'primary' }, 'visualViewport'),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'Element.requestFullscreen() 进入全屏，document.exitFullscreen() 退出，document.fullscreenElement / fullscreenEnabled 反映状态。fullscreenchange / fullscreenerror 事件追踪变化。window.visualViewport 提供 width / height / offsetLeft / offsetTop / pageLeft / scale，pinch-zoom 时 scale 会变化；resize / scroll 事件持续追踪。'),
        // 全屏演示容器（点击「进入全屏」会对此元素调用 requestFullscreen）
        h('div', {
          class: 'fs-demo-box',
          style: {
            padding: '24px',
            background: 'linear-gradient(135deg, #1677ff, #722ed1)',
            color: '#fff',
            borderRadius: '8px',
            textAlign: 'center',
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
          },
        },
          h('div', { class: 'fs-sm', style: { opacity: 0.85 } }, '全屏演示容器'),
          h('div', { class: 'fs-lg fw-medium' }, '点击「进入全屏」测试 Fullscreen API'),
        ),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('进入全屏', {
            type: 'primary', size: 'sm',
            onClick: () => this._fsEnter(),
          }),
          this._btn('退出全屏', {
            size: 'sm', danger: true,
            onClick: () => this._fsExit(),
            disabled: this.state.fsStatus !== 'fullscreen',
          }),
          this._btn('监听 fullscreen 事件', {
            size: 'sm',
            onClick: () => this._fsListenStart(),
          }),
          this._btn('读取 visualViewport', {
            size: 'sm',
            onClick: () => this._vvRead(),
          }),
          this._btn('监听 vv 事件', {
            size: 'sm',
            onClick: () => this._vvListenStart(),
          }),
          this._btn('停止 vv 监听', {
            size: 'sm',
            onClick: () => this._vvListenStop(),
          }),
        ),
        this._kvRow('fullscreenElement', (typeof document !== 'undefined' && document.fullscreenElement) ? document.fullscreenElement.tagName : 'null'),
        this._kvRow('fullscreenEnabled', typeof document !== 'undefined' ? String(!!document.fullscreenEnabled) : 'unknown'),
        this.state.vpInfo
          ? h('div', { class: 'flex flex-col gap-xs' },
              this._kvRow('vv.width', this.state.vpInfo.width?.toFixed(1)),
              this._kvRow('vv.height', this.state.vpInfo.height?.toFixed(1)),
              this._kvRow('vv.scale', this.state.vpInfo.scale?.toFixed(3)),
              this._kvRow('vv.offsetLeft', this.state.vpInfo.offsetLeft),
              this._kvRow('vv.offsetTop', this.state.vpInfo.offsetTop),
              this._kvRow('vv.pageLeft', this.state.vpInfo.pageLeft),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「读取 visualViewport」后，数值显示在这里）'),
        h('p', { class: 'fs-xs text-tertiary' }, '说明：移动端 pinch-zoom 时 vv.scale 会从 1.0 增大，vv.width/height 随之缩小；vv.offsetLeft/offsetTop 反映视口相对于屏幕的偏移。'),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const card = new Card({
      title: '3. Clipboard API 深度（async）',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.clipboard'),
        h(Tag, { color: 'warning' }, '需 HTTPS + 用户激活'),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.clipboard.readText() / writeText(text) 处理纯文本；read() / write([ClipboardItem]) 处理富文本与图片。new ClipboardItem({ "text/plain": Blob, "text/html": Blob, "image/png": Blob }) 支持多种 MIME。clipboardchange 事件可监听剪贴板变化（部分浏览器支持）。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('写入 "Hello Clipboard"', {
            type: 'primary', size: 'sm',
            onClick: () => this._clipWriteText(),
          }),
          this._btn('读取剪贴板文本', {
            size: 'sm',
            onClick: () => this._clipReadText(),
          }),
          this._btn('写入 HTML（ClipboardItem）', {
            type: 'primary', size: 'sm',
            onClick: () => this._clipWriteHtml(),
          }),
        ),
        this._kvRow('最近内容', this.state.clipText === '' ? '（空）' : this.state.clipText),
        h(Alert, {
          type: 'info',
          message: '使用前提',
          description: 'Clipboard API 需 HTTPS / localhost 安全上下文 + 用户激活（点击/键盘）+ 权限授权（部分操作）。jsdom 等运行时通常不可用，调用会失败并记日志，不会抛异常。',
        }),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const onlineTagColor = this.state.onlineStatus === 'online'
      ? 'success' : (this.state.onlineStatus === 'offline' ? 'error' : 'default');
    const card = new Card({
      title: '4. Network Information API + Online/Offline',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.connection'),
        h(Tag, { color: 'primary' }, 'online/offline'),
        h(Tag, { color: onlineTagColor }, `online: ${this.state.onlineStatus}`),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.connection 提供 effectiveType（"4g"/"3g"/"2g"/"slow-2g"）、downlink（Mbps）、rtt（ms）、saveData（boolean）、type（"wifi"/"cellular"/"ethernet"/"none"）。connection.change 事件追踪网络切换。navigator.onLine 反映在线状态，window.online / offline 事件触发回调。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('读取 connection 信息', {
            type: 'primary', size: 'sm',
            onClick: () => this._connRead(),
          }),
          this._btn('监听 connection.change', {
            size: 'sm',
            onClick: () => this._connListenStart(),
          }),
          this._btn('模拟切换 effectiveType', {
            size: 'sm',
            onClick: () => this._connSimulate(),
          }),
          this._btn('监听 online/offline', {
            type: 'primary', size: 'sm',
            onClick: () => this._onlineOfflineListen(),
          }),
        ),
        this.state.connInfo
          ? h('div', { class: 'flex flex-col gap-xs' },
              this._kvRow('effectiveType', this.state.connInfo.effectiveType ?? 'N/A'),
              this._kvRow('downlink', this.state.connInfo.downlink == null ? 'N/A' : `${this.state.connInfo.downlink} Mbps`),
              this._kvRow('rtt', this.state.connInfo.rtt == null ? 'N/A' : `${this.state.connInfo.rtt} ms`),
              this._kvRow('saveData', this.state.connInfo.saveData == null ? 'N/A' : String(this.state.connInfo.saveData)),
              this._kvRow('type', this.state.connInfo.type ?? 'N/A'),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「读取 connection 信息」后，字段显示在这里。jsdom 中通常不可用）'),
        this._kvRow('navigator.onLine', typeof navigator !== 'undefined' ? String(navigator.onLine) : 'unknown'),
        h('p', { class: 'fs-xs text-tertiary' }, '注：saveData 表示用户开启了「省流模式」；type 在桌面浏览器多为 N/A，移动端可能返回 wifi / cellular。'),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const info = this.state.inputInfo;
    const card = new Card({
      title: '5. 输入设备能力 + ARIA 基础',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'InputDeviceCapabilities'),
        h(Tag, { color: 'primary' }, 'ARIA'),
      ),
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'PointerEvent.prototype.getPredictedEvents() 返回预测事件序列（部分浏览器支持）；pointercancel 事件在指针被中断时触发。new InputDeviceCapabilities({ sourceMotion }) 构造设备能力对象，firesTouchEvents 反映是否触发触摸事件；event.sourceCapabilities（已废弃）提供同类信息。ARIA 基础：role / aria-label / aria-pressed / aria-expanded / aria-live / aria-hidden 用于无障碍语义。'),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('检测 InputDeviceCapabilities', {
            type: 'primary', size: 'sm',
            onClick: () => this._detectInputDevice(),
          }),
          this._btn('监听 pointercancel', {
            size: 'sm',
            onClick: () => this._pointerCancelListen(),
          }),
        ),
        info
          ? h('div', { class: 'flex flex-col gap-xs' },
              this._kvRow('InputDeviceCapabilities', info.hasInputDeviceCapabilities ? '支持' : '不支持'),
              this._kvRow('firesTouchEvents', info.firesTouchEvents == null ? 'N/A' : String(info.firesTouchEvents)),
              this._kvRow('event.sourceCapabilities', info.hasSourceCapabilities ? '存在（已废弃）' : '不存在'),
              this._kvRow('PointerEvent.getPredictedEvents', info.hasGetPredictedEvents ? '支持' : '不支持'),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「检测 InputDeviceCapabilities」后，结果会显示在这里）'),
        // ARIA toggle 演示：button[role=button][aria-pressed] + aria-live 朗读区域
        h('div', {
          class: 'flex flex-col gap-xs',
          style: { padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' },
        },
          h('div', { class: 'fs-sm fw-medium' }, 'ARIA toggle 演示'),
          h('button', {
            type: 'button',
            role: 'button',
            'aria-label': '演示开关按钮',
            'aria-pressed': String(this.state.ariaPressed),
            class: 'btn btn--sm ' + (this.state.ariaPressed ? 'btn--primary' : 'btn--default'),
            onClick: () => this._toggleAria(),
          }, this.state.ariaPressed ? '已开启（再次点击关闭）' : '已关闭（点击开启）'),
          h('div', {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            role: 'status',
            class: 'fs-sm',
            style: {
              minHeight: '20px',
              color: this.state.ariaPressed ? '#52c41a' : '#8c8c8c',
            },
          }, `aria-live 朗读：当前状态为「${this.state.ariaPressed ? '已开启' : '已关闭'}」`),
          h('div', { class: 'fs-xs text-tertiary' },
            `当前 aria-pressed="${this.state.ariaPressed}"；点击按钮可观察 aria-live 区域的朗读变化。`,
            '辅助技术（屏幕阅读器）会在状态变化时朗读 polite 区域内容。'),
        ),
      ),
    });
    this.registerChild(card);
    return card.render();
  }

  // ============ Card 9: reading-flow 焦点阅读顺序 ============

  _readingFlowCap() {
    try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('reading-flow', 'visual'); }
    catch { return false; }
  }

  _runReadingFlowDemo() {
    const ok = this._readingFlowCap();
    const lines = [];
    lines.push('===== CSS reading-flow 焦点阅读顺序 =====');
    lines.push('');
    lines.push('【标准】CSS Working Group 2024 草案');
    lines.push('  - 在 spatial 布局（grid/flex）中显式声明焦点阅读顺序');
    lines.push('  - 无障碍（A11y）关键特性：让屏幕阅读器/键盘焦点按语义顺序遍历');
    lines.push('');
    lines.push('【取值】');
    lines.push('  reading-flow: visual;         按视觉顺序（默认，DOM 顺序）');
    lines.push('  reading-flow: flow-visual;    按流式视觉顺序（grid 行优先）');
    lines.push('  reading-flow: flow-relaxed;   宽松流式顺序（允许跨行）');
    lines.push('');
    lines.push('【与 tabindex 区别】');
    lines.push('  tabindex: 手动指定每个元素的正整数序号，侵入式且难维护');
    lines.push('  reading-flow: 在容器上声明一次，子元素自动按布局顺序聚焦');
    lines.push('  // tabindex 改 DOM 焦点序；reading-flow 改阅读序不改 DOM 序');
    lines.push('');
    lines.push('【与屏幕阅读器协同】');
    lines.push('  reading-flow 影响辅助技术的阅读顺序与 Tab 焦点顺序');
    lines.push('  // 即使 grid 视觉重排，屏幕阅读器仍按 reading-flow 顺序朗读');
    lines.push('');
    lines.push('【实战：grid 焦点顺序】');
    lines.push('  /* HTML：grid 布局视觉重排，但希望按行阅读 */');
    lines.push('  <div class="grid-cards">');
    lines.push('    <article>A</article>');
    lines.push('    <article>B</article>');
    lines.push('    <article>C</article>');
    lines.push('    <article>D</article>');
    lines.push('  </div>');
    lines.push('  /* CSS */');
    lines.push('  .grid-cards {');
    lines.push('    display: grid;');
    lines.push('    grid-template-columns: repeat(2, 1fr);');
    lines.push('    reading-flow: flow-visual;  /* 按行优先聚焦，而非 DOM 列序 */');
    lines.push('  }');
    lines.push('  /* Tab 键依次聚焦 A→B→C→D（视觉行序），无需 tabindex */');
    lines.push('');
    lines.push('【降级策略】');
    lines.push('  - 不支持 reading-flow：按 DOM 顺序聚焦（可能与视觉顺序不一致）');
    lines.push('  - 降级：手动设置 tabindex 或调整 DOM 顺序匹配视觉顺序');
    lines.push('  - ARIA：用 aria-flowto 指定阅读顺序（旧方案，兼容性差）');
    lines.push('');
    lines.push('【当前环境能力检测】');
    lines.push('  CSS.supports("reading-flow", "visual"): ' + (ok ? '✓' : '✗'));
    lines.push('');
    lines.push('【浏览器支持】');
    lines.push('  Chrome        开发中（behind flag）');
    lines.push('  Firefox       未实现');
    lines.push('  Safari        未实现');
    lines.push('  jsdom         ✗（不识别该属性）');

    this.setState({ readingFlowInfo: lines.join('\n') });

    if (!ok) {
      this._addLog('warn', 'reading-flow 不可用（Chrome 开发中），仅展示文档与代码示例');
    } else {
      this._addLog('info', 'reading-flow 可用，可体验 grid 焦点顺序');
    }
  }

  _renderCard9() {
    const s = this.state;
    const ok = this._readingFlowCap();
    const card = new Card({
      title: '9. CSS reading-flow —— 焦点阅读顺序',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: ok ? 'success' : 'error' }, ok ? 'reading-flow ✓' : 'reading-flow ✗'),
        h(Tag, { color: 'primary' }, 'CSSWG 2024 · A11y'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'reading-flow（CSSWG 2024）在 spatial 布局（grid/flex）中显式声明焦点阅读顺序（visual/flow-visual/flow-relaxed），是无障碍关键特性。与 tabindex 区别：reading-flow 在容器声明一次，子元素自动按布局顺序聚焦，不侵入 DOM；tabindex 需手动指定每个元素序号。与屏幕阅读器协同：即使 grid 视觉重排，辅助技术仍按 reading-flow 顺序朗读。Chrome 开发中，Firefox/Safari 未实现。降级：手动 tabindex 或调整 DOM 顺序。jsdom 不识别，演示仅展示文档。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 reading-flow 文档与代码', { type: 'primary', size: 'sm', onClick: () => this._runReadingFlowDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'reading-flow 文档与示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '520px', overflow: 'auto' } },
          h('code', {}, s.readingFlowInfo || '（点击按钮查看 reading-flow 完整文档与 grid 焦点顺序示例）')),
        h(Alert, {
          type: 'info',
          message: 'reading-flow 让 grid/flex 焦点顺序匹配视觉顺序',
          description: '在容器声明 reading-flow: flow-visual，Tab 键按视觉行序聚焦而非 DOM 序。A11y 关键特性，Chrome 开发中。jsdom 不识别，演示仅展示文档。降级用 tabindex 或调整 DOM 顺序。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ============ 日志面板 ============
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

  // =================== 渲染入口 ===================
  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '无障碍与交互 API 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' }, '演示 Wake Lock / Fullscreen / Visual Viewport / Clipboard / Network Information / InputDeviceCapabilities / ARIA 属性。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard9(),
      this._renderLogPanel(),
    );
  }
}
