// =====================================================================
// CSSFlexboxDeepPage.js —— CSS Flexbox Layout 深度 实验室
// 完整覆盖 CSS Flexible Box Layout Module Level 1 全套能力：
//   1. display: flex / inline-flex —— 容器与项目概念
//      .box { display: flex; }            // 块级 flex 容器
//      .box { display: inline-flex; }     // 行内级 flex 容器
//   2. flex-direction —— 主轴方向
//      row(默认) | row-reverse | column | column-reverse
//   3. flex-basis / flex-grow / flex-shrink —— 三件套核心算法
//      flex-basis: auto;     // 初始尺寸（优先于 width）
//      flex-grow: 1;         // 剩余空间按比例分配
//      flex-shrink: 1;       // 空间不足按比例收缩
//      flex: 1 1 auto;       // 简写：grow shrink basis
//   4. justify-content —— 主轴对齐
//      flex-start | flex-end | center | space-between | space-around | space-evenly
//   5. align-items / align-self —— 交叉轴对齐
//      stretch(默认) | flex-start | flex-end | center | baseline
//   6. flex-wrap / align-content / gap —— 多行与间距
//      flex-wrap: nowrap(默认) | wrap | wrap-reverse
//      align-content: 仅多行有效
//      gap / row-gap / column-gap
//   7. order —— 视觉顺序（不影响 DOM 顺序，有可访问性问题）
//      order: <integer>（默认 0，可为负数）
//   8. 调试与陷阱：min-width:auto 陷阱、绝对定位项目、IE11 兼容性
// 说明：jsdom 不做真实布局，但 CSS.supports 可探测属性支持；
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

