// =====================================================================
// CSSTableLayoutDeepPage.js —— CSS Table Layout 表格布局完整体系 深度实验室
// 完整覆盖 CSS Table Module Level 3 / CSS2.1 §17 表格布局全家桶：
//   1. 匿名表格盒模型 —— display: table/table-row-group/table-row/table-cell/
//      table-column/table-column-group/table-caption 自动补全规则 + 匿名盒生成
//   2. table-layout 算法 —— auto vs fixed 列宽算法对比 + 首次渲染 vs 二次布局
//   3. border-collapse —— collapse vs separate + border-spacing + empty-cells + 双边合并规则
//   4. caption-side 与 vertical-align —— caption 位置 + 单元格 vertical-align 上下文
//   5. colgroup 与列控制 —— <colgroup>/<col> 列级样式 + span + 列宽优先级链
//   6. 表格语义与可访问性 —— thead/tbody/tfoot/th/td + scope/colspan/rowspan + ARIA
//   7. sticky 表头与首列 —— position:sticky + overflow 容器陷阱 + border-collapse 边框 hack
//   8. 打印分页与陷阱 —— break-inside/break-before + widows/orphans + width:100% 收缩
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；表格属性是 CSS2.1 老特性，jsdom 与浏览器普遍支持。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSTableLayoutDeepPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    _tableLayoutMode = '';
    _collapseMode = '';
    _emptyCells = '';
    _captionSide = '';
    _valignMode = '';
    _stickyOn = false;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：匿名表格盒模型
            anonymousBoxesInfo: '',
            // Card 2：table-layout 算法
            tableLayoutInfo: '',
            // Card 3：border-collapse / border-spacing / empty-cells
            borderCollapseInfo: '',
            // Card 4：caption-side 与 vertical-align
            captionValignInfo: '',
            // Card 5：colgroup 与列控制
            colgroupInfo: '',
            // Card 6：表格语义与可访问性
            semanticsA11yInfo: '',
            // Card 7：sticky 表头与首列
            stickyHeaderInfo: '',
            // Card 8：打印分页与陷阱
            printTrapsInfo: '',
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._dynamicStyles = []; // 动态创建并插入 head 的 <style> 元素列表
        this._tableLayoutMode = 'auto'; // Card 2 当前 table-layout 值
        this._collapseMode = 'separate'; // Card 3 当前 border-collapse 值
        this._emptyCells = 'show'; // Card 3 当前 empty-cells 值
        this._captionSide = 'top'; // Card 4 当前 caption-side 值
        this._valignMode = 'middle'; // Card 4 当前 vertical-align 值
        this._stickyOn = false; // Card 7 sticky 表头是否开启
        // 一次性能力检测：CSS Table Module 全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
            `display:table ${c(f.displayTable)}`, `display:table-cell ${c(f.displayTableCell)}`,
            `table-layout ${c(f.tableLayout)}`, `border-collapse ${c(f.borderCollapse)}`,
            `border-spacing ${c(f.borderSpacing)}`, `caption-side ${c(f.captionSide)}`,
            `empty-cells ${c(f.emptyCells)}`, `vertical-align ${c(f.verticalAlign)}`,
            `position:sticky ${c(f.positionSticky)}`,
            `break-inside:avoid ${c(f.breakInside)}`, `break-before:page ${c(f.breakBefore)}`,
            `widows ${c(f.widows)}`, `orphans ${c(f.orphans)}`,
        ];
        const summary = f.css
            ? `CSS Table Layout 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；表格属性是 CSS2.1 §17 老特性，主流浏览器与 jsdom 普遍支持。caption-side:inline-start|inline-end、break-* 等较新值部分浏览器仍实验性，按钮将仅记日志说明。在真实浏览器中打开可完整演示。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.captionSide)
            this._addLog('warn', 'caption-side:inline-start|inline-end 不可用或 jsdom 未识别（CSS Logical Properties 写法，新浏览器支持）');
        if (!f.breakInside)
            this._addLog('warn', 'break-inside:avoid 不可用或 jsdom 未识别（旧名 page-break-inside:avoid 兼容性更好）');
        if (!f.positionSticky)
            this._addLog('warn', 'position:sticky 不可用或 jsdom 未识别（Chrome 56+/Firefox 32+/Safari 13+ 全面支持）');
        // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
        this._injectDemoStyles();
    }
    componentWillUnmount() {
        // 移除动态创建的 <style> 元素，便于 GC
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    // —— 日志 / 按钮辅助 ——
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
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
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
        return {
            css: hasCSS,
            supports: hasCSS && typeof CSS.supports === 'function',
            // Card 1：匿名表格盒模型
            displayTable: supportsPV('display', 'table'),
            displayTableCell: supportsPV('display', 'table-cell'),
            displayTableRow: supportsPV('display', 'table-row'),
            displayTableCaption: supportsPV('display', 'table-caption'),
            displayTableColumn: supportsPV('display', 'table-column'),
            // Card 2：table-layout
            tableLayout: supportsPV('table-layout', 'fixed'),
            // Card 3：border-collapse / border-spacing / empty-cells
            borderCollapse: supportsPV('border-collapse', 'collapse'),
            borderSpacing: supportsPV('border-spacing', '0'),
            emptyCells: supportsPV('empty-cells', 'hide'),
            // Card 4：caption-side / vertical-align
            captionSide: supportsPV('caption-side', 'inline-start'),
            captionSideTop: supportsPV('caption-side', 'top'),
            verticalAlign: supportsPV('vertical-align', 'middle'),
            // Card 5：col 列样式（仅 background / border / width / visibility 可生效）
            // 无独立 CSS 属性，沿用 display:table-column 检测
            // Card 6：原生表格语义（无独立 CSS 属性，沿用 display:table）
            // Card 7：position:sticky
            positionSticky: supportsPV('position', 'sticky'),
            // Card 8：打印分页
            breakInside: supportsPV('break-inside', 'avoid'),
            breakBefore: supportsPV('break-before', 'page'),
            widows: supportsPV('widows', '2'),
            orphans: supportsPV('orphans', '2'),
        };
    }
    // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
    _injectStyle(id, textContent) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = textContent;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
        return style;
    }
    // —— 动态注入所有演示样式 ——
    _injectDemoStyles() {
        this._injectStyle('css-table-base', `
      /* ===== 公共表格演示样式 ===== */
      .tbl-demo { margin-top: 10px; padding: 12px; background: #f8fafc;
        border: 1px solid #cbd5e1; border-radius: 8px; }
      .tbl-stage { margin-top: 8px; overflow: auto; max-height: 280px;
        border: 1px dashed #94a3b8; border-radius: 6px; }
      table.tbl { border-collapse: separate; border-spacing: 0; width: 100%;
        font-size: 13px; }
      table.tbl th, table.tbl td { padding: 6px 10px; border: 1px solid #cbd5e1; }
      table.tbl thead th { background: #1e3a8a; color: #fff; position: sticky; top: 0; z-index: 2; }
      table.tbl tbody th { background: #e0e7ff; text-align: left; position: sticky; left: 0; z-index: 1; }
      table.tbl tbody td { background: #fff; }
      table.tbl tbody tr:nth-child(even) td { background: #f1f5f9; }
      table.tbl caption { caption-side: top; padding: 6px; font-weight: 600; color: #1e3a8a; }
      /* Card 2 table-layout */
      .tl-auto { table-layout: auto; }
      .tl-fixed { table-layout: fixed; }
      .tl-col-w { width: 200px; }       /* fixed 模式下首行/col 锁定列宽 */
      /* Card 3 border-collapse */
      .bc-separate { border-collapse: separate; border-spacing: 4px 2px; empty-cells: show; }
      .bc-collapse { border-collapse: collapse; }
      .bc-hide-empty { empty-cells: hide; }
      /* Card 4 caption-side / vertical-align */
      .cap-top { caption-side: top; }
      .cap-bottom { caption-side: bottom; }
      .cap-is { caption-side: inline-start; }
      .cap-ie { caption-side: inline-end; }
      .va-cell td { vertical-align: middle; height: 48px; }
      .va-top td { vertical-align: top; }
      .va-bot td { vertical-align: bottom; }
      /* Card 7 sticky */
      .sticky-on thead th { position: sticky; top: 0; z-index: 3;
        background: #1e3a8a; color: #fff; }
      .sticky-on tbody th { position: sticky; left: 0; z-index: 2;
        background: #e0e7ff; }
      .sticky-on thead th:first-child { z-index: 4; } /* 左上角交叉格最高 */
      /* collapse 模式下 sticky 边框 hack：用 box-shadow 模拟边框 */
      .sticky-collapse.sticky-on thead th { box-shadow: inset 0 -1px 0 #1e3a8a, 0 1px 0 #cbd5e1; }
      /* Card 8 打印分页（仅 @media print 生效，屏幕不可见） */
      @media print {
        .print-avoid { break-inside: avoid; page-break-inside: avoid; }
        .print-page { break-before: page; page-break-before: always; }
        table.tbl { width: auto; }   /* 避免 width:100% 触发列宽收缩 */
      }
      /* Card 6 语义 */
      .sem-th { background: #1e3a8a; color: #fff; }
      .sem-th[scope="col"] { text-align: center; }
      .sem-th[scope="row"] { text-align: left; }
    `);
    }
    // =================== Card 1：匿名表格盒模型 ===================
    _runAnonymousBoxesDemo() {
        const f = this._flags();
        this._injectStyle('css-table-anon-demo', `
      .anon-stage { margin-top: 8px; }
      .anon-table { display: table; width: 100%; border-collapse: collapse; }
      .anon-row { display: table-row; }
      .anon-cell { display: table-cell; padding: 6px 10px; border: 1px solid #cbd5e1; }
      .anon-cell--hl { background: #fef3c7; }
      /* 仅 cell，缺 table/row → 浏览器自动生成匿名 table + row 包裹 */
      .anon-bare-cell { display: table-cell; padding: 6px 10px; border: 1px solid #3b82f6;
        background: #dbeafe; }
    `);
        const info = [
            '===== CSS Table 匿名表格盒模型 =====',
            '',
            '【display: table-* 一族】',
            '  display: table                // 类似 <table>，块级表格容器',
            '  display: inline-table         // 行内级表格（外部 inline，内部 table）',
            '  display: table-row-group      // 类似 <tbody>',
            '  display: table-header-group   // 类似 <thead>（始终渲染在最上方）',
            '  display: table-footer-group   // 类似 <tfoot>（始终渲染在最下方）',
            '  display: table-row            // 类似 <tr>',
            '  display: table-cell           // 类似 <td>/<th>',
            '  display: table-column         // 类似 <col>（无内容，仅承载列样式）',
            '  display: table-column-group   // 类似 <colgroup>',
            '  display: table-caption        // 类似 <caption>',
            '',
            '【匿名盒自动生成规则（CSS2.1 §17.2.1）】',
            '  表格模型要求严格的层级：table > row-group > row > cell。',
            '  若 DOM 层级缺失，浏览器会自动插入「匿名盒」补全：',
            '',
            '  1. table-cell 的父不是 table-row → 自动包匿名 table-row',
            '     <div style="display:table-cell">A</div>',
            '       渲染为：anonymous-table > anonymous-row > cell',
            '  2. table-row 的父不是 table/row-group → 自动包匿名 table',
            '     <div style="display:table-row">…</div>',
            '       渲染为：anonymous-table > row',
            '  3. table-cell 的直系祖先既不是 row 也不是 table → 自动包 row + table',
            '  4. table-row-group 的父不是 table → 自动包匿名 table',
            '',
            '  ★ 匿名盒无法用 CSS 选择器命中，也无法用 JS 直接获取',
            '  ★ 匿名盒不产生 box-decoration-break、不参与继承链定制',
            '',
            '【列级 display：table-column / table-column-group】',
            '  <col>、<colgroup> 默认 display: table-column / table-column-group',
            '  这两类盒「不渲染内容」，仅承载列级样式：',
            '    - border（仅 collapse 模式生效）',
            '    - background',
            '    - width（设定列宽）',
            '    - visibility: collapse（隐藏整列）',
            '  其他属性（color / font / padding）对列无效——需设在 cell 上',
            '',
            '【实战：用 div 模拟表格】',
            '  .div-table { display: table; width: 100%; border-collapse: collapse; }',
            '  .div-row   { display: table-row; }',
            '  .div-cell  { display: table-cell; padding: 8px; border: 1px solid #ccc; }',
            '',
            '  <div class="div-table">',
            '    <div class="div-row">',
            '      <div class="div-cell">A</div>',
            '      <div class="div-cell">B</div>',
            '    </div>',
            '  </div>',
            '',
            '  ★ 这就是「CSS 表格布局」的核心：不一定用 <table> 标签，',
            '    任何 display:table-* 的元素都走表格布局算法',
            '',
            '【table-header-group / table-footer-group 的强制位置】',
            '  thead (table-header-group) 无论 DOM 顺序如何，总是渲染在表格顶部',
            '  tfoot (table-footer-group) 总是渲染在表格底部',
            '  这是 HTML5 之前的规则；HTML5 允许 tfoot 在 tbody 之后，但渲染顺序不变',
            '',
            '【浏览器支持】',
            `  display: table: ${f.displayTable ? '✓' : '✗'} (CSS2.1 老特性，全主流浏览器支持)`,
            `  display: table-cell: ${f.displayTableCell ? '✓' : '✗'}`,
            `  display: table-column: ${f.displayTableColumn ? '✓' : '✗'}`,
            '',
            '===== 状态（截至 2025）=====',
            '  CSS Table Module Level 3 仍为草案，但 CSS2.1 §17 表格模型已被全浏览器实现 20+ 年',
            '  规范：https://www.w3.org/TR/css-tables-3/',
        ].join('\n');
        this.setState({ anonymousBoxesInfo: info });
        this._addLog('css', `匿名表格盒模型演示完成；display:table=${f.displayTable}/table-cell=${f.displayTableCell}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 匿名表格盒模型 —— display:table-* 自动补全 + 匿名盒生成',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['display:table', f.displayTable],
                ['table-cell', f.displayTableCell],
                ['table-column', f.displayTableColumn],
            ]), h(Tag, { color: 'primary' }, 'CSS2.1 §17.2')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '表格布局不限于 <table> 标签：display: table / table-row / table-cell / table-column / table-column-group / table-caption / table-header-group / table-footer-group 任意元素都可参与表格布局。若 DOM 层级缺失，浏览器按 CSS2.1 §17.2.1 自动生成「匿名盒」补全（如孤立的 table-cell 会被自动包上匿名 table-row + 匿名 table）。匿名盒无法用 CSS/JS 命中。table-column / table-column-group 仅承载 border/background/width/visibility，不渲染内容。'),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, '用 div 模拟表格（display: table-*）：'), h('div', { class: 'anon-stage' }, h('div', { class: 'anon-table' }, h('div', { class: 'anon-row' }, h('div', { class: 'anon-cell anon-cell--hl' }, 'A'), h('div', { class: 'anon-cell' }, 'B'), h('div', { class: 'anon-cell' }, 'C')))), h('div', { class: 'fs-sm text-secondary mt-sm' }, '孤立的 table-cell（缺 table/row → 自动包匿名盒）：'), h('div', { class: 'anon-bare-cell' }, '我是裸 cell，浏览器自动包了匿名 row + table')),
                h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' }, this._btn('运行匿名盒演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runAnonymousBoxesDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } }, h('code', {}, s.anonymousBoxesInfo || '（点击按钮查看 display:table-* 全家桶 + 匿名盒生成规则）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：table-layout 算法 ===================
    _runTableLayoutDemo() {
        const f = this._flags();
        const info = [
            '===== table-layout: auto vs fixed —— 列宽算法对比 =====',
            '',
            '【table-layout 取值】',
            '  table-layout: auto;     // 默认：自动算法，扫描全部内容定列宽',
            '  table-layout: fixed;    // 固定算法：仅看首行（或 col/colgroup 宽度）定列宽',
            '',
            '【auto 算法（默认）—— 二次布局】',
            '  步骤：',
            '    1. 第一次扫描：读取所有单元格内容，计算每列 min-content / max-content',
            '    2. 第二次扫描：按内容比例分配可用宽度，得出最终列宽',
            '    3. 渲染时再根据内容溢出做微调',
            '',
            '  特点：',
            '    + 列宽自动适应内容（长内容列更宽）',
            '    - 必须等所有单元格内容加载完才能定列宽 → 首屏渲染慢',
            '    - 大表格性能差（O(n) 扫描所有单元格）',
            '    - 单元格内容变化会触发整表 reflow',
            '',
            '【fixed 算法 —— 首次布局】',
            '  步骤：',
            '    1. 仅看表格首行（thead 第一行 或 第一个 tr）的 cell 宽度',
            '         优先级：cell width > col width > 平均分配',
            '    2. 列宽一旦确定，后续行的内容不再影响列宽',
            '    3. 内容超出列宽 → overflow / 换行 / 裁剪（不影响列宽）',
            '',
            '  特点：',
            '    + 首屏渲染快（无需扫描全部内容）',
            '    + 性能稳定（大表格 O(1) 列宽）',
            '    + 列宽可预测（不随后续内容变化）',
            '    - 列宽可能不适应内容（需手动设 width）',
            '',
            '【关键：fixed 必须配合 width】',
            '  table {',
            '    table-layout: fixed;',
            '    width: 100%;            // ★ 必须设 width，否则 fixed 退化为 auto',
            '  }',
            '  th.col-name { width: 200px; }   // 首行设定列宽，后续行无视',
            '',
            '【列宽优先级链（fixed 模式）】',
            '  1. <col> 的 width（最高，规范优先）',
            '  2. 首行 <th>/<td> 的 width',
            '  3. 无 width 时：剩余空间均分',
            '  ★ 优先级细节各浏览器实现略有差异，<col> 是最可靠的列宽设定方式',
            '',
            '【auto vs fixed 性能对比】',
            '  1000 行 × 10 列表格首屏渲染：',
            '    auto:  ~300ms（扫描 10000 个单元格）',
            '    fixed: ~30ms （仅扫描首行 10 个单元格）',
            '  ★ 大数据表格务必用 fixed + width:100%',
            '',
            '【实战：固定列宽表格】',
            '  <style>',
            '    table.data {',
            '      table-layout: fixed;',
            '      width: 100%;',
            '      border-collapse: collapse;',
            '    }',
            '    table.data th, table.data td {',
            '      padding: 6px 8px;',
            '      border: 1px solid #ccc;',
            '      overflow: hidden;        /* 超出隐藏 */',
            '      text-overflow: ellipsis; /* 省略号 */',
            '      white-space: nowrap;     /* 不换行 */',
            '    }',
            '    table.data .col-id { width: 60px; }',
            '    table.data .col-name { width: 200px; }',
            '    table.data .col-desc { width: auto; }   /* 剩余空间 */',
            '  </style>',
            '',
            '【实战：长内容截断 + tooltip】',
            '  table.data td.truncate {',
            '    max-width: 200px;          /* 配合 table-layout:fixed */',
            '    overflow: hidden;',
            '    text-overflow: ellipsis;',
            '    white-space: nowrap;',
            '    cursor: help;',
            '  }',
            '  /* title 属性提供完整内容 hover 提示 */',
            '',
            '【auto 适用场景】',
            '  - 内容长度未知、希望自动适应的小表格',
            '  - 富文本单元格（内容差异大，手动设宽反而不便）',
            '',
            '【fixed 适用场景】',
            '  - 大数据表格（性能优先）',
            '  - 需要可预测列宽（打印 / 导出）',
            '  - 配合 text-overflow: ellipsis 做长文本截断',
            '',
            '【浏览器支持】',
            `  table-layout: fixed: ${f.tableLayout ? '✓' : '✗'} (CSS2.1 老特性，全主流浏览器支持)`,
            '',
            '===== 状态（截至 2025）=====',
            '  全主流浏览器支持，无兼容性问题',
            '  规范：https://www.w3.org/TR/css-tables-3/#used-width-of-table',
        ].join('\n');
        this.setState({ tableLayoutInfo: info });
        this._addLog('css', `table-layout 演示完成；当前=${this._tableLayoutMode}，fixed 支持=${f.tableLayout}`);
    }
    _setTableLayout(mode) {
        this._tableLayoutMode = mode;
        this._injectStyle('css-table-layout-mode', `
      .tl-switch { table-layout: ${mode}; width: 100%; border-collapse: collapse; }
      .tl-switch th, .tl-switch td { padding: 6px 10px; border: 1px solid #cbd5e1; }
      .tl-switch .col-w { width: 120px; }   /* fixed 下锁定，auto 下仅作提示 */
      .tl-switch .col-long { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `);
        this.setState({ tableLayoutInfo: this.state.tableLayoutInfo }); // 触发 rerender 以更新演示表
        this._addLog('layout', `切换 table-layout → ${mode}（${mode === 'fixed' ? '首行锁定列宽，性能优' : '扫描全部内容定列宽'}）`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. table-layout 算法 —— auto vs fixed 列宽与性能',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['table-layout', f.tableLayout]]), h(Tag, { color: 'primary' }, 'auto / fixed')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'table-layout: auto（默认）扫描全部单元格内容二次计算列宽，适应内容但首屏慢、大表格性能差；table-layout: fixed 仅看首行（或 <col>）宽度一次锁定列宽，性能稳定（1000 行表格约 10 倍速）但需配合 width:100% 与手动设列宽。fixed 下长内容可用 overflow:hidden + text-overflow:ellipsis 截断。大数据表格务必用 fixed。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行算法演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runTableLayoutDemo() }), this._btn('auto', { size: 'sm', disabled: !f.tableLayout, onClick: () => this._setTableLayout('auto') }), this._btn('fixed', { size: 'sm', disabled: !f.tableLayout, onClick: () => this._setTableLayout('fixed') })),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, `当前 table-layout: ${this._tableLayoutMode}（fixed 模式下 .col-w 锁定 120px，长内容自动截断）`), h('table', { class: 'tl-switch' }, h('thead', {}, h('tr', {}, h('th', { class: 'col-w' }, 'ID'), h('th', {}, '名称'), h('th', { class: 'col-long' }, '描述（长内容，fixed 下截断）'))), h('tbody', {}, h('tr', {}, h('td', {}, '1'), h('td', {}, 'CSS 表格布局'), h('td', {}, '这是非常非常非常长的描述文字，用来演示 table-layout: fixed 配合 overflow:hidden + text-overflow:ellipsis 的截断效果')), h('tr', {}, h('td', {}, '2'), h('td', {}, '匿名盒模型'), h('td', {}, '另一个长内容：display: table-cell 的孤立元素会被浏览器自动包裹匿名 table-row 和 table 层级'))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '420px', overflow: 'auto' } }, h('code', {}, s.tableLayoutInfo || '（点击「运行算法演示」查看 auto vs fixed 完整对比）')),
                h(Alert, {
                    type: 'info',
                    message: 'fixed 必须配合 width:100%，否则退化为 auto',
                    description: 'fixed 模式下，列宽优先级：<col> width > 首行 <th>/<td> width > 均分。配合 overflow:hidden + text-overflow:ellipsis + white-space:nowrap 可实现长内容截断。auto 适合内容自适应的小表格，fixed 适合大数据表格与可预测列宽场景。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：border-collapse / border-spacing / empty-cells ===================
    _runBorderCollapseDemo() {
        const f = this._flags();
        const info = [
            '===== border-collapse / border-spacing / empty-cells =====',
            '',
            '【border-collapse 取值】',
            '  border-collapse: separate;  // 默认：单元格独立，各自有边框，间距由 border-spacing 决定',
            '  border-collapse: collapse;  // 相邻单元格边框合并为一条',
            '',
            '【separate 模式（默认）】',
            '  table {',
            '    border-collapse: separate;',
            '    border-spacing: 4px 2px;   // 水平间距 垂直间距（一个值则横竖相同）',
            '    empty-cells: show;         // 默认：显示空单元格的边框',
            '  }',
            '  table { empty-cells: hide; } // 隐藏空单元格边框（仅 separate 模式有效）',
            '',
            '  ★ border-spacing 不支持 calc()，但支持单值或双值',
            '  ★ empty-cells 在 collapse 模式下被忽略（边框总会显示）',
            '',
            '【collapse 模式 —— 双边合并规则（CSS2.1 §17.6.2.1）】',
            '  当两个单元格共享一条边时，浏览器按以下优先级选一条边渲染：',
            '    1. border-style 为 hidden 的边胜出（强制无边框）',
            '    2. border-style 为 none 的边最弱（被任何有样式的边覆盖）',
            '    3. 其余按「border-width 大的胜出」',
            '    4. 同宽度时按优先级：double > solid > dashed > dotted > ridge > outset > groove > inset',
            '    5. 同样式同宽度时按来源：cell > row > row-group > column > column-group > table',
            '',
            '  ★ 这意味着在 collapse 模式下，cell 边框优先于 table 边框',
            '  ★ <th> 设 2px solid，<td> 设 1px solid → 共享边渲染为 2px solid',
            '',
            '【collapse vs separate 视觉差异】',
            '  separate: 每个单元格独立边框 + 间隙 → 像网格',
            '    ┌───┐ ┌───┐',
            '    │ A │ │ B │   ← 两个 1px 边框 + 4px 间距',
            '    └───┘ └───┘',
            '  collapse: 相邻边合并为一条 → 紧凑单线',
            '    ┌───┬───┐',
            '    │ A │ B │   ← 共享 1px 边框',
            '    └───┴───┘',
            '',
            '【实战：单线紧凑表格】',
            '  table {',
            '    border-collapse: collapse;',
            '    width: 100%;',
            '  }',
            '  th, td {',
            '    border: 1px solid #cbd5e1;',
            '    padding: 6px 10px;',
            '  }',
            '  th { border-bottom: 2px solid #1e3a8a; }  /* 表头加粗底线 */',
            '',
            '【实战：网格风格表格（separate + border-spacing）】',
            '  table {',
            '    border-collapse: separate;',
            '    border-spacing: 4px;        /* 单元格间 4px 间隙 */',
            '    background: #e2e8f0;        /* 间隙背景色 */',
            '  }',
            '  td { background: #fff; border-radius: 4px; }',
            '',
            '【实战：空单元格隐藏（仅 separate）】',
            '  table {',
            '    border-collapse: separate;',
            '    empty-cells: hide;          // 缺失数据的单元格不显示边框',
            '  }',
            '',
            '【collapse 下的特殊行为】',
            '  1. border-spacing 无效（被忽略）',
            '  2. empty-cells 无效（边框总会显示）',
            '  3. 单元格 padding 仍生效',
            '  4. border-radius 不生效（边框合并后无法独立圆角）',
            '     ★ 需要 rounded 表格请用 separate 或在 cell 上单独设',
            '  5. position: sticky 边框会「消失」（见 Card 7）',
            '',
            '【浏览器支持】',
            `  border-collapse: collapse: ${f.borderCollapse ? '✓' : '✗'}`,
            `  border-spacing: ${f.borderSpacing ? '✓' : '✗'}`,
            `  empty-cells: hide: ${f.emptyCells ? '✓' : '✗'}`,
            '  均为 CSS2.1 老特性，全主流浏览器支持',
        ].join('\n');
        this.setState({ borderCollapseInfo: info });
        this._addLog('css', `border-collapse 演示完成；当前=${this._collapseMode}，empty-cells=${this._emptyCells}`);
    }
    _setCollapse(mode) {
        this._collapseMode = mode;
        this._injectStyle('css-table-collapse-mode', `
      .bc-switch { border-collapse: ${mode}; ${mode === 'separate' ? 'border-spacing: 4px 2px;' : ''} width: 100%; }
      .bc-switch th, .bc-switch td { padding: 6px 10px; border: 1px solid #cbd5e1; }
      .bc-switch th { border-bottom: 2px solid #1e3a8a; background: #e0e7ff; }
      .bc-switch .empty { /* 空单元格 */ }
    `);
        this._addLog('collapse', `切换 border-collapse → ${mode}（${mode === 'collapse' ? '相邻边合并为一条' : '单元格独立边框 + border-spacing'}）`);
    }
    _setEmptyCells(val) {
        this._emptyCells = val;
        this._injectStyle('css-table-empty-cells', `
      .bc-switch { empty-cells: ${val}; }
    `);
        this._addLog('empty', `切换 empty-cells → ${val}（仅 separate 模式生效；${val === 'hide' ? '空单元格不显示边框' : '显示空单元格边框'}）`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. border-collapse / border-spacing / empty-cells',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['border-collapse', f.borderCollapse],
                ['border-spacing', f.borderSpacing],
                ['empty-cells', f.emptyCells],
            ]), h(Tag, { color: 'primary' }, 'collapse / separate')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'border-collapse: separate（默认）单元格独立边框 + border-spacing 间距 + empty-cells 控制空单元格；collapse 相邻边按 CSS2.1 §17.6.2.1 优先级合并（hidden > none > width 大 > 样式强 > cell>row>table）。collapse 下 border-spacing/empty-cells/border-radius 失效，且 position:sticky 边框会消失（见 Card 7）。collapse 适合单线紧凑表格，separate 适合网格风格 + 圆角。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行边框演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runBorderCollapseDemo() }), this._btn('separate', { size: 'sm', disabled: !f.borderCollapse, onClick: () => this._setCollapse('separate') }), this._btn('collapse', { size: 'sm', disabled: !f.borderCollapse, onClick: () => this._setCollapse('collapse') }), this._btn(`empty-cells: ${this._emptyCells}`, { size: 'sm', disabled: !f.emptyCells, onClick: () => this._setEmptyCells(this._emptyCells === 'show' ? 'hide' : 'show') })),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, `当前 border-collapse: ${this._collapseMode}，empty-cells: ${this._emptyCells}（注意空单元格行为）`), h('table', { class: 'bc-switch' }, h('thead', {}, h('tr', {}, h('th', {}, '姓名'), h('th', {}, '年龄'), h('th', {}, '邮箱'))), h('tbody', {}, h('tr', {}, h('td', {}, '张三'), h('td', {}, '28'), h('td', {}, 'zhang@example.com')), h('tr', {}, h('td', {}, '李四'), h('td', { class: 'empty' }, ''), h('td', {}, 'li@example.com')), h('tr', {}, h('td', {}, '王五'), h('td', {}, '35'), h('td', { class: 'empty' }, ''))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '420px', overflow: 'auto' } }, h('code', {}, s.borderCollapseInfo || '（点击「运行边框演示」查看 collapse 边框合并规则 + separate 间距 + empty-cells）')),
                h(Alert, {
                    type: 'warning',
                    message: 'collapse 下 border-spacing / empty-cells / border-radius 失效',
                    description: 'collapse 模式相邻边合并为一条，cell 边框优先于 table 边框。需要圆角表格请用 separate 模式或在 cell 上单独设 border-radius。sticky 边框在 collapse 下会消失（Card 7 详解 hack）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：caption-side 与 vertical-align ===================
    _runCaptionValignDemo() {
        const f = this._flags();
        const info = [
            '===== caption-side 与 vertical-align =====',
            '',
            '【caption-side 取值】',
            '  caption-side: top;             // 默认：caption 在表格上方（CSS2.1）',
            '  caption-side: bottom;          // caption 在表格下方',
            '  caption-side: inline-start;    // 行首方向（CSS Logical，新浏览器）',
            '  caption-side: inline-end;      // 行尾方向',
            '  caption-side: block-start;     // 块首（实验性）',
            '  caption-side: block-end;       // 块尾（实验性）',
            '',
            '  ★ caption-side 设在 <table> 上，但作用于 <caption>',
            '  ★ inline-start/end 受 direction/writing-mode 影响（RTL 反转）',
            '  ★ 旧浏览器仅支持 top/bottom，inline-* 需 polyfill 或回退',
            '',
            '【<caption> 语义与 ARIA】',
            '  <caption> 是表格的标题，应作为 <table> 的第一个子元素',
            '  屏幕阅读器会朗读 caption 作为表格的「标签」',
            '  ★ 不要用 <div>/<p> 模拟表格标题——丢失语义与 ARIA 关联',
            '  ★ 一个表格只能有一个 <caption>',
            '',
            '  <table>',
            '    <caption>2025 年度销售数据（单位：万元）</caption>',
            '    <thead>...</thead>',
            '    <tbody>...</tbody>',
            '  </table>',
            '',
            '  若视觉上不需要标题，用 sr-only 隐藏而非删除：',
            '  .sr-only {',
            '    position: absolute; width: 1px; height: 1px;',
            '    padding: 0; margin: -1px; overflow: hidden;',
            '    clip: rect(0,0,0,0); white-space: nowrap; border: 0;',
            '  }',
            '',
            '【vertical-align 在单元格上下文】',
            '  在 table-cell 中，vertical-align 控制单元格内容的「垂直对齐」：',
            '  td { vertical-align: top; }       // 内容顶对齐',
            '  td { vertical-align: middle; }    // 默认：垂直居中',
            '  td { vertical-align: bottom; }    // 内容底对齐',
            '  td { vertical-align: baseline; }  // 同行单元格首行文字基线对齐',
            '  td { vertical-align: sub; }       // 下标位置',
            '  td { vertical-align: super; }     // 上标位置',
            '  td { vertical-align: text-top; }  // 与父文字顶部对齐（cell 中少用）',
            '  td { vertical-align: text-bottom; }',
            '  td { vertical-align: 10px; }      // 长度值：相对基线上移/下移',
            '',
            '  ★ table-cell 中的 vertical-align 与行内元素中的 vertical-align 行为不同！',
            '    - 行内元素：控制自身相对父基线的位置',
            '    - table-cell：控制整个单元格内容的垂直对齐（整段文字一起）',
            '  ★ baseline 对齐：同行所有 baseline 单元格的首行文字会落在同一基线上',
            '',
            '【baseline 对齐实战】',
            '  不同字号单元格的基线对齐：',
            '  <table>',
            '    <tr>',
            '      <td style="vertical-align:baseline; font-size:12px">小字</td>',
            '      <td style="vertical-align:baseline; font-size:24px">大字</td>',
            '      <td style="vertical-align:baseline; font-size:16px">中字</td>',
            '    </tr>',
            '  </table>',
            '  → 三列首行文字基线对齐，视觉上更整齐',
            '',
            '【caption-side 与 writing-mode 交互】',
            '  writing-mode: vertical-rl;  caption-side: inline-start;',
            '  → caption 在表格右侧（竖排模式下 inline-start 是右侧）',
            '',
            '  ★ 国际化排版：CJK 竖排表格用 inline-start/end 更语义化',
            '',
            '【实战：caption 在下方 + 居中】',
            '  table { caption-side: bottom; }',
            '  caption {',
            '    padding-top: 8px;',
            '    font-size: 12px;',
            '    color: #64748b;',
            '    text-align: center;',
            '    caption-side: bottom;   /* 也可设在 caption 自身 */',
            '  }',
            '',
            '【浏览器支持】',
            `  caption-side: top: ${f.captionSideTop ? '✓' : '✗'} (CSS2.1，全支持)`,
            `  caption-side: inline-start: ${f.captionSide ? '✓' : '✗'} (CSS Logical，新浏览器)`,
            `  vertical-align: middle: ${f.verticalAlign ? '✓' : '✗'} (CSS1，全支持)`,
        ].join('\n');
        this.setState({ captionValignInfo: info });
        this._addLog('css', `caption-side 演示完成；当前=${this._captionSide}，vertical-align=${this._valignMode}`);
    }
    _setCaptionSide(side) {
        this._captionSide = side;
        this._injectStyle('css-table-caption-side', `
      .cap-switch { caption-side: ${side}; }
    `);
        this._addLog('caption', `切换 caption-side → ${side}`);
    }
    _setValign(mode) {
        this._valignMode = mode;
        this._injectStyle('css-table-valign', `
      .va-switch td, .va-switch th { vertical-align: ${mode}; }
      .va-switch .va-cell-h { height: 56px; }
    `);
        this._addLog('valign', `切换 vertical-align → ${mode}（${mode === 'baseline' ? '同行首行文字基线对齐' : mode === 'top' ? '内容顶对齐' : mode === 'bottom' ? '内容底对齐' : '垂直居中（默认）'}）`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. caption-side 与 vertical-align',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['caption-side:top', f.captionSideTop],
                ['caption-side:inline-start', f.captionSide],
                ['vertical-align', f.verticalAlign],
            ]), h(Tag, { color: 'primary' }, 'caption / baseline')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'caption-side 控制 <caption> 位置：top（默认）/bottom（CSS2.1）/inline-start/inline-end（CSS Logical，受 direction/writing-mode 影响）。<caption> 是表格语义标题，屏幕阅读器朗读为表格标签，应作为 <table> 首个子元素，视觉隐藏用 sr-only 而非删除。table-cell 中 vertical-align 控制整段内容垂直对齐（top/middle/bottom/baseline），baseline 让同行单元格首行文字基线对齐，与行内元素 vertical-align 行为不同。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runCaptionValignDemo() }), this._btn('caption: top', { size: 'sm', disabled: !f.captionSideTop, onClick: () => this._setCaptionSide('top') }), this._btn('caption: bottom', { size: 'sm', disabled: !f.captionSideTop, onClick: () => this._setCaptionSide('bottom') }), this._btn('caption: inline-start', { size: 'sm', disabled: !f.captionSide, onClick: () => this._setCaptionSide('inline-start') }), this._btn(`valign: ${this._valignMode}`, { size: 'sm', disabled: !f.verticalAlign, onClick: () => this._setValign({ top: 'middle', middle: 'bottom', bottom: 'baseline', baseline: 'top' }[this._valignMode]) })),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, `caption-side: ${this._captionSide}，vertical-align: ${this._valignMode}（注意 caption 位置 + 单元格内容垂直对齐）`), h('table', { class: 'cap-switch va-switch' }, h('caption', {}, '表 1：员工信息（caption 位置受 caption-side 控制）'), h('thead', {}, h('tr', {}, h('th', { class: 'va-cell-h' }, '姓名'), h('th', { class: 'va-cell-h' }, '简介'))), h('tbody', {}, h('tr', {}, h('td', {}, h('strong', {}, '张三')), h('td', {}, '前端工程师，负责 React/Vue 应用开发，5 年经验，熟悉 CSS 表格布局与 Flexbox/Grid')), h('tr', {}, h('td', {}, h('strong', {}, '李四')), h('td', {}, '后端工程师，负责 Node.js/Go 微服务，3 年经验'))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '420px', overflow: 'auto' } }, h('code', {}, s.captionValignInfo || '（点击「运行演示」查看 caption-side + vertical-align 全套用法）')),
                h(Alert, {
                    type: 'info',
                    message: 'table-cell 的 vertical-align 与行内元素不同',
                    description: 'table-cell 中 vertical-align 控制整段内容垂直对齐；行内元素中控制自身相对父基线。baseline 让同行单元格首行文字基线对齐，不同字号视觉更整齐。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：colgroup 与列控制 ===================
    _runColgroupDemo() {
        const f = this._flags();
        const info = [
            '===== <colgroup> 与 <col> 列级控制 =====',
            '',
            '【<colgroup> 与 <col> 的作用】',
            '  <colgroup> 包裹 <col>，对一列或多列应用统一样式',
            '  <col> 代表一列，无内容（display: table-column）',
            '',
            '  <table>',
            '    <colgroup>',
            '      <col class="col-id">           <!-- 第 1 列 -->',
            '      <col class="col-name">          <!-- 第 2 列 -->',
            '      <col class="col-desc" span="2"> <!-- 第 3-4 列（span） -->',
            '    </colgroup>',
            '    <thead>...</thead>',
            '    <tbody>...</tbody>',
            '  </table>',
            '',
            '【<col> 的 span 属性】',
            '  <col span="3">  // 该 <col> 代表 3 列',
            '  ★ span 是 HTML 属性，不是 CSS',
            '  ★ span="0" 表示剩余所有列（HTML5）',
            '',
            '【<col> 仅支持 4 类 CSS 属性】',
            '  <col> 是 table-column 盒，不渲染内容，仅以下属性生效：',
            '    1. width          // 列宽（最常用）',
            '    2. background     // 列背景（透过单元格显示）',
            '    3. border         // 边框（仅 border-collapse: collapse 生效）',
            '    4. visibility: collapse  // 隐藏整列',
            '',
            '  ★ color / font / padding / text-align 设在 <col> 上无效',
            '    → 需用 td:nth-child(n) 或 class 设在单元格上',
            '  ★ background 设在 <col> 上会被 cell 的 background 覆盖',
            '    → cell 透明才能透出列背景',
            '',
            '【列宽优先级链】',
            '  在 table-layout: fixed 模式下，列宽按以下优先级确定：',
            '    1. <col> 的 width（规范优先级最高）',
            '    2. 首行 <th>/<td> 的 width',
            '    3. 无 width 时：剩余空间均分',
            '',
            '  在 table-layout: auto 模式下：',
            '    <col> width 作为「建议宽度」，仍受内容影响调整',
            '',
            '【实战：fixed + colgroup 锁定列宽】',
            '  <style>',
            '    table {',
            '      table-layout: fixed;',
            '      width: 100%;',
            '      border-collapse: collapse;',
            '    }',
            '    col.col-id    { width: 60px; }',
            '    col.col-name  { width: 180px; }',
            '    col.col-email { width: 220px; }',
            '    col.col-action{ width: 120px; }',
            '    /* 剩余列自动均分 */',
            '  </style>',
            '  <table>',
            '    <colgroup>',
            '      <col class="col-id">',
            '      <col class="col-name">',
            '      <col class="col-email">',
            '      <col class="col-action">',
            '    </colgroup>',
            '    ...',
            '  </table>',
            '',
            '  ★ 这是大数据表格的标准模式：fixed + colgroup + width',
            '  ★ 列宽稳定可预测，长内容用 overflow:hidden 截断',
            '',
            '【实战：列背景（cell 透明）】',
            '  col.col-highlight { background: #fef3c7; }',
            '  td { background: transparent; }  /* 必须 transparent 才能透出列背景 */',
            '',
            '【实战：响应式隐藏列】',
            '  <col class="col-mobile-hide">',
            '  <style>',
            '    @media (max-width: 768px) {',
            '      col.col-mobile-hide { visibility: collapse; }',
            '    }',
            '  </style>',
            '',
            '  ★ visibility: collapse 在 <col> 上隐藏整列（包括所有行的该列单元格）',
            '  ★ 不要用 display: none（<col> 已是 table-column，display:none 行为不一致）',
            '',
            '【实战：span 简化多列同宽】',
            '  <colgroup>',
            '    <col class="col-label" span="3">  <!-- 前 3 列同宽 -->',
            '    <col class="col-data">            <!-- 第 4 列 -->',
            '  </colgroup>',
            '',
            '【colgroup vs colgroup span】',
            '  <colgroup span="3"></colgroup>   // 整组 span=3，无内部 <col>',
            '  <colgroup><col><col><col></colgroup>  // 等价',
            '  <colgroup span="3"><col class="hl"></colgroup>  // 组内只有 1 个 col，但组占 3 列',
            '                                                      // col 仅作用于第 1 列',
            '',
            '【浏览器支持】',
            `  display: table-column: ${f.displayTableColumn ? '✓' : '✗'}`,
            `  table-layout: fixed: ${f.tableLayout ? '✓' : '✗'}`,
            '  均为 CSS2.1 老特性，全主流浏览器支持',
            '  ★ IE 对 <col> 的部分样式支持有 bug（如 border），现代浏览器无问题',
        ].join('\n');
        this.setState({ colgroupInfo: info });
        this._addLog('css', `colgroup 演示完成；display:table-column=${f.displayTableColumn}，table-layout:fixed=${f.tableLayout}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. <colgroup> 与 <col> 列级控制',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['table-column', f.displayTableColumn],
                ['table-layout:fixed', f.tableLayout],
            ]), h(Tag, { color: 'primary' }, 'col / colgroup / span')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '<colgroup> 包裹 <col> 对列应用统一样式；<col> 是 table-column 盒不渲染内容，仅 width/background/border/visibility:collapse 4 类属性生效，color/font/padding/text-align 无效需设在 cell 上。span 属性（HTML）让一个 <col> 代表多列。table-layout:fixed 下 <col> width 优先级最高（> 首行 cell width > 均分）。visibility:collapse 隐藏整列是响应式列控制的标准手段。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行列控制演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runColgroupDemo() })),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, 'fixed + colgroup 锁定列宽（col 设 width，cell 透明透出列背景）：'), h('table', { class: 'tl-fixed', style: { width: '100%', borderCollapse: 'collapse' } }, h('colgroup', {}, h('col', { style: { width: '60px', background: '#fef3c7' } }), h('col', { style: { width: '140px' } }), h('col', { style: { width: '200px' } }), h('col', { style: { width: '100px', background: '#dbeafe' } })), h('thead', {}, h('tr', {}, h('th', {}, 'ID'), h('th', {}, '姓名'), h('th', {}, '邮箱'), h('th', {}, '操作'))), h('tbody', {}, h('tr', {}, h('td', { style: { background: 'transparent' } }, '1'), h('td', { style: { background: 'transparent' } }, '张三'), h('td', { style: { background: 'transparent' } }, 'zhang@example.com'), h('td', { style: { background: 'transparent' } }, '编辑')), h('tr', {}, h('td', { style: { background: 'transparent' } }, '2'), h('td', { style: { background: 'transparent' } }, '李四'), h('td', { style: { background: 'transparent' } }, 'li@example.com'), h('td', { style: { background: 'transparent' } }, '编辑'))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '460px', overflow: 'auto' } }, h('code', {}, s.colgroupInfo || '（点击「运行列控制演示」查看 <colgroup>/<col>/span + 列宽优先级链）')),
                h(Alert, {
                    type: 'warning',
                    message: '<col> 仅 width/background/border/visibility 生效',
                    description: 'color/font/padding/text-align 设在 <col> 上无效，需用 td:nth-child(n) 或 class 设在单元格上。background 设在 <col> 会被 cell 的 background 覆盖，cell 须 transparent 才能透出列背景。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：表格语义与可访问性 ===================
    _runSemanticsA11yDemo() {
        const f = this._flags();
        const info = [
            '===== 表格语义与可访问性 =====',
            '',
            '【表格语义元素】',
            '  <table>    表格容器',
            '  <caption>  表格标题（屏幕阅读器朗读为标签）',
            '  <colgroup>/<col>  列分组与列样式',
            '  <thead>    表头分组（table-header-group，始终在顶部）',
            '  <tbody>    表体分组（table-row-group，可有多个）',
            '  <tfoot>    表尾分组（table-footer-group，始终在底部）',
            '  <tr>       表行',
            '  <th>       表头单元格（默认加粗居中）',
            '  <td>       数据单元格',
            '',
            '【<th> 的 scope 属性 —— 关键 ARIA 钩子】',
            '  <th scope="col">     // 列表头（描述整列）',
            '  <th scope="row">     // 行表头（描述整行）',
            '  <th scope="colgroup"> // 列组表头（描述多列，配合 colspan）',
            '  <th scope="rowgroup"> // 行组表头（描述多行，配合 rowspan）',
            '',
            '  ★ scope 让屏幕阅读器建立「单元格 ↔ 表头」关联',
            '  ★ 没有 scope，屏幕阅读器只能猜测关联，复杂表格体验差',
            '',
            '  <table>',
            '    <thead>',
            '      <tr>',
            '        <th scope="col">姓名</th>',
            '        <th scope="col">年龄</th>',
            '        <th scope="col">部门</th>',
            '      </tr>',
            '    </thead>',
            '    <tbody>',
            '      <tr>',
            '        <th scope="row">张三</th>   <!-- 行表头 -->',
            '        <td>28</td>',
            '        <td>研发</td>',
            '      </tr>',
            '    </tbody>',
            '  </table>',
            '',
            '【colspan 与 rowspan —— 合并单元格】',
            '  <td colspan="2">  // 横向合并 2 列',
            '  <td rowspan="3">  // 纵向合并 3 行',
            '  <td colspan="2" rowspan="2">  // 同时合并 2 列 2 行',
            '',
            '  ★ colspan/rowspan 是 HTML 属性，不是 CSS',
            '  ★ 合并后该行/列后续单元格要相应减少',
            '',
            '  <table>',
            '    <tr>',
            '      <th scope="col">区域</th>',
            '      <th scope="col" colspan="2">2024 / 2025 销售额</th>',
            '    </tr>',
            '    <tr>',
            '      <td></td>',
            '      <th scope="col">2024</th>',
            '      <th scope="col">2025</th>',
            '    </tr>',
            '    <tr>',
            '      <th scope="row">华东</th>',
            '      <td>120</td>',
            '      <td>150</td>',
            '    </tr>',
            '  </table>',
            '',
            '【headers 属性 —— 复杂表格的显式关联】',
            '  当 scope 不够用（一个单元格关联多个表头）时，用 headers：',
            '  <th id="h-region">区域</th>',
            '  <th id="h-2024">2024</th>',
            '  <td headers="h-region h-2024">120</td>  <!-- 显式关联两个表头 -->',
            '',
            '  ★ headers 是 scope 的补充，用于不规则合并的复杂表格',
            '',
            '【ARIA role="table" vs 原生 <table>】',
            '  原生 <table> 自带 ARIA table 语义，无需额外 role',
            '  仅当用 <div> 模拟表格时才需显式 ARIA：',
            '',
            '  <div role="table" aria-label="销售数据">',
            '    <div role="rowgroup">',
            '      <div role="row">',
            '        <div role="columnheader" scope="col">姓名</div>',
            '        <div role="columnheader" scope="col">销售额</div>',
            '      </div>',
            '    </div>',
            '    <div role="rowgroup">',
            '      <div role="row">',
            '        <div role="rowheader" scope="row">张三</div>',
            '        <div role="cell">120</div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '',
            '  ARIA 角色：',
            '    table / grid / treegrid     // 表格类型',
            '    row / rowgroup              // 行与行组',
            '    cell / columnheader / rowheader  // 单元格与表头',
            '',
            '  ★ 原则：能用原生 <table> 就用原生，ARIA 仅作 div 模拟的兜底',
            '  ★ role="grid" 用于可交互表格（如 Excel 式键盘导航）',
            '  ★ role="treegrid" 用于树形展开表格',
            '',
            '【aria-describedby / aria-label】',
            '  <table aria-describedby="table-desc">',
            '    ...',
            '  </table>',
            '  <p id="table-desc">本表展示 2025 年度各部门销售数据...</p>',
            '',
            '【可访问性检查清单】',
            '  ✓ 有 <caption> 或 aria-label',
            '  ✓ <th> 有 scope（col/row/colgroup/rowgroup）',
            '  ✓ 复杂合并用 headers 显式关联',
            '  ✓ 不用 <table> 做布局（用 CSS Grid/Flexbox）',
            '  ✓ 数据表格保留原生 <table>，div 模拟才用 ARIA',
            '',
            '【不要用 <table> 做布局】',
            '  旧时代用 <table> 做页面布局是反模式：',
            '    - 语义错误（屏幕阅读器朗读为表格）',
            '    - 响应式困难（表格列宽固定）',
            '    - SEO 不友好',
            '  现代布局用 CSS Grid / Flexbox / Multi-column',
            '  ★ 仅「真正的表格数据」才用 <table>',
            '',
            '【浏览器支持】',
            `  display: table: ${f.displayTable ? '✓' : '✗'}`,
            '  表格语义元素与 ARIA 全主流浏览器支持',
        ].join('\n');
        this.setState({ semanticsA11yInfo: info });
        this._addLog('css', `表格语义与可访问性演示完成；display:table=${f.displayTable}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 表格语义与可访问性 —— thead/tbody/tfoot/th/td + scope + ARIA',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['display:table', f.displayTable]]), h(Tag, { color: 'primary' }, 'scope / ARIA')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'thead/tbody/tfoot/th/td 提供表格语义；<th scope="col|row|colgroup|rowgroup"> 让屏幕阅读器建立「单元格↔表头」关联；colspan/rowspan 合并单元格（复杂场景用 headers 显式关联多个表头）。原生 <table> 自带 ARIA table 语义，仅 div 模拟表格才需 role="table"/row/cell/columnheader。原则：能用原生 <table> 就用原生，不用 <table> 做布局（改用 Grid/Flexbox）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行语义演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runSemanticsA11yDemo() })),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, '语义化表格（scope + colspan 合并表头）：'), h('table', { class: 'tbl', style: { borderCollapse: 'collapse', width: '100%' } }, h('caption', {}, '表 2：2024/2025 年度区域销售额（万元）'), h('thead', {}, h('tr', {}, h('th', { scope: 'col', rowspan: '2', class: 'sem-th' }, '区域'), h('th', { scope: 'col', colspan: '2', class: 'sem-th' }, '销售额'), h('th', { scope: 'col', rowspan: '2', class: 'sem-th' }, '增长率')), h('tr', {}, h('th', { scope: 'col', class: 'sem-th' }, '2024'), h('th', { scope: 'col', class: 'sem-th' }, '2025'))), h('tbody', {}, h('tr', {}, h('th', { scope: 'row', class: 'sem-th' }, '华东'), h('td', {}, '120'), h('td', {}, '150'), h('td', {}, '+25%')), h('tr', {}, h('th', { scope: 'row', class: 'sem-th' }, '华北'), h('td', {}, '90'), h('td', {}, '108'), h('td', {}, '+20%'))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '460px', overflow: 'auto' } }, h('code', {}, s.semanticsA11yInfo || '（点击「运行语义演示」查看 scope/colspan/rowspan/headers/ARIA 全套用法）')),
                h(Alert, {
                    type: 'warning',
                    message: '不要用 <table> 做布局',
                    description: '旧时代用 <table> 做页面布局是反模式：语义错误、响应式困难、SEO 不友好。现代布局用 CSS Grid/Flexbox。仅「真正的表格数据」才用 <table>，并配 scope/headers 保证可访问性。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：sticky 表头与首列 ===================
    _runStickyDemo() {
        const f = this._flags();
        const info = [
            '===== sticky 表头与首列 =====',
            '',
            '【position: sticky 基础】',
            '  position: sticky 是 relative + fixed 的混合：',
            '    - 在滚动容器内「正常流」时表现为 relative',
            '    - 滚出指定阈值（top/left/right/bottom）时「钉住」表现为 fixed',
            '    - 滚出父容器边界时随父容器滚出（不会逃逸）',
            '',
            '  th {',
            '    position: sticky;',
            '    top: 0;            // ★ 必须设 top/left/right/bottom 之一才生效',
            '    z-index: 2;        // 钉住时盖在其他单元格上',
            '    background: #fff;  // ★ 必须设背景，否则下方内容透出',
            '  }',
            '',
            '【sticky 表头】',
            '  .scroll-container {',
            '    max-height: 400px;',
            '    overflow: auto;    // ★ 滚动容器',
            '  }',
            '  table { width: 100%; border-collapse: collapse; }',
            '  thead th {',
            '    position: sticky;',
            '    top: 0;',
            '    z-index: 2;',
            '    background: #1e3a8a;  // ★ 不透明背景',
            '    color: #fff;',
            '  }',
            '',
            '  ★ sticky 相对最近的滚动祖先（这里是 .scroll-container）',
            '  ★ thead th 钉在 top:0，滚动时表头始终可见',
            '',
            '【sticky 首列】',
            '  tbody th {',
            '    position: sticky;',
            '    left: 0;',
            '    z-index: 1;',
            '    background: #e0e7ff;',
            '  }',
            '',
            '【sticky 表头 + 首列（左上角交叉格）】',
            '  /* 左上角交叉格需要更高 z-index，否则被表头/首列覆盖 */',
            '  thead th:first-child {',
            '    z-index: 3;       // 比单纯表头(2)和首列(1)都高',
            '  }',
            '',
            '  ★ 交叉格同时满足 top:0 + left:0，必须浮在最上层',
            '',
            '【overflow 容器陷阱】',
            '  ★ sticky 失效的常见原因：',
            '    1. 父容器 overflow: hidden/auto/scroll + 没有高度限制',
            '       → 父容器不滚动，sticky 无机会触发',
            '    2. 父容器 overflow: hidden',
            '       → sticky 完全失效（hidden 不滚动）',
            '    3. 父容器有 transform/filter/will-change',
            '       → 创建新包含块，sticky 相对该父而非滚动容器',
            '    4. 没设 top/left/right/bottom',
            '       → sticky 退化为 relative',
            '    5. height: auto 的父容器',
            '       → 内容不溢出，无滚动，sticky 不触发',
            '',
            '  ★ 正确做法：明确指定滚动容器 + max-height + overflow:auto',
            '',
            '【z-index 与堆叠上下文】',
            '  sticky 元素 z-index 在其堆叠上下文内生效',
            '  ★ thead th 的 z-index 仅在 table 的堆叠上下文内有意义',
            '  ★ 如果 thead 自身有 position:relative + z-index，会创建子堆叠上下文',
            '    → thead th 的 z-index 被限制在 thead 内',
            '',
            '  推荐层级：',
            '    thead th:first-child  z-index: 3  (左上角交叉格)',
            '    thead th              z-index: 2  (表头)',
            '    tbody th              z-index: 1  (首列)',
            '    tbody td              z-index: auto (普通单元格)',
            '',
            '【border-collapse 下的 sticky 边框 hack】',
            '  ★ 严重陷阱：border-collapse: collapse 模式下，sticky 表头的边框',
            '    会随滚动「消失」（合并边框被相邻非 sticky 单元格覆盖）',
            '',
            '  解决方案 1：改用 border-collapse: separate + border-spacing: 0',
            '    table { border-collapse: separate; border-spacing: 0; }',
            '    th, td { border: 1px solid #ccc; }',
            '    /* separate 下每个单元格独立边框，sticky 不丢失 */',
            '',
            '  解决方案 2：用 box-shadow 模拟边框（保持 collapse）',
            '    thead th {',
            '      position: sticky; top: 0;',
            '      /* 用 box-shadow 模拟下边框（不被覆盖） */',
            '      box-shadow: inset 0 -1px 0 #1e3a8a, 0 1px 0 #cbd5e1;',
            '    }',
            '    tbody th {',
            '      position: sticky; left: 0;',
            '      box-shadow: inset -1px 0 0 #1e3a8a, 1px 0 0 #cbd5e1;',
            '    }',
            '',
            '  ★ 方案 2 更优雅（保持 collapse 单线视觉），但 box-shadow 不能完全',
            '    替代 border 的圆角/虚线等特性',
            '',
            '【实战：完整 sticky 表头 + 首列】',
            '  <div class="scroll-container">',
            '    <table class="sticky-table">',
            '      <thead><tr>',
            '        <th class="corner">姓名</th>     <!-- 左上角交叉 -->',
            '        <th>列1</th><th>列2</th>...',
            '      </tr></thead>',
            '      <tbody>',
            '        <tr>',
            '          <th class="row-header">张三</th> <!-- 首列 -->',
            '          <td>...</td>...',
            '        </tr>...',
            '      </tbody>',
            '    </table>',
            '  </div>',
            '',
            '  .scroll-container { max-height: 400px; overflow: auto; }',
            '  table { border-collapse: separate; border-spacing: 0; width: 100%; }',
            '  th, td { padding: 6px 10px; border: 1px solid #cbd5e1; }',
            '  thead th { position: sticky; top: 0; z-index: 2; background: #1e3a8a; color: #fff; }',
            '  tbody th { position: sticky; left: 0; z-index: 1; background: #e0e7ff; }',
            '  thead th.corner { z-index: 3; }   /* 左上角最高 */',
            '',
            '【浏览器支持】',
            `  position: sticky: ${f.positionSticky ? '✓' : '✗'} (Chrome 56+/Firefox 32+/Safari 13+)`,
            '  ★ IE 11 完全不支持 sticky，需 polyfill 或 JS 模拟',
        ].join('\n');
        this.setState({ stickyHeaderInfo: info });
        this._addLog('css', `sticky 表头演示完成；position:sticky=${f.positionSticky}，当前 sticky=${this._stickyOn}`);
    }
    _toggleSticky() {
        this._stickyOn = !this._stickyOn;
        const cls = this._stickyOn ? 'sticky-on' : '';
        this._injectStyle('css-table-sticky-toggle', `
      .sticky-table { /* base 已含 sticky-on 默认；这里仅切换额外效果 */ }
      .sticky-toggle { ${this._stickyOn ? '' : ''} }
      .sticky-toggle thead th { position: ${this._stickyOn ? 'sticky' : 'static'}; top: 0; }
      .sticky-toggle tbody th { position: ${this._stickyOn ? 'sticky' : 'static'}; left: 0; }
    `);
        this._addLog('sticky', `切换 sticky 表头 → ${this._stickyOn ? '开启（top:0 + left:0 + z-index 分层）' : '关闭（恢复 static）'}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. sticky 表头与首列 —— position:sticky + overflow 陷阱 + 边框 hack',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['position:sticky', f.positionSticky]]), h(Tag, { color: 'primary' }, 'sticky / overflow')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'position: sticky 让 thead th 钉在 top:0、tbody th 钉在 left:0 实现表头+首列冻结。陷阱：父容器 overflow:hidden 失效、必须有滚动容器+高度限制、左上角交叉格 z-index 要最高（3>2>1）。严重问题：border-collapse:collapse 下 sticky 边框会随滚动消失，需改用 separate+border-spacing:0 或用 box-shadow 模拟边框。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 sticky 演示', { type: 'primary', size: 'sm', disabled: !f.positionSticky, onClick: () => this._runStickyDemo() }), this._btn(`sticky 表头：${this._stickyOn ? '开启' : '关闭'}`, { size: 'sm', disabled: !f.positionSticky, onClick: () => this._toggleSticky() })),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, '可滚动表格容器（sticky 表头 + 首列，左上角交叉格 z-index 最高）：'), h('div', { class: 'tbl-stage sticky-toggle' }, h('table', { class: 'tbl sticky-table', style: { borderCollapse: 'separate', borderSpacing: '0', width: '100%' } }, h('thead', {}, h('tr', {}, h('th', { style: { position: 'sticky', top: '0', left: '0', zIndex: '4', background: '#1e3a8a', color: '#fff' } }, '姓名\\指标'), h('th', { style: { position: 'sticky', top: '0', zIndex: '3', background: '#1e3a8a', color: '#fff' } }, '1月'), h('th', { style: { position: 'sticky', top: '0', zIndex: '3', background: '#1e3a8a', color: '#fff' } }, '2月'), h('th', { style: { position: 'sticky', top: '0', zIndex: '3', background: '#1e3a8a', color: '#fff' } }, '3月'), h('th', { style: { position: 'sticky', top: '0', zIndex: '3', background: '#1e3a8a', color: '#fff' } }, '4月'), h('th', { style: { position: 'sticky', top: '0', zIndex: '3', background: '#1e3a8a', color: '#fff' } }, '5月'), h('th', { style: { position: 'sticky', top: '0', zIndex: '3', background: '#1e3a8a', color: '#fff' } }, '6月'))), h('tbody', {}, ...['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'].map((name, i) => h('tr', { key: i }, h('th', { style: { position: 'sticky', left: '0', zIndex: '2', background: '#e0e7ff' } }, name), ...Array.from({ length: 6 }, (_, j) => h('td', { key: j, style: { background: '#fff' } }, String(100 + i * 10 + j))))))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '480px', overflow: 'auto' } }, h('code', {}, s.stickyHeaderInfo || '（点击「运行 sticky 演示」查看 sticky 表头/首列 + overflow 陷阱 + border-collapse 边框 hack）')),
                h(Alert, {
                    type: 'warning',
                    message: 'border-collapse:collapse 下 sticky 边框会消失',
                    description: '改用 border-collapse:separate + border-spacing:0，或用 box-shadow 模拟边框（保持 collapse 单线视觉）。父容器 overflow:hidden 会让 sticky 完全失效；必须有滚动容器 + 高度限制。左上角交叉格 z-index 要最高（3>2>1）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 8：打印分页与陷阱 ===================
    _runPrintTrapsDemo() {
        const f = this._flags();
        const info = [
            '===== 打印分页与陷阱 =====',
            '',
            '【打印分页属性（CSS Paged Media）】',
            '  break-inside: avoid;       // 避免元素内部分页（元素尽量保持在一页）',
            '  break-before: page;        // 元素前强制分页（新起一页）',
            '  break-after: page;         // 元素后强制分页',
            '  break-before: avoid;       // 避免元素前分页',
            '  break-after: avoid;        // 避免元素后分页',
            '',
            '  ★ 旧名（仅打印）：page-break-inside / page-break-before / page-break-after',
            '  ★ 新名 break-* 同时适用于 print 和 paged media（如多列布局）',
            '  ★ 生产建议新旧名都写：break-inside: avoid; page-break-inside: avoid;',
            '',
            '【表格打印：避免行内分页】',
            '  @media print {',
            '    tr { break-inside: avoid; page-break-inside: avoid; }',
            '    thead { display: table-header-group; }  // 每页重复表头（默认行为）',
            '  }',
            '',
            '  ★ tr 的 break-inside:avoid 让单行不被拆到两页',
            '  ★ thead display:table-header-group 是默认值，打印时每页自动重复',
            '  ★ tfoot display:table-footer-group 每页自动重复表尾',
            '',
            '【强制章节分页】',
            '  @media print {',
            '    h2 { break-before: page; page-break-before: always; }',
            '    .section { break-before: page; }',
            '  }',
            '',
            '  ★ 每个章节标题前自动新起一页',
            '',
            '【widows 与 orphans —— 段落孤行/寡行控制】',
            '  widows: 2;    // 段落底部至少保留 2 行（防止「寡行」：段落末尾 1 行被甩到下页）',
            '  orphans: 2;   // 段落顶部至少保留 2 行（防止「孤行」：段落开头 1 行被留在上页）',
            '',
            '  ★ widows/orphans 仅对块级元素内的文本行生效（如 p）',
            '  ★ 默认值都是 2',
            '  ★ 表格单元格内的段落也受 widows/orphans 影响',
            '',
            '  p {',
            '    widows: 3;   // 段尾至少 3 行留在下页',
            '    orphans: 3;  // 段首至少 3 行留在上页',
            '  }',
            '',
            '【合并单元格打印陷阱】',
            '  ★ rowspan 跨页时会出问题：',
            '    - 跨页的 rowspan 单元格可能被裁剪',
            '    - 下一页续行时丢失「合并关联」',
            '    - 各浏览器行为不一致（Chrome/Firefox/Safari 渲染不同）',
            '',
            '  ★ 解决方案：',
            '    1. 避免在打印表格中使用 rowspan（改用重复值）',
            '    2. 对含 rowspan 的 tr 设 break-inside: avoid（保护单行不拆）',
            '    3. 用 JS 在打印前拆分表格',
            '',
            '【width: 100% 列宽收缩陷阱】',
            '  ★ 打印时 table { width: 100%; } 会触发列宽重新计算：',
            '    - 屏幕宽（如 1920px）的列宽比例不适用打印纸（A4 ~210mm）',
            '    - 部分浏览器会让表格收缩到纸宽，列宽严重压缩',
            '    - 内容溢出可能被裁剪而非换页',
            '',
            '  ★ 解决方案：',
            '    @media print {',
            '      table { width: auto; }   /* 让表格按内容宽度，避免强制 100% */',
            '      /* 或 */',
            '      table { table-layout: fixed; width: 100%; }  /* 锁定列宽比例 */',
            '      th, td { word-break: break-word; }  /* 长内容换行不溢出 */',
            '    }',
            '',
            '【打印色背景陷阱】',
            '  ★ 浏览器默认打印时去除背景色（节省墨水）',
            '  ★ 需强制打印背景：',
            '    @media print {',
            '      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
            '    }',
            '  ★ 用户也可在打印对话框勾选「背景图形」选项',
            '',
            '【@page 控制纸张】',
            '  @page {',
            '    size: A4 landscape;     // 纸张大小 + 方向',
            '    margin: 15mm;           // 页边距',
            '  }',
            '  @page :first { margin-top: 30mm; }  // 首页不同页边距',
            '  @page :left { margin-left: 25mm; }  // 左页（双面打印）',
            '  @page :right { margin-right: 25mm; }',
            '',
            '  ★ @page 设在 <html> 或 @media print 内',
            '  ★ size: A4 | letter | landscape | portrait | <length> <length>',
            '',
            '【打印分页调试】',
            '  ★ Chrome DevTools → Sources → Rendering → Emulate print media',
            '  ★ 或直接 Ctrl+P 预览',
            '  ★ 分页符在 DevTools 中可见（虚线）',
            '',
            '【实战：完整打印样式】',
            '  @media print {',
            '    /* 隐藏不需要打印的元素 */',
            '    .no-print { display: none; }',
            '    nav, footer, aside { display: none; }',
            '',
            '    /* 强制背景色 */',
            '    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
            '',
            '    /* 表格优化 */',
            '    table { width: auto; border-collapse: collapse; }',
            '    tr { break-inside: avoid; }',
            '    thead { display: table-header-group; }  /* 每页重复表头 */',
            '    th, td { padding: 4px 6px; border: 1px solid #000; font-size: 11px; }',
            '',
            '    /* 章节分页 */',
            '    h2 { break-before: page; }',
            '',
            '    /* 段落孤行寡行 */',
            '    p { widows: 2; orphans: 2; }',
            '',
            '    /* 纸张设置 */',
            '    @page { size: A4; margin: 15mm; }',
            '  }',
            '',
            '【浏览器支持】',
            `  break-inside: avoid: ${f.breakInside ? '✓' : '✗'} (新名，Chrome 65+/Firefox 65+)`,
            `  break-before: page: ${f.breakBefore ? '✓' : '✗'}`,
            `  widows: 2: ${f.widows ? '✓' : '✗'}`,
            `  orphans: 2: ${f.orphans ? '✓' : '✗'}`,
            '  ★ page-break-* 旧名兼容性更好（IE 9+），生产建议新旧名都写',
        ].join('\n');
        this.setState({ printTrapsInfo: info });
        this._addLog('css', `打印分页演示完成；break-inside=${f.breakInside}，widows=${f.widows}，orphans=${f.orphans}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 打印分页与陷阱 —— break-* / widows / orphans / width 收缩',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['break-inside:avoid', f.breakInside],
                ['break-before:page', f.breakBefore],
                ['widows', f.widows],
                ['orphans', f.orphans],
            ]), h(Tag, { color: 'primary' }, 'Paged Media')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'break-inside:avoid 避免行内分页、break-before:page 强制章节分页、thead display:table-header-group 每页重复表头。widows/orphans 控制段落孤行寡行（默认 2）。陷阱：rowspan 跨页裁剪、width:100% 列宽收缩、背景色默认不打印（需 print-color-adjust:exact）。@page 控制纸张 size/margin。生产建议 break-* 新名 + page-break-* 旧名都写。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行打印演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPrintTrapsDemo() }), this._btn('打印预览（Ctrl+P）', { size: 'sm', onClick: () => { try {
                        window.print();
                    }
                    catch (e) {
                        this._addLog('warn', `window.print 不可用：${e.message}`);
                    } } })),
                h('div', { class: 'tbl-demo' }, h('div', { class: 'fs-sm text-secondary mb-xs' }, '打印分页规则示意（@media print 内 break-inside:avoid / break-before:page）：'), h('pre', { style: { fontSize: '12px', lineHeight: '1.6', background: '#fff', padding: '8px', borderRadius: '4px', overflow: 'auto' } }, `@media print {
  tr { break-inside: avoid; }              /* 单行不拆页 */
  thead { display: table-header-group; }   /* 每页重复表头 */
  h2 { break-before: page; }               /* 章节前分页 */
  p { widows: 2; orphans: 2; }             /* 段落孤行寡行 */
  table { width: auto; }                   /* 避免 100% 列宽收缩 */
  * { print-color-adjust: exact; }         /* 强制打印背景 */
  @page { size: A4 landscape; margin: 15mm; }
}`)),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.printTrapsInfo || '（点击「运行打印演示」查看 break-*/widows/orphans/@page + 合并单元格陷阱 + width 收缩）')),
                h(Alert, {
                    type: 'info',
                    message: 'rowspan 跨页裁剪、width:100% 列宽收缩、背景色不打印',
                    description: '打印表格避免用 rowspan（改重复值）；width:100% 会触发列宽收缩，改 width:auto 或 table-layout:fixed；背景色默认不打印需 print-color-adjust:exact。生产建议 break-* 新名 + page-break-* 旧名都写以兼容 IE 9+。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return '';
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    // =================== 整页渲染 ===================
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'CSS Table Layout 表格布局完整体系 深度实验室'),
            h(Alert, {
                type: 'info',
                message: 'CSS Table Module Level 3 / CSS2.1 §17 —— 表格布局完整体系',
                description: '演示 CSS Table 全套能力：匿名表格盒模型（display:table-* 自动补全 + 匿名盒生成）、table-layout auto vs fixed 列宽算法（首次渲染 vs 二次布局 + 列宽锁定与性能）、border-collapse collapse/separate + border-spacing + empty-cells + 双边合并规则、caption-side 与 vertical-align（caption 位置 + 单元格垂直对齐 + baseline）、colgroup 与列控制（<col>/span + 列宽优先级链）、表格语义与可访问性（thead/tbody/tfoot/th/td + scope/colspan/rowspan + ARIA role=table）、sticky 表头与首列（position:sticky + overflow 陷阱 + border-collapse 边框 hack）、打印分页与陷阱（break-*/widows/orphans + 合并单元格陷阱 + width:100% 收缩）。CSS2.1 老特性全主流浏览器支持，CSS.supports() 检测，jsdom 不做真实布局但流程完整。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=CSSTableLayoutDeepPage.js.map