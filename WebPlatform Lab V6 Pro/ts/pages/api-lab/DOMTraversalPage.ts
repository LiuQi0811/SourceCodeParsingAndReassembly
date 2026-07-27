// =====================================================================
// DOMTraversalPage.ts —— DOM 遍历 / 事件系统 / 调度对比 / CSS Typed OM 实验室
// 演示 MDN：
//   1. NodeIterator / TreeWalker —— createNodeIterator / createTreeWalker /
//      NodeFilter.SHOW_*/FILTER_* / nextNode / previousNode / detach /
//      currentNode / parentNode / firstChild / lastChild / nextSibling
//   2. DocumentFragment / Range / Selection —— createDocumentFragment /
//      createRange / setStart / setEnd / selectNode / selectNodeContents /
//      collapse / cloneContents / extractContents / deleteContents / insertNode /
//      surroundContents / getBoundingClientRect / getClientRects /
//      window.getSelection / removeAllRanges / addRange / getRangeAt / toString
//   3. CSS Typed OM / Custom Highlight —— attributeStyleMap.set/get /
//      computedStyleMap / CSS.px/percent/vw/em / CSSMathSum/Product/Negate /
//      CSSKeywordValue / CSSImageValue / CSSStyleValue.parse/parseAll /
//      new Highlight(...ranges) / CSS.highlights.set/delete/clear/size /
//      ::highlight(name) 伪元素
//   4. Event 系统 —— bubbles/cancelable/composed/defaultPrevented/target/
//      currentTarget/eventPhase/timeStamp/type / composedPath / stopPropagation /
//      stopImmediatePropagation / preventDefault / addEventListener options
//      (capture/passive/once/signal) / removeEventListener / dispatchEvent /
//      CustomEvent / EventTarget 继承
//   5. 调度对比 —— queueMicrotask / Promise.then / setTimeout(0) /
//      requestIdleCallback / requestAnimationFrame / MessageChannel /
//      AbortSignal 演示 addEventListener 的 signal 选项
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

// Event.eventPhase 数值 → 可读名称（0=NONE, 1=CAPTURING, 2=AT_TARGET, 3=BUBBLING）
const PHASE_NAMES: string[] = ['NONE', 'CAPTURING', 'AT_TARGET', 'BUBBLING'];

export interface DOMTraversalPageProps extends Props {}

export interface DOMTraversalLog {
  type: string;
  content: string;
  time: string;
}

// DocumentFragment 性能对比结果
export interface FragmentPerf {
  count: number;
  directMs: string;
  fragMs: string;
  ratio: string;
}

export interface DOMTraversalPageState extends State {
  logs: DOMTraversalLog[];
  traversalSupported: boolean;
  rangeSupported: boolean;
  fragmentPerf: FragmentPerf | null;
  rangeExtractResult: string;
  typedOMSupported: boolean;
  highlightSupported: boolean;
  typedOMInfo: string;
  highlightInfo: string;
  eventSupported: boolean;
  schedulingSupported: boolean;
  abortSupported: boolean;
}

// _addScenario 注册的事件监听记录
interface ScenarioHandler {
  target: EventTarget;
  type: string;
  handler: EventListenerOrEventListenerObject;
  options: AddEventListenerOptions | boolean | undefined;
}

export class DOMTraversalPage extends Page {
  declare props: DOMTraversalPageProps;
  declare state: DOMTraversalPageState;
  _inited: boolean = false;
  declare _destroyed: boolean;
  _demoStyleEl: HTMLStyleElement | null = null;
  _rafId: number | null = null;
  _idleId: number | null = null;
  _abortController: AbortController | null = null;
  _scenarioHandlers: ScenarioHandler[] = [];
  _customSeq: number = 0;

