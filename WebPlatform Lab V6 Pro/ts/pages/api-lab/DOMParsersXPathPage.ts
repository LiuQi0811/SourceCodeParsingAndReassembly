// =====================================================================
// DOMParsersXPathPage.js —— DOM 解析与序列化 + XPath 实验室
// 演示 MDN：DOMParser(parseFromString, text/html|application/xml|image/svg+xml, <parsererror>)
//   XMLSerializer(serializeToString, outerHTML/innerHTML, void 元素自闭合差异)
//   document.evaluate + XPathResult 常量(ANY/NUMBER/STRING/BOOLEAN/ITERATOR/SNAPSHOT/...)
//   DocumentFragment + DOMImplementation(createDocument/createHTMLDocument) + <template>.content
//   Range(createRange/setStart/setEnd/selectNode/extractContents/surroundContents) + Selection
// =====================================================================

import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

// XPathResult 常量兜底：jsdom 实现了 XPath 子集但常量可能缺失，
// 优先取全局 XPathResult，缺失则补齐（polyfill，try/catch 保护），无则回退数值字面量。
const XPR = (() => {
  const fallback = {
    ANY_TYPE: 0, NUMBER_TYPE: 1, STRING_TYPE: 2, BOOLEAN_TYPE: 3,
    UNORDERED_NODE_ITERATOR_TYPE: 4, ORDERED_NODE_ITERATOR_TYPE: 5,
    UNORDERED_NODE_SNAPSHOT_TYPE: 6, ORDERED_NODE_SNAPSHOT_TYPE: 7,
    ANY_UNORDERED_NODE_TYPE: 8, FIRST_ORDERED_NODE_TYPE: 9,
  };
  if (typeof XPathResult !== 'undefined') {
    for (const [k, v] of (Object as any).entries(fallback)) {
      if (typeof ((XPathResult as any)[(k as any)]) === 'undefined') {
        try { ((XPathResult as any)[(k as any)]) = v; } catch { /* 只读则忽略 */ }
      }
    }
    return XPathResult;
  }
  return fallback;
})();

const DEMO_XML = `<items>
  <item id="1"><title>Alpha</title><price>10</price></item>
  <item id="2"><title>Beta</title><price>20</price></item>
  <item id="3"><title>Gamma</title><price>30</price></item>
  <item id="4"><title>Delta</title><price>40</price></item>
</items>`;

export interface DOMParsersXPathPageProps extends Props {}

export interface DOMParsersXPathPageState extends State {}

export class DOMParsersXPathPage extends Page {
  declare props: DOMParsersXPathPageProps;
  declare state: DOMParsersXPathPageState;
  _inited: boolean = false;
  initialState(): DOMParsersXPathPageState {
    return {
      logs: [],
      capsSummary: '',
      parseResult: '',
      serializeResult: '',
      xpathResult: '',
      fragResult: '',
      rangeResult: '',
    };
  }

  // =================== 生命周期 ===================
  componentDidMount(): void {
    // ★ 守卫：防止 setState 触发重渲染后再次进入 componentDidMount 导致死循环 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测：全部 typeof，不可用时记 warn，绝不抛异常 ——
    const mark = (ok: any) => (ok ? '✓' : '✗');
    const hasDOMParser = typeof DOMParser !== 'undefined';
    const hasXMLSerializer = typeof XMLSerializer !== 'undefined';
    const hasEvaluate = typeof document !== 'undefined' && typeof document.evaluate === 'function';
    const hasXPathResult = typeof XPathResult !== 'undefined';
    const hasRange = typeof document !== 'undefined' && typeof document.createRange === 'function';
    const hasCreateDoc = typeof document !== 'undefined'
      && typeof document.implementation === 'object'
      && typeof document.implementation.createDocument === 'function';
    const hasSelection = typeof window !== 'undefined' && typeof window.getSelection === 'function';

    const caps = [
      `DOMParser ${mark(hasDOMParser)}`,
      `XMLSerializer ${mark(hasXMLSerializer)}`,
      `document.evaluate ${mark(hasEvaluate)}`,
      `XPathResult ${mark(hasXPathResult)}`,
      `createRange ${mark(hasRange)}`,
      `implementation.createDocument ${mark(hasCreateDoc)}`,
      `window.getSelection ${mark(hasSelection)}`,
    ];
    this.setState({ capsSummary: '能力检测：' + caps.join('  ·  ') });

    if (!hasEvaluate || !hasXPathResult) {
      this._addLog('warn', 'document.evaluate / XPathResult 不可用：jsdom 实现了 XPath 子集但常量可能缺失（已用本地常量兜底）');
    }
    if (!hasSelection) {
      this._addLog('warn', 'window.getSelection 不可用（jsdom 对 Selection 部分支持），演示会降级');
    }
    if (!hasRange) {
      this._addLog('warn', 'document.createRange 不可用，Range/Selection 演示会降级');
    }
  }

  componentWillUnmount(): void {
    // 本页主要是纯计算，无长期监听；如有 AbortController 则 abort（当前未使用）。
    // 通过 this.on() 注册的事件由 Component.destroy 统一解绑。
  }

  // =================== 通用辅助 ===================
  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _card(title: any, desc: any, extra: any, children: any) {
    // Card 用法：new Card({ title, desc, extra, children }); registerChild; render
    // Card.render 只消费 title/extra/children，desc 这里前置一个 <p> 保证可见
    const kids = Array.isArray(children) ? children : [children];
    const body = desc ? [h('p', { class: 'fs-sm text-secondary' }, desc), ...kids] : kids;
    const card = new Card({ title, desc, extra, children: body });
    this.registerChild(card);
    return card.render();
  }

  // 安全解析：返回 Document 或 null（捕获异常）
  _safeParse(string: any, mimeType: any) {
    if (typeof DOMParser === 'undefined') return null;
    try { return new DOMParser().parseFromString(string, mimeType); }
    catch (err: any) {
      this._addLog('error', `parseFromString('${mimeType}') 抛异常：${err.message}`);
      return null as any;
    }
  }

