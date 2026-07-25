// =====================================================================
// CSSAnchorPositioningDeepPage.js —— CSS Anchor Positioning 深度 实验室
// 演示 CSS Anchor Positioning Module Level 1 全套能力，让一个元素相对
// 另一个被命名为「锚」的元素精准定位，无需 JS 计算坐标，是 2024 年起
// 浏览器（Chrome 125+）正式落地的革命性 CSS 模块，彻底改变下拉菜单、
// 工具提示、悬浮卡片、Popover/Dialog 的对齐方式：
//   1. anchor-name + position-anchor —— 声明锚与绑定目标
//      .anchor { anchor-name: --my-anchor; }
//      .target { position-anchor: --my-anchor; }
//   2. anchor() 函数 —— 取锚的某条边/中心作为定位依据
//      top: anchor(bottom);                  // 目标顶 = 锚底
//      left: anchor(50%);                     // 目标 left = 锚中心
//      margin-top: anchor(end);               // 也支持作为 margin 值
//      anchor(<side> | <percentage> | center | inner | outer | start | end)
//   3. anchor-size() 函数 —— 取锚的尺寸作为目标大小
//      width: anchor-size(width);             // 与锚同宽
//      height: anchor-size(height);
//      max-width: anchor-size(width);         // 不超过锚宽
//   4. position-area —— 9 宫格 / 3x3 网格对齐（取代旧 inset-area）
//      position-area: bottom span-left;       // 锚下方靠左
//      position-area: center;                  // 居中重叠锚
//   5. position-try-fallbacks —— 自动翻转/避让溢出
//      position-try-fallbacks: flip-block, flip-inline, flip-start;
//      多个候选按顺序尝试，第一个不溢出的即采用
//   6. position-try-order —— 选择最优候选策略
//      position-try-order: most-width;        // 优先可见宽度最大
//      normal | most-width | most-height | most-block-size | most-inline-size
//   7. @position-try 规则 —— 命名候选位置，可覆盖任意属性
//      @position-try --bottom-right {
//        position-area: bottom right;
//        margin-top: 8px;
//      }
//      .target { position-try-fallbacks: --bottom-right; }
//   8. position-visibility —— 锚不可见/滚出视口时是否隐藏目标
//      position-visibility: anchors-visible | no-overflow | always
// 说明：jsdom 不做真实布局，但 CSS.supports 可探测属性/选择器支持；
//       注入演示样式 + 完整代码示例，真实浏览器可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSAnchorPositioningDeepPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      basicsInfo: '',         // Card 1：anchor-name + position-anchor
      anchorFnInfo: '',       // Card 2：anchor() 函数
      anchorSizeInfo: '',     // Card 3：anchor-size() 函数
      positionAreaInfo: '',   // Card 4：position-area 9 宫格
      tryFallbacksInfo: '',   // Card 5：position-try-fallbacks + order
      positionTryRuleInfo: '',// Card 6：@position-try 命名规则
      visibilityInfo: '',     // Card 7：position-visibility
      patternInfo: '',        // Card 8：典型场景与实战
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `anchor-name ${c(f.anchorName)}`,
      `position-anchor ${c(f.positionAnchor)}`,
      `anchor() ${c(f.anchorFn)}`,
      `anchor-size() ${c(f.anchorSize)}`,
      `position-area ${c(f.positionArea)}`,
      `position-try-fallbacks ${c(f.positionTryFallbacks)}`,
      `position-try-order ${c(f.positionTryOrder)}`,
      `@position-try ${c(f.positionTryRule)}`,
      `position-visibility ${c(f.positionVisibility)}`,
      `popover-api ${c(f.popover)}`,
    ];

    const summary = f.css
      ? `CSS Anchor Positioning 能力检测：${parts.join(' · ')}。jsdom 不做真实布局，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器（Chrome 125+）可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.anchorName) this._addLog('warn', 'anchor-name 不可用（Chrome 125+/Safari TP 起支持，Firefox 仍在实现中）');
    if (!f.positionTryFallbacks) this._addLog('warn', 'position-try-fallbacks 不可用（Chrome 125+）');
    if (!f.positionArea) this._addLog('warn', 'position-area 不可用（Chrome 125+，早期叫 inset-area）');

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
    this._injectStyle('css-anchor-base', `
      .ap-demo { position: relative; padding: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 10px; }
      .ap-anchor {
        display: inline-block;
        padding: 8px 16px;
        background: #3b82f6;
        color: #fff;
        border-radius: 6px;
        font-weight: 600;
        cursor: default;
        anchor-name: --ap-anchor;
      }
      .ap-target {
        position: absolute;
        background: #1e40af;
        color: #fff;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        position-anchor: --ap-anchor;
        top: anchor(bottom);
        left: anchor(0);
        margin-top: 6px;
      }
      .ap-area-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        margin-top: 10px;
      }
      .ap-area-cell {
        background: #e0e7ff;
        padding: 8px;
        border-radius: 4px;
        text-align: center;
        font-size: 11px;
        color: #1e3a8a;
        border: 1px dashed #6366f1;
      }
      .ap-area-cell.ap-center { background: #c7d2fe; font-weight: 700; }
      .ap-output {
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
    const supportsSel = (sel) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(`selector(${sel})`); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      anchorName: supportsPV('anchor-name', '--x'),
      positionAnchor: supportsPV('position-anchor', '--x'),
      anchorFn: supportsPV('top', 'anchor(bottom)'),
      anchorSize: supportsPV('width', 'anchor-size(width)'),
      positionArea: supportsPV('position-area', 'center') || supportsPV('inset-area', 'center'),
      positionTryFallbacks: supportsPV('position-try-fallbacks', 'flip-block'),
      positionTryOrder: supportsPV('position-try-order', 'most-width'),
      positionTryRule: supportsPV('@position-try', '--x'),
      positionVisibility: supportsPV('position-visibility', 'anchors-visible'),
      popover: typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype,
    };
  }

  // ===================== Card 1：anchor-name + position-anchor 基础 =====================

  _runBasicsDemo() {
    const f = this._flags();
    this._injectStyle('ap-basics-demo', `
      .ap-basics-host {
        position: relative;
        padding: 20px;
        background: linear-gradient(135deg, #fef3c7, #fde68a);
        border-radius: 8px;
        margin-top: 10px;
      }
      .ap-basics-anchor {
        display: inline-block;
        padding: 10px 18px;
        background: #ef4444;
        color: #fff;
        border-radius: 6px;
        font-weight: 700;
        anchor-name: --basics-anchor;
      }
      .ap-basics-target {
        position: absolute;
        background: #1e40af;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        position-anchor: --basics-anchor;
        top: anchor(bottom);
        left: anchor(left);
        margin-top: 8px;
      }
    `);
    const info = [
      '===== CSS Anchor Positioning 基础：anchor-name + position-anchor =====',
      '',
      '【动机】',
      '  传统浮动定位依赖 JS getBoundingClientRect() 计算坐标，',
      '  滚动/缩放/方向变化都要重新计算，性能差且容易抖动。',
      '  Anchor Positioning 让浏览器原生管理锚点关系，自动跟随重排。',
      '',
      '【两步走：声明锚 + 绑定目标】',
      '  /* 1. 在锚元素上声明 anchor-name */',
      '  .anchor {',
      '    anchor-name: --my-anchor;     /* 必须以 -- 开头，类似 CSS 变量 */',
      '  }',
      '',
      '  /* 2. 在目标元素上绑定 position-anchor */',
      '  .target {',
      '    position: absolute;            /* 必须是 abs / fixed / relative */',
      '    position-anchor: --my-anchor;  /* 绑定到 --my-anchor */',
      '    top: anchor(bottom);           /* 目标顶边 = 锚底边 */',
      '    left: anchor(left);            /* 目标左边 = 锚左边 */',
      '    margin-top: 8px;               /* 加 8px 间距 */',
      '  }',
      '',
      '【anchor-name 命名规则】',
      '  - 必须以 -- 开头（dashed-ident）',
      '  - 一个元素可声明多个锚名：anchor-name: --a, --b;',
      '  - 一个锚名只能对应一个元素（重名时后者覆盖前者）',
      '  - 默认作用域是整个文档，可用 anchor-scope 限制',
      '',
      '【position-anchor 作用】',
      '  - 为目标元素指定「默认锚」',
      '  - 之后该元素的 anchor()/anchor-size() 函数都基于此锚',
      '  - 也可在 anchor() 中显式指定其他锚：anchor(--other bottom)',
      '',
      '【DOM 结构示例】',
      '  <button class="anchor">点击我</button>',
      '  <div class="target">悬浮卡片</div>',
      '  /* 两者无需父子关系，无需 wrapper，无需 JS */',
      '',
      '【vs 传统 JS 方案】',
      '  传统：button.addEventListener("click", () => {',
      '          const rect = button.getBoundingClientRect();',
      '          tooltip.style.top = (rect.bottom + 8) + "px";',
      '          tooltip.style.left = rect.left + "px";',
      '        });',
      '        window.addEventListener("scroll", update, true); // 滚动要重算',
      '        window.addEventListener("resize", update);        // 缩放要重算',
      '  Anchor：纯 CSS 声明，浏览器自动处理所有重排',
      '',
      '【浏览器支持】',
      `  anchor-name: ${f.anchorName ? '✓' : '✗'} (Chrome 125+/Safari TP/Firefox 实现中)`,
      `  position-anchor: ${f.positionAnchor ? '✓' : '✗'}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 125+（2024-05）正式支持全套 Anchor Positioning',
      '  Safari 17.4 部分支持，Safari 26 起完整支持',
      '  Firefox 仍在实现中（截至 2025 仅夜间版部分支持）',
      '  规范：https://drafts.csswg.org/css-anchor-position-1/',
    ].join('\n');
    this.setState({ basicsInfo: info });
    this._addLog('css', `anchor-name/position-anchor 演示完成；supports=${f.anchorName}/${f.positionAnchor}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. anchor-name + position-anchor —— 声明锚与绑定目标',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['anchor-name', f.anchorName],
          ['position-anchor', f.positionAnchor],
        ]),
        h(Tag, { color: 'primary' }, 'Anchor L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '两步走：(1) 在锚元素上声明 anchor-name: --my-anchor（必须 dashed-ident）；(2) 在目标元素上绑定 position-anchor: --my-anchor。之后该目标的 anchor()/anchor-size() 都基于此锚。浏览器原生管理重排，滚动/缩放/方向变化无需 JS 重算。Chrome 125+ 正式支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行基础演示', { type: 'primary', size: 'sm', onClick: () => this._runBasicsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.basicsInfo || '（点击按钮查看 anchor-name + position-anchor 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：anchor() 函数 =====================

  _runAnchorFnDemo() {
    const f = this._flags();
    const info = [
      '===== anchor() 函数 —— 取锚的边/中心作为定位依据 =====',
      '',
      '【语法】',
      '  anchor(<anchor-name>? <anchor-side>)',
      '',
      '  <anchor-side> 取值：',
      '    top | bottom | left | right       // 锚的四条边（物理）',
      '    start | end | self-start | self-end // 逻辑边（随 direction/writing-mode）',
      '    inset-block-start | inset-block-end // 块向起止',
      '    inset-inline-start | inset-inline-end // 行内向起止',
      '    center                             // 锚中心（横纵各取一次）',
      '    <percentage>                       // 0% = start 边，100% = end 边',
      '    inner | outer                      // 用于 margin（锚内侧/外侧间距）',
      '',
      '【可用于 inset 属性（top/right/bottom/left）】',
      '  .target {',
      '    position-anchor: --a;',
      '    top: anchor(bottom);    /* 目标顶边 = 锚底边，紧贴下方 */',
      '    left: anchor(left);     /* 目标左边 = 锚左边 */',
      '  }',
      '',
      '  /* 让目标 left 居中对齐锚中心 */',
      '  .target-center {',
      '    left: anchor(center);   /* 目标 left = 锚中心 X */',
      '    transform: translateX(-50%); /* 再左移自身一半实现真正居中 */',
      '  }',
      '',
      '  /* 50% 也可表示中心（与 center 等价）*/',
      '  .target-50 { left: anchor(50%); }',
      '',
      '【可用于 margin 属性（与 inset 等价但语义不同）】',
      '  /* 这两种写法等价：都让目标顶 = 锚底 + 8px */',
      '  .a { top: anchor(bottom); margin-top: 8px; }',
      '  .b { top: 0; margin-top: anchor(bottom); } /* margin 用 anchor 也行 */',
      '',
      '  /* margin 用 inner/outer 表示锚内外侧 */',
      '  .c { margin-top: anchor(end); }   /* 等价于 anchor(bottom) + 0px */',
      '',
      '【显式指定不同锚（不依赖 position-anchor）】',
      '  .multi {',
      '    /* top 用 --a 的底，left 用 --b 的右 */',
      '    top: anchor(--a bottom);',
      '    left: anchor(--b right);',
      '  }',
      '',
      '【自动默认锚：position-anchor 缺省时】',
      '  若 anchor() 未显式指定锚名，且元素无 position-anchor，',
      '  则取其最近的「祖先链中含 anchor-name 的元素」作为隐式锚',
      '',
      '【配合 Popover API 模式】',
      '  <button popover="auto" anchor-name="show more">点击</button>',
      '  /* 此 button 既是 popover 又是锚，点击自动弹出 */',
      '',
      '  .menu {',
      '    position-anchor: --show-more;',
      '    top: anchor(bottom);',
      '    left: anchor(left);',
      '  }',
      '',
      '【anchor() 失败时】',
      '  - 锚元素被 display:none 或 detached → anchor() 返回 0',
      '  - 锚名未找到 → 同上',
      '  - 可用 @position-try 提供降级位置（见 Card 6）',
      '',
      '【浏览器支持】',
      `  anchor() in inset: ${f.anchorFn ? '✓' : '✗'} (Chrome 125+)`,
      '',
      '【对比传统 JS 计算】',
      '  // 传统',
      '  const r = btn.getBoundingClientRect();',
      '  tooltip.style.top = (r.bottom + window.scrollY) + "px";',
      '  tooltip.style.left = (r.left + window.scrollX) + "px";',
      '  // anchor() 直接 CSS 声明，浏览器自动算 scrollY/scrollX',
    ].join('\n');
    this.setState({ anchorFnInfo: info });
    this._addLog('css', `anchor() 函数演示完成；supports=${f.anchorFn}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. anchor() 函数 —— 取锚的边/中心作为定位依据',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['anchor()', f.anchorFn]]),
        h(Tag, { color: 'primary' }, '函数值'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'anchor(<anchor-name>? <anchor-side>) 取锚的某条边或中心作为目标定位依据，可用于 top/right/bottom/left/margin。anchor-side 取值：top/bottom/left/right（物理）/start/end/self-start/self-end（逻辑）/center/<percentage>/inner/outer。可与 position-anchor 配合省略锚名，或显式 anchor(--a bottom) 用不同锚。锚 detached 时返回 0，可降级到 @position-try 候选。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 anchor() 演示', { type: 'primary', size: 'sm', onClick: () => this._runAnchorFnDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.anchorFnInfo || '（点击按钮查看 anchor() 函数完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：anchor-size() 函数 =====================

  _runAnchorSizeDemo() {
    const f = this._flags();
    const info = [
      '===== anchor-size() 函数 —— 取锚的尺寸作为目标大小 =====',
      '',
      '【语法】',
      '  anchor-size(<anchor-name>? <anchor-size>)',
      '',
      '  <anchor-size> 取值：',
      '    width | height               // 锚的宽/高',
      '    inline-size | block-size     // 逻辑尺寸（随 writing-mode）',
      '    self-inline-size | self-block-size',
      '',
      '【典型用法：让目标与锚同宽（如下拉菜单）】',
      '  .menu {',
      '    position-anchor: --trigger;',
      '    top: anchor(bottom);',
      '    left: anchor(left);',
      '    width: anchor-size(width);   /* 与触发按钮同宽 */',
      '  }',
      '',
      '【限制最大尺寸：不超过锚宽但允许更小】',
      '  .menu {',
      '    max-width: anchor-size(width);',
      '    min-width: 200px;            /* 但至少 200px */',
      '  }',
      '',
      '【跟随锚尺寸动画化】',
      '  .resize {',
      '    width: anchor-size(width);',
      '    height: anchor-size(height);',
      '    transition: width 0.2s, height 0.2s;',
      '  }',
      '  /* 锚用 resize observer 改变尺寸时目标平滑跟随 */',
      '',
      '【减去固定偏移】',
      '  .padded {',
      '    width: calc(anchor-size(width) - 32px);  // 锚宽 - 32px',
      '    margin: 0 16px;',
      '  }',
      '',
      '【用于字体大小（响应式排版）】',
      '  .label {',
      '    font-size: calc(anchor-size(width) / 10);  // 字号 = 锚宽 / 10',
      '  }',
      '',
      '【vs width: 100% 父级尺寸】',
      '  width: 100%       // 相对父级 containing block',
      '  width: anchor-size(width)  // 相对锚元素，可跨层级',
      '',
      '  // 锚可以是任意元素，不必是父级，',
      '  // 比如锚在另一个 SVG 内、另一 iframe（同源）、另一组件内',
      '',
      '【显式锚名】',
      '  .multi {',
      '    width: anchor-size(--a width);   // 用 --a 的宽',
      '    height: anchor-size(--b height); // 用 --b 的高',
      '  }',
      '',
      '【浏览器支持】',
      `  anchor-size(): ${f.anchorSize ? '✓' : '✗'} (Chrome 125+)`,
      '',
      '【应用场景】',
      '  1. 下拉菜单与触发按钮同宽',
      '  2. Tooltip 跟随锚的 resize 动画',
      '  3. 表单错误提示宽度跟随输入框',
      '  4. 卡片悬浮预览与缩略图同比例',
    ].join('\n');
    this.setState({ anchorSizeInfo: info });
    this._addLog('css', `anchor-size() 演示完成；supports=${f.anchorSize}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. anchor-size() 函数 —— 取锚的尺寸作为目标大小',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['anchor-size()', f.anchorSize]]),
        h(Tag, { color: 'primary' }, '尺寸函数'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'anchor-size(<anchor-name>? width|height|inline-size|block-size) 取锚的尺寸作为目标的 width/height/max-width 等。典型场景：下拉菜单 width: anchor-size(width) 与触发按钮同宽；表单错误提示 max-width: anchor-size(width) 不超过输入框；可配合 calc 减去固定偏移。锚可以是任意元素，不必是父级，可跨层级跨组件。Chrome 125+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 anchor-size() 演示', { type: 'primary', size: 'sm', onClick: () => this._runAnchorSizeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.anchorSizeInfo || '（点击按钮查看 anchor-size() 函数完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：position-area 9 宫格 =====================

  _runPositionAreaDemo() {
    const f = this._flags();
    const info = [
      '===== position-area —— 9 宫格快速对齐 =====',
      '',
      '【动机】',
      '  anchor() + transform: translateX(-50%) 实现居中需要 3 行 CSS，',
      '  position-area 用 9 宫格语义声明一步到位（早期叫 inset-area）',
      '',
      '【9 宫格模型】',
      '              ┌────────┬────────┬────────┐',
      '              │  top   │  top   │  top   │',
      '              │  left  │ center │ right  │',
      '              ├────────┼────────┼────────┤',
      '              │ center │ center │ center │',
      '              │  left  │        │ right  │  ← 锚元素位置',
      '              ├────────┼────────┼────────┤',
      '              │ bottom │ bottom │ bottom │',
      '              │  left  │ center │ right  │',
      '              └────────┴────────┴────────┘',
      '',
      '  目标默认占据一个格子（如 top left 表示锚的左上方）',
      '  span-* 表示跨多个格子（如 span-left 表示左列整列）',
      '',
      '【语法】',
      '  position-area: <row> <col>;',
      '  position-area: <value>;            // 单值时另一维默认 center',
      '',
      '  <row> 取值：top | center | bottom | span-top | span-bottom | span-all',
      '  <col> 取值：left | center | right | span-left | span-right | span-all',
      '',
      '【常见组合】',
      '  position-area: top left;             // 锚左上方',
      '  position-area: top;                  // = top center，锚正上方',
      '  position-area: bottom right;         // 锚右下方',
      '  position-area: center;               // 与锚重叠（如模态中心）',
      '  position-area: bottom span-left;     // 锚下方，跨左+中列',
      '  position-area: center span-all;      // 垂直居中，跨全部列',
      '  position-area: span-all span-all;    // 全屏铺满（特殊用途）',
      '',
      '【完整代码示例：常见 Tooltip 模式】',
      '  .trigger { anchor-name: --t; }',
      '  .tooltip {',
      '    position-anchor: --t;',
      '    position-area: top;                // 锚正上方',
      '    margin-bottom: 8px;                // 间距',
      '  }',
      '',
      '  /* 自动跟随 writing-mode / direction 翻转 */',
      '  /* 同样代码在 RTL 布局中 top right 会自动变成 top left */',
      '',
      '【position-area vs anchor() 函数】',
      '  anchor()：精细控制每条边',
      '    top: anchor(bottom); left: anchor(50%);',
      '    transform: translateX(-50%);',
      '  position-area：语义化声明',
      '    position-area: bottom;',
      '  // 等价：都让目标紧贴锚下方且水平居中',
      '',
      '【旧名 inset-area】',
      '  早期规范叫 inset-area，Chrome 119-124 用此名',
      '  Chrome 125+ 重命名为 position-area',
      '  建议用 position-area，旧浏览器不支持也无所谓',
      '',
      '【与 Popover API 配合】',
      '  [popover] {',
      '    position-anchor: --trigger;',
      '    position-area: bottom;             // 默认在下方',
      '    position-try-fallbacks: top;       // 下方不够翻到上方',
      '  }',
      '',
      '【浏览器支持】',
      `  position-area: ${f.positionArea ? '✓' : '✗'} (Chrome 125+)`,
      `  inset-area (旧名): ${f.positionArea ? '✓' : '✗'} (Chrome 119-124)`,
    ].join('\n');
    this.setState({ positionAreaInfo: info });
    this._addLog('css', `position-area 演示完成；supports=${f.positionArea}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. position-area —— 9 宫格快速对齐（取代旧 inset-area）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['position-area', f.positionArea]]),
        h(Tag, { color: 'primary' }, '9 宫格'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'position-area: <row> <col> 用 9 宫格语义声明目标相对锚的位置（如 top/bottom/center × left/right/center）。单值时另一维默认 center。span-* 跨多格子（如 span-left 跨左+中列）。语义化声明比 anchor()+translate 更简洁，自动跟随 writing-mode/direction 翻转。Chrome 119-124 旧名 inset-area，125+ 重命名为 position-area。',
        ),
        h('div', { class: 'ap-area-grid' },
          h('div', { class: 'ap-area-cell' }, 'top left'),
          h('div', { class: 'ap-area-cell' }, 'top'),
          h('div', { class: 'ap-area-cell' }, 'top right'),
          h('div', { class: 'ap-area-cell' }, 'left'),
          h('div', { class: 'ap-area-cell ap-center' }, '锚 center'),
          h('div', { class: 'ap-area-cell' }, 'right'),
          h('div', { class: 'ap-area-cell' }, 'bottom left'),
          h('div', { class: 'ap-area-cell' }, 'bottom'),
          h('div', { class: 'ap-area-cell' }, 'bottom right'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 position-area 演示', { type: 'primary', size: 'sm', onClick: () => this._runPositionAreaDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.positionAreaInfo || '（点击按钮查看 position-area 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：position-try-fallbacks + position-try-order =====================

  _runTryFallbacksDemo() {
    const f = this._flags();
    const info = [
      '===== position-try-fallbacks + position-try-order —— 自动避让溢出 =====',
      '',
      '【动机】',
      '  Tooltip 默认放在锚下方，但若锚贴近屏幕底边会溢出不可见。',
      '  传统 JS 用 Popper.js / Floating UI 计算翻转，',
      '  Anchor Positioning 用纯 CSS 声明候选列表，浏览器自动选不溢出的。',
      '',
      '【position-try-fallbacks 语法】',
      '  position-try-fallbacks: <fallback-1>, <fallback-2>, ...;',
      '',
      '  <fallback> 取值：',
      '    flip-block      // 上下翻转（top ↔ bottom）',
      '    flip-inline     // 左右翻转（left ↔ right）',
      '    flip-start      // start/end 翻转',
      '    --<name>        // 引用 @position-try 命名候选',
      '    <position-area> // 直接写 position-area 值（如 top right）',
      '',
      '【典型组合：Tooltip 自动翻转】',
      '  .tooltip {',
      '    position-anchor: --trigger;',
      '    position-area: bottom;            // 默认下方',
      '    position-try-fallbacks: top;      // 下方溢出翻到上方',
      '  }',
      '',
      '【多个候选按顺序尝试】',
      '  .tooltip {',
      '    position-area: bottom;            // 1. 默认下方',
      '    position-try-fallbacks:',
      '      top,                            // 2. 上方',
      '      bottom right,                   // 3. 右下方',
      '      bottom left,                    // 4. 左下方',
      '      top right,                      // 5. 右上方',
      '      top left;                       // 6. 左上方',
      '  }',
      '  /* 浏览器按顺序检查每个候选，第一个不溢出的采用 */',
      '  /* 全部溢出则用最后一个（用户至少能看到一部分）*/',
      '',
      '【flip-block / flip-inline 内置翻转】',
      '  .menu {',
      '    position-area: bottom;            // 默认底部',
      '    margin-top: 8px;',
      '    position-try-fallbacks: flip-block; // 等价于 top',
      '    /* flip-block 自动翻转 top/bottom 并交换 margin */',
      '  }',
      '',
      '  .side-menu {',
      '    position-area: right;             // 默认右侧',
      '    position-try-fallbacks: flip-inline; // 溢出翻到左侧',
      '  }',
      '',
      '【position-try-order —— 选择最优候选策略】',
      '  position-try-order: normal;         // 默认：按 fallbacks 顺序第一个不溢出的',
      '  position-try-order: most-width;     // 选可见宽度最大的候选',
      '  position-try-order: most-height;    // 选可见高度最大的',
      '  position-try-order: most-block-size; // 选块向可见最大的（同 height 但逻辑化）',
      '  position-try-order: most-inline-size; // 选行内向可见最大的',
      '',
      '  .menu {',
      '    position-try-fallbacks: bottom, top, left, right;',
      '    position-try-order: most-height;  // 4 个方向都试，选高度最大的',
      '  }',
      '',
      '【与 position-area 配合的隐式 fallback】',
      '  .tooltip {',
      '    position-area: bottom;            // 初始位置',
      '    position-try-fallbacks: top, flip-block;',
      '    // "top" 是显式 position-area 值',
      '    // "flip-block" 是相对初始位置的翻转',
      '  }',
      '',
      '【溢出判定逻辑】',
      '  - 目标元素相对 containing block（视口或滚动容器）的边界框',
      '  - 候选位置使目标完全在 containing block 内 → 采用',
      '  - 候选位置部分溢出 → 跳过',
      '  - 所有候选都溢出 → 用 position-try-order 选最优',
      '',
      '【与 Popover/Dialog 协同】',
      '  [popover] {',
      '    position-anchor: --trigger;',
      '    position-area: bottom;',
      '    position-try-fallbacks: top, flip-block;',
      '    margin: 8px;',
      '  }',
      '',
      '【浏览器支持】',
      `  position-try-fallbacks: ${f.positionTryFallbacks ? '✓' : '✗'} (Chrome 125+)`,
      `  position-try-order: ${f.positionTryOrder ? '✓' : '✗'} (Chrome 125+)`,
      '',
      '【vs Popper.js / Floating UI】',
      '  传统 JS：~30KB 库 + 每帧 getBoundingClientRect + ResizeObserver',
      '  Anchor：~0 KB + 浏览器原生 + 自动避让 + GPU 合成层',
      '  迁移：Floating UI 已支持 @floating-ui/dom + native fallback 选项',
    ].join('\n');
    this.setState({ tryFallbacksInfo: info });
    this._addLog('css', `position-try-fallbacks/order 演示完成；supports=${f.positionTryFallbacks}/${f.positionTryOrder}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. position-try-fallbacks + position-try-order —— 自动避让溢出',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['position-try-fallbacks', f.positionTryFallbacks],
          ['position-try-order', f.positionTryOrder],
        ]),
        h(Tag, { color: 'primary' }, '避让策略'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'position-try-fallbacks: <候选1>, <候选2>, ... 声明候选位置列表（flip-block/flip-inline/flip-start 翻转/--name 引用 @position-try/直接 position-area 值），浏览器按顺序检查，第一个不溢出的采用。position-try-order: most-width/most-height 等策略选可见区域最大的候选。替代 Popper.js/Floating UI 的纯 CSS 方案。Chrome 125+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行避让演示', { type: 'primary', size: 'sm', onClick: () => this._runTryFallbacksDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.tryFallbacksInfo || '（点击按钮查看 position-try-fallbacks/order 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：@position-try 命名规则 =====================

  _runPositionTryRuleDemo() {
    const f = this._flags();
    this._injectStyle('ap-position-try-demo', `
      @position-try --bottom-right {
        position-area: bottom right;
        margin-top: 8px;
        width: 200px;
      }
      @position-try --top-right {
        position-area: top right;
        margin-bottom: 8px;
        width: 200px;
      }
      @position-try --side-left {
        position-area: left;
        margin-right: 8px;
        max-height: 300px;
        overflow: auto;
      }
      .ap-named-demo {
        position-anchor: --ap-anchor;
        position-area: bottom;
        margin-top: 8px;
        position-try-fallbacks: --top-right, --bottom-right, --side-left;
        background: #1e40af;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
      }
    `);
    const info = [
      '===== @position-try —— 命名候选位置规则 =====',
      '',
      '【动机】',
      '  flip-block/flip-inline 只能翻转位置，无法改变其他属性（如 width、margin）。',
      '  @position-try 命名规则让候选位置携带完整属性集，',
      '  比如翻到侧边时让宽度变小、加滚动条。',
      '',
      '【语法】',
      '  @position-try --<name> {',
      '    /* 可覆盖的属性白名单（仅以下能用）*/',
      '    position-area',
      '    top / right / bottom / left / inset / inset-block / inset-inline',
      '    margin / margin-top / margin-block / margin-inline 等',
      '    width / height / min-width / max-width / min-height / max-height',
      '    align-self / justify-self',
      '    anchor-name / position-anchor（小心循环）',
      '    /* 注意：不能改 background / color / font-size 等非定位属性 */',
      '  }',
      '',
      '【完整示例：上下左右 4 个候选】',
      '  @position-try --bottom-right {',
      '    position-area: bottom right;',
      '    margin-top: 8px;',
      '    width: 200px;',
      '  }',
      '',
      '  @position-try --top-right {',
      '    position-area: top right;',
      '    margin-bottom: 8px;',
      '    width: 200px;',
      '  }',
      '',
      '  @position-try --side-left {',
      '    position-area: left;',
      '    margin-right: 8px;',
      '    max-height: 300px;',
      '    overflow: auto;',
      '    width: 180px;            // 翻到侧边变窄',
      '  }',
      '',
      '  .menu {',
      '    position-anchor: --trigger;',
      '    position-area: bottom;   // 默认位置',
      '    margin-top: 8px;',
      '    position-try-fallbacks: --top-right, --bottom-right, --side-left;',
      '  }',
      '',
      '【规则：属性白名单】',
      '  仅以下属性可写在 @position-try 块内：',
      '    - 所有 inset 属性（top/right/bottom/left/inset/inset-block/inset-inline）',
      '    - 所有 margin 属性',
      '    - 所有 sizing 属性（width/height/min-*/max-*）',
      '    - position-area（旧 inset-area）',
      '    - align-self / justify-self',
      '    - anchor-name / position-anchor（小心循环引用）',
      '  其他属性（background/color 等）会被忽略',
      '',
      '【混合 flip-block 与 --name】',
      '  .menu {',
      '    position-area: bottom;',
      '    position-try-fallbacks:',
      '      flip-block,           // 自动翻转（无额外属性）',
      '      --side-left,          // 引用命名候选（带 width/max-height）',
      '      top right;            // 显式 position-area 值',
      '  }',
      '',
      '【position-try 简写】',
      '  /* 同时设 position-try-fallbacks + position-try-order */',
      '  .menu {',
      '    position-try: most-height flip-block, --side-left;',
      '    // 等价于：',
      '    // position-try-order: most-height;',
      '    // position-try-fallbacks: flip-block, --side-left;',
      '  }',
      '',
      '【vs 直接写 position-area 在 fallbacks 里】',
      '  // 简单场景：直接写',
      '  position-try-fallbacks: top, bottom, left, right;',
      '  // 复杂场景：用 @position-try 携带额外属性',
      '  position-try-fallbacks: --top-narrow, --bottom-wide;',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → 选中目标元素 → Computed 面板',
      '  → 可看到当前应用的 @position-try 规则名',
      '  → 模拟滚动/缩放触发候选切换',
      '',
      '【浏览器支持】',
      `  @position-try: ${f.positionTryRule ? '✓' : '✗'} (Chrome 125+)`,
    ].join('\n');
    this.setState({ positionTryRuleInfo: info });
    this._addLog('css', `@position-try 演示完成；supports=${f.positionTryRule}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. @position-try —— 命名候选位置规则',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@position-try', f.positionTryRule]]),
        h(Tag, { color: 'primary' }, '命名规则'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@position-try --<name> { ... } 定义带额外属性的命名候选位置（仅 inset/margin/sizing/position-area/align-self 等定位属性可用，background/color 等会被忽略）。比 flip-block 翻转更强大：翻到侧边时可同时让 max-height/width 变化、加滚动条。position-try 简写可同时设 fallbacks + order。position-try-fallbacks: --top-right, --side-left 引用命名候选。Chrome 125+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 @position-try 演示', { type: 'primary', size: 'sm', onClick: () => this._runPositionTryRuleDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.positionTryRuleInfo || '（点击按钮查看 @position-try 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：position-visibility =====================

  _runVisibilityDemo() {
    const f = this._flags();
    const info = [
      '===== position-visibility —— 锚不可见时目标是否显示 =====',
      '',
      '【动机】',
      '  锚元素可能因滚动/缩放/transform 移出视口，目标 Tooltip 是否还显示？',
      '  position-visibility 控制目标可见性策略。',
      '',
      '【取值】',
      '  position-visibility: always;           // 总是显示（默认）',
      '  position-visibility: anchors-visible;  // 仅当锚至少部分可见时显示',
      '  position-visibility: no-overflow;      // 目标自身不溢出 containing block 时显示',
      '',
      '【always（默认）】',
      '  .tooltip {',
      '    position-visibility: always;',
      '  }',
      '  // 即使锚滚出视口，目标仍按计算位置显示',
      '  // 可能造成「孤悬」目标（无锚可见但目标在屏幕上）',
      '',
      '【anchors-visible：跟随锚可见性】',
      '  .tooltip {',
      '    position-visibility: anchors-visible;',
      '  }',
      '  // 锚完全滚出视口 → 目标自动 display: none',
      '  // 锚部分可见 → 目标仍显示',
      '  // 适合 Tooltip：锚不可见时无需显示提示',
      '',
      '【no-overflow：目标自身不溢出时才显示】',
      '  .menu {',
      '    position-visibility: no-overflow;',
      '  }',
      '  // 目标元素若因锚位置导致自身溢出视口 → display: none',
      '  // 比 position-try-fallbacks 更激进：不尝试翻转，直接隐藏',
      '',
      '【应用场景决策】',
      '  Tooltip 提示：anchors-visible（锚不可见则提示无意义）',
      '  下拉菜单：no-overflow + position-try-fallbacks（先翻转，全失败再隐藏）',
      '  悬浮卡片：always（用户可能滚动查看锚外内容，卡片仍需可见）',
      '  Popover：always（已通过 ESC/外部点击关闭，无需依赖锚可见性）',
      '',
      '【与 Popover API 的 display:none 协同】',
      '  // Popover 自身有 display: none 控制显隐',
      '  // position-visibility 在显示后额外控制',
      '  [popover] {',
      '    position-visibility: anchors-visible;',
      '  }',
      '  // 锚滚出视口 → popover 自动 display: none',
      '  // 锚重新进入视口 → popover 不会自动恢复显示（需 JS 重新 showPopover）',
      '',
      '【与 IntersectionObserver 对比】',
      '  // 传统 JS 方案',
      '  const io = new IntersectionObserver(([e]) => {',
      '    tooltip.style.display = e.isIntersecting ? "" : "none";',
      '  }, { threshold: 0 });',
      '  io.observe(trigger);',
      '  // position-visibility 一行 CSS 替代上述代码',
      '',
      '【浏览器支持】',
      `  position-visibility: ${f.positionVisibility ? '✓' : '✗'} (Chrome 125+)`,
      '',
      '【已知限制】',
      '  - anchors-visible 仅检测锚的可见性，不检测目标自身',
      '  - 目标在视口内但锚不在视口时仍会隐藏（即使目标可独立显示）',
      '  - 滚动容器嵌套时检测逻辑较复杂，建议实测',
    ].join('\n');
    this.setState({ visibilityInfo: info });
    this._addLog('css', `position-visibility 演示完成；supports=${f.positionVisibility}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. position-visibility —— 锚不可见时目标是否显示',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['position-visibility', f.positionVisibility]]),
        h(Tag, { color: 'primary' }, '可见性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'position-visibility: always(默认)|anchors-visible|no-overflow 控制目标可见性。always 总显示（可能孤悬）；anchors-visible 仅锚至少部分可见时显示（Tooltip 场景）；no-overflow 目标自身不溢出 containing block 时显示（比 fallbacks 更激进直接隐藏）。替代 IntersectionObserver + JS 切换 display 的方案。Chrome 125+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 position-visibility 演示', { type: 'primary', size: 'sm', onClick: () => this._runVisibilityDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.visibilityInfo || '（点击按钮查看 position-visibility 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：典型场景与实战 =====================

  _runPatternDemo() {
    const f = this._flags();
    const info = [
      '===== Anchor Positioning 典型场景与实战模式 =====',
      '',
      '【场景 1：Tooltip 提示（最常见）】',
      '  <button class="trigger">悬浮我看提示</button>',
      '  <div class="tooltip" role="tooltip">这是提示内容</div>',
      '',
      '  .trigger { anchor-name: --t; }',
      '  .tooltip {',
      '    position-anchor: --t;',
      '    position-area: top;',
      '    margin-bottom: 8px;',
      '    position-try-fallbacks: bottom;       // 上方不够翻下方',
      '    position-visibility: anchors-visible; // 锚滚出视口隐藏提示',
      '    background: #1f2937;',
      '    color: #fff;',
      '    padding: 6px 10px;',
      '    border-radius: 4px;',
      '    font-size: 12px;',
      '  }',
      '',
      '【场景 2：下拉菜单（与 Popover API 配合）】',
      '  <button popovertarget="menu" class="trigger">菜单</button>',
      '  <div id="menu" popover="auto" class="menu">',
      '    <ul>',
      '      <li>复制</li><li>粘贴</li><li>删除</li>',
      '    </ul>',
      '  </div>',
      '',
      '  .trigger { anchor-name: --m; }',
      '  .menu {',
      '    position-anchor: --m;',
      '    position-area: bottom;',
      '    margin-top: 4px;',
      '    width: anchor-size(width);            // 与按钮同宽',
      '    position-try-fallbacks: top, flip-block;',
      '    position-try-order: most-height;      // 选高度最大的方向',
      '    background: #fff;',
      '    border: 1px solid #cbd5e1;',
      '    border-radius: 6px;',
      '    box-shadow: 0 4px 12px rgba(0,0,0,0.1);',
      '    padding: 4px;',
      '  }',
      '  // 配合 popover=auto 自动 light-dismiss（点外部关闭）',
      '  // 不需要任何 JS',
      '',
      '【场景 3：Combobox 自动补全】',
      '  <input class="search" anchor-name="list" />',
      '  <ul class="suggestions" popover="manual">',
      '    <li>苹果</li><li>香蕉</li>',
      '  </ul>',
      '',
      '  .search { anchor-name: --list; }',
      '  .suggestions {',
      '    position-anchor: --list;',
      '    position-area: bottom span-all;       // 下方铺满',
      '    margin-top: 2px;',
      '    width: anchor-size(width);            // 与输入框同宽',
      '    max-height: 200px;',
      '    overflow: auto;',
      '    position-try-fallbacks: top;          // 输入框贴底翻上方',
      '  }',
      '',
      '【场景 4：Toast 通知（页面角落）】',
      '  // Toast 没有锚元素时，可用 anchor 显式绑到 body 或伪元素',
      '  // 实际更常见用 fixed + position-area 而无需 anchor',
      '  .toast {',
      '    position: fixed;',
      '    position-area: bottom right;          // 直接对齐视口',
      '    margin: 16px;',
      '  }',
      '  // position-area 不需要 anchor 也能用，',
      '  // 此时锚是 containing block（视口或滚动容器）',
      '',
      '【场景 5：富文本编辑器悬浮工具栏】',
      '  // 锚是选区的 Range 边界',
      '  // 用 CSS.highlights 注册一个 Highlight 作为锚',
      '  // 或用一个空 <span> 包裹选区作为锚元素',
      '  .toolbar {',
      '    position-anchor: --selection;',
      '    position-area: top;',
      '    position-try-fallbacks: bottom;',
      '    position-visibility: anchors-visible;',
      '  }',
      '',
      '【场景 6：图表数据点 Tooltip】',
      '  // 锚是 SVG <circle> 数据点',
      '  circle { anchor-name: --point; }',
      '  .tooltip {',
      '    position-anchor: --point;',
      '    position-area: top;',
      '    // SVG 元素也可作为锚，浏览器会正确计算边界',
      '  }',
      '',
      '【anchor-scope 限制锚作用域】',
      '  // 默认 anchor-name 全局唯一，',
      '  // 多个相同 anchor-name 后者覆盖前者',
      '  // 用 anchor-scope 限制到某个容器内',
      '  .list-item {',
      '    anchor-scope: all;        // 此容器内的 anchor-name 仅在内部生效',
      '  }',
      '  .list-item .trigger {',
      '    anchor-name: --item;      // 每个 list-item 都可定义 --item 互不冲突',
      '  }',
      '  .list-item .tooltip {',
      '    position-anchor: --item;  // 自动找最近的 anchor-scope 内的 --item',
      '  }',
      '',
      '【anchor-scroll 滚动行为】',
      '  // anchor-scroll 控制锚滚动时目标是否跟随',
      '  anchor-scroll: default;     // 默认跟随滚动',
      '  anchor-scroll: none;        // 不跟随（目标固定在初始位置）',
      '  // 早期提案，Chrome 125+ 暂未实现，未来版本可能加入',
      '',
      '【完整无 JS Tooltip 组件（最终版）】',
      '  <style>',
      '    [data-tooltip] {',
      '      anchor-name: --tooltip-trigger;',
      '      position: relative;',
      '    }',
      '    [data-tooltip]::after {',
      '      content: attr(data-tooltip);',
      '      position: absolute;',
      '      position-anchor: --tooltip-trigger;',
      '      position-area: top;',
      '      margin-bottom: 6px;',
      '      position-try-fallbacks: bottom;',
      '      position-visibility: anchors-visible;',
      '      background: #1f2937;',
      '      color: #fff;',
      '      padding: 4px 8px;',
      '      border-radius: 4px;',
      '      font-size: 12px;',
      '      opacity: 0;',
      '      transition: opacity 0.2s;',
      '      pointer-events: none;',
      '    }',
      '    [data-tooltip]:hover::after {',
      '      opacity: 1;',
      '    }',
      '  </style>',
      '',
      '  <button data-tooltip="点击保存修改">保存</button>',
      '  // 完全无 JS 的纯 CSS Tooltip，自动避让 + 跟随滚动 + 视口检测',
      '',
      '【渐进增强策略】',
      '  /* 1. 检测支持 */',
      '  @supports (anchor-name: --x) {',
      '    /* 用 Anchor Positioning */',
      '    .tooltip {',
      '      position-anchor: --t;',
      '      position-area: top;',
      '    }',
      '  }',
      '',
      '  /* 2. 不支持时降级 */',
      '  @supports not (anchor-name: --x) {',
      '    /* 用 JS 计算或简单 absolute 定位 */',
      '    .tooltip {',
      '      position: absolute;',
      '      bottom: 100%;',
      '      left: 50%;',
      '      transform: translateX(-50%);',
      '    }',
      '  }',
      '',
      '【vs 第三方库对比】',
      '  ┌────────────────┬──────────────┬──────────────┬──────────────┐',
      '  │ 特性           │ Anchor API   │ Popper.js    │ Floating UI  │',
      '  ├────────────────┼──────────────┼──────────────┼──────────────┤',
      '  │ 体积           │ 0 KB         │ ~30 KB       │ ~10 KB       │',
      '  │ 性能           │ 浏览器原生   │ 每帧计算     │ 每帧计算     │',
      '  │ 自动避让       │ ✓ position-try │ ✓ flip modifier │ ✓ flip │',
      '  │ 跟随滚动       │ ✓ 自动       │ 需 scroll listener │ 需 scroll │',
      '  │ 浏览器支持     │ Chrome 125+  │ 全部         │ 全部         │',
      '  │ Shadow DOM     │ 部分支持     │ 支持有限     │ 支持有限     │',
      '  │ SSR            │ ✓ 完美       │ ✗ 需 JS      │ ✗ 需 JS      │',
      '  └────────────────┴──────────────┴──────────────┴──────────────┘',
      '',
      '【资源】',
      '  - 规范：https://drafts.csswg.org/css-anchor-position-1/',
      '  - MDN: https://developer.mozilla.org/docs/Web/CSS/anchor-name',
      '  - Chrome 文章：https://developer.chrome.com/blog/anchor-positioning-api',
      '  - Floating UI：https://floating-ui.com/',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '典型场景与实战模式演示完成');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 典型场景与实战模式（Tooltip / 下拉菜单 / Combobox / Toast）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.popover ? 'success' : 'error' }, `Popover ${f.popover ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '完整实战模式：Tooltip 提示（自动翻转 + 锚不可见隐藏）/ 下拉菜单（Popover API + 同宽 + 自动避让）/ Combobox 自动补全（与输入框同宽 + 输入框贴底翻上方）/ Toast 通知（无需 anchor 直接对齐视口）/ 富文本编辑器悬浮工具栏（Range 作为锚）/ 图表数据点 Tooltip（SVG circle 作锚）。配合 anchor-scope 限制作用域、@supports 渐进增强、与 Popper.js/Floating UI 库对比。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看典型场景与实战模式完整代码）')),
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
      h('h2', { class: 'section-title' }, 'CSS Anchor Positioning 深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Anchor Positioning Module Level 1 —— 革命性 CSS 定位模块',
        description: '演示 CSS Anchor Positioning 全套能力：anchor-name + position-anchor 声明锚与绑定目标、anchor() 函数取锚的边/中心、anchor-size() 函数取锚尺寸、position-area 9 宫格对齐（取代旧 inset-area）、position-try-fallbacks + position-try-order 自动避让溢出、@position-try 命名候选位置规则、position-visibility 锚不可见时目标可见性、典型场景实战（Tooltip/下拉菜单/Combobox/Toast/编辑器工具栏）。Chrome 125+（2024-05）正式支持，是替代 Popper.js/Floating UI 的纯 CSS 方案。用 CSS.supports() 检测，jsdom 不做真实布局但流程完整。',
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
