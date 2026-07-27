// =====================================================================
// CSSCascadeLayersPage.js —— CSS Cascade Layers @layer 深度实验室
// 演示 CSS Cascading and Inheritance Level 5 的 @layer 级联层特性：
//   1. 概述与动机 —— CSS 级联痛点（!important 滥用、选择器特异性战争、
//      第三方库覆盖难）/ @layer 标准 CSS Cascading and Inheritance Level 5 /
//      浏览器支持 Chrome 99+/Firefox 97+/Safari 15.4+ / 与 !important 关系
//   2. @layer 声明语法 —— @layer name { ... } / @layer name1, name2, name3; /
//      匿名层 @layer { ... } / 嵌套层 @layer framework.components { ... } /
//      隐式层（未分组的所有规则）
//   3. 层顺序与优先级 —— 声明顺序决定优先级 / 后声明的层优先级更高 /
//      unlayered 规则优先级最高（vs 普通规则）/ 嵌套层内部排序 /
//      @layer 重排序不可行
//   4. !important 在层中的反转 —— 普通规则下层优先级越高越优先 /
//      !important 规则下层优先级越低越优先 / 这是为了允许底层库用
//      !important 覆盖上层应用 / 与 specificity 解耦
//   5. @import 与 layer —— @import url() layer(name); / 第三方 CSS 强制归入
//      特定层 / Tailwind/CSS 框架集成 / @import 顺序约束（必须在文件顶部）
//   6. cascade-layer() 条件 —— @media (min-width: 600px) { @layer ... } /
//      cascade-layer() @supports / 动态层优先级 / 与容器查询结合
//   7. 实战架构模式 —— reset → framework → components → utilities 四层架构 /
//      与 Tailwind utilities 层协同 / CSS-in-JS 集成 / BEM 命名空间与层映射 /
//      第三方库「降级」到低优先级层
//   8. 陷阱与最佳实践 —— 层命名约定 / 过度细分层导致维护负担 /
//      与 CSS Modules 互操作 / DevTools 查看层顺序 / 兼容性 fallback
//      （layer 检测 + 双写规则）/ 与 @scope 关系
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；CSSLayerBlockRule / CSSLayerStatementRule 类型
//       在 jsdom 可能未定义，统一 try/catch 兜底。_flags() 用 safe(()=>...)
//       包裹，jsdom 不可用时返回 false。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSCascadeLayersPage extends Page {
    _inited = false;
    _dynamicStyles;
    _syntaxMode;
    _orderMode;
    _importantMode;
    _importMode;
    _conditionalMode;
    _patternsMode;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概述与动机
            syntaxInfo: '', // Card 2：@layer 声明语法
            orderInfo: '', // Card 3：层顺序与优先级
            importantInfo: '', // Card 4：!important 在层中的反转
            importInfo: '', // Card 5：@import 与 layer
            conditionalInfo: '', // Card 6：cascade-layer() 条件
            patternsInfo: '', // Card 7：实战架构模式
            pitfallsInfo: '', // Card 8：陷阱与最佳实践
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
        // 各 Card 当前演示模式
        this._syntaxMode = 'named'; // Card 2 当前 @layer 语法模式
        this._orderMode = 'abc'; // Card 3 当前层顺序模式
        this._importantMode = 'normal'; // Card 4 当前 !important 模式
        this._importMode = 'tailwind'; // Card 5 当前 @import 模式
        this._conditionalMode = 'media'; // Card 6 当前条件模式
        this._patternsMode = 'four-layer'; // Card 7 当前架构模式
        // 一次性能力检测：CSS Cascade Layers @layer 全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`,
            `supports ${c(f.supports)}`,
            `@layer base ${c(f.layerBase)}`,
            `@layer base,theme ${c(f.layerList)}`,
            `@import layer() ${c(f.importLayer)}`,
            `CSSLayerBlockRule ${c(f.layerBlockRule)}`,
            `CSSLayerStatementRule ${c(f.layerStatementRule)}`,
        ];
        const summary = f.css
            ? `CSS Cascade Layers @layer 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；CSSLayerBlockRule / CSSLayerStatementRule 类型在 jsdom 可能未定义。@layer 为 CSS Cascading and Inheritance Level 5 特性（Chrome 99+/Firefox 97+/Safari 15.4+）。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看层优先级与 !important 反转效果。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.layerBase)
            this._addLog('warn', '@layer base 不可用或 jsdom 未识别（CSS Cascading L5，Chrome 99+/Firefox 97+/Safari 15.4+ 支持）');
        if (!f.layerList)
            this._addLog('warn', '@layer 多层声明语法不可用或 jsdom 未识别');
        if (!f.importLayer)
            this._addLog('warn', '@import url() layer(name) 不可用或 jsdom 未识别');
        if (!f.layerBlockRule)
            this._addLog('warn', 'CSSLayerBlockRule 类型未定义（jsdom 可能不实现 CSSOM 层规则接口，真实浏览器可用 document.styleSheets 遍历层）');
        if (!f.layerStatementRule)
            this._addLog('warn', 'CSSLayerStatementRule 类型未定义（jsdom 可能不实现）');
        // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
        this._injectBaseStyles();
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
    // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // safe 包装：jsdom 不可用时返回 false，绝不抛异常
    _safe(fn) {
        try {
            return fn();
        }
        catch {
            return false;
        }
    }
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
    _flags() {
        const hasCSS = this._safe(() => typeof CSS !== 'undefined');
        const supportsStr = (s) => this._safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(s));
        return {
            css: hasCSS,
            supports: this._safe(() => hasCSS && typeof CSS.supports === 'function'),
            // Card 2：@layer 声明语法
            layerBase: supportsStr('@layer base'),
            layerList: supportsStr('@layer base, theme, components'),
            layerNested: supportsStr('@layer framework.components'),
            layerAnonymous: supportsStr('@layer'),
            // Card 5：@import 与 layer
            importLayer: supportsStr('@import "x.css" layer(base)'),
            // Card 8：CSSOM 接口
            layerBlockRule: this._safe(() => typeof CSSLayerBlockRule !== 'undefined'),
            layerStatementRule: this._safe(() => typeof CSSLayerStatementRule !== 'undefined'),
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
    // —— 动态注入所有演示样式（一次性）——
    _injectBaseStyles() {
        this._injectStyle('css-cascade-layers-demo', `
      /* ===== 通用舞台 ===== */
      .layer-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      .layer-demo-box {
        padding: 8px 12px;
        margin: 4px 0;
        border-radius: 4px;
        font-size: 13px;
        color: #fff;
      }
      /* ===== Card 3：层顺序演示（同名层按声明顺序，后声明的优先级更高）===== */
      @layer layer-a, layer-b, layer-c;
      @layer layer-a {
        .order-target { background: #ef4444; }  /* 红色：优先级最低 */
      }
      @layer layer-b {
        .order-target { background: #10b981; }  /* 绿色：优先级中 */
      }
      @layer layer-c {
        .order-target { background: #3b82f6; }  /* 蓝色：优先级最高 */
      }
      /* unlayered 规则优先级最高（vs 普通规则）*/
      .order-target { background: #6366f1; }  /* 紫色：unlayered，优先级最高 */
      /* ===== Card 4：!important 在层中的反转 ===== */
      @layer imp-low, imp-high;
      @layer imp-low {
        .imp-target { background: #ef4444 !important; }  /* 低层 !important，优先级最高（反转！）*/
      }
      @layer imp-high {
        .imp-target { background: #3b82f6 !important; }  /* 高层 !important，优先级较低（反转！）*/
      }
      .imp-target { background: #6366f1; }  /* unlayered 普通规则，优先级最低（被 !important 覆盖）*/
      /* ===== Card 7：四层架构 ===== */
      @layer reset, framework, components, utilities;
      @layer reset {
        .arch-box { margin: 0; padding: 0; box-sizing: border-box; }
      }
      @layer framework {
        .arch-box { padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; }
      }
      @layer components {
        .arch-box { border-radius: 6px; font-size: 13px; }
      }
      @layer utilities {
        .arch-box { color: #1e40af; font-weight: 600; }  /* utilities 层优先级最高 */
      }
      /* ===== 输出区 ===== */
      .layer-output {
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
    _readOverviewInfo() {
        const f = this._flags();
        try {
            return `===== CSS Cascade Layers @layer 概述 =====\n` +
                `\n` +
                `【规范归属】\n` +
                `  CSS Cascading and Inheritance Module Level 5（W3C CR 2024）\n` +
                `  规范地址：https://www.w3.org/TR/css-cascade-5/#layering\n` +
                `\n` +
                `【CSS 级联痛点】\n` +
                `  1. !important 滥用：为覆盖第三方库样式大量使用 !important，导致恶性循环\n` +
                `  2. 选择器特异性战争：用 .parent .child .deep 或 #id 提高特异性覆盖样式\n` +
                `  3. 第三方库覆盖难：Tailwind / Bootstrap 等框架样式难以确定性覆盖\n` +
                `  4. 代码顺序依赖：相同时同样特异性时依赖源码顺序，重构易破坏样式\n` +
                `  5. CSS-in-JS 与全局 CSS 冲突：动态生成的样式与静态 CSS 优先级混乱\n` +
                `\n` +
                `【@layer 解决方案】\n` +
                `  @layer 显式声明"级联层"，层优先级由声明顺序决定（后声明优先级更高）\n` +
                `  同层内按特异性 + 源码顺序（与无层时一致）\n` +
                `  unlayered 规则优先级最高（vs 普通 layered 规则）\n` +
                `  !important 在层中反转：低层 !important 反而优先级更高（保护底层库）\n` +
                `\n` +
                `【与 !important 关系】\n` +
                `  !important 仍然有效，但在 @layer 中优先级反转：\n` +
                `    普通规则：layerA < layerB（后声明优先级更高）\n` +
                `    !important 规则：layerA !important > layerB !important（反转！）\n` +
                `  这是为了允许底层库（如 reset）用 !important 保护关键样式不被上层应用覆盖\n` +
                `\n` +
                `【能力检测】\n` +
                `  CSS.supports('@layer base')                       = ${f.layerBase}\n` +
                `  CSS.supports('@layer base, theme, components')    = ${f.layerList}\n` +
                `  CSS.supports('@import "x.css" layer(base)')       = ${f.importLayer}\n` +
                `  typeof CSSLayerBlockRule                          = ${f.layerBlockRule}\n` +
                `  typeof CSSLayerStatementRule                      = ${f.layerStatementRule}\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  @layer —— Chrome 99+ / Edge 99+ / Firefox 97+ / Safari 15.4+（2022 年起）\n` +
                `  @import url() layer() —— 同上\n` +
                `  CSSLayerBlockRule / CSSLayerStatementRule CSSOM 接口 —— 同上\n` +
                `  老浏览器（Chrome < 99, Firefox < 97, Safari < 15.4）不支持，@layer 规则被忽略\n` +
                `    导致样式层顺序失效，需 fallback 双写规则\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 声明层顺序（优先级：reset < framework < components < utilities）*/\n` +
                `  @layer reset, framework, components, utilities;\n` +
                `\n` +
                `  @layer reset {\n` +
                `    * { margin: 0; padding: 0; box-sizing: border-box; }\n` +
                `  }\n` +
                `\n` +
                `  @layer framework {\n` +
                `    .btn { padding: 8px 16px; border-radius: 4px; }\n` +
                `  }\n` +
                `\n` +
                `  @layer components {\n` +
                `    .btn-primary { background: blue; color: white; }\n` +
                `  }\n` +
                `\n` +
                `  @layer utilities {\n` +
                `    .mt-4 { margin-top: 1rem; }  /* 优先级最高，确定性覆盖 */\n` +
                `  }`;
        }
        catch (err) {
            return `读取概述信息失败：${err.name} - ${err.message}`;
        }
    }
    _runOverviewDemo() {
        this.setState({ overviewInfo: this._readOverviewInfo() });
        const f = this._flags();
        this._addLog('overview', `能力检测汇总：@layer base=${f.layerBase}, @import layer()=${f.importLayer}, CSSLayerBlockRule=${f.layerBlockRule}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述与动机 —— CSS 级联痛点 / @layer 标准 / 浏览器支持',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['@layer', f.layerBase],
                ['@import layer()', f.importLayer],
                ['CSSLayerBlockRule', f.layerBlockRule],
            ]), h(Tag, { color: 'primary' }, 'CSS Cascade L5')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Cascading and Inheritance Level 5 引入 @layer 解决级联痛点：!important 滥用、选择器特异性战争、第三方库覆盖难、代码顺序依赖、CSS-in-JS 与全局 CSS 冲突。@layer 显式声明级联层，层优先级由声明顺序决定（后声明更高），同层内按特异性+源码顺序，unlayered 规则优先级最高。!important 在层中反转（低层 !important 优先级更高，保护底层库 reset）。浏览器支持：Chrome 99+/Firefox 97+/Safari 15.4+（2022 年起），老浏览器忽略 @layer 规则需 fallback 双写。CSSLayerBlockRule/CSSLayerStatementRule CSSOM 接口可遍历 document.styleSheets 查看层。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 @layer 全景）')),
                h(Alert, {
                    type: 'info',
                    message: '@layer 显式声明级联层，层优先级由声明顺序决定',
                    description: '解决 !important 滥用、特异性战争、第三方库覆盖难。声明顺序：@layer reset, framework, components, utilities; 后声明优先级更高。unlayered 规则优先级最高（vs 普通 layered 规则）。!important 在层中反转：低层 !important 优先级更高，保护底层库。Chrome 99+/Firefox 97+/Safari 15.4+ 支持。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：@layer 声明语法 ===================
    _readSyntaxInfo() {
        const f = this._flags();
        try {
            return `===== @layer 声明语法 =====\n` +
                `\n` +
                `【语法 1：命名层块 @layer name { ... }】\n` +
                `  @layer base {\n` +
                `    p { line-height: 1.6; }\n` +
                `    a { color: blue; }\n` +
                `  }\n` +
                `  规则归入名为 base 的层\n` +
                `\n` +
                `【语法 2：层顺序声明 @layer name1, name2, name3;】\n` +
                `  @layer reset, framework, components, utilities;\n` +
                `  仅声明层顺序，不含规则（规则可在后续 @layer 块中补充）\n` +
                `  优先级：reset < framework < components < utilities（后声明优先级更高）\n` +
                `  推荐放文件顶部，明确层顺序\n` +
                `\n` +
                `【语法 3：匿名层 @layer { ... }】\n` +
                `  @layer {\n` +
                `    .temp { color: red; }\n` +
                `  }\n` +
                `  规则归入匿名层，无法后续引用（无法 @import layer(name) 或嵌套）\n` +
                `  用于一次性样式隔离（如第三方库内部）\n` +
                `\n` +
                `【语法 4：嵌套层 @layer framework.components { ... }】\n` +
                `  @layer framework {\n` +
                `    @layer components {\n` +
                `      .btn { ... }\n` +
                `    }\n` +
                `  }\n` +
                `  等价于 @layer framework.components { .btn { ... } }\n` +
                `  嵌套层优先级：framework < framework.components（子层优先级高于父层）\n` +
                `  用于框架内部组织（如 Tailwind 内部 base/components/utilities）\n` +
                `\n` +
                `【隐式层（unlayered）】\n` +
                `  未分组的所有规则属于"隐式层"，优先级最高（vs 普通 layered 规则）\n` +
                `  即 .foo { color: red; }（无 @layer 包裹）优先级高于 @layer base { .foo { ... } }\n` +
                `  这让应用代码默认覆盖框架层样式\n` +
                `\n` +
                `【同名层合并】\n` +
                `  多个 @layer base { ... } 块会合并到同一个 base 层\n` +
                `  @layer base { a { color: red; } }\n` +
                `  @layer base { a { font-size: 14px; } }  /* 合并到 base 层 */\n` +
                `  合并后按源码顺序（与无层时一致）\n` +
                `\n` +
                `【当前演示】\n` +
                `  当前语法模式: ${this._syntaxMode}\n` +
                `  CSS.supports('@layer base')                    = ${f.layerBase}\n` +
                `  CSS.supports('@layer base, theme, components') = ${f.layerList}\n` +
                `  CSS.supports('@layer framework.components')    = ${f.layerNested}\n` +
                `  CSS.supports('@layer')                          = ${f.layerAnonymous}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 文件顶部声明层顺序 */\n` +
                `  @layer reset, base, theme, components, utilities;\n` +
                `\n` +
                `  /* 命名层块 */\n` +
                `  @layer reset {\n` +
                `    *, *::before, *::after { box-sizing: border-box; margin: 0; }\n` +
                `  }\n` +
                `\n` +
                `  @layer base {\n` +
                `    body { font-family: system-ui; line-height: 1.6; }\n` +
                `  }\n` +
                `\n` +
                `  /* 嵌套层 */\n` +
                `  @layer framework {\n` +
                `    @layer components { .card { padding: 1rem; } }\n` +
                `    @layer utilities { .mt-4 { margin-top: 1rem; } }\n` +
                `  }\n` +
                `  /* 等价于 */\n` +
                `  @layer framework.components { .card { padding: 1rem; } }\n` +
                `  @layer framework.utilities { .mt-4 { margin-top: 1rem; } }\n` +
                `\n` +
                `  /* 匿名层（一次性隔离）*/\n` +
                `  @layer {\n` +
                `    .temp-isolated { color: red; }\n` +
                `  }\n` +
                `\n` +
                `  /* 隐式层（unlayered，优先级最高）*/\n` +
                `  .app-override { color: blue; }  /* 覆盖所有 layered 规则 */`;
        }
        catch (err) {
            return `读取 @layer 语法信息失败：${err.name} - ${err.message}`;
        }
    }
    _setSyntaxMode(mode) {
        this._syntaxMode = mode;
        this.setState({ syntaxInfo: this._readSyntaxInfo() });
        this._addLog('syntax', `切换 @layer 语法模式 → ${mode}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. @layer 声明语法 —— 命名层 / 层顺序 / 匿名层 / 嵌套层',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@layer base', f.layerBase], ['嵌套层', f.layerNested]]), h(Tag, { color: 'primary' }, '4 种语法')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@layer 四种语法：命名层块 @layer name { ... }（规则归入 name 层）、层顺序声明 @layer name1, name2, name3;（仅声明顺序不含规则，后声明优先级更高）、匿名层 @layer { ... }（一次性隔离无法引用）、嵌套层 @layer framework.components { ... }（子层优先级高于父层，用于框架内部组织）。隐式层（unlayered）即未分组规则，优先级最高（vs 普通 layered 规则），让应用代码默认覆盖框架层。同名层合并：多个 @layer base { ... } 块合并到同一 base 层按源码顺序。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ syntaxInfo: this._readSyntaxInfo() }) }), this._btn('命名层', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setSyntaxMode('named') }), this._btn('层顺序', { size: 'sm', disabled: !f.layerList, onClick: () => this._setSyntaxMode('order') }), this._btn('匿名层', { size: 'sm', disabled: !f.layerAnonymous, onClick: () => this._setSyntaxMode('anonymous') }), this._btn('嵌套层', { size: 'sm', disabled: !f.layerNested, onClick: () => this._setSyntaxMode('nested') })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.syntaxInfo || '（点击按钮切换 @layer 语法模式查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: '推荐文件顶部 @layer name1, name2, ...; 明确层顺序',
                    description: '层顺序声明不含规则，仅确定优先级（后声明更高）。后续 @layer name { ... } 块补充规则。同名层合并按源码顺序。嵌套层 @layer framework.components 子层优先级高于父层。隐式层（unlayered）优先级最高，让应用代码默认覆盖框架层。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：层顺序与优先级 ===================
    _readOrderInfo() {
        const f = this._flags();
        try {
            const target = this.el && this.el?.querySelector('.order-target');
            let computed = '(未渲染)';
            if (target) {
                computed = window.getComputedStyle(target).getPropertyValue('background-color') || '(空)';
            }
            return `===== 层顺序与优先级 =====\n` +
                `\n` +
                `【优先级规则】\n` +
                `  1. 声明顺序决定层优先级：后声明的层优先级更高\n` +
                `     @layer a, b, c;  →  优先级：a < b < c\n` +
                `  2. 同层内按特异性（specificity）+ 源码顺序（与无层时一致）\n` +
                `  3. unlayered 规则优先级最高（vs 普通 layered 规则）\n` +
                `     即 .foo { color: red; }（无 @layer）优先级高于 @layer base { .foo { ... } }\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  /* 层顺序声明：layer-a < layer-b < layer-c */\n` +
                `  @layer layer-a, layer-b, layer-c;\n` +
                `  @layer layer-a  { .order-target { background: #ef4444; } }  /* 红：最低 */\n` +
                `  @layer layer-b  { .order-target { background: #10b981; } }  /* 绿：中 */\n` +
                `  @layer layer-c  { .order-target { background: #3b82f6; } }  /* 蓝：最高 layered */\n` +
                `  .order-target { background: #6366f1; }  /* 紫：unlayered，优先级最高 */\n` +
                `    background 计算值="${computed}"\n` +
                `  预期：紫色（#6366f1，unlayered 优先级最高）\n` +
                `  当前顺序模式: ${this._orderMode}\n` +
                `\n` +
                `【嵌套层内部排序】\n` +
                `  @layer framework {\n` +
                `    @layer base { .x { color: red; } }      /* framework.base */\n` +
                `    @layer components { .x { color: blue; } } /* framework.components */\n` +
                `  }\n` +
                `  优先级：framework < framework.base < framework.components\n` +
                `  子层优先级高于父层；同父层子层按声明顺序\n` +
                `\n` +
                `【@layer 重排序不可行】\n` +
                `  一旦声明 @layer a, b, c; 后续 @layer a, c, b; 不会重排序\n` +
                `  层顺序由"首次声明"决定，后续声明仅补充规则不改变顺序\n` +
                `  若需调整顺序，必须修改首次 @layer 声明（文件顶部）\n` +
                `\n` +
                `【unlayered 优先级最高原理】\n` +
                `  unlayered 规则视为"匿名层"，优先级高于所有显式层\n` +
                `  这让应用代码（通常不分组）默认覆盖框架层（分组到 base/framework）\n` +
                `  框架升级时不会意外覆盖应用样式\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  @layer reset, framework, components, utilities;\n` +
                `\n` +
                `  @layer reset {\n` +
                `    h1 { font-size: 2em; }  /* 优先级最低 */\n` +
                `  }\n` +
                `\n` +
                `  @layer framework {\n` +
                `    h1 { font-size: 1.5em; }  /* 覆盖 reset */\n` +
                `  }\n` +
                `\n` +
                `  @layer components {\n` +
                `    h1.title { font-size: 1.8em; }  /* 覆盖 framework */\n` +
                `  }\n` +
                `\n` +
                `  @layer utilities {\n` +
                `    .text-2xl { font-size: 1.5rem; }  /* 优先级最高（layered）*/\n` +
                `  }\n` +
                `\n` +
                `  h1 { font-size: 3em; }  /* unlayered，优先级最高，覆盖所有 layered */`;
        }
        catch (err) {
            return `读取层顺序信息失败：${err.name} - ${err.message}`;
        }
    }
    _setOrderMode(mode) {
        this._orderMode = mode;
        // 动态切换层顺序（注意：@layer 重排序不可行，这里通过动态注入新样式模拟）
        const map = {
            abc: `/* layer-a < layer-b < layer-c, unlayered 最高 */`,
            cba: `/* 演示：unlayered 始终最高，layered 顺序由首次声明决定 */`,
        };
        this._injectStyle('css-layer-order-dynamic', (map[mode]) || map.abc);
        this.setState({ orderInfo: this._readOrderInfo() });
        this._addLog('order', `切换层顺序模式 → ${mode}（注意：@layer 重排序不可行，顺序由首次声明决定）`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. 层顺序与优先级 —— 声明顺序 / unlayered 最高 / 嵌套排序',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@layer base', f.layerBase]]), h(Tag, { color: 'primary' }, '优先级规则')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '层优先级规则：1. 声明顺序决定层优先级（后声明更高），@layer a, b, c → a < b < c；2. 同层内按特异性+源码顺序（与无层时一致）；3. unlayered 规则优先级最高（vs 普通 layered 规则），让应用代码默认覆盖框架层。嵌套层内部排序：子层优先级高于父层（framework < framework.base < framework.components），同父层子层按声明顺序。@layer 重排序不可行：层顺序由"首次声明"决定，后续声明仅补充规则不改变顺序，调整需修改文件顶部 @layer 声明。unlayered 视为"匿名层"优先级高于所有显式层。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ orderInfo: this._readOrderInfo() }) }), this._btn('a<b<c', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setOrderMode('abc') }), this._btn('重排序说明', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setOrderMode('cba') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '层顺序演示（预期紫色 #6366f1，unlayered 优先级最高）：'),
                h('div', { class: 'layer-stage' }, h('div', { class: 'layer-demo-box order-target' }, '我的背景色 = unlayered 紫色 #6366f1（优先级最高，覆盖 layer-a/b/c）'), h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } }, 'layer-a 红 < layer-b 绿 < layer-c 蓝（layered 最高）< unlayered 紫（最高）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.orderInfo || '（点击按钮查看层顺序与优先级完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'unlayered 规则优先级最高，让应用代码默认覆盖框架层',
                    description: '声明顺序决定层优先级（后声明更高），同层内按特异性+源码顺序。嵌套层子层优先级高于父层。@layer 重排序不可行：层顺序由首次声明决定，调整需修改文件顶部 @layer 声明。unlayered 视为匿名层优先级最高，框架升级不会意外覆盖应用样式。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：!important 在层中的反转 ===================
    _readImportantInfo() {
        const f = this._flags();
        try {
            const target = this.el && this.el?.querySelector('.imp-target');
            let computed = '(未渲染)';
            if (target) {
                computed = window.getComputedStyle(target).getPropertyValue('background-color') || '(空)';
            }
            return `===== !important 在层中的反转 =====\n` +
                `\n` +
                `【反转规则】\n` +
                `  普通规则：层优先级越高越优先（layerA < layerB，layerB 胜出）\n` +
                `  !important 规则：层优先级越低越优先（layerA !important > layerB !important，反转！）\n` +
                `\n` +
                `【为什么反转】\n` +
                `  为了允许底层库（如 reset）用 !important 保护关键样式不被上层应用覆盖\n` +
                `  若不反转，应用层 @layer components { .x { color: red !important; } } 会覆盖\n` +
                `    reset 层 @layer reset { .x { color: blue !important; } }\n` +
                `  反转后 reset 层 !important 优先级更高，保护关键 reset 样式\n` +
                `\n` +
                `【与 specificity 解耦】\n` +
                `  @layer 内 !important 不依赖选择器特异性\n` +
                `  即 @layer low { #high-specificity !important } 仍可能输给 @layer lower { * !important }\n` +
                `  层优先级（反转后）决定 !important 胜负，特异性仅在同层内起作用\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  @layer imp-low, imp-high;\n` +
                `  @layer imp-low  { .imp-target { background: #ef4444 !important; } }  /* 红：低层 !important，反转后优先级最高 */\n` +
                `  @layer imp-high { .imp-target { background: #3b82f6 !important; } }  /* 蓝：高层 !important，反转后优先级较低 */\n` +
                `  .imp-target { background: #6366f1; }  /* 紫：unlayered 普通规则，优先级最低（被 !important 覆盖）*/\n` +
                `    background 计算值="${computed}"\n` +
                `  预期：红色 #ef4444（imp-low !important 反转后优先级最高）\n` +
                `  当前 !important 模式: ${this._importantMode}\n` +
                `\n` +
                `【完整优先级顺序（从低到高）】\n` +
                `  1. 普通规则（无 !important）按层顺序：layerA < layerB < ... < unlayered\n` +
                `  2. !important 规则反转层顺序：unlayered !important < ... < layerB !important < layerA !important\n` +
                `  即 !important 始终高于普通规则，但 !important 内部反转层顺序\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  @layer reset, app;\n` +
                `\n` +
                `  @layer reset {\n` +
                `    /* reset 层 !important 优先级最高（反转保护）*/\n` +
                `    * { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }\n` +
                `  }\n` +
                `\n` +
                `  @layer app {\n` +
                `    /* app 层 !important 优先级低于 reset（反转）*/\n` +
                `    .container { padding: 1rem !important; }  /* 不会覆盖 reset 的 padding: 0 !important */\n` +
                `  }\n` +
                `\n` +
                `  /* unlayered 普通规则（优先级低于任何 !important）*/\n` +
                `  .box { padding: 2rem; }  /* 被 reset !important 覆盖 */\n` +
                `\n` +
                `  /* unlayered !important（优先级低于 layered !important，反转）*/\n` +
                `  .box { padding: 3rem !important; }  /* 仍输给 reset !important */`;
        }
        catch (err) {
            return `读取 !important 反转信息失败：${err.name} - ${err.message}`;
        }
    }
    _setImportantMode(mode) {
        this._importantMode = mode;
        this.setState({ importantInfo: this._readImportantInfo() });
        this._addLog('important', `切换 !important 模式 → ${mode}（层中 !important 优先级反转，低层胜出）`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. !important 在层中的反转 —— 低层 !important 优先级更高',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@layer base', f.layerBase]]), h(Tag, { color: 'warning' }, '!important 反转')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '!important 在 @layer 中优先级反转：普通规则下层优先级越高越优先（layerA < layerB），!important 规则下层优先级越低越优先（layerA !important > layerB !important，反转！）。原因：允许底层库（reset）用 !important 保护关键样式不被上层应用覆盖。与 specificity 解耦：层优先级（反转后）决定 !important 胜负，特异性仅在同层内起作用。完整优先级：普通规则按层顺序（layerA < ... < unlayered）< !important 规则反转层顺序（unlayered !important < ... < layerA !important）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ importantInfo: this._readImportantInfo() }) }), this._btn('normal', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setImportantMode('normal') }), this._btn('反转演示', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setImportantMode('reversed') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '!important 反转演示（预期红色 #ef4444，imp-low !important 反转后最高）：'),
                h('div', { class: 'layer-stage' }, h('div', { class: 'layer-demo-box imp-target' }, '我的背景色 = 红色 #ef4444（imp-low !important 反转后优先级最高）'), h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } }, 'imp-low !important（红，反转后最高）> imp-high !important（蓝）> unlayered 普通（紫，被 !important 覆盖）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.importantInfo || '（点击按钮查看 !important 反转完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: '!important 在 @layer 中反转，低层 !important 优先级更高',
                    description: '反转目的：保护底层库（reset）关键样式不被上层应用覆盖。与 specificity 解耦：层优先级（反转后）决定 !important 胜负。完整优先级：普通规则按层顺序 < !important 规则反转层顺序。这让 reset !important 始终胜出，应用层 !important 无法破坏 reset。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：@import 与 layer ===================
    _readImportInfo() {
        const f = this._flags();
        try {
            return `===== @import 与 layer =====\n` +
                `\n` +
                `【语法】\n` +
                `  @import url("framework.css") layer(framework);\n` +
                `  @import "tailwind.css" layer(tailwind);\n` +
                `  /* 第三方 CSS 强制归入特定层，便于控制优先级 */\n` +
                `\n` +
                `【第三方 CSS 强制归层】\n` +
                `  问题：第三方 CSS（Tailwind/Bootstrap）默认 unlayered，优先级最高\n` +
                `    导致应用样式难以覆盖\n` +
                `  解决：@import url("tailwind.css") layer(vendor);\n` +
                `    将 Tailwind 归入 vendor 层，优先级低于应用层\n` +
                `  这样应用 @layer app { ... } 可确定性覆盖 Tailwind\n` +
                `\n` +
                `【Tailwind / CSS 框架集成】\n` +
                `  Tailwind v3+：@import "tailwindcss" layer(tailwind);\n` +
                `  Tailwind v4 内置 @layer base/components/utilities\n` +
                `  Bootstrap：@import "bootstrap.css" layer(bootstrap);\n` +
                `  应用层 @layer components { .btn { ... } } 覆盖框架\n` +
                `\n` +
                `【@import 顺序约束】\n` +
                `  @import 必须在文件顶部（除 @charset 和 @layer 声明外）\n` +
                `  即所有 @import 必须在其他规则之前\n` +
                `  若 @import 在其他规则后，浏览器忽略该 @import\n` +
                `  示例（错误）：\n` +
                `    body { color: red; }\n` +
                `    @import "x.css";  /* ⚠ 被忽略！*/\n` +
                `  示例（正确）：\n` +
                `    @layer base, app;\n` +
                `    @import "x.css" layer(base);\n` +
                `    @layer app { body { color: red; } }\n` +
                `\n` +
                `【当前演示】\n` +
                `  当前 @import 模式: ${this._importMode}\n` +
                `  CSS.supports('@import "x.css" layer(base)') = ${f.importLayer}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* main.css 顶部 */\n` +
                `  @layer reset, tailwind, bootstrap, components, utilities, app;\n` +
                `\n` +
                `  /* 第三方 CSS 归入低优先级层 */\n` +
                `  @import "tailwindcss/preflight.css" layer(tailwind);\n` +
                `  @import "bootstrap.css" layer(bootstrap);\n` +
                `\n` +
                `  /* 应用层覆盖框架 */\n` +
                `  @layer components {\n` +
                `    .btn-primary {\n` +
                `      background: var(--brand);\n` +
                `      /* 确定性覆盖 Tailwind .bg-blue-500 */\n` +
                `    }\n` +
                `  }\n` +
                `\n` +
                `  @layer app {\n` +
                `    /* 优先级最高（layered），覆盖所有框架层 */\n` +
                `    .custom { color: var(--text); }\n` +
                `  }\n` +
                `\n` +
                `  /* unlayered 规则（优先级最高，谨慎使用）*/\n` +
                `  .critical { color: red !important; }`;
        }
        catch (err) {
            return `读取 @import layer 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setImportMode(mode) {
        this._importMode = mode;
        this.setState({ importInfo: this._readImportInfo() });
        this._addLog('import', `切换 @import layer 模式 → ${mode}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. @import 与 layer —— 第三方 CSS 归层 / 框架集成',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@import layer()', f.importLayer]]), h(Tag, { color: 'primary' }, '框架集成')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@import url("framework.css") layer(name) 将第三方 CSS 强制归入特定层，便于控制优先级。问题：第三方 CSS（Tailwind/Bootstrap）默认 unlayered 优先级最高，应用样式难覆盖；解决：@import "tailwind.css" layer(vendor) 归入 vendor 层优先级低于应用层。Tailwind v3+ 推荐 @import "tailwindcss" layer(tailwind)，Tailwind v4 内置 @layer base/components/utilities。@import 顺序约束：必须在文件顶部（除 @charset 和 @layer 声明外），其他规则后 @import 被浏览器忽略。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ importInfo: this._readImportInfo() }) }), this._btn('Tailwind', { size: 'sm', disabled: !f.importLayer, onClick: () => this._setImportMode('tailwind') }), this._btn('Bootstrap', { size: 'sm', disabled: !f.importLayer, onClick: () => this._setImportMode('bootstrap') }), this._btn('多框架', { size: 'sm', disabled: !f.importLayer, onClick: () => this._setImportMode('multi') })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.importInfo || '（点击按钮查看 @import layer 完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: '@import url() layer(name) 将第三方 CSS 归入特定层，应用层可确定性覆盖',
                    description: '第三方 CSS 默认 unlayered 优先级最高，归入 vendor 层后优先级低于应用层。Tailwind v3+ 推荐 @import "tailwindcss" layer(tailwind)。@import 必须在文件顶部（除 @charset/@layer 声明外），其他规则后 @import 被忽略。多框架集成：@layer reset, tailwind, bootstrap, components, utilities, app; 明确层顺序。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：cascade-layer() 条件 ===================
    _readConditionalInfo() {
        const f = this._flags();
        try {
            return `===== cascade-layer() 条件与动态层 =====\n` +
                `\n` +
                `【@supports cascade-layer() 检测】\n` +
                `  @supports (cascade-layer: base) {\n` +
                `    /* 浏览器支持 @layer 时执行 */\n` +
                `    @layer base { ... }\n` +
                `  }\n` +
                `  CSS.supports('@layer base') 检测同义\n` +
                `\n` +
                `【@media 嵌套 @layer】\n` +
                `  @media (min-width: 600px) {\n` +
                `    @layer responsive {\n` +
                `      .container { max-width: 720px; }\n` +
                `    }\n` +
                `  }\n` +
                `  媒体查询内声明层，仅在匹配时生效\n` +
                `  用于响应式层（如移动端隐藏桌面端样式）\n` +
                `\n` +
                `【动态层优先级】\n` +
                `  层顺序由首次 @layer 声明决定，但可通过 @media 动态启用/禁用层内规则\n` +
                `  示例：\n` +
                `    @layer mobile, desktop;\n` +
                `    @media (max-width: 600px) {\n` +
                `      @layer mobile { .nav { display: block; } }\n` +
                `    }\n` +
                `    @media (min-width: 601px) {\n` +
                `      @layer desktop { .nav { display: flex; } }\n` +
                `    }\n` +
                `  不同视口启用不同层，避免冲突\n` +
                `\n` +
                `【与容器查询结合】\n` +
                `  @container (min-width: 400px) {\n` +
                `    @layer card { .card { padding: 1rem; } }\n` +
                `  }\n` +
                `  容器查询内声明层，容器尺寸匹配时生效\n` +
                `  用于组件级响应式层\n` +
                `\n` +
                `【当前演示】\n` +
                `  当前条件模式: ${this._conditionalMode}\n` +
                `  CSS.supports('@layer base') = ${f.layerBase}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* @supports 检测 + fallback 双写 */\n` +
                `  .btn { padding: 8px; }  /* fallback */\n` +
                `\n` +
                `  @supports (cascade-layer: base) {\n` +
                `    @layer base, components;\n` +
                `    @layer base { .btn { padding: 8px; } }\n` +
                `    @layer components { .btn-primary { color: blue; } }\n` +
                `  }\n` +
                `\n` +
                `  /* 响应式层 */\n` +
                `  @layer mobile, desktop;\n` +
                `  @media (max-width: 768px) {\n` +
                `    @layer mobile {\n` +
                `      .grid { display: block; }\n` +
                `      .sidebar { display: none; }\n` +
                `    }\n` +
                `  }\n` +
                `  @media (min-width: 769px) {\n` +
                `    @layer desktop {\n` +
                `      .grid { display: grid; grid-template-columns: 1fr 3fr; }\n` +
                `    }\n` +
                `  }\n` +
                `\n` +
                `  /* 容器查询内层 */\n` +
                `  @container (min-width: 400px) {\n` +
                `    @layer card-large {\n` +
                `      .card { padding: 2rem; font-size: 1.2rem; }\n` +
                `    }\n` +
                `  }`;
        }
        catch (err) {
            return `读取 cascade-layer 条件信息失败：${err.name} - ${err.message}`;
        }
    }
    _setConditionalMode(mode) {
        this._conditionalMode = mode;
        this.setState({ conditionalInfo: this._readConditionalInfo() });
        this._addLog('conditional', `切换 cascade-layer 条件模式 → ${mode}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. cascade-layer() 条件 —— @supports / @media / 容器查询结合',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@layer base', f.layerBase]]), h(Tag, { color: 'primary' }, '条件层')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'cascade-layer() 条件检测：@supports (cascade-layer: base) { @layer base { ... } } 浏览器支持时执行（CSS.supports(\'@layer base\') 同义）。@media 嵌套 @layer：@media (min-width: 600px) { @layer responsive { ... } } 媒体查询内声明层仅匹配时生效，用于响应式层。动态层优先级：层顺序由首次声明决定，但 @media 可动态启用/禁用层内规则（如 mobile/desktop 不同视口启用不同层避免冲突）。与容器查询结合：@container (min-width: 400px) { @layer card { ... } } 组件级响应式层。@supports 检测 + fallback 双写保证兼容性。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ conditionalInfo: this._readConditionalInfo() }) }), this._btn('@supports', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setConditionalMode('supports') }), this._btn('@media', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setConditionalMode('media') }), this._btn('@container', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setConditionalMode('container') })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.conditionalInfo || '（点击按钮查看 cascade-layer 条件完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: '@supports (cascade-layer: base) 检测 + fallback 双写保证兼容性',
                    description: '@media 嵌套 @layer 用于响应式层（mobile/desktop 不同视口启用不同层）。容器查询内 @layer 用于组件级响应式。@supports cascade-layer() 检测后双写规则：先 fallback（无 @layer），再 @layer 块（支持时覆盖），保证老浏览器正常显示。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：实战架构模式 ===================
    _readPatternsInfo() {
        const f = this._flags();
        try {
            const box = this.el && this.el?.querySelector('.arch-box');
            let computedColor = '(未渲染)';
            let computedRadius = '(未渲染)';
            if (box) {
                const cs = window.getComputedStyle(box);
                computedColor = cs.getPropertyValue('color') || '(空)';
                computedRadius = cs.getPropertyValue('border-radius') || '(空)';
            }
            return `===== 实战架构模式 =====\n` +
                `\n` +
                `【模式 1：reset → framework → components → utilities 四层架构】\n` +
                `  @layer reset, framework, components, utilities;\n` +
                `  @layer reset { * { margin: 0; box-sizing: border-box; } }\n` +
                `  @layer framework { .btn { padding: 8px; } }\n` +
                `  @layer components { .btn-primary { background: blue; } }\n` +
                `  @layer utilities { .mt-4 { margin-top: 1rem; } }  /* 优先级最高 */\n` +
                `  最经典架构，Tailwind/Bootstrap 推荐\n` +
                `\n` +
                `【模式 2：与 Tailwind utilities 层协同】\n` +
                `  @import "tailwindcss" layer(tailwind);\n` +
                `  @layer base, tailwind, components, utilities;\n` +
                `  @layer base { body { font-family: system-ui; } }\n` +
                `  @layer components { .btn { @apply bg-blue-500; } }  /* 覆盖 Tailwind */\n` +
                `  @layer utilities { .text-brand { color: var(--brand); } }  /* 最高优先级 */\n` +
                `\n` +
                `【模式 3：CSS-in-JS 集成】\n` +
                `  // Emotion / styled-components 注入的样式默认 unlayered（优先级最高）\n` +
                `  // 可通过 @layer 降低优先级\n` +
                `  const Button = styled.button\`\n` +
                `    @layer components {\n` +
                `      background: blue;\n` +
                `      color: white;\n` +
                `    }\n` +
                `  \`;\n` +
                `  // 让 CSS-in-JS 样式归入 components 层，可被 utilities 覆盖\n` +
                `\n` +
                `【模式 4：BEM 命名空间与层映射】\n` +
                `  @layer base, components, utilities;\n` +
                `  @layer components {\n` +
                `    .card { ... }              /* block */\n` +
                `    .card__title { ... }       /* element */\n` +
                `    .card--featured { ... }    /* modifier */\n` +
                `  }\n` +
                `  BEM 命名 + @layer 双重隔离，避免特异性战争\n` +
                `\n` +
                `【模式 5：第三方库「降级」到低优先级层】\n` +
                `  @layer reset, vendor, framework, app;\n` +
                `  @import "animate.css" layer(vendor);  /* 动画库降级 */\n` +
                `  @import "normalize.css" layer(reset);\n` +
                `  @layer app { .custom-anim { animation: my-anim; } }  /* 覆盖 vendor */\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  @layer reset, framework, components, utilities;\n` +
                `  @layer reset      { .arch-box { margin: 0; box-sizing: border-box; } }\n` +
                `  @layer framework  { .arch-box { padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; } }\n` +
                `  @layer components { .arch-box { border-radius: 6px; font-size: 13px; }\n` +
                `  @layer utilities  { .arch-box { color: #1e40af; font-weight: 600; } }  /* 最高优先级 */\n` +
                `    color 计算值="${computedColor}"\n` +
                `    border-radius 计算值="${computedRadius}"\n` +
                `  预期：color=#1e40af（utilities 层），border-radius=6px（components 层）\n` +
                `  当前架构模式: ${this._patternsMode}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 推荐项目结构：styles/main.css 顶部 */\n` +
                `  @layer reset, vendor, base, components, utilities, app;\n` +
                `\n` +
                `  /* 第三方库归低优先级层 */\n` +
                `  @import "normalize.css" layer(reset);\n` +
                `  @import "tailwindcss" layer(vendor);\n` +
                `  @import "animate.css" layer(vendor);\n` +
                `\n` +
                `  /* 应用基础样式 */\n` +
                `  @layer base {\n` +
                `    body { font-family: system-ui; line-height: 1.6; }\n` +
                `    a { color: var(--brand); }\n` +
                `  }\n` +
                `\n` +
                `  /* 组件层（覆盖 vendor）*/\n` +
                `  @layer components {\n` +
                `    .btn { padding: 0.5rem 1rem; border-radius: 0.25rem; }\n` +
                `    .btn-primary { background: var(--brand); color: white; }\n` +
                `  }\n` +
                `\n` +
                `  /* 工具类层（最高优先级 layered）*/\n` +
                `  @layer utilities {\n` +
                `    .mt-4 { margin-top: 1rem; }\n` +
                `    .text-center { text-align: center; }\n` +
                `  }\n` +
                `\n` +
                `  /* 应用层（覆盖所有 layered，但低于 unlayered）*/\n` +
                `  @layer app {\n` +
                `    .app-specific { /* 应用特定覆盖 */ }\n` +
                `  }`;
        }
        catch (err) {
            return `读取实战架构模式信息失败：${err.name} - ${err.message}`;
        }
    }
    _setPatternsMode(mode) {
        this._patternsMode = mode;
        this.setState({ patternsInfo: this._readPatternsInfo() });
        this._addLog('patterns', `切换架构模式 → ${mode}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 实战架构模式 —— 四层架构 / Tailwind / CSS-in-JS / BEM / 降级',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@layer base', f.layerBase]]), h(Tag, { color: 'primary' }, '5 大模式')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '五大架构模式：1. reset→framework→components→utilities 四层架构（最经典，Tailwind/Bootstrap 推荐）；2. 与 Tailwind utilities 层协同（@import "tailwindcss" layer(tailwind) + @layer components 覆盖）；3. CSS-in-JS 集成（styled-components @layer components 让样式归层可被 utilities 覆盖）；4. BEM 命名空间与层映射（block/element/modifier + @layer 双重隔离）；5. 第三方库降级到低优先级层（@import "animate.css" layer(vendor) 让应用层可覆盖）。推荐项目结构：@layer reset, vendor, base, components, utilities, app; 明确层顺序。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ patternsInfo: this._readPatternsInfo() }) }), this._btn('四层架构', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setPatternsMode('four-layer') }), this._btn('Tailwind', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setPatternsMode('tailwind') }), this._btn('CSS-in-JS', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setPatternsMode('css-in-js') }), this._btn('降级第三方', { size: 'sm', disabled: !f.layerBase, onClick: () => this._setPatternsMode('vendor') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '四层架构演示（预期 color=#1e40af utilities 层，border-radius=6px components 层）：'),
                h('div', { class: 'layer-stage' }, h('div', { class: 'layer-demo-box arch-box' }, '我是 .arch-box，样式来自 reset + framework + components + utilities 四层叠加\nutilities 层 color=#1e40af font-weight=600 优先级最高（layered）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.patternsInfo || '（点击按钮查看 5 大架构模式完整代码）')),
                h(Alert, {
                    type: 'success',
                    message: '推荐 @layer reset, vendor, base, components, utilities, app; 项目结构',
                    description: '四层架构最经典（reset→framework→components→utilities）。Tailwind 协同：@import layer(tailwind) + @layer components 覆盖。CSS-in-JS 用 @layer components 归层可被 utilities 覆盖。BEM + @layer 双重隔离。第三方库 @import layer(vendor) 降级让应用层覆盖。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 8：陷阱与最佳实践 ===================
    _readPitfallsInfo() {
        const f = this._flags();
        try {
            return `===== 陷阱与最佳实践 =====\n` +
                `\n` +
                `【陷阱 1：层命名约定】\n` +
                `  缺乏命名约定导致层混乱（base/foundation/reset 谁优先？）\n` +
                `  最佳实践：采用行业通用命名 reset→framework→components→utilities\n` +
                `  团队约定层名，文档化层顺序与职责\n` +
                `\n` +
                `【陷阱 2：过度细分层导致维护负担】\n` +
                `  错误：@layer a, b, c, d, e, f, g, h, i, j;  /* 10 层 */\n` +
                `  层过多难以追踪优先级，维护成本高\n` +
                `  最佳实践：3-6 层为宜（reset/vendor/base/components/utilities/app）\n` +
                `  嵌套层用于框架内部，应用层保持扁平\n` +
                `\n` +
                `【陷阱 3：与 CSS Modules 互操作】\n` +
                `  CSS Modules 默认生成局部类名（.button_xxx），通常 unlayered\n` +
                `  问题：CSS Modules 样式优先级高于 @layer（unlayered 最高）\n` +
                `  解决：CSS Modules 配置 generateLayerName 归层\n` +
                `    // webpack.config.js\n` +
                `    modules: { mode: 'local', autoLayer: true, layer: 'components' }\n` +
                `  或手动包裹 @layer components { .button { ... } }\n` +
                `\n` +
                `【陷阱 4：DevTools 查看层顺序】\n` +
                `  Chrome DevTools 96+：Styles 面板显示 @layer 分组\n` +
                `  查看层顺序：Elements → Styles → 滚动到顶部，按层分组显示\n` +
                `  Firefox DevTools：类似，Rules 面板显示层\n` +
                `  也可通过 document.styleSheets 遍历 CSSLayerBlockRule/CSSLayerStatementRule\n` +
                `\n` +
                `【陷阱 5：兼容性 fallback（双写规则）】\n` +
                `  老浏览器（Chrome < 99, Firefox < 97, Safari < 15.4）忽略 @layer\n` +
                `  导致层顺序失效，样式可能错乱\n` +
                `  解决：双写规则 + @supports 检测\n` +
                `  .btn { padding: 8px; }  /* fallback（无 @layer）*/\n` +
                `  @supports (cascade-layer: base) {\n` +
                `    @layer base, components;\n` +
                `    @layer base { .btn { padding: 8px; } }\n` +
                `    @layer components { .btn-primary { color: blue; } }\n` +
                `  }\n` +
                `\n` +
                `【陷阱 6：与 @scope 关系】\n` +
                `  @scope（CSS Scope L1）限定选择器作用域：@scope (.card) { .title { ... } }\n` +
                `  @layer 控制优先级，@scope 控制作用域，两者正交\n` +
                `  可组合：@layer components { @scope (.card) { .title { ... } } }\n` +
                `  @scope 仍在草案（Chrome 118+ 实验），生产慎用\n` +
                `\n` +
                `【陷阱 7：@import 顺序约束易违反】\n` +
                `  @import 必须在文件顶部（除 @charset/@layer 声明外）\n` +
                `  其他规则后的 @import 被浏览器忽略（静默失败）\n` +
                `  最佳实践：所有 @import 集中在 main.css 顶部\n` +
                `\n` +
                `【陷阱 8：unlayered 规则意外覆盖】\n` +
                `  unlayered 规则优先级最高，可能意外覆盖 layered 框架样式\n` +
                `  最佳实践：应用代码也归入 @layer app { ... }，避免 unlayered\n` +
                `  仅"关键覆盖"用 unlayered（如 .critical { color: red !important; }）\n` +
                `\n` +
                `【最佳实践清单】\n` +
                `  ✓ 文件顶部 @layer name1, name2, ...; 明确层顺序\n` +
                `  ✓ 3-6 层为宜（reset/vendor/base/components/utilities/app）\n` +
                `  ✓ 第三方库 @import url() layer(vendor) 降级\n` +
                `  ✓ 应用代码归入 @layer app，避免 unlayered 意外覆盖\n` +
                `  ✓ !important 仅在底层库（reset）保护关键样式\n` +
                `  ✓ @supports (cascade-layer: base) 检测 + 双写 fallback\n` +
                `  ✓ CSS Modules 配置归层或手动包裹 @layer\n` +
                `  ✓ DevTools 查看层顺序，document.styleSheets 遍历 CSSLayerBlockRule\n` +
                `  ✓ @import 集中文件顶部，避免静默失败\n` +
                `  ✓ 与 @scope 正交可组合（@scope 仍实验性）\n` +
                `\n` +
                `【能力检测汇总】\n` +
                `  @layer base                  = ${f.layerBase}\n` +
                `  @layer base, theme, ...      = ${f.layerList}\n` +
                `  @import "x.css" layer(base)  = ${f.importLayer}\n` +
                `  CSSLayerBlockRule            = ${f.layerBlockRule}\n` +
                `  CSSLayerStatementRule        = ${f.layerStatementRule}`;
        }
        catch (err) {
            return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPitfallsDemo() {
        this.setState({ pitfallsInfo: this._readPitfallsInfo() });
        const f = this._flags();
        this._addLog('pitfalls', `陷阱与最佳实践演示：@layer=${f.layerBase}, @import layer()=${f.importLayer}, CSSLayerBlockRule=${f.layerBlockRule}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 陷阱与最佳实践 —— 命名 / 细分层 / CSS Modules / DevTools / fallback',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@layer', f.layerBase], ['CSSLayerBlockRule', f.layerBlockRule]]), h(Tag, { color: 'warning' }, '8 大陷阱')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '八大陷阱与最佳实践：1. 层命名约定（采用 reset→framework→components→utilities 行业通用命名）；2. 过度细分层（3-6 层为宜，嵌套层用于框架内部）；3. CSS Modules 互操作（配置 generateLayerName 归层或手动 @layer 包裹）；4. DevTools 查看层顺序（Chrome 96+ Styles 面板分组，document.styleSheets 遍历 CSSLayerBlockRule）；5. 兼容性 fallback（@supports cascade-layer() 检测 + 双写规则）；6. 与 @scope 关系（@layer 控制优先级，@scope 控制作用域，正交可组合）；7. @import 顺序约束（必须文件顶部，其他规则后静默失败）；8. unlayered 意外覆盖（应用代码归 @layer app 避免意外）。10 条最佳实践清单。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.pitfallsInfo || '（点击按钮查看 8 大陷阱与 10 条最佳实践完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: '老浏览器忽略 @layer 需 @supports 检测 + 双写 fallback',
                    description: '陷阱清单：层命名约定（行业通用 reset→framework→components→utilities）；过度细分层（3-6 层为宜）；CSS Modules 归层配置；DevTools 查看层顺序；@supports cascade-layer() 检测 + 双写 fallback；@scope 正交可组合（仍实验性）；@import 文件顶部约束；unlayered 意外覆盖（应用归 @layer app）。最佳实践 10 条覆盖命名/细分/归层/检测/DevTools/兼容性。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.slice().reverse().map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'api-lab-page css-cascade-layers-page' }, h('h2', { class: 'section-title' }, 'CSS Cascade Layers @layer 深度实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 CSS Cascading and Inheritance Level 5 的 @layer 级联层：@layer 声明语法（命名层/层顺序/匿名层/嵌套层）、层顺序与优先级（声明顺序/unlayered 最高/嵌套排序）、!important 在层中的反转（低层 !important 优先级更高保护底层库）、@import 与 layer（第三方 CSS 归层/Tailwind 集成）、cascade-layer() 条件（@supports/@media/容器查询）、5 大实战架构模式（四层架构/Tailwind/CSS-in-JS/BEM/降级）、8 大陷阱与最佳实践。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSCascadeLayersPage.js.map