// =====================================================================
// CSSCounterStylesPage.js —— CSS Counter Styles @counter-style 完整实验室
// 演示 W3C CSS Counter Styles Level 3 自定义列表序号样式：
//   1. 概述与动机：内置列表序号样式局限（disc/circle/square/decimal/
//      lower-roman/upper-roman 等）/ 自定义符号集需求（中文天干地支、
//      阿拉伯-印度数字、希腊字母）/ CSS Counter Styles Level 3 标准 /
//      浏览器支持 Chrome 91+ / Firefox 33+ / Safari 17+ 全部稳定
//   2. @counter-style 语法：@counter-style name { system: ...;
//      symbols: ...; prefix/suffix: ...; range: ...; } / 系统类型 /
//      符号定义 / 描述符全集
//   3. system 描述符全集：cyclic / symbolic / additive / fixed / numeric /
//      alphabetic / system: extends name / 算法详解 / 不同 system 表现差异 /
//      fallback 兜底
//   4. symbols 与 additive-symbols：symbols: "甲" "乙" "丙" / 多字符符号 /
//      additive-symbols 用于罗马数字 / 符号数量限制 / Unicode 符号集
//   5. prefix/suffix/range/pad/fallback：prefix: "(" suffix: ") " /
//      range: 1 99 / pad: 3 "0" / fallback: decimal / 负数 negative: "(" ")"
//      / 自定义完整序号格式
//   6. speak-as 与无障碍：speak-as: auto/bullets/numbers/words/spell-out/
//      <<counter-style>> / 屏幕阅读器朗读 / 数字与符号区分 /
//      与 @counter-style 名称互引用
//   7. 实战：中文天干地支与节气：天干（甲乙丙丁戊己庚辛壬癸）/ 地支
//      （子丑寅卯辰巳午未申酉戌亥）/ 二十四节气 / 农历日期 /
//      阿拉伯-印度数字 / 希腊字母 αβγ
//   8. 实战与陷阱：list-style: custom-name / counter-set/counter-reset/
//      counter-increment / 多级目录章节号（1.1.1）/ counters() 函数嵌套 /
//      fallback 处理超范围 / DevTools 调试
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；@counter-style 在 jsdom 通常识别为合法语法
//       但 CSSCounterStyleRule 可能未定义，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSCounterStylesPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  overviewInfo: string;
  syntaxInfo: string;
  systemInfo: string;
  symbolsInfo: string;
  descriptorsInfo: string;
  speakAsInfo: string;
  cjkCustomInfo: string;
  pitfallsInfo: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSCounterStylesPage extends Page {
  declare state: CSSCounterStylesPageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];
  _counterStyleInjected: boolean = false;
  _currentSystem: string = '';


  // —— 初始 state ——
  initialState(): CSSCounterStylesPageState {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',          // Card 1：概述与动机
      syntaxInfo: '',            // Card 2：@counter-style 语法
      systemInfo: '',            // Card 3：system 描述符全集
      symbolsInfo: '',           // Card 4：symbols 与 additive-symbols
      descriptorsInfo: '',       // Card 5：prefix/suffix/range/pad/fallback
      speakAsInfo: '',           // Card 6：speak-as 与无障碍
      cjkCustomInfo: '',         // Card 7：实战：中文天干地支与节气
      pitfallsInfo: '',          // Card 8：实战与陷阱
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];                // 动态创建并插入 head 的 <style> 元素列表
    this._counterStyleInjected = false;      // Card 7 自定义 @counter-style 是否已注入
    this._currentSystem = 'cyclic';          // Card 3 当前 system 演示值

    // 一次性能力检测：CSS Counter Styles 全家桶
    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`,
      `supports ${c(f.supports)}`,
      `@counter-style ${c(f.counterStyleAtRule)}`,
      `CSSCounterStyleRule ${c(f.counterStyleRule)}`,
      `list-style-type:"*" ${c(f.listStyleTypeCustom)}`,
      `counter-reset ${c(f.counterReset)}`,
      `counter-set ${c(f.counterSet)}`,
      `counter-increment ${c(f.counterIncrement)}`,
    ];

    const summary = f.css
      ? `CSS Counter Styles Level 3 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；@counter-style at-rule 现代浏览器支持完整（Chrome 91+ / Firefox 33+ / Safari 17+）。CSSCounterStyleRule 接口在 jsdom 可能未定义，统一兜底。按钮点击注入自定义 @counter-style + 完整代码示例，真实浏览器可查看天干地支/希腊字母等自定义序号。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.counterStyleAtRule) this._addLog('warn', '@counter-style at-rule 不可用或 jsdom 未识别（Chrome 91+ / Firefox 33+ / Safari 17+ 全部稳定）');
    if (!f.counterStyleRule) this._addLog('warn', 'CSSCounterStyleRule 接口未定义（jsdom 通常不实现，现代浏览器全支持）');
    if (!f.counterSet) this._addLog('warn', 'counter-set 不可用或 jsdom 未识别（Chrome 85+ / Firefox 68+ / Safari 17.4+）');

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

  _btn(label: string, opts: BtnOpts): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(): any;
  _caps(items: [string, boolean][]): Node[];
  _caps(items?: [string, boolean][]): any {
    return items!.map(([label, ok]: [string, boolean]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  // 用 safe 包裹：jsdom 不可用时返回 false，绝不抛异常
  _flags(): any {
    const safe = (fn: () => boolean): boolean => { try { return fn(); } catch { return false; } };
    const hasCSS = safe(() => typeof CSS !== 'undefined');
    const supportsPV = (p: string, v: string) => safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v));
    const supportsDecl = (decl: string) => safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(decl));
    return {
      css: hasCSS,
      supports: safe(() => hasCSS && typeof CSS.supports === 'function'),
      counterStyleAtRule: supportsDecl('@counter-style custom { system: cyclic; symbols: "A"; }'),
      counterStyleRule: safe(() => typeof CSSCounterStyleRule !== 'undefined'),
      listStyleTypeCustom: supportsPV('list-style-type', '"*"'),
      counterReset: supportsPV('counter-reset', 'item 0'),
      counterSet: supportsPV('counter-set', 'item 5'),
      counterIncrement: supportsPV('counter-increment', 'item'),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id: string, textContent: string): HTMLStyleElement {
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 一次性注入全部基础演示样式 ——
  _injectBaseStyles(): void {
    this._injectStyle('css-counter-styles-demo', `
      /* ===== 通用 counter 舞台 ===== */
      .counter-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 3：system 演示 ===== */
      .system-stage {
        padding: 12px;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        color: #1e3a8a;
        border-radius: 6px;
      }
      .system-stage ol {
        margin: 8px 0;
        padding-inline-start: 30px;
      }
      .system-stage li {
        margin: 4px 0;
        font-size: 14px;
      }
      /* ===== Card 5：prefix/suffix/range/pad 演示 ===== */
      .descriptors-stage {
        padding: 12px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        color: #78350f;
        border-radius: 6px;
      }
      .descriptors-stage ol {
        margin: 8px 0;
        padding-inline-start: 40px;
      }
      .descriptors-stage li {
        margin: 4px 0;
        font-size: 14px;
      }
      /* ===== Card 7：天干地支演示 ===== */
      .cjk-stage {
        padding: 12px;
        background: #fffbeb;
        border: 2px solid #d97706;
        color: #78350f;
        border-radius: 6px;
      }
      .cjk-stage ol {
        margin: 8px 0;
        padding-inline-start: 40px;
      }
      .cjk-stage li {
        margin: 4px 0;
        font-size: 15px;
      }
      .cjk-stage .grid-cols {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-top: 8px;
      }
      .cjk-stage .grid-cols > div {
        padding: 8px;
        background: #fff;
        border-radius: 4px;
        font-size: 13px;
      }
      /* ===== Card 8：多级目录章节号 ===== */
      .toc-stage {
        padding: 12px;
        background: #dcfce7;
        border: 2px solid #10b981;
        color: #064e3b;
        border-radius: 6px;
      }
      .toc-stage ol {
        margin: 4px 0;
        padding-inline-start: 24px;
      }
      .toc-stage li {
        margin: 2px 0;
        font-size: 14px;
      }
      /* ===== 输出区 ===== */
      .counter-output {
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

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo(): string {
    const f = this._flags();
    try {
      return `===== CSS Counter Styles @counter-style 概述 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  CSS Counter Styles Level 3（W3C Recommendation）\n` +
        `  规范地址：https://www.w3.org/TR/css-counter-styles-3/\n` +
        `\n` +
        `【核心动机】\n` +
        `  内置列表序号样式局限：\n` +
        `    disc / circle / square（无序列表符号）\n` +
        `    decimal / decimal-leading-zero（阿拉伯数字）\n` +
        `    lower-roman / upper-roman（罗马数字 i/ii/iii 或 I/II/III）\n` +
        `    lower-alpha / upper-alpha（拉丁字母 a/b/c 或 A/B/C）\n` +
        `    lower-greek（希腊字母 α/β/γ）\n` +
        `    cjk-decimal / cjk-ideographic（中日韩数字）\n` +
        `  局限：无法自定义符号集（如中文天干地支、阿拉伯-印度数字、自定义 Unicode）\n` +
        `\n` +
        `【@counter-style 解决方案】\n` +
        `  @counter-style name { system: ...; symbols: ...; ... }\n` +
        `  定义自定义序号样式，用 list-style-type: name 引用\n` +
        `  支持任意 Unicode 符号集（中文天干地支、阿拉伯-印度数字、希腊字母等）\n` +
        `\n` +
        `【能力检测】\n` +
        `  CSS.supports('@counter-style custom { system: cyclic; symbols: "A"; }') = ${f.counterStyleAtRule}\n` +
        `  typeof CSSCounterStyleRule = ${f.counterStyleRule ? 'defined' : 'undefined'}\n` +
        `  CSS.supports('list-style-type','"*"') = ${f.listStyleTypeCustom}\n` +
        `  CSS.supports('counter-reset','item 0') = ${f.counterReset}\n` +
        `  CSS.supports('counter-set','item 5') = ${f.counterSet}\n` +
        `  CSS.supports('counter-increment','item') = ${f.counterIncrement}\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  @counter-style at-rule —— Chrome 91+ / Firefox 33+ / Safari 17+ / Edge 91+\n` +
        `    Firefox 最早支持（33+），Chrome 91+ 才支持，Safari 17+ 最新支持\n` +
        `  CSSCounterStyleRule 接口 —— 同上\n` +
        `  counter-set —— Chrome 85+ / Firefox 68+ / Safari 17.4+\n` +
        `  counter-reset / counter-increment —— 全部浏览器支持（CSS2 起就有）\n` +
        `  内置 list-style-type（disc/circle/decimal/roman 等）—— 全部浏览器支持\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  <style>\n` +
        `    /* 自定义天干序号 */\n` +
        `    @counter-style tiangan {\n` +
        `      system: cyclic;            /* 循环使用符号 */\n` +
        `      symbols: "甲" "乙" "丙" "丁" "戊" "己" "庚" "辛" "壬" "癸";\n` +
        `      suffix: "、";              /* 序号后缀 */\n` +
        `    }\n` +
        `    ol.tiangan-list {\n` +
        `      list-style-type: tiangan;  /* 引用自定义样式 */\n` +
        `    }\n` +
        `  </style>\n` +
        `  <ol class="tiangan-list">\n` +
        `    <li>第一项（甲、）</li>\n` +
        `    <li>第二项（乙、）</li>\n` +
        `    <li>第三项（丙、）</li>\n` +
        `  </ol>`;
    } catch (err: any) {
      return `读取概述信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo(): void {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    this._addLog('info', `概述演示：CSS Counter Styles L3，@counter-style=${this._flags().counterStyleAtRule}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— CSS Counter Styles Level 3 @counter-style',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['@counter-style', f.counterStyleAtRule],
          ['CSSCounterStyleRule', f.counterStyleRule],
          ['counter-set', f.counterSet],
        ]),
        h(Tag, { color: 'primary' }, 'Level 3 REC'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Counter Styles Level 3 通过 @counter-style at-rule 让开发者自定义列表序号样式，突破内置样式局限（disc/circle/decimal/roman 等）。支持任意 Unicode 符号集：中文天干地支、阿拉伯-印度数字、希腊字母等。语法：@counter-style name { system; symbols; prefix; suffix; range; ... }，用 list-style-type: name 引用。浏览器支持：Chrome 91+ / Firefox 33+ / Safari 17+（Firefox 最早支持，Safari 最新支持）。counter-reset/counter-increment 全浏览器支持（CSS2），counter-set 较新（Chrome 85+ / Safari 17.4+）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 CSS Counter Styles 全景）')),
        h(Alert, {
          type: 'info',
          message: '@counter-style 让自定义序号样式（天干地支/希腊字母等）成为纯 CSS 实现',
          description: '规范定义于 CSS Counter Styles Level 3（W3C REC）。@counter-style at-rule 定义自定义序号样式，用 list-style-type: name 引用。支持任意 Unicode 符号集。浏览器支持：Chrome 91+ / Firefox 33+ / Safari 17+（Firefox 最早，Safari 最新）。counter-reset/increment 全浏览器支持（CSS2），counter-set 较新。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：@counter-style 语法 ===================

  _readSyntaxInfo(): string {
    const f = this._flags();
    try {
      return `===== @counter-style 语法 =====\n` +
        `\n` +
        `【基本语法】\n` +
        `  @counter-style <name> {\n` +
        `    system: <system>;           /* 必需：算法类型 */\n` +
        `    symbols: <symbols>;         /* 必需（除 system: extends）：符号集 */\n` +
        `    additive-symbols: <values>; /* 仅 additive system 使用 */\n` +
        `    prefix: <symbol>;           /* 可选：序号前缀 */\n` +
        `    suffix: <symbol>;           /* 可选：序号后缀，默认 ". " */\n` +
        `    range: <range>;             /* 可选：适用范围 */\n` +
        `    pad: <length> <symbol>;     /* 可选：补齐长度 */\n` +
        `    negative: <symbol>;         /* 可选：负数符号 */\n` +
        `    fallback: <counter-style>;  /* 可选：兜底样式 */\n` +
        `    speak-as: <speak-as>;       /* 可选：屏幕阅读器朗读方式 */\n` +
        `  }\n` +
        `\n` +
        `【描述符全集】\n` +
        `  1. system       —— 算法类型（cyclic/symbolic/additive/fixed/numeric/alphabetic/extends）\n` +
        `  2. symbols      —— 符号集（字符串或图像）\n` +
        `  3. additive-symbols —— 加法符号集（用于罗马数字等）\n` +
        `  4. prefix       —— 序号前缀（如 "(" ）\n` +
        `  5. suffix       —— 序号后缀（默认 ". "）\n` +
        `  6. range        —— 适用范围（如 1 99）\n` +
        `  7. pad          —— 补齐（如 pad: 3 "0" 补零到 3 位）\n` +
        `  8. negative     —— 负数符号（如 negative: "(" ")"）\n` +
        `  9. fallback     —— 兜底样式（超范围或无法表示时）\n` +
        `  10. speak-as    —— 屏幕阅读器朗读方式\n` +
        `\n` +
        `【name 命名规则】\n` +
        `  必须是合法 CSS 标识符（不含引号、空格、特殊字符）\n` +
        `  不能与内置 counter-style 重名（decimal/disc/roman 等）\n` +
        `  区分大小写（Tiangan ≠ tiangan）\n` +
        `  示例：tiangan / dizhi / greek-alpha / arabic-india\n` +
        `\n` +
        `【引用方式】\n` +
        `  list-style-type: <name>;          /* 列表序号 */\n` +
        `  content: counter(item, <name>);   /* content 中使用 */\n` +
        `  content: counters(item, ".", <name>); /* 嵌套计数器 */\n` +
        `\n` +
        `【能力检测】\n` +
        `  CSS.supports('@counter-style custom { system: cyclic; symbols: "A"; }') = ${f.counterStyleAtRule}\n` +
        `  CSSCounterStyleRule 接口可用 = ${f.counterStyleRule}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 自定义带圆括号的序号 */\n` +
        `  @counter-style paren {\n` +
        `    system: numeric;\n` +
        `    symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9";\n` +
        `    prefix: "(";\n` +
        `    suffix: ") ";\n` +
        `  }\n` +
        `  ol.paren-list { list-style-type: paren; }\n` +
        `\n` +
        `  /* content 中使用 */\n` +
        `  .custom-counter::before {\n` +
        `    counter-increment: item;\n` +
        `    content: counter(item, paren);\n` +
        `  }`;
    } catch (err: any) {
      return `读取 @counter-style 语法信息失败：${err.name} - ${err.message}`;
    }
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. @counter-style 语法 —— name + 描述符全集',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@counter-style', f.counterStyleAtRule]]),
        h(Tag, { color: 'primary' }, 'at-rule 语法'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@counter-style at-rule 语法：@counter-style <name> { system; symbols; additive-symbols; prefix; suffix; range; pad; negative; fallback; speak-as; }。10 个描述符：system（算法类型，必需）、symbols（符号集，必需）、additive-symbols（加法符号，仅 additive system）、prefix/suffix（前后缀，suffix 默认 ". "）、range（适用范围）、pad（补齐）、negative（负数符号）、fallback（兜底样式）、speak-as（无障碍朗读）。name 必须是合法 CSS 标识符，不能与内置样式重名。用 list-style-type: name 或 content: counter(item, name) 引用。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取语法信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ syntaxInfo: this._readSyntaxInfo() }) }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.syntaxInfo || '（点击按钮查看 @counter-style 语法完整说明）')),
        h(Alert, {
          type: 'info',
          message: '@counter-style 含 10 个描述符：system/symbols/prefix/suffix/range/pad/negative/fallback/speak-as',
          description: '基本语法：@counter-style <name> { system; symbols; ... }。system（必需，算法类型）、symbols（必需，符号集）、prefix/suffix（前后缀，suffix 默认 ". "）、range（适用范围）、pad（补齐）、negative（负数符号）、fallback（兜底）、speak-as（无障碍）。name 必须是合法 CSS 标识符。用 list-style-type: name 或 content: counter(item, name) 引用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：system 描述符全集 ===================

  _readSystemInfo(): string {
    const f = this._flags();
    try {
      return `===== system 描述符全集 =====\n` +
        `\n` +
        `【system 取值】\n` +
        `  cyclic | symbolic | additive | fixed | numeric | alphabetic | extends\n` +
        `\n` +
        `【1. cyclic —— 循环使用符号】\n` +
        `  符号集循环重复：1→符号1, 2→符号2, ..., n+1→符号1\n` +
        `  适合：天干地支、八卦、有限符号集\n` +
        `  示例：\n` +
        `    @counter-style tiangan {\n` +
        `      system: cyclic;\n` +
        `      symbols: "甲" "乙" "丙" "丁" "戊" "己" "庚" "辛" "壬" "癸";\n` +
        `    }\n` +
        `    /* 1=甲, 2=乙, ..., 10=癸, 11=甲（循环）*/\n` +
        `\n` +
        `【2. symbolic —— 符号重复】\n` +
        `  1→符号1, 2→符号1符号1, 3→符号1符号1符号1\n` +
        `  适合：简单计数（如 "*" "**" "***"）\n` +
        `  示例：\n` +
        `    @counter-style stars {\n` +
        `      system: symbolic;\n` +
        `      symbols: "*";\n` +
        `    }\n` +
        `    /* 1=*, 2=**, 3=***, 4=**** */\n` +
        `\n` +
        `【3. additive —— 加法（罗马数字）】\n` +
        `  用 additive-symbols 定义加法符号集\n` +
        `  适合：罗马数字（I/V/X/L/C/D/M）\n` +
        `  示例：\n` +
        `    @counter-style roman {\n` +
        `      system: additive;\n` +
        `      additive-symbols: 1000 "M", 900 "CM", 500 "D", 400 "CD",\n` +
        `                       100 "C", 90 "XC", 50 "L", 40 "XL",\n` +
        `                       10 "X", 9 "IX", 5 "V", 4 "IV", 1 "I";\n` +
        `    }\n` +
        `    /* 1=I, 4=IV, 9=IX, 2024=MMXXIV */\n` +
        `\n` +
        `【4. fixed —— 固定符号（超出范围用 fallback）】\n` +
        `  1→符号1, 2→符号2, ..., n→符号n, n+1→fallback\n` +
        `  适合：有限固定序号（如月份 1-12）\n` +
        `  示例：\n` +
        `    @counter-style months {\n` +
        `      system: fixed;\n` +
        `      symbols: "一月" "二月" "三月" "四月" "五月" "六月"\n` +
        `              "七月" "八月" "九月" "十月" "十一月" "十二月";\n` +
        `      fallback: decimal;  /* 13 及以后用十进制 */\n` +
        `    }\n` +
        `\n` +
        `【5. numeric —— 数字进制】\n` +
        `  类似十进制但用自定义符号集\n` +
        `  适合：阿拉伯-印度数字、其他进制数字\n` +
        `  示例：\n` +
        `    @counter-style arabic-indic {\n` +
        `      system: numeric;\n` +
        `      symbols: "٠" "١" "٢" "٣" "٤" "٥" "٦" "٧" "٨" "٩";\n` +
        `    }\n` +
        `    /* 1=١, 10=١٠, 2024=٢٠٢٤ */\n` +
        `\n` +
        `【6. alphabetic —— 字母进制】\n` +
        `  类似 Excel 列号（A/B/.../Z/AA/AB/...）\n` +
        `  适合：拉丁字母、希腊字母序号\n` +
        `  示例：\n` +
        `    @counter-style greek-alpha {\n` +
        `      system: alphabetic;\n` +
        `      symbols: "α" "β" "γ" "δ" "ε" "ζ" "η" "θ" "ι" "κ"\n` +
        `              "λ" "μ" "ν" "ξ" "ο" "π" "ρ" "σ" "τ" "υ"\n` +
        `              "φ" "χ" "ψ" "ω";\n` +
        `    }\n` +
        `    /* 1=α, 2=β, ..., 24=ω, 25=αα, 26=αβ */\n` +
        `\n` +
        `【7. extends —— 继承已有 counter-style】\n` +
        `  继承内置或自定义 counter-style，覆盖部分描述符\n` +
        `  适合：微调内置样式\n` +
        `  示例：\n` +
        `    @counter-style decimal-paren {\n` +
        `      system: extends decimal;  /* 继承 decimal */\n` +
        `      prefix: "(";\n` +
        `      suffix: ") ";             /* 仅覆盖前后缀 */\n` +
        `    }\n` +
        `    /* 1=(1), 2=(2), 3=(3) */\n` +
        `\n` +
        `【不同 system 表现差异】\n` +
        `  cyclic：循环（适合有限符号）\n` +
        `  symbolic：重复（适合单符号计数）\n` +
        `  additive：加法（适合罗马数字）\n` +
        `  fixed：固定（超出用 fallback）\n` +
        `  numeric：数字进制（适合自定义数字）\n` +
        `  alphabetic：字母进制（适合字母序号）\n` +
        `  extends：继承（适合微调）\n` +
        `\n` +
        `【fallback 兜底】\n` +
        `  当 system 无法表示某个数字（如 fixed 超范围、cyclic 超出预期）\n` +
        `  自动使用 fallback 指定的 counter-style\n` +
        `  默认 fallback: decimal（十进制）\n` +
        `\n` +
        `【能力检测】\n` +
        `  @counter-style 支持 = ${f.counterStyleAtRule}\n` +
        `  当前演示 system = ${this._currentSystem}`;
    } catch (err: any) {
      return `读取 system 描述符信息失败：${err.name} - ${err.message}`;
    }
  }

  _setSystem(mode: string): void {
    this._currentSystem = mode;
    // 注入对应 system 的 @counter-style 演示
    const styles = {
      cyclic: `@counter-style demo-cyclic { system: cyclic; symbols: "甲" "乙" "丙" "丁"; suffix: "、"; }
        .system-stage ol.sys-cyclic { list-style-type: demo-cyclic; }`,
      symbolic: `@counter-style demo-symbolic { system: symbolic; symbols: "*"; suffix: " "; }
        .system-stage ol.sys-symbolic { list-style-type: demo-symbolic; }`,
      additive: `@counter-style demo-additive { system: additive; additive-symbols: 10 "X", 5 "V", 1 "I"; suffix: "."; }
        .system-stage ol.sys-additive { list-style-type: demo-additive; }`,
      numeric: `@counter-style demo-numeric { system: numeric; symbols: "٠" "١" "٢" "٣" "٤" "٥" "٦" "٧" "٨" "٩"; suffix: " "; }
        .system-stage ol.sys-numeric { list-style-type: demo-numeric; }`,
      alphabetic: `@counter-style demo-alpha { system: alphabetic; symbols: "α" "β" "γ" "δ"; suffix: " "; }
        .system-stage ol.sys-alpha { list-style-type: demo-alpha; }`,
    };
    this._injectStyle('css-system-dynamic', ((styles as any)[(mode as any)]) || styles.cyclic);
    this.setState({ systemInfo: this._readSystemInfo() });
    this._addLog('system', `切换 system → ${mode}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. system 描述符全集 —— cyclic / symbolic / additive / fixed / numeric / alphabetic / extends',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@counter-style', f.counterStyleAtRule]]),
        h(Tag, { color: 'primary' }, '7 种 system'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'system 描述符定义算法类型：cyclic（循环，适合天干地支）、symbolic（符号重复，如 * ** ***）、additive（加法，适合罗马数字 I/V/X）、fixed（固定，超出用 fallback）、numeric（数字进制，适合阿拉伯-印度数字）、alphabetic（字母进制，适合希腊字母 α β γ）、extends（继承已有样式微调）。不同 system 表现差异显著，fallback 默认 decimal 兜底超范围情况。Chrome 91+ / Firefox 33+ / Safari 17+ 支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ systemInfo: this._readSystemInfo() }) }),
          this._btn('cyclic', { size: 'sm', disabled: !f.counterStyleAtRule, onClick: () => this._setSystem('cyclic') }),
          this._btn('symbolic', { size: 'sm', disabled: !f.counterStyleAtRule, onClick: () => this._setSystem('symbolic') }),
          this._btn('additive', { size: 'sm', disabled: !f.counterStyleAtRule, onClick: () => this._setSystem('additive') }),
          this._btn('numeric', { size: 'sm', disabled: !f.counterStyleAtRule, onClick: () => this._setSystem('numeric') }),
          this._btn('alphabetic', { size: 'sm', disabled: !f.counterStyleAtRule, onClick: () => this._setSystem('alphabetic') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '当前 system: ' + this._currentSystem + '（真实浏览器查看自定义序号）：'),
        h('div', { class: 'system-stage' },
          h('ol', { class: 'sys-cyclic' },
            h('li', {}, '第一项'), h('li', {}, '第二项'), h('li', {}, '第三项'), h('li', {}, '第四项'), h('li', {}, '第五项'),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.systemInfo || '（点击按钮切换 system 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'cyclic 适合天干地支，additive 适合罗马数字，numeric 适合阿拉伯-印度数字',
          description: '7 种 system：cyclic（循环，天干地支）、symbolic（重复，* ** ***）、additive（加法，罗马数字）、fixed（固定，超出 fallback）、numeric（数字进制，阿拉伯-印度数字）、alphabetic（字母进制，希腊字母）、extends（继承微调）。fallback 默认 decimal 兜底。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：symbols 与 additive-symbols ===================

  _readSymbolsInfo(): string {
    const f = this._flags();
    try {
      return `===== symbols 与 additive-symbols =====\n` +
        `\n` +
        `【symbols 描述符】\n` +
        `  定义符号集，用于 cyclic / symbolic / fixed / numeric / alphabetic\n` +
        `  语法：symbols: <symbol> <symbol> ...;\n` +
        `  每个 symbol 可以是：\n` +
        `    字符串："甲" "乙" "丙"\n` +
        `    多字符："10" "20" "30"（整个字符串作为一个符号）\n` +
        `    Unicode 转义："\\2605"（★）"\\2606"（☆）\n` +
        `    图像：url(star.png)（部分浏览器支持）\n` +
        `\n` +
        `【多字符符号】\n` +
        `  每个符号可以是多个字符（作为整体）\n` +
        `  示例：\n` +
        `    @counter-style double-digit {\n` +
        `      system: fixed;\n` +
        `      symbols: "10" "20" "30" "40";  /* 每个符号是两位数 */\n` +
        `    }\n` +
        `    /* 1=10, 2=20, 3=30, 4=40 */\n` +
        `\n` +
        `【additive-symbols 描述符】\n` +
        `  仅用于 system: additive（罗马数字等）\n` +
        `  语法：additive-symbols: <value> <symbol>, <value> <symbol>, ...;\n` +
        `  value 必须是正整数，按降序排列\n` +
        `  示例（罗马数字）：\n` +
        `    @counter-style roman {\n` +
        `      system: additive;\n` +
        `      additive-symbols:\n` +
        `        1000 "M", 900 "CM", 500 "D", 400 "CD",\n` +
        `        100 "C", 90 "XC", 50 "L", 40 "XL",\n` +
        `        10 "X", 9 "IX", 5 "V", 4 "IV", 1 "I";\n` +
        `    }\n` +
        `    /* 算法：从大到小减法表示 */\n` +
        `    /* 2024 = M + M + X + X + IV = MMXXIV */\n` +
        `    /* 4 = IV（4 直接对应）*/\n` +
        `    /* 9 = IX（9 直接对应）*/\n` +
        `\n` +
        `【符号数量限制】\n` +
        `  cyclic/symbolic/fixed/numeric/alphabetic：至少 1 个符号\n` +
        `  additive：至少 1 个 additive-symbols 项\n` +
        `  实际无硬性上限，但建议 ≤ 100 个（性能考虑）\n` +
        `  Unicode 符号集：可使用任意 Unicode 字符\n` +
        `\n` +
        `【Unicode 符号集示例】\n` +
        `  天干：甲乙丙丁戊己庚辛壬癸（U+7532 - U+7678）\n` +
        `  地支：子丑寅卯辰巳午未申酉戌亥（U+5B50 - U+4EA5）\n` +
        `  阿拉伯-印度数字：٠١٢٣٤٥٦٧٨٩（U+0660 - U+0669）\n` +
        `  希腊字母：αβγδεζηθικλμνξοπρστυφχψω（U+03B1 - U+03C9）\n` +
        `  八卦：☰☱☲☳☴☵☶☷（U+2630 - U+2637）\n` +
        `  星星：★☆（U+2605, U+2606）\n` +
        `\n` +
        `【能力检测】\n` +
        `  @counter-style 支持 = ${f.counterStyleAtRule}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 多字符符号 */\n` +
        `  @counter-style double {\n` +
        `    system: fixed;\n` +
        `    symbols: "10" "20" "30" "40" "50";\n` +
        `    suffix: ". ";\n` +
        `  }\n` +
        `\n` +
        `  /* 罗马数字（additive）*/\n` +
        `  @counter-style roman {\n` +
        `    system: additive;\n` +
        `    additive-symbols: 1000 "M", 500 "D", 100 "C", 50 "L", 10 "X", 5 "V", 1 "I";\n` +
        `  }\n` +
        `\n` +
        `  /* Unicode 星星 */\n` +
        `  @counter-style stars {\n` +
        `    system: cyclic;\n` +
        `    symbols: "\\2605" "\\2606";  /* ★ ☆ */\n` +
        `    suffix: " ";\n` +
        `  }`;
    } catch (err: any) {
      return `读取 symbols 信息失败：${err.name} - ${err.message}`;
    }
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. symbols 与 additive-symbols —— 符号集与罗马数字',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@counter-style', f.counterStyleAtRule]]),
        h(Tag, { color: 'primary' }, '符号集'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'symbols 描述符定义符号集（用于 cyclic/symbolic/fixed/numeric/alphabetic），支持字符串、多字符符号、Unicode 转义（\\2605 ★）、图像 url()。多字符符号将整个字符串作为单个符号。additive-symbols 仅用于 system: additive（罗马数字等），语法 additive-symbols: <value> <symbol>, ...，value 按降序排列，算法从大到小减法表示（2024 = MMXXIV）。Unicode 符号集：天干地支、阿拉伯-印度数字、希腊字母、八卦、星星等任意 Unicode 字符。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 symbols 信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ symbolsInfo: this._readSymbolsInfo() }) }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.symbolsInfo || '（点击按钮查看 symbols/additive-symbols 完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'additive-symbols 用于罗马数字（从大到小减法），symbols 用于其他 system',
          description: 'symbols 定义符号集（字符串/多字符/Unicode/图像），用于 cyclic/symbolic/fixed/numeric/alphabetic。additive-symbols 仅用于 additive system（罗马数字），语法 additive-symbols: <value> <symbol>, ...，value 降序排列，算法从大到小减法（2024=MMXXIV）。Unicode 符号集：天干地支、阿拉伯-印度数字、希腊字母等。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：prefix/suffix/range/pad/fallback ===================

  _readDescriptorsInfo(): string {
    const f = this._flags();
    try {
      return `===== prefix/suffix/range/pad/fallback/negative =====\n` +
        `\n` +
        `【prefix / suffix —— 前后缀】\n` +
        `  prefix: <symbol>;   默认 ""（无前缀）\n` +
        `  suffix: <symbol>;   默认 ". "（点空格）\n` +
        `  示例：\n` +
        `    @counter-style paren {\n` +
        `      system: numeric;\n` +
        `      symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9";\n` +
        `      prefix: "(";\n` +
        `      suffix: ") ";    /* 1=(1), 2=(2), 3=(3) */\n` +
        `    }\n` +
        `\n` +
        `【range —— 适用范围】\n` +
        `  range: <min> <max> | auto;\n` +
        `  限制 counter-style 仅在指定范围内生效\n` +
        `  超出范围时使用 fallback\n` +
        `  默认 auto（由 system 决定）\n` +
        `  示例：\n` +
        `    @counter-style months {\n` +
        `      system: fixed;\n` +
        `      symbols: "一月" "二月" ... "十二月";\n` +
        `      range: 1 12;       /* 仅 1-12 生效 */\n` +
        `      fallback: decimal;  /* 13+ 用十进制 */\n` +
        `    }\n` +
        `\n` +
        `【pad —— 补齐】\n` +
        `  pad: <length> <symbol>;\n` +
        `  将序号补齐到指定长度（不足时用 symbol 填充）\n` +
        `  示例：\n` +
        `    @counter-style padded {\n` +
        `      system: numeric;\n` +
        `      symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9";\n` +
        `      pad: 3 "0";       /* 补零到 3 位 */\n` +
        `    }\n` +
        `    /* 1=001, 10=010, 100=100, 1000=1000（超出不截断）*/\n` +
        `\n` +
        `【fallback —— 兜底】\n` +
        `  fallback: <counter-style>;\n` +
        `  当 counter-style 无法表示某个数字时使用\n` +
        `  默认 fallback: decimal\n` +
        `  触发条件：\n` +
        `    1. fixed system 超出符号数\n` +
        `    2. 超出 range 范围\n` +
        `    3. negative 数字但未定义 negative 描述符\n` +
        `  示例：\n` +
        `    @counter-style limited {\n` +
        `      system: fixed;\n` +
        `      symbols: "①" "②" "③" "④" "⑤";\n` +
        `      fallback: decimal;  /* 6+ 用十进制 */\n` +
        `    }\n` +
        `\n` +
        `【negative —— 负数符号】\n` +
        `  negative: <symbol> <symbol>?;\n` +
        `  定义负数的表示方式\n` +
        `  第一个 symbol 是前缀，第二个（可选）是后缀\n` +
        `  默认 negative: "-" ""（仅前缀减号）\n` +
        `  示例：\n` +
        `    @counter-style paren-neg {\n` +
        `      system: numeric;\n` +
        `      symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9";\n` +
        `      negative: "(" ")";  /* -1=(1), -2=(2) */\n` +
        `    }\n` +
        `\n` +
        `【自定义完整序号格式】\n` +
        `  组合 prefix + suffix + pad + range + negative：\n` +
        `    @counter-style invoice-num {\n` +
        `      system: numeric;\n` +
        `      symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9";\n` +
        `      prefix: "INV-";\n` +
        `      pad: 4 "0";          /* 补零到 4 位 */\n` +
        `      range: 1 9999;       /* 仅 1-9999 */\n` +
        `      fallback: decimal;\n` +
        `    }\n` +
        `    /* 1=INV-0001, 100=INV-0100, 9999=INV-9999 */\n` +
        `\n` +
        `【能力检测】\n` +
        `  @counter-style 支持 = ${f.counterStyleAtRule}`;
    } catch (err: any) {
      return `读取 prefix/suffix/range/pad/fallback 信息失败：${err.name} - ${err.message}`;
    }
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. prefix/suffix/range/pad/fallback/negative —— 完整序号格式',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@counter-style', f.counterStyleAtRule]]),
        h(Tag, { color: 'primary' }, '6 个描述符'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '6 个格式描述符：prefix/suffix（前后缀，suffix 默认 ". "）、range（适用范围，超出用 fallback）、pad（补齐，如 pad: 3 "0" 补零到 3 位）、fallback（兜底样式，默认 decimal）、negative（负数符号，默认 "-"，可定义括号 negative: "(" ")"）、组合自定义完整序号格式（如发票号 INV-0001）。prefix: "(" + suffix: ") " 实现括号序号 (1) (2)。range: 1 12 限制月份序号。pad: 4 "0" 补零到 4 位。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取格式描述符信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ descriptorsInfo: this._readDescriptorsInfo() }) }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.descriptorsInfo || '（点击按钮查看 6 个格式描述符完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'prefix/suffix/range/pad/fallback/negative 组合自定义完整序号格式',
          description: 'prefix/suffix（前后缀，suffix 默认 ". "）、range（适用范围，超出用 fallback）、pad（补齐，如 pad: 3 "0" 补零到 3 位）、fallback（兜底，默认 decimal）、negative（负数符号，默认 "-"，可定义括号 negative: "(" ")"）。组合实现发票号 INV-0001、括号序号 (1)(2) 等格式。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：speak-as 与无障碍 ===================

  _readSpeakAsInfo(): string {
    const f = this._flags();
    try {
      return `===== speak-as 与无障碍 =====\n` +
        `\n` +
        `【speak-as 取值】\n` +
        `  speak-as: auto | bullets | numbers | words | spell-out | <<counter-style>>\n` +
        `\n` +
        `【取值详解】\n` +
        `  auto           —— 默认：由浏览器决定（通常 bullets 对符号型，numbers 对数字型）\n` +
        `  bullets        —— 当作无序列表符号朗读（"项目"）\n` +
        `  numbers        —— 当作数字朗读（"第一项" "第二项"）\n` +
        `  words          —— 当作单词朗读（符号本身作为单词）\n` +
        `  spell-out      —— 逐字符朗读（如 "甲" 朗读为 "甲"）\n` +
        `  <<counter-style>> —— 引用另一个 counter-style 的 speak-as\n` +
        `\n` +
        `【屏幕阅读器朗读】\n` +
        `  speak-as 决定屏幕阅读器如何朗读序号\n` +
        `  默认 auto 可能不准确（如 cyclic 符号可能朗读为符号名）\n` +
        `  显式指定 speak-as 让朗读更友好：\n` +
        `    数字型 counter-style → speak-as: numbers（"第一项"）\n` +
        `    符号型 counter-style → speak-as: bullets（"项目"）\n` +
        `\n` +
        `【数字与符号区分】\n` +
        `  数字型（numeric/alphabetic/additive）：建议 speak-as: numbers\n` +
        `    朗读为"第一项""第二项"（序数词）\n` +
        `  符号型（cyclic/symbolic/fixed）：建议 speak-as: bullets 或 spell-out\n` +
        `    bullets 朗读为"项目"（不朗读符号本身）\n` +
        `    spell-out 朗读符号本身（如"甲""乙"）\n` +
        `\n` +
        `【与 @counter-style 名称互引用】\n` +
        `  speak-as: <counter-style-name>;\n` +
        `  引用另一个 counter-style 的朗读方式\n` +
        `  示例：\n` +
        `    @counter-style tiangan {\n` +
        `      system: cyclic;\n` +
        `      symbols: "甲" "乙" "丙" "丁" "戊" "己" "庚" "辛" "壬" "癸";\n` +
        `      speak-as: spell-out;  /* 朗读符号本身"甲""乙" */\n` +
        `    }\n` +
        `\n` +
        `    @counter-style tiangan-num {\n` +
        `      system: extends tiangan;\n` +
        `      speak-as: numbers;    /* 朗读为"第一项""第二项" */\n` +
        `    }\n` +
        `\n` +
        `【无障碍最佳实践】\n` +
        `  1. 数字型 counter-style 设 speak-as: numbers\n` +
        `  2. 符号型 counter-style 设 speak-as: spell-out（朗读符号）或 bullets（朗读"项目"）\n` +
        `  3. 避免依赖序号传达关键信息（屏幕阅读器用户可能听不清）\n` +
        `  4. 配合 aria-label 提供完整描述\n` +
        `\n` +
        `【能力检测】\n` +
        `  @counter-style 支持 = ${f.counterStyleAtRule}`;
    } catch (err: any) {
      return `读取 speak-as 信息失败：${err.name} - ${err.message}`;
    }
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. speak-as 与无障碍 —— 屏幕阅读器朗读方式',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@counter-style', f.counterStyleAtRule]]),
        h(Tag, { color: 'primary' }, '无障碍'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'speak-as 描述符决定屏幕阅读器如何朗读序号：auto（默认，浏览器决定）/ bullets（朗读"项目"，适合符号型）/ numbers（朗读"第一项"，适合数字型）/ words（朗读符号作为单词）/ spell-out（逐字符朗读符号本身）/ <<counter-style>>（引用另一个 counter-style 的朗读方式）。数字型建议 speak-as: numbers，符号型建议 speak-as: spell-out 或 bullets。无障碍最佳实践：避免依赖序号传达关键信息，配合 aria-label 提供完整描述。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 speak-as 信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ speakAsInfo: this._readSpeakAsInfo() }) }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.speakAsInfo || '（点击按钮查看 speak-as 与无障碍完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'speak-as 让屏幕阅读器正确朗读自定义序号',
          description: 'speak-as 决定朗读方式：auto（默认）、bullets（"项目"，适合符号型）、numbers（"第一项"，适合数字型）、words、spell-out（朗读符号本身）、<<counter-style>>（引用其他样式）。数字型建议 numbers，符号型建议 spell-out 或 bullets。无障碍最佳实践：避免依赖序号传达关键信息，配合 aria-label。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 7：实战：中文天干地支与节气 ===================

  _readCjkCustomInfo(): string {
    const f = this._flags();
    try {
      return `===== 实战：中文天干地支与节气 =====\n` +
        `\n` +
        `【场景 1：天干（甲乙丙丁戊己庚辛壬癸）】\n` +
        `  @counter-style tiangan {\n` +
        `    system: cyclic;            /* 循环 */\n` +
        `    symbols: "甲" "乙" "丙" "丁" "戊" "己" "庚" "辛" "壬" "癸";\n` +
        `    suffix: "、";\n` +
        `    speak-as: spell-out;       /* 朗读"甲""乙" */\n` +
        `  }\n` +
        `  ol.tiangan { list-style-type: tiangan; }\n` +
        `  /* 1=甲、 2=乙、 ... 10=癸、 11=甲（循环）*/\n` +
        `\n` +
        `【场景 2：地支（子丑寅卯辰巳午未申酉戌亥）】\n` +
        `  @counter-style dizhi {\n` +
        `    system: cyclic;\n` +
        `    symbols: "子" "丑" "寅" "卯" "辰" "巳" "午" "未" "申" "酉" "戌" "亥";\n` +
        `    suffix: "、";\n` +
        `  }\n` +
        `  /* 1=子、 2=丑、 ... 12=亥、 13=子（循环）*/\n` +
        `\n` +
        `【场景 3：二十四节气】\n` +
        `  @counter-style jieqi {\n` +
        `    system: fixed;             /* 固定，超出用 fallback */\n` +
        `    symbols: "立春" "雨水" "惊蛰" "春分" "清明" "谷雨"\n` +
        `            "立夏" "小满" "芒种" "夏至" "小暑" "大暑"\n` +
        `            "立秋" "处暑" "白露" "秋分" "寒露" "霜降"\n` +
        `            "立冬" "小雪" "大雪" "冬至" "小寒" "大寒";\n` +
        `    suffix: " ";\n` +
        `    fallback: decimal;          /* 25+ 用十进制 */\n` +
        `  }\n` +
        `  /* 1=立春 2=雨水 ... 24=大寒 25=25（fallback）*/\n` +
        `\n` +
        `【场景 4：农历日期】\n` +
        `  @counter-style lunar-day {\n` +
        `    system: fixed;\n` +
        `    symbols: "初一" "初二" "初三" "初四" "初五" "初六" "初七" "初八" "初九" "初十"\n` +
        `            "十一" "十二" "十三" "十四" "十五" "十六" "十七" "十八" "十九" "二十"\n` +
        `            "廿一" "廿二" "廿三" "廿四" "廿五" "廿六" "廿七" "廿八" "廿九" "三十";\n` +
        `    suffix: " ";\n` +
        `    fallback: decimal;\n` +
        `  }\n` +
        `\n` +
        `【场景 5：阿拉伯-印度数字】\n` +
        `  @counter-style arabic-indic {\n` +
        `    system: numeric;           /* 数字进制 */\n` +
        `    symbols: "٠" "١" "٢" "٣" "٤" "٥" "٦" "٧" "٨" "٩";\n` +
        `    suffix: ". ";\n` +
        `  }\n` +
        `  /* 1=١. 10=١٠. 2024=٢٠٢٤. */\n` +
        `\n` +
        `【场景 6：希腊字母 αβγ】\n` +
        `  @counter-style greek-alpha {\n` +
        `    system: alphabetic;        /* 字母进制 */\n` +
        `    symbols: "α" "β" "γ" "δ" "ε" "ζ" "η" "θ" "ι" "κ"\n` +
        `            "λ" "μ" "ν" "ξ" "ο" "π" "ρ" "σ" "τ" "υ"\n` +
        `            "φ" "χ" "ψ" "ω";\n` +
        `    suffix: ". ";\n` +
        `  }\n` +
        `  /* 1=α. 2=β. ... 24=ω. 25=αα. 26=αβ. */\n` +
        `\n` +
        `【能力检测】\n` +
        `  @counter-style 支持 = ${f.counterStyleAtRule}\n` +
        `  已注入自定义 @counter-style = ${this._counterStyleInjected}`;
    } catch (err: any) {
      return `读取中文天干地支实战信息失败：${err.name} - ${err.message}`;
    }
  }

  _injectCjkCounterStyles(): void {
    if (this._counterStyleInjected) {
      this._addLog('warn', '自定义 @counter-style 已注入，无需重复');
      return;
    }
    this._counterStyleInjected = true;
    this._injectStyle('css-cjk-counter-styles', `
      @counter-style tiangan {
        system: cyclic;
        symbols: "甲" "乙" "丙" "丁" "戊" "己" "庚" "辛" "壬" "癸";
        suffix: "、";
      }
      @counter-style dizhi {
        system: cyclic;
        symbols: "子" "丑" "寅" "卯" "辰" "巳" "午" "未" "申" "酉" "戌" "亥";
        suffix: "、";
      }
      @counter-style greek-alpha {
        system: alphabetic;
        symbols: "α" "β" "γ" "δ" "ε" "ζ" "η" "θ" "ι" "κ" "λ" "μ" "ν" "ξ" "ο" "π" "ρ" "σ" "τ" "υ" "φ" "χ" "ψ" "ω";
        suffix: ". ";
      }
      .cjk-stage ol.tiangan-list { list-style-type: tiangan; }
      .cjk-stage ol.dizhi-list { list-style-type: dizhi; }
      .cjk-stage ol.greek-list { list-style-type: greek-alpha; }
    `);
    this._addLog('cjk', '已注入天干/地支/希腊字母 @counter-style，真实浏览器查看自定义序号');
  }

  _runCjkCustomDemo(): void {
    this._injectCjkCounterStyles();
    this.setState({ cjkCustomInfo: this._readCjkCustomInfo() });
    this._addLog('cjk', `天干地支实战演示：@counter-style=${this._flags().counterStyleAtRule}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：中文天干地支与节气 / 阿拉伯-印度数字 / 希腊字母',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@counter-style', f.counterStyleAtRule]]),
        h(Tag, { color: 'primary' }, '6 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '中文序号六大场景：天干（甲乙丙丁戊己庚辛壬癸，cyclic 循环）、地支（子丑寅卯辰巳午未申酉戌亥，cyclic）、二十四节气（立春雨水...大寒，fixed + fallback）、农历日期（初一初二...三十，fixed）、阿拉伯-印度数字（٠١٢٣٤٥٦٧٨٩，numeric）、希腊字母（αβγ...ω，alphabetic 字母进制，25=αα）。每个场景展示真实 @counter-style 代码与渲染效果。点击按钮注入自定义 @counter-style（真实浏览器查看效果）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注入并运行演示', { type: 'primary', size: 'sm', disabled: !f.counterStyleAtRule, onClick: () => this._runCjkCustomDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '天干/地支/希腊字母序号演示（真实浏览器查看）：'),
        h('div', { class: 'cjk-stage' },
          h('div', { class: 'grid-cols' },
            h('div', {},
              h('div', { class: 'fs-sm text-secondary' }, '天干（cyclic）：'),
              h('ol', { class: 'tiangan-list' },
                h('li', {}, '第一'), h('li', {}, '第二'), h('li', {}, '第三'), h('li', {}, '第四'), h('li', {}, '第五'),
              ),
            ),
            h('div', {},
              h('div', { class: 'fs-sm text-secondary' }, '地支（cyclic）：'),
              h('ol', { class: 'dizhi-list' },
                h('li', {}, '第一'), h('li', {}, '第二'), h('li', {}, '第三'), h('li', {}, '第四'),
              ),
            ),
            h('div', {},
              h('div', { class: 'fs-sm text-secondary' }, '希腊字母（alphabetic）：'),
              h('ol', { class: 'greek-list' },
                h('li', {}, '第一'), h('li', {}, '第二'), h('li', {}, '第三'),
              ),
            ),
            h('div', {},
              h('div', { class: 'fs-sm text-secondary' }, '说明：'),
              '点击「注入并运行演示」注入 @counter-style，真实浏览器可查看自定义序号。jsdom 不渲染序号但 DOM 正确。',
            ),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.cjkCustomInfo || '（点击按钮注入 @counter-style 并查看 6 大场景完整代码）')),
        h(Alert, {
          type: 'info',
          message: '天干地支用 cyclic，节气用 fixed，阿拉伯-印度数字用 numeric，希腊字母用 alphabetic',
          description: '天干（cyclic 循环 10 符号）、地支（cyclic 循环 12 符号）、二十四节气（fixed + fallback decimal）、农历日期（fixed）、阿拉伯-印度数字（numeric 数字进制）、希腊字母（alphabetic 字母进制，25=αα）。每个场景对应不同 system，体现 @counter-style 灵活性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 8：实战与陷阱 ===================

  _readPitfallsInfo(): string {
    const f = this._flags();
    try {
      return `===== CSS Counter Styles 实战与陷阱 =====\n` +
        `\n` +
        `【实战 1：list-style: custom-name 引用】\n` +
        `  ol { list-style-type: tiangan; }  /* 引用自定义 @counter-style */\n` +
        `  也可用 list-style 简写：list-style: tiangan outside;\n` +
        `\n` +
        `【实战 2：counter-set / counter-reset / counter-increment】\n` +
        `  counter-reset: item 0;      /* 重置计数器 item 为 0 */\n` +
        `  counter-increment: item;    /* 递增 item（默认 +1）*/\n` +
        `  counter-increment: item 2;  /* 递增 item +2 */\n` +
        `  counter-set: item 5;        /* 直接设置 item 为 5（覆盖递增）*/\n` +
        `  区别：\n` +
        `    counter-reset：重置为指定值（每次进入元素作用域）\n` +
        `    counter-increment：在当前值基础上递增\n` +
        `    counter-set：直接设置（Chrome 85+ / Safari 17.4+ 较新）\n` +
        `\n` +
        `【实战 3：多级目录章节号（1.1.1）】\n` +
        `  用 counters() 函数嵌套实现多级编号\n` +
        `  ol.toc { counter-reset: section; }\n` +
        `  ol.toc > li {\n` +
        `    counter-increment: section;\n` +
        `    counter-reset: subsection;  /* 每级重置子计数器 */\n` +
        `  }\n` +
        `  ol.toc > li::before {\n` +
        `    content: counters(section, ".") " ";  /* 1, 1.1, 1.1.1 */\n` +
        `  }\n` +
        `  ol.toc ol { counter-reset: subsection; }\n` +
        `  ol.toc ol > li {\n` +
        `    counter-increment: subsection;\n` +
        `  }\n` +
        `  ol.toc ol > li::before {\n` +
        `    content: counters(section, ".", decimal) "." counters(subsection, ".", decimal) " ";\n` +
        `    /* 1.1, 1.2, 1.1.1, 1.1.2 */\n` +
        `  }\n` +
        `\n` +
        `【实战 4：counters() 函数嵌套】\n` +
        `  counters(<name>, <separator>, <counter-style>?)\n` +
        `  嵌套计数器自动拼接所有祖先作用域的同名计数器\n` +
        `  示例：counters(section, ".") → "1", "1.1", "1.1.1"\n` +
        `  可指定 counter-style：counters(section, ".", tiangan)\n` +
        `\n` +
        `【陷阱 1：fallback 处理超范围】\n` +
        `  fixed system 超出符号数时自动用 fallback\n` +
        `  range 超出时也用 fallback\n` +
        `  默认 fallback: decimal（十进制）\n` +
        `  示例：\n` +
        `    @counter-style five-only {\n` +
        `      system: fixed;\n` +
        `      symbols: "①" "②" "③" "④" "⑤";\n` +
        `      fallback: decimal;  /* 6+ 用十进制 */\n` +
        `    }\n` +
        `    /* 1=① 2=② ... 5=⑤ 6=6 7=7 */\n` +
        `\n` +
        `【陷阱 2：counter-set 浏览器支持较新】\n` +
        `  counter-set 较新：Chrome 85+ / Firefox 68+ / Safari 17.4+\n` +
        `  老浏览器不支持，需用 counter-reset 替代\n` +
        `  检测：CSS.supports('counter-set', 'item 5')\n` +
        `  当前检测：${f.counterSet ? '✓ 支持' : '✗ 不支持或 jsdom 未识别'}\n` +
        `\n` +
        `【陷阱 3：@counter-style 浏览器支持差异】\n` +
        `  Firefox 33+ 最早支持，Chrome 91+ 才支持，Safari 17+ 最新\n` +
        `  老浏览器（Chrome < 91, Safari < 17）不支持 @counter-style\n` +
        `  回退方案：用内置 list-style-type（disc/circle/decimal/roman）或 JS 生成序号\n` +
        `\n` +
        `【陷阱 4：DevTools 调试】\n` +
        `  Chrome DevTools：\n` +
        `    Elements 面板 → 查看 ol 的 list-style-type 计算值\n` +
        `    可查看 @counter-style 规则（Styles 面板）\n` +
        `  Firefox DevTools：\n` +
        `    更强大：显示 @counter-style 规则详情\n` +
        `    可查看 counter-reset/increment/set 计算值\n` +
        `\n` +
        `【陷阱 5：counter-reset 作用域】\n` +
        `  counter-reset 在元素作用域内有效\n` +
        `  子元素继承父元素的计数器值\n` +
        `  嵌套列表需在每级重置子计数器（counter-reset: subsection）\n` +
        `\n` +
        `【最佳实践清单】\n` +
        `  ✓ 优先用 @counter-style 替代 JS 生成序号\n` +
        `  ✓ cyclic 适合有限符号集（天干地支）\n` +
        `  ✓ additive 适合罗马数字\n` +
        `  ✓ fixed + fallback 适合固定范围（节气、月份）\n` +
        `  ✓ 用 counters() 实现多级目录章节号\n` +
        `  ✓ 配合 speak-as 提升无障碍\n` +
        `  ✓ 检测 counter-set 浏览器支持（较新）\n` +
        `  ✓ 老浏览器用内置 list-style-type 兜底\n` +
        `\n` +
        `  @counter-style 支持 = ${f.counterStyleAtRule}\n` +
        `  counter-set 支持 = ${f.counterSet}\n` +
        `  counter-reset 支持 = ${f.counterReset}\n` +
        `  counter-increment 支持 = ${f.counterIncrement}`;
    } catch (err: any) {
      return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPitfallsDemo(): void {
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    this._addLog('pitfalls', `陷阱与最佳实践演示：@counter-style=${this._flags().counterStyleAtRule}, counter-set=${this._flags().counterSet}`);
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战与陷阱 —— list-style / counter-set / 多级目录 / counters() / fallback / DevTools',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['@counter-style', f.counterStyleAtRule],
          ['counter-set', f.counterSet],
          ['counter-reset', f.counterReset],
        ]),
        h(Tag, { color: 'warning' }, '5 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实战与陷阱：list-style-type: name 引用自定义 @counter-style；counter-reset/increment/set 控制计数器（counter-set 较新 Chrome 85+/Safari 17.4+）；多级目录章节号（1.1.1）用 counters() 函数嵌套；counters(name, separator, style?) 拼接祖先作用域计数器。5 大陷阱：fallback 处理超范围（默认 decimal）、counter-set 浏览器支持较新（用 counter-reset 替代）、@counter-style 浏览器差异（Firefox 33+ / Chrome 91+ / Safari 17+）、DevTools 调试（Firefox 更强大）、counter-reset 作用域（嵌套需重置子计数器）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '多级目录章节号演示（counters() 嵌套）：'),
        h('div', { class: 'toc-stage' },
          h('ol', { class: 'toc', style: { counterReset: 'section' } },
            h('li', {}, '第一章'),
            h('li', {}, '第二章'),
            h('li', {}, '第三章'),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 5 大陷阱与 8 条最佳实践完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'counter-set 较新，老浏览器用 counter-reset；@counter-style 浏览器差异大',
          description: '陷阱：counter-set（Chrome 85+/Safari 17.4+ 较新，用 counter-reset 替代）、@counter-style 浏览器差异（Firefox 33+ / Chrome 91+ / Safari 17+，老浏览器用内置 list-style-type 兜底）、fallback 处理超范围（默认 decimal）、counter-reset 作用域（嵌套需重置子计数器）。多级目录用 counters() 嵌套实现 1.1.1 章节号。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板（按时间倒序，最新在上）===================

  _renderLogPanel(): Node | string {
    const s = this.state;
    const reversed = [...s.logs].reverse();   // 按时间倒序：最新日志在最上方
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志（按时间倒序）',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      reversed.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : reversed.map((log: LogEntry) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render(): Node {
    const s = this.state;
    return h('div', { class: 'api-lab-page css-counter-styles-page' },
      h('h2', { class: 'section-title' }, 'CSS Counter Styles @counter-style 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Counter Styles Level 3 自定义列表序号样式：@counter-style 语法（name + 10 个描述符）、system 描述符全集（cyclic/symbolic/additive/fixed/numeric/alphabetic/extends）、symbols 与 additive-symbols（符号集 + 罗马数字）、prefix/suffix/range/pad/fallback/negative（完整序号格式）、speak-as 与无障碍（屏幕阅读器朗读）、中文天干地支与节气实战（cyclic 天干地支 / fixed 节气 / numeric 阿拉伯-印度数字 / alphabetic 希腊字母）、实战与陷阱（list-style 引用 / counter-set / 多级目录章节号 / counters() 嵌套 / fallback / DevTools 调试）。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'),
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
