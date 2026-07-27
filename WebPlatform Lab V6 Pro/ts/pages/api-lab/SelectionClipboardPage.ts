// =====================================================================
// SelectionClipboardPage.js —— Selection / Clipboard / execCommand 实验室
// 演示 MDN：
//   1. Selection API —— getSelection / anchorNode / focusNode / isCollapsed /
//      rangeCount / getRangeAt / addRange / removeAllRanges / removeRange /
//      collapse / extend / modify / toString / deleteFromDocument /
//      selectAllChildren / containsNode / selectionchange 事件
//   2. Range API —— new Range / createRange / setStart / setEnd /
//      setStartBefore / setStartAfter / setEndBefore / setEndAfter /
//      selectNode / selectNodeContents / collapse / collapsed /
//      cloneContents / extractContents / deleteContents / insertNode /
//      surroundContents / cloneRange / compareBoundaryPoints /
//      getBoundingClientRect / START_TO_START 等常量
//   3. Clipboard API（异步）—— readText / writeText / read / write /
//      ClipboardItem 构造器 / types / getType / clipboardchange
//   4. execCommand（已废弃）—— copy / cut / paste / selectAll / bold /
//      italic / underline / insertText / formatBlock /
//      queryCommandEnabled / queryCommandSupported / queryCommandValue
//   5. copy / cut / paste 事件 —— e.clipboardData.setData / getData / preventDefault
// 说明：jsdom 中 Selection / Range 支持有限，navigator.clipboard 通常 undefined，
//       ClipboardItem 可能未定义，execCommand 存在但大多返回 false。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

export interface SelectionClipboardPageProps extends Props {}

export interface SelectionClipboardPageState extends State {}

