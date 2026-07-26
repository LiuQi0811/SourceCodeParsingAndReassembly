// =====================================================================
// PWAModernPage.js —— PWA 与现代 Web 平台 API 实验室
// 演示 MDN：
//   1. Web App Manifest + BeforeInstallPromptEvent   —— <link rel="manifest"> / appinstalled / display-mode
//   2. App Badging API + Window Controls Overlay     —— navigator.setAppBadge / windowControlsOverlay / geometrychange
//   3. Document Picture-in-Picture + Protocol Handler —— documentPictureInPicture.requestWindow / registerProtocolHandler
//   4. Launch Handler + File Handling API            —— launchQueue.setConsumer / LaunchParams.files / file_handlers
//   5. Navigation API + Page Lifecycle                —— navigation.navigate / visibilitychange / freeze / resume
// 大量 API 仅在 Chromium 内核、HTTPS、已安装 PWA 上下文下可用；
// 本页所有调用前均做能力检测（typeof / in），不可用时仅记日志，不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// Manifest 完整字段示例（Card 1 展示）
const MANIFEST_EXAMPLE = {
  name: 'API 实验室 PWA',
  short_name: 'APILab',
  description: '演示 MDN Web API 的纯原生 SPA',
  start_url: '/?source=pwa',
  scope: '/',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone', 'browser'],
  orientation: 'any',
  theme_color: '#1677ff',
  background_color: '#ffffff',
  lang: 'zh-CN',
  dir: 'ltr',
  categories: ['education', 'developer', 'productivity'],
  icons: [
    { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'API 实验室', short_name: 'Lab', url: '/api-lab', icons: [{ src: '/icons/lab.png', sizes: '96x96' }] },
  ],
  share_target: {
    action: '/share-receive',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'file', accept: ['image/*'] }] },
  },
  file_handlers: [
    { action: '/open-file', accept: { 'text/plain': ['.txt', '.md'], 'application/json': ['.json'] } },
  ],
  protocol_handlers: [
    { protocol: 'web+study', url: '/handle?uri=%s' },
  ],
};

// Manifest file_handlers 子字段示例（Card 4 展示）
const FILE_HANDLERS_EXAMPLE = {
  file_handlers: [
    {
      action: '/open-text',
      icons: [{ src: '/icons/text.png', sizes: '192x192' }],
      launch_type: 'single-client',
      accept: {
        'text/plain': ['.txt', '.md', '.log'],
        'text/markdown': ['.md'],
        'application/json': ['.json'],
      },
    },
    {
      action: '/open-image',
      accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] },
    },
  ],
};

