// =====================================================================
// AsyncCookbookPage.js —— 异步编程深度实验室
// 演示 MDN：Promise 组合器（all/allSettled/race/any）、微任务 vs 宏任务、
//   async/await 深度、异步迭代器/生成器、同步生成器双向通信、AbortController。
// 说明：所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。jsdom/Node 中 Promise 全家桶、queueMicrotask、AbortController 均真实可用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class AsyncCookbookPage extends Page {
    _inited = false;
    _abortController;
    _abortSignal;
    _abortTimeoutId;
    _abortListener;
    _cur;
    _end;
    _stepMs;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            combinatorResult: '', // Card 1：Promise 组合器对比
            taskOrder: '', // Card 2：微任务 vs 宏任务顺序
            asyncAwaitResult: '', // Card 3：async/await 错误处理 + 并行 vs 顺序
            asyncGenResult: '', // Card 4：异步生成器 + for await
            syncGenResult: '', // Card 5：同步生成器双向通信
            abortResult: '', // Card 6：AbortController + AbortSignal.timeout
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._abortController = null; // Card 6 当前的 AbortController
        this._abortSignal = null; // Card 6 当前的 signal
        this._abortTimeoutId = null; // Card 6 备用 setTimeout 句柄
        this._abortListener = null; // Card 6 abort 事件监听器
        // 一次性能力检测：异步编程全家桶
        const hasPromise = typeof Promise !== 'undefined' && typeof Promise.all === 'function';
        const hasAllSettled = hasPromise && typeof Promise.allSettled === 'function';
        const hasAny = hasPromise && typeof Promise.any === 'function';
        const hasQueueMicrotask = typeof queueMicrotask === 'function';
        const hasMessageChannel = typeof MessageChannel !== 'undefined';
        const hasRAF = typeof requestAnimationFrame === 'function';
        const hasAbortController = typeof AbortController !== 'undefined';
        const hasTimeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function';
        const hasAny2 = typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function';
        const hasAsyncIterator = typeof Symbol !== 'undefined' && typeof Symbol.asyncIterator === 'symbol';
        const parts = [];
        parts.push(`Promise ${hasPromise ? '✓' : '✗'}`);
        parts.push(`allSettled ${hasAllSettled ? '✓' : '✗'}`);
        parts.push(`any ${hasAny ? '✓' : '✗'}`);
        parts.push(`queueMicrotask ${hasQueueMicrotask ? '✓' : '✗'}`);
        parts.push(`MessageChannel ${hasMessageChannel ? '✓' : '✗'}`);
        parts.push(`requestAnimationFrame ${hasRAF ? '✓' : '✗'}`);
        parts.push(`AbortController ${hasAbortController ? '✓' : '✗'}`);
        parts.push(`AbortSignal.timeout ${hasTimeout ? '✓' : '✗'}`);
        parts.push(`AbortSignal.any ${hasAny2 ? '✓' : '✗'}`);
        parts.push(`Symbol.asyncIterator ${hasAsyncIterator ? '✓' : '✗'}`);
        const summary = hasPromise
            ? `异步能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）Promise 全家桶、queueMicrotask、MessageChannel、AbortController 均真实可用；requestAnimationFrame 由 jsdom 提供（可能退化为 setTimeout）。AbortSignal.timeout 需 Node 17.3+，AbortSignal.any 需较新环境。`
            : '当前环境不支持 Promise（typeof Promise === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(hasPromise ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!hasAllSettled)
            this._addLog('warn', 'Promise.allSettled 不可用（ES2020）');
        if (!hasAny)
            this._addLog('warn', 'Promise.any 不可用（ES2021）');
        if (!hasTimeout)
            this._addLog('warn', 'AbortSignal.timeout 不可用（需 Node 17.3+）');
        if (!hasAny2)
            this._addLog('warn', 'AbortSignal.any 不可用（较新环境才支持）');
        if (!hasRAF)
            this._addLog('warn', 'requestAnimationFrame 不可用（Node 通常无此 API）');
    }
    componentWillUnmount() {
        // 释放 AbortController 相关引用，清理可能残留的 setTimeout
        if (this._abortTimeoutId !== null) {
            clearTimeout(this._abortTimeoutId);
            this._abortTimeoutId = null;
        }
        this._abortController = null;
        this._abortSignal = null;
        this._abortListener = null;
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
    // —— 同步能力检测（render 时调用，开销可忽略）——
    _caps() {
        const hasPromise = typeof Promise !== 'undefined' && typeof Promise.all === 'function';
        return {
            promise: hasPromise,
            allSettled: hasPromise && typeof Promise.allSettled === 'function',
            any: hasPromise && typeof Promise.any === 'function',
            queueMicrotask: typeof queueMicrotask === 'function',
            messageChannel: typeof MessageChannel !== 'undefined',
            raf: typeof requestAnimationFrame === 'function',
            abortController: typeof AbortController !== 'undefined',
            abortSignalTimeout: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function',
            abortSignalAny: typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function',
            asyncIterator: typeof Symbol !== 'undefined' && typeof Symbol.asyncIterator === 'symbol',
        };
    }
    // —— 工具：带延迟的 Promise（成功 / 失败）——
    _delay(ms, value, label) {
        return new Promise((resolve) => setTimeout(() => resolve({ value, label, ms }), ms));
    }
    _delayReject(ms, reason, label) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: ${reason}`)), ms));
    }
    // =================== Card 1：Promise 组合器对比 ===================
    // Promise.all：全成功才成功，任一失败立即失败（短路）
    async _demoAll() {
        if (!this._caps().promise) {
            this._addLog('warn', 'Promise 不可用');
            return;
        }
        try {
            const t0 = Date.now();
            const ok = await Promise.all([this._delay(80, 1, 'p1'), this._delay(40, 2, 'p2'), this._delay(120, 3, 'p3')]);
            const tOk = Date.now() - t0;
            const t1 = Date.now();
            let partialErr = null;
            try {
                await Promise.all([this._delay(80, 1, 'p1'), this._delayReject(50, 'boom', 'p2-bad'), this._delay(120, 3, 'p3')]);
            }
            catch (err) {
                partialErr = err;
            }
            const tPartial = Date.now() - t1;
            this.setState({
                combinatorResult: `Promise.all([p1(80ms), p2(40ms), p3(120ms)]) —— 全成功才成功\n` +
                    `全部成功：结果 = ${JSON.stringify(ok)}（耗时 ${tOk}ms ≈ 最慢 p3）\n` +
                    `含一个失败（p2-bad 50ms reject）：第一个 reject 即短路 → ${partialErr ? partialErr.message : ''}\n` +
                    `  短路耗时 ${tPartial}ms ≈ p2-bad 的 50ms（不等 p3 完成）\n` +
                    `说明：all 失败短路常用于「任一失败立即终止」；返回数组顺序与入参一致（与完成时间无关）。`,
            });
            this._addLog('all', `Promise.all：全成功耗时 ${tOk}ms；含失败短路耗时 ${tPartial}ms`);
        }
        catch (err) {
            this._addLog('warn', `Promise.all 演示失败：${err.name} - ${err.message}`);
        }
    }
    // Promise.allSettled：等全部 settle，返回 [{status, value/reason}]，永不短路
    async _demoAllSettled() {
        if (!this._caps().allSettled) {
            this._addLog('warn', 'Promise.allSettled 不可用（ES2020）');
            return;
        }
        try {
            const t0 = Date.now();
            const results = await Promise.allSettled([
                this._delay(80, 1, 'p1'), this._delayReject(50, 'oops', 'p2-bad'), this._delay(120, 3, 'p3'),
            ]);
            const t = Date.now() - t0;
            const pretty = results.map((r, i) => r.status === 'fulfilled'
                ? `[${i}] fulfilled, value: ${JSON.stringify(r.value)}`
                : `[${i}] rejected, reason: ${r.reason.message}`).join('\n');
            this.setState({
                combinatorResult: `Promise.allSettled([p1(80ms ok), p2-bad(50ms reject), p3(120ms ok)])\n` +
                    `→ 全部 settle 后返回 [{status, value|reason}]，不会短路：\n${pretty}\n` +
                    `耗时 ${t}ms ≈ 最慢 p3 的 120ms（不因 p2 失败提前返回）\n` +
                    `说明：allSettled 永不 reject；适合「等所有请求完成，逐个汇报成败」场景。`,
            });
            this._addLog('allSettled', `Promise.allSettled 完成：3 项 settle，耗时 ${t}ms（不短路）`);
        }
        catch (err) {
            this._addLog('warn', `Promise.allSettled 演示失败：${err.name} - ${err.message}`);
        }
    }
    // Promise.race：第一个 settle 的（成功或失败）作为结果
    async _demoRace() {
        if (!this._caps().promise) {
            this._addLog('warn', 'Promise 不可用');
            return;
        }
        try {
            const t0 = Date.now();
            const fastestOk = await Promise.race([this._delay(80, 1, 'p1'), this._delay(40, 2, 'p2'), this._delay(120, 3, 'p3')]);
            const tOk = Date.now() - t0;
            const t1 = Date.now();
            let fastestErr = null;
            try {
                await Promise.race([this._delay(80, 1, 'p1'), this._delayReject(30, 'fast-fail', 'p2-bad'), this._delay(120, 3, 'p3')]);
            }
            catch (err) {
                fastestErr = err;
            }
            const tErr = Date.now() - t1;
            this.setState({
                combinatorResult: `Promise.race([p1, p2, p3]) —— 第一个 settle 的（成功或失败）作为结果\n` +
                    `场景 1（最快者成功）：p2(40ms) 最先 settle → value = ${JSON.stringify(fastestOk)}（耗时 ${tOk}ms）\n` +
                    `场景 2（最快者失败）：p2-bad(30ms reject) 最先 settle → reject ${fastestErr ? fastestErr.message : ''}（耗时 ${tErr}ms）\n` +
                    `说明：race 对「成功」与「失败」一视同仁，谁先 settle 谁赢；常用于超时控制：race([fetch(url), timeoutReject(5000)])。`,
            });
            this._addLog('race', `Promise.race：最快成功耗时 ${tOk}ms；最快失败短路耗时 ${tErr}ms`);
        }
        catch (err) {
            this._addLog('warn', `Promise.race 演示失败：${err.name} - ${err.message}`);
        }
    }
    // Promise.any：第一个成功的；全失败才抛 AggregateError
    async _demoAny() {
        if (!this._caps().any) {
            this._addLog('warn', 'Promise.any 不可用（ES2021）');
            return;
        }
        try {
            const t0 = Date.now();
            const firstOk = await Promise.any([
                this._delayReject(30, 'fail1', 'p1-bad'), this._delay(80, 'win', 'p2'), this._delayReject(50, 'fail3', 'p3-bad'),
            ]);
            const tOk = Date.now() - t0;
            const t1 = Date.now();
            let aggErr = null;
            try {
                await Promise.any([this._delayReject(30, 'fail1', 'p1-bad'), this._delayReject(50, 'fail2', 'p2-bad')]);
            }
            catch (err) {
                aggErr = err;
            }
            const tAgg = Date.now() - t1;
            this.setState({
                combinatorResult: `Promise.any([p1, p2, p3]) —— 第一个成功的；全失败才抛 AggregateError\n` +
                    `场景 1（含成功）：p2(80ms ok) 是首个成功 → value = ${JSON.stringify(firstOk)}（耗时 ${tOk}ms）\n` +
                    `  → 即使 p1-bad、p3-bad 先 reject，any 也会忽略它们继续等首个成功\n` +
                    `场景 2（全部失败）：所有 Promise 都 reject → ${aggErr ? aggErr.name : ''}（errors 长度 = ${aggErr && aggErr.errors ? aggErr.errors.length : '?'}，耗时 ${tAgg}ms）\n` +
                    `  → aggErr.errors[0].message = ${aggErr && aggErr.errors ? aggErr.errors[0].message : '?'}\n` +
                    `说明：any 是 all 的「对偶」—— all 要求全成功，any 要求至少一个成功。`,
            });
            this._addLog('any', `Promise.any：含成功耗时 ${tOk}ms；全失败抛 AggregateError（${aggErr && aggErr.errors ? aggErr.errors.length : 0} 个 errors），耗时 ${tAgg}ms`);
        }
        catch (err) {
            this._addLog('warn', `Promise.any 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. Promise 组合器对比（all / allSettled / race / any）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.promise ? 'success' : 'error' }, caps.promise ? 'Promise ✓' : '不可用'), h(Tag, { color: caps.allSettled && caps.any ? 'primary' : 'warning' }, 'allSettled / any')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Promise.all：全成功才成功，任一失败立即失败（短路）。Promise.allSettled：等全部 settle，返回 [{status, value/reason}]，永不短路。Promise.race：第一个 settle 的（成功或失败）作为结果。Promise.any：第一个成功的；全失败才抛 AggregateError（errors 数组聚合所有原因）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('Promise.all', { type: 'primary', size: 'sm', disabled: !caps.promise, onClick: () => this._demoAll() }), this._btn('allSettled', { type: 'primary', size: 'sm', disabled: !caps.allSettled, onClick: () => this._demoAllSettled() }), this._btn('race', { type: 'primary', size: 'sm', disabled: !caps.promise, onClick: () => this._demoRace() }), this._btn('any', { type: 'primary', size: 'sm', disabled: !caps.any, onClick: () => this._demoAny() })),
                h('div', { class: 'fs-sm text-secondary' }, '组合器结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.combinatorResult || '（点击 all / allSettled / race / any 任一按钮）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '组合器对照速查：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `// all       全成功→值数组；任一失败→立即 reject（短路）
Promise.all([p1,p2,p3]).then(arr=>arr).catch(e=>e);
// allSettled 永不 reject，返回 [{status, value|reason}]
// race      第一个 settle 的（成功或失败）作为结果
// any       第一个成功的；全失败→AggregateError(errors)`)),
                h(Alert, {
                    type: 'info',
                    message: '四个组合器的语义差异',
                    description: 'all 与 any 互为对偶：all 要求全成功（任一失败短路），any 要求至少一个成功（任一成功短路）。allSettled 永不短路，等所有 settle 后逐个汇报。race 对成功和失败一视同仁，谁先 settle 谁赢。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：微任务 vs 宏任务顺序 ===================
    // 演示 queueMicrotask / Promise.then / setTimeout / MessageChannel 的执行顺序
    _demoTaskOrder() {
        if (!this._caps().queueMicrotask || !this._caps().promise) {
            this._addLog('warn', 'queueMicrotask 或 Promise 不可用');
            return;
        }
        const seq = [];
        const record = (tag) => seq.push(`${seq.length + 1}. ${tag}`);
        record('sync-1（同步代码）');
        // 微任务：Promise.then / queueMicrotask / 链式 then
        Promise.resolve().then(() => record('Promise.then（微任务）'));
        queueMicrotask(() => record('queueMicrotask（微任务）'));
        Promise.resolve().then(() => record('Promise.then-2（微任务，链式）')).then(() => record('Promise.then-3（链式第二级）'));
        // 宏任务：setTimeout(0) / MessageChannel
        setTimeout(() => record('setTimeout 0（宏任务）'), 0);
        let mcLine = '';
        if (this._caps().messageChannel) {
            try {
                const ch = new MessageChannel();
                ch.port1.onmessage = () => {
                    record('MessageChannel.port（宏任务）');
                    mcLine = '（MessageChannel 已触发）';
                    this._finalizeTaskOrder(seq, mcLine);
                };
                ch.port2.postMessage(null);
            }
            catch (err) {
                mcLine = `（MessageChannel 失败：${err.message}）`;
                this._finalizeTaskOrder(seq, mcLine);
            }
        }
        else {
            mcLine = '（MessageChannel 不可用）';
            this._finalizeTaskOrder(seq, mcLine);
        }
        record('sync-2（同步代码，仍在主任务）');
        this._addLog('task', '已安排微任务（Promise.then / queueMicrotask）与宏任务（setTimeout / MessageChannel），等待事件循环执行…');
    }
    // 任务执行完毕后汇总顺序（在 MessageChannel 回调或 fallback 中调用）
    _finalizeTaskOrder(seq, mcLine) {
        setTimeout(() => {
            this.setState({
                taskOrder: `执行顺序（按 seq 编号）：\n${seq.join('\n')}\n\n` +
                    `说明：同步代码先执行（sync-1 → sync-2）；主任务结束后清空微任务队列\n` +
                    `（Promise.then → queueMicrotask → Promise.then-2，链式第二级 then-3 仍属本轮微任务）；\n` +
                    `微任务清空后才执行宏任务：setTimeout(0) → MessageChannel.port${mcLine}\n` +
                    `微任务：Promise.then 与 queueMicrotask 同级，按入队顺序；宏任务按调度顺序。`,
            });
            this._addLog('task', `任务执行顺序已记录（共 ${seq.length} 步）`);
        }, 0);
    }
    // 演示 requestAnimationFrame 在浏览器中的位置（jsdom/Node 中可能不可用或退化为 setTimeout）
    _demoRAF() {
        if (!this._caps().raf) {
            this._addLog('warn', 'requestAnimationFrame 不可用（Node 环境通常无此 API）');
            this.setState({
                taskOrder: 'requestAnimationFrame 不可用：当前环境（jsdom/Node）未提供 rAF。\n在真实浏览器中，rAF 回调在每次重绘前执行，属于独立的回调队列（不与微/宏任务混排）。',
            });
            return;
        }
        const seq = [];
        const record = (tag) => seq.push(`${seq.length + 1}. ${tag}`);
        record('sync');
        Promise.resolve().then(() => record('Promise.then（微任务）'));
        setTimeout(() => record('setTimeout 0（宏任务）'), 0);
        requestAnimationFrame(() => record('requestAnimationFrame（重绘前）'));
        setTimeout(() => {
            this.setState({
                taskOrder: `含 requestAnimationFrame 的执行顺序：\n${seq.join('\n')}\n\n` +
                    `说明：在真实浏览器中，rAF 回调在「每次重绘前」执行，位于微任务之后、下一次宏任务之前；\n` +
                    `但 jsdom 的 rAF 通常退化为 setTimeout(16)，顺序可能与浏览器不同。`,
            });
            this._addLog('task', `rAF 演示完成（${seq.length} 步）`);
        }, 50);
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. 微任务 vs 宏任务执行顺序',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.queueMicrotask ? 'success' : 'error' }, caps.queueMicrotask ? 'queueMicrotask ✓' : '不可用'), h(Tag, { color: caps.messageChannel ? 'primary' : 'warning' }, caps.messageChannel ? 'MessageChannel ✓' : 'MessageChannel ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '微任务（microtask）：Promise.then / queueMicrotask / MutationObserver，在每个宏任务结束后、下一个宏任务开始前清空。宏任务（macrotask）：setTimeout / setInterval / MessageChannel / I/O / UI 事件，按调度顺序逐个执行。事件循环：执行一个宏任务 → 清空所有微任务 → 渲染（rAF）→ 取下一个宏任务。本卡片安排一组微/宏任务，记录实际落地顺序。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('安排微/宏任务', { type: 'primary', size: 'sm', disabled: !caps.queueMicrotask, onClick: () => this._demoTaskOrder() }), this._btn('加测 rAF', { size: 'sm', disabled: !caps.raf, onClick: () => this._demoRAF() })),
                h('div', { class: 'fs-sm text-secondary' }, '实际执行顺序：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.taskOrder || '（点击「安排微/宏任务」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考：事件循环简化模型'),
                h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } }, h('code', {}, `// 事件循环（简化）
while (true) {
  taskQueue.shift()();                 // 取一个宏任务执行
  while (microtaskQueue.length) microtaskQueue.shift()();  // 清空微任务
  if (needsRender) { runRAFCallbacks(); paint(); }
}
// 微任务：Promise.then / queueMicrotask / MutationObserver
// 宏任务：setTimeout / MessageChannel / I/O / UI 事件`)),
                h(Alert, {
                    type: 'warning',
                    message: 'queueMicrotask 与 Promise.then 同属微任务',
                    description: 'queueMicrotask(cb) 与 Promise.resolve().then(cb) 在语义上等价，都把 cb 排入当前微任务队列。但 queueMicrotask 意图更明确，且不创建 Promise 对象，开销略小。两者执行顺序按入队先后。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：async/await 错误处理 + 并行 vs 顺序 ===================
    // async function 隐式返回 Promise；await 暂停函数执行；try/catch 捕获 reject
    async _demoAsyncBasics() {
        if (!this._caps().promise) {
            this._addLog('warn', 'Promise 不可用');
            return;
        }
        try {
            // 1) async function 隐式返回 Promise
            const implied = (async () => 42)();
            const impliedType = implied.constructor.name;
            const impliedVal = await implied;
            // 2) await 暂停函数
            const awaitedVal = await this._delay(30, 'hello', 'p');
            // 3) try/catch 捕获 reject
            let caught = null;
            try {
                await this._delayReject(20, 'intended', 'p-bad');
            }
            catch (err) {
                caught = err.message;
            }
            // 4) .catch() 链式捕获（与 try/catch 等价）
            const viaCatch = await this._delayReject(20, 'via-catch', 'p-bad').catch((err) => `recovered: ${err.message}`);
            // 5) finally 总会执行
            let finallyRan = false;
            try {
                await this._delay(10, 1, 'p');
            }
            finally {
                finallyRan = true;
            }
            this.setState({
                asyncAwaitResult: `async function 基础：\n` +
                    `1) 隐式返回 Promise：(async () => 42)() → ${impliedType}，await 后值 = ${impliedVal}\n` +
                    `2) await 暂停：await delay(30, 'hello') → ${JSON.stringify(awaitedVal)}\n` +
                    `3) try/catch 捕获 reject：caught.message = ${caught}\n` +
                    `4) .catch() 链式捕获（等价于 try/catch）：viaCatch = ${JSON.stringify(viaCatch)}\n` +
                    `5) finally 总会执行：finallyRan = ${finallyRan}\n` +
                    `说明：async function 返回值自动包成 Promise；await 暂停函数直到 Promise settle；try/catch 与 .catch() 等价；finally 不论成败都执行。`,
            });
            this._addLog('async', `async 基础：隐式 Promise=${impliedType}，try/catch 与 .catch() 均已验证`);
        }
        catch (err) {
            this._addLog('warn', `async 基础演示失败：${err.name} - ${err.message}`);
        }
    }
    // 并行 await（Promise.all）vs 顺序 await 的耗时对比
    async _demoParallelVsSequential() {
        if (!this._caps().promise) {
            this._addLog('warn', 'Promise 不可用');
            return;
        }
        try {
            const makeTask = (ms, label) => this._delay(ms, label, label);
            // 顺序：每个 await 都阻塞，总耗时 ≈ 三个之和
            const t0 = Date.now();
            const seqResults = [];
            seqResults.push(await makeTask(80, 'a'));
            seqResults.push(await makeTask(80, 'b'));
            seqResults.push(await makeTask(80, 'c'));
            const tSeq = Date.now() - t0;
            // 并行：Promise.all 同时启动，总耗时 ≈ 最慢的一个
            const t1 = Date.now();
            const parResults = await Promise.all([makeTask(80, 'a'), makeTask(80, 'b'), makeTask(80, 'c')]);
            const tPar = Date.now() - t1;
            this.setState({
                asyncAwaitResult: `并行 await（Promise.all）vs 顺序 await 耗时对比（三个任务各 80ms）：\n` +
                    `• 顺序 await：await a; await b; await c; → 耗时 ${tSeq}ms（≈ 80×3 = 240ms，串行累加）\n` +
                    `  结果 = ${JSON.stringify(seqResults)}\n` +
                    `• 并行 await：await Promise.all([a, b, c]) → 耗时 ${tPar}ms（≈ 80ms，取最慢）\n` +
                    `  结果 = ${JSON.stringify(parResults)}\n` +
                    `加速比：≈ ${(tSeq / Math.max(tPar, 1)).toFixed(1)}x\n` +
                    `说明：await 一个个写会串行；用 Promise.all 包裹后 await 才是并行。\n` +
                    `⚠ Promise.all 只是「发起」并行，await 是「等待」全部完成；CPU 密集任务不会因此变快。`,
            });
            this._addLog('async', `并行 vs 顺序：顺序 ${tSeq}ms / 并行 ${tPar}ms（加速 ≈ ${(tSeq / Math.max(tPar, 1)).toFixed(1)}x）`);
        }
        catch (err) {
            this._addLog('warn', `并行 vs 顺序演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. async/await 深度（错误处理 + 并行 vs 顺序）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.promise ? 'success' : 'error' }, caps.promise ? 'async/await ✓' : '不可用'), h(Tag, { color: 'primary' }, 'try/catch · Promise.all')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'async function 隐式返回 Promise；await 暂停函数执行直到 Promise settle；错误处理可用 try/catch 或 .catch()（等价）；finally 不论成败都执行。并行 await：await Promise.all([p1, p2, p3]) 同时发起、等待全部完成（耗时 ≈ 最慢者）；顺序 await：await p1; await p2; await p3; 串行累加（耗时 ≈ 三者之和）。ES2022 top-level await 允许模块顶层直接 await。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('async 基础', { type: 'primary', size: 'sm', disabled: !caps.promise, onClick: () => this._demoAsyncBasics() }), this._btn('并行 vs 顺序', { type: 'primary', size: 'sm', disabled: !caps.promise, onClick: () => this._demoParallelVsSequential() })),
                h('div', { class: 'fs-sm text-secondary' }, 'async/await 结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.asyncAwaitResult || '（点击「async 基础」或「并行 vs 顺序」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `// async function 隐式返回 Promise
async function f() { return 42; }      // f() → Promise<42>
// 错误处理：try/catch 与 .catch() 等价
try { await rejectP; } catch (e: any) { /* e */ }
// 并行 vs 顺序（差异在 await 的位置）
await p1; await p2; await p3;            // 顺序：耗时 ≈ p1+p2+p3
await Promise.all([p1, p2, p3]);         // 并行：耗时 ≈ max(p1,p2,p3)
// top-level await（ES2022，仅模块作用域）`)),
                h(Alert, {
                    type: 'info',
                    message: 'await Promise.all 才是真并行',
                    description: '常见误区：写成 await p1; await p2; 以为是并行，实际是串行。要并行必须先把 Promise 都「发起」（不 await），再用 Promise.all 包裹后整体 await。Promise.all 只是「等待」并发启动的 Promise，不负责启动本身。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：异步生成器 + for await ===================
    // async function* gen() { yield ... }：yield 出值；for await 消费
    async _demoAsyncGenerator() {
        if (!this._caps().promise || !this._caps().asyncIterator) {
            this._addLog('warn', 'Promise 或 Symbol.asyncIterator 不可用');
            return;
        }
        try {
            // 定义异步生成器：内部可 await，yield 暂停并把值交给消费者
            async function* counter(start, end, delayMs) {
                for (let i = start; i <= end; i++) {
                    await new Promise((r) => setTimeout(r, delayMs));
                    yield i; // yield 出值（被 for await 接收）
                }
                return 'done'; // return 值不会被 for await 消费（仅 done:true）
            }
            const collected = [];
            const t0 = Date.now();
            for await (const v of counter(1, 4, 40)) {
                collected.push(v);
                this._addLog('async-gen', `for await 收到 yield 值：${v}`);
            }
            const t = Date.now() - t0;
            // 演示手动调用 .next()：返回 {value, done}
            const gen = counter(10, 11, 20);
            const step1 = await gen.next();
            const step2 = await gen.next();
            const step3 = await gen.next();
            this.setState({
                asyncGenResult: `async function* 异步生成器 + for await：\n` +
                    `定义：async function* counter(1, 4, 40ms) { for i { await delay; yield i } }\n` +
                    `for await (const v of counter(1, 4, 40)) → 收集 [${collected.join(', ')}]\n` +
                    `总耗时 ${t}ms（4 次 yield × ~40ms，串行等待）\n\n` +
                    `手动 .next() 调用（每次返回 Promise<{value, done}>）：\n` +
                    `  gen.next() #1 = ${JSON.stringify(step1)}\n` +
                    `  gen.next() #2 = ${JSON.stringify(step2)}\n` +
                    `  gen.next() #3 = ${JSON.stringify(step3)}（done: true，value 为 return 值）\n` +
                    `说明：async function* 内部可 await；yield 暂停并把值交给 for await；\n` +
                    `return 的值出现在最后一个 {value, done:true} 中，但 for await 不会消费它；\n` +
                    `Symbol.asyncIterator 协议：对象实现 [Symbol.asyncIterator]() 返回 { next(): Promise<{value,done}> } 即可被 for await 消费。`,
            });
            this._addLog('async-gen', `for await 收集 [${collected.join(', ')}]，耗时 ${t}ms`);
        }
        catch (err) {
            this._addLog('warn', `异步生成器演示失败：${err.name} - ${err.message}`);
        }
    }
    // 自定义异步迭代器类（实现 Symbol.asyncIterator 协议）
    async _demoCustomAsyncIterator() {
        if (!this._caps().promise || !this._caps().asyncIterator) {
            this._addLog('warn', 'Promise 或 Symbol.asyncIterator 不可用');
            return;
        }
        try {
            // 自定义异步迭代器类
            class AsyncRange {
                _cur;
                _end;
                _stepMs;
                constructor(start, end, stepMs) {
                    this._cur = start;
                    this._end = end;
                    this._stepMs = stepMs;
                }
                [Symbol.asyncIterator]() { return this; } // 自身就是迭代器
                next() {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            if (this._cur > this._end)
                                resolve({ value: 'end', done: true });
                            else
                                resolve({ value: this._cur++, done: false });
                        }, this._stepMs);
                    });
                }
            }
            const collected = [];
            const t0 = Date.now();
            for await (const v of new AsyncRange(100, 103, 30))
                collected.push(v);
            const t = Date.now() - t0;
            this.setState({
                asyncGenResult: `自定义异步迭代器类（实现 Symbol.asyncIterator 协议）：\n` +
                    `class AsyncRange { [Symbol.asyncIterator]() { return this; } next(): any { return Promise<{value,done}> } }\n` +
                    `for await (const v of new AsyncRange(100, 103, 30)) → 收集 [${collected.join(', ')}]\n` +
                    `总耗时 ${t}ms（4 个值 × ~30ms）\n` +
                    `说明：任何对象实现 [Symbol.asyncIterator]() 方法（返回带 next() 的迭代器）即可被 for await 消费；\n` +
                    `next() 必须返回 Promise<{value, done}>。这是 fetch 流式响应、Node ReadableStream 等的基础协议。`,
            });
            this._addLog('async-iter', `自定义异步迭代器：收集 [${collected.join(', ')}]，耗时 ${t}ms`);
        }
        catch (err) {
            this._addLog('warn', `自定义异步迭代器演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '4. 异步生成器 + for await（async function* / Symbol.asyncIterator）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.asyncIterator ? 'success' : 'error' }, caps.asyncIterator ? 'asyncIterator ✓' : '不可用'), h(Tag, { color: 'primary' }, 'async function* · for await')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'async function* 声明异步生成器：内部可 await，yield 暂停并把值交给消费者。for await (const v of asyncIterable) 异步消费——每次迭代都 await 上一次 yield 的 Promise。手动调用 gen.next() 返回 Promise<{value, done}>。Symbol.asyncIterator 协议：对象实现 [Symbol.asyncIterator]() 方法（返回 { next(): Promise<{value, done}> }）即可被 for await 消费。这是流式数据（fetch 流、Node Stream）的基础。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('async 生成器 + for await', { type: 'primary', size: 'sm', disabled: !caps.asyncIterator, onClick: () => this._demoAsyncGenerator() }), this._btn('自定义异步迭代器', { size: 'sm', disabled: !caps.asyncIterator, onClick: () => this._demoCustomAsyncIterator() })),
                h('div', { class: 'fs-sm text-secondary' }, '异步迭代结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.asyncGenResult || '（点击「async 生成器 + for await」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `// async function* 异步生成器 + for await 消费
async function* fetchPages(url) {
  let page = 1;
  while (true) {
    const data = await fetch(\`\${url}?page=\${page}\`).then(r => r.json());
    if (!data.items.length) return;
    yield data.items;                 // yield 一批数据
    page++;
  }
}
for await (const batch of fetchPages('/api/list')) render(batch);`)),
                h(Alert, {
                    type: 'info',
                    message: 'for await 与同步 for...of 的差异',
                    description: 'for await 会 await 每次 .next() 返回的 Promise，适合异步序列；同步 for...of 不能消费异步迭代器。异步生成器的 return 值不会出现在 for await 循环体中，仅作为最后一个 {done:true} 的 value。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：同步生成器双向通信 ===================
    // function* gen() { ... yield ... }：next(value) 把 value 传回生成器
    _demoSyncGenerator() {
        try {
            // 双向通信：yield 表达式的返回值 = 调用方通过 next(value) 传入的 value
            function* dialog() {
                const a = yield 'Q1: 你叫什么？'; // a = next('Alice') 传入的 'Alice'
                const b = yield `Q2: 你好 ${a}，几岁？`; // b = next(30) 传入的 30
                return `Bye ${a}（${b} 岁）`;
            }
            const g = dialog();
            const steps = [];
            const r1 = g.next(); // 启动，传参被忽略
            steps.push(`g.next() → ${JSON.stringify(r1)}（首次启动，yield 返回 Q1）`);
            const r2 = g.next('Alice'); // 把 'Alice' 作为上一个 yield 的返回值
            steps.push(`g.next('Alice') → ${JSON.stringify(r2)}（'Alice' 传回给 a，yield 返回 Q2）`);
            const r3 = g.next(30); // 把 30 作为上一个 yield 的返回值
            steps.push(`g.next(30) → ${JSON.stringify(r3)}（30 传回给 b，return 'Bye Alice（30 岁）'）`);
            const r4 = g.next(); // 已 done，再 next 永远返回 {value:undefined, done:true}
            steps.push(`g.next()（已 done）→ ${JSON.stringify(r4)}`);
            this.setState({
                syncGenResult: `同步生成器双向通信（next(value) 把 value 传回生成器）：\n` +
                    `function* dialog(): Generator<any, any, any> { const a = yield 'Q1'; const b = yield 'Q2'; return ... }\n\n` +
                    `逐步执行：\n${steps.join('\n')}\n\n` +
                    `说明：yield 表达式的「返回值」由调用方下次 next(value) 的 value 决定；\n` +
                    `首次 next() 的参数会被忽略（还没有 yield 在等返回值）；return 的值出现在 {value, done:true} 中；\n` +
                    `生成器 done 后再 next() 永远返回 {value:undefined, done:true}。`,
            });
            this._addLog('sync-gen', `生成器双向通信：4 步执行完毕（a='Alice', b=30）`);
        }
        catch (err) {
            this._addLog('warn', `生成器双向通信演示失败：${err.name} - ${err.message}`);
        }
    }
    // next(value) / return(value) / throw(err) 三种「推进」方式 + yield* 委托
    _demoGeneratorControl() {
        try {
            function* counter() {
                let i = 0;
                while (true) {
                    try {
                        const injected = yield i; // 接收 next(injected) 的值
                        if (injected !== undefined)
                            i = injected;
                        else
                            i++;
                    }
                    catch (err) {
                        // throw(err) 把 err 抛进生成器（在 yield 处）
                        yield `caught: ${err.message}`;
                        return 'terminated-by-throw';
                    }
                }
            }
            const g = counter();
            const steps = [];
            steps.push(`g.next() → ${JSON.stringify(g.next())}`); // 0
            steps.push(`g.next() → ${JSON.stringify(g.next())}`); // 1（自增）
            steps.push(`g.next(100) → ${JSON.stringify(g.next(100))}`); // 100（注入新值）
            steps.push(`g.next() → ${JSON.stringify(g.next())}`); // 101（从注入值继续自增）
            steps.push(`g.throw(new Error('boom')) → ${JSON.stringify(g.throw(new Error('boom')))}`); // 被 catch
            steps.push(`g.return('done') → ${JSON.stringify(g.return('done'))}`); // 强制终结
            // yield* 委托演示
            function* inner() { yield 'i1'; yield 'i2'; }
            function* outer() { yield 'a'; yield* inner(); yield 'b'; }
            const delegated = [];
            for (const v of outer())
                delegated.push(v);
            this.setState({
                syncGenResult: `生成器三种推进方式：next(value) / return(value) / throw(err)\n\n` +
                    `function* counter() { while(true) { try { const injected = yield i; ... } catch (e: any) { yield 'caught'; return ... } } }\n` +
                    `执行序列：\n${steps.join('\n')}\n\n` +
                    `yield* 委托：function* outer() { yield 'a'; yield* inner(); yield 'b'; } → [${delegated.map((x) => `'${x}'`).join(', ')}]\n\n` +
                    `说明：next(value) 把 value 作为上一个 yield 的返回值；return(value) 在当前 yield 处强制终结；\n` +
                    `throw(err) 在当前 yield 处抛出 err（可被生成器内 try/catch 捕获）；yield* 委托给另一个可迭代对象。`,
            });
            this._addLog('sync-gen', `生成器控制：next/return/throw 三种推进 + yield* 委托均已演示`);
        }
        catch (err) {
            this._addLog('warn', `生成器控制演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '5. 同步生成器深入（next/return/throw · 双向通信）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'success' }, 'function* ✓'), h(Tag, { color: 'primary' }, 'yield · yield* · next(value)')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'function* 声明同步生成器；yield 暂停并把值交给调用方；yield* 委托给另一个可迭代对象。三种推进方式：next(value) 把 value 作为上一个 yield 的返回值（双向通信）；return(value) 在当前 yield 处强制终结；throw(err) 在当前 yield 处抛出错误（可被生成器内 try/catch 捕获）。Symbol.iterator 协议：实现 [Symbol.iterator]() 返回 { next(): {value, done} } 即可被 for...of / 展开运算符消费。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('双向通信', { type: 'primary', size: 'sm', onClick: () => this._demoSyncGenerator() }), this._btn('next/return/throw', { type: 'primary', size: 'sm', onClick: () => this._demoGeneratorControl() })),
                h('div', { class: 'fs-sm text-secondary' }, '生成器结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.syncGenResult || '（点击「双向通信」或「next/return/throw」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `// 双向通信：yield 的返回值 = 下次 next(value) 的 value
function* dialog(): Generator<any, any, any> {
  const name = yield '问名字';      // name = next('Alice')
  const age  = yield \`你好 \${name}\`; // age  = next(30)
  return \`再见 \${name}(\${age})\`;
}
const g = dialog();
g.next('Alice');    // 把 'Alice' 传回给上一个 yield
g.next(30);         // 把 30 传回给上一个 yield
// yield* 委托：function* outer() { yield 'a'; yield* ['x','y']; yield 'b'; }`)),
                h(Alert, {
                    type: 'info',
                    message: '生成器是「可暂停的函数」',
                    description: '同步生成器用 yield 暂停、next 推进；异步生成器（async function*）在 yield 基础上允许内部 await。两者都基于迭代器协议：实现 next() 即可被 for...of（同步）或 for await（异步）消费。生成器的双向通信让它能像协程一样工作。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：AbortController + AbortSignal.timeout ===================
    // new AbortController() / controller.signal / controller.abort() / signal.aborted
    _createAbortController() {
        if (!this._caps().abortController) {
            this._addLog('warn', 'AbortController 不可用');
            return;
        }
        try {
            // 清理上一个 controller
            if (this._abortTimeoutId !== null) {
                clearTimeout(this._abortTimeoutId);
                this._abortTimeoutId = null;
            }
            this._abortController = new AbortController();
            this._abortSignal = this._abortController.signal;
            const abortedNow = this._abortSignal.aborted;
            // 注册 abort 事件监听（演示 signal.addEventListener('abort', cb)）
            this._abortListener = () => {
                this._addLog('abort', `abort 事件触发！signal.aborted = ${this._abortSignal.aborted}`);
            };
            this._abortSignal.addEventListener('abort', this._abortListener);
            this.setState({
                abortResult: `new AbortController() → controller\n` +
                    `controller.signal → AbortSignal（初始 aborted = ${abortedNow}）\n` +
                    `已注册 signal.addEventListener('abort', cb)：abort 时回调触发\n\n` +
                    `说明：controller.abort() 触发 signal.aborted = true 并派发 'abort' 事件；\n` +
                    `signal 可传给 fetch(url, { signal })、addEventListener(name, cb, { signal }) 等；\n` +
                    `abort 后无法恢复（需新建 controller）；同一 signal 可被多个消费者监听。`,
            });
            this._addLog('abort', `已创建 AbortController：signal.aborted = ${abortedNow}，已注册 abort 监听`);
        }
        catch (err) {
            this._addLog('warn', `创建 AbortController 失败：${err.name} - ${err.message}`);
        }
    }
    // 手动 controller.abort()：触发 signal.aborted + abort 事件
    _manualAbort() {
        if (!this._caps().abortController) {
            this._addLog('warn', 'AbortController 不可用');
            return;
        }
        if (!this._abortController) {
            this._addLog('warn', '请先点击「创建 controller」');
            return;
        }
        try {
            const before = this._abortSignal.aborted;
            this._abortController.abort(); // 触发 abort 事件 + 置 aborted = true
            const after = this._abortSignal.aborted;
            this._abortController.abort(); // 再次 abort 不会重复触发事件
            this.setState({
                abortResult: `controller.abort() 手动触发：\n` +
                    `signal.aborted：${before} → ${after}\n` +
                    `abort 事件已派发（监听器被调用一次，见日志）\n` +
                    `再次调用 abort() 无效果：事件不会重复派发（aborted 已是 true）\n` +
                    `说明：abort 是一次性信号；已 abort 的 signal 传给 fetch 会立即抛 AbortError。`,
            });
            this._addLog('abort', `手动 abort：aborted ${before} → ${after}（事件派发一次）`);
        }
        catch (err) {
            this._addLog('warn', `手动 abort 失败：${err.name} - ${err.message}`);
        }
    }
    // AbortSignal.timeout(ms)：静态方法，N 毫秒后自动 abort（无需手动 controller）
    _demoAbortSignalTimeout() {
        if (!this._caps().abortSignalTimeout) {
            this._addLog('warn', 'AbortSignal.timeout 不可用（需 Node 17.3+ / 现代浏览器）');
            return;
        }
        try {
            if (this._abortTimeoutId !== null) {
                clearTimeout(this._abortTimeoutId);
                this._abortTimeoutId = null;
            }
            // AbortSignal.timeout(2000)：2 秒后自动 abort
            const signal = AbortSignal.timeout(2000);
            this._abortSignal = signal;
            const t0 = Date.now();
            this._abortListener = () => {
                const t = Date.now() - t0;
                this._addLog('abort', `AbortSignal.timeout(2000) 在 ${t}ms 后自动触发 abort`);
                this.setState({
                    abortResult: `AbortSignal.timeout(2000) 自动 abort：\n` +
                        `const signal = AbortSignal.timeout(2000);  // 2 秒后自动 abort\n` +
                        `已等待 ${t}ms，signal.aborted = ${signal.aborted}，abort 事件已触发\n` +
                        `说明：AbortSignal.timeout 是静态工厂，无需手动 controller；超时后 signal.aborted 变 true 并派发 'abort' 与 'timeout' 事件。`,
                });
            };
            signal.addEventListener('abort', this._abortListener);
            this.setState({
                abortResult: `AbortSignal.timeout(2000) 已创建，等待 2 秒自动 abort…\n` +
                    `const signal = AbortSignal.timeout(2000);\n` +
                    `signal.aborted = ${signal.aborted}（初始 false）\n` +
                    `已注册 abort 监听，2 秒后日志与结果区会更新。`,
            });
            this._addLog('abort', 'AbortSignal.timeout(2000) 已启动，等待自动 abort…');
            // 备用兜底：若环境 timeout 实现有偏差，4 秒后强制更新一次
            this._abortTimeoutId = setTimeout(() => {
                if (!signal.aborted) {
                    this._addLog('warn', 'AbortSignal.timeout 2 秒后仍未 abort（环境异常），强制刷新状态');
                    this.setState({
                        abortResult: `AbortSignal.timeout(2000) 状态：signal.aborted = ${signal.aborted}\n（已等待 4 秒兜底，仍未触发，环境可能未真正实现 timeout）`,
                    });
                }
            }, 4000);
        }
        catch (err) {
            this._addLog('warn', `AbortSignal.timeout 演示失败：${err.name} - ${err.message}`);
        }
    }
    // AbortSignal.any([s1, s2])：组合多个 signal，任一 abort 即触发
    _demoAbortSignalAny() {
        if (!this._caps().abortSignalAny) {
            this._addLog('warn', 'AbortSignal.any 不可用（较新环境才支持）');
            return;
        }
        try {
            const c1 = new AbortController();
            const c2 = new AbortController();
            // AbortSignal.any([s1, s2])：任一来源 abort 即触发组合 signal
            const combined = AbortSignal.any([c1.signal, c2.signal]);
            const t0 = Date.now();
            const listener = () => {
                const t = Date.now() - t0;
                this._addLog('abort', `AbortSignal.any 触发：c1.aborted=${c1.signal.aborted}, c2.aborted=${c2.signal.aborted}, combined.aborted=${combined.aborted}（${t}ms）`);
                this.setState({
                    abortResult: `AbortSignal.any([s1, s2]) 组合信号：\n` +
                        `const combined = AbortSignal.any([c1.signal, c2.signal]);\n` +
                        `c2.abort() 触发后（${t}ms）：c1.aborted=${c1.signal.aborted}, c2.aborted=${c2.signal.aborted}, combined.aborted=${combined.aborted}\n` +
                        `说明：AbortSignal.any 用于「多个取消来源合并」—— 用户手动取消 OR 超时 OR 父任务取消，任一发生都让 combined abort。`,
                });
            };
            combined.addEventListener('abort', listener);
            // 300ms 后 abort c2，combined 应随之 abort
            this._abortTimeoutId = setTimeout(() => c2.abort(), 300);
            this.setState({
                abortResult: `AbortSignal.any([s1, s2]) 已创建，300ms 后将 abort c2…\n` +
                    `const combined = AbortSignal.any([c1.signal, c2.signal]);\n` +
                    `combined.aborted = ${combined.aborted}（初始 false）\n` +
                    `已注册 combined 的 abort 监听；c2.abort() 后 combined 也会 abort。`,
            });
            this._addLog('abort', 'AbortSignal.any 已启动，等待 c2.abort() 触发 combined…');
        }
        catch (err) {
            this._addLog('warn', `AbortSignal.any 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. AbortController + AbortSignal（取消异步操作）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.abortController ? 'success' : 'error' }, caps.abortController ? 'AbortController ✓' : '不可用'), h(Tag, { color: caps.abortSignalTimeout ? 'primary' : 'warning' }, caps.abortSignalTimeout ? 'timeout ✓' : 'timeout ✗'), h(Tag, { color: caps.abortSignalAny ? 'primary' : 'warning' }, caps.abortSignalAny ? 'any ✓' : 'any ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new AbortController() 创建控制器；controller.signal 获取 AbortSignal；controller.abort() 触发取消（signal.aborted 置 true 并派发 abort 事件）；signal.addEventListener("abort", cb) 监听取消。signal 可传给 fetch(url, { signal })、addEventListener(name, cb, { signal }) 等实现统一取消。AbortSignal.timeout(ms) 静态方法：N 毫秒后自动 abort（无需手动 controller）。AbortSignal.any([s1, s2]) 组合多个信号，任一 abort 即触发（适合「用户取消 OR 超时」合并场景）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('创建 controller', { type: 'primary', size: 'sm', disabled: !caps.abortController, onClick: () => this._createAbortController() }), this._btn('手动 abort', { danger: true, size: 'sm', disabled: !caps.abortController, onClick: () => this._manualAbort() }), this._btn('AbortSignal.timeout', { type: 'primary', size: 'sm', disabled: !caps.abortSignalTimeout, onClick: () => this._demoAbortSignalTimeout() }), this._btn('AbortSignal.any', { size: 'sm', disabled: !caps.abortSignalAny, onClick: () => this._demoAbortSignalAny() })),
                h('div', { class: 'fs-sm text-secondary' }, 'AbortController 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.abortResult || '（点击「创建 controller」或「AbortSignal.timeout」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `// 手动取消 fetch
const ctrl = new AbortController();
fetch(url, { signal: ctrl.signal }).catch(e => {
  if (e.name === 'AbortError') console.log('已取消');
});
ctrl.abort();                          // 触发取消
// 超时自动取消：AbortSignal.timeout(5000) → 5 秒后自动 abort
// 多来源合并：AbortSignal.any([userCancelSignal, AbortSignal.timeout(10000)])
// 取消事件监听：btn.addEventListener('click', handler, { signal: ctrl.signal })`)),
                h(Alert, {
                    type: 'warning',
                    message: 'abort 是一次性信号，无法重置',
                    description: 'AbortSignal 一旦 aborted 就不可恢复，需新建 AbortController。同一 signal 可被多个消费者监听（fetch、addEventListener、自定义异步操作），abort 时全部收到通知。fetch 在 abort 后会抛出 name 为 "AbortError" 的 DOMException。',
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
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, '异步编程深度实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, 'Promise 组合器（all / allSettled / race / any）、微任务 vs 宏任务、async/await 深度、异步迭代器/生成器、同步生成器双向通信、AbortController 取消异步。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=AsyncCookbookPage.js.map