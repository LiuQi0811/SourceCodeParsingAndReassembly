// =====================================================================
// CSSTransforms3DDeepPage.js —— CSS Transforms & 3D 深度 实验室
// 完整覆盖 CSS Transforms Module Level 1 + Level 2 全套能力，让元素
// 在 2D / 3D 空间中平移、缩放、旋转、倾斜，是现代 Web 动画与视觉效果
// 的基石（GPU 合成层、60fps 动画、3D 翻转卡片、视差滚动都依赖它）：
//   1. transform 属性 + 2D 变换函数
//      translate(x,y) / translateX / translateY（位移，% 为自身尺寸）
//      scale(x,y) / scaleX / scaleY（缩放，1 = 原始，无单位）
//      rotate(angle)（旋转，deg / turn / rad）
//      skew(x,y) / skewX / skewY（倾斜）
//      matrix(a,b,c,d,e,f)（2D 6 值矩阵）
//      多函数组合从右到左执行：translate(10px,20px) rotate(45deg) scale(1.5)
//      transform-origin：变换原点（默认 center center）
//   2. translate / rotate / scale 独立属性（CSS Transforms L2 新特性）
//      translate: 50px 100px; （独立属性，无需 transform）
//      rotate: 45deg;   scale: 1.5;
//      优势：性能更好（独立合成层）、动画更高效、不互相覆盖
//      浏览器支持：Chrome 104+ / Firefox 72+ / Safari 14.1+
//   3. 3D 变换函数全集
//      perspective(n) / rotateX / rotateY / rotateZ / rotate3d(x,y,z,angle)
//      translateZ / translate3d / scaleZ / scale3d / matrix3d(16 值)
//   4. transform-style: preserve-3d（保留 3D 子元素空间）
//      flat（默认）vs preserve-3d；preserve-3d 的限制（overflow/opacity/filter/clip 会破坏 3D 上下文）
//   5. backface-visibility: hidden（3D 翻转卡片核心）
//      visible（默认）/ hidden；3D 翻转卡片完整实现
//   6. perspective 属性 vs perspective() 函数
//      perspective: 800px 设在父元素（统一视点）
//      transform: perspective(800px) 设在元素自身（独立视点）
//      perspective-origin：消失点（默认 center center）
//   7. will-change / 合成层 / 性能优化
//      transform 触发合成层（GPU 加速）；will-change: transform 提示优化
//      动画属性优先级：transform / opacity > 其他；translateZ(0) hack
//   8. 实战效果合集
//      3D 翻转卡片 / 3D 立方体 / 视差滚动 / 卡片悬浮 3D 倾斜 /
//      翻页动画 / 缩放放大镜 / 图标弹跳 / 加载动画
// 说明：jsdom 不做真实布局，但 CSS.supports 可探测属性/选择器支持；
//       注入演示样式 + 完整代码示例，真实浏览器可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSTransforms3DDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  basicsInfo: string;
  independentInfo: string;
  transform3dInfo: string;
  preserve3dInfo: string;
  backfaceInfo: string;
  perspectiveInfo: string;
  willChangeInfo: string;
  patternInfo: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSTransforms3DDeepPage extends Page {
  declare state: CSSTransforms3DDeepPageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];


  initialState(): CSSTransforms3DDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      basicsInfo: '',         // Card 1：transform 基础与 2D 变换函数
      independentInfo: '',    // Card 2：translate / rotate / scale 独立属性
      transform3dInfo: '',    // Card 3：3D 变换函数全集
      preserve3dInfo: '',     // Card 4：transform-style: preserve-3d
      backfaceInfo: '',       // Card 5：backface-visibility 与 3D 翻转卡片
      perspectiveInfo: '',    // Card 6：perspective 深度与视觉原理
      willChangeInfo: '',     // Card 7：will-change / 合成层 / 性能优化
      patternInfo: '',        // Card 8：实战效果合集
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `transform ${c(f.transform)}`,
      `transform3d ${c(f.transform3d)}`,
      `perspective ${c(f.perspective)}`,
      `transform-style ${c(f.transformStyle)}`,
      `backface-visibility ${c(f.backfaceVisibility)}`,
      `translate ${c(f.translateProp)}`,
      `rotate ${c(f.rotateProp)}`,
      `scale ${c(f.scaleProp)}`,
      `will-change ${c(f.willChange)}`,
      `transform-origin ${c(f.transformOrigin)}`,
      `perspective-origin ${c(f.perspectiveOrigin)}`,
      `matrix3d ${c(f.matrix3d)}`,
    ];

    const summary = f.css
      ? `CSS Transforms & 3D 能力检测：${parts.join(' · ')}。jsdom 不做真实布局，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看 3D 翻转 / 立方体 / 视差等效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.transform3d) this._addLog('warn', '3D transform 不可用（IE10+ / 所有现代浏览器支持，需 -webkit- 前缀的历史方案已淘汰）');
    if (!f.translateProp) this._addLog('warn', 'translate 独立属性不可用（Chrome 104+ / Firefox 72+ / Safari 14.1+）');
    if (!f.transformStyle) this._addLog('warn', 'transform-style: preserve-3d 不可用（3D 立方体等结构依赖此属性）');

    this._injectBaseStyles();
  }

  componentWillUnmount(): void {
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: BtnOpts): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  _caps(): any;
  _caps(items: [string, boolean][]): Node[];
  _caps(items?: [string, boolean][]): any {
    return items!.map(([label, ok]: [string, boolean]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id: any,css: any) {
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _injectBaseStyles(): void {
    this._injectStyle('css-transforms-base', `
      .tf-demo { position: relative; padding: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 10px; }
      .tf-stage {
        position: relative;
        width: 100%;
        min-height: 120px;
        background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 10px, #e2e8f0 10px, #e2e8f0 20px);
        border-radius: 6px;
        margin-top: 10px;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 16px;
      }
      .tf-box {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #3b82f6, #1e40af);
        color: #fff;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 4px 10px rgba(30, 64, 175, 0.3);
      }
      .tf-box.tf-alt { background: linear-gradient(135deg, #ef4444, #b91c1c); }
      .tf-box.tf-green { background: linear-gradient(135deg, #10b981, #047857); }
      .tf-box.tf-purple { background: linear-gradient(135deg, #a855f7, #6b21a8); }
      .tf-label {
        font-size: 11px;
        color: #475569;
        text-align: center;
        margin-top: 4px;
      }
      .tf-cell { display: flex; flex-direction: column; align-items: center; }
      .tf-origin {
        transform: rotate(15deg);
        transform-origin: top left;
      }
      .tf-translate { transform: translate(20px, 10px); }
      .tf-scale { transform: scale(1.4); }
      .tf-rotate { transform: rotate(30deg); }
      .tf-skew { transform: skew(15deg, 5deg); }
      .tf-combo { transform: translate(10px, 0) rotate(45deg) scale(1.2); }
      .tf-ind-translate { translate: 20px 10px; }
      .tf-ind-rotate { rotate: 30deg; }
      .tf-ind-scale { scale: 1.4; }
      .tf-3d-stage { perspective: 800px; }
      .tf-3d-rotatex { transform: rotateX(45deg); }
      .tf-3d-rotatey { transform: rotateY(45deg); }
      .tf-3d-rotatez { transform: rotateZ(45deg); }
      .tf-3d-translatez { transform: translateZ(60px); }
      .tf-3d-stage .tf-box { transform-style: preserve-3d; }
      .tf-flip-card {
        width: 120px;
        height: 80px;
        perspective: 800px;
        cursor: pointer;
      }
      .tf-flip-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transition: transform 0.6s;
        transform-style: preserve-3d;
      }
      .tf-flip-card:hover .tf-flip-inner {
        transform: rotateY(180deg);
      }
      .tf-flip-front, .tf-flip-back {
        position: absolute;
        inset: 0;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
      }
      .tf-flip-front { background: linear-gradient(135deg, #3b82f6, #1e40af); }
      .tf-flip-back { background: linear-gradient(135deg, #ef4444, #b91c1c); transform: rotateY(180deg); }
      .tf-cube-stage {
        perspective: 800px;
        width: 100px;
        height: 100px;
        margin: 30px auto;
      }
      .tf-cube {
        position: relative;
        width: 100px;
        height: 100px;
        transform-style: preserve-3d;
        animation: tf-cube-rotate 12s infinite linear;
      }
      .tf-cube-face {
        position: absolute;
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        border: 2px solid rgba(255, 255, 255, 0.3);
        opacity: 0.85;
      }
      .tf-cube-front  { background: #3b82f6; transform: translateZ(50px); }
      .tf-cube-back   { background: #ef4444; transform: rotateY(180deg) translateZ(50px); }
      .tf-cube-right  { background: #10b981; transform: rotateY(90deg) translateZ(50px); }
      .tf-cube-left   { background: #f59e0b; transform: rotateY(-90deg) translateZ(50px); }
      .tf-cube-top    { background: #a855f7; transform: rotateX(90deg) translateZ(50px); }
      .tf-cube-bottom { background: #ec4899; transform: rotateX(-90deg) translateZ(50px); }
      @keyframes tf-cube-rotate {
        from { transform: rotateX(0) rotateY(0) rotateZ(0); }
        to   { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg); }
      }
      .tf-output {
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
      .tf-perspective-row {
        display: flex;
        gap: 12px;
        margin-top: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }
      .tf-perspective-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .tf-perspective-cell .tf-box { transform: rotateY(45deg); }
      .tf-perspective-cell.tf-p1 { perspective: 300px; }
      .tf-perspective-cell.tf-p2 { perspective: 800px; }
      .tf-perspective-cell.tf-p3 { perspective: 2000px; }
    `);
  }

  _flags(): any {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: string, v: string) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      transform: supportsPV('transform', 'rotate(45deg)'),
      transform3d: supportsPV('transform', 'translate3d(0,0,0)'),
      perspective: supportsPV('perspective', '800px'),
      transformStyle: supportsPV('transform-style', 'preserve-3d'),
      backfaceVisibility: supportsPV('backface-visibility', 'hidden'),
      translateProp: supportsPV('translate', '10px 20px'),
      rotateProp: supportsPV('rotate', '45deg'),
      scaleProp: supportsPV('scale', '1.5'),
      willChange: supportsPV('will-change', 'transform'),
      transformOrigin: supportsPV('transform-origin', 'center center'),
      perspectiveOrigin: supportsPV('perspective-origin', 'center center'),
      matrix3d: supportsPV('transform', 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'),
    };
  }

  // ===================== Card 1：transform 基础与 2D 变换函数 =====================

  _runBasicsDemo(): void {
    const f = this._flags();
    this._injectStyle('tf-basics-demo', `
      .tf-basics-host {
        position: relative;
        padding: 20px;
        background: linear-gradient(135deg, #fef3c7, #fde68a);
        border-radius: 8px;
        margin-top: 10px;
      }
      .tf-basics-host .tf-box {
        background: linear-gradient(135deg, #ef4444, #b91c1c);
      }
      .tf-basics-host .tf-origin-demo {
        transform: rotate(20deg);
        transform-origin: top left;
      }
    `);
    const info = [
      '===== CSS Transforms 基础与 2D 变换函数全集 =====',
      '',
      '【transform 属性本质】',
      '  transform 让元素在视觉上变换（位移/缩放/旋转/倾斜），',
      '  但不影响文档流：元素仍占据变换前的原位置，',
      '  相邻元素不会因为 transform 而 reflow。',
      '',
      '  .box { transform: translate(20px, 0); }',
      '  /* 视觉上向右移 20px，但后续元素不会跟着移动 */',
      '',
      '【transform-origin：变换原点】',
      '  默认 center center（元素中心）',
      '  可用 length / percentage / keyword：',
      '    transform-origin: top left;          /* 左上角 */',
      '    transform-origin: 0 0;                /* 等价 top left */',
      '    transform-origin: 50% 100%;           /* 底边中点 */',
      '    transform-origin: 20px 30px;          /* 距左 20px 距顶 30px */',
      '    transform-origin: right bottom 50px;  /* 三维原点（含 Z 轴）*/',
      '  旋转/缩放/倾斜都绕原点进行，原点不同效果差异巨大',
      '',
      '【2D 变换函数全集】',
      '',
      '  —— translate（位移，% 为自身尺寸百分比）——',
      '    translate(x, y)         // 同时移 x、y',
      '    translateX(n)           // 仅 x 方向',
      '    translateY(n)           // 仅 y 方向',
      '    translate(50%, 0)       // x 方向移自身宽的 50%',
      '    translate(100%, 100%)   // 完全移出右下方',
      '',
      '  —— scale（缩放，1 = 原始，无单位）——',
      '    scale(x, y)             // 同时缩 x、y',
      '    scale(1.5)              // 等价 scale(1.5, 1.5)',
      '    scaleX(2)               // 仅水平方向放大 2 倍',
      '    scaleY(0.5)             // 仅垂直方向缩小一半',
      '    scale(-1)               // 镜像翻转（左右翻转）',
      '',
      '  —— rotate（旋转）——',
      '    rotate(angle)           // 顺时针为正',
      '    rotate(45deg)           // 常用度数',
      '    rotate(0.5turn)         // 0.5 圈 = 180deg',
      '    rotate(1.57rad)         // 弧度（π/2 ≈ 90deg）',
      '    rotate(-90deg)          // 逆时针 90 度',
      '',
      '  —— skew（倾斜）——',
      '    skew(x-angle, y-angle)  // 同时倾斜 x、y',
      '    skewX(15deg)            // 仅 x 方向倾斜',
      '    skewY(10deg)            // 仅 y 方向倾斜',
      '    skew(15deg, 5deg)       // 双向倾斜',
      '',
      '  —— matrix（2D 6 值矩阵）——',
      '    matrix(a, b, c, d, e, f)',
      '    // 对应变换矩阵：',
      '    //   | a c e |',
      '    //   | b d f |',
      '    //   | 0 0 1 |',
      '    // a/d = 缩放，b/c = 倾斜，e/f = 位移',
      '    matrix(1, 0, 0, 1, 50, 30)   // 等价 translate(50px, 30px)',
      '    matrix(2, 0, 0, 2, 0, 0)     // 等价 scale(2)',
      '    matrix(0.7, 0.7, -0.7, 0.7, 0, 0)  // 约等价 rotate(45deg)',
      '',
      '【多函数组合：从右到左执行】',
      '  transform: translate(10px, 20px) rotate(45deg) scale(1.5);',
      '  执行顺序：先 scale(1.5) → 再 rotate(45deg) → 最后 translate(10px, 20px)',
      '  // 注意：先缩放旋转再位移 vs 先位移再缩放旋转，效果完全不同',
      '  // 矩阵乘法不满足交换律：M1·M2 ≠ M2·M1',
      '',
      '  实战：先缩放后位移会让位移距离也被缩放：',
      '    transform: translate(100px, 0) scale(2);  // 视觉位移 200px',
      '    transform: scale(2) translate(100px, 0);  // 视觉位移 100px',
      '',
      '【transform vs position: relative】',
      '  position: relative; top: 20px;',
      '    → 元素视觉位置改变，但仍占据原位置',
      '    → 影响 layout（其他元素按原位置排版）',
      '    → 可被滚动 / 影响包含块',
      '  transform: translateY(20px);',
      '    → 元素视觉位置改变，仍占据原位置',
      '    → 不影响 layout（仅 paint + composite 阶段）',
      '    → 性能更好（GPU 合成层）',
      '    → 创建新的包含块（fixed 子元素相对它定位）',
      '    → 创建新的层叠上下文（stacking context）',
      '',
      '【完整代码示例：5 种 2D 变换对比】',
      '  <div class="stage">',
      '    <div class="box box-translate">translate(20px,10px)</div>',
      '    <div class="box box-scale">scale(1.4)</div>',
      '    <div class="box box-rotate">rotate(30deg)</div>',
      '    <div class="box box-skew">skew(15deg,5deg)</div>',
      '    <div class="box box-combo">combo</div>',
      '  </div>',
      '',
      '  .box { width: 64px; height: 64px; background: #3b82f6; }',
      '  .box-translate { transform: translate(20px, 10px); }',
      '  .box-scale     { transform: scale(1.4); }',
      '  .box-rotate    { transform: rotate(30deg); }',
      '  .box-skew      { transform: skew(15deg, 5deg); }',
      '  .box-combo     { transform: translate(10px, 0) rotate(45deg) scale(1.2); }',
      '',
      '【浏览器支持】',
      `  transform: ${f.transform ? '✓' : '✗'} (IE9+ / 所有现代浏览器)`,
      `  transform-origin: ${f.transformOrigin ? '✓' : '✗'}`,
      '  规范：https://www.w3.org/TR/css-transforms-1/',
    ].join('\n');
    this.setState({ basicsInfo: info });
    this._addLog('css', `transform 2D 基础演示完成；supports=${f.transform}/${f.transformOrigin}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. transform 基础与 2D 变换函数全集',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['transform', f.transform],
          ['transform-origin', f.transformOrigin],
        ]),
        h(Tag, { color: 'primary' }, 'Transforms L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transform 让元素在视觉上变换但不影响文档流（仍占据原位置）。transform-origin 设变换原点（默认 center center，可用 length/percentage/keyword）。2D 函数全集：translate/translateX/translateY（位移，% 为自身尺寸）、scale/scaleX/scaleY（缩放，1=原始）、rotate（旋转，deg/turn/rad）、skew/skewX/skewY（倾斜）、matrix(a,b,c,d,e,f)（2D 6 值矩阵）。多函数组合从右到左执行（矩阵乘法不可交换）。与 position:relative 区别：transform 不影响 layout，且会创建新包含块和层叠上下文。',
        ),
        h('div', { class: 'tf-stage' },
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-translate' }, 'T'),
            h('div', { class: 'tf-label' }, 'translate(20px,10px)'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-scale' }, 'S'),
            h('div', { class: 'tf-label' }, 'scale(1.4)'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-rotate' }, 'R'),
            h('div', { class: 'tf-label' }, 'rotate(30deg)'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-skew' }, 'K'),
            h('div', { class: 'tf-label' }, 'skew(15deg,5deg)'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-combo' }, 'C'),
            h('div', { class: 'tf-label' }, 'translate+rotate+scale'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 2D 变换演示', { type: 'primary', size: 'sm', onClick: () => this._runBasicsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.basicsInfo || '（点击按钮查看 transform 基础与 2D 变换函数完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：translate / rotate / scale 独立属性 =====================

  _runIndependentDemo(): void {
    const f = this._flags();
    const info = [
      '===== translate / rotate / scale 独立属性（CSS Transforms Level 2）=====',
      '',
      '【动机】',
      '  transform 是单一属性，多个动画同时改 transform 会互相覆盖：',
      '    @keyframes moveX { to { transform: translateX(100px); } }',
      '    @keyframes spin  { to { transform: rotate(360deg); } }',
      '    .box { animation: moveX 2s, spin 2s; }',
      '    // 两个动画都设 transform，后者覆盖前者，moveX 失效',
      '  Level 2 拆出 translate / rotate / scale 三个独立属性解决此问题。',
      '',
      '【语法】',
      '  translate: <x> <y>?;       // 1 或 2 值，y 缺省为 0',
      '    translate: 50px 100px;',
      '    translate: 50%;           // 仅 x，y 为 0',
      '    translate: none;          // 清除',
      '',
      '  rotate: <angle> | <angle> <axis>;  // 可选轴（如 x | y | z）',
      '    rotate: 45deg;',
      '    rotate: 1turn;',
      '    rotate: 45deg Y;          // 绕 Y 轴（Level 2 新增）',
      '',
      '  scale: <x> <y>?;            // 1 或 2 值，y 缺省等于 x',
      '    scale: 1.5;',
      '    scale: 2 0.5;             // x 方向 2 倍，y 方向 0.5 倍',
      '    scale: -1;                // 镜像',
      '',
      '【与 transform 的组合规则（优先级）】',
      '  浏览器先应用 translate/rotate/scale 独立属性，再应用 transform：',
      '    最终矩阵 = transform · scale · rotate · translate',
      '  即 transform 在最外层，会覆盖独立属性（同名效果时）：',
      '    .box {',
      '      translate: 50px 0;',
      '      transform: translate(100px, 0);   // 这会覆盖独立 translate',
      '    }',
      '    // 视觉位移 100px（transform 起作用）',
      '',
      '  // 但独立属性仍可用于动画分离：',
      '  @keyframes moveX { to { translate: 100px 0; } }',
      '  @keyframes spin  { to { rotate: 360deg; } }',
      '  .box { animation: moveX 2s, spin 2s; }  // 两个动画互不冲突',
      '',
      '【性能优势：独立合成层】',
      '  独立属性触发独立的合成层（compositing layer），',
      '  动画时仅合成层重绘，不触发 layout / paint：',
      '    - transform: 子像素抗锯齿可能略有差异',
      '    - translate: 子像素渲染更精确',
      '  实测 60fps 动画：translate/rotate/scale ≥ transform > top/left',
      '',
      '【浏览器支持】',
      `  translate: ${f.translateProp ? '✓' : '✗'} (Chrome 104+ / Firefox 72+ / Safari 14.1+)`,
      `  rotate: ${f.rotateProp ? '✓' : '✗'}`,
      `  scale: ${f.scaleProp ? '✓' : '✗'}`,
      '  早期 Safari 14.1 仅支持单值，14.5 起完整支持',
      '',
      '【实战：用独立属性做 hover 动画比 transform 更高效】',
      '  /* 传统 transform：每次都要重算整个 transform 字符串 */',
      '  .btn { transform: translate(0, 0); transition: transform 0.2s; }',
      '  .btn:hover { transform: translate(0, -2px) scale(1.05); }',
      '',
      '  /* 独立属性：分别动画，互不干扰 */',
      '  .btn {',
      '    translate: 0 0;',
      '    scale: 1;',
      '    transition: translate 0.2s, scale 0.2s;',
      '  }',
      '  .btn:hover {',
      '    translate: 0 -2px;',
      '    scale: 1.05;',
      '  }',
      '',
      '  /* JS 单独改某个变换无需拼接字符串 */',
      '  el.style.translate = "50px 0";    // 只改位移',
      '  el.style.rotate = "45deg";        // 只改旋转',
      '  el.style.scale = "1.5";           // 只改缩放',
      '',
      '【CSS Transforms Level 2 其他新特性】',
      '  - 独立属性 translate / rotate / scale',
      '  - rotate 支持轴向：rotate: 45deg Y',
      '  - transform-path（沿路径变换，早期提案）',
      '  - individual transform properties 已是稳定特性',
      '',
      '【完整代码示例：3 种独立属性对比 transform】',
      '  <div class="stage">',
      '    <div class="box ind-translate">translate: 20px 10px</div>',
      '    <div class="box ind-rotate">rotate: 30deg</div>',
      '    <div class="box ind-scale">scale: 1.4</div>',
      '  </div>',
      '',
      '  .ind-translate { translate: 20px 10px; }',
      '  .ind-rotate    { rotate: 30deg; }',
      '  .ind-scale     { scale: 1.4; }',
      '',
      '【迁移建议】',
      '  1. 新项目优先用独立属性做动画',
      '  2. 单次变换仍可用 transform（如纯 rotate 一次性）',
      '  3. 复杂 3D 矩阵必须用 transform（独立属性不支持 matrix）',
      '  4. 老浏览器降级：@supports (translate: 1px) { ... }',
      '',
      '【规范】',
      '  https://drafts.csswg.org/css-transforms-2/',
    ].join('\n');
    this.setState({ independentInfo: info });
    this._addLog('css', `translate/rotate/scale 独立属性演示完成；supports=${f.translateProp}/${f.rotateProp}/${f.scaleProp}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. translate / rotate / scale 独立属性（CSS Transforms Level 2）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['translate', f.translateProp],
          ['rotate', f.rotateProp],
          ['scale', f.scaleProp],
        ]),
        h(Tag, { color: 'primary' }, 'Transforms L2'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Transforms Level 2 拆出 translate/rotate/scale 三个独立属性，解决 transform 多动画互相覆盖问题。优势：性能更好（独立合成层）、动画更高效、JS 单独改某个变换无需拼接字符串。与 transform 组合时优先级：transform 覆盖同名独立属性（最终矩阵 = transform · scale · rotate · translate）。浏览器支持：Chrome 104+/Firefox 72+/Safari 14.1+。',
        ),
        h('div', { class: 'tf-stage' },
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-ind-translate' }, 'T'),
            h('div', { class: 'tf-label' }, 'translate: 20px 10px'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-ind-rotate' }, 'R'),
            h('div', { class: 'tf-label' }, 'rotate: 30deg'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-ind-scale' }, 'S'),
            h('div', { class: 'tf-label' }, 'scale: 1.4'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行独立属性演示', { type: 'primary', size: 'sm', onClick: () => this._runIndependentDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.independentInfo || '（点击按钮查看 translate/rotate/scale 独立属性完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：3D 变换函数全集 =====================

  _runTransform3dDemo(): void {
    const f = this._flags();
    const info = [
      '===== 3D 变换函数全集（CSS Transforms Level 1 & 2）=====',
      '',
      '【perspective(n) —— 透视距离函数（用在 transform 中）】',
      '  transform: perspective(800px) rotateY(45deg);',
      '  // perspective() 必须放在 transform 列表第一位',
      '  // 设定观察者到 Z=0 平面的距离，影响后续 3D 变换的透视效果',
      '  // n 越小透视越强（夸张），越大透视越弱（接近正交）',
      '',
      '【3D 旋转】',
      '  rotateX(angle)            // 绕 X 轴旋转（水平轴，前后翻转）',
      '  rotateY(angle)            // 绕 Y 轴旋转（垂直轴，左右翻转）',
      '  rotateZ(angle)            // 绕 Z 轴旋转（等价 2D rotate）',
      '  rotate3d(x, y, z, angle)  // 绕任意轴（x,y,z 为方向向量，无需归一化）',
      '',
      '  rotateX(45deg)            // 元素顶部向后倾倒',
      '  rotateY(45deg)            // 元素右侧向后旋转',
      '  rotate3d(1, 1, 0, 45deg)  // 绕对角线轴旋转 45 度',
      '  rotate3d(0, 1, 0, 180deg) // 等价 rotateY(180deg)',
      '',
      '【3D 位移】',
      '  translateZ(z)             // 沿 Z 轴位移（朝向/远离观察者）',
      '  translate3d(x, y, z)      // 三维位移',
      '',
      '  translateZ(100px)         // 元素朝观察者拉近 100px（视觉变大）',
      '  translateZ(-100px)        // 远离观察者（视觉变小）',
      '  translate3d(50px, 0, 100px)',
      '',
      '  // 注意：translateZ 必须配合 perspective 才能看到效果',
      '  // 无 perspective 时 Z 轴位移无视觉变化（正交投影）',
      '',
      '【3D 缩放】',
      '  scaleZ(z)                 // 沿 Z 轴缩放（实际很少用，影响立体深度）',
      '  scale3d(x, y, z)          // 三维缩放',
      '',
      '  scale3d(1, 1, 2)          // Z 方向放大 2 倍（影响子元素深度）',
      '',
      '【matrix3d —— 4x4 矩阵（16 值）】',
      '  matrix3d(a1, b1, c1, d1,',
      '           a2, b2, c2, d2,',
      '           a3, b3, c3, d3,',
      '           a4, b4, c4, d4)',
      '  // 对应 4x4 齐次矩阵，可表达任意 3D 仿射变换',
      '  // 单位矩阵：matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)',
      '',
      '  // 等价 translate3d(50px, 30px, 100px):',
      '  matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 50,30,100,1)',
      '',
      '【perspective 属性 vs perspective() 函数 —— 关键区别】',
      '',
      '  —— perspective: 800px（属性，设在父元素）——',
      '    .parent { perspective: 800px; }',
      '    .parent .child { transform: rotateY(45deg); }',
      '    // 所有子元素共享同一消失点（统一视点）',
      '    // 适合 3D 场景：多个元素相对同一相机',
      '',
      '  —— transform: perspective(800px)（函数，设在元素自身）——',
      '    .box { transform: perspective(800px) rotateY(45deg); }',
      '    // 每个元素独立视点（各自有消失点）',
      '    // 适合单个元素 3D 翻转：互不影响',
      '',
      '  // 二者效果差异：',
      '  //   属性版：3 个并排子元素 rotateY(45deg) 看起来朝向同一相机',
      '  //   函数版：3 个元素各自独立翻转，互不影响',
      '  //   做立体卡片阵列用属性版，做单卡片翻转两者皆可',
      '',
      '【3D 坐标系】',
      '  X 轴：水平向右（右手法则，拇指指向 +X）',
      '  Y 轴：垂直向下（注意！CSS Y 轴向下，与数学坐标相反）',
      '  Z 轴：朝向观察者（屏幕外为 +Z）',
      '',
      '  旋转方向（右手法则）：',
      '    rotateX(45deg)：四指从 +Y 转向 +Z（顶部向后倾）',
      '    rotateY(45deg)：四指从 +Z 转向 +X（右侧向后转）',
      '    rotateZ(45deg)：四指从 +X 转向 +Y（顺时针旋转）',
      '',
      '【完整代码示例：5 种 3D 变换对比】',
      '  <div class="stage-3d" style="perspective: 800px;">',
      '    <div class="box box-rx">rotateX(45deg)</div>',
      '    <div class="box box-ry">rotateY(45deg)</div>',
      '    <div class="box box-rz">rotateZ(45deg)</div>',
      '    <div class="box box-tz">translateZ(60px)</div>',
      '  </div>',
      '',
      '  .stage-3d { perspective: 800px; display: flex; gap: 16px; }',
      '  .box-rx { transform: rotateX(45deg); }',
      '  .box-ry { transform: rotateY(45deg); }',
      '  .box-rz { transform: rotateZ(45deg); }',
      '  .box-tz { transform: translateZ(60px); }',
      '',
      '【浏览器支持】',
      `  3D transform: ${f.transform3d ? '✓' : '✗'} (IE10+ / 所有现代浏览器)`,
      `  perspective 属性: ${f.perspective ? '✓' : '✗'}`,
      `  matrix3d: ${f.matrix3d ? '✓' : '✗'}`,
      '  规范：https://drafts.csswg.org/css-transforms-2/',
    ].join('\n');
    this.setState({ transform3dInfo: info });
    this._addLog('css', `3D 变换函数演示完成；supports=${f.transform3d}/${f.perspective}/${f.matrix3d}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. 3D 变换函数全集（rotateX/Y/Z / translate3d / matrix3d）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['3D transform', f.transform3d],
          ['perspective', f.perspective],
          ['matrix3d', f.matrix3d],
        ]),
        h(Tag, { color: 'primary' }, '3D 函数'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '3D 变换函数全集：perspective(n)（透视距离函数，影响后续 3D 变换）、rotateX/Y/Z(angle)（绕三轴旋转）、rotate3d(x,y,z,angle)（绕任意轴）、translateZ/translate3d（3D 位移）、scaleZ/scale3d（3D 缩放）、matrix3d(16 值 4x4 矩阵)。关键区别：perspective: 800px 属性设在父元素（统一视点，所有子元素共享消失点）vs transform: perspective(800px) 函数设在元素自身（独立视点）。3D 坐标系：X 右、Y 下、Z 朝向观察者，旋转遵循右手法则。',
        ),
        h('div', { class: 'tf-stage tf-3d-stage' },
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-3d-rotatex' }, 'X'),
            h('div', { class: 'tf-label' }, 'rotateX(45deg)'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-3d-rotatey' }, 'Y'),
            h('div', { class: 'tf-label' }, 'rotateY(45deg)'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-3d-rotatez' }, 'Z'),
            h('div', { class: 'tf-label' }, 'rotateZ(45deg)'),
          ),
          h('div', { class: 'tf-cell' },
            h('div', { class: 'tf-box tf-3d-translatez' }, 'TZ'),
            h('div', { class: 'tf-label' }, 'translateZ(60px)'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 3D 变换演示', { type: 'primary', size: 'sm', onClick: () => this._runTransform3dDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.transform3dInfo || '（点击按钮查看 3D 变换函数全集完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：transform-style: preserve-3d =====================

  _runPreserve3dDemo(): void {
    const f = this._flags();
    const info = [
      '===== transform-style: preserve-3d 与 3D 空间 =====',
      '',
      '【两个取值】',
      '  transform-style: flat;          // 默认：子元素在 2D 平面渲染',
      '  transform-style: preserve-3d;   // 子元素保留 3D 位置',
      '',
      '  flat：所有 3D 变换的子元素被压平到父元素平面',
      '    .parent { transform: rotateY(45deg); }',
      '    .child  { transform: rotateX(45deg); }',
      '    // 默认 flat：子元素的 rotateX 不会真正立起来',
      '',
      '  preserve-3d：子元素在父元素的 3D 空间内排布',
      '    .parent { transform-style: preserve-3d; transform: rotateY(45deg); }',
      '    .child  { transform: rotateX(45deg); }',
      '    // 子元素真正立起来，与父元素组成 3D 结构',
      '',
      '【preserve-3d 的限制：哪些属性会破坏 3D 上下文】',
      '  以下属性会让 preserve-3d 失效，强制 flat 渲染：',
      '    - overflow: hidden / auto / scroll / clip',
      '    - opacity < 1',
      '    - filter（任何值，如 blur、drop-shadow）',
      '    - clip-path（任何值）',
      '    - mask / mask-image',
      '    - mix-blend-mode（非 normal）',
      '    - isolation: isolate',
      '    - will-change: 上述任一属性',
      '',
      '  // 解决方案：把这些属性设到子元素而非父元素',
      '  // 或用额外 wrapper 隔离',
      '',
      '【3D 坐标系（重申）】',
      '  X 轴：水平向右',
      '  Y 轴：垂直向下（注意与数学坐标相反）',
      '  Z 轴：朝向观察者（屏幕外为 +Z）',
      '',
      '  右手法则：右手拇指指向轴正方向，四指弯曲方向为正旋转方向',
      '',
      '【实战：3D 立方体（6 个面 preserve-3d + 各自 rotateX/Y translateZ）】',
      '  <div class="cube-stage">',
      '    <div class="cube">',
      '      <div class="face face-front">前</div>',
      '      <div class="face face-back">后</div>',
      '      <div class="face face-right">右</div>',
      '      <div class="face face-left">左</div>',
      '      <div class="face face-top">上</div>',
      '      <div class="face face-bottom">下</div>',
      '    </div>',
      '  </div>',
      '',
      '  .cube-stage {',
      '    perspective: 800px;          // 父级透视',
      '    width: 100px; height: 100px;',
      '    margin: 50px auto;',
      '  }',
      '  .cube {',
      '    position: relative;',
      '    width: 100px; height: 100px;',
      '    transform-style: preserve-3d;  // 关键：保留 3D 子元素',
      '    animation: spin 12s infinite linear;',
      '  }',
      '  .face {',
      '    position: absolute;',
      '    width: 100px; height: 100px;',
      '    display: flex; align-items: center; justify-content: center;',
      '    color: #fff; font-weight: 700;',
      '    border: 2px solid rgba(255,255,255,0.3);',
      '  }',
      '',
      '  /* 6 个面分别变换：先旋转到对应方向，再 translateZ 推出 */',
      '  .face-front  { background: #3b82f6; transform: translateZ(50px); }',
      '  .face-back   { background: #ef4444; transform: rotateY(180deg) translateZ(50px); }',
      '  .face-right  { background: #10b981; transform: rotateY(90deg)  translateZ(50px); }',
      '  .face-left   { background: #f59e0b; transform: rotateY(-90deg) translateZ(50px); }',
      '  .face-top    { background: #a855f7; transform: rotateX(90deg)  translateZ(50px); }',
      '  .face-bottom { background: #ec4899; transform: rotateX(-90deg) translateZ(50px); }',
      '',
      '  @keyframes spin {',
      '    from { transform: rotateX(0) rotateY(0); }',
      '    to   { transform: rotateX(360deg) rotateY(360deg); }',
      '  }',
      '',
      '  // 关键点：',
      '  //   1. translateZ(50px) 中的 50 = 立方体边长一半（推出到面位置）',
      '  //   2. 先旋转再 translateZ：旋转改变方向，translateZ 沿新方向推出',
      '  //   3. 父级 .cube 必须有 transform-style: preserve-3d',
      '  //   4. 父级 .cube-stage 必须有 perspective 才能看到 3D 透视',
      '',
      '【其他 3D 结构示例】',
      '  - 3D 卡片堆叠：6 张卡片 rotateY 间隔 60deg + translateZ(100px)',
      '  - 3D 翻书：每页 rotateY，preserve-3d 让封面与内页连续',
      '  - 3D 圆柱：多个面绕 Y 轴均匀分布 + translateZ 推出',
      '  - 3D 球面：用 rotateX + rotateY 组合 + translateZ 形成球壳',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → 选中 3D 元素',
      '    → 右上角"三层彩色方块"图标 → 3D 视图查看立体结构',
      '  Firefox DevTools → 3D 视图（旧版）',
      '',
      '【常见陷阱】',
      '  1. 忘记在父元素设 perspective → 看不到透视，3D 退化成正交',
      '  2. 忘记在中间层设 preserve-3d → 子元素被压平',
      '  3. 中间层有 overflow:hidden → preserve-3d 失效',
      '  4. 旋转顺序错：先 translateZ 再 rotate 会沿原方向推出',
      '',
      '【浏览器支持】',
      `  transform-style: preserve-3d: ${f.transformStyle ? '✓' : '✗'} (IE10+ / 所有现代浏览器)`,
      '  规范：https://drafts.csswg.org/css-transforms-2/#transform-style',
    ].join('\n');
    this.setState({ preserve3dInfo: info });
    this._addLog('css', `transform-style: preserve-3d 演示完成；supports=${f.transformStyle}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. transform-style: preserve-3d 与 3D 空间',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['transform-style', f.transformStyle]]),
        h(Tag, { color: 'primary' }, '3D 空间'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transform-style: flat（默认，子元素压平到父平面）/ preserve-3d（子元素保留 3D 位置，可形成 3D 结构）。preserve-3d 的限制：overflow/opacity<1/filter/clip-path/mask/mix-blend-mode/isolation 会破坏 3D 上下文，强制 flat。3D 坐标系：X 右、Y 下、Z 朝向观察者，旋转遵循右手法则。实战：3D 立方体（6 个面 preserve-3d + 各自 rotateX/Y translateZ 推出）。',
        ),
        h('div', { class: 'tf-cube-stage' },
          h('div', { class: 'tf-cube' },
            h('div', { class: 'tf-cube-face tf-cube-front' }, '前'),
            h('div', { class: 'tf-cube-face tf-cube-back' }, '后'),
            h('div', { class: 'tf-cube-face tf-cube-right' }, '右'),
            h('div', { class: 'tf-cube-face tf-cube-left' }, '左'),
            h('div', { class: 'tf-cube-face tf-cube-top' }, '上'),
            h('div', { class: 'tf-cube-face tf-cube-bottom' }, '下'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 preserve-3d 演示', { type: 'primary', size: 'sm', onClick: () => this._runPreserve3dDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.preserve3dInfo || '（点击按钮查看 transform-style: preserve-3d 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：backface-visibility 与 3D 翻转卡片 =====================

  _runBackfaceDemo(): void {
    const f = this._flags();
    const info = [
      '===== backface-visibility 与 3D 翻转卡片实战 =====',
      '',
      '【两个取值】',
      '  backface-visibility: visible;   // 默认：背面可见',
      '  backface-visibility: hidden;    // 背面隐藏',
      '',
      '  // 当元素 rotateY(180deg) 翻到背面时：',
      '  //   visible：能看到镜像反转的背面内容',
      '  //   hidden：完全不可见，仿佛元素消失',
      '',
      '【3D 翻转卡片完整实现（4 个关键点）】',
      '',
      '  1. 容器设 perspective + transform-style: preserve-3d',
      '  2. 正面和背面绝对定位重叠（inset: 0）',
      '  3. 背面 transform: rotateY(180deg) + backface-visibility: hidden',
      '  4. hover 时容器 rotateY(180deg) 翻转',
      '',
      '【完整 CSS 代码示例】',
      '  <div class="flip-card">',
      '    <div class="flip-inner">',
      '      <div class="flip-front">正面内容</div>',
      '      <div class="flip-back">背面内容</div>',
      '    </div>',
      '  </div>',
      '',
      '  .flip-card {',
      '    width: 240px;',
      '    height: 160px;',
      '    perspective: 800px;          // 1. 容器透视',
      '    cursor: pointer;',
      '  }',
      '  .flip-inner {',
      '    position: relative;',
      '    width: 100%;',
      '    height: 100%;',
      '    transition: transform 0.6s;',
      '    transform-style: preserve-3d; // 2. 内层保留 3D',
      '  }',
      '  .flip-card:hover .flip-inner {',
      '    transform: rotateY(180deg);   // 4. hover 翻转',
      '  }',
      '  .flip-front, .flip-back {',
      '    position: absolute;',
      '    inset: 0;                     // 3. 重叠',
      '    backface-visibility: hidden;  // 3. 背面隐藏',
      '    -webkit-backface-visibility: hidden; // Safari 兼容',
      '    display: flex;',
      '    align-items: center;',
      '    justify-content: center;',
      '    border-radius: 8px;',
      '    color: #fff;',
      '  }',
      '  .flip-front {',
      '    background: linear-gradient(135deg, #3b82f6, #1e40af);',
      '  }',
      '  .flip-back {',
      '    background: linear-gradient(135deg, #ef4444, #b91c1c);',
      '    transform: rotateY(180deg);   // 3. 背面预先翻转',
      '  }',
      '',
      '【工作原理】',
      '  - 初始状态：',
      '    flip-inner 无旋转',
      '    flip-front 朝前可见（rotateY(0)）',
      '    flip-back 朝后不可见（rotateY(180deg) + backface-visibility: hidden）',
      '  - hover 状态：',
      '    flip-inner 旋转 180deg',
      '    flip-front 跟着旋转到背面 → 不可见',
      '    flip-back 跟着旋转回正面 → 可见',
      '  - 整个过程 transition: transform 0.6s 平滑过渡',
      '',
      '【JS 控制翻转（点击切换而非 hover）】',
      '  const card = document.querySelector(".flip-card");',
      '  const inner = card.querySelector(".flip-inner");',
      '  let flipped = false;',
      '  card.addEventListener("click", () => {',
      '    flipped = !flipped;',
      '    inner.style.transform = flipped ? "rotateY(180deg)" : "";',
      '  });',
      '',
      '【横向翻转 vs 纵向翻转】',
      '  rotateY(180deg)：左右翻转（最常见）',
      '  rotateX(180deg)：上下翻转（垂直翻牌效果）',
      '  rotateY(90deg) → rotateY(180deg)：分阶段翻转动画',
      '',
      '【浏览器支持】',
      `  backface-visibility: ${f.backfaceVisibility ? '✓' : '✗'}`,
      '  Safari 需要 -webkit-backface-visibility 前缀（即使是新版本）',
      '  IE10+ 支持 -ms-backface-visibility',
      '  移动端 iOS Safari 早期版本对 3D 翻转有渲染 bug，需测试',
      '',
      '【常见陷阱】',
      '  1. 忘记 transform-style: preserve-3d → 背面不会真正翻转',
      '  2. 正面也漏写 backface-visibility: hidden → 翻转后正面镜像可见',
      '  3. 背面忘写 transform: rotateY(180deg) → 背面与正面重叠显示',
      '  4. 父级有 overflow: hidden → preserve-3d 失效',
      '  5. Safari 渲染抖动：背面加 -webkit-backface-visibility: hidden',
      '  6. 背面内容文字镜像：因 backface-visibility: hidden 才不显示',
      '',
      '【进阶：3D 翻转 + 内容切换】',
      '  // 翻转过程中切换内容，避免镜像文字',
      '  .flip-inner {',
      '    transition: transform 0.6s;',
      '  }',
      '  .flip-back {',
      '    transform: rotateY(180deg);',
      '    backface-visibility: hidden;',
      '  }',
      '  // 文字在背面正常显示（已预先翻转），无需额外处理',
      '',
      '【资源】',
      '  MDN: https://developer.mozilla.org/docs/Web/CSS/backface-visibility',
      '  规范：https://drafts.csswg.org/css-transforms-2/#backface-visibility',
    ].join('\n');
    this.setState({ backfaceInfo: info });
    this._addLog('css', `backface-visibility 与 3D 翻转卡片演示完成；supports=${f.backfaceVisibility}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. backface-visibility 与 3D 翻转卡片实战',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['backface-visibility', f.backfaceVisibility]]),
        h(Tag, { color: 'primary' }, '翻转卡片'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'backface-visibility: visible（默认，背面可见）/ hidden（背面隐藏）。3D 翻转卡片完整实现：(1) 容器 perspective + transform-style: preserve-3d；(2) 正面和背面绝对定位重叠（inset: 0）；(3) 背面 transform: rotateY(180deg) + backface-visibility: hidden；(4) hover 时容器 rotateY(180deg) 翻转。Safari 需要 -webkit-backface-visibility 前缀。',
        ),
        h('div', { class: 'tf-stage' },
          h('div', { class: 'tf-flip-card' },
            h('div', { class: 'tf-flip-inner' },
              h('div', { class: 'tf-flip-front' }, '正面（hover 翻转）'),
              h('div', { class: 'tf-flip-back' }, '背面内容'),
            ),
          ),
        ),
        h('div', { class: 'fs-xs text-secondary text-center mt-xs' }, '↑ 鼠标悬浮卡片查看 3D 翻转效果'),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行翻转卡片演示', { type: 'primary', size: 'sm', onClick: () => this._runBackfaceDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.backfaceInfo || '（点击按钮查看 backface-visibility 与 3D 翻转卡片完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：perspective 深度与视觉原理 =====================

  _runPerspectiveDemo(): void {
    const f = this._flags();
    const info = [
      '===== perspective 深度与视觉原理 =====',
      '',
      '【perspective 值的视觉影响】',
      '  perspective: 300px;   // 透视强（夸张，近距离广角）',
      '  perspective: 800px;   // 中等透视（自然）',
      '  perspective: 2000px;  // 透视弱（接近正交投影）',
      '  perspective: none;    // 无透视（正交投影，3D 退化）',
      '',
      '  // 想象观察者距屏幕的距离：',
      '  //   300px = 眼睛贴近屏幕（夸张广角）',
      '  //   2000px = 眼睛远离屏幕（接近正交）',
      '  //   越小透视越强（近大远小越明显）',
      '  //   越大透视越弱（接近正交投影）',
      '',
      '【perspective-origin：消失点】',
      '  perspective-origin: center center;   // 默认：消失点在中心',
      '  perspective-origin: top;             // 消失点在顶部',
      '  perspective-origin: bottom;          // 消失点在底部',
      '  perspective-origin: left;            // 消失点在左侧',
      '  perspective-origin: right;           // 消失点在右侧',
      '  perspective-origin: 25% 75%;         // 自定义百分比',
      '  perspective-origin: 100px 50px;      // 自定义长度',
      '',
      '  // 消失点决定 3D 场景朝哪个方向"消失"',
      '  // 元素越远离消失点，3D 透视变形越明显',
      '',
      '【实战：不同 perspective 值的视觉效果对比】',
      '  <div class="row">',
      '    <div class="cell p1"><div class="box">300px</div></div>',
      '    <div class="cell p2"><div class="box">800px</div></div>',
      '    <div class="cell p3"><div class="box">2000px</div></div>',
      '  </div>',
      '',
      '  .row { display: flex; gap: 12px; }',
      '  .cell { display: flex; flex-direction: column; align-items: center; }',
      '  .cell.p1 { perspective: 300px; }',
      '  .cell.p2 { perspective: 800px; }',
      '  .cell.p3 { perspective: 2000px; }',
      '  .box { width: 80px; height: 80px; transform: rotateY(45deg); }',
      '  // 同样 rotateY(45deg)：300px 看起来最歪斜，2000px 最接近正交',
      '',
      '【消失点对 3D 场景的影响】',
      '  // 默认 center：3D 物体居中显示，左右对称',
      '  .stage { perspective: 800px; perspective-origin: center; }',
      '',
      '  // 消失点在左上：物体看起来朝左上方"倒"',
      '  .stage-tl { perspective-origin: top left; }',
      '',
      '  // 消失点在底部：俯视效果，物体顶部远离观察者',
      '  .stage-bottom { perspective-origin: bottom; }',
      '',
      '  // 实战：模拟不同相机角度',
      '  //   仰视：perspective-origin: top',
      '  //   俯视：perspective-origin: bottom',
      '  //   侧视：perspective-origin: left / right',
      '',
      '【与 camera 概念的关系】',
      '  // 3D 渲染中 perspective 等价于相机（camera）：',
      '  //   perspective = 相机到投影平面的距离',
      '  //   perspective-origin = 相机在屏幕上的投影位置',
      '  //   rotateX/Y/Z = 物体相对相机的旋转',
      '  //   translateZ = 物体相对相机的距离',
      '',
      '  // CSS 的 perspective 是简化的相机模型：',
      '  //   - 相机始终面向 Z 轴负方向',
      '  //   - 不可旋转相机（无法 lookAt）',
      '  //   - 要"移动相机"实际是移动场景（反向变换）',
      '',
      '【perspective 属性 vs perspective() 函数（重申）】',
      '  // 属性版（父元素）：',
      '  .parent { perspective: 800px; perspective-origin: center; }',
      '  // 所有子元素共享同一消失点，统一相机',
      '',
      '  // 函数版（元素自身 transform 内）：',
      '  .box { transform: perspective(800px) rotateY(45deg); }',
      '  // 每个元素独立相机，消失点在元素中心',
      '  // 不支持 perspective-origin（无法改消失点）',
      '',
      '  // 经验：',
      '  //   单元素 3D 翻转 → 函数版即可',
      '  //   多元素 3D 场景 → 属性版 + perspective-origin',
      '',
      '【3D 透视中的 Z 轴缩放公式】',
      '  // 元素视觉缩放比例 = perspective / (perspective - translateZ)',
      '  //   translateZ = 0   → 比例 1（原始大小）',
      '  //   translateZ > 0   → 比例 > 1（放大，朝向观察者）',
      '  //   translateZ < 0   → 比例 < 1（缩小，远离观察者）',
      '  //   translateZ = perspective → 比例无限大（消失点）',
      '  //   translateZ > perspective → 元素消失（在观察者身后）',
      '',
      '  // 实战：translateZ(100px) 配合 perspective(800px)',
      '  //   比例 = 800 / (800 - 100) = 800/700 ≈ 1.14（放大 14%）',
      '',
      '【浏览器支持】',
      `  perspective 属性: ${f.perspective ? '✓' : '✗'}`,
      `  perspective-origin: ${f.perspectiveOrigin ? '✓' : '✗'}`,
      '  规范：https://drafts.csswg.org/css-transforms-2/#perspective',
    ].join('\n');
    this.setState({ perspectiveInfo: info });
    this._addLog('css', `perspective 深度演示完成；supports=${f.perspective}/${f.perspectiveOrigin}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. perspective 深度与视觉原理',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['perspective', f.perspective],
          ['perspective-origin', f.perspectiveOrigin],
        ]),
        h(Tag, { color: 'primary' }, '透视深度'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'perspective 值越大透视越弱（接近正交投影）、越小透视越强（夸张广角）。perspective-origin 设定消失点（默认 center center，可用 top/bottom/left/right/length/percentage）。与 camera 概念的关系：perspective = 相机到投影平面距离，perspective-origin = 相机投影位置。Z 轴缩放公式：比例 = perspective / (perspective - translateZ)。',
        ),
        h('div', { class: 'tf-perspective-row' },
          h('div', { class: 'tf-perspective-cell tf-p1' },
            h('div', { class: 'tf-box' }, '300px'),
            h('div', { class: 'tf-label' }, '透视强'),
          ),
          h('div', { class: 'tf-perspective-cell tf-p2' },
            h('div', { class: 'tf-box' }, '800px'),
            h('div', { class: 'tf-label' }, '中等透视'),
          ),
          h('div', { class: 'tf-perspective-cell tf-p3' },
            h('div', { class: 'tf-box' }, '2000px'),
            h('div', { class: 'tf-label' }, '透视弱'),
          ),
        ),
        h('div', { class: 'fs-xs text-secondary text-center mt-xs' }, '↑ 同样 rotateY(45deg)，不同 perspective 值的视觉差异'),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 perspective 演示', { type: 'primary', size: 'sm', onClick: () => this._runPerspectiveDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.perspectiveInfo || '（点击按钮查看 perspective 深度与视觉原理完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：will-change / 合成层 / 性能优化 =====================

  _runWillChangeDemo(): void {
    const f = this._flags();
    const info = [
      '===== will-change / 合成层 / 性能优化 =====',
      '',
      '【transform 触发合成层（compositing layer），GPU 加速】',
      '  浏览器渲染流程：JavaScript → Style → Layout → Paint → Composite',
      '  改 transform / opacity 仅触发 Composite（最后阶段），GPU 处理',
      '  改 top/left/width/height 触发 Layout + Paint + Composite（重排重绘）',
      '',
      '  // 性能排序（从快到慢）：',
      '  //   transform / opacity（仅合成）>',
      '  //   color / background（仅重绘）>',
      '  //   top / left / width / height（重排）',
      '',
      '【will-change：提前提示浏览器优化】',
      '  will-change: transform;       // 提示将要改变 transform',
      '  will-change: opacity;         // 提示将要改变 opacity',
      '  will-change: transform, opacity;  // 多个属性',
      '  will-change: auto;            // 默认，浏览器自行决定',
      '  will-change: scroll-position; // 将要改变滚动位置',
      '  will-change: contents;        // 内容将改变（很少用）',
      '',
      '  // 作用：浏览器提前创建合成层、预分配资源',
      '  // 用在动画即将开始前，移除动画后',
      '',
      '【will-change 滥用陷阱：过多合成层导致内存爆炸】',
      '  // 错误：对所有元素都加 will-change',
      '  * { will-change: transform; }   // 灾难！',
      '  // 每个元素都创建独立合成层，内存爆炸、性能反而下降',
      '',
      '  // 正确：仅对即将动画的元素临时设置',
      '  .card { transition: transform 0.3s; }',
      '  .card:hover { will-change: transform; }',
      '  // 动画结束后移除（让浏览器回收资源）',
      '',
      '  // 或用 JS 在动画前设置，动画后清除：',
      '  el.addEventListener("mouseenter", () => {',
      '    el.style.willChange = "transform";',
      '  });',
      '  el.addEventListener("transitionend", () => {',
      '    el.style.willChange = "auto";',
      '  });',
      '',
      '【动画属性优先级】',
      '  最佳（仅合成，GPU 加速）：',
      '    - transform / translate / rotate / scale',
      '    - opacity',
      '    - filter（部分浏览器）',
      '',
      '  次佳（仅重绘，CPU）：',
      '    - color / background-color / border-color',
      '    - box-shadow',
      '',
      '  避免（重排，CPU）：',
      '    - top / left / right / bottom',
      '    - width / height / margin / padding',
      '    - font-size / line-height',
      '',
      '【translateZ(0) / translate3d(0,0,0) hack：强制合成层】',
      '  // 历史方案：用空 transform 强制元素进入合成层',
      '  .box { transform: translateZ(0); }',
      '  .box { transform: translate3d(0, 0, 0); }',
      '  // 现代浏览器推荐用 will-change 替代',
      '  // hack 仍有用：某些老 Android 浏览器不支持 will-change',
      '',
      '  // 移动端动画卡顿时常用 hack：',
      '  .animated { transform: translateZ(0); }',
      '  // 让动画元素进入独立合成层，避免重绘整页',
      '',
      '【实战：60fps 动画的最佳实践】',
      '',
      '  1. 优先用 transform / opacity 做动画',
      '     .box { transition: transform 0.3s; }',
      '     .box:hover { transform: translateX(100px); }  // ✓ 60fps',
      '     // 而非',
      '     .box:hover { left: 100px; }                   // ✗ 触发重排',
      '',
      '  2. 复杂动画前设置 will-change',
      '     .modal {',
      '       opacity: 0;',
      '       transition: opacity 0.3s;',
      '     }',
      '     .modal.opening {',
      '       will-change: opacity;',
      '       opacity: 1;',
      '     }',
      '',
      '  3. 避免在动画中读取 layout 属性',
      '     // 错误：每帧读 offsetWidth 触发重排',
      '     function animate() {',
      '       box.style.transform = `translateX(${box.offsetWidth + 1}px)`;',
      '       requestAnimationFrame(animate);',
      '     }',
      '     // 正确：用变量管理状态',
      '     let x = 0;',
      '     function animate() {',
      '       x += 1;',
      '       box.style.transform = `translateX(${x}px)`;',
      '       requestAnimationFrame(animate);',
      '     }',
      '',
      '  4. 用 transform 替代 position 动画',
      '     // 错误：',
      '     .ball { transition: left 0.3s; left: 0; }',
      '     .ball.go { left: 100px; }',
      '     // 正确：',
      '     .ball { transition: transform 0.3s; transform: translateX(0); }',
      '     .ball.go { transform: translateX(100px); }',
      '',
      '  5. contain: layout style paint 隔离重排范围',
      '     .card { contain: layout style paint; }',
      '     // 该卡片内部变化不影响外部布局',
      '',
      '【Chrome DevTools Layers 面板调试合成层】',
      '  1. F12 打开 DevTools',
      '  2. 右上角"⋮" → More tools → Layers',
      '  3. 查看页面所有合成层列表',
      '  4. 选中某层查看：尺寸、原因、内存占用',
      '  5. 3D 视图查看层堆叠关系',
      '',
      '  // 调试技巧：',
      '  //   - 合成层数量过多（>50）→ 内存压力大',
      '  //   - 单层尺寸过大（>4096px）→ 可能被强制拆分',
      '  //   - 重叠的合成层 → 层爆炸',
      '',
      '【合成层创建条件（隐式）】',
      '  以下情况元素会自动创建合成层：',
      '    - 3D transform（translate3d / translateZ / rotateX/Y 等）',
      '    - position: fixed + 滚动',
      '    - video / canvas / webgl',
      '    - will-change: transform / opacity',
      '    - opacity < 1 + 有动画',
      '    - filter / mask',
      '    - transform + 有动画',
      '',
      '【浏览器支持】',
      `  will-change: ${f.willChange ? '✓' : '✗'} (Chrome 36+ / Firefox 36+ / Safari 9.1+)`,
      '  规范：https://drafts.csswg.org/css-will-change-1/',
      '  合成层文档：https://chromedevtools.github.io/devtools-protocol/tot/Layers/',
    ].join('\n');
    this.setState({ willChangeInfo: info });
    this._addLog('css', `will-change / 合成层 / 性能优化演示完成；supports=${f.willChange}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. will-change / 合成层 / 性能优化',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['will-change', f.willChange]]),
        h(Tag, { color: 'primary' }, '性能优化'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transform 触发合成层（compositing layer），GPU 加速。will-change: transform / opacity 提前提示浏览器优化。滥用陷阱：过多合成层导致内存爆炸（* { will-change: transform; } 是灾难）。动画属性优先级：transform / opacity > color / background > top / left / width / height。translateZ(0) / translate3d(0,0,0) hack 强制合成层（历史方案，现代浏览器推荐 will-change）。Chrome DevTools Layers 面板调试合成层。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行性能优化演示', { type: 'primary', size: 'sm', onClick: () => this._runWillChangeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.willChangeInfo || '（点击按钮查看 will-change / 合成层 / 性能优化完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：实战效果合集 =====================

  _runPatternDemo(): void {
    const f = this._flags();
    const info = [
      '===== CSS Transforms & 3D 实战效果合集 =====',
      '',
      '【效果 1：3D 翻转卡片（hover 翻转）】',
      '  // 详见 Card 5 完整实现',
      '  .flip-card { perspective: 800px; }',
      '  .flip-inner { transform-style: preserve-3d; transition: transform 0.6s; }',
      '  .flip-card:hover .flip-inner { transform: rotateY(180deg); }',
      '  .flip-front, .flip-back { backface-visibility: hidden; position: absolute; inset: 0; }',
      '  .flip-back { transform: rotateY(180deg); }',
      '',
      '【效果 2：3D 立方体旋转（6 面立方体 + animation 旋转）】',
      '  // 详见 Card 4 完整实现',
      '  .cube-stage { perspective: 800px; }',
      '  .cube { transform-style: preserve-3d; animation: spin 12s infinite linear; }',
      '  .face-front  { transform: translateZ(50px); }',
      '  .face-back   { transform: rotateY(180deg) translateZ(50px); }',
      '  .face-right  { transform: rotateY(90deg)  translateZ(50px); }',
      '  .face-left   { transform: rotateY(-90deg) translateZ(50px); }',
      '  .face-top    { transform: rotateX(90deg)  translateZ(50px); }',
      '  .face-bottom { transform: rotateX(-90deg) translateZ(50px); }',
      '  @keyframes spin { to { transform: rotateX(360deg) rotateY(360deg); } }',
      '',
      '【效果 3：视差滚动（translateZ + scroll）】',
      '  // 原理：perspective 容器内，translateZ 大的元素滚动更快',
      '  <div class="parallax-stage">',
      '    <div class="layer back">背景层</div>',
      '    <div class="layer mid">中间层</div>',
      '    <div class="layer front">前景层</div>',
      '  </div>',
      '',
      '  .parallax-stage {',
      '    height: 100vh;',
      '    overflow-y: scroll;',
      '    perspective: 1px;',
      '    perspective-origin: top;',
      '    transform-style: preserve-3d;',
      '  }',
      '  .layer {',
      '    position: absolute;',
      '    inset: 0;',
      '    transform-style: preserve-3d;',
      '  }',
      '  .layer.back  { transform: translateZ(-1px) scale(2);  z-index: 1; }',
      '  .layer.mid   { transform: translateZ(-0.5px) scale(1.5); z-index: 2; }',
      '  .layer.front { transform: translateZ(0); z-index: 3; }',
      '  // 滚动时背景层滚动慢（视差效果），前景层滚动快',
      '  // scale 是为了抵消 translateZ 导致的尺寸变化',
      '',
      '【效果 4：卡片悬浮 3D 倾斜（mousemove + rotateX/Y）】',
      '  <div class="tilt-card">',
      '    <div class="tilt-inner">悬浮我</div>',
      '  </div>',
      '',
      '  .tilt-card {',
      '    perspective: 1000px;',
      '    width: 200px; height: 280px;',
      '  }',
      '  .tilt-inner {',
      '    width: 100%; height: 100%;',
      '    background: linear-gradient(135deg, #3b82f6, #1e40af);',
      '    border-radius: 12px;',
      '    transition: transform 0.1s ease-out;',
      '    transform-style: preserve-3d;',
      '  }',
      '',
      '  const card = document.querySelector(".tilt-card");',
      '  const inner = card.querySelector(".tilt-inner");',
      '  card.addEventListener("mousemove", (e: any) => {',
      '    const rect = card.getBoundingClientRect();',
      '    const x = e.clientX - rect.left;     // 鼠标相对卡片 X',
      '    const y = e.clientY - rect.top;      // 鼠标相对卡片 Y',
      '    const cx = rect.width / 2;',
      '    const cy = rect.height / 2;',
      '    const rotateY = ((x - cx) / cx) * 15;  // 最大 ±15deg',
      '    const rotateX = -((y - cy) / cy) * 15;',
      '    inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;',
      '  });',
      '  card.addEventListener("mouseleave", () => {',
      '    inner.style.transform = "rotateX(0) rotateY(0)";',
      '  });',
      '',
      '【效果 5：翻页动画（rotateY + perspective）】',
      '  <div class="book">',
      '    <div class="page page-1">第 1 页</div>',
      '    <div class="page page-2">第 2 页</div>',
      '  </div>',
      '',
      '  .book {',
      '    perspective: 2000px;',
      '    width: 300px; height: 400px;',
      '    position: relative;',
      '  }',
      '  .page {',
      '    position: absolute;',
      '    inset: 0;',
      '    background: #fff;',
      '    transform-origin: left center;   // 翻页轴在左侧',
      '    transition: transform 0.8s;',
      '    transform-style: preserve-3d;',
      '    backface-visibility: hidden;',
      '  }',
      '  .page.flipped { transform: rotateY(-180deg); }   // 翻到左侧',
      '',
      '  // JS 切换 .flipped 类',
      '  page.addEventListener("click", () => {',
      '    page.classList.toggle("flipped");',
      '  });',
      '',
      '【效果 6：图片缩放放大镜（scale + overflow hidden）】',
      '  <div class="zoom-stage">',
      '    <img class="zoom-img" src="photo.jpg" />',
      '  </div>',
      '',
      '  .zoom-stage {',
      '    width: 300px; height: 200px;',
      '    overflow: hidden;            // 关键：裁剪超出部分',
      '    cursor: zoom-in;',
      '  }',
      '  .zoom-img {',
      '    width: 100%; height: 100%;',
      '    object-fit: cover;',
      '    transition: transform 0.3s;',
      '    transform-origin: center;',
      '  }',
      '  .zoom-stage:hover .zoom-img {',
      '    transform: scale(1.5);       // 放大 1.5 倍',
      '  }',
      '',
      '  // 进阶：跟随鼠标位置放大（origin 跟随鼠标）',
      '  stage.addEventListener("mousemove", (e: any) => {',
      '    const rect = stage.getBoundingClientRect();',
      '    const x = ((e.clientX - rect.left) / rect.width) * 100;',
      '    const y = ((e.clientY - rect.top) / rect.height) * 100;',
      '    img.style.transformOrigin = `${x}% ${y}%`;',
      '    img.style.transform = "scale(2)";',
      '  });',
      '  stage.addEventListener("mouseleave", () => {',
      '    img.style.transform = "scale(1)";',
      '  });',
      '',
      '【效果 7：图标 hover 弹跳（scale + transition）】',
      '  .icon {',
      '    font-size: 24px;',
      '    transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);',
      '  }',
      '  .icon:hover {',
      '    transform: scale(1.3);       // 弹跳放大',
      '  }',
      '  .icon:active {',
      '    transform: scale(0.9);       // 点击缩小',
      '  }',
      '  // cubic-bezier(0.68, -0.55, 0.265, 1.55) 是经典弹跳曲线',
      '  // 中间会超过 1.3 再回到 1.3，模拟弹性',
      '',
      '【效果 8：加载动画（rotate + animation）】',
      '  <div class="spinner"></div>',
      '',
      '  .spinner {',
      '    width: 40px; height: 40px;',
      '    border: 4px solid #e2e8f0;',
      '    border-top-color: #3b82f6;',
      '    border-radius: 50%;',
      '    animation: spin 1s infinite linear;',
      '  }',
      '  @keyframes spin {',
      '    to { transform: rotate(360deg); }',
      '  }',
      '  // 仅 transform 变化，60fps 丝滑',
      '',
      '  // 进阶：3D 翻转加载',
      '  .spinner-3d {',
      '    width: 40px; height: 40px;',
      '    background: #3b82f6;',
      '    animation: flip 1s infinite ease-in-out;',
      '  }',
      '  @keyframes flip {',
      '    0%   { transform: perspective(120px) rotateX(0) rotateY(0); }',
      '    50%  { transform: perspective(120px) rotateX(-180deg) rotateY(0); }',
      '    100% { transform: perspective(120px) rotateX(-180deg) rotateY(-180deg); }',
      '  }',
      '',
      '【效果 9：3D 卡片堆叠轮播】',
      '  <div class="carousel-3d">',
      '    <div class="card-3d" style="--i: 0">卡片 1</div>',
      '    <div class="card-3d" style="--i: 1">卡片 2</div>',
      '    <div class="card-3d" style="--i: 2">卡片 3</div>',
      '    <div class="card-3d" style="--i: 3">卡片 4</div>',
      '    <div class="card-3d" style="--i: 4">卡片 5</div>',
      '  </div>',
      '',
      '  .carousel-3d {',
      '    perspective: 1200px;',
      '    transform-style: preserve-3d;',
      '    animation: rotate-carousel 20s infinite linear;',
      '    height: 200px;',
      '  }',
      '  .card-3d {',
      '    position: absolute;',
      '    width: 150px; height: 200px;',
      '    left: 50%; top: 0;',
      '    margin-left: -75px;',
      '    background: linear-gradient(135deg, #3b82f6, #1e40af);',
      '    color: #fff;',
      '    transform: rotateY(calc(var(--i) * 72deg)) translateZ(200px);',
      '    // 5 张卡片均匀分布（360/5 = 72deg）',
      '  }',
      '  @keyframes rotate-carousel {',
      '    to { transform: rotateY(-360deg); }',
      '  }',
      '',
      '【效果 10：磁吸按钮（hover 时按钮跟随鼠标轻微位移）】',
      '  .magnetic-btn {',
      '    transition: transform 0.2s ease-out;',
      '    will-change: transform;',
      '  }',
      '',
      '  const btn = document.querySelector(".magnetic-btn");',
      '  btn.addEventListener("mousemove", (e: any) => {',
      '    const rect = btn.getBoundingClientRect();',
      '    const x = e.clientX - rect.left - rect.width / 2;',
      '    const y = e.clientY - rect.top - rect.height / 2;',
      '    btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;',
      '  });',
      '  btn.addEventListener("mouseleave", () => {',
      '    btn.style.transform = "";',
      '  });',
      '',
      '【资源】',
      '  - 规范：https://drafts.csswg.org/css-transforms-1/ & -2/',
      '  - MDN transform: https://developer.mozilla.org/docs/Web/CSS/transform',
      '  - MDN 3D 变换: https://developer.mozilla.org/docs/Web/CSS/CSS_transforms/Using_CSS_transforms',
      '  - CSS-Tricks 3D 立方体: https://css-tricks.com/creating-a-3d-cube-image-gallery/',
      '  - Chrome 合成层文档: https://developers.google.com/web/fundamentals/performance/rendering/stick-to-compositor-only-properties',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战效果合集演示完成');
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战效果合集（翻转/立方体/视差/倾斜/翻页/放大镜/弹跳/加载）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.transform3d ? 'success' : 'error' }, `3D ${f.transform3d ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '完整实战效果合集：3D 翻转卡片（hover 翻转）/ 3D 立方体旋转（6 面立方体 + animation）/ 视差滚动（translateZ + scroll，背景慢前景快）/ 卡片悬浮 3D 倾斜（mousemove + rotateX/Y）/ 翻页动画（rotateY + perspective + transform-origin: left）/ 图片缩放放大镜（scale + overflow hidden + transform-origin 跟随鼠标）/ 图标 hover 弹跳（scale + cubic-bezier 弹性曲线）/ 加载动画（rotate + animation，60fps 丝滑）。包含 3D 卡片堆叠轮播、磁吸按钮等进阶效果。',
        ),
        h('div', { class: 'tf-stage' },
          h('div', { class: 'tf-flip-card' },
            h('div', { class: 'tf-flip-inner' },
              h('div', { class: 'tf-flip-front' }, '翻转卡片'),
              h('div', { class: 'tf-flip-back' }, '↑ hover 翻转'),
            ),
          ),
          h('div', { class: 'tf-cube-stage', style: { margin: '0 auto' } },
            h('div', { class: 'tf-cube' },
              h('div', { class: 'tf-cube-face tf-cube-front' }, 'F'),
              h('div', { class: 'tf-cube-face tf-cube-back' }, 'B'),
              h('div', { class: 'tf-cube-face tf-cube-right' }, 'R'),
              h('div', { class: 'tf-cube-face tf-cube-left' }, 'L'),
              h('div', { class: 'tf-cube-face tf-cube-top' }, 'T'),
              h('div', { class: 'tf-cube-face tf-cube-bottom' }, 'D'),
            ),
          ),
        ),
        h('div', { class: 'fs-xs text-secondary text-center mt-xs' }, '↑ 3D 翻转卡片 + 自动旋转立方体'),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行实战效果合集演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战效果合集完整代码）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  _renderLogPanel(): Node | string {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return '';
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log: LogEntry) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  renderPage(): Node | string | (Node | string)[] {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS Transforms & 3D 深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Transforms Module Level 1 + Level 2 —— 现代 Web 动画与视觉效果的基石',
        description: '完整覆盖 CSS Transforms 全套能力：transform 基础与 2D 变换函数（translate/scale/rotate/skew/matrix）、translate/rotate/scale 独立属性（Level 2 新特性）、3D 变换函数全集（rotateX/Y/Z/rotate3d/translate3d/matrix3d/perspective）、transform-style: preserve-3d 与 3D 空间、backface-visibility 与 3D 翻转卡片、perspective 深度与视觉原理、will-change / 合成层 / 性能优化、实战效果合集（3D 翻转卡片/3D 立方体/视差滚动/卡片悬浮倾斜/翻页动画/缩放放大镜/图标弹跳/加载动画）。GPU 合成层加速、60fps 动画的基石。用 CSS.supports() 检测，jsdom 不做真实布局但流程完整。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,

      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
        this._renderCard5(),
        this._renderCard6(),
        this._renderCard7(),
        this._renderCard8(),
      ),

      this._renderLogPanel(),
    ] as (Node | string)[];
  }
}