export class SelectionClipboardPage extends Page {
  declare props: SelectionClipboardPageProps;
  declare state: SelectionClipboardPageState;
  _clipboardChangeHandler: any = null;
  _copyHandler: any = null;
  _cutHandler: any = null;
  _inited: boolean = false;
  _pasteHandler: any = null;
  _rangeHost: any = null;
  _selChangeHandler: any = null;
  _selHost: any = null;
  // —— 初始 state ——
  initialState(): SelectionClipboardPageState {
    return {
      logs: [],
      capsSummary: '',
      selectionInfo: '',  // Card 1：Selection 基本操作
      rangeInfo: '',      // Card 2：Range 操作
      clipboardInfo: '',  // Card 3：Clipboard API 异步读写
      execInfo: '',       // Card 4：execCommand 演示
      eventInfo: '',      // Card 5：copy/cut/paste 事件拦截
      modifyInfo: '',     // Card 6：selection.modify 高级操作
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._selHost = null;        // Card 1 / Card 6 选区宿主（textarea）
    this._rangeHost = null;      // Card 2 Range 宿主（contenteditable div）
    this._copyHandler = null;    // Card 5 copy 事件处理函数
    this._cutHandler = null;     // Card 5 cut 事件处理函数
    this._pasteHandler = null;   // Card 5 paste 事件处理函数
    this._selChangeHandler = null;       // selectionchange 处理函数
    this._clipboardChangeHandler = null; // clipboardchange 处理函数

    // 一次性能力检测：Selection / Range / Clipboard / execCommand 全家桶
    const hasDoc = typeof document !== 'undefined';
    const hasNavClip = typeof navigator !== 'undefined' && !!navigator.clipboard;
    const hasSel = typeof window !== 'undefined' && typeof window.getSelection === 'function';
    const hasRange = typeof Range !== 'undefined';
    const hasCreateRange = hasDoc && typeof document.createRange === 'function';
    const hasClipWrite = hasNavClip && typeof navigator.clipboard.writeText === 'function';
    const hasClipRead = hasNavClip && typeof navigator.clipboard.readText === 'function';
    const hasClipItem = typeof ClipboardItem !== 'undefined';
    const hasExec = hasDoc && typeof document.execCommand === 'function';
    const hasQueryCmd = hasDoc && typeof document.queryCommandSupported === 'function';
    const hasClipEvt = typeof ClipboardEvent !== 'undefined';

    const parts = [
      `Selection ${hasSel ? '✓' : '✗'}`, `Range ${hasRange ? '✓' : '✗'}`,
      `createRange ${hasCreateRange ? '✓' : '✗'}`, `clipboard.writeText ${hasClipWrite ? '✓' : '✗'}`,
      `clipboard.readText ${hasClipRead ? '✓' : '✗'}`, `ClipboardItem ${hasClipItem ? '✓' : '✗'}`,
      `execCommand ${hasExec ? '✓' : '✗'}`, `queryCommandSupported ${hasQueryCmd ? '✓' : '✗'}`,
      `ClipboardEvent ${hasClipEvt ? '✓' : '✗'}`,
    ];

    const summary = hasSel
      ? `能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）Selection 存在但 Range 操作可能返回 null；navigator.clipboard 在 jsdom 中通常 undefined（需安全上下文 HTTPS）；ClipboardItem 可能未定义；execCommand 存在但大多返回 false。所有按钮点击会真实调用 API 并 try/catch 记录结果。`
      : `能力检测：${parts.join(' · ')}。当前环境不支持 Selection；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(hasSel ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasClipWrite) this._addLog('warn', 'navigator.clipboard 不可用（jsdom 或非安全上下文 http）');
    if (!hasClipItem) this._addLog('warn', 'ClipboardItem 未定义（多 MIME 写入演示将记日志说明）');
    if (!hasExec) this._addLog('warn', 'document.execCommand 不可用');

    // 注册 document 级 selectionchange 监听（不触发 setState 避免循环）
    if (hasSel && typeof document !== 'undefined') {
      this._selChangeHandler = () => {};
      try { document.addEventListener('selectionchange', this._selChangeHandler); } catch { /* noop */ }
    }
    if (hasClipWrite && typeof document !== 'undefined') {
      this._clipboardChangeHandler = () => this._addLog('info', 'clipboardchange 事件触发（剪贴板内容变化）');
      try { document.addEventListener('clipboardchange', this._clipboardChangeHandler); } catch { /* noop */ }
    }
  }

  componentWillUnmount(): void {
    // 移除事件监听器并释放引用，便于 GC
    const remove = (target: any, type: any, handler: any) => {
      if (handler && typeof document !== 'undefined') {
        try { document.removeEventListener(type, handler); } catch { /* noop */ }
      }
    };
    remove(document, 'selectionchange', this._selChangeHandler);
    remove(document, 'clipboardchange', this._clipboardChangeHandler);
    remove(document, 'copy', this._copyHandler);
    remove(document, 'cut', this._cutHandler);
    remove(document, 'paste', this._pasteHandler);
    if (this._selHost && this._selHost.parentNode) {
      try { this._selHost.parentNode.removeChild(this._selHost); } catch { /* noop */ }
    }
    if (this._rangeHost && this._rangeHost.parentNode) {
      try { this._rangeHost.parentNode.removeChild(this._rangeHost); } catch { /* noop */ }
    }
    this._selHost = this._rangeHost = null;
    this._copyHandler = this._cutHandler = this._pasteHandler = null;
    this._selChangeHandler = this._clipboardChangeHandler = null;
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    const hasNavClip = typeof navigator !== 'undefined' && !!navigator.clipboard;
    return {
      selection: typeof window !== 'undefined' && typeof window.getSelection === 'function',
      range: typeof Range !== 'undefined',
      createRange: typeof document !== 'undefined' && typeof document.createRange === 'function',
      clipboard: hasNavClip && typeof navigator.clipboard.writeText === 'function',
      clipboardRead: hasNavClip && typeof navigator.clipboard.readText === 'function',
      clipboardWrite: hasNavClip && typeof navigator.clipboard.write === 'function',
      clipboardItem: typeof ClipboardItem !== 'undefined',
      execCommand: typeof document !== 'undefined' && typeof document.execCommand === 'function',
      queryCommand: typeof document !== 'undefined' && typeof document.queryCommandSupported === 'function',
      clipboardEvent: typeof ClipboardEvent !== 'undefined',
      event: typeof Event !== 'undefined',
    };
  }

  // =================== Card 1：Selection 基本操作 ===================

  // 创建 textarea 宿主并选中部分文本，读取 selection.toString() / anchorNode / rangeCount
  _createSelectionHost() {
    if (!this._caps().selection) { this._addLog('warn', 'window.getSelection 不可用'); return; }
    try {
      if (this._selHost && this._selHost.parentNode) this._selHost.parentNode.removeChild(this._selHost);
      const host = document.createElement('textarea');
      host.value = 'Hello Selection API！这是一段用于演示选区的中文文本。';
      host.style.cssText = 'width:100%;min-height:60px;padding:8px;border:1px solid #ddd;border-radius:4px;font-family:monospace;';
      document.body.appendChild(host);
      this._selHost = host;
      this._addLog('info', '已创建 textarea 宿主并挂载到 document.body');
      this._readSelection();
    } catch (err: any) {
      this._addLog('warn', `创建选区宿主失败：${err.name} - ${err.message}`);
    }
  }

  // selection.toString() / anchorNode / anchorOffset / focusNode / focusOffset / isCollapsed / rangeCount
  _readSelection() {
    if (!this._caps().selection) { this._addLog('warn', 'window.getSelection 不可用'); return; }
    try {
      const sel = window.getSelection();
      if (!sel) {
        this.setState({ selectionInfo: 'window.getSelection() 返回 null（jsdom 可能不支持真实选区）' });
        this._addLog('warn', 'getSelection() 返回 null'); return;
      }
      let selectLine = '';
      if (this._selHost && typeof this._selHost.select === 'function') {
        try { this._selHost.focus(); this._selHost.setSelectionRange(6, 14); selectLine = `textarea.setSelectionRange(6, 14) → 选中文本索引 [6, 14)\n`; }
        catch (e: any) { selectLine = `setSelectionRange 失败：${e.message}\n`; }
      } else { selectLine = '（未创建 textarea 宿主，先点「创建选区宿主」）\n'; }
      const text = sel.toString();
      this.setState({
        selectionInfo:
          `${selectLine}` +
          `window.getSelection() → Selection 对象 ✓\n` +
          `selection.toString() = "${text}"，type = "${sel.type}"（None/Caret/Range）\n` +
          `anchorNode = ${sel.anchorNode ? sel.anchorNode.nodeName : 'null'}，anchorOffset = ${sel.anchorOffset}；focusNode = ${sel.focusNode ? sel.focusNode.nodeName : 'null'}，focusOffset = ${sel.focusOffset}\n` +
          `isCollapsed = ${sel.isCollapsed}（锚点与焦点重合则 true），rangeCount = ${sel.rangeCount}\n` +
          `说明：anchorNode/focusNode 为选区起止节点，offset 为节点内偏移。`,
      });
      this._addLog('sel', `读取 Selection：toString="${text}"，rangeCount=${sel.rangeCount}，isCollapsed=${sel.isCollapsed}`);
    } catch (err: any) {
      this._addLog('warn', `读取 Selection 失败：${err.name} - ${err.message}`);
    }
  }

  // selection.addRange(range) / removeAllRanges() / getRangeAt(0) / selectAllChildren / containsNode / collapse
  _addRangeAndSelectDemo() {
    if (!this._caps().selection) { this._addLog('warn', 'window.getSelection 不可用'); return; }
    try {
      const sel = window.getSelection();
      if (!sel) { this.setState({ selectionInfo: 'getSelection() 返回 null，无法操作' }); return; }
      sel.removeAllRanges();
      const lines = [`selection.removeAllRanges() → 清空所有选区`];
      if (this._caps().createRange && this._selHost) {
        try {
          const range = document.createRange();
          range.selectNodeContents(this._selHost);
          sel.addRange(range);
          lines.push(`range.selectNodeContents(host) + sel.addRange(range) → rangeCount=${sel.rangeCount}，getRangeAt(0) = ${sel.rangeCount > 0 ? 'Range ✓' : 'null'}`);
          sel.selectAllChildren(this._selHost);
          lines.push(`sel.selectAllChildren(host) → 选中所有子节点，toString="${sel.toString()}"`);
          if (typeof sel.containsNode === 'function') lines.push(`sel.containsNode(host, false) = ${sel.containsNode(this._selHost, false)}`);
          sel.collapse(this._selHost, 0);
          lines.push(`sel.collapse(host, 0) → 折叠到起始（isCollapsed=${sel.isCollapsed}）`);
        } catch (e: any) { lines.push(`addRange/selectAllChildren/collapse 失败：${e.name} - ${e.message}（jsdom 可能不支持真实选区）`); }
      } else {
        lines.push('createRange 或宿主不可用');
      }
      lines.push(`最终 sel.toString() = "${sel.toString()}"\n说明：addRange 加入选区；removeAllRanges 清空；getRangeAt(i) 取出；selectAllChildren 选中子节点；collapse 折叠光标。`);
      this.setState({ selectionInfo: lines.join('\n') });
      this._addLog('sel', `addRange/selectAllChildren 演示完成，rangeCount=${sel.rangeCount}`);
    } catch (err: any) {
      this._addLog('warn', `addRange 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Selection 基本操作',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.selection ? 'success' : 'error' }, caps.selection ? 'Selection ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'getSelection / toString'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.getSelection() 返回 Selection 对象，代表当前选区。toString() 获取选中文本；anchorNode/anchorOffset 为起点；focusNode/focusOffset 为终点；isCollapsed 表示锚点与焦点是否重合；rangeCount 为选区内 Range 数量；getRangeAt(i) 取 Range；addRange/removeAllRanges 增删 Range；selectAllChildren(node) 选中所有子节点；collapse(node, offset) 折叠光标；containsNode(node, partial) 判断节点是否在选区内。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建选区宿主', { type: 'primary', size: 'sm', disabled: !caps.selection, onClick: () => this._createSelectionHost() }),
          this._btn('读取 Selection', { type: 'primary', size: 'sm', disabled: !caps.selection, onClick: () => this._readSelection() }),
          this._btn('addRange/selectAllChildren', { size: 'sm', disabled: !caps.selection, onClick: () => this._addRangeAndSelectDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Selection 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.selectionInfo || '（点击「创建选区宿主」开始）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`const sel = window.getSelection();
const text = sel.toString();             // 选中文本
const { anchorNode, anchorOffset } = sel; // 起点
const range = sel.getRangeAt(0);          // 取第 0 个 Range
sel.removeAllRanges(); sel.addRange(r);   // 清空再添加
sel.selectAllChildren(node);              // 选中所有子节点`)),
        h(Alert, {
          type: 'info',
          message: 'Selection 是文档级别的全局选区',
          description: 'window.getSelection() 与 document.getSelection() 等价，返回同一个 Selection 对象。一个文档同时只有一个活动选区；selectionchange 事件在 document 上触发。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Range 操作 ===================

  // 创建 contenteditable 宿主用于 Range 操作
  _createRangeHost() {
    if (!this._caps().createRange) { this._addLog('warn', 'document.createRange 不可用'); return; }
    try {
      if (this._rangeHost && this._rangeHost.parentNode) this._rangeHost.parentNode.removeChild(this._rangeHost);
      const host = document.createElement('div');
      host.contentEditable = 'true';
      host.style.cssText = 'width:100%;min-height:60px;padding:8px;border:1px solid #ddd;border-radius:4px;font-family:monospace;';
      host.textContent = 'Range 演示文本 ABCDEFGHIJK';
      document.body.appendChild(host);
      this._rangeHost = host;
      this._addLog('info', '已创建 contenteditable 宿主并挂载到 document.body');
      this._rangeSetStartEnd();
    } catch (err: any) {
      this._addLog('warn', `创建 Range 宿主失败：${err.name} - ${err.message}`);
    }
  }

  // range.setStart/setEnd / collapsed / cloneContents / toString / getBoundingClientRect / getClientRects
  _rangeSetStartEnd() {
    if (!this._caps().createRange) { this._addLog('warn', 'document.createRange 不可用'); return; }
    try {
      if (!this._rangeHost) { this._addLog('warn', '请先点击「创建 Range 宿主」'); return; }
      const range = document.createRange();
      const host = this._rangeHost;
      const firstChild = host.firstChild;
      const lines = [`document.createRange() → Range 对象 ✓`];
      if (firstChild && firstChild.nodeType === 3) { // Node.TEXT_NODE = 3
        range.setStart(firstChild, 5);
        range.setEnd(firstChild, 11);
        lines.push(`range.setStart(textNode, 5) / setEnd(textNode, 11) → collapsed=${range.collapsed}（起止重合则 true），toString="${range.toString()}"`);
        try {
          const frag = range.cloneContents();
          lines.push(`range.cloneContents() → DocumentFragment，childNodes.length = ${frag.childNodes.length}`);
        } catch (e: any) { lines.push(`cloneContents 失败：${e.message}`); }
        try {
          const rect = range.getBoundingClientRect();
          lines.push(`range.getBoundingClientRect() → { left:${rect.left}, top:${rect.top}, width:${rect.width}, height:${rect.height} }；getClientRects().length = ${range.getClientRects().length}`);
        } catch (e: any) { lines.push(`getBoundingClientRect/getClientRects 失败：${e.message}（jsdom 无布局）`); }
      } else {
        lines.push('宿主无文本子节点');
      }
      lines.push('说明：setStart/setEnd 用 (node, offset) 定位；文本节点 offset 为字符索引。');
      this.setState({ rangeInfo: lines.join('\n') });
      this._addLog('range', `setStart/setEnd 演示：toString="${range.toString()}"，collapsed=${range.collapsed}`);
    } catch (err: any) {
      this._addLog('warn', `Range setStart/setEnd 失败：${err.name} - ${err.message}`);
    }
  }

  // range.selectNode / selectNodeContents / setStartBefore / setEndAfter / cloneRange / compareBoundaryPoints
  _rangeSelectAndClone() {
    if (!this._caps().createRange) { this._addLog('warn', 'document.createRange 不可用'); return; }
    try {
      if (!this._rangeHost) { this._addLog('warn', '请先点击「创建 Range 宿主」'); return; }
      const host = this._rangeHost;
      const r1 = document.createRange();
      const r2 = document.createRange();
      const lines: any[] = [];
      try { r1.selectNode(host); r2.selectNodeContents(host); r1.setStartBefore(host); r1.setEndAfter(host);
        lines.push(`r1.selectNode(host) → 选中整个节点；r2.selectNodeContents(host) → 仅选内容\nr1.setStartBefore(host) / setEndAfter(host) → 用相邻位置定位`);
      } catch (e: any) { lines.push(`selectNode/selectNodeContents/setStartBefore 失败：${e.message}`); }
      try {
        const cloned = r1.cloneRange();
        lines.push(`r1.cloneRange() → 新 Range（边界相同）`);
        if (typeof Range !== 'undefined' && typeof Range.START_TO_START !== 'undefined') {
          lines.push(`r1.compareBoundaryPoints(START_TO_START, r2) = ${r1.compareBoundaryPoints(Range.START_TO_START, r2)}；(END_TO_END, r2) = ${r1.compareBoundaryPoints(Range.END_TO_END, r2)}`);
          lines.push(`常量：START_TO_START=${Range.START_TO_START}, START_TO_END=${Range.START_TO_END}, END_TO_START=${Range.END_TO_START}, END_TO_END=${Range.END_TO_END}`);
        }
      } catch (e: any) { lines.push(`cloneRange/compareBoundaryPoints 失败：${e.message}`); }
      lines.push('说明：compareBoundaryPoints(how, sourceRange) 比较两 Range 边界，how 取 START_TO_START/START_TO_END/END_TO_START/END_TO_END。');
      this.setState({ rangeInfo: lines.join('\n') });
      this._addLog('range', `selectNode/cloneRange/compareBoundaryPoints 演示完成`);
    } catch (err: any) {
      this._addLog('warn', `Range selectNode 失败：${err.name} - ${err.message}`);
    }
  }

  // range.insertNode / surroundContents / extractContents / deleteContents
  _rangeMutate() {
    if (!this._caps().createRange) { this._addLog('warn', 'document.createRange 不可用'); return; }
    try {
      if (!this._rangeHost) { this._addLog('warn', '请先点击「创建 Range 宿主」'); return; }
      const host = this._rangeHost;
      const lines = [`Range 变更操作（insertNode / surroundContents / extractContents / deleteContents）：`];
      try {
        host.textContent = 'Range 变更演示文本 XYZ';
        const range = document.createRange();
        const fc = host.firstChild;
        if (fc) {
          range.setStart(fc, 4); range.setEnd(fc, 8);
          const span = document.createElement('span'); span.textContent = '[插入]';
          range.insertNode(span);
          lines.push(`range.insertNode(span) → 在起点插入 <span>[插入]</span>\nhost.textContent = "${host.textContent}"`);
        }
      } catch (e: any) { lines.push(`insertNode 失败：${e.name} - ${e.message}`); }
      try {
        host.textContent = 'Range 包裹演示文本';
        const range2 = document.createRange(); range2.selectNodeContents(host);
        range2.surroundContents(document.createElement('mark'));
        lines.push(`range2.surroundContents(<mark>) → 用 <mark> 包裹选区\nhost.innerHTML = "${host.innerHTML}"`);
      } catch (e: any) { lines.push(`surroundContents 失败：${e.name} - ${e.message}（须恰好跨完整节点）`); }
      try {
        host.textContent = 'Range 提取演示 ABCD';
        const range3 = document.createRange();
        const fc = host.firstChild;
        if (fc) {
          range3.setStart(fc, 4); range3.setEnd(fc, 10);
          const frag = range3.extractContents();
          lines.push(`range3.extractContents() → Fragment（含 "${frag.textContent}"）\nhost.textContent = "${host.textContent}"（提取后剩余）`);
          range3.deleteContents();
          lines.push(`range3.deleteContents() → 删除范围内容`);
        }
      } catch (e: any) { lines.push(`extractContents/deleteContents 失败：${e.name} - ${e.message}`); }
      this.setState({ rangeInfo: lines.join('\n') });
      this._addLog('range', `Range 变更演示完成`);
    } catch (err: any) {
      this._addLog('warn', `Range 变更失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Range 操作',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createRange ? 'success' : 'error' }, caps.createRange ? 'createRange ✓' : '不可用'),
        h(Tag, { color: caps.range ? 'success' : 'warning' }, caps.range ? 'Range ✓' : 'Range ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.createRange() 或 new Range() 创建 Range，表示文档片段区间。setStart(node, offset)/setEnd(node, offset) 定位；setStartBefore/setStartAfter/setEndBefore/setEndAfter 用相邻节点定位；selectNode 选中整个节点，selectNodeContents 仅选内容；collapsed 判断重合；cloneContents 复制为 DocumentFragment，extractContents 移出，deleteContents 删除，insertNode 插入，surroundContents 用新父节点包裹；cloneRange 克隆，compareBoundaryPoints 比较边界（用 Range.START_TO_START 等常量）；getBoundingClientRect/getClientRects 取几何矩形。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Range 宿主', { type: 'primary', size: 'sm', disabled: !caps.createRange, onClick: () => this._createRangeHost() }),
          this._btn('setStart/setEnd', { type: 'primary', size: 'sm', disabled: !caps.createRange, onClick: () => this._rangeSetStartEnd() }),
          this._btn('selectNode/cloneRange', { size: 'sm', disabled: !caps.createRange, onClick: () => this._rangeSelectAndClone() }),
          this._btn('insertNode/surround', { size: 'sm', disabled: !caps.createRange, onClick: () => this._rangeMutate() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Range 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.rangeInfo || '（点击「创建 Range 宿主」开始）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '110px', overflow: 'auto' } },
          h('code', {},
`const range = document.createRange();
range.setStart(textNode, 0); range.setEnd(textNode, 5);
range.toString();                  // 选中文本
range.cloneContents();             // 复制为 DocumentFragment
range.extractContents();           // 移出并返回
range.insertNode(newNode);         // 在起点插入
range.surroundContents(document.createElement('mark')); // 包裹`)),
        h(Alert, {
          type: 'warning',
          message: 'surroundContents 要求范围恰好跨完整节点',
          description: '若范围起止落在节点中间，surroundContents 会抛 DOMException。部分包裹需用 extractContents + insertNode 手动实现。getBoundingClientRect/getClientRects 在 jsdom 中无布局，返回零矩形。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Clipboard API 异步读写 ===================

  // navigator.clipboard.writeText(text) → Promise<void>
  async _clipboardWriteText() {
    if (!this._caps().clipboard) {
      this._addLog('warn', 'navigator.clipboard.writeText 不可用（jsdom 或非安全上下文）');
      this.setState({ clipboardInfo: 'navigator.clipboard 不可用。需 HTTPS 安全上下文或 localhost；jsdom 中通常未实现。' });
      return;
    }
    try {
      this._addLog('info', '开始 navigator.clipboard.writeText("剪贴板写入测试 📋")…');
      await navigator.clipboard.writeText('剪贴板写入测试 📋');
      this.setState({
        clipboardInfo:
          `navigator.clipboard.writeText('剪贴板写入测试 📋') → Promise<void> ✓\n` +
          `已将文本写入系统剪贴板。\n` +
          `说明：writeText 是异步 API，返回 Promise；需在安全上下文（HTTPS/localhost）且页面有焦点。`,
      });
      this._addLog('write', 'writeText 成功：写入 "剪贴板写入测试 📋"');
    } catch (err: any) {
      this._addLog('warn', `writeText 失败：${err.name} - ${err.message}（可能权限被拒）`);
      this.setState({ clipboardInfo: `writeText 失败：${err.name} - ${err.message}\n（可能权限被拒或非安全上下文）` });
    }
  }

  // navigator.clipboard.readText() → Promise<string>
  async _clipboardReadText() {
    if (!this._caps().clipboardRead) {
      this._addLog('warn', 'navigator.clipboard.readText 不可用');
      this.setState({ clipboardInfo: 'navigator.clipboard.readText 不可用。读取需用户授权（clipboard-read 权限）。' });
      return;
    }
    try {
      this._addLog('info', '开始 navigator.clipboard.readText()…');
      const text = await navigator.clipboard.readText();
      this.setState({
        clipboardInfo:
          `navigator.clipboard.readText() → Promise<string> ✓\n` +
          `读取到的文本："${text}"\n` +
          `文本长度：${text.length} 字符\n` +
          `说明：readText 需 clipboard-read 权限授权；首次调用会弹出权限请求。`,
      });
      this._addLog('read', `readText 成功：读到 "${text}"（${text.length} 字符）`);
    } catch (err: any) {
      this._addLog('warn', `readText 失败：${err.name} - ${err.message}`);
      this.setState({ clipboardInfo: `readText 失败：${err.name} - ${err.message}\n（可能权限被拒或剪贴板为空）` });
    }
  }

  // navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob, 'text/html': blob })])
  // ClipboardItem.types / ClipboardItem.getType(type)
  async _clipboardWriteItem() {
    const caps = this._caps();
    if (!caps.clipboardWrite) {
      this._addLog('warn', 'navigator.clipboard.write 不可用');
      this.setState({ clipboardInfo: 'navigator.clipboard.write 不可用（多 MIME 写入需 HTTPS）。' });
      return;
    }
    if (!caps.clipboardItem) {
      this._addLog('warn', 'ClipboardItem 未定义（无法构造多 MIME 项）');
      this.setState({ clipboardInfo: 'ClipboardItem 构造器未定义。\n说明：new ClipboardItem({ "text/plain": blob, "text/html": blob }) 用于同时写入多种 MIME。' });
      return;
    }
    try {
      this._addLog('info', '构造 ClipboardItem({ text/plain, text/html }) 并写入…');
      const plainBlob = new Blob(['ClipboardItem 多格式测试（纯文本）'], { type: 'text/plain' });
      const htmlBlob = new Blob(['<b>ClipboardItem</b> 多格式测试（<i>HTML</i>）'], { type: 'text/html' });
      const item = new ClipboardItem({ 'text/plain': plainBlob, 'text/html': htmlBlob });
      const types = item.types;
      const plainText = await (await item.getType('text/plain')).text();
      const htmlText = await (await item.getType('text/html')).text();
      await navigator.clipboard.write([item]);
      this.setState({
        clipboardInfo:
          `new ClipboardItem({ 'text/plain': blob, 'text/html': blob }) ✓\n` +
          `item.types = ${JSON.stringify(types)}\n` +
          `item.getType('text/plain') → text() = "${plainText}"；getType('text/html') → text() = "${htmlText}"\n` +
          `navigator.clipboard.write([item]) → Promise<void> ✓（已写入双格式）\n` +
          `说明：write 接受 ClipboardItem 数组；每项是 { mimeType: Blob } 映射。`,
      });
      this._addLog('write', `ClipboardItem 写入成功：types=${JSON.stringify(types)}`);
    } catch (err: any) {
      this._addLog('warn', `ClipboardItem 写入失败：${err.name} - ${err.message}`);
      this.setState({ clipboardInfo: `ClipboardItem 写入失败：${err.name} - ${err.message}\n（可能 MIME 不被支持或权限被拒）` });
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. Clipboard API 异步读写',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.clipboard ? 'success' : 'error' }, caps.clipboard ? 'clipboard.writeText ✓' : '不可用'),
        h(Tag, { color: caps.clipboardItem ? 'success' : 'warning' }, caps.clipboardItem ? 'ClipboardItem ✓' : 'ClipboardItem ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.clipboard.writeText(text) / readText() 是最常用的纯文本异步剪贴板 API；navigator.clipboard.write([ClipboardItem]) / read() 支持多 MIME（text/plain、text/html、image/png）。new ClipboardItem({ "text/plain": blob, "text/html": blob }) 构造多格式项；item.types 列出 MIME，item.getType(mime) 取对应 Blob。所有方法返回 Promise，需 HTTPS 安全上下文 + 用户授权。clipboardchange 事件在剪贴板内容变化时触发。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('writeText', { type: 'primary', size: 'sm', disabled: !caps.clipboard, onClick: () => this._clipboardWriteText() }),
          this._btn('readText', { type: 'primary', size: 'sm', disabled: !caps.clipboardRead, onClick: () => this._clipboardReadText() }),
          this._btn('write ClipboardItem', { size: 'sm', disabled: !caps.clipboardWrite || !caps.clipboardItem, onClick: () => this._clipboardWriteItem() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Clipboard 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {}, s.clipboardInfo || '（点击 writeText / readText / write ClipboardItem）')),
        h(Alert, {
          type: 'warning',
          message: 'Clipboard API 需安全上下文 + 权限',
          description: 'navigator.clipboard 仅在安全上下文（HTTPS / localhost / file://）可用，http 下为 undefined。readText/read 需 clipboard-read 权限；writeText/write 需 clipboard-write 权限。jsdom 通常未实现，演示时记日志说明。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：execCommand 演示 ===================

  // document.execCommand / queryCommandSupported / queryCommandEnabled / queryCommandValue
  // 同时执行 copy/cut/paste 三个剪贴板命令并对比 queryCommandSupported
  _execCommandDetect() {
    if (!this._caps().execCommand) { this._addLog('warn', 'document.execCommand 不可用'); return; }
    try {
      const cmds = ['copy', 'cut', 'paste', 'selectAll', 'bold', 'italic', 'underline', 'insertText', 'formatBlock', 'delete', 'redo', 'undo'];
      const lines = ['document.queryCommandSupported / queryCommandEnabled / queryCommandValue 检测：'];
      for (const cmd of cmds) {
        let supported = 'n/a', enabled = 'n/a', value = 'n/a';
        try { supported = String(document.queryCommandSupported(cmd)); } catch (e: any) { supported = `err(${e.name})`; }
        try { enabled = String(document.queryCommandEnabled(cmd)); } catch (e: any) { enabled = `err(${e.name})`; }
        try { value = String(document.queryCommandValue(cmd)); } catch (e: any) { value = `err(${e.name})`; }
        lines.push(`  ${cmd.padEnd(12)} supported=${supported.padEnd(6)} enabled=${enabled.padEnd(6)} value="${value}"`);
      }
      lines.push('', 'document.execCommand(cmd, showUI, value) 执行结果：');
      const exec = (cmd: any, ...args: any[]) => { try { return String(document.execCommand(cmd, ...args)); } catch (e: any) { return `err(${e.message})`; } };
      lines.push(`  selectAll → ${exec('selectAll')}`, `  insertText("X") → ${exec('insertText', false, 'X')}`);
      lines.push(`  formatBlock <h1> → ${exec('formatBlock', false, 'h1')}`, `  bold → ${exec('bold')}`, `  copy → ${exec('copy')}`);
      // copy/cut/paste 剪贴板命令对比（需可编辑宿主 + focus）
      if (!this._selHost) {
        this._selHost = document.createElement('textarea');
        this._selHost.value = 'execCommand 剪贴板命令演示文本';
        document.body.appendChild(this._selHost);
      }
      try { this._selHost.focus(); this._selHost.select(); } catch { /* noop */ }
      lines.push('', 'copy/cut/paste 剪贴板命令（受权限限制）：');
      for (const cmd of ['copy', 'cut', 'paste']) {
        lines.push(`  execCommand('${cmd}') → ${exec(cmd)}（supported=${String(document.queryCommandSupported(cmd))}）`);
      }
      lines.push('', '说明：execCommand 已废弃（Deprecated），推荐用 Clipboard API；paste 出于安全通常被禁用；jsdom 中均返回 false。');
      this.setState({ execInfo: lines.join('\n') });
      this._addLog('exec', `execCommand 演示完成：检测 ${cmds.length} 个命令并执行 copy/cut/paste`);
    } catch (err: any) {
      this._addLog('warn', `execCommand 演示失败：${err.name} - ${err.message}`);
    }
  }

  // execCommand('insertText') / formatBlock / bold / italic / underline / undo / redo 演示富文本编辑
  _execFormatCmds() {
    if (!this._caps().execCommand) { this._addLog('warn', 'document.execCommand 不可用'); return; }
    try {
      if (!this._rangeHost) {
        const host = document.createElement('div');
        host.contentEditable = 'true';
        host.textContent = 'execCommand 富文本演示';
        document.body.appendChild(host);
        this._rangeHost = host;
      }
      const host = this._rangeHost;
      const lines: any[] = [];
      const exec = (cmd: any, ...args: any[]) => { try { return String(document.execCommand(cmd, ...args)); } catch (e: any) { return `err(${e.name}: ${e.message})`; } };
      try { host.focus(); } catch { /* noop */ }
      lines.push(`execCommand('selectAll') → ${exec('selectAll')}`, `execCommand('bold') → ${exec('bold')}（加粗选区）`);
      lines.push(`execCommand('italic') → ${exec('italic')}（斜体选区）`, `execCommand('underline') → ${exec('underline')}（下划线）`);
      lines.push(`execCommand('formatBlock', false, 'h2') → ${exec('formatBlock', false, 'h2')}（块级格式）`, `execCommand('insertText', false, ' [插入文本] ') → ${exec('insertText', false, ' [插入文本] ')}`);
      lines.push(`execCommand('undo') → ${exec('undo')}（撤销）`, `execCommand('redo') → ${exec('redo')}（重做）`);
      lines.push('', `host.innerHTML = "${host.innerHTML}"`);
      lines.push('说明：execCommand 主要用于 contenteditable 富文本编辑；formatBlock 用标签名（h1/h2/p/div）改变块级格式。');
      this.setState({ execInfo: lines.join('\n') });
      this._addLog('exec', `execCommand 富文本演示完成`);
    } catch (err: any) {
      this._addLog('warn', `execFormatCmds 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. execCommand 演示（已废弃）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.execCommand ? 'success' : 'error' }, caps.execCommand ? 'execCommand ✓' : '不可用'),
        h(Tag, { color: 'warning' }, 'Deprecated'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.execCommand(cmd, showUI, value) 执行编辑命令：copy/cut/paste（剪贴板）、selectAll（全选）、bold/italic/underline（富文本）、insertText（插入文本）、formatBlock（块级格式 h1/h2/p）、undo/redo（撤销重做）。queryCommandSupported(cmd) 检测支持，queryCommandEnabled(cmd) 检测当前可用，queryCommandValue(cmd) 取值。execCommand 已被 MDN 标记为 Deprecated，推荐用 Clipboard API 替代 copy/cut/paste，但旧浏览器与富文本编辑仍依赖它。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('命令支持检测 + copy/cut/paste', { type: 'primary', size: 'sm', disabled: !caps.execCommand, onClick: () => this._execCommandDetect() }),
          this._btn('富文本格式命令', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._execFormatCmds() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'execCommand 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.execInfo || '（点击按钮执行 execCommand）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '110px', overflow: 'auto' } },
          h('code', {},
`// 富文本编辑（contenteditable）
editor.focus();
document.execCommand('bold');                          // 加粗
document.execCommand('formatBlock', false, 'h2');      // 块级格式
document.execCommand('insertText', false, '插入文本');  // 插入文本
// 检测支持
document.queryCommandSupported('copy');   // 是否支持
document.queryCommandEnabled('copy');     // 当前是否可用`)),
        h(Alert, {
          type: 'warning',
          message: 'execCommand 已废弃，新代码请用 Clipboard API',
          description: 'MDN 将 document.execCommand 标记为 Deprecated。copy/cut/paste 用 navigator.clipboard 替代；富文本编辑推荐用 contenteditable + Selection/Range 或成熟编辑器。paste 出于安全通常被禁用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：copy/cut/paste 事件拦截 ===================

  // 注册 copy 事件监听器，拦截并 setData 自定义内容，preventDefault 阻止默认复制
  _registerCopyIntercept() {
    if (typeof document === 'undefined') { this._addLog('warn', 'document 不可用'); return; }
    try {
      if (this._copyHandler) { try { document.removeEventListener('copy', this._copyHandler); } catch { /* noop */ } }
      this._copyHandler = (e: any) => {
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '【被拦截的 copy 事件】自定义纯文本');
          try { e.clipboardData.setData('text/html', '<i>【被拦截的 copy 事件】</i>自定义 HTML'); } catch { /* noop */ }
          const got = e.clipboardData.getData('text/plain');
          this._addLog('event', `copy 事件拦截：setData text/plain，getData 回读="${got}"`);
        }
        e.preventDefault();
      };
      document.addEventListener('copy', this._copyHandler);
      this.setState({
        eventInfo:
          `已注册 document 级 'copy' 事件监听器 ✓\n` +
          `回调：e.clipboardData.setData('text/plain', '【被拦截的 copy 事件】自定义纯文本') + setData('text/html', ...) + e.preventDefault()\n` +
          `说明：copy/cut/paste 事件可被 preventDefault 拦截；e.clipboardData 在事件回调中可读写。`,
      });
      this._addLog('event', '已注册 copy 拦截监听器，点击「手动触发 copy 事件」测试');
    } catch (err: any) {
      this._addLog('warn', `注册 copy 拦截失败：${err.name} - ${err.message}`);
    }
  }

  // 注册 cut / paste 拦截
  _registerCutPasteIntercept() {
    if (typeof document === 'undefined') { this._addLog('warn', 'document 不可用'); return; }
    try {
      if (this._cutHandler) { try { document.removeEventListener('cut', this._cutHandler); } catch { /* noop */ } }
      if (this._pasteHandler) { try { document.removeEventListener('paste', this._pasteHandler); } catch { /* noop */ } }
      this._cutHandler = (e: any) => {
        if (e.clipboardData) e.clipboardData.setData('text/plain', '【cut 拦截】剪切被替换为此文本');
        e.preventDefault();
        this._addLog('event', 'cut 事件拦截：setData + preventDefault');
      };
      this._pasteHandler = (e: any) => {
        if (e.clipboardData) {
          const types = e.clipboardData.types ? Array.from(e.clipboardData.types) : [];
          const plain = e.clipboardData.getData('text/plain');
          this._addLog('event', `paste 事件拦截：types=${JSON.stringify(types)}，text/plain="${plain}"`);
        }
        e.preventDefault();
      };
      document.addEventListener('cut', this._cutHandler);
      document.addEventListener('paste', this._pasteHandler);
      this.setState({
        eventInfo:
          `已注册 document 级 'cut' 与 'paste' 事件监听器 ✓\n` +
          `cut 回调：setData('text/plain', '【cut 拦截】...') + preventDefault；paste 回调：读取 types 与 getData('text/plain') + preventDefault\n` +
          `说明：paste 可读取剪贴板内容（部分浏览器需权限）；preventDefault 阻止默认粘贴。`,
      });
      this._addLog('event', '已注册 cut/paste 拦截监听器');
    } catch (err: any) {
      this._addLog('warn', `注册 cut/paste 拦截失败：${err.name} - ${err.message}`);
    }
  }

  // 手动 dispatchEvent 触发 copy 事件（jsdom 中可用 new Event 或 new ClipboardEvent）
  _dispatchCopyEvent() {
    if (typeof document === 'undefined' || typeof Event === 'undefined') {
      this._addLog('warn', 'Event/document 不可用'); return;
    }
    try {
      let evt;
      const caps = this._caps();
      if (caps.clipboardEvent) {
        try { evt = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }); }
        catch (e: any) { evt = new Event('copy', { bubbles: true, cancelable: true }); }
      } else {
        evt = new Event('copy', { bubbles: true, cancelable: true });
      }
      document.dispatchEvent(evt);
      this.setState({
        eventInfo:
          `document.dispatchEvent(${evt.constructor.name}('copy')) → 已派发 copy 事件\n` +
          `事件类型：${evt.type}，bubbles=${evt.bubbles}，cancelable=${evt.cancelable}，defaultPrevented=${evt.defaultPrevented}（若已注册 copy 拦截并 preventDefault 则 true）\n` +
          `说明：jsdom 中 ClipboardEvent 可能不可用，回退为 new Event('copy')；此时 e.clipboardData 为 undefined。`,
      });
      this._addLog('event', `派发 copy 事件：defaultPrevented=${evt.defaultPrevented}（用 ${evt.constructor.name}）`);
    } catch (err: any) {
      this._addLog('warn', `派发 copy 事件失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. copy / cut / paste 事件拦截',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.event ? 'success' : 'error' }, caps.event ? 'Event ✓' : '不可用'),
        h(Tag, { color: caps.clipboardEvent ? 'success' : 'warning' }, caps.clipboardEvent ? 'ClipboardEvent ✓' : 'ClipboardEvent ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.addEventListener("copy", e => { e.clipboardData.setData("text/plain", data); e.preventDefault(); }) 拦截复制并替换剪贴板内容。e.clipboardData.getData(type) 读取，setData(type, data) 写入；e.preventDefault() 阻止默认行为。copy/cut/paste 三类事件均可被拦截。jsdom 中可用 new Event("copy") 或 new ClipboardEvent("copy") 手动 dispatchEvent 触发（ClipboardEvent 可能未定义，回退为 Event 时 e.clipboardData 为 undefined）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注册 copy 拦截', { type: 'primary', size: 'sm', disabled: !caps.event, onClick: () => this._registerCopyIntercept() }),
          this._btn('注册 cut/paste 拦截', { size: 'sm', disabled: !caps.event, onClick: () => this._registerCutPasteIntercept() }),
          this._btn('手动触发 copy', { type: 'primary', size: 'sm', disabled: !caps.event, onClick: () => this._dispatchCopyEvent() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '事件拦截状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.eventInfo || '（点击「注册 copy 拦截」然后「手动触发 copy」测试）')),
        h(Alert, {
          type: 'info',
          message: 'clipboardData 仅在事件回调中可写',
          description: 'e.clipboardData 是 DataTransfer 对象，仅在 copy/cut/paste 事件回调中可读写；回调结束后不可访问。copy/cut 中可 setData 写入剪贴板，paste 中可 getData 读取。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：selection.modify 高级操作 ===================

  // selection.modify('extend', 'forward', 'character') 扩展选区
  _modifyExtendDemo() {
    if (!this._caps().selection) { this._addLog('warn', 'window.getSelection 不可用'); return; }
    try {
      const sel = window.getSelection();
      if (!sel) {
        this.setState({ modifyInfo: 'getSelection() 返回 null（jsdom 可能不支持 modify）' });
        this._addLog('warn', 'getSelection() 返回 null'); return;
      }
      let prepLine = '';
      if (this._selHost) {
        try { this._selHost.focus(); if (typeof this._selHost.setSelectionRange === 'function') { this._selHost.setSelectionRange(0, 1); prepLine = `初始：textarea.setSelectionRange(0, 1) → 选第 1 个字符\n`; } }
        catch (e: any) { prepLine = `初始选区失败：${e.message}\n`; }
      } else { prepLine = '（未创建 textarea 宿主，先点 Card 1「创建选区宿主」）\n'; }
      const beforeText = sel.toString();
      const modifySupported = typeof sel.modify === 'function';
      let modifyLine = '';
      if (modifySupported) {
        try {
          sel.modify('extend', 'forward', 'character');
          sel.modify('extend', 'forward', 'character');
          sel.modify('extend', 'forward', 'word');
          modifyLine = `sel.modify('extend','forward','character') ×2 + ('extend','forward','word') ×1 → 扩展选区\n`;
        } catch (e: any) { modifyLine = `modify 抛错：${e.name} - ${e.message}\n`; }
      } else { modifyLine = `selection.modify 不可用（jsdom 未实现，浏览器中可用）\n`; }
      const afterText = sel.toString();
      this.setState({
        modifyInfo:
          `${prepLine}` +
          `modify 前：toString="${beforeText}"，rangeCount=${sel.rangeCount}，isCollapsed=${sel.isCollapsed}\n` +
          `${modifyLine}` +
          `modify 后：toString="${afterText}"，rangeCount=${sel.rangeCount}，isCollapsed=${sel.isCollapsed}\n` +
          `说明：modify(alter, direction, granularity)：alter='extend'/'move'；direction='forward'/'backward'；granularity='character'/'word'/'line'。`,
      });
      this._addLog('modify', `extend 演示：modifySupported=${modifySupported}，"${beforeText}" → "${afterText}"`);
    } catch (err: any) {
      this._addLog('warn', `modify extend 演示失败：${err.name} - ${err.message}`);
    }
  }

  // selection.modify('move', 'backward', 'word') 移动光标 + collapse/extend
  // 同时演示 deleteFromDocument / removeRange / removeAllRanges
  _modifyMoveDemo() {
    if (!this._caps().selection) { this._addLog('warn', 'window.getSelection 不可用'); return; }
    try {
      const sel = window.getSelection();
      if (!sel) { this.setState({ modifyInfo: 'getSelection() 返回 null' }); return; }
      let prepLine = '';
      if (this._selHost) {
        try { this._selHost.focus(); if (typeof this._selHost.setSelectionRange === 'function') { this._selHost.setSelectionRange(5, 10); prepLine = `初始：textarea.setSelectionRange(5, 10) → 选 [5,10)\n`; } }
        catch (e: any) { prepLine = `初始选区失败：${e.message}\n`; }
      }
      const beforeText = sel.toString();
      const modifySupported = typeof sel.modify === 'function';
      const lines = [`${prepLine}modify 前：toString="${beforeText}"，isCollapsed=${sel.isCollapsed}`];
      if (modifySupported) {
        try { sel.modify('move', 'backward', 'word'); lines.push(`sel.modify('move','backward','word') → 移动光标（选区折叠）`); }
        catch (e: any) { lines.push(`move 抛错：${e.name} - ${e.message}`); }
      } else { lines.push(`selection.modify 不可用（jsdom 未实现）`); }
      // collapse / extend
      try {
        const anchorNode = sel.anchorNode;
        if (anchorNode) {
          sel.collapse(anchorNode, 0);
          lines.push(`sel.collapse(anchorNode, 0) → 折叠到节点起始（isCollapsed=${sel.isCollapsed}）`);
          try { sel.extend(anchorNode, 3); lines.push(`sel.extend(anchorNode, 3) → 扩展焦点到 offset 3（isCollapsed=${sel.isCollapsed}，toString="${sel.toString()}")`); }
          catch (e: any) { lines.push(`extend 抛错：${e.message}`); }
        } else { lines.push(`anchorNode 为 null，无法 collapse/extend`); }
      } catch (e: any) { lines.push(`collapse/extend 抛错：${e.name} - ${e.message}`); }
      // deleteFromDocument / removeRange / removeAllRanges
      lines.push('', '— deleteFromDocument / removeRange / removeAllRanges —');
      if (this._caps().createRange && this._selHost) {
        try {
          const fc = this._selHost.firstChild;
          if (!fc) { lines.push('宿主无文本子节点'); }
          else {
            const range = document.createRange(); range.setStart(fc, 0); range.setEnd(fc, 5);
            sel.removeAllRanges(); sel.addRange(range);
            lines.push(`建立选区：setStart(fc,0)/setEnd(fc,5) + addRange，toString="${sel.toString()}"`);
            const tryOp = (label: any, fn: any) => { try { fn(); lines.push(label); } catch (e: any) { lines.push(`${label.split(' →')[0]} 抛错：${e.name} - ${e.message}`); } };
            tryOp('sel.deleteFromDocument() → 删除选中内容（jsdom 可能无效果）', () => sel.deleteFromDocument());
            tryOp(`sel.removeRange(r2) → 移除指定 Range，rangeCount=${sel.rangeCount}`, () => { const r2 = document.createRange(); r2.setStart(fc, 0); r2.setEnd(fc, 3); sel.removeAllRanges(); sel.addRange(r2); sel.removeRange(r2); });
            tryOp(`sel.removeAllRanges() → 清空所有 Range，rangeCount=${sel.rangeCount}，isCollapsed=${sel.isCollapsed}`, () => sel.removeAllRanges());
          }
        } catch (e: any) { lines.push(`操作失败：${e.name} - ${e.message}`); }
      } else { lines.push('createRange 或宿主不可用'); }
      lines.push('说明：move 移动光标，extend 扩展焦点；collapse(node, offset) 折叠；deleteFromDocument 删除选中；removeRange/removeAllRanges 移除 Range。');
      this.setState({ modifyInfo: lines.join('\n') });
      this._addLog('modify', `move/collapse/extend/delete 演示完成：modifySupported=${modifySupported}`);
    } catch (err: any) {
      this._addLog('warn', `modify move 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. selection.modify 高级操作',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.selection ? 'success' : 'error' }, caps.selection ? 'Selection ✓' : '不可用'),
        h(Tag, { color: 'warning' }, 'modify 非标准'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'selection.modify(alter, direction, granularity) 调整选区：alter="extend" 扩展选区 / "move" 移动光标；direction="forward"/"backward"/"left"/"right"；granularity="character"/"word"/"line"/"paragraph"/"lineboundary"。collapse(node, offset) 折叠光标；extend(node, offset) 扩展焦点（保持锚点）；deleteFromDocument() 删除选中内容；removeRange(range) 移除指定 Range；removeAllRanges() 清空。注：modify 为非标准 API（Firefox/Chrome 支持，jsdom 未实现）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('modify extend', { type: 'primary', size: 'sm', disabled: !caps.selection, onClick: () => this._modifyExtendDemo() }),
          this._btn('move + collapse/delete', { size: 'sm', disabled: !caps.selection, onClick: () => this._modifyMoveDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'modify 操作结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.modifyInfo || '（先在 Card 1 创建选区宿主，再点本卡按钮）')),
        h(Alert, {
          type: 'info',
          message: 'modify 是非标准但广泛支持的 API',
          description: 'selection.modify 由 Firefox 引入，Chrome/Edge/Safari 均支持，但未进入规范。jsdom 未实现，typeof sel.modify === "undefined"。需跨浏览器兼容时用 Range.setStart/setEnd + Selection.addRange 手动模拟。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Selection / Clipboard / execCommand 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 Selection API（选区）、Range API（文档片段区间）、Clipboard API（异步剪贴板读写）、execCommand（已废弃的编辑命令）、copy/cut/paste 事件拦截、selection.modify 高级操作。所有 API 调用前做 typeof 能力检测，不可用时仅记日志。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
