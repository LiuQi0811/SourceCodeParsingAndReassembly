// =====================================================================
// ExperimentalWebAPIsPage.js —— 实验/边缘 Web API 实验室
// 演示 2023-2025 尚未在前序页面覆盖的实验/边缘但高价值的 Web API：
//   1. Ink API —— navigator.ink.requestPresenter() → DelegatedInkTrailPresenter
//      + updateInkTrailStartPoint(point, style) 在指针事件之间由 OS 级合成器
//      渲染委托的笔迹墨迹，绕过 JS 事件循环，显著降低延迟（Chrome 94+）
//   2. WebXR Device API —— navigator.xr.isSessionSupported(mode) / requestSession
//      + XRSession(mode='immersive-vr'|'immersive-ar'|'inline') +
//      requestReferenceSpace('local'|'local-floor'|'viewer'|'bounded-floor') +
//      XRFrame/session.requestAnimationFrame(cb) + WebGL context compatibility +
//      vs WebVR（已废弃）/ 桌面 vs 移动 vs 全沉浸 AR/VR（Chrome 79+）
//   3. Element.checkVisibility() —— 检查元素「可见」状态（contentVisibilityAuto
//      / opacityProperty / visibilityProperty / fixedPositionObscured 检查项）
//      + vs getBoundingClientRect / getComputedStyle / offsetParent 各自盲区
//      （Chrome 105+）
//   4. Element.setHTMLUnsafe / ShadowRoot.setHTMLUnsafe / Document.parseHTMLUnsafe
//      —— 直接解析含 <template shadowrootmode> 的 DSD HTML 字符串，无需
//      DOMParser 中转；parseHTMLUnsafe 返回 Document；与 Sanitizer API 协同
//      （Chrome 124+ setHTMLUnsafe / 125+ parseHTMLUnsafe）
//   5. navigator.scheduling.isInputPending() —— 检查主线程是否有待处理用户
//      输入（continuous: 'move'|'pointermove'、discrete: 'click'|'mousedown'
//      等），用于长任务中主动让出主线程避免卡顿；vs scheduler.postTask /
//      scheduler.yield / requestIdleCallback（Chrome 87+ Origin Trial）
//   6. scrollbar-color / scrollbar-width —— 标准化滚动条样式属性（thin/auto/
//      none + 双色），替代 ::-webkit-scrollbar 私有前缀；Firefox 64+ /
//      Chrome 121+ / Safari 16.4+；scrollbar-width: none 隐藏滚动条仍可滚动
// 说明：所有特性调用前做 typeof/in/属性检测，不可用时仅记日志，绝不抛异常。
//       jsdom 中多数 API 不可用，统一 try/catch 兜底，演示以日志 + 代码片段
//       形式展示真实浏览器中的预期行为。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ExperimentalWebAPIsPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      inkInfo: '',
      xrInfo: '',
      checkVisibilityInfo: '',
      setHtmlInfo: '',
      schedulingInfo: '',
      scrollbarInfo: '',
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._injectedStyles = [];
    // 实例字段（避免 rerender 重置）
    this._inkPresenter = null;          // Card 1 DelegatedInkTrailPresenter 实例
    this._xrSession = null;             // Card 2 XRSession 引用
    this._inkPoints = [];               // Card 1 墨迹路径点（演示用）
    this._schedulingPendingCount = 0;   // Card 5 isInputPending 计数

    const caps = this._caps();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `Ink API ${c(caps.ink)}`,
      `navigator.xr ${c(caps.xr)}`,
      `Element.checkVisibility ${c(caps.checkVisibility)}`,
      `setHTMLUnsafe ${c(caps.setHTMLUnsafe)}`,
      `parseHTMLUnsafe ${c(caps.parseHTMLUnsafe)}`,
      `scheduling.isInputPending ${c(caps.scheduling)}`,
      `scrollbar-color ${c(caps.scrollbarColor)}`,
      `scrollbar-width ${c(caps.scrollbarWidth)}`,
    ];

    const summary = '实验/边缘 Web API 能力检测：' + parts.join(' · ')
      + '。jsdom 中上述 API 多数不可用，仅记日志说明；在真实浏览器中打开可完整演示。';

    this.setState({
      capsSummary: summary,
      logs: [...this.state.logs, { type: 'info', content: '能力检测：' + parts.join('，'), time: formatTime() }].slice(-40),
    });

    if (!caps.ink) this._addLog('warn', 'navigator.ink 不可用（Chrome 94+ 实验性），演示仅记日志');
    if (!caps.xr) this._addLog('warn', 'navigator.xr 不可用（Chrome 79+ WebXR，需 HTTPS + XR 设备/模拟器）');
    if (!caps.checkVisibility) this._addLog('warn', 'Element.checkVisibility 不可用（Chrome 105+）');
    if (!caps.setHTMLUnsafe) this._addLog('warn', 'Element.setHTMLUnsafe 不可用（Chrome 124+）');
    if (!caps.parseHTMLUnsafe) this._addLog('warn', 'Document.parseHTMLUnsafe 不可用（Chrome 125+）');
    if (!caps.scheduling) this._addLog('warn', 'navigator.scheduling.isInputPending 不可用（Chrome 87+ Origin Trial，需 enable-experimental-web-platform-features）');
    if (!caps.scrollbarColor) this._addLog('warn', 'scrollbar-color 不可用（Firefox 64+/Chrome 121+/Safari 16.4+）');
    if (!caps.scrollbarWidth) this._addLog('warn', 'scrollbar-width 不可用或 jsdom 未识别（Firefox 64+/Chrome 121+/Safari 16.4+）');

    this._injectDemoStyles();
  }

  componentWillUnmount() {
    if (Array.isArray(this._injectedStyles)) {
      this._injectedStyles.forEach((el) => { try { el && el.remove(); } catch { /* noop */ } });
      this._injectedStyles = [];
    }
    // 释放 XR session（真实环境需要 await session.endSession()）
    if (this._xrSession && typeof this._xrSession.endSession === 'function') {
      try { this._xrSession.endSession(); } catch { /* noop */ }
    }
    this._xrSession = null;
    this._inkPresenter = null;
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
    let ink = false;
    try { ink = typeof navigator !== 'undefined' && !!navigator.ink && typeof navigator.ink.requestPresenter === 'function'; }
    catch { ink = false; }
    let xr = false;
    try { xr = typeof navigator !== 'undefined' && !!navigator.xr && typeof navigator.xr.isSessionSupported === 'function'; }
    catch { xr = false; }
    let checkVisibility = false;
    try { checkVisibility = typeof Element !== 'undefined' && typeof Element.prototype.checkVisibility === 'function'; }
    catch { checkVisibility = false; }
    let setHTMLUnsafe = false;
    try { setHTMLUnsafe = typeof Element !== 'undefined' && typeof Element.prototype.setHTMLUnsafe === 'function'; }
    catch { setHTMLUnsafe = false; }
    let parseHTMLUnsafe = false;
    try { parseHTMLUnsafe = typeof Document !== 'undefined' && typeof Document.prototype.parseHTMLUnsafe === 'function'; }
    catch { parseHTMLUnsafe = false; }
    let scheduling = false;
    try { scheduling = typeof navigator !== 'undefined' && !!navigator.scheduling && typeof navigator.scheduling.isInputPending === 'function'; }
    catch { scheduling = false; }
    const supportsPV = (p, v) => {
      try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      ink, xr, checkVisibility, setHTMLUnsafe, parseHTMLUnsafe, scheduling,
      scrollbarColor: supportsPV('scrollbar-color', 'red blue'),
      scrollbarWidth: supportsPV('scrollbar-width', 'thin'),
      scrollbarWidthNone: supportsPV('scrollbar-width', 'none'),
    };
  }

  _injectDemoStyles() {
    this._injectStyle('experimental-web-apis-demo', `
      /* ===== Card 1: Ink API ===== */
      .ewa-ink-stage { position: relative; width: 100%; height: 160px; border: 1px dashed #cbd5e1; border-radius: 6px; background: #fff; margin-top: 8px; overflow: hidden; }
      .ewa-ink-canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
      /* ===== Card 6: scrollbar-color / scrollbar-width ===== */
      .ewa-sb-stage { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 8px; }
      .ewa-sb-box { height: 120px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #fff; font-size: 12px; line-height: 1.6; color: #475569; }
      .ewa-sb-box.sb-color { scrollbar-color: #1677ff #e0e7ff; scrollbar-width: thin; }
      .ewa-sb-box.sb-thin { scrollbar-width: thin; }
      .ewa-sb-box.sb-none { scrollbar-width: none; }
      .ewa-sb-box.sb-auto { scrollbar-width: auto; }
      .ewa-sb-label { font-size: 11px; color: #64748b; margin-top: 4px; font-family: monospace; }
      /* ===== Card 4: DSD 演示 ===== */
      .ewa-dsd-host { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; margin-top: 8px; background: #f8fafc; }
      .ewa-dsd-output { background: #0f172a; color: #e2e8f0; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 11px; margin-top: 8px; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow: auto; }
      /* ===== Card 3: checkVisibility ===== */
      .ewa-cv-stage { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      .ewa-cv-row { display: flex; align-items: center; gap: 12px; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; font-size: 12px; }
      .ewa-cv-row .ewa-cv-name { min-width: 120px; color: #1e40af; font-weight: 600; }
      .ewa-cv-row .ewa-cv-result { font-family: monospace; color: #0f766e; }
      .ewa-cv-row.hidden-demo { display: none; }
      .ewa-cv-row.opacity-zero-demo { opacity: 0; }
      .ewa-cv-row.visibility-hidden-demo { visibility: hidden; }
      .ewa-cv-row.content-visibility-demo { content-visibility: hidden; }
      /* ===== 通用代码块 ===== */
      .ewa-code { background: #0f172a; color: #e2e8f0; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; line-height: 1.6; overflow: auto; margin-top: 8px; }
    `);
  }

  // ============ Card 1：Ink API（DelegatedInkTrailPresenter）============

  _initInkPresenter() {
    const caps = this._caps();
    if (!caps.ink) {
      this._addLog('warn', 'Ink API 不可用（Chrome 94+ 实验性），仅说明：navigator.ink.requestPresenter() → DelegatedInkTrailPresenter，updateInkTrailStartPoint(point, style) 在 pointermove 之间由 OS 合成器渲染墨迹');
      this.setState({ inkInfo: 'Ink API 不可用：需 Chrome 94+ 实验性 flag 或较新浏览器。\n\n预期流程：\n  const presenter = await navigator.ink.requestPresenter({ presentationArea: canvas });\n  presenter.updateInkTrailStartPoint(pointerEvent, { diameter, color, style: \'-en-least-essential\' });' });
      return;
    }
    const canvas = this.$('#ewa-ink-canvas');
    if (!canvas || !canvas.getContext) {
      this._addLog('warn', '未找到 canvas 或 canvas 2D 上下文不可用');
      return;
    }
    try {
      const ctx = canvas.getContext('2d');
      this._inkCtx = ctx;
      // 重新设置画布像素尺寸（DPR 适配）
      const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 320, height: 160 };
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1677ff';
      this._addLog('info', '已获取 canvas 2D context，准备调用 navigator.ink.requestPresenter()');
      navigator.ink.requestPresenter({ presentationArea: canvas })
        .then((presenter) => {
          this._inkPresenter = presenter;
          this._addLog('info', 'navigator.ink.requestPresenter() ✓ → DelegatedInkTrailPresenter 已创建');
          this.setState({ inkInfo: `navigator.ink.requestPresenter() → DelegatedInkTrailPresenter ✓\n.presentationArea = canvas\n.expectedImprovement = ${typeof presenter.expectedImprovement === 'number' ? presenter.expectedImprovement : '(N/A)'}\n\n在画布上拖动鼠标可绘制墨迹；JS 绘制 + DelegatedInkTrail 在两次 pointermove 之间由 OS 合成器补帧，显著降低延迟。` });
        })
        .catch((err) => {
          this._addLog('warn', 'navigator.ink.requestPresenter 失败：' + (err && err.message));
        });
    } catch (err) {
      this._addLog('warn', '初始化 Ink 演示失败：' + (err && err.message));
    }
  }

  _onInkPointerMove(e) {
    // 普通绘制：JS 接到 pointermove 后绘制线段
    if (!this._inkCtx || !e) return;
    const rect = e.target && e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : null;
    const x = rect ? (e.clientX - rect.left) : (e.offsetX || 0);
    const y = rect ? (e.clientY - rect.top) : (e.offsetY || 0);
    if (this._inkPoints.length > 0) {
      const prev = this._inkPoints[this._inkPoints.length - 1];
      this._inkCtx.beginPath();
      this._inkCtx.moveTo(prev.x, prev.y);
      this._inkCtx.lineTo(x, y);
      this._inkCtx.stroke();
    }
    this._inkPoints.push({ x, y });
    // 关键：调用 presenter.updateInkTrailStartPoint(pointerEvent, style)
    // 让 OS 合成器在两次 pointermove 之间补一帧墨迹
    if (this._inkPresenter && typeof this._inkPresenter.updateInkTrailStartPoint === 'function') {
      try {
        this._inkPresenter.updateInkTrailStartPoint(e, {
          diameter: 4,
          color: '#1677ff',
        });
      } catch { /* noop */ }
    }
  }

  _onInkPointerUp() {
    this._inkPoints = [];
    this._addLog('info', 'pointerup → 墨迹路径已结束（_inkPoints 清空，下次重新开始）');
  }

  _clearInk() {
    if (this._inkCtx && this._inkCtx.canvas) {
      this._inkCtx.clearRect(0, 0, this._inkCtx.canvas.width, this._inkCtx.canvas.height);
    }
    this._inkPoints = [];
    this._addLog('info', '已清空画布');
  }

  _renderCard1() {
    const caps = this._caps();
    const s = this.state;
    return h(Card, {
      title: 'Card 1 · Ink API（DelegatedInkTrailPresenter）',
      extra: h(Tag, { color: caps.ink ? 'success' : 'error' }, caps.ink ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'navigator.ink.requestPresenter({ presentationArea }) → Promise<DelegatedInkTrailPresenter>；' +
        'presenter.updateInkTrailStartPoint(pointerEvent, { diameter, color, style }) 在 pointer 事件之间由 OS 级合成器补帧渲染墨迹，' +
        '绕过 JS 事件循环显著降低延迟。适合签名/手写/绘图类应用。Chrome 94+ 实验性。'),
      h('div', { class: 'ewa-ink-stage' },
        h('canvas', {
          id: 'ewa-ink-canvas', class: 'ewa-ink-canvas',
          onpointermove: (e) => this._onInkPointerMove(e),
          onpointerup: () => this._onInkPointerUp(),
        }),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('初始化 InkPresenter', { type: 'primary', size: 'sm', onClick: () => this._initInkPresenter() }),
        this._btn('清空画布', { type: 'default', size: 'sm', onClick: () => this._clearInk() }),
      ),
      s.inkInfo ? h('pre', { class: 'code-block mt-md' }, s.inkInfo) : null,
      h('pre', { class: 'ewa-code' },
`// Ink API：让 OS 级合成器在 pointermove 之间补帧墨迹
const presenter = await navigator.ink.requestPresenter({ presentationArea: canvas });
canvas.addEventListener('pointermove', (e) => {
  // 1) JS 自身绘制（事件循环内）
  drawSegment(prevPoint, e);
  // 2) 委托合成器在下次 pointermove 之前补一帧
  presenter.updateInkTrailStartPoint(e, {
    diameter: 4,
    color: '#1677ff',
    // style: '-en-least-essential'（实验性）
  });
});
// vs 普通绘制：两次 pointermove 间隔（~16ms）有空白；Ink API 补帧后视觉延迟更低`),
    );
  }

  // ============ Card 2：WebXR Device API ============

  _checkXrSupport() {
    const caps = this._caps();
    if (!caps.xr) {
      this._addLog('warn', 'navigator.xr 不可用（Chrome 79+ WebXR，需 HTTPS + XR 设备/模拟器扩展如 WebXR API Emulator）');
      this.setState({ xrInfo: 'navigator.xr 不可用：需 Chrome 79+ + HTTPS + XR 设备或浏览器模拟器扩展。\n\n预期能力检测：\n  navigator.xr.isSessionSupported(\'immersive-vr\')  → Promise<true|false>\n  navigator.xr.isSessionSupported(\'immersive-ar\')  → Promise<true|false>\n  navigator.xr.isSessionSupported(\'inline\')        → Promise<true>（inline 总可用）' });
      return;
    }
    const modes = ['immersive-vr', 'immersive-ar', 'inline'];
    const results = [];
    let pending = modes.length;
    modes.forEach((mode) => {
      try {
        navigator.xr.isSessionSupported(mode)
          .then((supported) => {
            results.push(`${mode.padEnd(13)} → ${supported ? '✓ supported' : '✗ not supported'}`);
            this._addLog('info', `navigator.xr.isSessionSupported('${mode}') → ${supported}`);
          })
          .catch((err) => {
            results.push(`${mode.padEnd(13)} → error: ${err.name}`);
            this._addLog('warn', `isSessionSupported('${mode}') 抛错：${err.name} - ${err.message}`);
          })
          .finally(() => {
            pending--;
            if (pending === 0) {
              this.setState({ xrInfo: '===== WebXR Session 支持情况 =====\n\n' + results.sort().join('\n') + '\n\nimmersive-vr / immersive-ar 需 XR 设备或模拟器；inline 总可用（页面内嵌 3D 渲染）。' });
            }
          });
      } catch (err) {
        results.push(`${mode.padEnd(13)} → sync throw: ${err.message}`);
        pending--;
      }
    });
  }

  _requestXrSession() {
    const caps = this._caps();
    if (!caps.xr) {
      this._addLog('warn', 'navigator.xr 不可用，无法 requestSession');
      return;
    }
    if (this._xrSession) {
      this._addLog('info', '已有活动 XRSession，先调用 endSession() 再演示');
      try { this._xrSession.endSession(); } catch { /* noop */ }
      this._xrSession = null;
    }
    try {
      navigator.xr.requestSession('inline')
        .then((session) => {
          this._xrSession = session;
          this._addLog('info', "navigator.xr.requestSession('inline') ✓ → XRSession 已创建（inline 模式不需要 XR 设备）");
          // 监听 end 事件
          if (typeof session.addEventListener === 'function') {
            session.addEventListener('end', () => {
              this._addLog('info', 'XRSession end 事件触发（会话已结束）');
              this._xrSession = null;
            });
          }
          this.setState({ xrInfo: `navigator.xr.requestSession('inline') → XRSession ✓\n.mode = ${session.mode}\n.environmentBlendMode = ${session.environmentBlendMode}\n.visibilityState = ${session.visibilityState}\n.requestReferenceSpace('local'|'viewer'|'local-floor') → Promise<XRReferenceSpace>\n.session.requestAnimationFrame((time, frame) => { /* 渲染循环 */ })` });
        })
        .catch((err) => {
          this._addLog('warn', "requestSession('inline') 失败：" + err.name + ' - ' + err.message);
          this.setState({ xrInfo: `requestSession('inline') 失败：${err.name} - ${err.message}\n\n常见原因：\n  - NotSupportedError：浏览器不支持 inline 模式（理论应支持）\n  - NotAllowedError：用户拒绝授权或非安全上下文\n  - SecurityError：跨源 iframe 缺少 allow="xr-spatial-tracking"` });
        });
    } catch (err) {
      this._addLog('warn', 'requestSession 同步抛错：' + err.message);
    }
  }

  _endXrSession() {
    if (!this._xrSession) {
      this._addLog('warn', '当前无活动 XRSession 可结束');
      return;
    }
    try {
      const endPromise = this._xrSession.end();
      this._addLog('info', '已调用 session.end()（返回 Promise 或 void）');
      if (endPromise && typeof endPromise.then === 'function') {
        endPromise.then(() => {
          this._addLog('info', 'XRSession.end() resolved，会话已结束');
          this._xrSession = null;
        }).catch((err) => this._addLog('warn', 'XRSession.end() 失败：' + err.message));
      } else {
        this._xrSession = null;
      }
    } catch (err) {
      this._addLog('warn', 'session.end 失败：' + err.message);
    }
  }

  _renderCard2() {
    const caps = this._caps();
    const s = this.state;
    return h(Card, {
      title: 'Card 2 · WebXR Device API',
      extra: h(Tag, { color: caps.xr ? 'success' : 'error' }, caps.xr ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'navigator.xr.isSessionSupported(mode) / requestSession(mode) → Promise<XRSession>；' +
        'mode: \'immersive-vr\' | \'immersive-ar\' | \'inline\'；session.requestReferenceSpace(' +
        '\'local\'|\'local-floor\'|\'viewer\'|\'bounded-floor\') + requestAnimationFrame 渲染循环 + ' +
        'XRFrame/pose/视图矩阵。WebGL 上下文需 xrCompatible: true。Chrome 79+，替代已废弃 WebVR。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('检测 session 支持', { type: 'primary', size: 'sm', onClick: () => this._checkXrSupport() }),
        this._btn("requestSession('inline')", { type: 'default', size: 'sm', disabled: !caps.xr, onClick: () => this._requestXrSession() }),
        this._btn('endSession()', { type: 'default', size: 'sm', danger: true, disabled: !caps.xr, onClick: () => this._endXrSession() }),
      ),
      s.xrInfo ? h('pre', { class: 'code-block mt-md' }, s.xrInfo) : null,
      h('pre', { class: 'ewa-code' },
`// WebXR 完整流程（沉浸式 VR）
if (await navigator.xr.isSessionSupported('immersive-vr')) {
  const session = await navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],      // 6DoF 站立参考系
    optionalFeatures: ['bounded-floor', 'hand-tracking'],
  });
  const gl = canvas.getContext('webgl2', { xrCompatible: true });
  const refSpace = await session.requestReferenceSpace('local-floor');
  session.requestAnimationFrame((time, frame) => {
    const pose = frame.getViewerPose(refSpace);   // XRViewerPose
    for (const view of pose.views) {              // 左右眼各一
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
      // 渲染 view.projectionMatrix / view.transform.matrix ...
    }
    session.requestAnimationFrame(handler);       // 续帧
  });
}
// inline 模式不需 XR 设备，可作降级；AR 模式需 immersive-ar + camera` +
` 权限`),
    );
  }

  // ============ Card 3：Element.checkVisibility() ============

  _checkVisibilityDemo() {
    const caps = this._caps();
    if (!caps.checkVisibility) {
      this._addLog('warn', 'Element.checkVisibility 不可用（Chrome 105+），仅说明：检查元素「可见」状态，参数 { contentVisibilityAuto, opacityProperty, visibilityProperty, fixedPositionObscured } 控制检查项');
      this.setState({ checkVisibilityInfo: 'Element.checkVisibility() 不可用：需 Chrome 105+。\n\n预期用法：\n  el.checkVisibility()                                  // 默认所有检查项\n  el.checkVisibility({ contentVisibilityAuto: true })    // 含 content-visibility:auto 跳过\n  el.checkVisibility({ opacityProperty: true })          // opacity:0 视为不可见\n  el.checkVisibility({ visibilityProperty: true })       // visibility:hidden 视为不可见\n  el.checkVisibility({ fixedPositionObscured: true })    // fixed 元素被遮挡视为不可见\n\nvs 其他可见性检测方式：\n  - getBoundingClientRect：仅看几何位置，不看 opacity/visibility\n  - getComputedStyle：仅看计算样式，不知是否真正在视口\n  - offsetParent===null：仅看是否被定位祖先移出，opacity:0 仍返回正常 parent\n  - IntersectionObserver：异步回调 + 仅看视口交叉，不查样式\n  - checkVisibility：综合检查（样式 + 几何 + content-visibility），同步返回 boolean' });
      return;
    }
    const ids = ['ewa-cv-visible', 'ewa-cv-hidden', 'ewa-cv-opacity0', 'ewa-cv-visibility-hidden', 'ewa-cv-content-hidden'];
    const names = ['正常显示', 'display:none', 'opacity:0', 'visibility:hidden', 'content-visibility:hidden'];
    const rows = [];
    for (let i = 0; i < ids.length; i++) {
      const el = this.$('#' + ids[i]);
      if (!el) continue;
      let r1 = '?', r2 = '?', r3 = '?', r4 = '?';
      try { r1 = String(el.checkVisibility()); } catch (e) { r1 = 'err:' + e.name; }
      try { r2 = String(el.checkVisibility({ opacityProperty: true })); } catch (e) { r2 = 'err:' + e.name; }
      try { r3 = String(el.checkVisibility({ visibilityProperty: true })); } catch (e) { r3 = 'err:' + e.name; }
      try { r4 = String(el.checkVisibility({ contentVisibilityAuto: true })); } catch (e) { r4 = 'err:' + e.name; }
      rows.push(`${names[i].padEnd(22)} | 默认=${r1.padEnd(5)} | opacity=${r2.padEnd(5)} | visibility=${r3.padEnd(5)} | contentVis=${r4}`);
      this._addLog('info', `checkVisibility ${names[i]}：默认=${r1}, opacity=${r2}, visibility=${r3}`);
    }
    this.setState({ checkVisibilityInfo: '===== Element.checkVisibility() 各检查项矩阵 =====\n\n' + rows.join('\n') + '\n\n说明：\n  - 默认（无参数）：仅检查 display:none / content-visibility:hidden 等「渲染层」不可见\n  - opacityProperty:true：把 opacity:0 也视为不可见\n  - visibilityProperty:true：把 visibility:hidden 也视为不可见\n  - contentVisibilityAuto:true：考虑 content-visibility:auto 的跳过状态\n  - fixedPositionObscured:true：fixed 元素被其他元素遮挡时视为不可见' });
  }

  _renderCard3() {
    const caps = this._caps();
    const s = this.state;
    return h(Card, {
      title: 'Card 3 · Element.checkVisibility()',
      extra: h(Tag, { color: caps.checkVisibility ? 'success' : 'error' }, caps.checkVisibility ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'Element.checkVisibility(options) → boolean：综合检查元素「可见」状态，' +
        '参数 { contentVisibilityAuto, opacityProperty, visibilityProperty, fixedPositionObscured } 控制检查项。' +
        'vs getBoundingClientRect / getComputedStyle / offsetParent 各自盲区。Chrome 105+。'),
      h('div', { class: 'ewa-cv-stage' },
        h('div', { id: 'ewa-cv-visible', class: 'ewa-cv-row' }, h('span', { class: 'ewa-cv-name' }, '正常显示'), h('span', { class: 'ewa-cv-result' }, '可见')),
        h('div', { id: 'ewa-cv-hidden', class: 'ewa-cv-row hidden-demo' }, h('span', { class: 'ewa-cv-name' }, 'display:none'), h('span', { class: 'ewa-cv-result' }, '不可见')),
        h('div', { id: 'ewa-cv-opacity0', class: 'ewa-cv-row opacity-zero-demo' }, h('span', { class: 'ewa-cv-name' }, 'opacity:0'), h('span', { class: 'ewa-cv-result' }, '透明')),
        h('div', { id: 'ewa-cv-visibility-hidden', class: 'ewa-cv-row visibility-hidden-demo' }, h('span', { class: 'ewa-cv-name' }, 'visibility:hidden'), h('span', { class: 'ewa-cv-result' }, '隐藏')),
        h('div', { id: 'ewa-cv-content-hidden', class: 'ewa-cv-row content-visibility-demo' }, h('span', { class: 'ewa-cv-name' }, 'content-visibility:hidden'), h('span', { class: 'ewa-cv-result' }, '内容跳过')),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('运行 checkVisibility', { type: 'primary', size: 'sm', onClick: () => this._checkVisibilityDemo() }),
      ),
      s.checkVisibilityInfo ? h('pre', { class: 'code-block mt-md' }, s.checkVisibilityInfo) : null,
      h('pre', { class: 'ewa-code' },
`// Element.checkVisibility()：综合检查元素可见性
el.checkVisibility();                                       // true / false
el.checkVisibility({ opacityProperty: true });              // 把 opacity:0 视为不可见
el.checkVisibility({ visibilityProperty: true });           // 把 visibility:hidden 视为不可见
el.checkVisibility({ contentVisibilityAuto: true });        // 含 content-visibility:auto 跳过状态
el.checkVisibility({ fixedPositionObscured: true });        // fixed 元素被遮挡视为不可见

// vs 其他检测方式盲区：
//   getBoundingClientRect：仅看几何位置（opacity:0 仍返回非零矩形）
//   getComputedStyle(prop)：仅看计算样式（脱离视口仍返回 opacity:1）
//   offsetParent===null：仅看是否被 display:none 祖先移出（opacity:0 仍正常）
//   IntersectionObserver：异步 + 仅看视口交叉，不查样式`),
    );
  }

  // ============ Card 4：Element.setHTMLUnsafe / Document.parseHTMLUnsafe ============

  _setHtmlUnsafeDemo() {
    const caps = this._caps();
    if (!caps.setHTMLUnsafe) {
      this._addLog('warn', 'Element.setHTMLUnsafe 不可用（Chrome 124+），仅说明：直接解析含 <template shadowrootmode="open"> 的 DSD HTML 字符串，无需 DOMParser');
      this.setState({ setHtmlInfo: 'Element.setHTMLUnsafe(html) 不可用：需 Chrome 124+。\n\n预期用法：\n  // 直接把含 DSD 的 HTML 字符串赋给容器\n  host.setHTMLUnsafe(`\n    <template shadowrootmode="open">\n      <style>:host { display: block; padding: 8px; }</style>\n      <p>Declarative Shadow DOM 内容</p>\n    </template>\n    <span>Light DOM 内容</span>\n  `);\n  // host.shadowRoot 现在已存在（无需 attachShadow）\n  host.shadowRoot.querySelector(\'p\');   // → <p>Declarative Shadow DOM 内容</p>\n\nvs innerHTML：\n  - innerHTML 不会解析 <template shadowrootmode>，会把 template 当普通元素插入\n  - setHTMLUnsafe 会触发 DSD 解析，自动创建 shadowRoot\n\nvs Sanitizer API：\n  - setHTMLUnsafe 不做净化，含 XSS 风险（适合可信内容或配合 Sanitizer）\n  - element.setHTML(html, { sanitizer }) 配合 Sanitizer 净化后设置' });
      return;
    }
    const host = this.$('#ewa-dsd-host');
    if (!host) { this._addLog('warn', '未找到演示容器'); return; }
    try {
      const html = '<template shadowrootmode="open">'
        + '<style>:host { display: block; padding: 8px; background: #dbeafe; border-radius: 4px; }</style>'
        + '<p>Declarative Shadow DOM 内容（自动 attachShadow）</p>'
        + '</template>'
        + '<span>Light DOM 内容</span>';
      host.setHTMLUnsafe(html);
      const hasShadow = !!host.shadowRoot;
      const lightHTML = host.innerHTML;
      const shadowHTML = hasShadow ? host.shadowRoot.innerHTML : '(no shadowRoot)';
      this._addLog('info', 'host.setHTMLUnsafe(html) ✓ → shadowRoot=' + (hasShadow ? '✓' : '✗'));
      this.setState({ setHtmlInfo: `Element.setHTMLUnsafe(html) ✓\n\nhost.shadowRoot = ${hasShadow ? '✓ 已创建' : '✗ 未创建'}\n\n===== host.innerHTML（Light DOM）=====\n${lightHTML}\n\n===== host.shadowRoot.innerHTML（Shadow DOM）=====\n${shadowHTML}\n\n说明：setHTMLUnsafe 直接解析含 <template shadowrootmode="open"> 的 DSD 字符串，自动创建 shadowRoot，无需 attachShadow。` });
    } catch (err) {
      this._addLog('warn', 'setHTMLUnsafe 失败：' + err.message);
    }
  }

  _parseHtmlUnsafeDemo() {
    const caps = this._caps();
    if (!caps.parseHTMLUnsafe) {
      this._addLog('warn', 'Document.parseHTMLUnsafe 不可用（Chrome 125+），仅说明：直接把含 DSD 的 HTML 字符串解析为 Document，无需 DOMParser');
      this.setState({ setHtmlInfo: 'Document.parseHTMLUnsafe(html) 不可用：需 Chrome 125+。\n\n预期用法：\n  const doc = Document.parseHTMLUnsafe(`\n    <!DOCTYPE html>\n    <html><body>\n      <my-element>\n        <template shadowrootmode="open">\n          <style>:host { color: red; }</style>\n          <p>Shadow</p>\n        </template>\n        <span>Light</span>\n      </my-element>\n    </body></html>\n  `);\n  // doc 是完整 Document，含已 attach 的 shadowRoot\n  doc.querySelector(\'my-element\').shadowRoot;   // → ✓\n\nvs DOMParser：\n  - DOMParser 默认不解析 DSD，template 元素作为普通 template 保留\n  - Document.parseHTMLUnsafe 直接触发 DSD 解析' });
      return;
    }
    try {
      const html = '<!DOCTYPE html><html><body>'
        + '<my-element><template shadowrootmode="open"><style>:host{color:#1677ff;}</style>'
        + '<p>解析后的 Shadow 内容</p></template><span>解析后的 Light 内容</span></my-element>'
        + '</body></html>';
      const doc = Document.parseHTMLUnsafe(html);
      const el = doc.querySelector('my-element');
      const hasShadow = el && !!el.shadowRoot;
      const lightText = el ? el.textContent : '(no element)';
      const shadowText = (el && el.shadowRoot) ? el.shadowRoot.textContent : '(no shadowRoot)';
      this._addLog('info', 'Document.parseHTMLUnsafe(html) ✓ → doc.querySelector("my-element").shadowRoot=' + (hasShadow ? '✓' : '✗'));
      this.setState({ setHtmlInfo: `Document.parseHTMLUnsafe(html) ✓\n\n返回 Document 对象：${doc.constructor.name}\ndoc.querySelector('my-element').shadowRoot = ${hasShadow ? '✓' : '✗'}\n\nLight DOM textContent：${lightText}\nShadow DOM textContent：${shadowText}\n\n说明：parseHTMLUnsafe 直接解析 DSD，返回完整 Document 对象，shadowRoot 已自动 attach。` });
    } catch (err) {
      this._addLog('warn', 'parseHTMLUnsafe 失败：' + err.message);
    }
  }

  _renderCard4() {
    const caps = this._caps();
    const s = this.state;
    return h(Card, {
      title: 'Card 4 · setHTMLUnsafe / parseHTMLUnsafe',
      extra: h(Tag, { color: caps.setHTMLUnsafe ? 'success' : 'error' }, caps.setHTMLUnsafe ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'Element.setHTMLUnsafe(html) / ShadowRoot.setHTMLUnsafe / Document.parseHTMLUnsafe(html)：' +
        '直接解析含 <template shadowrootmode="open"> 的 Declarative Shadow DOM HTML 字符串，' +
        '自动 attachShadow，无需 DOMParser 中转。setHTMLUnsafe Chrome 124+ / parseHTMLUnsafe Chrome 125+。' +
        '与 Sanitizer API 协同：setHTML(html, { sanitizer }) 做净化后设置。'),
      h('div', { id: 'ewa-dsd-host', class: 'ewa-dsd-host' }, '（点击下方按钮演示 setHTMLUnsafe）'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('setHTMLUnsafe(DSD)', { type: 'primary', size: 'sm', disabled: !caps.setHTMLUnsafe, onClick: () => this._setHtmlUnsafeDemo() }),
        this._btn('parseHTMLUnsafe', { type: 'default', size: 'sm', disabled: !caps.parseHTMLUnsafe, onClick: () => this._parseHtmlUnsafeDemo() }),
      ),
      s.setHtmlInfo ? h('div', { class: 'ewa-dsd-output' }, s.setHtmlInfo) : null,
      h('pre', { class: 'ewa-code' },
`// setHTMLUnsafe：直接解析含 DSD 的 HTML
host.setHTMLUnsafe(\`
  <template shadowrootmode="open">
    <style>:host { display: block; padding: 8px; }</style>
    <p>Declarative Shadow DOM 内容</p>
  </template>
  <span>Light DOM 内容</span>
\`);
host.shadowRoot.querySelector('p');   // ✓ 自动 attach

// parseHTMLUnsafe：返回完整 Document
const doc = Document.parseHTMLUnsafe(\`<!DOCTYPE html><html><body>
  <my-element>
    <template shadowrootmode="open"><p>Shadow</p></template>
    <span>Light</span>
  </my-element>
</body></html>\`);
doc.querySelector('my-element').shadowRoot;   // ✓

// vs innerHTML：innerHTML 不解析 <template shadowrootmode>，仅当普通 template 插入
// vs Sanitizer：setHTMLUnsafe 不做净化；element.setHTML(html, { sanitizer }) 净化后设置`),
    );
  }

  // ============ Card 5：navigator.scheduling.isInputPending() ============

  _runSchedulingLoop() {
    const caps = this._caps();
    if (!caps.scheduling) {
      this._addLog('warn', 'navigator.scheduling.isInputPending 不可用（Chrome 87+ Origin Trial），仅说明：检查主线程是否有待处理用户输入，长任务中主动让出避免卡顿');
      this.setState({ schedulingInfo: 'navigator.scheduling.isInputPending() 不可用：需 Chrome 87+ Origin Trial 或 enable-experimental-web-platform-features。\n\n预期用法：\n  // 长任务分块：每处理 N 项检查一次是否有用户输入待处理\n  function processChunks(items) {\n    for (let i = 0; i < items.length; i++) {\n      processItem(items[i]);\n      // 仅在没有待处理输入时继续；有输入时主动让出\n      if (i % 100 === 0 && navigator.scheduling.isInputPending()) {\n        // 让出主线程处理用户输入\n        return setTimeout(() => processChunks(items.slice(i + 1)), 0);\n      }\n    }\n  }\n\n检查项 options：\n  isInputPending()                                  // 默认所有输入类型\n  isInputPending({ includeContinuous: true })       // continuous: pointermove / wheel / touchmove\n  isInputPending({ includeContinuous: false })      // 仅 discrete: click / mousedown / keydown\n\nvs 其他让出方式：\n  - scheduler.postTask(priority)：明示调度优先级（Chrome 94+）\n  - scheduler.yield()：高优先级让出（Chrome 129+ 实验）\n  - requestIdleCallback：浏览器空闲时才执行（低优先级）\n  - setTimeout(0)：让出但最低 4ms 延迟\n  - isInputPending：仅在有输入时让出，无输入时持续工作（更智能）' });
      return;
    }
    // 真实可用：模拟长任务循环
    const total = 1000;
    let i = 0;
    let yieldCount = 0;
    this._schedulingPendingCount = 0;
    const chunk = () => {
      const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      // 处理一批（最多 5ms）
      while (i < total && ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start < 5) {
        i++;
      }
      // 检查是否有待处理用户输入
      let pending = false;
      try {
        pending = navigator.scheduling.isInputPending({ includeContinuous: true });
      } catch { /* noop */ }
      if (pending) {
        this._schedulingPendingCount++;
        this._addLog('info', `isInputPending() → true（已检测到 ${this._schedulingPendingCount} 次），主动让出主线程`);
        yieldCount++;
      }
      if (i < total) {
        // 让出（用 setTimeout 或 scheduler.yield）
        const yielder = (typeof navigator.scheduler !== 'undefined' && typeof navigator.scheduler.yield === 'function')
          ? navigator.scheduler.yield()
          : new Promise((r) => setTimeout(r, 0));
        Promise.resolve(yielder).then(chunk);
      } else {
        this._addLog('info', `长任务完成：处理 ${total} 项，让出 ${yieldCount} 次（其中 isInputPending 触发 ${this._schedulingPendingCount} 次）`);
        this.setState({ schedulingInfo: `===== 长任务调度循环完成 =====\n\n处理项数：${total}\n让出次数：${yieldCount}\nisInputPending 触发让出：${this._schedulingPendingCount} 次\n\n说明：每次让出前调用 navigator.scheduling.isInputPending() 检查；返回 true 表示有待处理用户输入，主动让出避免卡顿；返回 false 表示无输入待处理，可继续工作（更智能 than setTimeout(0)）。` });
      }
    };
    chunk();
  }

  _pollInputPending() {
    const caps = this._caps();
    if (!caps.scheduling) {
      this._addLog('warn', 'navigator.scheduling.isInputPending 不可用，无法轮询');
      return;
    }
    const results = [];
    try {
      const r1 = navigator.scheduling.isInputPending();
      const r2 = navigator.scheduling.isInputPending({ includeContinuous: true });
      const r3 = navigator.scheduling.isInputPending({ includeContinuous: false });
      results.push(`isInputPending()                              → ${r1}`);
      results.push(`isInputPending({ includeContinuous: true })   → ${r2}（含 pointermove/touchmove/wheel）`);
      results.push(`isInputPending({ includeContinuous: false })  → ${r3}（仅 click/mousedown/keydown）`);
      this._addLog('info', `轮询 isInputPending：默认=${r1}, continuous=true=${r2}, continuous=false=${r3}`);
      this.setState({ schedulingInfo: '===== isInputPending 单次轮询 =====\n\n' + results.join('\n') + '\n\n说明：在长任务中调用此方法，true 时主动让出主线程处理用户输入，false 时可继续工作。' });
    } catch (err) {
      this._addLog('warn', 'isInputPending 调用失败：' + err.message);
    }
  }

  _renderCard5() {
    const caps = this._caps();
    const s = this.state;
    return h(Card, {
      title: 'Card 5 · navigator.scheduling.isInputPending()',
      extra: h(Tag, { color: caps.scheduling ? 'success' : 'error' }, caps.scheduling ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'navigator.scheduling.isInputPending(options) → boolean：检查主线程是否有待处理用户输入，' +
        'options.includeContinuous（默认 true）控制是否包含 continuous 类型（pointermove/touchmove/wheel）' +
        'vs discrete（click/mousedown/keydown）。长任务中检查返回 true 时主动让出，避免卡顿。' +
        'Chrome 87+ Origin Trial，vs scheduler.postTask / scheduler.yield / requestIdleCallback。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('运行长任务循环', { type: 'primary', size: 'sm', disabled: !caps.scheduling, onClick: () => this._runSchedulingLoop() }),
        this._btn('单次轮询', { type: 'default', size: 'sm', disabled: !caps.scheduling, onClick: () => this._pollInputPending() }),
      ),
      s.schedulingInfo ? h('pre', { class: 'code-block mt-md' }, s.schedulingInfo) : null,
      h('pre', { class: 'ewa-code' },
`// 长任务分块 + isInputPending 让出
function processChunks(items) {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    // 每处理 N 项检查是否有用户输入待处理
    if (i % 100 === 0 && navigator.scheduling.isInputPending()) {
      // 有待处理输入 → 主动让出主线程
      return setTimeout(() => processChunks(items.slice(i + 1)), 0);
    }
  }
}

// options
navigator.scheduling.isInputPending();                              // 默认所有输入
navigator.scheduling.isInputPending({ includeContinuous: true });   // 含 pointermove/wheel/touchmove
navigator.scheduling.isInputPending({ includeContinuous: false });  // 仅 click/mousedown/keydown

// vs 让出方式：
//   scheduler.postTask(priority) - 明示优先级调度（Chrome 94+）
//   scheduler.yield()            - 高优先级让出（Chrome 129+ 实验）
//   requestIdleCallback          - 空闲时才执行（低优先级）
//   setTimeout(0)                - 让出但最低 4ms 延迟
//   isInputPending               - 仅在有输入时让出（更智能）`),
    );
  }

  // ============ Card 6：scrollbar-color / scrollbar-width ============

  _probeScrollbarStyles() {
    const caps = this._caps();
    const c = (ok) => ok ? '✓' : '✗';
    const lines = [
      `CSS.supports('scrollbar-color', 'red blue')   : ${c(caps.scrollbarColor)}`,
      `CSS.supports('scrollbar-width', 'auto')       : ${c(caps.scrollbarWidth)}`,
      `CSS.supports('scrollbar-width', 'thin')       : ${c(caps.scrollbarWidth)}`,
      `CSS.supports('scrollbar-width', 'none')       : ${c(caps.scrollbarWidthNone)}`,
    ];
    this._addLog('info', '滚动条样式能力检测：' + lines.join('，'));
    this.setState({ scrollbarInfo: '===== scrollbar-color / scrollbar-width 能力检测 =====\n\n' + lines.join('\n') + '\n\n说明：\n  - scrollbar-color: <thumb> <track>（双色，auto 为默认）\n  - scrollbar-width: auto | thin | none（thin 为细窄样式，none 隐藏但仍可滚动）\n  - 浏览器支持：Firefox 64+ / Chrome 121+ / Safari 16.4+\n  - 替代私有 ::-webkit-scrollbar（仅 Chromium/WebKit，且不支持 width:none 后滚动）\n  - jsdom 不渲染，CSS.supports 可能不识别，仅供参考' });
  }

  _renderCard6() {
    const caps = this._caps();
    const s = this.state;
    const longText = Array.from({ length: 30 }, (_, i) => `段落 ${i + 1}：滚动条样式演示。`).join(' ');
    return h(Card, {
      title: 'Card 6 · scrollbar-color / scrollbar-width',
      extra: h(Tag, { color: caps.scrollbarWidth ? 'success' : 'error' }, caps.scrollbarWidth ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'scrollbar-color: <thumb-color> <track-color> 设置双色；scrollbar-width: auto | thin | none ' +
        '控制宽度（none 隐藏但仍可滚动）。标准化滚动条样式，替代 ::-webkit-scrollbar 私有前缀。' +
        'Firefox 64+ / Chrome 121+ / Safari 16.4+。'),
      h('div', { class: 'ewa-sb-stage' },
        h('div', {},
          h('div', { class: 'ewa-sb-box sb-color' }, longText),
          h('div', { class: 'ewa-sb-label' }, 'scrollbar-color: #1677ff #e0e7ff; scrollbar-width: thin;'),
        ),
        h('div', {},
          h('div', { class: 'ewa-sb-box sb-thin' }, longText),
          h('div', { class: 'ewa-sb-label' }, 'scrollbar-width: thin;'),
        ),
        h('div', {},
          h('div', { class: 'ewa-sb-box sb-none' }, longText),
          h('div', { class: 'ewa-sb-label' }, 'scrollbar-width: none;（隐藏但仍可滚动）'),
        ),
        h('div', {},
          h('div', { class: 'ewa-sb-box sb-auto' }, longText),
          h('div', { class: 'ewa-sb-label' }, 'scrollbar-width: auto;（默认）'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._probeScrollbarStyles() }),
      ),
      s.scrollbarInfo ? h('pre', { class: 'code-block mt-md' }, s.scrollbarInfo) : null,
      h('pre', { class: 'ewa-code' },
`/* 标准化滚动条样式 */
.custom-scroll {
  scrollbar-color: #1677ff #e0e7ff;   /* thumb track */
  scrollbar-width: thin;                /* auto | thin | none */
}

.hidden-scroll {
  scrollbar-width: none;                /* 隐藏但仍可滚动 */
}
.hidden-scroll::-webkit-scrollbar { display: none; }   /* Chromium/WebKit 兼容 */

/* vs ::-webkit-scrollbar 私有前缀 */
::-webkit-scrollbar         { width: 8px; }
::-webkit-scrollbar-thumb   { background: #1677ff; border-radius: 4px; }
::-webkit-scrollbar-track   { background: #e0e7ff; }
/* 缺点：仅 Chromium/WebKit；scrollbar-width:none 隐藏后不可滚，::-webkit-scrollbar:none 仍可滚 */`),
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
              h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'error' || log.type === 'warn' ? 'error' : 'info'}` }, log.type),
              h('span', { class: 'log-panel__content' }, log.content),
            )),
      ),
    );
  }

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, '实验/边缘 Web API 实验室'),

      h(Alert, {
        type: 'info',
        message: '实验/边缘 Web API（尚未在前序页面覆盖）',
        description: '演示 Ink API、WebXR Device API、Element.checkVisibility、setHTMLUnsafe/parseHTMLUnsafe、navigator.scheduling.isInputPending、scrollbar-color/width 等 2023-2025 实验/边缘但高价值的 Web API。所有特性调用前做 typeof/in/CSS.supports 能力检测，不支持时仅记日志，绝不抛异常。jsdom 中多数 API 不可用，演示以日志 + 代码片段形式展示真实浏览器中的预期行为。',
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
