// =====================================================================
// CSSMotionPathDeepPage.js —— CSS Motion Path Module Level 1 完整 实验室
// 演示 W3C CSS Motion Path Module Level 1 路径运动动画特性：
//   1. 概述与动机：传统 CSS 动画只能沿直线/曲线插值属性 / 路径运动需求
//      （轨迹动画、引导线、徽章飘动、SVG 路径描边）/ 旧 motion-path 重命名
//      为 offset-path / CSS Motion Path Module Level 1 标准 / 浏览器支持
//      Chrome 116+/Firefox 72+ 部分 113+ 完整/Safari 16+ 已进入 Baseline /
//      与 CSS Transitions/Animations 正交
//   2. offset-path 路径定义：offset-path: path('M0,0 L100,100') / ray(angle,
//      size, position) / <basic-shape> circle/ellipse/inset/polygon /
//      <coord-box> content-box/padding-box/border-box/margin-box/fill-box/
//      stroke-box/view-box / url() 引用 SVG path / 多路径组合
//   3. path() 函数与 SVG 路径：path('M0,0 C50,50 100,0 150,50') / SVG path
//      data 语法 M/L/C/Q/A/Z / 绝对 vs 相对坐标 / 路径长度 pathLength / 与
//      SVG <path> element d 属性共用语法 / path() 不支持变量（CSS Values L5
//      提案）
//   4. ray() 射线函数：ray(45deg closest-side) / ray(angle, <ray-size>,
//      <ray-position>) / size: closest-side/farthest-side/closest-corner/
//      farthest-corner/sides / position: 绝对坐标 / 射线方向角度 / 与 polar
//      坐标系
//   5. offset-distance 偏移距离：offset-distance: 50% / 0% 起点至 100% 终点
//      / 长度值 px / 与 offset-path 配合 / 动画沿路径运动 / 反向运动 100% → 0%
//   6. offset-rotate 与 offset-position：offset-rotate: auto / reverse /
//      <angle> / auto <angle> / 0deg 不旋转 / auto 跟随路径切线 /
//      offset-position: <position> 路径起点偏移 / 与 offset-anchor 区别
//   7. offset-anchor 锚点：offset-anchor: center / <position> / 元素哪个点
//      对齐路径 / 与 transform-origin 区别 / 默认值 normal / 影响旋转中心
//   8. 实战与陷阱：沿 SVG 路径运动动画 / 引导线动画 / 徽章飘动 / 与 CSS
//      Animations @keyframes 配合 / offset 简写 / 浏览器降级（旧 motion-path
//      前缀）/ DevTools 调试 / 性能（GPU 加速 transform）/ 与 Web Animations
//      API 协同 / 与 transform: translate() 组合注意事项
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；offset-path / ray() / <coord-box> 等较新或
//       实验性语法 jsdom 可能不识别，统一 safe(()=>...) 兜底返回 false。
//       注入演示样式 + 完整代码示例，真实浏览器可查看沿路径运动效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSMotionPathDeepPageCaps {
  css: boolean;
  supports: boolean;
  offsetPathPath: boolean;
  offsetPathRay: boolean;
  offsetPathShape: boolean;
  offsetPathCoordBox: boolean;
  offsetDistance: boolean;
  offsetRotateAuto: boolean;
  offsetRotateAngle: boolean;
  offsetPosition: boolean;
  offsetAnchor: boolean;
  offsetShorthand: boolean;
}

export interface CSSMotionPathDeepPageProps extends Props {}

export interface CSSMotionPathDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  overviewInfo: string;
  offsetPathInfo: string;
  pathFuncInfo: string;
  rayFuncInfo: string;
  distanceInfo: string;
  rotateInfo: string;
  anchorInfo: string;
  patternsInfo: string;
}

export class CSSMotionPathDeepPage extends Page {
  declare props: CSSMotionPathDeepPageProps;
  declare state: CSSMotionPathDeepPageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _dynamicStyles!: any[];
  _pathMode!: string;
  _pathData!: string;
  _rayAngle!: number;
  _raySize!: string;
  _distance!: string;
  _rotateMode!: string;
  _positionMode!: string;
  _anchorMode!: string;