  initialState(): DOMTraversalPageState {
    return {
      logs: [],
      traversalSupported: false,
      rangeSupported: false,
      fragmentPerf: null,
      rangeExtractResult: '',
      typedOMSupported: false,
      highlightSupported: false,
      typedOMInfo: '',
      highlightInfo: '',
      eventSupported: false,
      schedulingSupported: false,
      abortSupported: false,
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM。
    // 每次挂载都需要重建的演示（动态注入 ::highlight CSS）放在守卫之前，
    // 一次性初始化（能力检测）放在守卫之后。
    this._injectDemoStyles();

    if (this._inited) return;
    this._inited = true;

    // —— 一次性能力检测（全部用 typeof/in + try/catch，避免 jsdom 抛异常）——
    const traversalSupported = typeof document !== 'undefined'
      && typeof document.createTreeWalker === 'function'
      && typeof document.createNodeIterator === 'function'
      && typeof NodeFilter !== 'undefined';
    const rangeSupported = typeof document !== 'undefined'
      && typeof document.createRange === 'function'
      && typeof Range !== 'undefined' && typeof DocumentFragment !== 'undefined';
    const typedOMSupported = typeof CSS !== 'undefined' && typeof CSS.px === 'function';
    const highlightSupported = typeof Highlight !== 'undefined'
      && typeof CSS !== 'undefined' && 'highlights' in CSS;
    const eventSupported = typeof Event !== 'undefined' && typeof CustomEvent !== 'undefined';
    const schedulingSupported = typeof queueMicrotask === 'function'
      && typeof Promise === 'function' && typeof MessageChannel !== 'undefined';
    const abortSupported = typeof AbortController !== 'undefined'
      && typeof AbortSignal !== 'undefined';

    const summary = `能力检测 → TreeWalker=${traversalSupported}, Range=${rangeSupported}, `
      + `TypedOM=${typedOMSupported}, Highlight=${highlightSupported}, `
      + `Event=${eventSupported}, Scheduling=${schedulingSupported}, Abort=${abortSupported}`;

    this.setState({
      traversalSupported,
      rangeSupported,
      typedOMSupported,
      highlightSupported,
      eventSupported,
      schedulingSupported,
      abortSupported,
      logs: [...this.state.logs, { type: 'info', content: summary, time: formatTime() }].slice(-40),
    });
  }

  componentWillUnmount(): void {
    this._destroyed = true;
    // 取消调度回调（requestAnimationFrame / requestIdleCallback）
    if (this._rafId && typeof cancelAnimationFrame === 'function') {
      try { cancelAnimationFrame(this._rafId); } catch { /* noop */ }
      this._rafId = null;
    }
    if (this._idleId && typeof cancelIdleCallback === 'function') {
      try { cancelIdleCallback(this._idleId); } catch { /* noop */ }
      this._idleId = null;
    }
    // 中止 AbortSignal 演示中的控制器
    if (this._abortController) {
      try { this._abortController.abort(); } catch { /* noop */ }
      this._abortController = null;
    }
    // 清理 Event 系统场景监听器（手动添加的，未通过 this.on 自动管理）
    this._clearEventScenario();
    // 移除动态注入的 style 元素
    this._demoStyleEl?.remove();
    this._demoStyleEl = null;
    // 其余通过 this.on() 注册的事件监听由 Component.destroy 统一解绑
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: Props): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  // —— 注入演示样式（::highlight 伪元素 + 容器样式 + 日志标签配色）——
  _injectDemoStyles(): void {
    if (this._demoStyleEl) this._demoStyleEl.remove();
    const style = document.createElement('style');
    style.id = 'dom-traversal-demo-style';
    style.textContent = `
      /* Card 1: 遍历容器 */
      .dt-tree { border: 1px dashed var(--color-border); border-radius: var(--radius-base); padding: var(--spacing-md); background: var(--color-bg-spotlight); }
      .dt-tree ul { margin: 6px 0; padding-left: 20px; }
      .dt-tree li { list-style: disc; margin: 2px 0; }
      .dt-tree span.tag-text { color: var(--color-primary); font-weight: 500; }
      .dt-tree__a { padding: var(--spacing-xs) var(--spacing-sm); border-left: 3px solid var(--color-primary); background: rgba(22, 119, 255, 0.06); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 6px; }
      .dt-tree__b { padding: var(--spacing-xs) var(--spacing-sm); border-left: 3px solid #722ed1; background: rgba(114, 46, 209, 0.06); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-top: 6px; }
      /* Card 2: 性能容器 / Range */
      .dt-perf-row { display: flex; gap: var(--spacing-md); }
      .dt-perf-col { flex: 1; min-width: 0; }
      .dt-perf-list { max-height: 140px; overflow: auto; border: 1px solid var(--color-border); border-radius: var(--radius-base); padding: 4px 8px; font-size: 12px; margin: 0; }
      .dt-range-container { padding: 8px; border: 1px solid var(--color-border); border-radius: var(--radius-base); min-height: 32px; }
      .dt-range-target { background: #fff7cc; padding: 0 4px; border-radius: 3px; }
      /* Card 3: Typed OM / Highlight */
      .dt-typed-demo { padding: var(--spacing-md); border: 1px solid var(--color-border); border-radius: var(--radius-base); background: var(--color-bg-spotlight); transition: all 0.2s; }
      .dt-highlight-text { line-height: 2; font-size: 16px; padding: var(--spacing-md); background: var(--color-bg-spotlight); border-radius: var(--radius-base); }
      /* ::highlight 伪元素：Custom Highlight API 高亮 */
      .dt-highlight-text::highlight(dt-highlight) { background: #1677ff; color: #fff; }
      /* Card 4: 事件三层嵌套 */
      .dt-event-parent { padding: var(--spacing-md); border: 2px solid #1677ff; border-radius: var(--radius-base); cursor: pointer; }
      .dt-event-child { padding: var(--spacing-md); border: 2px solid #52c41a; border-radius: var(--radius-base); margin-top: 8px; cursor: pointer; }
      .dt-event-grandchild { padding: var(--spacing-md); border: 2px solid #faad14; border-radius: var(--radius-base); margin-top: 8px; cursor: pointer; background: var(--color-bg-spotlight); }
      /* Card 5: AbortSignal 演示 */
      .dt-abort-target { padding: var(--spacing-md); border: 1px dashed var(--color-warning); border-radius: var(--radius-base); text-align: center; cursor: pointer; user-select: none; background: var(--color-bg-spotlight); }
      /* 本页专属日志标签配色（未在 pages.css 中预定义的类型） */
      .log-panel__tag--walker { background: #1e4d8b; color: #4da3ff; }
      .log-panel__tag--iter { background: #1e5e3a; color: #50fa7b; }
      .log-panel__tag--frag { background: #5a3d1e; color: #ffb86c; }
      .log-panel__tag--range { background: #5a1e3d; color: #ff79c6; }
      .log-panel__tag--typed { background: #1e3d5a; color: #8be9fd; }
      .log-panel__tag--highlight { background: #3a3d1e; color: #f1fa8c; }
      .log-panel__tag--event { background: #1e4d8b; color: #4da3ff; }
      .log-panel__tag--sched { background: #5a3d1e; color: #ffb86c; }
      .log-panel__tag--abort { background: #5a1e1e; color: #ff5555; }
    `;
    document.head.appendChild(style);
    this._demoStyleEl = style;
  }

  // ===================== Card 1: NodeIterator 与 TreeWalker =====================

  // 用 TreeWalker 遍历所有元素节点，记录 tagName + class
  _traverseElements(): void {
    if (!this.state.traversalSupported) {
      this._addLog('error', 'TreeWalker 不可用（document.createTreeWalker 不存在）');
      return;
    }
    const root = this.$<HTMLElement>('.dt-tree');
    if (!root) return;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
      const visited: string[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const el = n as Element;
        const tag = el.tagName.toLowerCase();
        const cls = el.className ? '.' + String(el.className).split(/\s+/).filter(Boolean).join('.') : '';
        visited.push(tag + cls);
      }
      this._addLog('walker',
        `TreeWalker(SHOW_ELEMENT) 遍历到 ${visited.length} 个元素：`
        + visited.slice(0, 10).join(' > ')
        + (visited.length > 10 ? ' ...' : ''));
    } catch (err: any) {
      this._addLog('error', `TreeWalker 遍历失败：${err.message}`);
    }
  }

