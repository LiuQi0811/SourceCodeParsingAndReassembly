// =====================================================================
// WindowPiPViewportPage.js —— Window / PiP / Viewport 显示控制 实验室
// 演示 MDN：
//   1. Document Picture-in-Picture 文档画中画 —— window.documentPictureInPicture
//      requestWindow({width,height,disallowReturnToOpener}) → Promise<Window>，可移动任意 DOM（非仅 video）；
//      .window 当前 PiP 窗口；enter/leave 事件；pipWindow.document.body.append(el) 移动元素（非复制）。
//   2. Visual Viewport 可视视口 —— window.visualViewport：offsetLeft/offsetTop/pageLeft/pageTop/width/height/scale；
//      resize/scroll/scrollend 事件；移动端键盘与双指缩放适配的关键 API。
//   3. Screen Wake Lock 屏幕唤醒锁 —— navigator.wakeLock.request('screen') → Promise<WakeLockSentinel>；
//      sentinel.released/.type/.release()/'release' 事件；需用户手势 + 活跃文档。
//   4. Screen Orientation + Fullscreen —— screen.orientation：type/angle/lock(type)/unlock()/'change'；
//      element.requestFullscreen({navigationUI})/exitFullscreen()/fullscreenElement/fullscreenEnabled/fullscreenchange/error。
//   5. Pointer Lock 指针锁 —— element.requestPointerLock({unadjustedMovement:true}) → Promise(newer)/void(older)；
//      exitPointerLock()/pointerLockElement/pointerlockchange/error；movementX/movementY（FPS / 3D 浏览器；raw 鼠标输入）。
//   6. Virtual Keyboard 虚拟键盘 —— navigator.virtualKeyboard：show()/hide()/.boundingRect；
//      virtualKeyboardPolicy='auto'|'manual'+contenteditable+inputmode；geometrychange 事件；overlaysContent（仅无物理键盘设备）。
// 说明：所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//   jsdom/Node 中 documentPictureInPicture / visualViewport / wakeLock / virtualKeyboard 已由 polyfill 覆盖；
//   screen.orientation / Fullscreen / PointerLock 通常需真实浏览器，Fullscreen / PointerLock 需用户手势触发。
//   componentWillUnmount 释放 wake lock、退出全屏 / PiP、断开 visualViewport 监听（逐个 try/catch）。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class WindowPiPViewportPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：Document Picture-in-Picture
      docPiPInfo: '',
      // Card 2：Visual Viewport
      viewportInfo: '',
      // Card 3：Screen Wake Lock
      wakeLockInfo: '',
      // Card 4：Screen Orientation + Fullscreen
      orientationFsInfo: '',
      // Card 5：Pointer Lock
      pointerLockInfo: '',
      // Card 6：Virtual Keyboard
      virtualKeyboardInfo: '',
    };
  }

  // —— 生命周期：挂载 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._pipWindow = null;              // Card 1：documentPictureInPicture.requestWindow() 返回的窗口
    this._pipMovedEl = null;             // Card 1：被移动进 PiP 窗口的 DOM 元素（追踪用于回填）
    this._onVVResize = null;             // Card 2：visualViewport 'resize' 回调（手动管理）
    this._onVVScroll = null;             // Card 2：visualViewport 'scroll' 回调（手动管理）
    this._wakeLockSentinel = null;       // Card 3：WakeLockSentinel
    this._wakeLockReleaseHandler = null; // Card 3：sentinel 'release' 回调（手动管理）
    this._demoFsEl = null;               // Card 4：演示全屏的 demo 元素
    this._demoPointerEl = null;          // Card 5：演示指针锁的 demo 元素

    // —— 能力检测（绝不抛异常，仅 typeof / in 判定）——
    const caps = this._caps();
    const mark = (b) => (b ? '✓' : '✗');
    const parts = [
      `documentPictureInPicture ${mark(caps.docPiP)}`,
      `visualViewport ${mark(caps.visualViewport)}`,
      `wakeLock ${mark(caps.wakeLock)}`,
      `screen.orientation ${mark(caps.orientation)}`,
      `Fullscreen ${mark(caps.fullscreen)}`,
      `PointerLock ${mark(caps.pointerLock)}`,
      `virtualKeyboard ${mark(caps.virtualKeyboard)}`,
    ];

    const anyAvailable = caps.docPiP || caps.visualViewport || caps.wakeLock || caps.virtualKeyboard;
    const summary = `Window / PiP / Viewport 显示控制 能力检测：${parts.join(' · ')}。\n` +
      `当前环境（jsdom/Node）中 documentPictureInPicture / visualViewport / wakeLock / virtualKeyboard 已由 polyfill 覆盖；` +
      `screen.orientation / Fullscreen / PointerLock 通常需真实浏览器，Fullscreen / PointerLock 需用户手势触发（无手势会失败并记日志，绝不抛异常）。所有按钮点击均做 typeof 守卫，不可用时仅记日志说明。`;
    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.docPiP) this._addLog('warn', 'window.documentPictureInPicture 不可用（需真实浏览器，jsdom 已 polyfill）');
    if (!caps.visualViewport) this._addLog('warn', 'window.visualViewport 不可用');
    if (!caps.wakeLock) this._addLog('warn', 'navigator.wakeLock 不可用（需用户手势 + 活跃文档）');
    if (!caps.orientation) this._addLog('warn', 'screen.orientation 不可用（jsdom 未实现）');
    if (!caps.fullscreen) this._addLog('warn', 'Fullscreen API 不可用（jsdom 未实现 fullscreenEnabled）');
    if (!caps.pointerLock) this._addLog('warn', 'Pointer Lock API 不可用（jsdom 未实现 requestPointerLock）');
    if (!caps.virtualKeyboard) this._addLog('warn', 'navigator.virtualKeyboard 不可用（仅无物理键盘设备）');

    // 注册 document 级事件（Component._eventBindings 自动解绑）：fullscreenchange / pointerlockchange
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      this.on(document, 'fullscreenchange', () => {
        this._addLog('event', `fullscreenchange 触发：fullscreenElement=${document.fullscreenElement}`);
      });
      this.on(document, 'fullscreenerror', () => {
        this._addLog('warn', 'fullscreenerror 触发（全屏请求失败）');
      });
      this.on(document, 'pointerlockchange', () => {
        this._addLog('event', `pointerlockchange 触发：pointerLockElement=${document.pointerLockElement}`);
      });
      this.on(document, 'pointerlockerror', () => {
        this._addLog('warn', 'pointerlockerror 触发（指针锁请求失败）');
      });
    }
    // screen.orientation 'change'（若可用，自动解绑）
    if (caps.orientation && typeof screen.orientation.addEventListener === 'function') {
      this.on(screen.orientation, 'change', () => {
        this._addLog('event', `orientation change：type="${screen.orientation.type}"，angle=${screen.orientation.angle}`);
      });
    }
  }

  // —— 生命周期：卸载 ——
  // 释放 wake lock sentinel、退出全屏、关闭 PiP 窗口、断开 visualViewport 监听（逐个 try/catch）
  componentWillUnmount() {
    // 1) 释放 wake lock sentinel
    if (this._wakeLockSentinel) {
      try {
        if (this._wakeLockReleaseHandler && typeof this._wakeLockSentinel.removeEventListener === 'function') {
          this._wakeLockSentinel.removeEventListener('release', this._wakeLockReleaseHandler);
        }
      } catch { /* noop */ }
      if (!this._wakeLockSentinel.released) {
        try { this._wakeLockSentinel.release(); } catch { /* noop */ }
      }
    }
    this._wakeLockSentinel = null;
    this._wakeLockReleaseHandler = null;
    // 2) 退出全屏
    if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      try { document.exitFullscreen(); } catch { /* noop */ }
    }
    // 3) 退出文档画中画（关闭 PiP 窗口）
    if (this._pipWindow && typeof this._pipWindow.close === 'function') {
      try { this._pipWindow.close(); } catch { /* noop */ }
    }
    this._pipWindow = null;
    this._pipMovedEl = null;
    // 4) 断开 visualViewport 监听（逐个 try/catch）
    const vv = (typeof window !== 'undefined') ? window.visualViewport : null;
    if (vv && typeof vv.removeEventListener === 'function') {
      try { if (this._onVVResize) vv.removeEventListener('resize', this._onVVResize); } catch { /* noop */ }
      try { if (this._onVVScroll) vv.removeEventListener('scroll', this._onVVScroll); } catch { /* noop */ }
    }
    this._onVVResize = null;
    this._onVVScroll = null;
    this._demoFsEl = null;
    this._demoPointerEl = null;
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
  // 不传参：返回布尔标记对象（用于内部逻辑判断）
  // 传 items（[['label', ok], ...]）：返回 Tag 组件数组（用于渲染能力标签）
  _caps(items) {
    const hasWin = typeof window !== 'undefined';
    const hasDoc = typeof document !== 'undefined';
    const hasScreen = typeof screen !== 'undefined';
    const hasNav = typeof navigator !== 'undefined';
    const flags = {
      docPiP: hasWin && typeof window.documentPictureInPicture !== 'undefined' && !!window.documentPictureInPicture,
      visualViewport: hasWin && !!window.visualViewport,
      wakeLock: hasNav && !!navigator.wakeLock && typeof navigator.wakeLock.request === 'function',
      orientation: hasScreen && !!screen.orientation && typeof screen.orientation.type !== 'undefined',
      fullscreen: hasDoc && document.fullscreenEnabled === true,
      pointerLock: hasDoc && typeof Element !== 'undefined' && !!Element.prototype && typeof Element.prototype.requestPointerLock === 'function',
      virtualKeyboard: hasNav && !!navigator.virtualKeyboard,
    };
    if (items === undefined) return flags;
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`),
    );
  }

  // =================== Card 1：Document Picture-in-Picture API ===================

  // documentPictureInPicture.requestWindow({width,height,disallowReturnToOpener}) → Promise<Window>
  // 可移动任意 DOM（非仅 video）；元素被「移动」而非复制
  async _demoDocPiP() {
    const caps = this._caps();
    if (!caps.docPiP) {
      this.setState({ docPiPInfo:
        'window.documentPictureInPicture 不可用。\n\n真实浏览器用法：\n' +
        "const pipWindow = await window.documentPictureInPicture.requestWindow({ width:320, height:240, disallowReturnToOpener:false });\n" +
        '// 把任意 DOM 元素移动进 PiP 窗口（元素被移动而非复制）\n' +
        'pipWindow.document.body.append(myElement);   // window.documentPictureInPicture.window → 当前 PiP 窗口引用\n' +
        "// 事件：'enter' (e.window) / 'leave'；documentPictureInPicture.addEventListener('enter', (e) => e.window);" });
      this._addLog('warn', 'documentPictureInPicture 不可用，已记录用法');
      return;
    }
    const dpip = window.documentPictureInPicture;
    try {
      // 注册 enter / leave 事件（若未注册过）
      if (!this._pipEnterBound) {
        this._pipEnterBound = true;
        if (typeof dpip.addEventListener === 'function') {
          this.on(dpip, 'enter', (e) => this._addLog('event', `documentPictureInPicture 'enter'：e.window=${e && e.window}`));
          this.on(dpip, 'leave', () => {
            this._addLog('event', "documentPictureInPicture 'leave'：PiP 窗口已关闭");
            this._pipWindow = null; this._pipMovedEl = null;
          });
        }
      }
      // 构造一个待移动的 DOM 元素（演示任意 DOM，非仅 video）
      const movedEl = (typeof document !== 'undefined' && typeof document.createElement === 'function')
        ? document.createElement('div') : null;
      if (movedEl) {
        movedEl.textContent = 'PiP 演示内容（任意 DOM）';
        movedEl.setAttribute('data-pip-demo', '1');
      }
      this._addLog('info', '调用 documentPictureInPicture.requestWindow({width:320,height:240,disallowReturnToOpener:true})…');
      const pipWindow = await dpip.requestWindow({
        width: 320, height: 240, disallowReturnToOpener: true,
      });
      this._pipWindow = pipWindow;
      this._pipMovedEl = movedEl;
      // 移动 DOM 进 PiP 窗口（元素被移动而非复制）
      let movedOk = false;
      if (movedEl && pipWindow && pipWindow.document && pipWindow.document.body) {
        const body = pipWindow.document.body;
        try {
          if (typeof body.append === 'function') { body.append(movedEl); movedOk = true; }
          else if (typeof body.appendChild === 'function') { body.appendChild(movedEl); movedOk = true; }
        } catch (e) { this._addLog('warn', `移动 DOM 进 PiP 失败：${errInfo(e).message}`); }
      }
      const currentWin = (typeof dpip.window !== 'undefined') ? dpip.window : null;
      this.setState({ docPiPInfo:
        'documentPictureInPicture.requestWindow() → PiP 窗口 ✓\n' +
        `  返回窗口：${pipWindow ? typeof pipWindow : 'null'}；documentPictureInPicture.window=${currentWin ? '已设置' : 'null'}\n` +
        `  DOM 移动：${movedOk ? '已 append 进 pipWindow.document.body（元素被移动而非复制）' : '未移动（环境无 body.append）'}\n\n` +
        'API 要点：requestWindow({width,height,disallowReturnToOpener}) → Promise<Window>（全新 window）；\n' +
        '  可移动任意 DOM（非仅 video），适合把控件 / 面板独立到浮动窗口；事件 enter (e.window) / leave。\n' +
        '  jsdom 无原生支持，polyfill 已 mock（body.append 为 no-op，元素实际未离开主文档）。' });
      this._addLog('pip', `requestWindow 成功，DOM 移动=${movedOk}，当前 PiP 窗口=${currentWin ? '已设置' : 'null'}`);
    } catch (err) {
      this._addLog('warn', `requestWindow 失败：${errInfo(err).name} - ${errInfo(err).message}（可能无用户手势或浏览器不支持）`);
      this.setState({ docPiPInfo: `requestWindow 失败：${errInfo(err).name} - ${errInfo(err).message}\n常见原因：未由用户手势触发 / 浏览器不支持 / 已有 PiP 窗口。` });
    }
  }

  // 关闭 PiP 窗口
  _closeDocPiP() {
    if (!this._pipWindow) {
      this._addLog('warn', '无 PiP 窗口可关闭');
      return;
    }
    try {
      if (typeof this._pipWindow.close === 'function') this._pipWindow.close();
      this._addLog('pip', '已关闭 PiP 窗口（pipWindow.close()）');
      this.setState({ docPiPInfo: 'PiP 窗口已关闭（pipWindow.close()）。\n说明：关闭后触发 leave 事件；元素是否回填主文档需自行处理（API 不自动回填）。' });
    } catch (err) {
      this._addLog('warn', `关闭 PiP 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
    this._pipWindow = null;
    this._pipMovedEl = null;
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Document Picture-in-Picture API 文档画中画',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['DocPiP', caps.docPiP], ['任意DOM', caps.docPiP]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.documentPictureInPicture.requestWindow({width,height,disallowReturnToOpener}) 返回 Promise<Window>，得到一个全新 window 对象，可把任意 DOM 元素「移动」进去（非仅 video，元素被移动而非复制）。window.documentPictureInPicture.window 指向当前 PiP 窗口；事件 enter（e.window）/ leave。适合把视频控件、聊天面板、笔记等独立到浮动窗口。jsdom 无原生支持，polyfill 已 mock。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('requestWindow + 移动 DOM', { type: 'primary', size: 'sm', disabled: !caps.docPiP, onClick: () => this._demoDocPiP() }),
          this._btn('关闭 PiP', { danger: true, size: 'sm', disabled: !caps.docPiP, onClick: () => this._closeDocPiP() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Document PiP 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.docPiPInfo || '（点击「requestWindow + 移动 DOM」开始演示）')),
        h(Alert, {
          type: 'warning',
          message: 'requestWindow 需用户手势触发',
          description: 'Document PiP 必须在用户手势（点击）回调中调用；disallowReturnToOpener:true 时用户无法从 PiP 窗口返回原页面。元素被移动进 PiP 后会从原文档移除，关闭 PiP 时不会自动回填，需开发者手动处理。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Visual Viewport API ===================

  // 读取 visualViewport 属性
  _readViewport() {
    const caps = this._caps();
    if (!caps.visualViewport) {
      this.setState({ viewportInfo:
        'window.visualViewport 不可用。\n\n真实浏览器用法：\n' +
        'const vv = window.visualViewport;\n' +
        'vv.width/height/scale/offsetLeft/offsetTop/pageLeft/pageTop\n' +
        "vv.addEventListener('resize', (e) => e.target.width);\n" +
        "vv.addEventListener('scroll', (e) => e.target.pageTop);" });
      this._addLog('warn', 'visualViewport 不可用，已记录用法');
      return;
    }
    try {
      const vv = window.visualViewport;
      this.setState({ viewportInfo:
        'window.visualViewport 属性快照：\n' +
        `  width=${vv.width}  height=${vv.height}  scale=${vv.scale}\n` +
        `  offsetLeft=${vv.offsetLeft}  offsetTop=${vv.offsetTop}  pageLeft=${vv.pageLeft}  pageTop=${vv.pageTop}\n\n` +
        'API 要点：width/height 为可视视口尺寸（CSS px，受双指缩放影响）；scale 为相对 layout viewport 的缩放比（1.0 未缩放）；\n' +
        '  offsetLeft/offsetTop 与 pageLeft/pageTop 为相对 layout viewport 的偏移；\n' +
        '  事件：resize（尺寸变化）/ scroll（滚动）/ scrollend；关键用途：移动端键盘弹出与双指缩放适配。' });
      this._addLog('viewport', `visualViewport：${vv.width}x${vv.height}，scale=${vv.scale}，pageLeft=${vv.pageLeft}，pageTop=${vv.pageTop}`);
    } catch (err) {
      this._addLog('warn', `读取 visualViewport 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  // 注册 visualViewport resize / scroll 监听（手动管理，componentWillUnmount 中逐个 try/catch 断开）
  _bindViewport() {
    const caps = this._caps();
    if (!caps.visualViewport) {
      this._addLog('warn', 'visualViewport 不可用，无法注册监听');
      return;
    }
    const vv = window.visualViewport;
    if (typeof vv.addEventListener !== 'function') {
      this._addLog('warn', 'visualViewport.addEventListener 不可用');
      return;
    }
    // 先清理旧监听
    if (this._onVVResize) { try { vv.removeEventListener('resize', this._onVVResize); } catch { /* noop */ } }
    if (this._onVVScroll) { try { vv.removeEventListener('scroll', this._onVVScroll); } catch { /* noop */ } }
    this._onVVResize = (e) => { const t = e && e.target ? e.target : vv; this._addLog('event', `visualViewport resize：width=${t.width}，height=${t.height}，scale=${t.scale}`); };
    this._onVVScroll = (e) => { const t = e && e.target ? e.target : vv; this._addLog('event', `visualViewport scroll：pageLeft=${t.pageLeft}，pageTop=${t.pageTop}`); };
    try { vv.addEventListener('resize', this._onVVResize); } catch (err) { this._addLog('warn', `注册 resize 失败：${errInfo(err).message}`); }
    try { vv.addEventListener('scroll', this._onVVScroll); } catch (err) { this._addLog('warn', `注册 scroll 失败：${errInfo(err).message}`); }
    this.setState({ viewportInfo:
      '已注册 visualViewport 事件监听 ✓\n' +
      "  • 'resize'：视口尺寸 / 缩放变化时触发（e.target.width / scale）\n" +
      "  • 'scroll'：visual viewport 滚动时触发（e.target.pageLeft / pageTop）\n" +
      `当前快照：width=${vv.width}，height=${vv.height}，scale=${vv.scale}\n` +
      '说明：监听在组件卸载时逐个 try/catch 断开；jsdom 中事件不会真实触发。' });
    this._addLog('viewport', '已注册 visualViewport resize / scroll 监听');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Visual Viewport API 可视视口',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['visualViewport', caps.visualViewport], ['resize/scroll', caps.visualViewport]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.visualViewport 反映用户实际可见的视口（受双指缩放与移动端键盘影响），区别于 layout viewport。属性：width / height / scale / offsetLeft / offsetTop / pageLeft / pageTop。事件：resize（视口尺寸或缩放变化）/ scroll（视口滚动）/ scrollend。e.target 指向 visualViewport 自身。常用于：移动端键盘弹出时调整布局、双指缩放适配、固定元素定位。jsdom 中由 polyfill mock 提供静态值。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取属性', { type: 'primary', size: 'sm', disabled: !caps.visualViewport, onClick: () => this._readViewport() }),
          this._btn('监听 resize/scroll', { size: 'sm', disabled: !caps.visualViewport, onClick: () => this._bindViewport() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Visual Viewport 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.viewportInfo || '（点击「读取属性」或「监听 resize/scroll」）')),
        h(Alert, {
          type: 'info',
          message: 'visualViewport 是移动端键盘 / 缩放适配的关键',
          description: 'layout viewport（document.documentElement.clientWidth）不随键盘变化，而 visualViewport.height 在键盘弹出时减小。据此调整固定栏 / 输入区位置可避免被键盘遮挡。scale > 1 表示用户已放大页面。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Screen Wake Lock API ===================

  // navigator.wakeLock.request('screen') → Promise<WakeLockSentinel>
  async _requestWakeLock() {
    const caps = this._caps();
    if (!caps.wakeLock) {
      this.setState({ wakeLockInfo:
        'navigator.wakeLock 不可用。\n\n真实浏览器用法：\n' +
        "const sentinel = await navigator.wakeLock.request('screen');\n" +
        "sentinel.addEventListener('release', () => console.log('已释放'));   // type='screen', released=false\n" +
        'await sentinel.release();   // 主动释放，released → true' });
      this._addLog('warn', 'navigator.wakeLock 不可用（需用户手势 + 活跃文档）');
      return;
    }
    try {
      // 释放旧的 sentinel
      if (this._wakeLockSentinel && !this._wakeLockSentinel.released) {
        try { if (this._wakeLockReleaseHandler) this._wakeLockSentinel.removeEventListener('release', this._wakeLockReleaseHandler); } catch { /* noop */ }
        try { await this._wakeLockSentinel.release(); } catch { /* noop */ }
      }
      this._addLog('info', "调用 navigator.wakeLock.request('screen')…");
      const sentinel = await navigator.wakeLock.request('screen');
      this._wakeLockSentinel = sentinel;
      // 注册 release 事件（手动管理）
      this._wakeLockReleaseHandler = () => this._addLog('event', `WakeLockSentinel 'release' 触发：released=${sentinel.released}`);
      if (typeof sentinel.addEventListener === 'function') {
        try { sentinel.addEventListener('release', this._wakeLockReleaseHandler); } catch { /* noop */ }
      }
      this.setState({ wakeLockInfo:
        "navigator.wakeLock.request('screen') → WakeLockSentinel ✓\n" +
        `  sentinel.type = "${sentinel.type}"（始终 'screen'）  released = ${sentinel.released}（false 持有中）\n` +
        `  release() → Promise<void>（主动释放，released 变 true）；'release' 事件已注册\n\n` +
        'API 要点：需用户手势 + 文档活跃（visibilityState=visible）；页面隐藏时 sentinel 可能被系统自动释放\n' +
        '  （需在 visibilitychange 中重新请求）；仅 screen 类型，无其它类型。' });
      this._addLog('wake', `wakeLock 成功：type=${sentinel.type}，released=${sentinel.released}`);
    } catch (err) {
      this._addLog('warn', `request wakeLock 失败：${errInfo(err).name} - ${errInfo(err).message}（可能无用户手势 / 文档不可见 / 权限拒绝）`);
      this.setState({ wakeLockInfo: `request('screen') 失败：${errInfo(err).name} - ${errInfo(err).message}\n常见原因：未由用户手势触发 / 文档不可见 / 浏览器不支持。` });
    }
  }

  // 主动释放 wake lock
  async _releaseWakeLock() {
    if (!this._wakeLockSentinel) {
      this._addLog('warn', '无 WakeLockSentinel 可释放');
      return;
    }
    try {
      if (this._wakeLockSentinel.released) {
        this._addLog('wake', 'sentinel 已 released，无需重复释放');
        return;
      }
      if (this._wakeLockReleaseHandler && typeof this._wakeLockSentinel.removeEventListener === 'function') {
        try { this._wakeLockSentinel.removeEventListener('release', this._wakeLockReleaseHandler); } catch { /* noop */ }
      }
      await this._wakeLockSentinel.release();
      this._addLog('wake', `sentinel.release() 完成：released=${this._wakeLockSentinel.released}`);
      this.setState({ wakeLockInfo: `sentinel.release() 完成 ✓\n  released = ${this._wakeLockSentinel.released}\n说明：释放后屏幕恢复正常休眠；'release' 事件已断开。` });
    } catch (err) {
      this._addLog('warn', `release 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
    this._wakeLockSentinel = null;
    this._wakeLockReleaseHandler = null;
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. Screen Wake Lock API 屏幕唤醒锁',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['wakeLock', caps.wakeLock], ['screen', caps.wakeLock]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "navigator.wakeLock.request('screen') 返回 Promise<WakeLockSentinel>，阻止屏幕进入休眠（如视频播放、导航、阅读时）。WakeLockSentinel.type 始终为 'screen'；released 布尔标记是否已释放；release() 返回 Promise 主动释放；'release' 事件在释放时触发（含系统自动释放）。要求用户手势 + 文档可见（visibilityState='visible'）。页面隐藏时系统可能自动释放，需在 visibilitychange 中重新请求。jsdom 中由 polyfill mock 提供。"),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn("request('screen')", { type: 'primary', size: 'sm', disabled: !caps.wakeLock, onClick: () => this._requestWakeLock() }),
          this._btn('release 释放', { danger: true, size: 'sm', disabled: !caps.wakeLock, onClick: () => this._releaseWakeLock() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Wake Lock 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.wakeLockInfo || '（点击 "request(\'screen\')" 申请唤醒锁）')),
        h(Alert, {
          type: 'warning',
          message: '页面隐藏时 wake lock 可能被系统自动释放',
          description: '应在 visibilitychange 事件中检测 document.visibilityState==="visible" 后重新 request；多 sentinel 不会叠加，但应避免泄漏（不使用时主动 release）。需用户手势触发首次请求。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Screen Orientation + Fullscreen API ===================

  // 读取 screen.orientation.type / angle
  _readOrientation() {
    const caps = this._caps();
    if (!caps.orientation) {
      this.setState({ orientationFsInfo:
        'screen.orientation 不可用（jsdom 未实现）。\n\n真实浏览器：\n' +
        "  type ∈ 'portrait-primary'/'portrait-secondary'/'landscape-primary'/'landscape-secondary'；angle ∈ 0/90/180/270\n" +
        "  await screen.orientation.lock('landscape');   // 需先进入全屏；unlock() 解除；'change' 事件监听方向变化" });
      this._addLog('warn', 'screen.orientation 不可用，已记录用法');
      return;
    }
    try {
      const ori = screen.orientation;
      this.setState({ orientationFsInfo:
        `screen.orientation 快照：\n  type = "${ori.type}"   angle = ${ori.angle}\n\n` +
        'API 要点：type 为主/副方向（primary/secondary）× 纵/横（portrait/landscape）；angle 为屏幕相对自然方向的旋转角度（0/90/180/270）；\n' +
        "  lock(type) 锁定方向（返回 Promise，要求文档已全屏）；unlock() 解除锁定；'change' 事件方向变化时触发（已在 componentDidMount 注册）。" });
      this._addLog('orient', `orientation：type="${ori.type}"，angle=${ori.angle}`);
    } catch (err) {
      this._addLog('warn', `读取 orientation 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  // 尝试进入全屏（无用户手势会失败，catch 并记录）
  async _attemptFullscreen() {
    if (typeof document === 'undefined' || document.fullscreenEnabled !== true) {
      this._addLog('warn', 'Fullscreen API 不可用（document.fullscreenEnabled !== true）');
      this.setState({ orientationFsInfo:
        'Fullscreen API 不可用。\n\n真实浏览器用法：\n' +
        "element.requestFullscreen({ navigationUI: 'auto' | 'show' | 'hide' });\n" +
        'document.exitFullscreen();   document.fullscreenElement;   // 退出 / 当前全屏元素\n' +
        "document.addEventListener('fullscreenchange' / 'fullscreenerror', cb);\n" +
        '说明：requestFullscreen 需用户手势触发；navigationUI 控制是否显示浏览器 UI。' });
      return;
    }
    try {
      // 创建 / 复用 demo 元素
      if (!this._demoFsEl && typeof document.createElement === 'function') {
        this._demoFsEl = document.createElement('div');
        this._demoFsEl.textContent = '全屏演示容器';
      }
      const el = this._demoFsEl;
      if (!el) {
        this._addLog('warn', '无法创建 demo 元素');
        return;
      }
      this._addLog('info', "调用 demoEl.requestFullscreen({ navigationUI: 'hide' })…");
      if (typeof el.requestFullscreen !== 'function') {
        this._addLog('warn', 'element.requestFullscreen 不可用（jsdom 未实现）');
        return;
      }
      await el.requestFullscreen({ navigationUI: 'hide' });
      this.setState({ orientationFsInfo:
        `requestFullscreen 成功 ✓\n  fullscreenElement = ${document.fullscreenElement === el ? 'demoEl' : document.fullscreenElement}\n\n` +
        "API 要点：element.requestFullscreen({ navigationUI: 'auto'|'show'|'hide' }) → Promise；document.exitFullscreen() → Promise（退出全屏）；\n" +
        '  document.fullscreenElement（当前全屏元素，无则 null）；document.fullscreenEnabled（布尔，能力检测）；\n' +
        '  事件：fullscreenchange / fullscreenerror（已注册自动解绑）。' });
      this._addLog('fullscreen', `requestFullscreen 成功，fullscreenElement=${document.fullscreenElement}`);
    } catch (err) {
      this._addLog('warn', `requestFullscreen 失败：${errInfo(err).name} - ${errInfo(err).message}（通常需用户手势触发）`);
      this.setState({ orientationFsInfo:
        `requestFullscreen 失败：${errInfo(err).name} - ${errInfo(err).message}\n常见原因：未由用户手势触发 / 元素不可全屏 / 浏览器拒绝。jsdom 中 fullscreenEnabled 为 false，无法真实进入全屏。` });
    }
  }

  // 退出全屏
  async _exitFullscreen() {
    if (typeof document === 'undefined' || !document.fullscreenElement) {
      this._addLog('warn', '当前无全屏元素，无需 exitFullscreen');
      return;
    }
    try {
      await document.exitFullscreen();
      this._addLog('fullscreen', 'document.exitFullscreen() 完成');
    } catch (err) {
      this._addLog('warn', `exitFullscreen 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Screen Orientation + Fullscreen API 屏幕方向与全屏',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['orientation', caps.orientation], ['Fullscreen', caps.fullscreen]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "screen.orientation.type（portrait-primary / landscape-secondary 等）与 angle 反映屏幕方向；lock(type) 锁定方向（要求文档已全屏）、unlock() 解除、'change' 事件监听变化。Fullscreen API：element.requestFullscreen({navigationUI:'auto'|'show'|'hide'}) 进入全屏（需用户手势）、document.exitFullscreen() 退出、document.fullscreenElement 当前全屏元素、document.fullscreenEnabled 能力检测、fullscreenchange / fullscreenerror 事件。jsdom 中 orientation 与 fullscreen 通常未实现。"),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 orientation', { type: 'primary', size: 'sm', disabled: !caps.orientation, onClick: () => this._readOrientation() }),
          this._btn('requestFullscreen', { size: 'sm', disabled: !caps.fullscreen, onClick: () => this._attemptFullscreen() }),
          this._btn('exitFullscreen', { danger: true, size: 'sm', disabled: !caps.fullscreen, onClick: () => this._exitFullscreen() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Orientation / Fullscreen 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.orientationFsInfo || '（点击「读取 orientation」或「requestFullscreen」）')),
        h(Alert, {
          type: 'warning',
          message: 'orientation.lock 需先进入全屏，requestFullscreen 需用户手势',
          description: 'screen.orientation.lock 要求文档处于全屏状态，否则抛错；requestFullscreen 必须在用户手势回调中调用，否则被浏览器拒绝。jsdom 中两者均未实现，本页 catch 失败并记录原因。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Pointer Lock API ===================

  // 尝试请求指针锁（无用户手势会失败，catch 并记录）
  async _attemptPointerLock() {
    const caps = this._caps();
    if (!caps.pointerLock) {
      this.setState({ pointerLockInfo:
        'Pointer Lock API 不可用（element.requestPointerLock 不存在）。\n\n真实浏览器用法：\n' +
        '// 新版返回 Promise，旧版返回 void\n' +
        'await element.requestPointerLock({ unadjustedMovement: true });   // 原始鼠标输入（无 OS 加速度）\n' +
        'document.exitPointerLock();   document.pointerLockElement;   // 退出锁定 / 当前锁定元素\n' +
        "document.addEventListener('pointerlockchange' / 'pointerlockerror', cb);\n" +
        '// 锁定后 MouseEvent.movementX / movementY 提供无限相对位移（FPS / 3D 浏览器）' });
      this._addLog('warn', 'Pointer Lock 不可用（jsdom 未实现 requestPointerLock）');
      return;
    }
    try {
      if (!this._demoPointerEl && typeof document.createElement === 'function') {
        this._demoPointerEl = document.createElement('div');
        this._demoPointerEl.textContent = '指针锁演示容器';
      }
      const el = this._demoPointerEl;
      if (!el) {
        this._addLog('warn', '无法创建 demo 元素');
        return;
      }
      this._addLog('info', '调用 demoEl.requestPointerLock({ unadjustedMovement: true })…');
      const ret = el.requestPointerLock({ unadjustedMovement: true });
      // 新版返回 Promise，旧版返回 undefined
      if (ret && typeof ret.then === 'function') {
        await ret;
      }
      this.setState({ pointerLockInfo:
        `requestPointerLock 调用完成 ✓\n  pointerLockElement = ${document.pointerLockElement === el ? 'demoEl' : document.pointerLockElement}\n\n` +
        'API 要点：element.requestPointerLock({ unadjustedMovement: true }) → Promise（新版）/ void（旧版）；\n' +
        '  unadjustedMovement:true 使用原始鼠标输入（绕过 OS 鼠标加速度，FPS 精准瞄准）；document.exitPointerLock() 退出锁定；\n' +
        '  document.pointerLockElement 当前锁定元素；事件 pointerlockchange / pointerlockerror（已注册自动解绑）；\n' +
        '  锁定后 MouseEvent.movementX / movementY 提供无限相对位移。' });
      this._addLog('pointer', `requestPointerLock 完成，pointerLockElement=${document.pointerLockElement}`);
    } catch (err) {
      this._addLog('warn', `requestPointerLock 失败：${errInfo(err).name} - ${errInfo(err).message}（通常需用户手势触发）`);
      this.setState({ pointerLockInfo:
        `requestPointerLock 失败：${errInfo(err).name} - ${errInfo(err).message}\n常见原因：未由用户手势触发 / unadjustedMovement 不被支持 / 用户拒绝。典型场景：FPS 游戏、3D 模型查看器。` });
    }
  }

  // 退出指针锁
  _exitPointerLock() {
    if (typeof document === 'undefined' || !document.pointerLockElement || typeof document.exitPointerLock !== 'function') {
      this._addLog('warn', '当前无指针锁元素，无需 exitPointerLock');
      return;
    }
    try {
      document.exitPointerLock();
      this._addLog('pointer', 'document.exitPointerLock() 完成');
    } catch (err) {
      this._addLog('warn', `exitPointerLock 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Pointer Lock API 指针锁',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['PointerLock', caps.pointerLock], ['movementX/Y', caps.pointerLock]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.requestPointerLock({ unadjustedMovement: true }) 请求指针锁（新版返回 Promise，旧版返回 void）；锁定后鼠标光标隐藏、MouseEvent.movementX / movementY 提供无限相对位移（不再受屏幕边界限制），适合 FPS 游戏瞄准、3D 模型 / 全景查看器。unadjustedMovement:true 使用原始鼠标输入（绕过 OS 鼠标加速度，更精准）。document.exitPointerLock() 退出；document.pointerLockElement 当前锁定元素；pointerlockchange / pointerlockerror 事件。需用户手势触发。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('requestPointerLock', { type: 'primary', size: 'sm', disabled: !caps.pointerLock, onClick: () => this._attemptPointerLock() }),
          this._btn('exitPointerLock', { danger: true, size: 'sm', disabled: !caps.pointerLock, onClick: () => this._exitPointerLock() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Pointer Lock 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.pointerLockInfo || '（点击「requestPointerLock」尝试锁定指针）')),
        h(Alert, {
          type: 'info',
          message: '指针锁典型场景：FPS 游戏与 3D 浏览器',
          description: '锁定后 movementX/movementY 可无限累积，实现 360° 环视而不受屏幕边界限制；unadjustedMovement 提供原始输入便于精准瞄准（部分浏览器不支持会回退或抛错）。需在用户手势回调中调用，jsdom 中未实现，本页 catch 失败并记录。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：Virtual Keyboard API ===================

  // 检测 navigator.virtualKeyboard
  _detectVirtualKeyboard() {
    const caps = this._caps();
    if (!caps.virtualKeyboard) {
      this.setState({ virtualKeyboardInfo:
        'navigator.virtualKeyboard 不可用（仅无物理键盘设备，如平板 / 手机）。\n\n真实浏览器用法：\n' +
        'navigator.virtualKeyboard.show() / hide();   // 程序化唤起 / 收起\n' +
        'navigator.virtualKeyboard.boundingRect;   // 键盘几何 {x,y,width,height}\n' +
        "navigator.virtualKeyboard.overlaysContent = true;   // 应用自行绘制键盘区域\n" +
        "element.virtualKeyboardPolicy = 'auto' | 'manual';   // 'manual' 时需自行 show/hide\n" +
        "navigator.virtualKeyboard.addEventListener('geometrychange', cb);\n" +
        '// contenteditable + inputmode 指定键盘类型' });
      this._addLog('warn', 'navigator.virtualKeyboard 不可用（仅无物理键盘设备）');
      return;
    }
    try {
      const vk = navigator.virtualKeyboard;
      const rect = vk.boundingClientRect;
      const rectStr = rect ? `{ x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height} }` : 'null';
      this.setState({ virtualKeyboardInfo:
        'navigator.virtualKeyboard 检测 ✓\n' +
        `  boundingClientRect = ${rectStr}\n  overlaysContent = ${vk.overlaysContent}\n` +
        `  show/hide/addEventListener 存在：${typeof vk.show === 'function'} / ${typeof vk.hide === 'function'} / ${typeof vk.addEventListener === 'function'}\n\n` +
        'API 要点：show()/hide() 程序化唤起/收起虚拟键盘（需配合 virtualKeyboardPolicy）；boundingClientRect 键盘几何矩形（DOMRectReadOnly）；\n' +
        "  overlaysContent=true 时由应用自行处理键盘遮挡布局；element.virtualKeyboardPolicy = 'auto'（默认，浏览器自动）/ 'manual'（应用自行 show/hide）；\n" +
        "  'geometrychange' 事件：键盘几何变化时触发；配合 contenteditable + inputmode 指定输入类型（numeric / decimal 等）。" });
      this._addLog('vkbd', `virtualKeyboard 检测：overlaysContent=${vk.overlaysContent}，boundingRect=${rectStr}`);
    } catch (err) {
      this._addLog('warn', `检测 virtualKeyboard 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  // 程序化显示 / 隐藏虚拟键盘
  _toggleVirtualKeyboard(show) {
    const caps = this._caps();
    if (!caps.virtualKeyboard) { this._addLog('warn', 'navigator.virtualKeyboard 不可用'); return; }
    try {
      const vk = navigator.virtualKeyboard;
      const fn = show ? vk.show : vk.hide;
      if (typeof fn === 'function') { fn.call(vk); this._addLog('vkbd', `virtualKeyboard.${show ? 'show' : 'hide'}() 已调用`); }
      else { this._addLog('warn', `virtualKeyboard.${show ? 'show' : 'hide'} 不可用`); }
    } catch (err) {
      this._addLog('warn', `${show ? 'show' : 'hide'} 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. Virtual Keyboard API 虚拟键盘',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['virtualKeyboard', caps.virtualKeyboard], ['geometrychange', caps.virtualKeyboard]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "navigator.virtualKeyboard（仅无物理键盘设备，如平板 / 手机）提供程序化控制：show() 唤起 / hide() 收起 / boundingRect 键盘几何 / overlaysContent 控制是否由应用自行处理遮挡布局 / 'geometrychange' 事件监听几何变化。元素 virtualKeyboardPolicy='auto'（浏览器自动，默认）/ 'manual'（应用自行 show/hide，配合 contenteditable + inputmode 实现自定义键盘 UI）。jsdom 中由 polyfill mock 提供。"),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 virtualKeyboard', { type: 'primary', size: 'sm', disabled: !caps.virtualKeyboard, onClick: () => this._detectVirtualKeyboard() }),
          this._btn('show()', { size: 'sm', disabled: !caps.virtualKeyboard, onClick: () => this._toggleVirtualKeyboard(true) }),
          this._btn('hide()', { size: 'sm', disabled: !caps.virtualKeyboard, onClick: () => this._toggleVirtualKeyboard(false) }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Virtual Keyboard 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.virtualKeyboardInfo || '（点击「检测 virtualKeyboard」开始演示）')),
        h(Alert, {
          type: 'info',
          message: 'manual 策略用于自定义键盘 UI',
          description: '当应用实现自定义输入面板（如表情键盘、特殊符号栏）时，设置 virtualKeyboardPolicy="manual" 可阻止系统键盘自动弹出，由应用自行 show/hide。overlaysContent=true 时浏览器不再调整布局，应用需根据 boundingRect / geometrychange 自行避让键盘区域。',
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
    return h('div', { class: 'api-lab-page window-pip-viewport-page' },
      h('h2', { class: 'section-title' }, 'Window / PiP / Viewport 显示控制 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '文档画中画 / 可视视口 / 屏幕唤醒锁 / 方向与全屏 / 指针锁 / 虚拟键盘。本页演示 Window/PiP/Viewport 显示控制类 API，覆盖任意 DOM 画中画、移动端键盘与缩放适配、唤醒锁、全屏与方向锁定、指针锁、虚拟键盘控制。'),
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