  // —— 初始 state ——
  initialState(): CSSMotionPathDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',        // Card 1：概述与动机
      offsetPathInfo: '',      // Card 2：offset-path 路径定义
      pathFuncInfo: '',        // Card 3：path() 函数与 SVG 路径
      rayFuncInfo: '',         // Card 4：ray() 射线函数
      distanceInfo: '',        // Card 5：offset-distance 偏移距离
      rotateInfo: '',          // Card 6：offset-rotate 与 offset-position
      anchorInfo: '',          // Card 7：offset-anchor 锚点
      patternsInfo: '',        // Card 8：实战与陷阱
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];     // 动态创建并插入 head 的 <style> 元素列表

    this._pathMode = 'path';                      // Card 2 当前 offset-path 形式
    this._pathData = 'M20,80 C60,20 140,20 180,80'; // Card 3 当前 SVG path data
    this._rayAngle = 45;                          // Card 4 当前 ray 角度
    this._raySize = 'closest-side';               // Card 4 当前 ray size
    this._distance = '50%';                       // Card 5 当前 offset-distance
    this._rotateMode = 'auto';                    // Card 6 当前 offset-rotate
    this._positionMode = 'auto';                  // Card 6 当前 offset-position
    this._anchorMode = 'auto';                    // Card 7 当前 offset-anchor

    // 一次性能力检测：CSS Motion Path Module Level 1 全家桶
    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`,
      `supports ${c(f.supports)}`,
      `offset-path:path() ${c(f.offsetPathPath)}`,
      `offset-path:ray() ${c(f.offsetPathRay)}`,
      `offset-path:circle() ${c(f.offsetPathShape)}`,
      `offset-path:content-box ${c(f.offsetPathCoordBox)}`,
      `offset-distance ${c(f.offsetDistance)}`,
      `offset-rotate:auto ${c(f.offsetRotateAuto)}`,
      `offset-rotate:0deg ${c(f.offsetRotateAngle)}`,
      `offset-position ${c(f.offsetPosition)}`,
      `offset-anchor ${c(f.offsetAnchor)}`,
      `offset 简写 ${c(f.offsetShorthand)}`,
    ];

    const summary = f.css
      ? `CSS Motion Path Module Level 1 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；offset-path / ray() / <basic-shape> / <coord-box> 等较新语法 jsdom 可能不识别，按钮将仅记日志说明。在真实浏览器中打开可完整演示（Chrome 116+/Firefox 113+/Safari 16+ 已进入 Baseline）。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.offsetPathPath) this._addLog('warn', 'offset-path: path() 不可用或 jsdom 未识别（CSS Motion Path L1，Chrome 116+/Firefox 72+/Safari 16+）');
    if (!f.offsetPathRay) this._addLog('warn', 'offset-path: ray() 不可用或 jsdom 未识别（CSS Motion Path L1，Chrome 116+/Firefox 113+/Safari 16+）');
    if (!f.offsetPathShape) this._addLog('warn', 'offset-path: <basic-shape> 不可用或 jsdom 未识别（如 circle()/ellipse()，Chrome 116+/Safari 16+）');
    if (!f.offsetPathCoordBox) this._addLog('warn', 'offset-path: <coord-box> 不可用或 jsdom 未识别（如 content-box/fill-box，Chrome 116+）');
    if (!f.offsetPosition) this._addLog('warn', 'offset-position 不可用或 jsdom 未识别（CSS Motion Path L1 较新属性，Chrome 116+/Safari 16+）');
    if (!f.offsetAnchor) this._addLog('warn', 'offset-anchor 不可用或 jsdom 未识别（CSS Motion Path L1 较新属性，Chrome 116+/Safari 16+）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectBaseStyles();
  }

  componentWillUnmount(): void {
    // 移除动态创建的 <style> 元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items: any) {
    return items.map(([label, ok]: [any, any]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // safe 包装：jsdom 不可用或异常时返回 false（绝不抛异常）
  _safe(fn: any): any  {
    try { return fn(); }
    catch { return false; }
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags(): CSSMotionPathDeepPageCaps {
    const hasCSS = this._safe(() => typeof CSS !== 'undefined');
    const hasSupports = this._safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function');
    const supportsPV = (p: any,v: any) => this._safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v));
    return {
      css: hasCSS,
      supports: hasSupports,
      // Card 2：offset-path 各形式
      offsetPathPath: supportsPV('offset-path', 'path("M0,0 L100,100")'),
      offsetPathRay: supportsPV('offset-path', 'ray(45deg closest-side)'),
      offsetPathShape: supportsPV('offset-path', 'circle()'),
      offsetPathCoordBox: supportsPV('offset-path', 'content-box'),
      // Card 5：offset-distance
      offsetDistance: supportsPV('offset-distance', '50%'),
      // Card 6：offset-rotate / offset-position
      offsetRotateAuto: supportsPV('offset-rotate', 'auto'),
      offsetRotateAngle: supportsPV('offset-rotate', '0deg'),
      offsetPosition: supportsPV('offset-position', '50% 50%'),
      // Card 7：offset-anchor
      offsetAnchor: supportsPV('offset-anchor', 'center'),
      // Card 8：offset 简写
      offsetShorthand: supportsPV('offset', 'path("M0,0 L100,100") 50% auto'),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id: string, textContent: string): any {
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 动态注入所有演示样式 ——
  _injectBaseStyles(): void {
    this._injectStyle('css-motion-path-demo', `
      /* ===== 通用 motion-path 舞台 ===== */
      .mp-stage {
        position: relative;
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
        min-height: 120px;
      }
      /* ===== Card 2 / Card 3：path 路径演示 ===== */
      .mp-path-stage {
        position: relative;
        width: 100%;
        height: 140px;
        background: #f1f5f9;
        border: 1px dashed #94a3b8;
        border-radius: 6px;
        margin-top: 8px;
      }
      .mp-path-stage svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .mp-mover {
        position: absolute;
        top: 0;
        left: 0;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: radial-gradient(circle, #3b82f6 0%, #1d4ed8 100%);
        border: 2px solid #fff;
        box-shadow: 0 2px 6px rgba(59,130,246,0.4);
        offset-path: path('M20,80 C60,20 140,20 180,80');
        offset-rotate: auto;
        offset-distance: 50%;
        animation: mp-travel 6s linear infinite;
      }
      @keyframes mp-travel {
        from { offset-distance: 0%; }
        to   { offset-distance: 100%; }
      }
      /* ===== Card 4：ray 射线演示 ===== */
      .mp-ray-stage {
        position: relative;
        width: 200px;
        height: 200px;
        margin: 8px auto;
        background: repeating-linear-gradient(0deg, #e2e8f0 0 1px, transparent 1px 20px),
                    repeating-linear-gradient(90deg, #e2e8f0 0 1px, transparent 1px 20px);
        border: 1px solid #94a3b8;
        border-radius: 6px;
      }
      .mp-ray-center {
        position: absolute;
        top: 50%; left: 50%;
        width: 6px; height: 6px;
        background: #ef4444;
        border-radius: 50%;
        transform: translate(-50%, -50%);
      }
      .mp-ray-arrow {
        position: absolute;
        top: 50%; left: 50%;
        width: 24px; height: 24px;
        border-radius: 50%;
        background: radial-gradient(circle, #10b981 0%, #047857 100%);
        border: 2px solid #fff;
        offset-path: ray(45deg closest-side);
        offset-rotate: auto;
        offset-distance: 50%;
      }
      /* ===== Card 5：offset-distance 演示 ===== */
      .mp-distance-stage {
        position: relative;
        width: 100%;
        height: 100px;
        background: #fef3c7;
        border: 1px dashed #f59e0b;
        border-radius: 6px;
        margin-top: 8px;
      }
      .mp-distance-mover {
        position: absolute;
        top: 0; left: 0;
        width: 20px; height: 20px;
        background: #f59e0b;
        border: 2px solid #fff;
        border-radius: 4px;
        offset-path: path('M10,50 L390,50');
        offset-rotate: 0deg;
      }
      /* ===== Card 6：offset-rotate 演示 ===== */
      .mp-rotate-stage {
        position: relative;
        width: 100%;
        height: 120px;
        background: #ede9fe;
        border: 1px dashed #8b5cf6;
        border-radius: 6px;
        margin-top: 8px;
      }
      .mp-rotate-mover {
        position: absolute;
        top: 0; left: 0;
        width: 32px; height: 12px;
        background: linear-gradient(90deg, #8b5cf6 0%, #c4b5fd 100%);
        border: 1px solid #4c1d95;
        border-radius: 2px;
        offset-path: path('M20,100 C80,20 200,20 360,100');
        offset-distance: 30%;
      }
      /* ===== Card 7：offset-anchor 演示 ===== */
      .mp-anchor-stage {
        position: relative;
        width: 100%;
        height: 120px;
        background: #dcfce7;
        border: 1px dashed #10b981;
        border-radius: 6px;
        margin-top: 8px;
      }
      .mp-anchor-mover {
        position: absolute;
        top: 0; left: 0;
        width: 36px; height: 36px;
        background: rgba(16,185,129,0.6);
        border: 2px solid #047857;
        border-radius: 4px;
        offset-path: path('M20,80 C80,20 200,20 360,80');
        offset-distance: 50%;
        offset-rotate: auto;
      }
      .mp-anchor-mover::before {
        content: '';
        position: absolute;
        top: 50%; left: 50%;
        width: 6px; height: 6px;
        background: #ef4444;
        border-radius: 50%;
        transform: translate(-50%, -50%);
      }
      /* ===== Card 8：实战徽章飘动 ===== */
      .mp-badge-stage {
        position: relative;
        width: 100%;
        height: 160px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-radius: 6px;
        margin-top: 8px;
        overflow: hidden;
      }
      .mp-badge {
        position: absolute;
        top: 0; left: 0;
        padding: 4px 10px;
        background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(239,68,68,0.5);
        offset-path: path('M20,40 C100,120 200,10 360,80 C400,110 420,40 460,60');
        offset-rotate: auto;
        animation: mp-badge-travel 8s ease-in-out infinite;
      }
      @keyframes mp-badge-travel {
        0%   { offset-distance: 0%; }
        50%  { offset-distance: 100%; }
        100% { offset-distance: 0%; }
      }
      /* ===== 输出区 ===== */
      .mp-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
      }
      /* ===== 日志面板 ===== */
      .mp-log-panel { margin-top: 12px; }
      .mp-log-list { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow: auto; }
      .mp-log-item { display: flex; gap: 8px; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: monospace; }
      .mp-log-item.mp-log-info  { background: #e0f2fe; color: #075985; }
      .mp-log-item.mp-log-warn  { background: #fef3c7; color: #78350f; }
      .mp-log-item.mp-log-error { background: #fee2e2; color: #7f1d1d; }
      .mp-log-time { color: inherit; opacity: 0.7; }
    `);
  }

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo(): any {
    const f = this._flags();
    try {
      return `===== CSS Motion Path Module Level 1 概述 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  CSS Motion Path Module Level 1（W3C 规范，2023+ Candidate Recommendation）\n` +
        `  规范地址：https://www.w3.org/TR/motion-1/\n` +
        `  前身：CSS Motion Path Module Level 1 早期草案使用 motion-path / motion-offset\n` +
        `    等属性名，后为统一命名空间重命名为 offset-path / offset-distance / \n` +
        `    offset-rotate / offset-anchor / offset-position / offset 简写\n` +
        `\n` +
        `【动机：传统 CSS 动画的局限】\n` +
        `  传统 CSS Transitions / Animations 只能对可插值属性做"两点间"线性/曲线插值\n` +
        `  例如 transform: translate(0,0) → translate(100px,100px) 只能走直线\n` +
        `  transform: rotate() 可旋转但不能沿任意曲线运动\n` +
        `  无法直接表达"沿 SVG 路径运动""沿圆形轨迹运动""沿引导线飘动"等需求\n` +
        `  历史方案：用 JS（如 GSAP MotionPathPlugin）/ SVG <animateMotion> / 手算关键帧\n` +
        `\n` +
        `【Motion Path 解决的问题】\n` +
        `  offset-path 定义一条路径，offset-distance 控制元素在路径上的位置（0%~100%）\n` +
        `  浏览器自动计算路径切线，offset-rotate: auto 让元素朝向运动方向\n` +
        `  典型场景：轨迹动画、引导线动画、徽章飘动、SVG 路径描边、行星轨道\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  offset-path: path()  —— Chrome 55+/Firefox 72+（部分）/Safari 16+/Edge 79+\n` +
        `  offset-path: ray()   —— Chrome 116+/Firefox 113+/Safari 16+（较新）\n` +
        `  offset-path: <basic-shape> / <coord-box> —— Chrome 116+/Safari 16+\n` +
        `  offset-position       —— Chrome 116+/Safari 16+（Firefox 仍 behind flag）\n` +
        `  offset-anchor         —— Chrome 116+/Safari 16+（Firefox 仍 behind flag）\n` +
        `  2024+ 已进入 Baseline（主流浏览器普遍支持核心特性）\n` +
        `\n` +
        `【与 CSS Transitions/Animations 正交】\n` +
        `  offset-* 属性本身可被动画/过渡（如 @keyframes 改 offset-distance）\n` +
        `  也可被 transition 过渡（如 hover 时 offset-distance: 100%）\n` +
        `  offset-* 与 transform 协同：先沿路径位移，再叠加 transform 旋转/缩放\n` +
        `  与 Web Animations API（Element.animate()）完全兼容\n` +
        `\n` +
        `【能力检测】\n` +
        `  CSS ${f.css ? '✓' : '✗'} / supports ${f.supports ? '✓' : '✗'}\n` +
        `  offset-path:path()     = ${f.offsetPathPath}\n` +
        `  offset-path:ray()      = ${f.offsetPathRay}\n` +
        `  offset-path:circle()   = ${f.offsetPathShape}\n` +
        `  offset-path:content-box= ${f.offsetPathCoordBox}\n` +
        `  offset-distance        = ${f.offsetDistance}\n` +
        `  offset-rotate:auto     = ${f.offsetRotateAuto}\n` +
        `  offset-rotate:0deg     = ${f.offsetRotateAngle}\n` +
        `  offset-position        = ${f.offsetPosition}\n` +
        `  offset-anchor          = ${f.offsetAnchor}\n` +
        `  offset 简写            = ${f.offsetShorthand}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  <style>\n` +
        `    .mover {\n` +
        `      offset-path: path('M20,80 C60,20 140,20 180,80');\n` +
        `      offset-rotate: auto;   /* 跟随路径切线方向 */\n` +
        `      animation: travel 4s linear infinite;\n` +
        `    }\n` +
        `    @keyframes travel {\n` +
        `      from { offset-distance: 0%; }\n` +
        `      to   { offset-distance: 100%; }\n` +
        `    }\n` +
        `  </style>\n` +
        `  <div class="mover">沿路径运动</div>`;
    } catch (err: any) {
      return `读取 概述 信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo(): void {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    const f = this._flags();
    this._addLog('overview', `Motion Path 概述演示：offset-path=${f.offsetPathPath}, ray=${f.offsetPathRay}, 简写=${f.offsetShorthand}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— CSS Motion Path Module Level 1',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['offset-path', f.offsetPathPath],
          ['ray()', f.offsetPathRay],
          ['offset 简写', f.offsetShorthand],
        ]),
        h(Tag, { color: 'primary' }, 'Baseline 2024'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Motion Path Module Level 1 让元素沿任意路径运动：offset-path 定义路径（path()/ray()/basic-shape/coord-box），offset-distance 控制位置（0%~100%），offset-rotate: auto 让元素朝向运动方向。前身 motion-path 已重命名为 offset-* 命名空间。传统 CSS 动画只能对属性做两点间插值，无法直接表达沿 SVG 路径/圆形轨迹运动；Motion Path 补足这一缺口，且与 CSS Transitions/Animations 正交（offset-* 本身可被动画/过渡）。浏览器支持：Chrome 116+/Firefox 113+/Safari 16+ 已进入 Baseline。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '沿路径运动演示（真实浏览器可见蓝色小球沿曲线运动）：'),
        h('div', { class: 'mp-path-stage' },
          h('svg', { viewBox: '0 0 400 140', preserveAspectRatio: 'none', xmlns: 'http://www.w3.org/2000/svg' },
            h('path', { d: 'M20,80 C60,20 140,20 180,80', stroke: '#3b82f6', 'stroke-width': '2', fill: 'none', 'stroke-dasharray': '4,4' }),
          ),
          h('div', { class: 'mp-mover' }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 Motion Path 完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'offset-path 与 CSS Transitions/Animations 正交，可叠加',
          description: 'offset-* 属性本身可被 @keyframes 动画或 transition 过渡（如动画 offset-distance 从 0% 到 100%）。前身 motion-path/motion-offset 已重命名为 offset-path/offset-distance 等统一命名空间。Chrome 116+/Firefox 113+/Safari 16+ 已进入 Baseline，老浏览器需 -webkit- 前缀或 JS 兜底（GSAP MotionPathPlugin）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：offset-path 路径定义 ===================

  _readOffsetPathInfo(): any {
    const f = this._flags();
    try {
      const mover = this.el && (this.el as any as Element | null)?.querySelector('.mp-path-stage .mp-mover');
      let computed = '(未渲染)';
      if (mover) {
        computed = window.getComputedStyle(mover).getPropertyValue('offset-path') || '(空)';
      }
      return `===== offset-path 路径定义 =====\n` +
        `\n` +
        `【语法】\n` +
        `  offset-path: none | <offset-path> || <coord-box>\n` +
        `  <offset-path> = path() | ray() | <basic-shape> | url()\n` +
        `  <coord-box> = content-box | padding-box | border-box | margin-box |\n` +
        `                fill-box | stroke-box | view-box\n` +
        `\n` +
        `【四种路径形式】\n` +
        `  1. path() —— SVG path data 字符串（最常用）\n` +
        `       offset-path: path('M0,0 L100,100');\n` +
        `       offset-path: path('M0,0 C50,50 100,0 150,50');\n` +
        `  2. ray()  —— 射线（从一点向某角度发射的线段）\n` +
        `       offset-path: ray(45deg closest-side);\n` +
        `       offset-path: ray(0deg farthest-corner at 50% 50%);\n` +
        `  3. <basic-shape> —— 基本形状（与 clip-path 共用语法）\n` +
        `       offset-path: circle(50% at 50% 50%);\n` +
        `       offset-path: ellipse(50% 30% at 50% 50%);\n` +
        `       offset-path: inset(10% 10% 10% 10% round 10px);\n` +
        `       offset-path: polygon(0% 0%, 100% 0%, 50% 100%);\n` +
        `  4. url() —— 引用 SVG <path> 元素的 d 属性\n` +
        `       offset-path: url(#myPath);  /* <path id="myPath" d="..."/> */\n` +
        `\n` +
        `【<coord-box> 参考盒】\n` +
        `  <coord-box> 指定路径坐标的参考盒（影响 ray()/basic-shape 的原点与尺寸）\n` +
        `    content-box  —— 内容盒（默认，不含 padding/border）\n` +
        `    padding-box  —— padding 盒（含 padding，不含 border）\n` +
        `    border-box   —— border 盒（含 padding + border）\n` +
        `    margin-box   —— margin 盒（含 margin）\n` +
        `    fill-box     —— SVG 对象边界盒（SVG 元素专用）\n` +
        `    stroke-box   —— SVG 描边边界盒\n` +
        `    view-box     —— SVG viewBox（最近视口）\n` +
        `  示例：offset-path: ray(0deg closest-side) content-box;\n` +
        `\n` +
        `【多路径组合】\n` +
        `  offset-path 当前规范只支持单条路径；多路径需用 JS 拆分或多个元素叠加\n` +
        `  CSS Values L5 提案：path() 接受变量插值（仍草案，未实现）\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .mp-mover { offset-path: path('${this._pathData}'); offset-rotate: auto; }\n` +
        `    offset-path 计算值="${computed}"\n` +
        `  CSS.supports 检测：\n` +
        `    offset-path: path()        = ${f.offsetPathPath}\n` +
        `    offset-path: ray()         = ${f.offsetPathRay}\n` +
        `    offset-path: circle()      = ${f.offsetPathShape}\n` +
        `    offset-path: content-box   = ${f.offsetPathCoordBox}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* path() —— SVG path data */\n` +
        `  .mover-path { offset-path: path('M0,0 L100,100'); }\n` +
        `\n` +
        `  /* ray() —— 射线 */\n` +
        `  .mover-ray { offset-path: ray(45deg closest-side); }\n` +
        `\n` +
        `  /* <basic-shape> —— 圆形 */\n` +
        `  .mover-circle { offset-path: circle(50% at 50% 50%); }\n` +
        `\n` +
        `  /* <coord-box> —— 参考盒 */\n` +
        `  .mover-box { offset-path: ray(0deg closest-side) border-box; }\n` +
        `\n` +
        `  /* url() —— 引用 SVG <path> */\n` +
        `  <svg width="0" height="0">\n` +
        `    <path id="myPath" d="M0,0 C50,50 100,0 150,50" />\n` +
        `  </svg>\n` +
        `  .mover-url { offset-path: url(#myPath); }`;
    } catch (err: any) {
      return `读取 offset-path 信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOffsetPathDemo(): void {
    this.setState({ offsetPathInfo: this._readOffsetPathInfo() });
    const f = this._flags();
    this._addLog('offset-path', `offset-path 演示：path=${f.offsetPathPath}, ray=${f.offsetPathRay}, shape=${f.offsetPathShape}, coord-box=${f.offsetPathCoordBox}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. offset-path 路径定义 —— path()/ray()/basic-shape/coord-box',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['path()', f.offsetPathPath],
          ['ray()', f.offsetPathRay],
          ['basic-shape', f.offsetPathShape],
          ['coord-box', f.offsetPathCoordBox],
        ]),
        h(Tag, { color: 'primary' }, '4 种路径形式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'offset-path 定义运动路径，支持四种形式：path()（SVG path data 字符串，最常用）、ray()（从一点向某角度发射的射线）、<basic-shape>（circle/ellipse/inset/polygon，与 clip-path 共用语法）、url()（引用 SVG <path> 元素的 d 属性）。可附加 <coord-box> 指定参考盒：content-box（默认）/padding-box/border-box/margin-box/fill-box/stroke-box/view-box，影响 ray()/basic-shape 的原点与尺寸。当前规范只支持单条路径；多路径需 JS 拆分或多个元素叠加。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 offset-path 信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOffsetPathDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'path() 演示（蓝色小球沿 SVG path 运动）：'),
        h('div', { class: 'mp-path-stage' },
          h('svg', { viewBox: '0 0 400 140', preserveAspectRatio: 'none', xmlns: 'http://www.w3.org/2000/svg' },
            h('path', { d: 'M20,80 C60,20 140,20 180,80', stroke: '#3b82f6', 'stroke-width': '2', fill: 'none', 'stroke-dasharray': '4,4' }),
          ),
          h('div', { class: 'mp-mover' }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.offsetPathInfo || '（点击按钮查看 offset-path 四种路径形式完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'path() 最常用，ray()/basic-shape 为 Level 1 新增',
          description: 'path() 接受 SVG path data 字符串，与 SVG <path> 元素 d 属性共用语法，最常用且兼容性最好（Chrome 55+/Firefox 72+）。ray()/basic-shape/coord-box 为 Motion Path L1 较新特性（Chrome 116+/Safari 16+）。url() 引用 SVG <path> 元素，需同文档内存在对应 id。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：path() 函数与 SVG 路径 ===================

  _readPathFuncInfo(): any {
    const f = this._flags();
    try {
      const mover = this.el && (this.el as any as Element | null)?.querySelector('.mp-path-stage .mp-mover');
      let computed = '(未渲染)';
      if (mover) {
        computed = window.getComputedStyle(mover).getPropertyValue('offset-path') || '(空)';
      }
      return `===== path() 函数与 SVG 路径 =====\n` +
        `\n` +
        `【语法】\n` +
        `  offset-path: path(<string>)\n` +
        `  <string> 为 SVG path data 字符串（与 SVG <path> d 属性共用语法）\n` +
        `  示例：offset-path: path('M0,0 C50,50 100,0 150,50');\n` +
        `\n` +
        `【SVG path data 命令】\n` +
        `  M x,y   —— Move To（移动到，起点）\n` +
        `  L x,y   —— Line To（直线到）\n` +
        `  H x     —— Horizontal Line To（水平线到）\n` +
        `  V y     —— Vertical Line To（垂直线到）\n` +
        `  C x1,y1 x2,y2 x,y —— Cubic Bezier（三次贝塞尔，2 控制点）\n` +
        `  Q x1,y1 x,y       —— Quadratic Bezier（二次贝塞尔，1 控制点）\n` +
        `  S x2,y2 x,y       —— Smooth Cubic（平滑三次，复用前控制点）\n` +
        `  T x,y             —— Smooth Quadratic（平滑二次）\n` +
        `  A rx,ry rot large-arc sweep x,y —— Arc（椭圆弧）\n` +
        `  Z       —— Close Path（闭合到起点）\n` +
        `  小写字母为相对坐标（如 m/l/c），大写为绝对坐标（如 M/L/C）\n` +
        `\n` +
        `【绝对 vs 相对坐标】\n` +
        `  M 100,100  —— 绝对坐标，移动到 (100,100)\n` +
        `  m 100,100  —— 相对坐标，从当前点移动 (100,100) 偏移\n` +
        `  path() 内可混用绝对/相对，但建议统一风格便于调试\n` +
        `\n` +
        `【路径长度 pathLength】\n` +
        `  SVG <path> 元素有 pathLength 属性，可自定义路径长度（用于 stroke-dasharray）\n` +
        `  offset-distance: 50% 始终按"实际几何长度"的 50% 计算，与 pathLength 无关\n` +
        `  如需精确控制距离，可用 px 值：offset-distance: 100px\n` +
        `\n` +
        `【与 SVG <path> element d 属性共用语法】\n` +
        `  path() 函数的字符串与 SVG <path d="..."> 完全兼容\n` +
        `  可用 SVG 编辑器（如 Illustrator/Figma）导出路径，复制 d 属性值到 path()\n` +
        `  也可用 url(#pathId) 直接引用 SVG <path> 元素（避免重复）\n` +
        `\n` +
        `【path() 不支持变量】\n` +
        `  当前 path() 的字符串是字面量，不能用 CSS 变量插值：\n` +
        `    --my-path: 'M0,0 L100,100';\n` +
        `    offset-path: path(var(--my-path));  /* ✗ 不生效 */\n` +
        `  CSS Values L5 提案：path() 接受变量插值（仍草案，未实现）\n` +
        `  替代方案：用 JS 动态生成 inline style，或用 url() 引用 SVG <path>\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .mp-mover { offset-path: path('${this._pathData}'); }\n` +
        `    offset-path 计算值="${computed}"\n` +
        `  当前 path data = ${this._pathData}\n` +
        `  CSS.supports('offset-path','path("M0,0 L100,100")') = ${f.offsetPathPath}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 三次贝塞尔曲线 */\n` +
        `  .bezier {\n` +
        `    offset-path: path('M0,0 C50,50 100,0 150,50');\n` +
        `    offset-rotate: auto;\n` +
        `    animation: travel 4s linear infinite;\n` +
        `  }\n` +
        `\n` +
        `  /* 闭合路径（三角形）*/\n` +
        `  .triangle {\n` +
        `    offset-path: path('M50,0 L100,100 L0,100 Z');\n` +
        `  }\n` +
        `\n` +
        `  /* 椭圆弧 */\n` +
        `  .arc {\n` +
        `    offset-path: path('M0,50 A50,50 0 1 1 100,50');\n` +
        `  }\n` +
        `\n` +
        `  /* 引用 SVG <path> 元素 */\n` +
        `  <svg width="0" height="0" style="position:absolute">\n` +
        `    <path id="motionPath" d="M0,0 C50,50 100,0 150,50" />\n` +
        `  </svg>\n` +
        `  .mover-url { offset-path: url(#motionPath); }`;
    } catch (err: any) {
      return `读取 path() 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setPathData(data: any,desc: any): void  {
    this._pathData = data;
    // 更新 .mp-mover 的 offset-path（同时更新 SVG 可视路径）
    this._injectStyle('css-motion-path-data-dynamic',
      `.mp-path-stage .mp-mover { offset-path: path('${data}'); }`);
    if (this.el) {
      const svgPath = (this.el as any as Element | null)?.querySelector('.mp-path-stage svg path');
      if (svgPath) svgPath.setAttribute('d', data);
    }
    this.setState({ pathFuncInfo: this._readPathFuncInfo() });
    this._addLog('path', `切换 path data → ${desc}（${data}）`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. path() 函数与 SVG 路径 —— M/L/C/Q/A/Z 命令',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['path()', f.offsetPathPath]]),
        h(Tag, { color: 'primary' }, 'SVG path data'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'path() 接受 SVG path data 字符串，与 SVG <path> 元素 d 属性共用语法。命令包括 M（Move To）/L（Line To）/H/V（水平/垂直线）/C（三次贝塞尔）/Q（二次贝塞尔）/S/T（平滑贝塞尔）/A（椭圆弧）/Z（闭合）。大写为绝对坐标，小写为相对坐标。offset-distance: 50% 按实际几何长度的 50% 计算（与 pathLength 无关）。path() 字符串是字面量，不支持 CSS 变量插值（CSS Values L5 提案仍草案），替代方案用 JS 动态生成 inline style 或 url() 引用 SVG <path>。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ pathFuncInfo: this._readPathFuncInfo() }) }),
          this._btn('贝塞尔 C', { size: 'sm', disabled: !f.offsetPathPath, onClick: () => this._setPathData('M20,80 C60,20 140,20 180,80', '三次贝塞尔') }),
          this._btn('直线 L', { size: 'sm', disabled: !f.offsetPathPath, onClick: () => this._setPathData('M20,100 L380,40', '直线') }),
          this._btn('三角 Z', { size: 'sm', disabled: !f.offsetPathPath, onClick: () => this._setPathData('M200,20 L380,120 L20,120 Z', '闭合三角') }),
          this._btn('弧 A', { size: 'sm', disabled: !f.offsetPathPath, onClick: () => this._setPathData('M20,80 A180,60 0 1 1 380,80', '椭圆弧') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'path() 演示（切换按钮观察不同 SVG path 命令）：'),
        h('div', { class: 'mp-path-stage' },
          h('svg', { viewBox: '0 0 400 140', preserveAspectRatio: 'none', xmlns: 'http://www.w3.org/2000/svg' },
            h('path', { d: 'M20,80 C60,20 140,20 180,80', stroke: '#3b82f6', 'stroke-width': '2', fill: 'none', 'stroke-dasharray': '4,4' }),
          ),
          h('div', { class: 'mp-mover' }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pathFuncInfo || '（点击按钮切换 path data 并查看 SVG path 命令说明）')),
        h(Alert, {
          type: 'warning',
          message: 'path() 不支持 CSS 变量插值（CSS Values L5 提案仍草案）',
          description: 'path(\'M0,0 L100,100\') 字符串是字面量，不能用 var(--my-path) 插值。替代方案：用 JS 动态生成 inline style（element.style.offsetPath = "path(\'...\')"），或用 url(#pathId) 引用 SVG <path> 元素（修改 d 属性即可更新路径）。offset-distance: 50% 按实际几何长度计算，与 SVG pathLength 属性无关。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：ray() 射线函数 ===================

  _readRayFuncInfo(): any {
    const f = this._flags();
    try {
      const arrow = this.el && (this.el as any as Element | null)?.querySelector('.mp-ray-arrow');
      let computed = '(未渲染)';
      if (arrow) {
        computed = window.getComputedStyle(arrow).getPropertyValue('offset-path') || '(空)';
      }
      return `===== ray() 射线函数 =====\n` +
        `\n` +
        `【语法】\n` +
        `  offset-path: ray(<angle> <ray-size>? <ray-position>?)\n` +
        `  示例：offset-path: ray(45deg closest-side at 50% 50%);\n` +
        `\n` +
        `【<angle> 射线方向角度】\n` +
        `  0deg   —— 向上（北）\n` +
        `  90deg  —— 向右（东）\n` +
        `  180deg —— 向下（南）\n` +
        `  270deg —— 向左（西）\n` +
        `  45deg  —— 右上方\n` +
        `  角度顺时针增加，与 CSS transform: rotate() 一致\n` +
        `\n` +
        `【<ray-size> 射线长度】\n` +
        `  closest-side     —— 到最近边的距离（最短）\n` +
        `  farthest-side    —— 到最远边的距离\n` +
        `  closest-corner   —— 到最近角的距离\n` +
        `  farthest-corner  —— 到最远角的距离（默认）\n` +
        `  sides            —— 到边的交点（射线与盒子边界的交点）\n` +
        `  默认值：farthest-corner\n` +
        `\n` +
        `【<ray-position> 射线起点】\n` +
        `  语法：<position>（与 background-position 共用语法）\n` +
        `  示例：at 50% 50%（中心）/ at 0 0（左上角）/ at center top\n` +
        `  默认值：center（即 50% 50%）\n` +
        `  起点相对 <coord-box> 计算（默认 content-box）\n` +
        `\n` +
        `【与 polar 坐标系】\n` +
        `  ray() 本质是极坐标：从起点出发，沿指定角度方向，延伸指定长度\n` +
        `  offset-distance: 50% 沿射线从起点到终点的 50% 处\n` +
        `  offset-rotate: auto 让元素朝向射线方向（角度方向）\n` +
        `  适合"从中心向外辐射""雷达扫描""时钟指针"等场景\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .mp-ray-arrow { offset-path: ray(${this._rayAngle}deg ${this._raySize}); offset-rotate: auto; offset-distance: 50%; }\n` +
        `    offset-path 计算值="${computed}"\n` +
        `  CSS.supports('offset-path','ray(45deg closest-side)') = ${f.offsetPathRay}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 从中心向右上方发射 */\n` +
        `  .ray-45 {\n` +
        `    offset-path: ray(45deg closest-side);\n` +
        `    offset-rotate: auto;\n` +
        `    offset-distance: 50%;\n` +
        `  }\n` +
        `\n` +
        `  /* 从左上角向右下方发射 */\n` +
        `  .ray-diagonal {\n` +
        `    offset-path: ray(135deg farthest-corner at 0 0);\n` +
        `    offset-rotate: auto;\n` +
        `    animation: pulse 2s ease-in-out infinite;\n` +
        `  }\n` +
        `  @keyframes pulse {\n` +
        `    0%, 100% { offset-distance: 0%; }\n` +
        `    50%      { offset-distance: 100%; }\n` +
        `  }\n` +
        `\n` +
        `  /* 雷达扫描（配合 <coord-box>）*/\n` +
        `  .radar-sweep {\n` +
        `    offset-path: ray(0deg closest-side at center) border-box;\n` +
        `    offset-rotate: auto;\n` +
        `    animation: rotate 4s linear infinite;\n` +
        `  }\n` +
        `  @keyframes rotate {\n` +
        `    from { offset-distance: 0%; transform: rotate(0deg); }\n` +
        `    to   { offset-distance: 0%; transform: rotate(360deg); }\n` +
        `  }`;
    } catch (err: any) {
      return `读取 ray() 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setRay(angle: any,size: any): void  {
    this._rayAngle = angle;
    this._raySize = size;
    this._injectStyle('css-motion-path-ray-dynamic',
      `.mp-ray-arrow { offset-path: ray(${angle}deg ${size}); offset-rotate: auto; offset-distance: 50%; }`);
    this.setState({ rayFuncInfo: this._readRayFuncInfo() });
    this._addLog('ray', `切换 ray → ${angle}deg ${size}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. ray() 射线函数 —— ray(angle, size, position)',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ray()', f.offsetPathRay]]),
        h(Tag, { color: 'primary' }, '极坐标 / 雷达扫描'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ray() 是极坐标路径函数：ray(<angle> <ray-size>? <ray-position>?)。<angle> 为射线方向（0deg 向上，90deg 向右，顺时针）；<ray-size> 为射线长度（closest-side/farthest-side/closest-corner/farthest-corner 默认/sides）；<ray-position> 为起点（<position> 语法，默认 center）。offset-distance: 50% 沿射线从起点到终点的 50% 处，offset-rotate: auto 让元素朝向射线方向。适合"从中心向外辐射""雷达扫描""时钟指针"等场景。可附加 <coord-box> 指定参考盒。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ rayFuncInfo: this._readRayFuncInfo() }) }),
          this._btn('0° 上', { size: 'sm', disabled: !f.offsetPathRay, onClick: () => this._setRay(0, 'closest-side') }),
          this._btn('45° 右上', { size: 'sm', disabled: !f.offsetPathRay, onClick: () => this._setRay(45, 'closest-side') }),
          this._btn('90° 右', { size: 'sm', disabled: !f.offsetPathRay, onClick: () => this._setRay(90, 'closest-side') }),
          this._btn('135° 右下', { size: 'sm', disabled: !f.offsetPathRay, onClick: () => this._setRay(135, 'farthest-corner') }),
          this._btn('180° 下', { size: 'sm', disabled: !f.offsetPathRay, onClick: () => this._setRay(180, 'closest-side') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'ray() 演示（绿色小球沿射线方向运动，当前 ' + this._rayAngle + 'deg ' + this._raySize + '）：'),
        h('div', { class: 'mp-ray-stage' },
          h('div', { class: 'mp-ray-center' }),
          h('div', { class: 'mp-ray-arrow' }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.rayFuncInfo || '（点击按钮切换 ray 角度/size 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'ray() 本质是极坐标，0deg 向上、顺时针增加',
          description: 'ray() 适合"从中心向外辐射"场景：雷达扫描（rotate 360deg）、时钟指针、爆炸粒子、引导箭头。<ray-size> 控制射线长度（closest-side 最短，farthest-corner 最长默认）。<ray-position> 用 <position> 语法指定起点（默认 center）。offset-rotate: auto 让元素朝向射线方向。Chrome 116+/Firefox 113+/Safari 16+ 支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：offset-distance 偏移距离 ===================

  _readDistanceInfo(): any {
    const f = this._flags();
    try {
      const mover = this.el && (this.el as any as Element | null)?.querySelector('.mp-distance-mover');
      let computed = '(未渲染)';
      if (mover) {
        computed = window.getComputedStyle(mover).getPropertyValue('offset-distance') || '(空)';
      }
      return `===== offset-distance 偏移距离 =====\n` +
        `\n` +
        `【语法】\n` +
        `  offset-distance: <length-percentage>\n` +
        `  <length>      —— px/em/rem 等绝对长度（如 100px）\n` +
        `  <percentage>  —— 相对路径总长度的百分比（0%~100%）\n` +
        `  默认值：0%（路径起点）\n` +
        `\n` +
        `【0% 起点至 100% 终点】\n` +
        `  0%   —— 路径起点（path 的第一个 M 命令位置）\n` +
        `  100% —— 路径终点（最后一个命令的终点，或 Z 闭合回起点）\n` +
        `  50%  —— 路径中点（按几何长度计算，非命令数）\n` +
        `  负值与 >100% 的值会被钳制到 [0%, 100%]\n` +
        `\n` +
        `【与 offset-path 配合】\n` +
        `  offset-distance 必须配合 offset-path 使用（否则无路径可走）\n` +
        `  offset-path 定义路径形状，offset-distance 决定元素当前在路径上的位置\n` +
        `  动画 offset-distance 从 0% 到 100% 即"沿路径运动"\n` +
        `\n` +
        `【动画沿路径运动】\n` +
        `  @keyframes travel {\n` +
        `    from { offset-distance: 0%; }\n` +
        `    to   { offset-distance: 100%; }\n` +
        `  }\n` +
        `  .mover { offset-path: path('...'); animation: travel 4s linear infinite; }\n` +
        `\n` +
        `【反向运动 100% → 0%】\n` +
        `  反转 keyframes 即可让元素反向运动：\n` +
        `    @keyframes travel-reverse {\n` +
        `      from { offset-distance: 100%; }\n` +
        `      to   { offset-distance: 0%; }\n` +
        `    }\n` +
        `  或用 animation-direction: reverse 复用同一 keyframes\n` +
        `\n` +
        `【长度值 px】\n` +
        `  offset-distance: 100px —— 距离起点 100px 处\n` +
        `  适合精确控制位置（如点击跳转到路径某点）\n` +
        `  但路径总长度需用 JS getTotalLength() 获取（SVG <path> 方法）\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .mp-distance-mover { offset-path: path('M10,50 L390,50'); offset-distance: ${this._distance}; offset-rotate: 0deg; }\n` +
        `    offset-distance 计算值="${computed}"\n` +
        `  CSS.supports('offset-distance','50%') = ${f.offsetDistance}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 沿路径运动（0% → 100%）*/\n` +
        `  .mover-forward {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    offset-rotate: auto;\n` +
        `    animation: travel 4s linear infinite;\n` +
        `  }\n` +
        `  @keyframes travel {\n` +
        `    from { offset-distance: 0%; }\n` +
        `    to   { offset-distance: 100%; }\n` +
        `  }\n` +
        `\n` +
        `  /* 反向运动（100% → 0%）*/\n` +
        `  .mover-backward {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    animation: travel 4s linear infinite reverse;\n` +
        `  }\n` +
        `\n` +
        `  /* 来回运动（alternate）*/\n` +
        `  .mover-pingpong {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    animation: travel 4s ease-in-out infinite alternate;\n` +
        `  }\n` +
        `\n` +
        `  /* 精确位置（px）*/\n` +
        `  .mover-fixed { offset-path: path('M0,0 L300,0'); offset-distance: 150px; }\n` +
        `\n` +
        `  /* JS 获取路径总长度 */\n` +
        `  const pathEl = document.createElementNS('http://www.w3.org/2000/svg','path');\n` +
        `  pathEl.setAttribute('d', 'M0,0 L300,0');\n` +
        `  const totalLen = pathEl.getTotalLength();  // 300`;
    } catch (err: any) {
      return `读取 offset-distance 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setDistance(val: any): void  {
    this._distance = val;
    this._injectStyle('css-motion-path-distance-dynamic',
      `.mp-distance-mover { offset-distance: ${val}; }`);
    this.setState({ distanceInfo: this._readDistanceInfo() });
    this._addLog('distance', `切换 offset-distance → ${val}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. offset-distance 偏移距离 —— 0% 起点至 100% 终点',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['offset-distance', f.offsetDistance]]),
        h(Tag, { color: 'primary' }, '<length-percentage>'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'offset-distance 控制元素在 offset-path 路径上的位置：<percentage>（0%~100%，相对路径总长度）或 <length>（px/em 等绝对长度）。0% 为路径起点（path 第一个 M 命令位置），100% 为路径终点（最后一个命令终点或 Z 闭合回起点），50% 为路径几何中点。动画 offset-distance 从 0% 到 100% 即"沿路径运动"；反向运动用 100% → 0% 或 animation-direction: reverse；来回运动用 alternate。px 值适合精确控制位置，路径总长度可用 SVG <path>.getTotalLength() 获取。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ distanceInfo: this._readDistanceInfo() }) }),
          this._btn('0%', { size: 'sm', disabled: !f.offsetDistance, onClick: () => this._setDistance('0%') }),
          this._btn('25%', { size: 'sm', disabled: !f.offsetDistance, onClick: () => this._setDistance('25%') }),
          this._btn('50%', { type: 'primary', size: 'sm', disabled: !f.offsetDistance, onClick: () => this._setDistance('50%') }),
          this._btn('75%', { size: 'sm', disabled: !f.offsetDistance, onClick: () => this._setDistance('75%') }),
          this._btn('100%', { size: 'sm', disabled: !f.offsetDistance, onClick: () => this._setDistance('100%') }),
          this._btn('100px', { size: 'sm', disabled: !f.offsetDistance, onClick: () => this._setDistance('100px') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'offset-distance 演示（黄色方块沿直线运动，当前 ' + this._distance + '）：'),
        h('div', { class: 'mp-distance-stage' },
          h('div', { class: 'mp-distance-mover' }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.distanceInfo || '（点击按钮切换 offset-distance 查看说明）')),
        h(Alert, {
          type: 'info',
          message: '动画 offset-distance 从 0% 到 100% 即沿路径运动',
          description: '反向运动用 100% → 0% 或 animation-direction: reverse；来回运动用 alternate。px 值适合精确控制位置（如点击跳转到路径某点），路径总长度可用 SVG <path>.getTotalLength() 获取。负值与 >100% 的值会被钳制到 [0%, 100%]。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：offset-rotate 与 offset-position ===================

  _readRotateInfo(): any {
    const f = this._flags();
    try {
      const mover = this.el && (this.el as any as Element | null)?.querySelector('.mp-rotate-mover');
      let computed = '(未渲染)';
      if (mover) {
        computed = window.getComputedStyle(mover).getPropertyValue('offset-rotate') || '(空)';
      }
      return `===== offset-rotate 与 offset-position =====\n` +
        `\n` +
        `【offset-rotate 语法】\n` +
        `  offset-rotate: auto | reverse | <angle> | auto <angle>\n` +
        `  默认值：auto（跟随路径切线方向）\n` +
        `\n` +
        `【取值详解】\n` +
        `  auto          —— 跟随路径切线方向（元素朝向运动方向，最常用）\n` +
        `  reverse       —— 反向跟随切线（元素朝向运动反方向，如倒车）\n` +
        `  <angle>       —— 固定角度（如 0deg 不旋转，45deg 固定倾斜）\n` +
        `  auto <angle>  —— 切线方向 + 额外角度（如 auto 90deg 切线 + 90deg）\n` +
        `\n` +
        `【0deg 不旋转】\n` +
        `  offset-rotate: 0deg —— 元素保持原方向，不随路径旋转\n` +
        `  适合"图标沿路径移动但图标本身不旋转"场景\n` +
        `  注意：0deg 与 auto 区别显著，0deg 完全不旋转，auto 跟随切线\n` +
        `\n` +
        `【auto 跟随路径切线】\n` +
        `  offset-rotate: auto —— 元素朝向运动方向（如箭头指向前进方向）\n` +
        `  浏览器自动计算路径当前点的切线方向\n` +
        `  适合"飞机沿航线飞行""鱼游动""箭头指引"等场景\n` +
        `\n` +
        `【offset-position 语法】\n` +
        `  offset-position: auto | <position>\n` +
        `  默认值：auto（路径起点由 offset-path 决定）\n` +
        `  <position> 与 background-position 共用语法\n` +
        `    offset-position: 50% 50%;  /* 中心 */\n` +
        `    offset-position: 0 0;      /* 左上角 */\n` +
        `    offset-position: center top;\n` +
        `\n` +
        `【offset-position 作用】\n` +
        `  offset-position 指定路径的"初始位置偏移"\n` +
        `  对 ray()：作为 ray 的 <ray-position> 默认值（覆盖 ray 内的 at）\n` +
        `  对 path()：path 的坐标原点偏移（path('M0,0...') 的 (0,0) 移到 offset-position）\n` +
        `  对 <basic-shape>：作为 shape 的中心默认值\n` +
        `\n` +
        `【与 offset-anchor 区别】\n` +
        `  offset-position：路径本身的位置（路径放在容器的哪个位置）\n` +
        `  offset-anchor：元素的锚点（元素的哪个点对齐路径）\n` +
        `  两者独立，可组合使用\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .mp-rotate-mover { offset-path: path('M20,100 C80,20 200,20 360,100'); offset-rotate: ${this._rotateMode}; offset-distance: 30%; }\n` +
        `    offset-rotate 计算值="${computed}"\n` +
        `  CSS.supports('offset-rotate','auto') = ${f.offsetRotateAuto}\n` +
        `  CSS.supports('offset-rotate','0deg') = ${f.offsetRotateAngle}\n` +
        `  CSS.supports('offset-position','50% 50%') = ${f.offsetPosition}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* auto 跟随切线（箭头指向前进方向）*/\n` +
        `  .arrow-auto {\n` +
        `    offset-path: path('M0,0 C50,50 100,0 150,50');\n` +
        `    offset-rotate: auto;\n` +
        `    animation: travel 4s linear infinite;\n` +
        `  }\n` +
        `\n` +
        `  /* 0deg 不旋转（图标保持原方向）*/\n` +
        `  .icon-fixed {\n` +
        `    offset-path: path('M0,0 C50,50 100,0 150,50');\n` +
        `    offset-rotate: 0deg;\n` +
        `    animation: travel 4s linear infinite;\n` +
        `  }\n` +
        `\n` +
        `  /* reverse 反向（倒车效果）*/\n` +
        `  .car-reverse {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    offset-rotate: reverse;\n` +
        `    animation: travel 4s linear infinite;\n` +
        `  }\n` +
        `\n` +
        `  /* auto 90deg 切线 + 90deg（侧身移动）*/\n` +
        `  .crab-walk {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    offset-rotate: auto 90deg;\n` +
        `    animation: travel 4s linear infinite;\n` +
        `  }\n` +
        `\n` +
        `  /* offset-position 偏移路径原点 */\n` +
        `  .mover-offset {\n` +
        `    offset-path: ray(0deg closest-side);\n` +
        `    offset-position: 25% 75%;  /* ray 起点在容器 25% 75% 处 */\n` +
        `    offset-rotate: auto;\\n` +
        `  }`;
    } catch (err: any) {
      return `读取 offset-rotate/position 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setRotate(mode: any): void  {
    this._rotateMode = mode;
    this._injectStyle('css-motion-path-rotate-dynamic',
      `.mp-rotate-mover { offset-rotate: ${mode}; }`);
    this.setState({ rotateInfo: this._readRotateInfo() });
    const desc = ({
      auto: '跟随路径切线方向',
      reverse: '反向跟随切线（倒车）',
      '0deg': '固定 0deg（不旋转）',
      'auto 90deg': '切线 + 90deg（侧身）',
      '45deg': '固定 45deg 倾斜',
    } as Record<string, string>)[mode];
    this._addLog('rotate', `切换 offset-rotate → ${mode}（${desc}）`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. offset-rotate 与 offset-position —— 旋转与起点偏移',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['offset-rotate:auto', f.offsetRotateAuto],
          ['offset-rotate:0deg', f.offsetRotateAngle],
          ['offset-position', f.offsetPosition],
        ]),
        h(Tag, { color: 'primary' }, 'auto/reverse/<angle>'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'offset-rotate 控制元素沿路径运动时的旋转：auto（默认，跟随路径切线方向，元素朝向运动方向）/ reverse（反向跟随切线，倒车效果）/ <angle>（固定角度，0deg 不旋转）/ auto <angle>（切线 + 额外角度，如 auto 90deg 侧身移动）。offset-position 指定路径的初始位置偏移：<position> 语法（与 background-position 共用），对 ray() 作为 <ray-position> 默认值，对 path() 偏移坐标原点。与 offset-anchor 区别：offset-position 是路径位置，offset-anchor 是元素锚点。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ rotateInfo: this._readRotateInfo() }) }),
          this._btn('auto', { type: 'primary', size: 'sm', disabled: !f.offsetRotateAuto, onClick: () => this._setRotate('auto') }),
          this._btn('reverse', { size: 'sm', disabled: !f.offsetRotateAuto, onClick: () => this._setRotate('reverse') }),
          this._btn('0deg', { size: 'sm', disabled: !f.offsetRotateAngle, onClick: () => this._setRotate('0deg') }),
          this._btn('auto 90deg', { size: 'sm', disabled: !f.offsetRotateAuto, onClick: () => this._setRotate('auto 90deg') }),
          this._btn('45deg', { size: 'sm', disabled: !f.offsetRotateAngle, onClick: () => this._setRotate('45deg') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'offset-rotate 演示（紫色长条沿曲线运动，当前 ' + this._rotateMode + '）：'),
        h('div', { class: 'mp-rotate-stage' },
          h('svg', { viewBox: '0 0 400 120', preserveAspectRatio: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } },
            h('path', { d: 'M20,100 C80,20 200,20 360,100', stroke: '#8b5cf6', 'stroke-width': '2', fill: 'none', 'stroke-dasharray': '4,4' }),
          ),
          h('div', { class: 'mp-rotate-mover' }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.rotateInfo || '（点击按钮切换 offset-rotate 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'auto 跟随切线（箭头指向前进方向），0deg 不旋转（图标保持原方向）',
          description: 'auto 适合飞机/鱼/箭头等需要朝向运动方向的元素；0deg 适合图标/徽章等不需要旋转的元素。reverse 实现倒车效果，auto 90deg 实现侧身移动（螃蟹步）。offset-position 偏移路径原点，与 offset-anchor（元素锚点）独立。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 7：offset-anchor 锚点 ===================

  _readAnchorInfo(): any {
    const f = this._flags();
    try {
      const mover = this.el && (this.el as any as Element | null)?.querySelector('.mp-anchor-mover');
      let computed = '(未渲染)';
      if (mover) {
        computed = window.getComputedStyle(mover).getPropertyValue('offset-anchor') || '(空)';
      }
      return `===== offset-anchor 锚点 =====\n` +
        `\n` +
        `【语法】\n` +
        `  offset-anchor: auto | <position>\n` +
        `  默认值：auto（与 offset-position 一致，否则为 center）\n` +
        `  <position> 与 background-position 共用语法\n` +
        `\n` +
        `【作用】\n` +
        `  offset-anchor 指定元素的"哪个点"对齐到路径上\n` +
        `  例如 offset-anchor: center —— 元素中心对齐路径\n` +
        `       offset-anchor: 0% 0%   —— 元素左上角对齐路径\n` +
        `       offset-anchor: 100% 100% —— 元素右下角对齐路径\n` +
        `  影响元素在路径上的视觉位置与旋转中心\n` +
        `\n` +
        `【常见取值】\n` +
        `  center / 50% 50%   —— 元素中心对齐路径（最常用）\n` +
        `  top left / 0% 0%   —— 元素左上角对齐路径\n` +
        `  bottom right / 100% 100% —— 元素右下角对齐路径\n` +
        `  50% 0%             —— 元素顶部中点对齐路径\n` +
        `\n` +
        `【与 transform-origin 区别】\n` +
        `  transform-origin：transform 变换（rotate/scale/skew）的中心点\n` +
        `  offset-anchor：offset-path 运动时元素对齐路径的点\n` +
        `  两者独立：transform-origin 影响 rotate() 旋转中心，\n` +
        `    offset-anchor 影响元素在路径上的对齐位置\n` +
        `  但 offset-rotate: auto 旋转时，旋转中心由 offset-anchor 决定\n` +
        `\n` +
        `【默认值 normal 的含义】\n` +
        `  规范早期用 normal 作为默认值，现已统一为 auto\n` +
        `  auto 行为：\n` +
        `    若 offset-position 非 auto，则 offset-anchor = offset-position\n` +
        `    否则 offset-anchor = center（元素中心对齐路径）\n` +
        `\n` +
        `【影响旋转中心】\n` +
        `  offset-rotate: auto 时，元素围绕 offset-anchor 指定的点旋转\n` +
        `  例如 offset-anchor: 50% 0%（顶部中点）+ auto —— 元素顶部中点沿路径运动，\n` +
        `    元素本身像"悬挂"在路径下方，围绕顶部中点旋转\n` +
        `  适合"钟摆""旗帜飘动""吊灯摇晃"等场景\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .mp-anchor-mover { offset-anchor: ${this._anchorMode === 'auto' ? 'auto' : this._anchorMode}; offset-rotate: auto; }\n` +
        `    offset-anchor 计算值="${computed}"\n` +
        `  CSS.supports('offset-anchor','center') = ${f.offsetAnchor}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 元素中心对齐路径（默认）*/\n` +
        `  .mover-center {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    offset-anchor: center;       /* 50% 50% */\n` +
        `    offset-rotate: auto;\n` +
        `  }\n` +
        `\n` +
        `  /* 元素左上角对齐路径 */\n` +
        `  .mover-topleft {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    offset-anchor: 0% 0%;        /* top left */\n` +
        `    offset-rotate: auto;\n` +
        `  }\n` +
        `\n` +
        `  /* 顶部中点对齐（钟摆效果）*/\n` +
        `  .pendulum {\n` +
        `    offset-path: path('M0,0 A100,100 0 0 1 200,0');\n` +
        `    offset-anchor: 50% 0%;       /* 顶部中点 */\n` +
        `    offset-rotate: auto;         /* 围绕顶部中点旋转 */\n` +
        `    animation: swing 2s ease-in-out infinite alternate;\n` +
        `  }\n` +
        `  @keyframes swing {\n` +
        `    from { offset-distance: 0%; }\n` +
        `    to   { offset-distance: 100%; }\n` +
        `  }\n` +
        `\n` +
        `  /* 与 transform-origin 对比 */\n` +
        `  .mover-with-transform {\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    offset-anchor: center;       /* 路径对齐点：中心 */\n` +
        `    offset-rotate: auto;         /* 围绕 center 旋转 */\n` +
        `    transform-origin: top left;  /* 额外 transform 的旋转中心：左上角 */\n` +
        `    transform: scale(1.2);       /* scale 围绕左上角，offset 围绕中心 */\n` +
        `  }`;
    } catch (err: any) {
      return `读取 offset-anchor 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setAnchor(mode: any): void  {
    this._anchorMode = mode;
    const val = mode === 'auto' ? 'auto' : mode;
    this._injectStyle('css-motion-path-anchor-dynamic',
      `.mp-anchor-mover { offset-anchor: ${val}; }`);
    this.setState({ anchorInfo: this._readAnchorInfo() });
    this._addLog('anchor', `切换 offset-anchor → ${mode}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. offset-anchor 锚点 —— 元素哪个点对齐路径',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['offset-anchor', f.offsetAnchor]]),
        h(Tag, { color: 'primary' }, '<position>'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'offset-anchor 指定元素的"哪个点"对齐到路径上：<position> 语法（与 background-position 共用）。center（默认，元素中心对齐路径）/ 0% 0%（左上角）/ 100% 100%（右下角）/ 50% 0%（顶部中点）。与 transform-origin 区别：transform-origin 影响 transform 变换中心，offset-anchor 影响 offset-path 运动时元素对齐路径的点；但 offset-rotate: auto 旋转时，旋转中心由 offset-anchor 决定。默认值 auto：若 offset-position 非 auto 则等于 offset-position，否则为 center。适合"钟摆""旗帜飘动""吊灯摇晃"等场景。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ anchorInfo: this._readAnchorInfo() }) }),
          this._btn('auto', { type: 'primary', size: 'sm', disabled: !f.offsetAnchor, onClick: () => this._setAnchor('auto') }),
          this._btn('center', { size: 'sm', disabled: !f.offsetAnchor, onClick: () => this._setAnchor('center') }),
          this._btn('0% 0%', { size: 'sm', disabled: !f.offsetAnchor, onClick: () => this._setAnchor('0% 0%') }),
          this._btn('100% 100%', { size: 'sm', disabled: !f.offsetAnchor, onClick: () => this._setAnchor('100% 100%') }),
          this._btn('50% 0%', { size: 'sm', disabled: !f.offsetAnchor, onClick: () => this._setAnchor('50% 0%') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'offset-anchor 演示（绿色方块的红点为锚点，当前 ' + this._anchorMode + '）：'),
        h('div', { class: 'mp-anchor-stage' },
          h('svg', { viewBox: '0 0 400 120', preserveAspectRatio: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } },
            h('path', { d: 'M20,80 C80,20 200,20 360,80', stroke: '#10b981', 'stroke-width': '2', fill: 'none', 'stroke-dasharray': '4,4' }),
          ),
          h('div', { class: 'mp-anchor-mover' }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.anchorInfo || '（点击按钮切换 offset-anchor 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'offset-anchor 决定元素哪个点对齐路径，offset-rotate: auto 时围绕该点旋转',
          description: '与 transform-origin 区别：transform-origin 影响 transform 变换中心，offset-anchor 影响 offset-path 对齐点。但 offset-rotate: auto 旋转时，旋转中心由 offset-anchor 决定。offset-anchor: 50% 0%（顶部中点）+ auto 实现"钟摆"效果（元素悬挂在路径下方，围绕顶部中点旋转）。默认 auto：若 offset-position 非 auto 则等于 offset-position，否则为 center。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 8：实战与陷阱 ===================

  _readPatternsInfo(): any {
    const f = this._flags();
    try {
      return `===== CSS Motion Path 实战与陷阱 =====\n` +
        `\n` +
        `【场景 1：沿 SVG 路径运动动画】\n` +
        `  最经典用法：用 path() 定义路径，动画 offset-distance\n` +
        `  .train {\n` +
        `    offset-path: path('M0,100 C100,0 200,0 300,100');\n` +
        `    offset-rotate: auto;\n` +
        `    animation: travel 6s linear infinite;\n` +
        `  }\n` +
        `  @keyframes travel {\n` +
        `    from { offset-distance: 0%; }\n` +
        `    to   { offset-distance: 100%; }\n` +
        `  }\n` +
        `\n` +
        `【场景 2：引导线动画】\n` +
        `  箭头沿引导线移动指引视线\n` +
        `  .guide-arrow {\n` +
        `    offset-path: path('M10,10 L200,10 L200,100 L390,100');\n` +
        `    offset-rotate: auto;\n` +
        `    animation: guide 3s ease-in-out infinite;\n` +
        `  }\n` +
        `  @keyframes guide {\n` +
        `    0%, 20%   { offset-distance: 0%; }\n` +
        `    80%, 100% { offset-distance: 100%; }\n` +
        `  }\n` +
        `\n` +
        `【场景 3：徽章飘动】\n` +
        `  促销/活动徽章沿曲线飘动吸引注意\n` +
        `  .promo-badge {\n` +
        `    offset-path: path('M0,40 C100,0 200,80 360,40');\n` +
        `    offset-rotate: 0deg;       /* 徽章不旋转，保持水平 */\n` +
        `    animation: float 4s ease-in-out infinite alternate;\n` +
        `  }\n` +
        `  @keyframes float {\n` +
        `    from { offset-distance: 0%; }\n` +
        `    to   { offset-distance: 100%; }\n` +
        `  }\n` +
        `\n` +
        `【场景 4：与 CSS Animations @keyframes 配合】\n` +
        `  offset-* 属性可在 @keyframes 中动画\n` +
        `  @keyframes orbit {\n` +
        `    from { offset-distance: 0%; }\n` +
        `    50%  { offset-distance: 50%; offset-rotate: auto 180deg; }\n` +
        `    to   { offset-distance: 100%; }\n` +
        `  }\n` +
        `  .planet {\n` +
        `    offset-path: circle(50% at 50% 50%);\n` +
        `    animation: orbit 8s linear infinite;\n` +
        `  }\n` +
        `\n` +
        `【场景 5：offset 简写】\n` +
        `  offset 简写可同时设置 offset-position / offset-path / offset-distance /\n` +
        `    offset-rotate / offset-anchor\n` +
        `  .mover {\n` +
        `    offset: path('M0,0 L300,0') 50% auto;  /* path distance rotate */\n` +
        `  }\n` +
        `  等价于：\n` +
        `    offset-path: path('M0,0 L300,0');\n` +
        `    offset-distance: 50%;\n` +
        `    offset-rotate: auto;\n` +
        `\n` +
        `【陷阱 1：浏览器降级（旧 motion-path 前缀）】\n` +
        `  老版本 Chrome（< 55）使用 motion-path / motion-offset / motion-rotation\n` +
        `  需加 -webkit- 前缀或同时写 motion-* 与 offset-*\n` +
        `  .mover {\n` +
        `    -webkit-motion-path: path('M0,0 L100,100');\n` +
        `    motion-path: path('M0,0 L100,100');\n` +
        `    offset-path: path('M0,0 L100,100');\n` +
        `  }\n` +
        `  检测：CSS.supports('offset-path','path("M0,0")') || CSS.supports('motion-path','path("M0,0")')\n` +
        `\n` +
        `【陷阱 2：DevTools 调试】\n` +
        `  Chrome DevTools Elements 面板可查看 offset-path 计算值\n` +
        `  Animations 面板可调试 offset-distance 动画时间线\n` +
        `  但 DevTools 不直接可视化路径（需配合 SVG <path> 叠加显示）\n` +
        `  调试技巧：临时加一个 SVG <path> 用相同 d 属性可视化路径\n` +
        `\n` +
        `【陷阱 3：性能（GPU 加速 transform）】\n` +
        `  offset-path 运动本质是 transform，由 GPU 合成层加速\n` +
        `  不会触发 layout / paint，性能优于 top/left 动画\n` +
        `  但 offset-rotate: auto 会改变 transform，仍需注意合成层爆炸\n` +
        `  优化：will-change: transform 提示浏览器创建合成层\n` +
        `  优化：避免大量元素同时 offset-path 动画（合成层过多导致内存爆炸）\n` +
        `\n` +
        `【陷阱 4：与 Web Animations API 协同】\n` +
        `  Element.animate() 可直接动画 offset-distance\n` +
        `  element.animate([\n` +
        `    { offsetDistance: '0%' },\n` +
        `    { offsetDistance: '100%' }\n` +
        `  ], { duration: 4000, iterations: Infinity });\n` +
        `  注意：JS 属性名为 offsetDistance（驼峰），CSS 属性名为 offset-distance\n` +
        `  优势：可用 JS 动态控制（暂停/反转/跳转），比 @keyframes 灵活\n` +
        `\n` +
        `【陷阱 5：与 transform: translate() 组合注意事项】\n` +
        `  offset-* 生成的 transform 与手写 transform: translate() 会叠加\n` +
        `  顺序：offset-* 先应用（沿路径位移 + 旋转），再叠加 transform\n` +
        `  即 final-transform = transform(offset) ∘ transform(manual)\n` +
        `  注意：transform: translate(100px,0) 会让元素"额外"偏移 100px\n` +
        `  若只想沿路径运动，不要叠加 transform: translate()\n` +
        `  若需缩放/旋转，可用 transform: scale() rotate()（不冲突）\n` +
        `\n` +
        `【能力检测】\n` +
        `  offset-path:path()     = ${f.offsetPathPath}\n` +
        `  offset-path:ray()      = ${f.offsetPathRay}\n` +
        `  offset-distance        = ${f.offsetDistance}\n` +
        `  offset-rotate:auto     = ${f.offsetRotateAuto}\n` +
        `  offset-position        = ${f.offsetPosition}\n` +
        `  offset-anchor          = ${f.offsetAnchor}\n` +
        `  offset 简写            = ${f.offsetShorthand}`;
    } catch (err: any) {
      return `读取 实战与陷阱 信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPatternsDemo(): void {
    this.setState({ patternsInfo: this._readPatternsInfo() });
    const f = this._flags();
    this._addLog('patterns', `实战与陷阱演示：path=${f.offsetPathPath}, ray=${f.offsetPathRay}, 简写=${f.offsetShorthand}`);
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战与陷阱 —— 沿路径运动 / 引导线 / 徽章飘动 / 简写 / 降级',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['offset-path', f.offsetPathPath],
          ['offset 简写', f.offsetShorthand],
        ]),
        h(Tag, { color: 'primary' }, '5 场景 + 5 陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '五大实战场景：沿 SVG 路径运动动画（path() + offset-distance 动画）、引导线动画（箭头沿折线指引视线）、徽章飘动（促销徽章沿曲线飘动，offset-rotate: 0deg 保持水平）、与 CSS @keyframes 配合（offset-* 可在 keyframes 动画）、offset 简写（同时设置 path/distance/rotate）。五大陷阱：浏览器降级（老 Chrome 用 motion-path，需 -webkit- 前缀）、DevTools 调试（不直接可视化路径，需 SVG 叠加）、性能（GPU 加速 transform，但合成层爆炸风险）、与 Web Animations API 协同（offsetDistance 驼峰）、与 transform: translate() 组合（offset-* 先应用，再叠加 transform）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战与陷阱演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPatternsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '徽章飘动演示（橙色徽章沿复杂路径来回飘动，offset-rotate: auto）：'),
        h('div', { class: 'mp-badge-stage' },
          h('svg', { viewBox: '0 0 480 160', preserveAspectRatio: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } },
            h('path', { d: 'M20,40 C100,120 200,10 360,80 C400,110 420,40 460,60', stroke: 'rgba(255,255,255,0.2)', 'stroke-width': '1', fill: 'none', 'stroke-dasharray': '3,3' }),
          ),
          h('div', { class: 'mp-badge' }, 'PROMO'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternsInfo || '（点击按钮查看 5 大实战场景与 5 大陷阱完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'offset-* 与 transform: translate() 会叠加，注意组合顺序',
          description: 'offset-* 生成的 transform 先应用（沿路径位移 + 旋转），再叠加手写 transform。若只想沿路径运动，不要叠加 transform: translate()（会额外偏移）。transform: scale()/rotate() 不冲突可叠加。性能：offset-path 本质是 transform，GPU 加速，但 offset-rotate: auto 改变 transform 需注意合成层爆炸（大量元素同时动画）。老 Chrome（< 55）用 motion-path，需 -webkit- 前缀或 JS 兜底（GSAP MotionPathPlugin）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板（按时间倒序，最新在前） ===================

  _renderLogPanel(): Node | string {
    const s = this.state;
    return h('div', { class: 'mp-log-panel' },
      h('div', { class: 'flex items-center gap-sm mb-sm' },
        h('span', { class: 'fs-sm text-secondary' }, '事件日志'),
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'fs-sm text-secondary' }, '（暂无日志）')
        : h('div', { class: 'mp-log-list' },
            ...s.logs.slice().reverse().map((log) =>
              h('div', { class: `mp-log-item mp-log-${log.type}` },
                h('span', { class: 'mp-log-time' }, log.time),
                h('span', {}, log.content),
              ),
            ),
          ),
    );
  }

  // =================== 整页渲染 ===================

  render(): Node {
    const s = this.state;
    return h('div', { class: 'api-lab-page css-motion-path-page' },
      h('h2', { class: 'section-title' }, 'CSS Motion Path Module Level 1 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Motion Path Module Level 1 路径运动动画：offset-path 路径定义（path()/ray()/basic-shape/coord-box）、path() 函数与 SVG 路径（M/L/C/Q/A/Z 命令）、ray() 射线函数（极坐标）、offset-distance 偏移距离（0%~100%）、offset-rotate 与 offset-position（auto/reverse/<angle>）、offset-anchor 锚点、实战与陷阱（沿路径运动/引导线/徽章飘动/简写/降级）。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard7(),
      this._renderCard8(),
      this._renderLogPanel(),
    );
  }
}
