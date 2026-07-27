// =====================================================================
// CSSTransitionsAnimationsPage.js —— CSS Transitions & @keyframes Animations 实验室
// 演示 CSS Transitions Module + CSS Animations Module + Easing Functions
// Level 1/2 全套基础能力，是浏览器原生动画体系的核心：
//   1. transition-* —— 属性平滑过渡
//      transition: width 0.3s ease-in 0.1s;
//      transition-property / duration / timing-function / delay
//      多属性独立设置：transition: width 0.3s, height 0.5s ease-in 0.1s;
//   2. @keyframes —— 关键帧定义
//      @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
//      支持百分比 0%/25%/50%/75%/100% 多关键帧
//      可用 var() CSS 变量与 calc() 表达式
//   3. animation-* —— 关键帧动画全套属性
//      animation: name 1s ease infinite alternate;
//      animation-name/duration/timing-function/delay/iteration-count/
//        direction/fill-mode/play-state
//   4. cubic-bezier() —— 三次贝塞尔缓动函数
//      cubic-bezier(0.25, 0.1, 0.25, 1) 等价 ease
//      y 值可超出 [0,1] 实现回弹效果（如 cubic-bezier(0.34, 1.56, 0.64, 1)）
//   5. steps() / linear() —— 分步缓动与多点线性插值
//      steps(4, end) 等分 4 步每步末尾跳；step-start = steps(1, start)
//      linear(0, 0.25, 1) 自定义多点线性插值（Chrome 124+ CSS Easing Level 2）
//   6. 动画事件 —— transitionend / animationstart / animationiteration / animationend
//      event.propertyName / elapsedTime / pseudoElement
//      element.getAnimations() + Animation 对象 play()/pause()/cancel()
//   7. 性能优化 —— will-change / contain / prefers-reduced-motion
//      仅过渡 transform/opacity 仅触发 composite，60fps 预算 16.67ms/帧
//   8. 实战模式 —— hover 反馈/淡入/旋转/脉冲/摆动/进度条/打字机/精灵图/模态框
// 说明：jsdom 不做真实动画播放，但 CSS.supports 可探测属性支持；
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

interface CSSTransitionsAnimationsPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  transitionInfo: string;
  keyframesInfo: string;
  animationInfo: string;
  cubicBezierInfo: string;
  stepsInfo: string;
  eventsInfo: string;
  perfInfo: string;
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

