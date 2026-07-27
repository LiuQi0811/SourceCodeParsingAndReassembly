// =====================================================================
// WebXRAdvancedPage.js —— WebXR 高级特性深度实验室
// 演示 WebXR Device API 的高级 AR/VR 能力（与 ExperimentalWebAPIsPage 的
// Card 2 WebXR 基础互补，本页专注 Hit Test / Anchors / DOM Overlays / Layers）：
//   1. AR 进阶概览 —— immersive-ar vs immersive-vr session 差异 +
//      requiredFeatures/optionalFeatures 申请 hit-test/anchors/dom-overlay/layers +
//      浏览器/设备支持矩阵
//   2. Hit Test 射线检测 —— session.requestHitTestSource({ space, entityTypes }) +
//      XRHitTestSource/XRHitTestResult + getPose() + 真实表面放置 3D 物体
//   3. Anchor 锚点 —— frame.createAnchor(pose, space) + XRAnchor 持久化 +
//      session.trackedAnchors + 删除/失效 + 大范围移动稳定性
//   4. DOM Overlays —— domOverlay: { root } + xrbubbleset + HTML 元素叠加 AR 场景 +
//      CSS 定位同步 + 与 WebGL Layer 协同
//   5. WebXR Layers 概述 —— vs XRWebGLLayer 默认基础层 +
//      QuadLayer/CylinderLayer/EquirectLayer/CubeLayer/ProjectionLayer + 性能与合成优势
//   6. 各 Layer 类型实战 —— QuadLayer 平面 UI、EquirectLayer 360°视频、
//      CylinderLayer 弧形菜单、ProjectionLayer 多视角高效合成
//   7. 实战 AR 家具摆放 —— Hit Test + Anchor + DOM Overlay 控件 + Layers 性能优化 +
//      与 Three.js WebXR 桥接
//   8. 能力检测与降级 —— features 申请失败回退 + iOS Quick Look 模型预览 +
//      8thWall/Model Viewer 替代方案 + 浏览器支持矩阵
// 说明：所有 WebXR API 调用前做 typeof/in/属性检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 无 navigator.xr，所有检测
//       返回 false，演示以日志 + 代码片段形式展示真实浏览器中的预期行为。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class WebXRAdvancedPage extends Page {
    _anchors;
    _dynamicStyles;
    _gl;
    _hitTestSource;
    _inited;
    _rafId;
    _referenceSpace;
    _xrSession;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：AR 进阶概览
            hitTestInfo: '', // Card 2：Hit Test 射线检测
            anchorInfo: '', // Card 3：Anchor 锚点
            domOverlayInfo: '', // Card 4：DOM Overlays
            layersInfo: '', // Card 5：WebXR Layers 概述
            layerTypesInfo: '', // Card 6：各 Layer 类型实战
            furnitureInfo: '', // Card 7：实战 AR 家具摆放
            fallbackInfo: '', // Card 8：能力检测与降级
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._dynamicStyles = [];
        // 实例字段（避免 rerender 重置）
        this._xrSession = null; // 当前活跃 XRSession 引用
        this._hitTestSource = null; // Card 2 XRHitTestSource 引用
        this._anchors = new Set(); // Card 3 XRAnchor 集合
        this._rafId = 0; // session.requestAnimationFrame 句柄
        this._gl = null; // WebGL context（创建 Layer 时使用）
        this._referenceSpace = null; // XRReferenceSpace 引用
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `navigator.xr ${c(f.xr)}`,
            `XRSession ${c(f.xrSession)}`,
            `XRHitTestSource ${c(f.hitTest)}`,
            `XRAnchor ${c(f.xrAnchor)}`,
            `XRDOMOverlayState ${c(f.domOverlay)}`,
            `XRLayer ${c(f.layers)}`,
        ];
        const summary = f.xr
            ? `WebXR 高级特性能力检测：${parts.join(' · ')}。当前环境支持 navigator.xr，可在 HTTPS + XR 设备/模拟器下完整体验 AR 进阶特性。`
            : `WebXR 高级特性能力检测：${parts.join(' · ')}。jsdom/Node 环境无 navigator.xr，所有按钮点击仅记日志说明，不会抛异常；真实浏览器（Chrome 79+/Edge 79+ + Android ARCore）可完整体验。`;
        this.setState({ capsSummary: summary });
        this._addLog(f.xr ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.xr)
            this._addLog('warn', 'navigator.xr 不可用（Chrome 79+ WebXR，需 HTTPS + XR 设备/模拟器）');
        if (!f.xrSession)
            this._addLog('warn', 'XRSession 接口不可用（需 navigator.xr.requestSession 返回）');
        if (!f.hitTest)
            this._addLog('warn', 'XRHitTestSource 不可用（Chrome 81+ AR，hit-test 特性）');
        if (!f.xrAnchor)
            this._addLog('warn', 'XRAnchor 接口不可用（Chrome 85+ AR，anchors 特性）');
        if (!f.domOverlay)
            this._addLog('warn', 'XRDOMOverlayState 不可用（Chrome 83+ AR，dom-overlay 特性）');
        if (!f.layers)
            this._addLog('warn', 'XRLayer 接口不可用（Chrome 90+ 桌面/91+ Android，layers 特性）');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        // 取消 RAF（优先用 session.cancelAnimationFrame，回退到全局 cancelAnimationFrame）
        if (this._rafId && typeof this._rafId === 'number') {
            try {
                if (this._xrSession && typeof this._xrSession.cancelAnimationFrame === 'function') {
                    this._xrSession.cancelAnimationFrame(this._rafId);
                }
                else {
                    cancelAnimationFrame(this._rafId);
                }
            }
            catch { /* noop */ }
        }
        this._rafId = 0;
        // 结束 XR session（真实环境需 await session.end()）
        if (this._xrSession && typeof this._xrSession.end === 'function') {
            try {
                this._xrSession.end();
            }
            catch { /* noop */ }
        }
        this._xrSession = null;
        this._hitTestSource = null;
        this._referenceSpace = null;
        this._gl = null;
        try {
            this._anchors.clear();
        }
        catch { /* noop */ }
        // 移除动态样式
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    // —— 辅助方法 ——
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    _injectStyle(id, css) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    _flags() {
        const safe = (fn) => {
            try {
                return fn();
            }
            catch {
                return false;
            }
        };
        return {
            xr: safe(() => typeof navigator !== 'undefined' && !!navigator.xr && typeof navigator.xr.isSessionSupported === 'function'),
            xrSession: safe(() => typeof XRSession !== 'undefined'),
            hitTest: safe(() => typeof XRHitTestSource !== 'undefined'),
            hitTestResult: safe(() => typeof XRHitTestResult !== 'undefined'),
            xrAnchor: safe(() => typeof XRAnchor !== 'undefined'),
            domOverlay: safe(() => typeof XRDOMOverlayState !== 'undefined'),
            layers: safe(() => typeof XRLayer !== 'undefined'),
            quadLayer: safe(() => typeof XRQuadLayer !== 'undefined'),
            cylinderLayer: safe(() => typeof XRCylinderLayer !== 'undefined'),
            equirectLayer: safe(() => typeof XREquirectLayer !== 'undefined'),
            cubeLayer: safe(() => typeof XRCubeLayer !== 'undefined'),
            projectionLayer: safe(() => typeof XRProjectionLayer !== 'undefined'),
            webglLayer: safe(() => typeof XRWebGLLayer !== 'undefined'),
        };
    }
    _injectBaseStyles() {
        this._injectStyle('webxr-advanced-base', `
      .webxr-demo {
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .webxr-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .webxr-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .webxr-matrix-cell .webxr-mx-name { font-weight: 600; color: #1e40af; }
      .webxr-matrix-cell .webxr-mx-val { font-family: monospace; color: #475569; margin-top: 2px; }
      .webxr-feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .webxr-feature-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px;
        font-size: 12px;
      }
      .webxr-feature-cell .webxr-feature-name { font-weight: 600; color: #1e40af; }
      .webxr-feature-cell .webxr-feature-status { font-family: monospace; margin-top: 4px; color: #0f766e; }
      .webxr-overlay-preview {
        position: relative;
        width: 100%;
        height: 200px;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        border-radius: 8px;
        margin-top: 10px;
        overflow: hidden;
      }
      .webxr-overlay-preview .webxr-overlay-elt {
        position: absolute;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        color: #1e293b;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      .webxr-overlay-preview .webxr-overlay-elt.btn-top { top: 12px; left: 12px; }
      .webxr-overlay-preview .webxr-overlay-elt.btn-bottom { bottom: 12px; left: 50%; transform: translateX(-50%); }
      .webxr-overlay-preview .webxr-overlay-elt.btn-right { top: 50%; right: 12px; transform: translateY(-50%); }
      .webxr-overlay-preview .webxr-overlay-hint {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        color: #94a3b8; font-size: 11px; font-family: monospace;
      }
      .webxr-layer-stack {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
      }
      .webxr-layer-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 12px;
      }
      .webxr-layer-row .webxr-layer-name { min-width: 130px; color: #1e40af; font-weight: 600; }
      .webxr-layer-row .webxr-layer-desc { color: #475569; flex: 1; }
      .webxr-furniture-stage {
        display: grid;
        grid-template-columns: 1fr 180px;
        gap: 10px;
        margin-top: 10px;
      }
      @media (max-width: 640px) {
        .webxr-furniture-stage { grid-template-columns: 1fr; }
      }
      .webxr-furniture-canvas {
        height: 220px;
        background: linear-gradient(135deg, #fef3c7, #fed7aa);
        border-radius: 8px;
        position: relative;
        overflow: hidden;
        border: 1px solid #cbd5e1;
      }
      .webxr-furniture-canvas .webxr-furniture-item {
        position: absolute;
        font-size: 28px;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
        cursor: move;
      }
      .webxr-furniture-controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .webxr-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        max-height: 460px;
        overflow: auto;
        line-height: 1.6;
      }
      .webxr-output.webxr-output--empty { color: #94a3b8; }
    `);
    }
    // ===================== Card 1：AR 进阶概览 =====================
    _runOverviewDemo() {
        const f = this._flags();
        this._injectStyle('webxr-overview-demo', `
      .webxr-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        // 真实浏览器：异步检测 immersive-ar 支持
        if (f.xr && typeof navigator.xr.isSessionSupported === 'function') {
            this._addLog('info', '正在异步检测 immersive-ar / immersive-vr 支持...');
            Promise.all([
                navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
                navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
            ]).then(([ar, vr]) => {
                this._addLog('info', `异步检测结果：immersive-ar=${ar}，immersive-vr=${vr}`);
                this.setState({ overviewInfo: this._buildOverviewInfo(f, { ar, vr }) });
            });
        }
        else {
            this._addLog('warn', 'navigator.xr 不可用，跳过异步 isSessionSupported 检测（jsdom 无 WebXR）');
            this.setState({ overviewInfo: this._buildOverviewInfo(f, { ar: false, vr: false }) });
        }
    }
    _buildOverviewInfo(f, support) {
        return [
            '===== WebXR AR 进阶概览 =====',
            '',
            '【immersive-ar vs immersive-vr session 差异】',
            '  // 两种沉浸模式的核心差异',
            "  // immersive-vr：完全虚拟环境，不透传现实",
            "  //   - 头显完全遮挡视野，渲染纯虚拟世界",
            "  //   - 参考空间：local / local-floor / bounded-floor",
            "  //   - 无 hit-test / anchors / dom-overlay（现实不存在）",
            "  //   - 适合 VR 游戏、虚拟展厅、360° 影院",
            '',
            "  // immersive-ar：透传现实 + 虚拟叠加（AR）",
            "  //   - 通过摄像头透传现实画面，渲染虚拟物体叠加",
            "  //   - 参考空间：local / local-floor / viewer",
            "  //   - 支持 hit-test / anchors / dom-overlay / layers",
            "  //   - 适合 AR 家具摆放、测量、导航、试妆",
            '',
            "  // inline：非沉浸，嵌入网页（无头显），可选 features",
            "  const session = await navigator.xr.requestSession('inline');",
            '',
            '【features 申请（requiredFeatures / optionalFeatures）】',
            '  const session = await navigator.xr.requestSession(\'immersive-ar\', {',
            "    requiredFeatures: ['local-floor', 'hit-test', 'anchors'],",
            "    optionalFeatures: ['dom-overlay', 'layers', 'plane-detection', 'light-estimation'],",
            "    domOverlay: { root: document.querySelector('#ar-overlay-ui') },",
            '  });',
            '',
            '  // requiredFeatures 任一不可用 → requestSession 抛 NotSupportedError',
            '  // optionalFeatures 不可用 → 静默忽略，session 仍创建',
            '  // 检测特性可用性（异步）：',
            "  const arOK = await navigator.xr.isSessionSupported('immersive-ar');",
            '',
            '【AR 进阶 features 说明】',
            '  hit-test         射线检测真实表面，返回 XRHitTestResult[]',
            '  anchors          创建持久锚点 XRAnchor，抵抗漂移',
            '  dom-overlay      HTML 元素叠加在 AR 场景之上（仅 AR）',
            '  layers           多层合成（Quad/Cylinder/Equirect/Cube/Projection）',
            '  plane-detection  检测真实平面（地面/墙面/桌面），返回 XRPlane',
            '  mesh-detection   检测真实网格几何（场景重建）',
            '  light-estimation 估计环境光，照亮虚拟物体',
            '  image-tracking   跟踪预定义图像标记',
            '',
            '【浏览器/设备支持矩阵】',
            '  浏览器/设备          immersive-ar   hit-test   anchors   dom-overlay   layers',
            '  Chrome Android+ARCore ✓ 81+         ✓ 81+      ✓ 85+     ✓ 83+         ✓ 91+',
            '  Edge Android+ARCore   ✓ 81+         ✓ 81+      ✓ 85+     ✓ 83+         ✓ 91+',
            '  Samsung Internet      ✓ 13+         ✓ 13+      ✓ 15+     ✓ 13+         ✓ 14+',
            '  Chrome 桌面（无 XR）  ✗             ✗          ✗         ✗             ✓ 90+(VR)',
            '  Firefox Reality       ✗             ✗          ✗         ✗             部分',
            '  Safari iOS            ✗（用 Quick Look/AR Quick Look）',
            '  WebXR Emulator        ✓ 模拟        ✓ 模拟     ✓ 模拟    ✓ 模拟        ✓ 模拟',
            '',
            '【实际能力检测演示（当前环境）】',
            `  navigator.xr:           ${f.xr ? '✓' : '✗'}`,
            `  XRSession:              ${f.xrSession ? '✓' : '✗'}`,
            `  XRHitTestSource:        ${f.hitTest ? '✓' : '✗'}`,
            `  XRAnchor:               ${f.xrAnchor ? '✓' : '✗'}`,
            `  XRDOMOverlayState:      ${f.domOverlay ? '✓' : '✗'}`,
            `  XRLayer:                ${f.layers ? '✓' : '✗'}`,
            `  isSessionSupported('immersive-ar'): ${support.ar ? '✓' : '✗（异步检测）'}`,
            `  isSessionSupported('immersive-vr'): ${support.vr ? '✓' : '✗（异步检测）'}`,
            '',
            '【常见陷阱】',
            '  1. requiredFeatures 申请失败会直接 reject，不会回退；用 optionalFeatures 容错',
            '  2. dom-overlay 必须同时传 domOverlay: { root }，否则忽略',
            '  3. iOS Safari 不支持 WebXR immersive-ar，需降级 Quick Look',
            '  4. 桌面 Chrome 无 ARCore，immersive-ar 不可用（可用 WebXR Emulator 扩展）',
            '  5. layers 在某些移动 GPU 上可能性能更差，需实测',
        ].join('\n');
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. AR 进阶概览 —— immersive-ar vs immersive-vr + features 申请 + 支持矩阵',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['navigator.xr', f.xr],
                ['immersive-ar', f.xr],
            ]), h(Tag, { color: 'primary' }, '概览')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'immersive-ar 透传现实 + 虚拟叠加，支持 hit-test/anchors/dom-overlay/layers；immersive-vr 纯虚拟环境，无 AR 特性。requestSession 时通过 requiredFeatures（必需，失败即 reject）与 optionalFeatures（可选，失败静默忽略）申请特性。dom-overlay 必须同时传 domOverlay: { root }。用 navigator.xr.isSessionSupported(mode) 异步检测模式支持。Chrome 81+ Android + ARCore 支持 AR，iOS Safari 不支持需降级 Quick Look。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 AR 进阶概览演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 申请 AR session，同时申请 hit-test / anchors / dom-overlay / layers
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['local-floor', 'hit-test', 'anchors'],
  optionalFeatures: ['dom-overlay', 'layers', 'plane-detection', 'light-estimation'],
  domOverlay: { root: document.querySelector('#ar-overlay-ui') },
});

// 异步检测模式支持（不创建 session）
const arOK = await navigator.xr.isSessionSupported('immersive-ar');
const vrOK = await navigator.xr.isSessionSupported('immersive-vr');
console.log('AR supported:', arOK, 'VR supported:', vrOK);

// requiredFeatures 任一不可用 → NotSupportedError
try {
  const s = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'non-existent-feature'],
  });
} catch (err: any) {
  // NotSupportedError: Required feature 'non-existent-feature' not supported
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击按钮查看 AR 进阶概览与支持矩阵）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：Hit Test 射线检测 =====================
    _runHitTestDemo() {
        const f = this._flags();
        this._injectStyle('webxr-hittest-demo', `
      .webxr-hittest-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.xr) {
            this._addLog('warn', 'navigator.xr 不可用，跳过真实 Hit Test（jsdom 无 WebXR）');
            this.setState({ hitTestInfo: this._buildHitTestInfo(f, false) });
            return;
        }
        // 真实环境：尝试创建 AR session 并 requestHitTestSource
        this._addLog('info', '尝试创建 immersive-ar session 并申请 hit-test 源...');
        try {
            navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.body },
            }).then(async (session) => {
                this._xrSession = session;
                this._addLog('info', 'XRSession 已创建（immersive-ar + hit-test）');
                const refSpace = await session.requestReferenceSpace('local-floor');
                this._referenceSpace = refSpace;
                const hitTestSource = await session.requestHitTestSource({
                    space: refSpace,
                    entityTypes: ['plane', 'point'],
                });
                this._hitTestSource = hitTestSource;
                this._addLog('info', 'XRHitTestSource 已创建，启动 RAF 循环获取 hit results');
                this._startHitTestLoop();
                this.setState({ hitTestInfo: this._buildHitTestInfo(f, true) });
            }).catch((err) => {
                this._addLog('warn', 'requestSession/requestHitTestSource 失败：' + (err && err.message));
                this.setState({ hitTestInfo: this._buildHitTestInfo(f, false) });
            });
        }
        catch (err) {
            this._addLog('warn', 'Hit Test 初始化异常：' + (err && err.message));
            this.setState({ hitTestInfo: this._buildHitTestInfo(f, false) });
        }
    }
    _startHitTestLoop() {
        const session = this._xrSession;
        if (!session || typeof session.requestAnimationFrame !== 'function')
            return;
        const onFrame = (time, frame) => {
            try {
                if (this._hitTestSource && typeof frame.getHitTestResults === 'function') {
                    const hits = frame.getHitTestResults(this._hitTestSource);
                    if (hits.length > 0) {
                        const pose = hits[0].getPose(this._referenceSpace);
                        if (pose) {
                            this._addLog('info', `命中 ${hits.length} 处，首点 transform: (${pose.transform.position.x.toFixed(2)}, ${pose.transform.position.y.toFixed(2)}, ${pose.transform.position.z.toFixed(2)})`);
                        }
                    }
                }
            }
            catch { /* noop */ }
            this._rafId = session.requestAnimationFrame(onFrame);
        };
        this._rafId = session.requestAnimationFrame(onFrame);
    }
    _buildHitTestInfo(f, started) {
        return [
            '===== Hit Test 射线检测 =====',
            '',
            '【session.requestHitTestSource({ space, entityTypes })】',
            '  // 创建持久 hit-test 源（每帧复用，避免重复创建）',
            '  const hitTestSource = await session.requestHitTestSource({',
            "    space: referenceSpace,        // XRReferenceSpace 或 XRBoundedReferenceSpace",
            "    entityTypes: ['plane', 'point'], // 可选：检测的实体类型",
            '  });',
            '',
            '  // entityTypes 可选值（Chrome 实现仅 plane）：',
            '  //   "plane"  检测真实平面（地面/墙面）—— 主流',
            '  //   "point"  检测特征点云',
            '  //   "mesh"   检测重建网格（需 mesh-detection feature）',
            '',
            '【瞬时 hit-test：requestHitTestSourceForTransientInput】',
            '  // 用于屏幕点击：每次点击创建瞬时输入源',
            '  const transientSource = await session.requestHitTestSourceForTransientInput({',
            "    profile: 'generic-touch-screen',",
            '    space: referenceSpace,',
            '  });',
            '  // 在 frame 中：',
            '  const transientResults = frame.getHitTestResultsForTransientInput(transientSource);',
            '  for (const inputResult of transientResults) {',
            '    const hits = inputResult.results; // 该输入的命中结果',
            '    if (hits.length > 0) { /* 放置物体 */ }',
            '  }',
            '',
            '【XRHitTestSource / XRHitTestResult】',
            '  // XRHitTestSource：持久源，cancel() 释放',
            '  hitTestSource.cancel();  // 不再需要时释放',
            '',
            '  // XRHitTestResult：单次命中，getPose() 获取位姿',
            '  const hits = frame.getHitTestResults(hitTestSource);',
            '  if (hits.length > 0) {',
            '    const pose = hits[0].getPose(referenceSpace);',
            '    // pose.transform.position / orientation（XRRigidTransform）',
            '    // pose.emulatedPosition: true 表示位姿为推算（非真实）',
            '  }',
            '',
            '【在真实表面放置 3D 物体】',
            '  function onFrame(time, frame) {',
            '    const hits = frame.getHitTestResults(hitTestSource);',
            '    if (hits.length > 0) {',
            '      const pose = hits[0].getPose(referenceSpace);',
            '      if (pose) {',
            '        // 将虚拟物体矩阵设为 pose.transform.matrix',
            '        object.matrix.fromArray(pose.transform.matrix);',
            '        object.matrix.decompose(object.position, object.quaternion, object.scale);',
            '        object.visible = true;',
            '      }',
            '    }',
            '    session.requestAnimationFrame(onFrame);',
            '  }',
            '',
            '【屏幕点击放置（transient input）】',
            '  session.addEventListener($1, (event: any) => {',
            '    const results = frame.getHitTestResultsForTransientInput(transientSource);',
            '    if (results.length > 0 && results[0].results.length > 0) {',
            '      const pose = results[0].results[0].getPose(referenceSpace);',
            '      placeObjectAt(pose.transform);',
            '    }',
            '  });',
            '',
            '【实际能力检测演示（当前环境）】',
            `  navigator.xr:        ${f.xr ? '✓' : '✗'}`,
            `  XRHitTestSource:     ${f.hitTest ? '✓' : '✗'}`,
            `  XRHitTestResult:     ${f.hitTestResult ? '✓' : '✗'}`,
            `  Hit Test 演示已启动:  ${started ? '✓（RAF 循环中）' : '✗（jsdom 无 WebXR）'}`,
            '',
            '【常见陷阱】',
            '  1. requestHitTestSource 返回 Promise，需 await；不可同步使用',
            '  2. hitTestSource 必须在 session.end() 前 cancel()，否则泄漏',
            '  3. entityTypes 在 Chrome 实现中仅 plane 生效，传 point 被忽略',
            '  4. getPose 可能返回 null（追踪丢失），需判空',
            '  5. emulatedPosition=true 时位姿为推算，精度低，UI 应提示用户',
        ].join('\n');
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. Hit Test 射线检测 —— requestHitTestSource + 真实表面放置',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['XRHitTestSource', f.hitTest],
                ['XRHitTestResult', f.hitTestResult],
            ]), h(Tag, { color: 'primary' }, 'AR 核心')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'session.requestHitTestSource({ space, entityTypes }) 创建持久射线源，每帧 frame.getHitTestResults(source) 返回 XRHitTestResult[]，调用 hits[0].getPose(referenceSpace) 获取 XRRigidTransform 位姿，将虚拟物体矩阵设为 pose.transform.matrix 即可在真实表面放置。屏幕点击放置用 requestHitTestSourceForTransientInput({ profile, space }) + select 事件。Chrome 实现仅 entityTypes: plane 生效。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 Hit Test 演示', { type: 'primary', size: 'sm', onClick: () => this._runHitTestDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 创建持久 hit-test 源
const hitTestSource = await session.requestHitTestSource({
  space: referenceSpace,
  entityTypes: ['plane', 'point'],
});

// 在 frame 循环中获取命中结果
function onFrame(time: any,  frame: any) {
  const hits = frame.getHitTestResults(hitTestSource);
  if (hits.length > 0) {
    const pose = hits[0].getPose(referenceSpace);
    if (pose) {
      // 真实表面放置 3D 物体
      object.matrix.fromArray(pose.transform.matrix);
      object.matrix.decompose(object.position, object.quaternion, object.scale);
      object.visible = true;
    }
  }
  session.requestAnimationFrame(onFrame);
}

// 屏幕点击放置（transient input）
const transientSource = await session.requestHitTestSourceForTransientInput({
  profile: 'generic-touch-screen',
  space: referenceSpace,
});
session.addEventListener('select', () => {
  const results = frame.getHitTestResultsForTransientInput(transientSource);
  if (results[0]?.results[0]) {
    const pose = results[0].results[0].getPose(referenceSpace);
    placeObjectAt(pose.transform);
  }
});

// 释放：session.end() 前 cancel
hitTestSource.cancel();`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.hitTestInfo || '（点击按钮查看 Hit Test 射线检测完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：Anchor 锚点 =====================
    _runAnchorDemo() {
        const f = this._flags();
        this._injectStyle('webxr-anchor-demo', `
      .webxr-anchor-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.xr || !f.xrAnchor) {
            this._addLog('warn', 'navigator.xr / XRAnchor 不可用，跳过真实 Anchor 演示（jsdom 无 WebXR）');
            this.setState({ anchorInfo: this._buildAnchorInfo(f, false) });
            return;
        }
        this._addLog('warn', '当前环境检测到 XRAnchor 接口，但 jsdom 无法真实创建 session，仅展示说明');
        this.setState({ anchorInfo: this._buildAnchorInfo(f, false) });
    }
    _buildAnchorInfo(f, created) {
        return [
            '===== Anchor 锚点 =====',
            '',
            '【frame.createAnchor(pose, space)】',
            '  // 在指定位姿创建锚点，返回 Promise<XRAnchor>',
            '  // pose: XRRigidTransform（位置 + 朝向）',
            '  // space: XRReferenceSpace 或 XRSpace（hit-test 的 pose 用的 space）',
            '  const anchor = await frame.createAnchor(pose, referenceSpace);',
            '',
            '  // 典型流程：hit-test 命中后创建锚点固定物体',
            '  const hits = frame.getHitTestResults(hitTestSource);',
            '  if (hits.length > 0) {',
            '    const pose = hits[0].getPose(referenceSpace);',
            '    if (pose) {',
            '      const anchor = await frame.createAnchor(pose.transform, referenceSpace);',
            '      anchors.add(anchor);  // 持久保存',
            '      object.matrixAutoUpdate = false;',
            '      object.userData.anchor = anchor;  // 关联',
            '    }',
            '  }',
            '',
            '【XRAnchor 持久化与追踪】',
            '  // XRAnchor 在 session 生命周期内持久存在',
            '  // 每帧通过 frame.trackedAnchors 获取当前有效的锚点集合',
            '  for (const anchor of frame.trackedAnchors) {',
            '    const pose = anchor.getSpace(refSpace) ? frame.getPose(anchor.getSpace(refSpace), refSpace) : null;',
            '    if (pose) {',
            '      // 更新关联物体的矩阵',
            '      obj.matrix.fromArray(pose.transform.matrix);',
            '    } else {',
            '      // 锚点失效（追踪丢失），删除物体',
            '      scene.remove(obj);',
            '    }',
            '  }',
            '',
            '【session.trackedAnchors（XRAnchorSet）】',
            '  // frame.trackedAnchors 是当前帧仍有效的 XRAnchor 集合',
            '  // 失效的锚点不会出现 → 用作删除判定',
            '  const trackedSet = frame.trackedAnchors;  // XRAnchorSet',
            '  for (const anchor of myAnchors) {',
            '    if (!trackedSet.has(anchor)) {',
            '      // 锚点已失效，清理',
            '      myAnchors.delete(anchor);',
            '      removeObject(anchor.userData.obj);',
            '    }',
            '  }',
            '',
            '【删除 / 失效处理】',
            '  // 主动删除：anchor.delete()（规范定义，部分浏览器实现为垃圾回收）',
            '  await anchor.delete();',
            '  myAnchors.delete(anchor);',
            '',
            '  // 被动失效：ARCore/ARKit 追踪丢失时自动失效',
            '  // 表现：frame.trackedAnchors 不再包含该 anchor',
            '  // 应监听并清理关联资源（3D 物体、纹理）',
            '',
            '【大范围移动稳定性】',
            '  // Hit-test 直接放置：物体随参考空间漂移（local-floor 漂移明显）',
            '  // Anchor 锚定：物体固定在真实世界坐标，移动后仍稳定',
            '  //',
            '  // 场景：用户走动 5 米后回头看物体',
            '  //   hit-test 放置：物体位置漂移 10-50cm（漂移累积）',
            '  //   anchor 锚定：物体位置稳定 < 5cm（ARCore 持续修正）',
            '  //',
            '  // 性能：anchor 比 hit-test 多一次 createAnchor 调用，但追踪开销低',
            '  // 建议：放置物体后立即创建 anchor，hit-test 仅用于初次定位',
            '',
            '【实际能力检测演示（当前环境）】',
            `  navigator.xr:  ${f.xr ? '✓' : '✗'}`,
            `  XRAnchor:      ${f.xrAnchor ? '✓' : '✗'}`,
            `  Anchor 已创建: ${created ? '✓' : '✗（jsdom 无 WebXR）'}`,
            '',
            '【常见陷阱】',
            '  1. createAnchor 是 Promise，需在 frame 回调内 await',
            '  2. anchor.delete() 在部分浏览器未实现，依赖 trackedAnchors 判定失效',
            '  3. 锚点数量过多（>30）可能影响追踪精度，需池化复用',
            '  4. session.end() 后所有 anchor 失效，不可跨 session 持久化',
            '  5. anchors feature 必须在 requiredFeatures 申请，否则 createAnchor 抛异常',
        ].join('\n');
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. Anchor 锚点 —— createAnchor + trackedAnchors + 持久化追踪',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['XRAnchor', f.xrAnchor],
            ]), h(Tag, { color: 'primary' }, '稳定性')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'frame.createAnchor(pose, space) 在真实世界坐标创建 XRAnchor 持久锚点，session 生命周期内 frame.trackedAnchors 返回当前有效的锚点集合（XRAnchorSet）。每帧用 anchor.getSpace() + frame.getPose() 更新关联物体矩阵。锚点失效时不再出现在 trackedAnchors，据此清理物体。Anchor 比 hit-test 直接放置更稳定，大范围移动漂移 < 5cm。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 Anchor 演示', { type: 'primary', size: 'sm', onClick: () => this._runAnchorDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// hit-test 命中后创建锚点固定物体
const hits = frame.getHitTestResults(hitTestSource);
if (hits.length > 0) {
  const pose = hits[0].getPose(referenceSpace);
  if (pose) {
    const anchor = await frame.createAnchor(pose.transform, referenceSpace);
    anchors.add(anchor);
    obj.userData.anchor = anchor;
  }
}

// 每帧通过 trackedAnchors 更新 + 清理失效锚点
const trackedSet = frame.trackedAnchors;  // XRAnchorSet
for (const anchor of anchors) {
  if (!trackedSet.has(anchor)) {
    // 锚点已失效，清理关联物体
    scene.remove(anchor.userData.obj);
    anchors.delete(anchor);
    continue;
  }
  const space = anchor.anchorSpace;
  const pose = frame.getPose(space, referenceSpace);
  if (pose) {
    obj.matrix.fromArray(pose.transform.matrix);
  }
}

// 主动删除
await anchor.delete();
anchors.delete(anchor);`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.anchorInfo || '（点击按钮查看 Anchor 锚点完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：DOM Overlays =====================
    _runDomOverlayDemo() {
        const f = this._flags();
        this._injectStyle('webxr-dom-overlay-demo', `
      .webxr-dom-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.xr) {
            this._addLog('warn', 'navigator.xr 不可用，跳过真实 DOM Overlay 演示（jsdom 无 WebXR）');
            this.setState({ domOverlayInfo: this._buildDomOverlayInfo(f, false) });
            return;
        }
        this._addLog('warn', '当前环境支持 navigator.xr，但 DOM Overlay 需真实 AR session，仅展示说明');
        this.setState({ domOverlayInfo: this._buildDomOverlayInfo(f, true) });
    }
    _buildDomOverlayInfo(f, supported) {
        return [
            '===== DOM Overlays =====',
            '',
            '【domOverlay: { root } 申请】',
            '  // 在 requestSession 时传入 domOverlay 配置',
            '  const session = await navigator.xr.requestSession(\'immersive-ar\', {',
            "    requiredFeatures: ['hit-test', 'anchors'],",
            "    optionalFeatures: ['dom-overlay'],",
            '    domOverlay: { root: document.querySelector(\'#ar-overlay-ui\') },',
            '  });',
            '',
            '  // root 指定的 DOM 子树会作为 HTML 层叠加在 AR 场景之上',
            '  // 该子树内的元素始终可见（不被 WebGL canvas 遮挡）',
            '  // 仅 AR 模式支持，VR 模式不支持（VR 无现实参照）',
            '',
            '【XRDOMOverlayState 状态查询】',
            '  // 查询当前 DOM overlay 状态',
            '  const state = session.domOverlayState;  // XRDOMOverlayState | null',
            '  if (state) {',
            '    console.log(state.type);  // "screen"（屏幕固定）',
            '  }',
            '  // type 只有 "screen"：overlay 钉在屏幕，不随头部转动',
            '',
            '【HTML 元素叠加 AR 场景】',
            '  <!-- HTML 结构 -->',
            '  <div id="ar-overlay-ui" style="position:absolute;inset:0;pointer-events:none;">',
            '    <div class="ar-hud-top">已放置 3 件家具</div>',
            '    <button class="ar-btn-place">放置</button>',
            '    <button class="ar-btn-clear">清空</button>',
            '  </div>',
            '',
            '  // pointer-events 控制：',
            '  //   overlay 容器 pointer-events: none（不拦截 AR 交互）',
            '  //   可点击元素 pointer-events: auto（按钮可点）',
            '',
            '【CSS 定位同步】',
            '  // DOM overlay 是屏幕空间固定层，无需手动同步 3D→2D',
            '  // 但若要让 HTML 元素"跟随"3D 物体，需手动投影：',
            '  function projectToScreen(worldPos, frame, refSpace) {',
            '    const pose = frame.getPose(worldPos, refSpace);',
            '    // 通过 XRWebGLLayer 的 viewport + 相机矩阵投影到 NDC',
            '    // 再映射到 CSS 像素坐标',
            '    const ndc = worldToNDC(pose.transform.position, camera);',
            '    const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;',
            '    const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;',
            '    labelEl.style.transform = `translate(${x}px, ${y}px)`;',
            '  }',
            '',
            '【与 WebGL Layer 协同】',
            '  // DOM overlay 渲染在 WebGL canvas 之上的合成层',
            '  // 浏览器保证 DOM overlay 始终可见，无需 z-index 战争',
            '  // 性能：DOM overlay 走浏览器合成器，不占 WebGL 绘制预算',
            '  // 适合：HUD、按钮、文字标签（避免用 WebGL 渲染文字）',
            '  // 不适合：跟随 3D 物体的高频动画（每帧投影开销）',
            '',
            '【xrbubbleset（实验性）】',
            '  // 部分浏览器实现 xrbubbleset：限定 DOM overlay 可交互区域',
            '  // 类似 "气泡"：在 AR 场景中圈定一块 DOM 可交互区域',
            '  // 规范尚在演进，Chrome 暂未稳定支持',
            '',
            '【实际能力检测演示（当前环境）】',
            `  navigator.xr:         ${f.xr ? '✓' : '✗'}`,
            `  XRDOMOverlayState:   ${f.domOverlay ? '✓' : '✗'}`,
            `  DOM Overlay 演示:    ${supported ? '✓（接口可用，需真实 session）' : '✗（jsdom 无 WebXR）'}`,
            '',
            '【常见陷阱】',
            '  1. domOverlay.root 必须是 DOM 元素，传 null 会忽略 overlay',
            '  2. overlay 容器 pointer-events: none，否则拦截 AR select 事件',
            '  3. DOM overlay 仅 screen 类型（屏幕固定），无 "floating" 跟随头部',
            '  4. iOS Safari 不支持 dom-overlay，HTML 元素不会显示',
            '  5. overlay 内的 input/video 等控件可正常交互，但性能敏感场景慎用',
        ].join('\n');
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. DOM Overlays —— HTML 元素叠加 AR 场景 + CSS 同步',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['XRDOMOverlayState', f.domOverlay],
            ]), h(Tag, { color: 'primary' }, 'UI 叠加')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'requestSession 时传 domOverlay: { root } 指定 DOM 子树作为 HTML 层叠加在 AR 场景之上（仅 AR 模式）。session.domOverlayState.type 仅 "screen"（屏幕固定）。容器 pointer-events: none 不拦截 AR 交互，按钮设 auto 可点。DOM overlay 走浏览器合成器不占 WebGL 预算，适合 HUD/按钮/文字标签。跟随 3D 物体需手动 worldToNDC 投影同步 CSS transform。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 DOM Overlay 演示', { type: 'primary', size: 'sm', onClick: () => this._runDomOverlayDemo() })),
                h('div', { class: 'webxr-overlay-preview' }, h('div', { class: 'webxr-overlay-elt btn-top' }, '🏠 已放置 3 件家具'), h('div', { class: 'webxr-overlay-elt btn-right' }, '⚙️ 设置'), h('div', { class: 'webxr-overlay-elt btn-bottom' }, '👆 点击地面放置物体'), h('div', { class: 'webxr-overlay-hint' }, 'DOM Overlay 预览（屏幕固定层）')),
                h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 申请 AR session 带 DOM overlay
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['hit-test', 'anchors'],
  optionalFeatures: ['dom-overlay'],
  domOverlay: { root: document.querySelector('#ar-overlay-ui') },
});