export class PWAModernPage extends Page {
  initialState() {
    return {
      logs: [],
      // Card 1
      deferredPromptAvailable: false,   // beforeinstallprompt 是否已触发并缓存
      installOutcome: '',               // userChoice 结果
      displayMode: 'browser',           // 当前 display-mode
      isStandalone: false,              // 是否 standalone
      appInstalled: false,
      // Card 2
      wcoVisible: false,
      titlebarRect: null,               // getTitlebarAreaRect() 结果
      // Card 3
      docPipActive: false,              // Document PiP 是否打开
      // Card 4
      launchParams: null,               // LaunchParams 摘要
      // Card 5
      navCurrentURL: '',
      navEntryCount: 0,
      visibilityState: 'visible',
      lifecycleEvents: [],              // 最近捕获的 lifecycle 事件（用于一次性展示，不无限增长）
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测日志（一次性 setState，避免循环）——
    const c = this._caps();
    const summary = [
      `BeforeInstallPromptEvent:${c.beforeInstallPrompt ? '✓' : '✗'}`,
      `setAppBadge:${c.badging ? '✓' : '✗'}`,
      `windowControlsOverlay:${c.wco ? '✓' : '✗'}`,
      `documentPictureInPicture:${c.docPip ? '✓' : '✗'}`,
      `registerProtocolHandler:${c.protocolHandler ? '✓' : '✗'}`,
      `launchQueue:${c.launchQueue ? '✓' : '✗'}`,
      `navigation:${c.navigation ? '✓' : '✗'}`,
    ].join('  ');
    this._addLog('cap', `能力检测：${summary}`);

    // —— Card 1：尽早注册 beforeinstallprompt / appinstalled 监听（页面加载时可能已触发）——
    if (c.beforeInstallPrompt) {
      this._onBeforeInstallPrompt = (e) => {
        e.preventDefault(); // 阻止浏览器自动弹出，改为手动 prompt()
        this._deferredPrompt = e;
        this.setState({ deferredPromptAvailable: true });
        this._addLog('manifest', 'beforeinstallprompt 触发，已缓存到 _deferredPrompt（preventDefault 已阻止默认提示）');
      };
      window.addEventListener('beforeinstallprompt', this._onBeforeInstallPrompt);
    }
    this._onAppInstalled = () => {
      this.setState({ appInstalled: true });
      this._addLog('manifest', 'appinstalled 触发：应用已被安装到主屏');
    };
    window.addEventListener('appinstalled', this._onAppInstalled);

    // —— Card 1：display-mode 媒体查询（一次性读取 + 监听变化）——
    if (typeof window.matchMedia === 'function') {
      try {
        this._dmMql = window.matchMedia('(display-mode: standalone)');
        const sync = () => {
          const standalone = !!this._dmMql.matches;
          const mode = standalone ? 'standalone' : 'browser';
          this.setState({ displayMode: mode, isStandalone: standalone });
        };
        sync();
        this._onDisplayModeChange = (e) => {
          this.setState({ displayMode: e.matches ? 'standalone' : 'browser', isStandalone: !!e.matches });
          this._addLog('manifest', `display-mode 变化：matches=${e.matches} (${e.media})`);
        };
        // 兼容旧 Safari：addListener 已废弃但部分实现仍存在
        if (typeof this._dmMql.addEventListener === 'function') {
          this._dmMql.addEventListener('change', this._onDisplayModeChange);
        } else if (typeof this._dmMql.addListener === 'function') {
          this._dmMql.addListener(this._onDisplayModeChange);
        }
      } catch (err) {
        this._addLog('err', `matchMedia('(display-mode: standalone)') 失败：${err.message}`);
      }
    }
    // iOS navigator.standalone（旧 iOS Safari 专有）
    if ('standalone' in navigator) {
      this._addLog('manifest', `navigator.standalone (iOS 专有) = ${navigator.standalone}`);
    }

    // —— Card 2：Window Controls Overlay geometrychange 监听 ——
    if (c.wco && navigator.windowControlsOverlay) {
      const wco = navigator.windowControlsOverlay;
      const syncWco = () => {
        let rect = null;
        try { rect = wco.getTitlebarAreaRect(); } catch { /* noop */ }
        this.setState({ wcoVisible: !!wco.visible, titlebarRect: rect });
      };
      syncWco();
      this._onGeometryChange = () => {
        syncWco();
        this._addLog('wco', `geometrychange 触发：visible=${wco.visible}`);
      };
      try {
        wco.addEventListener('geometrychange', this._onGeometryChange);
      } catch (err) {
        this._addLog('err', `windowControlsOverlay geometrychange 注册失败：${err.message}`);
      }
    }

    // —— Card 3：Document PiP enter / leave 监听 ——
    if (c.docPip && window.documentPictureInPicture) {
      this._onPipEnter = (e) => {
        this._pipWindow = e.window;
        this.setState({ docPipActive: true });
        this._addLog('dppip', `documentPictureInPicture enter 触发：window=${!!e.window}`);
      };
      this._onPipLeave = () => {
        this._pipWindow = null;
        this.setState({ docPipActive: false });
        this._addLog('dppip', 'documentPictureInPicture leave 触发：PiP 窗口已关闭');
      };
      try {
        window.documentPictureInPicture.addEventListener('enter', this._onPipEnter);
        window.documentPictureInPicture.addEventListener('leave', this._onPipLeave);
      } catch (err) {
        this._addLog('err', `documentPictureInPicture 事件注册失败：${err.message}`);
      }
    }

    // —— Card 4：Launch Handler ——
    if (c.launchQueue && window.launchQueue) {
      try {
        window.launchQueue.setConsumer((params) => {
          const summaryObj = this._summarizeLaunchParams(params);
          this.setState({ launchParams: summaryObj });
          this._addLog('launch', `setConsumer 回调触发：targetURL=${summaryObj.targetURL} files=${summaryObj.filesCount}`);
        });
        this._addLog('launch', 'launchQueue.setConsumer 已注册，等待系统通过文件/协议启动 PWA');
      } catch (err) {
        this._addLog('err', `launchQueue.setConsumer 失败：${err.message}`);
      }
    }

    // —— Card 5：Navigation API ——
    if (c.navigation && window.navigation) {
      const nav = window.navigation;
      const syncNav = () => {
        let cur = ''; let count = 0;
        try { cur = nav.currentEntry ? nav.currentEntry.url : ''; } catch { /* noop */ }
        try { count = nav.entries ? nav.entries().length : 0; } catch { /* noop */ }
        this.setState({ navCurrentURL: cur, navEntryCount: count });
      };
      syncNav();
      this._onNavigate = (e) => {
        // 不调用 preventDefault/intercept，仅观察记录
        this._addLog('nav', `navigate 事件：destination.url=${e.destination ? e.destination.url : '?'} navigationType=${e.navigationType}`);
      };
      this._onNavigateSuccess = () => this._addLog('nav', 'navigatesuccess 事件触发');
      this._onNavigateError = (e) => this._addLog('err', `navigateerror 事件：${e.message || ''}`);
      try {
        nav.addEventListener('navigate', this._onNavigate);
        nav.addEventListener('navigatesuccess', this._onNavigateSuccess);
        nav.addEventListener('navigateerror', this._onNavigateError);
      } catch (err) {
        this._addLog('err', `navigation 事件注册失败：${err.message}`);
      }
    }

    // —— Card 5：Page Lifecycle ——
    this._onVisibilityChange = () => {
      const vs = document.visibilityState;
      this.setState({ visibilityState: vs });
      this._addLog('lifecycle', `visibilitychange → visibilityState=${vs}`);
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    this._onFreeze = () => this._addLog('lifecycle', 'freeze 事件触发：页面已被后台冻结');
    this._onResume = () => this._addLog('lifecycle', 'resume 事件触发：页面已从冻结状态恢复');
    document.addEventListener('freeze', this._onFreeze);
    document.addEventListener('resume', this._onResume);

    this._onPageShow = (e) => {
      this._addLog('lifecycle', `pageshow 触发：persisted=${e.persisted}（BFCache 命中=${e.persisted}）`);
    };
    this._onPageHide = (e) => {
      this._addLog('lifecycle', `pagehide 触发：persisted=${e.persisted}`);
    };
    window.addEventListener('pageshow', this._onPageShow);
    window.addEventListener('pagehide', this._onPageHide);

    // 当前 visibilityState 一次性记录
    this._addLog('lifecycle', `初始 visibilityState=${document.visibilityState}`);
  }

  componentWillUnmount() {
    // 1. Card 1：移除 beforeinstallprompt / appinstalled / display-mode 监听
    if (this._onBeforeInstallPrompt) {
      try { window.removeEventListener('beforeinstallprompt', this._onBeforeInstallPrompt); } catch { /* noop */ }
      this._onBeforeInstallPrompt = null;
    }
    if (this._onAppInstalled) {
      try { window.removeEventListener('appinstalled', this._onAppInstalled); } catch { /* noop */ }
      this._onAppInstalled = null;
    }
    if (this._dmMql) {
      try {
        if (typeof this._dmMql.removeEventListener === 'function') {
          this._dmMql.removeEventListener('change', this._onDisplayModeChange);
        } else if (typeof this._dmMql.removeListener === 'function') {
          this._dmMql.removeListener(this._onDisplayModeChange);
        }
      } catch { /* noop */ }
      this._dmMql = null;
    }
    this._deferredPrompt = null;

    // 2. Card 2：解除 windowControlsOverlay geometrychange
    if (this._onGeometryChange && this._caps().wco && navigator.windowControlsOverlay) {
      try { navigator.windowControlsOverlay.removeEventListener('geometrychange', this._onGeometryChange); }
      catch { /* noop */ }
      this._onGeometryChange = null;
    }

    // 3. Card 3：关闭 Document PiP 窗口并移除 enter/leave 监听
    if (this._caps().docPip && window.documentPictureInPicture) {
      if (this._onPipEnter) {
        try { window.documentPictureInPicture.removeEventListener('enter', this._onPipEnter); }
        catch { /* noop */ }
        this._onPipEnter = null;
      }
      if (this._onPipLeave) {
        try { window.documentPictureInPicture.removeEventListener('leave', this._onPipLeave); }
        catch { /* noop */ }
        this._onPipLeave = null;
      }
    }
    if (this._pipWindow) {
      try { this._pipWindow.close(); } catch { /* noop */ }
      this._pipWindow = null;
    }

    // 4. Card 5：移除 navigation 事件
    if (this._caps().navigation && window.navigation) {
      const nav = window.navigation;
      if (this._onNavigate) { try { nav.removeEventListener('navigate', this._onNavigate); } catch { /* noop */ } }
      if (this._onNavigateSuccess) { try { nav.removeEventListener('navigatesuccess', this._onNavigateSuccess); } catch { /* noop */ } }
      if (this._onNavigateError) { try { nav.removeEventListener('navigateerror', this._onNavigateError); } catch { /* noop */ } }
      this._onNavigate = this._onNavigateSuccess = this._onNavigateError = null;
    }

    // 5. Card 5：移除 lifecycle 事件
    if (this._onVisibilityChange) {
      try { document.removeEventListener('visibilitychange', this._onVisibilityChange); } catch { /* noop */ }
      this._onVisibilityChange = null;
    }
    if (this._onFreeze) { try { document.removeEventListener('freeze', this._onFreeze); } catch { /* noop */ } this._onFreeze = null; }
    if (this._onResume) { try { document.removeEventListener('resume', this._onResume); } catch { /* noop */ } this._onResume = null; }
    if (this._onPageShow) { try { window.removeEventListener('pageshow', this._onPageShow); } catch { /* noop */ } this._onPageShow = null; }
    if (this._onPageHide) { try { window.removeEventListener('pagehide', this._onPageHide); } catch { /* noop */ } this._onPageHide = null; }
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const win = typeof window !== 'undefined' ? window : {};
    return {
      beforeInstallPrompt: 'BeforeInstallPromptEvent' in win,
      badging: 'setAppBadge' in nav,
      wco: 'windowControlsOverlay' in nav,
      docPip: 'documentPictureInPicture' in win,
      protocolHandler: 'registerProtocolHandler' in nav,
      launchQueue: 'launchQueue' in win,
      navigation: 'navigation' in win,
    };
  }

  _capTag(ok) {
    return ok ? h(Tag, { color: 'success' }, '支持') : h(Tag, { color: 'error' }, '不支持');
  }

  _statusTag(label, ok) {
    return h(Tag, { color: ok ? 'success' : 'default' }, `${label}:${ok ? '是' : '否'}`);
  }

  _kvRow(label, value, unit = '') {
    const text = value == null ? 'N/A' : `${value}${unit}`;
    return h('div', { class: 'flex items-center gap-sm' },
      h('span', { class: 'fs-sm text-secondary', style: { minWidth: '150px' } }, label),
      h('span', { class: 'fs-sm', style: { wordBreak: 'break-all' } }, text),
    );
  }

  _preCode(obj) {
    let text;
    try { text = JSON.stringify(obj, null, 2); }
    catch { text = String(obj); }
    return h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
      h('code', {}, text),
    );
  }

  _logApiErr(tag, api, err) {
    const name = err && err.name ? err.name : 'Error';
    const msg = err && err.message ? err.message : String(err);
    this._addLog(tag, `${api} 失败：${name} — ${msg}`);
  }

  _summarizeLaunchParams(params) {
    const out = { targetURL: '', filesCount: 0, files: [] };
    try { out.targetURL = params.targetURL || ''; } catch { /* noop */ }
    try {
      const files = params.files;
      if (files && files.length) {
        out.filesCount = files.length;
        out.files = Array.from(files).map((f) => ({
          name: f.name || '',
          kind: f.kind || '',
          type: f.type || '',
        }));
      }
    } catch { /* noop */ }
    return out;
  }

  // ============ Card 1: Web App Manifest 与安装 ============

  async _triggerInstall() {
    if (!this._deferredPrompt) {
      this._addLog('manifest', '尚未捕获 beforeinstallprompt 事件，无法 prompt()（需 HTTPS + 未安装 + 浏览器判定可安装）');
      return;
    }
    try {
      this._addLog('manifest', '调用 _deferredPrompt.prompt()，等待用户选择…');
      this._deferredPrompt.prompt();
      const choice = await this._deferredPrompt.userChoice;
      this.setState({ installOutcome: choice.outcome });
      this._addLog('manifest', `userChoice.outcome='${choice.outcome}' platform='${choice.platform || ''}'`);
      // prompt 只能调用一次，消费后置空
      this._deferredPrompt = null;
      this.setState({ deferredPromptAvailable: false });
    } catch (err) {
      this._logApiErr('manifest', 'prompt()', err);
    }
  }

  _checkDisplayMode() {
    if (typeof window.matchMedia !== 'function') {
      this._addLog('err', '当前环境不支持 matchMedia，无法检测 display-mode');
      return;
    }
    const modes = ['fullscreen', 'standalone', 'minimal-ui', 'browser'];
    const hit = modes.find((m) => window.matchMedia(`(display-mode: ${m})`).matches) || 'unknown';
    this._addLog('manifest', `matchMedia 检测：当前 display-mode=${hit}，isStandalone=${this.state.isStandalone}`);
  }

  _checkManifestLink() {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) {
      this._addLog('manifest', `已发现 <link rel="manifest"> href=${link.href}`);
    } else {
      this._addLog('manifest', '未发现 <link rel="manifest">（当前页面未声明 manifest）');
    }
  }