export class CSSTransitionsAnimationsPage extends Page {
  declare state: CSSTransitionsAnimationsPageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];


  initialState(): CSSTransitionsAnimationsPageState {
    return {
      logs: [],
      capsSummary: '',
      transitionInfo: '',     // Card 1：transition-* 全套属性
      keyframesInfo: '',      // Card 2：@keyframes 关键帧定义
      animationInfo: '',      // Card 3：animation-* 全套属性
      cubicBezierInfo: '',    // Card 4：cubic-bezier() 缓动深潜
      stepsInfo: '',          // Card 5：steps() / linear() 分步缓动
      eventsInfo: '',         // Card 6：动画事件与 JS 控制
      perfInfo: '',           // Card 7：性能优化与最佳实践
      patternInfo: '',        // Card 8：实战动画模式
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `transition ${c(f.transition)}`,
      `transition-behavior ${c(f.transitionBehavior)}`,
      `animation ${c(f.animation)}`,
      `cubic-bezier() ${c(f.cubicBezier)}`,
      `steps() ${c(f.steps)}`,
      `linear() ${c(f.linearFn)}`,
      `animation-fill-mode ${c(f.animationFillMode)}`,
      `animation-play-state ${c(f.animationPlayState)}`,
      `will-change ${c(f.willChange)}`,
      `prefers-reduced-motion ${c(f.prefersReducedMotion)}`,
      `View Transitions ${c(f.viewTransitions)}`,
    ];

    const summary = f.css
      ? `CSS Transitions & Animations 能力检测：${parts.join(' · ')}。jsdom 不做真实动画播放，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.linearFn) this._addLog('warn', 'linear() 不可用（Chrome 124+ / CSS Easing Level 2）');
    if (f.prefersReducedMotion) this._addLog('warn', '用户偏好减少动态效果（prefers-reduced-motion: reduce）');
    if (!f.viewTransitions) this._addLog('info', 'View Transitions API 不可用（Chrome 111+）');

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
    this._injectStyle('css-ta-base', `
      .ta-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .ta-box {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        margin: 8px;
      }
      .ta-box--hover {
        transition: transform 0.3s ease, background 0.3s ease, border-radius 0.3s ease;
        cursor: pointer;
      }
      .ta-box--hover:hover {
        transform: scale(1.2) rotate(8deg);
        background: linear-gradient(135deg, #ef4444, #f59e0b);
        border-radius: 50%;
      }
      .ta-spinner {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 4px solid #e5e7eb;
        border-top-color: #3b82f6;
        animation: ta-spin 1s linear infinite;
        display: inline-block;
        margin: 8px;
      }
      .ta-pulse {
        animation: ta-pulse 1.5s ease-in-out infinite alternate;
        display: inline-block;
        margin: 8px;
      }
      .ta-wiggle {
        animation: ta-wiggle 0.6s ease-in-out infinite alternate;
        display: inline-block;
        margin: 8px;
      }
      .ta-progress {
        width: 200px;
        height: 12px;
        background: #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
        margin: 8px;
      }
      .ta-progress__bar {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #34d399);
        animation: ta-fill 2s ease-out infinite;
      }
      .ta-typewriter {
        font-family: monospace;
        border-right: 2px solid #1e40af;
        white-space: nowrap;
        overflow: hidden;
        width: 0;
        animation: ta-type 3s steps(11) infinite, ta-caret 0.7s step-end infinite;
        margin: 8px;
      }
      .ta-sprite {
        width: 64px;
        height: 64px;
        background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="32" height="32" fill="%233b82f6"/><rect x="32" width="32" height="32" fill="%23ef4444"/><rect y="32" width="32" height="32" fill="%2310b981"/><rect x="32" y="32" width="32" height="32" fill="%23f59e0b"/></svg>') 0 0;
        animation: ta-sprite 0.8s steps(4) infinite;
        display: inline-block;
        margin: 8px;
      }
      @keyframes ta-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes ta-pulse {
        from { transform: scale(1); opacity: 1; }
        to { transform: scale(1.15); opacity: 0.7; }
      }
      @keyframes ta-wiggle {
        from { transform: rotate(-8deg); }
        to { transform: rotate(8deg); }
      }
      @keyframes ta-fill {
        from { width: 0%; }
        to { width: 100%; }
      }
      @keyframes ta-type {
        from { width: 0; }
        to { width: 11ch; }
      }
      @keyframes ta-caret {
        from, to { border-color: transparent; }
        50% { border-color: #1e40af; }
      }
      @keyframes ta-sprite {
        from { background-position: 0 0; }
        to { background-position: -256px 0; }
      }
      .ta-easing-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .ta-easing-cell {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px;
      }
      .ta-easing-bar {
        width: 100%;
        height: 8px;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        border-radius: 4px;
        margin-top: 4px;
        animation: ta-slide 2s ease infinite;
      }
      @keyframes ta-slide {
        from { transform: scaleX(0); transform-origin: left; }
        to { transform: scaleX(1); transform-origin: left; }
      }
      .ta-output {
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
    `);
  }

  _flags(): any {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: string, v: string) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    const hasMatchMedia = typeof matchMedia === 'function';
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      transition: supportsPV('transition', 'opacity 0.3s'),
      transitionBehavior: supportsPV('transition-behavior', 'allow-discrete'),
      animation: supportsPV('animation', 'spin 1s linear infinite'),
      cubicBezier: supportsPV('transition-timing-function', 'cubic-bezier(0.25, 0.1, 0.25, 1)'),
      steps: supportsPV('transition-timing-function', 'steps(4, end)'),
      linearFn: supportsPV('transition-timing-function', 'linear(0, 1)'),
      animationFillMode: supportsPV('animation-fill-mode', 'forwards'),
      animationPlayState: supportsPV('animation-play-state', 'paused'),
      willChange: supportsPV('will-change', 'transform'),
      prefersReducedMotion: hasMatchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches,
      viewTransitions: typeof document !== 'undefined' && typeof document.startViewTransition !== 'undefined',
    };
  }

  // ===================== Card 1：transition-* 全套属性 =====================

  _runTransitionDemo(): void {
    const f = this._flags();
    this._injectStyle('ta-transition-demo', `
      .ta-transition-host {
        padding: 16px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
      }
      .ta-tran-multi {
        width: 80px;
        height: 80px;
        background: #3b82f6;
        border-radius: 8px;
        /* 多属性独立设置不同 duration / timing / delay */
        transition: width 0.3s ease, height 0.5s ease-in 0.1s, background 0.4s ease-out, border-radius 0.3s;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        margin: 8px;
      }
      .ta-tran-multi:hover {
        width: 120px;
        height: 120px;
        background: #ef4444;
        border-radius: 50%;
      }
    `);
    const info = [
      '===== CSS transition-* 全套属性 =====',
      '',
      '【四个独立属性 + 一个简写】',
      '  transition-property: width, height;          /* 要过渡的属性 */',
      '  transition-duration: 0.3s, 0.5s;              /* 持续时间 */',
      '  transition-timing-function: ease, ease-in;   /* 缓动函数 */',
      '  transition-delay: 0s, 0.1s;                  /* 延迟（可负数） */',
      '',
      '  /* 简写：property duration timing-function delay */',
      '  transition: width 0.3s ease 0.1s;',
      '',
      '【transition-property 取值】',
      '  transition-property: none;       // 不过渡任何属性',
      '  transition-property: all;        // 过渡所有可过渡属性（默认）',
      '  transition-property: width;      // 单属性',
      '  transition-property: width, height, opacity; // 多属性用逗号',
      '  transition-property: transform, background-color;',
      '',
      '【transition-duration 单位】',
      '  transition-duration: 0.3s;   // 秒（推荐）',
      '  transition-duration: 300ms;  // 毫秒',
      '  transition-duration: 0s;     // 立即（无过渡）',
      '',
      '【transition-timing-function 预设值】',
      '  linear       匀速',
      '  ease         默认，慢-快-慢',
      '  ease-in      慢入',
      '  ease-out     慢出',
      '  ease-in-out  慢入慢出',
      '  cubic-bezier(0.25, 0.1, 0.25, 1)   自定义贝塞尔（见 Card 4）',
      '  steps(4, end)                       分步（见 Card 5）',
      '  step-start = steps(1, start)',
      '  step-end   = steps(1, end)',
      '',
      '【transition-delay：延迟开始（可为负数）】',
      '  transition-delay: 0.1s;   // 0.1 秒后开始',
      '  transition-delay: -0.1s; // 立即开始但偏移到动画中段',
      '  /* 负延迟常用于让多个元素错峰但相对同步 */',
      '',
      '【多属性独立设置：每属性独立 duration/timing/delay】',
      '  .box {',
      '    transition:',
      '      width 0.3s,',
      '      height 0.5s ease-in 0.1s,',
      '      background 0.4s ease-out;',
      '  }',
      '  /* width 用默认 ease 0 延迟；height 用 ease-in 0.1s 延迟；background 用 ease-out */',
      '',
      '【可过渡属性的必要条件】',
      '  - 中间值必须是数值类型（如 width/color/opacity）',
      '  - 不能过渡 display: none ↔ block（无中间值）',
      '    → 解决：transition-behavior: allow-discrete 配合 @starting-style',
      '  - 不能过渡 auto（如 height: auto）',
      '    → 解决：interpolate-size: allow-keywords (Chrome 129+)',
      '  - 简写属性过渡会展开所有子属性（如 border 包含 width/color/style）',
      '',
      '【CSS transition-behavior: allow-discrete（离散过渡）】',
      '  /* 默认 display: none ↔ block 不过渡，加 allow-discrete 后可过渡 */',
      '  .modal {',
      '    transition: opacity 0.3s, display 0.3s allow-discrete;',
      '  }',
      '  /* 配合 @starting-style 解决「首次出现无过渡」问题 */',
      '',
      '【性能：仅触发 paint/composite 不触发 layout】',
      '  - 仅过渡 transform / opacity：仅 composite 阶段（最快）',
      '  - 过渡 color/background/box-shadow：触发 paint（次之）',
      '  - 过渡 width/height/top/left：触发 layout（最慢，避免）',
      '',
      '【过渡触发条件】',
      '  1. 属性值发生变化（如 :hover / :focus / class 切换 / JS 设值）',
      '  2. 元素已声明 transition 属性',
      '  3. 属性值是可过渡的（数值或颜色）',
      '  4. 元素已挂载到 DOM 树（不挂载无法触发）',
      '',
      '【JS 触发过渡的标准模式】',
      '  // 1. 等待浏览器渲染初始状态',
      '  requestAnimationFrame(() => {',
      '    requestAnimationFrame(() => {',
      '      box.style.width = "200px"; // 修改属性触发过渡',
      '    });',
      '  });',
      '  // 双层 RAF 确保浏览器先记录初始状态再变更',
      '',
      '【浏览器支持】',
      `  transition: ${f.transition ? '✓' : '✗'} (IE10+/所有现代浏览器)`,
      `  transition-behavior: allow-discrete: ${f.transitionBehavior ? '✓' : '✗'} (Chrome 117+)`,
      '',
      '【常见陷阱】',
      '  1. 设置 transition-duration: 0; 时仍会触发 transitionend 事件',
      '  2. 过渡属性切换太快会导致动画跳跃',
      '     → 用 transition-delay 让属性错峰',
      '  3. transition-property: all 会过渡所有变化（包括意外的属性）',
      '     → 显式列出要过渡的属性',
      '  4. CSS 自定义属性默认不可过渡，需用 @property 注册类型',
      '     @property --my-color { syntax: "<color>"; inherits: false; initial-value: red; }',
    ].join('\n');
    this.setState({ transitionInfo: info });
    this._addLog('css', `transition-* 演示完成；supports=${f.transition}/${f.transitionBehavior}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. transition-* 全套属性 —— 平滑过渡的基础',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['transition', f.transition],
          ['transition-behavior', f.transitionBehavior],
        ]),
        h(Tag, { color: 'primary' }, 'Transitions L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transition: property duration timing-function delay 简写过渡。transition-property 指定过渡的属性（none/all/具体属性逗号分隔），transition-duration 持续时间（s/ms），transition-timing-function 缓动函数（ease/linear/cubic-bezier/steps），transition-delay 延迟（可为负数立即开始但偏移）。多属性可独立设置：transition: width 0.3s, height 0.5s ease-in 0.1s。不能过渡 display（用 allow-discrete）/ auto（用 interpolate-size），中间值必须是数值类型。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 transition 演示', { type: 'primary', size: 'sm', onClick: () => this._runTransitionDemo() }),
        ),
        h('div', { class: 'ta-box ta-box--hover' }, 'hover 我'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.transitionInfo || '（点击按钮查看 transition-* 全套属性完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：@keyframes 关键帧定义 =====================

  _runKeyframesDemo(): void {
    const f = this._flags();
    this._injectStyle('ta-keyframes-demo', `
      @keyframes ta-kf-fade {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ta-kf-multi {
        0%   { transform: translateX(0); background: #3b82f6; }
        25%  { transform: translateX(40px); background: #10b981; }
        50%  { transform: translateX(0); background: #f59e0b; }
        75%  { transform: translateX(-40px); background: #ef4444; }
        100% { transform: translateX(0); background: #3b82f6; }
      }
      /* 同名 @keyframes 后者覆盖前者 */
      @keyframes ta-kf-overwrite {
        from { transform: rotate(0); }
        to   { transform: rotate(180deg); }
      }
      @keyframes ta-kf-overwrite {
        from { transform: scale(1); }
        to   { transform: scale(1.5); }  /* 这条生效 */
      }
      /* 关键帧中可用 CSS 变量 */
      @keyframes ta-kf-var {
        from { background: var(--kf-from, #3b82f6); }
        to   { background: var(--kf-to, #ef4444); }
      }
      /* 关键帧中可用 calc() */
      @keyframes ta-kf-calc {
        from { transform: translateX(calc(0px + 0px)); }
        to   { transform: translateX(calc(100px - 20px)); } /* = 80px */
      }
      /* !important 在关键帧中被忽略 */
      @keyframes ta-kf-important {
        from { transform: rotate(0deg) !important; }
        to   { transform: rotate(360deg); }  /* !important 被忽略 */
      }
      .ta-kf-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
      .ta-kf-box {
        width: 60px;
        height: 60px;
        background: #3b82f6;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 11px;
      }
      .ta-kf-fade    { animation: ta-kf-fade 2s ease infinite alternate; }
      .ta-kf-multi   { animation: ta-kf-multi 3s ease infinite; }
      .ta-kf-overwrite { animation: ta-kf-overwrite 1.5s ease infinite alternate; }
      .ta-kf-var     { --kf-from: #3b82f6; --kf-to: #ec4899; animation: ta-kf-var 2s ease infinite alternate; }
      .ta-kf-calc    { animation: ta-kf-calc 2s ease infinite alternate; }
      .ta-kf-important { animation: ta-kf-important 2s linear infinite; }
    `);
    const info = [
      '===== @keyframes 关键帧定义 =====',
      '',
      '【基础语法：from/to 关键字】',
      '  @keyframes spin {',
      '    from { transform: rotate(0deg); }',
      '    to   { transform: rotate(360deg); }',
      '  }',
      '  /* from = 0%，to = 100%，必须成对出现 */',
      '',
      '【百分比关键帧：多段控制】',
      '  @keyframes bounce {',
      '    0%   { transform: translateY(0); }',
      '    25%  { transform: translateY(-30px); }',
      '    50%  { transform: translateY(0); }',
      '    75%  { transform: translateY(-15px); }',
      '    100% { transform: translateY(0); }',
      '  }',
      '  /* 关键帧按时间插值，相邻帧之间平滑过渡 */',
      '',
      '【混合使用 from/to 与百分比】',
      '  @keyframes fade {',
      '    from  { opacity: 0; }        /* = 0% */',
      '    50%   { opacity: 0.5; }',
      '    to    { opacity: 1; }        /* = 100% */',
      '  }',
      '',
      '【同一关键帧多个属性】',
      '  @keyframes enter {',
      '    from {',
      '      opacity: 0;',
      '      transform: translateY(20px) scale(0.95);',
      '    }',
      '    to {',
      '      opacity: 1;',
      '      transform: translateY(0) scale(1);',
      '    }',
      '  }',
      '',
      '【!important 在关键帧中被忽略】',
      '  @keyframes kf {',
      '    from { transform: rotate(0deg) !important; }   /* !important 被忽略 */',
      '    to   { transform: rotate(360deg); }',
      '  }',
      '  // 规范规定关键帧中的 !important 不会提升优先级',
      '',
      '【关键帧属性冲突解决：按时间插值】',
      '  @keyframes conflict {',
      '    50%  { transform: translateX(100px); }',
      '    50%  { transform: translateY(100px); }   /* 同 50% 但不同 transform */',
      '  }',
      '  // 浏览器将同时间点的多个 transform 声明按"最后声明胜出"合并',
      '  // 实际效果取决于浏览器实现，应避免这种写法',
      '',
      '【同名 @keyframes：后者覆盖前者】',
      '  @keyframes same {',
      '    from { transform: rotate(0); }',
      '    to   { transform: rotate(180deg); }',
      '  }',
      '  @keyframes same {           /* 同名，覆盖前者 */',
      '    from { transform: scale(1); }',
      '    to   { transform: scale(1.5); }',
      '  }',
      '  .el { animation: same 1s; } /* 后者生效 */',
      '',
      '【动态修改 @keyframes：CSSStyleSheet.insertRule】',
      '  const sheet = new CSSStyleSheet();',
      '  sheet.insertRule(`',
      '    @keyframes dynamic {',
      '      from { transform: scale(${Math.random()}); }',
      '      to   { transform: scale(${Math.random() + 1}); }',
      '    }',
      '  `);',
      '  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];',
      '',
      '  // 或修改现有 stylesheet',
      '  const styleSheet = document.styleSheets[0];',
      '  styleSheet.insertRule("@keyframes dynamic { ... }", styleSheet.cssRules.length);',
      '',
      '【关键帧中可使用 CSS 变量 var()】',
      '  @keyframes kf-var {',
      '    from { background: var(--from-color, blue); }',
      '    to   { background: var(--to-color, red); }',
      '  }',
      '  .el {',
      '    --from-color: #3b82f6;',
      '    --to-color: #ec4899;',
      '    animation: kf-var 2s infinite alternate;',
      '  }',
      '  /* 修改 --from-color 即可动态改变动画起点 */',
      '',
      '【关键帧中可使用 calc()】',
      '  @keyframes kf-calc {',
      '    from { width: calc(50% - 20px); }',
      '    to   { width: calc(100% - 20px); }',
      '  }',
      '  /* 关键帧中 calc 可用于任何支持 calc 的属性 */',
      '',
      '【关键帧继承与初始值】',
      '  - 未在 from 中声明的属性会取元素当前值（继承行为）',
      '  - 仅声明 0%/100% 之一时，另一端取元素当前值',
      '  - 关键帧中不支持 !important（被忽略）',
      '  - 关键帧中可省略某些帧（浏览器自动插值）',
      '',
      '【关键帧的隐式 from/to】',
      '  @keyframes pulse {',
      '    50% { transform: scale(1.2); }   /* 仅声明 50% */',
      '  }',
      '  // 浏览器自动用元素当前 transform 作为 0% 和 100%',
      '  // 适合「在原位置基础上的临时变化」场景',
      '',
      '【动画名称引用】',
      '  .el {',
      '    animation-name: spin;          /* 引用 @keyframes spin */',
      '    animation-duration: 1s;',
      '    animation-iteration-count: infinite;',
      '  }',
      '',
      '【多动画名引用：逗号分隔】',
      '  @keyframes spin { ... }',
      '  @keyframes fade { ... }',
      '  .el {',
      '    animation: spin 1s linear infinite, fade 2s ease infinite;',
      '    /* 两个动画同时运行 */',
      '  }',
      '',
      '【浏览器支持】',
      `  @keyframes: ${f.animation ? '✓' : '✗'} (IE10+/所有现代浏览器)`,
      '',
      '【常见陷阱】',
      '  1. 关键帧名字必须有效标识符（不能用数字开头）',
      '  2. from/to 必须成对出现，否则浏览器忽略动画',
      '  3. 改变 animation-name 后动画从 0% 重新开始',
      '  4. 关键帧中不能使用 currentColor（不会动态计算）',
      '  5. transform 在动画中会被原值覆盖（除非在 from/to 显式写）',
    ].join('\n');
    this.setState({ keyframesInfo: info });
    this._addLog('css', `@keyframes 演示完成；supports=${f.animation}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. @keyframes —— 关键帧定义（动画蓝图）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['animation', f.animation]]),
        h(Tag, { color: 'primary' }, '关键帧'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@keyframes name { from { } to { } } 或 0%/25%/50%/75%/100% 多关键帧定义动画蓝图。!important 在关键帧中被忽略（规范规定）；同名 @keyframes 后者覆盖前者；关键帧中可使用 var() CSS 变量与 calc() 表达式；隐式 from/to 自动取元素当前值。动态修改可用 CSSStyleSheet.insertRule。@keyframes 比 transition 更高效（预编译）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 @keyframes 演示', { type: 'primary', size: 'sm', onClick: () => this._runKeyframesDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.keyframesInfo || '（点击按钮查看 @keyframes 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：animation-* 全套属性 =====================

  _runAnimationDemo(): void {
    const f = this._flags();
    this._injectStyle('ta-animation-demo', `
      @keyframes ta-anim-demo {
        from { transform: translateX(0); }
        to   { transform: translateX(150px); }
      }
      .ta-anim-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
      .ta-anim-fill { animation: ta-anim-demo 2s ease; animation-fill-mode: forwards; }
      .ta-anim-both { animation: ta-anim-demo 2s ease; animation-fill-mode: both; animation-delay: 0.5s; }
      .ta-anim-backwards { animation: ta-anim-demo 2s ease; animation-fill-mode: backwards; animation-delay: 1s; }
      .ta-anim-paused { animation: ta-anim-demo 2s ease infinite; animation-play-state: paused; }
      .ta-anim-alternate { animation: ta-anim-demo 1.5s ease infinite alternate; }
      .ta-anim-reverse { animation: ta-anim-demo 1.5s ease infinite reverse; }
    `);
    const info = [
      '===== animation-* 全套属性 =====',
      '',
      '【8 个独立属性 + 1 个简写】',
      '  animation-name: spin;',
      '  animation-duration: 1s;',
      '  animation-timing-function: linear;',
      '  animation-delay: 0s;',
      '  animation-iteration-count: infinite;',
      '  animation-direction: normal;',
      '  animation-fill-mode: none;',
      '  animation-play-state: running;',
      '',
      '  /* 简写：name duration timing-function delay iteration-count direction fill-mode play-state */',
      '  animation: spin 1s linear 0s infinite normal none running;',
      '',
      '【animation-name：引用 @keyframes 名称】',
      '  animation-name: spin;',
      '  animation-name: spin, fade;       // 多动画用逗号',
      '  animation-name: none;              // 取消动画',
      '  /* 若引用不存在的 @keyframes 则动画不执行 */',
      '',
      '【animation-duration：持续时间】',
      '  animation-duration: 1s;',
      '  animation-duration: 500ms;',
      '  animation-duration: 0s;            // 立即（无动画效果，但触发 animationstart 事件）',
      '',
      '【animation-timing-function：缓动函数】',
      '  animation-timing-function: ease;            // 默认',
      '  animation-timing-function: linear;',
      '  animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);',
      '  animation-timing-function: steps(8, end);',
      '  /* 同 transition-timing-function，见 Card 4/5 */',
      '',
      '【animation-delay：延迟开始（可为负数）】',
      '  animation-delay: 0.5s;            // 0.5 秒后开始',
      '  animation-delay: -0.5s;           // 立即开始但跳过前 0.5 秒',
      '  /* 负延迟让动画从中间状态开始 */',
      '',
      '【animation-iteration-count：重复次数】',
      '  animation-iteration-count: 3;     // 重复 3 次',
      '  animation-iteration-count: infinite;  // 无限循环',
      '  animation-iteration-count: 2.5;  // 2.5 次（停在中间）',
      '  /* 必须配合 animation-fill-mode 才能停在结束状态 */',
      '',
      '【animation-direction：方向】',
      '  animation-direction: normal;             // 默认：0% → 100%',
      '  animation-direction: reverse;            // 反向：100% → 0%',
      '  animation-direction: alternate;          // 交替：0→100→0→100...',
      '  animation-direction: alternate-reverse;  // 反向交替：100→0→100→0...',
      '  /* alternate 常用于呼吸/脉冲效果 */',
      '',
      '【animation-fill-mode：动画前后保持状态（关键！）】',
      '  animation-fill-mode: none;       // 默认：动画前后恢复到原样式',
      '  animation-fill-mode: forwards;  // 动画结束保持最后一帧（100%）',
      '  animation-fill-mode: backwards; // 动画开始前立即应用第一帧（0%）',
      '  animation-fill-mode: both;      // 两者（开始前用 0%，结束后保持 100%）',
      '',
      '  /* 详解 forwards：动画结束后停在 100% 状态 */',
      '  @keyframes grow { from { width: 0; } to { width: 200px; } }',
      '  .bar {',
      '    width: 0;',
      '    animation: grow 2s ease forwards;   // 结束后保持 width: 200px',
      '  }',
      '',
      '  /* 详解 backwards：动画延迟期间先应用 0% 状态 */',
      '  .delayed {',
      '    animation: grow 2s ease backwards;',
      '    animation-delay: 1s;   // 1 秒延迟期间已应用 width: 0（避免闪烁）',
      '  }',
      '',
      '  /* 详解 both：兼顾两端 */',
      '  .modal-enter {',
      '    animation: enter 0.3s ease both;',
      '    animation-delay: 0.1s;',
      '    // 开始前应用 0%（避免初始 opacity:1 闪烁）',
      '    // 结束后保持 100%',
      '  }',
      '',
      '【animation-play-state：暂停/恢复】',
      '  animation-play-state: running;     // 默认：运行',
      '  animation-play-state: paused;      // 暂停（保留进度，恢复时继续）',
      '  /* 适合「鼠标悬停暂停」场景 */',
      '  .spinner:hover {',
      '    animation-play-state: paused;',
      '  }',
      '',
      '【简写顺序：name duration timing-function delay iteration-count direction fill-mode play-state】',
      '  animation: spin 1s linear 0s infinite normal none running;',
      '  /* 至少要 name + duration，其他可省略用默认值 */',
      '  animation: spin 1s;',
      '',
      '【多动画简写：逗号分隔】',
      '  animation:',
      '    spin 1s linear infinite,',
      '    fade 2s ease infinite alternate;',
      '  /* 两动画同时运行 */',
      '',
      '【动画结束监听】',
      '  const box = document.querySelector(".bar");',
      '  box.addEventListener("animationend", (e: any) => {',
      '    console.log("动画结束", e.animationName, e.elapsedTime);',
      '  });',
      '',
      '【浏览器支持】',
      `  animation: ${f.animation ? '✓' : '✗'} (IE10+/所有现代浏览器)`,
      `  animation-fill-mode: ${f.animationFillMode ? '✓' : '✗'}`,
      `  animation-play-state: ${f.animationPlayState ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 默认 animation-fill-mode: none → 动画结束恢复原样式',
      '     → 想保持结束状态必须设 forwards',
      '  2. animation-iteration-count: 0 → 动画不执行',
      '  3. animation-name 改变后从 0% 重新开始',
      '  4. 简写中省略的字段会用默认值覆盖原 CSS',
      '     → 已设置 animation-duration 后再用 animation 简写会覆盖',
      '  5. animation-duration: 0s 仍会触发 animationstart/animationend 事件',
      '  6. animation-delay 期间 fill-mode: backwards 才会先应用起始帧',
    ].join('\n');
    this.setState({ animationInfo: info });
    this._addLog('css', `animation-* 演示完成；supports=${f.animation}/${f.animationFillMode}/${f.animationPlayState}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. animation-* 全套属性 —— 关键帧动画控制',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['animation', f.animation],
          ['fill-mode', f.animationFillMode],
          ['play-state', f.animationPlayState],
        ]),
        h(Tag, { color: 'primary' }, 'Animations L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'animation 简写：name duration timing-function delay iteration-count direction fill-mode play-state。animation-fill-mode: none/forwards/backwards/both 控制动画前后保持状态（forwards 保持结束帧，backwards 立即应用起始帧，both 两者）。animation-play-state: running/paused 暂停恢复。animation-direction: normal/reverse/alternate/alternate-reverse。animation-iteration-count: 数字/infinite。Chrome 全部支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 animation 演示', { type: 'primary', size: 'sm', onClick: () => this._runAnimationDemo() }),
        ),
        h('div', { class: 'ta-spinner' }),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.animationInfo || '（点击按钮查看 animation-* 全套属性完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：cubic-bezier() 缓动深潜 =====================

  _runCubicBezierDemo(): void {
    const f = this._flags();
    const info = [
      '===== cubic-bezier() 三次贝塞尔缓动深潜 =====',
      '',
      '【语法】',
      '  cubic-bezier(x1, y1, x2, y2)',
      '  /* 4 个参数：两个控制点的坐标 */',
      '  /* x1, x2 必须在 [0, 1] 之间 */',
      '  /* y1, y2 可以超出 [0, 1] 实现回弹/弹性效果 */',
      '',
      '【贝塞尔曲线原理】',
      '  起点 P0 = (0, 0)  终点 P3 = (1, 1)',
      '  控制点 P1 = (x1, y1)  P2 = (x2, y2)',
      '',
      '  曲线公式：B(t) = (1-t)³P0 + 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³P3',
      '  其中 t ∈ [0, 1] 表示时间进度',
      '',
      '  // 时间 t（x 轴）→ 输出值（y 轴）的映射',
      '  // 曲线越陡 → 该时间段变化越快',
      '  // 曲线越平 → 该时间段变化越慢',
      '',
      '【常见预设等价关系】',
      '  ease        = cubic-bezier(0.25, 0.1, 0.25, 1)',
      '  ease-in     = cubic-bezier(0.42, 0, 1, 1)',
      '  ease-out    = cubic-bezier(0, 0, 0.58, 1)',
      '  ease-in-out = cubic-bezier(0.42, 0, 0.58, 1)',
      '  linear      = cubic-bezier(0, 0, 1, 1)',
      '',
      '【自定义示例：标准 ease 系列】',
      '  .ease        { transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); }',
      '  .ease-in     { transition: all 0.3s cubic-bezier(0.42, 0, 1, 1); }',
      '  .ease-out    { transition: all 0.3s cubic-bezier(0, 0, 0.58, 1); }',
      '  .ease-in-out { transition: all 0.3s cubic-bezier(0.42, 0, 0.58, 1); }',
      '',
      '【回弹/弹性效果：y 超出 [0,1]】',
      '  /* 弹性缩放 */',
      '  .bounce-in {',
      '    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);',
      '    /* y2 = 1.56 > 1，元素会先超出目标值再回弹 */',
      '  }',
      '',
      '  /* 弹性进入 */',
      '  .spring {',
      '    transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);',
      '    /* y1 = -0.55 < 0，元素先反向再正向 */',
      '  }',
      '',
      '【常用回弹预设（easings.net）】',
      '  easeInBack      = cubic-bezier(0.600, -0.280, 0.735, 0.045)',
      '  easeOutBack     = cubic-bezier(0.175, 0.885, 0.320, 1.275)',
      '  easeInOutBack   = cubic-bezier(0.680, -0.550, 0.265, 1.550)',
      '',
      '  easeInElastic   ≈ cubic-bezier(0.6, -0.28, 0.735, 0.045)（近似）',
      '  easeOutElastic  ≈ cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      '',
      '【预设值曲线特征】',
      '  ease      起步快，中段最快，结尾慢 → 适合「元素已可见需平滑过渡」',
      '  ease-in   起步慢，越来越快 → 适合「元素退出场景」',
      '  ease-out  起步快，结尾慢 → 适合「元素进入场景」（最常用）',
      '  ease-in-out 两端慢中段快 → 适合「颜色/背景变化」',
      '  linear    匀速 → 适合「旋转/进度条/机械运动」',
      '',
      '【缓动函数选择指南】',
      '  UI 反馈（hover/click）：ease-out（用户操作即时反馈）',
      '  元素进入：ease-out 或 cubic-bezier(0.16, 1, 0.3, 1)',
      '  元素退出：ease-in 或 cubic-bezier(0.7, 0, 0.84, 0)',
      '  颜色/背景：ease-in-out',
      '  旋转/机械：linear',
      '  弹性进入：cubic-bezier(0.34, 1.56, 0.64, 1)',
      '  弹性退出：cubic-bezier(0.36, 0, 0.66, -0.56)',
      '',
      '【可视化理解】',
      '  想象一个球从 A 滚到 B：',
      '  - linear：均匀速度滚',
      '  - ease-in：从静止开始加速',
      '  - ease-out：快速起步然后减速到停',
      '  - ease-in-out：起步慢→中段快→结尾慢',
      '  - cubic-bezier(0.34, 1.56, 0.64, 1)：先冲过 B 再回弹',
      '',
      '【工具推荐】',
      '  - cubic-bezier.com（Lea Verou 经典工具，可视化拖动控制点）',
      '  - easings.net（常用预设曲线 + 缓动名对照）',
      '  - Chrome DevTools → Animations 面板可实时调整贝塞尔',
      '  - F12 → 选中元素 → Computed → transition-timing-function 可点击编辑',
      '',
      '【性能：cubic-bezier 是 GPU 友好的】',
      '  - cubic-bezier 是纯数学函数，浏览器可预计算',
      '  - 配合 transform/opacity 仅触发 composite 阶段',
      '  - 不会因 y 值超出 [0,1] 影响性能',
      '',
      '【浏览器支持】',
      `  cubic-bezier(): ${f.cubicBezier ? '✓' : '✗'} (IE10+/所有现代浏览器)`,
      '',
      '【常见陷阱】',
      '  1. x1/x2 必须 [0,1]，超出会被视为无效值（动画回退到 linear）',
      '  2. y1/y2 可超出 [0,1]，但极端值会让动画跳变',
      '  3. cubic-bezier(0, 0, 0, 0) 等价于瞬间到 0%',
      '  4. transition: all 1s cubic-bezier(...) 比 transition: opacity 1s ... 慢',
      '     → all 会触发多个属性的过渡',
    ].join('\n');
    this.setState({ cubicBezierInfo: info });
    this._addLog('css', `cubic-bezier() 演示完成；supports=${f.cubicBezier}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. cubic-bezier() —— 三次贝塞尔缓动函数深潜',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['cubic-bezier()', f.cubicBezier]]),
        h(Tag, { color: 'primary' }, 'Easing L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'cubic-bezier(x1, y1, x2, y2) 定义三次贝塞尔曲线，起点 (0,0) 终点 (1,1)，两个控制点决定曲线形状。x1/x2 必须 [0,1]，y1/y2 可超出 [0,1] 实现回弹/弹性效果（如 cubic-bezier(0.34, 1.56, 0.64, 1)）。预设等价：ease = cubic-bezier(0.25, 0.1, 0.25, 1) 等。UI 反馈用 ease-out，进入用 ease-in，退出用 ease-in-out。工具：cubic-bezier.com / easings.net。',
        ),
        h('div', { class: 'ta-easing-grid' },
          h('div', { class: 'ta-easing-cell' }, [h('div', {}, 'ease'), h('div', { class: 'ta-easing-bar', style: { animationTimingFunction: 'ease' } })]),
          h('div', { class: 'ta-easing-cell' }, [h('div', {}, 'linear'), h('div', { class: 'ta-easing-bar', style: { animationTimingFunction: 'linear' } })]),
          h('div', { class: 'ta-easing-cell' }, [h('div', {}, 'ease-in'), h('div', { class: 'ta-easing-bar', style: { animationTimingFunction: 'ease-in' } })]),
          h('div', { class: 'ta-easing-cell' }, [h('div', {}, 'ease-out'), h('div', { class: 'ta-easing-bar', style: { animationTimingFunction: 'ease-out' } })]),
          h('div', { class: 'ta-easing-cell' }, [h('div', {}, 'ease-in-out'), h('div', { class: 'ta-easing-bar', style: { animationTimingFunction: 'ease-in-out' } })]),
          h('div', { class: 'ta-easing-cell' }, [h('div', {}, 'back'), h('div', { class: 'ta-easing-bar', style: { animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' } })]),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 cubic-bezier 演示', { type: 'primary', size: 'sm', onClick: () => this._runCubicBezierDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.cubicBezierInfo || '（点击按钮查看 cubic-bezier() 完整深潜）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：steps() / linear() 分步缓动 =====================

  _runStepsDemo(): void {
    const f = this._flags();
    const info = [
      '===== steps() 分步缓动 + linear() 多点线性插值 =====',
      '',
      '【steps() 语法】',
      '  steps(n, <jumpterm>)',
      '  /* n：分步数量，正整数 */',
      '  /* <jumpterm>：跳变点，可选 start | end（默认 end） */',
      '',
      '  steps(4, end)    // 等分 4 步，每步末尾跳变',
      '  steps(4, start)  // 等分 4 步，每步开头跳变',
      '  steps(1, start) = step-start   // 一步到位（开头）',
      '  steps(1, end)   = step-end     // 一步到位（末尾）',
      '',
      '【steps(4, end) 详解：每步末尾跳】',
      '  时间   0%   25%   50%   75%   100%',
      '  值     0    0.25  0.50  0.75  1.00',
      '         └────┴────┴────┴────┘',
      '              ↑    ↑    ↑    ↑',
      '         保持 保持 保持 保持 跳到 1.0',
      '  // 0%-25% 保持 0，25% 时跳到 0.25',
      '',
      '【steps(4, start) 详解：每步开头跳】',
      '  时间   0%   25%   50%   75%   100%',
      '  值     0.25 0.50  0.75  1.00  1.00',
      '         ↑    ↑    ↑    ↑',
      '         跳到 0.25 立即跳变',
      '  // 0% 时立即跳到 0.25，然后保持到 25%',
      '',
      '【step-start / step-end 简写】',
      '  step-start = steps(1, start)  // 0% 时立即跳到 100%',
      '  step-end   = steps(1, end)    // 99% 时还是 0%，100% 跳到 100%',
      '',
      '【应用 1：精灵图逐帧动画（最经典）】',
      '  /* 假设精灵图 8 帧横向排列，每帧 64px */',
      '  .sprite {',
      '    width: 64px;',
      '    height: 64px;',
      '    background: url("sprite.png") 0 0;',
      '    animation: walk 0.8s steps(8) infinite;',
      '  }',
      '  @keyframes walk {',
      '    from { background-position: 0 0; }',
      '    to   { background-position: -512px 0; }  /* 8 × 64 = 512 */',
      '  }',
      '  // steps(8) 让 background-position 离散跳变，',
      '  // 配合精灵图实现逐帧动画效果',
      '',
      '【应用 2：打字机效果】',
      '  .typewriter {',
      '    font-family: monospace;',
      '    border-right: 2px solid #000;',
      '    overflow: hidden;',
      '    white-space: nowrap;',
      '    width: 0;',
      '    animation: typing 3s steps(11) infinite,',
      '               caret 0.7s step-end infinite;',
      '  }',
      '  @keyframes typing {',
      '    from { width: 0; }',
      '    to   { width: 11ch; }   /* 11 个字符 */',
      '  }',
      '  @keyframes caret {',
      '    from, to { border-color: transparent; }',
      '    50%      { border-color: #000; }',
      '  }',
      '  // steps(11) 让 width 按 1ch 步进，模拟打字',
      '',
      '【应用 3：进度条分段】',
      '  .progress {',
      '    width: 0;',
      '    animation: fill 4s steps(100) forwards;',
      '  }',
      '  @keyframes fill {',
      '    from { width: 0; }',
      '    to   { width: 100%; }',
      '  }',
      '  // steps(100) 让进度每 4/100 秒前进 1%',
      '',
      '【linear() 函数（CSS Easing Level 2 / Chrome 124+）】',
      '  linear(<number>#, [number <percentage>]?)',
      '  /* 自定义多点线性插值，比 cubic-bezier 更直观可控 */',
      '',
      '  linear(0, 0.25, 1)               // 三点：0→0.25→1 线性插值',
      '  linear(0, 0.5 50%, 1)             // 50% 时取 0.5',
      '  linear(0 0%, 0.5 50%, 1 100%)     // 显式指定百分比',
      '',
      '【linear() 实例：自定义曲线】',
      '  /* 类似 ease 但更可控 */',
      '  .smooth {',
      '    transition: all 0.3s linear(0, 0.5 50%, 1);',
      '  }',
      '',
      '  /* 多段控制 */',
      '  .multi {',
      '    transition: all 0.6s linear(0, 0.2 20%, 0.8 80%, 1);',
      '    // 0-20%：0→0.2（慢）',
      '    // 20-80%：0.2→0.8（快）',
      '    // 80-100%：0.8→1（慢）',
      '  }',
      '',
      '  /* 配合斜率：表示每段的速率 */',
      '  linear(0 0%, 0.5 50%, 1 100%)  // 等价于 linear',
      '',
      '【linear() 高级：增加斜率定义】',
      '  /* 形如 linear(<input> <percentage> / <slope>, ...) */',
      '  linear(0, 1 50% / 0.5, 1)   // 50% 时跳到 1，斜率 0.5',
      '',
      '【与 cubic-bezier 对比】',
      '  cubic-bezier(0.25, 0.1, 0.25, 1)',
      '    + 兼容性好（IE10+）',
      '    - 4 个参数难直观理解',
      '    - 需要工具辅助设计',
      '',
      '  linear(0, 0.5, 1)',
      '    + 直观：每点位置即输出值',
      '    + 多段控制更灵活',
      '    - Chrome 124+ 才支持',
      '    - 不能产生回弹效果（y 不能超出 [0,1]）',
      '',
      '【steps() vs linear()：离散 vs 连续】',
      '  steps(4, end)：离散跳变（适合逐帧/分段）',
      '  linear(0, 0.25, 0.5, 0.75, 1)：连续插值（平滑过渡）',
      '  // 若想模拟 steps 但用线性，可用 linear(0 0%, 0 25%, 0.25 25%, ...)',
      '',
      '【浏览器支持】',
      `  steps(): ${f.steps ? '✓' : '✗'} (IE10+/所有现代浏览器)`,
      `  linear(): ${f.linearFn ? '✓' : '✗'} (Chrome 124+ / CSS Easing Level 2)`,
      '',
      '【资源】',
      '  - CSS Easing Level 2 规范：https://drafts.csswg.org/css-easing-2/',
      '  - linear() 调试器：https://easings.net/',
      '  - steps() 可视化：https://www.desmos.com/calculator/iyfyu5jmiy',
    ].join('\n');
    this.setState({ stepsInfo: info });
    this._addLog('css', `steps()/linear() 演示完成；supports=${f.steps}/${f.linearFn}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. steps() 分步缓动与 linear() 多点插值',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['steps()', f.steps],
          ['linear()', f.linearFn],
        ]),
        h(Tag, { color: 'primary' }, 'Easing L2'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'steps(n, start|end) 分 n 步跳跃：steps(4, end) 每步末尾跳，steps(4, start) 每步开头跳，step-start = steps(1, start)。应用：精灵图逐帧动画、打字机效果、进度条分段。linear() 函数（Chrome 124+ / CSS Easing Level 2）：linear(0, 0.25, 1) 自定义多点线性插值，配合百分比 linear(0 0%, 0.5 50%, 1 100%) 显式控制每段时间。比 cubic-bezier 更直观可控但不能回弹。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 steps/linear 演示', { type: 'primary', size: 'sm', onClick: () => this._runStepsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '逐帧精灵图（steps(4)）：'),
        h('div', { class: 'ta-sprite' }),
        h('div', { class: 'fs-sm text-secondary' }, '打字机效果（steps(11)）：'),
        h('div', { class: 'ta-typewriter' }, 'Hello World'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.stepsInfo || '（点击按钮查看 steps() / linear() 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：动画事件与 JS 控制 =====================

  _runEventsDemo(): void {
    const f = this._flags();
    const info = [
      '===== 动画事件与 JS 控制 =====',
      '',
      '【Transition 事件（4 个）】',
      '  transitionrun      // 过渡开始（含延迟期）',
      '  transitionstart    // 过渡实际开始（延迟结束后）',
      '  transitioncancel   // 过渡被取消（如再次切换属性）',
      '  transitionend      // 过渡结束',
      '',
      '  // 时序：transitionrun → (delay) → transitionstart → transitionend',
      '  //         或 transitionrun → (delay) → transitionstart → transitioncancel',
      '',
      '【transitionend 事件属性】',
      '  box.addEventListener("transitionend", (e: any) => {',
      '    console.log(e.propertyName);  // 触发过渡的属性名（如 "width"）',
      '    console.log(e.elapsedTime);   // 已过渡时间（秒）',
      '    console.log(e.pseudoElement); // 触发过渡的伪元素（如 "::before" 或 ""）',
      '  });',
      '',
      '  /* 多属性过渡会触发多次 transitionend（每个属性一次）*/',
      '  /* transition: width 0.3s, height 0.5s; → 触发 2 次 transitionend */',
      '',
      '【Animation 事件（4 个）】',
      '  animationstart      // 动画开始',
      '  animationiteration  // 每次循环结束（除最后一次）',
      '  animationcancel     // 动画被取消（如删除元素/改 animation-name）',
      '  animationend        // 动画完全结束',
      '',
      '  // 时序（无限循环动画）：',
      '  // animationstart → animationiteration → animationiteration → ... → animationend',
      '  // 时序（有限次动画）：',
      '  // animationstart → animationend',
      '  // 时序（iteration-count: 3）：',
      '  // animationstart → animationiteration → animationiteration → animationend',
      '',
      '【animationiteration 在每次循环时触发（除最后一次）】',
      '  @keyframes spin { ... }',
      '  .el { animation: spin 1s linear 3; }  // 重复 3 次',
      '  // 触发：animationstart → 1s 后 animationiteration → 2s 后 animationiteration → 3s 后 animationend',
      '  // 注意：第 3 次循环结束触发的是 animationend，不是 animationiteration',
      '',
      '【animationend 事件属性】',
      '  box.addEventListener("animationend", (e: any) => {',
      '    console.log(e.animationName);  // @keyframes 名称',
      '    console.log(e.elapsedTime);   // 已运行时间（秒）',
      '    console.log(e.pseudoElement); // 伪元素',
      '  });',
      '',
      '【通过 JS 动态添加/移除 class 触发动画】',
      '  // 添加 class',
      '  box.classList.add("animate-in");',
      '  // 动画结束后移除',
      '  box.addEventListener("animationend", () => {',
      '    box.classList.remove("animate-in");',
      '  });',
      '',
      '  /* 重启动画的标准技巧：强制重排 */',
      '  box.classList.remove("animate-in");',
      '  void box.offsetWidth;  // 触发重排，重置动画',
      '  box.classList.add("animate-in");',
      '',
      '【element.getAnimations() 获取所有动画对象】',
      '  const animations = box.getAnimations();',
      '  // 返回 Animation 对象数组（包括 CSS Animations + Web Animations API）',
      '  animations.forEach((anim) => {',
      '    console.log(anim.animationName);   // CSS 动画名',
      '    console.log(anim.currentTime);     // 当前时间（毫秒）',
      '    console.log(anim.playState);       // "running" | "paused"',
      '  });',
      '',
      '【Animation 对象方法】',
      '  const anim = box.getAnimations()[0];',
      '  anim.play();        // 播放（从暂停处继续）',
      '  anim.pause();       // 暂停',
      '  anim.cancel();      // 取消（删除动画，回到初始状态）',
      '  anim.finish();      // 跳到结束状态',
      '  anim.reverse();     // 反向播放',
      '  anim.playbackRate = 2;  // 2 倍速播放',
      '  anim.startTime;    // 开始时间',
      '  anim.currentTime;  // 当前时间',
      '  anim.effect;       // 关联的 KeyframeEffect',
      '',
      '【Animation 对象事件】',
      '  anim.addEventListener("finish", () => { ... });',
      '  anim.addEventListener("cancel", () => { ... });',
      '  anim.onfinish = () => { ... };',
      '',
      '【监听全局动画变化：document.getAnimations()】',
      '  // 获取页面所有动画',
      '  document.getAnimations().forEach((anim) => {',
      '    anim.pause();  // 暂停所有动画（适合 prefers-reduced-motion）',
      '  });',
      '',
      '【替代方案：Web Animations API element.animate()】',
      '  // JS 创建动画，无需 CSS',
      '  const anim = box.animate(',
      '    [',
      '      { transform: "translateX(0)" },',
      '      { transform: "translateX(200px)" }',
      '    ],',
      '    {',
      '      duration: 1000,',
      '      iterations: Infinity,',
      '      easing: "ease-in-out",',
      '      direction: "alternate",',
      '      fill: "forwards",',
      '    }',
      '  );',
      '',
      '  // 与 CSS 动画对比：',
      '  // + 动态生成关键帧（运行时计算值）',
      '  // + 直接拿 Animation 对象',
      '  // + 可链式调用 .then()（anim.finished 返回 Promise）',
      '  // - 性能略低于 CSS（需 JS 计算）',
      '  // - 不能被 DevTools Animations 面板编辑',
      '',
      '【anim.finished 返回 Promise】',
      '  async function animateAndRemove() {',
      '    const anim = box.animate([',
      '      { opacity: 1 },',
      '      { opacity: 0 }',
      '    ], { duration: 300, fill: "forwards" });',
      '    await anim.finished;   // 等动画结束',
      '    box.remove();',
      '  }',
      '',
      '【实战：监听动画结束移除元素】',
      '  box.classList.add("animate-out");',
      '  box.addEventListener("animationend", () => {',
      '    box.remove();',
      '  }, { once: true });  // 仅触发一次',
      '',
      '【实战：监听动画结束触发回调】',
      '  // 用 transitionend 监听卡片展开完成',
      '  panel.style.maxHeight = panel.scrollHeight + "px";',
      '  panel.addEventListener("transitionend", function handler(e) {',
      '    if (e.propertyName === "max-height") {',
      '      panel.style.maxHeight = "none";  // 移除限制',
      '      panel.removeEventListener("transitionend", handler);',
      '    }',
      '  });',
      '',
      '【浏览器支持】',
      `  animation 事件: ${f.animation ? '✓' : '✗'} (IE10+)`,
      `  Element.getAnimations(): ${typeof Element !== 'undefined' && 'getAnimations' in Element.prototype ? '✓' : '✗'} (Chrome 84+)`,
      `  Web Animations API: ${typeof Element !== 'undefined' && 'animate' in Element.prototype ? '✓' : '✗'} (Chrome 39+/Firefox 48+)`,
      '',
      '【常见陷阱】',
      '  1. transitionend 触发多次：每个属性一次，需用 e.propertyName 过滤',
      '  2. 子元素的 transitionend 会冒泡到父元素',
      '     → e.stopPropagation() 或检查 e.target === this',
      '  3. 改变 display: none 立即取消动画，不触发 animationend',
      '  4. animation-iteration-count: infinite 永远不会触发 animationend',
      '  5. transition-duration: 0 仍会触发 transitionend（但 elapsedTime 为 0）',
    ].join('\n');
    this.setState({ eventsInfo: info });
    this._addLog('css', `动画事件演示完成；supports=${f.animation}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 动画事件与 JS 控制（transitionend / getAnimations / Web Animations API）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['animation 事件', f.animation]]),
        h(Tag, { color: 'primary' }, 'JS API'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Transition 事件：transitionrun/transitionstart/transitioncancel/transitionend，事件属性 propertyName/elapsedTime/pseudoElement。Animation 事件：animationstart/animationiteration/animationcancel/animationend，animationiteration 在每次循环时触发（除最后一次）。element.getAnimations() 获取所有 Animation 对象，可 play()/pause()/cancel()/reverse()/finish()。替代方案：Web Animations API element.animate(keyframes, options)，返回 Animation 对象并支持 .finished Promise。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行动画事件演示', { type: 'primary', size: 'sm', onClick: () => this._runEventsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.eventsInfo || '（点击按钮查看动画事件与 JS 控制完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：性能优化与最佳实践 =====================

  _runPerfDemo(): void {
    const f = this._flags();
    const info = [
      '===== 性能优化与最佳实践 =====',
      '',
      '【渲染管线：layout / paint / composite 三阶段】',
      '  浏览器渲染一帧的步骤：',
      '    1. Style Recalculation（样式重算）',
      '    2. Layout（重排，计算元素几何）',
      '    3. Paint（重绘，绘制像素）',
      '    4. Composite（合成，GPU 合成图层）',
      '',
      '  各属性触发的阶段：',
      '    transform / opacity         → 仅 Composite（最快）',
      '    color / background / shadow → Paint + Composite（次之）',
      '    width / height / top / left → Layout + Paint + Composite（最慢）',
      '',
      '【最佳实践：仅过渡 transform 和 opacity】',
      '  /* 推荐：仅触发 composite */',
      '  .box {',
      '    transition: transform 0.3s ease, opacity 0.3s ease;',
      '  }',
      '  .box:hover {',
      '    transform: translateX(100px);   // 用 transform 代替 left',
      '    opacity: 0.5;',
      '  }',
      '',
      '  /* 避免：触发 layout */',
      '  .box-bad {',
      '    transition: left 0.3s, width 0.3s;',
      '  }',
      '  .box-bad:hover {',
      '    left: 100px;      // 触发整个父容器 layout',
      '    width: 200px;',
      '  }',
      '',
      '【will-change：提示浏览器预创建合成层】',
      '  .card {',
      '    will-change: transform;     // 提示浏览器：transform 会变化',
      '    transition: transform 0.3s;',
      '  }',
      '',
      '  /* will-change 取值 */',
      '  will-change: auto;            // 默认，浏览器自动决定',
      '  will-change: transform, opacity;',
      '  will-change: scroll-position; // 滚动位置会变化',
      '  will-change: contents;        // 内容会变化',
      '',
      '  /* 使用原则 */',
      '  1. 仅在确知元素即将变化时设置（如 hover 进入即将变化的元素）',
      '  2. 变化结束后移除（避免长期占用 GPU 内存）',
      '  3. 不要给所有元素都加 will-change（反而拖慢）',
      '  4. 适合：长滚动列表、复杂动画、模态框打开',
      '',
      '  /* 错误用法 */',
      '  * { will-change: transform; }   // 全部元素都加 → 浏览器无法优化',
      '',
      '【contain：限制重排范围】',
      '  .card-list {',
      '    contain: layout;       // 此容器内布局变化不影响外部',
      '    contain: paint;        // 此容器内绘制不溢出',
      '    contain: strict;       // = layout + paint + size + style',
      '    contain: content;      // = layout + paint + style（不含 size）',
      '  }',
      '',
      '  /* contain 各值含义 */',
      '  layout   独立布局，内部变化不引起外部 layout',
      '  paint    独立绘制，子元素绘制不溢出边界',
      '  size     容器尺寸不影响外部（自己计算大小）',
      '  style    计数器/引号独立',
      '',
      '【避免过渡 width/height/top/left（触发 layout）】',
      '  /* 不推荐 */',
      '  .panel { transition: height 0.3s; }',
      '  .panel.open { height: 300px; }   // 触发整个父容器重排',
      '',
      '  /* 推荐用 transform: scaleY 代替 height */',
      '  .panel {',
      '    transform: scaleY(0);',
      '    transform-origin: top;',
      '    transition: transform 0.3s;',
      '  }',
      '  .panel.open { transform: scaleY(1); }   // 仅触发 composite',
      '',
      '  /* 推荐用 max-height: 9999px 模拟（仍触发 layout 但更可控）*/',
      '  .panel {',
      '    max-height: 0;',
      '    transition: max-height 0.5s;',
      '    overflow: hidden;',
      '  }',
      '  .panel.open { max-height: 500px; }',
      '',
      '【transition vs animation 性能对比】',
      '  transition：',
      '    + 触发条件简单（属性变化即触发）',
      '    + 实时性高（响应交互）',
      '    - 每次触发都需重新计算关键帧',
      '',
      '  animation @keyframes：',
      '    + 预编译，浏览器提前优化',
      '    + 适合循环/复杂动画',
      '    + 配合 will-change 性能更好',
      '    - 触发条件需手动管理（class 切换）',
      '',
      '【@keyframes 比 transition 更高效（预编译）】',
      '  // 浏览器解析 @keyframes 时已计算所有中间值',
      '  // 而 transition 每次属性变化都需重新计算',
      '  // 长时间循环动画用 @keyframes 更高效',
      '',
      '【动画暂停时节省资源：animation-play-state: paused】',
      '  .spinner {',
      '    animation: spin 1s linear infinite;',
      '  }',
      '  /* 离开屏幕时暂停 */',
      '  .spinner.paused {',
      '    animation-play-state: paused;',
      '  }',
      '  /* 暂停后浏览器不再为动画分配渲染时间 */',
      '',
      '【离屏元素动画暂停：IntersectionObserver】',
      '  const io = new IntersectionObserver((entries) => {',
      '    entries.forEach((entry) => {',
      '      entry.target.classList.toggle("paused", !entry.isIntersecting);',
      '    });',
      '  }, { rootMargin: "100px" });  // 提前 100px 暂停',
      '  document.querySelectorAll(".animated").forEach((el) => io.observe(el));',
      '',
      '  /* CSS 配合 */',
      '  .animated.paused {',
      '    animation-play-state: paused;',
      '  }',
      '',
      '【prefers-reduced-motion 媒体查询尊重用户偏好】',
      '  @media (prefers-reduced-motion: reduce) {',
      '    *, *::before, *::after {',
      '      animation-duration: 0.01ms !important;',
      '      animation-iteration-count: 1 !important;',
      '      transition-duration: 0.01ms !important;',
      '      scroll-behavior: auto !important;',
      '    }',
      '  }',
      '',
      '  /* JS 检测用户偏好 */',
      '  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;',
      '  if (reduceMotion) {',
      '    // 跳过动画，直接显示最终状态',
      '  }',
      '',
      '  /* 用户在系统设置中开启「减少动态效果」时自动尊重 */',
      '  /* 适合：前庭功能紊乱用户、晕动症、电池省电模式 */',
      '',
      '【60fps 性能预算：每帧 16.67ms】',
      '  60fps = 60 frames per second = 1000/60 = 16.67ms/帧',
      '  浏览器渲染一帧的时间预算：',
      '    - JS 执行：约 5-10ms',
      '    - Style + Layout + Paint + Composite：约 5-10ms',
      '  超出预算 → 丢帧（卡顿）',
      '',
      '  /* 检测卡顿 */',
      '  let last = performance.now();',
      '  function checkFPS() {',
      '    const now = performance.now();',
      '    const delta = now - last;',
      '    if (delta > 20) console.warn("丢帧", delta);',
      '    last = now;',
      '    requestAnimationFrame(checkFPS);',
      '  }',
      '  requestAnimationFrame(checkFPS);',
      '',
      '【requestAnimationFrame：与浏览器渲染同步】',
      '  // 用 rAF 而非 setTimeout 触发动画',
      '  function animate() {',
      '    // ... 更新属性 ...',
      '    requestAnimationFrame(animate);',
      '  }',
      '  requestAnimationFrame(animate);',
      '  // rAF 在浏览器即将渲染下一帧时调用，确保 60fps 同步',
      '',
      '【硬件加速：transform 触发 GPU 合成层】',
      '  /* transform 默认触发 GPU 加速 */',
      '  .gpu {',
      '    transform: translateZ(0);    /* 触发合成层（hack）*/',
      '    /* 或 */',
      '    will-change: transform;       /* 推荐 */',
      '  }',
      '  /* GPU 合成层独立绘制，不与主线程竞争 */',
      '',
      '【浏览器支持】',
      `  will-change: ${f.willChange ? '✓' : '✗'} (Chrome 36+/Firefox 36+)`,
      `  prefers-reduced-motion 检测: ${f.prefersReducedMotion ? '当前启用' : '✓'}`,
      '',
      '【性能检测工具】',
      '  - Chrome DevTools → Performance 面板：录制查看每帧耗时',
      '  - Chrome DevTools → Rendering 面板：勾选 Paint Flashing 看重绘区域',
      '  - Chrome DevTools → Layers 面板：查看合成层',
      '  - Lighthouse：Performance 评分',
    ].join('\n');
    this.setState({ perfInfo: info });
    this._addLog('css', `性能优化演示完成；prefers-reduced-motion=${f.prefersReducedMotion}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 性能优化与最佳实践（will-change / contain / prefers-reduced-motion）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['will-change', f.willChange],
          ['prefers-reduced-motion', f.prefersReducedMotion],
        ]),
        h(Tag, { color: 'primary' }, '性能'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '仅过渡 transform/opacity 仅触发 composite（不触发 layout/paint）。will-change: transform 提示浏览器预创建合成层。contain: layout/paint 限制重排范围。避免过渡 width/height/top/left（触发 layout）。@keyframes 比 transition 更高效（预编译）。animation-play-state: paused 暂停时节省资源。IntersectionObserver 离屏暂停动画。prefers-reduced-motion 尊重用户减少动态偏好。60fps 预算：每帧 16.67ms。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行性能优化演示', { type: 'primary', size: 'sm', onClick: () => this._runPerfDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.perfInfo || '（点击按钮查看性能优化与最佳实践完整指南）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：实战动画模式 =====================

  _runPatternDemo(): void {
    const f = this._flags();
    const info = [
      '===== 实战动画模式 =====',
      '',
      '【模式 1：hover 按钮反馈（scale + transition + ease-out）】',
      '  .btn {',
      '    transition: transform 0.2s ease-out,',
      '                background 0.2s ease,',
      '                box-shadow 0.2s ease;',
      '  }',
      '  .btn:hover {',
      '    transform: scale(1.05);',
      '    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);',
      '  }',
      '  .btn:active {',
      '    transform: scale(0.98);   // 按下缩小',
      '  }',
      '  /* 用 transform 代替 width/height 触发 layout */',
      '',
      '【模式 2：卡片淡入（opacity + translateY + transition）】',
      '  @keyframes fadeInUp {',
      '    from {',
      '      opacity: 0;',
      '      transform: translateY(20px);',
      '    }',
      '    to {',
      '      opacity: 1;',
      '      transform: translateY(0);',
      '    }',
      '  }',
      '  .card {',
      '    animation: fadeInUp 0.5s ease-out forwards;',
      '    animation-delay: calc(var(--i, 0) * 0.1s);   /* 错峰进入 */',
      '  }',
      '  // HTML：',
      '  // <div class="card" style="--i: 0">Card 1</div>',
      '  // <div class="card" style="--i: 1">Card 2</div>',
      '  // <div class="card" style="--i: 2">Card 3</div>',
      '',
      '【模式 3：加载旋转（rotate + animation infinite）】',
      '  .spinner {',
      '    width: 40px;',
      '    height: 40px;',
      '    border: 4px solid #e5e7eb;',
      '    border-top-color: #3b82f6;',
      '    border-radius: 50%;',
      '    animation: spin 1s linear infinite;',
      '  }',
      '  @keyframes spin {',
      '    from { transform: rotate(0deg); }',
      '    to   { transform: rotate(360deg); }',
      '  }',
      '',
      '  /* 用 SVG 旋转 */',
      '  .spinner-svg {',
      '    animation: spin 1s linear infinite;',
      '  }',
      '',
      '【模式 4：脉冲呼吸（scale + animation alternate）】',
      '  .pulse {',
      '    animation: pulse 1.5s ease-in-out infinite alternate;',
      '  }',
      '  @keyframes pulse {',
      '    from { transform: scale(1); opacity: 1; }',
      '    to   { transform: scale(1.15); opacity: 0.7; }',
      '  }',
      '  /* alternate 让动画在 from/to 之间往返 */',
      '  /* 适合：心跳图标、注意力提示、在线状态指示 */',
      '',
      '【模式 5：摆动效果（rotate + animation alternate）】',
      '  .wiggle {',
      '    animation: wiggle 0.6s ease-in-out infinite alternate;',
      '  }',
      '  @keyframes wiggle {',
      '    from { transform: rotate(-8deg); }',
      '    to   { transform: rotate(8deg); }',
      '  }',
      '  /* 适合：通知小红点、未读消息提示 */',
      '',
      '【模式 6：滑入菜单（transform + transition）】',
      '  .menu {',
      '    position: fixed;',
      '    top: 0;',
      '    right: 0;',
      '    width: 300px;',
      '    height: 100vh;',
      '    transform: translateX(100%);     /* 默认移出视口 */',
      '    transition: transform 0.3s ease-out;',
      '  }',
      '  .menu.open {',
      '    transform: translateX(0);         /* 滑入 */',
      '  }',
      '  // JS：menu.classList.toggle("open")',
      '',
      '【模式 7：进度条（width + transition 或 animation）】',
      '  /* 模式 A：用 transition */',
      '  .progress-bar {',
      '    width: 0;',
      '    transition: width 0.3s ease;',
      '  }',
      '  // JS：progressBar.style.width = "60%";',
      '',
      '  /* 模式 B：用 animation 循环填充 */',
      '  .progress-loading {',
      '    animation: fill 2s ease-out infinite;',
      '  }',
      '  @keyframes fill {',
      '    from { width: 0; }',
      '    to   { width: 100%; }',
      '  }',
      '',
      '  /* 模式 C：不确定进度的脉动 */',
      '  .progress-indeterminate {',
      '    position: relative;',
      '    overflow: hidden;',
      '  }',
      '  .progress-indeterminate::after {',
      '    content: "";',
      '    position: absolute;',
      '    width: 30%;',
      '    height: 100%;',
      '    background: inherit;',
      '    animation: indeterminate 1.5s ease-in-out infinite;',
      '  }',
      '  @keyframes indeterminate {',
      '    0%   { left: -30%; }',
      '    100% { left: 100%; }',
      '  }',
      '',
      '【模式 8：打字机（steps + animation）】',
      '  .typewriter {',
      '    font-family: monospace;',
      '    border-right: 2px solid #000;',
      '    overflow: hidden;',
      '    white-space: nowrap;',
      '    width: 0;',
      '    animation:',
      '      typing 3s steps(11) infinite,',
      '      caret 0.7s step-end infinite;',
      '  }',
      '  @keyframes typing {',
      '    from { width: 0; }',
      '    to   { width: 11ch; }',
      '  }',
      '  @keyframes caret {',
      '    from, to { border-color: transparent; }',
      '    50%      { border-color: #000; }',
      '  }',
      '',
      '【模式 9：精灵图逐帧动画（steps + background-position）】',
      '  /* 假设精灵图 4 帧横向排列，每帧 64px */',
      '  .sprite {',
      '    width: 64px;',
      '    height: 64px;',
      '    background: url("walk.png") 0 0;',
      '    animation: walk 0.8s steps(4) infinite;',
      '  }',
      '  @keyframes walk {',
      '    from { background-position: 0 0; }',
      '    to   { background-position: -256px 0; }   /* 4 × 64 = 256 */',
      '  }',
      '  // steps(4) 让 background-position 离散跳变，',
      '  // 实现逐帧动画（无需 JS）',
      '',
      '【模式 10：模态框淡入淡出（@starting-style + transition-behavior: allow-discrete）】',
      '  /* 现代方案：CSS @starting-style + allow-discrete */',
      '  .modal {',
      '    opacity: 0;',
      '    transform: scale(0.95);',
      '    transition:',
      '      opacity 0.3s ease,',
      '      transform 0.3s ease,',
      '      display 0.3s allow-discrete,',
      '      overlay 0.3s allow-discrete;',
      '  }',
      '  .modal[open] {',
      '    opacity: 1;',
      '    transform: scale(1);',
      '  }',
      '  /* @starting-style 解决「首次出现无过渡」问题 */',
      '  @starting-style {',
      '    .modal[open] {',
      '      opacity: 0;',
      '      transform: scale(0.95);',
      '    }',
      '  }',
      '  // 配合 <dialog> 元素：dialog.showModal() 触发过渡',
      '',
      '  /* 旧方案（无 allow-discrete）：JS 控制 */',
      '  async function openModal() {',
      '    modal.style.display = "block";',
      '    requestAnimationFrame(() => {',
      '      requestAnimationFrame(() => {',
      '        modal.classList.add("open");',
      '      });',
      '    });',
      '  }',
      '',
      '【模式 11：视图过渡（View Transitions API）】',
      '  // JS 触发视图过渡',
      '  function navigate() {',
      '    if (!document.startViewTransition) {',
      '      updateDOM();  // 不支持时直接更新',
      '      return;',
      '    }',
      '    const transition = document.startViewTransition(() => {',
      '      updateDOM();',
      '    });',
      '    transition.ready.then(() => {',
      '      // 自定义过渡动画',
      '      document.documentElement.animate(',
      '        [',
      '          { clipPath: "circle(0% at 50% 50%)" },',
      '          { clipPath: "circle(100% at 50% 50%)" }',
      '        ],',
      '        { duration: 500, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }',
      '      );',
      '    });',
      '  }',
      '',
      '  /* CSS 自定义视图过渡 */',
      '  ::view-transition-old(root),',
      '  ::view-transition-new(root) {',
      '    animation-duration: 0.5s;',
      '    animation-timing-function: ease-in-out;',
      '  }',
      '',
      '【模式 12：导航栏指示器滑动】',
      '  /* 用 transform + transition 让指示器跟随激活项 */',
      '  .tabs {',
      '    position: relative;',
      '    display: flex;',
      '  }',
      '  .tabs::after {',
      '    content: "";',
      '    position: absolute;',
      '    bottom: 0;',
      '    height: 2px;',
      '    background: #3b82f6;',
      '    /* JS 设置 left 和 width */',
      '    transition: left 0.3s ease, width 0.3s ease;',
      '  }',
      '',
      '  /* JS：',
      '  const indicator = document.querySelector(".tabs::after");',
      '  const activeTab = document.querySelector(".tab.active");',
      '  const rect = activeTab.getBoundingClientRect();',
      '  const parentRect = activeTab.parentElement.getBoundingClientRect();',
      '  indicator.style.left = (rect.left - parentRect.left) + "px";',
      '  indicator.style.width = rect.width + "px";',
      '  */',
      '',
      '【模式 13：列表项交错入场】',
      '  @keyframes slideIn {',
      '    from {',
      '      opacity: 0;',
      '      transform: translateX(-20px);',
      '    }',
      '    to {',
      '      opacity: 1;',
      '      transform: translateX(0);',
      '    }',
      '  }',
      '  .list-item {',
      '    opacity: 0;',
      '    animation: slideIn 0.4s ease forwards;',
      '    animation-delay: calc(var(--i, 0) * 0.08s);',
      '  }',
      '  // HTML：',
      '  // <li class="list-item" style="--i: 0">Item 1</li>',
      '  // <li class="list-item" style="--i: 1">Item 2</li>',
      '  // <li class="list-item" style="--i: 2">Item 3</li>',
      '',
      '【模式 14：滚动视差（scroll + transform）】',
      '  /* CSS scroll-timeline（实验性，Chrome 115+）*/',
      '  .parallax {',
      '    animation: parallax linear;',
      '    animation-timeline: scroll();',
      '  }',
      '  @keyframes parallax {',
      '    from { transform: translateY(0); }',
      '    to   { transform: translateY(-100px); }',
      '  }',
      '  /* 旧方案：JS + scroll 监听 + transform */',
      '',
      '【浏览器支持】',
      `  View Transitions API: ${f.viewTransitions ? '✓' : '✗'} (Chrome 111+)`,
      `  @starting-style / transition-behavior: allow-discrete: ${f.transitionBehavior ? '✓' : '✗'} (Chrome 117+)`,
      '',
      '【资源】',
      '  - CSS Transitions 规范：https://drafts.csswg.org/css-transitions/',
      '  - CSS Animations 规范：https://drafts.csswg.org/css-animations/',
      '  - CSS Easing Functions：https://drafts.csswg.org/css-easing-1/',
      '  - Web Animations API：https://developer.mozilla.org/docs/Web/API/Web_Animations_API',
      '  - Animate.css（预设动画库）：https://animate.style/',
      '  - View Transitions API：https://developer.mozilla.org/docs/Web/API/View_Transitions_API',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战动画模式演示完成');
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战动画模式（hover / 淡入 / 旋转 / 脉冲 / 摆动 / 进度条 / 打字机 / 精灵图 / 模态框 / 视图过渡）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.viewTransitions ? 'success' : 'error' }, `View Transitions ${f.viewTransitions ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '14 种实战模式：hover 反馈（scale + ease-out）/ 卡片淡入（opacity + translateY + 错峰延迟）/ 加载旋转（rotate + infinite）/ 脉冲呼吸（scale + alternate）/ 摆动（rotate + alternate）/ 滑入菜单（transform + transition）/ 进度条（width + transition 或 animation）/ 打字机（steps + animation）/ 精灵图逐帧（steps + background-position）/ 模态框淡入淡出（@starting-style + transition-behavior: allow-discrete）/ 视图过渡（View Transitions API）/ 导航栏指示器 / 列表项交错入场 / 滚动视差。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '脉冲呼吸效果：'),
        h('div', { class: 'ta-box ta-pulse' }, 'PULSE'),
        h('div', { class: 'fs-sm text-secondary' }, '摆动效果：'),
        h('div', { class: 'ta-box ta-wiggle' }, 'WIGGLE'),
        h('div', { class: 'fs-sm text-secondary' }, '进度条效果：'),
        h('div', { class: 'ta-progress' }, h('div', { class: 'ta-progress__bar' })),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看 14 种实战动画模式完整代码）')),
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
      h('h2', { class: 'section-title' }, 'CSS Transitions & @keyframes Animations 实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Transitions Module + CSS Animations Module + Easing Functions —— 浏览器原生动画体系',
        description: '演示 CSS Transitions 全套属性（transition-property/duration/timing-function/delay 简写与多属性独立设置）、@keyframes 关键帧定义（from/to 与百分比多关键帧/!important 忽略/同名覆盖/var() 与 calc()/CSSStyleSheet.insertRule 动态修改）、animation-* 全套属性（name/duration/timing-function/delay/iteration-count/direction/fill-mode/play-state，fill-mode 详解 forwards/backwards/both）、cubic-bezier() 缓动深潜（4 参数/常见预设等价关系/y 超出 [0,1] 回弹效果）、steps() 分步与 linear() 多点线性插值（精灵图/打字机/进度条/Chrome 124+ CSS Easing L2）、动画事件与 JS 控制（transitionend/animationiteration/getAnimations/Animation.play()/Web Animations API）、性能优化（will-change/contain/prefers-reduced-motion/60fps 预算 16.67ms）、14 种实战模式（hover/淡入/旋转/脉冲/摆动/进度条/打字机/精灵图/模态框/View Transitions API）。用 CSS.supports() 检测，jsdom 不做真实动画播放但流程完整。',
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
