// =====================================================================
// AsyncContextPage.js —— AsyncContext 异步上下文透传实验室
// 演示 TC39 Stage 2/3 提案：AsyncContext.Variable / AsyncContext.Snapshot
//   Card 1: 问题与历史方案 —— 异步调用栈状态丢失 + 全局变量陷阱 +
//           zone.js 历史方案 + 与 Node AsyncLocalStorage 的关系
//   Card 2: AsyncContext.Variable —— new AsyncContext.Variable(name) +
//           var.run(value, callback) + var.get() + 嵌套 run 隔离
//   Card 3: AsyncContext.Snapshot —— new AsyncContext.Snapshot() +
//           snapshot.run(callback) 恢复 + Snapshot.wrap(fn) 工厂
//   Card 4: 跨 await/Promise 边界 —— 跨 await/Promise 自动保留 +
//           setTimeout/queueMicrotask/requestAnimationFrame 行为 +
//           浏览器实现差异
//   Card 5: 与 fetch 协同 —— traceId 透传 + AbortSignal.any 协同 +
//           Service Worker fetch 事件
//   Card 6: 与 scheduler/Worker 协同 —— scheduler.postTask/yield +
//           Worker postMessage + 上下文传播矩阵 + 可转移对象 +
//           structuredClone 限制
//   Card 7: 实战 APM tracing 与多租户 —— OpenTelemetry Web SDK +
//           多语言 SSR locale 透传 + 多租户 SaaS tenantId 透传
//   Card 8: 对照与陷阱 —— 与 Node AsyncLocalStorage API 对照 +
//           polyfill 性能开销 + 浏览器支持矩阵 + 陷阱（new Promise /
//           addEventListener / Worker 边界）+ 与 using/Symbol.dispose 协同
// 说明：AsyncContext 是 TC39 提案，jsdom/Node 当前未实现（typeof AsyncContext
//       === 'undefined'）。所有按钮做能力检测，不可用时仅 _addLog('warn', ...)
//       并显示信息文本，绝不抛异常。Card 2/3/4/7 使用「朴素 polyfill」
//       （栈式实现，仅同步可用）演示概念，并诚实标注其跨 await 失效。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// —— 模块级：朴素 AsyncContext polyfill（仅同步语义，跨 await 不保留）——
// 真实 AsyncContext 依赖引擎钩子（Promise/任务调度）传播上下文快照；
// 这里仅以「每变量一个栈」近似 .run/.get/嵌套隔离 与 Snapshot 捕获/恢复。
function createNaiveAsyncContext() {
    const registry = new Set();
    function Variable(name) {
        const stack = [];
        const v = {
            name,
            run(value, callback) {
                stack.push(value);
                try {
                    return callback();
                }
                finally {
                    stack.pop();
                }
            },
            get() { return stack.length ? stack[stack.length - 1] : undefined; },
            _stack: stack,
        };
        registry.add(v);
        return v;
    }
    function Snapshot() {
        const captured = new Map();
        for (const v of registry)
            captured.set(v, v._stack[v._stack.length - 1]);
        return {
            run(callback) {
                for (const [v, val] of captured)
                    v._stack.push(val);
                try {
                    return callback();
                }
                finally {
                    for (const [v] of captured)
                        v._stack.pop();
                }
            },
        };
    }
    // Snapshot.wrap(fn)：捕获当前快照，返回的函数在调用时恢复快照后执行 fn
    Snapshot.wrap = function (fn) {
        const snap = Snapshot();
        return function (...args) { return snap.run(() => fn.apply(this, args)); };
    };
    return { Variable, Snapshot };
}
export class AsyncContextPage extends Page {
    _inited = false;
    _dynamicStyles;
    _pendingTimers;
    _naive;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            problemInfo: '', // Card 1：问题与历史方案
            variableInfo: '', // Card 2：AsyncContext.Variable
            snapshotInfo: '', // Card 3：AsyncContext.Snapshot
            awaitBoundaryInfo: '', // Card 4：跨 await/Promise 边界
            fetchInfo: '', // Card 5：与 fetch 协同
            schedulerWorkerInfo: '', // Card 6：与 scheduler/Worker 协同
            apmInfo: '', // Card 7：实战 APM tracing 与多租户
            comparisonInfo: '', // Card 8：对照与陷阱
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._dynamicStyles = [];
        this._pendingTimers = [];
        this._naive = createNaiveAsyncContext(); // Card 2/3/4/7 演示用 polyfill
        // 一次性能力检测：AsyncContext 提案 + 相关平台 API
        const c = this._caps();
        const f = this._flags();
        const parts = [
            `AsyncContext ${c.asyncContext ? '✓' : '✗'}`,
            `Variable ${c.variable ? '✓' : '✗'}`,
            `Snapshot ${c.snapshot ? '✓' : '✗'}`,
            `Snapshot.wrap ${c.snapshotWrap ? '✓' : '✗'}`,
            `fetch ${f.fetch ? '✓' : '✗'}`,
            `AbortSignal.any ${f.abortSignalAny ? '✓' : '✗'}`,
            `scheduler.postTask ${f.schedulerPostTask ? '✓' : '✗'}`,
            `scheduler.yield ${f.schedulerYield ? '✓' : '✗'}`,
            `Worker ${f.worker ? '✓' : '✗'}`,
            `structuredClone ${f.structuredClone ? '✓' : '✗'}`,
            `Symbol.dispose ${f.symbolDispose ? '✓' : '✗'}`,
        ];
        const summary = c.asyncContext
            ? `AsyncContext 能力检测：${parts.join(' · ')}。当前环境原生支持 AsyncContext（罕见，仅特定 polyfill/试验构建），演示将以真实 API 为主。`
            : `AsyncContext 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）typeof AsyncContext === "undefined"——TC39 提案尚未落地。所有按钮点击将使用「朴素 polyfill」（仅同步语义）演示概念，或仅显示信息文本与代码示例，绝不抛异常。`;
        this.setState({ capsSummary: summary });
        this._addLog(c.asyncContext ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!c.asyncContext)
            this._addLog('warn', 'AsyncContext 不可用：TC39 Stage 2/3 提案，jsdom/Node 当前未实现；Card 2/3/4/7 使用朴素 polyfill 演示');
        if (!f.fetch)
            this._addLog('warn', 'fetch 不可用（jsdom 通常提供，Node 18+ 内置）');
        if (!f.abortSignalAny)
            this._addLog('warn', 'AbortSignal.any 不可用（较新环境才支持）');
        if (!f.schedulerPostTask)
            this._addLog('warn', 'scheduler.postTask 不可用（Chrome 94+，Firefox/Safari 无）');
        if (!f.worker)
            this._addLog('warn', 'Worker 不可用（jsdom 不支持）');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        // 清理：清掉演示中挂起的 setTimeout，移除动态注入的 <style>
        for (const t of this._pendingTimers) {
            try {
                clearTimeout(t);
            }
            catch { /* noop */ }
        }
        this._pendingTimers = [];
        for (const s of this._dynamicStyles) {
            try {
                s.parentNode && s.parentNode.removeChild(s);
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
    // —— 同步能力检测：AsyncContext API 表面 ——
    _caps() {
        const hasAsyncContext = typeof AsyncContext !== 'undefined';
        const hasVariable = hasAsyncContext && typeof AsyncContext.Variable === 'function';
        const hasSnapshot = hasAsyncContext && typeof AsyncContext.Snapshot === 'function';
        const hasSnapshotWrap = hasSnapshot && typeof AsyncContext.Snapshot.wrap === 'function';
        return {
            asyncContext: hasAsyncContext,
            variable: hasVariable,
            snapshot: hasSnapshot,
            snapshotWrap: hasSnapshotWrap,
        };
    }
    // —— 同步能力检测：相关平台 API（fetch / scheduler / Worker / 等）——
    _flags() {
        return {
            fetch: typeof fetch === 'function',
            abortSignalAny: typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function',
            schedulerPostTask: typeof scheduler !== 'undefined' && typeof scheduler.postTask === 'function',
            schedulerYield: typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function',
            worker: typeof Worker !== 'undefined',
            messageChannel: typeof MessageChannel !== 'undefined',
            structuredClone: typeof structuredClone === 'function',
            symbolDispose: typeof Symbol !== 'undefined' && typeof Symbol.dispose !== 'undefined',
        };
    }
    // —— 动态样式注入 ——
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
    _injectBaseStyles() {
        this._injectStyle('async-context-page-base', `
      .ac-grid { display: grid; gap: 8px; }
      .ac-matrix { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
      .ac-matrix th, .ac-matrix td { border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left; }
      .ac-matrix th { background: #f1f5f9; font-weight: 600; }
      .ac-matrix td.ac-yes { color: #16a34a; }
      .ac-matrix td.ac-no { color: #dc2626; }
      .ac-matrix td.ac-partial { color: #d97706; }
    `);
    }
    // =================== Card 1：问题与历史方案 ===================
    _demoProblemHistory() {
        const info = '===== 异步上下文透传：问题与历史方案 =====\n\n' +
            '【问题】异步调用栈中状态丢失：\n' +
            '  async function handleReq(req) {\n' +
            '    const traceId = req.headers["x-trace-id"];\n' +
            '    await db.query();              // ← 进入新微任务，traceId 不在调用栈\n' +
            '    logger.log("done");            // ← logger 拿不到 traceId！\n' +
            '  }\n' +
            '  传统解法：把 traceId 一路「显式传参」→ db.query(traceId).then(r => logger.log(traceId, r))\n' +
            '  痛点：每个 async 函数签名都要加 traceId/userId/tenantId/locale...，污染所有层。\n\n' +
            '【陷阱】用「全局变量」临时存放？\n' +
            '  let gTraceId;\n' +
            '  async function handleReq(req) { gTraceId = req.headers["x-trace-id"]; await db.query(); logger.log(); }\n' +
            '  → 并发请求会互相覆盖！req-A 设 gTraceId="a"，req-B 设 gTraceId="b"，\n' +
            '    req-A 的 logger.log() 读到的是 "b"——串号、跨用户数据泄漏。\n\n' +
            '【历史方案 1：zone.js】Angular 团队 2014 年方案：\n' +
            '  monkey-patch Promise/setTimeout/XMLHttpRequest 等 host API，\n' +
            '  在每个异步任务 fork 一个新 zone，把 context 跟着任务走。\n' +
            '  缺点：侵入式 patch、性能开销、与原生 Promise 行为有微妙差异、bundle 体积大。\n\n' +
            '【历史方案 2：Node AsyncLocalStorage】Node 13.10+ 稳定：\n' +
            '  const { AsyncLocalStorage } = require("async_hooks");\n' +
            '  const als = new AsyncLocalStorage();\n' +
            '  als.run(traceId, () => fetch(...));   // 后续 await/setTimeout 都能 als.getStore() 读到\n' +
            '  机制：基于 async_hooks，监听 async 资源 init/before/after，传播 store。\n' +
            '  限制：仅 Node；浏览器无 async_hooks；性能（早期实现）非零开销。\n\n' +
            '【AsyncContext 提案定位】\n' +
            '  TC39 Stage 2/3，目标：标准化「跨异步边界传播的上下文容器」语义，\n' +
            '  让浏览器与 Node 共用同一 API（Variable/Snapshot），由引擎原生实现，\n' +
            '  无需 monkey-patch、零运行时开销（hide-from-stack + 引擎内联传播）。\n' +
            '  与 AsyncLocalStorage 关系：API 形态接近，AsyncContext 是语言级提案，\n' +
            '  AsyncLocalStorage 是 Node 运行时实现，未来 Node 可基于 AsyncContext 重实现 ALS。';
        this.setState({ problemInfo: info });
        this._addLog('info', 'Card 1：已展示异步上下文透传问题与 zone.js / AsyncLocalStorage / AsyncContext 历史脉络');
    }
    _renderCard1() {
        const s = this.state;
        const c = this._caps();
        const card = new Card({
            title: '1. 问题与历史方案（异步调用栈状态丢失）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: c.asyncContext ? 'success' : 'warning' }, c.asyncContext ? 'AsyncContext ✓' : '提案未落地'), h(Tag, { color: 'primary' }, 'zone.js · AsyncLocalStorage')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '异步调用栈中状态丢失：每个 await 进入新微任务，调用栈上的本地变量不再可达。传统显式传参会污染所有层签名；用全局变量临时存放会被并发请求互相覆盖（串号、跨用户泄漏）。zone.js 通过 monkey-patch 异步 API 传播上下文（侵入式、有性能开销）；Node AsyncLocalStorage 基于 async_hooks 在运行时层传播（仅 Node）。AsyncContext（TC39 Stage 2/3）目标是在语言层标准化上下文容器语义，由引擎原生实现，零开销。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展开问题与方案', { type: 'primary', size: 'sm', onClick: () => this._demoProblemHistory() })),
                h('div', { class: 'fs-sm text-secondary' }, '问题与历史方案：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.problemInfo || '（点击「展开问题与方案」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：AsyncContext.Variable 最小示例'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `// AsyncContext.Variable：声明一个「上下文变量」，跨 await 自动保留
const traceId = new AsyncContext.Variable('traceId');
traceId.run('req-123', async () => {
  await fetch('/api');              // traceId.get() === 'req-123' 在 fetch 内部仍可读
  setTimeout(() => console.log(traceId.get()));  // 'req-123'
});
traceId.get();                     // undefined（run 作用域外）`)),
                h(Alert, {
                    type: 'info',
                    message: '从「显式传参」到「上下文容器」',
                    description: 'AsyncContext 的核心价值：把 traceId/userId/tenantId/locale 这类「请求作用域」数据放进 Variable，在 run 作用域内的任意 async 调用都能 get() 读到，无需逐层传参，且天然支持并发隔离（每个 run 是独立分支）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：AsyncContext.Variable ===================
    // 用朴素 polyfill 演示 .run / .get / 嵌套隔离（同步部分真实运行）
    _demoVariable() {
        const c = this._caps();
        const { Variable } = this._naive;
        const L = [];
        try {
            const traceId = Variable('traceId');
            const userId = Variable('userId');
            // 1) 作用域外读取
            L.push(`traceId.get()（作用域外）= ${JSON.stringify(traceId.get())}（应为 undefined）`);
            // 2) run 作用域内读取
            traceId.run('req-001', () => {
                L.push(`run('req-001') 内：traceId.get() = ${JSON.stringify(traceId.get())}`);
                // 3) 同时有另一个独立 Variable
                userId.run(42, () => {
                    L.push(`  嵌套 userId.run(42) 内：traceId=${JSON.stringify(traceId.get())}, userId=${JSON.stringify(userId.get())}`);
                });
                L.push(`  退出 userId.run 后：userId.get() = ${JSON.stringify(userId.get())}（已恢复 undefined）`);
            });
            // 4) 嵌套 run 隔离：内层 run 不影响外层
            traceId.run('outer', () => {
                L.push(`traceId.run('outer') 内：get() = ${JSON.stringify(traceId.get())}`);
                traceId.run('inner', () => {
                    L.push(`  嵌套 run('inner') 内：get() = ${JSON.stringify(traceId.get())}（内层覆盖）`);
                });
                L.push(`  退出 inner 后：get() = ${JSON.stringify(traceId.get())}（恢复 outer）`);
            });
            // 5) run 的返回值 = callback 返回值
            const ret = traceId.run('with-return', () => {
                const v = traceId.get();
                return `processed:${v}`;
            });
            L.push(`run 返回值透传：traceId.run('with-return', cb) → ${JSON.stringify(ret)}`);
            L.push('', '说明（朴素 polyfill 限制）：');
            L.push('  • 同步 .run/.get/嵌套隔离 行为与提案一致 ✓');
            L.push('  • 跨 await/setTimeout 不保留（栈在 finally 已 pop）✗ → 见 Card 4');
            L.push(`  • 真实 AsyncContext${c.asyncContext ? '已可用' : '未落地'}：${c.asyncContext ? '可直接用 new AsyncContext.Variable(name)' : 'jsdom 未实现，可安装 asynccontext npm 包或 zone.js polyfill'}`);
        }
        catch (err) {
            this._addLog('warn', `Variable 演示失败：${err.name} - ${err.message}`);
            this.setState({ variableInfo: `Variable 演示失败：${err.message}` });
            return;
        }
        this.setState({
            variableInfo: `AsyncContext.Variable 演示（朴素 polyfill，同步部分真实运行）：\n${L.join('\n')}\n\n` +
                `参考 API：\n` +
                `  const v = new AsyncContext.Variable(name?);   // 声明\n` +
                `  v.run(value, callback);            // 设值并执行 callback，返回 callback 返回值\n` +
                `  v.get();                           // 读取当前作用域的值（run 外为 undefined）\n` +
                `  v.name;                            // 可选的名字（调试用）`,
        });
        this._addLog('variable', `Variable 演示完成：${L.length} 行记录（朴素 polyfill 同步语义）`);
    }
    _renderCard2() {
        const s = this.state;
        const c = this._caps();
        const card = new Card({
            title: '2. AsyncContext.Variable（run / get / 嵌套隔离）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: c.variable ? 'success' : 'warning' }, c.variable ? 'Variable ✓' : '用 polyfill 演示')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new AsyncContext.Variable(name?) 声明一个上下文变量；var.run(value, callback) 设值并执行 callback，callback 内（含同步子调用）var.get() 读取该值；run 返回 callback 的返回值。嵌套 run 隔离：内层 run 的值不影响外层，退出内层后 get() 恢复外层值。多个 Variable 互相独立。run 作用域外 get() 返回 undefined。本卡片用「朴素 polyfill（栈式）」真实运行同步部分；跨 await 行为见 Card 4。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('演示 Variable', { type: 'primary', size: 'sm', onClick: () => this._demoVariable() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Variable 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.variableInfo || '（点击「演示 Variable」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：嵌套 run 隔离'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `const v = new AsyncContext.Variable('v');
v.run('outer', () => {
  v.get();              // 'outer'
  v.run('inner', () => {
    v.get();            // 'inner'（内层覆盖）
  });
  v.get();              // 'outer'（恢复）
});
v.get();                // undefined（run 外）`)),
                h(Alert, {
                    type: 'warning',
                    message: '朴素 polyfill 仅同步可用',
                    description: '本卡的 polyfill 用「每变量一个栈」实现：run push、finally pop。这在同步代码中行为与提案一致；但 callback 一旦 await，finally 会先于异步续体执行，导致 get() 返回 undefined。真实 AsyncContext 由引擎在任务调度层传播快照，跨 await/setTimeout 自动保留（见 Card 4）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：AsyncContext.Snapshot ===================
    // 用朴素 polyfill 演示 Snapshot 捕获/恢复 + Snapshot.wrap 工厂
    _demoSnapshot() {
        const c = this._caps();
        const { Variable, Snapshot } = this._naive;
        const L = [];
        try {
            const traceId = Variable('traceId');
            const userId = Variable('userId');
            // 1) 在 outer 作用域内创建 Snapshot，捕获所有 Variable 当前值
            traceId.run('outer-trace', () => {
                userId.run('u-7', () => {
                    const snap = Snapshot(); // 捕获：traceId='outer-trace', userId='u-7'
                    L.push(`Snapshot 创建时：traceId=${JSON.stringify(traceId.get())}, userId=${JSON.stringify(userId.get())}`);
                    // 2) 切到完全不同的值
                    traceId.run('other-trace', () => {
                        userId.run('u-99', () => {
                            L.push(`切换后（无 snap）：traceId=${JSON.stringify(traceId.get())}, userId=${JSON.stringify(userId.get())}`);
                            // 3) snap.run 恢复到捕获时的值
                            snap.run(() => {
                                L.push(`snap.run 内（恢复）：traceId=${JSON.stringify(traceId.get())}, userId=${JSON.stringify(userId.get())}`);
                            });
                            L.push(`snap.run 退出后：traceId=${JSON.stringify(traceId.get())}, userId=${JSON.stringify(userId.get())}（恢复到切换值）`);
                        });
                    });
                });
            });
            // 4) Snapshot.wrap(fn)：返回一个「调用时恢复快照」的函数
            const wrapped = traceId.run('wrap-ctx', () => {
                const snap = Snapshot();
                return snap.wrap(() => `wrapped: traceId=${JSON.stringify(traceId.get())}`);
            });
            // 此时外层 traceId.get() === undefined
            L.push('', `Snapshot.wrap：在外层（traceId=${JSON.stringify(traceId.get())}）调用 wrapped() → ${JSON.stringify(wrapped())}`);
            L.push('  → wrapped() 调用时恢复了「创建 wrap 时的快照」，能读到 wrap-ctx');
            L.push('', '说明：');
            L.push('  • Snapshot 捕获「所有 Variable 的当前值」，run 时整体恢复（与单个 Variable.run 不同）');
            L.push('  • Snapshot.wrap(fn) 等价于：const s = Snapshot(); return (...a) => s.run(() => fn(...a))');
            L.push('  • 典型场景：addEventListener / setTimeout 等回调——回调触发时上下文已丢失，wrap 后能恢复');
            L.push(`  • 真实 AsyncContext.Snapshot${c.snapshot ? '已可用' : '未落地'}：${c.snapshot ? 'new AsyncContext.Snapshot()' : 'jsdom 未实现，polyfill 仅同步语义'}`);
        }
        catch (err) {
            this._addLog('warn', `Snapshot 演示失败：${err.name} - ${err.message}`);
            this.setState({ snapshotInfo: `Snapshot 演示失败：${err.message}` });
            return;
        }
        this.setState({
            snapshotInfo: `AsyncContext.Snapshot 演示（朴素 polyfill，同步部分真实运行）：\n${L.join('\n')}\n\n` +
                `参考 API：\n` +
                `  const snap = new AsyncContext.Snapshot();   // 捕获所有 Variable 当前值\n` +
                `  snap.run(callback);                         // 恢复并执行\n` +
                `  const fn = AsyncContext.Snapshot.wrap(fn);  // 工厂：返回「调用时恢复快照」的函数`,
        });
        this._addLog('snapshot', `Snapshot 演示完成：${L.length} 行记录（捕获/恢复/wrap 均已演示）`);
    }
    _renderCard3() {
        const s = this.state;
        const c = this._caps();
        const card = new Card({
            title: '3. AsyncContext.Snapshot（捕获/恢复 + wrap 工厂）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: c.snapshot ? 'success' : 'warning' }, c.snapshot ? 'Snapshot ✓' : '用 polyfill 演示'), h(Tag, { color: c.snapshotWrap ? 'primary' : 'warning' }, c.snapshotWrap ? 'wrap ✓' : 'wrap ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new AsyncContext.Snapshot() 一次性捕获「所有 Variable 的当前值」；snap.run(callback) 把所有 Variable 恢复到捕获时状态后执行 callback。Snapshot.wrap(fn) 是工厂：返回一个函数，调用时先恢复快照再执行 fn——适合把「注册时上下文」带给「触发时回调」（如 setTimeout/addEventListener 回调）。Variable.run 只设一个变量；Snapshot.run 整体恢复一组。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('演示 Snapshot', { type: 'primary', size: 'sm', onClick: () => this._demoSnapshot() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Snapshot 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.snapshotInfo || '（点击「演示 Snapshot」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：Snapshot.wrap 给回调带上注册时上下文'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `const v = new AsyncContext.Variable('v');
v.run('req-1', () => {
  // 注册回调时上下文是 'req-1'；回调触发时上下文已变
  btn.addEventListener('click', AsyncContext.Snapshot.wrap((e) => {
    v.get();           // 'req-1'（wrap 恢复了注册时快照）
    handleClick(e);
  }));
});
// 用户点击时 v.get() 在 wrap 内仍是 'req-1'，而非 undefined`)),
                h(Alert, {
                    type: 'info',
                    message: 'Snapshot 与 Variable.run 的关系',
                    description: 'Variable.run 修改单个变量并执行 callback；Snapshot 捕获所有变量、run 时整体恢复。Snapshot 不是「替换」Variable.run，而是「跨调用点恢复上下文」——典型用法是 wrap 一个回调，让回调在触发时仍能看到注册时的上下文。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：跨 await/Promise 边界 ===================
    // 用朴素 polyfill 演示「跨 await 失效」（诚实标注），对比真实 AsyncContext 行为
    _demoAwaitBoundary() {
        const c = this._caps();
        const { Variable } = this._naive;
        const L = [];
        let timerId = null;
        try {
            const traceId = Variable('traceId');
            // —— 同步部分：跨「同步 Promise.then」也立即失效 ——
            traceId.run('sync-ctx', () => {
                L.push(`run 内同步：traceId.get() = ${JSON.stringify(traceId.get())}`);
                Promise.resolve().then(() => {
                    // 微任务续体：polyfill 的栈已 pop（run 的 finally 先于 then 执行）
                    L.push(`Promise.then 续体：traceId.get() = ${JSON.stringify(traceId.get())}（polyfill: undefined / 真实: 'sync-ctx'）`);
                });
            });
            // —— 真实 AsyncContext 行为对照（仅当 API 可用时才真跑）——
            if (c.asyncContext) {
                try {
                    const realV = new AsyncContext.Variable('realTraceId');
                    realV.run('real-ctx', async () => {
                        await Promise.resolve();
                        L.push(`[真实 API] await 后：realV.get() = ${JSON.stringify(realV.get())}（应为 'real-ctx'）`);
                        await new Promise((r) => setTimeout(r, 20));
                        L.push(`[真实 API] setTimeout 20ms 后：realV.get() = ${JSON.stringify(realV.get())}（应为 'real-ctx'）`);
                        this.setState({ awaitBoundaryInfo: `AsyncContext 跨 await/Promise 边界演示（含真实 API）：\n${L.join('\n')}` });
                        this._addLog('await', '跨 await 演示完成（真实 API + polyfill 对照）');
                    });
                    return; // 真实 API 异步分支自行 setState
                }
                catch (err) {
                    L.push(`[真实 API] 失败：${err.name} - ${err.message}`);
                }
            }
            // —— polyfill 路径：再演示 setTimeout 续体也失效 ——
            traceId.run('timer-ctx', () => {
                timerId = setTimeout(() => {
                    L.push(`setTimeout 续体：traceId.get() = ${JSON.stringify(traceId.get())}（polyfill: undefined / 真实: 'timer-ctx'）`);
                    L.push('', '说明：');
                    L.push('  • 朴素 polyfill（栈式）在 callback 一旦返回（含 await 让出）就 pop，续体读到 undefined');
                    L.push('  • 真实 AsyncContext 由引擎在任务调度层传播「当前快照」，跨 await/setTimeout/queueMicrotask 自动保留');
                    L.push('  • requestAnimationFrame：Chrome 实现保留上下文；jsdom rAF 退化为 setTimeout，行为依实现而定');
                    L.push('  • 浏览器实现差异：Chrome（V8）原生实现最早；Safari/Firefox 仍以 polyfill/zone.js 为主');
                    this.setState({
                        awaitBoundaryInfo: `AsyncContext 跨 await/Promise 边界演示（朴素 polyfill，标注失效点）：\n${L.join('\n')}\n\n` +
                            `参考（真实 API 行为）：\n` +
                            `  const v = new AsyncContext.Variable('v');\n` +
                            `  v.run('ctx', async () => {\n` +
                            `    await fetch('/api');          // v.get() === 'ctx'\n` +
                            `    await Promise.resolve();      // v.get() === 'ctx'\n` +
                            `    queueMicrotask(() => v.get());// 'ctx'\n` +
                            `    setTimeout(() => v.get());    // 'ctx'\n` +
                            `    requestAnimationFrame(() => v.get()); // 'ctx'（Chrome）\n` +
                            `  });`,
                    });
                    this._addLog('await', '跨 await 演示完成（polyfill 标注失效 + 真实行为对照说明）');
                }, 20);
                if (timerId)
                    this._pendingTimers.push(timerId);
            });
        }
        catch (err) {
            this._addLog('warn', `跨 await 演示失败：${err.name} - ${err.message}`);
            this.setState({ awaitBoundaryInfo: `跨 await 演示失败：${err.message}` });
        }
    }
    _renderCard4() {
        const s = this.state;
        const c = this._caps();
        const card = new Card({
            title: '4. 跨 await / Promise 边界（自动保留）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: c.asyncContext ? 'success' : 'warning' }, c.asyncContext ? '真实 API ✓' : 'polyfill 标注失效'), h(Tag, { color: 'primary' }, 'await · setTimeout · rAF')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'AsyncContext 的核心承诺：在 var.run(value, callback) 作用域内，callback 触发的所有异步续体（await、Promise.then、queueMicrotask、setTimeout、requestAnimationFrame）都能 var.get() 读到 value。机制：引擎在「调度续体」时携带「当前上下文快照」，续体执行前恢复。本卡用朴素 polyfill 演示「跨 await 失效」（栈在 finally 已 pop），并对照真实 API 行为；若环境有真实 AsyncContext，会一并跑真实用例。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('演示跨 await 边界', { type: 'primary', size: 'sm', onClick: () => this._demoAwaitBoundary() })),
                h('div', { class: 'fs-sm text-secondary' }, '跨 await 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.awaitBoundaryInfo || '（点击「演示跨 await 边界」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：续体类型与是否保留'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `// 真实 AsyncContext 在以下续体中均自动保留 v.get()
v.run('ctx', async () => {
  await micro;            // ✓ 微任务（Promise.then / queueMicrotask）
  await new Promise(r => setTimeout(r, 0));  // ✓ 宏任务（setTimeout）
  requestAnimationFrame(() => v.get());      // ✓ Chrome；jsdom rAF 退化
});
// ✗ 不保留：new Promise(executor) 内同步 executor 不属于「续体」
// ✗ 不保留：addEventListener 回调（注册与触发跨多次任务，需 Snapshot.wrap）`)),
                h(Alert, {
                    type: 'warning',
                    message: 'polyfill 标注失效点 ≠ 提案行为',
                    description: '本卡 polyfill 跨 await/setTimeout 会读到 undefined，这是「朴素栈式实现」的固有局限，不是 AsyncContext 提案的行为。真实 AsyncContext 由引擎在调度层传播快照，跨 await 自动保留。要体验真实行为，需在 Chrome（启用实验标志）或安装 asynccontext/zone.js polyfill。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：与 fetch 协同 ===================
    _demoFetchCoordination() {
        const c = this._caps();
        const f = this._flags();
        const info = '===== AsyncContext 与 fetch / Response.body / Service Worker 协同 =====\n\n' +
            '【1】traceId 透传到所有 fetch：\n' +
            '  const traceId = new AsyncContext.Variable("traceId");\n' +
            '  // 全局 fetch 包装：从上下文读 traceId，注入 header\n' +
            '  const origFetch = globalThis.fetch;\n' +
            '  globalThis.fetch = (url, opts = {}) => {\n' +
            '    const tid = traceId.get();\n' +
            '    if (tid) opts.headers = { ...opts.headers, "x-trace-id": tid };\n' +
            '    return origFetch(url, opts);\n' +
            '  };\n' +
            '  traceId.run("req-abc", async () => {\n' +
            '    await fetch("/api/a");   // 自动带 x-trace-id: req-abc\n' +
            '    await fetch("/api/b");   // 同样带，无需逐个传参\n' +
            '  });\n\n' +
            '【2】流式 Response.body（ReadableStream）跨 chunk 保留：\n' +
            '  traceId.run("stream-ctx", async () => {\n' +
            '    const res = await fetch("/stream");\n' +
            '    const reader = res.body.getReader();\n' +
            '    while (true) {\n' +
            '      const { value, done } = await reader.read();\n' +
            '      if (done) break;\n' +
            '      metrics.chunk(traceId.get());  // ✓ 每个 chunk 仍能读到 "stream-ctx"\n' +
            '    }\n' +
            '  });\n\n' +
            '【3】AbortSignal.any 协同：用户取消 OR 超时 OR 父任务取消，任一发生即中止 fetch\n' +
            '  const userCancel = new AbortController();\n' +
            '  traceId.run("req-with-cancel", async () => {\n' +
            '    const signal = AbortSignal.any([\n' +
            '      userCancel.signal,\n' +
            '      AbortSignal.timeout(5000),\n' +
            '      parentTask.signal,\n' +
            '    ]);\n' +
            '    await fetch("/api", { signal });  // 任一 abort 即抛 AbortError\n' +
            '    logger.log("done", traceId.get()); // ✓ "req-with-cancel"\n' +
            '  });\n' +
            `  当前环境 AbortSignal.any: ${f.abortSignalAny ? '✓ 可用' : '✗ 不可用（较新环境）'}\n\n` +
            '【4】Service Worker fetch 事件：AsyncContext 不跨 Service Worker 边界\n' +
            '  // 主线程：traceId.run("req-1", () => fetch("/api"))\n' +
            '  // SW: self.addEventListener("fetch", e => {\n' +
            '  //   traceId.get();  // ✗ undefined！SW 是独立全局，上下文不跨进程\n' +
            '  //   e.respondWith(fetch(e.request));  // 需把 traceId 写进 request header 显式传\n' +
            '  // });\n' +
            '  → 跨 Worker/SW 边界：必须把上下文「序列化」进 message / request header（结构化可克隆值）。\n\n' +
            `当前环境检测：fetch=${f.fetch ? '✓' : '✗'}，AbortSignal.any=${f.abortSignalAny ? '✓' : '✗'}。` +
            `AsyncContext=${c.asyncContext ? '✓' : '✗（提案未落地，jsdom 无）'}。`;
        this.setState({ fetchInfo: info });
        this._addLog('fetch', `fetch 协同演示：fetch=${f.fetch ? '✓' : '✗'}, AbortSignal.any=${f.abortSignalAny ? '✓' : '✗'}, AsyncContext=${c.asyncContext ? '✓' : '✗'}`);
    }
    _renderCard5() {
        const s = this.state;
        const c = this._caps();
        const f = this._flags();
        const card = new Card({
            title: '5. 与 fetch / Response.body / Service Worker 协同',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: f.fetch ? 'success' : 'error' }, f.fetch ? 'fetch ✓' : 'fetch ✗'), h(Tag, { color: f.abortSignalAny ? 'success' : 'warning' }, f.abortSignalAny ? 'AbortSignal.any ✓' : 'any ✗'), h(Tag, { color: c.asyncContext ? 'success' : 'warning' }, c.asyncContext ? 'AsyncContext ✓' : '提案未落地')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'AsyncContext 与 fetch 协同的三个典型场景：(1) 全局 fetch 包装从上下文读 traceId 注入 header，所有请求自动带 traceId；(2) Response.body 流式读取跨 chunk 保留上下文；(3) AbortSignal.any 合并「用户取消/超时/父任务取消」与 AsyncContext 配合实现可取消的可追踪请求。Service Worker 的 fetch 事件是独立全局，AsyncContext 不跨进程边界——需把 traceId 序列化进 request header 显式传递。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展开 fetch 协同', { type: 'primary', size: 'sm', onClick: () => this._demoFetchCoordination() })),
                h('div', { class: 'fs-sm text-secondary' }, 'fetch 协同说明：'),
                h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } }, h('code', {}, s.fetchInfo || '（点击「展开 fetch 协同」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：全局 fetch 包装注入 traceId'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `const traceId = new AsyncContext.Variable('traceId');
const origFetch = globalThis.fetch;
globalThis.fetch = (url, opts = {}) => {
  const tid = traceId.get();
  if (tid) opts.headers = { ...opts.headers, 'x-trace-id': tid };
  return origFetch(url, opts);
};
traceId.run('req-abc', async () => {
  await fetch('/api/a');   // 自动带 x-trace-id: req-abc
  await fetch('/api/b');   // 同样带，无需逐个传参
});`)),
                h(Alert, {
                    type: 'warning',
                    message: 'Service Worker 边界不传播',
                    description: 'AsyncContext 是「同进程异步续体」的上下文传播，不跨 Worker/Service Worker/iframe 进程边界。跨边界时必须把 traceId 等上下文序列化进 message 或 request header 显式传递，对方进程在自己的 AsyncContext.run 中重新建立。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：与 scheduler/Worker 协同 ===================
    _demoSchedulerWorker() {
        const c = this._caps();
        const f = this._flags();
        const info = '===== AsyncContext 与 scheduler / Worker 协同：传播矩阵 =====\n\n' +
            '【scheduler.postTask / scheduler.yield】（Chrome 94+，优先级调度）\n' +
            '  traceId.run("sched-ctx", async () => {\n' +
            '    scheduler.postTask(() => {\n' +
            '      traceId.get();   // ✓ 真实 AsyncContext：postTask 续体保留\n' +
            '    }, { priority: "user-visible" });\n' +
            '    await scheduler.yield();  // ✓ yield 续体保留\n' +
            '    traceId.get();            // "sched-ctx"\n' +
            '  });\n' +
            `  当前环境：scheduler.postTask=${f.schedulerPostTask ? '✓' : '✗'}，scheduler.yield=${f.schedulerYield ? '✓' : '✗'}\n\n` +
            '【Worker postMessage】上下文传播矩阵：\n' +
            '  ┌─────────────────────────┬──────────────────────────────────┐\n' +
            '  │ 传播路径                │ AsyncContext 是否保留            │\n' +
            '  ├─────────────────────────┼──────────────────────────────────┤\n' +
            '  │ 主线程 → postMessage → Worker onmessage ✗ │ 不保留（跨进程）  │\n' +
            '  │ Worker 内部 await/setTimeout             ✓ │ 保留（同进程）    │\n' +
            '  │ Worker → postMessage → 主线程 onmessage  ✗ │ 不保留（跨进程）  │\n' +
            '  │ MessageChannel port 双向                 ✗ │ 不保留（跨端口）  │\n' +
            '  │ BroadcastChannel                         ✗ │ 不保留（跨广播）  │\n' +
            '  └─────────────────────────┴──────────────────────────────────┘\n' +
            `  当前环境：Worker=${f.worker ? '✓' : '✗（jsdom 不支持）'}, MessageChannel=${f.messageChannel ? '✓' : '✗'}\n\n` +
            '【可转移对象 vs structuredClone 限制】\n' +
            '  主线程 → Worker 传上下文，必须序列化进 message：\n' +
            '  worker.postMessage({ type: "ctx", traceId: traceId.get() });\n' +
            '  // Worker 内：self.onmessage = e => { traceId.run(e.data.traceId, () => work()); }\n' +
            '  • 可转移对象（Transferable）：ArrayBuffer / MessagePort / ImageBitmap 等「零拷贝移交」\n' +
            '    → 但 AsyncContext 本身不是 Transferable，不能 postMessage 传播\n' +
            '  • structuredClone 限制：Function / DOM 节点 / WeakRef / SharedArrayBuffer（需 COOP/COEP）等不可克隆\n' +
            `    → 上下文里的函数引用无法跨 Worker，只能传「值」（traceId 字符串、tenantId 数字等）\n` +
            `    → 当前环境 structuredClone=${f.structuredClone ? '✓' : '✗'}\n\n` +
            '【实践模式：上下文桥接】\n' +
            '  // 主线程：把上下文打包随 message 传\n' +
            '  traceId.run("req-1", () => {\n' +
            '    worker.postMessage({ traceId: traceId.get(), payload });\n' +
            '  });\n' +
            '  // Worker：在 onmessage 内重新 run 建立上下文\n' +
            '  self.onmessage = (e) => traceId.run(e.data.traceId, () => handle(e.data.payload));\n' +
            `  AsyncContext=${c.asyncContext ? '✓' : '✗（提案未落地）'}。`;
        this.setState({ schedulerWorkerInfo: info });
        this._addLog('sched', `scheduler/Worker 协同：postTask=${f.schedulerPostTask ? '✓' : '✗'}, yield=${f.schedulerYield ? '✓' : '✗'}, Worker=${f.worker ? '✓' : '✗'}`);
    }
    _renderCard6() {
        const s = this.state;
        const c = this._caps();
        const f = this._flags();
        const card = new Card({
            title: '6. 与 scheduler / Worker 协同（传播矩阵）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: f.schedulerPostTask ? 'success' : 'warning' }, f.schedulerPostTask ? 'postTask ✓' : 'postTask ✗'), h(Tag, { color: f.schedulerYield ? 'success' : 'warning' }, f.schedulerYield ? 'yield ✓' : 'yield ✗'), h(Tag, { color: f.worker ? 'success' : 'warning' }, f.worker ? 'Worker ✓' : 'Worker ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'scheduler.postTask/scheduler.yield（Chrome 94+）是浏览器优先级调度 API，真实 AsyncContext 在其续体中保留上下文。Worker postMessage 跨进程，AsyncContext 不传播——必须把上下文值序列化进 message，Worker 内 onmessage 重新 run 建立。可转移对象（Transferable）只能零拷贝移交 ArrayBuffer/MessagePort 等，不能传播 AsyncContext；structuredClone 限制 Function/DOM 节点不可克隆，所以上下文里只能传「值」。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展开传播矩阵', { type: 'primary', size: 'sm', onClick: () => this._demoSchedulerWorker() })),
                h('div', { class: 'fs-sm text-secondary' }, 'scheduler/Worker 协同说明：'),
                h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } }, h('code', {}, s.schedulerWorkerInfo || '（点击「展开传播矩阵」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：Worker 上下文桥接模式'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `// 主线程：把上下文打包随 message 传
traceId.run('req-1', () => {
  worker.postMessage({ traceId: traceId.get(), payload });
});
// Worker：在 onmessage 内重新 run 建立上下文
self.onmessage = (e) => traceId.run(e.data.traceId, () => handle(e.data.payload));`)),
                h(Alert, {
                    type: 'info',
                    message: 'AsyncContext 是「同进程」语义',
                    description: 'AsyncContext 的传播边界 = 同一 JS 引擎实例的异步续体。跨 Worker/Service Worker/iframe 进程时，每个进程有独立的 AsyncContext 状态，需要「桥接」：主线程把上下文值序列化进 message，Worker 在 onmessage 内 run 重建。这与 Node 的 worker_threads vs AsyncLocalStorage 关系一致。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：实战 APM tracing 与多租户 ===================
    // 用朴素 polyfill 模拟「多租户 fetch 透传」与「locale SSR 透传」（同步部分真实运行）
    _demoApmMultiTenant() {
        const c = this._caps();
        const { Variable } = this._naive;
        const L = [];
        try {
            // —— 模拟多租户 SaaS：tenantId 透传到所有「fetch」——
            const tenantId = Variable('tenantId');
            const traceId = Variable('traceId');
            const locale = Variable('locale');
            // 模拟「带上下文的 fetch 包装」
            const fetchCalls = [];
            const ctxFetch = (url) => {
                const tid = traceId.get();
                const ten = tenantId.get();
                fetchCalls.push({ url, tid, ten });
                return Promise.resolve({ ok: true, tid, ten });
            };
            // —— 场景 1：APM tracing —— 每个请求一个 traceId，所有子调用自动带
            traceId.run('trace-001', () => {
                tenantId.run('tenant-A', () => {
                    locale.run('zh-CN', () => {
                        L.push('【场景 1】APM tracing + 多租户 + 多语言（同步模拟）：');
                        L.push(`  traceId=${JSON.stringify(traceId.get())}, tenantId=${JSON.stringify(tenantId.get())}, locale=${JSON.stringify(locale.get())}`);
                        // 模拟一次「请求处理」内的多个子 fetch
                        ctxFetch('/api/user');
                        ctxFetch('/api/orders');
                        ctxFetch('/api/invoice');
                        L.push(`  3 个子 fetch 均自动带上 traceId/tenantId：`);
                        fetchCalls.forEach((c2, i) => L.push(`    [${i + 1}] ${c2.url} → tid=${c2.tid}, tenant=${c2.ten}`));
                    });
                });
            });
            // —— 场景 2：模拟「不同租户并发」隔离 ——
            L.push('', '【场景 2】并发请求隔离（朴素 polyfill 同步模拟）：');
            ['tenant-A', 'tenant-B', 'tenant-C'].forEach((ten) => {
                tenantId.run(ten, () => {
                    // 模拟该租户的请求处理
                    const seen = tenantId.get();
                    L.push(`  处理 ${ten}：tenantId.get() = ${JSON.stringify(seen)}（隔离，互不串号）`);
                });
            });
            // —— 场景 3：OpenTelemetry Web SDK 集成示意 ——
            L.push('', '【场景 3】OpenTelemetry Web SDK 集成示意：');
            L.push('  // otel context 与 AsyncContext 同构：otel 用 Context API，AsyncContext 是语言层');
            L.push('  const tracer = otel.trace.getTracer("app");');
            L.push('  traceId.run(spanId, () => {');
            L.push('    const span = tracer.startSpan("handleReq");');
            L.push('    // otel.context.active() 可由 AsyncContext.Variable 实现');
            L.push('    return otel.context.with(otel.trace.setSpan(otel.context.active(), span), () => {');
            L.push('      await fetch("/api");  // otel fetch instrumentation 自动注入 span');
            L.push('    });');
            L.push('  });');
            // —— 场景 4：多语言 SSR locale 透传 ——
            L.push('', '【场景 4】多语言 SSR locale 透传到所有 async 渲染：');
            L.push('  // SSR 入口：根据请求 Accept-Language 决定 locale');
            L.push('  locale.run(req.locale, async () => {');
            L.push('    const html = await renderApp();   // 内部所有 async 组件都能 locale.get()');
            L.push('    res.send(html);');
            L.push('  });');
            L.push('  // renderApp 内部：');
            L.push('  async function renderApp() {');
            L.push('    const t = i18n.t(locale.get());   // ✓ 跨 await 仍能读到');
            L.push('    return `<html lang="${locale.get()}">${t}</html>`;');
            L.push('  }');
            L.push('', `说明：AsyncContext=${c.asyncContext ? '✓（真实可用）' : '✗（朴素 polyfill，仅同步语义；真实跨 await 需引擎实现）'}。`);
            L.push('  • 多租户 SaaS：tenantId 透传到所有 fetch，杜绝「逐层传参」与「全局变量串号」');
            L.push('  • APM tracing：traceId 自动随异步续体传播，子 span 无需显式传 context');
            L.push('  • 多语言 SSR：locale 在 run 作用域内跨 await 渲染保留，i18n 不需每个组件传 locale');
        }
        catch (err) {
            this._addLog('warn', `APM/多租户演示失败：${err.name} - ${err.message}`);
            this.setState({ apmInfo: `APM/多租户演示失败：${err.message}` });
            return;
        }
        this.setState({
            apmInfo: `AsyncContext 实战：APM tracing + 多租户 + 多语言 SSR（朴素 polyfill 同步模拟）：\n${L.join('\n')}\n\n` +
                `参考：多租户 fetch 包装\n` +
                `  const tenantId = new AsyncContext.Variable('tenantId');\n` +
                `  globalThis.fetch = (url, opts = {}) => {\n` +
                `    const t = tenantId.get();\n` +
                `    if (t) opts.headers = { ...opts.headers, 'x-tenant-id': t };\n` +
                `    return origFetch(url, opts);\n` +
                `  };\n` +
                `  // 每个请求 run 自己的 tenantId，所有 fetch 自动带，并发隔离不串号`,
        });
        this._addLog('apm', `APM/多租户演示完成：${L.length} 行记录（含 3 个子 fetch 自动带 tid/tenant）`);
    }
    _renderCard7() {
        const s = this.state;
        const c = this._caps();
        const card = new Card({
            title: '7. 实战：APM tracing 与多租户 / 多语言 SSR',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: c.asyncContext ? 'success' : 'warning' }, c.asyncContext ? 'AsyncContext ✓' : 'polyfill 模拟'), h(Tag, { color: 'primary' }, 'otel · tenantId · locale')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '三大实战场景：(1) APM tracing——OpenTelemetry Web SDK 的 context API 与 AsyncContext 同构，traceId 自动随异步续体传播，子 span 无需显式传 context；(2) 多语言 SSR——locale 在 run 作用域内跨 await 渲染保留，i18n 不需每个组件传 locale；(3) 多租户 SaaS——tenantId 透传到所有 fetch，杜绝逐层传参与全局变量串号。本卡用朴素 polyfill 同步模拟「3 个子 fetch 自动带 tid/tenant」与「并发租户隔离」。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('演示 APM/多租户', { type: 'primary', size: 'sm', onClick: () => this._demoApmMultiTenant() })),
                h('div', { class: 'fs-sm text-secondary' }, 'APM/多租户演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } }, h('code', {}, s.apmInfo || '（点击「演示 APM/多租户」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：多语言 SSR locale 透传'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `const locale = new AsyncContext.Variable('locale');
// SSR 入口：根据请求 Accept-Language 决定 locale
locale.run(req.locale, async () => {
  const html = await renderApp();   // 内部所有 async 组件都能 locale.get()
  res.send(html);
});
async function renderApp() {
  const t = i18n.t(locale.get());   // ✓ 跨 await 仍能读到
  return \`<html lang="\${locale.get()}">\${t}</html>\`;
}`)),
                h(Alert, {
                    type: 'info',
                    message: 'AsyncContext 是 OpenTelemetry Web SDK 的天然底座',
                    description: 'otel.context.with(ctx, fn) 与 AsyncContext.Variable.run(value, fn) 语义同构。当前 otel Web SDK 用 zone.js 或自实现的 context manager；AsyncContext 落地后可直接作为 otel context 的零开销底座，取代 zone.js。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 8：对照与陷阱 ===================
    _demoComparisonPitfalls() {
        const c = this._caps();
        const f = this._flags();
        const info = '===== AsyncContext 与 AsyncLocalStorage 对照 + 陷阱 + 协同 =====\n\n' +
            '【1】与 Node AsyncLocalStorage API 对照：\n' +
            '  ┌────────────────────┬─────────────────────────────┬────────────────────────────┐\n' +
            '  │ 维度               │ Node AsyncLocalStorage       │ TC39 AsyncContext          │\n' +
            '  ├────────────────────┼─────────────────────────────┼────────────────────────────┤\n' +
            '  │ 命名空间           │ require("async_hooks").ALS   │ 全局 AsyncContext          │\n' +
            '  │ 容器类             │ new AsyncLocalStorage()      │ new AsyncContext.Variable()│\n' +
            '  │ 设值执行           │ als.run(store, cb)           │ v.run(value, cb)           │\n' +
            '  │ 读取当前值         │ als.getStore()               │ v.get()                    │\n' +
            '  │ 快照恢复           │ als.enterWith(store)（废弃） │ new Snapshot().run(cb)     │\n' +
            '  │ wrap 回调          │ als.bind(fn)                 │ Snapshot.wrap(fn)          │\n' +
            '  │ 退出回调清理       │ als.disable()（已废弃）       │ 无（run 作用域自动恢复）   │\n' +
            '  │ 平台               │ 仅 Node                      │ 浏览器 + Node（提案目标）  │\n' +
            '  │ 实现               │ async_hooks                  │ 引擎原生（零开销目标）     │\n' +
            '  └────────────────────┴─────────────────────────────┴────────────────────────────┘\n' +
            '  未来 Node 可基于 AsyncContext 重新实现 ALS，API 双向兼容。\n\n' +
            '【2】Polyfill 性能开销：\n' +
            '  • zone.js：monkey-patch Promise/setTimeout/XHR/fetch 等 ~20 个 host API，\n' +
            '    每个异步操作多一层 wrapper + zone fork，开销 ~10-30%（Angular 早期实测）\n' +
            '  • asynccontext npm：基于 async_hooks（Node）或 zone.js（浏览器），开销依宿主\n' +
            '  • 真实 AsyncContext：引擎内联传播，目标零开销（hide-from-stack 减少栈深度）\n' +
            '  → 性能敏感场景：polyfill 仅作过渡，原生实现才是终局\n\n' +
            '【3】浏览器支持矩阵（截至 2026 年初，提案 Stage 2/3）：\n' +
            '  ┌──────────────┬──────────────────────────────────────────┐\n' +
            '  │ 浏览器        │ AsyncContext 支持情况                      │\n' +
            '  ├──────────────┼──────────────────────────────────────────┤\n' +
            '  │ Chrome/Edge   │ 实验标志可用（V8 原生实现领先）           │\n' +
            '  │ Firefox       │ 未原生，可用 zone.js polyfill             │\n' +
            '  │ Safari        │ 未原生，可用 zone.js polyfill             │\n' +
            '  │ Node.js       │ 未原生（仍用 AsyncLocalStorage）          │\n' +
            '  │ Deno/Bun      │ 实验性支持（基于 V8/JavaScriptCore）      │\n' +
            '  └──────────────┴──────────────────────────────────────────┘\n' +
            `  当前环境 AsyncContext=${c.asyncContext ? '✓' : '✗'}。\n\n` +
            '【4】常见陷阱（提案行为，需特别注意）：\n' +
            '  • new Promise(executor)：executor 是「同步执行」的，run 作用域内 OK；\n' +
            '    但若在 run 外 new Promise、run 内 await，续体保留 ✓；run 内 new Promise、\n' +
            '    run 外 await，则 resolve 续体不保留 ✗（看续体在哪个作用域调度）\n' +
            '  • addEventListener 回调：注册与触发跨多次任务，回调触发时上下文已丢失 ✗\n' +
            '    → 用 Snapshot.wrap(handler) 把注册时上下文带给触发时回调\n' +
            '  • Worker / Service Worker / iframe：跨进程边界，上下文不传播 ✗\n' +
            '    → 把上下文值序列化进 message / request header，对方进程重新 run\n' +
            '  • requestAnimationFrame：Chrome 保留 ✓，jsdom 退化为 setTimeout 行为依实现\n' +
            '  • 长任务（同步阻塞）：run 作用域内同步执行不影响，但同步阻塞会延迟续体调度\n\n' +
            '【5】与 using / Symbol.dispose 协同（ERM 提案）：\n' +
            '  // using 声明自动调用 [Symbol.dispose]，可与 AsyncContext.run 组合\n' +
            '  function withContext(value, fn) {\n' +
            '    return {\n' +
            '      [Symbol.dispose]() { /* run 退出清理钩子 */ },\n' +
            '    };\n' +
            '  }\n' +
            '  traceId.run("req-1", () => {\n' +
            '    using ctx = withContext(traceId.get(), () => {});  // 块结束自动 dispose\n' +
            '    doWork();\n' +
            '  });\n' +
            `  当前环境 Symbol.dispose=${f.symbolDispose ? '✓' : '✗'}。\n` +
            `  → using 与 AsyncContext 组合可实现「作用域级资源 + 上下文」的统一管理。`;
        this.setState({ comparisonInfo: info });
        this._addLog('cmp', `对照与陷阱：AsyncContext=${c.asyncContext ? '✓' : '✗'}, Symbol.dispose=${f.symbolDispose ? '✓' : '✗'}`);
    }
    _renderCard8() {
        const s = this.state;
        const c = this._caps();
        const f = this._flags();
        const card = new Card({
            title: '8. 对照与陷阱（AsyncLocalStorage / polyfill / 陷阱 / using）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: c.asyncContext ? 'success' : 'warning' }, c.asyncContext ? 'AsyncContext ✓' : '提案未落地'), h(Tag, { color: f.symbolDispose ? 'success' : 'warning' }, f.symbolDispose ? 'Symbol.dispose ✓' : 'dispose ✗'), h(Tag, { color: 'primary' }, 'ALS · zone.js · using')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'AsyncContext.Variable 与 Node AsyncLocalStorage API 形态接近（run/get/wrap），未来 Node 可基于 AsyncContext 重实现 ALS。Polyfill（zone.js / asynccontext npm）有 10-30% 开销，原生实现目标零开销。常见陷阱：new Promise 续体调度点决定是否保留、addEventListener 回调需 Snapshot.wrap、Worker/SW/iframe 跨进程不传播。与 using/Symbol.dispose（ERM 提案）协同可实现「作用域级资源 + 上下文」统一管理。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展开对照与陷阱', { type: 'primary', size: 'sm', onClick: () => this._demoComparisonPitfalls() })),
                h('div', { class: 'fs-sm text-secondary' }, '对照与陷阱说明：'),
                h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } }, h('code', {}, s.comparisonInfo || '（点击「展开对照与陷阱」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：addEventListener 回调用 Snapshot.wrap 带上下文'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `const v = new AsyncContext.Variable('v');
v.run('req-1', () => {
  // ✗ 不 wrap：触发时 v.get() === undefined
  btn.addEventListener('click', () => v.get());
  // ✓ wrap：触发时 v.get() === 'req-1'
  btn.addEventListener('click', AsyncContext.Snapshot.wrap(() => v.get()));
});`)),
                h(Alert, {
                    type: 'warning',
                    message: '三大陷阱：new Promise / addEventListener / Worker 边界',
                    description: 'AsyncContext 的传播边界 = 「同进程异步续体」。new Promise 的续体调度点决定是否保留；addEventListener 回调注册与触发跨任务，需 Snapshot.wrap 把注册时上下文带给触发时回调；Worker/Service Worker/iframe 是独立进程，AsyncContext 不跨边界，必须序列化进 message 重建。',
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
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, 'AsyncContext 异步上下文透传实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, 'TC39 Stage 2/3 提案：AsyncContext.Variable / AsyncContext.Snapshot。跨 await/Promise 边界自动保留上下文，解决「异步调用栈状态丢失」与「全局变量并发串号」。含 zone.js/AsyncLocalStorage 对照、fetch/scheduler/Worker 协同、APM tracing/多租户实战、polyfill 与陷阱。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8(), this._renderLogPanel());
    }
}
//# sourceMappingURL=AsyncContextPage.js.map