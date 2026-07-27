// =====================================================================
// CSSHoudiniWorkletsDeepPage.js —— CSS Houdini Worklets 深度实验室
// 专注两大未被 CSSHoudiniPage 覆盖的 Worklet：
//   1. Layout Worklet（registerLayout）—— 作者自定义布局
//      CSS.layoutWorklet.addModule(url) 加载
//      registerLayout(name, class) 注册布局类
//      类实现 inputProperties / childInputProperties / layoutChildren /
//        intrinsicSizes / async layout(children, edges, constraints, styleMap, breakToken)
//      display: layout(name) 触发自定义布局
//      与 Flexbox/Grid 并列的「作者定义布局」能力
//      浏览器支持最弱：仅 Chromium 实验（需 enable-experimental-web-platform-features）
//   2. Animation Worklet（registerAnimator）—— 合成线程动画
//      CSS.animationWorklet.addModule(url) 加载
//      registerAnimator(name, class) 注册动画类
//      类实现 inputProperties / outputProperties / constructor(options) /
//        animate(currentTime, effect)
//      new WorkletAnimation(name, keyframes, timeline, options) 创建实例
//      跑在 compositor thread，不受主线程阻塞，60fps 稳定
//      浏览器支持：Chrome 85+ / Safari 17+ / Firefox 暂不支持
// 说明：jsdom 不做真实 CSS 渲染，真实 Worklet 不会执行；本页注入视觉 mockup
//       （masonry 瀑布流 / parallax 视差）+ 完整代码示例与 API 签名参考。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSHoudiniWorkletsDeepPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',       // Card 1：Houdini 概述与 Worklets 体系
      layoutBasicInfo: '',    // Card 2：Layout Worklet 概述与 registerLayout
      layoutMethodInfo: '',   // Card 3：Layout Worklet layout() 方法深潜
      layoutMasonryInfo: '',  // Card 4：Layout Worklet 实战 masonry 瀑布流
      animBasicInfo: '',      // Card 5：Animation Worklet 概述与 registerAnimator
      animMethodInfo: '',     // Card 6：Animation Worklet animate() 方法深潜
      animParallaxInfo: '',   // Card 7：Animation Worklet 实战 视差滚动
      debugInfo: '',          // Card 8：Worklet 调试与陷阱
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `layoutWorklet ${c(f.layoutWorklet)}`,
      `animationWorklet ${c(f.animationWorklet)}`,
      `paintWorklet ${c(f.paintWorklet)}`,
      `WorkletAnimation ${c(f.workletAnimation)}`,
      `ScrollTimeline ${c(f.scrollTimeline)}`,
      `ViewTimeline ${c(f.viewTimeline)}`,
    ];

    const summary = f.css
      ? `CSS Houdini Worklets 能力检测：${parts.join(' · ')}。jsdom 不执行真实 Worklet，按钮点击注入视觉 mockup + 完整代码示例与 API 签名参考；真实浏览器（Chrome 启用实验特性）可查看 Layout/Animation Worklet 实际效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.layoutWorklet) this._addLog('warn', 'CSS.layoutWorklet 不可用（Layout Worklet 仅 Chromium 实验）');
    if (!f.animationWorklet) this._addLog('warn', 'CSS.animationWorklet 不可用（Chrome 85+ / Safari 17+ / Firefox 暂不支持）');
    if (!f.workletAnimation) this._addLog('warn', 'WorkletAnimation 不可用（Animation Worklet API）');
    if (!f.scrollTimeline) this._addLog('warn', 'ScrollTimeline 不可用（scroll-driven animations 基础）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
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
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id, css) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _injectBaseStyles() {
    this._injectStyle('css-hw-base', `
      .hw-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .hw-masonry-viz {
        column-count: 3;
        column-gap: 8px;
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .hw-masonry-item {
        break-inside: avoid;
        margin-bottom: 8px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: #fff;
        padding: 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .hw-masonry-item--a { height: 60px; }
      .hw-masonry-item--b { height: 90px; background: linear-gradient(135deg, #10b981, #34d399); }
      .hw-masonry-item--c { height: 50px; background: linear-gradient(135deg, #f59e0b, #fbbf24); }
      .hw-masonry-item--d { height: 80px; background: linear-gradient(135deg, #ef4444, #f87171); }
      .hw-masonry-item--e { height: 70px; background: linear-gradient(135deg, #ec4899, #f472b6); }
      .hw-masonry-item--f { height: 100px; background: linear-gradient(135deg, #6366f1, #818cf8); }
      .hw-parallax-viz {
        position: relative;
        height: 140px;
        overflow: hidden;
        border-radius: 8px;
        margin-top: 10px;
        background: linear-gradient(180deg, #dbeafe 0%, #ede9fe 60%, #fce7f3 100%);
        border: 1px solid #cbd5e1;
      }
      .hw-parallax-layer {
        position: absolute;
        left: 0;
        right: 0;
        font-size: 11px;
        font-weight: 600;
        color: #fff;
        padding: 6px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .hw-parallax-layer--back {
        top: 8px;
        background: rgba(59, 130, 246, 0.5);
      }
      .hw-parallax-layer--mid {
        top: 50px;
        background: rgba(139, 92, 246, 0.6);
      }
      .hw-parallax-layer--front {
        bottom: 8px;
        background: rgba(236, 72, 153, 0.7);
      }
      .hw-parallax-rate {
        margin-left: auto;
        background: rgba(0, 0, 0, 0.25);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
      }
      .hw-circle-viz {
        position: relative;
        width: 200px;
        height: 200px;
        margin: 12px auto;
        border: 2px dashed #cbd5e1;
        border-radius: 50%;
      }
      .hw-circle-item {
        position: absolute;
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 50%;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        top: 50%;
        left: 50%;
        margin: -14px 0 0 -14px;
      }
      .hw-timeline-viz {
        padding: 12px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        margin-top: 10px;
        font-family: monospace;
        font-size: 11px;
      }
      .hw-timeline-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
      }
      .hw-timeline-bar {
        flex: 1;
        height: 8px;
        background: #334155;
        border-radius: 4px;
        position: relative;
        overflow: hidden;
      }
      .hw-timeline-fill {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        border-radius: 4px;
      }
      .hw-output {
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

  _flags() {
    const hasCSS = typeof CSS !== 'undefined';
    const check = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      css: hasCSS,
      layoutWorklet: check(() => hasCSS && typeof CSS.layoutWorklet !== 'undefined' && typeof CSS.layoutWorklet.addModule === 'function'),
      animationWorklet: check(() => hasCSS && typeof CSS.animationWorklet !== 'undefined' && typeof CSS.animationWorklet.addModule === 'function'),
      paintWorklet: check(() => hasCSS && typeof CSS.paintWorklet !== 'undefined' && typeof CSS.paintWorklet.addModule === 'function'),
      workletAnimation: check(() => typeof WorkletAnimation !== 'undefined'),
      scrollTimeline: check(() => typeof ScrollTimeline !== 'undefined'),
      viewTimeline: check(() => typeof ViewTimeline !== 'undefined'),
    };
  }

  // ===================== Card 1：Houdini 概述与 Worklets 体系 =====================

  _runOverviewDemo() {
    const f = this._flags();
    const info = `
===== CSS Houdini 概述与 Worklets 体系 =====

【Houdini 是什么】
  Houdini 是 W3C CSS-TAG 推动的一组草案，目标：
  把 CSS 引擎的底层渲染管线暴露给 JavaScript，让开发者
  能「介入」样式解析 → 布局 → 绘制 → 合成 各阶段。
  传统上 CSS 引擎是黑盒，JS 只能读写最终计算样式；
  Houdini 后 JS 可自定义属性解析、布局算法、绘制逻辑、动画驱动。

【Houdini 全景：8 大 API】
  1. CSS Properties & Values API（CSS.registerProperty / @property）
     注册自定义属性类型，使其可过渡、可继承、有初始值。
  2. CSS Typed OM（attributeStyleMap / computedStyleMap / CSSUnitValue）
     类型化样式读写，替代字符串风格的 el.style.foo = "10px"。
  3. CSS Painting API + Paint Worklet（registerPaint）
     自定义绘制背景/边框/图标，输出位图。CSSHoudiniPage 已覆盖。
  4. CSS Layout API + Layout Worklet（registerLayout）★ 本页重点
     自定义布局算法，display: layout(name) 触发。
  5. Animation Worklet（registerAnimator）★ 本页重点
     合成线程动画，new WorkletAnimation 创建，不受主线程阻塞。
  6. CSS Parser API（CSS.parseStyleSheet / parsePropertyValue）
     直接解析 CSS 文本为 Type OM 结构（规范草案，支持弱）。
  7. Font Metrics API（queryFontMetrics）
     读取字体度量（ascent/descent/baseline），用于精确对齐（草案）。
  8. Worklets 底层基础设施（Worklet Global Scope 生命周期）

【三大 Worklet 对照】
  Worklet          | 加载入口                       | 注册函数        | 触发方式
  -----------------|--------------------------------|-----------------|------------------
  Paint Worklet    | CSS.paintWorklet.addModule()   | registerPaint   | paint(name, ...)
  Layout Worklet   | CSS.layoutWorklet.addModule()  | registerLayout  | display: layout(name)
  Animation Worklet| CSS.animationWorklet.addModule()| registerAnimator| new WorkletAnimation(name, ...)

【Worklet 与 Worker 的区别】
  Worker（Web Worker / Service Worker / Shared Worker）：
    - 独立线程长期运行，主线程通过 postMessage 通信
    - 拥有完整全局（self、importScripts、fetch 等）
    - 适合：耗时计算、后台同步、消息推送

  Worklet：
    - 轻量 Worker，可被渲染线程 / 合成线程按需调用
    - 无 DOM 访问（无 window / document / localStorage）
    - 独立全局作用域（无 window，但有 registerPaint / registerLayout /
      registerAnimator / self）
    - 生命周期由渲染引擎管理（可被随时创建 / 销毁 / 复用）
    - 适合：高频低延迟的渲染钩子（每帧 / 每次重排都可能调用）

  关键差异：
    Worker = 通用后台线程（消息驱动）
    Worklet = 渲染管线钩子（引擎驱动，同步阻塞渲染）

【Worklet 生命周期与 addModule 加载机制】
  1. 主线程调用 CSS.xxxWorklet.addModule(url)（返回 Promise）
  2. 引擎在网络线程拉取模块脚本（受同源策略 + CSP 限制）
  3. 引擎为每个 Worklet Global Scope 加载并执行模块
  4. 模块顶层调用 registerXxx(name, class) 完成注册
  5. CSS 引擎在渲染时按需实例化 class 并调用其方法
  6. Worklet 实例可能被复用（stateful）或重建（stateless）

  // 异步加载示例
  async function loadAllWorklets() {
    await Promise.all([
      CSS.paintWorklet.addModule("/worklets/paint.js"),
      CSS.layoutWorklet.addModule("/worklets/layout.js"),
      CSS.animationWorklet.addModule("/worklets/animator.js"),
    ]);
    console.log("所有 Worklet 加载完成");
  }

【Houdini 整体路线图与浏览器支持现状（2024-2026）】
  已稳定可用：
    - Properties & Values API（@property）：Chrome 85+ / Safari 16.4+ / Firefox 128+
    - Paint Worklet（registerPaint）：Chrome 65+ / Safari 18+（部分）/ Firefox 暂不支持
    - CSS Typed OM：Chrome 66+ / Safari 16.4+ / Firefox 暂不支持
  实验性：
    - Layout Worklet（registerLayout）：仅 Chromium 实验
      需 chrome://flags 启用 enable-experimental-web-platform-features
    - Animation Worklet（registerAnimator）：Chrome 85+ / Safari 17+ / Firefox 暂不支持
  草案（基本无实现）：
    - CSS Parser API、Font Metrics API

【本页定位】
  CSSHoudiniPage 已覆盖：registerProperty / Paint Worklet / Typed OM /
    :has()/:is()/:where() / Container Queries / @layer
  本页专注：Layout Worklet（registerLayout）+ Animation Worklet（registerAnimator）
  两者是 Houdini 最具想象力但浏览器支持最弱的部分。

【浏览器支持】
  layoutWorklet: ${f.layoutWorklet ? '✓' : '✗'} (仅 Chromium 实验)
  animationWorklet: ${f.animationWorklet ? '✓' : '✗'} (Chrome 85+ / Safari 17+ / Firefox 暂不支持)
  paintWorklet: ${f.paintWorklet ? '✓' : '✗'} (Chrome 65+ / Safari 18+ 部分)

【常见陷阱】
  1. Worklet 模块必须通过 URL 加载（不能内联字符串，不能 import 字符串）
  2. addModule 是 Promise，未 await 就使用 display: layout() 会无效
  3. Worklet 内无 window/document，所有 DOM API 都不可用
  4. 同一 name 重复 registerXxx 会被忽略（已注册不覆盖）
  5. Worklet 受 CSP script-src 'self' 限制（不能用 inline / blob:）
`;
    this.setState({ overviewInfo: info });
    this._addLog('css', `Houdini 概述演示完成；layoutWorklet=${f.layoutWorklet}/animationWorklet=${f.animationWorklet}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const code = `// 三大 Worklet 的加载入口
// Paint Worklet（已在 CSSHoudiniPage 介绍）
CSS.paintWorklet.addModule('/worklets/paint.js');

// Layout Worklet（本页重点 ★）
CSS.layoutWorklet.addModule('/worklets/layout.js');

// Animation Worklet（本页重点 ★）
CSS.animationWorklet.addModule('/worklets/animator.js');

// Worklet 与 Worker 的区别
// - Worklet 是轻量 Worker，可被渲染线程 / 合成线程调用
// - 无 DOM 访问（无 window / document / localStorage）
// - 独立全局作用域（无 window，但有 registerPaint / registerLayout /
//   registerAnimator）
// - 生命周期由渲染引擎管理（可被随时创建 / 销毁 / 复用）

// addModule 异步加载（返回 Promise）
async function loadAllWorklets() {
  await Promise.all([
    CSS.paintWorklet.addModule('/worklets/paint.js'),
    CSS.layoutWorklet.addModule('/worklets/layout.js'),
    CSS.animationWorklet.addModule('/worklets/animator.js'),
  ]);
  console.log('所有 Worklet 加载完成');
}`;
    const card = new Card({
      title: '1. CSS Houdini 概述与 Worklets 体系',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['layoutWorklet', f.layoutWorklet],
          ['animationWorklet', f.animationWorklet],
        ]),
        h(Tag, { color: 'primary' }, 'Houdini 总览'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Houdini 把 CSS 引擎底层暴露给 JS。三大 Worklet（Paint/Layout/Animation）+ Properties & Values API + Typed OM + CSS Parser API + Font Metrics API 全景。Worklet 是轻量 Worker，可被渲染线程调用，无 DOM 访问，独立全局作用域。addModule 异步加载模块，引擎按需实例化。Layout Worklet 仅 Chromium 实验，Animation Worklet Chrome 85+/Safari 17+/Firefox 暂不支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Houdini 概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 Houdini 概述与 Worklets 体系完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：Layout Worklet 概述与 registerLayout =====================

  _runLayoutBasicDemo() {
    const f = this._flags();
    const info = `
===== Layout Worklet 概述与 registerLayout =====

【Layout Worklet 是什么】
  Layout Worklet 让开发者用 JS 编写自定义布局算法，与 Flexbox / Grid
  并列，称为「作者定义布局」（Author-defined Layout）。
  注册后通过 display: layout(name) 触发，浏览器在重排时调用你的 layout() 方法。

  这是 Houdini 最具想象力的部分：
    - 实现规范未提供的布局（masonry 瀑布流 / circle 圆形 / 自定义对齐）
    - 无需 JS 框架（如 Masonry.js）手动计算位置
    - 浏览器原生集成，可参与分页 / 打印 / RTL / writing-mode

【加载入口：CSS.layoutWorklet.addModule(url)】
  // 主线程
  if (CSS.layoutWorklet) {
    await CSS.layoutWorklet.addModule('/worklets/masonry.js');
  } else {
    // 降级：CSS Grid / multi-column / JS 库
  }

  // addModule 返回 Promise，模块在 Layout Worklet Global Scope 执行
  // 模块顶层调用 registerLayout(name, class) 完成注册

【registerLayout(name, class) 注册签名】
  registerLayout(name, layoutClass)

  参数：
    name        字符串，布局名，对应 display: layout(<name>)
    layoutClass 类，需实现以下静态属性与方法：

  类需实现的成员：
    static get inputProperties()
      返回字符串数组：本布局需要读取的「自身」CSS 属性（Type OM 读取）
      例：return ['--column-count', '--gap'];

    static get childInputProperties()
      返回字符串数组：本布局需要读取的「子元素」CSS 属性
      例：return ['--span', '--order'];

    static get layoutChildren()
      返回布尔 / 函数：哪些子元素参与布局（默认全部）
      例：return true;  // 所有子元素
      例：return (child) => child.styleMap.get('display').value !== 'none';

    static get childInputProperties() 已述
    static get intrinsicSizes()（可选）
      返回类，实现 minContent / maxContent 用于自动尺寸推断
      浏览器在无固定尺寸时调用以推断 inline/block 尺寸

    async layout(children, edges, constraints, styleMap, breakToken)
      核心布局方法，详见 Card 3
      返回 { inlineSize, blockSize, childFragments, ... }

【display: layout(name) 触发自定义布局】
  /* CSS */
  .masonry-container {
    display: layout(masonry);       /* 触发自定义布局 */
    --column-count: 3;
    --gap: 8px;
  }

  /* 与 Flexbox / Grid 并列 */
  .flex  { display: flex; }        /* 浏览器内置 */
  .grid  { display: grid; }        /* 浏览器内置 */
  .mine  { display: layout(mine); } /* 作者自定义 */

【registerLayout 最小骨架】
  // masonry.js
  registerLayout('my-layout', class {
    static get inputProperties() { return ['--my-prop']; }
    static get childInputProperties() { return []; }
    static get layoutChildren() { return true; }

    async layout(children, edges, constraints, styleMap, breakToken) {
      const fragments = await Promise.all(
        children.map(c => c.layoutNextFragment({}))
      );
      return {
        inlineSize: constraints.fixedInlineSize || 300,
        blockSize: 200,
        childFragments: fragments,
      };
    }
  });

【与 Flexbox / Grid 的关系】
  - Flexbox / Grid 是规范内置布局，性能最优，浏览器高度优化
  - Layout Worklet 是「逃生舱」，实现规范未覆盖的布局
  - Layout Worklet 性能低于内置布局（JS 调用开销 + 每次重排都调用）
  - 适合：masonry / circle / 自定义对齐等长尾需求
  - 不适合：能用 Flexbox/Grid 解决的场景（优先用内置）

【Layout Worklet 是 Houdini 最具想象力但支持最弱的部分】
  - 仅 Chromium 实验，需启用 enable-experimental-web-platform-features
  - Firefox / Safari 暂未实现（截至 2025）
  - 规范本身仍在草案阶段，API 可能变动
  - 生产环境需 @supports 检测 + 降级方案

【浏览器支持】
  layoutWorklet.addModule: ${f.layoutWorklet ? '✓' : '✗'} (仅 Chromium 实验)
  display: layout():  ${f.layoutWorklet ? '✓' : '✗'} (需启用实验特性)

【常见陷阱】
  1. layout() 必须是 async（返回 Promise），不能同步返回
  2. inputProperties 声明的属性未用 @property 注册时仍可读取（取初始值）
  3. display: layout(name) 的 name 必须已 registerLayout，否则回退到 block
  4. Layout Worklet 内不能访问 DOM，所有信息从参数获取
  5. 每次重排（resize / 子元素增删 / 属性变化）都会重新调用 layout()
  6. 返回的 inlineSize/blockSize 决定容器尺寸，错误值会导致布局抖动
`;
    this.setState({ layoutBasicInfo: info });
    this._addLog('css', `Layout Worklet 概述演示完成；layoutWorklet=${f.layoutWorklet}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const code = `// layout.js —— Layout Worklet 模块
// 运行在 Layout Worklet 全局作用域（无 window / document）

registerLayout('my-layout', class {
  // 声明本布局需要读取的自身 CSS 属性（Type OM）
  static get inputProperties() { return ['--my-prop']; }

  // 声明本布局需要读取的子元素 CSS 属性
  static get childInputProperties() { return ['--child-prop']; }

  // 声明哪些子元素是布局子元素（默认全部）
  static get layoutChildren() { return true; }

  // 计算固有尺寸（自动尺寸推断，可选）
  static get intrinsicSizes() {
    return class {
      static get minContent() { /* ... */ }
      static get maxContent() { /* ... */ }
    };
  }

  // 核心布局方法（async，详见 Card 3）
  async layout(children, edges, constraints, styleMap, breakToken) {
    // children: LayoutChild[] —— 子元素布局句柄
    // edges: LayoutEdges —— padding / border / inset
    // constraints: LayoutConstraints —— 可用空间 / 固定尺寸
    // styleMap: TypeOMStyleMap —— 自身 CSS 属性读取
    // breakToken: 分页断行（打印 / 分页场景）

    // 生成子元素片段
    const fragments = await Promise.all(
      children.map(child => child.layoutNextFragment({}))
    );

    // 返回布局结果
    return {
      inlineSize: 300,     // 行内尺寸（宽度）
      blockSize: 200,      // 块尺寸（高度）
      childFragments: fragments,
    };
  }
});

// 使用：display: layout(name)
// .box { display: layout(my-layout); }`;
    const card = new Card({
      title: '2. Layout Worklet 概述与 registerLayout',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['layoutWorklet', f.layoutWorklet]]),
        h(Tag, { color: f.layoutWorklet ? 'success' : 'error' }, '仅 Chromium 实验'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS.layoutWorklet.addModule(url) 加载布局模块，registerLayout(name, class) 注册布局类。类需实现 static get inputProperties() / childInputProperties() / layoutChildren() / async layout(children, edges, constraints, styleMap, breakToken)。display: layout(name) 触发自定义布局，与 Flexbox/Grid 并列的「作者定义布局」能力。Layout Worklet 是 Houdini 最具想象力但浏览器支持最弱的部分，仅 Chromium 实验。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 registerLayout 概述演示', { type: 'primary', size: 'sm', onClick: () => this._runLayoutBasicDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.layoutBasicInfo || '（点击按钮查看 registerLayout 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：Layout Worklet layout() 方法深潜 =====================

  _runLayoutMethodDemo() {
    const f = this._flags();
    const info = `
===== Layout Worklet layout() 方法深潜 =====

【方法签名】
  async layout(children, edges, constraints, styleMap, breakToken)

  这是 registerLayout 注册类的核心方法，浏览器在重排时调用。
  必须返回布局结果对象，详见末尾「返回值」。

【参数 1：children —— LayoutChild[]】
  LayoutChild 数组，每个元素代表一个子元素的布局句柄。

  LayoutChild 方法：
    child.layoutNextFragment(constraints) → Promise<LayoutFragment>
      生成子元素的片段（fragment）。constraints 可指定：
        availableInlineSize   可用行内空间
        availableBlockSize    可用块空间
        fixedInlineSize       固定行内尺寸（强制宽度）
        fixedBlockSize        固定块尺寸（强制高度）
        breakToken            分页断行（续排）

  LayoutFragment 属性（生成后可设置位置）：
    fragment.inlineSize       片段行内尺寸
    fragment.blockSize        片段块尺寸
    fragment.inlineOffset     行内方向偏移（X 轴，可写）
    fragment.blockOffset      块方向偏移（Y 轴，可写）
    fragment.baselines        基线信息

  // 典型用法：批量生成片段再排位
  const fragments = await Promise.all(
    children.map(c => c.layoutNextFragment({
      availableInlineSize: constraints.availableInlineSize,
    }))
  );
  fragments.forEach((frag, i) => {
    frag.inlineOffset = i * 50;
    frag.blockOffset = 0;
  });

【参数 2：edges —— LayoutEdges】
  描述容器的 padding / border / inset（scrollbar）边距。

  属性：
    edges.inlineStart / edges.inlineEnd    行内方向起止边距
    edges.blockStart / edges.blockEnd      块方向起止边距
    edges.inline                           行内总边距（start + end）
    edges.block                            块总边距（start + end）

  // 计算内容区可用空间
  const contentInline = constraints.availableInlineSize; // 已扣除 edges
  const paddingBlock = edges.blockStart + edges.blockEnd;

【参数 3：constraints —— LayoutConstraints】
  描述布局约束（固定尺寸 / 可用空间 / 百分比基准）。

  属性：
    constraints.fixedInlineSize       固定行内尺寸（null 或数值，width 设定时有）
    constraints.fixedBlockSize        固定块尺寸（null 或数值）
    constraints.availableInlineSize   可用行内空间（已扣除 padding/border）
    constraints.availableBlockSize    可用块空间
    constraints.percentageInlineSize  百分比基准行内尺寸
    constraints.percentageBlockSize   百分比基准块尺寸
    constraints.data                  自定义数据（LayoutConstraintsOptions 传入）

  // 自适应：固定尺寸优先，否则用可用空间
  const inline = constraints.fixedInlineSize || constraints.availableInlineSize;

【参数 4：styleMap —— TypeOMStyleMap】
  读取容器自身 CSS 属性（inputProperties 声明的）。

  方法：
    styleMap.get(propertyName) → Type OM 值（CSSUnitValue / CSSKeywordValue ...）
    styleMap.getAll(propertyName) → Type OM 值数组

  // 读取自定义属性（需 inputProperties 声明）
  const gapVal = styleMap.get('--gap');         // CSSUnitValue { value: 8, unit: 'px' }
  const gap = gapVal ? gapVal.value : 0;        // 取数值部分
  const cols = styleMap.get('--column-count');
  const colCount = cols ? cols.value : 3;

  // 读取标准属性
  const display = styleMap.get('display');      // CSSKeywordValue { value: 'layout(...)' }

【参数 5：breakToken —— 分页断行】
  打印 / 分页 / 多列场景传入，用于续排。
  非分页场景为 null。

  // 处理分页
  if (breakToken) {
    // 从断点继续布局子元素
    const childBreakTokens = breakToken.childBreakTokens;
    // ...
  }

  // 生成新断点（返回值中）
  return {
    // ...
    breakToken: new BreakToken({ childBreakTokens: [...] }),
  };

【返回值：布局结果对象】
  return {
    inlineSize: <number>,          // 内容行内尺寸（决定容器宽度）
    blockSize: <number>,           // 内容块尺寸（决定容器高度）
    childFragments: [<LayoutFragment>, ...],  // 排好位的子片段
    autoBlockSize: <number>,       // 可选：自动块尺寸
    baselines: { ... },            // 可选：基线信息
    overflow: { ... },             // 可选：溢出信息
    breakToken: <BreakToken>,      // 可选：分页断点
  };

  // 最小返回
  return {
    inlineSize: 300,
    blockSize: 200,
    childFragments: fragments,
  };

【与 intrinsicSizes 配合自动尺寸】
  当容器无固定尺寸（width: auto）时，浏览器调用 intrinsicSizes 推断：

  static get intrinsicSizes() {
    return class {
      static get minContent(constraints, edges, styleMap, childBreakTokens) {
        // 返回最小内容尺寸
        return { inlineSize: 100, blockSize: 50 };
      }
      static get maxContent(constraints, edges, styleMap, childBreakTokens) {
        // 返回最大内容尺寸
        return { inlineSize: 1000, blockSize: 50 };
      }
    };
  }

  // 浏览器用 minContent/maxContent 计算 width: min-content/max-content/fill 等

【完整的 layout() 方法示例】
  async layout(children, edges, constraints, styleMap, breakToken) {
    const gap = (styleMap.get('--gap') || { value: 8 }).value;
    const inline = constraints.fixedInlineSize || constraints.availableInlineSize;

    const fragments = await Promise.all(
      children.map(c => c.layoutNextFragment({
        availableInlineSize: inline,
      }))
    );

    let blockOffset = edges.blockStart;
    fragments.forEach(frag => {
      frag.inlineOffset = edges.inlineStart;
      frag.blockOffset = blockOffset;
      blockOffset += frag.blockSize + gap;
    });

    return {
      inlineSize: inline,
      blockSize: blockOffset - gap + edges.blockEnd,
      childFragments: fragments,
    };
  }

【浏览器支持】
  layout(): ${f.layoutWorklet ? '✓' : '✗'} (仅 Chromium 实验，API 仍可能变动)

【常见陷阱】
  1. layoutNextFragment 是 async，必须 await / Promise.all
  2. inlineOffset / blockOffset 是相对「内容区」原点（已扣除 padding）
  3. 返回的 inlineSize 不含 padding/border（除非 box-sizing 处理）
  4. 子元素片段必须全部放入 childFragments，否则不渲染
  5. 分页场景 breakToken 处理复杂，非分页可忽略
  6. styleMap.get 返回 Type OM 值，不是字符串，需 .value 取数值
  7. 不要在 layout() 中访问 DOM（无 document/window）
`;
    this.setState({ layoutMethodInfo: info });
    this._addLog('css', `layout() 方法深潜演示完成；layoutWorklet=${f.layoutWorklet}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const code = `// layout(children, edges, constraints, styleMap, breakToken) 参数详解
async layout(children, edges, constraints, styleMap, breakToken) {

  // —— children: LayoutChild[] ——
  // 每个 LayoutChild 代表一个子元素，调用 layoutNextFragment 生成片段
  const childFragments = await Promise.all(
    children.map(child => child.layoutNextFragment({
      // availableInlineSize: 可用行内空间
      // availableBlockSize: 可用块空间
      // fixedInlineSize: 固定行内尺寸
      // fixedBlockSize: 固定块尺寸
      // breakToken: 分页断行
    }))
  );

  // —— edges: LayoutEdges ——
  // padding / border / inset（scrollbar）边距
  const paddingInline = edges.inlineStart + edges.inlineEnd;
  const paddingBlock = edges.blockStart + edges.blockEnd;

  // —— constraints: LayoutConstraints ——
  // 固定尺寸与可用空间
  const fixedInline = constraints.fixedInlineSize;   // null 或数值
  const fixedBlock = constraints.fixedBlockSize;     // null 或数值
  const availableInline = constraints.availableInlineSize;
  const availableBlock = constraints.availableBlockSize;

  // —— styleMap: TypeOMStyleMap ——
  // 读取自身 CSS 属性（Type OM 值）
  const gap = styleMap.get('--gap');          // CSSUnitValue
  const columns = styleMap.get('--columns');  // CSSUnitValue
  const gapValue = gap ? gap.value : 0;       // 数值部分

  // —— breakToken: 分页断行 ——
  if (breakToken) {
    // 从断点继续布局
  }

  // —— 返回布局结果 ——
  return {
    inlineSize: 300,        // 内容行内尺寸
    blockSize: 200,         // 内容块尺寸
    childFragments: childFragments,
    // 可选：autoBlockSize / baselines / overflow / breakToken
  };
}`;
    const card = new Card({
      title: '3. Layout Worklet layout() 方法深潜',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['layout()', f.layoutWorklet]]),
        h(Tag, { color: 'primary' }, '方法深潜'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'layout(children, edges, constraints, styleMap, breakToken) 参数详解：children LayoutChild 数组（.layoutNextFragment() 生成片段）、edges LayoutEdges（padding/border/inset）、constraints LayoutConstraints（fixedInlineSize/fixedBlockSize/availableInlineSize）、styleMap TypeOMStyleMap（读取自身 CSS 属性）、breakToken 分页断行。返回 { inlineSize, blockSize, childFragments, ... } 自定义布局结果，与 intrinsicSizes 配合自动尺寸。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 layout() 方法深潜演示', { type: 'primary', size: 'sm', onClick: () => this._runLayoutMethodDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.layoutMethodInfo || '（点击按钮查看 layout() 方法完整参数说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：Layout Worklet 实战 masonry 瀑布流 =====================

  _runLayoutMasonryDemo() {
    const f = this._flags();
    this._injectStyle('hw-masonry-demo', `
      .hw-masonry-viz {
        column-count: 4;
      }
    `);
    const info = `
===== Layout Worklet 实战：masonry 瀑布流 =====

【masonry 瀑布流布局原理】
  - 列宽固定，元素按高度分配到「最短列」
  - 每个元素高度不定，自动填入当前最矮的列
  - 视觉上呈现参差不齐的瀑布效果
  - 典型场景：Pinterest / 图片画廊 / 卡片墙

【registerLayout('masonry', class) 完整代码】
  // masonry.js —— Layout Worklet 瀑布流
  registerLayout('masonry', class {
    // 读取列数与间距配置
    static get inputProperties() {
      return ['--column-count', '--gap'];
    }

    static get childInputProperties() { return []; }
    static get layoutChildren() { return true; }

    async layout(children, edges, constraints, styleMap, breakToken) {
      // 读取配置（Type OM → 数值）
      const columnCount =
        (styleMap.get('--column-count') || { value: 3 }).value;
      const gap =
        (styleMap.get('--gap') || { value: 8 }).value;

      // 可用宽度（已扣除 padding/border）
      const availableInline = constraints.availableInlineSize;
      const columnWidth =
        (availableInline - gap * (columnCount - 1)) / columnCount;

      // 初始化每列当前高度
      const columnHeights = new Array(columnCount).fill(0);
      const childFragments = [];

      // 逐个分配子元素到最短列
      for (const child of children) {
        // 找到最短列
        let minCol = 0;
        for (let i = 1; i < columnCount; i++) {
          if (columnHeights[i] < columnHeights[minCol]) minCol = i;
        }

        // 生成子元素片段（固定列宽）
        const fragment = await child.layoutNextFragment({
          fixedInlineSize: columnWidth,
          availableBlockSize: constraints.availableBlockSize,
        });

        // 计算位置（相对内容区原点）
        const x = minCol * (columnWidth + gap);
        const y = columnHeights[minCol];

        fragment.inlineOffset = x + edges.inlineStart;
        fragment.blockOffset = y + edges.blockStart;

        childFragments.push(fragment);
        columnHeights[minCol] = y + fragment.blockSize + gap;
      }

      // 块尺寸 = 最高列
      const maxBlock = Math.max(...columnHeights, 0);

      return {
        inlineSize: availableInline,
        blockSize: maxBlock,
        childFragments: childFragments,
      };
    }
  });

【CSS 使用】
  /* 启用自定义 masonry 布局 */
  .masonry {
    display: layout(masonry);
    --column-count: 3;
    --gap: 8px;
  }

  /* 子元素自动排布 */
  .masonry > .item {
    break-inside: avoid;   /* 防止片段内分页 */
  }

【主线程加载】
  async function init() {
    if (!CSS.layoutWorklet) {
      // 降级：multi-column 模拟
      return;
    }
    await CSS.layoutWorklet.addModule('/worklets/masonry.js');
    // 此后 display: layout(masonry) 生效
  }
  init();

【对比 CSS Grid Level 3 masonry 提案】
  /* 规范草案：原生 masonry（无需 Worklet） */
  .masonry-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: masonry;   /* 原生 masonry 关键字 */
    gap: 8px;
  }

  对比：
    CSS Grid masonry：
      + 声明式，无需 JS
      + 浏览器原生优化性能高
      - 规范草案中，仅 Firefox 实验支持
      - 灵活性低（无法自定义分配算法）

    Layout Worklet masonry：
      + 完全可编程（自定义分配策略 / 对齐 / 间距）
      + 可读取自定义属性动态配置
      - 仅 Chromium 实验
      - 性能低于原生（JS 调用开销）

【其他 Layout Worklet 实战】
  1. circle 圆形布局
     registerLayout('circle', class {
       async layout(children, edges, constraints, styleMap) {
         const fragments = await Promise.all(
           children.map(c => c.layoutNextFragment({}))
         );
         const count = fragments.length;
         const radius = (constraints.fixedInlineSize || 200) / 2;
         fragments.forEach((frag, i) => {
           const angle = (i / count) * 2 * Math.PI;
           frag.inlineOffset = radius + Math.cos(angle) * radius;
           frag.blockOffset = radius + Math.sin(angle) * radius;
         });
         return {
           inlineSize: radius * 2,
           blockSize: radius * 2,
           childFragments: fragments,
         };
       }
     });
     // .circle { display: layout(circle); }

  2. flow 流式布局（自定义行内排布）
     实现类似 inline-block 但带自定义换行规则

  3. 自定义对齐
     读取 --align 自定义属性实现 flex align-items 变体

  4. 网格瀑布混合布局
     masonry + 自定义对齐 + 响应式列数

【浏览器支持】
  display: layout(masonry): ${f.layoutWorklet ? '✓' : '✗'} (仅 Chromium 实验)
  grid-template-rows: masonry: 规范草案（Firefox 实验支持）

【常见陷阱】
  1. columnCount 必须正整数，否则除零错误
  2. 子元素片段的 inlineOffset/blockOffset 是相对内容区，需加 edges.inlineStart
  3. maxBlock 计算时记得减去最后一个 gap（避免底部空白）
  4. 响应式：--column-count 用媒体查询切换，layout() 会自动重算
  5. 子元素增删会触发完整重排（无增量优化）
  6. 生产环境务必降级：@supports (display: layout(masonry)) 或 CSS.multi-column
`;
    this.setState({ layoutMasonryInfo: info });
    this._addLog('css', `masonry 瀑布流演示完成；layoutWorklet=${f.layoutWorklet}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const code = `// masonry.js —— Layout Worklet 实现瀑布流
registerLayout('masonry', class {
  static get inputProperties() {
    return ['--column-count', '--gap'];
  }
  static get childInputProperties() { return []; }

  async layout(children, edges, constraints, styleMap, breakToken) {
    const columnCount =
      (styleMap.get('--column-count') || { value: 3 }).value;
    const gap =
      (styleMap.get('--gap') || { value: 8 }).value;

    const availableInline = constraints.availableInlineSize;
    const columnWidth =
      (availableInline - gap * (columnCount - 1)) / columnCount;

    const columnHeights = new Array(columnCount).fill(0);
    const childFragments = [];

    for (const child of children) {
      // 找最短列
      let minCol = 0;
      for (let i = 1; i < columnCount; i++) {
        if (columnHeights[i] < columnHeights[minCol]) minCol = i;
      }
      // 生成片段（固定列宽）
      const fragment = await child.layoutNextFragment({
        fixedInlineSize: columnWidth,
        availableBlockSize: constraints.availableBlockSize,
      });
      // 设置位置
      const x = minCol * (columnWidth + gap);
      const y = columnHeights[minCol];
      fragment.inlineOffset = x + edges.inlineStart;
      fragment.blockOffset = y + edges.blockStart;
      childFragments.push(fragment);
      columnHeights[minCol] = y + fragment.blockSize + gap;
    }

    const maxBlock = Math.max(...columnHeights, 0);
    return {
      inlineSize: availableInline,
      blockSize: maxBlock,
      childFragments: childFragments,
    };
  }
});

// CSS
// .masonry { display: layout(masonry); --column-count: 3; --gap: 8px; }

// 对比 CSS Grid Level 3 masonry 提案
// .masonry-grid {
//   display: grid;
//   grid-template-columns: repeat(3, 1fr);
//   grid-template-rows: masonry;
//   gap: 8px;
// }`;
    const card = new Card({
      title: '4. Layout Worklet 实战：masonry 瀑布流',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['masonry', f.layoutWorklet]]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'masonry 布局实现：列宽固定、元素按高度分配到最短列。registerLayout("masonry", class) 完整代码示例，inputProperties: ["--column-count", "--gap"]，children.map(c => c.layoutNextFragment({fixedInlineSize})) 生成片段。对比 CSS Grid Level 3 masonry 提案（grid-template-rows: masonry）。其他实战：circle 圆形布局、flow 流式布局、自定义对齐。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 masonry 瀑布流演示', { type: 'primary', size: 'sm', onClick: () => this._runLayoutMasonryDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'masonry 视觉 mockup（CSS multi-column 模拟，真实 Worklet 不在 jsdom 运行）：'),
        h('div', { class: 'hw-masonry-viz' },
          h('div', { class: 'hw-masonry-item hw-masonry-item--a' }, '1'),
          h('div', { class: 'hw-masonry-item hw-masonry-item--b' }, '2'),
          h('div', { class: 'hw-masonry-item hw-masonry-item--c' }, '3'),
          h('div', { class: 'hw-masonry-item hw-masonry-item--d' }, '4'),
          h('div', { class: 'hw-masonry-item hw-masonry-item--e' }, '5'),
          h('div', { class: 'hw-masonry-item hw-masonry-item--f' }, '6'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.layoutMasonryInfo || '（点击按钮查看 masonry 瀑布流完整实现）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：Animation Worklet 概述与 registerAnimator =====================

  _runAnimBasicDemo() {
    const f = this._flags();
    const info = `
===== Animation Worklet 概述与 registerAnimator =====

【Animation Worklet 是什么】
  Animation Worklet 让开发者用 JS 编写跑在「合成线程」（compositor thread）
  的动画，不受主线程阻塞。即使主线程卡顿（长任务 / GC），动画仍 60fps。

  解决的核心问题：「输入驱动的滚动动画」
    - 传统 scroll 监听 + transform 跑在主线程，滚动时易卡顿
    - Animation Worklet + ScrollTimeline 跑在合成线程，丝滑滚动

【加载入口：CSS.animationWorklet.addModule(url)】
  // 主线程
  if (CSS.animationWorklet) {
    await CSS.animationWorklet.addModule('/worklets/animator.js');
  } else {
    // 降级：element.animate() / requestAnimationFrame
  }

  // addModule 返回 Promise，模块在 Animation Worklet Global Scope 执行
  // 模块顶层调用 registerAnimator(name, class) 完成注册

【registerAnimator(name, class) 注册签名】
  registerAnimator(name, animatorClass)

  参数：
    name            字符串，animator 名，对应 WorkletAnimation 构造第一参数
    animatorClass   类，需实现以下静态属性与方法：

  类需实现的成员：
    static get inputProperties()
      返回字符串数组：从 element 读取的输入 CSS 属性（Type OM）
      例：return ['--parallax-rate'];

    static get outputProperties()
      返回字符串数组：要写入 element 的输出 CSS 属性
      例：return ['transform', 'opacity'];

    constructor(options)
      接收 WorkletAnimation 构造时传入的 options
      可保存实例状态（stateful animator）
      例：constructor(options) { this.rate = options.rate || 0.5; }

    animate(currentTime, effect)
      核心动画方法，每帧调用（详见 Card 6）
      currentTime：时间线当前时间（毫秒）
      effect：WorkletAnimationEffect（含 localTime / progress / currentIteration）

【registerAnimator 最小骨架】
  // animator.js —— Animation Worklet 模块
  registerAnimator('my-animator', class {
    static get inputProperties() { return ['--rate']; }
    static get outputProperties() { return ['transform']; }

    constructor(options) {
      this.rate = options.rate || 1;
    }

    animate(currentTime, effect) {
      // 设置 localTime 驱动关键帧
      effect.localTime = currentTime * this.rate;
    }
  });

【WorkletAnimation 创建实例】
  // 主线程
  const animation = new WorkletAnimation(
    'my-animator',                    // animator 名（已 registerAnimator）
    new KeyframeEffect(               // 关键帧效果
      element,
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(200px)' },
      ],
      { duration: 1000, iterations: Infinity }
    ),
    document.timeline,                // 时间线（DocumentTimeline / ScrollTimeline / ViewTimeline）
    { rate: 0.5 }                     // options → constructor(options)
  );
  animation.play();

  // WorkletAnimation 继承 Animation，支持：
  animation.pause();
  animation.cancel();
  animation.playbackRate = 2;
  animation.currentTime;

【element.animate() vs WorkletAnimation 对比】
  element.animate(keyframes, options)：
    + API 简单（一行创建动画）
    + 浏览器支持广（Chrome 39+ / Firefox 48+）
    - 跑在主线程，受 JS 阻塞
    - 不能读取输入属性驱动
    - 滚动驱动需手动监听 scroll + 改 currentTime（主线程）

  WorkletAnimation：
    + 跑在合成线程，不受主线程阻塞，60fps 稳定
    + 可读取 inputProperties（输入驱动）
    + 原生支持 ScrollTimeline / ViewTimeline（滚动驱动）
    + 状态保持（stateful）
    - API 较复杂（需 addModule + registerAnimator + WorkletAnimation）
    - 浏览器支持有限（Chrome 85+ / Safari 17+ / Firefox 暂不支持）

【Animation Worklet 解决「输入驱动的滚动动画」】
  传统痛点：
    scroll 事件 → 主线程回调 → 改 transform → 触发重排
    滚动时主线程忙 → 掉帧 → 卡顿

  Animation Worklet 方案：
    ScrollTimeline 把滚动位置映射为 currentTime
    animate() 跑在合成线程读 currentTime → 改 localTime → 驱动关键帧
    全程不经过主线程 → 丝滑滚动

【浏览器支持】
  animationWorklet.addModule: ${f.animationWorklet ? '✓' : '✗'} (Chrome 85+ / Safari 17+ / Firefox 暂不支持)
  WorkletAnimation: ${f.workletAnimation ? '✓' : '✗'} (同上)
  ScrollTimeline: ${f.scrollTimeline ? '✓' : '✗'} (Chrome 115+ scroll-driven animations)

【常见陷阱】
  1. animate() 内不能访问 DOM（无 document/window），只能读 inputProperties
  2. inputProperties/outputProperties 声明的属性才可读写
  3. addModule 未完成就 new WorkletAnimation 会失败
  4. 同一 animator 名重复 registerAnimator 会被忽略
  5. WorkletAnimation 必须显式 .play() 才开始
  6. 合成线程无 console，animate 内 console.log 不输出到主控制台
  7. 状态保持需用实例属性（this.xxx），不能依赖闭包外的主线程变量
`;
    this.setState({ animBasicInfo: info });
    this._addLog('css', `Animation Worklet 概述演示完成；animationWorklet=${f.animationWorklet}/workletAnimation=${f.workletAnimation}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const code = `// animator.js —— Animation Worklet 模块
// 运行在 Animation Worklet 全局作用域（合成线程）

registerAnimator('my-animator', class {
  // 从 element 读取的输入 CSS 属性
  static get inputProperties() { return ['--rate']; }

  // 要写入 element 的输出 CSS 属性
  static get outputProperties() { return ['transform', 'opacity']; }

  // 构造函数：接收 options（来自 WorkletAnimation 构造时）
  constructor(options) {
    this.rate = options.rate || 1;
    this.lastTime = 0;   // 可保存实例状态（stateful）
  }

  // 核心动画方法（每帧调用，跑在合成线程）
  animate(currentTime, effect) {
    // currentTime: 当前时间线进度（毫秒）
    // effect: WorkletAnimationEffect
    //   effect.localTime     本地时间（可读写，驱动关键帧）
    //   effect.progress      进度 0-1（只读）
    //   effect.currentIteration 当前迭代次数（只读）

    // 方式 1：设置 localTime（驱动关键帧）
    effect.localTime = currentTime * this.rate;

    // 方式 2：直接设置输出属性（绕过关键帧）
    // effect.target.styleMap.set('transform', ...);
  }
});

// 主线程创建 WorkletAnimation
const animation = new WorkletAnimation(
  'my-animator',
  new KeyframeEffect(el, [
    { transform: 'translateX(0)' },
    { transform: 'translateX(200px)' }
  ], { duration: 1000, iterations: Infinity }),
  document.timeline,
  { rate: 0.5 }
);
animation.play();

// element.animate() vs WorkletAnimation
// element.animate():  跑在主线程，受 JS 阻塞
// WorkletAnimation:   跑在合成线程，不受主线程阻塞，60fps 稳定`;
    const card = new Card({
      title: '5. Animation Worklet 概述与 registerAnimator',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['animationWorklet', f.animationWorklet],
          ['WorkletAnimation', f.workletAnimation],
        ]),
        h(Tag, { color: f.animationWorklet ? 'success' : 'error' }, 'Chrome 85+/Safari 17+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS.animationWorklet.addModule(url) 加载动画模块，registerAnimator(name, class) 注册动画类。类需实现 static get inputProperties() / outputProperties() / constructor(options) / animate(currentTime, effect)。new WorkletAnimation(name, keyframes, timeline, options) 创建实例。element.animate() 跑主线程受阻塞，WorkletAnimation 跑合成线程不受主线程阻塞。Animation Worklet 解决「输入驱动的滚动动画」问题。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 registerAnimator 概述演示', { type: 'primary', size: 'sm', onClick: () => this._runAnimBasicDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.animBasicInfo || '（点击按钮查看 registerAnimator 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：Animation Worklet animate() 方法深潜 =====================

  _runAnimMethodDemo() {
    const f = this._flags();
    const info = `
===== Animation Worklet animate() 方法深潜 =====

【方法签名】
  animate(currentTime, effect)

  这是 registerAnimator 注册类的核心方法，合成线程每帧调用。
  通过修改 effect.localTime 或直接设置输出属性驱动动画。

【参数 1：currentTime —— 当前时间线进度】
  时间线当前时间（毫秒），来源：
    DocumentTimeline：从页面加载开始的毫秒数
    ScrollTimeline：滚动位置映射的时间（0 → duration）
    ViewTimeline：元素在视口中的位置映射

  // 不同时间线的 currentTime 含义
  // document.timeline:    持续增长的毫秒数
  // new ScrollTimeline(): 滚动 0 时 currentTime=0，滚到底 currentTime=duration
  // new ViewTimeline():   元素进入视口 currentTime=0，离开 currentTime=duration

  animate(currentTime, effect) {
    // currentTime 是数值（毫秒）
    // 可用于计算进度、缩放、偏移
    const progress = currentTime / 1000;  // 假设 duration 1000ms
  }

【参数 2：effect —— WorkletAnimationEffect】
  继承自 AnimationEffectReadOnly，关联关键帧效果。

  核心属性：
    effect.localTime（可读写）★ 最重要
      本地时间，设置它驱动关联的关键帧
      例：effect.localTime = 500 → 关键帧跑到 500ms 位置
      浏览器据此插值并应用到 element

    effect.progress（只读）
      当前进度（0-1），受 timing function 影响后的进度
      例：linear 时 progress = localTime / duration
          ease-in 时 progress 受缓动函数扭曲

    effect.currentIteration（只读）
      当前迭代次数（0 表示第一次循环）

    effect.target（只读）
      动画目标元素（可读其 styleMap，但勿直接改 DOM）

    effect.targetStyleMap
      目标元素的 Type OM styleMap（读 inputProperties）

【方式 1：设置 effect.localTime 驱动关键帧】
  // 最常用：把时间线进度映射到关键帧
  animate(currentTime, effect) {
    // 直接传递（关键帧按自身 duration 插值）
    effect.localTime = currentTime;

    // 缩放（2 倍速 / 0.5 倍速）
    effect.localTime = currentTime * 2;

    // 偏移
    effect.localTime = currentTime + 200;
  }

【方式 2：直接设置输出属性（绕过关键帧）】
  // 当 outputProperties 声明时，可直接写
  animate(currentTime, effect) {
    const progress = currentTime / 1000;
    const opacity = Math.sin(progress * Math.PI);
    // effect.target.styleMap.set('opacity', new CSSNumberValue(opacity));
  }

  // 注意：直接 set output properties 会绕过关键帧插值
  // 适合：非关键帧驱动的连续动画（如物理模拟）

【与 ScrollTimeline 协同（scroll-driven animations）】
  // 主线程创建 ScrollTimeline
  const scrollTL = new ScrollTimeline({
    source: document.scrollingElement,   // 滚动容器
    orientation: 'block',                // block / inline / horizontal / vertical
    scrollOffsets: [                     // 起止滚动位置
      CSS.px(0),
      CSS.px(1000),
    ],
  });

  // WorkletAnimation 用 ScrollTimeline
  const wa = new WorkletAnimation(
    'parallax',
    keyframes,
    scrollTL,        // 滚动驱动时间线
    { rate: 1 }
  );
  wa.play();

  // animate() 每帧收到滚动驱动的 currentTime
  // effect.localTime = currentTime 驱动关键帧
  // 全程跑在合成线程，不受主线程阻塞

【与 ViewTimeline 协同】
  // ViewTimeline 基于元素在视口中的位置
  const viewTL = new ViewTimeline({
    subject: element,          // 观察的元素
    axis: 'block',
    inset: 'auto',             // 视口内边距
  });

  // 元素进入视口 → currentTime=0
  // 元素离开视口 → currentTime=duration
  // 适合：滚动入场动画 / sticky header 渐显

【状态保持（stateful animator）】
  // constructor 接收 options 保存初始状态
  constructor(options) {
    this.accumulator = 0;
    this.rate = options.rate;
  }

  // 实例属性在帧间保持（合成线程不销毁实例）
  animate(currentTime, effect) {
    const delta = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += delta * this.rate;
    effect.localTime = this.accumulator;
  }

  // 注意：合成线程可能重建实例（如内存压力），状态会丢失
  // 关键状态可用 options 重建或持久化到 element 自定义属性

【性能优势：60fps 即使主线程卡顿】
  传统动画（main thread）：
    主线程长任务（100ms）→ 动画卡顿 6 帧
    GC 暂停 → 动画冻结
    scroll 监听回调 → 与动画竞争主线程

  Animation Worklet（compositor thread）：
    合成线程独立于主线程
    即使主线程 100% 占用，动画仍 60fps
    滚动事件直接在合成线程处理，无延迟

  // 验证：主线程故意卡顿
  function blockMain(ms) {
    const start = performance.now();
    while (performance.now() - start < ms) {}
  }
  setInterval(() => blockMain(50), 100);   // 主线程每 100ms 卡 50ms
  // element.animate() 动画会卡顿
  // WorkletAnimation 动画仍 60fps

【浏览器支持】
  animate(): ${f.animationWorklet ? '✓' : '✗'} (Chrome 85+ / Safari 17+ / Firefox 暂不支持)
  ScrollTimeline: ${f.scrollTimeline ? '✓' : '✗'} (Chrome 115+ scroll-driven animations)
  ViewTimeline: ${f.viewTimeline ? '✓' : '✗'} (Chrome 115+)

【常见陷阱】
  1. effect.localTime 单位是毫秒，不是秒
  2. 设置 localTime 超出 duration 时受 iteration-count / fill 影响
  3. animate() 内不要做重计算（每帧调用，影响合成线程性能）
  4. 状态保持不可靠（合成线程可能重建实例）
  5. ScrollTimeline 的 scrollOffsets 用 CSS.px() 等 Type OM 值
  6. 不能在 animate 内访问 currentTime 之外的主线程数据
`;
    this.setState({ animMethodInfo: info });
    this._addLog('css', `animate() 方法深潜演示完成；animationWorklet=${f.animationWorklet}/scrollTimeline=${f.scrollTimeline}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const code = `// animate(currentTime, effect) 深潜
animate(currentTime, effect) {

  // —— currentTime：当前时间线进度（毫秒）——
  // DocumentTimeline: 页面加载以来的毫秒数
  // ScrollTimeline:   滚动位置映射的时间
  // ViewTimeline:     元素在视口中的位置映射
  const progress = currentTime / 1000;

  // —— effect: WorkletAnimationEffect ——
  // effect.localTime（可读写）★ 核心
  //   设置 localTime 驱动关联的关键帧
  effect.localTime = currentTime * 2;   // 2 倍速

  // effect.progress（只读）：受 timing function 影响后的进度 0-1
  const p = effect.progress;

  // effect.currentIteration（只读）：当前迭代次数
  const iter = effect.currentIteration;

  // —— 与 ScrollTimeline 协同 ——
  // ScrollTimeline 把滚动位置映射为 currentTime
  // animate() 每帧收到滚动驱动的 currentTime
  // effect.localTime = currentTime 驱动关键帧
  // 全程跑在合成线程，不受主线程阻塞

  // —— 状态保持（stateful animator）——
  // constructor(options) 接收初始状态
  // 实例属性在帧间保持（this.accumulator += delta）
}

// 创建带 ScrollTimeline 的 WorkletAnimation
const scrollTL = new ScrollTimeline({
  source: document.scrollingElement,
  orientation: 'block',
});

const wa = new WorkletAnimation(
  'my-animator',
  keyframes,
  scrollTL,           // 滚动驱动时间线
  { rate: 1 }
);
wa.play();

// 性能：即使主线程卡顿，合成线程仍 60fps
// 因为 animate() 跑在独立合成线程`;
    const card = new Card({
      title: '6. Animation Worklet animate() 方法深潜',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['animate()', f.animationWorklet],
          ['ScrollTimeline', f.scrollTimeline],
          ['ViewTimeline', f.viewTimeline],
        ]),
        h(Tag, { color: 'primary' }, '方法深潜'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'animate(currentTime, effect) 参数：currentTime 当前时间线进度，effect WorkletAnimationEffect（含 localTime/progress/currentIteration）。在 animate 内修改 effect.localTime 或直接 set output properties。与 ScrollTimeline/ViewTimeline 协同（scroll-driven animations 跑在 compositor）。状态保持（stateful animator 通过 constructor options 与实例属性）。性能优势：60fps 即使 main thread 卡顿。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 animate() 方法深潜演示', { type: 'primary', size: 'sm', onClick: () => this._runAnimMethodDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '时间线对照可视化：'),
        h('div', { class: 'hw-timeline-viz' },
          h('div', { class: 'hw-timeline-row' },
            h('span', {}, 'DocumentTimeline'),
            h('div', { class: 'hw-timeline-bar' }, h('div', { class: 'hw-timeline-fill', style: { width: '35%' } })),
          ),
          h('div', { class: 'hw-timeline-row' },
            h('span', {}, 'ScrollTimeline'),
            h('div', { class: 'hw-timeline-bar' }, h('div', { class: 'hw-timeline-fill', style: { width: '60%' } })),
          ),
          h('div', { class: 'hw-timeline-row' },
            h('span', {}, 'ViewTimeline  '),
            h('div', { class: 'hw-timeline-bar' }, h('div', { class: 'hw-timeline-fill', style: { width: '45%' } })),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.animMethodInfo || '（点击按钮查看 animate() 方法完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：Animation Worklet 实战 视差滚动 =====================

  _runAnimParallaxDemo() {
    const f = this._flags();
    this._injectStyle('hw-parallax-demo', `
      .hw-parallax-viz {
        background: linear-gradient(180deg, #1e3a8a 0%, #4c1d95 50%, #831843 100%);
      }
    `);
    const info = `
===== Animation Worklet 实战：视差滚动 =====

【视差滚动原理】
  多层背景以不同速率移动，营造深度感：
    - 远景层移动慢（rate 小，如 0.2）
    - 中景层移动中（rate 0.5）
    - 近景层移动快（rate 1.0）
  滚动时各层 translateY 不同距离 → 立体视差效果

【registerAnimator('parallax', class) 完整代码】
  // parallax.js —— Animation Worklet 视差滚动
  registerAnimator('parallax', class {
    // 从元素读取视差速率
    static get inputProperties() {
      return ['--parallax-rate'];
    }

    // 输出 transform
    static get outputProperties() {
      return ['transform'];
    }

    constructor(options) {
      this.rate = options.rate || 0.5;
    }

    animate(currentTime, effect) {
      // 从 inputProperties 读取速率（每元素可不同）
      const rateMap = effect.targetStyleMap
        ? effect.targetStyleMap.get('--parallax-rate')
        : null;
      const rate = rateMap ? rateMap.value : this.rate;

      // 滚动进度映射到 localTime（驱动关键帧 translateY）
      effect.localTime = currentTime * rate;
    }
  });

【主线程：创建视差 WorkletAnimation】
  // 1. 加载 animator 模块
  await CSS.animationWorklet.addModule('/worklets/parallax.js');

  // 2. 创建 ScrollTimeline（滚动驱动时间线）
  const scrollTL = new ScrollTimeline({
    source: document.scrollingElement,
    orientation: 'block',
  });

  // 3. 为每个视差层创建 WorkletAnimation
  document.querySelectorAll('[data-parallax]').forEach(el => {
    const wa = new WorkletAnimation(
      'parallax',
      new KeyframeEffect(el, [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-200px)' }
      ], { duration: 1000 }),
      scrollTL,
      { rate: parseFloat(el.dataset.parallax) || 0.5 }
    );
    wa.play();
  });

【CSS 配置】
  [data-parallax] {
    --parallax-rate: 0.5;     /* 被 inputProperties 读取 */
  }
  [data-parallax].layer-back  { --parallax-rate: 0.2; }
  [data-parallax].layer-mid   { --parallax-rate: 0.5; }
  [data-parallax].layer-front { --parallax-rate: 1.0; }

【对比 CSS scroll-driven animations（声明式）】
  /* CSS 声明式方案（Chrome 115+ scroll-driven animations） */
  .parallax {
    animation: parallax linear;
    animation-timeline: scroll();
  }
  @keyframes parallax {
    from { transform: translateY(0); }
    to   { transform: translateY(-200px); }
  }

  对比：
    CSS scroll-driven（声明式）：
      + 简洁，纯 CSS 无 JS
      + 浏览器原生优化
      - 不能读取 inputProperties 动态配置
      - 不能状态保持 / 自定义逻辑
      - 只能做线性映射

    Animation Worklet（可编程）：
      + 可读 inputProperties（每元素不同速率）
      + 可状态保持（accumulator / 物理模拟）
      + 可自定义非线性映射
      + 跑在合成线程 60fps
      - 需 addModule + registerAnimator + WorkletAnimation
      - 浏览器支持有限

【其他 Animation Worklet 实战】
  1. sticky header 渐显
     滚动时 header 从透明渐变为实色（ViewTimeline 驱动 opacity）
     registerAnimator('sticky-header', class {
       static get inputProperties() { return ['--header-opacity']; }
       animate(currentTime, effect) {
         effect.localTime = currentTime;  // 滚动进度驱动 opacity
       }
     });

  2. scroll-linked progress bar
     顶部进度条随滚动填充宽度
     new WorkletAnimation('progress', kf, scrollTL, {});
     // effect.localTime = currentTime 驱动 width 0→100%

  3. 自定义缓动
     animate() 内用自定义函数扭曲 progress
     effect.localTime = customEasing(currentTime);

  4. 物理弹簧动画
     stateful animator 模拟弹簧物理
     constructor(options) { this.velocity = 0; this.pos = 0; }
     animate(currentTime, effect) {
       const force = -this.pos * 0.1;       // 弹力
       this.velocity += force;              // 加速度
       this.pos += this.velocity;           // 位置
       effect.localTime = this.pos * 1000;
     }

【浏览器支持】
  parallax WorkletAnimation: ${f.animationWorklet ? '✓' : '✗'} (Chrome 85+ / Safari 17+ / Firefox 暂不支持)
  CSS scroll-driven (animation-timeline: scroll()): ${f.scrollTimeline ? '✓' : '✗'} (Chrome 115+)

【常见陷阱】
  1. 每个视差层需独立 WorkletAnimation（不能共享）
  2. ScrollTimeline 的 source 必须是可滚动容器
  3. 关键帧 duration 与 rate 配合决定移动距离
  4. effect.targetStyleMap 读取需 inputProperties 声明
  5. 视差层数过多会增加合成线程负担（建议 ≤ 5 层）
  6. 降级：不支持时用 scroll 监听 + transform（主线程，性能差）
`;
    this.setState({ animParallaxInfo: info });
    this._addLog('css', `视差滚动演示完成；animationWorklet=${f.animationWorklet}/scrollTimeline=${f.scrollTimeline}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const code = `// parallax.js —— Animation Worklet 视差滚动
registerAnimator('parallax', class {
  static get inputProperties() {
    return ['--parallax-rate'];
  }
  static get outputProperties() {
    return ['transform'];
  }

  constructor(options) {
    this.rate = options.rate || 0.5;
  }

  // 读取元素 CSS 上的 --parallax-rate
  animate(currentTime, effect) {
    const rateMap = effect.targetStyleMap
      ? effect.targetStyleMap.get('--parallax-rate')
      : null;
    const rate = rateMap ? rateMap.value : this.rate;
    // 滚动进度映射到 localTime
    effect.localTime = currentTime * rate;
  }
});

// 主线程
await CSS.animationWorklet.addModule('/worklets/parallax.js');

const scrollTL = new ScrollTimeline({
  source: document.scrollingElement,
  orientation: 'block',
});

document.querySelectorAll('[data-parallax]').forEach(el => {
  const wa = new WorkletAnimation(
    'parallax',
    new KeyframeEffect(el, [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-200px)' }
    ], { duration: 1000 }),
    scrollTL,
    { rate: parseFloat(el.dataset.parallax) || 0.5 }
  );
  wa.play();
});

// CSS
// [data-parallax] { --parallax-rate: 0.5; }
// .layer-back  { --parallax-rate: 0.2; }
// .layer-front { --parallax-rate: 1.0; }

// 对比 CSS scroll-driven（声明式）
// .parallax { animation: parallax linear; animation-timeline: scroll(); }
// @keyframes parallax { from { transform: translateY(0); } to { transform: translateY(-200px); } }`;
    const card = new Card({
      title: '7. Animation Worklet 实战：视差滚动',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['parallax', f.animationWorklet],
          ['scroll-timeline', f.scrollTimeline],
        ]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '视差滚动实现：多层背景以不同速率移动。registerAnimator("parallax", class) 完整代码，static get inputProperties() return ["--parallax-rate"]，animate(currentTime, effect) 中 effect.localTime = currentTime * rate。new WorkletAnimation("parallax", keyframes, new ScrollTimeline({...}), { rate: 0.5 })。对比 CSS scroll-driven animations（CSS 声明式 vs JS Worklet 可编程）。其他实战：sticky header 渐显、scroll-linked progress bar、自定义缓动。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行视差滚动演示', { type: 'primary', size: 'sm', onClick: () => this._runAnimParallaxDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'parallax 视觉 mockup（三层不同速率，真实 Worklet 不在 jsdom 运行）：'),
        h('div', { class: 'hw-parallax-viz' },
          h('div', { class: 'hw-parallax-layer hw-parallax-layer--back' },
            h('span', {}, '远景层 rate=0.2'), h('span', { class: 'hw-parallax-rate' }, 'slow'),
          ),
          h('div', { class: 'hw-parallax-layer hw-parallax-layer--mid' },
            h('span', {}, '中景层 rate=0.5'), h('span', { class: 'hw-parallax-rate' }, 'mid'),
          ),
          h('div', { class: 'hw-parallax-layer hw-parallax-layer--front' },
            h('span', {}, '近景层 rate=1.0'), h('span', { class: 'hw-parallax-rate' }, 'fast'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.animParallaxInfo || '（点击按钮视差滚动完整实现）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：Worklet 调试与陷阱 =====================

  _runDebugDemo() {
    const f = this._flags();
    const info = `
===== Worklet 调试与陷阱 =====

【1. DevTools 不直接支持 Worklet 调试】
  普通 Sources 面板不显示 Worklet 执行上下文。
  需访问 chrome://inspect/#worklets 开启 Worklet 专用调试：
    - 列出所有已加载的 Worklet Global Scope
    - 可在其中打断点 / 单步 / 查看作用域
  Production 环境无法调试（需 DevTools 打开时加载）。

【2. Worklet 代码运行在独立上下文】
  无 window / document / localStorage / fetch（部分）/ XMLHttpRequest。
  以下代码在 Worklet 内会 ReferenceError：
    window.alert("hi");        // ReferenceError: window is not defined
    document.title;            // ReferenceError: document is not defined
    localStorage.getItem("k"); // ReferenceError: localStorage is not defined
  可用：self / registerPaint / registerLayout / registerAnimator /
    console（仅部分上下文）/ Math / Promise / TypedArray 等。

【3. addModule 是 Promise 异步加载】
  CSS.xxxWorklet.addModule(url) 返回 Promise，未 await 就使用会失败。
  // 错误
  CSS.animationWorklet.addModule("/worklets/a.js");
  new WorkletAnimation("a", ...);   // 可能未注册，失败

  // 正确
  await CSS.animationWorklet.addModule("/worklets/a.js");
  new WorkletAnimation("a", ...);   // 已注册

【4. 错误处理：Worklet 内 throw 不冒泡到 main】
  Worklet 内运行时错误（如 layout() 抛异常）不会冒泡到主线程。
  主线程只能通过 addModule 的 catch 捕获「加载/解析」错误：
    async function safeLoad() {
      try {
        await CSS.animationWorklet.addModule("/worklets/a.js");
      } catch (err) {
        console.error("Worklet 加载失败", err);
      }
    }
  运行时错误需通过 chrome://inspect 查看 Worklet 控制台。

【5. 模块热替换（HMR）】
  开发时修改 Worklet 模块后需重新 addModule（不会自动重载）：
    // 简单 HMR
    if (module.hot) {
      module.hot.accept("/worklets/a.js", () => {
        // 重新加载（部分浏览器支持覆盖注册）
        CSS.animationWorklet.addModule("/worklets/a.js?t=" + Date.now());
      });
    }
  注意：已注册的同名 registerXxx 会被忽略（不覆盖），
  实际热替换需改名或刷新页面。

【6. 陷阱清单（完整版）】

  浏览器支持：
    - Layout Worklet：仅 Chromium 实验
      需 chrome://flags 启用 enable-experimental-web-platform-features
      Firefox / Safari 暂未实现（截至 2025）
    - Animation Worklet：Chrome 85+ / Safari 17+ / Firefox 暂不支持
    - Paint Worklet：Chrome 65+ / Safari 18+（部分）/ Firefox 暂不支持
    - ScrollTimeline / ViewTimeline：Chrome 115+ scroll-driven animations

  运行环境：
    - Worklet 内不能访问 DOM（window / document / localStorage）
    - Worklet 内 console.log 不输出到主页面控制台
      （需 chrome://inspect 查看 Worklet 控制台）
    - 需 HTTPS 或 localhost（Worklet 受同源策略 + CSP 限制）
    - 模块必须通过 URL 加载（不能内联字符串 / blob / data URL）

  性能：
    - Layout Worklet 布局重计算性能开销大
      每次重排（resize / 子元素增删 / 属性变化）都重新调用 layout()
      避免在 layout() 内做重计算
    - Animation Worklet animate() 每帧调用
      避免在 animate() 内做重计算 / 分配内存

  协同：
    - display: layout(name) 替换默认布局
      未注册 name 时回退到 block（无报错）
    - 与现有 CSS 布局协同：子元素仍可用 Flexbox/Grid
    - WorkletAnimation 必须显式 .play() 才开始

  降级策略：
    - @supports 检测 display: layout()
      @supports (display: layout(masonry)) {
        .grid { display: layout(masonry); }
      }
      @supports not (display: layout(masonry)) {
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); }
      }
    - JS 能力检测
      if (CSS.animationWorklet) {
        await CSS.animationWorklet.addModule(...);
        new WorkletAnimation(...);
      } else {
        // 降级：element.animate() 或 requestAnimationFrame
        el.animate(keyframes, options);
      }
    - CSS scroll-driven 降级
      @supports (animation-timeline: scroll()) {
        .parallax { animation: parallax linear; animation-timeline: scroll(); }
      }

【7. 调试技巧汇总】
  - chrome://inspect/#worklets 查看所有 Worklet 上下文
  - Worklet 内用 console.log 输出到 Worklet 控制台（非主页）
  - 主线程用 try/catch 包裹 addModule 捕获加载错误
  - 用 @supports / typeof 双重检测能力
  - Layout Worklet 调试：在 layout() 内 throw 故意错误看是否触发
  - Animation Worklet 调试：在 animate() 内记录 currentTime 到实例属性

【8. 生产环境建议】
  - 优先用 CSS 原生方案（Flexbox/Grid/scroll-driven animations）
  - Worklet 作为渐进增强，@supports 检测后启用
  - 模块代码尽量精简（影响加载与执行性能）
  - 关键路径不要依赖 Worklet（降级要可用）
  - 监控 Worklet 加载失败率（addModule catch 上报）

【浏览器支持汇总】
  layoutWorklet: ${f.layoutWorklet ? '✓' : '✗'} (仅 Chromium 实验)
  animationWorklet: ${f.animationWorklet ? '✓' : '✗'} (Chrome 85+ / Safari 17+ / Firefox 暂不支持)
  paintWorklet: ${f.paintWorklet ? '✓' : '✗'} (Chrome 65+ / Safari 18+ 部分)
  WorkletAnimation: ${f.workletAnimation ? '✓' : '✗'}
  ScrollTimeline: ${f.scrollTimeline ? '✓' : '✗'} (Chrome 115+)
  ViewTimeline: ${f.viewTimeline ? '✓' : '✗'} (Chrome 115+)
`;
    this.setState({ debugInfo: info });
    this._addLog('css', `Worklet 调试与陷阱演示完成；layoutWorklet=${f.layoutWorklet}/animationWorklet=${f.animationWorklet}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const code = `// Worklet 调试与陷阱

// 1. DevTools 调试：chrome://inspect/#worklets
//    普通 Sources 面板不直接显示 Worklet 上下文

// 2. Worklet 独立上下文：无 window/document/localStorage
//    以下代码在 Worklet 内会报错：
//    window.alert('hi');         // ReferenceError
//    document.title;             // ReferenceError
//    localStorage.getItem('k');  // ReferenceError

// 3. addModule 异步加载（返回 Promise）
async function safeLoad() {
  try {
    await CSS.animationWorklet.addModule('/worklets/animator.js');
  } catch (err) {
    // Worklet 内 throw 不冒泡到 main，但 addModule 失败会 reject
    console.error('Worklet 加载失败', err);
  }
}

// 4. 能力检测与降级
if (CSS.animationWorklet) {
  CSS.animationWorklet.addModule('/worklets/animator.js');
} else {
  // 降级：element.animate() 或 requestAnimationFrame
  el.animate(keyframes, options);
}

// 5. @supports 检测 display: layout()
@supports (display: layout(masonry)) {
  .grid { display: layout(masonry); }
}
@supports not (display: layout(masonry)) {
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); }
}

// 6. 陷阱清单
// - Layout Worklet：仅 Chromium 实验（需 enable-experimental-web-platform-features）
// - Animation Worklet：Chrome 85+ / Safari 17+ / Firefox 暂不支持
// - Worklet 内不能访问 DOM（window/document）
// - Worklet 内 console.log 不输出到主页面控制台
// - 需 HTTPS 或 localhost（Worklet 受同源策略限制）
// - 布局重计算性能开销（Layout Worklet 每次重排都调 layout()）
// - 与现有 CSS 布局协同（display: layout() 替换默认布局）`;
    const card = new Card({
      title: '8. Worklet 调试与陷阱',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['layoutWorklet', f.layoutWorklet],
          ['animationWorklet', f.animationWorklet],
        ]),
        h(Tag, { color: 'primary' }, '调试与降级'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'DevTools 不直接支持 Worklet 调试（需 chrome://inspect/#worklets）。Worklet 代码运行在独立上下文（无 window/document/localStorage）。addModule 是 Promise 异步加载。错误处理（worklet 内 throw 不冒泡到 main）。模块热替换。陷阱清单：Layout Worklet 浏览器支持极弱仅 Chromium 实验性/Animation Worklet Chrome 85+/Safari 17+/Firefox 暂不支持/Worklet 内不能访问 DOM/不能 console.log 到主页面控制台/需 HTTPS 或 localhost/布局重计算性能开销/与现有 CSS 布局协同/降级策略（@supports 检测 display: layout()）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Worklet 调试与陷阱演示', { type: 'primary', size: 'sm', onClick: () => this._runDebugDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.debugInfo || '（点击按钮查看 Worklet 调试与陷阱完整清单）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS Houdini Worklets 深度实验室（Layout & Animation Worklet）'),

      h(Alert, {
        type: 'info',
        message: 'CSS Houdini Worklets 深度实验室 —— Layout Worklet（registerLayout）与 Animation Worklet（registerAnimator）',
        description: '专注 CSSHoudiniPage 未覆盖的两大 Worklet。Layout Worklet：CSS.layoutWorklet.addModule 加载、registerLayout(name, class) 注册布局类（inputProperties/childInputProperties/layoutChildren/intrinsicSizes/async layout(children, edges, constraints, styleMap, breakToken)）、display: layout(name) 触发自定义布局、与 Flexbox/Grid 并列的作者定义布局能力、masonry 瀑布流实战（列宽固定分配最短列）、circle 圆形布局等，仅 Chromium 实验。Animation Worklet：CSS.animationWorklet.addModule 加载、registerAnimator(name, class) 注册动画类（inputProperties/outputProperties/constructor(options)/animate(currentTime, effect)）、new WorkletAnimation(name, keyframes, timeline, options) 创建实例、跑在 compositor thread 不受主线程阻塞 60fps 稳定、effect.localTime/progress/currentIteration、与 ScrollTimeline/ViewTimeline 协同 scroll-driven animations、视差滚动/sticky header/scroll-linked progress bar/物理弹簧实战，Chrome 85+/Safari 17+/Firefox 暂不支持。Worklet 与 Worker 区别（轻量 Worker 无 DOM 独立全局作用域）、addModule 异步加载、Worklet 内 throw 不冒泡、@supports 检测 display: layout() 降级策略。jsdom 不执行真实 Worklet，注入视觉 mockup（masonry/parallax）+ 完整代码示例与 API 签名参考。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

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
    ];
  }
}