  // ============ Card 2: App Badging + Window Controls Overlay ============

  async _badgeSet5() {
    if (!this._caps().badging) { this._addLog('err', '当前浏览器不支持 App Badging API'); return; }
    try {
      await navigator.setAppBadge(5);
      this._addLog('badge', 'navigator.setAppBadge(5) 完成');
    } catch (err) { this._logApiErr('badge', 'setAppBadge(5)', err); }
  }

  async _badgeSetDot() {
    if (!this._caps().badging) { this._addLog('err', '当前浏览器不支持 App Badging API'); return; }
    try {
      await navigator.setAppBadge();
      this._addLog('badge', 'navigator.setAppBadge() 完成（无数字 badge，仅显示一个点）');
    } catch (err) { this._logApiErr('badge', 'setAppBadge()', err); }
  }

  async _badgeClear() {
    if (!this._caps().badging) { this._addLog('err', '当前浏览器不支持 App Badging API'); return; }
    try {
      await navigator.clearAppBadge();
      this._addLog('badge', 'navigator.clearAppBadge() 完成');
    } catch (err) { this._logApiErr('badge', 'clearAppBadge()', err); }
  }

  _wcoReadRect() {
    if (!this._caps().wco) { this._addLog('err', '当前浏览器不支持 Window Controls Overlay API'); return; }
    try {
      const rect = navigator.windowControlsOverlay.getTitlebarAreaRect();
      this.setState({ titlebarRect: rect });
      this._addLog('wco', `getTitlebarAreaRect() → x=${rect.x} y=${rect.y} w=${rect.width} h=${rect.height}`);
    } catch (err) { this._logApiErr('wco', 'getTitlebarAreaRect()', err); }
  }

