// =====================================================================
// FetchLaterAPIPage.js —— fetchLater 与可靠上报 实验室
// 演示 MDN：
//   1. fetchLater API —— window.fetchLater(request, options) 返回 FetchLaterResult，
//      options.attemptCount / backgroundTimeout，result.dismiss() / result.state，
//      请求在下一个空闲期或页面卸载时发送（不立即发出）。
//   2. sendBeacon API 深入 —— navigator.sendBeacon(url, data) 返回 boolean，
//      data 支持 ArrayBuffer/ArrayBufferView/Blob/string/URLSearchParams/FormData，
//      ~64KB 限制、仅 POST、无自定义头、无响应，visibilitychange→hidden 为可靠上报时机。
//   3. fetchLater vs sendBeacon vs fetch 对比 —— fetch / fetch+keepalive /
//      sendBeacon / fetchLater 四种方式的差异与决策矩阵。
//   4. Reporting-Endpoints 与报告上报 —— Reporting-Endpoints 响应头、
//      application/reports+json、报告类型（deprecation/intervention/crash/csp-violation/
//      permissions-policy-violation）、NEL 网络错误日志。
//   5. 页面生命周期与可靠上报时机 —— visibilitychange / pagehide / beforeunload /
//      unload 的可靠性对比，bfcache 与 event.persisted，AbortController 中止在途请求。
//   6. 遥测架构与队列管理 —— 采集/批量/序列化/发送/重试/退避/采样完整管线，
//      navigator.storage.estimate 配额、Service Worker sync 保证送达。
// 说明：fetchLater 是 Chrome 123+ 实验性 API，绝大多数环境不可用；
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn'/'info', ...)），
//       绝不抛异常。sendBeacon / AbortController / visibilitychange 在真实浏览器中可用，
//       jsdom 中 sendBeacon / fetchLater 通常 undefined。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class FetchLaterAPIPage extends Page {
    _abortControllers = null;
    _fetchLaterResults = null;
    _inited = false;
    _pagehideHandler = null;
    _telemetryQueue = null;
    _timer = null;
    _visibilityHandler = null;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            fetchLaterInfo: '', // Card 1
            beaconInfo: '', // Card 2
            compareInfo: '', // Card 3
            reportingInfo: '', // Card 4
            lifecycleInfo: '', // Card 5
            telemetryInfo: '', // Card 6
        };
    }
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._abortControllers = new Set(); // 所有活跃 AbortController（在途 fetch 中止）
        this._visibilityHandler = null; // Card 5 visibilitychange 监听器
        this._pagehideHandler = null; // Card 5 pagehide 监听器
        this._fetchLaterResults = []; // Card 1 fetchLater 返回的 FetchLaterResult（用于 dismiss）
        this._telemetryQueue = null; // Card 6 遥测队列实例（演示用）
        // 一次性能力检测：fetchLater / sendBeacon / Reporting-Endpoints / scheduling
        const caps = this._detect();
        const parts = [
            `fetchLater ${caps.fetchLater ? '✓' : '✗'}`,
            `sendBeacon ${caps.sendBeacon ? '✓' : '✗'}`,
            `fetch ${caps.fetch ? '✓' : '✗'}`,
            `AbortController ${caps.abort ? '✓' : '✗'}`,
            `scheduling.isInputPending ${caps.scheduling ? '✓' : '✗'}`,
            `storage.estimate ${caps.storageEstimate ? '✓' : '✗'}`,
            `Reporting-Endpoints ${caps.reporting ? '（响应头机制）' : '✗'}`,
            `visibilitychange ${caps.visibilityState ? '✓' : '✗'}`,
        ];
        const anyAvailable = caps.fetch || caps.sendBeacon || caps.abort || caps.visibilityState;
        const summary = anyAvailable
            ? `fetchLater 与可靠上报能力检测：${parts.join(' · ')}。fetchLater 是 Chrome 123+ 实验性 API（多数环境不可用，需开启实验标志）；sendBeacon / AbortController / visibilitychange 在真实浏览器中可用。jsdom 中 sendBeacon / fetchLater 通常 undefined，相关演示将记录用法说明，绝不抛异常。`
            : `当前环境不支持 fetch / sendBeacon / AbortController / visibilitychange（typeof 均为 "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。`;
        this.setState({ capsSummary: summary });
        this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!caps.fetchLater)
            this._addLog('warn', 'fetchLater 不可用（Chrome 123+ 实验性，需开启实验标志；jsdom 无此 API）');
        if (!caps.sendBeacon)
            this._addLog('warn', 'navigator.sendBeacon 不可用（jsdom 通常无此方法，需真实浏览器）');
        if (!caps.scheduling)
            this._addLog('info', 'navigator.scheduling.isInputPending 不可用（仅 Chromium 系浏览器）');
    }
    componentWillUnmount() {
        // 中止所有进行中的 AbortController（在途 fetch）
        if (this._abortControllers) {
            this._abortControllers.forEach((c) => {
                try {
                    if (c && c.signal && !c.signal.aborted)
                        c.abort('page-unmount');
                }
                catch { /* noop */ }
            });
            try {
                this._abortControllers.clear();
            }
            catch { /* noop */ }
        }
        if (this._visibilityHandler && typeof document !== 'undefined') {
            try {
                document.removeEventListener('visibilitychange', this._visibilityHandler);
            }
            catch { /* noop */ }
        }
        this._visibilityHandler = null;
        if (this._pagehideHandler && typeof window !== 'undefined') {
            try {
                window.removeEventListener('pagehide', this._pagehideHandler);
            }
            catch { /* noop */ }
        }
        this._pagehideHandler = null;
        // dismiss 所有 fetchLater 结果（取消延迟请求）
        if (this._fetchLaterResults) {
            for (const r of this._fetchLaterResults) {
                try {
                    if (r && typeof r.dismiss === 'function')
                        r.dismiss();
                }
                catch { /* noop */ }
            }
            try {
                this._fetchLaterResults.length = 0;
            }
            catch { /* noop */ }
        }
        this._telemetryQueue = null;
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
    // —— 能力 Tag 渲染辅助：items=[{label, ok}] → Tag 节点数组 ——
    _caps(items) {
        return items.map(({ label, ok }) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // —— 能力布尔对象（供逻辑判断，开销可忽略）——
    _detect() {
        const hasNav = typeof navigator !== 'undefined';
        return {
            fetchLater: typeof fetchLater === 'function',
            sendBeacon: hasNav && typeof navigator.sendBeacon === 'function',
            fetch: typeof fetch === 'function',
            abort: typeof AbortController !== 'undefined',
            scheduling: hasNav && typeof navigator.scheduling !== 'undefined'
                && typeof navigator.scheduling.isInputPending === 'function',
            storageEstimate: hasNav && !!navigator.storage && typeof navigator.storage.estimate === 'function',
            reporting: typeof PerformanceObserver !== 'undefined',
            visibilityState: typeof document !== 'undefined' && typeof document.visibilityState !== 'undefined',
        };
    }
    // =================== Card 1：fetchLater API 延迟请求 ===================
    _demoFetchLaterBasic() {
        const caps = this._detect();
        if (!caps.fetchLater) {
            this.setState({ fetchLaterInfo: `fetchLater 用法（当前环境不可用，仅说明）：\n\n// 1. 直接传 URL 字符串\nconst result = window.fetchLater('https://analytics.example/collect', {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ event: "pageview", ts: Date.now() }),\n  attemptCount: 3,           // 失败重试次数（默认 1）\n  backgroundTimeout: 2000,   // 页面卸载后浏览器继续尝试的时长（ms）\n});\n\n// 2. 传 Request 对象（支持完整 fetch 特性）\nconst req = new Request("https://analytics.example/evt", {\n  method: "POST", headers: { "X-Trace": "abc" }, body: JSON.stringify({ type: "click" }),\n});\nconst r2 = fetchLater(req, { attemptCount: 2 });\n\n// FetchLaterResult 接口：\n//   result.state      // "pending" | "finished" | "errored"\n//   result.dismiss()  // 取消该延迟请求（不再发送）\n\n// 关键：请求 NOT 立即发出，而是排队，在下一次空闲期 OR 页面卸载时发送。\n// 与 fetch 区别：fetchLater 不返回 Response（fire-and-forget），能在页面卸载后存活\n//   （backgroundTimeout），适合分析上报。` });
            this._addLog('warn', 'fetchLater 不可用（typeof fetchLater !== "function"），已记录用法说明');
            return;
        }
        try {
            const req = new Request('https://analytics.example/api-lab-fetchlater', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Source': 'api-lab' },
                body: JSON.stringify({ event: 'demo', ts: Date.now(), n: Math.floor(Math.random() * 1000) }),
            });
            const result = window.fetchLater(req, { attemptCount: 2, backgroundTimeout: 2000 });
            this._fetchLaterResults.push(result);
            let stateStr = 'unknown';
            try {
                stateStr = String(result.state);
            }
            catch { /* noop */ }
            const hasDismiss = result && typeof result.dismiss === 'function';
            this.setState({ fetchLaterInfo: `真实调用 fetchLater（当前环境可用）：\n\nconst req = new Request("https://analytics.example/api-lab-fetchlater", {\n  method: "POST", headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ event: "demo", ts: ... })\n});\nconst result = window.fetchLater(req, { attemptCount: 2, backgroundTimeout: 2000 });\n\nFetchLaterResult：\n  result.state = ${stateStr}    // "pending" | "finished" | "errored"\n  result.dismiss = ${hasDismiss ? 'function（可取消）' : '（不可用）'}\n\n说明：请求已排队，将在下一次空闲期或页面卸载时发送（fire-and-forget，无 Response）。` });
            this._addLog('fetchLater', `fetchLater 已调用，result.state=${stateStr}，dismiss=${hasDismiss}`);
        }
        catch (err) {
            this._addLog('warn', `fetchLater 调用失败：${err.name} - ${err.message}`);
        }
    }
    _demoFetchLaterDismiss() {
        const caps = this._detect();
        if (!caps.fetchLater) {
            this.setState({ fetchLaterInfo: `fetchLater dismiss 用法（当前环境不可用，仅说明）：\n\nconst result = fetchLater(url, opts);\nif (result.state === "pending") {\n  result.dismiss();  // 取消该延迟请求，不再发送\n}\n\n使用场景：用户撤销操作后取消对应的上报请求，避免无效流量。` });
            this._addLog('warn', 'fetchLater 不可用，已记录 dismiss 用法说明');
            return;
        }
        try {
            const result = window.fetchLater('https://analytics.example/cancel-test', { attemptCount: 1 });
            this._fetchLaterResults.push(result);
            let before = 'unknown', after = 'unknown';
            try {
                before = String(result.state);
            }
            catch { /* noop */ }
            result.dismiss();
            try {
                after = String(result.state);
            }
            catch { /* noop */ }
            this.setState({ fetchLaterInfo: `fetchLater dismiss 演示：\n\nconst result = fetchLater("https://analytics.example/cancel-test", { attemptCount: 1 });\nresult.state（dismiss 前）= ${before}\nresult.dismiss();  // 取消延迟请求\nresult.state（dismiss 后）= ${after}\n\n说明：dismiss 后该请求不再发送，适合撤销场景（如用户取消操作）。` });
            this._addLog('fetchLater', `dismiss 演示：state ${before} → ${after}`);
        }
        catch (err) {
            this._addLog('warn', `fetchLater dismiss 失败：${err.name} - ${err.message}`);
        }
    }
    _explainFetchLaterVsFetch() {
        this.setState({ fetchLaterInfo: `===== fetchLater vs fetch 核心差异 =====\n\n【fetch(url, init)】\n  - 立即发出请求，返回 Promise<Response>，可读取响应体\n  - 可被 AbortController 中止\n  - 页面卸载后请求被丢弃（除非 keepalive: true）\n\n【fetchLater(request, options)】\n  - 不立即发出，排队到下一次空闲期 OR 页面卸载时发送\n  - 返回 FetchLaterResult（非 Promise），无 Response（fire-and-forget）\n  - FetchLaterResult.state：pending / finished / errored\n  - FetchLaterResult.dismiss() 取消\n  - options.attemptCount：失败重试次数\n  - options.backgroundTimeout：卸载后浏览器继续尝试时长（ms）\n  - 支持完整 Request 特性（headers / method / body）\n  - 体内容量上限大于 sendBeacon（约 64KB 限制）\n\n决策：需要响应 → fetch；分析上报 fire-and-forget → fetchLater；\n      小体积遥测且需最简 API → sendBeacon。` });
        this._addLog('fetchLater', '已展示 fetchLater vs fetch 核心差异说明');
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._detect();
        const card = new Card({
            title: '1. fetchLater API 延迟请求',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'fetchLater', ok: caps.fetchLater },
                { label: 'Request', ok: typeof Request !== 'undefined' },
            ]), h(Tag, { color: 'primary' }, 'FetchLaterResult')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'window.fetchLater(request, options) 返回 FetchLaterResult。request 可为 Request 对象或 URL 字符串；options.attemptCount（默认 1，失败重试次数）、options.backgroundTimeout（ms，页面卸载后浏览器继续尝试时长）。FetchLaterResult.state 为 "pending"|"finished"|"errored"，dismiss() 取消该延迟请求。请求 NOT 立即发出，而是排队在下一次空闲期 OR 页面卸载（pagehide / visibilitychange hidden）时发送。用法：分析 fire-and-forget 上报，像 sendBeacon 但具备完整 fetch 特性（headers / method / body）。fetchLater 不返回 Response，但能在卸载后存活。Chrome 123+ 实验性。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('基本演示', { type: 'primary', size: 'sm', onClick: () => this._demoFetchLaterBasic() }), this._btn('dismiss 取消', { size: 'sm', disabled: !caps.fetchLater, onClick: () => this._demoFetchLaterDismiss() }), this._btn('vs fetch 差异', { size: 'sm', onClick: () => this._explainFetchLaterVsFetch() })),
                h('div', { class: 'fs-sm text-secondary' }, 'fetchLater 状态 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.fetchLaterInfo || '（点击「基本演示」或「vs fetch 差异」）')),
                h(Alert, {
                    type: 'info',
                    message: 'fetchLater 是 fire-and-forget 的延迟请求 API',
                    description: '与 fetch 不同，fetchLater 不返回 Response，请求排队到空闲期或卸载时发送，attemptCount 支持失败重试，backgroundTimeout 让请求在页面卸载后继续存活。适合分析上报，比 sendBeacon 更灵活（完整 Request 特性、更大体量）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：sendBeacon API 深入 ===================
    _demoSendBeacon() {
        const caps = this._detect();
        if (!caps.sendBeacon) {
            this.setState({ beaconInfo: `sendBeacon 用法（当前环境不可用，仅说明）：\n\nconst ok = navigator.sendBeacon(\n  "https://analytics.example/beacon",\n  JSON.stringify({ event: "unload", ts: Date.now() })\n);\n// ok === true 表示已成功加入浏览器发送队列\n// 请求在下一个空闲期 / 页面卸载时发出，survives page close\n\n限制：\n  - 体量 ~64KB（浏览器相关，超出返回 false）\n  - 仅 POST 方法，不能自定义 headers\n  - 无 Response（fire-and-forget）\n  - Content-Type 由 data 类型推断` });
            this._addLog('warn', 'navigator.sendBeacon 不可用（typeof undefined），已记录用法');
            return;
        }
        try {
            const payload = JSON.stringify({ event: 'api-lab-beacon', ts: Date.now(), v: 1 });
            const url = 'https://analytics.example/api-lab-beacon';
            const ok = navigator.sendBeacon(url, payload);
            this.setState({ beaconInfo: `真实调用 sendBeacon：\n\nconst payload = JSON.stringify({ event: "api-lab-beacon", ts: ..., v: 1 });\nconst ok = navigator.sendBeacon("https://analytics.example/api-lab-beacon", payload);\n\n返回值 ok = ${ok}    // true 表示已加入发送队列\npayload 字节大小 = ${payload.length} 字节（远小于 64KB 限制）\n\n说明：sendBeacon 把请求加入浏览器后台队列，在下一个空闲期或页面卸载时发送，\n  survives page close。Content-Type 由 data 类型推断（string→text/plain;charset=UTF-8）。` });
            this._addLog('beacon', `sendBeacon 返回 ${ok}，payload=${payload.length}B`);
        }
        catch (err) {
            this._addLog('warn', `sendBeacon 调用失败：${err.name} - ${err.message}`);
        }
    }
    _demoBeaconDataTypes() {
        const caps = this._detect();
        if (!caps.sendBeacon) {
            this.setState({ beaconInfo: `sendBeacon data 类型支持（当前环境不可用，仅说明）：\n\ndata 可为以下类型，浏览器据此推断 Content-Type：\n  - string           → text/plain;charset=UTF-8\n  - Blob             → blob.type（如 application/json）\n  - ArrayBuffer      → 无 Content-Type（原始字节）\n  - ArrayBufferView  → 无 Content-Type（如 Uint8Array）\n  - URLSearchParams  → application/x-www-form-urlencoded\n  - FormData         → multipart/form-data; boundary=...\n\n示例：\n  sendBeacon(url, JSON.stringify(obj));            // 字符串\n  sendBeacon(url, new Blob([json], { type: "application/json" }));\n  sendBeacon(url, new Uint8Array([1,2,3]));       // 字节\n  sendBeacon(url, new URLSearchParams({ a:1 }));   // 表单\n  sendBeacon(url, formData);                       // multipart` });
            this._addLog('warn', 'sendBeacon 不可用，已记录 data 类型说明');
            return;
        }
        try {
            const url = 'https://analytics.example/api-lab-beacon-types';
            const results = [];
            let ok;
            ok = navigator.sendBeacon(url, 'plain-string');
            results.push(`string → ${ok}`);
            try {
                ok = navigator.sendBeacon(url, new Blob(['{"a":1}'], { type: 'application/json' }));
                results.push(`Blob(application/json) → ${ok}`);
            }
            catch (e) {
                results.push(`Blob → 失败:${e.message}`);
            }
            try {
                ok = navigator.sendBeacon(url, new ArrayBuffer(8));
                results.push(`ArrayBuffer(8) → ${ok}`);
            }
            catch (e) {
                results.push(`ArrayBuffer → 失败:${e.message}`);
            }
            try {
                ok = navigator.sendBeacon(url, new Uint8Array([1, 2, 3, 4]));
                results.push(`Uint8Array → ${ok}`);
            }
            catch (e) {
                results.push(`Uint8Array → 失败:${e.message}`);
            }
            try {
                ok = navigator.sendBeacon(url, new URLSearchParams({ a: '1', b: '2' }));
                results.push(`URLSearchParams → ${ok}`);
            }
            catch (e) {
                results.push(`URLSearchParams → 失败:${e.message}`);
            }
            try {
                const fd = new FormData();
                fd.append('x', '1');
                ok = navigator.sendBeacon(url, fd);
                results.push(`FormData → ${ok}`);
            }
            catch (e) {
                results.push(`FormData → 失败:${e.message}`);
            }
            this.setState({ beaconInfo: `sendBeacon data 类型转换演示：\n\nconst url = "https://analytics.example/api-lab-beacon-types";\n${results.map((r) => '  ' + r).join('\n')}\n\n说明：浏览器据 data 类型推断 Content-Type：\n  string→text/plain;charset=UTF-8；Blob→blob.type；\n  URLSearchParams→application/x-www-form-urlencoded；\n  FormData→multipart/form-data；ArrayBuffer/View→无 Content-Type。` });
            this._addLog('beacon', `data 类型演示完成：${results.join('，')}`);
        }
        catch (err) {
            this._addLog('warn', `sendBeacon data 类型演示失败：${err.name} - ${err.message}`);
        }
    }
    _explainBeaconLimit() {
        this.setState({ beaconInfo: `===== sendBeacon 限制与可靠上报时机 =====\n\n【体量限制】\n  - 单次 beacon 约 64KB（浏览器相关，Chrome 约 64KB）\n  - 超出限制 sendBeacon 返回 false（不发送）\n  - 仅适合小体积遥测，大数据需用 fetch + keepalive 或 fetchLater\n\n【方法/头限制】\n  - 仅 POST 方法，不能自定义 headers\n  - 无 Response（fire-and-forget）\n  - Content-Type 由 data 类型推断\n\n【可靠上报时机】\n  - visibilitychange → document.visibilityState === "hidden" 是 RELIABLE 信号\n    （用户切标签页 / 最小化 / 导航离开都会触发，移动端尤其可靠）\n  - pagehide 已被废弃用于此目的（且影响 bfcache）\n  - beforeunload 在移动端不可靠\n  - unload 已废弃、不可靠、且会阻止 bfcache\n\n【发送时机】\n  - sendBeacon 把请求加入浏览器后台队列\n  - 在下一个空闲期或页面卸载时发出\n  - survives page close（即使页面关闭也会尽力发送）` });
        this._addLog('beacon', '已展示 sendBeacon 64KB 限制与可靠上报时机说明');
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._detect();
        const card = new Card({
            title: '2. sendBeacon API 深入',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'sendBeacon', ok: caps.sendBeacon },
            ]), h(Tag, { color: 'warning' }, '~64KB / POST only')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.sendBeacon(url, data) 返回 boolean（true 表示已成功加入浏览器发送队列）。data 可为 ArrayBuffer / ArrayBufferView / Blob / string / URLSearchParams / FormData，浏览器据此推断 Content-Type。限制：单次约 64KB（浏览器相关，超出返回 false）、仅 POST、无自定义 headers、无 Response。请求在下一个空闲期或页面卸载时发出，survives page close。visibilitychange → document.visibilityState === "hidden" 是 RELIABLE 上报时机（pagehide 已废弃用于此目的，且影响 bfcache）。sendBeacon 适合小体积遥测。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('发送 JSON beacon', { type: 'primary', size: 'sm', disabled: !caps.sendBeacon, onClick: () => this._demoSendBeacon() }), this._btn('data 类型演示', { size: 'sm', disabled: !caps.sendBeacon, onClick: () => this._demoBeaconDataTypes() }), this._btn('64KB 限制说明', { size: 'sm', onClick: () => this._explainBeaconLimit() })),
                h('div', { class: 'fs-sm text-secondary' }, 'sendBeacon 状态 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.beaconInfo || '（点击「发送 JSON beacon」或「64KB 限制说明」）')),
                h(Alert, {
                    type: 'warning',
                    message: 'sendBeacon 仅适合小体积遥测',
                    description: '64KB 体量限制、仅 POST、无自定义 headers、无 Response。大数据上报需用 fetch + keepalive 或 fetchLater。可靠上报时机是 visibilitychange → hidden，而非 pagehide / unload（后者影响 bfcache）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：fetchLater vs sendBeacon vs fetch 对比 ===================
    _showCompareTable() {
        this.setState({ compareInfo: `===== fetch / fetch+keepalive / sendBeacon / fetchLater 对比 =====\n\n1) fetch(url, init)\n   - 时机：立即发出\n   - 请求：完整 Request（method/headers/body）\n   - 响应：返回 Promise<Response>，可读取响应体\n   - 中止：可被 AbortController 中止\n   - 卸载存活：否（页面卸载后请求被丢弃，除非 keepalive）\n   - 体量：无特殊限制\n\n2) fetch(url, { keepalive: true })\n   - 时机：立即发出\n   - 请求：完整 Request（像 sendBeacon 但有完整 fetch 特性）\n   - 响应：返回 Promise<Response>（但卸载后可能无法读取）\n   - 中止：可被 AbortController 中止\n   - 卸载存活：是（survives page unload）\n   - 体量：~64KB body 限制\n\n3) sendBeacon(url, data)\n   - 时机：排队到空闲期 / 卸载时发出\n   - 请求：仅 POST，无自定义 headers（最简 API）\n   - 响应：无（fire-and-forget）\n   - 中止：不可中止\n   - 卸载存活：是（survives page close）\n   - 体量：~64KB 限制\n\n4) fetchLater(request, options)\n   - 时机：排队到下一次空闲期 OR 卸载时发送（延迟）\n   - 请求：完整 Request 特性（headers / method / body）\n   - 响应：无（fire-and-forget），返回 FetchLaterResult\n   - 中止：FetchLaterResult.dismiss() 取消\n   - 重试：options.attemptCount 失败重试\n   - 卸载存活：是（options.backgroundTimeout 控制卸载后尝试时长）\n   - 体量：上限最大（大于 sendBeacon 的 64KB）\n\n===== 决策矩阵 =====\n  分析上报（fire-and-forget）        → fetchLater（首选，支持重试与完整头）\n  小体积遥测（最简 API）            → sendBeacon\n  需要响应                          → fetch\n  需要响应 + 卸载存活               → fetch + keepalive\n  需要失败重试 / 延迟发送           → fetchLater（attemptCount）` });
        this._addLog('compare', '已展示 fetch / keepalive / sendBeacon / fetchLater 四方式对比表');
    }
    _demoAllFour() {
        const caps = this._detect();
        const payload = { event: 'click', target: '#btn', ts: Date.now() };
        const url = 'https://analytics.example/collect';
        const lines = [
            '同一条分析 payload 的四种发送方式：',
            '',
            `payload = ${JSON.stringify(payload)}`,
            `url = ${url}`,
            '',
            '1) fetch（需响应、不卸载存活）：',
        ];
        if (caps.fetch) {
            lines.push('   fetch(url, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) })');
            lines.push('   // 返回 Promise<Response>，可 resp.json()');
        }
        else {
            lines.push('   // fetch 不可用');
        }
        lines.push('2) fetch + keepalive（需响应、卸载存活、~64KB）：');
        if (caps.fetch) {
            lines.push('   fetch(url, { method:"POST", keepalive:true, headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) })');
            lines.push('   // keepalive:true 让请求在卸载后继续，但 body ~64KB 限制');
        }
        else {
            lines.push('   // fetch 不可用');
        }
        lines.push('3) sendBeacon（fire-and-forget、仅 POST、~64KB）：');
        if (caps.sendBeacon) {
            lines.push('   navigator.sendBeacon(url, JSON.stringify(payload));  // 返回 boolean');
        }
        else {
            lines.push('   // sendBeacon 不可用');
        }
        lines.push('4) fetchLater（延迟、fire-and-forget、可重试、体量最大）：');
        if (caps.fetchLater) {
            lines.push('   const r = fetchLater(new Request(url, { method:"POST", body: JSON.stringify(payload) }), { attemptCount: 3 });');
            lines.push('   // r.state / r.dismiss()');
        }
        else {
            lines.push('   // fetchLater 不可用（Chrome 123+ 实验性）');
        }
        lines.push('');
        lines.push('差异要点：');
        lines.push('  - fetch / keepalive 返回 Response，sendBeacon / fetchLater 不返回');
        lines.push('  - sendBeacon 仅 POST 无 headers；fetch / keepalive / fetchLater 支持完整 Request');
        lines.push('  - fetchLater 延迟发送（空闲期 / 卸载），其余三者立即发出');
        lines.push('  - fetchLater 独有 attemptCount 重试与 dismiss 取消');
        this.setState({ compareInfo: lines.join('\n') });
        this._addLog('compare', `四方式演示：fetch=${caps.fetch}, sendBeacon=${caps.sendBeacon}, fetchLater=${caps.fetchLater}`);
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._detect();
        const card = new Card({
            title: '3. fetchLater vs sendBeacon vs fetch 对比',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'fetch', ok: caps.fetch },
                { label: 'sendBeacon', ok: caps.sendBeacon },
                { label: 'fetchLater', ok: caps.fetchLater },
            ]), h(Tag, { color: 'primary' }, '决策矩阵')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '四种发送方式对比：1) fetch 立即发出、完整 Request/Response、可中止、卸载后丢弃（除非 keepalive）；2) fetch(url, { keepalive: true }) 像 sendBeacon 但有完整 fetch 特性、~64KB body 限制、卸载存活；3) sendBeacon fire-and-forget、仅 POST、无 headers、~64KB、卸载存活、最简 API；4) fetchLater 延迟（空闲期/卸载）、完整 Request 特性、attemptCount 重试、backgroundTimeout、FetchLaterResult.dismiss()、体量上限最大。决策：分析上报→fetchLater，小遥测→sendBeacon，需响应→fetch，需响应+卸载存活→fetch+keepalive。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('对比表', { type: 'primary', size: 'sm', onClick: () => this._showCompareTable() }), this._btn('四方式演示', { size: 'sm', onClick: () => this._demoAllFour() })),
                h('div', { class: 'fs-sm text-secondary' }, '对比 / 决策矩阵：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.compareInfo || '（点击「对比表」或「四方式演示」）')),
                h(Alert, {
                    type: 'info',
                    message: 'fetchLater 综合能力最强，sendBeacon 最简',
                    description: 'fetchLater 兼具完整 Request 特性、延迟发送、失败重试、卸载存活与大体量；sendBeacon API 最简但限制最多（仅 POST、无 headers、64KB）；fetch + keepalive 适合需要响应且卸载存活的场景。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：Reporting-Endpoints 与报告上报 ===================
    _buildReportingHeader() {
        const endpoints = {
            default: 'https://report.example.com/default',
            'csp-endpoint': 'https://report.example.com/csp',
            deprecation: 'https://report.example.com/dep',
            intervention: 'https://report.example.com/int',
            crash: 'https://report.example.com/crash',
        };
        const headerValue = Object.entries(endpoints).map(([name, url]) => `${name}="${url}"`).join(', ');
        this.setState({ reportingInfo: `===== Reporting-Endpoints 响应头 =====\n\nHTTP 响应头语法（命名端点 → URL）：\n  Reporting-Endpoints: default="https://report.example.com/default", \\\n    csp-endpoint="https://report.example.com/csp", \\\n    deprecation="https://report.example.com/dep"\n\n构造示例（本演示）：\n  Reporting-Endpoints: ${headerValue}\n\n说明：\n  - 由被上报页面所在的 HTTP 响应设置（不是 JS 设置）\n  - 每个命名端点独立接收报告，POST + Content-Type: application/reports+json\n  - 浏览器批量上报（攒一批再发，降低请求次数）\n  - 报告 body 含 { type, url, user_agent, body, age }` });
        this._addLog('reporting', `构造 Reporting-Endpoints 头值（${Object.keys(endpoints).length} 个命名端点）`);
    }
    _showSampleReport() {
        const sampleDep = {
            type: 'deprecation', url: 'https://app.example.com/feature', user_agent: 'Mozilla/5.0 ...',
            body: { id: 'DeprecatedInterface', message: 'The deprecated interface was used.',
                source_file: 'https://app.example.com/app.js', line_number: 42, column_number: 11 },
            age: 137,
        };
        const sampleCsp = {
            type: 'csp-violation', url: 'https://app.example.com/', user_agent: 'Mozilla/5.0 ...',
            body: { documentURL: 'https://app.example.com/', violatedDirective: 'script-src-elem',
                effectiveDirective: 'script-src-elem', originalPolicy: "default-src 'self'",
                blockedURL: 'https://evil.example/evil.js', lineNumber: 12, columnNumber: 1, statusCode: 200 },
            age: 5,
        };
        this.setState({ reportingInfo: `===== 报告类型与示例 JSON =====\n\n报告类型（type 字段）：\n  - deprecation                 使用了已废弃 API\n  - intervention                浏览器介入干预\n  - crash                       页面崩溃\n  - csp-violation               内容安全策略违规\n  - permissions-policy-violation 权限策略违规\n\n报告统一字段：{ type, url, user_agent, body, age }\n  age = 报告生成到上报之间的毫秒数（浏览器批量延迟）\n\n示例 1：deprecation 报告\n${JSON.stringify(sampleDep, null, 2)}\n\n示例 2：csp-violation 报告\n${JSON.stringify(sampleCsp, null, 2)}\n\n端点接收：POST https://report.example.com/dep\n  Content-Type: application/reports+json\n  Body: [report1, report2, ...]   // 数组，浏览器批量` });
        this._addLog('reporting', '已展示报告类型与 deprecation / csp-violation 示例 JSON');
    }
    _explainNEL() {
        this.setState({ reportingInfo: `===== NEL（Network Error Logging）=====\n\nNEL 响应头（与 Reporting-Endpoints 配合）：\n  NEL: { "report_to": "default", "max_age": 86400 }\n\n字段说明：\n  - report_to：指定 Reporting-Endpoints 中的命名端点名\n  - max_age：策略有效期（秒，示例 86400 = 1 天）\n  - 可选：include_subdomains（子域名也上报）、success_fraction（成功请求采样率）\n         failure_fraction（失败请求采样率）\n\n记录的网络错误类型（报告 body.type = "network-error"）：\n  - dns.address_unreachable      DNS 不可达\n  - tcp.timed_out                TCP 连接超时\n  - tls.protocol_error           TLS 协议错误\n  - http.protocol.error          HTTP 协议错误\n  - http.response.invalid        响应无效\n  - http.response.redirect_loop  重定向循环\n\n工作流程：\n  1. 页面响应携带 NEL + Reporting-Endpoints 头\n  2. 浏览器缓存 NEL 策略（max_age 期内有效）\n  3. 后续对该源的请求若发生网络错误，浏览器上报到指定端点\n  4. 端点 POST application/reports+json 接收\n\n与 Reporting-Endpoints 区别：NEL 专注网络层错误（DNS/TLS/连接），\n  Reporting-Endpoints 专注页面行为报告（deprecation/csp 等）。` });
        this._addLog('reporting', '已展示 NEL 网络错误日志机制说明');
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._detect();
        const card = new Card({
            title: '4. Reporting-Endpoints 与报告上报',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'PerformanceObserver', ok: caps.reporting },
            ]), h(Tag, { color: 'primary' }, 'reports+json'), h(Tag, { color: 'warning' }, 'NEL')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'HTTP 响应头 Reporting-Endpoints: default="https://report.example", csp-endpoint="https://csp.example", deprecation="https://dep.example" 定义命名端点。每个命名端点以 POST + Content-Type: application/reports+json 接收报告，body 为报告数组。报告统一字段 { type, url, user_agent, body, age }，type 包含 deprecation（已废弃 API）、intervention（浏览器介入）、crash（崩溃）、csp-violation（CSP 违规）、permissions-policy-violation（权限策略违规）。NEL 头 NEL: { "report_to": "default", "max_age": 86400 } 记录网络错误（DNS/TLS/连接）到端点。端点由被上报页面的响应头设置，浏览器批量上报。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('构造头值', { type: 'primary', size: 'sm', onClick: () => this._buildReportingHeader() }), this._btn('示例报告 JSON', { size: 'sm', onClick: () => this._showSampleReport() }), this._btn('NEL 机制', { size: 'sm', onClick: () => this._explainNEL() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Reporting-Endpoints / NEL 说明：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.reportingInfo || '（点击「构造头值」或「示例报告 JSON」）')),
                h(Alert, {
                    type: 'info',
                    message: 'Reporting-Endpoints 由响应头设置，浏览器批量上报',
                    description: '端点不能通过 JS 设置，由被上报页面的 HTTP 响应头定义。浏览器攒一批报告后 POST 到端点（application/reports+json），age 字段记录延迟。NEL 专注网络层错误，与 Reporting-Endpoints 配合使用。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：页面生命周期与可靠上报时机 ===================
    _registerVisibility() {
        const caps = this._detect();
        if (!caps.visibilityState) {
            this.setState({ lifecycleInfo: `visibilitychange 监听用法（当前环境不可用，仅说明）：\n\ndocument.addEventListener("visibilitychange", () => {\n  if (document.visibilityState === "hidden") {\n    // ★ 最可靠的上报时机：在此 flush 所有排队遥测\n    navigator.sendBeacon(url, JSON.stringify(queue));\n    // 或 fetchLater(req) / fetch(url, { keepalive: true })\n  }\n});\n\n说明：visibilityState 可为 "visible" | "hidden"。\n  "hidden" 在用户切标签页 / 最小化 / 导航离开时触发，移动端尤其可靠。` });
            this._addLog('warn', 'document.visibilityState 不可用（jsdom 通常无此属性）');
            return;
        }
        if (this._visibilityHandler) {
            try {
                document.removeEventListener('visibilitychange', this._visibilityHandler);
            }
            catch { /* noop */ }
        }
        let transitions = 0;
        this._visibilityHandler = () => {
            transitions += 1;
            const state = document.visibilityState;
            this._addLog('lifecycle', `visibilitychange → visibilityState="${state}"（第 ${transitions} 次转换）`);
            if (state === 'hidden') {
                this._addLog('lifecycle', '★ 可靠上报时机：visibilityState=hidden，应 flush 队列遥测');
            }
        };
        try {
            document.addEventListener('visibilitychange', this._visibilityHandler);
            this.setState({ lifecycleInfo: `已注册 visibilitychange 监听：\n\ndocument.addEventListener("visibilitychange", handler);\n  handler: () => {\n    const state = document.visibilityState;  // "visible" | "hidden"\n    console.log(state);\n    if (state === "hidden") { /* flush 遥测 */ }\n  }\n\n当前 visibilityState = ${document.visibilityState}\n\n说明：切换标签页 / 最小化窗口 / 导航离开会触发 hidden，\n  这是移动端与桌面端都可靠的上报时机。\n  事件日志将记录每次状态转换。` });
            this._addLog('lifecycle', `visibilitychange 监听已注册，当前 visibilityState="${document.visibilityState}"`);
        }
        catch (err) {
            this._addLog('warn', `注册 visibilitychange 失败：${err.name} - ${err.message}`);
        }
    }
    _registerPagehide() {
        if (typeof window === 'undefined') {
            this._addLog('warn', 'window 不可用，无法注册 pagehide');
            return;
        }
        if (this._pagehideHandler) {
            try {
                window.removeEventListener('pagehide', this._pagehideHandler);
            }
            catch { /* noop */ }
        }
        this._pagehideHandler = (event) => {
            const persisted = event && typeof event.persisted === 'boolean' ? event.persisted : 'unknown';
            this._addLog('lifecycle', `pagehide 触发：event.persisted=${persisted}（${persisted === true ? '从 bfcache 恢复' : persisted === false ? '正常卸载' : '未知'}）`);
        };
        try {
            window.addEventListener('pagehide', this._pagehideHandler);
            this.setState({ lifecycleInfo: `已注册 pagehide 监听：\n\nwindow.addEventListener("pagehide", (event: any) => {\n  if (event.persisted) {\n    // 页面进入 bfcache，稍后可能从 bfcache 恢复（不真正卸载）\n  } else {\n    // 正常卸载，可做最后清理 / 上报\n  }\n});\n\n说明：pagehide 在页面被卸载时触发，event.persisted 检测是否进入 bfcache。\n  persisted=true 表示页面进入 bfcache（可能恢复），不应做不可逆清理。\n  persisted=false 表示真正卸载。\n\n注意：pagehide 已不建议用于 sendBeacon 上报（用 visibilitychange→hidden 替代），\n  但 event.persisted 仍是检测 bfcache 的关键。` });
            this._addLog('lifecycle', 'pagehide 监听已注册（事件触发时记录 persisted）');
        }
        catch (err) {
            this._addLog('warn', `注册 pagehide 失败：${err.name} - ${err.message}`);
        }
    }
    _showFlushPattern() {
        const caps = this._detect();
        this.setState({ lifecycleInfo: `===== 可靠上报时机信号链 =====\n\n1) visibilitychange → hidden（最可靠）\n   - 用户切标签页 / 最小化 / 导航离开都触发\n   - 移动端尤其可靠（后台切换 / 系统回收）\n   - ★ 这是 flush 队列遥测的最佳时机\n\n2) pagehide（页面卸载中）\n   - 用 event.persisted 检测 bfcache\n   - persisted=true 表示进 bfcache（可能恢复）\n\n3) beforeunload（移动端不可靠，可能不触发）\n   - 不建议依赖\n\n4) unload（已废弃、不可靠、且阻止 bfcache）\n   - ★ 不要用 unload 上报\n\n===== flush 模式 =====\n\nconst queue = [];\ndocument.addEventListener("visibilitychange", () => {\n  if (document.visibilityState === "hidden") {\n    // flush 所有排队遥测\n    navigator.sendBeacon(url, JSON.stringify(queue));\n    queue.length = 0;\n  }\n});\n\n// 在途 fetch 用 AbortController 在 visibilitychange hidden 时中止\nconst ctrl = new AbortController();\nfetch(url, { signal: ctrl.signal });\ndocument.addEventListener("visibilitychange", () => {\n  if (document.visibilityState === "hidden") ctrl.abort("page-hidden");\n});\n\n// navigator.scheduling.isInputPending() 检测是否安全发送（${caps.scheduling ? '当前可用' : '当前不可用，仅 Chromium 系'}）\nif (navigator.scheduling && !navigator.scheduling.isInputPending()) {\n  // 当前无待处理输入事件，可安全发送\n}\n\n===== 为何不用 unload =====\n  - unload 在移动端不可靠（可能不触发）\n  - 注册 unload 监听会阻止页面进入 bfcache（后退/前进缓存）\n  - 现代浏览器正逐步废弃 unload\n  - 用 visibilitychange → hidden + pagehide 替代` });
        this._addLog('lifecycle', `已展示可靠 flush 模式（scheduling.isInputPending=${caps.scheduling}）`);
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._detect();
        const card = new Card({
            title: '5. 页面生命周期与可靠上报时机',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'visibilitychange', ok: caps.visibilityState },
                { label: 'AbortController', ok: caps.abort },
                { label: 'isInputPending', ok: caps.scheduling },
            ]), h(Tag, { color: 'primary' }, 'bfcache')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '可靠遥测信号链：1) visibilitychange → hidden（用户切标签页 / 最小化 / 导航离开，移动端尤其可靠，★ 最佳 flush 时机）；2) pagehide（页面卸载中，用 event.persisted 检测 bfcache）；3) beforeunload（移动端不可靠）；4) unload（已废弃、不可靠、且阻止 bfcache）。模式：visibilitychange → hidden 时用 fetchLater / sendBeacon flush 所有排队遥测；在途 fetch 用 AbortController 中止。navigator.scheduling.isInputPending() 检测是否安全发送。不要用 unload（破坏 bfcache）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('注册 visibilitychange', { type: 'primary', size: 'sm', disabled: !caps.visibilityState, onClick: () => this._registerVisibility() }), this._btn('注册 pagehide', { size: 'sm', onClick: () => this._registerPagehide() }), this._btn('flush 模式 / unload', { size: 'sm', onClick: () => this._showFlushPattern() })),
                h('div', { class: 'fs-sm text-secondary' }, '生命周期 / 上报时机：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.lifecycleInfo || '（点击「注册 visibilitychange」或「flush 模式」）')),
                h(Alert, {
                    type: 'warning',
                    message: '不要用 unload 事件上报',
                    description: 'unload 在移动端不可靠、注册它会阻止 bfcache（后退/前进缓存），现代浏览器正逐步废弃。用 visibilitychange → hidden 作为 flush 时机，pagehide + event.persisted 检测 bfcache。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：遥测架构与队列管理 ===================
    _buildTelemetryQueue() {
        const caps = this._detect();
        this.setState({ telemetryInfo: `===== 完整遥测管线 TelemetryQueue =====\n\n管线：采集 → 批量 → 序列化 → 发送 → 重试 → 退避 → 采样\n\nclass TelemetryQueue {\n  constructor(url, opts = {}) {\n    this.url = url;\n    this.queue = [];                          // 1) 采集：内存数组\n    this.maxBatch = opts.maxBatch || 10;       // 批量阈值（条数）\n    this.flushInterval = opts.flushInterval || 5000; // 批量阈值（ms）\n    this.attemptCount = opts.attemptCount || 3;\n    this.sampleRate = opts.sampleRate || 1;    // 7) 采样率（0~1）\n    this.retries = 0;\n    this._timer = setInterval(() => this.flush(), this.flushInterval);\n    // visibilitychange hidden 时 flush（可靠时机）\n    document.addEventListener("visibilitychange", () => {\n      if (document.visibilityState === "hidden") this.flush();\n    });\n  }\n  push(event) {                              // 采集\n    if (Math.random() > this.sampleRate) return;  // 7) 采样\n    this.queue.push({ ...event, ts: Date.now() });\n    if (this.queue.length >= this.maxBatch) this.flush();  // 2) 批量\n  }\n  async flush() {                            // 3) 序列化 + 4) 发送\n    if (!this.queue.length) return;\n    const batch = this.queue.splice(0, this.queue.length);\n    const body = JSON.stringify(batch);       // 3) 序列化\n    try {\n      // 4) 发送：fetchLater 优先 / sendBeacon（小）/ fetch+keepalive（需响应）\n      if (typeof fetchLater === "function") {\n        fetchLater(new Request(this.url, { method:"POST",\n          headers:{"Content-Type":"application/json"}, body }),\n          { attemptCount: this.attemptCount });  // 5) 重试\n      } else if (navigator.sendBeacon) {\n        if (!navigator.sendBeacon(this.url, body)) throw new Error("beacon full");\n      } else {\n        await fetch(this.url, { method:"POST", keepalive:true,\n          headers:{"Content-Type":"application/json"}, body });\n      }\n      this.retries = 0;\n    } catch (e: any) {\n      // 5) 重试 + 6) 指数退避\n      this.queue.unshift(...batch);            // 失败重新入队\n      this.retries++;\n      const delay = Math.min(30000, 1000 * 2 ** this.retries); // 指数退避\n      setTimeout(() => this.flush(), delay);\n    }\n  }\n}\n\n===== 持久化与保证送达 =====\n  // navigator.storage.estimate() 检查配额，决定是否本地持久化\n  const est = await navigator.storage.estimate();\n  // 当前环境 storage.estimate ${caps.storageEstimate ? '可用' : '不可用'}\n  if (est.usage / est.quota < 0.9) { /* 可本地缓存待发队列 */ }\n\n  // Service Worker sync 事件保证送达（需 SW）\n  // SW 内：self.addEventListener("sync", (e: any) => { if (e.tag === "telemetry") flushAll(); });\n  // 主线程：registration.sync.register("telemetry");\n\n===== 采样策略 =====\n  - 高频事件（如鼠标移动）：sampleRate = 0.1（仅采 10%）\n  - 关键事件（如错误）：sampleRate = 1（全采）\n  - 可按事件类型动态调整 sampleRate` });
        this._addLog('telemetry', '已展示完整 TelemetryQueue 类代码（采集/批量/序列化/发送/重试/退避/采样）');
    }
    _demoBatchSend() {
        const caps = this._detect();
        const events = [
            { type: 'click', target: '#btn1', ts: Date.now() },
            { type: 'click', target: '#btn2', ts: Date.now() + 1 },
            { type: 'error', msg: 'TypeError: x is undefined', ts: Date.now() + 2 },
            { type: 'timing', dns: 12, tcp: 5, ttfb: 80, ts: Date.now() + 3 },
        ];
        const url = 'https://analytics.example/batch';
        const body = JSON.stringify(events);
        const lines = [
            '模拟批量发送演示：',
            '',
            `url = ${url}`,
            `事件数 = ${events.length}（click×2 / error×1 / timing×1）`,
            `序列化后 body = ${body.length} 字节`,
            '',
            '选择发送方式：',
        ];
        if (caps.fetchLater) {
            lines.push('  → fetchLater(new Request(url, { method:"POST", body }), { attemptCount: 3 })');
            try {
                const r = fetchLater(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }), { attemptCount: 3 });
                this._fetchLaterResults.push(r);
                lines.push(`    已调用，result.state = ${r.state}`);
            }
            catch (e) {
                lines.push(`    调用异常：${e.message}`);
            }
        }
        else if (caps.sendBeacon) {
            lines.push('  → navigator.sendBeacon(url, body)');
            try {
                const ok = navigator.sendBeacon(url, body);
                lines.push(`    返回 ${ok}`);
            }
            catch (e) {
                lines.push(`    异常：${e.message}`);
            }
        }
        else if (caps.fetch) {
            lines.push('  → fetch(url, { method:"POST", keepalive:true, body })');
            lines.push('    （jsdom fetch 为 mock，不真实发送）');
        }
        else {
            lines.push('  → 所有发送 API 不可用，仅记录批量 payload');
        }
        lines.push('');
        lines.push('批量策略说明：');
        lines.push('  - flush 时机：达到 maxBatch 条 / 每 flushInterval ms / visibilitychange hidden');
        lines.push('  - 失败重试：fetchLater attemptCount 自动重试；其它方式重新入队 + 指数退避');
        lines.push('  - 采样：高频事件采 10%，关键事件全采');
        lines.push(`  - 当前环境能力：fetchLater=${caps.fetchLater}, sendBeacon=${caps.sendBeacon}, fetch=${caps.fetch}`);
        this.setState({ telemetryInfo: lines.join('\n') });
        this._addLog('telemetry', `批量发送演示：${events.length} 事件 / ${body.length}B（fetchLater=${caps.fetchLater}, sendBeacon=${caps.sendBeacon}）`);
    }
    _showAggregate() {
        const caps = this._detect();
        const items = [
            ['fetchLater', caps.fetchLater],
            ['sendBeacon', caps.sendBeacon],
            ['fetch', caps.fetch],
            ['AbortController', caps.abort],
            ['fetch keepalive', caps.fetch],
            ['Reporting-Endpoints', caps.reporting],
            ['visibilitychange', caps.visibilityState],
            ['bfcache(pagehide.persisted)', typeof window !== 'undefined'],
            ['scheduling.isInputPending', caps.scheduling],
            ['storage.estimate', caps.storageEstimate],
        ];
        this.setState({ telemetryInfo: `===== 遥测架构聚合能力检测 =====\n\n${items.map((([n, ok]) => `  ${n.padEnd(32)} ${ok ? '✓ 可用' : '✗ 不可用'}`)).join('\n')}\n\n===== 推荐架构（按可用能力组合）=====\n\n1) 采集层：内存数组收集事件（click/error/timing）\n2) 批量层：maxBatch 条 / flushInterval ms / visibilitychange hidden 触发 flush\n3) 发送层（按优先级）：\n   ${caps.fetchLater ? '✓' : '✗'} fetchLater（首选，支持重试 + 完整 Request + 大体量）\n   ${caps.sendBeacon ? '✓' : '✗'} sendBeacon（小体积遥测，~64KB）\n   ${caps.fetch ? '✓' : '✗'} fetch + keepalive（需响应且卸载存活）\n4) 持久化层：navigator.storage.estimate() 检查配额，本地缓存待发队列\n5) 保证送达：Service Worker sync 事件（网络恢复后重发）\n6) 可靠时机：visibilitychange → hidden（不用 unload）\n7) 中止在途：AbortController 在 hidden 时中止未完成 fetch` });
        this._addLog('telemetry', `聚合检测：${items.map((([n, ok]) => `${n}:${ok ? '✓' : '✗'}`)).join('，')}`);
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._detect();
        const card = new Card({
            title: '6. 遥测架构与队列管理',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'fetchLater', ok: caps.fetchLater },
                { label: 'sendBeacon', ok: caps.sendBeacon },
                { label: 'storage.estimate', ok: caps.storageEstimate },
            ]), h(Tag, { color: 'primary' }, '管线')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '完整遥测管线：1) 采集（内存数组收集 click/error/timing）；2) 批量（每 N 条 OR 每 M 秒 OR visibilitychange hidden 触发 flush）；3) 序列化（JSON.stringify）；4) 发送（fetchLater 优先 / sendBeacon 小 / fetch+keepalive 需响应）；5) 重试（fetchLater attemptCount 或失败重新入队）；6) 退避（指数退避）；7) 采样（高频事件采 10%）。navigator.storage.estimate() 检查配额做持久化；Service Worker sync 事件保证送达（Background Sync）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('TelemetryQueue 代码', { type: 'primary', size: 'sm', onClick: () => this._buildTelemetryQueue() }), this._btn('批量发送演示', { size: 'sm', onClick: () => this._demoBatchSend() }), this._btn('聚合能力检测', { size: 'sm', onClick: () => this._showAggregate() })),
                h('div', { class: 'fs-sm text-secondary' }, '遥测架构 / 队列管理：'),
                h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } }, h('code', {}, s.telemetryInfo || '（点击「TelemetryQueue 代码」或「批量发送演示」）')),
                h(Alert, {
                    type: 'info',
                    message: 'fetchLater 优先 + sendBeacon 兜底 + SW sync 保证送达',
                    description: '现代遥测架构按能力分级发送：fetchLater（重试 + 大体量 + 完整头）首选，sendBeacon 兜底小体积，fetch+keepalive 处理需响应场景。配合 visibilitychange→hidden 可靠时机、AbortController 中止在途、storage.estimate 持久化、SW sync 保证送达，构成完整可靠上报体系。',
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
        return h('div', { class: 'api-lab-page fetch-later-api-page' }, h('h2', { class: 'section-title' }, 'fetchLater 与可靠上报 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, 'fetchLater 是 Chrome 123+ 实验性延迟请求 API，配合 sendBeacon / fetch+keepalive / Reporting-Endpoints / visibilitychange 构成完整可靠上报体系。本页演示 fetchLater、sendBeacon 深入、四方式对比、Reporting-Endpoints、生命周期时机与遥测队列架构。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=FetchLaterAPIPage.js.map