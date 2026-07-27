// =====================================================================
// CSSCustomHighlightAPIPage.js —— CSS Custom Highlight API 实验室
// 演示 CSS Custom Highlight API 全套能力，允许开发者用 Range 对文本/元素
// 区间打标并样式化，无需修改 DOM 树。比 <mark>/::selection 更灵活：
//   1. CSS.highlights 注册表 —— 全局 HighlightRegistry，类似 CSS.stylesheets
//      通过 CSS.highlights.set(name, highlight) 注册，
//      CSS.highlights.get(name) 取回，CSS.highlights.delete(name) 移除，
//      CSS.highlights.clear() 清空，(CSS.highlights as any).entries()/keys()/values() 迭代
//   2. Highlight 对象 —— 由若干 Range 组成的集合
//      const hl = new Highlight(range1, range2);
//      hl.add(range3); hl.delete(range1); hl.clear();
//      hl.size 属性返回当前 Range 数量
//      Highlight 是 Set-like，支持 forEach/iterable 协议
//   3. ::highlight(<custom-name>) 伪元素 —— 用 CSS 样式化注册的高亮
//      ::highlight(search-result) { background: yellow; color: black; }
//      仅支持部分属性：color/background-color/text-decoration/caret-color/
//      outline/stroke/fill 等「文本相关」属性，不支持 box-shadow/transform 等
//   4. 多重高亮与 priority —— 多个高亮重叠时按 priority 决定叠层顺序
//      (highlight as any).priority = 1;  // 数值越大优先级越高，渲染在上层
//      默认 priority = 0，相同 priority 时按注册顺序
//   5. type 属性 —— 高亮语义分类（spellcheck/search-result/text-selection 等）
//      highlight.type = "search-result";
//      // 协助辅助技术识别高亮用途，目前 AT 支持有限
//   6. 典型场景：搜索结果高亮、拼写检查标注、代码评审批注、富文本编辑器装饰、
//      阅读进度标注、协同编辑他人选区显示
// 说明：jsdom 不做真实渲染，但 CSS.highlights/Highlight 在新版 Chrome 可用；
//       检测能力并展示完整代码示例。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSCustomHighlightAPIPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  basicsInfo: string;
  pseudoInfo: string;
  priorityInfo: string;
  typeInfo: string;
  patternsInfo: string;
  compareInfo: string;
  liveSearchResult: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSCustomHighlightAPIPage extends Page {
  declare state: CSSCustomHighlightAPIPageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];
  _registeredHighlights: any[] = [];


  initialState(): CSSCustomHighlightAPIPageState {
    return {
      logs: [],
      capsSummary: '',
      basicsInfo: '',         // Card 1：CSS.highlights + Highlight 基础
      pseudoInfo: '',         // Card 2：::highlight() 伪元素
      priorityInfo: '',       // Card 3：priority 多重高亮叠层
      typeInfo: '',           // Card 4：type 语义分类
      patternsInfo: '',       // Card 5：典型场景与实战
      compareInfo: '',        // Card 6：与 ::selection/<mark>/contentEditable 对比
      liveSearchResult: '',   // 实战演示：搜索高亮结果
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];
    this._registeredHighlights = []; // 记录注册的高亮名，便于卸载时清理

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `CSS.highlights ${c(f.highlightsAPI)}`,
      `Highlight ${c(f.highlightCtor)}`,
      `::highlight() ${c(f.pseudo)}`,
      `Range ${c(f.rangeAPI)}`,
      `priority ${c((f as any).priority)}`,
      `type ${c(f.type)}`,
      `Highlight Set-like ${c(f.setLike)}`,
    ];

    const summary = f.highlightsAPI
      ? `CSS Custom Highlight API 能力检测：${parts.join(' · ')}。可用 CSS.highlights 注册 Highlight，::highlight(name) 样式化；按钮点击运行实时演示并展示完整代码。`
      : '当前环境不支持 CSS Custom Highlight API（CSS.highlights === undefined）。按钮点击仅记日志说明，不会抛异常。Chrome 105+/Safari 17.2+ 支持。';

    this.setState({ capsSummary: summary });
    this._addLog(f.highlightsAPI ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.highlightsAPI) this._addLog('warn', '当前 jsdom 版本不支持 CSS.highlights；点击按钮查看代码示例与说明');
    if (!(f as any).priority) this._addLog('warn', 'priority 属性不可用（Chrome 105+/Safari 17.2+）');

    this._injectBaseStyles();
  }

  componentWillUnmount(): void {
    // 清理已注册的 Highlight
    if (this._flags().highlightsAPI) {
      for (const name of this._registeredHighlights) {
        try { CSS.highlights.delete(name); } catch { /* noop */ }
      }
    }
    this._registeredHighlights = [];

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
    this._injectStyle('css-highlight-base', `
      .ch-demo {
        padding: 12px;
        background: #fafafa;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        margin-top: 8px;
        font-family: "Inter", "PingFang SC", sans-serif;
        line-height: 1.8;
      }
      .ch-demo-text {
        font-size: 14px;
        color: #1e293b;
        white-space: pre-wrap;
      }
      .ch-search-bar {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }
      .ch-search-bar input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-size: 14px;
      }
      .ch-stats {
        font-size: 12px;
        color: #64748b;
        margin-top: 6px;
      }
      .ch-output {
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
      .ch-highlight-legend {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 12px;
      }
      .ch-legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .ch-legend-swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 2px;
      }
    `);
  }

  _flags(): any {
    const hasCSS = typeof CSS !== 'undefined';
    const hasHighlights = hasCSS && CSS.highlights !== undefined && CSS.highlights !== null;
    return {
      css: hasCSS,
      highlightsAPI: hasHighlights,
      highlightCtor: typeof Highlight !== 'undefined',
      pseudo: (() => {
        try {
          return hasCSS && typeof CSS.supports === 'function' &&
                 CSS.supports('selector(::highlight(x))');
        } catch { return false; }
      })(),
      rangeAPI: typeof Range !== 'undefined',
      priority: hasHighlights && typeof Highlight !== 'undefined' && 'priority' in Highlight.prototype,
      type: hasHighlights && typeof Highlight !== 'undefined' && 'type' in Highlight.prototype,
      setLike: typeof Highlight !== 'undefined' &&
               typeof Highlight.prototype.forEach === 'function' &&
               'size' in Highlight.prototype,
    };
  }

  // —— 安全注册/清理 Highlight ——

  _registerHighlight(name: any,highlight: any) {
    if (!this._flags().highlightsAPI) return false;
    try {
      CSS.highlights.set(name, highlight);
      if (!this._registeredHighlights.includes(name)) {
        this._registeredHighlights.push(name);
      }
      return true;
    } catch (e: any) {
      this._addLog('error', `注册 Highlight "${name}" 失败：${e.message}`);
      return false;
    }
  }

  _unregisterHighlight(name: any) {
    if (!this._flags().highlightsAPI) return;
    try {
      CSS.highlights.delete(name);
      this._registeredHighlights = this._registeredHighlights.filter(n => n !== name);
    } catch { /* noop */ }
  }

  // ===================== Card 1：CSS.highlights + Highlight 基础 =====================

  _runBasicsDemo(): void {
    const f = this._flags();
    const info = [
      '===== CSS.highlights 注册表 + Highlight 对象 基础 =====',
      '',
      '【动机】',
      '  传统文本高亮必须修改 DOM：包 <mark>、<span class="highlight">，',
      '  破坏原结构、影响事件委托、增加 DOM 节点、与 React/Vue 虚拟 DOM 冲突。',
      '  Custom Highlight API 用 Range 标记区间，DOM 完全不动。',
      '',
      '【CSS.highlights 全局注册表】',
      '  // 类似 CSS.stylesheets，但用 Map 接口',
      '  CSS.highlights.set("search", highlight);  // 注册',
      '  CSS.highlights.get("search");              // 取回',
      '  CSS.highlights.delete("search");           // 移除',
      '  CSS.highlights.clear();                     // 清空全部',
      '  CSS.highlights.has("search");               // 是否存在',
      '  (CSS.highlights as any).entries();                   // [name, highlight] 迭代',
      '  (CSS.highlights as any).keys();                       // name 迭代',
      '  (CSS.highlights as any).values();                     // highlight 迭代',
      '  CSS.highlights.forEach((hl, name) => { ... });',
      '  CSS.highlights.size;                         // 已注册数量',
      '',
      '【Highlight 对象 —— Range 集合】',
      '  // 构造：可传入 0 个或多个 Range',
      '  const hl = new Highlight();',
      '  const hl = new Highlight(range1);',
      '  const hl = new Highlight(range1, range2, range3);',
      '',
      '  // Set-like 接口',
      '  hl.add(range4);          // 添加',
      '  hl.delete(range1);       // 移除',
      '  hl.clear();              // 清空全部',
      '  hl.has(range2);          // 是否包含',
      '  hl.size;                 // 当前 Range 数量',
      '  hl.forEach(range => { ... });',
      '',
      '  // 可迭代',
      '  for (const range of hl) { ... }',
      '  const arr = [...hl];     // 转 Range 数组',
      '',
      '【Range 创建 —— 用 document.createRange()】',
      '  // 基础：选中某元素的全部文本',
      '  const r1 = new Range();',
      '  r1.selectNode(document.querySelector("p"));',
      '',
      '  // 精细：选中文本节点的一段',
      '  const textNode = document.querySelector("p").firstChild;',
      '  const r2 = new Range();',
      '  r2.setStart(textNode, 5);     // 从第 5 个字符开始',
      '  r2.setEnd(textNode, 15);       // 到第 15 个字符',
      '',
      '  // 跨节点：startContainer/endContainer 可不同',
      '  const r3 = new Range();',
      '  r3.setStart(node1, 0);',
      '  r3.setEnd(node2, 5);',
      '',
      '【完整最小示例】',
      '  <p id="text">Hello, Custom Highlight API!</p>',
      '',
      '  const p = (document.getElementById("text") as any);',
      '  const textNode = p.firstChild;',
      '  const range = new Range();',
      '  range.setStart(textNode, 7);       // "Custom"',
      '  range.setEnd(textNode, 13);',
      '',
      '  const highlight = new Highlight(range);',
      '  CSS.highlights.set("my-highlight", highlight);',
      '',
      '  /* CSS 样式化 */',
      '  ::highlight(my-highlight) {',
      '    background-color: #fef08a;',
      '    color: #1e293b;',
      '  }',
      '',
      '【Highlight 是 Set-like 但不是 Set 子类】',
      '  // 实现 Set-like 协议：size/has/add/delete/clear/forEach/迭代',
      '  // 但不是 Set 的实例：',
      '  new Highlight() instanceof Set;   // false',
      '  // 不能用 Set 静态方法：Set.intersection(hl1, hl2) // 报错',
      '',
      '【更新 Highlight 自动触发重绘】',
      '  // 修改 hl 内的 Range 集合后，',
      '  // 浏览器自动重绘对应区域，无需手动调用任何 refresh 方法',
      '  hl.add(newRange);     // 立即生效',
      '  hl.delete(oldRange);  // 立即生效',
      '  range.setEnd(textNode, 20);  // 改 Range 边界也立即生效',
      '',
      '【卸载页面时自动清理】',
      '  // Highlight 与 Range 都是 JS 对象，',
      '  // 当 Range 引用的 DOM 节点被移除时，',
      '  // Range 自动失效但不会自动从 Highlight 移除',
      '  // 建议在组件卸载时显式 hl.clear() 或 CSS.highlights.delete(name)',
      '',
      '【浏览器支持】',
      `  CSS.highlights: ${f.highlightsAPI ? '✓' : '✗'} (Chrome 105+/Safari 17.2+)`,
      `  Highlight 构造器: ${f.highlightCtor ? '✓' : '✗'}`,
      `  Set-like 接口: ${f.setLike ? '✓' : '✗'}`,
      `  Range API: ${f.rangeAPI ? '✓' : '✗'} (所有浏览器支持)`,
      '',
      '【规范】',
      '  https://www.w3.org/TR/css-highlight-api-1/',
      '  https://developer.mozilla.org/docs/Web/CSS/CSS_Custom_Highlight_API',
    ].join('\n');
    this.setState({ basicsInfo: info });
    this._addLog('css', `CSS.highlights + Highlight 基础演示完成；supports=${f.highlightsAPI}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. CSS.highlights + Highlight 对象 —— 注册表与 Range 集合',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['CSS.highlights', f.highlightsAPI],
          ['Highlight', f.highlightCtor],
        ]),
        h(Tag, { color: 'primary' }, 'Highlight API L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS.highlights 是全局 HighlightRegistry（类似 CSS.stylesheets），用 set/get/delete/clear/entries/keys/values/forEach/size 管理。Highlight 是 Range 集合（Set-like：add/delete/has/clear/forEach/size/迭代），构造器可传任意多个 Range。修改 Highlight 内 Range 后浏览器自动重绘，无需 refresh。Chrome 105+/Safari 17.2+ 支持。Range API 全浏览器可用。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行基础演示', { type: 'primary', size: 'sm', onClick: () => this._runBasicsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.basicsInfo || '（点击按钮查看 CSS.highlights + Highlight 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：::highlight() 伪元素 =====================

  _runPseudoDemo(): void {
    const f = this._flags();
    this._injectStyle('ch-pseudo-demo', `
      ::highlight(ch-yellow) {
        background-color: #fef08a;
        color: #1e293b;
      }
      ::highlight(ch-green) {
        background-color: #bbf7d0;
        color: #14532d;
      }
      ::highlight(ch-underline) {
        text-decoration: underline wavy #ef4444;
        text-decoration-thickness: 2px;
        text-underline-offset: 2px;
      }
      ::highlight(ch-outline) {
        outline: 2px solid #3b82f6;
        outline-offset: 1px;
      }
    `);

    // 尝试注册实际 Highlight（jsdom 可能不支持，但不会抛异常）
    let liveResult = '';
    if (f.rangeAPI && f.highlightCtor) {
      try {
        // 在演示容器内查找文本节点并创建 Range
        const demoText = document.querySelector('.ch-pseudo-text');
        if (demoText && demoText.firstChild) {
          const text = demoText.firstChild.textContent;
          // 找 "Highlight" 单词的位置
          const idx1 = text!.indexOf('Highlight');
          const idx2 = text!.indexOf('API');
          if (idx1 >= 0) {
            const r1 = new Range();
            r1.setStart(demoText.firstChild, idx1);
            r1.setEnd(demoText.firstChild, idx1 + 'Highlight'.length);
            this._registerHighlight('ch-yellow', new Highlight(r1));
          }
          if (idx2 >= 0) {
            const r2 = new Range();
            r2.setStart(demoText.firstChild, idx2);
            r2.setEnd(demoText.firstChild, idx2 + 'API'.length);
            this._registerHighlight('ch-green', new Highlight(r2));
          }
          liveResult = `已在演示文本中注册 2 个高亮：ch-yellow（Highlight 单词）、ch-green（API 单词）。`;
        }
      } catch (e: any) {
        liveResult = `实时注册失败（jsdom 限制）：${e.message}；代码示例已展示。`;
      }
    }

    const info = [
      '===== ::highlight(<custom-name>) 伪元素 —— 用 CSS 样式化高亮 =====',
      '',
      '【语法】',
      '  ::highlight(<custom-name>) {',
      '    /* 仅支持「文本相关」属性 */',
      '    color: <color>;',
      '    background-color: <color>;',
      '    text-decoration: <line> <style> <color>;',
      '    text-decoration-thickness: <length>;',
      '    text-underline-offset: <length>;',
      '    caret-color: <color>;',
      '    outline: <width> <style> <color>;',
      '    outline-offset: <length>;',
      '    stroke: <color>;       /* SVG 文本 */',
      '    fill: <color>;          /* SVG 文本 */',
      '    fill-opacity: <number>;',
      '    stroke-width: <length>;',
      '  }',
      '',
      '【支持的属性（白名单）】',
      '  - color',
      '  - background-color',
      '  - text-decoration 及其子属性',
      '  - text-shadow（部分浏览器）',
      '  - caret-color',
      '  - outline 及其子属性',
      '  - stroke/fill/stroke-width/fill-opacity（SVG 文本）',
      '',
      '【不支持的属性（关键限制）】',
      '  ✗ box-shadow / text-shadow（部分浏览器）',
      '  ✗ border / border-radius',
      '  ✗ padding / margin',
      '  ✗ transform / filter',
      '  ✗ width / height',
      '  ✗ display / position',
      '  ✗ font-* 系列字号/字重',
      '  原因：高亮是「视觉装饰层」不参与布局，',
      '        不能改变文本盒子尺寸/位置，避免重排',
      '',
      '【完整示例：四种高亮样式】',
      '  /* 黄色背景：搜索结果标记 */',
      '  ::highlight(search-result) {',
      '    background-color: #fef08a;',
      '    color: #1e293b;',
      '  }',
      '',
      '  /* 绿色背景：已访问结果 */',
      '  ::highlight(visited) {',
      '    background-color: #bbf7d0;',
      '    color: #14532d;',
      '  }',
      '',
      '  /* 红色波浪线：拼写错误 */',
      '  ::highlight(spell-error) {',
      '    text-decoration: underline wavy #ef4444;',
      '    text-decoration-thickness: 2px;',
      '    text-underline-offset: 2px;',
      '  }',
      '',
      '  /* 蓝色外框：批注/评审 */',
      '  ::highlight(comment) {',
      '    outline: 2px solid #3b82f6;',
      '    outline-offset: 1px;',
      '  }',
      '',
      '【与文字组合的常见模式】',
      '  /* 搜索高亮：黄底黑字 */',
      '  ::highlight(search) {',
      '    background-color: #fef08a;',
      '    color: #1e293b;',
      '    border-radius: 2px;        /* 无效！border-radius 不支持 */',
      '  }',
      '  // 不能做圆角，要圆角必须用 <span class="highlight"> 修改 DOM',
      '',
      '【SVG 文本高亮】',
      '  <svg><text x="10" y="20">SVG 文本</text></svg>',
      '  ::highlight(svg-highlight) {',
      '    fill: #ef4444;',
      '    stroke: #1e40af;',
      '    stroke-width: 0.5px;',
      '  }',
      '',
      '【跨元素高亮：单个 Highlight 包含多个 Range】',
      '  const r1 = new Range(); r1.selectNode(h1);',
      '  const r2 = new Range(); r2.selectNode(p);',
      '  const r3 = new Range(); r3.selectNode(li);',
      '  CSS.highlights.set("all-elements", new Highlight(r1, r2, r3));',
      '  // 三个元素同时高亮，共享同一 ::highlight(all-elements) 样式',
      '',
      '【动态切换样式：媒体查询/状态伪类】',
      '  ::highlight(search) { background-color: #fef08a; }',
      '  @media (prefers-color-scheme: dark) {',
      '    ::highlight(search) { background-color: #ca8a04; color: #fefce8; }',
      '  }',
      '  ::highlight(search) { /* 默认 */ }',
      '  :hover ::highlight(search) { /* 父级 hover 时改样式 */ }',
      '  // 注：:hover 不能直接放在 ::highlight 前，',
      '  // 但可放在父元素选择器前（实际支持有限，建议测试）',
      '',
      '【浏览器支持】',
      `  ::highlight(): ${f.pseudo ? '✓' : '✗'} (Chrome 105+/Safari 17.2+/Firefox 140+)`,
      '',
      liveResult ? `【实时演示】${liveResult}` : '',
    ].filter(Boolean).join('\n');
    this.setState({ pseudoInfo: info });
    this._addLog('css', `::highlight() 演示完成；supports=${f.pseudo}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. ::highlight(<custom-name>) 伪元素 —— CSS 样式化高亮',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['::highlight()', f.pseudo]]),
        h(Tag, { color: 'primary' }, '伪元素'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '::highlight(<name>) 伪元素用 CSS 样式化注册的高亮。仅支持文本相关属性白名单：color/background-color/text-decoration 及子属性/caret-color/outline 及子属性/stroke/fill/stroke-width（SVG 文本）。不支持 box-shadow/border/padding/transform/font-* 等会触发布局的属性（高亮是视觉装饰层不参与布局）。可配合 @prefers-color-scheme 自适应深色模式。',
        ),
        h('div', { class: 'ch-demo' },
          h('p', { class: 'ch-demo-text ch-pseudo-text' }, '这段演示文本中的 Highlight 和 API 单词会被自动高亮。'),
        ),
        h('div', { class: 'ch-highlight-legend' },
          h('span', { class: 'ch-legend-item' },
            h('span', { class: 'ch-legend-swatch', style: { background: '#fef08a' } }), 'ch-yellow (Highlight 单词)'),
          h('span', { class: 'ch-legend-item' },
            h('span', { class: 'ch-legend-swatch', style: { background: '#bbf7d0' } }), 'ch-green (API 单词)'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 ::highlight() 演示', { type: 'primary', size: 'sm', onClick: () => this._runPseudoDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pseudoInfo || '（点击按钮查看 ::highlight() 伪元素完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：priority 多重高亮叠层 =====================

  _runPriorityDemo(): void {
    const f = this._flags();
    const info = [
      '===== priority 属性 —— 多重高亮重叠时叠层顺序 =====',
      '',
      '【动机】',
      '  同一段文本可能同时被多个高亮覆盖：',
      '  - 搜索高亮 + 拼写错误高亮',
      '  - 用户选区 + 他人选区（协同编辑）',
      '  - 阅读进度 + 章节标记',
      '  重叠区域用谁的样式？priority 控制。',
      '',
      '【priority 属性】',
      '  const hl = new Highlight(range);',
      '  (hl as any).priority = 1;     // 数值越大优先级越高，渲染在上层',
      '  (hl as any).priority = 0;     // 默认值',
      '  (hl as any).priority = -1;    // 可为负数',
      '',
      '【叠层规则】',
      '  1. 浏览器收集所有覆盖该字符的 Highlight',
      '  2. 按 priority 从大到小排序',
      '  3. 相同 priority 按注册顺序（先注册的在上）',
      '  4. 高优先级高亮的样式覆盖低优先级的',
      '  5. 各属性的覆盖独立：A 设 color，B 设 background，',
      '     即使 A priority 高，B 的 background 仍生效',
      '',
      '【完整示例：三层高亮】',
      '  /* 文本：搜索结果 + 拼写错误 + 阅读进度 */',
      '  const textNode = document.querySelector("p").firstChild;',
      '',
      '  // 搜索结果：priority=2，最高',
      '  const searchRange = new Range();',
      '  searchRange.setStart(textNode, 0);',
      '  searchRange.setEnd(textNode, 20);',
      '  const searchHl = new Highlight(searchRange);',
      '  (searchHl as any).priority = 2;',
      '  CSS.highlights.set("search", searchHl);',
      '',
      '  // 拼写错误：priority=1，中层',
      '  const spellRange = new Range();',
      '  spellRange.setStart(textNode, 5);',
      '  spellRange.setEnd(textNode, 15);',
      '  const spellHl = new Highlight(spellRange);',
      '  (spellHl as any).priority = 1;',
      '  CSS.highlights.set("spell", spellHl);',
      '',
      '  // 阅读进度：priority=0，最低',
      '  const progressRange = new Range();',
      '  progressRange.setStart(textNode, 0);',
      '  progressRange.setEnd(textNode, 30);',
      '  const progressHl = new Highlight(progressRange);',
      '  (progressHl as any).priority = 0;',
      '  CSS.highlights.set("progress", progressHl);',
      '',
      '  /* CSS */',
      '  ::highlight(search) { background-color: #fef08a; color: #1e293b; }',
      '  ::highlight(spell) { text-decoration: underline wavy #ef4444; }',
      '  ::highlight(progress) { background-color: #dbeafe; }',
      '',
      '  /* 渲染效果：',
      '     [0,20] 蓝底（progress）→ 黄底覆盖（search）',
      '     [0,5] 蓝底 + 黄字（search 优先）',
      '     [5,15] 蓝底 → 黄底 + 红波浪线（spell 的 text-decoration 不被覆盖）',
      '     [15,20] 蓝底 + 黄底',
      '     [20,30] 仅蓝底（progress）',
      '  */',
      '',
      '【属性级独立覆盖】',
      '  // 即使 priority 低，只要某属性高 priority 高亮未设，',
      '  // 低 priority 高亮的该属性仍生效',
      '  ::highlight(a) { background-color: yellow; }  // priority=2',
      '  ::highlight(b) { color: red; }                // priority=1',
      '  // 重叠区域：黄底 + 红字（两者并存）',
      '',
      '【动态调整 priority】',
      '  // 修改 priority 立即生效，无需重新注册',
      '  (searchHl as any).priority = 10;',
      '  // 通常用于：',
      '  // - 用户切换搜索结果时提升当前项 priority',
      '  // - 协同编辑中当前用户选区 priority 高于他人',
      '',
      '【协同编辑场景：多人选区】',
      '  const aliceRange = new Range();',
      '  aliceRange.selectNode(textNode);',
      '  const aliceHl = new Highlight(aliceRange);',
      '  (aliceHl as any).priority = 1;  // 普通用户',
      '  CSS.highlights.set("alice-cursor", aliceHl);',
      '',
      '  const bobRange = new Range();',
      '  bobRange.selectNode(textNode);',
      '  const bobHl = new Highlight(bobRange);',
      '  (bobHl as any).priority = 1;    // 同 priority 按注册顺序',
      '  CSS.highlights.set("bob-cursor", bobHl);',
      '',
      '  // 当前用户提升自己的 priority',
      '  if (currentUser === "alice") (aliceHl as any).priority = 5;',
      '',
      '【vs z-index】',
      '  - z-index 仅对定位元素生效（position != static）',
      '  - priority 是 Highlight 专属，不影响 DOM 元素',
      '  - 两者完全独立：高亮的 priority 不影响其下 DOM 元素的 z-index',
      '',
      '【浏览器支持】',
      `  Highlight.prototype.priority: ${(f as any).priority ? '✓' : '✗'} (Chrome 105+/Safari 17.2+)`,
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → 选中含高亮的元素',
      '  → Computed 面板可看到 ::highlight(name) 应用样式',
      '  → 暂无专门的 Highlight 调试面板，需手动 console.log(CSS.highlights)',
    ].join('\n');
    this.setState({ priorityInfo: info });
    this._addLog('css', `priority 演示完成；supports=${(f as any).priority}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. priority 属性 —— 多重高亮叠层顺序',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['priority', (f as any).priority]]),
        h(Tag, { color: 'primary' }, '叠层'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '(highlight as any).priority = <number> 控制多重高亮重叠时的叠层顺序（数值越大越上层，默认 0 可为负）。相同 priority 按注册顺序。各属性独立覆盖：A 设 color，B 设 background，即使 A priority 高 B 的 background 仍生效。协同编辑场景：当前用户选区 priority 高于他人。修改 priority 立即生效无需重新注册。Chrome 105+/Safari 17.2+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 priority 演示', { type: 'primary', size: 'sm', onClick: () => this._runPriorityDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.priorityInfo || '（点击按钮查看 priority 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：type 语义分类 =====================

  _runTypeDemo(): void {
    const f = this._flags();
    const info = [
      '===== Highlight.prototype.type —— 语义分类 =====',
      '',
      '【动机】',
      '  不同高亮有不同语义：拼写错误、搜索结果、用户选区、协同他人选区、',
      '  阅读进度、批注评审等。辅助技术（屏幕阅读器）需识别语义才能正确朗读。',
      '  type 属性为高亮声明语义分类，便于 AT 与未来扩展。',
      '',
      '【type 属性取值】',
      '  highlight.type = "search-result";   // 搜索结果',
      '  highlight.type = "spell-error";     // 拼写错误',
      '  highlight.type = "grammar-error";   // 语法错误',
      '  highlight.type = "text-selection";  // 文本选区',
      '  highlight.type = "highlight";       // 一般高亮（默认）',
      '',
      '【完整示例】',
      '  const searchHl = new Highlight(range);',
      '  searchHl.type = "search-result";',
      '  CSS.highlights.set("search", searchHl);',
      '',
      '  const spellHl = new Highlight(spellRange);',
      '  spellHl.type = "spell-error";',
      '  CSS.highlights.set("spell", spellHl);',
      '',
      '  /* 即使 type 不同，::highlight(name) 样式仍独立设置 */',
      '  ::highlight(search) { background-color: yellow; }',
      '  ::highlight(spell) { text-decoration: underline wavy red; }',
      '',
      '【规范定义的 type 值】',
      '  规范预定义以下语义类型（来自 ARIA）：',
      '  - search-result：搜索结果匹配',
      '  - spell-error：拼写错误',
      '  - grammar-error：语法错误',
      '  - text-selection：用户文本选区',
      '  - highlight：通用高亮（默认值）',
      '',
      '【与 ARIA role 的关系】',
      '  - type 不是 ARIA 属性，但语义对齐',
      '  - 浏览器未来可能将 type 映射到 ARIA 角色',
      '  - 屏幕阅读器朗读时可根据 type 调整提示',
      '    例：「搜索结果」vs「拼写错误」会有不同语音反馈',
      '',
      '【AT 支持现状（截至 2025）】',
      '  - Chrome 已实现 type 属性',
      '  - 屏幕阅读器（VoiceOver/NVDA/JAWS）支持有限',
      '  - 大部分 AT 仍将高亮视为「一般文本」朗读',
      '  - 未来 AT 改进后 type 将提供更好的无障碍体验',
      '',
      '【自定义 type 值】',
      '  // 规范允许任意字符串，但未在 AT 中定义的会被忽略',
      '  highlight.type = "my-custom-type";  // 不会报错但 AT 不识别',
      '  // 建议优先用规范预定义的 5 个值',
      '',
      '【type vs 自定义 data-* 属性】',
      '  // 不能在 Highlight 上设 data-*（不是 HTMLElement）',
      '  // 可用 WeakMap 关联元数据：',
      '  const meta = new WeakMap();',
      '  meta.set(highlight, { author: "alice", timestamp: Date.now() });',
      '',
      '【与其他属性的关系】',
      '  // type 与 priority 独立：',
      '  hl.type = "search-result";',
      '  (hl as any).priority = 5;  // 可同时设',
      '',
      '  // type 不影响样式：',
      '  // ::highlight(name) 仍按 name 匹配，不按 type',
      '  // type 仅用于语义标注',
      '',
      '【浏览器支持】',
      `  Highlight.prototype.type: ${f.type ? '✓' : '✗'} (Chrome 105+/Safari 17.2+)`,
      '  AT 支持：有限，持续改进中',
      '',
      '【规范参考】',
      '  https://www.w3.org/TR/css-highlight-api-1/#highlight-type',
      '  https://w3c.github.io/csswg-drafts/css-highlight-api/',
    ].join('\n');
    this.setState({ typeInfo: info });
    this._addLog('css', `type 属性演示完成；supports=${f.type}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. Highlight.prototype.type —— 语义分类',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['type', f.type]]),
        h(Tag, { color: 'primary' }, '语义'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'highlight.type = "search-result"|"spell-error"|"grammar-error"|"text-selection"|"highlight" 为高亮声明语义分类。规范预定义 5 个值，便于辅助技术（屏幕阅读器）识别高亮用途。type 不影响样式（::highlight 仍按 name 匹配），与 priority 独立。AT 支持有限但持续改进，未来可提供更好的无障碍体验。Chrome 105+/Safari 17.2+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 type 演示', { type: 'primary', size: 'sm', onClick: () => this._runTypeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.typeInfo || '（点击按钮查看 type 属性完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：典型场景与实战（含实时搜索演示）=====================

  _runPatternsDemo(): void {
    const f = this._flags();
    const info = [
      '===== CSS Custom Highlight API 典型场景与实战 =====',
      '',
      '【场景 1：搜索结果高亮（最经典）】',
      '  // HTML',
      '  <input id="search" placeholder="搜索关键词" />',
      '  <article id="content">...</article>',
      '',
      '  // JS：监听输入，实时高亮所有匹配',
      '  const input = (document.getElementById("search") as any);',
      '  const content = (document.getElementById("content") as any);',
      '',
      '  let highlight = new Highlight();',
      '  CSS.highlights.set("search", highlight);',
      '',
      '  input.addEventListener("input", () => {',
      '    highlight.clear();',
      '    const query = input.value.trim();',
      '    if (!query) return;',
      '',
      '    // 遍历 content 内所有文本节点',
      '    const walker = document.createTreeWalker(',
      '      content, NodeFilter.SHOW_TEXT, null',
      '    );',
      '    let node;',
      '    while (node = walker.nextNode()) {',
      '      const text = node.textContent.toLowerCase();',
      '      const q = query.toLowerCase();',
      '      let idx = text.indexOf(q);',
      '      while (idx >= 0) {',
      '        const r = new Range();',
      '        r.setStart(node, idx);',
      '        r.setEnd(node, idx + q.length);',
      '        highlight.add(r);',
      '        idx = text.indexOf(q, idx + q.length);',
      '      }',
      '    }',
      '  });',
      '',
      '  /* CSS */',
      '  ::highlight(search) {',
      '    background-color: #fef08a;',
      '    color: #1e293b;',
      '  }',
      '',
      '【场景 2：拼写检查高亮】',
      '  // 接收后端拼写检查结果，标注错误单词',
      '  async function checkSpelling(text) {',
      '    const res = await fetch("/api/spellcheck", {',
      '      method: "POST",',
      '      body: JSON.stringify({ text }),',
      '    });',
      '    return res.json(); // { errors: [{start, end, suggestions: []}] }',
      '  }',
      '',
      '  const spellHl = new Highlight();',
      '  spellHl.type = "spell-error";',
      '  CSS.highlights.set("spell", spellHl);',
      '',
      '  async function updateSpellcheck() {',
      '    spellHl.clear();',
      '    const errors = await checkSpelling(editor.textContent);',
      '    for (const err of errors) {',
      '      const r = new Range();',
      '      r.setStart(textNode, err.start);',
      '      r.setEnd(textNode, err.end);',
      '      spellHl.add(r);',
      '    }',
      '  }',
      '',
      '  ::highlight(spell) {',
      '    text-decoration: underline wavy #ef4444;',
      '    text-decoration-thickness: 2px;',
      '  }',
      '',
      '【场景 3：协同编辑他人选区】',
      '  // WebSocket 接收其他用户的选区位置',
      '  const ws = new WebSocket("wss://collab.example.com");',
      '  const userHighlights = new Map(); // userId -> Highlight',
      '',
      '  ws.onmessage = (e) => {',
      '    const { userId, ranges, color } = JSON.parse(e.data);',
      '    let hl = userHighlights.get(userId);',
      '    if (!hl) {',
      '      hl = new Highlight();',
      '      (hl as any).priority = 1;',
      '      CSS.highlights.set(`user-${userId}`, hl);',
      '      userHighlights.set(userId, hl);',
      '    }',
      '    hl.clear();',
      '    for (const { start, end } of ranges) {',
      '      const r = new Range();',
      '      r.setStart(textNode, start);',
      '      r.setEnd(textNode, end);',
      '      hl.add(r);',
      '    }',
      '  };',
      '',
      '  /* 每个用户用不同颜色 */',
      '  ::highlight(user-alice) { background-color: rgba(255,235,59,0.5); }',
      '  ::highlight(user-bob)   { background-color: rgba(59,235,255,0.5); }',
      '  ::highlight(user-carol) { background-color: rgba(255,59,235,0.5); }',
      '',
      '【场景 4：代码评审批注】',
      '  // 锚定代码行号范围高亮',
      '  const reviewHl = new Highlight();',
      '  CSS.highlights.set("review-comment", reviewHl);',
      '',
      '  // 评审数据：[{ line: 5, endLine: 8, comment: "建议重构" }]',
      '  comments.forEach(c => {',
      '    const startEl = codeLines[c.line];',
      '    const endEl = codeLines[c.endLine];',
      '    const r = new Range();',
      '    r.setStartBefore(startEl);',
      '    r.setEndAfter(endEl);',
      '    reviewHl.add(r);',
      '  });',
      '',
      '  ::highlight(review-comment) {',
      '    background-color: rgba(59, 130, 246, 0.2);',
      '    outline: 1px solid #3b82f6;',
      '    outline-offset: -1px;',
      '  }',
      '',
      '【场景 5：阅读进度条】',
      '  // 高亮已阅读的段落',
      '  const progressHl = new Highlight();',
      '  (progressHl as any).priority = -1;  // 最低优先级，不遮挡其他高亮',
      '  CSS.highlights.set("progress", progressHl);',
      '',
      '  const observer = new IntersectionObserver((entries) => {',
      '    entries.forEach(e => {',
      '      if (e.isIntersecting) {',
      '        const r = new Range();',
      '        r.selectNode(e.target);',
      '        progressHl.add(r);',
      '      }',
      '    });',
      '  }, { threshold: 0.5 });',
      '',
      '  document.querySelectorAll("p").forEach(p => observer.observe(p));',
      '',
      '  ::highlight(progress) {',
      '    background-color: rgba(34, 197, 94, 0.1);',
      '  }',
      '',
      '【场景 6：富文本编辑器装饰】',
      '  // CodeMirror/Monaco/ProseMirror 替代方案',
      '  // 高亮当前行、匹配括号、错误标记',
      '  const currentLineHl = new Highlight();',
      '  CSS.highlights.set("current-line", currentLineHl);',
      '',
      '  editor.addEventListener("selectionchange", () => {',
      '    currentLineHl.clear();',
      '    const { startContainer, startOffset } = window.getSelection().getRangeAt(0);',
      '    // 找到当前行的起止',
      '    const lineRange = getLineRange(startContainer, startOffset);',
      '    currentLineHl.add(lineRange);',
      '  });',
      '',
      '  ::highlight(current-line) {',
      '    background-color: rgba(255, 255, 255, 0.05);',
      '  }',
      '',
      '【场景 7：表单错误标记】',
      '  // 高亮表单中校验失败的字段标签',
      '  const errorHl = new Highlight();',
      '  errorHl.type = "grammar-error";',
      '  CSS.highlights.set("form-error", errorHl);',
      '',
      '  form.addEventListener("submit", (e: any) => {',
      '    errorHl.clear();',
      '    const errors = validateForm(form);',
      '    errors.forEach(({ labelEl}: any) => {',
      '      const r = new Range();',
      '      r.selectNode(labelEl);',
      '      errorHl.add(r);',
      '    });',
      '    if (errors.length) e.preventDefault();',
      '  });',
      '',
      '  ::highlight(form-error) {',
      '    color: #dc2626;',
      '    text-decoration: underline wavy #dc2626;',
      '  }',
      '',
      '【性能优化技巧】',
      '  1. 复用 Highlight 对象，clear() 后 add 新 Range，',
      '     不要每次 delete + new Highlight（保留 CSS 注册）',
      '  2. 大量匹配时用 requestIdleCallback 分批处理：',
      '     function* findMatches(text, query) { /* yield Range */ }',
      '     function step() {',
      '       const start = performance.now();',
      '       while (performance.now() - start < 16) {',
      '         const { value, done } = iter.next();',
      '         if (done) return;',
      '         if (value) highlight.add(value);',
      '       }',
      '       requestIdleCallback(step);',
      '     }',
      '  3. Range 引用的 DOM 节点被移除时，',
      '     Range 自动失效但留在 Highlight 中，建议定期清理：',
      '     for (const r of highlight) {',
      '       if (!r.startContainer.isConnected) highlight.delete(r);',
      '     }',
      '',
      '【与 React/Vue 集成】',
      '  // 高亮是 DOM 操作，不与虚拟 DOM 冲突',
      '  // React useEffect 中操作 CSS.highlights，',
      '  // cleanup 时 delete 已注册的高亮',
      '  useEffect(() => {',
      '    const hl = new Highlight();',
      '    CSS.highlights.set("my-hl", hl);',
      '    return () => CSS.highlights.delete("my-hl");',
      '  }, []);',
      '',
      '【浏览器支持】',
      `  CSS.highlights: ${f.highlightsAPI ? '✓' : '✗'} (Chrome 105+/Safari 17.2+/Firefox 140+)`,
      '  注意：Firefox 长期未支持，140+（2025）起开始支持',
    ].join('\n');
    this.setState({ patternsInfo: info });
    this._addLog('css', '典型场景与实战演示完成');
  }

  _runLiveSearchDemo(): void {
    const f = this._flags();
    if (!f.rangeAPI) {
      this.setState({ liveSearchResult: '当前环境不支持 Range API，无法运行实时搜索演示。' });
      return;
    }

    // 获取演示文本
    const demoText = document.querySelector('.ch-search-text');
    if (!demoText) {
      this.setState({ liveSearchResult: '演示文本未找到。' });
      return;
    }

    const input = document.querySelector('.ch-search-input') as HTMLInputElement | null;
    const query = (input?.value || 'Highlight').trim();

    // 准备或重置 Highlight
    let hl;
    if (f.highlightsAPI && CSS.highlights.has('ch-live-search')) {
      hl = CSS.highlights.get('ch-live-search');
      hl!.clear();
    } else if (f.highlightsAPI) {
      hl = new Highlight();
      (hl as any).priority = 5;
      CSS.highlights.set('ch-live-search', hl);
      this._registeredHighlights.push('ch-live-search');
    }

    // 注入样式
    this._injectStyle('ch-live-search-style', `
      ::highlight(ch-live-search) {
        background-color: #fde047;
        color: #1e293b;
      }
    `);

    // 在所有文本节点中搜索
    let matchCount = 0;
    const walker = document.createTreeWalker(
      demoText, NodeFilter.SHOW_TEXT, null
    );
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      const lowerText = text!.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let idx = 0;
      while ((idx = lowerText.indexOf(lowerQuery, idx)) >= 0) {
        if (f.highlightsAPI) {
          const r = new Range();
          r.setStart(node, idx);
          r.setEnd(node, idx + query.length);
          hl!.add(r);
        }
        matchCount++;
        idx += query.length;
      }
    }

    const result = [
      `搜索关键词："${query}"`,
      `匹配数量：${matchCount} 处`,
      `Highlight API 支持：${f.highlightsAPI ? '✓ 已注册到 CSS.highlights' : '✗ 仅统计未实际高亮'}`,
      f.highlightsAPI
        ? `当前 Highlight.size：${hl!.size}`
        : '提示：在 Chrome 105+/Safari 17.2+ 中可看到实际黄色高亮效果',
    ].join('\n');
    this.setState({ liveSearchResult: result });
    this._addLog('css', `实时搜索完成：query="${query}"，匹配 ${matchCount} 处`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 典型场景与实战（搜索/拼写/协同/批注/进度/编辑器/表单）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.highlightsAPI ? 'success' : 'error' }, `实时演示 ${f.highlightsAPI ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '7 大典型场景完整实战：搜索结果高亮（实时输入匹配 + TreeWalker 遍历文本节点）/ 拼写检查标注（后端 API + type=spell-error）/ 协同编辑他人选区（WebSocket + 每用户独立 Highlight + priority）/ 代码评审批注（行号范围 Range）/ 阅读进度（IntersectionObserver + 最低 priority）/ 富文本编辑器装饰（当前行高亮）/ 表单错误标记。含性能优化（复用 Highlight、requestIdleCallback 分批、清理失效 Range）与 React/Vue 集成模式。',
        ),
        h('div', { class: 'ch-demo' },
          h('div', { class: 'ch-search-bar' },
            h('input', {
              type: 'text',
              class: 'ch-search-input',
              value: 'Highlight',
              placeholder: '输入要搜索的关键词',
            }),
            this._btn('搜索高亮', { type: 'primary', size: 'sm', onClick: () => this._runLiveSearchDemo() }),
          ),
          h('div', { class: 'ch-demo-text ch-search-text' },
            'CSS Custom Highlight API 是浏览器原生的高亮 API。' +
            '它让开发者可以用 Range 对象标记文本区间，并用 ::highlight() 伪元素样式化。' +
            'Highlight 对象是 Range 的集合，类似 Set 但不是 Set 的子类。' +
            '通过 CSS.highlights 全局注册表管理所有高亮。'
          ),
          s.liveSearchResult
            ? h('pre', { class: 'ch-output' }, s.liveSearchResult)
            : h('div', { class: 'ch-stats' }, '点击「搜索高亮」按钮运行实时搜索演示'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('查看 7 大场景完整代码', { type: 'default', size: 'sm', onClick: () => this._runPatternsDemo() }),
        ),
        s.patternsInfo
          ? h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
              h('code', {}, s.patternsInfo))
          : null,
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：与 ::selection / <mark> / contentEditable 对比 =====================

  _runCompareDemo(): void {
    const f = this._flags();
    const info = [
      '===== CSS Custom Highlight API vs 其他高亮方案对比 =====',
      '',
      '【方案 A：::selection —— 浏览器原生选区】',
      '  /* 仅样式化用户当前选区 */',
      '  ::selection { background: yellow; }',
      '  ::selection { background: yellow; color: black; }',
      '',
      '  优点：',
      '    ✓ 零 JS，浏览器原生',
      '    ✓ 不修改 DOM',
      '    ✓ 全浏览器支持',
      '  缺点：',
      '    ✗ 仅能样式化「用户主动选中的文本」，无法程序化高亮',
      '    ✗ 同一时刻只能有一个选区',
      '    ✗ 失去焦点后选区消失',
      '',
      '【方案 B：<mark> 元素 —— HTML5 语义标签】',
      '  <p>Hello <mark>world</mark>!</p>',
      '  mark { background: yellow; }',
      '',
      '  优点：',
      '    ✓ HTML 语义化，对 SEO/AT 友好',
      '    ✓ 支持所有 CSS 属性（box-shadow/border-radius/transform 等）',
      '    ✓ 全浏览器支持',
      '  缺点：',
      '    ✗ 必须修改 DOM，破坏原结构',
      '    ✗ 与 React/Vue 虚拟 DOM 冲突（diff 时可能丢失）',
      '    ✗ 大量高亮时增加 DOM 节点，性能下降',
      '    ✗ 跨节点高亮需拆分多个 <mark>',
      '    ✗ 影响事件委托（e.target 变成 mark 不是原文本）',
      '',
      '【方案 C：<span class="highlight"> —— 通用 span 包裹】',
      '  <p>Hello <span class="highlight">world</span>!</p>',
      '  .highlight { background: yellow; }',
      '',
      '  优点：',
      '    ✓ 比 <mark> 更灵活（可加任意 class）',
      '    ✓ 支持所有 CSS 属性',
      '    ✓ 全浏览器支持',
      '  缺点：',
      '    ✗ 同 <mark>：修改 DOM、与框架冲突、性能问题',
      '    ✗ 无语义',
      '',
      '【方案 D：contentEditable + execCommand —— 富文本编辑】',
      '  document.execCommand("hiliteColor", false, "yellow");',
      '  // 在选区插入背景色',
      '',
      '  优点：',
      '    ✓ 用户可主动高亮',
      '    ✓ 持久化（保存 HTML 即可保留高亮）',
      '  缺点：',
      '    ✗ execCommand 已废弃',
      '    ✗ 同样修改 DOM',
      '    ✗ 与框架集成困难',
      '',
      '【方案 E：Canvas 叠加层 —— 自绘高亮】',
      '  // 在文本上叠加一个透明 canvas，',
      '  // 计算文本 bbox 后用 canvas 绘制矩形',
      '  const rect = range.getBoundingClientRect();',
      '  ctx.fillStyle = "yellow";',
      '  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);',
      '',
      '  优点：',
      '    ✓ 完全控制视觉效果（圆角、阴影、动画）',
      '    ✓ 不修改 DOM',
      '  缺点：',
      '    ✗ 性能差（每帧重绘）',
      '    ✗ 文本选择/复制受影响',
      '    ✗ 滚动/缩放需手动同步',
      '    ✗ 实现复杂',
      '',
      '【方案 F：SVG 叠加层 —— 矢量高亮】',
      '  // 类似 Canvas，但用 SVG <rect>',
      '  <svg style="position:absolute; pointer-events:none;">',
      '    <rect x="..." y="..." width="..." height="..." fill="yellow" />',
      '  </svg>',
      '',
      '  优点：',
      '    ✓ 矢量缩放清晰',
      '    ✓ 支持 SVG 滤镜/动画',
      '  缺点：',
      '    ✗ 同 Canvas：性能、滚动同步、实现复杂',
      '',
      '【方案 G：CSS Custom Highlight API —— 当前方案】',
      '  const range = new Range();',
      '  range.setStart(...); range.setEnd(...);',
      '  CSS.highlights.set("hl", new Highlight(range));',
      '  ::highlight(hl) { background: yellow; }',
      '',
      '  优点：',
      '    ✓ 不修改 DOM，与框架兼容',
      '    ✓ 性能优秀（浏览器原生）',
      '    ✓ 支持多重高亮（priority）',
      '    ✓ 支持跨节点 Range',
      '    ✓ 自动跟随滚动/重排',
      '  缺点：',
      '    ✗ 仅支持文本相关 CSS 属性（无圆角/阴影/动画）',
      '    ✗ 浏览器支持较新（Chrome 105+/Safari 17.2+/Firefox 140+）',
      '    ✗ AT 支持有限',
      '',
      '【对比表】',
      '  ┌──────────────┬──────┬──────┬──────────┬─────────┬─────────────┐',
      '  │ 方案         │ 改DOM│ 性能 │ CSS 属性 │ 多重高亮│ 浏览器支持  │',
      '  ├──────────────┼──────┼──────┼──────────┼─────────┼─────────────┤',
      '  │ ::selection  │ 否   │ 优秀 │ 文本相关 │ 否      │ 全部        │',
      '  │ <mark>       │ 是   │ 一般 │ 全部     │ 是      │ 全部        │',
      '  │ <span>       │ 是   │ 一般 │ 全部     │ 是      │ 全部        │',
      '  │ execCommand  │ 是   │ 差   │ 全部     │ 是      │ 全部(已废弃)│',
      '  │ Canvas 叠加  │ 否   │ 差   │ 全部     │ 是      │ 全部        │',
      '  │ SVG 叠加     │ 否   │ 差   │ 全部     │ 是      │ 全部        │',
      '  │ Custom HL    │ 否   │ 优秀 │ 文本相关 │ 是      │ C105+/S17.2 │',
      '  └──────────────┴──────┴──────┴──────────┴─────────┴─────────────┘',
      '',
      '【决策树】',
      '  1. 仅样式化用户当前选区？→ ::selection',
      '  2. 持久化高亮（保存到 DB）？→ <mark> 或 <span class="hl">',
      '  3. 程序化高亮 + 不改 DOM + 性能优先？→ CSS Custom Highlight API',
      '  4. 需要圆角/阴影/动画等高级视觉效果？→ Canvas/SVG 叠加 或 <mark>',
      '  5. 富文本编辑器？→ CodeMirror/Monaco/ProseMirror 内置方案',
      '',
      '【混合方案：Custom Highlight + <mark>】',
      '  // 临时高亮（搜索/拼写）用 Custom Highlight API',
      '  // 持久高亮（用户标注）用 <mark> 持久化到 DB',
      '  // 两者可并存，priority 控制：',
      '  mark { background-color: rgba(59, 130, 246, 0.3); }',
      '  ::highlight(search) { background-color: yellow; }',
      '',
      '【迁移指南：从 <mark> 到 Custom Highlight】',
      '  // 1. 移除 <mark> 包裹',
      '  // 2. 用 Range 重建区间（保存原 start/end offset）',
      '  // 3. 注册 Highlight 并设置 ::highlight 样式',
      '  // 4. 持久化策略改为保存 Range 数据（startContainer XPath + offset）',
      '',
      '【浏览器支持】',
      `  CSS.highlights: ${f.highlightsAPI ? '✓' : '✗'} (Chrome 105+/Safari 17.2+/Firefox 140+)`,
      '',
      '【Polyfill 现状】',
      '  - 无官方 polyfill（涉及底层渲染）',
      '  - 可用 <mark> 降级方案：feature detect 后回退',
      '  - if (!("highlights" in CSS)) { useMarkFallback(); }',
      '  - 第三方库 rangy 提供类似 API 但仍用 <span> 实现',
    ].join('\n');
    this.setState({ compareInfo: info });
    this._addLog('css', '方案对比演示完成');
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 与 ::selection / <mark> / contentEditable / Canvas 对比',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '方案对比'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '7 种高亮方案对比：::selection（仅用户选区，无 JS）/ <mark>（HTML 语义但改 DOM）/ <span class="hl">（同 mark 但无语义）/ execCommand hiliteColor（已废弃）/ Canvas 叠加（性能差但完全控制视觉）/ SVG 叠加（矢量但同 Canvas 问题）/ CSS Custom Highlight API（不改 DOM + 性能优秀 + 仅文本 CSS 属性）。含决策树与混合方案（临时高亮用 Custom Highlight + 持久化用 <mark>）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('查看方案对比', { type: 'primary', size: 'sm', onClick: () => this._runCompareDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.compareInfo || '（点击按钮查看 7 种高亮方案完整对比）')),
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
      h('h2', { class: 'section-title' }, 'CSS Custom Highlight API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Custom Highlight API —— 不修改 DOM 的文本高亮方案',
        description: '演示 CSS Custom Highlight API 全套能力：CSS.highlights 全局注册表（set/get/delete/clear/entries/forEach）+ Highlight 对象（Range 集合，Set-like 接口 add/delete/has/clear/forEach/size/迭代）+ ::highlight(<name>) 伪元素（仅支持 color/background/text-decoration/caret-color/outline/stroke/fill 等文本相关属性）+ priority 多重高亮叠层（数值越大越上层，各属性独立覆盖）+ type 语义分类（search-result/spell-error/grammar-error/text-selection/highlight）+ 7 大典型场景实战（搜索/拼写/协同编辑/代码评审/阅读进度/富文本编辑器装饰/表单错误）+ 与 ::selection/<mark>/Canvas/SVG 等 6 种方案对比。Chrome 105+/Safari 17.2+/Firefox 140+ 支持。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,

      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
        this._renderCard5(),
        this._renderCard6(),
      ),

      this._renderLogPanel(),
    ] as (Node | string)[];
  }
}