interface CSSFlexboxDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  basicsInfo: string;
  flexAlgorithmInfo: string;
  justifyContentInfo: string;
  alignItemsInfo: string;
  flexWrapAlignContentInfo: string;
  orderInfo: string;
  patternsInfo: string;
  trapsInfo: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSFlexboxDeepPage extends Page {
  declare state: CSSFlexboxDeepPageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];


  initialState(): CSSFlexboxDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      basicsInfo: '',              // Card 1：display flex/inline-flex + flex-direction
      flexAlgorithmInfo: '',       // Card 2：flex-basis/grow/shrink 三件套
      justifyContentInfo: '',      // Card 3：justify-content 主轴对齐
      alignItemsInfo: '',          // Card 4：align-items / align-self
      flexWrapAlignContentInfo: '',// Card 5：flex-wrap / align-content / gap
      orderInfo: '',               // Card 6：order 与可访问性
      patternsInfo: '',            // Card 7：常见布局模式实战
      trapsInfo: '',               // Card 8：调试与陷阱
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `display:flex ${c(f.flex)}`,
      `inline-flex ${c(f.inlineFlex)}`,
      `gap ${c(f.gap)}`,
      `row-gap ${c(f.rowGap)}`,
      `flex-basis:content ${c(f.flexBasisContent)}`,
      `order ${c(f.order)}`,
      `align-content:space-evenly ${c(f.alignContentSpaceEvenly)}`,
    ];

    const summary = f.css
      ? `CSS Flexbox 能力检测：${parts.join(' · ')}。jsdom 不做真实布局，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。Flexbox 已被全主流浏览器支持多年（IE 11 部分实现）。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.gap) this._addLog('warn', 'gap 不可用（Chrome 84+/Firefox 63+/Safari 14.1+ 起支持，旧浏览器需用 margin 模拟）');
    if (!f.flexBasisContent) this._addLog('warn', 'flex-basis: content 不可用（仅 Firefox 较早支持，Chrome/Safari 较新版本支持）');

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
    this._injectStyle('css-flexbox-base', `
      .fl-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .fl-box {
        display: flex;
        padding: 8px;
        background: #e0e7ff;
        border-radius: 6px;
        gap: 6px;
      }
      .fl-item {
        background: #3b82f6;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        min-width: 32px;
        text-align: center;
      }
      .fl-item--alt { background: #ef4444; }
      .fl-item--accent { background: #10b981; }
      .fl-axis-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        margin-top: 10px;
      }
      .fl-axis-cell {
        background: #e0e7ff;
        padding: 8px;
        border-radius: 4px;
        text-align: center;
        font-size: 11px;
        color: #1e3a8a;
        border: 1px dashed #6366f1;
      }
      .fl-axis-cell.fl-center { background: #c7d2fe; font-weight: 700; }
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
      flex: supportsPV('display', 'flex'),
      inlineFlex: supportsPV('display', 'inline-flex'),
      gap: supportsPV('gap', '10px'),
      rowGap: supportsPV('row-gap', '10px'),
      flexBasisContent: supportsPV('flex-basis', 'content'),
      order: supportsPV('order', '1'),
      alignContentSpaceEvenly: supportsPV('align-content', 'space-evenly'),
    };
  }

  // ===================== Card 1：Flex 容器与项目基础 =====================

  _runBasicsDemo(): void {
    const f = this._flags();
    this._injectStyle('fl-basics-demo', `
      .fl-basics-block {
        display: flex;
        background: #e0e7ff;
        padding: 8px;
        gap: 6px;
        margin-bottom: 8px;
        border-radius: 6px;
      }
      .fl-basics-inline {
        display: inline-flex;
        background: #fef3c7;
        padding: 8px;
        gap: 6px;
        border-radius: 6px;
      }
      .fl-dir-row { display: flex; flex-direction: row; }
      .fl-dir-row-rev { display: flex; flex-direction: row-reverse; }
      .fl-dir-col { display: flex; flex-direction: column; }
      .fl-dir-col-rev { display: flex; flex-direction: column-reverse; }
    `);
    const info = [
      '===== CSS Flexbox 基础：display flex/inline-flex + flex-direction =====',
      '',
      '【动机】',
      '  传统布局用 float/table/inline-block，垂直居中、等高列、自适应分配空间都困难。',
      '  Flexbox 用「主轴+交叉轴」的一维布局模型，专为自适应分配空间而生。',
      '  适合：导航栏、按钮组、卡片横排、表单输入组、媒体对象（图+文）。',
      '',
      '【display: flex vs inline-flex】',
      '  .block-flex {',
      '    display: flex;          // 块级 flex 容器，独占一行（类似 block）',
      '  }',
      '  .inline-flex {',
      '    display: inline-flex;   // 行内级 flex 容器（类似 inline-block）',
      '  }                          // 可与其他 inline 元素并排',
      '',
      '  区别仅在外部表现：flex 占满父宽，inline-flex 宽度由内容决定；',
      '  内部子元素的 flex 布局规则完全相同。',
      '',
      '【flex-direction：主轴方向】',
      '  flex-direction: row;             // 默认：水平，主轴左→右',
      '  flex-direction: row-reverse;     // 水平，主轴右→左',
      '  flex-direction: column;          // 垂直，主轴上→下',
      '  flex-direction: column-reverse;  // 垂直，主轴下→上',
      '',
      '  注：row/row-reverse 受 direction/writing-mode 影响（RTL 会反转）',
      '      column 不受 writing-mode 影响（总是物理垂直）',
      '',
      '【主轴(main-axis) vs 交叉轴(cross-axis)】',
      '  - 主轴 = flex-direction 指向的轴',
      '      row 时主轴是水平 X，column 时主轴是垂直 Y',
      '  - 交叉轴 = 与主轴垂直的另一条轴',
      '  - 主轴方向用 justify-content 对齐',
      '  - 交叉轴方向用 align-items 对齐',
      '',
      '      row:                          column:',
      '      ┌──────────────────┐          ┌────┐',
      '      │ 1  2  3  4       │ main→    │ 1  │ main↓',
      '      │                  │          │ 2  │',
      '      │                  │ cross↓   │ 3  │',
      '      └──────────────────┘          │ 4  │',
      '                                    └────┘',
      '',
      '【flex 容器属性总览（设在父元素）】',
      '  display              flex | inline-flex',
      '  flex-direction       row | row-reverse | column | column-reverse',
      '  flex-wrap            nowrap | wrap | wrap-reverse',
      '  flex-flow            <direction> <wrap> 简写',
      '  justify-content      主轴对齐（5+ 种）',
      '  align-items          交叉轴对齐（5 种）',
      '  align-content        多行对齐（仅 flex-wrap 多行有效）',
      '  gap / row-gap / column-gap  间距（替代 margin）',
      '',
      '【flex 项目属性总览（设在子元素）】',
      '  order            视觉顺序（整数，默认 0）',
      '  flex-grow        剩余空间分配比例（默认 0）',
      '  flex-shrink      收缩比例（默认 1）',
      '  flex-basis       初始尺寸（默认 auto）',
      '  flex             <grow> <shrink> <basis> 简写',
      '  align-self       单项交叉轴对齐（覆盖 align-items）',
      '',
      '【最小代码示例】',
      '  <style>',
      '    .nav {',
      '      display: flex;            /* 启用 flex 布局 */',
      '      gap: 8px;                 /* 项目间距 */',
      '      align-items: center;      /* 垂直居中 */',
      '    }',
      '    .nav-item { padding: 6px 12px; background: #3b82f6; color: #fff; }',
      '  </style>',
      '  <nav class="nav">',
      '    <div class="nav-item">首页</div>',
      '    <div class="nav-item">产品</div>',
      '    <div class="nav-item">关于</div>',
      '  </nav>',
      '',
      '【浏览器支持】',
      `  display: flex: ${f.flex ? '✓' : '✗'} (全主流浏览器，IE 11 部分实现)`,
      `  display: inline-flex: ${f.inlineFlex ? '✓' : '✗'}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 29+ / Firefox 22+ / Safari 9+ / Edge 12+ 全部支持',
      '  IE 11 实现了旧版规范（带 -ms- 前缀），有诸多 bug',
      '  规范：https://www.w3.org/TR/css-flexbox-1/',
    ].join('\n');
    this.setState({ basicsInfo: info });
    this._addLog('css', `flex/inline-flex 演示完成；supports=${f.flex}/${f.inlineFlex}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. Flex 容器与项目基础 —— display:flex / inline-flex / flex-direction',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['display:flex', f.flex],
          ['inline-flex', f.inlineFlex],
        ]),
        h(Tag, { color: 'primary' }, 'Flexbox L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Flex 容器：display: flex（块级）/ inline-flex（行内级）。flex-direction 设置主轴方向：row(默认)/row-reverse/column/column-reverse。主轴用 justify-content 对齐，交叉轴用 align-items 对齐。容器属性还有 flex-wrap/align-content/gap；项目属性有 order/flex(flex-basis+grow+shrink)/align-self。Chrome 29+/Firefox 22+/Safari 9+ 全面支持，IE 11 实现旧规范有 bug。',
        ),
        h('div', { class: 'fl-demo' },
          h('div', { class: 'fl-basics-block' },
            h('div', { class: 'fl-item' }, '1'),
            h('div', { class: 'fl-item' }, '2'),
            h('div', { class: 'fl-item' }, '3'),
          ),
          h('div', { class: 'fl-basics-inline' },
            h('div', { class: 'fl-item fl-item--alt' }, 'A'),
            h('div', { class: 'fl-item fl-item--alt' }, 'B'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行基础演示', { type: 'primary', size: 'sm', onClick: () => this._runBasicsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.basicsInfo || '（点击按钮查看 display:flex / flex-direction / 主轴交叉轴 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：flex-basis / flex-grow / flex-shrink 三件套 =====================

  _runFlexAlgorithmDemo(): void {
    const f = this._flags();
    this._injectStyle('fl-algo-demo', `
      .fl-algo-grow .grow-1 { flex-grow: 1; }
      .fl-algo-grow .grow-2 { flex-grow: 2; }
      .fl-algo-grow .grow-3 { flex-grow: 3; }
      .fl-algo-fixed .fixed { flex: 0 0 80px; }
      .fl-algo-fixed .flex-1 { flex: 1; }
      .fl-algo-shrink .shrink-0 { flex-shrink: 0; min-width: 80px; }
      .fl-algo-shrink .shrink-1 { flex-shrink: 1; flex-basis: 200px; }
    `);
    const info = [
      '===== flex-basis / flex-grow / flex-shrink —— Flex 算法三件套 =====',
      '',
      '【核心：flex 算法五步走】',
      '  1. 收集每个项目的「主轴尺寸」',
      '     flex-basis → 若为 auto 则取 width → 若 width 也为 auto 则取 content',
      '  2. 计算容器可用空间',
      '     可用 = 容器主轴尺寸 - 所有项目 flex-basis 之和 - gap 总和',
      '  3. 判断可用空间正负：',
      '     正 → 走 grow 分配（多余空间按比例加给项目）',
      '     负 → 走 shrink 收缩（不足空间按比例从项目扣除）',
      '  4. grow 分配公式：',
      '     增量_i = 可用空间 × (grow_i / sum(grow))',
      '     最终_i = flex-basis_i + 增量_i',
      '  5. shrink 收缩公式（带加权，flex-basis 大的扣得多）：',
      '     收缩量_i = -可用空间 × (shrink_i × basis_i / sum(shrink × basis))',
      '     最终_i = flex-basis_i + 收缩量_i',
      '',
      '【flex-basis：初始尺寸】',
      '  flex-basis: auto;       // 默认：取 width 值，width 也 auto 则取 content',
      '  flex-basis: 200px;      // 固定 200px 作为初始主轴尺寸',
      '  flex-basis: 50%;        // 容器主轴尺寸的 50%',
      '  flex-basis: content;    // 取内容固有尺寸（不取 width，Chrome 较新支持）',
      '  flex-basis: fill;       // 类似 content 但拉伸填充（旧名 main-size）',
      '  flex-basis: max-content | min-content | fit-content;',
      '',
      '  ★ 优先级：flex-basis > width（仅当 flex-basis 不为 auto 时）',
      '  ★ flex-basis: auto 时回退到 width',
      '  ★ 主轴是 column 时：flex-basis 对应 height 而非 width',
      '',
      '【flex-grow：剩余空间分配比例】',
      '  flex-grow: 0;     // 默认：不增长，保持 flex-basis 尺寸',
      '  flex-grow: 1;     // 占据 1 份剩余空间',
      '  flex-grow: 2;     // 占据 2 份（grow=1 的两倍）',
      '',
      '  示例：容器 500px，A basis=100 grow=1，B basis=100 grow=2',
      '    剩余 = 500 - (100+100) = 300',
      '    A 增量 = 300 × 1/3 = 100 → 最终 200',
      '    B 增量 = 300 × 2/3 = 200 → 最终 300',
      '',
      '【flex-shrink：空间不足时收缩比例】',
      '  flex-shrink: 0;    // 不收缩（保持 basis）',
      '  flex-shrink: 1;    // 默认：按比例收缩',
      '  flex-shrink: 2;    // 收缩 2 倍（比 shrink=1 的多收一倍）',
      '',
      '  示例：容器 300px，A basis=200 shrink=1，B basis=200 shrink=1',
      '    溢出 = (200+200) - 300 = 100',
      '    A 收缩 = 100 × (1×200)/(1×200+1×200) = 50 → 最终 150',
      '    B 收缩 = 100 × (1×200)/400 = 50 → 最终 150',
      '',
      '  ★ shrink 用 basis 加权（不是单纯比例），basis 大的扣得多',
      '',
      '【flex 简写】',
      '  flex: <grow> <shrink> <basis>;',
      '',
      '  常见简写语义：',
      '    flex: 1;            // = flex: 1 1 0%;  完全按比例分配，无视内容',
      '    flex: auto;         // = flex: 1 1 auto; 按内容尺寸+分配剩余',
      '    flex: none;         // = flex: 0 0 auto; 不变不缩，保持内容/width 尺寸',
      '    flex: 0 1 auto;     // 默认值：不变长但可收缩',
      '    flex: initial;      // = flex: 0 1 auto; 同默认',
      '    flex: 2 1 0;        // grow=2, shrink=1, basis=0',
      '',
      '【flex: 0 1 auto 默认值剖析】',
      '  - grow=0：不会变长',
      '  - shrink=1：可收缩',
      '  - basis=auto：初始尺寸取 width 或 content',
      '  结果：项目按内容尺寸排，溢出时按比例收缩',
      '',
      '【flex-basis: 0 vs auto 的关键区别】',
      '  flex: 1 1 0;       // basis=0：所有项目从 0 开始按 grow 比例瓜分',
      '                      //   grow=1 的全部等宽，无论内容多长',
      '  flex: 1 1 auto;    // basis=auto：先按内容/width 排，再按 grow 分剩余',
      '                      //   内容多的项目会更宽（先大再加分）',
      '',
      '  ★ 实现 N 等分：用 flex: 1（basis: 0）',
      '  ★ 实现按内容自适应+剩余平分：用 flex: auto 或 flex: 1 1 auto',
      '',
      '【实战 1：等分导航栏】',
      '  .nav { display: flex; }',
      '  .nav-item { flex: 1; }    /* 4 个 item 完全等宽 */',
      '',
      '  /* 配合 min-width 保证内容不挤压 */',
      '  .nav-item {',
      '    flex: 1;',
      '    min-width: 0;           /* 允许收缩到内容以下（见 Card 8）*/',
      '    text-align: center;',
      '  }',
      '',
      '【实战 2：自适应侧边栏】',
      '  .layout { display: flex; }',
      '  .sidebar { flex: 0 0 240px; }  /* 不变不缩，固定 240px */',
      '  .main    { flex: 1; }          /* 占据剩余空间 */',
      '',
      '  /* 响应式：窄屏隐藏侧边栏 */',
      '  @media (max-width: 768px) {',
      '    .sidebar { display: none; }',
      '    .main    { flex: 1; }',
      '  }',
      '',
      '【实战 3：输入框组】',
      '  .input-group { display: flex; }',
      '  .input-group input { flex: 1; min-width: 0; }',
      '  .input-group button { flex: none; }',
      '',
      '【浏览器支持】',
      `  flex-basis: content: ${f.flexBasisContent ? '✓' : '✗'} (Firefox 早期支持，Chrome/Safari 较新版本)`,
      `  flex-grow/shrink/basis: 全主流支持（IE 11 有 bug，需测试）`,
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → 选中 flex 项目 → Computed 面板',
      '  → 可看到 flex-basis / flex-grow / flex-shrink 的最终计算值',
      '  → Layout 面板可看到「flex item sizing」可视化（grow=绿，shrink=红）',
    ].join('\n');
    this.setState({ flexAlgorithmInfo: info });
    this._addLog('css', `flex 三件套演示完成；supports flex-basis:content=${f.flexBasisContent}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. flex-basis / flex-grow / flex-shrink 三件套（核心算法）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['flex-basis:content', f.flexBasisContent]]),
        h(Tag, { color: 'primary' }, '核心算法'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'flex 算法五步：收集项目主轴尺寸 → 算可用空间 → 正走 grow 分配 / 负走 shrink 收缩。flex-basis 优先于 width；flex-grow 按比例分剩余；flex-shrink 按 basis 加权收缩。flex 简写：flex:1=1 1 0%（等分）/ flex:auto=1 1 auto（按内容+分剩余）/ flex:none=0 0 auto（不变不缩）。flex-basis:0 让所有项目从 0 开始按 grow 瓜分实现等分；flex-basis:auto 则先按内容排再分剩余。',
        ),
        h('div', { class: 'fl-demo' },
          h('div', { class: 'fl-box fl-algo-grow' },
            h('div', { class: 'fl-item grow-1' }, 'grow:1'),
            h('div', { class: 'fl-item grow-2' }, 'grow:2'),
            h('div', { class: 'fl-item grow-3' }, 'grow:3'),
          ),
          h('div', { class: 'fl-box fl-algo-fixed' },
            h('div', { class: 'fl-item fixed' }, 'fixed 80'),
            h('div', { class: 'fl-item flex-1 fl-item--accent' }, 'flex:1 占剩余'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行三件套演示', { type: 'primary', size: 'sm', onClick: () => this._runFlexAlgorithmDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.flexAlgorithmInfo || '（点击按钮查看 flex-basis/grow/shrink 算法完整解析）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：justify-content 主轴对齐 =====================

  _runJustifyContentDemo(): void {
    const f = this._flags();
    this._injectStyle('fl-justify-demo', `
      .fl-jc-row {
        display: flex;
        margin-bottom: 6px;
        background: #e0e7ff;
        padding: 6px;
        border-radius: 4px;
        gap: 4px;
      }
      .fl-jc-row > span {
        background: #3b82f6;
        color: #fff;
        padding: 4px 10px;
        border-radius: 3px;
        font-size: 11px;
      }
    `);
    const info = [
      '===== justify-content —— 主轴对齐 =====',
      '',
      '【语法】',
      '  justify-content: flex-start | flex-end | center',
      '                 | space-between | space-around | space-evenly',
      '',
      '【6 种取值视觉差异（容器宽 400px，3 个项目各 60px）】',
      '',
      '  flex-start（默认）: 项目紧贴主轴起点，剩余空间在末尾',
      '    [■■■]                    ............剩余............',
      '    |60 60 60|',
      '',
      '  flex-end: 项目紧贴主轴终点，剩余空间在起点',
      '    ............剩余............    [■■■]',
      '                                  |60 60 60|',
      '',
      '  center: 项目居中，剩余空间两侧均分',
      '    ......剩余......    [■■■]    ......剩余......',
      '                      |60 60 60|',
      '',
      '  space-between: 项目均匀分布，首尾贴边，剩余空间在项目之间',
      '    [■]       110px       [■]       110px       [■]',
      '    首                            中                            尾',
      '    剩余 = 400 - 180 = 220，分 2 个间隙各 110',
      '',
      '  space-around: 每个项目左右各分 1/2 间隙',
      '    55px [■] 110px [■] 110px [■] 55px',
      '    首尾间隙是中间的一半',
      '    剩余 220 分 6 个半隙（每个项目 2 个半隙）= 220/6 ≈ 36.67',
      '    实际：36.67 [■] 73.33 [■] 73.33 [■] 36.67',
      '',
      '  space-evenly: 项目间和首尾的间隙完全相等',
      '    55px [■] 55px [■] 55px [■] 55px',
      '    剩余 220 分 4 个等隙 = 55',
      '',
      '【space-between vs space-around vs space-evenly 精确区别】',
      '  设：容器宽 W，N 个项目各 w，剩余空间 R = W - N×w',
      '  - space-between: N-1 个间隙，每个 R/(N-1)，首尾无间隙',
      '  - space-around:  2N 个半隙，每个 R/(2N)，首尾各 1 个半隙',
      '  - space-evenly:  N+1 个等隙，每个 R/(N+1)，首尾各 1 个等隙',
      '',
      '  口诀：',
      '    between = 中间空，首尾贴',
      '    around = 首尾半空，中间全空',
      '    evenly = 全部等空',
      '',
      '【配合 flex-direction: row-reverse 的翻转效果】',
      '  flex-direction: row-reverse + justify-content: flex-start',
      '    等价于 row + flex-end（项目从右开始排）',
      '  flex-direction: row-reverse + justify-content: flex-end',
      '    等价于 row + flex-start（项目从左开始排）',
      '  flex-direction: row-reverse + justify-content: space-between',
      '    第一个项目在右，最后一个在左（顺序翻转）',
      '',
      '  ★ 主轴起点跟随 flex-direction 翻转，justify-content 相对主轴起点',
      '',
      '【完整代码示例】',
      '  <style>',
      '    .toolbar {',
      '      display: flex;',
      '      justify-content: space-between;  /* logo 左 + 菜单右 */',
      '      align-items: center;',
      '      padding: 8px 16px;',
      '    }',
      '    .menu { display: flex; gap: 12px; }',
      '  </style>',
      '  <header class="toolbar">',
      '    <div class="logo">Logo</div>',
      '    <nav class="menu">',
      '      <a>首页</a><a>产品</a><a>关于</a>',
      '    </nav>',
      '  </header>',
      '',
      '【实战：分页器】',
      '  .pagination {',
      '    display: flex;',
      '    justify-content: center;          /* 居中 */',
      '    gap: 4px;',
      '  }',
      '',
      '【实战：按钮组两端对齐】',
      '  .actions {',
      '    display: flex;',
      '    justify-content: space-between;   /* 取消 + 确定分两端 */',
      '  }',
      '',
      '【实战：卡片均匀分布】',
      '  .cards {',
      '    display: flex;',
      '    justify-content: space-evenly;    /* 首尾也有间隙 */',
      '    flex-wrap: wrap;',
      '  }',
      '',
      '【浏览器支持】',
      '  flex-start/flex-end/center/space-between/space-around: 全主流支持',
      `  space-evenly: ${f.alignContentSpaceEvenly ? '✓' : '✗'} (Chrome 60+/Firefox 52+/Safari 11+，IE 不支持)`,
      '',
      '【IE 11 兼容】',
      '  IE 11 不支持 space-evenly 和 space-around（仅支持 space-between）',
      '  降级方案：用 margin: auto 自动分配',
      '  .cards > * { margin: 0 8px; }',
      '  .cards > *:first-child { margin-left: 0; }',
      '  .cards > *:last-child { margin-right: 0; }',
      '',
      '【调试技巧】',
      '  Chrome DevTools → 选中 flex 容器 → 出现 justify-content 切换下拉',
      '  可实时预览 6 种对齐效果，无需改代码',
    ].join('\n');
    this.setState({ justifyContentInfo: info });
    this._addLog('css', `justify-content 演示完成；supports space-evenly=${f.alignContentSpaceEvenly}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. justify-content —— 主轴对齐（6 种取值）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['space-evenly', f.alignContentSpaceEvenly]]),
        h(Tag, { color: 'primary' }, '主轴对齐'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'justify-content 控制项目在主轴上的对齐：flex-start(默认)/flex-end/center/space-between/space-around/space-evenly。space-between 首尾贴边中间均分；space-around 首尾半隙中间全隙；space-evenly 全部等隙（含首尾）。配合 flex-direction: row-reverse 可翻转主轴起点。IE 11 不支持 space-evenly/around，可用 margin:auto 降级。',
        ),
        h('div', { class: 'fl-demo' },
          h('div', { class: 'fl-jc-row', style: 'justify-content: flex-start' },
            h('span', {}, 'A'), h('span', {}, 'B'), h('span', {}, 'C')),
          h('div', { class: 'fl-jc-row', style: 'justify-content: center' },
            h('span', {}, 'A'), h('span', {}, 'B'), h('span', {}, 'C')),
          h('div', { class: 'fl-jc-row', style: 'justify-content: space-between' },
            h('span', {}, 'A'), h('span', {}, 'B'), h('span', {}, 'C')),
          h('div', { class: 'fl-jc-row', style: 'justify-content: space-evenly' },
            h('span', {}, 'A'), h('span', {}, 'B'), h('span', {}, 'C')),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 justify-content 演示', { type: 'primary', size: 'sm', onClick: () => this._runJustifyContentDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.justifyContentInfo || '（点击按钮查看 justify-content 6 种取值完整解析）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：align-items / align-self 交叉轴对齐 =====================

  _runAlignItemsDemo(): void {
    const f = this._flags();
    this._injectStyle('fl-align-demo', `
      .fl-ai-row {
        display: flex;
        height: 80px;
        margin-bottom: 6px;
        background: #e0e7ff;
        padding: 6px;
        border-radius: 4px;
        gap: 4px;
      }
      .fl-ai-row > span {
        background: #3b82f6;
        color: #fff;
        padding: 4px 10px;
        border-radius: 3px;
        font-size: 11px;
      }
      .fl-ai-row > span.tall { font-size: 16px; padding: 12px 14px; }
      .fl-ai-row > span.short { font-size: 10px; padding: 2px 6px; }
    `);
    const info = [
      '===== align-items / align-self —— 交叉轴对齐 =====',
      '',
      '【align-items：所有项目的交叉轴对齐（设在容器）】',
      '  align-items: stretch(默认) | flex-start | flex-end | center | baseline',
      '',
      '  注：交叉轴方向 = 与 flex-direction 垂直的另一条轴',
      '      row 时交叉轴是垂直 Y，column 时交叉轴是水平 X',
      '',
      '【5 种取值视觉差异（容器高 80px，3 个项目内容高不同）】',
      '',
      '  stretch（默认）：项目拉伸填满交叉轴',
      '    条件：项目无固定交叉轴尺寸（height 是 auto）',
      '    ┌────────────────────┐',
      '    │ [■■■] [■■■] [■■■]  │  ← 全部撑满 80px 高',
      '    │ [    ] [    ] [    ] │',
      '    └────────────────────┘',
      '',
      '  flex-start：项目紧贴交叉轴起点（顶部）',
      '    ┌────────────────────┐',
      '    │ [■■■] [■■■] [■■■]  │  ← 都在顶部',
      '    │                    │  ← 下方空',
      '    └────────────────────┘',
      '',
      '  flex-end：项目紧贴交叉轴终点（底部）',
      '    ┌────────────────────┐',
      '    │                    │  ← 上方空',
      '    │ [■■■] [■■■] [■■■]  │  ← 都在底部',
      '    └────────────────────┘',
      '',
      '  center：项目居中（垂直居中常见用法）',
      '    ┌────────────────────┐',
      '    │       [■■■][■■■][■■■] │  ← 中间居中',
      '    └────────────────────┘',
      '',
      '  baseline：项目按文字基线对齐',
      '    不同字号的项目，基线（字母 x 底部）对齐',
      '    ┌────────────────────┐',
      '    │  [■■■]              │  ← 大字 baseline',
      '    │     [■■■][■■■]     │  ← 小字 baseline 与大字齐',
      '    └────────────────────┘',
      '',
      '【align-self：单个项目覆盖 align-items】',
      '  align-self: auto(默认跟随 align-items) | stretch | flex-start | flex-end | center | baseline',
      '',
      '  .box { display: flex; align-items: center; }',
      '  .box .pin { align-self: flex-start; }  /* 单独贴顶 */',
      '',
      '【baseline 对齐的基线计算规则】',
      '  - 浏览器取项目内最后一行文字的基线作为项目基线',
      '  - 多行文字时取第一行（inline-block 行为）或 margin-box',
      '  - 项目内有图片/inline-block 时，基线是其底部',
      '  - 不同字号项目 baseline 对齐：让所有字号 x 底部在同一水平线',
      '',
      '  注意：项目内若用 inline-block 元素或 float，可能让基线计算异常',
      '',
      '【stretch 的触发条件】',
      '  stretch 仅当以下条件全部满足才生效：',
      '    1. 项目交叉轴尺寸属性为 auto（如 row 时 height 是 auto）',
      '    2. 项目无固定 margin-top/margin-bottom（row 时）',
      '    3. align-items 不是其他值',
      '  若项目有 height: 50px，stretch 失效，项目按 50px 高显示',
      '',
      '【常见用法：垂直居中（最经典）】',
      '  .center {',
      '    display: flex;',
      '    align-items: center;     /* 垂直居中 */',
      '    justify-content: center; /* 水平居中 */',
      '    height: 100vh;           /* 或指定高度 */',
      '  }',
      '',
      '  ★ Flexbox 之前实现垂直居中需 5+ 种 hack：',
      '    table-cell + vertical-align / absolute + transform / line-height 等',
      '    Flexbox 一行 align-items: center 搞定',
      '',
      '【实战：按钮内图标+文字垂直居中】',
      '  .btn {',
      '    display: inline-flex;',
      '    align-items: center;     /* 图标和文字垂直居中 */',
      '    gap: 6px;',
      '  }',
      '  <button class="btn">',
      '    <svg>...</svg>',
      '    <span>保存</span>',
      '  </button>',
      '',
      '【实战：表单 label + input 对齐】',
      '  .form-row {',
      '    display: flex;',
      '    align-items: baseline;   /* label 与 input 文字基线对齐 */',
      '  }',
      '  .form-row label { width: 80px; }',
      '  .form-row input { flex: 1; }',
      '',
      '【实战：列表项对齐方式】',
      '  .list-item {',
      '    display: flex;',
      '    align-items: flex-start; /* 顶部对齐 */',
      '    gap: 12px;',
      '  }',
      '  .avatar { width: 40px; height: 40px; }',
      '  .content { flex: 1; }',
      '',
      '【align-items vs justify-content】',
      '  justify-content: 主轴方向对齐',
      '  align-items: 交叉轴方向对齐',
      '  两者配合可实现任意位置的对齐',
      '',
      '【浏览器支持】',
      '  align-items/align-self 5 种取值：全主流浏览器支持',
      '  baseline 在 IE 11 有 bug（对 inline-block 子元素失效）',
      '',
      '【调试技巧】',
      '  Chrome DevTools → 选中 flex 容器 → 出现 align-items 图标',
      '  可切换 5 种值实时预览，并对单个项目用 align-self 覆盖',
    ].join('\n');
    this.setState({ alignItemsInfo: info });
    this._addLog('css', `align-items/align-self 演示完成`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. align-items / align-self —— 交叉轴对齐',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['align-items', f.flex]]),
        h(Tag, { color: 'primary' }, '交叉轴对齐'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'align-items 控制所有项目在交叉轴的对齐：stretch(默认)/flex-start/flex-end/center/baseline。align-self 单个项目覆盖。stretch 仅项目无固定交叉轴尺寸时生效；baseline 让所有项目文字基线对齐。Flexbox 实现垂直居中：align-items:center + justify-content:center 两行搞定，替代旧 5+ 种 hack。',
        ),
        h('div', { class: 'fl-demo' },
          h('div', { class: 'fl-ai-row', style: 'align-items: flex-start' },
            h('span', { class: 'tall' }, 'A'), h('span', {}, 'B'), h('span', { class: 'short' }, 'C')),
          h('div', { class: 'fl-ai-row', style: 'align-items: center' },
            h('span', { class: 'tall' }, 'A'), h('span', {}, 'B'), h('span', { class: 'short' }, 'C')),
          h('div', { class: 'fl-ai-row', style: 'align-items: baseline' },
            h('span', { class: 'tall' }, 'A'), h('span', {}, 'B'), h('span', { class: 'short' }, 'C')),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 align-items 演示', { type: 'primary', size: 'sm', onClick: () => this._runAlignItemsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.alignItemsInfo || '（点击按钮查看 align-items/align-self 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：flex-wrap / align-content / gap =====================

  _runFlexWrapAlignContentDemo(): void {
    const f = this._flags();
    this._injectStyle('fl-wrap-demo', `
      .fl-wrap-box {
        display: flex;
        flex-wrap: wrap;
        height: 120px;
        background: #e0e7ff;
        padding: 6px;
        border-radius: 4px;
        gap: 6px;
        margin-bottom: 8px;
        align-content: space-between;
      }
      .fl-wrap-box > span {
        background: #3b82f6;
        color: #fff;
        padding: 6px 10px;
        border-radius: 3px;
        font-size: 11px;
        flex: 0 0 80px;
      }
    `);
    const info = [
      '===== flex-wrap / align-content / gap —— 多行与间距 =====',
      '',
      '【flex-wrap：是否换行】',
      '  flex-wrap: nowrap(默认) | wrap | wrap-reverse',
      '',
      '  nowrap: 不换行，项目挤压到一行（可能溢出容器）',
      '    shrink 默认为 1，会按比例收缩',
      '    ┌──────────────────┐',
      '    │[■][■][■][■][■][■]│  ← 全挤在一行',
      '    └──────────────────┘',
      '',
      '  wrap: 换行，溢出时从下一行开始',
      '    ┌──────────────────┐',
      '    │[■][■][■][■]      │',
      '    │[■][■]            │',
      '    └──────────────────┘',
      '',
      '  wrap-reverse: 换行方向反转（从下往上排）',
      '    ┌──────────────────┐',
      '    │[■][■]            │  ← 第二行在上',
      '    │[■][■][■][■]      │  ← 第一行在下',
      '    └──────────────────┘',
      '',
      '【单行 vs 多行 flex 的行为差异】',
      '  - 单行（nowrap）：项目被挤压/拉伸，align-content 无效',
      '  - 多行（wrap）：每行独立计算 grow/shrink，行间距由 align-content 控制',
      '',
      '  ★ align-content 仅在 flex-wrap: wrap/wrap-reverse 时有效',
      '  ★ nowrap 时 align-content 不生效，需用 align-items',
      '',
      '【align-content：多行在交叉轴的对齐（仅多行有效）】',
      '  align-content: stretch(默认) | flex-start | flex-end | center',
      '               | space-between | space-around | space-evenly',
      '',
      '  7 种取值与 justify-content 同义，只是作用于行的整体布局：',
      '    flex-start: 所有行紧贴顶部',
      '    center: 所有行居中',
      '    space-between: 首尾行贴边，中间行均匀分布',
      '    space-evenly: 行间距与首尾间距全相等',
      '',
      '  示例（容器高 120px，3 行项目各 30px 高）：',
      '    space-between:',
      '    [行1]              ← 顶部',
      '    [行2]              ← 中间',
      '    [行3]              ← 底部',
      '',
      '    space-evenly:',
      '       [行1]            ← 15px 顶隙',
      '           [行2]        ← 15px 行隙',
      '               [行3]    ← 15px 底隙',
      '',
      '【align-content vs align-items 区别】',
      '  align-items: 单行内项目的交叉轴对齐',
      '  align-content: 多行整体的交叉轴对齐（行与行之间）',
      '',
      '  ┌──────────────────────┐',
      '  │  [■] [■] [■]         │ ← align-items 控制这一行内项目对齐',
      '  │                      │',
      '  │  [■] [■] [■]         │ ← align-items 控制这一行内项目对齐',
      '  │                      │ ← align-content 控制两行之间的间距',
      '  └──────────────────────┘',
      '',
      '  ★ 单行时 align-content 失效，用 align-items',
      '  ★ 多行时 align-content 控制行间距，align-items 控制每行内项目对齐',
      '',
      '【gap / row-gap / column-gap —— 项目间距（替代 margin）】',
      '  .box {',
      '    display: flex;',
      '    gap: 16px;             /* 行列间距都是 16px */',
      '    row-gap: 16px;         /* 仅行间距（多行时）*/',
      '    column-gap: 16px;      /* 仅列间距 */',
      '  }',
      '',
      '  注：flex 中 gap 对应主轴方向（row 时是水平，column 时是垂直）',
      '      row-gap 是交叉轴方向，column-gap 是主轴方向',
      '      （与 Grid 中行列含义相同，但 flex 主轴可能旋转）',
      '',
      '【gap 替代 margin 的优势】',
      '  1. 不需要 :first-child / :last-child 重置边距',
      '     旧方案：.item { margin-right: 8px; } .item:last-child { margin-right: 0; }',
      '     新方案：.box { gap: 8px; }',
      '',
      '  2. 自动响应换行：wrap 时每行首尾无多余边距',
      '     旧方案 margin 在换行后会出现行首多余边距',
      '',
      '  3. 滚动容器无边缘碰撞',
      '     scroll-snap + gap 比 margin 更可控',
      '',
      '  4. CSS 计算属性 calc 可用：gap: calc(var(--space) * 2)',
      '',
      '【完整代码示例：响应式卡片网格】',
      '  <style>',
      '    .cards {',
      '      display: flex;',
      '      flex-wrap: wrap;            /* 允许换行 */',
      '      gap: 16px;                  /* 替代 margin */',
      '      align-content: flex-start;  /* 行紧贴顶部 */',
      '    }',
      '    .card {',
      '      flex: 1 1 200px;            /* 基础宽 200px，可伸缩 */',
      '      min-width: 0;               /* 允许收缩（见 Card 8）*/',
      '    }',
      '  </style>',
      '  <div class="cards">',
      '    <div class="card">1</div>',
      '    <div class="card">2</div>',
      '    <div class="card">3</div>',
      '    <div class="card">4</div>',
      '  </div>',
      '  /* 自动响应：宽屏 4 列 → 中屏 2 列 → 窄屏 1 列，无需 media query */',
      '',
      '【浏览器支持】',
      `  gap: ${f.gap ? '✓' : '✗'} (Chrome 84+/Firefox 63+/Safari 14.1+)`,
      `  row-gap: ${f.rowGap ? '✓' : '✗'}`,
      '  flex-wrap / align-content 5 种基础取值：全主流支持',
      `  align-content: space-evenly: ${f.alignContentSpaceEvenly ? '✓' : '✗'}`,
      '',
      '【降级方案：旧浏览器无 gap 时用 margin + 选择器】',
      '  .box { display: flex; flex-wrap: wrap; margin: -8px; }',
      '  .item { margin: 8px; }',
      '  /* 负 margin 抵消首尾边距，所有项目等距 */',
      '',
      '【调试技巧】',
      '  Chrome DevTools → 选中 flex 容器 → Layout 面板',
      '  → 可看到 gap 的可视化（绿色高亮间距）',
      '  → align-content 切换图标实时预览 7 种值',
    ].join('\n');
    this.setState({ flexWrapAlignContentInfo: info });
    this._addLog('css', `flex-wrap/align-content/gap 演示完成；supports gap=${f.gap}/row-gap=${f.rowGap}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. flex-wrap / align-content / gap —— 多行与间距',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['gap', f.gap],
          ['row-gap', f.rowGap],
          ['align-content:space-evenly', f.alignContentSpaceEvenly],
        ]),
        h(Tag, { color: 'primary' }, '多行布局'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'flex-wrap: nowrap(默认)/wrap/wrap-reverse 控制换行。多行时 align-content 控制行间距（7 种取值，仅多行有效）；align-items 控制单行内项目对齐。gap/row-gap/column-gap 替代 margin 实现项目间距（Chrome 84+），优势：无需 :first-child 重置、自动响应换行、CSS calc 可用。响应式卡片网格：flex: 1 1 200px + flex-wrap + gap 自动适应列数，无需 media query。',
        ),
        h('div', { class: 'fl-demo' },
          h('div', { class: 'fl-wrap-box' },
            h('span', {}, '1'), h('span', {}, '2'), h('span', {}, '3'),
            h('span', {}, '4'), h('span', {}, '5'), h('span', {}, '6')),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行多行+gap 演示', { type: 'primary', size: 'sm', onClick: () => this._runFlexWrapAlignContentDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.flexWrapAlignContentInfo || '（点击按钮查看 flex-wrap/align-content/gap 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：order 与可访问性 =====================

  _runOrderDemo(): void {
    const f = this._flags();
    this._injectStyle('fl-order-demo', `
      .fl-order-box {
        display: flex;
        background: #e0e7ff;
        padding: 6px;
        border-radius: 4px;
        gap: 4px;
      }
      .fl-order-box > span {
        background: #3b82f6;
        color: #fff;
        padding: 6px 12px;
        border-radius: 3px;
        font-size: 12px;
      }
      .fl-order-box .o-first { order: -1; background: #ef4444; }
      .fl-order-box .o-last  { order: 99; background: #10b981; }
    `);
    const info = [
      '===== order 与可访问性 —— 视觉顺序 vs DOM 顺序 =====',
      '',
      '【order：视觉顺序】',
      '  order: <integer>;     // 默认 0，可为负数',
      '',
      '  - 同 order 值的项目按 DOM 顺序排列',
      '  - order 小的排前面（含负数）',
      '  - order 大的排后面',
      '',
      '【示例：让某个项目排第一】',
      '  .box { display: flex; }',
      '  .pin-first { order: -1; }   /* 排到所有默认 0 项目之前 */',
      '',
      '  <div class="box">',
      '    <div>A</div>',
      '    <div class="pin-first">B（视觉第一）</div>',
      '    <div>C</div>',
      '  </div>',
      '  /* DOM 顺序：A B C，视觉顺序：B A C */',
      '',
      '【响应式重排实战：移动端先显示主内容】',
      '  <style>',
      '    .layout { display: flex; flex-direction: column; }',
      '    .sidebar { order: 2; }    /* 桌面端在左 */',
      '    .main    { order: 1; }    /* 桌面端在右 */',
      '',
      '    @media (max-width: 768px) {',
      '      /* 移动端：主内容先显示，侧边栏在下方 */',
      '      .sidebar { order: 2; }',
      '      .main    { order: 1; }',
      '    }',
      '  </style>',
      '',
      '  /* 桌面端 DOM 顺序 sidebar main 但视觉 main 在右 */',
      '  /* 移动端希望 main 在上 sidebar 在下 */',
      '  /* 用 order 重排即可，无需改 DOM 结构 */',
      '',
      '【关键陷阱：order 改视觉不改 DOM 顺序】',
      '  ★ Tab 键焦点顺序仍按 DOM 顺序，不按 order',
      '  ★ 屏幕阅读器（screen reader）朗读顺序按 DOM，不按 order',
      '  ★ 这会造成视觉顺序与可访问性顺序不一致',
      '',
      '  问题示例：',
      '    <button style="order: 2">1</button>',
      '    <button style="order: 1">2</button>',
      '    视觉：[2] [1]',
      '    Tab：先聚焦 1，再聚焦 2（按 DOM 顺序）',
      '    用户看到 2 在前，按 Tab 却先聚焦后面的 1，体验混乱',
      '',
      '【WCAG 规范要求】',
      '  WCAG 2.1 SC 1.3.2 「有意义的顺序」要求：',
      '    DOM 顺序应与视觉呈现顺序一致，',
      '    让辅助技术能正确理解内容流。',
      '',
      '  使用 order 重排会破坏此原则，可能影响可达性。',
      '',
      '【推荐做法：用 DOM 顺序而非 order】',
      '  ★ 优先调整 DOM 顺序，让结构与视觉一致',
      '  ★ order 仅用于「视觉装饰性重排」（不影响语义流的情况）',
      '  ★ 如：图片轮播箭头位置、装饰性图标位置',
      '',
      '  反例：表单字段、按钮组、导航链接不要用 order 重排',
      '  正例：媒体对象（图在文左/右切换）可用 order',
      '',
      '【order 与 flex-direction 的交互】',
      '  flex-direction: row-reverse + order: 1',
      '    先按 row-reverse 翻转主轴方向，再按 order 排序',
      '    容易产生混乱，建议二选一',
      '',
      '【order 与 accessibility tree】',
      '  - 浏览器构建 accessibility tree 时仍按 DOM 顺序',
      '  - aria-flowto / tabindex 可显式指定顺序（但兼容性差）',
      '  - 最佳实践：DOM 顺序就是想要的可访问性顺序',
      '',
      '【完整代码：响应式媒体对象（图在左/右切换）】',
      '  <style>',
      '    .media {',
      '      display: flex;',
      '      gap: 12px;',
      '      align-items: flex-start;',
      '    }',
      '    .media.flipped .media__img { order: 2; }',
      '    .media.flipped .media__body { order: 1; }',
      '    .media__img { width: 80px; height: 80px; }',
      '    .media__body { flex: 1; }',
      '  </style>',
      '',
      '  <div class="media">',
      '    <img class="media__img" src="..." alt="头像">',
      '    <div class="media__body">文字内容</div>',
      '  </div>',
      '',
      '  <div class="media flipped">',
      '    <img class="media__img" src="..." alt="头像">',
      '    <div class="media__body">文字内容（图在右）</div>',
      '  </div>',
      '  /* 图片与正文都是独立内容流，order 重排不影响语义 */',
      '',
      '【浏览器支持】',
      `  order: ${f.order ? '✓' : '✗'} (全主流浏览器支持)`,
      '  IE 11 支持 order 但与新版规范有差异',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → 选中项目 → Computed 面板',
      '  → 查看最终 order 值',
      '  → Accessibility 面板可看到 DOM 顺序与视觉顺序的对比',
    ].join('\n');
    this.setState({ orderInfo: info });
    this._addLog('css', `order 演示完成；supports=${f.order}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. order 与可访问性 —— 视觉顺序 vs DOM 顺序',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['order', f.order]]),
        h(Tag, { color: 'warning' }, '可访问性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'order: <integer>（默认 0，可为负数）改变项目视觉顺序，但 Tab 焦点顺序和屏幕阅读器朗读仍按 DOM 顺序，造成视觉与可访问性不一致（违反 WCAG 2.1 SC 1.3.2）。推荐用 DOM 顺序而非 order 实现布局；order 仅用于装饰性重排（如媒体对象图片左右切换）。响应式重排也尽量用 DOM + media query 切换而非纯 order。',
        ),
        h('div', { class: 'fl-demo' },
          h('div', { class: 'fl-order-box' },
            h('span', {}, 'A'),
            h('span', { class: 'o-last' }, 'B order:99'),
            h('span', { class: 'o-first' }, 'C order:-1')),
          h('div', { class: 'fs-xs text-secondary mt-xs' }, 'DOM: A B C → 视觉: C A B'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 order 演示', { type: 'primary', size: 'sm', onClick: () => this._runOrderDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.orderInfo || '（点击按钮查看 order 与可访问性完整解析）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：常见布局模式实战 =====================

  _runPatternsDemo(): void {
    const f = this._flags();
    const info = [
      '===== Flexbox 常见布局模式实战 =====',
      '',
      '【模式 1：居中布局（最经典）】',
      '  .center {',
      '    display: flex;',
      '    justify-content: center;   /* 主轴居中 */',
      '    align-items: center;       /* 交叉轴居中 */',
      '    height: 100vh;             /* 或指定高度 */',
      '  }',
      '',
      '  <div class="center">',
      '    <div>内容垂直水平居中</div>',
      '  </div>',
      '',
      '  /* 也可用 margin: auto 自动分配剩余空间 */',
      '  .center > * { margin: auto; }',
      '',
      '【模式 2：顶栏布局（logo 左 + 菜单右）】',
      '  .header {',
      '    display: flex;',
      '    justify-content: space-between;  /* 两端对齐 */',
      '    align-items: center;             /* 垂直居中 */',
      '    padding: 8px 16px;',
      '  }',
      '  .menu { display: flex; gap: 12px; }',
      '',
      '  <header class="header">',
      '    <div class="logo">Logo</div>',
      '    <nav class="menu"><a>首页</a><a>产品</a></nav>',
      '  </header>',
      '',
      '【模式 3：等高三栏（两侧固定 + 中间自适应）】',
      '  .layout {',
      '    display: flex;',
      '    min-height: 100vh;',
      '  }',
      '  .sidebar-left  { flex: 0 0 200px; }   /* 不变不缩，固定 200px */',
      '  .main          { flex: 1; }            /* 占据剩余空间 */',
      '  .sidebar-right { flex: 0 0 240px; }',
      '',
      '  /* 三栏自动等高（flex 默认 stretch）*/',
      '  /* 中间内容多长，两侧边栏自动撑高 */',
      '',
      '【模式 4：响应式卡片网格】',
      '  .cards {',
      '    display: flex;',
      '    flex-wrap: wrap;             /* 允许换行 */',
      '    gap: 16px;                   /* 替代 margin */',
      '  }',
      '  .card {',
      '    flex: 1 1 200px;             /* 基础 200px，可伸缩 */',
      '    min-width: 0;                /* 允许收缩（见 Card 8）*/',
      '  }',
      '',
      '  /* 自动响应：宽屏 4 列 → 中屏 2 列 → 窄屏 1 列 */',
      '  /* 无需 media query，flex 算法自动处理 */',
      '',
      '【模式 5：粘性页脚（Sticky Footer）】',
      '  /* 方案 A：flex column + main flex:1 */',
      '  body {',
      '    display: flex;',
      '    flex-direction: column;',
      '    min-height: 100vh;           /* 至少一屏高 */',
      '    margin: 0;',
      '  }',
      '  .header { flex: none; }        /* 不变不缩 */',
      '  .main   { flex: 1; }            /* 占据剩余空间 */',
      '  .footer { flex: none; }        /* 不变不缩，被推到底 */',
      '',
      '  /* 内容少时 footer 自动贴底；内容多时 footer 跟随滚动 */',
      '',
      '  /* 方案 B：margin-top: auto（仅 footer 单独）*/',
      '  body { min-height: 100vh; margin: 0; }',
      '  .footer { margin-top: auto; }',
      '',
      '【模式 6：媒体对象（图 + 文）】',
      '  .media {',
      '    display: flex;',
      '    gap: 12px;',
      '    align-items: flex-start;     /* 顶部对齐 */',
      '  }',
      '  .media__img {',
      '    flex: none;                  /* 图片不伸缩 */',
      '    width: 80px;',
      '    height: 80px;',
      '  }',
      '  .media__body {',
      '    flex: 1;                     /* 文字占剩余 */',
      '    min-width: 0;                /* 允许文字收缩（见 Card 8）*/',
      '  }',
      '',
      '  <div class="media">',
      '    <img class="media__img" src="..." alt="头像">',
      '    <div class="media__body">文字内容...</div>',
      '  </div>',
      '',
      '【模式 7：输入框组（input flex:1 + button 固定）】',
      '  .input-group {',
      '    display: flex;',
      '    gap: 8px;',
      '  }',
      '  .input-group input {',
      '    flex: 1;                     /* 占据剩余空间 */',
      '    min-width: 0;                /* 允许收缩（见 Card 8）*/',
      '  }',
      '  .input-group button {',
      '    flex: none;                  /* 按钮固定宽度 */',
      '  }',
      '',
      '  <div class="input-group">',
      '    <input type="text" placeholder="搜索...">',
      '    <button>搜索</button>',
      '  </div>',
      '',
      '【模式 8：垂直等距导航（flex column + space-between）】',
      '  .sidebar {',
      '    display: flex;',
      '    flex-direction: column;',
      '    justify-content: space-between;',
      '    height: 100vh;',
      '  }',
      '  <aside class="sidebar">',
      '    <div class="top">...</div>',
      '    <div class="bottom">...</div>',
      '  </aside>',
      '',
      '【模式 9：按钮组（一行排列 + gap）】',
      '  .btn-group {',
      '    display: inline-flex;        /* 行内级，宽度由内容决定 */',
      '    gap: 4px;',
      '  }',
      '  .btn-group button {',
      '    border-radius: 0;            /* 去圆角让按钮贴在一起 */',
      '  }',
      '  .btn-group button:first-child { border-radius: 4px 0 0 4px; }',
      '  .btn-group button:last-child  { border-radius: 0 4px 4px 0; }',
      '',
      '【模式 10：分页器（居中 + gap）】',
      '  .pagination {',
      '    display: flex;',
      '    justify-content: center;',
      '    align-items: center;',
      '    gap: 4px;',
      '  }',
      '',
      '【模式 11：响应式重排（DOM 不变，flex-direction 切换）】',
      '  .layout {',
      '    display: flex;',
      '    flex-direction: column;      /* 移动端纵向 */',
      '  }',
      '  @media (min-width: 768px) {',
      '    .layout { flex-direction: row; } /* 桌面端横向 */',
      '  }',
      '  .sidebar { flex: 0 0 240px; }',
      '  .main    { flex: 1; }',
      '',
      '  /* DOM 顺序保持 sidebar → main，方向切换即可 */',
      '',
      '【模式 12：底部固定操作栏（Actions Bar）】',
      '  .actions-bar {',
      '    display: flex;',
      '    justify-content: flex-end;   /* 默认靠右 */',
      '    gap: 8px;',
      '    padding: 12px;',
      '    border-top: 1px solid #ddd;',
      '  }',
      '  /* 用 margin-left:auto 让某个按钮靠左 */',
      '  .actions-bar .left { margin-left: 0; margin-right: auto; }',
      '',
      '【模式 13：聊天界面（左右气泡）】',
      '  .message {',
      '    display: flex;',
      '    margin-bottom: 8px;',
      '  }',
      '  .message.self { justify-content: flex-end; }     /* 自己靠右 */',
      '  .message.other { justify-content: flex-start; }  /* 他人靠左 */',
      '  .bubble { max-width: 70%; padding: 8px 12px; border-radius: 12px; }',
      '',
      '【模式 14：表单 label-input 一行】',
      '  .form-row {',
      '    display: flex;',
      '    align-items: center;',
      '    gap: 12px;',
      '    margin-bottom: 12px;',
      '  }',
      '  .form-row label { flex: 0 0 100px; text-align: right; }',
      '  .form-row input { flex: 1; min-width: 0; }',
      '',
      '【模式 15：标签云（wrap + gap）】',
      '  .tag-cloud {',
      '    display: flex;',
      '    flex-wrap: wrap;',
      '    gap: 8px;',
      '  }',
      '  .tag { padding: 4px 10px; background: #e0e7ff; }',
      '',
      '【实战决策树：何时用 Flexbox vs Grid】',
      '  内容优先（一维方向自适应）→ Flexbox',
      '    ✓ 导航栏、按钮组、表单行、媒体对象、卡片网格（响应式）',
      '  布局优先（二维网格精确控制）→ Grid',
      '    ✓ 整页布局、复杂表格、固定行列模板',
      '',
      '  组合用法：',
      '    页面整体用 Grid，局部组件用 Flexbox',
      '    .page { display: grid; grid-template: "header header" "side main" / 240px 1fr; }',
      '    .header { display: flex; justify-content: space-between; }',
      '',
      '【浏览器支持】',
      `  display: flex: ${f.flex ? '✓' : '✗'}`,
      `  gap: ${f.gap ? '✓' : '✗'} (Chrome 84+)`,
      '  所有布局模式所需属性全主流浏览器支持',
    ].join('\n');
    this.setState({ patternsInfo: info });
    this._addLog('css', '常见布局模式实战演示完成');
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 常见布局模式实战（居中/顶栏/三栏/网格/页脚/媒体对象/输入组）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['flex', f.flex],
          ['gap', f.gap],
        ]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '15 种经典布局模式完整代码：垂直水平居中（justify+align center）、顶栏（space-between）、等高三栏（两侧固定+中间 flex:1）、响应式卡片网格（flex:1 1 200px + wrap + gap 无需 media query）、粘性页脚（min-height:100vh + column + main flex:1）、媒体对象、输入框组、垂直等距导航、按钮组、分页器、响应式重排、底部操作栏、聊天气泡、表单行、标签云。Flexbox 适合内容优先的一维布局，整页布局用 Grid。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行布局模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternsInfo || '（点击按钮查看 15 种布局模式完整代码）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：调试与陷阱 =====================

  _runTrapsDemo(): void {
    const f = this._flags();
    const info = [
      '===== Flexbox 调试与陷阱 =====',
      '',
      '【陷阱 1：min-width: auto / min-height: auto 陷阱（最常见）】',
      '',
      '  ★ Flex 项目默认 min-width: auto / min-height: auto',
      '  ★ 这意味着项目不会收缩到内容最小尺寸以下',
      '  ★ 长文本/长 URL/图片会让项目撑爆容器',
      '',
      '  问题示例：',
      '    .box { display: flex; width: 300px; }',
      '    .item { flex: 1; }   /* 看似等分 */',
      '    <div class="box">',
      '      <div class="item">短文本</div>',
      '      <div class="item">超长URL超长URL超长URL超长URL超长URL</div>',
      '    </div>',
      '    /* 第二个项目撑爆 300px，flex:1 失效 */',
      '',
      '  原因：',
      '    flex 算法先取 max(flex-basis, min-content) 作为初始尺寸',
      '    min-content 是内容最小不可分割尺寸（如最长单词）',
      '    flex-shrink 无法让项目小于 min-content',
      '',
      '  解决：手动设置 min-width: 0 让项目可收缩到任意尺寸',
      '    .item {',
      '      flex: 1;',
      '      min-width: 0;          /* 关键！让项目可收缩 */',
      '      overflow: hidden;      /* 配合截断 */',
      '      text-overflow: ellipsis;',
      '      white-space: nowrap;',
      '    }',
      '',
      '  ★ column 方向同理：min-height: 0',
      '',
      '【陷阱 2：flex-basis: auto 与 width 同时存在时的优先级】',
      '',
      '  ★ flex-basis 优先于 width（当 flex-basis 不为 auto 时）',
      '  ★ flex-basis: auto 时回退到 width',
      '  ★ flex-basis 和 width 都为 auto 时取 content',
      '',
      '  优先级链：',
      '    flex-basis(非auto) > width > content',
      '',
      '  示例：',
      '    .item {',
      '      width: 100px;',
      '      flex-basis: 200px;   /* 生效，width 被忽略 */',
      '    }',
      '',
      '    .item {',
      '      width: 100px;',
      '      flex-basis: auto;    /* 回退到 width: 100px */',
      '    }',
      '',
      '  ★ 主轴是 column 时：flex-basis 对应 height 而非 width',
      '  ★ IE 11 中 flex-basis 行为与新版规范不同（有 bug）',
      '',
      '【陷阱 3：百分比在 flex 中的计算基准】',
      '',
      '  flex-basis: 50% 是相对什么？',
      '    → 相对 flex 容器的主轴尺寸（content-box，不含 padding/border）',
      '    → 若容器 box-sizing: border-box，仍按 content-box 计算',
      '',
      '  width: 50% 在 flex 项目中：',
      '    → 仅当 flex-basis: auto 时作为初始尺寸',
      '    → 不参与 grow/shrink 分配',
      '',
      '  示例：',
      '    .box { display: flex; width: 400px; padding: 20px; box-sizing: border-box; }',
      '    .item { flex-basis: 50%; }   /* 50% of 360 (content) = 180px，不是 200px */',
      '',
      '  ★ 两个 flex: 1 1 50% 项目不会精确等分（grow 会再分剩余）',
      '  ★ 实现等分用 flex: 1（basis: 0），而非 flex: 1 1 50%',
      '',
      '【陷阱 4：绝对定位的 flex 项目】',
      '',
      '  position: absolute 的 flex 项目：',
      '    - 不参与 flex 布局（不占空间，不参与 grow/shrink）',
      '    - 但仍受 align-items 影响（若未设 align-self）',
      '    - 默认对齐到容器的 padding-box 起点',
      '',
      '  示例：',
      '    .box { display: flex; position: relative; align-items: center; }',
      '    .abs { position: absolute; right: 0; }',
      '    /* .abs 脱离 flex 流，但垂直方向按 align-items: center 居中 */',
      '    /* 水平方向用 right: 0 控制，不受 flex 影响 */',
      '',
      '  ★ 可用此实现「flex 内的绝对定位徽章」',
      '  ★ 类似 position: absolute 子元素继承父 align-items 的特性',
      '',
      '【陷阱 5：flex-grow 不生效的常见原因】',
      '',
      '  1. 容器没有剩余空间（被其他 flex-basis 占满）',
      '     → 检查容器主轴尺寸和其他项目的 basis',
      '',
      '  2. 项目 flex-basis 太大导致溢出（走 shrink 而非 grow）',
      '     → 用 flex: 1 (= 1 1 0%) 让 basis 为 0 强制走 grow',
      '',
      '  3. 项目 min-width: auto 阻止收缩',
      '     → 设 min-width: 0',
      '',
      '  4. 项目被 max-width 限制',
      '     → 检查 max-width 是否过小',
      '',
      '  5. flex-direction 错误（column 时 grow 是垂直方向）',
      '     → 确认主轴方向',
      '',
      '【陷阱 6：align-items: stretch 不生效】',
      '',
      '  stretch 仅当项目交叉轴尺寸为 auto 时生效：',
      '    .item { height: 50px; }   /* ← 此项目不会 stretch */',
      '    .item { height: auto; }   /* ← 此项目会 stretch 到容器高 */',
      '',
      '  其他原因：',
      '    - 项目有 margin-top/bottom',
      '    - 项目内含 inline-block / float 元素',
      '',
      '【陷阱 7：flex 子元素的 z-index】',
      '',
      '  ★ flex 项目默认会创建新的 stacking context',
      '  ★ z-index 在 position: static 时也能生效（与普通元素不同）',
      '  ★ 这可能让 absolute 子元素的层叠异常',
      '',
      '  解决：',
      '    .item { position: relative; z-index: 0; }  /* 显式控制 */',
      '',
      '【陷阱 8：IE 11 的 flexbug 清单（兼容老项目时）】',
      '',
      '  1. flex 简写解析不同：',
      '     IE 11: flex: 1 解析为 1 0 0px（shrink=0）',
      '     规范: flex: 1 解析为 1 1 0%（shrink=1）',
      '     → 显式写 flex: 1 1 0% 避免',
      '',
      '  2. flex-basis 不支持 calc / var：',
      '     → IE 11 不支持，需用固定值',
      '',
      '  3. align-items: baseline 完全失效：',
      '     → 用 flex-start 替代或 padding 微调',
      '',
      '  4. flex 容器的 min-height 失效：',
      '     → 用 height 替代',
      '',
      '  5. 嵌套 flex 容器布局异常：',
      '     → 加 min-width: 0 / min-height: 0',
      '',
      '  6. space-evenly 不支持：',
      '     → 用 margin: auto 或 space-between 降级',
      '',
      '  7. flex 项目内 absolute 子元素位置异常：',
      '     → 加 wrapper 包一层 relative',
      '',
      '  参考：https://github.com/philipwalton/flexbugs',
      '',
      '【陷阱 9：gap 在旧浏览器的降级】',
      '',
      '  Chrome 84- / Firefox 62- / Safari 14- 不支持 gap：',
      '    方案 A：用 margin + 选择器',
      '      .box > * { margin-right: 8px; margin-bottom: 8px; }',
      '      .box > *:nth-child(N) { margin-right: 0; } /* N 是每行项目数 */',
      '',
      '    方案 B：负 margin 容器',
      '      .box { display: flex; flex-wrap: wrap; margin: -4px; }',
      '      .box > * { margin: 4px; }',
      '',
      '    方案 C：postcss-gap-properties 自动降级',
      '',
      '【Chrome DevTools Flexbox 调试】',
      '',
      '  1. Flex 容器可视化：',
      '     Elements → 选中 flex 容器 → 旁边出现 「flex」 徽章',
      '     → 点击徽章切换 align-items / justify-content 实时预览',
      '',
      '  2. Flex 编辑器：',
      '     Styles 面板 → display: flex 旁边出现编辑按钮',
      '     → 可视化编辑 flex-direction / wrap / align / justify',
      '',
      '  3. Flex 项目 sizing 可视化：',
      '     Layout 面板 → Flexbox 章节',
      '     → 每个项目显示 basis / grow(绿) / shrink(红) 颜色标记',
      '     → 可看到剩余空间如何分配',
      '',
      '  4. 调试常见问题：',
      '     - 项目撑爆容器 → 看 min-width 是否为 auto',
      '     - grow 不生效 → 看是否有剩余空间（basis 总和 < 容器）',
      '     - stretch 不生效 → 看项目交叉轴尺寸是否为 auto',
      '',
      '【vs CSS Grid 决策树】',
      '',
      '  ┌──────────────────────┬──────────────────────┬──────────────────────┐',
      '  │ 特性                │ Flexbox              │ Grid                  │',
      '  ├──────────────────────┼──────────────────────┼──────────────────────┤',
      '  │ 维度                │ 一维（行或列）       │ 二维（行+列同时）     │',
      '  │ 适用                │ 内容优先自适应       │ 布局优先精确控制      │',
      '  │ 项目顺序            │ order 重排           │ 显式 grid-area        │',
      '  │ 等高                │ 默认 stretch         │ 需 align-items:stretch│',
      '  │ 间距                │ gap                  │ gap                   │',
      '  │ 适合组件            │ 导航栏/按钮组/卡片行 │ 整页布局/复杂表格     │',
      '  │ 浏览器支持          │ 全主流（IE 11 部分） │ IE 11 部分/新版全面   │',
      '  └──────────────────────┴──────────────────────┴──────────────────────┘',
      '',
      '  决策原则：',
      '    - 内容驱动 + 一维方向 → Flexbox',
      '    - 布局驱动 + 二维网格 → Grid',
      '    - 不确定 → 两者混用（Grid 做整体，Flexbox 做局部）',
      '',
      '【资源】',
      '  - 规范：https://www.w3.org/TR/css-flexbox-1/',
      '  - MDN: https://developer.mozilla.org/docs/Web/CSS/CSS_flexible_box_layout',
      '  - 完整指南：https://css-tricks.com/snippets/css/a-guide-to-flexbox/',
      '  - flexbug 清单：https://github.com/philipwalton/flexbugs',
    ].join('\n');
    this.setState({ trapsInfo: info });
    this._addLog('css', 'Flexbox 调试与陷阱演示完成');
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. Flexbox 调试与陷阱（min-width/IE11/DevTools/vs Grid）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['flex', f.flex],
          ['flex-basis:content', f.flexBasisContent],
        ]),
        h(Tag, { color: 'warning' }, '陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '核心陷阱：min-width/min-height: auto（默认不收缩到内容以下，需手动设 0）；flex-basis 优先于 width；百分比相对容器 content-box；绝对定位项目不参与 flex 但受 align-items 影响；IE 11 有诸多 flexbug 需显式写 flex: 1 1 0%。Chrome DevTools 提供 Flex 编辑器、align-items 切换徽章、项目 sizing 可视化（grow=绿/shrink=红）。vs Grid：内容驱动一维用 Flexbox，布局驱动二维用 Grid。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行调试与陷阱演示', { type: 'primary', size: 'sm', onClick: () => this._runTrapsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.trapsInfo || '（点击按钮查看 Flexbox 调试与陷阱完整解析）')),
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
      h('h2', { class: 'section-title' }, 'CSS Flexbox 深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Flexible Box Layout Module Level 1 —— 一维自适应布局基石',
        description: '演示 CSS Flexbox 全套能力：display flex/inline-flex + flex-direction（容器与项目概念）、flex-basis/grow/shrink 三件套（核心分配算法）、justify-content 主轴 6 种对齐、align-items/align-self 交叉轴 5 种对齐、flex-wrap/align-content/gap 多行与间距、order 与可访问性陷阱、15 种常见布局模式实战（居中/顶栏/三栏/网格/页脚/媒体对象/输入组）、调试与陷阱（min-width:auto/IE11 flexbug/DevTools/vs Grid）。全主流浏览器支持多年，是替代 float/table 的一维布局首选。用 CSS.supports() 检测，jsdom 不做真实布局但流程完整。',
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