// 查询 overlay 状态
const state = session.domOverlayState;  // XRDOMOverlayState
console.log(state.type);  // "screen"

<!-- HTML: overlay 容器 pointer-events:none，按钮 auto -->
<div id="ar-overlay-ui" style="position:absolute;inset:0;pointer-events:none;">
  <div class="ar-hud">已放置 3 件家具</div>
  <button style="pointer-events:auto;" onclick="place()">放置</button>
</div>

// 跟随 3D 物体的标签：手动投影同步 CSS transform
function projectToScreen(worldPos: any,  frame: any,  refSpace: any) {
  const pose = frame.getPose(worldPos, refSpace);
  const ndc = worldToNDC(pose.transform.position, camera);
  labelEl.style.transform =
    \`translate(\${(ndc.x*0.5+0.5)*innerWidth}px, \${(-ndc.y*0.5+0.5)*innerHeight}px)\`;
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.domOverlayInfo || '（点击按钮查看 DOM Overlays 完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：WebXR Layers 概述 =====================
    _runLayersDemo() {
        const f = this._flags();
        this._injectStyle('webxr-layers-demo', `
      .webxr-layers-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.xr) {
            this._addLog('warn', 'navigator.xr 不可用，跳过真实 Layers 演示（jsdom 无 WebXR）');
            this.setState({ layersInfo: this._buildLayersInfo(f, false) });
            return;
        }
        this._addLog('warn', '当前环境支持 navigator.xr，但 Layers 需真实 session + WebGL，仅展示说明');
        this.setState({ layersInfo: this._buildLayersInfo(f, true) });
    }
    _buildLayersInfo(f, supported) {
        return [
            '===== WebXR Layers 概述 =====',
            '',
            '【默认基础层：XRWebGLLayer】',
            '  // 传统 WebXR：单一 XRWebGLLayer 作为渲染目标',
            '  const gl = canvas.getContext(\'webgl2\', { xrCompatible: true });',
            '  const glLayer = new XRWebGLLayer(session, gl);',
            '  session.updateRenderState({ baseLayer: glLayer });',
            '',
            '  // 每帧渲染：',
            '  const pose = frame.getViewerPose(refSpace);',
            '  for (const view of pose.views) {',
            '    const viewport = glLayer.getViewport(view);',
            '    gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);',
            '    renderScene(view);  // 所有内容画到同一个 framebuffer',
            '  }',
            '',
            '  // 问题：所有内容（背景天空盒 + UI + 3D 物体）混在一个 framebuffer，',
            '  // 重新绘制开销大，无合成优化，移动 GPU 尤其吃力。',
            '',
            '【WebXR Layers：多层合成】',
            '  // session.updateRenderState({ layers: [...] }) 替代 baseLayer',
            '  // 每层独立 framebuffer，由浏览器合成器高效合成',
            '  const layers = [',
            '    projectionLayer,  // 主 3D 场景（每只眼独立）',
            '    quadLayer,         // 平面 UI（如菜单）',
            '    equirectLayer,     // 360° 背景视频',
            '  ];',
            '  session.updateRenderState({ layers });',
            '',
            '【五种 Layer 类型】',
            '  1. ProjectionLayer  投影层：主 3D 场景，每只眼独立 view，最常用',
            '     - new XRProjectionLayer(session, gl, { textureType, colorFormat, depthFormat })',
            '     - 替代 XRWebGLLayer 作为主渲染目标',
            '     - 支持纹理数组（textureType: "texture-array"）提升立体渲染效率',
            '',
            '  2. QuadLayer        四边形层：平面 2D 内容（UI、图片、视频贴图）',
            '     - new XRQuadLayer(session, gl, {',
            '         space, transform, width, height,  // 在 3D 空间中的位置/尺寸',
            '         textureType, colorFormat, mipLevels, viewPixelWidth, viewPixelHeight,',
            '       })',
            '     - 在 3D 空间中放置一块平面，渲染 2D 内容',
            '',
            '  3. CylinderLayer    圆柱层：弧形内容（环幕菜单、弧形 UI）',
            '     - new XRCylinderLayer(session, gl, {',
            '         space, transform, radius, centralAngleLength, aspectRatio,',
            '         viewPixelWidth, viewPixelHeight, ...',
            '       })',
            '     - 内容贴在圆柱内壁，适合环绕 HUD',
            '',
            '  4. EquirectLayer    等距柱状层：360° 全景（背景视频、天空盒）',
            '     - new XREquirectLayer(session, gl, {',
            '         space, transform, radius, centralHorizontalAngle, ...',
            '         viewPixelWidth, viewPixelHeight, ...',
            '       })',
            '     - 球面投影，适合 360° 视频背景',
            '',
            '  5. CubeLayer        立方体贴图层：6 面环境贴图（反射、天空盒）',
            '     - new XRCubeLayer(session, gl, {',
            '         space, viewPixelWidth, viewPixelHeight, ...',
            '       })',
            '     - 6 个面构成立方体，适合环境反射',
            '',
            '【性能与合成优势】',
            '  - 浏览器合成器优化：层间透明度/深度由合成器处理，无需重绘',
            '  - 减少重绘：静态层（如 360° 背景）只渲染一次，复用到多帧',
            '  - 分辨率独立：每层可设独立像素分辨率，避免整体超采样',
            '  - 移动 GPU 友好：合成器走 tile-based 渲染，省带宽',
            '  - 实测：360° 视频背景用 EquirectLayer 比画进 ProjectionLayer 省 30-50% GPU',
            '',
            '【实际能力检测演示（当前环境）】',
            `  navigator.xr:        ${f.xr ? '✓' : '✗'}`,
            `  XRLayer:             ${f.layers ? '✓' : '✗'}`,
            `  XRWebGLLayer:        ${f.webglLayer ? '✓' : '✗'}`,
            `  XRProjectionLayer:   ${f.projectionLayer ? '✓' : '✗'}`,
            `  XRQuadLayer:         ${f.quadLayer ? '✓' : '✗'}`,
            `  XRCylinderLayer:     ${f.cylinderLayer ? '✓' : '✗'}`,
            `  XREquirectLayer:     ${f.equirectLayer ? '✓' : '✗'}`,
            `  XRCubeLayer:         ${f.cubeLayer ? '✓' : '✗'}`,
            `  Layers 演示:         ${supported ? '✓（接口可用，需真实 session）' : '✗（jsdom 无 WebXR）'}`,
            '',
            '【常见陷阱】',
            '  1. layers 与 baseLayer 互斥：设置 layers 后 baseLayer 被忽略',
            '  2. ProjectionLayer 必须包含在 layers 中，否则无主场景',
            '  3. 每层需独立 WebGL framebuffer，显存占用增加',
            '  4. 移动 GPU 层数过多（>4）可能反而变慢，需实测',
            '  5. CubeLayer 的 6 面纹理内存占用大，慎用',
        ].join('\n');
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. WebXR Layers 概述 —— vs XRWebGLLayer + 五种 Layer 类型',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['XRLayer', f.layers],
                ['XRWebGLLayer', f.webglLayer],
            ]), h(Tag, { color: 'primary' }, '性能')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '传统 XRWebGLLayer 单一 framebuffer 渲染所有内容（背景+UI+3D），重绘开销大。WebXR Layers 支持多层独立 framebuffer 由合成器高效合成：ProjectionLayer（主 3D 场景，每眼独立）、QuadLayer（平面 UI）、CylinderLayer（弧形菜单）、EquirectLayer（360° 视频）、CubeLayer（环境贴图）。静态层只渲染一次复用多帧，360° 背景用 EquirectLayer 比 ProjectionLayer 省 30-50% GPU。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 Layers 概述演示', { type: 'primary', size: 'sm', onClick: () => this._runLayersDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 传统：单一 XRWebGLLayer
const glLayer = new XRWebGLLayer(session, gl);
session.updateRenderState({ baseLayer: glLayer });

// WebXR Layers：多层合成
const projectionLayer = new XRProjectionLayer(session, gl, {
  textureType: 'texture-array',
  colorFormat: gl.RGBA8,
  depthFormat: gl.DEPTH_COMPONENT16,
});
const quadLayer = new XRQuadLayer(session, gl, {
  space: refSpace,
  transform: new XRRigidTransform({x:0,y:1.5,z:-1}),
  width: 1, height: 0.5,
  viewPixelWidth: 1024, viewPixelHeight: 512,
});
const equirectLayer = new XREquirectLayer(session, gl, {
  space: refSpace,
  radius: 10,
  viewPixelWidth: 2048, viewPixelHeight: 1024,
});

// 设置 layers（替代 baseLayer）
session.updateRenderState({
  layers: [equirectLayer, projectionLayer, quadLayer],
});`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.layersInfo || '（点击按钮查看 WebXR Layers 概述完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：各 Layer 类型实战 =====================
    _runLayerTypesDemo() {
        const f = this._flags();
        this._injectStyle('webxr-layertypes-demo', `
      .webxr-layertypes-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.xr) {
            this._addLog('warn', 'navigator.xr 不可用，跳过真实各 Layer 类型演示（jsdom 无 WebXR）');
            this.setState({ layerTypesInfo: this._buildLayerTypesInfo(f) });
            return;
        }
        this._addLog('warn', '当前环境支持 navigator.xr，但 Layer 实战需真实 session + WebGL，仅展示说明');
        this.setState({ layerTypesInfo: this._buildLayerTypesInfo(f) });
    }
    _buildLayerTypesInfo(f) {
        return [
            '===== 各 Layer 类型实战 =====',
            '',
            '【QuadLayer 平面 UI】',
            '  // 在 3D 空间放置一块平面，渲染 2D UI（菜单、信息卡）',
            '  const quadLayer = new XRQuadLayer(session, gl, {',
            '    space: refSpace,',
            '    transform: new XRRigidTransform({ x: 0, y: 1.5, z: -1.2 }),  // 眼前 1.2m',
            '    width: 1.0, height: 0.6,   // 物理尺寸（米）',
            '    viewPixelWidth: 1024, viewPixelHeight: 614,  // 纹理分辨率',
            '    colorFormat: gl.RGBA8,',
            '    mipLevels: 1,',
            '  });',
            '',
            '  // 渲染：在 quadLayer 的 framebuffer 上画 2D 内容',
            '  const fb = gl.createFramebuffer();',
            '  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);',
            '  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,',
            '    gl.TEXTURE_2D, quadLayer.colorTexture, 0);',
            '  drawMenuUI();  // 用 WebGL/CSS 绘制菜单',
            '',
            '  // 适用：AR 信息卡悬浮、VR 虚拟屏幕、设置面板',
            '',
            '【EquirectLayer 360° 视频】',
            '  // 球面投影，360° 全景视频作为背景',
            '  const equirectLayer = new XREquirectLayer(session, gl, {',
            '    space: refSpace,',
            '    transform: new XRRigidTransform({}),  // 以用户为中心',
            '    radius: 0,  // 0 = 无限远（背景）',
            '    centralHorizontalAngle: 2 * Math.PI,  // 全周',
            '    centralVerticalAngle: Math.PI,',
            '    viewPixelWidth: 4096, viewPixelHeight: 2048,  // 4K 全景',
            '  });',
            '',
            '  // 把视频帧上传到 equirectLayer.colorTexture',
            '  updateVideoTexture(equirectLayer, videoElement);',
            '',
            '  // 优势：视频只解码上传一次，合成器复用到所有 view，省 GPU',
            '  // 对比：画进 ProjectionLayer 每帧每眼都要重画 4K 纹理，极慢',
            '',
            '【CylinderLayer 弧形菜单】',
            '  // 内容贴在圆柱内壁，环绕用户',
            '  const cylinderLayer = new XRCylinderLayer(session, gl, {',
            '    space: refSpace,',
            '    transform: new XRRigidTransform({ y: 1.5 }),',
            '    radius: 2,                     // 圆柱半径（米）',
            '    centralAngleLength: Math.PI * 0.6,  // 弧度（108°）',
            '    aspectRatio: 2,                // 宽高比',
            '    viewPixelWidth: 2048, viewPixelHeight: 1024,',
            '  });',
            '',
            '  // 适用：环幕 HUD、弧形工具栏、沉浸式画廊',
            '  // 用户转头时菜单自然环绕，比 QuadLayer 平面更沉浸',
            '',
            '【ProjectionLayer 多视角高效合成】',
            '  // 主 3D 场景，每只眼独立 view，texture-array 提升立体渲染',
            '  const projectionLayer = new XRProjectionLayer(session, gl, {',
            "    textureType: 'texture-array',  // 纹理数组：左右眼同一纹理层",
            '    colorFormat: gl.RGBA8,',
            '    depthFormat: gl.DEPTH_COMPONENT24,',
            '    scale: 1.0,                    // 渲染分辨率缩放',
            '    mipLevels: 1,',
            '  });',
            '',
            '  // 渲染：用 texture-array 一次 draw call 渲染双眼（instancing）',
            '  const pose = frame.getViewerPose(refSpace);',
            '  for (const view of pose.views) {',
            '    const viewport = projectionLayer.getViewport(view);',
            '    gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);',
            '    renderSceneForView(view);',
            '  }',
            '',
            '  // 优势：texture-array 让左右眼共享深度缓冲，单次绘制两眼',
            '  //       比 XRWebGLLayer 双 framebuffer 切换快 20-30%',
            '',
            '【CubeLayer 环境反射】',
            '  // 6 面立方体贴图，用于环境反射、天空盒',
            '  const cubeLayer = new XRCubeLayer(session, gl, {',
            '    space: refSpace,',
            '    viewPixelWidth: 512, viewPixelHeight: 512,  // 每面 512x512',
            '  });',
            '  // 渲染 6 个面到 cubeLayer.colorTexture（TEXTURE_CUBE_MAP）',
            '',
            '【实际能力检测演示（当前环境）】',
            `  XRProjectionLayer:   ${f.projectionLayer ? '✓' : '✗'}`,
            `  XRQuadLayer:         ${f.quadLayer ? '✓' : '✗'}`,
            `  XRCylinderLayer:     ${f.cylinderLayer ? '✓' : '✗'}`,
            `  XREquirectLayer:     ${f.equirectLayer ? '✓' : '✗'}`,
            `  XRCubeLayer:         ${f.cubeLayer ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. QuadLayer 的 transform 决定平面在 3D 空间的位置，需用 XRRigidTransform',
            '  2. EquirectLayer radius=0 表示无限远背景，非 0 表示有限球面',
            '  3. CylinderLayer centralAngleLength > 2π 会被裁剪到 2π',
            '  4. ProjectionLayer texture-array 需 WebGL2，WebGL1 不支持',
            '  5. 每层的 colorTexture 需手动用 video/canvas 更新，无自动同步',
        ].join('\n');
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 各 Layer 类型实战 —— Quad/Equirect/Cylinder/Projection',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['XRQuadLayer', f.quadLayer],
                ['XRProjectionLayer', f.projectionLayer],
            ]), h(Tag, { color: 'primary' }, '实战')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'QuadLayer 平面 UI（眼前悬浮菜单，XRRigidTransform 定位 + width/height 物理尺寸）、EquirectLayer 360° 视频（球面投影背景，radius=0 无限远，视频帧只上传一次复用多 view）、CylinderLayer 弧形菜单（圆柱内壁，centralAngleLength 控制弧度）、ProjectionLayer 多视角高效合成（texture-array 单次绘制双眼，比 XRWebGLLayer 快 20-30%）、CubeLayer 环境反射（6 面 TEXTURE_CUBE_MAP）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行各 Layer 类型演示', { type: 'primary', size: 'sm', onClick: () => this._runLayerTypesDemo() })),
                h('div', { class: 'webxr-layer-stack' }, h('div', { class: 'webxr-layer-row' }, h('span', { class: 'webxr-layer-name' }, 'QuadLayer'), h('span', { class: 'webxr-layer-desc' }, '平面 UI：菜单/信息卡悬浮在 3D 空间，XRRigidTransform 定位')), h('div', { class: 'webxr-layer-row' }, h('span', { class: 'webxr-layer-name' }, 'EquirectLayer'), h('span', { class: 'webxr-layer-desc' }, '360° 视频：球面背景，radius=0 无限远，省 30-50% GPU')), h('div', { class: 'webxr-layer-row' }, h('span', { class: 'webxr-layer-name' }, 'CylinderLayer'), h('span', { class: 'webxr-layer-desc' }, '弧形菜单：圆柱内壁，centralAngleLength 控制弧度')), h('div', { class: 'webxr-layer-row' }, h('span', { class: 'webxr-layer-name' }, 'ProjectionLayer'), h('span', { class: 'webxr-layer-desc' }, '主 3D 场景：texture-array 单次绘制双眼，快 20-30%'))),
                h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// QuadLayer 平面 UI（悬浮菜单）
const quadLayer = new XRQuadLayer(session, gl, {
  space: refSpace,
  transform: new XRRigidTransform({ x: 0, y: 1.5, z: -1.2 }),
  width: 1.0, height: 0.6,
  viewPixelWidth: 1024, viewPixelHeight: 614,
});

// EquirectLayer 360° 视频背景
const equirectLayer = new XREquirectLayer(session, gl, {
  space: refSpace,
  radius: 0,  // 无限远背景
  centralHorizontalAngle: 2 * Math.PI,
  viewPixelWidth: 4096, viewPixelHeight: 2048,
});
updateVideoTexture(equirectLayer, videoElement);

// CylinderLayer 弧形菜单
const cylinderLayer = new XRCylinderLayer(session, gl, {
  space: refSpace,
  radius: 2,
  centralAngleLength: Math.PI * 0.6,
  viewPixelWidth: 2048, viewPixelHeight: 1024,
});

// ProjectionLayer texture-array 双眼合成
const projectionLayer = new XRProjectionLayer(session, gl, {
  textureType: 'texture-array',
  colorFormat: gl.RGBA8,
  depthFormat: gl.DEPTH_COMPONENT24,
});
session.updateRenderState({
  layers: [equirectLayer, projectionLayer, quadLayer, cylinderLayer],
});`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.layerTypesInfo || '（点击按钮查看各 Layer 类型实战完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 7：实战 AR 家具摆放 =====================
    _runFurnitureDemo() {
        const f = this._flags();
        this._injectStyle('webxr-furniture-demo', `
      .webxr-furniture-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.xr) {
            this._addLog('warn', 'navigator.xr 不可用，跳过真实 AR 家具摆放（jsdom 无 WebXR）');
            this.setState({ furnitureInfo: this._buildFurnitureInfo(f, false) });
            return;
        }
        this._addLog('warn', '当前环境支持 navigator.xr，但 AR 家具摆放需真实 ARCore session，仅展示说明');
        this.setState({ furnitureInfo: this._buildFurnitureInfo(f, true) });
    }
    _buildFurnitureInfo(f, supported) {
        return [
            '===== 实战 AR 家具摆放 =====',
            '',
            '【完整流程：Hit Test + Anchor + DOM Overlay + Layers】',
            '  // 1. 申请 session（一次性申请所有 features）',
            '  const session = await navigator.xr.requestSession(\'immersive-ar\', {',
            "    requiredFeatures: ['local-floor', 'hit-test', 'anchors'],",
            "    optionalFeatures: ['dom-overlay', 'layers', 'light-estimation'],",
            "    domOverlay: { root: document.querySelector('#furniture-ui') },",
            '  });',
            '',
            '  // 2. 创建 WebGL context + ProjectionLayer（性能优化）',
            "  const gl = canvas.getContext('webgl2', { xrCompatible: true });",
            '  const projectionLayer = new XRProjectionLayer(session, gl, {',
            "    textureType: 'texture-array',",
            '    depthFormat: gl.DEPTH_COMPONENT24,',
            '  });',
            '  session.updateRenderState({ layers: [projectionLayer] });',
            '',
            '  // 3. 创建 hit-test 源（地面检测）',
            '  const refSpace = await session.requestReferenceSpace(\'local-floor\');',
            '  const hitTestSource = await session.requestHitTestSource({',
            '    space: refSpace,',
            "    entityTypes: ['plane'],",
            '  });',
            '',
            '  // 4. DOM Overlay 控件（放置/旋转/删除/清空）',
            '  // <div id="furniture-ui" style="pointer-events:none">',
            '  //   <button data-action="place">放置家具</button>',
            '  //   <button data-action="rotate">旋转</button>',
            '  //   <button data-action="delete">删除</button>',
            '  // </div>',
            '',
            '  // 5. select 事件 → hit-test 命中 → createAnchor 固定',
            '  const transientSource = await session.requestHitTestSourceForTransientInput({',
            "    profile: 'generic-touch-screen', space: refSpace,",
            '  });',
            '  session.addEventListener("select", async () => {',
            '    const results = frame.getHitTestResultsForTransientInput(transientSource);',
            '    if (results[0]?.results[0]) {',
            '      const pose = results[0].results[0].getPose(refSpace);',
            '      // 创建 anchor 固定家具（抵抗漂移）',
            '      const anchor = await frame.createAnchor(pose.transform, refSpace);',
            '      const furniture = loadFurnitureGLTF("sofa.glb");',
            '      furniture.userData.anchor = anchor;',
            '      anchors.add(anchor);',
            '    }',
            '  });',
            '',
            '  // 6. RAF 循环：每帧用 trackedAnchors 更新家具位置',
            '  function onFrame(time, frame) {',
            '    const trackedSet = frame.trackedAnchors;',
            '    for (const anchor of anchors) {',
            '      if (!trackedSet.has(anchor)) {',
            '        scene.remove(anchor.userData.furniture);',
            '        anchors.delete(anchor);',
            '        continue;',
            '      }',
            '      const pose = frame.getPose(anchor.anchorSpace, refSpace);',
            '      if (pose) {',
            '        anchor.userData.furniture.matrix.fromArray(pose.transform.matrix);',
            '      }',
            '    }',
            '    // 环境光估计照亮家具',
            '    if (frame.lightEstimate) {',
            '      const { primaryLightIntensity, ambientLightIntensity } = frame.lightEstimate;',
            '      updateLighting(primaryLightIntensity, ambientLightIntensity);',
            '    }',
            '    session.requestAnimationFrame(onFrame);',
            '  }',
            '',
            '【与 Three.js WebXR 桥接】',
            '  // Three.js 内置 WebXR 桥接（renderer.xr）',
            '  const renderer = new THREE.WebGLRenderer({ antialias: true });',
            '  renderer.xr.enabled = true;',
            '  renderer.xr.setReferenceSpaceType("local-floor");',
            '',
            '  // VRButton / ARButton 一行启动',
            '  document.body.appendChild(ARButton.createButton(renderer, {',
            "    requiredFeatures: ['hit-test', 'anchors'],",
            "    optionalFeatures: ['dom-overlay', 'layers'],",
            "    domOverlay: { root: document.querySelector('#ui') },",
            '  }));',
            '',
            '  // Three.js XRController 模拟 select 事件',
            '  const controller = renderer.xr.getController(0);',
            '  controller.addEventListener("select", () => {',
            '    // 用 Three.js 的 XRHitTestSource 放置物体',
            '    if (hitResults.length > 0) {',
            '      const hitPose = hitResults[0].getPose(renderer.xr.getReferenceSpace());',
            '      placeFurniture(hitPose);',
            '    }',
            '  });',
            '',
            '  // Three.js 自动管理 RAF + projection',
            '  renderer.setAnimationLoop(() => renderer.render(scene, camera));',
            '',
            '【Layers 性能优化点】',
            '  - 家具 3D 模型 → ProjectionLayer（texture-array 双眼合成）',
            '  - 房间预览背景 → EquirectLayer（一张全景图复用）',
            '  - 悬浮家具信息卡 → QuadLayer（2D 文字避免 WebGL 字体）',
            '  - DOM Overlay 仅放交互按钮（放置/旋转/删除）',
            '',
            '【实际能力检测演示（当前环境）】',
            `  navigator.xr:    ${f.xr ? '✓' : '✗'}`,
            `  hit-test:        ${f.hitTest ? '✓' : '✗'}`,
            `  anchors:         ${f.xrAnchor ? '✓' : '✗'}`,
            `  dom-overlay:     ${f.domOverlay ? '✓' : '✗'}`,
            `  layers:          ${f.layers ? '✓' : '✗'}`,
            `  家具摆放演示:    ${supported ? '✓（接口可用，需真实 ARCore）' : '✗（jsdom 无 WebXR）'}`,
            '',
            '【常见陷阱】',
            '  1. 家具模型必须用 anchor 固定，否则用户走动后漂移明显',
            '  2. GLB 模型首次加载慢，应预加载或显示 loading 占位',
            '  3. light-estimation 在低端 ARCore 设备可能不可用，需降级固定光照',
            '  4. DOM Overlay 按钮点击会触发 select 事件，需 stopPropagation',
            '  5. ProjectionLayer texture-array 需 WebGL2，Three.js 需 forceWebGL2',
        ].join('\n');
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 实战 AR 家具摆放 —— Hit Test + Anchor + DOM Overlay + Layers + Three.js',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['hit-test', f.hitTest],
                ['anchors', f.xrAnchor],
            ]), h(Tag, { color: 'primary' }, '综合实战')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '综合 Hit Test（地面检测）+ Anchor（家具固定抗漂移）+ DOM Overlay（放置/旋转/删除按钮）+ Layers（ProjectionLayer 渲染家具、QuadLayer 信息卡、EquirectLayer 房间背景）+ light-estimation 环境光照亮。与 Three.js WebXR 桥接：renderer.xr.enabled + ARButton.createButton + XRController select 事件，setAnimationLoop 自动管理 RAF。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 AR 家具摆放演示', { type: 'primary', size: 'sm', onClick: () => this._runFurnitureDemo() })),
                h('div', { class: 'webxr-furniture-stage' }, h('div', { class: 'webxr-furniture-canvas' }, h('div', { class: 'webxr-furniture-item', style: { top: '40px', left: '40px' } }, '🛋️'), h('div', { class: 'webxr-furniture-item', style: { top: '110px', left: '120px' } }, '🪑'), h('div', { class: 'webxr-furniture-item', style: { top: '60px', left: '220px' } }, '🪟'), h('div', { class: 'webxr-furniture-item', style: { bottom: '20px', right: '40px' } }, '🪴')), h('div', { class: 'webxr-furniture-controls' }, this._btn('👆 放置', { type: 'primary', size: 'sm', block: true, onClick: () => this._addLog('warn', 'AR 家具放置需真实 ARCore session（jsdom 无 WebXR）') }), this._btn('🔄 旋转', { type: 'default', size: 'sm', block: true, onClick: () => this._addLog('warn', '家具旋转需真实 AR session') }), this._btn('🗑️ 删除', { type: 'default', size: 'sm', block: true, onClick: () => this._addLog('warn', '家具删除需真实 AR session') }), this._btn('🧹 清空', { type: 'default', size: 'sm', block: true, danger: true, onClick: () => this._addLog('warn', '清空所有家具需真实 AR session') }))),
                h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 申请 AR session（一次性申请所有 features）
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['local-floor', 'hit-test', 'anchors'],
  optionalFeatures: ['dom-overlay', 'layers', 'light-estimation'],
  domOverlay: { root: document.querySelector('#furniture-ui') },
});

// Layers 性能优化：ProjectionLayer + QuadLayer 信息卡
const projectionLayer = new XRProjectionLayer(session, gl, {
  textureType: 'texture-array', depthFormat: gl.DEPTH_COMPONENT24,
});

// select 事件 → hit-test → createAnchor 固定家具
const transientSource = await session.requestHitTestSourceForTransientInput({
  profile: 'generic-touch-screen', space: refSpace,
});
session.addEventListener('select', async () => {
  const results = frame.getHitTestResultsForTransientInput(transientSource);
  if (results[0]?.results[0]) {
    const pose = results[0].results[0].getPose(refSpace);
    const anchor = await frame.createAnchor(pose.transform, refSpace);
    const furniture = await loadFurnitureGLTF('sofa.glb');
    furniture.userData.anchor = anchor;
    anchors.add(anchor);
  }
});

// Three.js 桥接
renderer.xr.enabled = true;
document.body.appendChild(ARButton.createButton(renderer, {
  requiredFeatures: ['hit-test', 'anchors'],
  optionalFeatures: ['dom-overlay', 'layers'],
  domOverlay: { root: document.querySelector('#ui') },
}));
renderer.setAnimationLoop(() => renderer.render(scene, camera));`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.furnitureInfo || '（点击按钮查看 AR 家具摆放完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 8：能力检测与降级 =====================
    _runFallbackDemo() {
        const f = this._flags();
        this._injectStyle('webxr-fallback-demo', `
      .webxr-fallback-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.xr) {
            this._addLog('warn', 'navigator.xr 不可用，跳过真实降级检测（jsdom 无 WebXR），展示完整降级方案说明');
        }
        else {
            this._addLog('info', '检测到 navigator.xr，展示 features 申请失败回退与替代方案');
        }
        this.setState({ fallbackInfo: this._buildFallbackInfo(f) });
    }
    _buildFallbackInfo(f) {
        return [
            '===== 能力检测与降级 =====',
            '',
            '【features 申请失败回退】',
            '  // 1. 异步检测 session 模式支持',
            "  const arOK = await navigator.xr.isSessionSupported('immersive-ar');",
            '  if (!arOK) {',
            '    // 降级方案：Quick Look / Model Viewer / 8thWall',
            '    return showFallback();',
            '  }',
            '',
            '  // 2. requiredFeatures 申请失败 → catch NotSupportedError',
            '  try {',
            '    const session = await navigator.xr.requestSession(\'immersive-ar\', {',
            "      requiredFeatures: ['hit-test', 'anchors'],  // 任一失败即 reject",
            '    });',
            '  } catch (err: any) {',
            '    if (err.name === "NotSupportedError") {',
            '      // 降级：去掉 anchors，仅用 hit-test（无锚点固定）',
            '      const session = await navigator.xr.requestSession(\'immersive-ar\', {',
            "        requiredFeatures: ['hit-test'],",
            '      });',
            '      // 物体随参考空间漂移，提示用户保持静止',
            '    }',
            '  }',
            '',
            '  // 3. optionalFeatures 失败 → 静默忽略，session 仍可用',
            '  const session = await navigator.xr.requestSession(\'immersive-ar\', {',
            "    requiredFeatures: ['hit-test'],",
            "    optionalFeatures: ['layers', 'dom-overlay'],  // 不可用则降级到 baseLayer",
            '  });',
            '  if (!session.domOverlayState) {',
            '    // dom-overlay 不可用，改用 WebGL 内绘制 UI',
            '    renderUIInWebGL();',
            '  }',
            '',
            '【iOS Quick Look 模型预览（iOS Safari 降级）】',
            '  // iOS Safari 不支持 WebXR immersive-ar，用 Quick Look 预览 USDZ',
            '  <a rel="ar"',
            '     href="sofa.usdz"',
            '     style="display:inline-block;width:64px;height:64px">',
            '    <img src="sofa-thumbnail.png" width="64" height="64">',
            '  </a>',
            '  // 点击链接触发 iOS 原生 AR Quick Look，支持放置/缩放/旋转',
            '  // 限制：仅 iOS 12+ Safari，无 hit-test/anchor API',
            '',
            '【Model Viewer（Web Component 降级）',
            '  // Google <model-viewer> Web Component，跨浏览器 3D 模型预览',
            '  // 支持 AR（Android Scene Viewer / iOS Quick Look 自动切换）',
            '  <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js">',
            '  </script>',
            '  <model-viewer',
            '    src="sofa.glb"',
            '    ios-src="sofa.usdz"',
            '    ar',
            '    camera-controls',
            '    auto-rotate',
            '    style="width:100%;height:400px;">',
            '  </model-viewer>',
            '  // 优势：零代码 AR，自动适配 Android（Scene Viewer）/ iOS（Quick Look）',
            '  // 限制：无 hit-test/anchor/layers API，仅模型预览',
            '',
            '【8thWall（商业 WebAR 替代）',
            '  // 8thWall 提供自有 WebAR 运行时，不依赖 WebXR API',
            '  // 支持图像目标、世界追踪、面部追踪、手部追踪',
            '  // 兼容 iOS Safari（WebXR 不支持的浏览器）',
            '  const engine = new XR8.Engine();',
            '  engine.start({ canvas, webxr: "AR" });',
            '  // 限制：商业付费，需 8thWall 账号 + API key',
            '',
            '【浏览器支持矩阵（综合）】',
            '  方案               Chrome Android  iOS Safari  Chrome 桌面  Firefox',
            '  WebXR immersive-ar ✓ 81+          ✗           ✗            ✗',
            '  WebXR hit-test     ✓ 81+          ✗           ✗            ✗',
            '  WebXR anchors      ✓ 85+          ✗           ✗            ✗',
            '  WebXR dom-overlay  ✓ 83+          ✗           ✗            ✗',
            '  WebXR layers       ✓ 91+          ✗           ✓ 90+(VR)    部分',
            '  iOS Quick Look     ✗              ✓ 12+       ✗            ✗',
            '  Model Viewer AR    ✓ Scene Viewer ✓ Quick Look ✗           ✗',
            '  8thWall            ✓              ✓           ✓            ✓',
            '',
            '【能力检测优先级】',
            '  1. navigator.xr.isSessionSupported(\'immersive-ar\') → WebXR AR',
            '  2. iOS Safari → <a rel="ar"> Quick Look',
            '  3. <model-viewer ar> → Scene Viewer / Quick Look 自动切换',
            '  4. 8thWall → 商业方案，兜底 iOS',
            '  5. 纯 3D 预览（无 AR）→ <model-viewer> 无 ar 属性',
            '',
            '【实际能力检测演示（当前环境）】',
            `  navigator.xr:           ${f.xr ? '✓' : '✗'}`,
            `  XRSession:              ${f.xrSession ? '✓' : '✗'}`,
            `  降级方案可用性:         ${f.xr ? 'WebXR AR' : '需 Model Viewer / Quick Look / 8thWall'}`,
            '',
            '【常见陷阱】',
            '  1. isSessionSupported 是异步 Promise，不能同步 if 判断',
            '  2. requiredFeatures 失败直接 reject，无部分成功；用 optionalFeatures 容错',
            '  3. iOS Safari 永远 false，必须提供 Quick Look 降级链接',
            '  4. Model Viewer 的 ar 属性在非 AR 浏览器静默忽略，不报错',
            '  5. 8thWall 与 WebXR 不可同时启用，需二选一',
        ].join('\n');
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 能力检测与降级 —— features 回退 + Quick Look + Model Viewer + 8thWall',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['navigator.xr', f.xr],
                ['降级方案', true],
            ]), h(Tag, { color: 'primary' }, '降级')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'isSessionSupported 异步检测后，requiredFeatures 失败抛 NotSupportedError（catch 后去掉不可用 feature 重新申请），optionalFeatures 失败静默忽略。iOS Safari 不支持 WebXR 降级 <a rel="ar" href=".usdz"> Quick Look（iOS 12+）。Google <model-viewer ar> 自动切换 Android Scene Viewer / iOS Quick Look。8thWall 商业 WebAR 兜底 iOS。优先级：WebXR AR → Quick Look → Model Viewer → 8thWall → 纯 3D 预览。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行降级方案演示', { type: 'primary', size: 'sm', onClick: () => this._runFallbackDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 1. 异步检测 + requiredFeatures 失败回退
const arOK = await navigator.xr.isSessionSupported('immersive-ar');
if (!arOK) return showFallback();  // Quick Look / Model Viewer

try {
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'anchors'],
  });
} catch (err: any) {
  if (err.name === 'NotSupportedError') {
    // 去掉 anchors，仅 hit-test
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
    });
  }
}

// 2. iOS Quick Look（USDZ）
<a rel="ar" href="sofa.usdz">
  <img src="sofa-thumbnail.png">
</a>

// 3. Model Viewer（自动 Android/iOS）
<model-viewer src="sofa.glb" ios-src="sofa.usdz" ar camera-controls>
</model-viewer>

// 4. 8thWall（商业兜底）
const engine = new XR8.Engine();
engine.start({ canvas, webxr: 'AR' });`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.fallbackInfo || '（点击按钮查看能力检测与降级完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== 日志面板 =====================
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return null;
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'WebXR 高级特性深度实验室'),
            h(Alert, {
                type: 'info',
                message: 'WebXR 高级特性 —— Hit Test / Anchors / DOM Overlays / Layers 深度实验室',
                description: '演示 WebXR Device API 的 AR 进阶能力：AR 进阶概览（immersive-ar vs immersive-vr session 差异 + requiredFeatures/optionalFeatures 申请 hit-test/anchors/dom-overlay/layers + 浏览器/设备支持矩阵）、Hit Test 射线检测（session.requestHitTestSource({ space, entityTypes }) + XRHitTestSource/XRHitTestResult + getPose() + 真实表面放置 3D 物体 + requestHitTestSourceForTransientInput 屏幕点击放置）、Anchor 锚点（frame.createAnchor(pose, space) + XRAnchor 持久化 + session.trackedAnchors（XRAnchorSet）+ 删除/失效 + 大范围移动稳定性 < 5cm 漂移）、DOM Overlays（domOverlay: { root } + XRDOMOverlayState + HTML 元素叠加 AR 场景 + pointer-events 控制 + CSS 定位同步 worldToNDC 投影 + 与 WebGL Layer 协同 + xrbubbleset 实验性）、WebXR Layers 概述（vs XRWebGLLayer 默认基础层 + ProjectionLayer/QuadLayer/CylinderLayer/EquirectLayer/CubeLayer 五种类型 + 性能与合成优势省 30-50% GPU）、各 Layer 类型实战（QuadLayer 平面 UI + EquirectLayer 360° 视频 + CylinderLayer 弧形菜单 + ProjectionLayer texture-array 双眼合成快 20-30% + CubeLayer 环境反射）、实战 AR 家具摆放（Hit Test + Anchor + DOM Overlay 控件 + Layers 性能优化 + light-estimation + 与 Three.js WebXR 桥接 renderer.xr + ARButton + XRController）、能力检测与降级（features 申请失败回退 + iOS Quick Look USDZ + Google Model Viewer 自动 Scene Viewer/Quick Look + 8thWall 商业兜底 + 浏览器支持矩阵）。必须 HTTPS + XR 设备/ARCore，jsdom 无 navigator.xr 所有检测为 false，真实浏览器 Chrome 81+ Android ARCore 可完整体验。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=WebXRAdvancedPage.js.map