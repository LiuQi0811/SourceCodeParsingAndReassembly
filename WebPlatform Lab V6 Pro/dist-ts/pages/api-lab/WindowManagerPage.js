// =====================================================================
// WindowManagerPage.js —— Window Management / 多窗口 实验室
// 演示 MDN：
//   1. Window Management API —— window.getScreenDetails() → Promise<ScreenDetails>、
//      ScreenDetails.screens / currentScreen、currentscreenchange / screenschange 事件；
//      ScreenDetailed：label/top/left/width/height/avail*/isPrimary/isInternal/devicePixelRatio；
//      screen.isExtended 免授权检测多屏。
//   2. window.open + 跨窗口 postMessage —— WindowProxy、postMessage(message, targetOrigin)、
//      close()、window.opener / closed / name；message 事件接收回执。
//   3. BroadcastChannel —— new BroadcastChannel(name)、postMessage、onmessage、close；
//      同名频道互相可见，不接收自己发出的消息。
//   4. Page Visibility + Screen Orientation —— document.visibilityState / hidden、
//      visibilitychange 事件、screen.orientation.type / angle。
//   5. 窗口几何控制 —— window.moveTo / moveBy / resizeTo / resizeBy / focus。
//   6. Permission API —— navigator.permissions.query({ name: 'window-management' | 'window-placement' })、
//      PermissionStatus.state / onchange；需安全上下文（isSecureContext）。
// 说明：所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//   jsdom/Node 中 getScreenDetails 与 navigator.permissions 通常不可用，window.open 返回 null，screen.isExtended 为 undefined；BroadcastChannel 不可用时用 mock；moveTo/resizeTo/focus 为 no-op。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// —— BroadcastChannel 不可用时的简易 mock（基于模块级注册表 + setTimeout 异步派发）——
// 模拟同源跨标签页通信：同名 channel 互相可见，且不接收自己发出的消息（符合规范语义）。
const _BC_REGISTRY = new Map(); // name → Set<_MockBroadcastChannel>
class _MockBroadcastChannel {
    name;
    onmessage;
    onmessageerror;
    _closed;
    constructor(name) {
        this.name = String(name);
        this.onmessage = null;
        this.onmessageerror = null;
        this._closed = false;
        if (!_BC_REGISTRY.has(this.name))
            _BC_REGISTRY.set(this.name, new Set());
        _BC_REGISTRY.get(this.name).add(this);
    }
    postMessage(message) {
        if (this._closed)
            return;
        const set = _BC_REGISTRY.get(this.name);
        if (!set)
            return;
        // 结构化克隆（演示 structuredClone，兜底 JSON）
        let cloned;
        try {
            cloned = (typeof structuredClone === 'function') ? structuredClone(message) : JSON.parse(JSON.stringify(message));
        }
        catch {
            cloned = JSON.parse(JSON.stringify(message));
        }
        // 异步派发给同名频道中的其它实例（setTimeout 0 模拟真实异步派发）
        setTimeout(() => {
            const cur = _BC_REGISTRY.get(this.name);
            if (!cur)
                return;
            for (const ch of cur) {
                if (ch === this || ch._closed)
                    continue;
                if (typeof ch.onmessage === 'function') {
                    try {
                        ch.onmessage({ data: cloned, origin: 'mock', target: ch, source: ch });
                    }
                    catch (e) { /* 单个 listener 异常不影响其它 */ }
                }
            }
        }, 0);
    }
    close() {
        this._closed = true;
        this.onmessage = null;
        this.onmessageerror = null;
        const set = _BC_REGISTRY.get(this.name);
        if (set)
            set.delete(this);
    }
}
export class WindowManagerPage extends Page {
    _inited = false;
    _screenDetails;
    _openedWindow;
    _bcRx;
    _bcTx;
    _bcUsedMock;
    _visibilityBound;
    _onCurrentScreenChange;
    _onScreensChange;
    _closed;
    // —— 初始 state ——
    initialState() {
        return {
            // 共享事件日志（所有卡片写入同一面板，最多保留 40 条）
            logs: [],
            // 能力检测摘要（componentDidMount 中填充，渲染时非空才显示 Alert）
            capsSummary: '',
            // Card 1：getScreenDetails / screen 对象信息
            screenDetailsInfo: '',
            // Card 2：window.open + postMessage 状态
            windowOpenInfo: '',
            // Card 3：BroadcastChannel 通信状态
            broadcastInfo: '',
            // Card 4：可见性 / 方向状态
            visibilityInfo: '',
            // Card 5：窗口几何控制结果
            windowControlInfo: '',
            // Card 6：Permission API 查询结果
            permissionInfo: '',
        };
    }
    // —— 生命周期：挂载 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._screenDetails = null; // Card 1：getScreenDetails() 返回的 ScreenDetails
        this._openedWindow = null; // Card 2：window.open() 返回的 WindowProxy（或 mock）
        this._bcRx = null; // Card 3：BroadcastChannel 接收端
        this._bcTx = null; // Card 3：BroadcastChannel 发送端
        this._bcUsedMock = false; // Card 3：是否使用了 mock BroadcastChannel
        this._visibilityBound = false; // Card 4：visibilitychange 监听是否已注册
        this._onCurrentScreenChange = null; // Card 1：ScreenDetails 事件回调
        this._onScreensChange = null; // Card 1：ScreenDetails 事件回调
        // —— 能力检测（绝不抛异常，仅 typeof / in 判定）——
        const caps = this._caps();
        const mark = (b) => (b ? '✓' : '✗');
        const parts = [
            `getScreenDetails ${mark(caps.getScreenDetails)}`, `screen.isExtended ${mark(caps.isExtended)}`,
            `orientation ${mark(caps.orientation)}`, `window.open ${mark(caps.windowOpen)}`,
            `postMessage ${mark(caps.postMessage)}`, `BroadcastChannel ${caps.broadcastChannel ? '✓' : '✗(将用 mock)'}`,
            `visibilityState ${mark(caps.visibility)}`, `moveTo/resizeTo ${mark(caps.moveTo && caps.resizeTo)}`,
            `focus ${mark(caps.focus)}`, `Permissions API ${mark(caps.permissions)}`,
            `isSecureContext ${mark(caps.isSecureContext)}`,
        ];
        const summary = `Window Management / 多窗口 能力检测：${parts.join(' · ')}。\n` +
            `当前环境（jsdom/Node）中 window.getScreenDetails 与 navigator.permissions 通常不可用，` +
            `window.open 返回 null（无真实窗口），screen.isExtended 为 undefined；` +
            `BroadcastChannel ${caps.broadcastChannel ? '真实可用' : '不可用，已用 mock 演示'}；` +
            `window.moveTo/resizeTo/focus 为 no-op 函数（存在但不改变窗口几何）。所有按钮点击均做 typeof 守卫，不可用时仅记日志说明。`;
        this.setState({ capsSummary: summary });
        this._addLog('info', `能力检测：${parts.join('，')}`);
        if (!caps.getScreenDetails)
            this._addLog('warn', 'window.getScreenDetails 不可用（需 Window Management API + 用户授权 + 安全上下文）');
        if (!caps.isExtended)
            this._addLog('warn', 'screen.isExtended 不可用（jsdom 中为 undefined，浏览器中需多屏环境）');
        if (!caps.orientation)
            this._addLog('warn', 'screen.orientation 不可用（jsdom 未实现）');
        if (!caps.broadcastChannel)
            this._addLog('warn', 'BroadcastChannel 不可用，将使用 mock 实现演示跨标签通信');
        if (!caps.permissions)
            this._addLog('warn', 'navigator.permissions 不可用（jsdom 未实现 Permissions API）');
        if (!caps.isSecureContext)
            this._addLog('warn', 'window.isSecureContext 非 true（Window Management / 窗口放置 API 要求安全上下文）');
        // 注册 window 'message' 事件监听（Card 2 跨窗口 postMessage 接收端）
        // 仅处理带 from:'wm-demo-child' 标记的演示消息，避免与其它消息混淆
        if (caps.postMessage && typeof window.addEventListener === 'function') {
            this.on(window, 'message', (ev) => {
                const data = ev && ev.data;
                if (!data || typeof data !== 'object')
                    return;
                if (data.from !== 'wm-demo-child')
                    return;
                this._addLog('recv', `opener 收到子窗 message 事件：data=${JSON.stringify(data)}，origin=${ev.origin || '(空)'}`);
            });
        }
    }
    // —— 生命周期：卸载 ——
    // 释放 ScreenDetails 事件、关闭子窗、关闭 BroadcastChannel；
    // visibilitychange / message 监听由 Component._eventBindings 自动解绑。
    componentWillUnmount() {
        if (this._screenDetails && typeof this._screenDetails.removeEventListener === 'function') {
            try {
                this._screenDetails.removeEventListener('currentscreenchange', this._onCurrentScreenChange);
            }
            catch { /* noop */ }
            try {
                this._screenDetails.removeEventListener('screenschange', this._onScreensChange);
            }
            catch { /* noop */ }
        }
        this._screenDetails = null;
        if (this._openedWindow && !this._openedWindow.closed && typeof this._openedWindow.close === 'function') {
            try {
                this._openedWindow.close();
            }
            catch { /* noop */ }
        }
        this._openedWindow = null;
        if (this._bcRx) {
            try {
                this._bcRx.close();
            }
            catch { /* noop */ }
            this._bcRx = null;
        }
        if (this._bcTx) {
            try {
                this._bcTx.close();
            }
            catch { /* noop */ }
            this._bcTx = null;
        }
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
        const hasWin = typeof window !== 'undefined';
        const hasDoc = typeof document !== 'undefined';
        const hasScreen = typeof screen !== 'undefined';
        return {
            getScreenDetails: hasWin && typeof window.getScreenDetails === 'function',
            isExtended: hasScreen && 'isExtended' in screen,
            orientation: hasScreen && screen.orientation != null,
            windowOpen: hasWin && typeof window.open === 'function',
            postMessage: hasWin && typeof window.postMessage === 'function',
            broadcastChannel: typeof BroadcastChannel !== 'undefined',
            visibility: hasDoc && 'visibilityState' in document,
            moveTo: hasWin && typeof window.moveTo === 'function',
            resizeTo: hasWin && typeof window.resizeTo === 'function',
            focus: hasWin && typeof window.focus === 'function',
            permissions: typeof navigator !== 'undefined' && !!navigator.permissions && typeof navigator.permissions.query === 'function',
            isSecureContext: hasWin && window.isSecureContext === true,
        };
    }
    // =================== Card 1：Window Management API · getScreenDetails ===================
    // window.getScreenDetails() → Promise<ScreenDetails>（需 permission: 'window-management'）
    async _getScreenDetails() {
        if (typeof window === 'undefined' || typeof window.getScreenDetails !== 'function') {
            this._addLog('warn', 'window.getScreenDetails 不可用（需 Window Management API + 用户授权）');
            this.setState({
                screenDetailsInfo: `window.getScreenDetails 不可用。\n` +
                    `在真实浏览器中：需 HTTPS 安全上下文 + 用户授权 window-management 权限。\n` +
                    `授权后 getScreenDetails() 返回 Promise<ScreenDetails>：\n` +
                    `  • .screens → ScreenDetailed[]（所有屏幕）   • .currentScreen → 当前屏幕\n` +
                    `  • .addEventListener('currentscreenchange' / 'screenschange', cb)\n` +
                    `ScreenDetailed 属性：label / top / left / width / height / availLeft / availTop / availWidth / availHeight / isPrimary / isInternal / devicePixelRatio`,
            });
            return;
        }
        try {
            this._addLog('info', '调用 window.getScreenDetails()…');
            const details = await window.getScreenDetails(); // → ScreenDetails
            this._screenDetails = details;
            // 注册事件（componentWillUnmount 中移除）
            this._onCurrentScreenChange = () => this._addLog('event', 'ScreenDetails currentscreenchange 触发（当前屏幕变化）');
            this._onScreensChange = () => this._addLog('event', 'ScreenDetails screenschange 触发（屏幕集合增删）');
            details.addEventListener('currentscreenchange', this._onCurrentScreenChange);
            details.addEventListener('screenschange', this._onScreensChange);
            // 枚举所有屏幕
            const screens = Array.from(details.screens);
            const lines = screens.map((s, i) => `[${i}] label="${s.label}"  ${s.width}×${s.height} @ (${s.left}, ${s.top})` +
                `  avail=${s.availWidth}×${s.availHeight}  dpr=${s.devicePixelRatio}` +
                `  isPrimary=${s.isPrimary}  isInternal=${s.isInternal}` +
                (s === details.currentScreen ? '  ← currentScreen' : ''));
            this.setState({
                screenDetailsInfo: `window.getScreenDetails() → ScreenDetails ✓\n` +
                    `screens.length = ${screens.length}   currentScreen.label = "${details.currentScreen.label}"\n\n` +
                    lines.join('\n') +
                    `\n\n已注册 currentscreenchange / screenschange 事件监听。`,
            });
            this._addLog('info', `getScreenDetails 成功：共 ${screens.length} 块屏幕，当前="${details.currentScreen.label}"`);
        }
        catch (err) {
            this._addLog('warn', `getScreenDetails 失败：${err.name} - ${err.message}（可能未授权或非安全上下文）`);
            this.setState({
                screenDetailsInfo: `getScreenDetails 失败：${err.name} - ${err.message}\n` +
                    `常见原因：用户未授权 window-management 权限 / 非安全上下文（http）/ 浏览器不支持。`,
            });
        }
    }
    // 查询当前 screen 对象（jsdom 中可用，作为 getScreenDetails 不可用时的回退演示）
    _queryScreenObject() {
        if (typeof screen === 'undefined') {
            this._addLog('warn', 'screen 对象不可用');
            return;
        }
        try {
            const s = screen;
            const isExt = s.isExtended; // jsdom 中 undefined
            const ori = s.orientation; // jsdom 中 undefined
            const lines = [
                `screen.width = ${s.width}   screen.height = ${s.height}`,
                `screen.availWidth = ${s.availWidth}   screen.availHeight = ${s.availHeight}`,
                `screen.colorDepth = ${s.colorDepth}   screen.pixelDepth = ${s.pixelDepth}`,
                `screen.isExtended = ${isExt === undefined ? 'undefined（jsdom 未实现；浏览器中需多屏）' : String(isExt)}`,
                `screen.orientation = ${ori ? JSON.stringify({ type: ori.type, angle: ori.angle }) : 'undefined（jsdom 未实现）'}`,
            ];
            this.setState({ screenDetailsInfo: `查询 window.screen 对象（getScreenDetails 不可用时的回退）：\n${lines.join('\n')}` });
            this._addLog('info', `screen 对象：${s.width}×${s.height}，isExtended=${isExt === undefined ? 'undefined' : isExt}，orientation=${ori ? ori.type : 'undefined'}`);
        }
        catch (err) {
            this._addLog('warn', `查询 screen 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. Window Management API · getScreenDetails',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.getScreenDetails ? 'success' : 'error' }, caps.getScreenDetails ? 'getScreenDetails ✓' : '不可用'), h(Tag, { color: caps.isExtended ? 'success' : 'warning' }, caps.isExtended ? 'isExtended ✓' : 'isExtended ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'window.getScreenDetails() → Promise<ScreenDetails>（需用户授权 window-management 权限 + 安全上下文）。ScreenDetails.screens 是 ScreenDetailed[] 数组，ScreenDetails.currentScreen 指向当前屏幕；ScreenDetailed 暴露 label / top / left / width / height / availLeft / availTop / availWidth / availHeight / isPrimary / isInternal / devicePixelRatio。screen.isExtended（布尔，只读）可免授权检测是否多屏。ScreenDetails 还提供 currentscreenchange / screenschange 事件。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('getScreenDetails()', { type: 'primary', size: 'sm', onClick: () => this._getScreenDetails() }), this._btn('查询 screen 对象', { size: 'sm', onClick: () => this._queryScreenObject() })),
                h('div', { class: 'fs-sm text-secondary' }, '屏幕信息：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.screenDetailsInfo || '（点击「getScreenDetails()」或「查询 screen 对象」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `// 需 HTTPS + 用户授权
if (typeof window.getScreenDetails === 'function') {
  const details = await window.getScreenDetails();
  details.screens.forEach((s) => {
    console.log(s.label, s.width + 'x' + s.height, 'primary=' + s.isPrimary);
  });
  details.addEventListener('screenschange', () => { /* 屏幕增删 */ });
  details.addEventListener('currentscreenchange', () => { /* 当前屏变化 */ });
}
console.log(screen.isExtended); // 是否多屏（免授权）`)),
                h(Alert, {
                    type: 'warning',
                    message: 'getScreenDetails 需要用户授权 + 安全上下文',
                    description: '调用前应先用 navigator.permissions.query({ name: "window-management" }) 查询权限；非安全上下文（http）或未授权时抛 NotAllowedError。jsdom/Node 中均不可用，本页用 screen 对象回退演示。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：window.open + 跨窗口 postMessage ===================
    // window.open(url, name, features) → WindowProxy；jsdom 返回 null，则创建 mock 演示
    _openWindow() {
        if (typeof window === 'undefined' || typeof window.open !== 'function') {
            this._addLog('warn', 'window.open 不可用');
            return;
        }
        try {
            const url = 'about:blank';
            const name = 'wm-demo-child';
            const features = 'width=480,height=320,left=100,top=100';
            let w = null;
            try {
                w = window.open(url, name, features); // jsdom 返回 null（Not implemented: window.open）
            }
            catch (e) {
                this._addLog('warn', `window.open 抛错：${e.message}`);
            }
            if (w && typeof w.postMessage === 'function') {
                // 真实环境：返回子窗 WindowProxy
                this._openedWindow = w;
                this.setState({
                    windowOpenInfo: `window.open('${url}', '${name}', '${features}') → 真实 WindowProxy ✓\n` +
                        `w.closed = ${w.closed}   w.name = ${w.name}   w.opener === window = ${w.opener === window}\n` +
                        `说明：可通过 w.postMessage(msg, targetOrigin) 与子窗通信；w.close() 关闭子窗。`,
                });
                this._addLog('open', 'window.open 成功，返回真实 WindowProxy');
            }
            else {
                // jsdom 返回 null：创建 mock WindowProxy 演示 postMessage 流程
                this._openedWindow = this._makeMockWindow(url, name, features);
                this.setState({
                    windowOpenInfo: `window.open('${url}', '${name}', '${features}') → null（jsdom 无真实窗口）\n` +
                        `已创建 mock WindowProxy 演示 postMessage 跨窗口通信流程。\n` +
                        `mock.closed = ${this._openedWindow.closed}   mock.name = ${this._openedWindow.name}` +
                        `   mock.opener === window = ${this._openedWindow.opener === window}\n` +
                        `说明：真实环境中 window.open 返回子窗 WindowProxy，可双向 postMessage。`,
                });
                this._addLog('open', 'window.open 返回 null（jsdom 无真实窗口），已创建 mock WindowProxy');
            }
        }
        catch (err) {
            this._addLog('warn', `open 失败：${err.name} - ${err.message}`);
        }
    }
    // 构造 mock WindowProxy（jsdom 中 window.open 返回 null 时使用）
    // mock.postMessage(message, targetOrigin) 表示「opener 发消息给子窗」：
    //   子窗收到后回执给 opener（派发 MessageEvent 到 window，触发 message 监听）
    _makeMockWindow(url, name, features) {
        const page = this;
        const opener = (typeof window !== 'undefined') ? window : null;
        const mock = {
            closed: false,
            name: name || 'wm-demo-child',
            opener,
            _url: url || 'about:blank',
            _features: features || '',
            _inbox: [],
            postMessage(message, targetOrigin) {
                if (mock.closed) {
                    page._addLog('warn', 'mock 子窗已 closed，postMessage 无效');
                    return;
                }
                mock._inbox.push({ message, targetOrigin, time: formatTime() });
                page._addLog('send', `opener → 子窗 postMessage(${JSON.stringify(message)}, '${targetOrigin}')`);
                // 模拟子窗收到消息后，异步回执给 opener（派发 MessageEvent）
                setTimeout(() => {
                    if (mock.closed || !opener)
                        return;
                    const reply = { from: 'wm-demo-child', echo: message, t: Date.now() };
                    if (typeof MessageEvent !== 'function') {
                        page._addLog('warn', 'MessageEvent 不可用，无法派发回执');
                        return;
                    }
                    try {
                        const ev = new MessageEvent('message', { data: reply, origin: 'mock-window', source: mock });
                        opener.dispatchEvent(ev);
                    }
                    catch (e) {
                        page._addLog('warn', `mock 回执派发失败：${e.message}`);
                    }
                }, 0);
            },
            close() { mock.closed = true; },
            focus() { page._addLog('focus', 'mock 子窗 focus() 被调用'); },
            blur() { },
        };
        return mock;
    }
    // opener 向子窗 postMessage（子窗 mock 会回执，触发 opener 的 message 事件）
    _postMessageToChild() {
        if (!this._openedWindow) {
            this._addLog('warn', '请先点击「window.open()」');
            return;
        }
        if (this._openedWindow.closed) {
            this._addLog('warn', '子窗已 closed，无法 postMessage');
            return;
        }
        if (typeof this._openedWindow.postMessage !== 'function') {
            this._addLog('warn', '子窗 postMessage 不可用');
            return;
        }
        try {
            const msg = { from: 'opener', greeting: 'hello child', t: Date.now() };
            this._openedWindow.postMessage(msg, '*'); // 真实环境：子窗收到；mock：回执给 opener
            this._addLog('info', `已调用 childWin.postMessage(${JSON.stringify(msg)}, '*')，等待子窗回执…`);
        }
        catch (err) {
            this._addLog('warn', `postMessage 失败：${err.name} - ${err.message}`);
        }
    }
    _closeWindow() {
        if (!this._openedWindow) {
            this._addLog('warn', '请先点击「window.open()」');
            return;
        }
        try {
            const wasClosed = this._openedWindow.closed;
            if (!wasClosed && typeof this._openedWindow.close === 'function') {
                this._openedWindow.close();
            }
            this.setState({
                windowOpenInfo: `childWin.close() 调用完成\n` +
                    `close 前 closed = ${wasClosed}   close 后 closed = ${this._openedWindow.closed}\n` +
                    `说明：window.close() 仅能关闭由 window.open 打开的窗口；已关闭窗口再调用无副作用。`,
            });
            this._addLog('close', `childWin.close()：closed ${wasClosed} → ${this._openedWindow.closed}`);
        }
        catch (err) {
            this._addLog('warn', `close 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. window.open + 跨窗口 postMessage',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.windowOpen ? 'success' : 'error' }, caps.windowOpen ? 'window.open ✓' : '不可用'), h(Tag, { color: caps.postMessage ? 'success' : 'error' }, caps.postMessage ? 'postMessage ✓' : '不可用')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'window.open(url, name, features) → WindowProxy（子窗引用）；childWin.postMessage(message, targetOrigin) 跨窗口通信（targetOrigin 限定来源，"*" 表示任意）；childWin.close() 关闭子窗；window.opener 指向打开者；window.closed 标记是否已关闭；window.name 跨导航保持。jsdom 中 window.open 返回 null（无真实窗口），本页创建 mock WindowProxy 演示 postMessage 双向流程。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('window.open()', { type: 'primary', size: 'sm', disabled: !caps.windowOpen, onClick: () => this._openWindow() }), this._btn('postMessage', { type: 'primary', size: 'sm', disabled: !caps.postMessage, onClick: () => this._postMessageToChild() }), this._btn('close()', { size: 'sm', disabled: !caps.windowOpen, onClick: () => this._closeWindow() })),
                h('div', { class: 'fs-sm text-secondary' }, '窗口通信状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.windowOpenInfo || '（点击「window.open()」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `const child = window.open('child.html', 'demo', 'width=480,height=320');
child.postMessage({ greeting: 'hi' }, 'https://example.com'); // targetOrigin 校验来源
window.addEventListener('message', (ev: any) => {
  if (ev.origin !== 'https://example.com') return;            // 校验来源
  console.log('收到子窗回执:', ev.data);
});
child.close();                                                 // 关闭子窗`)),
                h(Alert, {
                    type: 'warning',
                    message: 'postMessage 必须校验 ev.origin',
                    description: '接收 message 事件时应校验 event.origin 是否为预期来源，避免跨站脚本攻击。targetOrigin 应使用具体源（如 https://example.com）而非 "*"，防止消息泄露给恶意页面。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：BroadcastChannel 跨标签页通信 ===================
    // 返回可用的 BroadcastChannel 构造器（真实优先，不可用则 mock）
    _getBCClass() {
        if (typeof BroadcastChannel !== 'undefined')
            return BroadcastChannel;
        return _MockBroadcastChannel;
    }
    // 创建一对同名频道（接收端 + 发送端），演示跨实例通信
    _createChannels() {
        const BC = this._getBCClass();
        if (!BC) {
            this._addLog('warn', 'BroadcastChannel 不可用且无法 mock');
            return;
        }
        try {
            // 先关闭旧的频道
            if (this._bcRx) {
                try {
                    this._bcRx.close();
                }
                catch { /* noop */ }
            }
            if (this._bcTx) {
                try {
                    this._bcTx.close();
                }
                catch { /* noop */ }
            }
            const channelName = 'wm-bc-demo-' + Date.now();
            this._bcRx = new BC(channelName); // 接收端
            this._bcTx = new BC(channelName); // 发送端（同名）
            this._bcUsedMock = (typeof BroadcastChannel === 'undefined');
            // 接收端 onmessage：收到消息时记日志 + 更新状态
            this._bcRx.onmessage = (ev) => {
                const data = ev && ev.data;
                this._addLog('recv', `BroadcastChannel 收到消息：${JSON.stringify(data)}`);
                this.setState({
                    broadcastInfo: `BroadcastChannel 收到消息 ✓\n` +
                        `channel.name = ${this._bcRx.name}   data = ${JSON.stringify(data)}   接收时间 = ${formatTime()}\n` +
                        `说明：同名频道跨标签页/窗口通信，且不接收自己发出的消息。`,
                });
            };
            this.setState({
                broadcastInfo: `已创建 BroadcastChannel 对（name="${channelName}"）\n` +
                    `接收端 _bcRx + 发送端 _bcTx（同名，互相可见）   实现：${this._bcUsedMock ? 'mock（真实 BroadcastChannel 不可用）' : '真实 BroadcastChannel'}\n` +
                    `说明：点击「postMessage」从 _bcTx 发送，_bcRx.onmessage 将收到（异步）。`,
            });
            this._addLog('info', `创建 BroadcastChannel 对：name="${channelName}"，实现=${this._bcUsedMock ? 'mock' : '原生'}`);
        }
        catch (err) {
            this._addLog('warn', `创建 BroadcastChannel 失败：${err.name} - ${err.message}`);
        }
    }
    // 从发送端 postMessage（接收端 onmessage 异步收到）
    _bcPost() {
        if (!this._bcTx) {
            this._addLog('warn', '请先点击「创建 Channel 对」');
            return;
        }
        try {
            const msg = { from: 'wm-demo-tx', t: Date.now(), n: Math.floor(Math.random() * 1000) };
            this._bcTx.postMessage(msg); // 发送端发出，接收端 onmessage 收到（不回环给自己）
            this._addLog('send', `BroadcastChannel.postMessage(${JSON.stringify(msg)})`);
            this.setState({
                broadcastInfo: (this.state.broadcastInfo || '') +
                    `\n\n已 postMessage：${JSON.stringify(msg)}\n等待 _bcRx.onmessage 接收…`,
            });
        }
        catch (err) {
            this._addLog('warn', `postMessage 失败：${err.name} - ${err.message}`);
        }
    }
    // close() 释放频道
    _bcClose() {
        if (!this._bcRx && !this._bcTx) {
            this._addLog('warn', '尚无 BroadcastChannel 可关闭');
            return;
        }
        try {
            const closedName = this._bcRx ? this._bcRx.name : (this._bcTx ? this._bcTx.name : '(无)');
            if (this._bcRx) {
                this._bcRx.onmessage = null;
                try {
                    this._bcRx.close();
                }
                catch { /* noop */ }
            }
            if (this._bcTx) {
                try {
                    this._bcTx.close();
                }
                catch { /* noop */ }
            }
            this._bcRx = null;
            this._bcTx = null;
            this.setState({
                broadcastInfo: `BroadcastChannel 已 close() 释放 ✓\n` +
                    `关闭的 channel name = ${closedName}\n` +
                    `说明：close() 后不再接收消息；应在不使用时释放以避免内存泄漏。`,
            });
            this._addLog('close', `BroadcastChannel 已 close() 释放`);
        }
        catch (err) {
            this._addLog('warn', `close 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. BroadcastChannel 跨标签页通信',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.broadcastChannel ? 'success' : 'warning' }, caps.broadcastChannel ? '原生 BC ✓' : 'mock BC'), h(Tag, { color: 'primary' }, '同源跨标签页')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new BroadcastChannel(name) 创建同名频道；channel.postMessage(message) 广播给所有同名频道（不包含自己）；channel.onmessage 接收消息；channel.close() 释放。同源的所有标签页/窗口中同名频道互相可见，用于跨标签页状态同步。本页创建一对同名频道（发送端 + 接收端）演示；环境不支持时用 mock 实现（基于模块级注册表 + setTimeout 异步派发）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('创建 Channel 对', { type: 'primary', size: 'sm', onClick: () => this._createChannels() }), this._btn('postMessage', { type: 'primary', size: 'sm', disabled: !this._bcTx, onClick: () => this._bcPost() }), this._btn('close 释放', { size: 'sm', onClick: () => this._bcClose() })),
                h('div', { class: 'fs-sm text-secondary' }, 'BroadcastChannel 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.broadcastInfo || '（点击「创建 Channel 对」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `const bc = new BroadcastChannel('app-sync');
bc.onmessage = (ev) => { console.log('其它标签页发来:', ev.data); };
bc.postMessage({ type: 'tab-updated', t: Date.now() });
// 其它标签页的同名频道收到消息（自己不会收到）
bc.close(); // 不用时释放`)),
                h(Alert, {
                    type: 'info',
                    message: 'BroadcastChannel 不接收自己发出的消息',
                    description: '与 window.postMessage 不同，BroadcastChannel.postMessage 广播给同名频道的其它实例，发送者自身不会收到。因此本演示创建一对同名频道（_bcTx 发送 / _bcRx 接收）以展示通信。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：Page Visibility + Screen Orientation ===================
    // 查询 document.visibilityState / document.hidden
    _queryVisibility() {
        if (typeof document === 'undefined' || !('visibilityState' in document)) {
            this._addLog('warn', 'document.visibilityState 不可用');
            return;
        }
        try {
            const state = document.visibilityState; // 'visible' | 'hidden' | 'prerender' | 'unloaded'
            const hidden = document.hidden;
            this.setState({
                visibilityInfo: `document.visibilityState = "${state}"   document.hidden = ${hidden}\n` +
                    `说明：visibilityState ∈ 'visible' / 'hidden' / 'prerender'；hidden 为布尔简写。` +
                    `切换标签页或最小化窗口时触发 visibilitychange 事件。jsdom 中恒为 'visible'。`,
            });
            this._addLog('info', `可见性：visibilityState="${state}"，hidden=${hidden}`);
        }
        catch (err) {
            this._addLog('warn', `查询可见性失败：${err.name} - ${err.message}`);
        }
    }
    // 查询 screen.orientation.type / angle
    _queryOrientation() {
        if (typeof screen === 'undefined' || !screen.orientation) {
            this._addLog('warn', 'screen.orientation 不可用（jsdom 未实现）');
            this.setState({
                visibilityInfo: (this.state.visibilityInfo ? this.state.visibilityInfo + '\n\n' : '') +
                    `screen.orientation 不可用（jsdom 未实现）。\n` +
                    `真实浏览器中：\n` +
                    `  • type ∈ 'portrait-primary' / 'portrait-secondary' / 'landscape-primary' / 'landscape-secondary'\n` +
                    `  • angle 为旋转角度（0/90/180/270）\n` +
                    `  • lock(type) / unlock() 锁定/解除方向`,
            });
            return;
        }
        try {
            const ori = screen.orientation;
            this.setState({
                visibilityInfo: (this.state.visibilityInfo ? this.state.visibilityInfo + '\n\n' : '') +
                    `screen.orientation.type = "${ori.type}"   angle = ${ori.angle}\n` +
                    `说明：type 区分主/副方向（primary/secondary）；angle 为屏幕旋转角度。`,
            });
            this._addLog('info', `orientation：type="${ori.type}"，angle=${ori.angle}`);
        }
        catch (err) {
            this._addLog('warn', `查询 orientation 失败：${err.name} - ${err.message}`);
        }
    }
    // 注册 visibilitychange 事件监听（通过 this.on 自动管理解绑）
    _bindVisibility() {
        if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
            this._addLog('warn', 'document.addEventListener 不可用');
            return;
        }
        if (this._visibilityBound) {
            this._addLog('warn', 'visibilitychange 监听已注册，请勿重复注册');
            return;
        }
        this._visibilityBound = true;
        this.on(document, 'visibilitychange', () => {
            this._addLog('event', `visibilitychange 触发：visibilityState="${document.visibilityState}"，hidden=${document.hidden}`);
            this.setState({
                visibilityInfo: `visibilitychange 事件触发 ✓\n` +
                    `当前 visibilityState = "${document.visibilityState}"   hidden = ${document.hidden}\n` +
                    `说明：切换标签页/最小化时触发；可在此暂停视频、轮询等后台工作以节省资源。`,
            });
        });
        this.setState({
            visibilityInfo: `已注册 document 'visibilitychange' 事件监听 ✓\n` +
                `当前 visibilityState = "${document.visibilityState}"，hidden = ${document.hidden}\n` +
                `说明：真实浏览器中切换到其它标签页或最小化窗口将触发本监听（jsdom 中无法切换，事件不会触发）。`,
        });
        this._addLog('info', '已注册 visibilitychange 监听（切换标签页时触发）');
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '4. Page Visibility + Screen Orientation',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.visibility ? 'success' : 'error' }, caps.visibility ? 'visibility ✓' : '不可用'), h(Tag, { color: caps.orientation ? 'success' : 'warning' }, caps.orientation ? 'orientation ✓' : 'orientation ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'document.visibilityState（"visible"/"hidden"/"prerender"）与 document.hidden（布尔）反映页面可见性；visibilitychange 事件在切换标签页/最小化时触发，常用于暂停后台轮询、视频播放。screen.orientation.type（portrait-primary/landscape-primary 等）与 angle 反映屏幕方向。jsdom 中 visibilityState 恒为 "visible"，orientation 通常未实现。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('查询可见性', { type: 'primary', size: 'sm', disabled: !caps.visibility, onClick: () => this._queryVisibility() }), this._btn('查询 orientation', { size: 'sm', onClick: () => this._queryOrientation() }), this._btn('监听 visibilitychange', { size: 'sm', disabled: !caps.visibility, onClick: () => this._bindVisibility() })),
                h('div', { class: 'fs-sm text-secondary' }, '可见性 / 方向状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } }, h('code', {}, s.visibilityInfo || '（点击「查询可见性」/「查询 orientation」/「监听 visibilitychange」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pausePolling();          // 页面不可见：暂停后台任务
  } else {
    resumePolling();        // 页面恢复可见：恢复任务
  }
});
console.log(screen.orientation.type);   // 'landscape-primary'`)),
                h(Alert, {
                    type: 'info',
                    message: 'visibilitychange 是省电省流量的关键事件',
                    description: '页面隐藏时暂停视频播放、轮询、动画等可显著降低 CPU/网络/电量消耗。注意 Safari 曾以 webkitvisibilitychange / webkitHidden 为前缀名，现代浏览器已统一为标准名。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：窗口几何控制 ===================
    // 读取当前窗口几何快照（screenX/screenY/outerWidth/outerHeight）
    _windowSnapshot() {
        return {
            screenX: typeof window.screenX !== 'undefined' ? window.screenX : 0,
            screenY: typeof window.screenY !== 'undefined' ? window.screenY : 0,
            outerWidth: typeof window.outerWidth !== 'undefined' ? window.outerWidth : 0,
            outerHeight: typeof window.outerHeight !== 'undefined' ? window.outerHeight : 0,
        };
    }
    // 各操作的参数文本（用于日志展示）
    _opArgs(op) {
        return { moveTo: '100, 100', moveBy: '50, 50', resizeTo: '800, 600', resizeBy: '100, 100', focus: '' }[op] || '';
    }
    // 统一执行窗口几何操作（moveTo / moveBy / resizeTo / resizeBy / focus）
    _doWindowOp(op) {
        if (typeof window === 'undefined') {
            this._addLog('warn', 'window 不可用');
            return;
        }
        if (typeof window[op] !== 'function') {
            this._addLog('warn', `window.${op} 不可用`);
            return;
        }
        try {
            const before = this._windowSnapshot();
            const args = { moveTo: [100, 100], moveBy: [50, 50], resizeTo: [800, 600], resizeBy: [100, 100], focus: [] }[op] || [];
            window[op](...args); // jsdom 中为 no-op（存在但不改变窗口几何）
            const after = this._windowSnapshot();
            const argText = this._opArgs(op);
            this.setState({
                windowControlInfo: `调用 window.${op}(${argText})\n` +
                    `调用前：screenX=${before.screenX}  screenY=${before.screenY}  outer=${before.outerWidth}×${before.outerHeight}\n` +
                    `调用后：screenX=${after.screenX}  screenY=${after.screenY}  outer=${after.outerWidth}×${after.outerHeight}\n` +
                    `说明：jsdom 中 moveTo/moveBy/resizeTo/resizeBy/focus 为 no-op（存在但不改变窗口几何）；真实浏览器中受弹窗策略与安全限制（非 window.open 打开的窗口调用可能被忽略）。`,
            });
            this._addLog('info', `window.${op}(${argText}) 已调用（jsdom 中为 no-op）`);
        }
        catch (err) {
            this._addLog('warn', `window.${op} 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '5. 窗口几何控制 · moveTo / resizeTo / focus',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.moveTo && caps.resizeTo ? 'success' : 'error' }, caps.moveTo && caps.resizeTo ? 'moveTo/resizeTo ✓' : '不可用'), h(Tag, { color: caps.focus ? 'success' : 'error' }, caps.focus ? 'focus ✓' : '不可用')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'window.moveTo(x, y) 移动窗口到绝对坐标；window.moveBy(dx, dy) 相对移动；window.resizeTo(w, h) 设置窗口外尺寸；window.resizeBy(dw, dh) 相对调整尺寸；window.focus() 聚焦窗口；window.blur() 取消聚焦。这些方法受弹窗策略限制（通常仅对 window.open 打开的窗口生效）。jsdom 中均为 no-op 函数（存在但不改变窗口几何），本页记录调用前后 screenX/screenY/outerWidth/outerHeight 以展示无变化。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('moveTo(100,100)', { type: 'primary', size: 'sm', disabled: !caps.moveTo, onClick: () => this._doWindowOp('moveTo') }), this._btn('moveBy(50,50)', { size: 'sm', disabled: !caps.moveTo, onClick: () => this._doWindowOp('moveBy') }), this._btn('resizeTo(800,600)', { type: 'primary', size: 'sm', disabled: !caps.resizeTo, onClick: () => this._doWindowOp('resizeTo') }), this._btn('resizeBy(100,100)', { size: 'sm', disabled: !caps.resizeTo, onClick: () => this._doWindowOp('resizeBy') }), this._btn('focus()', { size: 'sm', disabled: !caps.focus, onClick: () => this._doWindowOp('focus') })),
                h('div', { class: 'fs-sm text-secondary' }, '窗口几何状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } }, h('code', {}, s.windowControlInfo || '（点击上方按钮调用窗口几何 API）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } }, h('code', {}, `// 仅对 window.open 打开的子窗通常有效
const child = window.open('child.html', 'demo', 'width=400,height=300');
child.moveTo(100, 100);      // 移动到绝对坐标
child.moveBy(50, 50);        // 相对移动
child.resizeTo(800, 600);    // 设置外尺寸
child.resizeBy(100, 100);    // 相对调整
child.focus();               // 聚焦子窗`)),
                h(Alert, {
                    type: 'warning',
                    message: '窗口几何方法受弹窗策略限制',
                    description: '浏览器通常仅允许脚本操作由 window.open 打开的窗口的几何属性；对主窗口调用 moveTo/resizeTo 多被忽略或受限。jsdom 中这些方法是 no-op，调用不报错但也不改变窗口状态。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：Permission API · window-management ===================
    // navigator.permissions.query({ name }) → Promise<PermissionStatus>
    async _queryPermission(name) {
        if (typeof navigator === 'undefined' || !navigator.permissions || typeof navigator.permissions.query !== 'function') {
            this._addLog('warn', `navigator.permissions 不可用，无法 query({name:'${name}'})`);
            this.setState({
                permissionInfo: `navigator.permissions 不可用（jsdom 未实现 Permissions API）。\n` +
                    `查询：navigator.permissions.query({ name: '${name}' } as any)\n` +
                    `预期返回：Promise<PermissionStatus>，state ∈ 'granted' / 'denied' / 'prompt'\n` +
                    `说明：真实浏览器中可查询 'window-management'（新名）/ 'window-placement'（旧名）权限状态，PermissionStatus.onchange 在状态变化时触发。`,
            });
            return;
        }
        try {
            this._addLog('info', `navigator.permissions.query({ name: '${name}' } as any)…`);
            const status = await navigator.permissions.query({ name }); // → PermissionStatus
            this.setState({
                permissionInfo: `navigator.permissions.query({ name: '${name}' } as any) → PermissionStatus ✓\n` +
                    `status.state = "${status.state}"   // granted / denied / prompt   已注册 status.onchange\n` +
                    `说明：'granted' 可直接调 getScreenDetails；'prompt' 需用户手势触发授权；'denied' 被拒绝。`,
            });
            status.onchange = () => {
                this._addLog('event', `PermissionStatus onchange：name='${name}'，state="${status.state}"`);
            };
            this._addLog('info', `权限 ${name}：state="${status.state}"`);
        }
        catch (err) {
            this._addLog('warn', `query({name:'${name}'}) 失败：${err.name} - ${err.message}（可能名称不被识别）`);
            this.setState({
                permissionInfo: `navigator.permissions.query({ name: '${name}' } as any) 抛错：${err.name} - ${err.message}\n` +
                    `常见原因：权限名称不被当前浏览器识别（'window-management' 为新名，'window-placement' 为旧名）。`,
            });
        }
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. Permission API · window-management 权限',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.permissions ? 'success' : 'error' }, caps.permissions ? 'Permissions ✓' : '不可用'), h(Tag, { color: caps.isSecureContext ? 'success' : 'warning' }, caps.isSecureContext ? 'Secure ✓' : '非 Secure')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.permissions.query({ name }) → Promise<PermissionStatus>，status.state ∈ granted/denied/prompt。Window Management API 的权限名为 "window-management"（新规范，旧名 "window-placement"）。调用 getScreenDetails 前应先查询权限：prompt 时需用户手势触发授权。PermissionStatus.onchange 在权限状态变化时触发。要求安全上下文（HTTPS / isSecureContext）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn("query('window-management')", { type: 'primary', size: 'sm', onClick: () => this._queryPermission('window-management') }), this._btn("query('window-placement')", { size: 'sm', onClick: () => this._queryPermission('window-placement') })),
                h('div', { class: 'fs-sm text-secondary' }, '权限查询结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } }, h('code', {}, s.permissionInfo || '（点击 query 按钮）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `// 查询 window-management 权限
const status = await navigator.permissions.query({ name: 'window-management' } as any);
if (status.state === 'granted') {
  const details = await window.getScreenDetails();
} else if (status.state === 'prompt') {
  // 需用户手势触发授权
  button.addEventListener('click', () => window.getScreenDetails());
}
status.onchange = () => { console.log('权限变为:', status.state); };`)),
                h(Alert, {
                    type: 'warning',
                    message: 'window-management 为新权限名，window-placement 为旧名',
                    description: '规范演进中权限名从 window-placement 改为 window-management；不同浏览器版本支持不一，建议两者都尝试 query。Permissions API 在 jsdom 中未实现，本页查询会记 warn 并展示预期流程。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), h('pre', { class: 'code-block log-pre', style: { maxHeight: '300px', overflow: 'auto' } }, s.logs.length === 0
            ? h('code', {}, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-line' }, h('span', { class: 'log-time' }, log.time), h('span', { class: `log-tag log-tag-${log.type}` }, log.type), h('span', { class: 'log-content' }, log.content)))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, 'Window Management 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, 'Window Management API / 多窗口 / 屏幕信息 / 跨窗口通信。本页演示 getScreenDetails、window.open + postMessage、BroadcastChannel、Page Visibility、窗口几何控制、Permission API。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=WindowManagerPage.js.map