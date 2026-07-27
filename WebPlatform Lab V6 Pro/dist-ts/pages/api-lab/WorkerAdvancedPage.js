// =====================================================================
// WorkerAdvancedPage.js —— Worker 与并发通信深入 实验室
// 演示 MDN：
//   1. Worker 类型对比 —— Dedicated Worker / SharedWorker / ServiceWorker
//   2. Module Worker vs Classic Worker —— type:'module' 与 importScripts
//   3. OffscreenCanvas + Worker —— transferControlToOffscreen 后台渲染
//   4. MessageChannel —— 双向通信管道（port1 / port2 / 转移 port）
//   5. BroadcastChannel —— 跨页面 / 跨 Worker 广播
//   6. Worker 全局对象对比 —— WorkerGlobalScope 有 / 无的 API
// 说明：Web Worker 把耗时任务移出主线程，避免 UI 卡顿。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。jsdom 中 Worker 可能可用但需脚本文件 URL，SharedWorker /
//       OffscreenCanvas 通常 undefined；MessageChannel / BroadcastChannel 真实可用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class WorkerAdvancedPage extends Page {
    _broadcastChannels = null;
    _dedicatedWorker = null;
    _inited = false;
    _messageChannel = null;
    _sharedWorker = null;
    _workerPort = null;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：Worker 类型对比
            workerCompare: '',
            // Card 2：Module Worker vs Classic Worker
            moduleWorkerInfo: '',
            // Card 3：OffscreenCanvas + Worker
            offscreenInfo: '',
            // Card 4：MessageChannel 双向通信
            channelInfo: '',
            // Card 5：BroadcastChannel 广播
            broadcastInfo: '',
            // Card 6：Worker 全局对象对比
            globalScopeInfo: '',
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._dedicatedWorker = null; // Card 1 专用 Worker 引用（mock）
        this._sharedWorker = null; // Card 1 共享 Worker 引用（mock）
        this._messageChannel = null; // Card 4 MessageChannel
        this._workerPort = null; // Card 4 转移给 Worker 的 port（mock，仅记录）
        this._broadcastChannels = []; // Card 5 BroadcastChannel 数组
        // 一次性能力检测：Worker 与并发通信全家桶
        const hasWorker = typeof Worker !== 'undefined';
        const hasSharedWorker = typeof SharedWorker !== 'undefined';
        const hasServiceWorker = typeof ServiceWorker !== 'undefined';
        const hasMessageChannel = typeof MessageChannel !== 'undefined';
        const hasBroadcastChannel = typeof BroadcastChannel !== 'undefined';
        const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
        const hasTransferControl = typeof HTMLCanvasElement !== 'undefined'
            && typeof HTMLCanvasElement.prototype !== 'undefined'
            && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function';
        const parts = [];
        parts.push(`Worker ${hasWorker ? '✓' : '✗'}`);
        parts.push(`SharedWorker ${hasSharedWorker ? '✓' : '✗'}`);
        parts.push(`ServiceWorker ${hasServiceWorker ? '✓' : '✗'}`);
        parts.push(`MessageChannel ${hasMessageChannel ? '✓' : '✗'}`);
        parts.push(`BroadcastChannel ${hasBroadcastChannel ? '✓' : '✗'}`);
        parts.push(`OffscreenCanvas ${hasOffscreenCanvas ? '✓' : '✗'}`);
        parts.push(`transferControlToOffscreen ${hasTransferControl ? '✓' : '✗'}`);
        const anyAvailable = hasWorker || hasMessageChannel || hasBroadcastChannel;
        const summary = anyAvailable
            ? `Worker 与并发通信能力检测：${parts.join(' · ')}。jsdom 中 Worker 可能可用但需脚本文件 URL（本演示不真正创建 Worker，仅记录用法）；MessageChannel / BroadcastChannel 在 Node/jsdom 中真实可用，可执行真实的双向通信与跨通道广播演示。`
            : '当前环境不支持 Worker / MessageChannel / BroadcastChannel（typeof 均为 "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!hasSharedWorker)
            this._addLog('warn', 'SharedWorker 不可用（jsdom 通常无此构造器，需真实浏览器）');
        if (!hasOffscreenCanvas)
            this._addLog('warn', 'OffscreenCanvas 不可用（jsdom 无此构造器，需真实浏览器）');
        if (!hasTransferControl)
            this._addLog('warn', 'HTMLCanvasElement.prototype.transferControlToOffscreen 不可用（jsdom 未实现）');
    }
    componentWillUnmount() {
        // 释放所有 worker 引用：terminate 专用 Worker / close 共享 Worker port
        if (this._dedicatedWorker && typeof this._dedicatedWorker.terminate === 'function') {
            try {
                this._dedicatedWorker.terminate();
            }
            catch { /* noop */ }
        }
        this._dedicatedWorker = null;
        if (this._sharedWorker && this._sharedWorker.port && typeof this._sharedWorker.port.close === 'function') {
            try {
                this._sharedWorker.port.close();
            }
            catch { /* noop */ }
        }
        this._sharedWorker = null;
        // 关闭 MessageChannel 的两个 port
        if (this._messageChannel) {
            try {
                this._messageChannel.port1.close();
            }
            catch { /* noop */ }
            try {
                this._messageChannel.port2.close();
            }
            catch { /* noop */ }
        }
        this._messageChannel = null;
        this._workerPort = null;
        // 关闭所有 BroadcastChannel
        for (const ch of this._broadcastChannels) {
            try {
                ch.close();
            }
            catch { /* noop */ }
        }
        this._broadcastChannels = [];
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
            worker: typeof Worker !== 'undefined',
            sharedWorker: typeof SharedWorker !== 'undefined',
            serviceWorker: typeof ServiceWorker !== 'undefined',
            messageChannel: typeof MessageChannel !== 'undefined',
            broadcastChannel: typeof BroadcastChannel !== 'undefined',
            offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
            transferControl: typeof HTMLCanvasElement !== 'undefined'
                && typeof HTMLCanvasElement.prototype !== 'undefined'
                && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function',
        };
    }
    // =================== Card 1：Worker 类型对比 ===================
    // 列出三种 Worker 的差异表 + 能力检测
    _showWorkerDiff() {
        const caps = this._caps();
        const w = caps.worker ? 'function（可用）' : 'undefined（不可用）';
        const sw = caps.sharedWorker ? 'function（可用）' : 'undefined（不可用，jsdom 通常无）';
        const serw = caps.serviceWorker ? 'function（可用）' : 'undefined（不可用，需 https 与浏览器）';
        this.setState({ workerCompare: '===== Web Worker 三大类型对比 =====\n\n' +
                '1) Dedicated Worker：new Worker(scriptURL, { type, name, credentials })\n' +
                '   通信：postMessage(msg, transfer) / onmessage / onerror；终止：terminate() / self.close()；作用域：一对一\n' +
                `   当前环境：typeof Worker = ${w}\n\n` +
                '2) SharedWorker：new SharedWorker(scriptURL, { name })，通信：port（MessagePort）+ start()\n' +
                '   Worker 内：onconnect = (e) => e.ports[0]；作用域：多页面共享（多对一）\n' +
                `   当前环境：typeof SharedWorker = ${sw}\n\n` +
                '3) ServiceWorker：navigator.serviceWorker.register(scriptURL, { scope })\n' +
                '   作用：拦截请求 / 离线缓存 / 推送；生命周期：install → activate → fetch / push\n' +
                `   当前环境：typeof ServiceWorker = ${serw}\n\n` +
                '通信方式差异：Dedicated=worker.postMessage 单向；Shared=port.postMessage 广播；Service=clients.postMessage 回传' });
        this._addLog('compare', `展示 Worker 类型对比表：Worker=${caps.worker}, SharedWorker=${caps.sharedWorker}, ServiceWorker=${caps.serviceWorker}`);
    }
    // 演示 Dedicated Worker 的 API 表面（用 mock 对象，不真正创建 Worker）
    _demoDedicatedMock() {
        const caps = this._caps();
        if (!caps.worker) {
            // 测试环境无 Worker：记录用法说明
            this.setState({ workerCompare: 'Dedicated Worker 用法（测试环境不可用，仅说明）：\n\n' +
                    "// 主线程\n" +
                    "const worker = new Worker('./heavy-task.js', { type: 'classic', name: 'compute' });\n" +
                    "worker.onmessage = (e) => console.log(e.data);\n" +
                    'worker.postMessage({ nums: [1,2,3] });    // 单向发送\n' +
                    'worker.postMessage(buf, [buf]);           // 转移 ArrayBuffer\n' +
                    'worker.terminate();                       // 主线程终止\n\n' +
                    "// heavy-task.js（Worker 内）\n" +
                    'self.onmessage = (e) => { self.postMessage({ sum: e.data.nums.reduce((a,b)=>a+b,0) }); };' });
            this._addLog('dedicated', 'Worker 不可用（jsdom 无脚本文件），已记录 Dedicated Worker 用法说明');
            return;
        }
        // Worker 可用：构造 mock 对象演示 API 表面（不真正 new Worker，避免依赖脚本文件）
        try {
            const mockWorker = {
                constructor: Worker,
                name: 'dedicated-mock',
                onmessage: null,
                onerror: null,
                onmessageerror: null,
                postMessage(_msg, _transfer) { },
                terminate() { },
            };
            this._dedicatedWorker = mockWorker;
            const isWorker = mockWorker.constructor === Worker;
            const protoKeys = Object.getOwnPropertyNames(Worker.prototype || {});
            const instKeys = Object.getOwnPropertyNames(mockWorker).filter((k) => k !== 'constructor');
            this.setState({ workerCompare: 'Dedicated Worker mock 演示（未真正 new Worker，避免依赖脚本文件）：\n\n' +
                    `mockWorker.constructor === Worker = ${isWorker}\n` +
                    `Worker.prototype 属性：${protoKeys.length ? protoKeys.join(', ') : '（无自有属性）'}\n` +
                    `mock 实例方法 / 属性：${instKeys.join(', ')}\n\n` +
                    'API 表面：\n' +
                    '  new Worker(scriptURL, { type: "classic" | "module", name, credentials })\n' +
                    '  worker.postMessage(message, transfer)  —— transfer 为可转移对象数组\n' +
                    '  worker.onmessage / onerror / onmessageerror —— 接收回传 / 错误 / 反序列化失败\n' +
                    '  worker.terminate()                      —— 主线程立即终止\n\n' +
                    '说明：真实创建需提供脚本 URL（同源或满足 CSP），本环境仅演示 API 形态。' });
            this._addLog('dedicated', `Dedicated Worker mock：constructor===Worker=${isWorker}，已记录 API 表面`);
        }
        catch (err) {
            this._addLog('warn', `Dedicated Worker mock 失败：${err.name} - ${err.message}`);
        }
    }
    // 演示 SharedWorker 的 API 表面（用 mock 对象）
    _demoSharedMock() {
        const caps = this._caps();
        if (!caps.sharedWorker) {
            this.setState({ workerCompare: 'SharedWorker 用法（测试环境不可用，仅说明）：\n\n' +
                    "// 主线程（页面 A / B 共享同一实例）\n" +
                    "const sw = new SharedWorker('./shared.js', { name: 'shared-counter' });\n" +
                    'sw.port.start();                              // 显式启动消息队列\n' +
                    'sw.port.onmessage = (e) => console.log(e.data);\n' +
                    "sw.port.postMessage({ cmd: 'inc' });\n\n" +
                    "// shared.js（SharedWorkerGlobalScope）\n" +
                    'let count = 0;\n' +
                    'self.onconnect = (e) => {\n' +
                    '  const port = e.ports[0]; port.start();      // 新连接的 port\n' +
                    '  port.onmessage = (ev) => {\n' +
                    '    if (ev.data.cmd === "inc") count++;\n' +
                    '    port.postMessage({ count });              // 广播给所有连接\n' +
                    '  };\n' +
                    '};\n\n' +
                    '差异：SharedWorker 通过 port 通信，多个页面共享；需 onconnect 接收新连接。' });
            this._addLog('shared', 'SharedWorker 不可用（typeof undefined），已记录用法说明');
            return;
        }
        try {
            const mockPort = {
                start() { }, close() { }, postMessage() { }, onmessage: null, onmessageerror: null,
            };
            const mockShared = {
                constructor: SharedWorker,
                port: mockPort,
            };
            this._sharedWorker = mockShared;
            const isShared = mockShared.constructor === SharedWorker;
            this.setState({ workerCompare: 'SharedWorker mock 演示（未真正 new SharedWorker）：\n\n' +
                    `mockShared.constructor === SharedWorker = ${isShared}\n` +
                    `mockShared.port 存在：${mockShared.port !== null && mockShared.port !== undefined}\n\n` +
                    'API 表面：\n' +
                    '  new SharedWorker(scriptURL, { name })\n' +
                    '  sharedWorker.port → MessagePort\n' +
                    '  port.start() / port.close() / port.postMessage(msg, transfer)\n' +
                    '  port.onmessage / port.onmessageerror\n\n' +
                    'Worker 内（SharedWorkerGlobalScope）：onconnect = (e) => e.ports[0]\n' +
                    '多页面共享：同名 SharedWorker 只创建一次，后续 new 复用实例。' });
            this._addLog('shared', `SharedWorker mock：constructor===SharedWorker=${isShared}，port 存在`);
        }
        catch (err) {
            this._addLog('warn', `SharedWorker mock 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. Worker 类型对比',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.worker ? 'success' : 'error' }, caps.worker ? 'Worker ✓' : 'Worker ✗'), h(Tag, { color: caps.sharedWorker ? 'success' : 'error' }, caps.sharedWorker ? 'SharedWorker ✓' : 'SharedWorker ✗'), h(Tag, { color: 'primary' }, 'Dedicated / Shared / Service')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Dedicated Worker（专用 Worker）只能与创建它的页面一对一通信；SharedWorker（共享 Worker）可被多个页面 / iframe 共享，通过 port（MessagePort）通信；ServiceWorker（服务 Worker）拦截网络请求、提供离线缓存，独立线程无 DOM 访问。三者构造器与通信方式均不同。本卡片用 mock 对象演示 API 表面，不真正创建 Worker（避免依赖脚本文件）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('类型对比表', { type: 'primary', size: 'sm', onClick: () => this._showWorkerDiff() }), this._btn('Dedicated mock', { size: 'sm', disabled: !caps.worker, onClick: () => this._demoDedicatedMock() }), this._btn('SharedWorker mock', { size: 'sm', disabled: !caps.sharedWorker, onClick: () => this._demoSharedMock() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Worker 类型对比 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.workerCompare || '（点击「类型对比表」或对应 mock 按钮）')),
                h(Alert, {
                    type: 'info',
                    message: '三种 Worker 的核心差异',
                    description: 'Dedicated 一对一、SharedWorker 多对一（port 通信 + onconnect）、ServiceWorker 离线缓存（独立线程 + 生命周期）。ServiceWorker 已在其他页面覆盖，此处仅对比说明。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：Module Worker vs Classic Worker ===================
    // 检测 Module Worker 支持（不真正 new Worker，避免测试环境 hang）
    _checkModuleSupport() {
        const caps = this._caps();
        if (!caps.worker) {
            this._addLog('warn', 'Worker 不可用，无法检测 Module Worker 支持');
            this.setState({ moduleWorkerInfo: 'Worker 不可用（typeof Worker === "undefined"），无法检测 Module Worker 支持。' });
            return;
        }
        // 不真正 new Worker（测试环境无脚本文件，且可能 hang），仅检测构造器存在性并记录用法
        const ctorOk = typeof Worker === 'function';
        this.setState({ moduleWorkerInfo: 'Module Worker 支持检测：\n' +
                `  typeof Worker === 'function'：${ctorOk}\n` +
                '  说明：测试环境不真正创建 Worker（避免依赖脚本文件 / hang），\n' +
                '    { type: "module" } 支持需在真实浏览器中验证（Chrome 80+ / Firefox 114+ / Safari 15+）。\n\n' +
                'Classic Worker（type: "classic"，默认）：\n' +
                '  Worker 内用 importScripts("lib.js", "utils.js") 同步加载脚本\n' +
                '  importScripts 阻塞执行；不能使用 import / export 语法\n\n' +
                'Module Worker（type: "module"）：\n' +
                '  Worker 内用 import { x } from "./lib.js" 静态导入\n' +
                '  支持 import() 动态导入、top-level await\n' +
                '  共享主线程的 ES Module 生态（同一打包产物可复用）\n\n' +
                `当前环境 Module Worker 支持需真实浏览器验证（构造器存在：${ctorOk}）。` });
        this._addLog('module', `Module Worker 检测：Worker 构造器存在=${ctorOk}（不真正创建）`);
    }
    // 演示 Classic Worker 用法（importScripts）
    _demoClassicWorker() {
        const caps = this._caps();
        if (!caps.worker) {
            this._addLog('warn', 'Worker 不可用，无法演示 Classic Worker');
            return;
        }
        this.setState({ moduleWorkerInfo: 'Classic Worker（type: "classic"，默认）API 与用法：\n\n' +
                `typeof Worker === 'function'：${caps.worker}\n` +
                '构造：new Worker(scriptURL) 或 new Worker(scriptURL, { type: "classic" })\n\n' +
                'Worker 内（ClassicWorkerGlobalScope）：\n' +
                '  importScripts("./lib.js", "./utils.js")  // 同步加载多脚本，阻塞执行\n' +
                '  // 不能使用 import / export 语法\n' +
                '  self.onmessage = (e) => { self.postMessage({ result: libCompute(e.data) }); }\n\n' +
                '主线程：worker.postMessage / worker.onmessage / worker.terminate\n' +
                '特点：importScripts 同步阻塞；全局作用域（变量挂载 self）；兼容性最好。\n' +
                '说明：测试环境不真正创建 Worker（需脚本文件），仅记录 API 与用法。' });
        this._addLog('classic', '已记录 Classic Worker / importScripts 用法说明');
    }
    // 演示 Module Worker 用法（ES Module import）
    _demoModuleWorker() {
        const caps = this._caps();
        if (!caps.worker) {
            this._addLog('warn', 'Worker 不可用，无法演示 Module Worker');
            return;
        }
        this.setState({ moduleWorkerInfo: 'Module Worker（type: "module"）API 与用法：\n\n' +
                `typeof Worker === 'function'：${caps.worker}\n` +
                '构造：new Worker(scriptURL, { type: "module" })\n\n' +
                'Worker 内（ModuleWorkerGlobalScope）：\n' +
                '  import { compute } from "./lib.js"        // 静态导入\n' +
                '  import("./dynamic.js").then(m => m.run()) // 动态导入\n' +
                '  // 支持 top-level await；importScripts 不可用（会抛 TypeError）\n' +
                '  self.onmessage = (e) => { self.postMessage({ result: compute(e.data) }); }\n\n' +
                '差异对比：Classic=importScripts 同步阻塞无 import/export；Module=import 静态/import() 动态/top-level await\n' +
                '  检测：worker.constructor === Worker（两者相同，区分靠 type 选项）\n' +
                '特点：复用 ES Module 生态；需现代浏览器（Chrome 80+ / Firefox 114+ / Safari 15+）。' });
        this._addLog('module', '已记录 Module Worker / ES import 用法说明');
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. Module Worker vs Classic Worker',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.worker ? 'success' : 'error' }, caps.worker ? 'Worker ✓' : '不可用'), h(Tag, { color: 'primary' }, 'importScripts / import')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Classic Worker（type: "classic"，默认）在 Worker 内用 importScripts("lib.js") 同步加载脚本，阻塞执行，不能用 import/export 语法；Module Worker（type: "module"）用 import { x } from "./lib.js" 静态导入，支持 import() 动态导入与 top-level await，可复用主线程 ES Module 生态。检测：worker.constructor === Worker（两者相同，区分靠 type 选项）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测 Module 支持', { type: 'primary', size: 'sm', disabled: !caps.worker, onClick: () => this._checkModuleSupport() }), this._btn('Classic Worker', { size: 'sm', disabled: !caps.worker, onClick: () => this._demoClassicWorker() }), this._btn('Module Worker', { size: 'sm', disabled: !caps.worker, onClick: () => this._demoModuleWorker() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Module / Classic Worker 用法对比：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.moduleWorkerInfo || '（点击「检测 Module 支持」或对应用法按钮）')),
                h(Alert, {
                    type: 'info',
                    message: 'Module Worker 是现代 Worker 的推荐方式',
                    description: 'Module Worker 复用 ES Module 生态，支持 tree-shaking、动态 import、top-level await；但旧浏览器（如 IE）不支持。importScripts 仅 Classic Worker 可用，Module Worker 内调用会抛 TypeError。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：OffscreenCanvas + Worker ===================
    // 检测 OffscreenCanvas 与 transferControlToOffscreen 支持
    _checkOffscreen() {
        const caps = this._caps();
        const status = caps.offscreenCanvas ? 'OffscreenCanvas 构造器可用，可执行真实演示。' : '当前环境 OffscreenCanvas 不可用，仅记录用法说明。';
        this.setState({ offscreenInfo: 'OffscreenCanvas 能力检测：\n' +
                `  typeof OffscreenCanvas = ${caps.offscreenCanvas ? 'function（可用）' : 'undefined（不可用）'}\n` +
                `  transferControlToOffscreen = ${caps.transferControl ? 'function（可用）' : 'undefined（不可用）'}\n\n` +
                '说明：\n' +
                '  - OffscreenCanvas 可在 Worker 内渲染，不阻塞主线程\n' +
                '  - transferControlToOffscreen 把 <canvas> 控制权转移给 OffscreenCanvas\n' +
                '  - jsdom 中两者均不可用（typeof undefined），需真实浏览器\n\n' +
                status });
        this._addLog('offscreen', `OffscreenCanvas=${caps.offscreenCanvas}, transferControl=${caps.transferControl}`);
    }
    // 演示创建 OffscreenCanvas（如可用）
    _createOffscreen() {
        const caps = this._caps();
        if (!caps.offscreenCanvas) {
            this.setState({ offscreenInfo: 'OffscreenCanvas 用法（测试环境不可用，仅说明）：\n\n' +
                    '// 主线程：从 <canvas> 转移控制权\n' +
                    'const offscreen = canvas.transferControlToOffscreen();\n' +
                    'worker.postMessage({ canvas: offscreen }, [offscreen]);  // 转移给 Worker\n\n' +
                    '// 或直接构造（脱离 DOM）\n' +
                    'const off = new OffscreenCanvas(300, 150);\n' +
                    'const blob = await off.convertToBlob({ type: "image/png" });\n\n' +
                    '// Worker 内：在 OffscreenCanvas 上渲染\n' +
                    'self.onmessage = (e) => {\n' +
                    '  const ctx = e.data.canvas.getContext("2d");\n' +
                    '  ctx.fillRect(0, 0, 50, 50);\n' +
                    '  requestAnimationFrame(() => { /* 动画帧，仅 OffscreenCanvas Worker */ });\n' +
                    '};' });
            this._addLog('offscreen', 'OffscreenCanvas 不可用（typeof undefined），已记录用法');
            return;
        }
        try {
            const off = new OffscreenCanvas(120, 80);
            const ctx = off.getContext('2d');
            ctx.fillStyle = '#4f8cff';
            ctx.fillRect(10, 10, 100, 60);
            const w = off.width;
            const h = off.height;
            this.setState({ offscreenInfo: '真实创建 OffscreenCanvas：\n' +
                    '  new OffscreenCanvas(120, 80) → offscreen\n' +
                    `  offscreen.width = ${w}, offscreen.height = ${h}\n` +
                    '  offscreen.getContext("2d") → ctx（可绘制），已绘制蓝色矩形\n\n' +
                    '说明：OffscreenCanvas 可在 Worker 内渲染；transferControlToOffscreen 转 <canvas> 控制权给 Worker。\n' +
                    '  convertToBlob(options) → Promise<Blob>：导出图片\n' +
                    '  Worker 内可用 requestAnimationFrame（仅 OffscreenCanvas Worker）' });
            this._addLog('offscreen', `真实创建 OffscreenCanvas(${w}x${h})，getContext('2d') 成功`);
        }
        catch (err) {
            this._addLog('warn', `创建 OffscreenCanvas 失败：${err.name} - ${err.message}`);
        }
    }
    // 演示 transferControlToOffscreen 流程（如可用）
    _demoTransferControl() {
        const caps = this._caps();
        if (!caps.transferControl) {
            this.setState({ offscreenInfo: 'transferControlToOffscreen 用法（测试环境不可用，仅说明）：\n\n' +
                    '// 1. 主线程 <canvas> 转移控制权（一次性，转移后主线程不能再操作该 canvas）\n' +
                    'const offscreen = canvas.transferControlToOffscreen();\n' +
                    '// 2. 转移给 Worker（transfer 数组）：worker.postMessage({ type: "init", canvas: offscreen }, [offscreen])\n' +
                    '// 3. Worker 内接收并渲染：self.onmessage = (e) => { if (e.data.type === "init") {\n' +
                    '  const ctx = e.data.canvas.getContext("2d"); ctx.fillStyle = "red"; ctx.fillRect(0, 0, 100, 100); } };\n\n' +
                    '优势：渲染在 Worker 线程，不阻塞主线程 UI，适合动画 / 复杂图形。' });
            this._addLog('offscreen', 'transferControlToOffscreen 不可用，已记录用法说明');
            return;
        }
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 100;
            const offscreen = canvas.transferControlToOffscreen();
            this.setState({ offscreenInfo: '真实演示 transferControlToOffscreen：\n' +
                    `  (document.createElement('canvas') as any) → canvas（${canvas.width}x${canvas.height}）\n` +
                    '  canvas.transferControlToOffscreen() → OffscreenCanvas\n' +
                    `  typeof offscreen = ${typeof offscreen}\n\n` +
                    '流程：主线程 canvas → transferControlToOffscreen → OffscreenCanvas\n' +
                    '  → worker.postMessage({ canvas }, [canvas]) 转移给 Worker\n' +
                    '  → Worker 内 getContext("2d" / "webgl" / "webgl2") 渲染\n\n' +
                    '注意：transferControlToOffscreen 后主线程不能再操作该 canvas（控制权已转移）。' });
            this._addLog('offscreen', `transferControlToOffscreen 成功，得到 ${typeof offscreen}`);
        }
        catch (err) {
            this._addLog('warn', `transferControlToOffscreen 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. OffscreenCanvas + Worker',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.offscreenCanvas ? 'success' : 'error' }, caps.offscreenCanvas ? 'OffscreenCanvas ✓' : '不可用'), h(Tag, { color: caps.transferControl ? 'success' : 'error' }, caps.transferControl ? 'transferControl ✓' : 'transferControl ✗'), h(Tag, { color: 'primary' }, '后台渲染')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'OffscreenCanvas 可在 Worker 内渲染，不阻塞主线程。主线程用 canvas.transferControlToOffscreen() 把 <canvas> 控制权转移给 OffscreenCanvas，再通过 worker.postMessage({ canvas }, [canvas]) 转移给 Worker；Worker 内用 getContext("2d"/"webgl"/"webgl2") 渲染，并可用 requestAnimationFrame（仅 OffscreenCanvas Worker 支持）。convertToBlob(options) 导出为 Blob。jsdom 中 OffscreenCanvas / transferControlToOffscreen 通常不可用。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkOffscreen() }), this._btn('创建 OffscreenCanvas', { size: 'sm', disabled: !caps.offscreenCanvas, onClick: () => this._createOffscreen() }), this._btn('transferControl', { size: 'sm', disabled: !caps.transferControl, onClick: () => this._demoTransferControl() })),
                h('div', { class: 'fs-sm text-secondary' }, 'OffscreenCanvas 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.offscreenInfo || '（点击「检测能力」或对应演示按钮）')),
                h(Alert, {
                    type: 'warning',
                    message: 'transferControlToOffscreen 是单向不可逆操作',
                    description: '调用后 <canvas> 控制权永久转移给 OffscreenCanvas，主线程不能再通过该 canvas 的 2d 上下文绘制（getContext 会抛错）。OffscreenCanvas 通过 transfer 列表转移给 Worker 后，主线程也不能再访问该 OffscreenCanvas。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：MessageChannel 双向通信 ===================
    // 创建 MessageChannel，绑定 port1.onmessage
    _createMessageChannel() {
        const caps = this._caps();
        if (!caps.messageChannel) {
            this._addLog('warn', 'MessageChannel 不可用');
            this.setState({ channelInfo: 'MessageChannel 不可用（typeof MessageChannel === "undefined"）。' });
            return;
        }
        try {
            // 关闭旧 channel
            if (this._messageChannel) {
                try {
                    this._messageChannel.port1.close();
                }
                catch { /* noop */ }
                try {
                    this._messageChannel.port2.close();
                }
                catch { /* noop */ }
            }
            const channel = new MessageChannel();
            this._messageChannel = channel;
            // port1 留主线程，绑定 onmessage 接收"Worker 回传"
            let receivedCount = 0;
            channel.port1.onmessage = (e) => {
                receivedCount += 1;
                this._addLog('channel', `port1.onmessage 收到：${JSON.stringify(e.data)}（第 ${receivedCount} 条）`);
            };
            channel.port1.onmessageerror = () => {
                this._addLog('warn', 'port1.onmessageerror：反序列化失败');
            };
            this.setState({ channelInfo: '已创建 MessageChannel：\n' +
                    '  new MessageChannel() → { port1, port2 }\n' +
                    '  port1.onmessage 已绑定（主线程接收 Worker 回传）\n' +
                    '  port1.onmessageerror 已绑定（反序列化失败）\n\n' +
                    '说明：\n' +
                    '  - port1.postMessage(msg) → port2.onmessage 收到\n' +
                    '  - port2.postMessage(msg) → port1.onmessage 收到\n' +
                    '  - 转移 port2 给 Worker：worker.postMessage({ port: channel.port2 }, [channel.port2])\n' +
                    '  - 设置 onmessage 会自动 port.start()；未设置时需显式 start()\n\n' +
                    '点击「port1 发送」从 port1 发送；点击「port2 回传」从 port2 发送。' });
            this._addLog('channel', '已创建 MessageChannel，port1.onmessage 已绑定');
        }
        catch (err) {
            this._addLog('warn', `创建 MessageChannel 失败：${err.name} - ${err.message}`);
        }
    }
    // 主线程通过 port1 发送消息（port2 会收到，模拟主线程→Worker 方向）
    _sendFromPort1() {
        const caps = this._caps();
        if (!caps.messageChannel) {
            this._addLog('warn', 'MessageChannel 不可用');
            return;
        }
        if (!this._messageChannel) {
            this._addLog('warn', '请先点击「创建 MessageChannel」');
            return;
        }
        try {
            const payload = { cmd: 'compute', value: Math.floor(Math.random() * 100), ts: Date.now() };
            // port2 绑定 onmessage 接收（模拟 Worker 端收到）
            this._messageChannel.port2.onmessage = (e) => {
                this._addLog('channel', `port2.onmessage 收到（Worker 端）：${JSON.stringify(e.data)}`);
            };
            this._messageChannel.port1.postMessage(payload);
            this.setState({ channelInfo: `主线程 → port1.postMessage(payload)：\n` +
                    `  payload = ${JSON.stringify(payload)}\n` +
                    '  port2.onmessage 已绑定（模拟 Worker 端接收）\n' +
                    '  消息已发送，查看事件日志中 port2.onmessage 的接收记录\n\n' +
                    '说明：port1.postMessage 发出的消息由 port2 接收（双向通道的两端）。' });
            this._addLog('channel', `port1.postMessage 发送：${JSON.stringify(payload)}`);
        }
        catch (err) {
            this._addLog('warn', `port1 发送失败：${err.name} - ${err.message}`);
        }
    }
    // 模拟 Worker 端通过 port2 回传（port1 会收到）
    _sendFromPort2() {
        const caps = this._caps();
        if (!caps.messageChannel) {
            this._addLog('warn', 'MessageChannel 不可用');
            return;
        }
        if (!this._messageChannel) {
            this._addLog('warn', '请先点击「创建 MessageChannel」');
            return;
        }
        try {
            const result = { ok: true, result: Math.floor(Math.random() * 1000), ts: Date.now() };
            this._messageChannel.port2.postMessage(result);
            this.setState({ channelInfo: `Worker 端 → port2.postMessage(result)（模拟回传）：\n` +
                    `  result = ${JSON.stringify(result)}\n` +
                    '  port1.onmessage 已绑定（创建时绑定），将收到此消息\n' +
                    '  查看事件日志中 port1.onmessage 的接收记录\n\n' +
                    '说明：这就是双向通信——port1 与 port2 互为收发端，不依赖 Worker.onmessage。' });
            this._addLog('channel', `port2.postMessage 回传：${JSON.stringify(result)}`);
        }
        catch (err) {
            this._addLog('warn', `port2 发送失败：${err.name} - ${err.message}`);
        }
    }
    // 关闭 MessageChannel（释放两个 port）
    _closeMessageChannel() {
        if (!this._messageChannel) {
            this._addLog('warn', '无 MessageChannel 可关闭');
            return;
        }
        try {
            this._messageChannel.port1.close();
            this._messageChannel.port2.close();
            this._addLog('channel', '已关闭 port1 / port2，MessageChannel 释放');
            this.setState({ channelInfo: 'MessageChannel 已关闭（port1.close() / port2.close()）。重新点击「创建 MessageChannel」可重建。' });
        }
        catch (err) {
            this._addLog('warn', `关闭 MessageChannel 失败：${err.name} - ${err.message}`);
        }
        this._messageChannel = null;
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '4. MessageChannel 双向通信',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.messageChannel ? 'success' : 'error' }, caps.messageChannel ? 'MessageChannel ✓' : '不可用'), h(Tag, { color: 'primary' }, 'port1 / port2')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new MessageChannel() 创建双向通信管道 { port1, port2 }：port1.postMessage(msg) 由 port2.onmessage 收到，反之亦然。可把 port2 转移给 Worker（worker.postMessage({ port: channel.port2 }, [channel.port2])），建立不依赖 worker.onmessage 的双向通道。port.start() 显式启动消息队列（设置 onmessage 时自动 start）；port.close() 关闭；port.onmessageerror 反序列化失败。MessageChannel 在 Node / jsdom 中真实可用。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('创建 MessageChannel', { type: 'primary', size: 'sm', disabled: !caps.messageChannel, onClick: () => this._createMessageChannel() }), this._btn('port1 发送', { size: 'sm', disabled: !caps.messageChannel, onClick: () => this._sendFromPort1() }), this._btn('port2 回传', { size: 'sm', disabled: !caps.messageChannel, onClick: () => this._sendFromPort2() }), this._btn('关闭 channel', { danger: true, size: 'sm', disabled: !caps.messageChannel, onClick: () => this._closeMessageChannel() })),
                h('div', { class: 'fs-sm text-secondary' }, 'MessageChannel 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.channelInfo || '（点击「创建 MessageChannel」开始双向通信演示）')),
                h(Alert, {
                    type: 'info',
                    message: 'MessageChannel 是不依赖 Worker.onmessage 的双向通道',
                    description: '把 port2 转移给 Worker 后，主线程的 port1 与 Worker 的 port2 构成独立双向通道，可与 worker.onmessage 并存，适合多通道并行通信。设置 onmessage 会自动 start()；未设置时需显式 port.start() 否则消息不入队。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：BroadcastChannel 广播 ===================
    // 创建两个同名 BroadcastChannel，演示互通
    _createBroadcast() {
        const caps = this._caps();
        if (!caps.broadcastChannel) {
            this.setState({ broadcastInfo: 'BroadcastChannel 用法（测试环境不可用，仅说明）：\n\n' +
                    "// 页面 A / 页面 B / Worker 都可创建同名 channel\n" +
                    "const ch = new BroadcastChannel('app-events');\n" +
                    "ch.onmessage = (e) => console.log('收到广播', e.data);\n" +
                    "ch.postMessage({ type: 'update', data: 42 });\n" +
                    'ch.close();  // 关闭\n\n' +
                    '说明：同名 channel 互通，postMessage 广播给所有同名 channel（除发送者）。\n' +
                    '用途：跨标签页 / 跨 Worker 同步状态（如登录态变更、数据刷新）。' });
            this._addLog('warn', 'BroadcastChannel 不可用（typeof undefined），已记录用法');
            return;
        }
        try {
            // 关闭旧 channel
            for (const ch of this._broadcastChannels) {
                try {
                    ch.close();
                }
                catch { /* noop */ }
            }
            this._broadcastChannels = [];
            // 创建两个同名 channel，模拟"两个页面"
            const chA = new BroadcastChannel('api-lab-test');
            const chB = new BroadcastChannel('api-lab-test');
            let aCount = 0;
            let bCount = 0;
            chA.onmessage = (e) => {
                aCount += 1;
                this._addLog('broadcast', `channel A 收到：${JSON.stringify(e.data)}（第 ${aCount} 条）`);
            };
            chB.onmessage = (e) => {
                bCount += 1;
                this._addLog('broadcast', `channel B 收到：${JSON.stringify(e.data)}（第 ${bCount} 条）`);
            };
            this._broadcastChannels.push(chA, chB);
            this.setState({ broadcastInfo: "已创建两个同名 BroadcastChannel：\n" +
                    "  new BroadcastChannel('api-lab-test') → channel A\n" +
                    "  new BroadcastChannel('api-lab-test') → channel B\n" +
                    '  chA.onmessage / chB.onmessage 已绑定\n\n' +
                    '说明：\n' +
                    '  - 同名 channel 互通（A 与 B 都监听 "api-lab-test"）\n' +
                    '  - A.postMessage 广播给 B（不给自己）；B.postMessage 广播给 A\n' +
                    '  - 跨标签页 / 跨 Worker 同样如此（浏览器内同源）\n\n' +
                    '点击「A 广播」或「B 广播」发送消息，另一端会收到。' });
            this._addLog('broadcast', "已创建 BroadcastChannel A / B（同名 'api-lab-test'）");
        }
        catch (err) {
            this._addLog('warn', `创建 BroadcastChannel 失败：${err.name} - ${err.message}`);
        }
    }
    // 从 channel A 广播消息（B 会收到）
    _broadcastFromA() {
        const caps = this._caps();
        if (!caps.broadcastChannel) {
            this._addLog('warn', 'BroadcastChannel 不可用');
            return;
        }
        if (this._broadcastChannels.length < 2) {
            this._addLog('warn', '请先点击「创建 BroadcastChannel」');
            return;
        }
        try {
            const msg = { from: 'A', type: 'sync', value: Math.floor(Math.random() * 100), ts: Date.now() };
            this._broadcastChannels[0].postMessage(msg);
            this.setState({ broadcastInfo: `channel A 广播：\n  A.postMessage(${JSON.stringify(msg)})\n` +
                    '  channel B 会收到（A 自己不收）\n  查看事件日志中 channel B 的接收记录\n\n' +
                    '说明：postMessage 广播给所有同名 channel（除发送者自己）。' });
            this._addLog('broadcast', `A 广播：${JSON.stringify(msg)}`);
        }
        catch (err) {
            this._addLog('warn', `A 广播失败：${err.name} - ${err.message}`);
        }
    }
    // 从 channel B 广播消息（A 会收到）
    _broadcastFromB() {
        const caps = this._caps();
        if (!caps.broadcastChannel) {
            this._addLog('warn', 'BroadcastChannel 不可用');
            return;
        }
        if (this._broadcastChannels.length < 2) {
            this._addLog('warn', '请先点击「创建 BroadcastChannel」');
            return;
        }
        try {
            const msg = { from: 'B', type: 'notify', value: Math.floor(Math.random() * 100), ts: Date.now() };
            this._broadcastChannels[1].postMessage(msg);
            this.setState({ broadcastInfo: `channel B 广播：\n  B.postMessage(${JSON.stringify(msg)})\n` +
                    '  channel A 会收到（B 自己不收）\n  查看事件日志中 channel A 的接收记录\n\n' +
                    '说明：跨标签页 / 跨 Worker 同理，同名 channel 自动互通。' });
            this._addLog('broadcast', `B 广播：${JSON.stringify(msg)}`);
        }
        catch (err) {
            this._addLog('warn', `B 广播失败：${err.name} - ${err.message}`);
        }
    }
    // 关闭所有 BroadcastChannel
    _closeBroadcast() {
        if (this._broadcastChannels.length === 0) {
            this._addLog('warn', '无 BroadcastChannel 可关闭');
            return;
        }
        const n = this._broadcastChannels.length;
        for (const ch of this._broadcastChannels) {
            try {
                ch.close();
            }
            catch { /* noop */ }
        }
        this._broadcastChannels = [];
        this._addLog('broadcast', `已关闭 ${n} 个 BroadcastChannel`);
        this.setState({ broadcastInfo: `已关闭 ${n} 个 BroadcastChannel（channel.close()）。重新点击「创建 BroadcastChannel」可重建。` });
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '5. BroadcastChannel 广播',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.broadcastChannel ? 'success' : 'error' }, caps.broadcastChannel ? 'BroadcastChannel ✓' : '不可用'), h(Tag, { color: 'primary' }, '跨页面 / 跨 Worker')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new BroadcastChannel(name) 创建同名广播通道：同名的所有 channel（跨标签页 / 跨 Worker / 同源）互通，channel.postMessage(message) 广播给所有同名 channel（除发送者自己），channel.onmessage 接收，channel.close() 关闭。用途：跨标签页同步登录态、数据刷新、通知推送。BroadcastChannel 在 Node 18+ 与 jsdom 中通常可用。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('创建 A/B channel', { type: 'primary', size: 'sm', disabled: !caps.broadcastChannel, onClick: () => this._createBroadcast() }), this._btn('A 广播', { size: 'sm', disabled: !caps.broadcastChannel, onClick: () => this._broadcastFromA() }), this._btn('B 广播', { size: 'sm', disabled: !caps.broadcastChannel, onClick: () => this._broadcastFromB() }), this._btn('关闭所有', { danger: true, size: 'sm', disabled: !caps.broadcastChannel, onClick: () => this._closeBroadcast() })),
                h('div', { class: 'fs-sm text-secondary' }, 'BroadcastChannel 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.broadcastInfo || '（点击「创建 A/B channel」开始广播演示）')),
                h(Alert, {
                    type: 'info',
                    message: 'BroadcastChannel 是跨上下文广播的最简方式',
                    description: '相比 storage event（需 localStorage）或 SharedWorker（需 port 中转），BroadcastChannel 直接 postMessage 广播，语义清晰。但只广播不保证送达顺序与可靠性，适合状态同步而非关键消息。同名 channel 在同源所有标签页 / Worker 间互通。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：Worker 全局对象对比 ===================
    // 检测 self 与 WorkerGlobalScope 相关 API
    _detectWorkerGlobal() {
        this.setState({ globalScopeInfo: 'Worker 全局对象检测（在主线程执行，仅检测 typeof）：\n\n' +
                `  typeof self = ${typeof self}；typeof window = ${typeof window}；typeof document = ${typeof document}\n` +
                `  typeof importScripts = ${typeof importScripts}；typeof caches = ${typeof caches}；typeof (self as any).clients = ${typeof clients}\n` +
                `  typeof DedicatedWorkerGlobalScope = ${typeof DedicatedWorkerGlobalScope}；typeof SharedWorkerGlobalScope = ${typeof SharedWorkerGlobalScope}\n\n` +
                '说明：主线程中 self === window，importScripts / caches / clients 通常 undefined；\n' +
                '  Worker 内 self 指向 WorkerGlobalScope（无 window / document）。' });
        this._addLog('global', `检测：self=${typeof self}, importScripts=${typeof importScripts}, caches=${typeof caches}`);
    }
    // 列出 WorkerGlobalScope 有 / 无的 API
    _listWorkerAPIs() {
        this.setState({ globalScopeInfo: '===== WorkerGlobalScope 全局对象清单 =====\n\n' +
                '【有】Worker 内可用的 API：\n' +
                '  self（WorkerGlobalScope 引用）/ importScripts(urls)（仅 Classic，同步加载）\n' +
                '  location / navigator / setTimeout / setInterval / fetch / Request / Response\n' +
                '  IndexedDB / WebSocket / EventSource / BroadcastChannel / MessageChannel / MessagePort\n' +
                '  Performance API / caches（部分）/ console / atob / btoa / TextEncoder / crypto / WebAssembly\n\n' +
                '【无】Worker 内不可用的 API：\n' +
                '  window / document / parent（主线程独有，Worker 无 DOM 与父窗口）\n' +
                '  localStorage / sessionStorage（用 IndexedDB 替代）\n' +
                '  DOM API（querySelector / createElement）/ UI API（alert / confirm / prompt）\n\n' +
                '【子类型差异】：\n' +
                '  DedicatedWorkerGlobalScope：self.name / self.close() / self.postMessage\n' +
                '  SharedWorkerGlobalScope：onconnect 事件 / self.name / self.close()\n' +
                '  ServiceWorkerGlobalScope：self.caches / self.clients / fetch 事件 / install / activate\n\n' +
                '【caches / clients 说明】：self.caches=Cache API（部分 Worker 可用）；self.clients=仅 ServiceWorkerGlobalScope' });
        this._addLog('global', '已列出 WorkerGlobalScope 有 / 无的 API 清单');
    }
    // 检测主线程 vs Worker 的 self 差异
    _checkSelfContext() {
        try {
            const selfIsWindow = typeof window !== 'undefined' && self === window;
            const selfType = Object.prototype.toString.call(self);
            const inWorker = typeof window === 'undefined' && typeof document === 'undefined';
            this.setState({ globalScopeInfo: 'self 上下文检测：\n\n' +
                    `  self === window = ${selfIsWindow}（主线程为 true，Worker 内为 false）\n` +
                    `  Object.prototype.toString.call(self) = ${selfType}\n` +
                    `  typeof self.document = ${typeof self.document}；typeof self.location = ${typeof self.location}；typeof self.navigator = ${typeof self.navigator}\n\n` +
                    '判断当前是否在 Worker：const inWorker = typeof window === "undefined" && typeof document === "undefined";\n' +
                    `  当前环境 inWorker = ${inWorker}\n\n` +
                    '说明：Worker 内 self 指向 WorkerGlobalScope（无 window / document），主线程 self === window。' });
        }
        catch (err) {
            this._addLog('warn', `self 上下文检测失败：${err.name} - ${err.message}`);
        }
        this._addLog('global', 'self 上下文检测完成');
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. Worker 全局对象对比',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, 'WorkerGlobalScope'), h(Tag, { color: 'warning' }, '有 / 无 API')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'WorkerGlobalScope 是 Worker 的全局作用域：有 self / importScripts / location / navigator / setTimeout / fetch / IndexedDB / WebSocket / BroadcastChannel / Performance API / caches（部分）；无 window / document / parent / localStorage / DOM / UI API。DedicatedWorkerGlobalScope 有 self.name / self.close()；SharedWorkerGlobalScope 有 onconnect / self.close()；ServiceWorkerGlobalScope 有 self.caches / self.clients / fetch 事件。本卡片在主线程检测 typeof 列出差异。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测全局对象', { type: 'primary', size: 'sm', onClick: () => this._detectWorkerGlobal() }), this._btn('列出 API 清单', { size: 'sm', onClick: () => this._listWorkerAPIs() }), this._btn('self 上下文检测', { size: 'sm', onClick: () => this._checkSelfContext() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Worker 全局对象对比：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.globalScopeInfo || '（点击「检测全局对象」或「列出 API 清单」）')),
                h(Alert, {
                    type: 'warning',
                    message: 'Worker 内无 DOM / window / localStorage',
                    description: 'Worker 不能操作 document / window / localStorage / sessionStorage，需用 postMessage 与主线程通信、用 IndexedDB 持久化、用 fetch 网络请求。Dedicated / Shared / Service 三类 Worker 的全局作用域子类各有专属 API（close / onconnect / caches / clients）。',
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
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, 'Worker 与并发通信 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, 'Web Worker 把耗时任务移出主线程避免 UI 卡顿。本页演示 Dedicated / Shared / Module Worker、OffscreenCanvas、MessageChannel、BroadcastChannel 与 WorkerGlobalScope。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=WorkerAdvancedPage.js.map