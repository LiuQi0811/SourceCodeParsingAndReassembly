// =====================================================================
// CSSScrollDrivenAnimationsDeepPage.js —— CSS Scroll-Driven Animations 滚动驱动动画深度实验室
// 演示 CSS Scroll-driven Animations Module Level 1 全套能力，是浏览器原生
// 「滚动驱动动画」体系的核心，让动画直接由滚动位置驱动而无需 JS 监听 scroll 事件：
//   1. animation-timeline —— 时间线声明
//      animation-timeline: <timeline-name> | scroll() | view() | auto | none;
//      切换到 scroll()/view() 后 animation-duration 改为表示滚动进度比例而非时间
//   2. scroll() —— 滚动进度时间线
//      scroll() = scroll([<axis>?, <scroller>?]);
//      axis: block|inline|x|y；scroller: nearest|root|self
//      animation-timeline: scroll(root block) 整页滚动驱动
//   3. view() —— 视图进度时间线
//      view() = view([<axis>?, <inset>?]);
//      跟踪元素进入视口过程；与 scroll() 区别在于 view 跟踪「元素进入视口」
//      用于 reveal / fade-in 动画
//   4. named scroll progress timelines —— 命名时间线
//      scroll-timeline-name: --name; scroll-timeline-axis: block|inline|x|y;
//      view-timeline-name: --name; view-timeline-axis: ...;
//      子元素通过 animation-timeline: --name 引用，跨组件复用
//   5. timeline-scope —— 跨层时间线引用
//      timeline-scope: --name | all | none;
//      让祖先元素声明时间线作用域，解决 shadow DOM / 组件树时间线传递问题
//   6. animation-range —— 动画范围
//      animation-range: <start> <end>;
//      animation-range-start/end: normal | <length-percentage> | <timeline-range-name> <length-percentage>?
//      timeline range names: cover|contain|entry|exit|entry-crossing|exit-crossing
//   7. view-timeline-inset —— 视图时间线内边距
//      view-timeline-inset: auto | <length-percentage>{1,2};
//      调整 view() 时间线的开始/结束位置，用于提前/延后触发动画
//   8. 实战模式与陷阱 —— 进度条 / reveal / 视差 / 旋转 / sticky / 陷阱清单
// 说明：jsdom 不做真实滚动播放，但 CSS.supports 可探测属性支持；
//       注入演示样式 + 完整代码示例，真实浏览器（Chrome 115+/Safari 17.4+/
//       Firefox 部分支持）可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSScrollDrivenAnimationsDeepPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',  // Card 1：animation-timeline 概述
      scrollInfo: '',    // Card 2：scroll() 函数 —— 滚动进度时间线
      viewInfo: '',      // Card 3：view() 函数 —— 视图进度时间线
      namedInfo: '',     // Card 4：named scroll progress timelines —— 命名时间线
      scopeInfo: '',     // Card 5：timeline-scope —— 跨层时间线引用
      rangeInfo: '',     // Card 6：animation-range —— 动画范围
      insetInfo: '',     // Card 7：view-timeline-inset —— 视图时间线内边距
      patternInfo: '',   // Card 8：实战模式与陷阱
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `animation-timeline: scroll() ${c(f.animationTimeline)}`,
      `animation-timeline: view() ${c(f.animationTimelineView)}`,
      `scroll-timeline-name ${c(f.scrollTimelineName)}`,
      `view-timeline-name ${c(f.viewTimelineName)}`,
      `timeline-scope ${c(f.timelineScope)}`,
      `animation-range ${c(f.animationRange)}`,
      `view-timeline-inset ${c(f.viewTimelineInset)}`,
    ];

    const summary = f.css
      ? `CSS Scroll-Driven Animations 能力检测：${parts.join(' · ')}。jsdom 不做真实滚动播放，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器（Chrome 115+/Safari 17.4+/Firefox 部分支持）可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.animationTimeline) this._addLog('warn', 'animation-timeline: scroll() 不可用（Chrome 115+/Safari 17.4+/Firefox 部分支持）');
    if (!f.animationTimelineView) this._addLog('warn', 'animation-timeline: view() 不可用（Chrome 115+/Safari 17.4+/Firefox 部分支持）');
    if (!f.timelineScope) this._addLog('info', 'timeline-scope 不可用（Chrome 122+）');
    if (f.prefersReducedMotion) this._addLog('warn', '用户偏好减少动态效果（prefers-reduced-motion: reduce），滚动驱动动画应跳过或简化');

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
    this._injectStyle('css-sda-base', `
      .sd-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-box {
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
      .sd-scroll-container {
        position: relative;
        height: 220px;
        overflow-y: auto;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
        background: #f8fafc;
      }
      .sd-scroll-content {
        padding: 16px;
      }
      .sd-scroll-item {
        padding: 16px;
        margin: 8px 0;
        background: #e0e7ff;
        border-radius: 6px;
        color: #1e3a8a;
        font-weight: 600;
      }
      .sd-progress {
        position: sticky;
        top: 0;
        height: 6px;
        background: #e5e7eb;
        z-index: 10;
        margin: 0 0 12px 0;
      }
      .sd-progress__bar {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        transform-origin: left center;
        animation: sd-progress-grow linear;
        animation-timeline: scroll();
      }
      @keyframes sd-progress-grow {
        from { transform: scaleX(0); }
        to   { transform: scaleX(1); }
      }
      .sd-reveal-item {
        padding: 16px;
        margin: 8px 0;
        background: #f1f5f9;
        border-radius: 6px;
        border-left: 4px solid #3b82f6;
        animation: sd-reveal linear;
        animation-timeline: view();
        animation-range: entry 0% cover 50%;
      }
      @keyframes sd-reveal {
        from { opacity: 0; transform: translateY(40px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .sd-output {
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
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    const hasMatchMedia = typeof matchMedia === 'function';
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      animationTimeline: supportsPV('animation-timeline', 'scroll()'),
      animationTimelineView: supportsPV('animation-timeline', 'view()'),
      scrollTimelineName: supportsPV('scroll-timeline-name', '--x'),
      viewTimelineName: supportsPV('view-timeline-name', '--x'),
      timelineScope: supportsPV('timeline-scope', '--x'),
      animationRange: supportsPV('animation-range', 'cover 0% cover 100%'),
      viewTimelineInset: supportsPV('view-timeline-inset', 'auto'),
      prefersReducedMotion: hasMatchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }

  // ===================== Card 1：animation-timeline 概述 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('sd-overview-demo', `
      .sd-overview-host {
        padding: 12px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-overview-bar {
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 8px;
      }
      .sd-overview-bar__fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        transform-origin: left center;
        animation: sd-overview-grow linear;
        animation-timeline: scroll(root);
      }
      @keyframes sd-overview-grow {
        from { transform: scaleX(0); }
        to   { transform: scaleX(1); }
      }
    `);
    const info = [
      '===== animation-timeline 概述 =====',
      '',
      '【语法】',
      '  animation-timeline: <timeline-name> | scroll() | view() | auto | none;',
      '  /* auto —— 默认，使用 DocumentTimeline（时间驱动） */',
      '  /* none —— 不绑定任何时间线（动画不执行） */',
      '  /* scroll() —— 滚动进度时间线（见 Card 2） */',
      '  /* view() —— 视图进度时间线（见 Card 3） */',
      '  /* <timeline-name> —— 引用命名时间线（见 Card 4） */',
      '',
      '【核心概念：timeline 决定动画驱动力】',
      '  传统时间驱动动画：',
      '    .box { animation: spin 1s linear infinite; }',
      '    // 由 wall-clock 时间驱动，1 秒一个周期循环',
      '    // animation-duration 表示时间（秒/毫秒）',
      '',
      '  滚动驱动动画：',
      '    .box {',
      '      animation: spin linear;',
      '      animation-timeline: scroll();',
      '    }',
      '    // 由滚动位置驱动，整页滚动一次为一个周期',
      '    // animation-duration 改为表示「滚动进度比例」',
      '',
      '【animation-duration 在 timeline 下的语义变化】',
      '  - time-driven（默认 auto）：duration 表示时间（1s = 1 秒）',
      '  - scroll-driven：duration 表示进度比例',
      '    duration: 1s    → 整个滚动范围对应一个动画周期',
      '    duration: 0.5s  → 滚动一半时动画完成（动画占滚动范围的 50%）',
      '    duration: 2s    → 动画进度是滚动进度的 1/2（动画占滚动范围的 200%）',
      '  - 通常省略 duration，让其自动占满整个 timeline 范围',
      '',
      '【scroll-driven vs time-driven 对比】',
      '  特性        time-driven              scroll-driven',
      '  驱动力      wall-clock 时间           滚动位置',
      '  duration    时间（s/ms）              进度比例',
      '  iteration   支持循环                  无意义（滚动只单向进行）',
      '  direction   normal/reverse/alternate  仅随滚动方向',
      '  暂停        play-state: paused        滚动停止即暂停',
      '  fill-mode   forwards/backwards/both   自动按滚动位置',
      '',
      '【timeline 名字引用】',
      '  /* 在滚动容器上声明命名时间线 */',
      '  .scroller {',
      '    scroll-timeline-name: --page-scroll;',
      '    scroll-timeline-axis: block;',
      '  }',
      '  /* 在动画元素上引用 */',
      '  .progress {',
      '    animation: grow linear;',
      '    animation-timeline: --page-scroll;  /* 引用命名时间线 */',
      '  }',
      '  /* 跨层引用需配合 timeline-scope（见 Card 5） */',
      '',
      '【与 animation 简写的关系】',
      '  /* animation 简写中不能直接写 timeline */',
      '  .box {',
      '    animation: spin 1s linear;     /* 简写不含 timeline */',
      '    animation-timeline: scroll();  /* 必须单独声明 */',
      '  }',
      '  /* 简写会重置 animation-timeline 为 auto，注意声明顺序 */',
      '',
      '【auto 与 none 的区别】',
      '  animation-timeline: auto;',
      '    // 默认值，使用 DocumentTimeline（时间驱动）',
      '    // 此时 animation-duration 表示时间',
      '  animation-timeline: none;',
      '    // 不绑定时间线，动画完全不执行',
      '    // 等价于禁用动画',
      '',
      '【浏览器支持】',
      `  animation-timeline: scroll(): ${f.animationTimeline ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      `  animation-timeline: view(): ${f.animationTimelineView ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      '',
      '【常见陷阱】',
      '  1. 设置 animation-timeline 后，animation-duration 含义改变',
      '     → 滚动驱动下 duration 是进度比例而非时间',
      '  2. animation-iteration-count 在滚动驱动下无意义（滚动单向进行）',
      '  3. animation 简写会重置 animation-timeline 为 auto',
      '     → 先写 animation 简写再写 animation-timeline',
      '  4. 必须浏览器支持 Chrome 115+/Safari 17.4+/Firefox 部分支持',
      '  5. 滚动容器必须有可滚动内容，否则 scroll() 无效果',
      '  6. prefers-reduced-motion: reduce 时应跳过滚动驱动动画',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('css', `animation-timeline 演示完成；supports=${f.animationTimeline}/${f.animationTimelineView}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. animation-timeline 概述 —— 时间线声明与驱动模型',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['animation-timeline', f.animationTimeline],
          ['view()', f.animationTimelineView],
        ]),
        h(Tag, { color: 'primary' }, 'Scroll Animations L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'animation-timeline: <timeline-name> | scroll() | view() | auto | none 声明动画驱动时间线。默认 auto 为时间驱动（duration 表示秒），切换到 scroll()/view() 后 duration 改为表示滚动进度比例。scroll-driven vs time-driven 区别：驱动力（滚动 vs 时间）、duration 语义、iteration 是否有意义、暂停方式。命名时间线通过 animation-timeline: --name 引用。animation 简写会重置 timeline 为 auto，需单独声明。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 animation-timeline 演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 滚动驱动进度条：duration 省略 = 占满整段滚动 */',
            '@keyframes grow {',
            '  from { transform: scaleX(0); }',
            '  to   { transform: scaleX(1); }',
            '}',
            '.progress {',
            '  animation: grow linear;',
            '  animation-timeline: scroll(root block);',
            '}',
            '/* 整页滚动驱动进度条从 0 增长到 100% */',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 animation-timeline 概述完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：scroll() 函数 —— 滚动进度时间线 =====================

  _runScrollDemo() {
    const f = this._flags();
    this._injectStyle('sd-scroll-demo', `
      .sd-scroll-demo-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-scroll-axis-x {
        width: 100%;
        height: 80px;
        overflow-x: auto;
        white-space: nowrap;
        background: #e0e7ff;
        border-radius: 6px;
        padding: 8px;
      }
      .sd-scroll-axis-x__bar {
        display: inline-block;
        width: 50%;
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        transform-origin: left center;
        animation: sd-axis-x-grow linear;
        animation-timeline: scroll(nearest inline);
      }
      @keyframes sd-axis-x-grow {
        from { transform: scaleX(0); }
        to   { transform: scaleX(1); }
      }
    `);
    const info = [
      '===== scroll() 函数 —— 滚动进度时间线 =====',
      '',
      '【语法】',
      '  scroll() = scroll([<axis>?, <scroller>?])',
      '  /* 两个参数顺序可互换，均可省略（默认 block + nearest） */',
      '',
      '【axis 取值：滚动轴】',
      '  block    块方向（默认，通常是垂直滚动 y 轴）',
      '  inline   行内方向（通常是水平滚动 x 轴）',
      '  x        水平轴',
      '  y        垂直轴',
      '',
      '  /* 写法等价（取决于书写模式） */',
      '  scroll(block) ≈ scroll(y)  // 水平书写模式下',
      '  scroll(inline) ≈ scroll(x) // 水平书写模式下',
      '  /* block/inline 跟随书写模式，x/y 永远是物理方向 */',
      '',
      '【scroller 取值：滚动容器】',
      '  nearest  最近的可滚动祖先（默认）',
      '  root     文档根（即 <html>，整页滚动）',
      '  self     元素自身（必须自己可滚动 overflow: auto/scroll）',
      '',
      '【组合用法示例】',
      '  /* 整页垂直滚动驱动 */',
      '  .page-progress {',
      '    animation: grow linear;',
      '    animation-timeline: scroll(root block);',
      '  }',
      '',
      '  /* 最近可滚动祖先驱动（默认参数可省略） */',
      '  .inner {',
      '    animation: fade linear;',
      '    animation-timeline: scroll(nearest);  // = scroll()',
      '  }',
      '',
      '  /* 自身水平滚动驱动 */',
      '  .scroller {',
      '    overflow-x: auto;',
      '    animation: slide linear;',
      '    animation-timeline: scroll(self inline);',
      '  }',
      '',
      '【scroller 选用规则】',
      '  nearest',
      '    - 向上查找最近的可滚动祖先（overflow != visible）',
      '    - 找不到时回退到 root',
      '    - 适合「容器内滚动驱动子元素动画」',
      '',
      '  root',
      '    - 直接绑定到 documentElement（整页滚动）',
      '    - 适合「整页滚动进度条」「回到顶部按钮显隐」',
      '',
      '  self',
      '    - 元素自身必须是滚动容器（overflow: auto/scroll/hidden）',
      '    - 适合「自身滚动条驱动自身装饰」',
      '',
      '【参数顺序可互换】',
      '  scroll(root block) === scroll(block root)',
      '  scroll(nearest inline) === scroll(inline nearest)',
      '  /* 浏览器按 token 类型识别，不依赖顺序 */',
      '',
      '【单参数简写】',
      '  scroll(block)     // 只指定 axis，scroller 默认 nearest',
      '  scroll(root)      // 只指定 scroller，axis 默认 block',
      '  scroll()          // 全部默认：block + nearest',
      '',
      '【完整示例：整页滚动驱动顶部进度条】',
      '  @keyframes progress {',
      '    from { transform: scaleX(0); }',
      '    to   { transform: scaleX(1); }',
      '  }',
      '  .top-progress {',
      '    position: fixed;',
      '    top: 0; left: 0; right: 0;',
      '    height: 4px;',
      '    background: linear-gradient(90deg, #3b82f6, #8b5cf6);',
      '    transform-origin: left center;',
      '    animation: progress linear;',
      '    animation-timeline: scroll(root block);',
      '  }',
      '  /* 整页滚动时进度条从 0 增长到 100% */',
      '',
      '【完整示例：容器内滚动驱动】',
      '  .scroll-box {',
      '    height: 300px;',
      '    overflow-y: auto;',
      '  }',
      '  .scroll-box .indicator {',
      '    animation: move linear;',
      '    animation-timeline: scroll(nearest block);',
      '    /* nearest = .scroll-box（最近可滚动祖先） */',
      '  }',
      '',
      '【浏览器支持】',
      `  animation-timeline: scroll(): ${f.animationTimeline ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      '',
      '【常见陷阱】',
      '  1. nearest 找不到可滚动祖先时回退到 root',
      '     → 行为可能与预期不同，建议显式指定 root/nearest',
      '  2. self 模式下元素必须自身可滚动，否则 timeline 无进度',
      '  3. axis 选错轴则动画不响应（如选 block 但实际是水平滚动）',
      '  4. scroll() 必须有可滚动内容（容器内容超出容器尺寸）',
      '  5. 整页滚动用 root，容器内滚动用 nearest 或命名时间线',
    ].join('\n');
    this.setState({ scrollInfo: info });
    this._addLog('css', `scroll() 演示完成；supports=${f.animationTimeline}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. scroll() 函数 —— 滚动进度时间线',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['scroll()', f.animationTimeline]]),
        h(Tag, { color: 'primary' }, 'scroll() 时间线'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'scroll() = scroll([<axis>?, <scroller>?]) 创建滚动进度时间线。axis: block|inline|x|y（block 跟随书写模式，x/y 物理方向）；scroller: nearest|root|self（nearest 最近可滚动祖先，root 整页，self 自身）。animation-timeline: scroll(root block) 整页滚动驱动；scroll(nearest) 最近可滚动祖先；scroll(self inline) 自身水平滚动。参数顺序可互换，单参数可省略另一个。整页进度条用 root，容器内动画用 nearest。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 scroll() 演示', { type: 'primary', size: 'sm', onClick: () => this._runScrollDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '滚动驱动进度条演示（滚动下方容器查看进度条变化）：'),
        h('div', { class: 'sd-scroll-container' },
          h('div', { class: 'sd-progress' },
            h('div', { class: 'sd-progress__bar' }),
          ),
          h('div', { class: 'sd-scroll-content' },
            h('div', { class: 'sd-scroll-item' }, '滚动项 1 —— 向下滚动查看进度条增长'),
            h('div', { class: 'sd-scroll-item' }, '滚动项 2 —— 进度条由 animation-timeline: scroll() 驱动'),
            h('div', { class: 'sd-scroll-item' }, '滚动项 3 —— 滚动停止动画即暂停'),
            h('div', { class: 'sd-scroll-item' }, '滚动项 4 —— 滚到底进度条满 100%'),
            h('div', { class: 'sd-scroll-item' }, '滚动项 5 —— 反向滚动动画倒退'),
            h('div', { class: 'sd-scroll-item' }, '滚动项 6 —— 无需 JS 监听 scroll 事件'),
            h('div', { class: 'sd-scroll-item' }, '滚动项 7 —— 纯 CSS 实现，性能更优'),
            h('div', { class: 'sd-scroll-item' }, '滚动项 8 —— 结束'),
          ),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 整页滚动驱动 */',
            '.page-progress {',
            '  animation: grow linear;',
            '  animation-timeline: scroll(root block);',
            '}',
            '/* 最近可滚动祖先驱动 */',
            '.box {',
            '  animation: fade linear;',
            '  animation-timeline: scroll(nearest);',
            '}',
            '/* 自身水平滚动驱动 */',
            '.scroller {',
            '  overflow-x: auto;',
            '  animation-timeline: scroll(self inline);',
            '}',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.scrollInfo || '（点击按钮查看 scroll() 函数完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：view() 函数 —— 视图进度时间线 =====================

  _runViewDemo() {
    const f = this._flags();
    this._injectStyle('sd-view-demo', `
      .sd-view-demo-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-view-card {
        padding: 16px;
        margin: 8px 0;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        color: #1e3a8a;
        animation: sd-view-reveal linear;
        animation-timeline: view();
      }
      @keyframes sd-view-reveal {
        from { opacity: 0; transform: translateY(60px) scale(0.9); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `);
    const info = [
      '===== view() 函数 —— 视图进度时间线 =====',
      '',
      '【语法】',
      '  view() = view([<axis>?, <inset>?])',
      '  /* 两个参数顺序可互换，均可省略（默认 block + auto） */',
      '',
      '【axis 取值：与 scroll() 相同】',
      '  block    块方向（默认）',
      '  inline   行内方向',
      '  x        水平轴',
      '  y        垂直轴',
      '',
      '【inset 取值：调整时间线起止位置】',
      '  auto              默认，使用 view-timeline-inset 属性值',
      '  <length-percentage>{1,2}  显式指定内边距',
      '    view(20%)                    // 起止都是 20%',
      '    view(10% 20%)                // 起始 10%，结束 20%',
      '    view(100px)                  // 用长度值',
      '  /* inset 详解见 Card 7 view-timeline-inset */',
      '',
      '【核心区别：view() vs scroll()】',
      '  scroll()：',
      '    - 跟踪滚动条位置（整个滚动容器的滚动进度）',
      '    - 一个 timeline 对应整个滚动过程',
      '    - 适合「整页进度条」「整段滚动驱动一个动画」',
      '    - 进度 0% = 滚动条在顶部，100% = 滚动条在底部',
      '',
      '  view()：',
      '    - 跟踪元素自身进入视口的过程',
      '    - 每个元素有独立的 timeline（元素从进入视口到离开视口）',
      '    - 适合「卡片 reveal」「fade-in」「逐项出现」',
      '    - 进度 0% = 元素即将进入视口，100% = 元素完全离开视口',
      '    - 元素在视口中央时进度约 50%',
      '',
      '【view() 的 timeline 范围（与 animation-range 配合）】',
      '  cover           元素从开始进入视口到完全离开（默认范围）',
      '  entry           元素进入视口的过程',
      '  exit            元素离开视口的过程',
      '  contain         元素完全在视口内的过程',
      '  entry-crossing  元素刚开始与视口边缘相交',
      '  exit-crossing   元素刚结束与视口边缘相交',
      '  /* 详见 Card 6 animation-range */',
      '',
      '【典型用法：卡片 reveal 动画】',
      '  @keyframes reveal {',
      '    from {',
      '      opacity: 0;',
      '      transform: translateY(60px) scale(0.9);',
      '    }',
      '    to {',
      '      opacity: 1;',
      '      transform: translateY(0) scale(1);',
      '    }',
      '  }',
      '  .card {',
      '    animation: reveal linear;',
      '    animation-timeline: view();',
      '    /* 元素进入视口时播放 reveal 动画 */',
      '  }',
      '',
      '【典型用法：fade-in 渐显】',
      '  @keyframes fadeIn {',
      '    from { opacity: 0; }',
      '    to   { opacity: 1; }',
      '  }',
      '  .section {',
      '    animation: fadeIn linear;',
      '    animation-timeline: view();',
      '    animation-range: entry 0% entry 100%;  /* 仅在进入阶段渐显 */',
      '  }',
      '',
      '【典型用法：水平方向 reveal（侧边滑入）】',
      '  @keyframes slideIn {',
      '    from { opacity: 0; transform: translateX(-80px); }',
      '    to   { opacity: 1; transform: translateX(0); }',
      '  }',
      '  .item {',
      '    animation: slideIn linear;',
      '    animation-timeline: view(inline);  /* 水平方向 view 时间线 */',
      '  }',
      '',
      '【配合 inset 提前/延后触发】',
      '  /* 元素进入视口前 100px 就开始动画 */',
      '  .card {',
      '    animation-timeline: view(100px);',
      '  }',
      '  /* inset 详解见 Card 7 */',
      '',
      '【view() vs scroll() 选择指南】',
      '  - 整页进度条、整段滚动驱动 → scroll()',
      '  - 单个元素进入视口动画 → view()',
      '  - 多个卡片逐项出现 → view()（每个卡片独立 timeline）',
      '  - 视差滚动 → scroll()（不同元素不同速率）',
      '',
      '【浏览器支持】',
      `  animation-timeline: view(): ${f.animationTimelineView ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      '',
      '【常见陷阱】',
      '  1. view() 默认范围是 cover（从进入到离开整个视口过程）',
      '     → 想要「仅进入时动画」用 animation-range: entry 0% entry 100%',
      '  2. 元素初始就在视口内时，view() 进度可能不在 0%',
      '     → 首屏元素可能直接显示动画终态',
      '  3. view() 的 inset 与 view-timeline-inset 属性关系：',
      '     → view(auto) 使用 view-timeline-inset 属性值',
      '     → view(20%) 直接覆盖，忽略 view-timeline-inset 属性',
      '  4. 元素必须能进入视口才能触发（display:none 的元素不行）',
      '  5. 多个 view() 元素各自独立 timeline，互不影响',
    ].join('\n');
    this.setState({ viewInfo: info });
    this._addLog('css', `view() 演示完成；supports=${f.animationTimelineView}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. view() 函数 —— 视图进度时间线（元素进入视口）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['view()', f.animationTimelineView]]),
        h(Tag, { color: 'primary' }, 'view() 时间线'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'view() = view([<axis>?, <inset>?]) 创建视图进度时间线，跟踪元素进入视口的过程。axis 同 scroll()；inset: auto|<length-percentage>{1,2} 调整起止位置。与 scroll() 区别：scroll 跟踪滚动条位置（整段滚动一个 timeline），view 跟踪元素进入视口过程（每个元素独立 timeline）。用于 reveal/fade-in 动画。timeline range names: cover/entry/exit/contain/entry-crossing/exit-crossing。配合 animation-range 精细控制动画触发阶段。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 view() 演示', { type: 'primary', size: 'sm', onClick: () => this._runViewDemo() }),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 卡片 reveal：进入视口时淡入上移 */',
            '@keyframes reveal {',
            '  from { opacity: 0; transform: translateY(60px) scale(0.9); }',
            '  to   { opacity: 1; transform: translateY(0) scale(1); }',
            '}',
            '.card {',
            '  animation: reveal linear;',
            '  animation-timeline: view();',
            '}',
            '/* 仅在进入阶段渐显 */',
            '.section {',
            '  animation: fadeIn linear;',
            '  animation-timeline: view();',
            '  animation-range: entry 0% entry 100%;',
            '}',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.viewInfo || '（点击按钮查看 view() 函数完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：named scroll progress timelines —— 命名时间线 =====================

  _runNamedDemo() {
    const f = this._flags();
    this._injectStyle('sd-named-demo', `
      .sd-named-demo-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-named-scroller {
        height: 200px;
        overflow-y: auto;
        background: #e0e7ff;
        border-radius: 6px;
        padding: 8px;
        scroll-timeline-name: --named-scroll;
        scroll-timeline-axis: block;
      }
      .sd-named-target {
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      .sd-named-target__bar {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #34d399);
        transform-origin: left center;
        animation: sd-named-grow linear;
        animation-timeline: --named-scroll;
      }
      @keyframes sd-named-grow {
        from { transform: scaleX(0); }
        to   { transform: scaleX(1); }
      }
      .sd-named-content {
        padding: 16px;
        margin: 8px 0;
        background: #fff;
        border-radius: 4px;
        color: #1e3a8a;
      }
      .sd-named-viewcard {
        padding: 16px;
        margin: 8px 0;
        background: #fef3c7;
        border-radius: 6px;
        view-timeline-name: --card-view;
        view-timeline-axis: block;
        animation: sd-named-cardreveal linear;
        animation-timeline: --card-view;
      }
      @keyframes sd-named-cardreveal {
        from { opacity: 0.3; transform: scale(0.95); }
        to   { opacity: 1; transform: scale(1); }
      }
    `);
    const info = [
      '===== named scroll progress timelines —— 命名时间线 =====',
      '',
      '【核心属性：在滚动容器上声明命名时间线】',
      '  /* 滚动进度时间线命名 */',
      '  scroll-timeline-name: --page-scroll;',
      '  scroll-timeline-axis: block | inline | x | y;  /* 默认 block */',
      '',
      '  /* 视图进度时间线命名（在元素自身上声明） */',
      '  view-timeline-name: --card-view;',
      '  view-timeline-axis: block | inline | x | y;  /* 默认 block */',
      '',
      '【语法】',
      '  scroll-timeline-name: none | <dashed-ident>;',
      '  view-timeline-name: none | <dashed-ident>#;',
      '  /* <dashed-ident> 必须以 -- 开头，类似 CSS 变量 */',
      '',
      '  scroll-timeline-axis: block | inline | x | y;',
      '  view-timeline-axis: block | inline | x | y;',
      '',
      '【命名时间线 vs scroll()/view() 函数】',
      '  /* 函数式（匿名）：直接在动画元素上写 */',
      '  .box {',
      '    animation: grow linear;',
      '    animation-timeline: scroll(nearest);  // 最近可滚动祖先',
      '  }',
      '',
      '  /* 命名式：在滚动容器上声明，在动画元素上引用 */',
      '  .scroller {',
      '    scroll-timeline-name: --my-scroll;',
      '    scroll-timeline-axis: block;',
      '  }',
      '  .box {',
      '    animation: grow linear;',
      '    animation-timeline: --my-scroll;  // 引用命名时间线',
      '  }',
      '',
      '【完整示例：滚动容器驱动外部元素】',
      '  /* 滚动容器声明命名时间线 */',
      '  .scroller {',
      '    height: 300px;',
      '    overflow-y: auto;',
      '    scroll-timeline-name: --panel-scroll;',
      '    scroll-timeline-axis: block;',
      '  }',
      '  /* 外部进度条引用（无需是 scroller 的子元素） */',
      '  .external-progress {',
      '    animation: grow linear;',
      '    animation-timeline: --panel-scroll;',
      '  }',
      '',
      '【完整示例：view-timeline-name 让元素自带时间线】',
      '  .card {',
      '    view-timeline-name: --card-reveal;',
      '    /* 自身声明 view 时间线 */',
      '  }',
      '  .card .indicator {',
      '    animation: pulse linear;',
      '    animation-timeline: --card-reveal;',
      '    /* 子元素引用父元素的 view 时间线 */',
      '  }',
      '',
      '【跨组件复用：声明一次，多处引用】',
      '  /* 容器声明 */',
      '  .page {',
      '    scroll-timeline-name: --page;',
      '  }',
      '  /* 多个元素引用同一时间线 */',
      '  .progress-bar { animation-timeline: --page; }',
      '  .back-to-top   { animation-timeline: --page; }',
      '  .parallax-bg   { animation-timeline: --page; }',
      '',
      '【多命名时间线】',
      '  /* 一个滚动容器可声明多个 view-timeline-name（逗号分隔） */',
      '  .card {',
      '    view-timeline-name: --reveal, --spin;',
      '    /* 元素同时拥有两个命名 view 时间线 */',
      '  }',
      '  .card .a { animation-timeline: --reveal; }',
      '  .card .b { animation-timeline: --spin; }',
      '',
      '【与 scroll-timeline-axis / view-timeline-axis 配合】',
      '  .horizontal-scroller {',
      '    overflow-x: auto;',
      '    scroll-timeline-name: --h-scroll;',
      '    scroll-timeline-axis: inline;  /* 水平滚动轴 */',
      '  }',
      '  .indicator {',
      '    animation-timeline: --h-scroll;',
      '  }',
      '',
      '【为什么需要命名时间线】',
      '  1. scroll()/view() 是匿名的，作用域受限（最近祖先）',
      '  2. 命名时间线可被任意后代元素引用（含跨层级）',
      '  3. 配合 timeline-scope 可跨 DOM 树引用（见 Card 5）',
      '  4. 同一时间线可被多个元素共享，便于复用',
      '  5. view-timeline-name 让元素自身成为时间线源',
      '',
      '【浏览器支持】',
      `  scroll-timeline-name: ${f.scrollTimelineName ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      `  view-timeline-name: ${f.viewTimelineName ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      '',
      '【常见陷阱】',
      '  1. <dashed-ident> 必须以 -- 开头（如 --my-scroll）',
      '  2. 引用不存在的命名时间线 → 动画不执行（无回退）',
      '  3. 命名时间线默认只在「后代元素」中可见',
      '     → 跨层引用需配合 timeline-scope（见 Card 5）',
      '  4. scroll-timeline-name 需配合可滚动容器（overflow: auto/scroll）',
      '  5. view-timeline-name 应在元素自身声明（不是滚动容器）',
      '  6. 同名命名时间线在 DOM 树中可能冲突，需注意作用域',
    ].join('\n');
    this.setState({ namedInfo: info });
    this._addLog('css', `命名时间线演示完成；supports=${f.scrollTimelineName}/${f.viewTimelineName}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. named scroll progress timelines —— 命名时间线',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['scroll-timeline-name', f.scrollTimelineName],
          ['view-timeline-name', f.viewTimelineName],
        ]),
        h(Tag, { color: 'primary' }, '命名时间线'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'scroll-timeline-name: --name 在滚动容器上声明命名滚动时间线，scroll-timeline-axis 指定轴。view-timeline-name: --name 在元素自身声明命名视图时间线，view-timeline-axis 指定轴。子元素通过 animation-timeline: --name 引用。比 scroll()/view() 匿名函数更灵活：可被任意后代引用、跨组件复用、配合 timeline-scope 跨层引用。<dashed-ident> 必须 -- 开头。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行命名时间线演示', { type: 'primary', size: 'sm', onClick: () => this._runNamedDemo() }),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 容器声明命名滚动时间线 */',
            '.scroller {',
            '  overflow-y: auto;',
            '  scroll-timeline-name: --panel-scroll;',
            '  scroll-timeline-axis: block;',
            '}',
            '/* 子元素引用 */',
            '.progress {',
            '  animation: grow linear;',
            '  animation-timeline: --panel-scroll;',
            '}',
            '/* 元素声明命名视图时间线 */',
            '.card {',
            '  view-timeline-name: --card-view;',
            '  view-timeline-axis: block;',
            '}',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.namedInfo || '（点击按钮查看命名时间线完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：timeline-scope —— 跨层时间线引用 =====================

  _runScopeDemo() {
    const f = this._flags();
    this._injectStyle('sd-scope-demo', `
      .sd-scope-demo-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-scope-ancestor {
        timeline-scope: --scope-scroll;
        padding: 8px;
      }
      .sd-scope-scroller {
        height: 150px;
        overflow-y: auto;
        background: #e0e7ff;
        border-radius: 6px;
        padding: 8px;
        scroll-timeline-name: --scope-scroll;
      }
      .sd-scope-content {
        height: 600px;
        background: linear-gradient(180deg, #fef3c7, #fde68a);
        border-radius: 4px;
      }
      .sd-scope-external {
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 8px;
      }
      .sd-scope-external__bar {
        height: 100%;
        background: linear-gradient(90deg, #ef4444, #f59e0b);
        transform-origin: left center;
        animation: sd-scope-grow linear;
        animation-timeline: --scope-scroll;
      }
      @keyframes sd-scope-grow {
        from { transform: scaleX(0); }
        to   { transform: scaleX(1); }
      }
    `);
    const info = [
      '===== timeline-scope —— 跨层时间线引用 =====',
      '',
      '【语法】',
      '  timeline-scope: none | <dashed-ident># | all;',
      '  /* none —— 默认，不扩展时间线作用域 */',
      '  /* <dashed-ident> —— 显式扩展指定命名时间线 */',
      '  /* all —— 扩展所有命名时间线（包括后代声明的） */',
      '',
      '【问题：命名时间线的默认作用域】',
      '  /* 默认情况下，命名时间线只在「声明元素的后代」中可见 */',
      '  .scroller {',
      '    scroll-timeline-name: --my-scroll;  // 在此声明',
      '  }',
      '  .scroller .child {',
      '    animation-timeline: --my-scroll;  // ✓ 子元素可引用',
      '  }',
      '  .sibling {',
      '    animation-timeline: --my-scroll;  // ✗ 兄弟元素不可见',
      '  }',
      '  .ancestor .other {',
      '    animation-timeline: --my-scroll;  // ✗ 祖先的其他分支不可见',
      '  }',
      '',
      '【解决：用 timeline-scope 扩展作用域】',
      '  /* 在共同祖先上声明 timeline-scope */',
      '  .ancestor {',
      '    timeline-scope: --my-scroll;  // 扩展作用域到此层级',
      '  }',
      '  .scroller {',
      '    scroll-timeline-name: --my-scroll;  // 仍是声明位置',
      '  }',
      '  .sibling {',
      '    animation-timeline: --my-scroll;  // ✓ 现在可引用',
      '  }',
      '  .ancestor .other {',
      '    animation-timeline: --my-scroll;  // ✓ 祖先其他分支可引用',
      '  }',
      '',
      '【工作原理：timeline-scope 创造「时间线穿透点」】',
      '  - 在某元素上声明 timeline-scope: --name',
      '  - 浏览器在该元素位置创建一个「时间线引用点」',
      '  - 后代中声明的同名时间线会「上传」到这个引用点',
      '  - 该元素的整个子树（含其他分支）都能引用该时间线',
      '',
      '【完整示例：滚动容器驱动外部元素】',
      '  <div class="layout">',
      '    <aside class="sidebar">',
      '      <div class="progress-bar"></div>  <!-- 外部进度条 -->',
      '    </aside>',
      '    <main class="content">',
      '      <div class="scroller">...</div>  <!-- 滚动容器 -->',
      '    </main>',
      '  </div>',
      '',
      '  .layout {',
      '    timeline-scope: --page-scroll;  /* 共同祖先扩展作用域 */',
      '  }',
      '  .scroller {',
      '    scroll-timeline-name: --page-scroll;  /* 声明时间线 */',
      '  }',
      '  .progress-bar {',
      '    animation: grow linear;',
      '    animation-timeline: --page-scroll;  /* 外部元素引用 */',
      '  }',
      '',
      '【timeline-scope: all —— 扩展所有命名时间线】',
      '  .root {',
      '    timeline-scope: all;  /* 扩展所有后代命名时间线 */',
      '  }',
      '  /* 适合「让整棵树都能引用任意命名时间线」 */',
      '  /* 注意：性能开销可能略大，谨慎使用 */',
      '',
      '【多个时间线扩展】',
      '  .layout {',
      '    timeline-scope: --scroll-1, --scroll-2, --view-1;',
      '    /* 同时扩展多个命名时间线 */',
      '  }',
      '',
      '【应用场景：组件树时间线传递】',
      '  <!-- Web Components 场景 -->',
      '  <my-app>',
      '    <my-sidebar>',
      '      <progress-indicator></progress-indicator>',
      '    </my-sidebar>',
      '    <my-main>',
      '      <my-scroller></my-scroller>  <!-- 声明时间线 -->',
      '    </my-main>',
      '  </my-app>',
      '',
      '  /* 在 my-app 上扩展作用域 */',
      '  my-app {',
      '    timeline-scope: --app-scroll;',
      '  }',
      '  my-scroller {',
      '    scroll-timeline-name: --app-scroll;',
      '  }',
      '  progress-indicator {',
      '    animation-timeline: --app-scroll;  /* 跨组件引用 */',
      '  }',
      '',
      '【shadow DOM 中的时间线传递】',
      '  - shadow DOM 边界会阻断命名时间线引用',
      '  - 在 host 元素上声明 timeline-scope 可让时间线穿透 shadow 边界',
      '  - 配合 adoptedStyleSheets 在 shadow 内声明时间线',
      '',
      '  /* host 元素扩展作用域 */',
      '  :host {',
      '    timeline-scope: --shared-scroll;',
      '  }',
      '',
      '【浏览器支持】',
      `  timeline-scope: ${f.timelineScope ? '✓' : '✗'} (Chrome 122+/Safari 17.4+/Firefox 部分支持)`,
      '',
      '【常见陷阱】',
      '  1. timeline-scope 必须在「共同祖先」上声明，不是在动画元素上',
      '  2. 扩展的时间线名必须与声明的时间线名完全一致（含 -- 前缀）',
      '  3. timeline-scope: all 性能开销大，仅在必要时使用',
      '  4. shadow DOM 边界阻断引用，需在 host 上扩展',
      '  5. 扩展作用域后，原声明元素的子元素仍可引用（不冲突）',
      '  6. 多个同名时间线在不同分支声明时可能冲突',
      '     → 浏览器按「最近的声明」解析',
    ].join('\n');
    this.setState({ scopeInfo: info });
    this._addLog('css', `timeline-scope 演示完成；supports=${f.timelineScope}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. timeline-scope —— 跨层时间线引用',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['timeline-scope', f.timelineScope]]),
        h(Tag, { color: 'primary' }, '跨层作用域'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'timeline-scope: --name | all | none 让祖先元素声明时间线作用域，使子元素可在 DOM 树不同位置引用同一命名时间线。默认命名时间线只在「声明元素的后代」中可见，timeline-scope 在共同祖先上扩展作用域，解决跨分支引用、shadow DOM / 组件树时间线传递问题。all 扩展所有命名时间线（性能开销大）。必须在共同祖先上声明，不是在动画元素上。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 timeline-scope 演示', { type: 'primary', size: 'sm', onClick: () => this._runScopeDemo() }),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 共同祖先扩展作用域 */',
            '.layout {',
            '  timeline-scope: --page-scroll;',
            '}',
            '/* 滚动容器声明时间线 */',
            '.scroller {',
            '  scroll-timeline-name: --page-scroll;',
            '}',
            '/* 外部兄弟元素引用（跨分支） */',
            '.sidebar .progress {',
            '  animation: grow linear;',
            '  animation-timeline: --page-scroll;',
            '}',
            '/* shadow DOM host 扩展 */',
            ':host { timeline-scope: --shared; }',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.scopeInfo || '（点击按钮查看 timeline-scope 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：animation-range —— 动画范围 =====================

  _runRangeDemo() {
    const f = this._flags();
    this._injectStyle('sd-range-demo', `
      .sd-range-demo-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-range-card {
        padding: 16px;
        margin: 8px 0;
        background: #dbeafe;
        border-radius: 6px;
        animation: sd-range-reveal linear;
        animation-timeline: view();
        animation-range: entry 0% cover 40%;
      }
      @keyframes sd-range-reveal {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .sd-range-card-2 {
        padding: 16px;
        margin: 8px 0;
        background: #fef3c7;
        border-radius: 6px;
        animation: sd-range-spin linear;
        animation-timeline: view();
        animation-range: cover 0% cover 100%;
      }
      @keyframes sd-range-spin {
        from { transform: rotate(-15deg); }
        to   { transform: rotate(15deg); }
      }
    `);
    const info = [
      '===== animation-range —— 动画范围 =====',
      '',
      '【语法】',
      '  animation-range: <start> <end> | <timeline-range-name>;',
      '',
      '  /* 拆分属性 */',
      '  animation-range-start: normal | <length-percentage> | <timeline-range-name> <length-percentage>?',
      '  animation-range-end:   normal | <length-percentage> | <timeline-range-name> <length-percentage>?',
      '',
      '【timeline-range-name（仅 view() 时间线有效）】',
      '  cover            元素从开始进入视口到完全离开视口（默认范围）',
      '  contain          元素完全在视口内的过程',
      '  entry            元素进入视口的过程（从开始进入到完全进入）',
      '  exit             元素离开视口的过程（从开始离开到完全离开）',
      '  entry-crossing   元素与视口起始边相交的过程',
      '  exit-crossing    元素与视口结束边相交的过程',
      '',
      '  /* 注：scroll() 时间线只有 0%-100% 一个范围，无 range-name */',
      '  /* range-name 主要用于 view() 时间线的精细控制 */',
      '',
      '【animation-range 简写形式】',
      '  /* 单值：仅指定 range-name，起止百分比默认 0% 100% */',
      '  animation-range: entry;       /* = entry 0% entry 100% */',
      '  animation-range: cover;       /* = cover 0% cover 100% */',
      '',
      '  /* 双值：start range + end range */',
      '  animation-range: entry 0% cover 50%;',
      '  /* 从 entry 起点开始，到 cover 的 50% 结束 */',
      '',
      '  /* 混合：不同 range-name 作为起止 */',
      '  animation-range: entry 0% exit 100%;',
      '  /* 从进入开始到离开结束 */',
      '',
      '【拆分属性：分别设置 start/end】',
      '  .card {',
      '    animation-range-start: entry 0%;',
      '    animation-range-end: cover 50%;',
      '    /* 等价于 animation-range: entry 0% cover 50% */',
      '  }',
      '',
      '【normal 值：使用 timeline 默认范围】',
      '  animation-range-start: normal;  /* = cover 0% for view() */',
      '  animation-range-end: normal;    /* = cover 100% for view() */',
      '',
      '【长度/百分比偏移：在 range-name 基础上偏移】',
      '  animation-range: entry 0% entry 100%;      /* 整个 entry 阶段 */',
      '  animation-range: entry 20% entry 80%;      /* entry 阶段的中间 60% */',
      '  animation-range: cover 100px cover 200px;  /* 用长度值偏移 */',
      '  animation-range: entry 0% cover -10%;      /* 负值提前结束 */',
      '',
      '【典型用法：仅在进入阶段动画】',
      '  @keyframes fadeIn {',
      '    from { opacity: 0; transform: translateY(40px); }',
      '    to   { opacity: 1; transform: translateY(0); }',
      '  }',
      '  .card {',
      '    animation: fadeIn linear;',
      '    animation-timeline: view();',
      '    animation-range: entry 0% entry 100%;  /* 仅进入阶段 */',
      '  }',
      '',
      '【典型用法：进入 + 停留前半段动画】',
      '  .card {',
      '    animation: reveal linear;',
      '    animation-timeline: view();',
      '    animation-range: entry 0% cover 40%;',
      '    /* 进入开始 → cover 的 40% 结束 */',
      '  }',
      '',
      '【典型用法：仅在 contain 阶段（元素完全在视口）动画】',
      '  .pulse {',
      '    animation: pulse linear;',
      '    animation-timeline: view();',
      '    animation-range: contain 0% contain 100%;',
      '    /* 元素完全在视口内时脉冲 */',
      '  }',
      '',
      '【典型用法：跨越整个 cover 范围（默认）】',
      '  .parallax {',
      '    animation: move linear;',
      '    animation-timeline: view();',
      '    /* 不写 animation-range 默认 cover 0% cover 100% */',
      '  }',
      '',
      '【range-name 在 scroll() 时间线下】',
      '  - scroll() 时间线没有 range-name 概念',
      '  - animation-range 在 scroll() 下只能用百分比/长度',
      '  - animation-range: 0% 100%;  /* 整段滚动 */',
      '  - animation-range: 20% 80%;  /* 滚动的中间 60% */',
      '',
      '【timeline range name 可视化（view() 时间线）】',
      '  元素位置：    [在视口外]→[进入中]→[完全在内]→[停留]→[离开中]→[在视口外]',
      '  range-name:              entry        contain          exit',
      '                           ├─────────────────────────────────┤',
      '                                              cover',
      '                                              ├─────────────────────────┤',
      '  entry-crossing: ↑（与起始边相交）',
      '  exit-crossing:                                          ↑（与结束边相交）',
      '',
      '【浏览器支持】',
      `  animation-range: ${f.animationRange ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      '',
      '【常见陷阱】',
      '  1. range-name 仅对 view() 时间线有效，scroll() 下用百分比',
      '  2. animation-range: entry 等价于 entry 0% entry 100%（不是 cover 0% cover 100%）',
      '  3. start 的百分比必须 < end 的百分比，否则动画不执行',
      '  4. 默认 animation-range 是 normal normal = cover 0% cover 100%',
      '  5. 负百分比或超过 100% 是合法的（扩展到范围外）',
      '  6. 拆分属性 animation-range-start/end 各自独立，可只设一个',
    ].join('\n');
    this.setState({ rangeInfo: info });
    this._addLog('css', `animation-range 演示完成；supports=${f.animationRange}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. animation-range —— 动画范围（精细控制 view() 触发阶段）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['animation-range', f.animationRange]]),
        h(Tag, { color: 'primary' }, '动画范围'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'animation-range: <start> <end> 精细控制动画在 timeline 上的触发范围。animation-range-start/end: normal|<length-percentage>|<timeline-range-name> <length-percentage>?。timeline range names: cover|contain|entry|exit|entry-crossing|exit-crossing（仅 view() 时间线有效，scroll() 用百分比）。如 animation-range: entry 0% cover 50% 表示从进入开始到 cover 的 50% 结束。简写单值 entry 等价于 entry 0% entry 100%。默认 cover 0% cover 100%。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 animation-range 演示', { type: 'primary', size: 'sm', onClick: () => this._runRangeDemo() }),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 仅进入阶段动画 */',
            '.card {',
            '  animation: fadeIn linear;',
            '  animation-timeline: view();',
            '  animation-range: entry 0% entry 100%;',
            '}',
            '/* 进入 + cover 前 40% */',
            '.card-2 {',
            '  animation: reveal linear;',
            '  animation-timeline: view();',
            '  animation-range: entry 0% cover 40%;',
            '}',
            '/* 拆分属性 */',
            '.card-3 {',
            '  animation-range-start: entry 0%;',
            '  animation-range-end: cover 50%;',
            '}',
            '/* scroll() 下用百分比 */',
            '.bar { animation-range: 20% 80%; }',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.rangeInfo || '（点击按钮查看 animation-range 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：view-timeline-inset —— 视图时间线内边距 =====================

  _runInsetDemo() {
    const f = this._flags();
    this._injectStyle('sd-inset-demo', `
      .sd-inset-demo-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .sd-inset-card {
        padding: 16px;
        margin: 8px 0;
        background: #ede9fe;
        border-radius: 6px;
        view-timeline-name: --inset-card;
        view-timeline-inset: 20% 10%;
        animation: sd-inset-reveal linear;
        animation-timeline: --inset-card;
      }
      @keyframes sd-inset-reveal {
        from { opacity: 0.3; transform: scale(0.9); }
        to   { opacity: 1; transform: scale(1); }
      }
    `);
    const info = [
      '===== view-timeline-inset —— 视图时间线内边距 =====',
      '',
      '【语法】',
      '  view-timeline-inset: auto | <length-percentage>{1,2};',
      '  /* auto —— 默认，使用 0（无 inset） */',
      '  /* 单值：起始和结束都用同一值 */',
      '  /* 双值：第一个是起始 inset，第二个是结束 inset */',
      '',
      '【取值含义】',
      '  view-timeline-inset: auto;       // 默认，inset 为 0',
      '  view-timeline-inset: 20%;        // 起止都是 20%（视口尺寸的 20%）',
      '  view-timeline-inset: 10% 20%;    // 起始 10%，结束 20%',
      '  view-timeline-inset: 100px;      // 起止都是 100px',
      '  view-timeline-inset: 50px 100px; // 起始 50px，结束 100px',
      '',
      '【inset 的作用：调整 view() 时间线的起止位置】',
      '  - inset 在视口的「进入边」和「离开边」各加一段内边距',
      '  - 相当于「收缩视口范围」，让元素更早/更晚触发动画',
      '',
      '  无 inset：',
      '    元素触碰视口边缘 → timeline 0%',
      '    元素离开视口边缘 → timeline 100%',
      '',
      '  inset: 20%（起止都 20%）：',
      '    元素进入视口 20% 处 → timeline 0%',
      '    元素离开到视口 80% 处 → timeline 100%',
      '    → 动画触发范围被「收缩」到视口中央 60% 区域',
      '',
      '【正 inset：让动画触发更晚/更早结束】',
      '  /* 元素进入视口 100px 后才开始动画 */',
      '  .card {',
      '    view-timeline-name: --card;',
      '    view-timeline-inset: 100px 0;  /* 起始 100px，结束 0 */',
      '  }',
      '  /* 适合：让动画在元素更靠近视口中央时触发 */',
      '',
      '【负 inset：让动画提前触发】',
      '  /* 元素即将进入视口前 50px 就开始动画 */',
      '  .card {',
      '    view-timeline-name: --card;',
      '    view-timeline-inset: -50px 0;  /* 起始 -50px */',
      '  }',
      '  /* 适合：让动画提前开始，元素进入时已完成部分 */',
      '',
      '【双值：起始和结束独立控制】',
      '  /* 进入时延后，离开时提前 */',
      '  .card {',
      '    view-timeline-name: --card;',
      '    view-timeline-inset: 20% 10%;',
      '    /* 进入 20% 处开始，离开到 90% 处结束 */',
      '  }',
      '',
      '【与 view() 函数的 inset 参数关系】',
      '  /* 两种方式设置 inset */',
      '',
      '  /* 方式 1：view() 函数参数 */',
      '  .box {',
      '    animation-timeline: view(20%);  /* 直接传 inset */',
      '  }',
      '',
      '  /* 方式 2：view-timeline-inset 属性（view() 用 auto 引用） */',
      '  .box {',
      '    view-timeline-inset: 20%;',
      '    animation-timeline: view(auto);  /* auto = 使用属性值 */',
      '  }',
      '',
      '  /* 优先级：view() 显式参数 > view-timeline-inset 属性 */',
      '  .box {',
      '    view-timeline-inset: 20%;',
      '    animation-timeline: view(10%);  /* 用 10%，忽略属性 */',
      '  }',
      '',
      '【典型用法：让 reveal 动画在视口中央触发】',
      '  /* 默认 view() 元素触碰边缘就触发，可能太早 */',
      '  .card {',
      '    view-timeline-name: --reveal;',
      '    view-timeline-inset: 30%;  /* 进入视口 30% 处才触发 */',
      '    animation: reveal linear;',
      '    animation-timeline: --reveal;',
      '  }',
      '',
      '【典型用法：sticky 标题渐显】',
      '  /* 标题在视口顶部 80px 处开始动画 */',
      '  .sticky-title {',
      '    view-timeline-name: --title;',
      '    view-timeline-inset: 80px 0;  /* 起始 80px */',
      '    animation: fadeIn linear;',
      '    animation-timeline: --title;',
      '    animation-range: entry 0% entry 100%;',
      '  }',
      '',
      '【与 animation-range 的区别】',
      '  view-timeline-inset：调整 timeline 的「物理范围」（视口内边距）',
      '  animation-range：调整动画在 timeline 上的「进度范围」',
      '',
      '  /* 两者可组合使用 */',
      '  .card {',
      '    view-timeline-inset: 20%;',
      '    animation-range: entry 0% cover 50%;',
      '  }',
      '',
      '【浏览器支持】',
      `  view-timeline-inset: ${f.viewTimelineInset ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      '',
      '【常见陷阱】',
      '  1. inset 是相对「视口尺寸」的百分比，不是元素尺寸',
      '  2. 负 inset 让动画提前触发，但元素可能尚未进入视口',
      '  3. view() 显式 inset 参数会覆盖 view-timeline-inset 属性',
      '  4. inset 过大可能导致 timeline 范围为 0（动画不执行）',
      '  5. inset 仅对 view() 时间线有效，scroll() 时间线无此概念',
      '  6. 双值顺序：第一个是起始（进入边），第二个是结束（离开边）',
    ].join('\n');
    this.setState({ insetInfo: info });
    this._addLog('css', `view-timeline-inset 演示完成；supports=${f.viewTimelineInset}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. view-timeline-inset —— 视图时间线内边距',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['view-timeline-inset', f.viewTimelineInset]]),
        h(Tag, { color: 'primary' }, '视图内边距'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'view-timeline-inset: auto | <length-percentage>{1,2} 调整 view() 时间线的开始/结束位置，相当于收缩视口范围让元素更早/更晚触发动画。单值起止相同，双值第一个是起始（进入边）第二个是结束（离开边）。正 inset 让动画触发更晚/更早结束，负 inset 让动画提前触发。与 view() 函数的 inset 参数关系：view(auto) 引用属性值，view(20%) 显式覆盖属性。用于提前/延后触发 reveal 动画、sticky 标题渐显。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 view-timeline-inset 演示', { type: 'primary', size: 'sm', onClick: () => this._runInsetDemo() }),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 元素进入视口 20% 处才触发动画 */',
            '.card {',
            '  view-timeline-name: --reveal;',
            '  view-timeline-inset: 20%;',
            '  animation: reveal linear;',
            '  animation-timeline: --reveal;',
            '}',
            '/* 双值：进入延后，离开提前 */',
            '.card-2 {',
            '  view-timeline-inset: 20% 10%;',
            '}',
            '/* 负 inset：提前触发 */',
            '.card-3 {',
            '  view-timeline-inset: -50px 0;',
            '}',
            '/* view() 显式参数覆盖属性 */',
            '.box { animation-timeline: view(10%); }',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.insetInfo || '（点击按钮查看 view-timeline-inset 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo() {
    const f = this._flags();
    const info = [
      '===== 实战模式与陷阱 =====',
      '',
      '【模式 1：滚动驱动进度条（scroll() + scaleX）】',
      '  @keyframes progress {',
      '    from { transform: scaleX(0); }',
      '    to   { transform: scaleX(1); }',
      '  }',
      '  .top-progress {',
      '    position: fixed;',
      '    top: 0; left: 0; right: 0;',
      '    height: 4px;',
      '    background: linear-gradient(90deg, #3b82f6, #8b5cf6);',
      '    transform-origin: left center;',
      '    animation: progress linear;',
      '    animation-timeline: scroll(root block);',
      '  }',
      '  /* 整页滚动驱动顶部进度条，无需 JS */',
      '',
      '【模式 2：卡片 reveal 动画（view() + opacity/translate）】',
      '  @keyframes reveal {',
      '    from {',
      '      opacity: 0;',
      '      transform: translateY(60px) scale(0.95);',
      '    }',
      '    to {',
      '      opacity: 1;',
      '      transform: translateY(0) scale(1);',
      '    }',
      '  }',
      '  .card {',
      '    animation: reveal linear;',
      '    animation-timeline: view();',
      '    animation-range: entry 0% cover 40%;',
      '  }',
      '  /* 每个卡片独立 timeline，进入视口时淡入上移 */',
      '',
      '【模式 3：视差滚动（不同速率 translate）】',
      '  /* 慢速层：动画占整段滚动 */',
      '  .bg-layer {',
      '    animation: parallax-slow linear;',
      '    animation-timeline: scroll(root);',
      '  }',
      '  @keyframes parallax-slow {',
      '    from { transform: translateY(0); }',
      '    to   { transform: translateY(-100px); }',
      '  }',
      '',
      '  /* 快速层：动画占滚动一半（移动距离更大） */',
      '  .fg-layer {',
      '    animation: parallax-fast linear;',
      '    animation-timeline: scroll(root);',
      '    animation-range: 0% 50%;  /* 仅前半段滚动驱动 */',
      '  }',
      '  @keyframes parallax-fast {',
      '    from { transform: translateY(0); }',
      '    to   { transform: translateY(-200px); }',
      '  }',
      '  /* 不同 range 让两层视差速率不同 */',
      '',
      '【模式 4：滚动旋转（scroll + rotate）】',
      '  @keyframes spin {',
      '    from { transform: rotate(0deg); }',
      '    to   { transform: rotate(360deg); }',
      '  }',
      '  .icon {',
      '    animation: spin linear;',
      '    animation-timeline: scroll(root);',
      '    /* 整页滚动一圈，图标转 360 度 */',
      '  }',
      '',
      '  /* 配合 animation-range 限制旋转范围 */',
      '  .icon {',
      '    animation-range: 0% 50%;  /* 仅前半段滚动时旋转 */',
      '  }',
      '',
      '【模式 5：sticky 标题渐显（view() + entry range）】',
      '  .section-title {',
      '    position: sticky;',
      '    top: 0;',
      '    animation: titleFade linear;',
      '    animation-timeline: view();',
      '    animation-range: entry 0% entry 100%;',
      '    /* 标题进入视口时渐显 */',
      '  }',
      '  @keyframes titleFade {',
      '    from { opacity: 0; transform: translateY(-20px); }',
      '    to   { opacity: 1; transform: translateY(0); }',
      '  }',
      '',
      '【模式 6：列表项逐项 reveal（view() + 错峰）】',
      '  @keyframes slideIn {',
      '    from { opacity: 0; transform: translateX(-40px); }',
      '    to   { opacity: 1; transform: translateX(0); }',
      '  }',
      '  .list-item {',
      '    animation: slideIn linear;',
      '    animation-timeline: view(inline);  /* 水平方向 */',
      '    animation-range: entry 0% entry 100%;',
      '  }',
      '  /* 每个 list-item 独立 timeline，自然错峰 */',
      '',
      '【模式 7：回到顶部按钮显隐（scroll() + opacity）】',
      '  @keyframes showAfterScroll {',
      '    from { opacity: 0; transform: translateY(20px); pointer-events: none; }',
      '    to   { opacity: 1; transform: translateY(0); pointer-events: auto; }',
      '  }',
      '  .back-to-top {',
      '    animation: showAfterScroll linear;',
      '    animation-timeline: scroll(root);',
      '    animation-range: 10% 20%;  /* 滚动 10%-20% 时渐显 */',
      '  }',
      '',
      '【模式 8：滚动驱动数字递增（counter + scroll）】',
      '  @keyframes countUp {',
      '    from { --num: 0; }',
      '    to   { --num: 100; }',
      '  }',
      '  @property --num {',
      '    syntax: "<integer>";',
      '    inherits: false;',
      '    initial-value: 0;',
      '  }',
      '  .counter {',
      '    counter-reset: n var(--num);',
      '    animation: countUp linear;',
      '    animation-timeline: scroll(root);',
      '  }',
      '  .counter::after {',
      '    content: counter(n);',
      '  }',
      '  /* 滚动时数字从 0 递增到 100 */',
      '',
      '【模式 9：滚动驱动颜色变化】',
      '  @keyframes themeShift {',
      '    from { background: #3b82f6; }',
      '    to   { background: #ef4444; }',
      '  }',
      '  .hero {',
      '    animation: themeShift linear;',
      '    animation-timeline: scroll(root);',
      '    /* 整页滚动时背景从蓝渐变到红 */',
      '  }',
      '',
      '【模式 10：横向滚动驱动（scroll(inline)）】',
      '  .horizontal-section {',
      '    overflow-x: auto;',
      '    scroll-snap-type: x mandatory;',
      '  }',
      '  .progress-dots {',
      '    animation: dotActive linear;',
      '    animation-timeline: scroll(nearest inline);',
      '    /* 横向滚动驱动指示点 */',
      '  }',
      '',
      '===== 陷阱清单 =====',
      '',
      '【陷阱 1：animation-duration 在 timeline 下表示进度比例】',
      '  - time-driven：duration: 1s = 1 秒',
      '  - scroll-driven：duration: 1s = 整段滚动；duration: 0.5s = 滚动一半',
      '  - 通常省略 duration 让动画占满 timeline',
      '  - 误用 duration 会导致动画进度与滚动不同步',
      '',
      '【陷阱 2：animation-iteration-count 在 scroll-driven 下无意义】',
      '  - 滚动是单向的，无法「循环」',
      '  - iteration-count: infinite 在 scroll-driven 下被忽略',
      '  - 想要「滚动一次播放多次动画」用 animation-range 分段',
      '',
      '【陷阱 3：浏览器支持差异】',
      '  - Chrome 115+：完整支持',
      '  - Safari 17.4+：完整支持',
      '  - Firefox：部分支持（截至 2024 年仍在逐步完善）',
      '  - 不支持的浏览器：动画完全不执行（无回退）',
      '  → 必须做特性检测或提供回退方案',
      '',
      '  /* 特性检测 */',
      '  @supports (animation-timeline: scroll()) {',
      '    .progress { animation-timeline: scroll(); }',
      '  }',
      '  @supports not (animation-timeline: scroll()) {',
      '    /* 回退：JS 监听 scroll */',
      '    .progress { transition: transform 0.1s; }',
      '  }',
      '',
      '【陷阱 4：prefers-reduced-motion 优先级】',
      '  - 滚动驱动动画仍受 prefers-reduced-motion 影响',
      '  - 用户开启「减少动态效果」时应跳过或简化',
      '',
      '  @media (prefers-reduced-motion: reduce) {',
      '    *, *::before, *::after {',
      '      animation-timeline: auto !important;',
      '      animation-duration: 0.01ms !important;',
      '    }',
      '  }',
      '  /* 或直接禁用滚动驱动动画 */',
      '',
      '【陷阱 5：scroll container 必须有可滚动内容】',
      '  - scroll() 要求滚动容器内容超出容器尺寸',
      '  - 容器无溢出内容 → timeline 无进度，动画不执行',
      '  - 检查 overflow: auto/scroll + 内容尺寸',
      '',
      '【陷阱 6：animation 简写会重置 animation-timeline】',
      '  /* 错误：简写在后会重置 timeline */',
      '  .box {',
      '    animation-timeline: scroll();',
      '    animation: spin 1s linear;  /* 重置 timeline 为 auto */',
      '  }',
      '',
      '  /* 正确：先简写再写 timeline */',
      '  .box {',
      '    animation: spin linear;',
      '    animation-timeline: scroll();',
      '  }',
      '',
      '【陷阱 7：view() 元素初始在视口内时进度非 0%】',
      '  - 首屏元素可能直接处于 cover 50% 等中间状态',
      '  - 动画可能显示为「中间帧」而非起始帧',
      '  - 想要「首屏元素不动画」用 animation-range 限制或 JS 检测',
      '',
      '【陷阱 8：命名时间线作用域受限】',
      '  - 默认命名时间线只在「声明元素的后代」可见',
      '  - 跨分支引用需配合 timeline-scope（见 Card 5）',
      '  - shadow DOM 边界阻断引用，需在 host 上扩展',
      '',
      '【陷阱 9：animation-range 起止顺序】',
      '  - start 必须在 end 之前（百分比意义上）',
      '  - 反向 range 会导致动画不执行',
      '  - 想要「反向动画」用 @keyframes 反向定义，而非反转 range',
      '',
      '【陷阱 10：scroll snap 与 scroll-driven 配合】',
      '  - scroll-snap-type 不影响 animation-timeline',
      '  - 但 snap 会让滚动跳变，动画也会跳变',
      '  - 适合「分段式滚动驱动动画」',
      '',
      '【浏览器支持总览】',
      `  animation-timeline: scroll(): ${f.animationTimeline ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      `  animation-timeline: view(): ${f.animationTimelineView ? '✓' : '✗'} (Chrome 115+/Safari 17.4+/Firefox 部分支持)`,
      `  scroll-timeline-name: ${f.scrollTimelineName ? '✓' : '✗'} (Chrome 115+/Safari 17.4+)`,
      `  view-timeline-name: ${f.viewTimelineName ? '✓' : '✗'} (Chrome 115+/Safari 17.4+)`,
      `  timeline-scope: ${f.timelineScope ? '✓' : '✗'} (Chrome 122+/Safari 17.4+)`,
      `  animation-range: ${f.animationRange ? '✓' : '✗'} (Chrome 115+/Safari 17.4+)`,
      `  view-timeline-inset: ${f.viewTimelineInset ? '✓' : '✗'} (Chrome 115+/Safari 17.4+)`,
      '',
      '【资源】',
      '  - CSS Scroll-driven Animations 规范：https://drafts.csswg.org/scroll-animations-1/',
      '  - MDN Scroll-driven animations：https://developer.mozilla.org/docs/Web/CSS/animation-timeline',
      '  - Chrome 官方示例：https://scroll-driven-animations.style/',
      '  - view-timeline-name 文档：https://developer.mozilla.org/docs/Web/CSS/view-timeline-name',
      '  - animation-range 文档：https://developer.mozilla.org/docs/Web/CSS/animation-range',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战模式与陷阱演示完成');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战模式与陷阱（进度条 / reveal / 视差 / 旋转 / sticky / 陷阱清单）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.animationTimeline ? 'success' : 'error' }, `scroll() ${f.animationTimeline ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '10 种实战模式：滚动驱动进度条（scroll(root) + scaleX）/ 卡片 reveal（view() + opacity/translate）/ 视差滚动（不同 animation-range 速率）/ 滚动旋转（scroll + rotate）/ sticky 标题渐显（view() + entry range）/ 列表项逐项 reveal（view(inline)）/ 回到顶部按钮显隐 / 滚动驱动数字递增（@property + counter）/ 滚动驱动颜色变化 / 横向滚动驱动（scroll(inline)）。陷阱清单：duration 在 timeline 下表示进度比例、iteration-count 无意义、浏览器支持 Chrome 115+/Safari 17.4+/Firefox 部分支持、prefers-reduced-motion 优先级、scroll container 必须有可滚动内容、简写重置 timeline 等。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式与陷阱演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '滚动驱动进度条演示（滚动下方容器）：'),
        h('div', { class: 'sd-scroll-container' },
          h('div', { class: 'sd-progress' },
            h('div', { class: 'sd-progress__bar' }),
          ),
          h('div', { class: 'sd-scroll-content' },
            h('div', { class: 'sd-reveal-item' }, 'reveal 项 1 —— 滚动驱动进度条 + 卡片 reveal'),
            h('div', { class: 'sd-reveal-item' }, 'reveal 项 2 —— view() + animation-range'),
            h('div', { class: 'sd-reveal-item' }, 'reveal 项 3 —— 纯 CSS 实现，无需 JS'),
            h('div', { class: 'sd-reveal-item' }, 'reveal 项 4 —— 性能更优（GPU 合成）'),
            h('div', { class: 'sd-reveal-item' }, 'reveal 项 5 —— 反向滚动动画倒退'),
            h('div', { class: 'sd-reveal-item' }, 'reveal 项 6 —— 结束'),
          ),
        ),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, [
            '/* 进度条：scroll(root) + scaleX */',
            '.top-progress {',
            '  animation: grow linear;',
            '  animation-timeline: scroll(root block);',
            '}',
            '/* Reveal：view() + entry range */',
            '.card {',
            '  animation: reveal linear;',
            '  animation-timeline: view();',
            '  animation-range: entry 0% cover 40%;',
            '}',
            '/* 视差：不同 range 不同速率 */',
            '.bg { animation-range: 0% 100%; }',
            '.fg { animation-range: 0% 50%; }',
            '/* 特性检测回退 */',
            '@supports (animation-timeline: scroll()) { ... }',
          ].join('\n')),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与陷阱完整代码）')),
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
      h('h2', { class: 'section-title' }, 'CSS Scroll-Driven Animations 滚动驱动动画深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Scroll-driven Animations Module Level 1 —— 浏览器原生滚动驱动动画体系',
        description: '演示 animation-timeline 概述（<timeline-name>|scroll()|view()|auto|none，duration 改为表示滚动进度比例，scroll-driven vs time-driven 对比，命名时间线引用）、scroll() 函数（scroll([<axis>?, <scroller>?])，axis: block|inline|x|y，scroller: nearest|root|self，整页/容器/自身滚动驱动）、view() 函数（view([<axis>?, <inset>?])，跟踪元素进入视口过程，与 scroll() 区别，用于 reveal/fade-in）、命名时间线（scroll-timeline-name/view-timeline-name + axis，子元素引用 --name 跨组件复用）、timeline-scope（--name|all|none 跨层引用，解决 shadow DOM/组件树传递）、animation-range（<start> <end>，timeline range names: cover|contain|entry|exit|entry-crossing|exit-crossing，view() 精细控制）、view-timeline-inset（auto|<length-percentage>{1,2} 调整起止位置，提前/延后触发）、实战模式与陷阱（进度条/reveal/视差/旋转/sticky/数字递增/颜色变化 + 10 大陷阱清单：duration 语义/iteration 无意义/浏览器支持 Chrome 115+/Safari 17.4+/Firefox 部分支持/prefers-reduced-motion 优先级/scroll container 必须可滚动/简写重置 timeline 等）。用 CSS.supports() 检测，jsdom 不做真实滚动但流程完整。',
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
