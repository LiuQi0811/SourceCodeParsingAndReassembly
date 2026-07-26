// =====================================================================
// DOMPartsAPIPage.js —— DOM Parts API 标准化模板部件深度实验室
// 演示 W3C DOM Parts API（原 Template Instantiation 提案演进而来的部件模型）：
//   1. 概念与三方案对比（模板部件 vs 节点克隆 vs Declarative Shadow DOM）
//      + PartRoot/Part/PartGroup 模型 + 浏览器支持（Chrome 部分实现）
//   2. DocumentPartRoot 与 Element.prototype.getPartRoot()
//      + 节点-部件树关系 + 部件类型枚举
//      （ChildNodePart/AttrPart/PropertyPart/BooleanPart/EventPart）
//   3. Element.createChildNodePart(node, metadata) + PartGroup
//      + part.replace(node) / part.replace(text) / part.disconnect()
//   4. HTMLTemplateElement.prototype.createInstance() + TemplateInstance
//      + update(state) 批量更新 + processCallback(state) 协同
//   5. PartType 元数据：Attribute/Property/Boolean/Event/TextNode
//      + 自定义处理器
//   6. 实战：声明式响应式列表渲染（{{items}} 占位 + part.replace(nodes)）
//      + 与自定义元素生命周期协同
//   7. 实战：表单双向绑定（::value PropertyPart + EventPart）
//      + processCallback 自定义表达式求值 + 模板片段复用
//      + 与 Declarative Shadow DOM 协同
//   8. 性能对比与生态（Lit render()/html`` vs DOM Parts）
//      + 浏览器支持矩阵 + Polyfill（@github/template-parts）
//      + 与 Web Components 生态整合路径
// 兼容性：jsdom 中 DOM Parts API 全部缺失（Part/ChildNodePart/PartGroup/
//   DocumentPartRoot/getPartRoot/createInstance 均为 undefined），所有按钮点击
//   仅记日志说明，不会抛异常；真实浏览器需 Chrome 部分实现（约 M120+，部分
//   API 仍 in progress）或 @github/template-parts polyfill 才能完整体验。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class DOMPartsAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],                // 共享事件日志（所有卡片写入同一面板）
      capsSummary: '',         // 能力检测摘要（componentDidMount 中填充，非空才显示 Alert）
      conceptInfo: '',         // Card 1：概念与三方案对比
      rootInfo: '',            // Card 2：DocumentPartRoot 与 getPartRoot
      childNodeInfo: '',       // Card 3：createChildNodePart 与 PartGroup
      instanceInfo: '',        // Card 4：createInstance 与 TemplateInstance
      metaInfo: '',            // Card 5：PartType 元数据
      listInfo: '',            // Card 6：实战：声明式响应式列表渲染
      formInfo: '',            // Card 7：实战：表单双向绑定
      perfInfo: '',            // Card 8：性能对比与生态
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // —— 幂等初始化实例引用（render 在 componentDidMount 之前执行，需安全读取）——
    if (this._dynamicStyles === undefined) this._dynamicStyles = [];
    if (this._instances === undefined) this._instances = [];
    if (this._listContainer === undefined) this._listContainer = null;
    if (this._formContainer === undefined) this._formContainer = null;
    if (this._listTpl === undefined) this._listTpl = null;
    if (this._formTpl === undefined) this._formTpl = null;

    // ★★★ 关键守卫：必须存在！否则 setState → rerender → componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（仅 typeof 判定，绝不抛异常）——
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `Part ${c(f.part)}`,
      `ChildNodePart ${c(f.childNodePart)}`,
      `PartGroup ${c(f.partGroup)}`,
      `DocumentPartRoot ${c(f.documentPartRoot)}`,
      `getPartRoot ${c(f.getPartRoot)}`,
      `createInstance ${c(f.createInstance)}`,
    ];

    const any = f.part || f.childNodePart || f.partGroup || f.documentPartRoot || f.getPartRoot || f.createInstance;
    const summary = any
      ? `DOM Parts API 能力检测：${parts.join(' · ')}。当前环境部分支持，可真实创建部件并 update。`
      : `DOM Parts API 能力检测：${parts.join(' · ')}。jsdom/Node 环境无 Part/ChildNodePart/PartGroup/DocumentPartRoot/getPartRoot/createInstance，所有按钮点击仅记日志说明，不会抛异常；真实浏览器需 Chrome 部分实现（约 M120+，部分 API 仍 in progress）或 @github/template-parts polyfill。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);

    if (!f.part) this._addLog('warn', 'Part 基类不可用（jsdom 无 DOM Parts API，Chrome 部分实现中）');
    if (!f.childNodePart) this._addLog('warn', 'ChildNodePart 不可用，子节点部件演示将仅显示说明文本');
    if (!f.partGroup) this._addLog('warn', 'PartGroup 不可用，部件分组演示将仅显示说明文本');
    if (!f.documentPartRoot) this._addLog('warn', 'DocumentPartRoot 不可用，部件根演示将仅显示说明文本');
    if (!f.getPartRoot) this._addLog('warn', 'Element.prototype.getPartRoot 不可用，无法获取元素部件根');
    if (!f.createInstance) this._addLog('warn', 'HTMLTemplateElement.prototype.createInstance 不可用，模板实例化演示将仅显示说明文本');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 移除动态注入的样式
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];

    // 销毁已创建的 TemplateInstance（如果存在 close/destroy 方法）
    for (const inst of this._instances) {
      try {
        if (inst && typeof inst.close === 'function') inst.close();
        else if (inst && typeof inst.destroy === 'function') inst.destroy();
      } catch { /* noop */ }
    }
    this._instances = [];

    this._listContainer = null;
    this._formContainer = null;
    this._listTpl = null;
    this._formTpl = null;
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

  _flags() {
    const safe = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      part: safe(() => typeof Part !== 'undefined'),
      childNodePart: safe(() => typeof ChildNodePart !== 'undefined'),
      attrPart: safe(() => typeof AttrPart !== 'undefined'),
      propertyPart: safe(() => typeof PropertyPart !== 'undefined'),
      booleanPart: safe(() => typeof BooleanPart !== 'undefined'),
      eventPart: safe(() => typeof EventPart !== 'undefined'),
      partGroup: safe(() => typeof PartGroup !== 'undefined'),
      documentPartRoot: safe(() => typeof DocumentPartRoot !== 'undefined'),
      getPartRoot: safe(() => typeof Element !== 'undefined' && typeof Element.prototype.getPartRoot === 'function'),
      createInstance: safe(() => typeof HTMLTemplateElement !== 'undefined' && typeof HTMLTemplateElement.prototype.createInstance === 'function'),
      createChildNodePart: safe(() => typeof Element !== 'undefined' && typeof Element.prototype.createChildNodePart === 'function'),
      templateInstance: safe(() => typeof TemplateInstance !== 'undefined'),
      templateEl: safe(() => typeof HTMLTemplateElement !== 'undefined'),
    };
  }

  _injectBaseStyles() {
    this._injectStyle('domparts-base', `
      .domparts-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .domparts-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
      .domparts-matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 10px; }
      .domparts-matrix-cell { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 12px; }
      .domparts-list { margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; }
      .domparts-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
      .domparts-item:last-child { border-bottom: none; }
      .domparts-item-name { font-weight: 600; color: #1e293b; min-width: 90px; }
      .domparts-item-count { color: #3b82f6; font-family: monospace; }
      .domparts-form { margin-top: 10px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
      .domparts-form-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .domparts-form-row label { min-width: 80px; font-size: 13px; color: #475569; }
      .domparts-form-row input { flex: 1; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; }
      .domparts-form-preview { margin-top: 8px; padding: 8px; background: #f1f5f9; border-left: 3px solid #1677ff; border-radius: 4px; font-size: 13px; }
      .domparts-status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
      .domparts-status--ok { background: #dcfce7; color: #166534; }
      .domparts-status--no { background: #fee2e2; color: #991b1b; }
      .domparts-output { background: #0f172a; color: #e2e8f0; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; margin-top: 8px; }
    `);
  }

  // ===================== Card 1：概念与三方案对比 =====================

  _runConceptDemo() {
    const f = this._flags();
    this._injectStyle('domparts-concept-demo', `
      .domparts-concept-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.part) {
      this._addLog('info', '检测到 Part 基类，可演示真实部件模型');
    } else {
      this._addLog('warn', 'Part 不可用（jsdom 无 DOM Parts API），仅展示概念说明文本');
    }
    const info = [
      '===== DOM Parts API 概念与三方案对比 =====',
      '',
      '【三方案：模板部件 / 节点克隆 / Declarative Shadow DOM】',
      '  方案 A：DOM Parts API（本页主题）',
      '    - 模板内用 {{ }} / 指令声明占位，createInstance 生成 TemplateInstance',
      '    - update(state) 批量更新对应 Part，无虚拟 DOM diff',
      '    - 直接 DOM 部件替换：part.replace(node) / part.replace(text)',
      '    - 优势：原生 API、零依赖、更新粒度精确到部件',
      '    - 劣势：尚未全面实现，需 polyfill；声明式更新表达式较弱',
      '',
      '  方案 B：节点克隆 template.content.cloneNode(true)',
      '    - document.querySelector("#tpl").content.cloneNode(true)',
      '    - 克隆后手动 querySelector 查找占位元素并赋值',
      '    - 优势：兼容性最好（IE11+）、简单直接',
      '    - 劣势：无更新机制，每次都重新克隆 + 全量替换；占位需约定',
      '',
      '  方案 C：Declarative Shadow DOM（<template shadowrootmode="open">）',
      '    - HTML 中直接声明 <template shadowrootmode="open">...</template>',
      '    - 浏览器解析时自动 attachShadow，无需 JS',
      '    - 优势：SSR 友好、Shadow DOM 封装样式',
      '    - 劣势：本身不含更新机制，需配合 DOM Parts API 或框架',
      '    - 与 DOM Parts API 协同：shadow root 内的部件仍可被 getPartRoot 管理',
      '',
      '【PartRoot / Part / PartGroup 模型】',
      '  DocumentPartRoot / ElementPartRoot (PartRoot)',
      '    └─ PartGroup (部件分组，可批量操作)',
      '         └─ Part (基类，所有部件的抽象)',
      '              ├─ ChildNodePart   替换子节点（文本或元素）',
      '              ├─ AttrPart        设置特性值 <div class="{{x}}">',
      '              ├─ PropertyPart    设置属性 element.value = v（语法 ::value）',
      '              ├─ BooleanPart     切换布尔特性/属性 <input {{disabled}}>',
      '              └─ EventPart       绑定事件 @click="handler"',
      '',
      '【Part 核心方法】',
      '  part.replace(node)     // 替换为节点（ChildNodePart）',
      '  part.replace(text)     // 替换为文本（ChildNodePart）',
      '  part.value = v         // AttrPart/PropertyPart 设值',
      '  part.disconnect()      // 断开部件与 DOM 的关联，停止更新',
      '  part.metadata          // 部件元数据（PartType 等）',
      '',
      '【能力检测代码】',
      "  const partOK = typeof Part !== 'undefined';",
      "  const childNodePartOK = typeof ChildNodePart !== 'undefined';",
      "  const partGroupOK = typeof PartGroup !== 'undefined';",
      "  const documentPartRootOK = typeof DocumentPartRoot !== 'undefined';",
      "  const getPartRootOK = typeof Element !== 'undefined'",
      "    && typeof Element.prototype.getPartRoot === 'function';",
      "  const createInstanceOK = typeof HTMLTemplateElement !== 'undefined'",
      "    && typeof HTMLTemplateElement.prototype.createInstance === 'function';",
      '',
      '【浏览器支持矩阵（截至 2025）】',
      '  浏览器            Part API    createInstance    备注',
      '  Chrome ≥120       部分实现    部分实现          原生 in progress',
      '  Edge ≥120         部分实现    部分实现          同 Chromium',
      '  Safari            ✗           ✗                 未实现',
      '  Firefox           ✗           ✗                 未实现',
      '  @github/template-parts polyfill  ✓  ✓           生产可用',
      '',
      '【与 Lit / 框架的关系】',
      '  - Lit html`` 基于早期的 Template Instantiation 提案实现',
      '  - DOM Parts API 是该提案的标准化演进，原生支持后 Lit 可直接复用',
      '  - 框架（Vue/Solid）未来可基于原生 Part 实现更轻量的响应式',
      '',
      '【实际能力检测演示】',
      `  Part: ${f.part ? '✓' : '✗'}`,
      `  ChildNodePart: ${f.childNodePart ? '✓' : '✗'}`,
      `  PartGroup: ${f.partGroup ? '✓' : '✗'}`,
      `  DocumentPartRoot: ${f.documentPartRoot ? '✓' : '✗'}`,
      `  Element.prototype.getPartRoot: ${f.getPartRoot ? '✓' : '✗'}`,
      `  HTMLTemplateElement.prototype.createInstance: ${f.createInstance ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. DOM Parts API 仍在演进，不同 Chrome 版本 API 形态可能不同',
      '  2. jsdom/Node 完全无此 API，所有 typeof 检测为 undefined',
      '  3. 生产环境应优先使用 @github/template-parts polyfill 保证一致性',
      '  4. createInstance 返回的 TemplateInstance 需手动 append 到 DOM',
      '  5. update(state) 是批量更新，单次调用会刷新所有匹配的 Part',
    ].join('\n');
    this.setState({ conceptInfo: info });
    this._addLog('parts', `概念演示完成；Part=${f.part}，ChildNodePart=${f.childNodePart}，createInstance=${f.createInstance}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概念与三方案对比 —— 模板部件 vs 节点克隆 vs DSD + PartRoot/Part/PartGroup 模型',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Part', f.part],
          ['createInstance', f.createInstance],
        ]),
        h(Tag, { color: 'primary' }, '概念'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'DOM Parts API 是 W3C Template Instantiation 提案演进而来的标准化模板部件模型。三方案对比：模板部件（createInstance + update 无 diff 直接替换 Part）、节点克隆（cloneNode 全量复制无更新机制）、Declarative Shadow DOM（<template shadowrootmode="open"> 声明式 Shadow DOM，SSR 友好但需配合 Parts 才有更新能力）。模型层次：DocumentPartRoot/ElementPartRoot → PartGroup → Part（ChildNodePart/AttrPart/PropertyPart/BooleanPart/EventPart）。Part 核心方法：replace(node/text)、value=、disconnect()、metadata。Chrome 约 M120+ 部分实现，生产推荐 @github/template-parts polyfill。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概念与三方案对比演示', { type: 'primary', size: 'sm', onClick: () => this._runConceptDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 三方案对比：同一列表渲染

// 方案 A：DOM Parts API
const tpl = document.querySelector('#list-tpl');
const inst = tpl.createInstance();
container.append(inst);
inst.update({ items: [{ name: 'Alice', count: 42 }] });

// 方案 B：节点克隆（无更新机制）
const frag = document.querySelector('#list-tpl').content.cloneNode(true);
frag.querySelector('.name').textContent = 'Alice';
frag.querySelector('.count').textContent = '42';
container.innerHTML = '';
container.append(frag); // 改数据需重新克隆 + 全量替换

// 方案 C：Declarative Shadow DOM（声明式，SSR 友好）
// <host-element>
//   <template shadowrootmode="open">
//     <p part="title">Hello</p>
//   </template>
// </host-element>
// 浏览器解析时自动 attachShadow，配合 getPartRoot 管理 shadow 内部件

// 能力检测
const partOK = typeof Part !== 'undefined';
const createInstanceOK =
  typeof HTMLTemplateElement !== 'undefined' &&
  typeof HTMLTemplateElement.prototype.createInstance === 'function';`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.conceptInfo || '（点击按钮查看 DOM Parts API 概念与三方案对比完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：DocumentPartRoot 与 getPartRoot =====================

  _runRootDemo() {
    const f = this._flags();
    this._injectStyle('domparts-root-demo', `
      .domparts-root-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const container = this.$('.domparts-root-host');
    if (container) this._rootContainer = container;
    if (f.getPartRoot && f.documentPartRoot) {
      try {
        const host = document.createElement('div');
        host.innerHTML = '<span>占位</span>';
        if (container) { container.innerHTML = ''; container.appendChild(host); }
        const root = host.getPartRoot();
        this._addLog('info', `element.getPartRoot() → ${root ? root.constructor.name : 'null'}`);
        this.setState({ rootInfo: '已调用 getPartRoot()，详见日志（当前环境支持真实部件根）' });
      } catch (err) {
        this._addLog('warn', `getPartRoot 调用失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'getPartRoot / DocumentPartRoot 不可用（jsdom 无 DOM Parts API），仅展示说明文本');
    }
    const info = [
      '===== DocumentPartRoot 与 Element.prototype.getPartRoot() =====',
      '',
      '【DocumentPartRoot：文档级部件根】',
      '  // 文档级部件根，管理游离于特定元素之外的部件',
      '  const docRoot = new DocumentPartRoot();',
      '  docRoot.createChildNodePart(node, metadata);',
      '',
      '【Element.prototype.getPartRoot()：元素部件根】',
      '  // 每个元素可获取（或创建）其 PartRoot',
      '  const el = document.querySelector(".my-host");',
      '  const partRoot = el.getPartRoot();',
      '  // 返回 ElementPartRoot，管理该元素子树的部件',
      '',
      '【PartRoot 接口】',
      '  partRoot.createChildNodePart(node, metadata)  // 创建 ChildNodePart',
      '  partRoot.parts                                  // 部件集合（PartGroup）',
      '  partRoot.replaceChildren(...)                   // 批量替换子节点',
      '',
      '【节点-部件树关系】',
      '  document',
      '    └─ Element (host)',
      '         └─ ElementPartRoot = host.getPartRoot()',
      '              └─ PartGroup',
      '                   ├─ ChildNodePart → 指向某子节点',
      '                   ├─ AttrPart      → 指向某特性',
      '                   ├─ PropertyPart  → 指向某属性',
      '                   ├─ BooleanPart   → 指向某布尔特性',
      '                   └─ EventPart     → 指向某事件监听',
      '',
      '  // 部件树与 DOM 树平行：DOM 节点变化时部件可自动跟随',
      '  // 部件 disconnect() 后不再跟随 DOM，但仍可重新连接',
      '',
      '【部件类型枚举（PartType）】',
      '  enum PartType {',
      '    Attribute,   // AttrPart：设置特性值',
      '    Property,    // PropertyPart：设置 JS 属性',
      '    Boolean,     // BooleanPart：切换布尔特性',
      '    Event,       // EventPart：绑定事件处理器',
      '    TextNode,    // ChildNodePart：替换子节点',
      '  }',
      '',
      '【ChildNodePart：替换子节点】',
      '  // 模板：<div>{{message}}</div>',
      '  // createInstance 后，{{message}} 占位对应一个 ChildNodePart',
      '  const part = partRoot.createChildNodePart(node, { type: "TextNode" });',
      '  part.replace("Hello");         // 替换为文本节点',
      '  part.replace(anotherNode);     // 替换为元素节点',
      '',
      '【AttrPart：设置特性值】',
      '  // 模板：<a href="{{url}}">link</a>',
      '  // href="{{url}}" 对应一个 AttrPart',
      '  const part = partRoot.createAttrPart?.(el, "href", "url");',
      '  part.value = "https://example.com";',
      '',
      '【PropertyPart：设置 JS 属性（::value 语法）】',
      '  // 模板：<input ::value="name"> → element.value = state.name',
      '  // 双冒号 :: 表示 PropertyPart（区别于 AttrPart 的单冒号）',
      '  const part = partRoot.createPropertyPart?.(el, "value", "name");',
      '  part.value = "Alice";',
      '',
      '【BooleanPart：切换布尔特性】',
      '  // 模板：<input {{disabled}}="isDisabled">',
      '  // isDisabled 为真时设置 disabled 特性，否则移除',
      '  const part = partRoot.createBooleanPart?.(el, "disabled", "isDisabled");',
      '  part.value = true;   // <input disabled>',
      '  part.value = false;  // 移除 disabled',
      '',
      '【EventPart：绑定事件】',
      '  // 模板：<button @click="onClick">Click</button>',
      '  // @event 语法对应 EventPart',
      '  const part = partRoot.createEventPart?.(el, "click", "onClick");',
      '  part.value = (e) => console.log("clicked", e);',
      '',
      '【实际能力检测演示】',
      `  Part: ${f.part ? '✓' : '✗'}`,
      `  ChildNodePart: ${f.childNodePart ? '✓' : '✗'}`,
      `  AttrPart: ${f.attrPart ? '✓' : '✗'}`,
      `  PropertyPart: ${f.propertyPart ? '✓' : '✗'}`,
      `  BooleanPart: ${f.booleanPart ? '✓' : '✗'}`,
      `  EventPart: ${f.eventPart ? '✓' : '✗'}`,
      `  DocumentPartRoot: ${f.documentPartRoot ? '✓' : '✗'}`,
      `  Element.prototype.getPartRoot: ${f.getPartRoot ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. PropertyPart 用 :: 双冒号语法，区别于 AttrPart 的单冒号',
      '  2. BooleanPart 的 value 是布尔值，非字符串',
      '  3. EventPart 的 value 是函数，赋非函数会抛错或忽略',
      '  4. getPartRoot() 首次调用会创建 PartRoot，再次调用返回同一实例',
      '  5. jsdom 中所有部件类型均为 undefined，无法真实演示',
    ].join('\n');
    this.setState({ rootInfo: info });
    this._addLog('parts', `DocumentPartRoot 与 getPartRoot 演示完成；getPartRoot=${f.getPartRoot}，documentPartRoot=${f.documentPartRoot}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. DocumentPartRoot 与 getPartRoot —— 节点-部件树关系与部件类型枚举',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['DocumentPartRoot', f.documentPartRoot],
          ['getPartRoot', f.getPartRoot],
        ]),
        h(Tag, { color: 'primary' }, '部件根'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'DocumentPartRoot 是文档级部件根，Element.prototype.getPartRoot() 返回元素的 ElementPartRoot（管理该元素子树的部件）。PartRoot 提供 createChildNodePart(node, metadata) 等工厂方法。部件树与 DOM 树平行：ChildNodePart 指向子节点、AttrPart 指向特性、PropertyPart（::value 语法）指向 JS 属性、BooleanPart 切换布尔特性、EventPart（@event 语法）绑定事件。PartType 枚举：Attribute/Property/Boolean/Event/TextNode。disconnect() 后部件不再跟随 DOM。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行部件根与类型枚举演示', { type: 'primary', size: 'sm', onClick: () => this._runRootDemo() }),
        ),
        h('div', { class: 'domparts-root-host domparts-host' },
          h('span', { class: 'fs-sm text-secondary' }, '部件根挂载容器（getPartRoot 调用宿主）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// Element.prototype.getPartRoot() 获取元素部件根
const host = document.querySelector('.my-host');
const partRoot = host.getPartRoot();

// DocumentPartRoot：文档级部件根
const docRoot = new DocumentPartRoot();
const part = docRoot.createChildNodePart(node, { type: 'TextNode' });

// 部件类型枚举
// enum PartType { Attribute, Property, Boolean, Event, TextNode }

// ChildNodePart：替换子节点
part.replace('Hello');          // 文本
part.replace(anotherNode);      // 元素

// PropertyPart（::value 语法）：设置 JS 属性
// <input ::value="name"> → element.value = state.name
propPart.value = 'Alice';

// BooleanPart：切换布尔特性
// <input {{disabled}}="isDisabled">
boolPart.value = true;   // <input disabled>

// EventPart（@event 语法）：绑定事件
// <button @click="onClick">Click</button>
eventPart.value = (e) => console.log('clicked', e);

// disconnect：断开部件与 DOM 关联
part.disconnect();`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.rootInfo || '（点击按钮查看 DocumentPartRoot 与 getPartRoot 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：createChildNodePart 与 PartGroup =====================

  _runChildNodeDemo() {
    const f = this._flags();
    this._injectStyle('domparts-child-demo', `
      .domparts-child-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const container = this.$('.domparts-child-host');
    if (container) this._childContainer = container;
    if (f.createChildNodePart && f.childNodePart) {
      try {
        const host = document.createElement('div');
        const placeholder = document.createElement('span');
        placeholder.textContent = '占位';
        host.appendChild(placeholder);
        if (container) { container.innerHTML = ''; container.appendChild(host); }
        const root = typeof host.getPartRoot === 'function' ? host.getPartRoot() : null;
        if (root && typeof root.createChildNodePart === 'function') {
          const part = root.createChildNodePart(placeholder, { type: 'TextNode' });
          this._addLog('info', `createChildNodePart → ${part ? part.constructor.name : 'null'}`);
          if (part && typeof part.replace === 'function') {
            part.replace('已被部件替换的文本');
            this._addLog('info', 'part.replace("...") 已替换占位文本');
          }
          if (part && typeof part.disconnect === 'function') {
            part.disconnect();
            this._addLog('info', 'part.disconnect() 已断开部件');
          }
        }
      } catch (err) {
        this._addLog('warn', `createChildNodePart 调用失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'createChildNodePart / ChildNodePart 不可用（jsdom 无 DOM Parts API），仅展示说明文本');
    }
    const info = [
      '===== createChildNodePart 与 PartGroup =====',
      '',
      '【Element.createChildNodePart(node, metadata)】',
      '  // 在元素上创建一个 ChildNodePart，指向指定子节点',
      '  const host = document.querySelector(".host");',
      '  const placeholder = host.firstChild;  // 模板中的占位文本节点',
      '  const part = host.createChildNodePart(placeholder, {',
      '    type: "TextNode",   // PartType 元数据',
      '    // 可携带自定义 metadata 供 processCallback 使用',
      '  });',
      '',
      '  // metadata 参数：部件类型与自定义数据',
      '  //   type:     PartType 枚举值',
      '  //   name:     绑定的状态键名（如 "message"）',
      '  //   evaluator: 自定义求值函数（可选）',
      '',
      '【part.replace(node)：替换为元素节点】',
      '  const newEl = document.createElement("strong");',
      '  newEl.textContent = "Bold";',
      '  part.replace(newEl);   // 占位节点被 newEl 替换',
      '',
      '【part.replace(text)：替换为文本】',
      '  part.replace("Hello, " + name);   // 占位节点被文本节点替换',
      '  // ChildNodePart 内部维护当前节点引用，replace 后自动更新引用',
      '',
      '【part.disconnect()：断开部件】',
      '  part.disconnect();',
      '  // 断开后 part 不再与 DOM 节点关联，update 不会影响 DOM',
      '  // 可重新 createChildNodePart 重建关联',
      '',
      '【PartGroup：部件分组批量操作】',
      '  // PartRoot.parts 返回 PartGroup，可批量遍历/操作',
      '  const group = host.getPartRoot().parts;',
      '  group.forEach((part) => {',
      '    if (part.metadata.name === "items") {',
      '      part.replace(renderItems(state.items));',
      '    }',
      '  });',
      '',
      '  // PartGroup 支持',
      '  group.length;          // 部件数量',
      '  group[0];              // 按索引访问',
      '  group.forEach(cb);     // 遍历',
      '  group.replaceChildren(...nodes); // 批量替换',
      '',
      '【手动创建多个 ChildNodePart 形成列表】',
      '  function renderList(host, items) {',
      '    const root = host.getPartRoot();',
      '    host.innerHTML = "";',
      '    const group = [];',
      '    items.forEach((item) => {',
      '      const li = document.createElement("li");',
      '      host.appendChild(li);',
      '      const part = root.createChildNodePart(li, { type: "TextNode" });',
      '      part.replace(item.name);',
      '      group.push(part);',
      '    });',
      '    return group;  // 返回 PartGroup（手动构建）',
      '  }',
      '',
      '【与 template.content 的差异】',
      '  // template.content.cloneNode 是一次性克隆，无更新机制',
      '  // createChildNodePart 建立长期部件引用，可反复 replace 更新',
      '  // 性能：部件更新只触及占位节点，无需全量重建子树',
      '',
      '【实际能力检测演示】',
      `  ChildNodePart: ${f.childNodePart ? '✓' : '✗'}`,
      `  createChildNodePart: ${f.createChildNodePart ? '✓' : '✗'}`,
      `  PartGroup: ${f.partGroup ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. createChildNodePart 的 node 必须是当前元素的直接子节点',
      '  2. replace(node) 后旧节点会从 DOM 移除，部件引用更新到新节点',
      '  3. disconnect() 不会移除 DOM 节点，只断开部件关联',
      '  4. PartGroup 的索引在 replace 后可能变化，遍历时需快照',
      '  5. 大量 ChildNodePart 会增加内存，列表场景建议复用部件',
    ].join('\n');
    this.setState({ childNodeInfo: info });
    this._addLog('parts', `createChildNodePart 演示完成；createChildNodePart=${f.createChildNodePart}，PartGroup=${f.partGroup}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. createChildNodePart —— Element.createChildNodePart + PartGroup + replace/disconnect',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['createChildNodePart', f.createChildNodePart],
          ['PartGroup', f.partGroup],
        ]),
        h(Tag, { color: 'primary' }, '子节点部件'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Element.createChildNodePart(node, metadata) 创建 ChildNodePart，metadata 含 type（PartType）与 name（绑定状态键）。part.replace(node) 替换为元素节点，part.replace(text) 替换为文本节点，部件引用自动更新。part.disconnect() 断开部件与 DOM 关联（不移除节点）。PartRoot.parts 返回 PartGroup，支持 forEach/index/replaceChildren 批量操作。与 cloneNode 不同，ChildNodePart 建立长期部件引用，可反复 replace 更新，仅触及占位节点无需全量重建。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 createChildNodePart 演示', { type: 'primary', size: 'sm', onClick: () => this._runChildNodeDemo() }),
        ),
        h('div', { class: 'domparts-child-host domparts-host' },
          h('span', { class: 'fs-sm text-secondary' }, 'ChildNodePart 挂载容器（replace/disconnect 演示宿主）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 创建 ChildNodePart
const host = document.querySelector('.host');
const placeholder = host.firstChild;  // 模板占位文本节点
const part = host.createChildNodePart(placeholder, {
  type: 'TextNode',
  name: 'message',         // 绑定的状态键
});

// replace(node)：替换为元素节点
const strong = document.createElement('strong');
strong.textContent = 'Bold';
part.replace(strong);

// replace(text)：替换为文本
part.replace('Hello, ' + state.name);

// disconnect()：断开部件（不移除 DOM 节点）
part.disconnect();

// PartGroup：批量操作
const group = host.getPartRoot().parts;
group.forEach((p) => {
  if (p.metadata.name === 'items') {
    p.replace(renderItems(state.items));
  }
});
group.length;                  // 部件数量
group.replaceChildren(...nodes); // 批量替换

// 列表渲染：为每项创建 ChildNodePart
function renderList(host, items) {
  const root = host.getPartRoot();
  host.innerHTML = '';
  const group = [];
  items.forEach((item) => {
    const li = document.createElement('li');
    host.appendChild(li);
    const p = root.createChildNodePart(li, { type: 'TextNode' });
    p.replace(item.name);
    group.push(p);
  });
  return group;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.childNodeInfo || '（点击按钮查看 createChildNodePart 与 PartGroup 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：createInstance 与 TemplateInstance =====================

  _runInstanceDemo() {
    const f = this._flags();
    this._injectStyle('domparts-instance-demo', `
      .domparts-instance-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const container = this.$('.domparts-instance-host');
    if (container) this._instanceContainer = container;
    // 尝试真实实例化（jsdom 不可用，仅记日志）
    if (f.createInstance && f.templateEl) {
      try {
        const tpl = document.createElement('template');
        tpl.innerHTML = '<p>Hello {{name}}, count = {{count}}</p>';
        const instance = tpl.createInstance();
        if (container) { container.innerHTML = ''; container.append(instance); }
        this._instances.push(instance);
        this._addLog('info', `template.createInstance() → ${instance ? instance.constructor.name : 'null'}`);
        if (instance && typeof instance.update === 'function') {
          instance.update({ name: 'Alice', count: 42 });
          this._addLog('info', 'instance.update({ name: "Alice", count: 42 }) 已批量更新部件');
        }
        if (typeof tpl.processCallback === 'function') {
          this._addLog('info', 'template.processCallback 可用于自定义表达式求值');
        }
      } catch (err) {
        this._addLog('warn', `createInstance 调用失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'createInstance / HTMLTemplateElement 不可用（jsdom 无 DOM Parts API），仅展示说明文本');
    }
    const info = [
      '===== createInstance 与 TemplateInstance =====',
      '',
      '【HTMLTemplateElement.prototype.createInstance()】',
      '  // 从 <template> 创建 TemplateInstance',
      '  const template = document.querySelector("#my-template");',
      '  const instance = template.createInstance();',
      '  // 可选参数：createInstance(state, options)',
      '  //   state:    初始状态对象',
      '  //   options:  { processCallback } 自定义处理回调',
      '  const inst2 = template.createInstance(',
      '    { name: "Alice", count: 42 },',
      '    { processCallback: (parts, state) => { /* 自定义求值 */ } },',
      '  );',
      '',
      '【TemplateInstance 接口】',
      '  instance.update(state);     // 批量更新所有匹配的 Part',
      '  instance.parts;             // PartGroup：实例内所有部件',
      '  instance.template;          // 关联的 <template> 元素',
      '  // TemplateInstance 本身是 DocumentFragment 子类，可直接 append',
      '  container.append(instance); // 插入 DOM',
      '',
      '【update(state)：批量更新】',
      '  const template = document.querySelector("#my-template");',
      '  const instance = template.createInstance();',
      '  container.append(instance);',
      '',
      '  // 首次更新：填充初始值',
      '  instance.update({ name: "Alice", count: 42 });',
      '  // 模板中 {{name}} / {{count}} 占位被对应 Part 替换',
      '',
      '  // 后续更新：仅触及变化的 Part，无全量 diff',
      '  instance.update({ name: "Bob", count: 100 });',
      '',
      '【processCallback(state)：自定义表达式求值】',
      '  // <template> 可定义 processCallback 自定义占位表达式求值',
      '  template.processCallback = (parts, state) => {',
      '    for (const part of parts) {',
      '      const expr = part.expression;  // 如 "user.name"',
      '      // 自定义求值：支持点路径、过滤器等',
      '      part.value = evalPath(state, expr);',
      '    }',
      '  };',
      '',
      '  // createInstance 时也可传入 processCallback 覆盖',
      '  const instance = template.createInstance(initialState, {',
      '    processCallback: (parts, state) => {',
      '      parts.forEach((p) => {',
      '        p.value = new Function("state", "return " + p.expression)(state);',
      '      });',
      '    },',
      '  });',
      '',
      '【与 update 的协同流程】',
      '  1. createInstance() 解析模板，建立 Part 与表达式的映射',
      '  2. 首次 processCallback(state) 求值所有表达式',
      '  3. update(state) 触发 processCallback 重新求值变化的 Part',
      '  4. Part.replace / Part.value 更新 DOM',
      '',
      '【完整示例：响应式问候】',
      '  // HTML:',
      '  //   <template id="greeting">',
      '  //     <p>Hello {{name}}, you have {{count}} messages</p>',
      '  //   </template>',
      '  const tpl = document.querySelector("#greeting");',
      '  const inst = tpl.createInstance();',
      '  document.body.append(inst);',
      '  inst.update({ name: "Alice", count: 5 });',
      '  // → <p>Hello Alice, you have 5 messages</p>',
      '',
      '  // 更新：仅触及 name/count 对应的 ChildNodePart',
      '  inst.update({ name: "Bob", count: 10 });',
      '  // → <p>Hello Bob, you have 10 messages</p>',
      '',
      '【生命周期】',
      '  - createInstance 后实例游离于 DOM，需手动 append',
      '  - update 可在 append 前或后调用（部件引用已建立）',
      '  - 实例从 DOM 移除后部件仍存在，可重新 append',
      '  - 长期不用建议调用 close/destroy（若实现）释放部件',
      '',
      '【实际能力检测演示】',
      `  HTMLTemplateElement: ${f.templateEl ? '✓' : '✗'}`,
      `  createInstance: ${f.createInstance ? '✓' : '✗'}`,
      `  TemplateInstance: ${f.templateInstance ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. createInstance 返回的是 DocumentFragment 子类，append 后 fragment 清空',
      '  2. update 是浅比较，引用相同的状态对象可能不触发更新',
      '  3. processCallback 中的求值函数需注意 XSS，勿直接 eval 用户输入',
      '  4. 一个 <template> 可 createInstance 多次，生成多个独立实例',
      '  5. jsdom 中 createInstance 不存在，需 polyfill 才能演示',
    ].join('\n');
    this.setState({ instanceInfo: info });
    this._addLog('parts', `createInstance 与 TemplateInstance 演示完成；createInstance=${f.createInstance}，TemplateInstance=${f.templateInstance}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. createInstance 与 TemplateInstance —— createInstance + update(state) + processCallback',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['createInstance', f.createInstance],
          ['TemplateInstance', f.templateInstance],
        ]),
        h(Tag, { color: 'primary' }, '模板实例'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'HTMLTemplateElement.prototype.createInstance(state, options) 从 <template> 创建 TemplateInstance（DocumentFragment 子类），可直接 append 到 DOM。instance.update(state) 批量更新所有匹配的 Part（{{name}}/{{count}} 占位）。processCallback(state) 自定义表达式求值（支持点路径 user.name、过滤器），可覆盖默认求值。协同流程：createInstance 解析模板建立 Part 映射 → 首次 processCallback 求值 → update 触发重新求值 → Part.replace/value 更新 DOM。update 是浅比较，仅触及变化的 Part 无全量 diff。一个 template 可 createInstance 多次生成独立实例。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 createInstance 演示', { type: 'primary', size: 'sm', onClick: () => this._runInstanceDemo() }),
        ),
        h('div', { class: 'domparts-instance-host domparts-host' },
          h('span', { class: 'fs-sm text-secondary' }, 'TemplateInstance 挂载容器（createInstance + update 演示宿主）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// HTML: <template id="greeting">
//   <p>Hello {{name}}, you have {{count}} messages</p>
// </template>
const template = document.querySelector('#my-template');
const instance = template.createInstance();
container.append(instance);

// 首次更新：填充初始值
instance.update({ name: 'Alice', count: 42 });
// → <p>Hello Alice, you have 42 messages</p>

// 后续更新：仅触及变化的 Part，无全量 diff
instance.update({ name: 'Bob', count: 100 });
// → <p>Hello Bob, you have 100 messages</p>

// processCallback：自定义表达式求值
template.processCallback = (parts, state) => {
  for (const part of parts) {
    const expr = part.expression;  // 如 "user.name"
    part.value = evalPath(state, expr);  // 支持点路径
  }
};

// createInstance 时覆盖 processCallback
const inst = template.createInstance(initialState, {
  processCallback: (parts, state) => {
    parts.forEach((p) => {
      p.value = new Function('state', 'return ' + p.expression)(state);
    });
  },
});

// TemplateInstance 接口
instance.update(state);   // 批量更新
instance.parts;           // PartGroup：实例内所有部件
instance.template;        // 关联的 <template> 元素`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.instanceInfo || '（点击按钮查看 createInstance 与 TemplateInstance 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：PartType 元数据 =====================

  _runMetaDemo() {
    const f = this._flags();
    this._injectStyle('domparts-meta-demo', `
      .domparts-meta-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.part) {
      this._addLog('info', '检测到 Part 基类，可演示 PartType 元数据与自定义处理器');
    } else {
      this._addLog('warn', 'Part 不可用（jsdom 无 DOM Parts API），仅展示说明文本');
    }
    const info = [
      '===== PartType 元数据与自定义处理器 =====',
      '',
      '【PartType 枚举】',
      '  enum PartType {',
      '    Attribute,   // AttrPart：设置特性值  <a href="{{url}}">',
      '    Property,    // PropertyPart：设置 JS 属性  <input ::value="name">',
      '    Boolean,     // BooleanPart：切换布尔特性  <input {{disabled}}="isDisabled">',
      '    Event,       // EventPart：绑定事件  <button @click="onClick">',
      '    TextNode,    // ChildNodePart：替换子节点  <p>{{message}}</p>',
      '  }',
      '',
      '【part.metadata：部件元数据对象】',
      '  const part = root.createChildNodePart(node, {',
      '    type: PartType.TextNode,',
      '    name: "message",          // 绑定的状态键',
      '    expression: "user.name",  // 表达式字符串',
      '    evaluator: (state) => state.user.name,  // 自定义求值函数',
      '  });',
      '',
      '  // 读取元数据',
      '  part.metadata.type;        // PartType.TextNode',
      '  part.metadata.name;        // "message"',
      '  part.metadata.expression;  // "user.name"',
      '',
      '【各类型 Part 的 value 语义】',
      '  // ChildNodePart（TextNode）',
      '  part.replace("text");       // 文本',
      '  part.replace(node);         // 元素节点',
      '',
      '  // AttrPart（Attribute）',
      '  // <a href="{{url}}">',
      '  part.value = "https://example.com";  // 字符串',
      '',
      '  // PropertyPart（Property）',
      '  // <input ::value="name">',
      '  part.value = "Alice";  // 设置 element.value = "Alice"',
      '',
      '  // BooleanPart（Boolean）',
      '  // <input {{disabled}}="isDisabled">',
      '  part.value = true;   // 添加 disabled 特性',
      '  part.value = false;  // 移除 disabled 特性',
      '',
      '  // EventPart（Event）',
      '  // <button @click="onClick">',
      '  part.value = (e) => console.log("clicked");  // 函数',
      '  part.value = null;   // 移除事件监听',
      '',
      '【自定义处理器（Custom Processor）】',
      '  // 通过 processCallback 自定义每种 PartType 的处理逻辑',
      '  template.processCallback = (parts, state) => {',
      '    for (const part of parts) {',
      '      switch (part.metadata.type) {',
      '        case "Attribute":',
      '          // 自定义 AttrPart：支持过滤器 {{url | sanitize}}',
      '          part.value = sanitize(evalExpr(state, part.expression));',
      '          break;',
      '        case "Property":',
      '          // PropertyPart：双向绑定回写',
      '          part.value = evalExpr(state, part.expression);',
      '          break;',
      '        case "Boolean":',
      '          part.value = Boolean(evalExpr(state, part.expression));',
      '          break;',
      '        case "Event":',
      '          // EventPart：包装 handler 注入额外参数',
      '          part.value = (e) => handlers[part.expression](e, state);',
      '          break;',
      '        case "TextNode":',
      '          part.replace(String(evalExpr(state, part.expression)));',
      '          break;',
      '      }',
      '    }',
      '  };',
      '',
      '【表达式求值器：支持点路径与过滤器】',
      '  function evalExpr(state, expr) {',
      '    // 支持 "user.profile.name" 点路径',
      '    // 支持 "{{value | filter}}" 过滤器语法',
      '    const [path, ...filters] = expr.split("|").map((s) => s.trim());',
      '    const value = path.split(".").reduce((o, k) => o?.[k], state);',
      '    return filters.reduce((v, fn) => filtersMap[fn]?.(v) ?? v, value);',
      '  }',
      '',
      '  const filtersMap = {',
      '    upper: (v) => String(v).toUpperCase(),',
      '    sanitize: (v) => String(v).replace(/[<>]/g, ""),',
      '    json: (v) => JSON.stringify(v),',
      '  };',
      '',
      '【元数据驱动更新】',
      '  // update 时只处理 metadata.name 匹配的 Part',
      '  instance.update({ message: "Hi" });',
      '  // → 遍历 parts，name === "message" 的 ChildNodePart 被 replace',
      '  // → 其他 Part 不变（无全量 diff）',
      '',
      '【自定义 PartType 扩展】',
      '  // 通过子类化 Part 实现自定义类型（实验性）',
      '  class StylePart extends Part {',
      '    constructor(el, prop, expr) {',
      '      super();',
      '      this.el = el; this.prop = prop; this.expr = expr;',
      '    }',
      '    set value(v) { this.el.style[this.prop] = v; }',
      '  }',
      '',
      '【实际能力检测演示】',
      `  Part: ${f.part ? '✓' : '✗'}`,
      `  AttrPart: ${f.attrPart ? '✓' : '✗'}`,
      `  PropertyPart: ${f.propertyPart ? '✓' : '✗'}`,
      `  BooleanPart: ${f.booleanPart ? '✓' : '✗'}`,
      `  EventPart: ${f.eventPart ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. BooleanPart 的 value 必须是布尔值，字符串 "false" 会被当作真',
      '  2. EventPart 重复赋值会自动移除旧监听，无需手动 off',
      '  3. 自定义 processCallback 中求值要注意 XSS，勿 eval 用户输入',
      '  4. metadata.type 在不同实现中可能是字符串或枚举，需兼容判断',
      '  5. PropertyPart 用 :: 双冒号，与 AttrPart 单冒号易混淆',
    ].join('\n');
    this.setState({ metaInfo: info });
    this._addLog('parts', `PartType 元数据演示完成；Part=${f.part}，PropertyPart=${f.propertyPart}，EventPart=${f.eventPart}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. PartType 元数据 —— Attribute/Property/Boolean/Event/TextNode + 自定义处理器',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['AttrPart', f.attrPart],
          ['PropertyPart', f.propertyPart],
          ['BooleanPart', f.booleanPart],
          ['EventPart', f.eventPart],
        ]),
        h(Tag, { color: 'primary' }, '元数据'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PartType 枚举：Attribute（AttrPart，href="{{url}}"）、Property（PropertyPart，::value="name" 双冒号）、Boolean（BooleanPart，{{disabled}}="isDisabled"）、Event（EventPart，@click="onClick"）、TextNode（ChildNodePart，{{message}}）。part.metadata 含 type/name/expression/evaluator。各类型 value 语义不同：ChildNodePart 用 replace，AttrPart/PropertyPart 用 value=，BooleanPart 用布尔值，EventPart 用函数。自定义处理器通过 processCallback 按 type 分发，可支持点路径 user.name 与过滤器 {{value | upper}}。可子类化 Part 扩展自定义类型（实验性）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 PartType 元数据演示', { type: 'primary', size: 'sm', onClick: () => this._runMetaDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// PartType 枚举
// enum PartType { Attribute, Property, Boolean, Event, TextNode }

// 部件元数据
const part = root.createChildNodePart(node, {
  type: 'TextNode',
  name: 'message',          // 绑定的状态键
  expression: 'user.name',  // 表达式字符串
  evaluator: (state) => state.user.name,  // 自定义求值函数
});

// 各类型 value 语义
childNodePart.replace('text');         // ChildNodePart: replace
attrPart.value = 'https://example.com'; // AttrPart: value=
propertyPart.value = 'Alice';           // PropertyPart: ::value 语法
booleanPart.value = true;               // BooleanPart: 布尔值
eventPart.value = (e) => console.log('clicked'); // EventPart: 函数

// 自定义处理器：按 type 分发
template.processCallback = (parts, state) => {
  for (const part of parts) {
    switch (part.metadata.type) {
      case 'Attribute':
        part.value = sanitize(evalExpr(state, part.expression));
        break;
      case 'Boolean':
        part.value = Boolean(evalExpr(state, part.expression));
        break;
      case 'Event':
        part.value = (e) => handlers[part.expression](e, state);
        break;
      case 'TextNode':
        part.replace(String(evalExpr(state, part.expression)));
        break;
    }
  }
};

// 表达式求值器：点路径 + 过滤器
function evalExpr(state, expr) {
  const [path, ...filters] = expr.split('|').map((s) => s.trim());
  const value = path.split('.').reduce((o, k) => o?.[k], state);
  return filters.reduce((v, fn) => filtersMap[fn]?.(v) ?? v, value);
}

// 自定义 Part 子类（实验性）
class StylePart extends Part {
  constructor(el, prop, expr) {
    super();
    this.el = el; this.prop = prop; this.expr = expr;
  }
  set value(v) { this.el.style[this.prop] = v; }
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.metaInfo || '（点击按钮查看 PartType 元数据与自定义处理器完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：实战：声明式响应式列表渲染 =====================

  _runListDemo() {
    const f = this._flags();
    this._injectStyle('domparts-list-demo', `
      .domparts-list-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const container = this.$('.domparts-list-host');
    if (container) this._listContainer = container;
    if (f.createInstance && f.templateEl) {
      try {
        const tpl = document.createElement('template');
        tpl.innerHTML = '<ul part="list"></ul>';
        const instance = tpl.createInstance();
        if (container) { container.innerHTML = ''; container.append(instance); }
        this._instances.push(instance);
        if (instance && typeof instance.update === 'function') {
          instance.update({ items: [{ name: 'Alice', count: 42 }, { name: 'Bob', count: 7 }] });
          this._addLog('info', '已 update({ items: [...] })，{{items}} 占位应渲染为列表');
        }
      } catch (err) {
        this._addLog('warn', `列表实例化失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'createInstance 不可用（jsdom 无 DOM Parts API），仅展示说明文本');
    }
    const info = [
      '===== 实战：声明式响应式列表渲染 =====',
      '',
      '【目标：用 {{items}} 占位 + part.replace(nodes) 渲染列表】',
      '  // 模板：',
      '  //   <template id="list-tpl">',
      '  //     <ul>{{items}}</ul>',
      '  //   </template>',
      '  // state: { items: [{ name: "Alice", count: 42 }, ...] }',
      '',
      '【步骤 1：定义模板与自定义 processCallback】',
      '  const tpl = document.querySelector("#list-tpl");',
      '  tpl.processCallback = (parts, state) => {',
      '    for (const part of parts) {',
      '      if (part.metadata.name === "items") {',
      '        // 为每项创建 <li> 节点，part.replace 批量替换',
      '        const nodes = state.items.map((item) => {',
      '          const li = document.createElement("li");',
      '          li.innerHTML = `<span class="name">${item.name}</span>` +',
      '                         `<span class="count">${item.count}</span>`;',
      '          return li;',
      '        });',
      '        // part.replace 支持传入多个节点（ChildNodePart 扩展）',
      '        part.replace(...nodes);',
      '      }',
      '    }',
      '  };',
      '',
      '【步骤 2：createInstance 并 update】',
      '  const instance = tpl.createInstance();',
      '  document.body.append(instance);',
      '',
      '  const state = { items: [{ name: "Alice", count: 42 }] };',
      '  instance.update(state);',
      '  // → <ul><li><span class="name">Alice</span>...</li></ul>',
      '',
      '【步骤 3：响应式更新（仅触及 items 部件）】',
      '  // 追加项：update 触发 processCallback，replace 重建 <li> 列表',
      '  state.items.push({ name: "Bob", count: 7 });',
      '  instance.update({ items: state.items });',
      '  // → <ul>..Alice..Bob..</ul>',
      '',
      '  // 删除项',
      '  state.items.shift();',
      '  instance.update({ items: state.items });',
      '  // → <ul>..Bob..</ul>',
      '',
      '【与自定义元素生命周期协同】',
      '  class ItemList extends HTMLElement {',
      '    constructor() {',
      '      super();',
      '      const sr = this.attachShadow({ mode: "open" });',
      '      const tpl = sr.appendChild(',
      '        document.createElement("template")',
      '      );',
      '      tpl.innerHTML = "<ul>{{items}}</ul>";',
      '      tpl.processCallback = (parts, state) => {',
      '        const part = parts[0];',
      '        const nodes = state.items.map((item) => {',
      '          const li = document.createElement("li");',
      '          li.textContent = `${item.name}: ${item.count}`;',
      '          return li;',
      '        });',
      '        part.replace(...nodes);',
      '      };',
      '      this._inst = tpl.createInstance();',
      '      sr.append(this._inst);',
      '    }',
      '',
      '    connectedCallback() {',
      '      // 首次渲染默认数据',
      '      this._inst.update({ items: [] });',
      '    }',
      '',
      '    set items(v) {',
      '      // 属性变化触发 update，复用同一 TemplateInstance',
      '      this._inst.update({ items: v });',
      '    }',
      '  }',
      '  customElements.define("item-list", ItemList);',
      '',
      '  // 使用：',
      '  const list = document.createElement("item-list");',
      '  list.items = [{ name: "Alice", count: 42 }];',
      '  document.body.append(list);',
      '',
      '【性能优势：无虚拟 DOM diff】',
      '  - 框架方案（React/Vue）：每次状态变化生成新 vdom → diff → patch',
      '  - DOM Parts：update 直接触及 items 部件的 replace，跳过 diff',
      '  - 列表场景：DOM Parts 仅重建 <li> 节点，父 <ul> 不变',
      '  - 注意：DOM Parts 默认无 key 复用，需手动优化（复用部件）',
      '',
      '【复用部件优化大列表】',
      '  // 默认 replace 每次重建所有 <li>，大列表性能差',
      '  // 优化：缓存 ChildNodePart 数组，仅更新变化的项',
      '  class ListManager {',
      '    constructor(part) { this.part = part; this.cache = []; }',
      '    update(items) {',
      '      // 复用已有部件，仅追加/移除差异项',
      '      while (this.cache.length > items.length) {',
      '        const p = this.cache.pop();',
      '        p.disconnect();',
      '      }',
      '      items.forEach((item, i) => {',
      '        if (!this.cache[i]) {',
      '          this.cache[i] = /* createChildNodePart */ ;',
      '        }',
      '        this.cache[i].replace(`${item.name}: ${item.count}`);',
      '      });',
      '    }',
      '  }',
      '',
      '【实际能力检测演示】',
      `  HTMLTemplateElement: ${f.templateEl ? '✓' : '✗'}`,
      `  createInstance: ${f.createInstance ? '✓' : '✗'}`,
      `  ChildNodePart: ${f.childNodePart ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 默认 replace 重建所有节点，大列表需复用部件优化',
      '  2. processCallback 中的 item.name 若含 HTML 需转义防 XSS',
      '  3. 自定义元素 constructor 中 createInstance 应在 attachShadow 后',
      '  4. set items 触发 update 时，引用相同数组可能不触发（浅比较）',
      '  5. Shadow DOM 内的 TemplateInstance 随宿主销毁自动清理',
    ].join('\n');
    this.setState({ listInfo: info });
    this._addLog('parts', `声明式列表渲染演示完成；createInstance=${f.createInstance}，ChildNodePart=${f.childNodePart}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 实战：声明式响应式列表渲染 —— {{items}} 占位 + part.replace(nodes) + 自定义元素协同',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['createInstance', f.createInstance],
          ['ChildNodePart', f.childNodePart],
        ]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '声明式响应式列表渲染：模板中 <ul>{{items}}</ul> 占位，processCallback 拦截 items 部件，state.items.map 创建 <li> 节点数组，part.replace(...nodes) 批量替换。响应式更新仅触及 items 部件，无虚拟 DOM diff。与自定义元素协同：constructor 中 attachShadow + createInstance，set items 触发 update 复用同一 TemplateInstance。性能优势：跳过 vdom diff，仅重建 <li>。大列表优化：缓存 ChildNodePart 数组复用，仅追加/移除差异项（手动 key 复用）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行声明式列表渲染演示', { type: 'primary', size: 'sm', onClick: () => this._runListDemo() }),
        ),
        h('div', { class: 'domparts-list-host domparts-host' },
          h('span', { class: 'fs-sm text-secondary' }, '列表渲染容器（{{items}} 占位 + part.replace 演示宿主）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// HTML: <template id="list-tpl"><ul>{{items}}</ul></template>
const tpl = document.querySelector('#list-tpl');

// 自定义 processCallback：拦截 items 部件
tpl.processCallback = (parts, state) => {
  for (const part of parts) {
    if (part.metadata.name === 'items') {
      const nodes = state.items.map((item) => {
        const li = document.createElement('li');
        li.innerHTML = '<span class="name">' + item.name + '</span>' +
                       '<span class="count">' + item.count + '</span>';
        return li;
      });
      part.replace(...nodes);  // 批量替换
    }
  }
};

const instance = tpl.createInstance();
document.body.append(instance);
instance.update({ items: [{ name: 'Alice', count: 42 }] });

// 响应式更新：仅触及 items 部件
state.items.push({ name: 'Bob', count: 7 });
instance.update({ items: state.items });

// 与自定义元素协同
class ItemList extends HTMLElement {
  constructor() {
    super();
    const sr = this.attachShadow({ mode: 'open' });
    const tpl = document.createElement('template');
    tpl.innerHTML = '<ul>{{items}}</ul>';
    tpl.processCallback = (parts, state) => {
      const part = parts[0];
      part.replace(...state.items.map((item) => {
        const li = document.createElement('li');
        li.textContent = item.name + ': ' + item.count;
        return li;
      }));
    };
    this._inst = tpl.createInstance();
    sr.append(this._inst);
  }
  connectedCallback() { this._inst.update({ items: [] }); }
  set items(v) { this._inst.update({ items: v }); }
}
customElements.define('item-list', ItemList);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.listInfo || '（点击按钮查看声明式响应式列表渲染完整实战说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：实战：表单双向绑定 =====================

  _runFormDemo() {
    const f = this._flags();
    this._injectStyle('domparts-form-demo', `
      .domparts-form-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const container = this.$('.domparts-form-host');
    if (container) this._formContainer = container;
    if (f.createInstance && f.propertyPart) {
      try {
        const tpl = document.createElement('template');
        tpl.innerHTML = '<input ::value="name" @input="onInput">';
        const instance = tpl.createInstance();
        if (container) { container.innerHTML = ''; container.append(instance); }
        this._instances.push(instance);
        this._addLog('info', '已 createInstance（::value PropertyPart + @input EventPart）');
        if (instance && typeof instance.update === 'function') {
          instance.update({ name: 'Alice', onInput: (e) => this._addLog('info', 'input: ' + e.target.value) });
          this._addLog('info', '已 update({ name, onInput })，::value 与 @input 部件已绑定');
        }
      } catch (err) {
        this._addLog('warn', `表单实例化失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'createInstance / PropertyPart 不可用（jsdom 无 DOM Parts API），仅展示说明文本');
    }
    const info = [
      '===== 实战：表单双向绑定 =====',
      '',
      '【目标：::value PropertyPart + @input EventPart 实现双向绑定】',
      '  // 模板：',
      '  //   <template id="form-tpl">',
      '  //     <input ::value="name" @input="onInput">',
      '  //     <p>Hello {{name}}</p>',
      '  //   </template>',
      '  // state: { name: "Alice", onInput: (e) => state.name = e.target.value }',
      '',
      '【::value PropertyPart：设置 JS 属性】',
      '  // 双冒号 :: 表示 PropertyPart（区别于 AttrPart 单冒号 :）',
      '  // <input ::value="name"> → element.value = state.name',
      '  // 注意：input.value 是 JS 属性，不是 HTML 特性，必须用 PropertyPart',
      '',
      '【@input EventPart：绑定事件】',
      '  // @event 语法对应 EventPart',
      '  // <input @input="onInput"> → element.addEventListener("input", state.onInput)',
      '  // state.onInput 是函数，回写 state.name 实现双向',
      '',
      '【processCallback 自定义表达式求值】',
      '  const tpl = document.querySelector("#form-tpl");',
      '  tpl.processCallback = (parts, state) => {',
      '    for (const part of parts) {',
      '      const { type, expression } = part.metadata;',
      '      switch (type) {',
      '        case "Property":',
      '          // ::value="name"',
      '          part.value = state[expression];',
      '          break;',
      '        case "Event":',
      '          // @input="onInput"',
      '          part.value = (e) => {',
      '            state[expression](e);          // 调用 onInput',
      '            instance.update(state);        // 触发重渲染',
      '          };',
      '          break;',
      '        case "TextNode":',
      '          // {{name}}',
      '          part.replace(String(state[expression]));',
      '          break;',
      '      }',
      '    }',
      '  };',
      '',
      '【完整双向绑定实现】',
      '  const state = { name: "Alice" };',
      '  const tpl = document.querySelector("#form-tpl");',
      '  const instance = tpl.createInstance();',
      '  document.body.append(instance);',
      '',
      '  // EventPart 回调中回写 state 并 update',
      '  state.onInput = (e) => {',
      '    state.name = e.target.value;  // 回写',
      '    instance.update(state);        // 触发 ::value 与 {{name}} 重渲染',
      '  };',
      '',
      '  instance.update(state);  // 首次渲染',
      '  // 输入框输入 → onInput → state.name 更新 → update → ::value 同步',
      '',
      '【模板片段复用：复用同一模板渲染多字段】',
      '  // 把字段模板封装为可复用片段',
      '  function createField(label, key) {',
      '    const tpl = document.createElement("template");',
      '    tpl.innerHTML =',
      '      "<label>" + label + "</label>" +',
      '      "<input ::value=\\"" + key + "\\" @input=\\"onInput\\">";',
      '    tpl.processCallback = (parts, state) => {',
      '      parts.forEach((p) => {',
      '        if (p.metadata.type === "Property") p.value = state[p.metadata.expression];',
      '        if (p.metadata.type === "Event") p.value = (e) => {',
      '          state[p.metadata.expression.replace("onInput", key)] = e.target.value;',
      '          instance.update(state);',
      '        };',
      '      });',
      '    };',
      '    return tpl;',
      '  }',
      '',
      '  // 复用片段构建多字段表单',
      '  const form = document.createElement("form");',
      '  ["name", "email", "phone"].forEach((key) => {',
      '    const inst = createField(key, key).createInstance();',
      '    form.append(inst);',
      '  });',
      '',
      '【与 Declarative Shadow DOM 协同】',
      '  // HTML（SSR 输出）：',
      '  //   <form-bind>',
      '  //     <template shadowrootmode="open">',
      '  //       <input ::value="name" @input="onInput">',
      '  //       <p>Hello {{name}}</p>',
      '  //     </template>',
      '  //   </form-bind>',
      '',
      '  // 浏览器解析时自动 attachShadow，shadow root 内模板可 createInstance',
      '  class FormBind extends HTMLElement {',
      '    constructor() {',
      '      super();',
      '      const sr = this.shadowRoot;  // DSD 已创建',
      '      const tpl = sr.querySelector("template");',
      '      // DSD 的 <template> 在 attachShadow 后被消费，需特殊处理',
      '      // 通常手动重新创建 template 并 createInstance',
      '      this._inst = tpl.createInstance();',
      '      sr.append(this._inst);',
      '      this._state = { name: "" };',
      '    }',
      '    connectedCallback() {',
      '      this._state.onInput = (e) => {',
      '        this._state.name = e.target.value;',
      '        this._inst.update(this._state);',
      '      };',
      '      this._inst.update(this._state);',
      '    }',
      '  }',
      '',
      '【与受控组件的差异】',
      '  - React 受控：value={state.name} onChange={e => setState}，每次 setState 重渲染整个组件',
      '  - DOM Parts 双向：::value 部件 + @input 部件，update 仅触及 name 相关部件',
      '  - 性能：DOM Parts 跳过组件树 diff，表单字段多时优势明显',
      '',
      '【实际能力检测演示】',
      `  createInstance: ${f.createInstance ? '✓' : '✗'}`,
      `  PropertyPart: ${f.propertyPart ? '✓' : '✗'}`,
      `  EventPart: ${f.eventPart ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. ::value 必须用 PropertyPart，单冒号 :value 只设特性不更新 input.value',
      '  2. EventPart 回调中需手动 update 触发重渲染（无自动脏检查）',
      '  3. DSD 的 <template> 被 attachShadow 消费后需手动重建才能 createInstance',
      '  4. processCallback 中 state[expression] 需注意表达式是字符串路径',
      '  5. 多字段复用模板时，EventPart 的 expression 易混淆，需按字段隔离',
    ].join('\n');
    this.setState({ formInfo: info });
    this._addLog('parts', `表单双向绑定演示完成；PropertyPart=${f.propertyPart}，EventPart=${f.eventPart}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：表单双向绑定 —— ::value PropertyPart + @input EventPart + DSD 协同',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PropertyPart', f.propertyPart],
          ['EventPart', f.eventPart],
        ]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '表单双向绑定：::value PropertyPart 设置 input.value（双冒号区别于 AttrPart 单冒号），@input EventPart 绑定事件。processCallback 按 type 分发：Property 设 value、Event 包装 handler 回写 state 并触发 update、TextNode 用 replace。EventPart 回调中手动 update 实现重渲染（无自动脏检查）。模板片段复用：封装 createField(label, key) 生成可复用模板实例构建多字段表单。与 Declarative Shadow DOM 协同：<template shadowrootmode="open"> 内模板 createInstance，SSR 友好。与 React 受控组件对比：DOM Parts 跳过组件树 diff，字段多时优势明显。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行表单双向绑定演示', { type: 'primary', size: 'sm', onClick: () => this._runFormDemo() }),
        ),
        h('div', { class: 'domparts-form-host domparts-host' },
          h('span', { class: 'fs-sm text-secondary' }, '表单双向绑定容器（::value + @input 演示宿主）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// HTML: <template id="form-tpl">
//   <input ::value="name" @input="onInput">
//   <p>Hello {{name}}</p>
// </template>
const tpl = document.querySelector('#form-tpl');
const state = { name: 'Alice' };
const instance = tpl.createInstance();
document.body.append(instance);

// processCallback 按 type 分发
tpl.processCallback = (parts, state) => {
  for (const part of parts) {
    const { type, expression } = part.metadata;
    switch (type) {
      case 'Property':           // ::value="name"
        part.value = state[expression];
        break;
      case 'Event':              // @input="onInput"
        part.value = (e) => {
          state[expression](e);     // 调用 onInput
          instance.update(state);   // 触发重渲染
        };
        break;
      case 'TextNode':           // {{name}}
        part.replace(String(state[expression]));
        break;
    }
  }
};

// EventPart 回调回写 state 实现“双向”
state.onInput = (e) => {
  state.name = e.target.value;  // 回写
  instance.update(state);        // 触发 ::value 与 {{name}} 重渲染
};
instance.update(state);

// 与 Declarative Shadow DOM 协同（SSR）
// <form-bind>
//   <template shadowrootmode="open">
//     <input ::value="name" @input="onInput">
//   </template>
// </form-bind>
class FormBind extends HTMLElement {
  constructor() {
    super();
    const sr = this.shadowRoot;  // DSD 已创建
    const tpl = sr.querySelector('template');
    this._inst = tpl.createInstance();
    sr.append(this._inst);
    this._state = { name: '' };
  }
  connectedCallback() {
    this._state.onInput = (e) => {
      this._state.name = e.target.value;
      this._inst.update(this._state);
    };
    this._inst.update(this._state);
  }
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.formInfo || '（点击按钮查看表单双向绑定完整实战说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：性能对比与生态 =====================

  _runPerfDemo() {
    const f = this._flags();
    this._injectStyle('domparts-perf-demo', `
      .domparts-perf-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.createInstance) {
      this._addLog('info', '检测到原生 createInstance，可对比 DOM Parts 与 Lit 性能');
    } else {
      this._addLog('warn', 'createInstance 不可用（jsdom 无 DOM Parts API），仅展示说明文本');
    }
    const info = [
      '===== 性能对比与生态 =====',
      '',
      '【与 Lit render() / html`` 性能对比】',
      '  Lit（基于早期 Template Instantiation 提案）:',
      '    - html`<p>Hello ${name}</p>` 模板字面量',
      '    - render(template, container) 首次创建 TemplateInstance',
      '    - 后续 render 复用实例，仅更新 ${} 部件（与 DOM Parts 同源）',
      '    - 内置 directive（repeat/when/classMap）处理 key 复用',
      '    - 性能基准：~10μs/更新（小模板）',
      '',
      '  DOM Parts API（原生标准化）:',
      '    - template.createInstance() 原生方法',
      '    - instance.update(state) 原生批量更新',
      '    - 无 directive，需手动实现 key 复用/条件渲染',
      '    - 性能基准：~5-8μs/更新（小模板，原生无需框架层）',
      '    - 优势：零依赖、原生、可被任何框架复用',
      '',
      '【无虚拟 DOM diff：直接 DOM 部件替换】',
      '  React/Vue 流程:',
      '    1. setState → 生成新 vdom',
      '    2. diff 旧 vdom vs 新 vdom（O(n) 树比较）',
      '    3. patch：提交 DOM 变更',
      '    4. 大列表 diff 成本随节点数线性增长',
      '',
      '  DOM Parts 流程:',
      '    1. update(state)',
      '    2. processCallback 遍历部件（O(部件数)）',
      '    3. part.replace / part.value 直接操作 DOM',
      '    4. 跳过树比较，仅触及占位部件',
      '    5. 大列表性能：部件数固定，与列表项数线性但常数更小',
      '',
      '【性能基准对比（示意，实际因环境而异）】',
      '  场景：1000 项列表更新第 500 项',
      '    React (keyed):    ~3.2ms（diff + patch）',
      '    Vue 3 (keyed):    ~2.1ms（block tree + patch）',
      '    Lit:               ~0.8ms（部件复用）',
      '    DOM Parts API:     ~0.6ms（原生部件 replace）',
      '    cloneNode 全量:    ~12ms（重建所有节点）',
      '',
      '  场景：单字段表单 input 更新',
      '    React 受控:       ~0.5ms（组件重渲染）',
      '    DOM Parts 双向:    ~0.05ms（仅 ::value 部件）',
      '',
      '【浏览器支持矩阵（截至 2025）】',
      '  浏览器            Part API    createInstance    getPartRoot    备注',
      '  Chrome ≥120       部分实现    部分实现          部分实现       in progress',
      '  Edge ≥120         部分实现    部分实现          部分实现       同 Chromium',
      '  Safari 17+        ✗           ✗                 ✗             未实现',
      '  Firefox           ✗           ✗                 ✗             未实现',
      '  移动 Chrome       部分实现    部分实现          部分实现       同桌面',
      '  移动 Safari       ✗           ✗                 ✗             未实现',
      '',
      '【Polyfill 策略：@github/template-parts】',
      '  // 安装：npm install @github/template-parts',
      '  // 引入：自动 polyfill HTMLTemplateElement.prototype.createInstance',
      '  import "@github/template-parts";',
      '',
      '  // polyfill 后 API 与原生一致',
      '  const tpl = document.querySelector("#tpl");',
      '  const inst = tpl.createInstance();',
      '  inst.update({ name: "Alice" });',
      '',
      '  // @github/template-parts 特性：',
      '  //   - AttributePart / PropertyPart / EventPart / BooleanPart',
      '  //   - NodePart（替换子节点）',
      '  //   - processCallback 自定义表达式',
      '  //   - 支持 {{ }} 与指令语法',
      '  //   - 兼容 IE11+（需 transpile）',
      '',
      '【与 Web Components 生态整合路径】',
      '  1. Lit：原生 DOM Parts 落地后，Lit 可直接复用原生 Part，移除内部实现',
      '  2. Vue：未来可基于原生 Part 实现更轻量的响应式 runtime',
      '  3. Solid：已用类似机制（信号 + 模板部件），原生 API 可标准化其内部',
      '  4.Stencil：编译产物可直接输出 DOM Parts 模板，减少运行时',
      '  5. 原生自定义元素：直接 createInstance 无需框架，部件级响应式',
      '',
      '【混合使用：框架 + 原生 Parts】',
      '  // 在 Lit 元素中复用原生 Parts（未来 Lit 适配后）',
      '  class MyElement extends LitElement {',
      '    render() {',
      '      // Lit html`` 内部最终调用原生 createInstance',
      '      return html`<p>Hello ${this.name}</p>`;',
      '    }',
      '  }',
      '',
      '  // 框架无关：直接用原生 Parts 构建组件',
      '  function createStateful(template, initialState) {',
      '    const inst = template.createInstance();',
      '    let state = initialState;',
      '    return {',
      '      el: inst,',
      '      set(next) { state = { ...state, ...next }; inst.update(state); },',
      '    };',
      '  }',
      '',
      '【渐进增强策略】',
      '  // 1. 优先检测原生支持',
      '  const nativeOK = typeof HTMLTemplateElement !== "undefined"',
      '    && typeof HTMLTemplateElement.prototype.createInstance === "function";',
      '  // 2. 不支持时动态加载 polyfill',
      '  if (!nativeOK) {',
      '    await import("@github/template-parts");',
      '  }',
      '  // 3. 之后统一用 createInstance API',
      '',
      '【实际能力检测演示】',
      `  createInstance: ${f.createInstance ? '✓' : '✗'}`,
      `  Part: ${f.part ? '✓' : '✗'}`,
      `  PartGroup: ${f.partGroup ? '✓' : '✗'}`,
      '',
      '【资源】',
      '  - W3C DOM Parts 提案: https://github.com/WICG/dom-parts',
      '  - Template Instantiation: https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md',
      '  - @github/template-parts: https://github.com/github/template-parts',
      '  - Lit: https://lit.dev/',
      '  - MDN HTMLTemplateElement: https://developer.mozilla.org/docs/Web/API/HTMLTemplateElement',
      '',
      '【常见陷阱】',
      '  1. 原生 API 仍在演进，不同 Chrome 版本签名可能不同，需检测',
      '  2. 生产环境建议始终加载 polyfill 保证跨浏览器一致',
      '  3. 性能优势在小模板不明显，大列表/表单场景才显著',
      '  4. 原生 Parts 无 directive，复杂逻辑需手动实现或回退框架',
      '  5. 与 SSR 协同需 Declarative Shadow DOM，注意 hydration 时机',
    ].join('\n');
    this.setState({ perfInfo: info });
    this._addLog('parts', `性能对比与生态演示完成；createInstance=${f.createInstance}，Part=${f.part}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 性能对比与生态 —— Lit/html`` 对比 + 浏览器矩阵 + Polyfill + WC 整合',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '生态'),
        h(Tag, { color: f.createInstance ? 'success' : 'error' }, `DOM Parts ${f.createInstance ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '性能对比：Lit html`` 基于早期 Template Instantiation 提案，DOM Parts API 是其标准化演进，原生无需框架层性能更优（~5-8μs vs Lit ~10μs/更新）。无虚拟 DOM diff：update 直接触及占位部件 part.replace/value，跳过树比较，大列表性能优势明显（1000 项更新 ~0.6ms vs React ~3.2ms）。浏览器支持：Chrome ≥120 部分实现，Safari/Firefox 未实现。Polyfill 策略：@github/template-parts（npm install，import 后自动 polyfill，兼容 IE11+）。WC 生态整合：Lit 未来可复用原生 Part，Vue/Solid 可基于原生 Part 标准化内部，原生自定义元素直接 createInstance 无需框架。渐进增强：检测原生 → 不支持动态加载 polyfill → 统一 API。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行性能对比与生态演示', { type: 'primary', size: 'sm', onClick: () => this._runPerfDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 渐进增强：优先原生，不支持加载 polyfill
const nativeOK = typeof HTMLTemplateElement !== 'undefined'
  && typeof HTMLTemplateElement.prototype.createInstance === 'function';
if (!nativeOK) {
  await import('@github/template-parts');  // 自动 polyfill
}

// 之后统一用 createInstance API
const template = document.querySelector('#my-template');
const instance = template.createInstance();
container.append(instance);
instance.update({ name: 'Alice', count: 42 });

// 框架无关：封装响应式状态
function createStateful(template, initialState) {
  const inst = template.createInstance();
  let state = initialState;
  return {
    el: inst,
    set(next) { state = { ...state, ...next }; inst.update(state); },
  };
}

// 与 Lit 协同（未来 Lit 适配后内部用原生 Part）
// import { LitElement, html } from 'lit';
// class MyElement extends LitElement {
//   render() { return html\`<p>Hello \${this.name}</p>\`; }
// }

// 性能基准（示意）
// 1000 项列表更新第 500 项：
//   React (keyed):    ~3.2ms (diff + patch)
//   Vue 3 (keyed):    ~2.1ms (block tree + patch)
//   Lit:              ~0.8ms (部件复用)
//   DOM Parts API:    ~0.6ms (原生部件 replace)`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.perfInfo || '（点击按钮查看性能对比与生态完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== 日志面板 =====================

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
      h('h2', { class: 'section-title' }, 'DOM Parts API 标准化模板部件深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'DOM Parts API —— W3C 标准化模板部件模型（原 Template Instantiation 提案演进）',
        description: '演示 DOM Parts API 完整能力：概念与三方案对比（模板部件 vs 节点克隆 cloneNode vs Declarative Shadow DOM <template shadowrootmode="open">）+ PartRoot/Part/PartGroup 模型、DocumentPartRoot 与 Element.prototype.getPartRoot() 节点-部件树关系 + 部件类型枚举（ChildNodePart/AttrPart/PropertyPart 用 :: 双冒号/BooleanPart/EventPart 用 @event）、Element.createChildNodePart(node, metadata) + PartGroup + part.replace(node)/part.replace(text)/part.disconnect()、HTMLTemplateElement.prototype.createInstance() + TemplateInstance 接口 + update(state) 批量更新 + processCallback(state) 自定义表达式求值、PartType 元数据（Attribute/Property/Boolean/Event/TextNode）+ 自定义处理器 + 表达式求值器（点路径 user.name 与过滤器 {{value | upper}}）、实战声明式响应式列表渲染（{{items}} 占位 + part.replace(...nodes) + 与自定义元素生命周期协同 + 部件复用优化）、实战表单双向绑定（::value PropertyPart + @input EventPart + processCallback 自定义求值 + 模板片段复用 + 与 DSD 协同）、性能对比与生态（Lit html`` 同源 vs 原生 DOM Parts 无 vdom diff 直接部件替换 + 浏览器支持矩阵 Chrome ≥120 部分实现 + @github/template-parts polyfill + 与 Web Components 生态整合路径）。jsdom 无 Part/ChildNodePart/PartGroup/DocumentPartRoot/getPartRoot/createInstance 全部 typeof 为 undefined，所有按钮点击仅记日志说明，不会抛异常；真实浏览器需 Chrome 部分实现或 polyfill 才能完整体验。',
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
