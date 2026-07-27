// =====================================================================
// HTMLModernInteractiveElementsPage.js —— 现代 HTML 交互/语义元素深潜 实验室
// 演示常被忽视但高价值的「现代 HTML 元素 + 专属 CSS 伪元素/伪类」组合：
//   1. <details>/<summary> 深潜 —— 原生折叠面板，无需 JS；
//      ::details-content 伪元素（Chrome 129+）选中展开内容区域可独立样式化；
//      ::marker 选中三角箭头可自定义图标；name 属性实现互斥手风琴（同 name
//      仅一个展开）；toggle 事件监听展开状态（e.target.open）
//   2. <search> 元素（2024）—— 用于搜索/过滤区域的语义元素，
//      替代 <form role="search">；landmark role 自动获得；屏幕阅读器快捷键跳转
//   3. <dialog> 深潜 —— showModal() 模态 + show() 非模态 + close()；
//      :modal 伪类（Chrome 111+）区分模态/非模态样式；::backdrop 模态遮罩；
//      form method="dialog" 表单提交关闭对话框 + returnValue 取值；
//      light dismiss（ESC 关闭）+ cancel 事件可阻止默认关闭
//   4. ::target-text 伪元素（Chrome 89+）—— 滚动到文本片段（#:~:text=...）
//      高亮被导航到的文本；:target/:target-within（提案）反映锚点目标状态；
//      FragmentDirective API（实验性）程序化生成文本片段链接
//   5. <permission> 元素（实验性 2024-2025）—— 声明式权限请求按钮，
//      type 属性指定权限（geolocation/camera/microphone/notifications 等）；
//      替代按钮 + Permissions API + try/catch 的命令式方案
//   6. 元素状态伪类大集合 —— :modal/:popover-open/:fullscreen/:picture-in-picture
//      /:target/:defined（自定义元素升级完成）/ :state()（自定义元素内部状态）
//      统一反映元素的「交互状态」，可用于 CSS 响应状态切换样式
// 说明：jsdom 不做真实渲染，本页用 CSS.supports() / 元素构造器探测能力并展示
//       完整代码示例与标记结构；真实浏览器可查看交互效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class HTMLModernInteractiveElementsPage extends Page {
    _dynamicStyles;
    _inited;
    _internals;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            detailsInfo: '', // Card 1：<details>/::details-content
            searchInfo: '', // Card 2：<search> 元素
            dialogInfo: '', // Card 3：<dialog> + :modal
            targetTextInfo: '', // Card 4：::target-text + 文本片段
            permissionInfo: '', // Card 5：<permission> 元素
            statePseudoInfo: '', // Card 6：状态伪类大集合
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._dynamicStyles = [];
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `<details> ${c(f.details)}`,
            `::details-content ${c(f.detailsContent)}`,
            `<search> ${c(f.search)}`,
            `<dialog> ${c(f.dialog)}`,
            `:modal ${c(f.modal)}`,
            `::backdrop ${c(f.backdrop)}`,
            `::target-text ${c(f.targetText)}`,
            `<permission> ${c(f.permission)}`,
            `:popover-open ${c(f.popoverOpen)}`,
            `:fullscreen ${c(f.fullscreen)}`,
            `:picture-in-picture ${c(f.pictureInPicture)}`,
            `:defined ${c(f.defined)}`,
            `:state() ${c(f.statePseudo)}`,
        ];
        const summary = f.css
            ? `现代 HTML 交互元素能力检测：${parts.join(' · ')}。jsdom 不做真实渲染，按钮点击将注入演示样式 + 展示完整标记/代码示例；真实浏览器可查看交互效果。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.detailsContent)
            this._addLog('warn', '::details-content 不可用（Chrome 129+ 才支持）');
        if (!f.search)
            this._addLog('warn', '<search> 元素不可用（Chrome 124+/Safari 17.4+ 才支持）');
        if (!f.modal)
            this._addLog('warn', ':modal 伪类不可用（Chrome 111+ 才支持）');
        if (!f.permission)
            this._addLog('warn', '<permission> 元素不可用（实验性，仅 Chrome Canary）');
    }
    componentWillUnmount() {
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
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
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    _injectStyle(id, css) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    _flags() {
        const hasCSS = typeof CSS !== 'undefined';
        const supportsPV = (p, v) => {
            try {
                return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v);
            }
            catch {
                return false;
            }
        };
        const supportsSel = (sel) => {
            try {
                return hasCSS && typeof CSS.supports === 'function' && CSS.supports('selector(' + sel + ')');
            }
            catch {
                return false;
            }
        };
        // DOM 元素构造器检测
        const hasElement = (name) => {
            try {
                const ctor = document.createElement(name).constructor;
                // HTMLUnknownElement 表示浏览器不识别该元素
                return ctor && ctor.name !== 'HTMLUnknownElement' &&
                    ctor !== window.HTMLUnknownElement;
            }
            catch {
                return false;
            }
        };
        return {
            css: hasCSS,
            supports: hasCSS && typeof CSS.supports === 'function',
            // Card 1
            details: hasElement('details'),
            detailsContent: supportsSel('::details-content'),
            detailsMarker: supportsSel('summary::marker'),
            // Card 2
            search: hasElement('search'),
            // Card 3
            dialog: hasElement('dialog'),
            modal: supportsSel(':modal'),
            backdrop: supportsSel('dialog::backdrop'),
            // Card 4
            targetText: supportsSel('::target-text'),
            target: supportsSel(':target'),
            targetWithin: supportsSel(':target-within'),
            // Card 5
            permission: hasElement('permission'),
            // Card 6
            popoverOpen: supportsSel(':popover-open'),
            fullscreen: supportsSel(':fullscreen'),
            pictureInPicture: supportsSel(':picture-in-picture'),
            defined: supportsSel(':defined'),
            statePseudo: supportsSel(':state()'),
        };
    }
    // ===================== Card 1：<details> + ::details-content =====================
    _runDetailsDemo() {
        const f = this._flags();
        this._injectStyle('html-details-demo', `
      .html-details-demo details {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #fff;
        margin-bottom: 8px;
        overflow: hidden;
      }
      .html-details-demo summary {
        padding: 10px 14px;
        background: #f8fafc;
        cursor: pointer;
        font-weight: 600;
        list-style: none;          /* 隐藏默认三角 */
        user-select: none;
      }
      .html-details-demo summary::-webkit-details-marker {
        display: none;             /* 旧 Webkit 内核隐藏三角 */
      }
      /* ::marker 选中 summary 的三角（标准方式） */
      .html-details-demo summary::marker {
        content: "▶ ";
        color: #3b82f6;
        transition: transform 0.2s;
      }
      .html-details-demo details[open] summary::marker {
        content: "▼ ";
      }
      /* ::details-content —— 选中展开的内容区域（Chrome 129+） */
      .html-details-demo details::details-content {
        padding: 12px 14px;
        background: #fffbeb;
        border-top: 1px solid #fde68a;
        /* 可独立动画化 */
        animation: details-slide 0.2s ease-out;
      }
      @keyframes details-slide {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      /* name 属性互斥手风琴：同 name 的 details 仅一个展开 */
      .html-accordion-demo details[name="faq"] {
        border: 1px solid #c7d2fe;
        margin-bottom: 6px;
        border-radius: 6px;
      }
    `);
        const info = [
            '===== <details>/<summary> + ::details-content 深潜 =====',
            '',
            '【基础用法：原生折叠面板，零 JS】',
            '  <details>',
            '    <summary>点击展开</summary>',
            '    <p>展开后显示的内容。</p>',
            '  </details>',
            '  - <summary> 是折叠按钮（可省略，浏览器提供默认「Details」按钮）',
            '  - open 属性反映展开状态：<details open> 默认展开',
            '  - 点击 summary 切换 open 属性，原生支持键盘（Enter/Space）',
            '',
            '【::marker —— 自定义三角箭头】',
            '  summary { list-style: none; }          /* 隐藏默认三角 */',
            '  summary::-webkit-details-marker { display: none; }  /* 旧 Webkit */',
            '  summary::marker {',
            '    content: "▶ ";                       /* 标准方式自定义图标 */',
            '    color: #3b82f6;',
            '    transition: transform 0.2s;',
            '  }',
            '  details[open] summary::marker { content: "▼ "; }',
            '',
            '【::details-content —— 选中展开内容区域（Chrome 129+）】',
            '  动机：传统 <details> 展开内容与 summary 共用同一个盒模型，',
            '        无法对「展开区域」单独设 padding/background/动画',
            '  方案：::details-content 伪元素选中展开内容容器',
            '  details::details-content {',
            '    padding: 12px 14px;',
            '    background: #fffbeb;',
            '    border-top: 1px solid #fde68a;',
            '    animation: details-slide 0.2s ease-out;  /* 可独立动画 */',
            '  }',
            '',
            '【name 属性 —— 互斥手风琴（Chrome 120+）】',
            '  <details name="faq">...</details>',
            '  <details name="faq">...</details>',
            '  <details name="faq">...</details>',
            '  /* 同 name 的 details 仅一个展开，展开新项自动收起其他项 */',
            '  /* 替代手写 JS 监听 toggle 事件手动 close 其他项 */',
            '',
            '【toggle 事件 —— 监听展开状态变化】',
            '  details.addEventListener($1, (e: any) => {',
            '    console.log("open:", e.target.open);',
            '    console.log("newState:", e.newState);    // "open" | "closed"',
            '    console.log("prevState:", e.oldState);    // "open" | "closed"',
            '  });',
            '  注意：toggle 事件在展开/收起后触发（非之前），无法 preventDefault',
            '',
            '【与 <dialog>/Popover API 对比】',
            '  <details>：内容嵌入文档流，展开推动后续元素；适合 FAQ/侧栏/手风琴',
            '  <dialog>：模态遮罩，焦点陷阱，ESC 关闭；适合弹窗/确认框',
            '  Popover API：声明式弹层，top-layer 渲染不挤压布局；适合 tooltip/menu',
            '',
            `CSS.supports('selector(::details-content)') = ${f.detailsContent}`,
            `CSS.supports('selector(summary::marker)') = ${f.detailsMarker}`,
            '',
            '===== 状态（截至 2025）=====',
            '  <details> 全浏览器支持（IE 除外）',
            '  ::details-content Chrome 129+ / Firefox/Safari 暂未实现',
            '  name 属性 Chrome 120+ / Edge 120+ / Firefox/Safari 暂未实现',
            '  规范来源：https://html.spec.whatwg.org/multipage/interactive-elements.html',
        ].join('\n');
        this.setState({ detailsInfo: info });
        this._addLog('html', `<details> 演示完成；::details-content=${f.detailsContent}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. <details>/<summary> + ::details-content 深潜',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['<details>', f.details], ['::details-content', f.detailsContent], ['::marker', f.detailsMarker]]), h(Tag, { color: 'primary' }, '零 JS 折叠')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '<details>/<summary> 原生折叠面板零 JS 即可用；::details-content（Chrome 129+）选中展开内容区域可独立样式化（padding/background/动画）；::marker 自定义三角箭头；name 属性（Chrome 120+）实现互斥手风琴（同 name 仅一个展开，替代手写 JS）；toggle 事件监听展开状态变化（e.newState/e.oldState）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 <details> 演示', { type: 'primary', size: 'sm', onClick: () => this._runDetailsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.detailsInfo || '（点击按钮查看 <details>/::details-content 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：<search> 元素 =====================
    _runSearchDemo() {
        const f = this._flags();
        this._injectStyle('html-search-demo', `
      .html-search-demo search {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .html-search-demo search input[type="search"] {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-size: 14px;
      }
      .html-search-demo search button {
        padding: 8px 16px;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `);
        const info = [
            '===== <search> 元素 —— 搜索区域语义（2024）=====',
            '',
            '【动机】传统搜索区域用 <form role="search"> 包裹：',
            '  <form role="search" action="/search">',
            '    <input type="search" name="q" />',
            '    <button>搜索</button>',
            '  </form>',
            '  问题：role="search" 是 ARIA 补丁，HTML 无原生语义元素',
            '',
            '【新方案】<search> 元素（Chrome 124+/Safari 17.4+）',
            '  <search>',
            '    <form action="/search">',
            '      <label>搜索：<input type="search" name="q" /></label>',
            '      <button>搜索</button>',
            '    </form>',
            '  </search>',
            '  自动获得 role="search" landmark 语义',
            '  屏幕阅读器提供快捷键跳转到搜索区域（与 nav/main 同级 landmark）',
            '',
            '【应用场景】',
            '  1. 站点搜索框：<search><form>...</form></search>',
            '  2. 过滤控件：列表/表格上方的筛选区域',
            '     <search>',
            '       <input type="search" placeholder="过滤..." />',
            '       <select><option>全部</option>...</select>',
            '     </search>',
            '  3. 多个搜索区域：站点搜索 + 页面内搜索可分别用 <search>',
            '',
            '【样式控制】',
            '  search { display: flex; align-items: center; gap: 8px; padding: 12px; }',
            '  search input[type="search"] { flex: 1; }',
            '',
            '【与 <form role="search"> 对比】',
            '  <form role="search">：ARIA 补丁，需手动写 role',
            '  <search>：原生语义元素，自动 landmark，无需 role',
            '  向后兼容：<search> 内部可仍包 <form> 提交表单',
            '',
            '【landmark role 全家桶】',
            '  <header>  → role="banner"',
            '  <main>    → role="main"',
            '  <footer>  → role="contentinfo"',
            '  <nav>     → role="navigation"',
            '  <aside>   → role="complementary"',
            '  <form>    → role="form"（有 accessible name 时）',
            '  <search>  → role="search"（2024 新增）',
            '  <region>  → role="region"（有 accessible name 时）',
            '',
            `DOM 检测 document.createElement("search") = ${f.search}`,
            '',
            '===== 状态（截至 2025）=====',
            '  Chrome 124+ / Edge 124+ / Safari 17.4+ / Firefox 124+ 支持',
            '  规范来源：https://html.spec.whatwg.org/multipage/grouping-content.html#the-search-element',
        ].join('\n');
        this.setState({ searchInfo: info });
        this._addLog('html', `<search> 演示完成；supports=${f.search}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. <search> 元素 —— 搜索区域语义（2024）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['<search>', f.search]]), h(Tag, { color: 'primary' }, 'landmark')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '<search> 是 2024 新增的语义元素，用于搜索/过滤区域，自动获得 role="search" landmark 语义，屏幕阅读器提供快捷键跳转。替代传统 <form role="search"> ARIA 补丁。可包含表单、输入框、筛选控件。Chrome 124+/Safari 17.4+/Firefox 124+ 支持。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 <search> 演示', { type: 'primary', size: 'sm', onClick: () => this._runSearchDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '440px', overflow: 'auto' } }, h('code', {}, s.searchInfo || '（点击按钮查看 <search> 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：<dialog> + :modal =====================
    _runDialogDemo() {
        const f = this._flags();
        this._injectStyle('html-dialog-demo', `
      .html-dialog-demo dialog {
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 0;
        max-width: 480px;
        width: 90vw;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      }
      /* :modal 伪类 —— 仅 showModal() 打开的 dialog 匹配（Chrome 111+） */
      .html-dialog-demo dialog:modal {
        background: #fff;
        animation: dialog-pop 0.2s ease-out;
      }
      @keyframes dialog-pop {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      /* 非模态 dialog（show() 打开）样式不同 */
      .html-dialog-demo dialog:not(:modal) {
        background: #fef3c7;
        border-color: #fcd34d;
      }
      /* ::backdrop —— 仅模态 dialog 的遮罩层 */
      .html-dialog-demo dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      }
      .html-dialog-demo dialog .dialog-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
        font-size: 16px;
      }
      .html-dialog-demo dialog .dialog-body {
        padding: 16px 20px;
        color: #475569;
      }
      .html-dialog-demo dialog .dialog-footer {
        padding: 12px 20px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `);
        const info = [
            '===== <dialog> + :modal + ::backdrop 深潜 =====',
            '',
            '【基础用法】',
            '  <dialog id="d">...</dialog>',
            '  <button onclick="d.showModal()">打开模态</button>',
            '  <button onclick="d.show()">打开非模态</button>',
            '',
            '【三种打开方式】',
            '  1. dialog.show()         - 非模态：嵌入文档流，无遮罩，无焦点陷阱',
            '  2. dialog.showModal()    - 模态：top-layer 渲染，遮罩 + 焦点陷阱 + ESC 关闭',
            '  3. <dialog open>         - 声明式非模态（HTML 属性，无遮罩）',
            '',
            '【关闭方式】',
            '  dialog.close(returnValue)  - JS 关闭，可传 returnValue',
            '  dialog.requestClose()      - 触发 cancel 事件（可 preventDefault 阻止）',
            '  ESC 键                      - 仅模态 dialog，触发 cancel 事件',
            '  form method="dialog"       - 表单提交关闭对话框',
            '',
            '【:modal 伪类 —— 区分模态/非模态样式（Chrome 111+）】',
            '  dialog:modal { background: #fff; }              /* 模态白底 */',
            '  dialog:not(:modal) { background: #fef3c7; }     /* 非模态黄底 */',
            '  动机：show() 与 showModal() 共用同一元素，需区分样式',
            '',
            '【::backdrop —— 模态遮罩层（仅 showModal 打开时）】',
            '  dialog::backdrop {',
            '    background: rgba(0, 0, 0, 0.5);',
            '    backdrop-filter: blur(2px);                   /* 毛玻璃效果 */',
            '  }',
            '  注意：::backdrop 仅对 showModal() 打开的 dialog 生效',
            '',
            '【form method="dialog" —— 表单提交关闭对话框】',
            '  <dialog id="d">',
            '    <form method="dialog">',
            '      <p>选择操作：</p>',
            '      <button value="save">保存</button>',
            '      <button value="cancel">取消</button>',
            '    </form>',
            '  </dialog>',
            '  <script>',
            '    d.showModal();',
            '    d.addEventListener("close", () => {',
            '      console.log(d.returnValue);  // "save" | "cancel" | ""',
            '    });',
            '  </script>',
            '  注意：form method="dialog" 不会触发 submit 事件，直接关闭对话框',
            '        并把按钮的 value 设为 dialog.returnValue',
            '',
            '【close 事件 —— 关闭后触发】',
            '  d.addEventListener($1, (e: any) => {',
            '    console.log("returnValue:", e.target.returnValue);',
            '  });',
            '',
            '【cancel 事件 —— ESC 或 requestClose 触发（可阻止）】',
            '  d.addEventListener($1, (e: any) => {',
            '    if (hasUnsavedChanges) {',
            '      e.preventDefault();  // 阻止 ESC 关闭，提示用户保存',
            '    }',
            '  });',
            '',
            '【showModal 的特性】',
            '  - top-layer 渲染：脱离文档流，无视 z-index 覆盖一切',
            '  - 焦点陷阱：Tab 仅在 dialog 内循环',
            '  - aria-modal="true"：屏幕阅读器识别',
            '  - inert 其他内容：背景元素不可交互（自动）',
            '  - ESC 关闭：触发 cancel 事件',
            '',
            '【配合 @starting-style 实现打开过渡】',
            '  dialog[open] {',
            '    opacity: 1; transform: scale(1);',
            '    transition: opacity 0.2s, transform 0.2s, overlay 0.2s allow-discrete;',
            '  }',
            '  @starting-style {',
            '    dialog[open] { opacity: 0; transform: scale(0.95); }',
            '  }',
            '  /* overlay allow-discrete 让 display: overlay 也能过渡 */',
            '',
            `CSS.supports('selector(:modal)') = ${f.modal}`,
            `CSS.supports('selector(dialog::backdrop)') = ${f.backdrop}`,
            '',
            '===== 状态（截至 2025）=====',
            '  <dialog> Chrome 37+/Firefox 98+/Safari 15.4+',
            '  :modal Chrome 111+/Edge 111+/Firefox 124+/Safari 17.4+',
            '  规范来源：https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element',
        ].join('\n');
        this.setState({ dialogInfo: info });
        this._addLog('html', `<dialog> 演示完成；:modal=${f.modal}, ::backdrop=${f.backdrop}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. <dialog> + :modal + ::backdrop 深潜',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['<dialog>', f.dialog], [':modal', f.modal], ['::backdrop', f.backdrop]]), h(Tag, { color: 'primary' }, '原生模态')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '<dialog> 原生模态/非模态对话框：show() 非模态、showModal() 模态（top-layer + 焦点陷阱 + ESC 关闭 + ::backdrop 遮罩）、open 属性声明式。:modal 伪类（Chrome 111+）区分模态/非模态样式。form method="dialog" 表单提交关闭对话框并把按钮 value 设为 returnValue。cancel 事件可阻止 ESC 关闭（有未保存内容时提示）。配合 @starting-style + overlay allow-discrete 实现打开/关闭过渡动画。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 <dialog> 演示', { type: 'primary', size: 'sm', onClick: () => this._runDialogDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '560px', overflow: 'auto' } }, h('code', {}, s.dialogInfo || '（点击按钮查看 <dialog>/:modal 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：::target-text + 文本片段 =====================
    _runTargetTextDemo() {
        const f = this._flags();
        const info = [
            '===== ::target-text + 滚动到文本片段 =====',
            '',
            '【动机】传统 URL 锚点只能定位到元素（#section），',
            '        无法定位到「元素内的某段文字」',
            '',
            '【文本片段（Text Fragment）语法】',
            '  URL: https://example.com/page#:~:text=<prefix>-><textStart>-<textEnd><suffix>',
            '',
            '  语法组成：',
            '    #:~:text=开头-结尾              - 选中从「开头」到「结尾」的文本',
            '    #:~:text=关键词                  - 选中第一个「关键词」',
            '    #:~:text=前-,关键词              - prefix 过滤，仅匹配前缀后的「关键词」',
            '    #:~:text=关键词,-后缀            - suffix 过滤，仅匹配后缀前的「关键词」',
            '',
            '【示例】',
            '  https://example.com/article#:~:text=CSS%20Anchor%20Positioning',
            '  → 页面加载后自动滚动到「CSS Anchor Positioning」并高亮',
            '',
            '  https://example.com/article#:~:text=第一章-,关键概念',
            '  → 在「第一章」之后查找「关键概念」并高亮',
            '',
            '【::target-text 伪元素 —— 选中高亮的文本片段】',
            '  ::target-text {',
            '    background-color: #fef08a;        /* 默认黄色高亮 */',
            '    color: #1e293b;',
            '    text-decoration: underline;',
            '    text-decoration-color: #f59e0b;',
            '    text-decoration-thickness: 2px;',
            '  }',
            '',
            '  /* 自定义动画高亮 */',
            '  ::target-text {',
            '    animation: target-flash 2s ease-out;',
            '  }',
            '  @keyframes target-flash {',
            '    0%   { background-color: #fbbf24; }',
            '    100% { background-color: transparent; }',
            '  }',
            '',
            '【浏览器行为】',
            '  - 加载带 #:~:text= 的 URL 时自动滚动到匹配文本',
            '  - 高亮匹配文本（::target-text 样式）',
            '  - 滚动是平滑的（受 scroll-behavior 影响）',
            '  - 文本匹配忽略大小写、规范 Unicode',
            '',
            '【生成文本片段链接（JS）】',
            '  // 方式 1：FragmentDirective API（实验性）',
            '  const fragment = document.fragmentDirective.createTextFragment({',
            '    textStart: "关键概念",',
            '    textEnd: "总结",',
            '  });',
            '  const url = location.origin + location.pathname + "#" + fragment;',
            '',
            '  // 方式 2：手动拼接 URL（兼容性更好）',
            '  function makeTextFragment(text) {',
            '    return `${location.href}#:~:text=${encodeURIComponent(text)}`;',
            '  }',
            '',
            '【:target 伪类 —— 锚点目标元素】',
            '  https://example.com/page#section1',
            '  <section id="section1">...</section>',
            '  section:target {',
            '    background: #dbeafe;            /* 锚点目标高亮 */',
            '    animation: target-flash 1s;',
            '  }',
            '',
            '【:target-within 伪类 —— 包含锚点目标的祖先（提案）】',
            '  article:target-within {',
            '    border-left: 3px solid #3b82f6;  /* 祖先高亮 */',
            '  }',
            '  注意：:target-within 仍为提案，无浏览器实现',
            '',
            '【安全性】',
            '  - 文本片段需要用户手势触发（点击链接、书签）',
            '  - 跨源链接的 #:~:text= 默认被丢弃（需 allow-downgrade 或同源）',
            '  - 防止钓鱼：高亮文本不能伪造 UI 元素',
            '',
            `CSS.supports('selector(::target-text)') = ${f.targetText}`,
            `CSS.supports('selector(:target)') = ${f.target}`,
            `CSS.supports('selector(:target-within)') = ${f.targetWithin}`,
            '',
            '===== 状态（截至 2025）=====',
            '  ::target-text Chrome 89+/Edge 89+/Safari 17+/Firefox 暂未实现',
            '  :target 全浏览器支持',
            '  :target-within 提案阶段，无浏览器实现',
            '  规范来源：https://wicg.github.io/scroll-to-text-fragment/',
        ].join('\n');
        this.setState({ targetTextInfo: info });
        this._addLog('html', `::target-text 演示完成；supports=${f.targetText}`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. ::target-text + 滚动到文本片段（#:~:text=）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['::target-text', f.targetText], [':target', f.target], [':target-within', f.targetWithin]]), h(Tag, { color: 'primary' }, '深链接')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '文本片段（Text Fragment）让 URL 锚点定位到「元素内的某段文字」：#:~:text=关键词 自动滚动并高亮。::target-text 伪元素（Chrome 89+）控制高亮样式（默认黄色背景，可改色/加动画）。支持 prefix/suffix 过滤、textStart-textEnd 范围选择。FragmentDirective API（实验性）程序化生成链接。:target 反映锚点目标元素，:target-within（提案）反映包含目标的祖先。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 ::target-text 演示', { type: 'primary', size: 'sm', onClick: () => this._runTargetTextDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } }, h('code', {}, s.targetTextInfo || '（点击按钮查看 ::target-text 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：<permission> 元素 =====================
    _runPermissionDemo() {
        const f = this._flags();
        this._injectStyle('html-permission-demo', `
      .html-permission-demo permission {
        display: inline-flex;
        align-items: center;
        padding: 8px 16px;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        margin: 4px;
      }
      .html-permission-demo permission:hover {
        background: #2563eb;
      }
    `);
        const info = [
            '===== <permission> 元素 —— 声明式权限请求（实验性 2024-2025）=====',
            '',
            '【动机】传统权限请求需按钮 + Permissions API + try/catch：',
            '  button.addEventListener("click", async () => {',
            '    try {',
            '      const result = await navigator.permissions.request({ name: "geolocation" });',
            '      // 处理结果',
            '    } catch (e: any) {',
            '      // 用户拒绝或权限被禁',
            '    }',
            '  });',
            '  问题：需 JS 绑定、错误处理、UI 与逻辑耦合',
            '',
            '【新方案】<permission> 声明式权限按钮（实验性，仅 Chrome Canary）',
            '  <permission type="geolocation" />',
            '  <permission type="camera" />',
            '  <permission type="microphone" />',
            '  <permission type="notifications" />',
            '',
            '【type 属性支持的权限】',
            '  geolocation   - 地理位置',
            '  camera        - 摄像头',
            '  microphone    - 麦克风',
            '  notifications - 通知',
            '  persistent-storage - 持久存储',
            '  （未来扩展：screen-wake-lock / midi / bluetooth 等）',
            '',
            '【行为】',
            '  - 渲染为按钮（默认样式 + label 文字如「允许定位」）',
            '  - 点击触发浏览器原生权限对话框',
            '  - 自动反映当前权限状态（granted/denied/prompt）',
            '  - granted 时按钮文字变为「已允许」并禁用',
            '  - denied 时按钮文字变为「已拒绝」',
            '',
            '【样式控制】',
            '  permission {',
            '    display: inline-flex;',
            '    padding: 8px 16px;',
            '    background: #3b82f6;',
            '    color: #fff;',
            '    border-radius: 6px;',
            '    cursor: pointer;',
            '  }',
            '',
            '  /* 状态伪类反映权限状态 */',
            '  permission:state(granted) { background: #10b981; }    /* 已允许 */',
            '  permission:state(denied) { background: #ef4444; }      /* 已拒绝 */',
            '  permission:state(prompt) { background: #3b82f6; }      /* 待询问 */',
            '',
            '【事件】',
            '  permission.addEventListener($1, (e: any) => {',
            '    console.log("权限状态：", e.target.state);  // granted/denied',
            '  });',
            '  permission.addEventListener($1, (e: any) => {',
            '    console.log("用户关闭对话框未选择");',
            '  });',
            '',
            '【与 Permissions API 对比】',
            '  Permissions API（navigator.permissions）：',
            '    - query({ name }) 查询权限状态（不请求）',
            '    - request({ name }) 请求权限（实验性，多数浏览器仅 query 可用）',
            '    - revoke({ name }) 撤销权限（实验性）',
            '',
            '  <permission> 元素：',
            '    - 声明式 HTML 即完成 UI + 请求逻辑',
            '    - 浏览器自动管理按钮状态文字',
            '    - 无障碍语义完善（role="button"）',
            '    - 仍可监听事件获取状态变化',
            '',
            '【渐进增强】',
            '  <!-- 服务端渲染始终输出 -->',
            '  <permission type="geolocation" />',
            '  <!-- 旧浏览器作为未知元素，可 JS 检测后降级 -->',
            '  <script>',
            '    if (!("HTMLPermissionElement" in window)) {',
            '      // 降级到传统按钮 + navigator.permissions.request()',
            '    }',
            '  </script>',
            '',
            '【安全性】',
            '  - 必须用户手势触发（点击 <permission> 元素）',
            '  - 仅 https 或 localhost 可用',
            '  - 权限对话框由浏览器绘制，无法伪造',
            '  - 跨源 iframe 需 allow 属性配合',
            '',
            `DOM 检测 document.createElement("permission") = ${f.permission}`,
            '',
            '===== 状态（截至 2025）=====',
            '  实验性，仅 Chrome Canary behind flag',
            '  Firefox / Safari 暂未实现',
            '  规范来源：https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/PermissionElement/explainer.md',
        ].join('\n');
        this.setState({ permissionInfo: info });
        this._addLog('html', `<permission> 演示完成；supports=${f.permission}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. <permission> 元素 —— 声明式权限请求（实验性）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['<permission>', f.permission]]), h(Tag, { color: 'primary' }, '实验性')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '<permission> 是实验性声明式权限按钮：type 属性指定权限（geolocation/camera/microphone/notifications），浏览器自动渲染按钮、触发原生权限对话框、反映权限状态（granted/denied/prompt）。:state() 伪类响应状态切换样式。替代传统「按钮 + Permissions API + try/catch」的命令式方案。截至 2025 仅 Chrome Canary behind flag，需 JS 检测降级。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 <permission> 演示', { type: 'primary', size: 'sm', onClick: () => this._runPermissionDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } }, h('code', {}, s.permissionInfo || '（点击按钮查看 <permission> 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：状态伪类大集合 =====================
    _runStatePseudoDemo() {
        const f = this._flags();
        const info = [
            '===== 元素状态伪类大集合 =====',
            '',
            '【动机】现代 Web 元素有多种「交互状态」：模态、弹出、全屏、画中画、',
            '        锚点目标、自定义元素升级完成等。CSS 提供一系列伪类响应这些状态。',
            '',
            '【1. :modal —— 模态状态（Chrome 111+）】',
            '  匹配 showModal() 打开的 <dialog>，或 showModal() 打开的 popover',
            '  dialog:modal { box-shadow: 0 20px 40px rgba(0,0,0,0.15); }',
            '  区别：dialog:not(:modal) 是 show() 打开的非模态，无遮罩无焦点陷阱',
            '',
            '【2. :popover-open —— 弹出状态（Chrome 114+）】',
            '  匹配 popover="auto" 或 popover="manual" 且当前打开的元素',
            '  [popover]:popover-open { animation: popover-in 0.2s; }',
            '  popover 与 dialog 区别：popover 无遮罩（manual 模式无 light dismiss）',
            '',
            '【3. :fullscreen —— 全屏状态（Chrome 71+）】',
            '  匹配 requestFullscreen() 进入全屏的元素',
            '  video:fullscreen { width: 100vw; height: 100vh; }',
            '  :fullscreen .controls { display: flex; }   /* 全屏时显示控件 */',
            '  注意：:-webkit-full-screen 旧前缀仍需用于兼容 Safari < 16.4',
            '',
            '【4. :picture-in-picture —— 画中画状态（Chrome 121+）】',
            '  匹配处于画中画模式的 <video> 或 Document Picture-in-Picture 窗口内的元素',
            '  video:picture-in-picture { border: 2px solid #3b82f6; }',
            '  配合 requestPictureInPicture() 进入画中画',
            '',
            '【5. :target —— URL 锚点目标（全浏览器）】',
            '  匹配 id 等于 URL hash 的元素',
            '  https://example.com/page#section1',
            '  section:target { background: #dbeafe; }   /* 锚点目标高亮 */',
            '',
            '【6. :defined —— 自定义元素已升级（Chrome 51+）】',
            '  匹配已通过 customElements.define() 升级的自定义元素',
            '  my-element:not(:defined) {',
            '    display: block;',
            '    height: 100px;                  /* 升级前占位，避免布局抖动 */',
            '    background: #f1f5f9;',
            '  }',
            '  my-element:defined {',
            '    /* 升级后样式 */',
            '  }',
            '  应用：渐进增强，自定义元素加载前显示骨架屏占位',
            '',
            '【7. :state() —— 自定义元素内部状态（Chrome 129+）】',
            '  匹配 ElementInternals.ariaStates 设置的状态',
            '  class MyElement extends HTMLElement {',
            '    constructor() {',
            '      super();',
            '      this._internals = this.attachInternals();',
            '    }',
            '    set loading(v) {',
            '      this._internals.states.delete("loading");',
            '      if (v) this._internals.states.add("loading");',
            '    }',
            '  }',
            '  my-element:state(loading) {',
            '    background: #fef3c7;             /* loading 状态样式 */',
            '    cursor: wait;',
            '  }',
            '  my-element:state(loading)::before {',
            '    content: "加载中...";',
            '  }',
            '  优势：状态与样式解耦，无需操作 classList；状态可被屏幕阅读器读取',
            '',
            '【8. :state() 配合 :host —— Shadow DOM 内部状态样式】',
            '  class MyButton extends HTMLElement {',
            '    constructor() {',
            '      super();',
            '      this._internals = this.attachInternals();',
            '      const shadow = this.attachShadow({ mode: "open" });',
            '      shadow.innerHTML = `<style>',
            '        :host(:state(primary)) { background: #3b82f6; color: #fff; }',
            '        :host(:state(disabled)) { opacity: 0.5; pointer-events: none; }',
            '      </style>`;',
            '    }',
            '  }',
            '',
            '【统一状态伪类响应模式】',
            '  /* 任一交互状态激活时显示状态指示器 */',
            '  .indicator { display: none; }',
            '  :is(:modal, :popover-open, :fullscreen, :picture-in-picture) ~ .indicator {',
            '    display: block;',
            '  }',
            '',
            '【检测结果】',
            `  :modal            = ${f.modal}`,
            `  :popover-open     = ${f.popoverOpen}`,
            `  :fullscreen       = ${f.fullscreen}`,
            `  :picture-in-picture = ${f.pictureInPicture}`,
            `  :target           = ${f.target}`,
            `  :defined          = ${f.defined}`,
            `  :state()          = ${f.statePseudo}`,
            '',
            '===== 状态（截至 2025）=====',
            '  :modal Chrome 111+/Firefox 124+/Safari 17.4+',
            '  :popover-open Chrome 114+/Edge 114+/Firefox 暂未实现',
            '  :fullscreen Chrome 71+/Firefox 71+/Safari 16.4+（无前缀）',
            '  :picture-in-picture Chrome 121+',
            '  :defined Chrome 51+/Firefox 63+/Safari 10+',
            '  :state() Chrome 129+',
        ].join('\n');
        this.setState({ statePseudoInfo: info });
        this._addLog('html', `状态伪类演示完成；modal=${f.modal}, popover-open=${f.popoverOpen}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 元素状态伪类大集合（:modal / :popover-open / :fullscreen / :picture-in-picture / :target / :defined / :state()）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                [':modal', f.modal],
                [':popover-open', f.popoverOpen],
                [':fullscreen', f.fullscreen],
                [':defined', f.defined],
                [':state()', f.statePseudo],
            ]), h(Tag, { color: 'primary' }, '状态响应')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '统一反映元素「交互状态」的伪类：:modal（showModal 打开的 dialog/popover）、:popover-open（打开的 popover）、:fullscreen（requestFullscreen 全屏）、:picture-in-picture（画中画）、:target（URL 锚点目标）、:defined（自定义元素升级完成，配合 :not() 做加载前占位）、:state()（自定义元素 ElementInternals.states 内部状态，与样式解耦）。可用 :is() 组合多状态响应。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行状态伪类演示', { type: 'primary', size: 'sm', onClick: () => this._runStatePseudoDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.statePseudoInfo || '（点击按钮查看状态伪类完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // —— 日志面板 ——
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return null;
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, '现代 HTML 交互/语义元素深潜'),
            h(Alert, {
                type: 'info',
                message: 'HTML Modern Interactive Elements —— 原生交互元素 + 专属 CSS 伪元素',
                description: '演示常被忽视的现代 HTML 元素与配套 CSS 伪元素/伪类：<details>/<summary> + ::details-content（Chrome 129+）+ name 属性互斥手风琴 + toggle 事件、<search>（2024）landmark 语义、<dialog> + :modal（Chrome 111+）+ ::backdrop + form method="dialog" + cancel 事件、::target-text + 文本片段（#:~:text=）深链接高亮、<permission>（实验性）声明式权限按钮、元素状态伪类大集合（:modal/:popover-open/:fullscreen/:picture-in-picture/:target/:defined/:state()）。用 CSS.supports() + DOM 构造器检测能力，jsdom 不做真实渲染但流程完整。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=HTMLModernInteractiveElementsPage.js.map