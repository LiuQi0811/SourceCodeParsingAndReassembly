// =====================================================================
// DecoratorsResourceManagementPage.js —— TC39 Stage 3 装饰器与资源管理 完整实验室
// 演示 TC39 Stage 3 前瞻性语言特性：Decorators 装饰器 + Explicit Resource
// Management（using / await using）的全套能力：
//   1. 概述与动机 —— TC39 Stage 3 前瞻性语言特性 / Decorators 装饰器
//      （历史演进：legacy → stage 2 → stage 3）/ Explicit Resource
//      Management using/await using / ES2025 未收录 / 浏览器支持 Chrome
//      flag / TypeScript 5.0+/Babel 转译 / 与 ES2022 装饰器元数据提案
//   2. Decorators 语法与种类 —— @decorator class / @decorator method /
//      @decorator field / @decorator accessor / @decorator getter/setter
//      / 装饰器工厂 @dec(args) / 多装饰器叠加 / 装饰器执行顺序
//   3. 装饰器实现 API —— type Decorator = (value: any, context: any) => value |
//      { get, set } | void / context: { kind, name, access,
//      addInitializer, metadata, private } / kind: class/method/field/
//      accessor/getter/setter / 返回值规则
//   4. 类装饰器与方法装饰器 —— @logged 日志 / @bound 自动 bind /
//      @deprecated 标记废弃 / @memoize 缓存 / @debounce 防抖 /
//      实战装饰器集合
//   5. 字段与访问器装饰器 —— @field 装饰器 / accessor 关键字
//      @accessor 自定义 getter/setter / 与 Object.defineProperty 协同 /
//      初始化器 addInitializer / 静态字段装饰器
//   6. Explicit Resource Management —— using x = createResource() /
//      await using y = createAsyncResource() / Symbol.dispose /
//      Symbol.asyncDispose / DisposableStack / AsyncDisposableStack /
//      资源栈 LIFO 释放
//   7. 实战：using 资源管理 —— 数据库连接 using db = acquireConn() /
//      文件句柄 / 锁 using lock = await navigator.locks.request() /
//      事务 scope / 自动释放避免泄漏
//   8. 陷阱与最佳实践 —— 装饰器不能用于普通函数（仅类成员）/ this 绑定
//      问题 / metadata 元数据提案 / 与 legacy 装饰器不兼容 / using 必须
//      在块作用域 / 异常时仍会 dispose / 性能考虑 / 转译工具链配置
// 说明：所有特性调用前做 typeof / in / new Function 语法探测能力检测，
//       不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。jsdom/Node
//       通常不支持装饰器与 using 语法（需 Babel/TS 转译），所有能力检测
//       统一兜底返回 false；真实浏览器 Chrome flag 或 TS 5.0+/Babel 转译
//       后可运行。注入演示样式 + 完整代码示例，所有装饰器代码以字符串
//       形式展示（避免源码本身依赖未转译语法）。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class DecoratorsResourceManagementPage extends Page {
    __disposed;
    _decoratorCallLog;
    _disposableStack;
    _dynamicStyles;
    _inited;
    _memoizeCache;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概述与动机
            syntaxInfo: '', // Card 2：Decorators 语法与种类
            apiInfo: '', // Card 3：装饰器实现 API
            classMethodInfo: '', // Card 4：类装饰器与方法装饰器
            fieldAccessorInfo: '', // Card 5：字段与访问器装饰器
            resourceInfo: '', // Card 6：Explicit Resource Management
            usingInfo: '', // Card 7：实战 using 资源管理
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
        this._disposableStack = []; // 模拟资源栈（LIFO 释放记录）
        this._decoratorCallLog = []; // 装饰器调用记录（模拟）
        this._memoizeCache = new Map(); // @memoize 模拟缓存
        // 一次性能力检测：装饰器与资源管理全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `class ${c(f.classSupport)}`,
            `decorator ${c(f.decoratorSupport)}`,
            `using ${c(f.usingSupport)}`,
            `await using ${c(f.awaitUsingSupport)}`,
            `Symbol.dispose ${c(f.symbolDispose)}`,
            `Symbol.asyncDispose ${c(f.symbolAsyncDispose)}`,
            `DisposableStack ${c(f.disposableStack)}`,
            `AsyncDisposableStack ${c(f.asyncDisposableStack)}`,
            `SuppressedError ${c(f.suppressedError)}`,
            `Reflect.metadata ${c(f.reflectMetadata)}`,
        ];
        const anySupported = f.symbolDispose || f.disposableStack || f.decoratorSupport || f.usingSupport;
        const summary = anySupported
            ? `TC39 Stage 3 装饰器与资源管理能力检测：${parts.join(' · ')}。当前环境部分支持（详见各能力）。装饰器与 using 为 TC39 Stage 3 前瞻特性，ES2025 未收录，需 Chrome flag 或 TypeScript 5.0+/Babel 转译。点击「运行演示」查看代码示例与模拟流程。`
            : '当前环境不支持装饰器与 using 语法（jsdom/Node 未启用，需 Chrome flag 或 TypeScript 5.0+/Babel 转译）；所有按钮点击将仅记日志说明（部分用模拟流程演示），不会抛异常。在启用了相应 flag 的 Chrome 或经 Babel/TS 转译的环境中可完整运行。';
        this.setState({ capsSummary: summary });
        this._addLog(anySupported ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.decoratorSupport)
            this._addLog('warn', '装饰器语法不可用（TC39 Stage 3，需 Chrome flag 或 TS 5.0+/Babel 转译；与 legacy 装饰器不兼容）');
        if (!f.usingSupport)
            this._addLog('warn', 'using 语法不可用（Explicit Resource Management 提案，需 Chrome flag 或 TS 5.6+/Babel 转译）');
        if (!f.symbolDispose)
            this._addLog('warn', 'Symbol.dispose 不可用（using 依赖的 well-known symbol，Chrome 124+ 起 flag 可用）');
        if (!f.disposableStack)
            this._addLog('warn', 'DisposableStack 不可用（资源栈 API，Chrome 124+ 起 flag 可用）');
        // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        this._destroyed = true;
        // 移除动态创建的 <style> 元素，便于 GC
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
        // 模拟资源栈 LIFO 释放（卸载时清空缓存）
        this._disposableStack = [];
        this._decoratorCallLog = [];
        if (this._memoizeCache)
            this._memoizeCache.clear();
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
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
    // 用 safe(()=>...) 包裹，jsdom/Node 不可用时返回 false
    _flags() {
        const safe = (fn) => { try {
            return fn();
        }
        catch {
            return false;
        } };
        // new Function 仅做语法解析探测（不执行）， SyntaxError 时返回 false
        const parses = (code) => safe(() => {
            // eslint-disable-next-line no-new-func
            new Function(code);
            return true;
        });
        return {
            classSupport: parses('class A {}'),
            decoratorSupport: parses('function dec(v){return v} @dec class A {}'),
            usingSupport: parses('using x = { [Symbol.dispose](){} };'),
            awaitUsingSupport: parses('await using x = { [Symbol.asyncDispose](){} };'),
            symbolDispose: safe(() => typeof Symbol !== 'undefined' && typeof Symbol.dispose === 'symbol'),
            symbolAsyncDispose: safe(() => typeof Symbol !== 'undefined' && typeof Symbol.asyncDispose === 'symbol'),
            disposableStack: safe(() => typeof window !== 'undefined' && typeof window.DisposableStack === 'function') ||
                safe(() => typeof globalThis !== 'undefined' && typeof globalThis.DisposableStack === 'function'),
            asyncDisposableStack: safe(() => typeof window !== 'undefined' && typeof window.AsyncDisposableStack === 'function') ||
                safe(() => typeof globalThis !== 'undefined' && typeof globalThis.AsyncDisposableStack === 'function'),
            suppressedError: safe(() => typeof SuppressedError !== 'undefined'),
            reflectMetadata: safe(() => typeof Reflect !== 'undefined' && typeof Reflect.metadata === 'function'),
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
    _injectBaseStyles() {
        this._injectStyle('decorators-resource-demo', `
      /* ===== 通用舞台 ===== */
      .drm-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2：装饰器语法高亮 ===== */
      .drm-code {
        margin-top: 8px;
        padding: 10px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 12px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-all;
        overflow-x: auto;
      }
      .drm-code .kw { color: #c084fc; }
      .drm-code .dec { color: #fbbf24; font-weight: 600; }
      .drm-code .str { color: #86efac; }
      .drm-code .com { color: #64748b; font-style: italic; }
      .drm-code .fn { color: #60a5fa; }
      /* ===== Card 4：装饰器调用日志 ===== */
      .drm-decorator-log {
        margin-top: 8px;
        padding: 8px;
        background: #fef3c7;
        border-left: 3px solid #f59e0b;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        color: #78350f;
        white-space: pre-wrap;
        max-height: 180px;
        overflow: auto;
      }
      /* ===== Card 6：资源栈可视化 ===== */
      .drm-stack {
        margin-top: 8px;
        display: flex;
        flex-direction: column-reverse;
        gap: 4px;
        padding: 8px;
        background: #1e293b;
        border-radius: 4px;
        min-height: 80px;
      }
      .drm-stack-item {
        padding: 6px 10px;
        background: #3b82f6;
        color: #fff;
        border-radius: 3px;
        font-size: 12px;
        font-family: monospace;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .drm-stack-item.drm-disposed { background: #6b7280; text-decoration: line-through; }
      .drm-stack-item .drm-order { color: #fde68a; font-weight: 600; }
      /* ===== Card 7：资源管理流程 ===== */
      .drm-flow {
        margin-top: 8px;
        padding: 10px;
        background: #e0f2fe;
        border: 1px solid #0284c7;
        border-radius: 4px;
        font-size: 13px;
        color: #0c4a6e;
      }
      .drm-flow .step {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 4px 0;
      }
      .drm-flow .step-num {
        display: inline-block;
        width: 20px; height: 20px;
        background: #0284c7; color: #fff;
        border-radius: 50%;
        text-align: center;
        line-height: 20px;
        font-size: 11px;
        flex-shrink: 0;
      }
      .drm-flow .step.done .step-num { background: #10b981; }
      .drm-flow .step.active .step-num { background: #f59e0b; }
      /* ===== Card 8：兼容性矩阵 ===== */
      .drm-matrix {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 12px;
      }
      .drm-matrix th, .drm-matrix td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        text-align: left;
      }
      .drm-matrix th { background: #e0e7ff; font-weight: 600; }
      .drm-matrix .yes { color: #10b981; }
      .drm-matrix .no { color: #ef4444; }
      .drm-matrix .partial { color: #f59e0b; }
      /* ===== 输出区 ===== */
      .drm-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        min-height: 24px;
      }
      .drm-status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        background: #e2e8f0;
        color: #0f172a;
        font-size: 12px;
        font-family: monospace;
      }
    `);
    }
    // —— 模拟资源栈 push（用于 Card 6/7 演示，真实 using 不可用时降级）——
    _stackPush(name, disposeFn) {
        const entry = { name, dispose: disposeFn, disposed: false, order: this._disposableStack.length + 1 };
        this._disposableStack.push(entry);
        this._addLog('info', `using 压栈 [${entry.order}]：${name}（LIFO 将在第 ${entry.order} 个释放）`);
        return entry;
    }
    // —— 模拟资源栈 LIFO 释放 ——
    _stackDisposeAll() {
        const released = [];
        while (this._disposableStack.length > 0) {
            const entry = this._disposableStack.pop();
            try {
                if (typeof entry.dispose === 'function')
                    entry.dispose();
                entry.disposed = true;
                released.push(entry.name);
                this._addLog('info', `[Symbol.dispose] 释放 [${entry.order}]：${entry.name}（LIFO 逆序）`);
            }
            catch (err) {
                this._addLog('warn', `[Symbol.dispose] 释放 [${entry.order}]：${entry.name} 异常：${err.message}`);
            }
        }
        return released;
    }
    // —— 真实尝试 using 语法（带能力检测 + new Function 沙箱）——
    _tryUsingSyntax() {
        const f = this._flags();
        if (!f.symbolDispose) {
            this._addLog('warn', 'Symbol.dispose 不可用，无法真实执行 using 块（用模拟资源栈演示 LIFO 释放）');
            return false;
        }
        // 用 new Function 在沙箱中执行 using 块（避免源码依赖未转译语法）
        const code = 'using x = { [Symbol.dispose]() { this.__disposed = true; } }; return x;';
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(code);
            fn();
            this._addLog('info', 'using 块在沙箱中执行成功（Symbol.dispose 已调用）');
            return true;
        }
        catch (err) {
            this._addLog('warn', `using 沙箱执行失败：${err.name} - ${err.message}（可能需 Chrome flag 或转译）`);
            return false;
        }
    }
    // =================== Card 1：概述与动机 ===================
    _readOverviewInfo() {
        const f = this._flags();
        try {
            return `===== TC39 Stage 3 装饰器与资源管理 概述 =====\n` +
                `\n` +
                `【TC39 Stage 3 前瞻性语言特性】\n` +
                `  Decorators（装饰器）与 Explicit Resource Management（显式资源管理）\n` +
                `  均为 TC39 Stage 3 提案（截至 2025 年）\n` +
                `  ES2025 未收录（仍在 Stage 3，未进 Stage 4 / 未纳入年度标准）\n` +
                `  需要 Chrome flag 或 TypeScript 5.0+/Babel 转译才能使用\n` +
                `\n` +
                `【Decorators 历史演进】\n` +
                `  legacy 装饰器（TypeScript 早期实验性，--experimentalDecorators）\n` +
                `    语义与现在不同，TS 5.0 前默认\n` +
                `  Stage 2 装饰器（曾被广泛讨论，最终被否决）\n` +
                `    字段初始化时机不同，与 stage 3 不兼容\n` +
                `  Stage 3 装饰器（当前提案，TypeScript 5.0+ 默认）\n` +
                `    更简洁的 API：(value: any, context: any) => value | { get, set } | void\n` +
                `    context 含 kind/name/access/addInitializer/metadata/private\n` +
                `  与 legacy 装饰器不兼容（语义/运行时行为不同）\n` +
                `\n` +
                `【Explicit Resource Management】\n` +
                `  using x = createResource()       // 同步资源，块结束自动 Symbol.dispose\n` +
                `  await using y = createAsync()    // 异步资源，块结束自动 Symbol.asyncDispose\n` +
                `  DisposableStack / AsyncDisposableStack  // 资源栈，LIFO 释放\n` +
                `  SuppressedError                  // dispose 异常被抑制时抛出\n` +
                `  灵感来自 Python with / C# using / Rust Drop\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  Decorators：Chrome 仍 behind flag（js/runtime flag），Firefox 未支持\n` +
                `    生产需 TypeScript 5.0+ 或 Babel @babel/plugin-proposal-decorators 转译\n` +
                `  using/await using：Chrome 124+ 起 flag（--js-flags="--harmony-using-in-namespace"）\n` +
                `    Symbol.dispose / DisposableStack 同期 flag\n` +
                `    生产需 TypeScript 5.6+ 或 Babel @babel/plugin-proposal-explicit-resource-management\n` +
                `  ES2025 未收录（截至 2025 年仍在 Stage 3）\n` +
                `\n` +
                `【与 ES2022 装饰器元数据提案】\n` +
                `  ES2022 已收录：类静态块、私有字段、#private 等\n` +
                `  但装饰器与元数据（metadata）未进 ES2022\n` +
                `  元数据提案（Reflect.metadata / Symbol.metadata）独立 Stage 3\n` +
                `    与装饰器 context.metadata 协同\n` +
                `    模拟 Java 注解 / C# Attribute 的元数据能力\n` +
                `\n` +
                `【当前环境能力检测】\n` +
                `  class 语法           = ${f.classSupport}\n` +
                `  decorator 语法       = ${f.decoratorSupport}\n` +
                `  using 语法           = ${f.usingSupport}\n` +
                `  await using 语法     = ${f.awaitUsingSupport}\n` +
                `  Symbol.dispose       = ${f.symbolDispose}\n` +
                `  Symbol.asyncDispose  = ${f.symbolAsyncDispose}\n` +
                `  DisposableStack      = ${f.disposableStack}\n` +
                `  AsyncDisposableStack = ${f.asyncDisposableStack}\n` +
                `  SuppressedError      = ${f.suppressedError}\n` +
                `  Reflect.metadata     = ${f.reflectMetadata}\n` +
                `\n` +
                `【核心 API 一览】\n` +
                `  // 装饰器\n` +
                `  function log(value, context) { /* ... */ return value; }\n` +
                `  @log class A {}  // 或 @log method / @log field / @log accessor\n` +
                `\n` +
                `  // 资源管理\n` +
                `  using conn = acquireConn();   // 块结束自动 conn[Symbol.dispose]()\n` +
                `  await using fh = openFile();  // 块结束自动 fh[Symbol.asyncDispose]()\n` +
                `  const stack = new DisposableStack();\n` +
                `  stack.use(resource);          // 压栈\n` +
                `  stack.dispose();              // LIFO 释放全部\n` +
                `\n` +
                `【完整代码示例：最小可运行】\n` +
                `  // 装饰器：日志方法\n` +
                `  function log(fn, { name, kind }) {\n` +
                `    if (kind !== 'method') return fn;\n` +
                `    return function(...args: any[]) {\n` +
                `      console.log('calling ' + name + ' with', args);\n` +
                `      return fn.apply(this, args);\n` +
                `    };\n` +
                `  }\n` +
                `  class Service {\n` +
                `    @log greet(who) { return 'hello ' + who; }\n` +
                `  }\n` +
                `\n` +
                `  // 资源管理：using\n` +
                `  function acquireConn() {\n` +
                `    return {\n` +
                `      query: (sql: any) => console.log(sql),\n` +
                `      [Symbol.dispose]() { console.log('conn closed'); },\n` +
                `    };\n` +
                `  }\n` +
                `  {\n` +
                `    using conn = acquireConn();\n` +
                `    conn.query('SELECT 1');\n` +
                `  }  // 块结束自动 conn[Symbol.dispose]()，输出 'conn closed'`;
        }
        catch (err) {
            return `读取装饰器与资源管理概述信息失败：${err.name} - ${err.message}`;
        }
    }
    _runOverviewDemo() {
        this.setState({ overviewInfo: this._readOverviewInfo() });
        this._addLog('info', `概述演示：decorator=${this._flags().decoratorSupport}, using=${this._flags().usingSupport}, Symbol.dispose=${this._flags().symbolDispose}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述与动机 —— TC39 Stage 3 前瞻性语言特性',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['decorator', f.decoratorSupport],
                ['using', f.usingSupport],
                ['Symbol.dispose', f.symbolDispose],
            ]), h(Tag, { color: 'primary' }, 'Stage 3 / ES2025 未收录')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Decorators 与 Explicit Resource Management 均为 TC39 Stage 3 提案，ES2025 未收录。Decorators 历史演进：legacy（TS 早期实验性）→ stage 2（被否决）→ stage 3（当前，TS 5.0+ 默认），与 legacy 不兼容。Explicit Resource Management：using/await using + Symbol.dispose/asyncDispose + DisposableStack/AsyncDisposableStack + SuppressedError，灵感来自 Python with/C# using/Rust Drop。浏览器支持：Chrome 仍 behind flag，生产需 TS 5.0+/Babel 转译。与 ES2022 元数据提案（Reflect.metadata/Symbol.metadata）独立但协同。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「运行演示」查看装饰器与资源管理完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'Stage 3 前瞻特性，ES2025 未收录，需 Chrome flag 或 TS 5.0+/Babel 转译',
                    description: 'Decorators（TS 5.0+ 默认）与 using/await using（TS 5.6+）均为 TC39 Stage 3。Chrome 仍 behind flag（decorator / harmony-using-in-namespace）。与 legacy 装饰器不兼容。元数据提案（Reflect.metadata）独立 Stage 3，与装饰器 context.metadata 协同。生产环境必须转译。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：Decorators 语法与种类 ===================
    _readSyntaxInfo() {
        const f = this._flags();
        try {
            return `===== Decorators 语法与种类 =====\n` +
                `\n` +
                `【装饰目标种类】\n` +
                `  @decorator class A {}            // 类装饰器\n` +
                `  class A { @decorator method(){} } // 方法装饰器\n` +
                `  class A { @decorator field = 1; } // 字段装饰器\n` +
                `  class A { @decorator accessor x = 1; } // 访问器装饰器（accessor 关键字）\n` +
                `  class A { @decorator get x(){} @decorator set x(v){} } // getter/setter 装饰器\n` +
                `\n` +
                `【装饰器工厂 @dec(args)】\n` +
                `  工厂形式：@dec(args) 先调用 dec(args) 返回真正的装饰器\n` +
                `  function log(level) {            // 工厂\n` +
                `    return function(value: any,  ctx: any) { // 真正的装饰器\n` +
                `      console.log(level, ctx.name);\n` +
                `      return value;\n` +
                `    };\n` +
                `  }\n` +
                `  class A { @log('info') greet(){} }\n` +
                `  执行：先 log('info') 返回装饰器，再用装饰器装饰 greet\n` +
                `\n` +
                `【多装饰器叠加】\n` +
                `  class A {\n` +
                `    @log @deprecated @bound\n` +
                `    method(){}\n` +
                `  }\n` +
                `  多装饰器可叠加（从上到下书写）\n` +
                `\n` +
                `【装饰器执行顺序】\n` +
                `  字段/方法/访问器装饰器：按声明顺序（从上到下）"求值"工厂\n` +
                `    但"应用"装饰器是逆序（从下到上）—— 类似函数组合\n` +
                `  类装饰器：在所有成员装饰器之后执行\n` +
                `  多装饰器叠加 @a @b @c method：\n` +
                `    求值顺序：a, b, c（工厂先调用）\n` +
                `    应用顺序：c(b(a(method)))（内到外，c 最外层）\n` +
                `\n` +
                `【accessor 关键字】\n` +
                `  class A { accessor x = 1; }\n` +
                `  accessor 自动生成 getter/setter + 私有存储\n` +
                `  等价于：class A { #x = 1; get x(){return this.#x} set x(v){this.#x=v} }\n` +
                `  可用 @decorator 装饰 accessor 自定义 getter/setter 行为\n` +
                `\n` +
                `【当前环境能力检测】\n` +
                `  class 语法支持     = ${f.classSupport}\n` +
                `  decorator 语法支持 = ${f.decoratorSupport}\n` +
                `\n` +
                `【完整代码示例：五种装饰目标】\n` +
                `  function trace(value, ctx) {\n` +
                `    console.log('trace ' + ctx.kind + ' ' + String(ctx.name));\n` +
                `    return value;\n` +
                `  }\n` +
                `\n` +
                `  @trace                              // 1. 类装饰器\n` +
                `  class Service {\n` +
                `    @trace method() {}                // 2. 方法装饰器\n` +
                `    @trace field = 1;                 // 3. 字段装饰器\n` +
                `    @trace accessor prop = 2;         // 4. 访问器装饰器\n` +
                `    @trace get computed() { return 0; } // 5. getter 装饰器\n` +
                `  }\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ 装饰器不能用于普通函数（仅类成员 + 类本身）\n` +
                `  ✗ accessor 关键字是 Stage 3 新增，老环境不识别\n` +
                `  ✗ 多装饰器应用顺序是逆序（c 最外层），易混淆`;
        }
        catch (err) {
            return `读取装饰器语法信息失败：${err.name} - ${err.message}`;
        }
    }
    _runSyntaxDemo() {
        const f = this._flags();
        this.setState({ syntaxInfo: this._readSyntaxInfo() });
        this._addLog('info', `装饰器语法演示：class=${f.classSupport}, decorator=${f.decoratorSupport}（不支持环境仅展示代码）`);
        // 模拟装饰器执行顺序记录
        this._decoratorCallLog = [];
        ['@trace class', '@trace method', '@trace field', '@trace accessor', '@trace getter'].forEach((tag, i) => {
            this._decoratorCallLog.push('[' + (i + 1) + '] 求值 ' + tag);
        });
        this._decoratorCallLog.push('[应用顺序] getter → accessor → field → method → class（逆序应用）');
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. Decorators 语法与种类 —— class/method/field/accessor/getter/setter',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['class', f.classSupport], ['decorator', f.decoratorSupport]]), h(Tag, { color: 'primary' }, '5 种目标')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '装饰器五种目标：类（@dec class）、方法（@dec method）、字段（@dec field = 1）、访问器（@dec accessor x = 1，accessor 关键字自动生成 getter/setter + 私有存储）、getter/setter（@dec get x(){}）。装饰器工厂 @dec(args) 先调用工厂返回真正装饰器。多装饰器叠加 @a @b @c：求值顺序 a→b→c（工厂先调用），应用顺序 c(b(a(method)))（逆序，c 最外层）。类装饰器在所有成员装饰器之后执行。陷阱：不能用于普通函数（仅类成员+类本身）、accessor 是 Stage 3 新增、应用顺序逆序易混淆。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runSyntaxDemo() })),
                h('div', { class: 'drm-code' }, h('span', { class: 'com' }, '// 五种装饰目标'), '\n', h('span', { class: 'dec' }, '@trace'), ' ', h('span', { class: 'kw' }, 'class'), ' Service {\n', '  ', h('span', { class: 'dec' }, '@trace'), ' ', h('span', { class: 'fn' }, 'method'), '() {}\n', '  ', h('span', { class: 'dec' }, '@trace'), ' field = 1;\n', '  ', h('span', { class: 'dec' }, '@trace'), ' ', h('span', { class: 'kw' }, 'accessor'), ' prop = 2;\n', '  ', h('span', { class: 'dec' }, '@trace'), ' ', h('span', { class: 'kw' }, 'get'), ' ', h('span', { class: 'fn' }, 'computed'), '() { return 0; }\n', '}'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.syntaxInfo || '（点击「运行演示」查看装饰器语法与种类完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: '装饰器仅用于类成员与类本身，不能装饰普通函数',
                    description: '五种目标：class/method/field/accessor/getter-setter。装饰器工厂 @dec(args) 先求值再应用。多装饰器叠加求值顺序 a→b→c，应用顺序逆序 c(b(a(...)))。accessor 关键字自动生成 getter/setter + 私有存储。类装饰器在成员装饰器之后执行。不能用于普通函数。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：装饰器实现 API ===================
    _readApiInfo() {
        const f = this._flags();
        try {
            return `===== 装饰器实现 API =====\n` +
                `\n` +
                `【装饰器函数签名】\n` +
                `  type Decorator = (value: any, context: any) => value | { get, set } | void\n` +
                `  value：被装饰的值（类/方法/字段初始值/访问器描述符）\n` +
                `  context：装饰上下文对象\n` +
                `  返回值：\n` +
                `    - 返回 value（或新值）：替换原值\n` +
                `    - 返回 { get, set }：仅 accessor/getter/setter 可用，自定义访问\n` +
                `    - 返回 void（undefined）：不替换（保持原值）\n` +
                `\n` +
                `【context 对象】\n` +
                `  {\n` +
                `    kind: 'class' | 'method' | 'field' | 'accessor' | 'getter' | 'setter',\n` +
                `    name: string | symbol,           // 被装饰成员名（类装饰器是类名）\n` +
                `    access: { get(), set(v) },       // 访问原值的 getter/setter（类装饰器无）\n` +
                `    addInitializer(fn),              // 添加初始化器（类：构造后；成员：定义后）\n` +
                `    metadata: object,                // 元数据对象（元数据提案）\n` +
                `    private: boolean,                // 是否私有成员（#private）\n` +
                `    static: boolean,                 // 是否静态成员\n` +
                `  }\n` +
                `\n` +
                `【kind 取值】\n` +
                `  class    —— 类装饰器，value 是类本身\n` +
                `  method   —— 方法装饰器，value 是方法函数\n` +
                `  field    —— 字段装饰器，value 是 undefined（字段初始值通过初始化器）\n` +
                `  accessor —— accessor 装饰器，value 是 { get, set }\n` +
                `  getter   —— getter 装饰器，value 是 getter 函数\n` +
                `  setter   —— setter 装饰器，value 是 setter 函数\n` +
                `\n` +
                `【返回值规则】\n` +
                `  class/method/getter/setter：返回新函数替换原值，或 void 保持\n` +
                `  field：返回初始值函数（init function）或不返回\n` +
                `  accessor：返回 { get, set } 或 { init } 自定义访问与初始值\n` +
                `\n` +
                `【addInitializer 初始化器】\n` +
                `  类装饰器：addInitializer(fn) 在实例构造后执行（类似构造函数钩子）\n` +
                `  成员装饰器：addInitializer(fn) 在类定义完成时执行（静态初始化）\n` +
                `  示例：\n` +
                `    function bound(method, ctx) {\n` +
                `      ctx.addInitializer(function() {\n` +
                `        this[ctx.name] = this[ctx.name].bind(this);\n` +
                `      });\n` +
                `    }\n` +
                `\n` +
                `【当前环境能力检测】\n` +
                `  class 语法支持     = ${f.classSupport}\n` +
                `  decorator 语法支持 = ${f.decoratorSupport}\n` +
                `  Reflect.metadata   = ${f.reflectMetadata}\n` +
                `\n` +
                `【完整代码示例：自定义装饰器】\n` +
                `  function double(value, ctx) {\n` +
                `    if (ctx.kind === 'method') {\n` +
                `      return function(...args: any[]) {\n` +
                `        const result = value.apply(this, args);\n` +
                `        return result * 2;\n` +
                `      };\n` +
                `    }\n` +
                `    return value;  // 其他 kind 不处理\n` +
                `  }\n` +
                `\n` +
                `  class Calc {\n` +
                `    @double\n` +
                `    square(n) { return n * n; }  // square(3) 实际返回 9*2=18\n` +
                `  }\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ field 装饰器 value 是 undefined（不是初始值）\n` +
                `  ✗ 不同 kind 返回值规则不同，需 ctx.kind 分支处理\n` +
                `  ✗ addInitializer 的 this 与执行时机因 kind 而异`;
        }
        catch (err) {
            return `读取装饰器 API 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runApiDemo() {
        const f = this._flags();
        this.setState({ apiInfo: this._readApiInfo() });
        this._addLog('info', `装饰器 API 演示：decorator=${f.decoratorSupport}, Reflect.metadata=${f.reflectMetadata}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. 装饰器实现 API —— (value: any, context: any) => value | { get, set } | void',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['decorator', f.decoratorSupport], ['Reflect.metadata', f.reflectMetadata]]), h(Tag, { color: 'primary' }, 'context.kind')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '装饰器签名：(value: any, context: any) => value | { get, set } | void。context 含 kind（class/method/field/accessor/getter/setter）、name、access（{ get, set }）、addInitializer、metadata、private、static。返回值规则：class/method/getter/setter 返回新函数替换；field 返回初始值函数（value 是 undefined）；accessor 返回 { get, set } 或 { init }。addInitializer 添加初始化器（类：构造后；成员：类定义完成时）。陷阱：field 的 value 是 undefined（不是初始值）、不同 kind 返回规则不同需分支、addInitializer 的 this 与时机因 kind 而异。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runApiDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.apiInfo || '（点击「运行演示」查看装饰器实现 API 完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'field 装饰器的 value 是 undefined，需返回初始值函数',
                    description: 'context.kind 决定 value 含义与返回规则。class/method/getter/setter 返回新函数；field 返回 init 函数（value=undefined）；accessor 返回 { get, set }。addInitializer 添加钩子（类构造后/成员定义后）。metadata 与元数据提案协同。private/static 标识私有/静态成员。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：类装饰器与方法装饰器 ===================
    _readClassMethodInfo() {
        const f = this._flags();
        try {
            const callLog = this._decoratorCallLog;
            const logStr = callLog.length === 0
                ? '（暂无调用记录，点击「运行 @logged 演示」查看装饰器执行）'
                : callLog.map((l) => '  ' + l).join('\n');
            return `===== 类装饰器与方法装饰器实战集合 =====\n` +
                `\n` +
                `【@logged 日志装饰器】\n` +
                `  function logged(value, ctx) {\n` +
                `    if (ctx.kind !== 'method') return value;\n` +
                `    return function(...args: any[]) {\n` +
                `      console.log('calling ' + String(ctx.name), args);\n` +
                `      const result = value.apply(this, args);\n` +
                `      console.log('returned', result);\n` +
                `      return result;\n` +
                `    };\n` +
                `  }\n` +
                `  class A { @logged greet(n) { return 'hi ' + n; } }\n` +
                `\n` +
                `【@bound 自动 bind 装饰器】\n` +
                `  function bound(value, ctx) {\n` +
                `    if (ctx.kind !== 'method') return;\n` +
                `    ctx.addInitializer(function() {\n` +
                `      this[ctx.name] = this[ctx.name].bind(this);\n` +
                `    });\n` +
                `  }\n` +
                `  class A { @bound handler() { return this; } }  // 解构后 this 不丢失\n` +
                `\n` +
                `【@deprecated 标记废弃】\n` +
                `  function deprecated(value, ctx) {\n` +
                `    if (ctx.kind !== 'method') return value;\n` +
                `    return function(...args: any[]) {\n` +
                `      console.warn(ctx.name + ' is deprecated');\n` +
                `      return value.apply(this, args);\n` +
                `    };\n` +
                `  }\n` +
                `\n` +
                `【@memoize 缓存】\n` +
                `  function memoize(value, ctx) {\n` +
                `    if (ctx.kind !== 'method') return value;\n` +
                `    const cache = new Map();\n` +
                `    return function(...args: any[]) {\n` +
                `      const key = JSON.stringify(args);\n` +
                `      if (cache.has(key)) return cache.get(key);\n` +
                `      const result = value.apply(this, args);\n` +
                `      cache.set(key, result);\n` +
                `      return result;\n` +
                `    };\n` +
                `  }\n` +
                `\n` +
                `【@debounce 防抖】\n` +
                `  function debounce(ms) {           // 工厂\n` +
                `    return function(value: any,  ctx: any) {\n` +
                `      if (ctx.kind !== 'method') return;\n` +
                `      let timer;\n` +
                `      return function(...args: any[]) {\n` +
                `        clearTimeout(timer);\n` +
                `        timer = setTimeout(() => value.apply(this, args), ms);\n` +
                `      };\n` +
                `    };\n` +
                `  }\n` +
                `  class A { @debounce(300) search(q) { /* ... */ } }\n` +
                `\n` +
                `【当前调用记录】\n` +
                `${logStr}\n` +
                `\n` +
                `【完整代码示例：组合使用】\n` +
                `  class UserService {\n` +
                `    @logged @memoize\n` +
                `    getUser(id) { return fetch('/users/' + id).then((r: any) => r.json()); }\n` +
                `\n` +
                `    @deprecated @bound\n` +
                `    oldApi() { /* legacy */ }\n` +
                `  }\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ @bound 用 addInitializer，不能返回新函数（this 未绑定时已替换）\n` +
                `  ✗ @memoize 的 key 需序列化 args（对象参数需稳定序列化）\n` +
                `  ✗ @debounce 改变返回值时机（异步），调用方需感知`;
        }
        catch (err) {
            return `读取类/方法装饰器信息失败：${err.name} - ${err.message}`;
        }
    }
    _runClassMethodDemo() {
        const f = this._flags();
        this._decoratorCallLog = [];
        // 模拟 @logged 调用记录（不依赖真实装饰器语法）
        this._decoratorCallLog.push('[调用] greet("world")');
        this._decoratorCallLog.push('  [@logged] calling greet ["world"]');
        this._decoratorCallLog.push('  [@logged] returned "hi world"');
        // 模拟 @memoize 缓存
        this._memoizeCache.set('greet(["world"])', 'hi world');
        this._decoratorCallLog.push('[@memoize] 缓存写入 greet(["world"]: any) => "hi world"');
        this._decoratorCallLog.push('[调用] greet("world") 第二次');
        this._decoratorCallLog.push('  [@memoize] 命中缓存，直接返回 "hi world"');
        this.setState({ classMethodInfo: this._readClassMethodInfo() });
        this._addLog('info', `类/方法装饰器演示：模拟 @logged/@memoize 调用流程（decorator 语法支持=${f.decoratorSupport}）`);
        if (!f.decoratorSupport)
            this._addLog('warn', '装饰器语法不可用，使用模拟调用流程演示；真实环境需 TS 5.0+/Babel 转译');
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. 类装饰器与方法装饰器 —— @logged/@bound/@deprecated/@memoize/@debounce',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['decorator', f.decoratorSupport]]), h(Tag, { color: 'primary' }, '5 大实战装饰器')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '五大实战方法装饰器：@logged（日志，包装方法记录调用与返回）、@bound（自动 bind，用 addInitializer 在构造后绑定 this，解构后 this 不丢失）、@deprecated（标记废弃，调用时 console.warn）、@memoize（缓存，序列化 args 作 key）、@debounce（防抖工厂 @debounce(ms)，clearTimeout+setTimeout）。组合使用：@logged @memoize getUser(id)。陷阱：@bound 用 addInitializer 不能返回新函数、@memoize key 需稳定序列化、@debounce 改变返回值时机调用方需感知。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 @logged 演示', { type: 'primary', size: 'sm', onClick: () => this._runClassMethodDemo() }), this._btn('读取信息', { size: 'sm', onClick: () => this.setState({ classMethodInfo: this._readClassMethodInfo() }) })),
                h('div', { class: 'drm-decorator-log' }, (!this._decoratorCallLog || this._decoratorCallLog.length === 0)
                    ? '（暂无调用记录，点击「运行 @logged 演示」查看模拟执行流程）'
                    : this._decoratorCallLog.map((l) => l).join('\n')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.classMethodInfo || '（点击「运行 @logged 演示」查看 5 大方法装饰器完整代码）')),
                h(Alert, {
                    type: 'info',
                    message: '@bound 用 addInitializer 绑定 this，@memoize 需稳定序列化 args 作 key',
                    description: '@logged 包装方法记录调用/返回。@bound 用 ctx.addInitializer 在构造后 bind this（不能返回新函数）。@deprecated 调用时 warn。@memoize 序列化 args 缓存结果。@debounce 工厂形式 @debounce(ms)，改变返回值时机。组合使用：@logged @memoize。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：字段与访问器装饰器 ===================
    _readFieldAccessorInfo() {
        const f = this._flags();
        try {
            return `===== 字段与访问器装饰器 =====\n` +
                `\n` +
                `【字段装饰器 @field】\n` +
                `  class A { @log field = 42; }\n` +
                `  field 装饰器 value 是 undefined（不是初始值 42）\n` +
                `  返回初始值函数 init(initialValue)：可修改/替换初始值\n` +
                `  示例：\n` +
                `    function doubleInit(value, ctx) {\n` +
                `      if (ctx.kind !== 'field') return;\n` +
                `      return function(initial: any) { return initial * 2; };  // 初始值翻倍\n` +
                `    }\n` +
                `    class A { @doubleInit n = 21; }  // 实际 n = 42\n` +
                `\n` +
                `【accessor 关键字 + @accessor 装饰器】\n` +
                `  class A { accessor x = 1; }\n` +
                `  accessor 自动生成 getter/setter + 私有存储\n` +
                `  @accessor 装饰器可自定义 getter/setter 行为\n` +
                `  装饰器收到 value = { get(), set(v) }，返回 { get, set } 替换\n` +
                `  示例：\n` +
                `    function reactive(value, ctx) {\n` +
                `      if (ctx.kind !== 'accessor') return;\n` +
                `      const { get, set } = value;\n` +
                `      return {\n` +
                `        get() { return get.call(this); },\n` +
                `        set(v) { set.call(this, v); triggerUpdate(); },  // 设值时触发更新\n` +
                `      };\n` +
                `    }\n` +
                `    class A { @reactive accessor count = 0; }\n` +
                `\n` +
                `【与 Object.defineProperty 协同】\n` +
                `  accessor 关键字内部用 Object.defineProperty 生成 getter/setter\n` +
                `  @accessor 装饰器返回的 { get, set } 最终也通过 defineProperty 应用\n` +
                `  与手写 Object.defineProperty 等价，但更声明式\n` +
                `\n` +
                `【addInitializer 初始化器】\n` +
                `  字段/accessor 装饰器可调用 ctx.addInitializer(fn)\n` +
                `  fn 在类定义完成时执行（静态初始化，类似 static block）\n` +
                `  示例：\n` +
                `    function validate(fn, ctx) {\n` +
                `      ctx.addInitializer(function() {\n` +
                `        if (typeof this[ctx.name] !== 'number')\n` +
                `          throw new TypeError(ctx.name + ' must be number');\n` +
                `      });\n` +
                `    }\n` +
                `\n` +
                `【静态字段装饰器】\n` +
                `  class A { @log static count = 0; }\n` +
                `  ctx.static === true 标识静态字段\n` +
                `  装饰器逻辑与实例字段相同，仅作用域不同（类 vs 实例）\n` +
                `\n` +
                `【当前环境能力检测】\n` +
                `  decorator 语法支持 = ${f.decoratorSupport}\n` +
                `\n` +
                `【完整代码示例：响应式 accessor】\n` +
                `  function reactive(value, { kind, name }) {\n` +
                `    if (kind !== 'accessor') return;\n` +
                `    const { get, set } = value;\n` +
                `    return {\n` +
                `      get() { return get.call(this); },\n` +
                `      set(v) {\n` +
                `        const old = get.call(this);\n` +
                `        set.call(this, v);\n` +
                `        if (old !== v) this.emit?.(name, v, old);\n` +
                `      },\n` +
                `    };\n` +
                `  }\n` +
                `\n` +
                `  class Store {\n` +
                `    @reactive accessor count = 0;\n` +
                `    @reactive accessor name = 'init';\n` +
                `    emit(prop: any, val: any){ console.log(prop + ' changed to ' + val); }\n` +
                `  }\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ field 装饰器 value 是 undefined（不是初始值）\n` +
                `  ✗ accessor 装饰器返回 { get, set }，不能返回函数\n` +
                `  ✗ accessor 关键字是 Stage 3 新增，老环境不识别`;
        }
        catch (err) {
            return `读取字段/访问器装饰器信息失败：${err.name} - ${err.message}`;
        }
    }
    _runFieldAccessorDemo() {
        const f = this._flags();
        this.setState({ fieldAccessorInfo: this._readFieldAccessorInfo() });
        this._addLog('info', `字段/访问器装饰器演示：accessor 关键字 + @accessor 自定义 getter/setter（decorator=${f.decoratorSupport}）`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. 字段与访问器装饰器 —— accessor 关键字 / addInitializer',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['decorator', f.decoratorSupport]]), h(Tag, { color: 'primary' }, 'accessor 关键字')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '字段装饰器 @field：value 是 undefined（不是初始值），返回初始值函数 init(initial) 可修改/替换初始值。accessor 关键字 + @accessor 装饰器：accessor 自动生成 getter/setter + 私有存储，装饰器收到 { get, set }，返回 { get, set } 替换自定义行为（如响应式 set 时触发更新）。与 Object.defineProperty 协同（内部用 defineProperty 应用）。addInitializer：字段/accessor 装饰器可调用，fn 在类定义完成时执行（静态初始化，类似 static block）。静态字段装饰器：ctx.static === true 标识，逻辑同实例字段。陷阱：field 的 value 是 undefined、accessor 返回 { get, set } 不能返回函数、accessor 是 Stage 3 新增。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runFieldAccessorDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.fieldAccessorInfo || '（点击「运行演示」查看字段与访问器装饰器完整代码）')),
                h(Alert, {
                    type: 'info',
                    message: 'accessor 关键字自动生成 getter/setter，@accessor 装饰器返回 { get, set } 替换',
                    description: '字段装饰器 value=undefined，返回 init 函数修改初始值。accessor 关键字生成 getter/setter + 私有存储。@accessor 装饰器收到 { get, set }，返回 { get, set } 自定义（如响应式触发更新）。addInitializer 在类定义完成时执行。ctx.static 标识静态字段。与 Object.defineProperty 协同。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：Explicit Resource Management ===================
    _readResourceInfo() {
        const f = this._flags();
        try {
            const stackItems = this._disposableStack.map((e) => '  [' + e.order + '] ' + e.name + (e.disposed ? ' (已释放)' : ''));
            const stackStr = stackItems.length === 0 ? '  （栈空，点击「压栈资源」添加）' : stackItems.join('\n');
            return `===== Explicit Resource Management =====\n` +
                `\n` +
                `【using 声明】\n` +
                `  using x = createResource()      // 同步资源\n` +
                `  块结束时自动调用 x[Symbol.dispose]()\n` +
                `  必须在块作用域（{ } / if / for / 函数体）内声明\n` +
                `\n` +
                `【await using 声明】\n` +
                `  await using y = createAsync()   // 异步资源\n` +
                `  块结束时自动 await y[Symbol.asyncDispose]()\n` +
                `  必须在 async 函数/顶层 await 上下文\n` +
                `\n` +
                `【Symbol.dispose / Symbol.asyncDispose】\n` +
                `  Symbol.dispose：同步释放 well-known symbol\n` +
                `    对象实现 [Symbol.dispose]() {} 即可被 using 释放\n` +
                `  Symbol.asyncDispose：异步释放 well-known symbol\n` +
                `    对象实现 [Symbol.asyncDispose]() {} 即可被 await using 释放\n` +
                `  Symbol.dispose 可用 = ${f.symbolDispose}\n` +
                `  Symbol.asyncDispose 可用 = ${f.symbolAsyncDispose}\n` +
                `\n` +
                `【DisposableStack / AsyncDisposableStack】\n` +
                `  const stack = new DisposableStack();\n` +
                `  stack.use(resource);       // 压栈（resource 需实现 Symbol.dispose）\n` +
                `  stack.adopt(obj, disposer);// 压栈 + 自定义 disposer\n` +
                `  stack.defer(fn);           // 压栈纯函数（无资源）\n` +
                `  stack.move();              // 转移栈所有权（返回新栈，原栈清空）\n` +
                `  stack.dispose();           // LIFO 释放全部（逆序调用 dispose）\n` +
                `  // 异步版\n` +
                `  const astack = new AsyncDisposableStack();\n` +
                `  await astack.disposeAsync();\n` +
                `  DisposableStack 可用 = ${f.disposableStack}\n` +
                `  AsyncDisposableStack 可用 = ${f.asyncDisposableStack}\n` +
                `\n` +
                `【资源栈 LIFO 释放】\n` +
                `  后进先出（Last In First Out）：最后压栈的最先释放\n` +
                `  类似 try-finally 嵌套，内层 finally 先执行\n` +
                `  当前模拟栈：\n` +
                `${stackStr}\n` +
                `\n` +
                `【SuppressedError】\n` +
                `  dispose 过程中抛异常 + 之前已有异常 → SuppressedError\n` +
                `  包装被抑制的异常（保留最后一个，抑制之前的）\n` +
                `  SuppressedError 可用 = ${f.suppressedError}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  function createConn() {\n` +
                `    console.log('open');\n` +
                `    return {\n` +
                `      query: (sql: any) => console.log(sql),\n` +
                `      [Symbol.dispose]() { console.log('close'); },\n` +
                `    };\n` +
                `  }\n` +
                `\n` +
                `  {\n` +
                `    using conn = createConn();   // open\n` +
                `    conn.query('SELECT 1');      // SELECT 1\n` +
                `  }  // close（块结束自动 dispose）\n` +
                `\n` +
                `  // DisposableStack\n` +
                `  const stack = new DisposableStack();\n` +
                `  stack.use(createConn());\n` +
                `  stack.use(openFile());\n` +
                `  stack.defer(() => console.log('cleanup'));\n` +
                `  stack.dispose();  // LIFO: cleanup → file → conn\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ using 必须在块作用域（顶层不行）\n` +
                `  ✗ 异常时仍会 dispose（try-finally 语义）\n` +
                `  ✗ dispose 抛异常可能抑制原异常（SuppressedError）`;
        }
        catch (err) {
            return `读取资源管理信息失败：${err.name} - ${err.message}`;
        }
    }
    _runResourcePushDemo() {
        const f = this._flags();
        const resources = ['DB Connection', 'File Handle', 'Mutex Lock'];
        // 模拟压栈 3 个资源
        resources.forEach((name) => {
            this._stackPush(name, undefined);
        });
        this.setState({ resourceInfo: this._readResourceInfo() });
        this._addLog('info', `DisposableStack 压栈演示：压入 ${resources.length} 个资源（LIFO 将逆序释放）`);
    }
    _runResourceDisposeDemo() {
        const f = this._flags();
        if (this._disposableStack.length === 0) {
            this._addLog('warn', '资源栈为空，先点击「压栈资源」再释放');
            return;
        }
        const released = this._stackDisposeAll();
        this.setState({ resourceInfo: this._readResourceInfo() });
        this._addLog('success', `DisposableStack LIFO 释放完成：${released.join(' → ')}`);
    }
    _runResourceDemo() {
        const f = this._flags();
        this.setState({ resourceInfo: this._readResourceInfo() });
        // 尝试真实 using 语法
        this._tryUsingSyntax();
        this._addLog('info', `资源管理演示：Symbol.dispose=${f.symbolDispose}, DisposableStack=${f.disposableStack}（不支持用模拟栈演示 LIFO）`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. Explicit Resource Management —— using / await using / DisposableStack',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['Symbol.dispose', f.symbolDispose],
                ['DisposableStack', f.disposableStack],
                ['using', f.usingSupport],
            ]), h(Tag, { color: 'primary' }, 'LIFO 释放')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Explicit Resource Management：using x = createResource()（同步，块结束自动 Symbol.dispose）、await using y = createAsync()（异步，块结束自动 await Symbol.asyncDispose）。Symbol.dispose/asyncDispose 是 well-known symbol，对象实现即可被 using 释放。DisposableStack/AsyncDisposableStack：use/adopt/defer/move/dispose，LIFO 释放（后进先出，类似 try-finally 嵌套）。SuppressedError：dispose 抛异常 + 已有异常时抑制之前的。using 必须块作用域，异常时仍 dispose（try-finally 语义）。灵感来自 Python with/C# using/Rust Drop。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runResourceDemo() }), this._btn('压栈资源', { size: 'sm', onClick: () => this._runResourcePushDemo() }), this._btn('LIFO 释放', { size: 'sm', danger: true, onClick: () => this._runResourceDisposeDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'DisposableStack 可视化（LIFO 逆序释放，栈底在上方）：'),
                h('div', { class: 'drm-stack' }, (!this._disposableStack || this._disposableStack.length === 0)
                    ? h('div', { style: { color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '20px' } }, '栈空（点击「压栈资源」添加）')
                    : this._disposableStack.map((e) => h('div', { class: 'drm-stack-item' + (e.disposed ? ' drm-disposed' : '') }, h('span', {}, e.name), h('span', { class: 'drm-order' }, '#' + e.order + (e.disposed ? ' 释放' : ' 持有'))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.resourceInfo || '（点击「运行演示」查看 Explicit Resource Management 完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'using 必须块作用域，异常时仍 dispose（try-finally 语义），LIFO 逆序释放',
                    description: 'using/await using 块结束自动调用 Symbol.dispose/asyncDispose。DisposableStack 提供 use/adopt/defer/move/dispose，LIFO 释放。SuppressedError 处理 dispose 异常抑制。using 必须块作用域。异常时仍 dispose（try-finally）。灵感来自 Python with/C# using/Rust Drop。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：实战 - using 资源管理 ===================
    _readUsingInfo() {
        const f = this._flags();
        try {
            return `===== 实战：using 资源管理场景 =====\n` +
                `\n` +
                `【场景 1：数据库连接】\n` +
                `  function acquireConn() {\n` +
                `    const conn = dbPool.acquire();\n` +
                `    return {\n` +
                `      ...conn,\n` +
                `      [Symbol.dispose]() { dbPool.release(conn); },\n` +
                `    };\n` +
                `  }\n` +
                `  {\n` +
                `    using conn = acquireConn();\n` +
                `    const rows = conn.query('SELECT * FROM users');\n` +
                `    // ... 使用 conn\n` +
                `  }  // 自动 release，无需 finally，避免连接泄漏\n` +
                `\n` +
                `【场景 2：文件句柄】\n` +
                `  async function readFile(path) {\n` +
                `    await using fh = await fs.open(path);  // 异步获取\n` +
                `    const content = await fh.read();\n` +
                `    return content;\n` +
                `  }  // 自动 await fh[Symbol.asyncDispose]() 关闭文件\n` +
                `\n` +
                `【场景 3：锁 navigator.locks.request】\n` +
                `  navigator.locks.request('resource', async (lock: any) => {\n` +
                `    // lock 实现了 Symbol.asyncDispose（提案，部分环境）\n` +
                `    await using l = lock;\n` +
                `    await doWork();\n` +
                `  });  // 自动释放锁\n` +
                `  // 降级：手动用 DisposableStack\n` +
                `  navigator.locks.request('res', async (lock: any) => {\n` +
                `    const stack = new AsyncDisposableStack();\n` +
                `    stack.defer(() => lock.release());\n` +
                `    try { await doWork(); }\n` +
                `    finally { await stack.disposeAsync(); }\n` +
                `  });\n` +
                `\n` +
                `【场景 4：事务 scope】\n` +
                `  function transaction(db) {\n` +
                `    const tx = db.beginTransaction();\n` +
                `    return {\n` +
                `      ...tx,\n` +
                `      [Symbol.dispose]() { tx.commit(); },  // 正常提交\n` +
                `    };\n` +
                `  }\n` +
                `  {\n` +
                `    using tx = transaction(db);\n` +
                `    tx.execute('UPDATE ...');\n` +
                `    tx.execute('INSERT ...');\n` +
                `  }  // 自动 commit（异常时如何 rollback？见陷阱）\n` +
                `\n` +
                `【自动释放避免泄漏】\n` +
                `  传统 try-finally 容易遗漏 finally（连接泄漏）\n` +
                `  using 强制块结束释放，编译器保证\n` +
                `  异常路径也释放（try-finally 语义）\n` +
                `\n` +
                `【当前环境能力检测】\n` +
                `  using 语法支持    = ${f.usingSupport}\n` +
                `  await using 支持  = ${f.awaitUsingSupport}\n` +
                `  Symbol.dispose    = ${f.symbolDispose}\n` +
                `  DisposableStack   = ${f.disposableStack}\n` +
                `\n` +
                `【完整代码示例：组合资源】\n` +
                `  async function processOrder(orderId) {\n` +
                `    const stack = new AsyncDisposableStack();\n` +
                `    try {\n` +
                `      await using conn = acquireConn();\n` +
                `      stack.use(conn);  // 也可手动压栈\n` +
                `      await using tx = transaction(conn);\n` +
                `      stack.use(tx);\n` +
                `      await tx.execute('INSERT orders ...');\n` +
                `      await tx.execute('UPDATE inventory ...');\n` +
                `      // 正常：tx commit + conn release\n` +
                `    } catch (err: any) {\n` +
                `      // 异常：仍 dispose（tx 可能 commit 失败需 rollback）\n` +
                `      throw err;\n` +
                `    }\n` +
                `  }\n` +
                `\n` +
                `【陷阱：事务异常时 commit vs rollback】\n` +
                `  using 默认 dispose = commit，但异常时应 rollback\n` +
                `  方案：dispose 内部判断是否有异常（用 SuppressedError）\n` +
                `    [Symbol.dispose]() {\n` +
                `      if (this.__error) this.rollback();\n` +
                `      else this.commit();\n` +
                `    }\n` +
                `  或用 DisposableStack 手动控制：异常时 dispose 释放 = rollback`;
        }
        catch (err) {
            return `读取 using 资源管理实战信息失败：${err.name} - ${err.message}`;
        }
    }
    _runUsingDemo() {
        const f = this._flags();
        this.setState({ usingInfo: this._readUsingInfo() });
        // 模拟 using 资源管理流程
        this._disposableStack = [];
        this._stackPush('acquireConn()', () => this._addLog('info', '[DB] 连接已 release'));
        this._stackPush('fs.open()', () => this._addLog('info', '[File] 句柄已 close'));
        this._stackPush('navigator.locks.request', () => this._addLog('info', '[Lock] 锁已 release'));
        this._addLog('info', `using 资源管理演示启动：模拟 acquireConn → fs.open → locks（using=${f.usingSupport}）`);
        // 模拟块结束 LIFO 释放
        setTimeout(() => {
            if (this._destroyed)
                return;
            this._addLog('info', 'using 块结束，触发 LIFO 释放...');
            this._stackDisposeAll();
            this.setState({ usingInfo: this._readUsingInfo() });
        }, 1500);
        if (!f.usingSupport)
            this._addLog('warn', 'using 语法不可用，使用模拟流程演示；真实环境需 Chrome flag 或 TS 5.6+/Babel 转译');
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 实战：using 资源管理 —— DB连接/文件句柄/锁/事务',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['using', f.usingSupport], ['await using', f.awaitUsingSupport]]), h(Tag, { color: 'success' }, '避免泄漏')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '四大 using 实战场景：数据库连接（using conn = acquireConn()，块结束自动 release 避免泄漏）、文件句柄（await using fh = await fs.open()，自动关闭）、锁（navigator.locks.request + await using，自动释放；降级用 AsyncDisposableStack）、事务 scope（using tx = transaction()，自动 commit；异常时需判断 rollback）。自动释放避免泄漏：传统 try-finally 易遗漏 finally，using 强制块结束释放，编译器保证，异常路径也释放。陷阱：事务异常时 commit vs rollback（dispose 内判断 SuppressedError 或用 DisposableStack 手动控制）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runUsingDemo() })),
                h('div', { class: 'drm-flow' }, h('div', { class: 'step' }, h('span', { class: 'step-num' }, '1'), h('span', {}, 'using conn = acquireConn()  // 获取 DB 连接')), h('div', { class: 'step' }, h('span', { class: 'step-num' }, '2'), h('span', {}, 'await using fh = fs.open()  // 打开文件句柄')), h('div', { class: 'step' }, h('span', { class: 'step-num' }, '3'), h('span', {}, 'await using lock = navigator.locks.request()  // 获取锁')), h('div', { class: 'step' }, h('span', { class: 'step-num' }, '4'), h('span', {}, '} // 块结束：LIFO 释放 lock → fh → conn'))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.usingInfo || '（点击「运行演示」查看 using 资源管理 4 大场景完整代码）')),
                h(Alert, {
                    type: 'info',
                    message: 'using 强制块结束释放，避免 try-finally 遗漏导致资源泄漏',
                    description: '四大场景：DB 连接（自动 release）、文件句柄（自动 close）、锁（自动 release，降级 AsyncDisposableStack）、事务（自动 commit，异常需 rollback 判断）。using 强制释放避免泄漏，异常路径也释放（try-finally 语义）。事务异常时 commit vs rollback 用 SuppressedError 判断或 DisposableStack 手动控制。',
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
            return `===== 装饰器与资源管理 陷阱与最佳实践 =====\n` +
                `\n` +
                `【陷阱 1：装饰器不能用于普通函数】\n` +
                `  装饰器仅用于类本身 + 类成员（method/field/accessor/getter/setter）\n` +
                `  普通函数声明不能用 @decorator：\n` +
                `    @log function foo() {}  // ✗ 语法错误\n` +
                `  原因：函数提升与装饰器时机冲突，TC39 明确排除\n` +
                `  解决：用高阶函数包裹普通函数\n` +
                `    const foo = log(function foo() {});  // ✓ 手动装饰\n` +
                `\n` +
                `【陷阱 2：this 绑定问题】\n` +
                `  装饰器返回的新函数不自动 bind this\n` +
                `  方法被解构/回调时 this 丢失：\n` +
                `    const { greet } = service; greet();  // this 不再是 service\n` +
                `  解决：用 @bound 装饰器（addInitializer 内 bind）\n` +
                `  注意：@bound 在构造后 bind，静态方法需 ctx.static 处理\n` +
                `\n` +
                `【陷阱 3：metadata 元数据提案】\n` +
                `  context.metadata 是元数据提案（独立 Stage 3）\n` +
                `  Reflect.metadata / Symbol.metadata 是其 API\n` +
                `  当前环境 Reflect.metadata = ${f.reflectMetadata}\n` +
                `  不支持时 context.metadata 仍存在（空对象），但无 Reflect.metadata API\n` +
                `  用途：依赖注入、序列化、ORM 映射（类似 Java 注解 / C# Attribute）\n` +
                `\n` +
                `【陷阱 4：与 legacy 装饰器不兼容】\n` +
                `  TS 5.0 前 --experimentalDecorators 是 legacy 装饰器\n` +
                `  语义不同：\n` +
                `    - legacy：字段初始化在构造函数，装饰器收到 descriptor\n` +
                `    - stage 3：字段初始化在类定义，装饰器收到 (value, context)\n` +
                `  迁移：TS 5.0+ 默认 stage 3，--experimentalDecorators 保留 legacy\n` +
                `  两者代码不兼容，需重写装饰器\n` +
                `\n` +
                `【陷阱 5：using 必须在块作用域】\n` +
                `  using 声明必须在块作用域 { } / if / for / 函数体内\n` +
                `  顶层（模块顶层）不能用 using（await using 顶层可，需顶层 await）\n` +
                `    using x = create();  // ✗ 顶层语法错误（部分实现）\n` +
                `    { using x = create(); }  // ✓ 块作用域\n` +
                `  原因：using 编译为 try-finally，需明确的块边界\n` +
                `\n` +
                `【陷阱 6：异常时仍会 dispose】\n` +
                `  using 块内抛异常，仍会调用 dispose（try-finally 语义）\n` +
                `  dispose 内不要依赖块内未完成的副作用\n` +
                `  dispose 抛异常会抑制原异常（SuppressedError）\n` +
                `    try { using x = create(); throw new Error('A'); }\n` +
                `    // x[Symbol.dispose]() 抛 Error('B') → 抛 SuppressedError(B, A)\n` +
                `\n` +
                `【陷阱 7：性能考虑】\n` +
                `  装饰器在类定义时求值（一次性开销，运行时无影响）\n` +
                `  using 编译为 try-finally，每次块执行有微小开销\n` +
                `  高频热点路径避免 using（用裸 try-finally 或对象池）\n` +
                `  @memoize 装饰器缓存提升性能，但 key 序列化有成本\n` +
                `\n` +
                `【陷阱 8：转译工具链配置】\n` +
                `  装饰器：\n` +
                `    TypeScript 5.0+ 默认 stage 3（无需 flag）\n` +
                `    Babel: @babel/plugin-proposal-decorators (version: "2023-11")\n` +
                `    legacy: --experimentalDecorators (TS) 或 version: "legacy" (Babel)\n` +
                `  using/await using：\n` +
                `    TypeScript 5.6+ (--module esnext --target esnext)\n` +
                `    Babel: @babel/plugin-proposal-explicit-resource-management\n` +
                `    Chrome flag: --js-flags="--harmony-using-in-namespace"\n` +
                `\n` +
                `【最佳实践清单】\n` +
                `  ✓ 装饰器仅用于类成员，普通函数用高阶函数\n` +
                `  ✓ 需要 this 绑定用 @bound（addInitializer）\n` +
                `  ✓ 不同 kind 分支处理（ctx.kind 判断）\n` +
                `  ✓ field 装饰器返回 init 函数（value 是 undefined）\n` +
                `  ✓ accessor 装饰器返回 { get, set }\n` +
                `  ✓ using 必须块作用域，顶层用 await using（需顶层 await）\n` +
                `  ✓ dispose 内不依赖未完成副作用，避免抛异常\n` +
                `  ✓ 异常路径仍 dispose，事务用 SuppressedError 判断 rollback\n` +
                `  ✓ 高频热点路径避免 using（性能）\n` +
                `  ✓ 转译：TS 5.0+ 装饰器 / TS 5.6+ using / Babel 对应插件\n` +
                `  ✓ 迁移：legacy 装饰器与 stage 3 不兼容，需重写\n` +
                `  ✓ 元数据用 context.metadata（依赖 Reflect.metadata 提案）\n` +
                `\n` +
                `【兼容性矩阵（截至 2025 年）】\n` +
                `  特性              | Chrome        | Firefox | Safari | TS      | Babel\n` +
                `  ------------------|---------------|---------|--------|---------|------\n` +
                `  Decorators (S3)   | flag          | ✗       | ✗      | 5.0+ ✓  | 插件 ✓\n` +
                `  using/await using | 124+ flag     | ✗       | ✗      | 5.6+ ✓  | 插件 ✓\n` +
                `  Symbol.dispose    | 124+ flag     | ✗       | ✗      | 5.6+ ✓  | 插件 ✓\n` +
                `  DisposableStack   | 124+ flag     | ✗       | ✗      | 5.6+ ✓  | 插件 ✓\n` +
                `  Reflect.metadata  | ✗ (提案)      | ✗       | ✗      | ✗       | polyfill\n` +
                `\n` +
                `  decorator 语法支持 = ${f.decoratorSupport}\n` +
                `  using 语法支持     = ${f.usingSupport}\n` +
                `  Symbol.dispose     = ${f.symbolDispose}\n` +
                `  Reflect.metadata   = ${f.reflectMetadata}`;
        }
        catch (err) {
            return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPitfallsDemo() {
        this.setState({ pitfallsInfo: this._readPitfallsInfo() });
        this._addLog('info', `陷阱与最佳实践演示完成；decorator=${this._flags().decoratorSupport}, using=${this._flags().usingSupport}, Symbol.dispose=${this._flags().symbolDispose}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 陷阱与最佳实践 —— 普通函数/this/metadata/legacy/块作用域/异常/性能/转译',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['decorator', f.decoratorSupport], ['using', f.usingSupport], ['Reflect.metadata', f.reflectMetadata]]), h(Tag, { color: 'warning' }, '8 大陷阱')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '八大陷阱：装饰器不能用于普通函数（仅类成员，普通函数用高阶函数）；this 绑定问题（用 @bound addInitializer）；metadata 元数据提案（独立 Stage 3，Reflect.metadata/Symbol.metadata）；与 legacy 装饰器不兼容（TS 5.0 前 --experimentalDecorators，语义不同需重写）；using 必须块作用域（顶层不行，await using 需顶层 await）；异常时仍 dispose（try-finally 语义，dispose 抛异常抑制原异常 SuppressedError）；性能考虑（装饰器一次性开销，using 编译 try-finally 有微小开销，高频热点避免）；转译工具链配置（TS 5.0+ 装饰器 / TS 5.6+ using / Babel 对应插件 / Chrome flag）。最佳实践清单 12 条覆盖使用边界、this、kind 分支、field/accessor 返回、using 作用域、dispose 副作用、异常 rollback、性能、转译、迁移、元数据。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() })),
                h('table', { class: 'drm-matrix' }, h('thead', {}, h('tr', {}, h('th', {}, '特性'), h('th', {}, 'Chrome'), h('th', {}, 'Firefox'), h('th', {}, 'Safari'), h('th', {}, 'TS'), h('th', {}, 'Babel'))), h('tbody', {}, h('tr', {}, h('td', {}, 'Decorators (S3)'), h('td', { class: 'partial' }, 'flag'), h('td', { class: 'no' }, '✗'), h('td', { class: 'no' }, '✗'), h('td', { class: 'yes' }, '5.0+'), h('td', { class: 'yes' }, '插件')), h('tr', {}, h('td', {}, 'using/await using'), h('td', { class: 'partial' }, '124+ flag'), h('td', { class: 'no' }, '✗'), h('td', { class: 'no' }, '✗'), h('td', { class: 'yes' }, '5.6+'), h('td', { class: 'yes' }, '插件')), h('tr', {}, h('td', {}, 'Symbol.dispose'), h('td', { class: 'partial' }, '124+ flag'), h('td', { class: 'no' }, '✗'), h('td', { class: 'no' }, '✗'), h('td', { class: 'yes' }, '5.6+'), h('td', { class: 'yes' }, '插件')), h('tr', {}, h('td', {}, 'DisposableStack'), h('td', { class: 'partial' }, '124+ flag'), h('td', { class: 'no' }, '✗'), h('td', { class: 'no' }, '✗'), h('td', { class: 'yes' }, '5.6+'), h('td', { class: 'yes' }, '插件')), h('tr', {}, h('td', {}, 'Reflect.metadata'), h('td', { class: 'no' }, '✗ 提案'), h('td', { class: 'no' }, '✗'), h('td', { class: 'no' }, '✗'), h('td', { class: 'no' }, '✗'), h('td', { class: 'partial' }, 'polyfill')))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.pitfallsInfo || '（点击「运行演示」查看 8 大陷阱与 12 条最佳实践完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: '装饰器不能用于普通函数；using 必须块作用域；异常时仍 dispose（SuppressedError）；与 legacy 不兼容',
                    description: '陷阱清单：普通函数不可装饰（用高阶函数）、this 绑定（@bound）、metadata 提案、legacy 不兼容、using 块作用域、异常仍 dispose（SuppressedError）、性能（高频避免）、转译配置（TS 5.0+/5.6+ Babel）。最佳实践：kind 分支、field 返回 init、accessor 返回 {get,set}、using 块作用域、dispose 不抛异常、事务 rollback 判断、转译工具链。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板（按时间倒序）===================
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return null;
        const reversed = [...s.logs].reverse();
        return h(Card, { title: '运行日志（按时间倒序）' }, h('div', { class: 'log-list' }, ...reversed.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    // =================== 渲染入口 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'api-lab-page decorators-resource-management-page' }, h('h2', { class: 'section-title' }, 'TC39 Stage 3 装饰器与资源管理完整实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 TC39 Stage 3 前瞻性语言特性：Decorators 装饰器（历史演进 legacy→stage2→stage3、5 种装饰目标、装饰器 API (value, context)、@logged/@bound/@deprecated/@memoize/@debounce、字段与 accessor 装饰器）+ Explicit Resource Management（using/await using、Symbol.dispose/asyncDispose、DisposableStack/AsyncDisposableStack、LIFO 释放、DB连接/文件句柄/锁/事务实战）、陷阱与最佳实践。所有特性通过 typeof / in / new Function 语法探测能力检测，不可用时仅记日志（部分用模拟流程演示），绝不抛异常。jsdom/Node 通常不支持，需 Chrome flag 或 TS 5.0+/Babel 转译。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()), this._renderLogPanel());
    }
}
//# sourceMappingURL=DecoratorsResourceManagementPage.js.map