  // 检测 XML 解析错误：<parsererror> 元素
  _detectParserError(doc: any) {
    if (!doc) return null;
    try {
      const direct = doc.querySelector('parsererror');
      if (direct) return direct.textContent.trim().slice(0, 200);
      if (doc.documentElement && doc.documentElement.tagName === 'parsererror') {
        return doc.documentElement.textContent.trim().slice(0, 200);
      }
    } catch { /* noop */ }
    return null as any;
  }

  // =================== Card 1: DOMParser（HTML/XML/SVG 解析）===================
  _parseHtml() {
    if (typeof DOMParser === 'undefined') {
      this._addLog('warn', 'DOMParser 不可用（typeof DOMParser === "undefined"）');
      this.setState({ parseResult: 'DOMParser 不可用' });
      return;
    }
    try {
      const html = '<div id="parsed"><span class="x">hello</span></div>';
      const doc = this._safeParse(html, 'text/html');
      if (!doc) { this.setState({ parseResult: '解析失败（返回 null）' }); return; }
      const byId = doc.getElementById('parsed'); // text/html 自动补 html/head/body
      const span = byId ? byId.querySelector('span.x') : null;
      const lines = [
        `输入字符串: ${html}`,
        `mimeType: text/html`,
        `返回类型: ${doc.constructor?.name || 'Document'}`,
        `documentElement.tagName: ${doc.documentElement?.tagName}`,
        `doc.head 存在: ${!!doc.head}（text/html 自动补 html/head/body）`,
        `doc.body 存在: ${!!doc.body}`,
        `getElementById('parsed'): ${byId ? `<${byId.tagName.toLowerCase()} id="${byId.id}">` : 'null'}`,
        `  └ querySelector('span.x'): ${span ? `<span class="${span.className}">${span.textContent}</span>` : 'null'}`,
        `doc.body.innerHTML: "${doc.body?.innerHTML || ''}"`,
        '',
        '说明: text/html 自动修正（补全 html/head/body）；XML 模式严格解析，错误时产生 <parsererror>。',
      ];
      this.setState({ parseResult: lines.join('\n') });
      this._addLog('parse', `解析 HTML 片段 → getElementById('parsed')=${byId?.tagName || 'null'}，span 文本="${span?.textContent || ''}"`);
    } catch (err: any) {
      this._addLog('error', `HTML 解析失败：${err.message}`);
    }
  }

  _parseSvg() {
    if (typeof DOMParser === 'undefined') { this._addLog('warn', 'DOMParser 不可用'); return; }
    try {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">'
        + '<rect x="10" y="10" width="80" height="30" fill="#1677ff"/></svg>';
      const doc = this._safeParse(svg, 'image/svg+xml');
      if (!doc) { this.setState({ parseResult: 'SVG 解析失败（返回 null）' }); return; }
      const errText = this._detectParserError(doc);
      if (errText) {
        this.setState({ parseResult: `SVG 解析出错：<parsererror>\n${errText}` });
        this._addLog('warn', `SVG 解析产生 <parsererror>：${errText.slice(0, 80)}`);
        return;
      }
      const rect = doc.querySelector('rect');
      const svgEl = doc.documentElement;
      const ser = typeof XMLSerializer !== 'undefined' ? new XMLSerializer().serializeToString(doc) : '(XMLSerializer 不可用)';
      const lines = [
        `输入字符串: ${svg}`,
        `mimeType: image/svg+xml`,
        `documentElement.tagName: ${svgEl?.tagName}（SVG 命名空间）`,
        `namespaceURI: ${svgEl?.namespaceURI}`,
        `querySelector('rect'): ${rect ? '<rect>' : 'null'}`,
        `  rect.width=${rect?.getAttribute('width')} height=${rect?.getAttribute('height')} fill=${rect?.getAttribute('fill')}`,
        `serializeToString(doc): ${ser}`,
        '',
        '说明: image/svg+xml 解析得到的根元素位于 SVG 命名空间，可直接 querySelector 读取图形属性。',
      ];
      this.setState({ parseResult: lines.join('\n') });
      this._addLog('parse', `解析 SVG → rect=${rect?.getAttribute('width')}x${rect?.getAttribute('height')} fill=${rect?.getAttribute('fill')}`);
    } catch (err: any) {
      this._addLog('error', `SVG 解析失败：${err.message}`);
    }
  }

  _parseErrorXml() {
    if (typeof DOMParser === 'undefined') { this._addLog('warn', 'DOMParser 不可用'); return; }
    try {
      const bad = '<root><unclosed></root>'; // 故意未闭合，触发 XML 解析错误
      const doc = this._safeParse(bad, 'application/xml');
      if (!doc) { this.setState({ parseResult: '错误 XML 解析失败（返回 null）' }); return; }
      const errText = this._detectParserError(doc);
      const lines = [
        `输入字符串: ${bad}`,
        `mimeType: application/xml`,
        `检测到 <parsererror>: ${errText ? '是' : '否'}`,
      ];
      if (errText) {
        lines.push('', '<parsererror> 文本内容:', errText);
      } else {
        lines.push('', `documentElement.tagName: ${doc.documentElement?.tagName}（部分引擎以不同方式暴露解析错误，可能未检测到 parsererror）`);
      }
      lines.push('', '说明: XML 模式严格解析，遇到未闭合标签等错误时文档根被替换为 <parsererror>（Firefox/Chromium 行为）；text/html 模式则容错修正，不产生 <parsererror>。');
      this.setState({ parseResult: lines.join('\n') });
      this._addLog('parse', `故意解析错误 XML → <parsererror> 检测结果：${errText ? '是' : '否（引擎未暴露）'}`);
    } catch (err: any) {
      this._addLog('error', `错误 XML 解析失败：${err.message}`);
    }
  }