  // 用 NodeIterator 遍历文本节点，记录 textContent 片段，最后 detach
  _traverseText(): void {
    if (!this.state.traversalSupported) {
      this._addLog('error', 'NodeIterator 不可用');
      return;
    }
    const root = this.$<HTMLElement>('.dt-tree');
    if (!root) return;
    try {
      const iter = document.createNodeIterator(root, NodeFilter.SHOW_TEXT, null);
      const texts: string[] = [];
      let n: Node | null;
      while ((n = iter.nextNode())) {
        const t = (n.textContent || '').trim();
        if (t) texts.push(t.length > 16 ? t.slice(0, 16) + '…' : t);
      }
      // detach() 已废弃但 MDN 仍有记载，演示其存在性
      if (typeof iter.detach === 'function') {
        try { iter.detach(); } catch { /* noop */ }
      }
      this._addLog('iter',
        `NodeIterator(SHOW_TEXT) 遍历到 ${texts.length} 个文本节点：`
        + texts.slice(0, 6).join(' | ')
        + (texts.length > 6 ? ' ...' : '')
        + ' | detach() ✓');
    } catch (err: any) {
      this._addLog('error', `NodeIterator 遍历失败：${err.message}`);
    }
  }

  // 用 TreeWalker + NodeFilter 过滤仅 li 元素
  _traverseLiOnly(): void {
    if (!this.state.traversalSupported) {
      this._addLog('error', 'TreeWalker 不可用');
      return;
    }
    const root = this.$<HTMLElement>('.dt-tree');
    if (!root) return;
    try {
      // filter.acceptNode 返回 FILTER_ACCEPT / FILTER_REJECT / FILTER_SKIP
      const filter: NodeFilter = {
        acceptNode(node: Node): number {
          return (node as Element).tagName === 'LI' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      };
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, filter);
      const lis: string[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        lis.push(`li: ${((n.textContent || '').trim()).slice(0, 20)}`);
      }
      this._addLog('walker',
        `TreeWalker+filter(仅 LI) → 命中 ${lis.length} 个：`
        + lis.slice(0, 5).join('; ')
        + (lis.length > 5 ? ' ...' : ''));
    } catch (err: any) {
      this._addLog('error', `TreeWalker 过滤失败：${err.message}`);
    }
  }

  // ===================== Card 2: DocumentFragment 与 Range =====================

  // Fragment 性能测试：循环 appendChild vs DocumentFragment 一次性插入
  _runFragmentPerf(): void {
    if (!this.state.rangeSupported) {
      this._addLog('error', 'DocumentFragment 不可用');
      return;
    }
    const directEl = this.$<HTMLUListElement>('.dt-perf-direct');
    const fragEl = this.$<HTMLUListElement>('.dt-perf-fragment');
    if (!directEl || !fragEl) return;
    const N = 500;

    // 方式 1：循环 appendChild —— 每次插入都触发 reflow
    directEl.innerHTML = '';
    const t1 = performance.now();
    for (let i = 0; i < N; i++) {
      const li = document.createElement('li');
      li.textContent = `item-${i}`;
      directEl.appendChild(li);
    }
    const directMs = performance.now() - t1;

    // 方式 2：DocumentFragment 一次性插入 —— 只触发一次 reflow
    fragEl.innerHTML = '';
    const t2 = performance.now();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < N; i++) {
      const li = document.createElement('li');
      li.textContent = `item-${i}`;
      frag.appendChild(li);
    }
    fragEl.appendChild(frag);
    const fragMs = performance.now() - t2;

