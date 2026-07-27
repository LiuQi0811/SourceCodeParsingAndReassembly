// =====================================================================
// SchedulerTasksPage.js —— 任务调度与系统压力实验室
// 演示 MDN：
//   1. Prioritized Task Scheduling API —— scheduler.postTask 三级优先级（user-blocking / user-visible / background），TaskController + TaskSignal
//   2. TaskController 取消任务 —— abort() 触发 AbortError，setPriority 与 prioritychange 事件，与 setTimeout / queueMicrotask / requestIdleCallback 对比
//   3. Idle Detection API —— IdleDetector.requestPermission / start / userState（active/idle）/ screenState（locked/unlocked）
//   4. Compute Pressure API —— PressureObserver.observe('cpu') / state（nominal/fair/serious/critical）/ takeRecords / disconnect
//   5. Long Animation Frames API（LoAF）—— PerformanceObserver 观察 'long-animation-frame'，含 blockingDuration / scripts（细粒度于 longtask）
//   6. performance.measureUserAgentSpecificMemory —— bytes 与 breakdown
// 说明：本页演示现代浏览器对「任务调度优先级」「空闲状态」「CPU 压力」「长帧」「内存占用」五类系统级 Web API。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//       jsdom/Node 中这些 API 大多 undefined，需在真实浏览器中演示。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class SchedulerTasksPage extends Page {
    _inited = false;
    _idleDetector;
    _idleHandler;
    _pressureObserver;
    _loafObserver;
    _loafEntries;
    _pendingTaskController;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：scheduler.postTask 三级优先级
            priorityResult: '',
            // Card 2：TaskController 取消与优先级变更
            controllerResult: '',
            // Card 3：IdleDetector 空闲检测
            idleState: '',
            // Card 4：PressureObserver 计算压力
            pressureState: '',
            // Card 5：Long Animation Frames
            loafState: '',
            // Card 6：内存监控
            memoryState: '',
            // Card 7：scheduler.yield()
            yieldState: '',
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._idleDetector = null; // Card 3 IdleDetector 实例
        this._idleHandler = null; // Card 3 change 回调引用（用于解绑）
        this._pressureObserver = null; // Card 4 PressureObserver 实例
        this._loafObserver = null; // Card 5 PerformanceObserver 实例
        this._loafEntries = []; // Card 5 累积的 LoAF 条目（用于展示）
        this._pendingTaskController = null; // Card 2 当前未完成的 TaskController
        // 一次性能力检测：系统级 Web API 全家桶
        const hasScheduler = typeof scheduler !== 'undefined' && typeof scheduler.postTask === 'function';
        const hasTaskController = typeof TaskController !== 'undefined';
        const hasTaskSignal = typeof TaskSignal !== 'undefined';
        const hasIdleDetector = typeof IdleDetector !== 'undefined';
        const hasPressureObserver = typeof PressureObserver !== 'undefined';
        const hasMeasureMemory = typeof performance !== 'undefined' && typeof performance.measureUserAgentSpecificMemory === 'function';
        const hasPerfObserver = typeof PerformanceObserver !== 'undefined';
        const hasRequestIdle = typeof requestIdleCallback === 'function';
        const hasQueueMicrotask = typeof queueMicrotask === 'function';
        const parts = [];
        parts.push(`scheduler ${hasScheduler ? '✓' : '✗'}`);
        parts.push(`TaskController ${hasTaskController ? '✓' : '✗'}`);
        parts.push(`TaskSignal ${hasTaskSignal ? '✓' : '✗'}`);
        parts.push(`IdleDetector ${hasIdleDetector ? '✓' : '✗'}`);
        parts.push(`PressureObserver ${hasPressureObserver ? '✓' : '✗'}`);
        parts.push(`measureMemory ${hasMeasureMemory ? '✓' : '✗'}`);
        parts.push(`PerformanceObserver ${hasPerfObserver ? '✓' : '✗'}`);
        parts.push(`requestIdleCallback ${hasRequestIdle ? '✓' : '✗'}`);
        parts.push(`queueMicrotask ${hasQueueMicrotask ? '✓' : '✗'}`);
        const supportedCount = [hasScheduler, hasTaskController, hasTaskSignal, hasIdleDetector,
            hasPressureObserver, hasMeasureMemory].filter(Boolean).length;
        const summary = supportedCount > 0
            ? `能力检测：${parts.join(' · ')}。当前环境部分 API 可用，可演示真实任务调度；不可用项点击按钮仅记日志说明，不会抛异常。`
            : `能力检测：${parts.join('，')}。当前环境（jsdom/Node）均不支持这些系统级 Web API；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（Chrome 最新版）中打开可完整演示。`;
        this.setState({ capsSummary: summary });
        this._addLog(supportedCount > 0 ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!hasScheduler)
            this._addLog('warn', 'scheduler 不可用（需 Chromium 94+，且仅在 window / Worker 上下文）');
        if (!hasTaskController)
            this._addLog('warn', 'TaskController 不可用（需 Chromium 94+）');
        if (!hasTaskSignal)
            this._addLog('warn', 'TaskSignal 不可用（需 Chromium 94+）');
        if (!hasIdleDetector)
            this._addLog('warn', 'IdleDetector 不可用（需 Chromium 94+，且 https 与权限授予）');
        if (!hasPressureObserver)
            this._addLog('warn', 'PressureObserver 不可用（需 Chromium 125+）');
        if (!hasMeasureMemory)
            this._addLog('warn', 'performance.measureUserAgentSpecificMemory 不可用（需 Chromium 89+ 且跨域隔离）');
    }
    componentWillUnmount() {
        // 释放系统资源：停止 IdleDetector / 断开 PressureObserver / 取消未完成 task
        if (this._idleDetector) {
            try {
                this._idleDetector.stop?.();
            }
            catch { /* noop */ }
            this._idleDetector = null;
            this._idleHandler = null;
        }
        if (this._pressureObserver) {
            try {
                this._pressureObserver.disconnect?.();
            }
            catch { /* noop */ }
            this._pressureObserver = null;
        }
        if (this._loafObserver) {
            try {
                this._loafObserver.disconnect?.();
            }
            catch { /* noop */ }
            this._loafObserver = null;
        }
        if (this._pendingTaskController) {
            try {
                this._pendingTaskController.abort();
            }
            catch { /* noop */ }
            this._pendingTaskController = null;
        }
        this._loafEntries = [];
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
        return {
            scheduler: typeof scheduler !== 'undefined' && typeof scheduler.postTask === 'function',
            taskController: typeof TaskController !== 'undefined',
            taskSignal: typeof TaskSignal !== 'undefined',
            idleDetector: typeof IdleDetector !== 'undefined',
            pressureObserver: typeof PressureObserver !== 'undefined',
            measureMemory: typeof performance !== 'undefined' && typeof performance.measureUserAgentSpecificMemory === 'function',
            perfObserver: typeof PerformanceObserver !== 'undefined',
            requestIdle: typeof requestIdleCallback === 'function',
            queueMicrotask: typeof queueMicrotask === 'function',
            schedulerYield: typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function',
        };
    }
    // =================== Card 1：scheduler.postTask 三级优先级 ===================
    // 同时提交 user-blocking / user-visible / background 三个任务，记录执行顺序
    // priority 三档：user-blocking（最高，~0ms）/ user-visible（默认，~4ms）/ background（最低，~50ms）
    async _runPriorityComparison() {
        const caps = this._caps();
        if (!caps.scheduler) {
            this._addLog('warn', 'scheduler.postTask 不可用，请用真实浏览器（Chromium 94+）演示');
            return;
        }
        try {
            this._addLog('priority', '同时提交三个不同优先级的 postTask 任务，观察执行顺序…');
            const order = [];
            const makeTask = (label) => () => {
                order.push(label);
                this._addLog('priority', `执行：${label}（顺序 #${order.length}）`);
                return label;
            };
            // 注意：提交顺序故意与优先级相反，便于观察调度器按优先级而非提交顺序执行
            const pBackground = scheduler.postTask(makeTask('background'), { priority: 'background' });
            const pVisible = scheduler.postTask(makeTask('user-visible'), { priority: 'user-visible' });
            const pBlocking = scheduler.postTask(makeTask('user-blocking'), { priority: 'user-blocking' });
            const [rBlocking, rVisible, rBackground] = await Promise.all([pBlocking, pVisible, pBackground]);
            this.setState({
                priorityResult: `scheduler.postTask(callback, { priority }) 三级优先级对比\n` +
                    `提交顺序：background → user-visible → user-blocking\n` +
                    `执行顺序：${order.join(' → ')}\n` +
                    `返回值：blocking=${rBlocking}，visible=${rVisible}，background=${rBackground}\n\n` +
                    `优先级语义：\n` +
                    `  user-blocking  最高（~0ms 延迟）：用户可见的关键任务，如输入响应\n` +
                    `  user-visible   默认（~4ms 延迟）：可见但不阻塞用户的任务\n` +
                    `  background     最低（~50ms 延迟）：可推迟的维护性任务\n\n` +
                    `说明：调度器按优先级而非提交顺序执行；同优先级按 FIFO。`,
            });
            this._addLog('priority', `完成：执行顺序=${order.join(' → ')}`);
        }
        catch (err) {
            this._addLog('warn', `优先级对比失败：${errInfo(err).name} - ${errInfo(err).message}`);
        }
    }
    // 与 setTimeout / queueMicrotask / requestIdleCallback 对比调度行为
    async _compareWithSetTimeout() {
        const caps = this._caps();
        if (!caps.scheduler) {
            this._addLog('warn', 'scheduler 不可用，无法对比');
            return;
        }
        try {
            this._addLog('compare', '对比 scheduler.postTask vs setTimeout vs queueMicrotask vs requestIdleCallback…');
            const order = [];
            const mark = (label) => { order.push(label); this._addLog('compare', `触发：${label}`); };
            // queueMicrotask：当前同步栈结束立即执行（最高优先级，先于任何调度）
            if (caps.queueMicrotask)
                queueMicrotask(() => mark('queueMicrotask'));
            else
                this._addLog('warn', 'queueMicrotask 不可用');
            // setTimeout(0)：会被钳制到 ~4ms（HTML5 规范）
            setTimeout(() => mark('setTimeout(0)'), 0);
            // requestIdleCallback：空闲时执行
            if (caps.requestIdle)
                requestIdleCallback(() => mark('requestIdleCallback'));
            else
                this._addLog('warn', 'requestIdleCallback 不可用');
            // scheduler.postTask background：~50ms 延迟
            scheduler.postTask(() => mark('postTask(background)'), { priority: 'background' });
            // scheduler.postTask user-visible：~4ms 延迟
            scheduler.postTask(() => mark('postTask(user-visible)'), { priority: 'user-visible' });
            // 等所有都执行完（粗略等 200ms）
            await new Promise((r) => setTimeout(r, 200));
            this.setState({
                priorityResult: `scheduler.postTask 与其它调度机制对比\n` +
                    `触发顺序：${order.join(' → ')}\n\n` +
                    `机制对比：\n` +
                    `  queueMicrotask      微任务，当前同步栈后立即执行（最高优先级）\n` +
                    `  setTimeout(0)       宏任务，HTML5 钳制到 ~4ms\n` +
                    `  requestIdleCallback 空闲时执行（可能被推迟很久）\n` +
                    `  postTask(user-visible)  ~4ms，可中断长任务\n` +
                    `  postTask(background)    ~50ms，最低优先级维护任务\n\n` +
                    `说明：postTask 提供显式优先级控制，比 setTimeout 更可预测；queueMicrotask 总是最先。`,
            });
            this._addLog('compare', `完成：触发顺序=${order.join(' → ')}`);
        }
        catch (err) {
            this._addLog('warn', `对比失败：${errInfo(err).name} - ${errInfo(err).message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. Prioritized Task Scheduling API（任务调度优先级）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.scheduler ? 'success' : 'error' }, caps.scheduler ? 'scheduler ✓' : '不可用'), h(Tag, { color: 'primary' }, 'user-blocking / visible / background')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'window.scheduler.postTask(callback, options) → Promise 按指定优先级调度任务；(options as any).priority ∈ "user-blocking"（最高，~0ms）/ "user-visible"（默认，~4ms）/ "background"（最低，~50ms）。调度器按优先级而非提交顺序执行；同优先级 FIFO。options.delay（毫秒延迟）。可与 setTimeout / queueMicrotask / requestIdleCallback 对比，理解不同调度机制的优先级与延迟特性。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('三级优先级对比', { type: 'primary', size: 'sm', disabled: !caps.scheduler, onClick: () => this._runPriorityComparison() }), this._btn('对比 setTimeout 等', { size: 'sm', disabled: !caps.scheduler, onClick: () => this._compareWithSetTimeout() })),
                h('div', { class: 'fs-sm text-secondary' }, '调度结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.priorityResult || '（点击「三级优先级对比」或「对比 setTimeout 等」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `// 三级优先级
scheduler.postTask(() => { /* 高优先级：输入响应 */ }, { priority: 'user-blocking' });
scheduler.postTask(() => { /* 默认：UI 更新 */ }); // 默认 user-visible
scheduler.postTask(() => { /* 低优先级：日志上报 */ }, { priority: 'background' });

// delay 选项：延迟执行
scheduler.postTask(cb, { delay: 1000 });  // 1 秒后调度

// 与 setTimeout 对比：postTask 优先级显式可控
setTimeout(cb, 0);    // ~4ms 钳制
queueMicrotask(cb);   // 微任务，最先执行
requestIdleCallback(cb); // 空闲时才执行`)),
                h(Alert, {
                    type: 'info',
                    message: 'postTask 比 setTimeout 更适合优先级敏感的任务',
                    description: 'setTimeout 无法表达「优先级」，只能靠 delay 控制时机；postTask 让浏览器统一调度，避免低优先级任务抢占主线程影响用户输入响应。priority 越高，调度延迟越短（user-blocking ~0ms，background ~50ms）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：TaskController + 取消 ===================
    // new TaskController({ priority }) 创建控制器；postTask 带其 signal；
    // controller.abort() 取消任务 → Promise reject AbortError
    async _demoTaskController() {
        const caps = this._caps();
        if (!caps.scheduler || !caps.taskController) {
            this._addLog('warn', 'scheduler 或 TaskController 不可用，请用真实浏览器（Chromium 94+）演示');
            return;
        }
        // 释放上一个未完成的 controller（若存在）
        if (this._pendingTaskController) {
            try {
                this._pendingTaskController.abort();
            }
            catch { /* noop */ }
            this._pendingTaskController = null;
        }
        try {
            this._addLog('controller', '创建 TaskController，提交一个 background 任务（5000ms 延迟），随后调用 abort() 取消…');
            const controller = new TaskController({ priority: 'background' });
            this._pendingTaskController = controller;
            const signalInfo = `(controller.signal as any).priority = ${controller.signal.priority}`;
            const taskPromise = scheduler.postTask(() => { this._addLog('controller', '任务执行（不应到达，因已被取消）'); return 'done'; }, { signal: controller.signal, delay: 5000 });
            // 短暂等待后取消
            setTimeout(() => {
                this._addLog('controller', '调用 controller.abort() 取消任务…');
                controller.abort();
            }, 100);
            let abortInfo = '';
            try {
                const r = await taskPromise;
                abortInfo = `任务结果：${r}（不应到达）`;
            }
            catch (err) {
                const isAbort = errInfo(err).name === 'AbortError' ||
                    (typeof DOMException !== 'undefined' && err instanceof DOMException && errInfo(err).name === 'AbortError');
                abortInfo = `任务被取消 → 抛出 ${errInfo(err).name}：${errInfo(err).message}\n  instanceof AbortError / DOMException(name=AbortError) = ${isAbort}`;
                this._addLog('controller', `捕获 ${errInfo(err).name}：任务已取消`);
            }
            this._pendingTaskController = null;
            this.setState({
                controllerResult: `new TaskController({ priority: 'background' }) → controller\n` +
                    `${signalInfo}\n` +
                    `scheduler.postTask(cb, { signal: controller.signal, delay: 5000 }) → Promise\n` +
                    `controller.abort() 取消 →\n  ${abortInfo}\n\n` +
                    `说明：TaskController 继承自 AbortController；abort() 后关联的 taskPromise reject AbortError；\n` +
                    `signal 既是 AbortSignal 又是 TaskSignal（含 priority 属性与 prioritychange 事件）。`,
            });
        }
        catch (err) {
            this._addLog('warn', `TaskController 演示失败：${errInfo(err).name} - ${errInfo(err).message}`);
        }
    }
    // controller.setPriority() + signal 的 prioritychange 事件
    async _demoPriorityChange() {
        const caps = this._caps();
        if (!caps.scheduler || !caps.taskController || !caps.taskSignal) {
            this._addLog('warn', 'scheduler / TaskController / TaskSignal 不可用');
            return;
        }
        try {
            this._addLog('priority', '演示 setPriority + prioritychange 事件…');
            const controller = new TaskController({ priority: 'background' });
            const changes = [];
            const onChange = (e) => {
                const line = `${e.previousPriority} → ${controller.signal.priority}`;
                changes.push(line);
                this._addLog('priority', `prioritychange：${line}`);
            };
            controller.signal.addEventListener('prioritychange', onChange);
            // 提交一个长延迟 background 任务
            const taskPromise = scheduler.postTask(() => 'executed', { signal: controller.signal, delay: 3000 });
            // 提升 priority：background → user-visible → user-blocking
            controller.setPriority('user-visible');
            await new Promise((r) => setTimeout(r, 50));
            controller.setPriority('user-blocking');
            const r = await taskPromise;
            controller.signal.removeEventListener('prioritychange', onChange);
            this.setState({
                controllerResult: `TaskController.setPriority + TaskSignal.prioritychange 演示\n` +
                    `初始 priority = background；依次 setPriority('user-visible')、setPriority('user-blocking')\n` +
                    `prioritychange 事件触发记录：\n  ${changes.map((c) => '• ' + c).join('\n  ') || '（无）'}\n` +
                    `最终任务结果：${r}\n\n` +
                    `说明：setPriority 可动态调整已提交任务的优先级；prioritychange 事件携带 previousPriority。\n` +
                    `TaskSignal 同时是 AbortSignal（支持 abort）与 priority 信号源。`,
            });
        }
        catch (err) {
            this._addLog('warn', `prioritychange 演示失败：${errInfo(err).name} - ${errInfo(err).message}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. TaskController + 取消与优先级变更',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.taskController ? 'success' : 'error' }, caps.taskController ? 'TaskController ✓' : '不可用'), h(Tag, { color: caps.taskSignal ? 'primary' : 'warning' }, caps.taskSignal ? 'TaskSignal ✓' : 'TaskSignal ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new TaskController({ priority }) 创建任务控制器，继承自 AbortController；postTask 传 { signal: controller.signal } 关联任务；controller.abort() 取消任务 → Promise reject AbortError（DOMException）。controller.setPriority(newPriority) 动态调整优先级，触发 signal 上的 prioritychange 事件（e.previousPriority）。TaskSignal 同时是 AbortSignal 与 priority 信号源，可监听 abort 与 prioritychange 两类事件。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('abort() 取消任务', { danger: true, size: 'sm', disabled: !caps.scheduler || !caps.taskController, onClick: () => this._demoTaskController() }), this._btn('setPriority 变更', { type: 'primary', size: 'sm', disabled: !caps.scheduler || !caps.taskController || !caps.taskSignal, onClick: () => this._demoPriorityChange() })),
                h('div', { class: 'fs-sm text-secondary' }, 'TaskController 结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.controllerResult || '（点击「abort() 取消任务」或「setPriority 变更」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `const controller = new TaskController({ priority: 'background' });
const taskPromise = scheduler.postTask(cb, { signal: controller.signal, delay: 5000 });

// 监听优先级变化
controller.signal.addEventListener('prioritychange', (e: any) => {
  console.log(e.previousPriority, '→', (controller.signal as any).priority);
});
controller.setPriority('user-blocking');   // 提升优先级

// 取消任务
setTimeout(() => controller.abort(), 100);
try { await taskPromise; } catch (e: any) { /* AbortError */ }`)),
                h(Alert, {
                    type: 'warning',
                    message: 'TaskController 继承自 AbortController',
                    description: 'abort() 后所有关联该 signal 的 postTask 都会 reject AbortError（DOMException 子类）；同一个 TaskSignal 既支持 abort 事件也支持 prioritychange 事件，是 AbortSignal 的扩展。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：IdleDetector 空闲检测 ===================
    // IdleDetector.requestPermission!() → Promise<'granted'|'denied'>
    async _requestIdlePermission() {
        const caps = this._caps();
        if (!caps.idleDetector) {
            this._addLog('warn', 'IdleDetector 不可用（需 Chromium 94+ 且 https 环境）');
            return;
        }
        try {
            this._addLog('idle', '调用 IdleDetector.requestPermission!()…');
            const perm = await IdleDetector.requestPermission();
            this.setState({
                idleState: `IdleDetector.requestPermission!() → '${perm}'\n` +
                    `说明：'granted' 才能调用 detector.start()；'denied' 时 start() 抛 NotAllowedError。\n` +
                    `权限仅能在用户手势（按钮点击）中请求，且需 https 与跨域隔离。`,
            });
            this._addLog('idle', `requestPermission 结果：${perm}`);
        }
        catch (err) {
            this._addLog('warn', `requestPermission 失败：${errInfo(err).name} - ${errInfo(err).message}`);
            this.setState({ idleState: `requestPermission 失败：${errInfo(err).name} - ${errInfo(err).message}` });
        }
    }
    // detector.start({ threshold, signal }) → Promise；监听 change 读取 userState/screenState
    async _startIdleDetector() {
        const caps = this._caps();
        if (!caps.idleDetector) {
            this._addLog('warn', 'IdleDetector 不可用');
            return;
        }
        // 停止上一个 detector
        if (this._idleDetector) {
            try {
                this._idleDetector.stop?.();
            }
            catch { /* noop */ }
            this._idleDetector = null;
            this._idleHandler = null;
        }
        try {
            this._addLog('idle', '创建 IdleDetector，注册 change 监听，start({ threshold: 60000 })…');
            const detector = new IdleDetector();
            this._idleDetector = detector;
            const handleChange = () => {
                const line = `change → userState=${detector.userState}，screenState=${detector.screenState}`;
                this._addLog('idle', line);
                this.setState({ idleState: this.state.idleState + '\n[' + formatTime() + '] ' + line });
            };
            detector.addEventListener('change', handleChange);
            this._idleHandler = handleChange;
            await detector.start({ threshold: 60000 }); // 60 秒空闲阈值
            // 立即读取一次当前状态
            const userState = detector.userState;
            const screenState = detector.screenState;
            this.setState({
                idleState: `new IdleDetector() → detector\n` +
                    `detector.addEventListener('change', cb)\n` +
                    `detector.start({ threshold: 60000 }) → Promise ✓\n` +
                    `threshold = ${detector.threshold} ms（用户超过此时间未操作视为 idle）\n` +
                    `初始状态：userState=${userState}，screenState=${screenState}\n` +
                    `  userState ∈ 'active' | 'idle'\n` +
                    `  screenState ∈ 'locked' | 'unlocked'\n` +
                    `说明：用户超过 threshold 未操作 → userState 变 'idle'；屏幕锁定 → screenState 变 'locked'。`,
            });
            this._addLog('idle', `start 成功：userState=${userState}，screenState=${screenState}，threshold=${detector.threshold}`);
        }
        catch (err) {
            this._addLog('warn', `start 失败：${errInfo(err).name} - ${errInfo(err).message}`);
            this.setState({ idleState: `start 失败：${errInfo(err).name} - ${errInfo(err).message}` });
        }
    }
    // 停止 IdleDetector（释放引用并移除监听）
    _stopIdleDetector() {
        if (this._idleDetector) {
            try {
                if (this._idleHandler)
                    this._idleDetector.removeEventListener('change', this._idleHandler);
                this._idleDetector.stop?.();
            }
            catch { /* noop */ }
            this._idleDetector = null;
            this._idleHandler = null;
            this._addLog('idle', 'IdleDetector 已停止');
            this.setState({ idleState: this.state.idleState + '\n[' + formatTime() + '] IdleDetector 已停止' });
        }
        else {
            this._addLog('warn', '尚未启动 IdleDetector');
        }
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. Idle Detection API（空闲检测）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.idleDetector ? 'success' : 'error' }, caps.idleDetector ? 'IdleDetector ✓' : '不可用'), h(Tag, { color: 'primary' }, 'userState / screenState')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'IdleDetector.requestPermission!() → Promise<"granted"|"denied"> 请求权限（需用户手势 + https）；new IdleDetector() 创建实例；detector.threshold 为空闲阈值（毫秒）；detector.addEventListener("change", cb) 监听变化；detector.userState ∈ "active"|"idle" 表示用户是否空闲；detector.screenState ∈ "locked"|"unlocked" 表示屏幕是否锁定；detector.start({ threshold }) 启动检测 → Promise。用途：聊天工具判断用户是否离开、后台同步降频等。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('请求权限', { type: 'primary', size: 'sm', disabled: !caps.idleDetector, onClick: () => this._requestIdlePermission() }), this._btn('启动检测', { type: 'primary', size: 'sm', disabled: !caps.idleDetector, onClick: () => this._startIdleDetector() }), this._btn('停止检测', { danger: true, size: 'sm', disabled: !caps.idleDetector, onClick: () => this._stopIdleDetector() })),
                h('div', { class: 'fs-sm text-secondary' }, 'IdleDetector 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.idleState || '（点击「请求权限」→「启动检测」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `const perm = await IdleDetector.requestPermission!();
if (perm !== 'granted') return;
const detector = new IdleDetector();
detector.addEventListener('change', () => {
  console.log(detector.userState, detector.screenState);
});
await detector.start({ threshold: 60000 });
// 用户 60 秒未操作 → userState='idle'
// 屏幕锁定 → screenState='locked'`)),
                h(Alert, {
                    type: 'warning',
                    message: 'IdleDetector 需要权限与安全上下文',
                    description: 'requestPermission 必须在用户手势（按钮点击）中调用，且页面需 https 与跨域隔离（COOP/COEP）。jsdom/Node 中无此 API，仅在真实浏览器可演示。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：PressureObserver 计算压力 ===================
    // new PressureObserver(cb) → observer.observe('cpu') 监听计算压力变化
    _startPressureObserver() {
        const caps = this._caps();
        if (!caps.pressureObserver) {
            this._addLog('warn', 'PressureObserver 不可用（需 Chromium 125+）');
            return;
        }
        if (this._pressureObserver) {
            try {
                this._pressureObserver.disconnect();
            }
            catch { /* noop */ }
            this._pressureObserver = null;
        }
        try {
            this._addLog('pressure', '创建 PressureObserver，observe("cpu")…');
            const observer = new PressureObserver((records) => {
                const lines = records.map((r) => `source=${r.source} state=${r.state} time=${new Date(r.time).toISOString()}`);
                for (const line of lines)
                    this._addLog('pressure', 'change → ' + line);
                this.setState({
                    pressureState: `PressureObserver 回调被触发，收到 ${records.length} 条 PressureRecord\n` +
                        records.map((r, i) => `  [${i}] source=${r.source}，state=${r.state}，time=${new Date(r.time).toISOString()}`).join('\n') +
                        `\n\nstate 取值：nominal（正常）< fair（轻微压力）< serious（严重）< critical（临界）\n` +
                        `source ∈ 'cpu'（未来可能扩展 'gpu' / 'thermals'）`,
                });
            });
            observer.observe('cpu');
            this._pressureObserver = observer;
            this.setState({
                pressureState: `new PressureObserver(callback) → observer\n` +
                    `observer.observe('cpu') ✓\n` +
                    `说明：当 CPU 压力状态变化（nominal → fair → serious → critical）时回调被触发，传入 PressureRecord[]。\n` +
                    `每条 record 有 source（'cpu'）/ state（'nominal'|'fair'|'serious'|'critical'）/ time / history。`,
            });
            this._addLog('pressure', 'PressureObserver 已启动，observe("cpu")');
        }
        catch (err) {
            this._addLog('warn', `启动 PressureObserver 失败：${errInfo(err).name} - ${errInfo(err).message}`);
        }
    }
    // observer.takeRecords() → 取出已积累的 PressureRecord（不等待下次回调）
    _takePressureRecords() {
        const caps = this._caps();
        if (!caps.pressureObserver) {
            this._addLog('warn', 'PressureObserver 不可用');
            return;
        }
        if (!this._pressureObserver) {
            this._addLog('warn', '请先点击「启动监听」');
            return;
        }
        try {
            const records = this._pressureObserver.takeRecords();
            const text = records.length
                ? records.map((r, i) => `  [${i}] source=${r.source}，state=${r.state}，time=${new Date(r.time).toISOString()}`).join('\n')
                : '（暂无新记录，takeRecords 返回空数组）';
            this.setState({
                pressureState: `observer.takeRecords() → ${records.length} 条 PressureRecord\n${text}\n\n` +
                    `说明：takeRecords 立即返回并清空已积累的记录，不等待下次回调；\n` +
                    `PressureRecord 还有 history 属性（历次状态变更序列）。`,
            });
            this._addLog('pressure', `takeRecords 返回 ${records.length} 条记录`);
        }
        catch (err) {
            this._addLog('warn', `takeRecords 失败：${errInfo(err).name} - ${errInfo(err).message}`);
        }
    }
    // observer.disconnect() 停止监听
    _stopPressureObserver() {
        if (this._pressureObserver) {
            try {
                this._pressureObserver.disconnect();
                this._addLog('pressure', 'PressureObserver 已断开（disconnect）');
            }
            catch (err) {
                this._addLog('warn', `disconnect 失败：${errInfo(err).message}`);
            }
            this._pressureObserver = null;
        }
        else {
            this._addLog('warn', '尚未启动 PressureObserver');
        }
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '4. Compute Pressure API（计算压力监控）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.pressureObserver ? 'success' : 'error' }, caps.pressureObserver ? 'PressureObserver ✓' : '不可用'), h(Tag, { color: 'primary' }, 'cpu / nominal / fair / serious / critical')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new PressureObserver(callback) 创建观察者；observer.observe(source) 订阅压力源（source = "cpu"，未来可能扩展 "gpu" / "thermals"）；observer.unobserve(source) 取消订阅；observer.disconnect() 断开所有订阅；observer.takeRecords() 取出已积累的 PressureRecord。回调参数 PressureRecord[] 每条含 source / state（"nominal"|"fair"|"serious"|"critical"）/ time / history。用途：根据 CPU 压力动态降低视频码率、降帧、降并发等。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('启动监听 cpu', { type: 'primary', size: 'sm', disabled: !caps.pressureObserver, onClick: () => this._startPressureObserver() }), this._btn('takeRecords', { size: 'sm', disabled: !caps.pressureObserver, onClick: () => this._takePressureRecords() }), this._btn('停止监听', { danger: true, size: 'sm', disabled: !caps.pressureObserver, onClick: () => this._stopPressureObserver() })),
                h('div', { class: 'fs-sm text-secondary' }, 'PressureObserver 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.pressureState || '（点击「启动监听 cpu」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `const observer = new PressureObserver((records) => {
  for (const r of records) {
    console.log(r.source, r.state, r.time);
    if (r.state === 'critical') lowerVideoBitrate();
  }
});
observer.observe('cpu');
// ...
const pending = observer.takeRecords(); // 立即取出并清空
observer.unobserve('cpu');   // 仅取消 cpu
observer.disconnect();        // 断开所有`)),
                h(Alert, {
                    type: 'info',
                    message: 'Compute Pressure 让应用感知系统负载',
                    description: '不同于 resource timing 只看自身耗时，Compute Pressure 反映整机的 CPU/GPU/热状态，让应用主动降级（如降低视频质量）以保流畅。状态值 nominal → fair → serious → critical 递进。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：Long Animation Frames API ===================
    // PerformanceObserver 观察 'long-animation-frame'；不可用时退化为 'longtask'
    _startLoAFObserver() {
        const caps = this._caps();
        if (!caps.perfObserver) {
            this._addLog('warn', 'PerformanceObserver 不可用');
            return;
        }
        if (this._loafObserver) {
            try {
                this._loafObserver.disconnect();
            }
            catch { /* noop */ }
            this._loafObserver = null;
        }
        this._loafEntries = [];
        const handleEntries = (entries, entryType) => {
            for (const e of entries) {
                this._loafEntries.push(e);
                if (entryType === 'long-animation-frame') {
                    const scripts = (e.scripts || []).map((s) => `    • name=${s.name || '(anon)'} invoker=${s.invoker || '-'} invokerType=${s.invokerType || '-'} ` +
                        `duration=${s.duration?.toFixed(2)}ms source=${s.sourceURL ? s.sourceURL.split('/').pop() : '-'}`).join('\n');
                    const line = `LoAF：duration=${e.duration.toFixed(1)}ms blocking=${(e.blockingDuration ?? 0).toFixed(1)}ms ` +
                        `render=${e.renderStart?.toFixed(1)} styleLayout=${e.styleAndLayoutStart?.toFixed(1)} scripts=${e.scripts?.length || 0}`;
                    this._addLog('loaf', line);
                    this.setState({
                        loafState: `PerformanceObserver 观察 'long-animation-frame' 收到 ${this._loafEntries.length} 条 LoAF 条目\n` +
                            `最近一条：\n  ${line}\n` +
                            (scripts ? `  scripts（${e.scripts.length} 个）：\n${scripts}\n` : '  scripts：（无）') +
                            `\n字段说明：startTime / duration / renderStart / styleAndLayoutStart / blockingDuration / scripts[]\n` +
                            `  scripts[i]：name / invoker / invokerType / executionStart / duration / sourceURL / sourceFunctionName / sourceCharPosition`,
                    });
                }
                else {
                    // longtask 退化分支
                    const line = `longtask：duration=${e.duration.toFixed(1)}ms startTime=${e.startTime.toFixed(1)} name=${e.name || '-'}`;
                    this._addLog('loaf', line);
                    this.setState({
                        loafState: `PerformanceObserver 观察 'longtask'（LoAF 不可用的退化分支）收到 ${this._loafEntries.length} 条\n` +
                            `最近一条：\n  ${line}\n\n` +
                            `说明：当前环境不支持 'long-animation-frame'，退化为观察 'longtask'。\n` +
                            `longtask 只给出总耗时，无 renderStart / blockingDuration / scripts 等细粒度信息。`,
                    });
                }
            }
        };
        // 优先尝试 'long-animation-frame'，失败则退化为 'longtask'
        try {
            const observer = new PerformanceObserver((list) => handleEntries(list.getEntries(), 'long-animation-frame'));
            observer.observe({ entryTypes: ['long-animation-frame'] });
            this._loafObserver = observer;
            this._addLog('loaf', 'PerformanceObserver 已启动，观察 "long-animation-frame"（>50ms 的帧）');
            this.setState({
                loafState: `new PerformanceObserver(cb).observe({ entryTypes: ['long-animation-frame'] }) ✓\n` +
                    `说明：当浏览器渲染一帧超过 50ms 时（长帧），产生 PerformanceLongAnimationFrameTiming 条目。\n` +
                    `等待中…触发长帧操作（如大量同步计算）后会出现条目。`,
            });
        }
        catch (err) {
            this._addLog('warn', `observe('long-animation-frame') 失败：${errInfo(err).name} - ${errInfo(err).message}，尝试退化到 'longtask'`);
            try {
                const observer = new PerformanceObserver((list) => handleEntries(list.getEntries(), 'longtask'));
                observer.observe({ entryTypes: ['longtask'] });
                this._loafObserver = observer;
                this.setState({
                    loafState: `当前环境不支持 'long-animation-frame'（${errInfo(err).message}）\n` +
                        `已退化为 PerformanceObserver 观察 'longtask'\n` +
                        `说明：longtask 是较旧的 API，只给出总耗时；LoAF 提供更细粒度的 renderStart / blockingDuration / scripts 信息。`,
                });
            }
            catch (err2) {
                this._addLog('warn', `observe('longtask') 也失败：${errInfo(err2).name} - ${errInfo(err2).message}`);
                this.setState({ loafState: `LoAF 与 longtask 均不可用：${errInfo(err2).name} - ${errInfo(err2).message}` });
            }
        }
    }
    // 触发一个长同步任务以产生 LoAF 条目（~80ms 主线程阻塞）
    _triggerLongFrame() {
        if (!this._loafObserver) {
            this._addLog('warn', '请先点击「启动 LoAF 监听」');
            return;
        }
        this._addLog('loaf', '触发一个 ~80ms 的同步长任务，等待产生 LoAF 条目…');
        const start = performance.now();
        // 故意阻塞主线程 ~80ms（超过 50ms 阈值）
        while (performance.now() - start < 80) { /* busy loop */ }
        // 提示：条目通常在下一次渲染帧后通过 PerformanceObserver 回调到达
        this._addLog('loaf', `长任务完成，耗时 ${(performance.now() - start).toFixed(1)}ms，等待 LoAF 回调…`);
    }
    _stopLoAFObserver() {
        if (this._loafObserver) {
            try {
                this._loafObserver.disconnect();
                this._addLog('loaf', 'PerformanceObserver 已断开');
            }
            catch (err) {
                this._addLog('warn', `disconnect 失败：${errInfo(err).message}`);
            }
            this._loafObserver = null;
        }
        else {
            this._addLog('warn', '尚未启动 LoAF 监听');
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '5. Long Animation Frames API（LoAF，长动画帧检测）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.perfObserver ? 'success' : 'error' }, caps.perfObserver ? 'PerfObserver ✓' : '不可用'), h(Tag, { color: 'primary' }, 'long-animation-frame / longtask')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'PerformanceObserver 观察 entryType: "long-animation-frame" 检测超过 50ms 的长动画帧；PerformanceLongAnimationFrameTiming 含 startTime / duration / renderStart / styleAndLayoutStart / blockingDuration（阻塞主线程时长）/ scripts[]（数组：name / invoker / invokerType / executionStart / duration / sourceURL / sourceFunctionName / sourceCharPosition）。比 Long Task API（longtask，仅总耗时）更细粒度。当前环境若不支持 LoAF 会自动退化为 longtask。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('启动 LoAF 监听', { type: 'primary', size: 'sm', disabled: !caps.perfObserver, onClick: () => this._startLoAFObserver() }), this._btn('触发长帧', { danger: true, size: 'sm', disabled: !caps.perfObserver, onClick: () => this._triggerLongFrame() }), this._btn('停止监听', { size: 'sm', disabled: !caps.perfObserver, onClick: () => this._stopLoAFObserver() })),
                h('div', { class: 'fs-sm text-secondary' }, 'LoAF 条目：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.loafState || '（点击「启动 LoAF 监听」→「触发长帧」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `const observer = new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    console.log(e.duration, e.blockingDuration, e.renderStart);
    for (const s of e.scripts) {
      console.log(s.name, s.invoker, s.invokerType,
        s.sourceURL, s.sourceFunctionName, s.sourceCharPosition);
    }
  }
});
observer.observe({ entryTypes: ['long-animation-frame'] });
// 触发长帧后可拿到 scripts[] 定位是哪段脚本拖慢了渲染

// 退化方案：Long Task API（仅总耗时，无脚本归因）
const o2 = new PerformanceObserver((l) => l.getEntries());
o2.observe({ entryTypes: ['longtask'] });`)),
                h(Alert, {
                    type: 'info',
                    message: 'LoAF 是 Long Task API 的升级版',
                    description: 'Long Task API（longtask）只告诉你"有个任务超过 50ms"，无法定位是哪段脚本；LoAF 提供 scripts[]，含 invoker / sourceURL / sourceFunctionName / sourceCharPosition，可直接归因到具体代码位置。blockingDuration 还区分了真正阻塞主线程的时间。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：measureUserAgentSpecificMemory ===================
    // performance.measureUserAgentSpecificMemory!() → Promise<{ bytes, breakdown }>
    async _measureMemory() {
        const caps = this._caps();
        if (!caps.measureMemory) {
            this._addLog('warn', 'performance.measureUserAgentSpecificMemory 不可用（需 Chromium 89+ 且跨域隔离 COOP/COEP）');
            return;
        }
        try {
            this._addLog('memory', '调用 performance.measureUserAgentSpecificMemory!()…');
            const result = await performance.measureUserAgentSpecificMemory();
            const bytes = result.bytes;
            const mb = (bytes / 1024 / 1024).toFixed(2);
            const breakdownText = (result.breakdown || [])
                .map((b, i) => {
                const bm = (b.bytes / 1024 / 1024).toFixed(2);
                const types = (b.types || []).join(', ') || '(无)';
                const attr = b.attribution || '(无)';
                return `  [${i}] bytes=${b.bytes}（${bm} MB）types=[${types}] attribution=${attr}`;
            })
                .join('\n');
            this.setState({
                memoryState: `performance.measureUserAgentSpecificMemory!() → { bytes, breakdown } ✓\n` +
                    `总占用：bytes = ${bytes}（${mb} MB）\n\n` +
                    `breakdown（按归属拆分）：\n${breakdownText || '  （无）'}\n\n` +
                    `说明：breakdown 是 [{ attribution, types, bytes }] 数组，按 JS 堆归属\n` +
                    `  attribution：归属（如 window、worker、SharedArrayBuffer）\n` +
                    `  types：类型标签（如 'JS' / 'DOM' / 'Shared'）\n` +
                    `  bytes：该归属占用字节数\n\n` +
                    `注意：返回值是「用户代理特定」的估计值，不同浏览器实现不同；\n` +
                    `需跨域隔离（COOP/COEP）才能获取跨域 iframe / window 的内存。`,
            });
            this._addLog('memory', `measureMemory 完成：总占用 ${mb} MB，breakdown ${(result.breakdown || []).length} 项`);
        }
        catch (err) {
            this._addLog('warn', `measureMemory 失败：${errInfo(err).name} - ${errInfo(err).message}`);
            this.setState({ memoryState: `measureMemory 失败：${errInfo(err).name} - ${errInfo(err).message}` });
        }
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. performance.measureUserAgentSpecificMemory（内存监控）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.measureMemory ? 'success' : 'error' }, caps.measureMemory ? 'measureMemory ✓' : '不可用'), h(Tag, { color: 'primary' }, 'bytes / breakdown')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'performance.measureUserAgentSpecificMemory!() → Promise<{ bytes, breakdown }> 估算当前页面 JavaScript 堆内存占用。bytes 为总字节数；breakdown 是 [{ attribution, types, bytes }] 数组，按归属（window / worker / SharedArrayBuffer 等）拆分。返回值为「用户代理特定」估计值，不同浏览器实现不同；需跨域隔离（COOP/COEP）才能统计跨域 iframe / window 的内存。用途：检测内存泄漏、监控页面内存增长。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('测量内存', { type: 'primary', size: 'sm', disabled: !caps.measureMemory, onClick: () => this._measureMemory() })),
                h('div', { class: 'fs-sm text-secondary' }, '内存测量结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.memoryState || '（点击「测量内存」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `// 需要页面跨域隔离（COOP/COEP 头）
const result = await performance.measureUserAgentSpecificMemory!();
console.log(result.bytes, 'bytes');
for (const b of result.breakdown) {
  console.log(b.attribution, b.types, b.bytes);
}
// 监控内存增长以检测泄漏：定时调用并记录 bytes 变化`)),
                h(Alert, {
                    type: 'warning',
                    message: '需要跨域隔离与 https',
                    description: '此 API 仅在跨域隔离（crossOriginIsolated = true，需 COOP: same-origin 与 COEP: require-corp 响应头）的安全上下文中可用；否则抛 TypeError。jsdom/Node 中无此 API。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：scheduler.yield() 让出主线程 ===================
    async _demoYield() {
        const caps = this._caps();
        if (!caps.schedulerYield) {
            this._addLog('warn', 'scheduler.yield() 不可用（Chrome 129+），无法演示');
            this.setState({ yieldState: 'scheduler.yield() 不可用（需 Chrome 129+）。该 API 让出主线程给更高优先级任务（如用户输入），是 INP 优化的关键工具。' });
            return;
        }
        try {
            const t0 = performance.now();
            this._addLog('yield', '开始长任务（密集计算 ~50ms），中途用 scheduler.yield() 让出主线程…');
            let sum = 0;
            for (let i = 0; i < 5e6; i++) {
                sum += Math.sqrt(i);
                if (i % 1e6 === 0 && i > 0) {
                    this._addLog('yield', `计算到 ${i / 1e6}M，调用 scheduler.yield() 让出…`);
                    await scheduler.yield();
                }
            }
            const elapsed = (performance.now() - t0).toFixed(1);
            this._addLog('yield', `长任务完成：sum=${sum.toFixed(0)}，总耗时 ${elapsed}ms（yield 让出后用户输入可穿插响应）`);
            this.setState({
                yieldState: `scheduler.yield() 演示完成 ✓\n` +
                    `长任务总耗时 ${elapsed}ms（含 yield 让出时间）\n` +
                    `sum = ${sum.toFixed(0)}\n\n` +
                    `yield() 让主线程在长任务中途响应更高优先级任务（如用户交互），\n` +
                    `避免长任务阻塞 INP。vs setTimeout(0)：yield() 保证在当前任务队列\n` +
                    `的 continuation 中恢复，不会被其他定时器插队；vs requestIdleCallback：\n` +
                    `yield() 立即让出并在下一轮恢复，不等空闲。`,
            });
        }
        catch (err) {
            this._addLog('error', `scheduler.yield() 演示失败：${errInfo(err).name} - ${errInfo(err).message}`);
        }
    }
    _renderCard7() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '7. scheduler.yield() —— 让出主线程（INP 优化）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.schedulerYield ? 'success' : 'error' }, caps.schedulerYield ? 'yield ✓' : '不可用'), h(Tag, { color: 'primary' }, 'Chrome 129+')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'scheduler.yield() 返回 Promise，让出主线程给更高优先级任务（如用户输入响应），随后在「continuation」中恢复执行。是长任务中段让出、优化 INP（Interaction to Next Paint）的关键 API。vs setTimeout(0)：yield 不会被其他定时器插队；vs requestIdleCallback：yield 立即让出不等空闲。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 yield 演示', { type: 'primary', size: 'sm', disabled: !caps.schedulerYield, onClick: () => this._demoYield() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, s.yieldState || '（点击「运行 yield 演示」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `// 长任务中段让出，避免阻塞用户交互
async function longTask() {
  for (let i = 0; i < chunks; i++) {
    doWork(i);
    await scheduler.yield();   // 让出主线程，用户输入可穿插
  }
}
// vs setTimeout(0)：yield 在 continuation 恢复，不被插队
// vs requestIdleCallback：yield 立即让出，不等空闲`)),
                h(Alert, {
                    type: 'info',
                    message: 'INP 优化的关键工具',
                    description: 'scheduler.yield() 是 Chrome 129+ 引入的 API，专为长任务中段让出而设计。与 scheduler.postTask 不同：postTask 用于提交新任务（含优先级），yield 用于在当前任务执行中主动让出。两者互补：postTask 管理任务调度，yield 管理任务执行中断点。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, '任务调度与系统压力实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示现代浏览器的系统级 Web API：Prioritized Task Scheduling（任务优先级调度）、TaskController（取消与优先级变更）、Idle Detection（空闲检测）、Compute Pressure（CPU 压力）、Long Animation Frames（长帧）、measureUserAgentSpecificMemory（内存监控）。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderLogPanel());
    }
}
//# sourceMappingURL=SchedulerTasksPage.js.map