  _renderCard1() {
    return this._card(
      '1. DOMParser（HTML / XML / SVG 解析）',
      'new DOMParser().parseFromString(string, mimeType)；mimeType 取 text/html（返回完整 Document，可 getElementById）/ application/xml / image/svg+xml / text/xml。text/html 自动补 html/head/body；XML 模式解析错误产生 <parsererror> 元素。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'DOMParser'),
        h(Tag, { color: 'success' }, 'text/html'),
        h(Tag, { color: 'warning' }, 'image/svg+xml'),
        h(Tag, { color: 'default' }, 'application/xml'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('解析 HTML 片段', { type: 'primary', size: 'sm', onClick: () => this._parseHtml() }),
          this._btn('解析 SVG 片段', { size: 'sm', onClick: () => this._parseSvg() }),
          this._btn('故意解析错误 XML', { size: 'sm', onClick: () => this._parseErrorXml() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '解析结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px' } }, this.state.parseResult || '（点击上方按钮）'),
      ],
    );
  }

  // =================== Card 2: XMLSerializer（序列化）===================
  _serializeElement() {
    if (typeof XMLSerializer === 'undefined') {
      this._addLog('warn', 'XMLSerializer 不可用（typeof XMLSerializer === "undefined"）');
      this.setState({ serializeResult: 'XMLSerializer 不可用' });
      return;
    }
    try {
      const serializer = new XMLSerializer();
      const target = this.el ? this.el.querySelector('.section-title') : null; // 序列化当前页面真实 DOM 节点
      const sample = target || document.createElement('div');
      const sampleHtml = target ? '当前页面 .section-title' : '临时 div';
      const outer = serializer.serializeToString(sample);
      const innerHtml = sample.innerHTML;
      const outerHtml = sample.outerHTML;
      const lines = [
        `序列化对象: ${sampleHtml}`,
        `nodeType: ${sample.nodeType}（${sample.nodeType === 1 ? 'ELEMENT_NODE' : '其他'}）`,
        `tagName: ${sample.tagName}`,
        '',
        `serializeToString(node): "${outer.slice(0, 120)}${outer.length > 120 ? ' ...' : ''}"`,
        `node.innerHTML:        "${(innerHtml || '').slice(0, 120)}${(innerHtml || '').length > 120 ? ' ...' : ''}"`,
        `node.outerHTML:        "${(outerHtml || '').slice(0, 120)}${(outerHtml || '').length > 120 ? ' ...' : ''}"`,
        '',
        '说明: serializeToString 是 XML 序列化（保留命名空间、自闭合空元素）；innerHTML/outerHTML 是 HTML 序列化（void 元素无闭合标签，布尔属性处理不同）。',
      ];
      this.setState({ serializeResult: lines.join('\n') });
      this._addLog('serialize', `serializeToString(${sampleHtml}) 输出 ${outer.length} 字符`);
    } catch (err: any) {
      this._addLog('error', `序列化元素失败：${err.message}`);
    }
  }

  _serializeFragment() {
    if (typeof XMLSerializer === 'undefined') { this._addLog('warn', 'XMLSerializer 不可用'); return; }
    if (typeof document === 'undefined' || typeof document.createDocumentFragment !== 'function') {
      this._addLog('warn', 'document.createDocumentFragment 不可用');
      this.setState({ serializeResult: 'createDocumentFragment 不可用' });
      return;
    }
    try {
      const serializer = new XMLSerializer();
      const frag = document.createDocumentFragment(); // 构造 Fragment，append 多个元素
      const header = document.createElement('header');
      header.className = 'frag-head';
      header.textContent = '片段标题';
      frag.appendChild(header);
      const ul = document.createElement('ul');
      for (let i = 1; i <= 3; i++) {
        const li = document.createElement('li');
        li.textContent = `项 ${i}`;
        ul.appendChild(li);
      }
      frag.appendChild(ul);
      frag.appendChild(document.createElement('br')); // 空元素（自闭合）
      const serialized = serializer.serializeToString(frag);
      const lines = [
        '构造 DocumentFragment，append header + ul(li×3) + br：',
        `fragment.childNodes.length: ${frag.childNodes.length}`,
        `fragment.nodeType: ${frag.nodeType}（11 = DOCUMENT_FRAGMENT_NODE）`,
        '',
        'serializeToString(fragment):',
        serialized,
        '',
        '说明: DocumentFragment 是轻量片段，本身不产生标签；serializeToString 输出子节点拼接（XML 序列化，br 输出 <br/>）。',
      ];
      this.setState({ serializeResult: lines.join('\n') });
      this._addLog('serialize', `序列化 DocumentFragment → ${frag.childNodes.length} 子节点，输出 ${serialized.length} 字符`);
    } catch (err: any) {
      this._addLog('error', `序列化 Fragment 失败：${err.message}`);
    }
  }

  _compareInnerHtml() {
    if (typeof XMLSerializer === 'undefined') { this._addLog('warn', 'XMLSerializer 不可用'); return; }
    try {
      const serializer = new XMLSerializer();
      const box = document.createElement('div'); // 构造含 void 元素与空属性的容器
      box.className = 'compare-box';
      box.setAttribute('data-flag', '');
      const img = document.createElement('img');
      img.setAttribute('src', 'a.png');
      img.setAttribute('alt', '');
      box.appendChild(img);
      box.appendChild(document.createElement('br'));
      box.appendChild(document.createElement('hr'));
      const span = document.createElement('span');
      span.textContent = '文本';
      box.appendChild(span);
      const xml = serializer.serializeToString(box);
      const html = box.outerHTML;
      const lines = [
        '构造 div.compare-box 含 img/br/hr/span + 空属性 data-flag：',
        '',
        '【serializeToString（XML 模式）】',
        xml,
        '',
        '【outerHTML（HTML 模式）】',
        html,
        '',
        '说明: XML 模式 void 元素自闭合 <img ... />、<br/>、<hr/>；HTML 模式无闭合（<br>、<hr>）；空属性 data-flag="" 两者均输出；XML 序列化保留/补全 xmlns，HTML 不输出 xmlns。',
      ];
      this.setState({ serializeResult: lines.join('\n') });
      this._addLog('serialize', `对比 outerHTML vs serializeToString：XML=${xml.length}，HTML=${html.length}`);
    } catch (err: any) {
      this._addLog('error', `对比序列化失败：${err.message}`);
    }
  }

  _renderCard2() {
    return this._card(
      '2. XMLSerializer（序列化）',
      'new XMLSerializer().serializeToString(node) → string，可序列化 Document/Element/DocumentFragment。element.outerHTML/innerHTML 为 HTML 模式（void 元素无闭合）；XML 模式保留命名空间并以自闭合形式输出空元素。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'XMLSerializer'),
        h(Tag, { color: 'success' }, 'serializeToString'),
        h(Tag, { color: 'warning' }, 'outerHTML'),
        h(Tag, { color: 'warning' }, 'innerHTML'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('序列化当前页面元素', { type: 'primary', size: 'sm', onClick: () => this._serializeElement() }),
          this._btn('序列化 DocumentFragment', { size: 'sm', onClick: () => this._serializeFragment() }),
          this._btn('对比 innerHTML vs serializeToString', { size: 'sm', onClick: () => this._compareInnerHtml() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '序列化结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px' } }, this.state.serializeResult || '（点击上方按钮）'),
      ],
    );
  }

  // =================== Card 3: XPath 查询（document.evaluate）===================
  _getDemoXmlDoc() {
    if (typeof DOMParser === 'undefined') return null;
    const doc = this._safeParse(DEMO_XML, 'application/xml');
    if (!doc) return null;
    const errText = this._detectParserError(doc);
    if (errText) {
      this._addLog('warn', `DEMO_XML 解析产生 <parsererror>：${errText.slice(0, 60)}`);
      return null as any;
    }
    return doc;
  }

  _xpathIterator() {
    if (typeof document === 'undefined' || typeof document.evaluate !== 'function') {
      this._addLog('warn', 'document.evaluate 不可用（jsdom 可能未实现 XPath）');
      this.setState({ xpathResult: 'document.evaluate 不可用' });
      return;
    }
    const doc = this._getDemoXmlDoc();
    if (!doc) return;
    try {
      const result = document.evaluate('//item', doc, null, XPR.UNORDERED_NODE_ITERATOR_TYPE, null); // 迭代器，iterateNext() 依次取节点
      const items: any[] = [];
      let node: any;
      while ((node = result.iterateNext())) {
        const id = node.getAttribute('id');
        const title = node.querySelector('title')?.textContent || '';
        items.push(`item[id=${id}] title="${title}"`);
      }
      const lines = [
        `XPath: //item`,
        `resultType: UNORDERED_NODE_ITERATOR_TYPE(${XPR.UNORDERED_NODE_ITERATOR_TYPE})`,
        `iterateNext() 遍历到 ${items.length} 个节点:`,
        ...items.map((s: any, i: any) => `  [${i}] ${s}`),
        '',
        '说明: 迭代器类型在 DOM 修改后会失效；如需多次访问或 DOM 会变，请用快照类型。',
      ];
      this.setState({ xpathResult: lines.join('\n') });
      this._addLog('xpath', `evaluate('//item', ITERATOR) → iterateNext 取得 ${items.length} 节点`);
    } catch (err: any) {
      this._addLog('error', `XPath 迭代器查询失败：${err.message}`);
    }
  }

  _xpathSnapshot() {
    if (typeof document === 'undefined' || typeof document.evaluate !== 'function') {
      this._addLog('warn', 'document.evaluate 不可用');
      return;
    }
    const doc = this._getDemoXmlDoc();
    if (!doc) return;
    try {
      const result = document.evaluate('//item', doc, null, XPR.UNORDERED_NODE_SNAPSHOT_TYPE, null); // 快照，snapshotLength + snapshotItem(i)
      const len = typeof result.snapshotLength === 'number' ? result.snapshotLength : 0;
      const items: any[] = [];
      for (let i = 0; i < len; i++) {
        const node = result.snapshotItem(i) as any;
        const id = node?.getAttribute('id');
        const price = node?.querySelector('price')?.textContent || '';
        items.push(`snapshot[${i}] item[id=${id}] price=${price}`);
      }
      const lines = [
        `XPath: //item`,
        `resultType: UNORDERED_NODE_SNAPSHOT_TYPE(${XPR.UNORDERED_NODE_SNAPSHOT_TYPE})`,
        `snapshotLength: ${len}`,
        ...items,
        '',
        '说明: 快照把结果固化，DOM 后续修改不影响已取快照；snapshotItem(i) 按索引随机访问，可多次遍历。',
      ];
      this.setState({ xpathResult: lines.join('\n') });
      this._addLog('xpath', `evaluate('//item', SNAPSHOT) → snapshotLength=${len}`);
    } catch (err: any) {
      this._addLog('error', `XPath 快照查询失败：${err.message}`);
    }
  }

  _xpathNumber() {
    if (typeof document === 'undefined' || typeof document.evaluate !== 'function') {
      this._addLog('warn', 'document.evaluate 不可用');
      return;
    }
    const doc = this._getDemoXmlDoc();
    if (!doc) return;
    try {
      const exprCount = 'count(//item)'; // NUMBER_TYPE(1) → numberValue；演示 sum() 与 BOOLEAN_TYPE
      const rCount = document.evaluate(exprCount, doc, null, XPR.NUMBER_TYPE, null);
      const exprSum = 'sum(//price)';
      const rSum = document.evaluate(exprSum, doc, null, XPR.NUMBER_TYPE, null);
      const exprBool = 'count(//item[@id="3"]) > 0';
      const rBool = document.evaluate(exprBool, doc, null, XPR.BOOLEAN_TYPE, null);
      const lines = [
        `XPath(数量): ${exprCount}`,
        `resultType: NUMBER_TYPE(${XPR.NUMBER_TYPE}) → numberValue = ${rCount.numberValue}`,
        '',
        `XPath(求和): ${exprSum}`,
        `numberValue = ${rSum.numberValue}`,
        '',
        `XPath(布尔): ${exprBool}`,
        `resultType: BOOLEAN_TYPE(${XPR.BOOLEAN_TYPE}) → booleanValue = ${rBool.booleanValue}`,
        '',
        '说明: NUMBER_TYPE 用 count()/sum()/number() 返回数值；BOOLEAN_TYPE 用比较表达式；STRING_TYPE(2) 用 string() 返回字符串。',
      ];
      this.setState({ xpathResult: lines.join('\n') });
      this._addLog('eval', `evaluate count=${rCount.numberValue}, sum=${rSum.numberValue}, 布尔=${rBool.booleanValue}`);
    } catch (err: any) {
      this._addLog('error', `XPath NUMBER 查询失败：${err.message}`);
    }
  }

  _xpathFirstNode() {
    if (typeof document === 'undefined' || typeof document.evaluate !== 'function') {
      this._addLog('warn', 'document.evaluate 不可用');
      return;
    }
    const doc = this._getDemoXmlDoc();
    if (!doc) return;
    try {
      const expr = "//item[@id='3']/title/text()"; // FIRST_ORDERED_NODE_TYPE(9) → singleNodeValue
      const result = document.evaluate(expr, doc, null, XPR.FIRST_ORDERED_NODE_TYPE, null);
      const single = result.singleNodeValue;
      const rStr = document.evaluate(expr, doc, null, XPR.STRING_TYPE, null); // 同路径 STRING_TYPE
      const rAny = document.evaluate("//item[@id='2']/price", doc, null, XPR.ANY_UNORDERED_NODE_TYPE, null);
      const anyNode = rAny.singleNodeValue;
      const lines = [
        `XPath: ${expr}`,
        `resultType: FIRST_ORDERED_NODE_TYPE(${XPR.FIRST_ORDERED_NODE_TYPE})`,
        `singleNodeValue: ${single ? `#text "${single.textContent}"` : 'null'}`,
        '',
        `同表达式用 STRING_TYPE(${XPR.STRING_TYPE}): stringValue = "${rStr.stringValue}"`,
        '',
        `ANY_UNORDERED_NODE_TYPE(${XPR.ANY_UNORDERED_NODE_TYPE}) //item[@id='2']/price:`,
        `  singleNodeValue: ${anyNode ? `<price>${anyNode.textContent}</price>` : 'null'}`,
        '',
        '语法: /absolute · //descendant · @attr · [predicate] · text() · *[position()<3] · count() · contains() · sum() · string()',
      ];
      this.setState({ xpathResult: lines.join('\n') });
      this._addLog('xpath', `evaluate("${expr}", FIRST_ORDERED_NODE) → singleNodeValue="${single?.textContent || 'null'}"`);
    } catch (err: any) {
      this._addLog('error', `XPath FIRST_ORDERED_NODE 查询失败：${err.message}`);
    }
  }

  _renderCard3() {
    return this._card(
      '3. XPath 查询（document.evaluate）',
      'document.evaluate(xpath, contextNode, nsResolver, resultType, result)。resultType 取 XPathResult 常量：ANY_TYPE(0)/NUMBER(1)/STRING(2)/BOOLEAN(3)/UNORDERED_NODE_ITERATOR(4)/ORDERED_ITERATOR(5)/UNORDERED_SNAPSHOT(6)/ORDERED_SNAPSHOT(7)/ANY_UNORDERED_NODE(8)/FIRST_ORDERED_NODE(9)。迭代器用 iterateNext()，快照用 snapshotItem(i)/snapshotLength，标量用 numberValue/stringValue/booleanValue/singleNodeValue。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'evaluate'),
        h(Tag, { color: 'success' }, 'iterateNext'),
        h(Tag, { color: 'success' }, 'snapshotItem'),
        h(Tag, { color: 'warning' }, 'count()'),
        h(Tag, { color: 'warning' }, 'singleNodeValue'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('evaluate 迭代器', { type: 'primary', size: 'sm', onClick: () => this._xpathIterator() }),
          this._btn('evaluate 快照', { type: 'primary', size: 'sm', onClick: () => this._xpathSnapshot() }),
          this._btn('evaluate NUMBER count()', { size: 'sm', onClick: () => this._xpathNumber() }),
          this._btn('evaluate FIRST_ORDERED_NODE', { size: 'sm', onClick: () => this._xpathFirstNode() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '演示 XML（解析后执行 //item[@id=\'3\']/title/text() 等）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px' } }, DEMO_XML.trim()),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'XPath 查询结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px' } }, this.state.xpathResult || '（点击上方按钮）'),
      ],
    );
  }

  // =================== Card 4: DocumentFragment + createDocument + 模板 ===================
  _fragBuild() {
    if (typeof document === 'undefined' || typeof document.createDocumentFragment !== 'function') {
      this._addLog('warn', 'document.createDocumentFragment 不可用');
      this.setState({ fragResult: 'createDocumentFragment 不可用' });
      return;
    }
    try {
      const frag = document.createDocumentFragment(); // 批量构建：片段内组装后一次性插入，只触发一次 reflow
      const N = 5;
      for (let i = 1; i <= N; i++) {
        const li = document.createElement('li');
        li.textContent = `批量项 ${i}`;
        li.setAttribute('data-idx', String(i));
        frag.appendChild(li);
      }
      const holder = document.createElement('ul');
      holder.appendChild(frag); // 片段子节点被"转移"进去，片段自身不占位
      const childCount = holder.children.length;
      const items = Array.from(holder.children).map((li: any) => `<li data-idx="${li.getAttribute('data-idx')}">${li.textContent}</li>`);
      const lines = [
        `createDocumentFragment() → append ${N} 个 <li> → 一次性插入 <ul>`,
        `插入后 holder.children.length: ${childCount}`,
        `fragment.nodeType: ${frag.nodeType}（11 = DOCUMENT_FRAGMENT_NODE，插入后片段自身消失）`,
        '',
        '生成结构:',
        ...items,
        '',
        '说明: DocumentFragment 是空文档片段，appendChild 到真实 DOM 时子节点被"转移"进去；批量插入只触发一次 reflow，性能优于逐个 appendChild。',
      ];
      this.setState({ fragResult: lines.join('\n') });
      this._addLog('frag', `createDocumentFragment 批量构建 ${N} 个 li，一次性插入 holder`);
    } catch (err: any) {
      this._addLog('error', `Fragment 构建失败：${err.message}`);
    }
  }

  _createHTMLDoc() {
    if (typeof document === 'undefined' || !document.implementation || typeof document.implementation.createHTMLDocument !== 'function') {
      this._addLog('warn', 'implementation.createHTMLDocument 不可用');
      this.setState({ fragResult: 'createHTMLDocument 不可用' });
      return;
    }
    try {
      const htmlDoc = document.implementation.createHTMLDocument('独立文档标题'); // 独立 HTML Document
      let xmlDoc = null; // createDocument(ns, qName, doctype)：独立 XML Document
      if (typeof document.implementation.createDocument === 'function') {
        try { xmlDoc = document.implementation.createDocument('urn:demo', 'root', null); }
        catch (e: any) { this._addLog('warn', `createDocument 抛错：${e.message}`); }
      }
      const lines = [
        `createHTMLDocument('独立文档标题') → ${htmlDoc.constructor?.name || 'HTMLDocument'}`,
        `htmlDoc.title: "${htmlDoc.title}"`,
        `htmlDoc.documentElement.tagName: ${htmlDoc.documentElement?.tagName}`,
        `htmlDoc.head 存在: ${!!htmlDoc.head} | htmlDoc.body 存在: ${!!htmlDoc.body}`,
        `htmlDoc === document: ${htmlDoc === document}（独立 Document，互不影响）`,
        '',
        '在独立文档中创建并插入元素:',
      ];
      try {
        const h1 = htmlDoc.createElement('h1');
        h1.textContent = '独立文档内的标题';
        htmlDoc.body.appendChild(h1);
        lines.push(`  htmlDoc.body.innerHTML: "${htmlDoc.body.innerHTML}"`);
        lines.push(`  主 document.body 是否受影响: ${document.body?.innerHTML === htmlDoc.body.innerHTML ? '是（异常）' : '否（隔离 ✓）'}`);
      } catch (e: any) {
        lines.push(`  操作失败: ${e.message}`);
      }
      if (xmlDoc) {
        lines.push('', `createDocument('urn:demo', 'root', null) → ${xmlDoc.constructor?.name || 'XMLDocument'}`);
        lines.push(`  documentElement.tagName: ${xmlDoc.documentElement?.tagName} | namespaceURI: ${xmlDoc.documentElement?.namespaceURI}`);
        try {
          const child = xmlDoc.createElementNS('urn:demo', 'child');
          child.textContent = 'XML 子节点';
          xmlDoc.documentElement.appendChild(child);
          const ser = typeof XMLSerializer !== 'undefined' ? new XMLSerializer().serializeToString(xmlDoc) : '(无 XMLSerializer)';
          lines.push(`  serializeToString: ${ser}`);
        } catch (e: any) {
          lines.push(`  XML 操作失败: ${e.message}`);
        }
      } else {
        lines.push('', 'createDocument 不可用，已跳过 XML Document 演示');
      }
      lines.push('', '说明: DOMImplementation 可创建与主文档隔离的 Document，常用于服务端片段渲染、模板引擎沙箱、离屏 DOM 操作。');
      this.setState({ fragResult: lines.join('\n') });
      this._addLog('impl', `createHTMLDocument 隔离 ✓${xmlDoc ? '，createDocument XML ✓' : ''}`);
    } catch (err: any) {
      this._addLog('error', `implementation 演示失败：${err.message}`);
    }
  }

  _templateClone() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      this._addLog('warn', 'document 不可用，无法演示 <template>');
      return;
    }
    try {
      const supportsTemplate = 'content' in document.createElement('template'); // <template>.content 是 DocumentFragment
      if (!supportsTemplate) {
        this._addLog('warn', '<template>.content 不可用（环境不支持 template 元素）');
        this.setState({ fragResult: '<template>.content 不可用' });
        return;
      }
      const tpl = document.createElement('template');
      tpl.innerHTML = '<article class="card-item"><h3 class="card-item__title">标题</h3><p class="card-item__desc">描述文本</p></article>';
      const content = tpl.content;
      const clone1 = content.cloneNode(true) as any; // 深克隆
      const clone2 = content.cloneNode(true) as any;
      clone1.querySelector('.card-item__title').textContent = '克隆实例 A';
      clone2.querySelector('.card-item__title').textContent = '克隆实例 B';
      const ser = typeof XMLSerializer !== 'undefined' ? new XMLSerializer() : null;
      const serClone = (frag: any) => (ser ? ser.serializeToString(frag) : '(无 XMLSerializer)');
      const lines = [
        `document.createElement('template').innerHTML = '<article>...</article>'`,
        `template.content.nodeType: ${content.nodeType}（11 = DOCUMENT_FRAGMENT_NODE）`,
        `template.content.children.length: ${content.children.length}`,
        '',
        'cloneNode(true) 深克隆两次，分别改标题后序列化:',
        `  克隆 A: ${serClone(clone1)}`,
        `  克隆 B: ${serClone(clone2)}`,
        '',
        '说明: <template> 内容 inert（不渲染不执行脚本），content 为 DocumentFragment；cloneNode(true) 复制结构后插入 DOM，是声明式模板 + 数据填充的常见模式。',
      ];
      this.setState({ fragResult: lines.join('\n') });
      this._addLog('frag', `template.content.cloneNode(true) 克隆 2 份并改标题，content 子节点数=${content.children.length}`);
    } catch (err: any) {
      this._addLog('error', `template 克隆失败：${err.message}`);
    }
  }

  _renderCard4() {
    return this._card(
      '4. DocumentFragment + createDocument + 模板',
      'document.createDocumentFragment() 创建轻量文档片段；document.implementation.createDocument(ns, qName, doctype) 创建独立 XML Document；createHTMLDocument(title) 创建独立 HTML Document；<template>.content 为 DocumentFragment，template.content.cloneNode(true) 克隆模板后插入 DOM。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'createDocumentFragment'),
        h(Tag, { color: 'success' }, 'implementation'),
        h(Tag, { color: 'success' }, 'createHTMLDocument'),
        h(Tag, { color: 'warning' }, 'template.content'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('createDocumentFragment 批量构建', { type: 'primary', size: 'sm', onClick: () => this._fragBuild() }),
          this._btn('createHTMLDocument', { size: 'sm', onClick: () => this._createHTMLDoc() }),
          this._btn('template 克隆', { size: 'sm', onClick: () => this._templateClone() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Fragment / implementation / template 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px' } }, this.state.fragResult || '（点击上方按钮）'),
      ],
    );
  }

  // =================== Card 5: Range + Selection 编辑（与解析结合）===================
  _rangeSelectContents() {
    if (typeof document === 'undefined' || typeof document.createRange !== 'function') {
      this._addLog('warn', 'document.createRange 不可用');
      this.setState({ rangeResult: 'createRange 不可用' });
      return;
    }
    const container = (this.$('.dx-range-target') as any);
    if (!container) { this._addLog('warn', 'Range 演示容器不存在'); return; }
    try {
      const range = document.createRange();
      range.selectNodeContents(container); // Range 覆盖容器全部内容
      const cloned = typeof range.cloneContents === 'function' ? range.cloneContents() : null; // 返回 Fragment，不改 DOM
      const rect = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
      const firstChild = container.firstChild; // setStart/setEnd 精确定位演示
      let setStartInfo = '';
      if (firstChild && firstChild.nodeType === (typeof Node !== 'undefined' ? Node.TEXT_NODE : 3)) {
        const len = firstChild.textContent.length;
        range.setStart(firstChild, 0);
        range.setEnd(firstChild, Math.min(4, len));
        setStartInfo = `\nsetStart(text,0)/setEnd(text,${Math.min(4, len)}) → collapsed=${range.collapsed}, toString()="${range.toString()}"`;
      }
      const lines = [
        `range.selectNodeContents(container) → 选中容器全部内容`,
        `range.collapsed: ${range.collapsed}`,
        `range.toString(): "${range.toString().slice(0, 40)}"`,
        `cloneContents().childNodes.length: ${cloned ? cloned.childNodes.length : '(不可用)'}`,
        `getBoundingClientRect: ${rect ? `w=${(rect.width as any).toFixed(0)}, h=${(rect.height as any).toFixed(0)}` : '(不可用，jsdom 无布局)'}`,
        setStartInfo,
        '',
        '说明: selectNode/selectNodeContents 设范围；setStart(node,offset)/setEnd(node,offset) 精确定位；cloneContents 复制为片段，extractContents 移除并返回，deleteContents 直接删除。',
      ];
      this.setState({ rangeResult: lines.join('\n') });
      this._addLog('range', `range.selectNodeContents → toString()="${range.toString().slice(0, 24)}..."`);
    } catch (err: any) {
      this._addLog('error', `Range selectNodeContents 失败：${err.message}`);
    }
  }

  _rangeSurroundMark() {
    if (typeof document === 'undefined' || typeof document.createRange !== 'function') {
      this._addLog('warn', 'document.createRange 不可用');
      return;
    }
    const container = (this.$('.dx-range-target') as any);
    if (!container) { this._addLog('warn', 'Range 演示容器不存在'); return; }
    try {
      container.innerHTML = ''; // 重置容器内容为可包裹的纯文本节点
      container.appendChild(document.createTextNode('这段文字中的一部分将被 mark 包裹高亮'));
      const text = container.firstChild;
      if (!text || text.nodeType !== (typeof Node !== 'undefined' ? Node.TEXT_NODE : 3)) {
        this._addLog('warn', 'surroundContents 需要文本节点');
        return;
      }
      const len = text.textContent.length;
      const start = 4;
      const end = Math.min(start + 6, len);
      const range = document.createRange();
      range.setStart(text, start);
      range.setEnd(text, end);
      const markEl = document.createElement('mark'); // surroundContents：用新父节点包裹 Range（要求完整跨越边界，否则抛异常）
      markEl.style.background = '#fff3a0';
      range.surroundContents(markEl);
      const lines = [
        `range.setStart(text, ${start}) / setEnd(text, ${end})`,
        `range.toString(): "${range.toString()}"`,
        `range.surroundContents(<mark>) → 用 <mark> 包裹该文本片段`,
        `container.innerHTML（包裹后）: "${container.innerHTML}"`,
        '',
        '说明: surroundContents 要求 Range 跨越的边界不切割元素（必须完整包含整个元素或纯文本片段），否则抛 InvalidStateError；不满足时可改用 extractContents + insertNode 重组。',
      ];
      this.setState({ rangeResult: lines.join('\n') });
      this._addLog('range', `surroundContents(<mark>) 包裹 "${range.toString()}"，container.innerHTML 更新`);
    } catch (err: any) {
      this._addLog('error', `surroundContents 失败：${err.message}`);
    }
  }

  _rangeExtract() {
    if (typeof document === 'undefined' || typeof document.createRange !== 'function') {
      this._addLog('warn', 'document.createRange 不可用');
      return;
    }
    const container = (this.$('.dx-range-target') as any);
    if (!container) { this._addLog('warn', 'Range 演示容器不存在'); return; }
    try {
      container.innerHTML = ''; // 重置：构造 "前段 [中间 span] 后段" 结构
      container.appendChild(document.createTextNode('前段文字 '));
      const mid = container.appendChild(document.createElement('span'));
      mid.textContent = '中间要被提取的内容';
      mid.style.color = '#1677ff';
      container.appendChild(document.createTextNode(' 后段文字'));
      const range = document.createRange();
      range.selectNode(mid);
      const extracted = range.extractContents(); // 从 DOM 中移除并返回 DocumentFragment
      const remain = container.textContent;
      const inserted = document.createElement('em'); // insertNode：把新节点插入到 range 起点处
      inserted.textContent = '[已提取]';
      try { range.insertNode(inserted); }
      catch (e: any) { this._addLog('warn', `insertNode 失败：${e.message}`); }
      const lines = [
        `构造容器: "前段文字 " + <span>中间要被提取的内容</span> + " 后段文字"`,
        `range.selectNode(span)`,
        `extractContents() → DocumentFragment，childNodes.length=${extracted.childNodes.length}`,
        `提取后容器剩余 textContent: "${remain}"`,
        `range.insertNode(<em>[已提取]</em>) → 在 range 起点插入`,
        `最终 container.innerHTML: "${container.innerHTML}"`,
        '',
        '说明: extractContents 移除并返回片段（可再插入别处）；deleteContents 仅删除不返回；insertNode 在 range 起点插入；surroundContents 用新父节点包裹 range。',
      ];
      this.setState({ rangeResult: lines.join('\n') });
      this._addLog('range', `extractContents 取出 ${extracted.childNodes.length} 节点，剩余="${remain}"`);
    } catch (err: any) {
      this._addLog('error', `extractContents 失败：${err.message}`);
    }
  }

  _getSelectionText() {
    if (typeof window === 'undefined' || typeof window.getSelection !== 'function') {
      this._addLog('warn', 'window.getSelection 不可用（jsdom 部分支持 Selection）');
      this.setState({ rangeResult: 'window.getSelection 不可用' });
      return;
    }
    const container = (this.$('.dx-range-target') as any);
    if (!container) { this._addLog('warn', 'Range 演示容器不存在'); return; }
    try {
      const sel = window.getSelection();
      const before = sel!.rangeCount;
      if (typeof sel!.removeAllRanges === 'function') sel!.removeAllRanges();
      let selText = '';
      if (typeof document.createRange === 'function' && typeof sel!.addRange === 'function') {
        const range = document.createRange();
        range.selectNodeContents(container);
        sel!.addRange(range);
        selText = typeof sel!.toString === 'function' ? sel!.toString() : '';
      }
      const lines = [
        `window.getSelection() → ${sel!.constructor?.name || 'Selection'}`,
        `操作前 rangeCount: ${before}`,
        `removeAllRanges() 清空 → addRange(range.selectNodeContents(container))`,
        `添加后 rangeCount: ${sel!.rangeCount}`,
        `selection.toString(): "${(selText || '').slice(0, 40)}"`,
      ];
      if (sel!.rangeCount > 0 && typeof sel!.getRangeAt === 'function') {
        try {
          const r = sel!.getRangeAt(0);
          lines.push(`getRangeAt(0).toString(): "${(r.toString() || '').slice(0, 40)}"`);
          lines.push(`getRangeAt(0).collapsed: ${r.collapsed}`);
        } catch (e: any) {
          lines.push(`getRangeAt 失败: ${e.message}`);
        }
      }
      lines.push('', '说明: Selection 表示用户选区，通过 removeAllRanges/addRange/getRangeAt 与 Range 交互；toString() 返回选区纯文本。jsdom 对 Selection 仅部分支持，真实浏览器行为更完整。');
      this.setState({ rangeResult: lines.join('\n') });
      this._addLog('sel', `Selection rangeCount ${before}→${sel!.rangeCount}，toString()="${(selText || '').slice(0, 24)}"`);
      try { if (typeof sel!.removeAllRanges === 'function') sel!.removeAllRanges(); } catch { /* noop */ }
    } catch (err: any) {
      this._addLog('error', `getSelection 演示失败：${err.message}`);
    }
  }

  _renderCard5() {
    return this._card(
      '5. Range + Selection 编辑（与解析结合）',
      'document.createRange() 创建 Range；setStart(node,offset)/setEnd(node,offset)/selectNode(node)/selectNodeContents(node)；deleteContents/extractContents（返回 DocumentFragment）/insertNode/surroundContents/cloneContents/getBoundingClientRect。window.getSelection()/removeAllRanges()/addRange(range)/getRangeAt(i)/toString() 管理用户选区。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'Range'),
        h(Tag, { color: 'success' }, 'selectNodeContents'),
        h(Tag, { color: 'success' }, 'extractContents'),
        h(Tag, { color: 'warning' }, 'surroundContents'),
        h(Tag, { color: 'warning' }, 'Selection'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('selectNodeContents', { type: 'primary', size: 'sm', onClick: () => this._rangeSelectContents() }),
          this._btn('surroundContents 包裹 mark', { size: 'sm', onClick: () => this._rangeSurroundMark() }),
          this._btn('extractContents 提取', { size: 'sm', onClick: () => this._rangeExtract() }),
          this._btn('getSelection 读取选中文本', { size: 'sm', onClick: () => this._getSelectionText() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Range / Selection 操作目标容器：'),
        h('div', { class: 'dx-range-target', style: { padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', minHeight: '32px' } },
          'Range 演示目标（点击按钮在此容器上执行 selectNodeContents / surroundContents / extractContents / Selection）'),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Range / Selection 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px' } }, this.state.rangeResult || '（点击上方按钮）'),
      ],
    );
  }

  // =================== 日志面板 ===================
  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 主渲染 ===================
  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'DOM 解析与 XPath 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' }, '演示 DOMParser / XMLSerializer / XPath evaluate / DocumentFragment + implementation / Range + Selection 编辑。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