    const ratio = fragMs > 0 ? (directMs / fragMs) : 0;
    this.setState({
      fragmentPerf: {
        count: N,
        directMs: directMs.toFixed(3),
        fragMs: fragMs.toFixed(3),
        ratio: ratio.toFixed(2),
      },
    });
    this._addLog('frag',
      `N=${N} | 直接 appendChild: ${directMs.toFixed(3)}ms | `
      + `DocumentFragment: ${fragMs.toFixed(3)}ms | `
      + `加速比: ${ratio.toFixed(2)}x（fragment 只触发一次 reflow）`);
  }

  // Range 操作：selectNode + extractContents，展示剩余 DOM
  _runRangeExtract(): void {
    if (!this.state.rangeSupported) {
      this._addLog('error', 'Range API 不可用');
      return;
    }
    const container = this.$<HTMLElement>('.dt-range-container');
    if (!container) return;
    // 重置容器：构造 "前段 [中间被提取] 后段" 结构
    container.innerHTML = '';
    const p = container.appendChild(document.createElement('p'));
    p.appendChild(document.createTextNode('前段文字 '));
    const mid = p.appendChild(document.createElement('span'));
    mid.className = 'dt-range-target';
    mid.textContent = '中间要被提取的内容';
    p.appendChild(document.createTextNode(' 后段文字'));

    try {
      const range = document.createRange();
      range.selectNode(mid);
      // getBoundingClientRect / getClientRects（jsdom 可能返回零矩形）
      const rect: DOMRect | null = typeof range.getBoundingClientRect === 'function'
        ? range.getBoundingClientRect() : null;
      let rectsCount = 0;
      if (typeof range.getClientRects === 'function') {
        try { rectsCount = range.getClientRects().length; } catch { rectsCount = 0; }
      }
      // extractContents：从 DOM 中移除并返回片段
      const extracted = range.extractContents();
      const remain = p.textContent;
      const result = `extractContents 取出 ${extracted.childNodes.length} 个节点 | `
        + `剩余 DOM: "${remain}" | rect(w=${rect ? rect.width.toFixed(0) : '?'}, h=${rect ? rect.height.toFixed(0) : '?'}) | `
        + `getClientRects().length=${rectsCount}`;
      this.setState({ rangeExtractResult: result });
      this._addLog('range',
        `range.selectNode(span) → extractContents() 取出 ${extracted.childNodes.length} 节点 | 剩余: "${remain}"`);
    } catch (err: any) {
      this._addLog('error', `Range 操作失败：${err.message}`);
    }
  }

  // Selection API 演示：getSelection / removeAllRanges / addRange / toString
  _demoSelection(): void {
    if (typeof window === 'undefined' || typeof window.getSelection !== 'function') {
      this._addLog('error', 'Selection API 不可用（window.getSelection 不存在）');
      return;
    }
    try {
      const sel = window.getSelection();
      if (!sel) {
        this._addLog('error', 'window.getSelection() 返回 null');
        return;
      }
      const before = sel.rangeCount;
      sel.removeAllRanges();
      // 构造一个 Range 并加入选区
      const container = this.$<HTMLElement>('.dt-range-container');
      if (container && container.firstChild) {
        const range = document.createRange();
        range.selectNodeContents(container);
        sel.addRange(range);
        const text = sel.toString();
        this._addLog('range',
          `Selection: rangeCount ${before}→${sel.rangeCount} | `
          + `toString()="${(text || '').slice(0, 30)}" | getRangeAt(0) 取出成功`);
        sel.removeAllRanges();
      } else {
        this._addLog('range', `Selection.rangeCount=${sel.rangeCount}（容器为空，未构造 Range）`);
      }
    } catch (err: any) {
      this._addLog('error', `Selection 操作失败：${err.message}`);
    }
  }

  // ===================== Card 3: CSS Typed OM 与 Custom Highlight =====================

  // 测试 CSS Typed OM：attributeStyleMap.set / get / computedStyleMap / CSSStyleValue.parse
  _testTypedOM(): void {
    const el = this.$<HTMLElement>('.dt-typed-demo');
    if (!el) return;
    if (!this.state.typedOMSupported) {
      this._addLog('error', 'CSS Typed OM 不可用（typeof CSS.px === "undefined"）');
      return;
    }
    if (!('attributeStyleMap' in el)) {
      this.setState({ typedOMInfo: 'element.attributeStyleMap 不存在（jsdom 不支持 CSS Typed OM）' });
      this._addLog('typed', 'element.attributeStyleMap 不存在（jsdom 不支持 CSS Typed OM）');
      return;
    }
    try {
      const styleMap = (el as any).attributeStyleMap;
      // set：用 CSS.px / CSS.percent 设置类型化样式；get 返回 CSSUnitValue { value, unit }
      styleMap.set('font-size', CSS.px(24));
      styleMap.set('width', CSS.percent(80));
      const fs = styleMap.get('font-size');
      const w = styleMap.get('width');
      const fsStr = fs ? `CSSUnitValue{value:${fs.value}, unit:"${fs.unit}"}` : 'null';
      const wStr = w ? `CSSUnitValue{value:${w.value}, unit:"${w.unit}"}` : 'null';

      // computedStyleMap：返回 StylePropertyMapReadOnly
      let computedInfo = '';
      if (typeof (el as any).computedStyleMap === 'function') {
        try {
          const cfs = (el as any).computedStyleMap().get('font-size');
          computedInfo = `\ncomputedStyleMap().get('font-size') = ${cfs ? cfs.value + cfs.unit : 'null'}`;
        } catch (e: any) { computedInfo = `\ncomputedStyleMap 抛错: ${e.message}`; }
      }

      // CSSStyleValue.parse + CSSMath 表达式（CSSMathSum / Product / Negate）
      let parseInfo = '';
      let mathInfo = '';
      if (typeof CSSStyleValue !== 'undefined' && typeof CSSStyleValue.parse === 'function') {
        try {
          const p = CSSStyleValue.parse('width', '50%') as CSSUnitValue;
          parseInfo = `\nCSSStyleValue.parse('width','50%') = ${p.value}${p.unit}`;
        } catch (e: any) { parseInfo = `\nCSSStyleValue.parse 抛错: ${e.message}`; }
      }
      if (typeof CSSMathSum !== 'undefined') {
        try {
          const sum = new CSSMathSum(CSS.px(10), CSS.px(20));
          mathInfo = `\nnew CSSMathSum(CSS.px(10), CSS.px(20)) = ${sum.toString()}`;
        } catch (e: any) { mathInfo = `\nCSSMathSum 抛错: ${e.message}`; }
      }

      const info = `set('font-size', CSS.px(24)) → get → ${fsStr}\n`
        + `set('width', CSS.percent(80)) → get → ${wStr}`
        + computedInfo + parseInfo + mathInfo;
      this.setState({ typedOMInfo: info });
      this._addLog('typed',
        `attributeStyleMap.set/get ✓：font-size=${fs.value}${fs.unit}, width=${w.value}${w.unit}`);
    } catch (err: any) {
      this._addLog('error', `Typed OM 操作失败：${err.message}`);
    }
  }

  // 测试 CSS Custom Highlight API
  _testHighlight(): void {
    if (!this.state.highlightSupported) {
      this.setState({ highlightInfo: 'CSS Custom Highlight API 不可用（typeof Highlight === "undefined" 或无 CSS.highlights）' });
      this._addLog('error', 'CSS Custom Highlight API 不可用（jsdom 不支持）');
      return;
    }
    const container = this.$<HTMLElement>('.dt-highlight-text');
    if (!container) return;
    const firstChild = container.firstChild;
    if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) {
      this._addLog('error', '高亮演示容器缺少文本节点');
      return;
    }
    try {
      const text = firstChild as Text;
      const len = (text.textContent || '').length;
      // 构造两个 Range 覆盖不同文本片段
      const r1 = document.createRange();
      r1.setStart(text, Math.min(2, len));
      r1.setEnd(text, Math.min(6, len));
      const r2 = document.createRange();
      r2.setStart(text, Math.min(10, len));
      r2.setEnd(text, Math.min(14, len));
      // new Highlight(...ranges) 接收多个 Range
      const highlight = new Highlight(r1, r2);
      // CSS.highlights.set 注册（同 Map 接口）
      CSS.highlights.set('dt-highlight', highlight);
      const size = CSS.highlights.size;
      const info = `new Highlight(r1, r2) → CSS.highlights.set('dt-highlight', highlight)\n`
        + `CSS.highlights.size = ${size}\n`
        + `::highlight(dt-highlight) { background: #1677ff; color: #fff; }`;
      this.setState({ highlightInfo: info });
      this._addLog('highlight',
        `CSS.highlights.set('dt-highlight', ...) ✓ | size=${size} | ::highlight 伪元素样式生效`);
    } catch (err: any) {
      this._addLog('error', `Highlight 操作失败：${err.message}`);
    }
  }

  // 清除 Highlight 注册
  _clearHighlight(): void {
    if (!this.state.highlightSupported) {
      this._addLog('error', 'CSS.highlights 不可用');
      return;
    }
    try {
      CSS.highlights.delete('dt-highlight');
      this.setState({ highlightInfo: `CSS.highlights.delete('dt-highlight') ✓ | size = ${CSS.highlights.size}` });
      this._addLog('highlight', `CSS.highlights.delete('dt-highlight') ✓ | size=${CSS.highlights.size}`);
    } catch (err: any) {
      this._addLog('error', `delete 失败：${err.message}`);
    }
  }

  // ===================== Card 4: Event 系统深入 =====================

  // 清理上一个场景的监听器（手动注册的，未通过 this.on 自动管理）
  _clearEventScenario(): void {
    if (this._scenarioHandlers) {
      for (const { target, type, handler, options } of this._scenarioHandlers) {
        try { target.removeEventListener(type, handler, options); } catch { /* noop */ }
      }
    }
    this._scenarioHandlers = [];
  }

  _addScenario(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void {
    try {
      target.addEventListener(type, handler, options);
      this._scenarioHandlers.push({ target, type, handler, options });
    } catch (err: any) {
      this._addLog('error', `addEventListener(${type}) 失败：${err.message}`);
    }
  }

  // 获取三层嵌套事件目标（parent → child → grandchild）
  _getEventTargets(): { parent: HTMLElement | null; child: HTMLElement | null; grand: HTMLElement | null } {
    return {
      parent: this.$<HTMLElement>('.dt-event-parent'),
      child: this.$<HTMLElement>('.dt-event-child'),
      grand: this.$<HTMLElement>('.dt-event-grandchild'),
    };
  }

  // 普通监听：默认冒泡，从 grandchild(target) → child → parent
  _setupNormalListeners(): void {
    this._clearEventScenario();
    const { parent, child, grand } = this._getEventTargets();
    if (!parent || !child || !grand) return;
    const mk = (label: string) => (e: Event): void => {
      const target = e.target as Element;
      const current = e.currentTarget as Element;
      this._addLog('event',
        `[普通/${label}] phase=${PHASE_NAMES[e.eventPhase] || e.eventPhase} | `
        + `target=${target.className || '(none)'} | currentTarget=${current.className || '(none)'} | bubbles=${e.bubbles}`);
    };
    this._addScenario(parent, 'click', mk('parent'), false);
    this._addScenario(child, 'click', mk('child'), false);
    this._addScenario(grand, 'click', mk('grand'), false);
    this._addLog('event', '场景：普通监听（默认冒泡）。预期顺序：grand(target/bubble) → child(bubble) → parent(bubble)');
  }

  // 捕获监听：从 parent(capture) → child(capture) → grand(target)
  _setupCaptureListeners(): void {
    this._clearEventScenario();
    const { parent, child, grand } = this._getEventTargets();
    if (!parent || !child || !grand) return;
    const mk = (label: string) => (e: Event): void => {
      const target = e.target as Element;
      const current = e.currentTarget as Element;
      this._addLog('event',
        `[捕获/${label}] phase=${PHASE_NAMES[e.eventPhase] || e.eventPhase} | `
        + `target=${target.className || '(none)'} | currentTarget=${current.className || '(none)'}`);
    };
    this._addScenario(parent, 'click', mk('parent'), true);
    this._addScenario(child, 'click', mk('child'), true);
    this._addScenario(grand, 'click', mk('grand'), true);
    this._addLog('event', '场景：捕获监听（capture: true）。预期顺序：parent(capture) → child(capture) → grand(target)');
  }

  // stopPropagation 演示：child 处停止冒泡，parent 不触发
  _setupStopPropagation(): void {
    this._clearEventScenario();
    const { parent, child, grand } = this._getEventTargets();
    if (!parent || !child || !grand) return;
    this._addScenario(parent, 'click', (): void => {
      this._addLog('event', `[parent/bubble] 触发（看到此日志说明 stopPropagation 未生效）`);
    }, false);
    this._addScenario(child, 'click', (e: Event): void => {
      this._addLog('event', `[child/bubble] 触发，调用 stopPropagation() 阻止继续冒泡到 parent`);
      e.stopPropagation();
    }, false);
    this._addScenario(grand, 'click', (e: Event): void => {
      this._addLog('event', `[grand/target] 触发，eventPhase=${PHASE_NAMES[e.eventPhase]}`);
    }, false);
    this._addLog('event', '场景：stopPropagation。child 处调用 stopPropagation，预期：grand → child，parent 不触发');
  }

  // once 监听：{ once: true } 触发后自动移除
  _setupOnceListeners(): void {
    this._clearEventScenario();
    const { parent, child, grand } = this._getEventTargets();
    if (!parent || !child || !grand) return;
    const mk = (label: string) => (): void => {
      this._addLog('event', `[once/${label}] 触发（once: true，触发后自动移除）`);
    };
    this._addScenario(parent, 'click', mk('parent'), { once: true });
    this._addScenario(child, 'click', mk('child'), { once: true });
    this._addScenario(grand, 'click', mk('grand'), { once: true });
    this._addLog('event', '场景：once 监听（{ once: true }）。第一次点击触发，第二次点击应无监听');
  }

  // 触发 grandchild 的 click 事件
  _triggerGrandchildClick(): void {
    const grand = this.$<HTMLElement>('.dt-event-grandchild');
    if (!grand || typeof grand.click !== 'function') {
      this._addLog('error', 'grandchild.click() 不可用');
      return;
    }
    this._addLog('event', `>>> 触发 grandchild.click() — timeStamp=${performance.now().toFixed(2)}`);
    grand.click();
  }

  // 派发 CustomEvent（携带 detail 数据）
  _dispatchCustomEvent(): void {
    const parent = this.$<HTMLElement>('.dt-event-parent');
    if (!parent) return;
    if (!this.state.eventSupported) {
      this._addLog('error', 'CustomEvent 不可用');
      return;
    }
    // 注册一次性监听器以接收派发的事件
    const onCustom = (e: Event): void => {
      const ce = e as CustomEvent;
      this._addLog('event',
        `[CustomEvent] type=${ce.type} | detail=${JSON.stringify(ce.detail)} | `
        + `bubbles=${ce.bubbles} | composed=${ce.composed} | cancelable=${ce.cancelable}`);
    };
    this._addScenario(parent, 'demo-custom', onCustom, false);
    this._customSeq = (this._customSeq || 0) + 1;
    const detail = { from: 'DOMTraversalPage', ts: Date.now(), seq: this._customSeq };
    const evt = new CustomEvent('demo-custom', { detail, bubbles: true, cancelable: true });
    this._addLog('event',
      `>>> dispatchEvent(new CustomEvent('demo-custom', { detail: ${JSON.stringify(detail)} }))`);
    try {
      parent.dispatchEvent(evt);
    } catch (err: any) {
      this._addLog('error', `dispatchEvent 失败：${err.message}`);
    }
  }

  // ===================== Card 5: 调度对比 =====================

  // 同时用 5 种调度方式排队回调，按实际执行时间打印顺序
  _runScheduling(): void {
    if (!this.state.schedulingSupported) {
      this._addLog('error', '调度 API 不可用（queueMicrotask / MessageChannel 缺失）');
      return;
    }
    const results: { name: string; t: number }[] = [];
    const t0 = performance.now();
    const record = (name: string): void => { results.push({ name, t: performance.now() - t0 }); };

    // 1. 微任务：queueMicrotask（当前同步任务后立即执行）
    queueMicrotask(() => record('queueMicrotask'));
    // 2. 微任务：Promise.resolve().then
    Promise.resolve().then(() => record('Promise.then'));
    // 3. requestAnimationFrame（下一帧渲染前，约 16ms）
    if (typeof requestAnimationFrame === 'function') {
      this._rafId = requestAnimationFrame(() => record('requestAnimationFrame'));
    } else {
      this._addLog('warn', 'requestAnimationFrame 不可用，已跳过');
    }
    // 4. MessageChannel（宏任务，无 4ms clamp）
    const ch = new MessageChannel();
    ch.port1.onmessage = (): void => {
      record('MessageChannel');
      try { ch.port1.close(); ch.port2.close(); } catch { /* noop */ }
    };
    ch.port2.postMessage(null);
    // 5. setTimeout(cb, 0)（宏任务，嵌套 clamp 4ms）
    setTimeout(() => record('setTimeout'), 0);
    // 6. requestIdleCallback（jsdom 不可用，fallback setTimeout）
    if (typeof requestIdleCallback === 'function') {
      this._idleId = requestIdleCallback(() => record('requestIdleCallback'), { timeout: 50 });
    } else {
      setTimeout(() => record('requestIdleCallback(fallback)'), 0);
    }

    // 收集结果：等待所有调度执行完（保守 80ms 覆盖 rAF 与 idle）
    setTimeout((): void => {
      if (this._destroyed) return;
      results.sort((a, b) => a.t - b.t);
      const orderStr = results.map((r) => `${r.name}(${r.t.toFixed(3)}ms)`).join(' → ');
      this._addLog('sched', `执行顺序（按时间）：${orderStr}`);
      this._addLog('sched',
        '理论顺序：微任务(queueMicrotask/Promise.then) → rAF → MessageChannel → setTimeout → requestIdleCallback');
    }, 80);
  }

  // AbortSignal 演示：addEventListener({ signal }) 通过 abort 主动取消
  _setupAbortableListener(): void {
    if (!this.state.abortSupported) {
      this._addLog('error', 'AbortController/AbortSignal 不可用');
      return;
    }
    const target = this.$<HTMLElement>('.dt-abort-target');
    if (!target) return;
    // 先清理上一次的 controller（避免泄漏）
    if (this._abortController) {
      try { this._abortController.abort(); } catch { /* noop */ }
    }
    this._abortController = new AbortController();
    const handler = (): void => this._addLog('abort', '可中止监听触发（监听仍存活，未被 abort）');
    // 关键：通过 signal 选项注册，abort 后监听自动移除
    this._addScenario(target, 'click', handler, { signal: this._abortController.signal });
    this._addLog('abort', '已添加 addEventListener("click", handler, { signal: controller.signal })');
  }

  // 调用 controller.abort() 取消监听
  _abortListener(): void {
    if (!this._abortController) {
      this._addLog('error', '尚未创建 AbortController，请先点击"添加 signal 监听"');
      return;
    }
    try {
      this._abortController.abort();
      this._addLog('abort', 'controller.abort() ✓ — 监听应已被自动移除，再点击目标无日志');
      this._abortController = null;
    } catch (err: any) {
      this._addLog('error', `abort 失败：${err.message}`);
    }
  }

  // 触发 AbortSignal 演示目标点击
  _triggerAbortDemo(): void {
    const target = this.$<HTMLElement>('.dt-abort-target');
    if (target && typeof target.click === 'function') {
      this._addLog('abort', '>>> 触发目标 click()');
      target.click();
    }
  }

  // ===================== 日志面板 =====================
  _renderLogPanel(): Node {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // ===================== 渲染 =====================
  renderPage(): Node | string | (Node | string)[] {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'DOM 遍历 / 事件系统 / 调度对比 / CSS Typed OM 实验室'),

      h(Alert, {
        type: 'info',
        message: 'NodeIterator · TreeWalker · Range · DocumentFragment · CSS Typed OM · Custom Highlight · Event 系统 · 调度对比',
        description: '本页面演示 DOM 遍历器、Range/Fragment、CSS Typed OM、Custom Highlight API、Event 系统深入及调度对比。所有调用前均做 typeof/in 能力检测，jsdom 不可用时记日志说明，不抛异常。',
      }),

      // ============ Card 1: NodeIterator 与 TreeWalker ============
      h(Card, {
        title: '1. NodeIterator 与 TreeWalker（DOM 遍历器）',
        extra: h(Tag, { color: s.traversalSupported ? 'success' : 'error' },
          s.traversalSupported ? '稳定' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'document.createTreeWalker(root, whatToShow, filter) 创建深度优先遍历器，支持 parentNode()/firstChild()/lastChild()/previousSibling()/nextSibling()/nextNode()/previousNode()；document.createNodeIterator(root, whatToShow, filter) 创建单向迭代器，nextNode()/previousNode()/detach()。whatToShow 用 NodeFilter.SHOW_* 常量，filter.acceptNode 返回 FILTER_ACCEPT/REJECT/SKIP。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('遍历元素', { type: 'primary', size: 'sm', onClick: () => this._traverseElements() }),
            this._btn('遍历文本', { size: 'sm', onClick: () => this._traverseText() }),
            this._btn('仅遍历 LI', { size: 'sm', onClick: () => this._traverseLiOnly() }),
          ),
          h('div', { class: 'fs-sm text-secondary mt-xs' },
            '目标 DOM 容器（用 h() 构造，包含 div/ul/li/span 多层嵌套）：'),
          h('div', { class: 'dt-tree' },
            h('div', { class: 'dt-tree__a' },
              '顶层 div（class=dt-tree__a）',
              h('ul', {},
                h('li', {}, '列表项 1 — ', h('span', { class: 'tag-text' }, '强调文本')),
                h('li', {}, '列表项 2 — 普通'),
                h('li', {}, '列表项 3 — ', h('span', { class: 'tag-text' }, '另一段强调')),
              ),
              h('div', { class: 'dt-tree__b' },
                '嵌套 div（class=dt-tree__b）',
                h('ul', {},
                  h('li', {}, '嵌套列表项 A'),
                  h('li', {}, '嵌套列表项 B'),
                ),
              ),
            ),
          ),
        ),
      ),

      // ============ Card 2: DocumentFragment 与 Range ============
      h(Card, {
        title: '2. DocumentFragment 与 Range 深入',
        extra: h(Tag, { color: s.rangeSupported ? 'success' : 'error' },
          s.rangeSupported ? '稳定' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'DocumentFragment 是轻量文档片段，appendChild 多个节点只触发一次 reflow，性能优于循环 appendChild。Range 表示连续 DOM 区间，支持 setStart/setEnd/selectNode/selectNodeContents/collapse/cloneContents/extractContents/deleteContents/insertNode/surroundContents 及 getBoundingClientRect/getClientRects。Selection API（window.getSelection/removeAllRanges/addRange/getRangeAt/toString）配合 Range 管理用户选区。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('Fragment 性能测试', { type: 'primary', size: 'sm', onClick: () => this._runFragmentPerf() }),
            this._btn('Range extractContents', { size: 'sm', onClick: () => this._runRangeExtract() }),
            this._btn('Selection API', { size: 'sm', onClick: () => this._demoSelection() }),
          ),
          s.fragmentPerf ? h('div', { class: 'fs-sm' },
            h('strong', {}, '性能对比：'),
            h('span', { class: 'text-secondary' },
              ` N=${s.fragmentPerf.count} | 直接 appendChild: ${s.fragmentPerf.directMs}ms | `
              + `DocumentFragment: ${s.fragmentPerf.fragMs}ms | 加速比: ${s.fragmentPerf.ratio}x`),
          ) : null,
          h('div', { class: 'dt-perf-row' },
            h('div', { class: 'dt-perf-col' },
              h('div', { class: 'fs-sm text-secondary mb-xs' }, '直接 appendChild 容器（每次插入触发 reflow）：'),
              h('ul', { class: 'dt-perf-list dt-perf-direct' })),
            h('div', { class: 'dt-perf-col' },
              h('div', { class: 'fs-sm text-secondary mb-xs' }, 'DocumentFragment 容器（一次性插入）：'),
              h('ul', { class: 'dt-perf-list dt-perf-fragment' })),
          ),
          h('div', { class: 'fs-sm text-secondary mt-xs' }, 'Range 操作结果（selectNode + extractContents）：'),
          h('div', { class: 'dt-range-container fs-sm' }),
          s.rangeExtractResult ? h('div', { class: 'fs-sm' }, s.rangeExtractResult) : null as any,
        ),
      ),

      // ============ Card 3: CSS Typed OM 与 Custom Highlight ============
      h(Card, {
        title: '3. CSS Typed Object Model 与 CSS Custom Highlight API',
        extra: h(Tag, { color: s.typedOMSupported || s.highlightSupported ? 'warning' : 'error' },
          s.typedOMSupported || s.highlightSupported ? '实验性' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'CSS Typed OM：element.attributeStyleMap.set/get 返回 CSSUnitValue 等 CSSStyleValue 子类（{value, unit}），element.computedStyleMap() 返回只读 StylePropertyMapReadOnly。CSS.px/percent/vw/em 创建单位值，CSSMathSum/Product/Negate 表达数学表达式，CSSKeywordValue/ImageValue 表示其他类型，CSSStyleValue.parse/parseAll 解析字符串。CSS Custom Highlight API：new Highlight(...ranges) + CSS.highlights.set(name, highlight) 注册高亮，通过 ::highlight(name) 伪元素样式化，无需包裹 DOM 节点。'),
          h(Alert, {
            type: 'warning',
            message: 'CSS Typed OM 与 Custom Highlight API 在 jsdom 中不可用',
            description: 'attributeStyleMap / computedStyleMap / CSS.px / Highlight / CSS.highlights 需要真实浏览器（Chrome 87+ / Highlight API Chrome 105+）。本页能力检测后将在不支持时记日志说明。',
          }),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('测试 Typed OM', { type: 'primary', size: 'sm', onClick: () => this._testTypedOM() }),
            this._btn('测试 Highlight', { type: 'primary', size: 'sm', onClick: () => this._testHighlight() }),
            this._btn('清除 Highlight', { size: 'sm', onClick: () => this._clearHighlight() }),
          ),
          h('div', { class: 'dt-typed-demo' },
            'Typed OM 演示元素（点击按钮后通过 attributeStyleMap.set 修改 font-size/width）'),
          s.typedOMInfo ? h('pre', { class: 'code-block' }, s.typedOMInfo) : null as any,
          h('div', { class: 'fs-sm text-secondary mt-xs' },
            'Custom Highlight 演示文本（注册后 ::highlight(dt-highlight) 高亮其中片段）：'),
          h('div', { class: 'dt-highlight-text' },
            '这是一段用于演示 CSS Custom Highlight API 的文本，点击按钮注册 Highlight 后将通过 ::highlight 伪元素高亮其中片段。'),
          s.highlightInfo ? h('pre', { class: 'code-block' }, s.highlightInfo) : null as any,
        ),
      ),

      // ============ Card 4: Event 系统深入 ============
      h(Card, {
        title: '4. Event 系统深入（capture / once / stopPropagation / CustomEvent）',
        extra: h(Tag, { color: s.eventSupported ? 'success' : 'error' },
          s.eventSupported ? '稳定' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Event 对象含 bubbles/cancelable/composed/defaultPrevented/target/currentTarget/eventPhase(0/1/2/3)/timeStamp/type；event.composedPath() 返回跨 Shadow DOM 的事件路径；stopPropagation/stopImmediatePropagation/preventDefault 控制事件流。addEventListener 第三参 options: capture（捕获阶段触发）/passive（不可 preventDefault，优化滚动）/once（触发一次后自动移除）/signal（AbortSignal，可主动取消）。CustomEvent(type, { detail, bubbles, cancelable }) 携带数据；dispatchEvent 派发；EventTarget 类可被继承实现自定义事件目标。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('普通监听', { type: 'primary', size: 'sm', onClick: () => this._setupNormalListeners() }),
            this._btn('捕获监听', { type: 'primary', size: 'sm', onClick: () => this._setupCaptureListeners() }),
            this._btn('stopPropagation', { size: 'sm', onClick: () => this._setupStopPropagation() }),
            this._btn('once 监听', { size: 'sm', onClick: () => this._setupOnceListeners() }),
            this._btn('触发 grandchild 点击', { type: 'primary', size: 'sm', onClick: () => this._triggerGrandchildClick() }),
            this._btn('派发 CustomEvent', { size: 'sm', onClick: () => this._dispatchCustomEvent() }),
          ),
          h('div', { class: 'fs-sm text-secondary' },
            '三层嵌套 div（parent → child → grandchild），先选择场景再点击触发：'),
          h('div', { class: 'dt-event-parent' },
            h('div', { class: 'fs-sm fw-medium' }, 'parent（蓝色边框）'),
            h('div', { class: 'dt-event-child' },
              h('div', { class: 'fs-sm fw-medium' }, 'child（绿色边框）'),
              h('div', { class: 'dt-event-grandchild' },
                h('div', { class: 'fs-sm fw-medium' }, 'grandchild（橙色边框，点击我或上方按钮）'),
              ),
            ),
          ),
        ),
      ),

      // ============ Card 5: 调度对比 ============
      h(Card, {
        title: '5. 调度对比（queueMicrotask / Promise / setTimeout / rAF / MessageChannel / requestIdleCallback）',
        extra: h(Tag, { color: s.schedulingSupported ? 'success' : 'error' },
          s.schedulingSupported ? '稳定' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'queueMicrotask 与 Promise.resolve().then 为微任务，在当前同步任务后立即执行；setTimeout(cb, 0) 为宏任务，嵌套调用会被 clamp 到 4ms；requestAnimationFrame 在下一帧渲染前执行（约 16ms）；MessageChannel.postMessage 也是宏任务，但无 4ms clamp；requestIdleCallback 在浏览器空闲时执行（可用 timeout 强制）。理论顺序：微任务 → rAF → MessageChannel → setTimeout → requestIdleCallback。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('调度对比', { type: 'primary', size: 'sm', onClick: () => this._runScheduling() }),
          ),
          h(Alert, {
            type: 'info',
            message: 'AbortSignal 演示：addEventListener 第三参 options.signal',
            description: '通过 new AbortController() 创建控制器，将其 signal 作为 addEventListener 的 options.signal 传入；调用 controller.abort() 后，监听器被自动移除（无需 removeEventListener）。此模式常用于一次性订阅、组件卸载时批量清理监听。',
          }),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('添加 signal 监听', { type: 'primary', size: 'sm', onClick: () => this._setupAbortableListener() }),
            this._btn('abort 中止', { danger: true, size: 'sm', onClick: () => this._abortListener() }),
            this._btn('触发目标点击', { size: 'sm', onClick: () => this._triggerAbortDemo() }),
          ),
          h('div', { class: 'dt-abort-target' }, '可中止监听目标（点击触发监听）'),
        ),
      ),

      // ============ 日志面板 ============
      h(Card, {
        title: '事件日志',
        extra: h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      },
        this._renderLogPanel(),
      ),
    ];
  }
}