  // ============ Card 3: Document PiP + Protocol Handler ============

  async _docPipOpen() {
    if (!this._caps().docPip) { this._addLog('err', '当前浏览器不支持 Document Picture-in-Picture API'); return; }
    try {
      this._addLog('dppip', '调用 documentPictureInPicture.requestWindow({width:480,height:320})…');
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 480, height: 320,
      });
      this._pipWindow = pipWin;
      // 把页面上的"画中画内容"容器移到 PiP 窗口（克隆避免破坏原 DOM）
      const src = this.$('.js-pip-source');
      if (src) {
        const clone = src.cloneNode(true);
        clone.style.margin = '0';
        // 复制必要样式（简化：仅设字体/背景）
        pipWin.document.body.style.fontFamily = 'system-ui, sans-serif';
        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.padding = '16px';
        pipWin.document.body.style.background = '#0f0f0f';
        pipWin.document.body.style.color = '#fff';
        pipWin.document.body.appendChild(clone);
      }
      // enter 事件已通过监听器处理；同时确保 active 状态（部分实现不触发 enter）
      if (!this.state.docPipActive) this.setState({ docPipActive: true });
      this._addLog('dppip', `requestWindow 完成：PiP window=${!!pipWin}，已 append 内容`);
      // PiP 窗口关闭兜底（部分实现不触发 leave）
      pipWin.addEventListener('pagehide', () => {
        this._pipWindow = null;
        this.setState({ docPipActive: false });
        this._addLog('dppip', 'PiP 窗口 pagehide：已关闭');
      });
    } catch (err) { this._logApiErr('dppip', 'requestWindow', err); }
  }

  _docPipClose() {
    if (!this._pipWindow) { this._addLog('err', '当前没有打开的 Document PiP 窗口'); return; }
    try {
      this._pipWindow.close();
      this._addLog('dppip', 'PiP window.close() 已调用');
    } catch (err) { this._logApiErr('dppip', 'close()', err); }
  }

  _protoRegister() {
    if (!this._caps().protocolHandler) { this._addLog('err', '当前浏览器不支持 Protocol Handler API'); return; }
    try {
      // url 必须同源且包含 %s 占位符；scheme 自定义需以 web+ 前缀
      const url = new URL('/handle?uri=%s', window.location.origin).href;
      navigator.registerProtocolHandler('web+study', url, 'API 实验室学习协议');
      this._addLog('proto', `registerProtocolHandler('web+study', '${url}', 'API 实验室学习协议') 完成`);
      this._addLog('proto', '提示：注册后访问 web+study://anything 将打开本页面（仅 PWA 安装后生效）');
    } catch (err) { this._logApiErr('proto', 'registerProtocolHandler', err); }
  }

  _protoUnregister() {
    if (!this._caps().protocolHandler) { this._addLog('err', '当前浏览器不支持 Protocol Handler API'); return; }
    try {
      const url = new URL('/handle?uri=%s', window.location.origin).href;
      navigator.unregisterProtocolHandler('web+study', url);
      this._addLog('proto', `unregisterProtocolHandler('web+study', '${url}') 完成`);
    } catch (err) { this._logApiErr('proto', 'unregisterProtocolHandler', err); }
  }

  _protoRegisterMailto() {
    if (!this._caps().protocolHandler) { this._addLog('err', '当前浏览器不支持 Protocol Handler API'); return; }
    try {
      const url = new URL('/handle-mail?to=%s', window.location.origin).href;
      navigator.registerProtocolHandler('mailto', url, 'API 实验室邮件处理');
      this._addLog('proto', `registerProtocolHandler('mailto', '${url}', …) 完成（注册 mailto 会让 PWA 出现在邮件应用列表）`);
    } catch (err) { this._logApiErr('proto', 'registerProtocolHandler(mailto)', err); }
  }

  // ============ Card 4: Launch Handler + File Handling ============

  _launchCheckCap() {
    const ok = this._caps().launchQueue;
    this._addLog('launch', `'launchQueue' in window = ${ok}（通常仅 PWA 安装后由系统触发，普通浏览不可达）`);
  }

  _launchReadParams() {
    const p = this.state.launchParams;
    if (!p) {
      this._addLog('launch', '尚未收到 LaunchParams（setConsumer 回调未触发，需 PWA 通过文件/协议被启动）');
      return;
    }
    this._addLog('launch', `LaunchParams 当前快照：targetURL=${p.targetURL || '(空)'} files=${p.filesCount}`);
  }

  // ============ Card 5: Navigation API + Page Lifecycle ============

  _navBack() {
    if (!this._caps().navigation) { this._addLog('err', '当前浏览器不支持 Navigation API'); return; }
    try {
      const ok = window.navigation.back();
      this._addLog('nav', `navigation.back() → ${ok ? '已发起' : 'false（无可后退条目）'}`);
    } catch (err) { this._logApiErr('nav', 'back()', err); }
  }

  _navForward() {
    if (!this._caps().navigation) { this._addLog('err', '当前浏览器不支持 Navigation API'); return; }
    try {
      const ok = window.navigation.forward();
      this._addLog('nav', `navigation.forward() → ${ok ? '已发起' : 'false（无可前进条目）'}`);
    } catch (err) { this._logApiErr('nav', 'forward()', err); }
  }

  _navReload() {
    if (!this._caps().navigation) { this._addLog('err', '当前浏览器不支持 Navigation API'); return; }
    try {
      window.navigation.reload();
      this._addLog('nav', 'navigation.reload() 已调用');
    } catch (err) { this._logApiErr('nav', 'reload()', err); }
  }

  _navNavigate() {
    if (!this._caps().navigation) { this._addLog('err', '当前浏览器不支持 Navigation API'); return; }
    // 演示：navigate 到一个 hash 锚点（不真正离开页面）
    try {
      const url = window.location.pathname + '#nav-demo-' + Date.now().toString(36);
      window.navigation.navigate(url);
      this._addLog('nav', `navigation.navigate('${url}') 已调用`);
    } catch (err) { this._logApiErr('nav', 'navigate()', err); }
  }

  _navListEntries() {
    if (!this._caps().navigation) { this._addLog('err', '当前浏览器不支持 Navigation API'); return; }
    try {
      const entries = window.navigation.entries();
      const cur = window.navigation.currentEntry;
      this._addLog('nav', `entries().length=${entries.length} currentEntry.url=${cur ? cur.url : '(空)'} key=${cur ? cur.key : '-'}`);
    } catch (err) { this._logApiErr('nav', 'entries()', err); }
  }

  _lifecycleTabAway() {
    // 提示用户切换标签页（无法程序化触发 hidden，仅指导）
    this._addLog('lifecycle', '提示：切换浏览器标签页或最小化窗口将触发 visibilitychange（hidden）；长时间后台后浏览器会派发 freeze');
  }

  renderPage() {
    const c = this._caps();
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'PWA 与现代 Web 平台 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'Web App Manifest / BeforeInstallPrompt / App Badging / Window Controls Overlay / Document PiP / Protocol Handler / Launch Handler / File Handling / Navigation API / Page Lifecycle',
        description: '本页演示渐进式 Web App 与现代 Web 平台特性。大量 API 仅在 Chromium 内核、HTTPS 上下文、且应用已安装为 PWA 时可用。所有按钮均会真实调用对应原生 API；调用前先做能力检测，不可用时仅记日志，不会抛异常中断页面。',
      }),

      h('div', { class: 'feature-grid mt-lg' },

        // ============ Card 1: Web App Manifest 与安装 ============
        h(Card, {
          title: '1. Web App Manifest 与安装',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'BeforeInstallPromptEvent'), this._capTag(c.beforeInstallPrompt),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              '通过 ', h('code', {}, '<link rel="manifest">'), ' 关联 manifest JSON；字段含 name / short_name / start_url / scope / display (fullscreen | standalone | minimal-ui | browser) / orientation / theme_color / background_color / icons / shortcuts / share_target / file_handlers / protocol_handlers。'),
            h('p', { class: 'fs-sm text-tertiary' },
              'BeforeInstallPromptEvent：监听 ', h('code', {}, 'window.onbeforeinstallprompt'), ' 缓存事件，', h('code', {}, 'event.prompt()'), ' 触发安装提示，', h('code', {}, 'event.userChoice'), ' 是 Promise<{outcome, platform}>；', h('code', {}, 'appinstalled'), ' 事件在安装完成后触发；可用 ', h('code', {}, 'matchMedia(\'(display-mode: standalone)\')'), ' 或 iOS ', h('code', {}, 'navigator.standalone'), ' 检测运行模式。'),
            h('div', { class: 'flex items-center gap-sm flex-wrap' },
              this._statusTag('已捕获 beforeinstallprompt', s.deferredPromptAvailable),
              this._statusTag('isStandalone', s.isStandalone),
              this._statusTag('appInstalled', s.appInstalled),
              h(Tag, { color: 'primary' }, `display-mode:${s.displayMode}`),
              s.installOutcome && h(Tag, { color: s.installOutcome === 'accepted' ? 'success' : 'warning' }, `outcome:${s.installOutcome}`),
            ),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('安装应用 (prompt)', { type: 'primary', size: 'sm', onClick: () => this._triggerInstall(), disabled: !c.beforeInstallPrompt || !s.deferredPromptAvailable }),
              this._btn('检测 display-mode', { size: 'sm', onClick: () => this._checkDisplayMode() }),
              this._btn('查找 <link rel="manifest">', { size: 'sm', onClick: () => this._checkManifestLink() }),
            ),
            h('div', { class: 'fs-sm text-secondary mt-xs' }, '完整 manifest 示例（含 share_target / file_handlers / protocol_handlers）：'),
            this._preCode(MANIFEST_EXAMPLE),
            h('p', { class: 'fs-xs text-tertiary' },
              '注：beforeinstallprompt 可能仅在页面加载后由浏览器择机触发；本页已在 componentDidMount 中尽早注册监听，事件触发后会自动启用"安装应用"按钮。'),
          ),
        ),

        // ============ Card 2: App Badging + Window Controls Overlay ============
        h(Card, {
          title: '2. App Badging 与 Window Controls Overlay',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'setAppBadge'), this._capTag(c.badging),
            h(Tag, { color: 'primary' }, 'windowControlsOverlay'), this._capTag(c.wco),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'App Badging API（被动 API，无事件）：', h('code', {}, 'navigator.setAppBadge(count)'), ' 设置数字 badge；', h('code', {}, 'navigator.setAppBadge()'), ' 设置无数字 badge（仅一个点）；', h('code', {}, 'navigator.clearAppBadge()'), ' 清除。需要已安装 PWA。'),
            h('p', { class: 'fs-sm text-tertiary' },
              'Window Controls Overlay：', h('code', {}, 'navigator.windowControlsOverlay.visible'), ' 反映系统控件是否占用标题栏；', h('code', {}, 'getTitlebarAreaRect()'), ' 返回 {x,y,width,height,top,left,right,bottom}；监听 ', h('code', {}, 'geometrychange'), '；CSS 用 ', h('code', {}, 'env(titlebar-area-x/y/width/height)'), '，需在 manifest ', h('code', {}, 'display_override'), ' 中声明 ', h('code', {}, '\'window-controls-overlay\''), '。'),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('设置 Badge (5)', { type: 'primary', size: 'sm', onClick: () => this._badgeSet5(), disabled: !c.badging }),
              this._btn('设置无数字 Badge', { size: 'sm', onClick: () => this._badgeSetDot(), disabled: !c.badging }),
              this._btn('清除 Badge', { size: 'sm', danger: true, onClick: () => this._badgeClear(), disabled: !c.badging }),
              this._btn('读取 titlebar rect', { size: 'sm', onClick: () => this._wcoReadRect(), disabled: !c.wco }),
            ),
            h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
              this._kvRow('windowControlsOverlay.visible', s.wcoVisible),
              this._kvRow('titlebar.x', s.titlebarRect ? s.titlebarRect.x : 'N/A'),
              this._kvRow('titlebar.y', s.titlebarRect ? s.titlebarRect.y : 'N/A'),
              this._kvRow('titlebar.width', s.titlebarRect ? s.titlebarRect.width : 'N/A'),
              this._kvRow('titlebar.height', s.titlebarRect ? s.titlebarRect.height : 'N/A'),
            ),
            (!c.badging || !c.wco) && h(Alert, {
              type: 'warning',
              message: '部分 API 不支持',
              description: `setAppBadge=${c.badging} / windowControlsOverlay=${c.wco}，需 Chromium + HTTPS + 已安装 PWA + display_override 声明。`,
            }),
          ),
        ),

        // ============ Card 3: Document PiP + Protocol Handler ============
        h(Card, {
          title: '3. Document Picture-in-Picture 与 Protocol Handler',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'documentPictureInPicture'), this._capTag(c.docPip),
            h(Tag, { color: 'primary' }, 'registerProtocolHandler'), this._capTag(c.protocolHandler),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'Document Picture-in-Picture：', h('code', {}, 'window.documentPictureInPicture.requestWindow({width,height})'), ' 返回独立 Window 对象，可向其 ', h('code', {}, 'document.body'), ' appendChild 任意 DOM；', h('code', {}, 'documentPictureInPicture.window'), ' 是当前 PiP 窗口；监听 ', h('code', {}, 'enter'), ' / ', h('code', {}, 'leave'), ' 事件。与视频 PiP 不同，可承载任意 HTML。'),
            h('p', { class: 'fs-sm text-tertiary' },
              'Protocol Handler：', h('code', {}, 'navigator.registerProtocolHandler(scheme, url, title)'), '；自定义 scheme 需 ', h('code', {}, 'web+'), ' 前缀（如 ', h('code', {}, 'web+study'), '），也可注册 ', h('code', {}, 'mailto'), ' 让 PWA 出现在邮件应用列表；url 必须同源且含 ', h('code', {}, '%s'), ' 占位符；', h('code', {}, 'unregisterProtocolHandler(scheme, url)'), ' 注销。'),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('打开 Document PiP', { type: 'primary', size: 'sm', onClick: () => this._docPipOpen(), disabled: !c.docPip || s.docPipActive }),
              this._btn('关闭 PiP', { size: 'sm', danger: true, onClick: () => this._docPipClose(), disabled: !s.docPipActive }),
              this._btn('注册 web+study', { type: 'primary', size: 'sm', onClick: () => this._protoRegister(), disabled: !c.protocolHandler }),
              this._btn('注销 web+study', { size: 'sm', onClick: () => this._protoUnregister(), disabled: !c.protocolHandler }),
              this._btn('注册 mailto', { size: 'sm', onClick: () => this._protoRegisterMailto(), disabled: !c.protocolHandler }),
            ),
            h('div', { class: 'flex items-center gap-sm' },
              h('span', { class: 'fs-sm text-secondary' }, 'Document PiP 状态：'),
              h(Tag, { color: s.docPipActive ? 'success' : 'default' }, s.docPipActive ? '已打开' : '未打开'),
            ),
            // 会被克隆到 PiP 窗口的源 DOM
            h('div', { class: 'js-pip-source', style: { padding: '12px', borderRadius: '8px', background: 'linear-gradient(135deg,#1677ff,#722ed1)', color: '#fff', textAlign: 'center' } },
              h('div', { style: { fontSize: '18px', fontWeight: 600 } }, '画中画内容'),
              h('div', { style: { fontSize: '12px', opacity: 0.85, marginTop: '6px' } }, '此 div 会被克隆 appendChild 到 PiP 窗口的 document.body'),
            ),
            (!c.docPip || !c.protocolHandler) && h(Alert, {
              type: 'warning',
              message: '部分 API 不支持',
              description: `documentPictureInPicture=${c.docPip} / registerProtocolHandler=${c.protocolHandler}，需 Chromium + HTTPS（Protocol Handler 通常需已安装 PWA）。`,
            }),
          ),
        ),

        // ============ Card 4: Launch Handler + File Handling ============
        h(Card, {
          title: '4. Launch Handler 与 File Handling API',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'launchQueue'), this._capTag(c.launchQueue),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'Launch Handler API：', h('code', {}, 'window.launchQueue.setConsumer((params) => …)'), ' 注册启动消费者；', h('code', {}, 'LaunchParams'), ' 含 ', h('code', {}, 'targetURL'), ' 与 ', h('code', {}, 'files'), '（FileSystemFileHandle 数组）；替代方案 ', h('code', {}, 'navigation.addEventListener(\'launch\')'), '。'),
            h('p', { class: 'fs-sm text-tertiary' },
              'File Handling API：在 manifest ', h('code', {}, 'file_handlers'), ' 数组中声明 ', h('code', {}, '{ action, accept: { mime: [extensions] } }'), '；安装 PWA 后，系统会将匹配文件以 LaunchParams.files 传入 setConsumer 回调，通过 ', h('code', {}, 'files[i].getFile()'), ' 读取内容。'),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('能力检测', { size: 'sm', onClick: () => this._launchCheckCap() }),
              this._btn('读取 LaunchParams 快照', { type: 'primary', size: 'sm', onClick: () => this._launchReadParams(), disabled: !c.launchQueue },
              ),
            ),
            s.launchParams && h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
              this._kvRow('targetURL', s.launchParams.targetURL || '(空)'),
              this._kvRow('files.length', s.launchParams.filesCount),
              ...(s.launchParams.files || []).map((f, i) => this._kvRow(`file[${i}].name`, `${f.name} (${f.kind}/${f.type})`)),
            ),
            h('div', { class: 'fs-sm text-secondary mt-xs' }, 'manifest file_handlers 示例：'),
            this._preCode(FILE_HANDLERS_EXAMPLE),
            h(Alert, {
              type: 'info',
              message: 'Launch Handler 通常需要 PWA 已安装',
              description: '普通浏览器直接访问不会触发 setConsumer 回调；需在 OS 中将本 PWA 设为某类文件的默认打开方式后，由系统启动才会派发 LaunchParams。',
            }),
          ),
        ),

        // ============ Card 5: Navigation API + Page Lifecycle ============
        h(Card, {
          title: '5. Navigation API 与 Page Lifecycle',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'navigation'), this._capTag(c.navigation),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'Navigation API：', h('code', {}, 'navigation.entries()'), ' 返回历史记录列表，', h('code', {}, 'navigation.currentEntry'), ' 是当前条目（含 url/key/id/getState()）；监听 ', h('code', {}, 'navigate'), ' 事件并调用 ', h('code', {}, 'e.intercept({ handler })'), ' 拦截；', h('code', {}, 'navigation.navigate(url)'), ' / ', h('code', {}, 'back()'), ' / ', h('code', {}, 'forward()'), ' / ', h('code', {}, 'reload()'), ' 编程导航；另有 ', h('code', {}, 'navigatesuccess'), ' / ', h('code', {}, 'navigateerror'), ' 事件。'),
            h('p', { class: 'fs-sm text-tertiary' },
              'Page Lifecycle：状态机 active → passive → hidden → frozen → terminated；', h('code', {}, 'document.visibilityState'), ' (visible | hidden) + ', h('code', {}, 'visibilitychange'), ' 事件；', h('code', {}, 'freeze'), ' / ', h('code', {}, 'resume'), ' 事件对应后台冻结/恢复；', h('code', {}, 'pagehide'), ' / ', h('code', {}, 'pageshow'), ' 的 ', h('code', {}, 'persisted'), ' 反映 BFCache 命中。'),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('navigation.back()', { size: 'sm', onClick: () => this._navBack(), disabled: !c.navigation }),
              this._btn('navigation.forward()', { size: 'sm', onClick: () => this._navForward(), disabled: !c.navigation }),
              this._btn('navigation.reload()', { size: 'sm', onClick: () => this._navReload(), disabled: !c.navigation }),
              this._btn('navigation.navigate(#hash)', { type: 'primary', size: 'sm', onClick: () => this._navNavigate(), disabled: !c.navigation }),
              this._btn('列出 entries()', { size: 'sm', onClick: () => this._navListEntries(), disabled: !c.navigation }),
              this._btn('提示：切换标签页测试 lifecycle', { size: 'sm', onClick: () => this._lifecycleTabAway() }),
            ),
            h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
              this._kvRow('visibilityState', s.visibilityState),
              this._kvRow('navigation.entries().length', s.navEntryCount),
              this._kvRow('navigation.currentEntry.url', s.navCurrentURL || '(N/A)'),
              this._kvRow('matchMedia display-mode', `${s.displayMode} (standalone=${s.isStandalone})`),
            ),
            !c.navigation && h(Alert, {
              type: 'warning',
              message: 'Navigation API 不可用',
              description: '当前浏览器不支持 Navigation API（仅 Chromium 系较新版本支持）。Page Lifecycle 事件仍可监听。',
            }),
          ),
        ),
      ),

      // —— 事件日志 ——
      h(Card, { title: '事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') },
        h('div', { class: 'log-panel' },
          s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志，点击上方按钮触发 API 调用）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' },
                h('span', { class: 'log-panel__time' }, log.time),
                h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
                h('span', { class: 'log-panel__content' }, log.content),
              )),
        ),
      ),
    ];
  }
}
