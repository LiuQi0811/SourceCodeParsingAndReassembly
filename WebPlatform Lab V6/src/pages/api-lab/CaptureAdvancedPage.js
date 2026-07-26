// =====================================================================
// CaptureAdvancedPage.js —— 高级屏幕捕获与剪贴板 实验室
// 演示 2023-2025 屏幕共享与剪贴板进阶 API：
//   1. getDisplayMedia 基础 —— navigator.mediaDevices.getDisplayMedia({video,
//      audio, displaySurface, monitorTypeSurfaces, surfaceSwitching, systemAudio})
//      返回 MediaStream；displaySurface: monitor|window|browser|application；
//      track.getSettings() 读 displaySurface/cursor；track.onended；能力检测
//      typeof navigator!=='undefined' && navigator.mediaDevices &&
//      typeof getDisplayMedia。jsdom 不可用时记日志说明。
//   2. CaptureController 与 surfaceSwitching —— new CaptureController() 传入
//      getDisplayMedia({controller}); controller.setFocus(focusable)、
//      controller.setDisplaySurface(surface) 运行时切换共享源（Chrome 116+
//      surfaceSwitching）。能力检测 typeof CaptureController!=='undefined'。
//   3. Element Capture（元素级捕获）—— RestrictionTarget.fromElement(element)
//      把 DOM 元素转为 RestrictionTarget；controller.cropTo(restrictionTarget)
//      把整页捕获裁剪到该元素；sendFocus/event focus；vs Region Capture
//      整页裁剪。能力检测 typeof RestrictionTarget!=='undefined' &&
//      typeof RestrictionTarget.fromElement==='function'（Chrome 121+）。
//   4. Region Capture 概念对比 —— getDisplayMedia 原始全标签页捕获 vs
//      Region Capture (cropTo 裁剪到 CSS 区域) vs Element Capture (只共享某
//      元素)；安全模型：不暴露无关 UI/隐私；Browser/Tab/Screen 三种
//      displaySurface；文本对比表。
//   5. ClipboardItem 懒加载（Promise 数据）—— new ClipboardItem({
//      'text/plain': Promise.resolve(blob), 'image/png': asyncBlobPromise })；
//      ClipboardItem.supports(type) 静态方法检测格式；自定义 MIME（web 前缀）；
//      一次写多种格式让目标应用自选；navigator.clipboard.write([item])。能力检测
//      typeof ClipboardItem!=='undefined' && typeof ClipboardItem.supports==='function'。
//   6. 能力检测矩阵与决策 —— 文本表格对比 Element/Region Capture/ClipboardItem/
//      CaptureController/getDisplayMedia 的 Chrome 版本与场景；场景推荐：
//      远程桌面=Element Capture、演示共享=Region Capture、富文本复制=
//      ClipboardItem 多格式。
// 说明：所有特性调用前做 typeof/in 能力检测，不可用时仅记日志，绝不抛异常。
//       jsdom/Node 环境下大部分 API 不存在，需兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CaptureAdvancedPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      gdmState: '',
      controllerState: '',
      elementCaptureState: '',
      clipboardState: '',
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._injectedStyles = [];

    const caps = this._caps();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `getDisplayMedia ${c(caps.getDisplayMedia)}`,
      `CaptureController ${c(caps.captureController)}`,
      `RestrictionTarget ${c(caps.restrictionTarget)}`,
      `cropTo ${c(caps.cropTo)}`,
      `ClipboardItem ${c(caps.clipboardItem)}`,
      `ClipboardItem.supports ${c(caps.clipboardItemSupports)}`,
      `clipboard.write ${c(caps.clipboardWrite)}`,
    ];

    const summary = `高级屏幕捕获与剪贴板能力检测：${parts.join(' · ')}。`
      + 'jsdom/Node 环境下大部分 API 不存在，需真实浏览器；点击按钮可触发能力检测与日志兜底。';

    this.setState({
      capsSummary: summary,
      logs: [...this.state.logs, { type: 'info', content: `能力检测：${parts.join('，')}`, time: formatTime() }].slice(-40),
    });

    if (!caps.getDisplayMedia) this._addLog('warn', 'navigator.mediaDevices.getDisplayMedia 不可用（jsdom 无 MediaDevices），演示仅记日志');
    if (!caps.captureController) this._addLog('warn', 'CaptureController 不可用（Chrome 116+），surfaceSwitching 仅说明');
    if (!caps.restrictionTarget) this._addLog('warn', 'RestrictionTarget.fromElement 不可用（Chrome 121+），Element Capture 仅说明');
    if (!caps.clipboardItem) this._addLog('warn', 'ClipboardItem 不可用（全主流 2022+），演示仅记日志');
    if (!caps.clipboardWrite) this._addLog('warn', 'navigator.clipboard.write 不可用（需安全上下文+权限），演示仅记日志');

    this._injectDemoStyles();
  }

  componentWillUnmount() {
    if (Array.isArray(this._injectedStyles)) {
      this._injectedStyles.forEach((el) => el?.remove());
      this._injectedStyles = [];
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

  _injectStyle(id, textContent) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._injectedStyles.push(style);
    return style;
  }

  _caps() {
    let getDisplayMedia = false;
    try {
      getDisplayMedia = typeof navigator !== 'undefined' && navigator.mediaDevices
        && typeof navigator.mediaDevices.getDisplayMedia === 'function';
    } catch { getDisplayMedia = false; }
    let captureController = false;
    try { captureController = typeof CaptureController !== 'undefined'; } catch { captureController = false; }
    let restrictionTarget = false;
    try {
      restrictionTarget = typeof RestrictionTarget !== 'undefined'
        && typeof RestrictionTarget.fromElement === 'function';
    } catch { restrictionTarget = false; }
    let cropTo = false;
    try {
      cropTo = typeof CaptureController !== 'undefined'
        && typeof CaptureController.prototype !== 'undefined'
        && typeof CaptureController.prototype.cropTo === 'function';
    } catch { cropTo = false; }
    let clipboardItem = false;
    try { clipboardItem = typeof ClipboardItem !== 'undefined'; } catch { clipboardItem = false; }
    let clipboardItemSupports = false;
    try {
      clipboardItemSupports = typeof ClipboardItem !== 'undefined'
        && typeof ClipboardItem.supports === 'function';
    } catch { clipboardItemSupports = false; }
    let clipboardWrite = false;
    try {
      clipboardWrite = typeof navigator !== 'undefined' && navigator.clipboard
        && typeof navigator.clipboard.write === 'function';
    } catch { clipboardWrite = false; }
    return {
      getDisplayMedia, captureController, restrictionTarget, cropTo,
      clipboardItem, clipboardItemSupports, clipboardWrite,
    };
  }

  _injectDemoStyles() {
    this._injectStyle('capture-advanced-demo', `
      .ca-demo-box { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; background: #fff; }
      .ca-target { border: 2px solid #4a90d9; border-radius: 6px; padding: 14px; margin-top: 8px; background: #eff6ff; color: #1e3a8a; min-height: 60px; }
      .ca-target.ca-restricted { border-color: #0f766e; background: #ecfdf5; color: #064e3b; }
      .ca-matrix { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
      .ca-matrix th, .ca-matrix td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
      .ca-matrix th { background: #f1f5f9; color: #334155; font-weight: 600; }
      .ca-matrix tr:nth-child(even) td { background: #fafbfc; }
      .ca-compare { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      .ca-compare-row { display: grid; grid-template-columns: 140px 1fr; gap: 10px; align-items: flex-start; }
      .ca-compare-label { font-weight: 600; color: #1e40af; }
    `);
  }

  // ============ Card 1：getDisplayMedia 基础 ============

  _requestDisplayMedia() {
    const caps = this._caps();
    if (!caps.getDisplayMedia) {
      this._addLog('warn', 'getDisplayMedia 不可用（jsdom 无 MediaDevices），仅说明用法：navigator.mediaDevices.getDisplayMedia({video:{displaySurface:"browser"},audio:false})');
      this.setState({ gdmState: '不可用：jsdom 无 MediaDevices 实现，需真实浏览器' });
      return;
    }
    const opts = {
      video: { displaySurface: 'browser' },
      audio: false,
      surfaceSwitching: 'include',
      systemAudio: 'exclude',
      monitorTypeSurfaces: 'include',
    };
    try {
      const p = navigator.mediaDevices.getDisplayMedia(opts);
      this._addLog('info', '已调用 getDisplayMedia(opts)，等待用户选择共享源（Promise pending）');
      this.setState({ gdmState: 'getDisplayMedia 已调用，等待用户授权（见浏览器弹窗）' });
      Promise.resolve(p).then((stream) => {
        try {
          const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
          const settings = track && typeof track.getSettings === 'function' ? track.getSettings() : {};
          this._addLog('info', `获取 MediaStream 成功：displaySurface=${settings.displaySurface || '?'}, cursor=${settings.cursor || '?'}`);
          if (track) {
            track.onended = () => this._addLog('info', 'track onended 触发：用户停止共享');
          }
          this.setState({ gdmState: `已获取流：displaySurface=${settings.displaySurface || '?'}` });
        } catch (e) {
          this._addLog('warn', '读取 track 设置失败：' + (e && e.message));
        } finally {
          try { stream && stream.getTracks && stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
        }
      }).catch((err) => {
        this._addLog('warn', 'getDisplayMedia 被拒绝或失败：' + (err && err.message));
        this.setState({ gdmState: '获取失败：' + (err && err.name || err && err.message) });
      });
    } catch (err) {
      this._addLog('warn', '调用失败：' + (err && err.message));
      this.setState({ gdmState: '调用失败：' + (err && err.message) });
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 1 · getDisplayMedia 基础',
      extra: h(Tag, { color: caps.getDisplayMedia ? 'success' : 'error' }, caps.getDisplayMedia ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'navigator.mediaDevices.getDisplayMedia({video, audio, displaySurface, monitorTypeSurfaces, surfaceSwitching, systemAudio}) 返回 MediaStream；' +
        'displaySurface: monitor|window|browser|application；track.getSettings() 读 displaySurface/cursor；track.onended 监听停止。'),
      h('div', { class: 'ca-demo-box' },
        h('p', { class: 'fs-sm' }, '点击下方按钮请求屏幕共享。jsdom 无 MediaDevices，仅记日志说明调用方式。'),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('请求屏幕共享', { type: 'primary', size: 'sm', onClick: () => this._requestDisplayMedia() }),
        h(Tag, { color: 'default' }, 'displaySurface: monitor|window|browser|application'),
      ),
      s.gdmState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.gdmState) : null,
      h('pre', { class: 'code-block mt-md' },
`const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { displaySurface: 'browser' },   // monitor|window|browser|application
  audio: false,
  surfaceSwitching: 'include',             // Chrome 116+ 运行时切换
  systemAudio: 'exclude',                  // include|exclude
  monitorTypeSurfaces: 'include',
});
const [track] = stream.getVideoTracks();
const { displaySurface, cursor } = track.getSettings();
track.onended = () => { /* 用户停止共享 */ };`),
    );
  }

  // ============ Card 2：CaptureController 与 surfaceSwitching ============

  _demoCaptureController() {
    const caps = this._caps();
    if (!caps.captureController) {
      this._addLog('warn', 'CaptureController 不可用（Chrome 116+），仅说明：new CaptureController() 传入 getDisplayMedia({controller}) 后可 setFocus/setDisplaySurface 运行时切换源');
      this.setState({ controllerState: '不可用：CaptureController 未定义（Chrome 116+）' });
      return;
    }
    try {
      const controller = new CaptureController();
      this._addLog('info', 'new CaptureController() 构造成功');
      const focusSupported = typeof controller.setFocus === 'function';
      const surfaceSupported = typeof controller.setDisplaySurface === 'function';
      if (focusSupported) {
        try { controller.setFocus(true); this._addLog('info', 'controller.setFocus(true) 已调用（聚焦共享源窗口）'); } catch (e) { this._addLog('warn', 'setFocus 调用失败：' + (e && e.message)); }
      }
      if (surfaceSupported) {
        try { controller.setDisplaySurface('monitor'); this._addLog('info', 'controller.setDisplaySurface("monitor") 已调用（运行时切换共享源 surfaceSwitching）'); } catch (e) { this._addLog('warn', 'setDisplaySurface 调用失败：' + (e && e.message)); }
      }
      this.setState({
        controllerState: `CaptureController 已构造：setFocus=${focusSupported ? '✓' : '✗'}, setDisplaySurface=${surfaceSupported ? '✓' : '✗'}（实际 getDisplayMedia 需用户授权）`,
      });
    } catch (err) {
      this._addLog('warn', 'CaptureController 构造失败：' + (err && err.message));
      this.setState({ controllerState: '构造失败：' + (err && err.message) });
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 2 · CaptureController 与 surfaceSwitching',
      extra: h(Tag, { color: caps.captureController ? 'success' : 'error' }, caps.captureController ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'new CaptureController() 传入 getDisplayMedia({controller}) 后可调用 controller.setFocus(focusable) 聚焦共享源、' +
        'controller.setDisplaySurface(surface) 运行时切换共享源（Chrome 116+ surfaceSwitching），无需重新申请授权。'),
      h('div', { class: 'ca-demo-box' },
        h('p', { class: 'fs-sm' }, '点击按钮演示构造 CaptureController 并调用 setFocus / setDisplaySurface（jsdom 记日志）。'),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('构造 CaptureController', { type: 'primary', size: 'sm', onClick: () => this._demoCaptureController() }),
        h(Tag, { color: caps.cropTo ? 'success' : 'error' }, caps.cropTo ? 'cropTo ✓' : 'cropTo ✗'),
      ),
      s.controllerState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.controllerState) : null,
      h('pre', { class: 'code-block mt-md' },
`const controller = new CaptureController();
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true, controller,             // 注入 controller
  surfaceSwitching: 'include',         // 启用运行时切换
});
controller.setFocus(true);             // 聚焦共享源窗口
controller.setDisplaySurface('window');// 运行时切换到窗口源（不重新授权）
controller.cropTo(restrictionTarget); // Element/Region Capture 裁剪`),
    );
  }

  // ============ Card 3：Element Capture（元素级捕获） ============

  _convertToRestrictionTarget() {
    const caps = this._caps();
    if (!caps.restrictionTarget) {
      this._addLog('warn', 'RestrictionTarget.fromElement 不可用（Chrome 121+），仅说明：把 DOM 元素转为 RestrictionTarget 后 controller.cropTo(rt) 即可只共享该元素');
      this.setState({ elementCaptureState: '不可用：RestrictionTarget.fromElement 未定义（Chrome 121+）' });
      return;
    }
    const el = this.$('#ca-target');
    if (!el) { this._addLog('warn', '未找到演示目标元素'); return; }
    try {
      const rt = RestrictionTarget.fromElement(el);
      this._addLog('info', 'RestrictionTarget.fromElement(el) 成功：得到 RestrictionTarget 对象');
      el.classList.add('ca-restricted');
      this.setState({ elementCaptureState: '已转为 RestrictionTarget：可传给 controller.cropTo(rt) 实现元素级捕获' });
    } catch (err) {
      this._addLog('warn', 'fromElement 失败：' + (err && err.message));
      this.setState({ elementCaptureState: '失败：' + (err && err.message) });
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 3 · Element Capture（元素级捕获）',
      extra: h(Tag, { color: caps.restrictionTarget ? 'success' : 'error' }, caps.restrictionTarget ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'RestrictionTarget.fromElement(element) 把 DOM 元素转为 RestrictionTarget；controller.cropTo(restrictionTarget) 把整页捕获裁剪到该元素；' +
        '配合 sendFocus/event focus；vs Region Capture 整页裁剪。Chrome 121+。'),
      h('div', { class: 'ca-demo-box' },
        h('p', { class: 'fs-sm' }, '下方蓝色框为演示捕获目标，点击按钮可转为 RestrictionTarget：'),
        h('div', { id: 'ca-target', class: 'ca-target' },
          h('p', { class: 'fs-sm' }, '我是被捕获目标元素（demo div）。'),
          h('p', { class: 'fs-sm' }, 'Element Capture 后，仅此区域被共享，其他 UI 不可见。'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('转为 RestrictionTarget', { type: 'primary', size: 'sm', onClick: () => this._convertToRestrictionTarget() }),
        h(Tag, { color: caps.cropTo ? 'success' : 'error' }, caps.cropTo ? 'cropTo ✓' : 'cropTo ✗'),
      ),
      s.elementCaptureState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.elementCaptureState) : null,
      h('pre', { class: 'code-block mt-md' },
`const targetEl = document.querySelector('#capture-me');
const rt = await RestrictionTarget.fromElement(targetEl); // Chrome 121+
const controller = new CaptureController();
await navigator.mediaDevices.getDisplayMedia({ video: true, controller });
controller.cropTo(rt);   // 整页捕获裁剪到该元素 → Element Capture
// vs Region Capture: cropTo 用 CSS 区域裁剪整页
// 安全：不暴露无关 UI/隐私，仅共享该元素`),
    );
  }

  // ============ Card 4：Region Capture 概念对比 ============

  _renderCard4() {
    return h(Card, {
      title: 'Card 4 · Region Capture 概念对比',
      extra: h(Tag, { color: this._caps().cropTo ? 'success' : 'error' }, this._caps().cropTo ? 'cropTo ✓' : 'cropTo ✗'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '对比三种捕获模式：getDisplayMedia 原始全标签页捕获 vs Region Capture（cropTo 裁剪到 CSS 区域）vs Element Capture（只共享某元素）。' +
        '安全模型：裁剪后不暴露无关 UI/隐私。displaySurface: browser（标签页）/ window / screen。'),
      h('div', { class: 'ca-compare' },
        h('div', { class: 'ca-compare-row' },
          h('div', { class: 'ca-compare-label' }, '全标签页捕获'),
          h('div', { class: 'fs-sm' }, 'getDisplayMedia({video:true}) 默认共享整个标签页，包含地址栏以外全部内容，无裁剪，可能暴露无关 UI。'),
        ),
        h('div', { class: 'ca-compare-row' },
          h('div', { class: 'ca-compare-label' }, 'Region Capture'),
          h('div', { class: 'fs-sm' }, '整页捕获后用 controller.cropTo(restrictionTarget) 按 CSS 区域裁剪，运行时可调整区域，隐藏区域不外泄。'),
        ),
        h('div', { class: 'ca-compare-row' },
          h('div', { class: 'ca-compare-label' }, 'Element Capture'),
          h('div', { class: 'fs-sm' }, 'RestrictionTarget.fromElement(el) + cropTo(rt) 只共享该元素，元素滚动/变换自动跟随，最精确。'),
        ),
      ),
      h('table', { class: 'ca-matrix' },
        h('thead', {},
          h('tr', {},
            h('th', {}, '模式'),
            h('th', {}, 'displaySurface'),
            h('th', {}, '裁剪粒度'),
            h('th', {}, '隐私暴露'),
            h('th', {}, '运行时调整'),
          ),
        ),
        h('tbody', {},
          h('tr', {},
            h('td', {}, '全标签页'),
            h('td', {}, 'browser'),
            h('td', {}, '无裁剪'),
            h('td', {}, '高（整页）'),
            h('td', {}, '不支持'),
          ),
          h('tr', {},
            h('td', {}, 'Region Capture'),
            h('td', {}, 'browser'),
            h('td', {}, 'CSS 区域'),
            h('td', {}, '低（仅区域）'),
            h('td', {}, '支持（cropTo）'),
          ),
          h('tr', {},
            h('td', {}, 'Element Capture'),
            h('td', {}, 'browser'),
            h('td', {}, '单个元素'),
            h('td', {}, '最低（仅元素）'),
            h('td', {}, '支持（跟随元素）'),
          ),
        ),
      ),
      h('pre', { class: 'code-block mt-md' },
`// Region Capture：裁剪到 CSS 区域
const rt = await RestrictionTarget.fromElement(regionEl);
controller.cropTo(rt);          // 仅共享 regionEl 区域
// Element Capture：仅共享单个元素（同 API，目标为具体元素）
// 安全模型：裁剪区域外内容不暴露，避免泄露无关 UI/隐私
// displaySurface: 'browser' | 'window' | 'screen' | 'application'`),
    );
  }

  // ============ Card 5：ClipboardItem 懒加载（Promise 数据） ============

  _asyncWriteClipboard() {
    const caps = this._caps();
    if (!caps.clipboardItem) {
      this._addLog('warn', 'ClipboardItem 不可用，仅说明：new ClipboardItem({"text/plain": Promise.resolve(blob)}) 支持懒加载，写入时才 resolve');
      this.setState({ clipboardState: '不可用：ClipboardItem 未定义' });
      return;
    }
    if (!caps.clipboardWrite) {
      this._addLog('warn', 'navigator.clipboard.write 不可用（需安全上下文+权限），仅说明用法');
      this.setState({ clipboardState: '不可用：clipboard.write 未定义（需 HTTPS+权限策略）' });
      return;
    }
    try {
      // 构造一个延迟生成文本 blob 的 Promise（懒加载演示）
      const textBlobPromise = new Promise((resolve) => {
        setTimeout(() => {
          const blob = new Blob(['ClipboardItem 懒加载文本 · ' + new Date().toISOString()], { type: 'text/plain' });
          this._addLog('info', '异步 Blob 已生成（延迟 50ms），即将写入剪贴板');
          resolve(blob);
        }, 50);
      });
      const item = new ClipboardItem({ 'text/plain': textBlobPromise });
      this._addLog('info', 'new ClipboardItem({ "text/plain": Promise<Blob> }) 已构造（懒加载）');
      Promise.resolve(navigator.clipboard.write([item])).then(() => {
        this._addLog('info', 'clipboard.write([item]) 成功：Promise Blob 已 resolve 并写入');
        this.setState({ clipboardState: '写入成功：text/plain（Promise 懒加载已 resolve）' });
      }).catch((err) => {
        this._addLog('warn', 'clipboard.write 失败：' + (err && err.message));
        this.setState({ clipboardState: '写入失败：' + (err && err.message) });
      });
    } catch (err) {
      this._addLog('warn', 'ClipboardItem 构造失败：' + (err && err.message));
      this.setState({ clipboardState: '构造失败：' + (err && err.message) });
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const supportsPlain = caps.clipboardItemSupports
      ? (() => { try { return ClipboardItem.supports('text/plain'); } catch { return false; } })()
      : false;
    const supportsPng = caps.clipboardItemSupports
      ? (() => { try { return ClipboardItem.supports('image/png'); } catch { return false; } })()
      : false;
    const supportsWebCustom = caps.clipboardItemSupports
      ? (() => { try { return ClipboardItem.supports('web custom/format'); } catch { return false; } })()
      : false;
    return h(Card, {
      title: 'Card 5 · ClipboardItem 懒加载（Promise 数据）',
      extra: h(Tag, { color: caps.clipboardItemSupports ? 'success' : 'error' }, caps.clipboardItemSupports ? 'supports ✓' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'new ClipboardItem({ "text/plain": Promise.resolve(blob), "image/png": asyncBlobPromise }) 支持懒加载（写入时才 resolve）；' +
        'ClipboardItem.supports(type) 静态检测格式；自定义 MIME 用 web 前缀；一次写多种格式让目标应用自选；navigator.clipboard.write([item])。'),
      h('div', { class: 'ca-demo-box' },
        h('p', { class: 'fs-sm' }, '支持格式检测（ClipboardItem.supports）：'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, { color: supportsPlain ? 'success' : 'error' }, `text/plain ${supportsPlain ? '✓' : '✗'}`),
          h(Tag, { color: supportsPng ? 'success' : 'error' }, `image/png ${supportsPng ? '✓' : '✗'}`),
          h(Tag, { color: supportsWebCustom ? 'success' : 'error' }, `web custom/format ${supportsWebCustom ? '✓' : '✗'}`),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('异步生成并写入剪贴板', { type: 'primary', size: 'sm', onClick: () => this._asyncWriteClipboard() }),
        h(Tag, { color: caps.clipboardWrite ? 'success' : 'error' }, caps.clipboardWrite ? 'clipboard.write ✓' : 'clipboard.write ✗'),
      ),
      s.clipboardState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.clipboardState) : null,
      h('pre', { class: 'code-block mt-md' },
`// 懒加载：值是 Promise<Blob>，clipboard.write 时才 resolve
const textBlob = new Promise(resolve =>
  setTimeout(() => resolve(new Blob(['hi'], { type: 'text/plain' })), 100)
);
const item = new ClipboardItem({
  'text/plain': textBlob,                 // Promise 懒加载
  'image/png': fetchPngBlob(),            // 异步生成图片
  'web custom/format': customBlob,        // 自定义 MIME（web 前缀）
});
ClipboardItem.supports('image/png');      // 静态检测格式
await navigator.clipboard.write([item]);  // 一次写多种格式，目标应用自选`),
    );
  }

  // ============ Card 6：能力检测矩阵与决策 ============

  _renderCard6() {
    const caps = this._caps();
    const mk = (api, version, scene, ok) => h('tr', {},
      h('td', {}, api),
      h('td', {}, version),
      h('td', {}, scene),
      h('td', {}, ok ? '✓' : '✗'),
    );
    return h(Card, {
      title: 'Card 6 · 能力检测矩阵与决策',
      extra: h(Tag, { color: 'default' }, '场景推荐'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '对比 Element/Region Capture/ClipboardItem/CaptureController/getDisplayMedia 的 Chrome 版本与场景；' +
        '场景推荐：远程桌面=Element Capture、演示共享=Region Capture、富文本复制=ClipboardItem 多格式。'),
      h('table', { class: 'ca-matrix' },
        h('thead', {},
          h('tr', {},
            h('th', {}, 'API'),
            h('th', {}, 'Chrome 版本'),
            h('th', {}, '典型场景'),
            h('th', {}, '当前可用'),
          ),
        ),
        h('tbody', {},
          mk('getDisplayMedia', 'Chrome 72+', '屏幕/窗口/标签页共享基础', caps.getDisplayMedia),
          mk('CaptureController', 'Chrome 116+', '运行时切换共享源 surfaceSwitching', caps.captureController),
          mk('RestrictionTarget + cropTo (Element)', 'Chrome 121+', '远程桌面/协作工具只共享某元素', caps.restrictionTarget && caps.cropTo),
          mk('Region Capture (cropTo 区域)', 'Chrome 104+', '演示共享裁剪到 CSS 区域', caps.cropTo),
          mk('ClipboardItem (Promise 懒加载)', 'Chrome 76+ / 全主流', '富文本/图片多格式复制', caps.clipboardItem),
          mk('ClipboardItem.supports', 'Chrome 98+', '检测格式可用性', caps.clipboardItemSupports),
          mk('navigator.clipboard.write', 'Chrome 66+ / 全主流', '异步写剪贴板（需安全上下文）', caps.clipboardWrite),
        ),
      ),
      h('div', { class: 'ca-demo-box' },
        h('p', { class: 'fs-sm' }, h('strong', {}, '场景推荐：')),
        h('p', { class: 'fs-sm' }, '远程桌面/在线协作 → Element Capture：只共享指定元素，最精确、隐私最安全。'),
        h('p', { class: 'fs-sm' }, '演示共享/教学直播 → Region Capture：裁剪到 CSS 区域，可运行时调整。'),
        h('p', { class: 'fs-sm' }, '富文本/图片复制 → ClipboardItem 多格式：一次写 text/plain + image/png，目标应用自选最佳格式。'),
        h('p', { class: 'fs-sm' }, '运行时切换共享源 → CaptureController + surfaceSwitching：无需重新授权。'),
      ),
      h('pre', { class: 'code-block mt-md' },
`// 决策树
if (typeof RestrictionTarget !== 'undefined')      // 元素级最精确
  elementCapture(el);
else if (controller.cropTo)                         // 区域裁剪次之
  regionCapture(regionEl);
else                                                // 兜底全标签页
  getDisplayMedia({ video: true });
// 富文本复制
if (ClipboardItem.supports('image/png'))
  clipboard.write([new ClipboardItem({ 'text/plain': p, 'image/png': p2 })]);`),
    );
  }

  // ============ 日志面板 ============

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

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, '高级屏幕捕获与剪贴板 实验室'),

      h(Alert, {
        type: 'info',
        message: '高级屏幕捕获与剪贴板',
        description: '演示 getDisplayMedia 基础、CaptureController 与 surfaceSwitching、Element Capture（RestrictionTarget）、Region Capture 概念对比、ClipboardItem 懒加载（Promise 数据）、能力检测矩阵与决策等 2023-2025 屏幕共享与剪贴板进阶 API。所有特性通过 typeof/in 能力检测，不支持时记日志不报错。jsdom/Node 环境下大部分 API 不存在，需真实浏览器。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

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
