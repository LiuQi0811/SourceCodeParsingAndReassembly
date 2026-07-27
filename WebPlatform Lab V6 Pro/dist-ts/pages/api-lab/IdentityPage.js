// =====================================================================
// IdentityPage.ts —— 身份认证与支付 API 实验室
// 演示 MDN：
//   1. Credential Management API          —— navigator.credentials
//        PasswordCredential / FederatedCredential / OTPCredential
//        get / create / store / preventSilentAccess，mediation 取值
//   2. WebAuthn (Web Authentication) API  —— PublicKeyCredential
//        create({publicKey}) 注册 / get({publicKey}) 认证
//        isUserVerifyingPlatformAuthenticatorAvailable / isConditionalMediationAvailable
//   3. Payment Request API                —— new PaymentRequest / show / canMakePayment
//        methodData / details / options / PaymentAddress / PaymentMethodChangeEvent
//   4. Presentation API + Idle Detection API
//        PresentationRequest / PresentationConnection / navigator.presentation
//        IdleDetector / requestPermission / start / userState / screenState
//   5. Local Font Access API + FedCM (Federated Credential Management)
//        window.queryLocalFonts / FontData
//        navigator.credentials.get({identity}) / IdentityCredential / IdentityProviderConfig
// 说明：以上 API 多数较新且要求安全上下文（HTTPS/localhost）与用户手势；
//       jsdom 等运行时通常不可用。所有调用前必须 typeof / in 检测，
//       不可用时记日志说明，不抛异常。WebAuthn / Payment 等敏感操作仅演示
//       API 调用流程，由用户点击触发，失败时在 try/catch 中记日志。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// WebAuthn 公钥算法参数：ES256（COSE -7）与 RS256（COSE -257）
const PUB_KEY_CRED_PARAMS = [
    { type: 'public-key', alg: -7 }, // ES256, ECDSA w/ SHA-256
    { type: 'public-key', alg: -257 }, // RS256, RSASSA-PKCS1-v1_5 w/ SHA-256
];
// Credential Management API 中 mediation 的全部取值
const MEDIATION_VALUES = ['silent', 'optional', 'conditional', 'required'];
// 安全生成随机字节（兼容 crypto 不可用的环境，返回 Uint8Array）
function _randomBytes(len) {
    const buf = new Uint8Array(len);
    try {
        if (globalThis.crypto?.getRandomValues) {
            globalThis.crypto.getRandomValues(buf);
        }
        else {
            for (let i = 0; i < len; i++)
                buf[i] = Math.floor(Math.random() * 256);
        }
    }
    catch {
        for (let i = 0; i < len; i++)
            buf[i] = Math.floor(Math.random() * 256);
    }
    return buf;
}
// 生成 nonce 字符串（兼容 crypto.randomUUID 不可用的环境）
function _genNonce() {
    try {
        if (globalThis.crypto?.randomUUID)
            return globalThis.crypto.randomUUID();
    }
    catch { /* fallthrough */ }
    return 'nonce-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
export class IdentityPage extends Page {
    _inited = false;
    _presentationConnection = null;
    _idleDetector = null;
    _idleChangeHandler = null;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            // Card 1: Credential Management
            credSupportedTypes: [],
            credPreventSilentResult: '—',
            credStoreResult: '—',
            // Card 2: WebAuthn
            webauthnPlatformAuth: null,
            webauthnConditionalMed: null,
            webauthnOptionsPreview: null,
            // Card 3: Payment Request
            paymentCanMake: null,
            paymentPreview: null,
            paymentShowResult: '—',
            // Card 4: Presentation + Idle Detection
            presentationRequestPreview: null,
            idlePermission: 'unknown',
            idleRunning: false,
            idleUserState: '—',
            idleScreenState: '—',
            // Card 5: Local Font + FedCM
            localFonts: [],
            localFontsLoading: false,
            fedcmPreview: null,
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ CRITICAL 守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 仅做一次性能力检测汇总（写日志，不触发额外 setState）
        this._logCapabilitySummary();
    }
    componentWillUnmount() {
        this._destroyed = true;
        // 1. 停止 IdleDetector 并解绑 change 监听
        this._stopIdleDetector(true);
        // 2. 断开 PresentationConnection 并清理事件回调
        this._disconnectPresentation(true);
    }
    // —— 日志辅助（最多保留 40 条，与项目其它页一致）——
    _addLog(type, content) {
        this.setState({
            logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
        });
    }
    // —— 按钮辅助（统一注册子组件，便于销毁）——
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    // —— 同步能力检测（render 时调用，开销可忽略；保证 Tag/Alert 实时反映支持情况）——
    _caps() {
        const nav = typeof navigator !== 'undefined' ? navigator : {};
        const win = typeof window !== 'undefined' ? window : {};
        return {
            credentials: 'credentials' in nav,
            passwordCredential: 'PasswordCredential' in win,
            federatedCredential: 'FederatedCredential' in win,
            otpCredential: 'OTPCredential' in win,
            publicKeyCredential: typeof win.PublicKeyCredential !== 'undefined',
            paymentRequest: typeof win.PaymentRequest !== 'undefined',
            presentation: 'presentation' in nav,
            idleDetector: typeof win.IdleDetector !== 'undefined',
            queryLocalFonts: typeof win.queryLocalFonts === 'function',
            identityCredential: 'IdentityCredential' in win,
        };
    }
    _capTag(ok) {
        return ok
            ? h(Tag, { color: 'success' }, '支持')
            : h(Tag, { color: 'error' }, '不支持');
    }
    // 键值行（label + value）
    _kvRow(label, value) {
        const text = value == null ? 'N/A' : String(value);
        return h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm text-secondary', style: { minWidth: '180px' } }, label), h('span', { class: 'fs-sm fw-medium', style: { wordBreak: 'break-all' } }, text));
    }
    // 子区块标题
    _subSection(title, ...children) {
        return h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, title), ...children);
    }
    // 把对象渲染为代码块（处理 Uint8Array → base64 摘要）
    _jsonBlock(obj) {
        if (!obj)
            return h('div', { class: 'fs-sm text-tertiary' }, '（未构造）');
        try {
            const replacer = (_key, value) => {
                if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
                    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
                    let bin = '';
                    for (let i = 0; i < bytes.length; i++)
                        bin += String.fromCharCode(bytes[i]);
                    const b64 = typeof btoa === 'function' ? btoa(bin) : `[${bytes.length} bytes]`;
                    return { __type: 'Uint8Array', length: bytes.length, base64: b64.slice(0, 32) + (b64.length > 32 ? '…' : '') };
                }
                return value;
            };
            const text = JSON.stringify(obj, replacer, 2);
            return h('pre', { class: 'code-block', html: text });
        }
        catch (err) {
            return h('div', { class: 'fs-sm text-tertiary' }, `（序列化失败：${errInfo(err).message}）`);
        }
    }
    _logCapabilitySummary() {
        const c = this._caps();
        const parts = [
            `credentials:${c.credentials ? '✓' : '✗'}`,
            `PasswordCredential:${c.passwordCredential ? '✓' : '✗'}`,
            `FederatedCredential:${c.federatedCredential ? '✓' : '✗'}`,
            `OTPCredential:${c.otpCredential ? '✓' : '✗'}`,
            `PublicKeyCredential:${c.publicKeyCredential ? '✓' : '✗'}`,
            `PaymentRequest:${c.paymentRequest ? '✓' : '✗'}`,
            `presentation:${c.presentation ? '✓' : '✗'}`,
            `IdleDetector:${c.idleDetector ? '✓' : '✗'}`,
            `queryLocalFonts:${c.queryLocalFonts ? '✓' : '✗'}`,
            `IdentityCredential:${c.identityCredential ? '✓' : '✗'}`,
        ];
        this._addLog('cap', `能力检测汇总：${parts.join('  ')}`);
    }
    // ============ Card 1: Credential Management API ============
    // 检测 navigator.credentials 与各 Credential 子类是否可用
    _detectCredentialTypes() {
        const win = typeof window !== 'undefined' ? window : {};
        const types = [];
        if ('PasswordCredential' in win)
            types.push('PasswordCredential');
        if ('FederatedCredential' in win)
            types.push('FederatedCredential');
        if ('OTPCredential' in win)
            types.push('OTPCredential');
        this.setState({ credSupportedTypes: types });
        this._addLog('cred', `支持的凭据类型：${types.length ? types.join(' / ') : '（无）'}`);
        if (!('credentials' in navigator)) {
            this._addLog('err', 'navigator.credentials 不可用，无法演示 get/create/store/preventSilentAccess');
        }
        else {
            this._addLog('cred', `mediation 取值：${MEDIATION_VALUES.join(' / ')}`);
        }
    }
    // 演示 preventSilentAccess()：阻止后续自动登录
    async _preventSilentAccess() {
        if (!('credentials' in navigator)) {
            this._addLog('err', 'navigator.credentials 不可用，无法调用 preventSilentAccess()');
            return;
        }
        try {
            this._addLog('cred', '调用 navigator.credentials.preventSilentAccess() ...');
            await navigator.credentials.preventSilentAccess();
            this.setState({ credPreventSilentResult: '已调用（下次 get() 需用户手势）' });
            this._addLog('cred', 'preventSilentAccess() 完成 —— 后续 get() 不会自动登录');
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `preventSilentAccess 失败：${info.name} — ${info.message}`);
            this.setState({ credPreventSilentResult: `失败：${info.name}` });
        }
    }
    // 演示创建 PasswordCredential 并调用 store()
    async _createAndStorePasswordCredential() {
        if (!('credentials' in navigator)) {
            this._addLog('err', 'navigator.credentials 不可用');
            return;
        }
        if (typeof PasswordCredential === 'undefined') {
            this._addLog('err', 'PasswordCredential 构造器不可用');
            return;
        }
        try {
            // PasswordCredential 接受 { id, password } 字面量或 HTMLFormElement
            const fakeForm = {
                id: 'demo-user@lab.local',
                password: 'lab-' + Math.random().toString(36).slice(2, 10),
            };
            this._addLog('cred', `构造 PasswordCredential(id=${fakeForm.id})`);
            const cred = new PasswordCredential(fakeForm);
            this._addLog('cred', '调用 navigator.credentials.store(cred) ...（浏览器可能弹确认）');
            await navigator.credentials.store(cred);
            this.setState({ credStoreResult: '已存储' });
            this._addLog('cred', 'store() 完成 —— 凭据已交给浏览器保管');
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `PasswordCredential 创建/存储失败：${info.name} — ${info.message}`);
            this.setState({ credStoreResult: `失败：${info.name}` });
        }
    }
    // ============ Card 2: WebAuthn (Web Authentication API) ============
    // 检测平台认证器（TouchID / WindowsHello / 安全密钥内建等）
    async _checkPlatformAuthenticator() {
        if (typeof PublicKeyCredential === 'undefined') {
            this._addLog('err', 'PublicKeyCredential 不可用，无法检测平台认证器');
            return;
        }
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
            this._addLog('err', 'isUserVerifyingPlatformAuthenticatorAvailable() 静态方法不可用');
            return;
        }
        try {
            this._addLog('auth', '调用 PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() ...');
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            this.setState({ webauthnPlatformAuth: !!available });
            this._addLog('auth', `平台认证器（TouchID/WindowsHello 等）${available ? '可用' : '不可用'}`);
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `检测平台认证器失败：${info.name} — ${info.message}`);
            this.setState({ webauthnPlatformAuth: false });
        }
    }
    // 检测条件 UI（autofill 中弹 WebAuthn UI）
    async _checkConditionalMediation() {
        if (typeof PublicKeyCredential === 'undefined') {
            this._addLog('err', 'PublicKeyCredential 不可用，无法检测条件 UI');
            return;
        }
        if (typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function') {
            this._addLog('err', 'isConditionalMediationAvailable() 静态方法不可用');
            return;
        }
        try {
            this._addLog('auth', '调用 PublicKeyCredential.isConditionalMediationAvailable() ...');
            const available = await PublicKeyCredential.isConditionalMediationAvailable();
            this.setState({ webauthnConditionalMed: !!available });
            this._addLog('auth', `条件 UI（autofill）${available ? '可用' : '不可用'}`);
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `检测条件 UI 失败：${info.name} — ${info.message}`);
            this.setState({ webauthnConditionalMed: false });
        }
    }
    // 构造完整的 PublicKeyCredentialCreationOptions（不实际调用 create，因需真实认证器）
    _buildWebAuthnOptions() {
        if (typeof PublicKeyCredential === 'undefined') {
            this._addLog('err', 'PublicKeyCredential 不可用，无法构造注册选项');
            return;
        }
        try {
            const challenge = _randomBytes(32); // 服务端下发，至少 16 字节
            const userId = _randomBytes(16); // 用户唯一标识
            const hostname = (typeof location !== 'undefined' && location.hostname) || 'lab.local';
            const options = {
                publicKey: {
                    rp: { name: 'API 实验室 Demo', id: hostname },
                    user: {
                        id: userId,
                        name: 'demo@lab.local',
                        displayName: 'API Lab Demo User',
                    },
                    challenge,
                    pubKeyCredParams: PUB_KEY_CRED_PARAMS,
                    timeout: 60000,
                    attestation: 'none',
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'preferred',
                        requireResidentKey: false,
                    },
                    excludeCredentials: [],
                    extensions: { credProps: true },
                },
            };
            this.setState({ webauthnOptionsPreview: options });
            this._addLog('auth', `已构造 PublicKeyCredentialCreationOptions（challenge=${challenge.length}B, user.id=${userId.length}B, alg=[${PUB_KEY_CRED_PARAMS.map((p) => p.alg).join(',')}]）`);
            this._addLog('auth', '注：未实际调用 create()，因需真实认证器与用户交互');
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `构造 WebAuthn 选项失败：${info.name} — ${info.message}`);
        }
    }
    // ============ Card 3: Payment Request API ============
    // 构造完整的 PaymentRequest 三段结构
    _buildPaymentRequest() {
        if (typeof PaymentRequest === 'undefined') {
            this._addLog('err', 'PaymentRequest 不可用，无法构造');
            return null;
        }
        try {
            const methodData = [
                // basic-card 已弃用；使用 URL 形式的支付处理程序
                { supportedMethods: 'https://google.com/pay', data: { environment: 'TEST', merchantInfo: { merchantId: 'lab-001' } } },
                { supportedMethods: 'https://apple.com/apple-pay', data: { version: 3, merchantIdentifier: 'merchant.lab.local' } },
            ];
            const details = {
                id: 'lab-order-' + Math.random().toString(36).slice(2, 8),
                displayItems: [
                    { label: 'API 实验室订阅 × 1', amount: { currency: 'CNY', value: '99.00' } },
                    { label: '满减优惠', amount: { currency: 'CNY', value: '-10.00' } },
                ],
                total: { label: '合计', amount: { currency: 'CNY', value: '89.00' } },
                shippingOptions: [
                    { id: 'standard', label: '标准配送', amount: { currency: 'CNY', value: '0.00' }, selected: true },
                    { id: 'express', label: '加急配送', amount: { currency: 'CNY', value: '12.00' } },
                ],
                modifiers: [],
            };
            const options = {
                requestPayerName: true,
                requestPayerEmail: true,
                requestPayerPhone: true,
                requestShipping: true,
                shippingType: 'shipping',
            };
            const preview = { methodData, details, options };
            this.setState({ paymentPreview: preview });
            this._addLog('pay', `已构造 PaymentRequest（methods=${methodData.length}, total=${details.total.amount.value} ${details.total.amount.currency}, shippingOptions=${details.shippingOptions.length}）`);
            return preview;
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `构造 PaymentRequest 失败：${info.name} — ${info.message}`);
            return null;
        }
    }
    // 调用 canMakePayment() 探测是否可支付
    async _canMakePayment() {
        if (typeof PaymentRequest === 'undefined') {
            this._addLog('err', 'PaymentRequest 不可用');
            return;
        }
        let preview = this.state.paymentPreview;
        if (!preview)
            preview = this._buildPaymentRequest();
        if (!preview)
            return;
        try {
            const req = new PaymentRequest(preview.methodData, preview.details, preview.options);
            this._addLog('pay', '调用 paymentRequest.canMakePayment() ...');
            const can = await req.canMakePayment();
            this.setState({ paymentCanMake: !!can });
            this._addLog('pay', `canMakePayment() = ${can}`);
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `canMakePayment 失败：${info.name} — ${info.message}`);
            this.setState({ paymentCanMake: false });
        }
    }
    // 调用 show() 弹出浏览器原生支付 UI（jsdom 中会失败，记日志说明）
    async _showPayment() {
        if (typeof PaymentRequest === 'undefined') {
            this._addLog('err', 'PaymentRequest 不可用');
            return;
        }
        let preview = this.state.paymentPreview;
        if (!preview)
            preview = this._buildPaymentRequest();
        if (!preview)
            return;
        try {
            const req = new PaymentRequest(preview.methodData, preview.details, preview.options);
            this._addLog('pay', '调用 paymentRequest.show() —— 将弹出浏览器原生支付 UI ...');
            const response = await req.show();
            this._addLog('pay', `show() 返回响应：methodName=${response.methodName}, payerName=${response.payerName || '—'}`);
            this.setState({ paymentShowResult: `已响应：${response.methodName}` });
            try {
                await response.complete('success');
                this._addLog('pay', "response.complete('success') 已确认");
            }
            catch (e) {
                this._addLog('err', `complete 失败：${errInfo(e).message}`);
            }
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `show 失败：${info.name} — ${info.message}（jsdom / 无支付处理程序时属正常）`);
            this.setState({ paymentShowResult: `失败：${info.name}` });
        }
    }
    // ============ Card 4: Presentation API + Idle Detection API ============
    // 构造 PresentationRequest（不实际 start，因需第二屏幕）
    _buildPresentationRequest() {
        if (!('presentation' in navigator)) {
            this._addLog('err', 'navigator.presentation 不可用，无法构造 PresentationRequest');
            return;
        }
        try {
            const urls = ['https://example.com/cast', '/presentation/slave.html'];
            const PresentationRequestCtor = window.PresentationRequest;
            const req = new PresentationRequestCtor(urls);
            // 不实际 start，仅记录结构
            const preview = {
                urls,
                defaultRequest: !!navigator.presentation.defaultRequest,
                receiver: !!navigator.presentation.receiver,
            };
            this.setState({ presentationRequestPreview: preview });
            this._addLog('pres', `已构造 PresentationRequest(urls=${urls.length}) —— 不调用 start（需第二屏幕）`);
            // 演示设置 defaultRequest（用于 `PresentationAvailability` 监听）
            try {
                navigator.presentation.defaultRequest = req;
                this._addLog('pres', '已设置 navigator.presentation.defaultRequest');
            }
            catch (err) {
                this._addLog('err', `设置 defaultRequest 失败：${errInfo(err).message}`);
            }
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `构造 PresentationRequest 失败：${info.name} — ${info.message}`);
        }
    }
    // 断开 PresentationConnection 并清理事件回调
    _disconnectPresentation(fromCleanup = false) {
        const conn = this._presentationConnection;
        if (!conn) {
            if (!fromCleanup)
                this._addLog('pres', '无活跃 PresentationConnection');
            return;
        }
        try {
            conn.onconnect = null;
            conn.onclose = null;
            conn.onterminate = null;
            if (conn.state === 'connected')
                conn.terminate();
        }
        catch { /* noop */ }
        this._presentationConnection = null;
        if (!fromCleanup)
            this._addLog('pres', '已断开 PresentationConnection');
    }
    // 请求 'idle-detection' 权限
    async _idleRequestPermission() {
        if (typeof IdleDetector === 'undefined') {
            this._addLog('err', 'IdleDetector 不可用，无法请求权限');
            return;
        }
        if (typeof IdleDetector.requestPermission !== 'function') {
            this._addLog('err', 'IdleDetector.requestPermission 静态方法不可用');
            return;
        }
        try {
            this._addLog('idle', '调用 IdleDetector.requestPermission!() ...（将弹权限请求）');
            const result = await IdleDetector.requestPermission();
            this.setState({ idlePermission: result });
            this._addLog('idle', `权限结果：${result}`);
            if (result === 'granted') {
                this._addLog('idle', '权限已授予，可点击「启动监听」');
            }
            else {
                this._addLog('idle', '权限被拒绝或未授予，无法启动监听');
            }
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `requestPermission 失败：${info.name} — ${info.message}`);
        }
    }
    // 启动 IdleDetector，监听 userState/screenState 变化
    async _startIdleDetector() {
        if (typeof IdleDetector === 'undefined') {
            this._addLog('err', 'IdleDetector 不可用');
            return;
        }
        if (this._idleDetector) {
            this._addLog('idle', 'IdleDetector 已在运行');
            return;
        }
        if (this.state.idlePermission !== 'granted') {
            this._addLog('idle', '请先调用 requestPermission() 取得授权');
            return;
        }
        try {
            const detector = new IdleDetector();
            this._idleDetector = detector;
            this._idleChangeHandler = () => {
                if (!this._idleDetector)
                    return;
                const userState = detector.userState ?? '—';
                const screenState = detector.screenState ?? '—';
                this.setState({ idleUserState: userState, idleScreenState: screenState });
                this._addLog('idle', `change 事件：userState=${userState}, screenState=${screenState}`);
            };
            detector.addEventListener('change', this._idleChangeHandler);
            this._addLog('idle', '调用 idleDetector.start({ threshold: 60000 }) ...');
            await detector.start({ threshold: 60000 });
            this.setState({
                idleRunning: true,
                idleUserState: detector.userState ?? '—',
                idleScreenState: detector.screenState ?? '—',
            });
            this._addLog('idle', `IdleDetector 已启动（threshold=60s, userState=${detector.userState}, screenState=${detector.screenState}）`);
        }
        catch (err) {
            const info = errInfo(err);
            this._addLog('err', `IdleDetector.start 失败：${info.name} — ${info.message}`);
            this._stopIdleDetector();
        }
    }
    // 停止 IdleDetector
    _stopIdleDetector(fromCleanup = false) {
        if (!this._idleDetector) {
            if (!fromCleanup && this.state.idleRunning) {
                this.setState({ idleRunning: false });
            }
            return;
        }
        try {
            if (this._idleChangeHandler) {
                this._idleDetector.removeEventListener('change', this._idleChangeHandler);
            }
        }
        catch { /* noop */ }
        this._idleDetector = null;
        this._idleChangeHandler = null;
        if (!fromCleanup && !this._destroyed) {
            this.setState({ idleRunning: false });
            this._addLog('idle', 'IdleDetector 已停止');
        }
    }
    // ============ Card 5: Local Font Access API + FedCM ============
    // 调用 queryLocalFonts() 枚举本地字体（可能需 'local-fonts' 权限）
    async _queryLocalFonts() {
        if (typeof window.queryLocalFonts !== 'function') {
            this._addLog('err', 'window.queryLocalFonts 不可用');
            return;
        }
        try {
            this.setState({ localFontsLoading: true });
            this._addLog('font', '调用 window.queryLocalFonts() ...（可能弹权限请求）');
            const fonts = await window.queryLocalFonts();
            // 只保留前 20 个字体，并裁剪字段（FontData: postscriptName/fullName/family/style）
            const list = fonts.slice(0, 20).map((f) => ({
                postscriptName: f.postscriptName,
                fullName: f.fullName,
                family: f.family,
                style: f.style,
            }));
            this.setState({ localFonts: list, localFontsLoading: false });
            this._addLog('font', `共获取 ${fonts.length} 个本地字体（仅展示前 ${list.length} 个）`);
        }
        catch (err) {
            const info = errInfo(err);
            this.setState({ localFontsLoading: false });
            this._addLog('err', `queryLocalFonts 失败：${info.name} — ${info.message}`);
        }
    }
    // 构造 FedCM 配置（不实际调用 get，因需真实 IdP 与 HTTPS）
    _buildFedcmConfig() {
        const win = typeof window !== 'undefined' ? window : {};
        const supported = 'IdentityCredential' in win;
        if (!supported) {
            this._addLog('err', 'IdentityCredential 不可用，FedCM 不支持');
            this.setState({ fedcmPreview: null });
            return;
        }
        const config = {
            mediation: 'optional',
            identity: {
                // mode: 'active' | 'passive'；context: 'signin' | 'signup' | 'use' | 'continue'
                mode: 'active',
                context: 'signin',
                providers: [
                    {
                        // IdentityProviderConfig 字段
                        configURL: 'https://idp.example.com/config.json',
                        clientId: 'api-lab-demo-client',
                        nonce: _genNonce(),
                        loginHint: 'demo@lab.local',
                        accountMode: 'prefer-exact',
                        fields: ['name', 'email', 'picture'],
                    },
                ],
            },
        };
        this.setState({ fedcmPreview: config });
        this._addLog('fedcm', '已构造 FedCM 配置（identity.providers=1, fields=3）');
        this._addLog('fedcm', '注：未实际调用 navigator.credentials.get({identity})，因需真实 IdP 与 HTTPS');
    }
    // ============ 日志面板 ============
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志'), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 渲染 ===================
    renderPage() {
        const caps = this._caps();
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, '身份认证与支付 API 实验室'),
            h(Alert, {
                type: 'info',
                message: 'Credential Management · WebAuthn · Payment Request · Presentation · Idle Detection · Local Font Access · FedCM',
                description: '聚焦「身份认证与支付」相关 Web API。多数 API 较新且要求安全上下文（HTTPS / localhost）与用户手势；jsdom 等运行时通常不可用。所有调用前均做能力检测，不可用时记日志说明，不抛异常。WebAuthn / Payment 等敏感操作仅演示调用流程，由用户点击触发，失败时在 try/catch 中记日志。',
            }),
            // ============ Card 1: Credential Management API ============
            h(Card, {
                title: '1. Credential Management API',
                extra: h('div', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'navigator.credentials'), h(Tag, { color: caps.credentials ? 'success' : 'warning' }, caps.credentials ? '稳定' : '不可用')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, '统一管理密码 / 联合 / OTP 凭据：get / create / store / preventSilentAccess。mediation 取值 silent / optional / conditional / required，控制自动登录行为；preventSilentAccess 用于退出后阻止下次自动登录。'), h('div', { class: 'flex items-center gap-sm flex-wrap fs-sm' }, h('span', { class: 'text-tertiary' }, '能力：'), this._capTag(caps.credentials), h('span', { class: 'text-tertiary' }, '已识别类型：'), s.credSupportedTypes.length === 0
                ? h('span', { class: 'text-tertiary' }, '（未检测）')
                : s.credSupportedTypes.map((t) => h(Tag, { color: 'primary' }, t))), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测凭据类型', { size: 'sm', onClick: () => this._detectCredentialTypes() }), this._btn('preventSilentAccess', { type: 'primary', size: 'sm', disabled: !caps.credentials, onClick: () => this._preventSilentAccess() }), this._btn('创建并 store 密码凭据', { type: 'primary', size: 'sm', disabled: !caps.credentials, onClick: () => this._createAndStorePasswordCredential() })), this._kvRow('preventSilentAccess 结果', s.credPreventSilentResult), this._kvRow('store 结果', s.credStoreResult), h('div', { class: 'fs-sm text-tertiary' }, 'mediation 取值：' + MEDIATION_VALUES.join(' / ')))),
            // ============ Card 2: WebAuthn ============
            h(Card, {
                title: '2. WebAuthn（Web Authentication API）',
                extra: h('div', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'PublicKeyCredential'), h(Tag, { color: caps.publicKeyCredential ? 'success' : 'warning' }, caps.publicKeyCredential ? '可用' : '不可用'), h(Tag, { color: 'warning' }, '实验性')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, '基于公钥的无密码认证。create({publicKey}) 注册新凭据，get({publicKey}) 完成断言。可探测平台认证器（TouchID / WindowsHello）与条件 UI（autofill 中弹 WebAuthn UI）。注册选项含 rp / user / challenge / pubKeyCredParams / authenticatorSelection / timeout / attestation。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测平台认证器', { type: 'primary', size: 'sm', disabled: !caps.publicKeyCredential, onClick: () => this._checkPlatformAuthenticator() }), this._btn('检测条件 UI', { type: 'primary', size: 'sm', disabled: !caps.publicKeyCredential, onClick: () => this._checkConditionalMediation() }), this._btn('构造注册选项', { size: 'sm', disabled: !caps.publicKeyCredential, onClick: () => this._buildWebAuthnOptions() })), this._kvRow('平台认证器', s.webauthnPlatformAuth === null ? '未检测' : (s.webauthnPlatformAuth ? '可用' : '不可用')), this._kvRow('条件 UI', s.webauthnConditionalMed === null ? '未检测' : (s.webauthnConditionalMed ? '可用' : '不可用')), this._subSection('PublicKeyCredentialCreationOptions 预览：', this._jsonBlock(s.webauthnOptionsPreview)))),
            // ============ Card 3: Payment Request API ============
            h(Card, {
                title: '3. Payment Request API',
                extra: h('div', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'PaymentRequest'), h(Tag, { color: caps.paymentRequest ? 'success' : 'warning' }, caps.paymentRequest ? '可用' : '不可用'), h(Tag, { color: 'default' }, 'basic-card 已弃用')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, '原生支付 UI：methodData + details + options 三段构造。show() 弹出 UI，canMakePayment() 探测支持，abort() 取消。basic-card 已弃用，使用 https://google.com/pay 等 URL 形式的支付处理程序。details 含 displayItems / total / shippingOptions / modifiers。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('构造 PaymentRequest', { size: 'sm', disabled: !caps.paymentRequest, onClick: () => this._buildPaymentRequest() }), this._btn('canMakePayment', { type: 'primary', size: 'sm', disabled: !caps.paymentRequest, onClick: () => this._canMakePayment() }), this._btn('show() 支付', { type: 'primary', size: 'sm', disabled: !caps.paymentRequest, onClick: () => this._showPayment() })), this._kvRow('canMakePayment 结果', s.paymentCanMake === null ? '未检测' : (s.paymentCanMake ? '可支付' : '不可支付')), this._kvRow('show 结果', s.paymentShowResult), this._subSection('PaymentRequest 结构预览：', this._jsonBlock(s.paymentPreview)))),
            // ============ Card 4: Presentation + Idle Detection ============
            h(Card, {
                title: '4. Presentation API + Idle Detection API',
                extra: h('div', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'PresentationRequest'), h(Tag, { color: caps.presentation ? 'success' : 'warning' }, caps.presentation ? '可用' : '不可用'), h(Tag, { color: 'primary' }, 'IdleDetector'), h(Tag, { color: caps.idleDetector ? 'success' : 'warning' }, caps.idleDetector ? '可用' : '不可用'), h(Tag, { color: 'warning' }, '实验性')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'Presentation API 用于第二屏幕投屏：PresentationRequest.start / reconnect / getAvailability，PresentationConnection 经 connect / close / terminate 与 statechange 事件管理。Idle Detection API 经 idle-detection 权限监听 userState / screenState 变化，threshold 控制空闲阈值。'), 
            // Presentation 子区块
            this._subSection('Presentation：', h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('构造 PresentationRequest', { size: 'sm', disabled: !caps.presentation, onClick: () => this._buildPresentationRequest() }), this._btn('断开连接', { danger: true, size: 'sm', onClick: () => this._disconnectPresentation() })), this._jsonBlock(s.presentationRequestPreview)), 
            // Idle Detection 子区块
            this._subSection('Idle Detection：', h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('请求权限', { type: 'primary', size: 'sm', disabled: !caps.idleDetector, onClick: () => this._idleRequestPermission() }), this._btn('启动监听', { type: 'primary', size: 'sm', disabled: !caps.idleDetector || s.idleRunning, onClick: () => this._startIdleDetector() }), this._btn('停止监听', { danger: true, size: 'sm', disabled: !s.idleRunning, onClick: () => this._stopIdleDetector() })), this._kvRow('权限状态', s.idlePermission), this._kvRow('运行中', s.idleRunning ? '是' : '否'), this._kvRow('userState', s.idleUserState), this._kvRow('screenState', s.idleScreenState)))),
            // ============ Card 5: Local Font Access + FedCM ============
            h(Card, {
                title: '5. Local Font Access API + FedCM',
                extra: h('div', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'queryLocalFonts'), h(Tag, { color: caps.queryLocalFonts ? 'success' : 'warning' }, caps.queryLocalFonts ? '可用' : '不可用'), h(Tag, { color: 'primary' }, 'IdentityCredential'), h(Tag, { color: caps.identityCredential ? 'success' : 'warning' }, caps.identityCredential ? '可用' : '不可用'), h(Tag, { color: 'warning' }, '实验性')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'Local Font Access API 经 local-fonts 权限枚举本地字体（FontData: postscriptName / fullName / family / style），用于高级排版。FedCM（Federated Credential Management）提供浏览器原生 IdP 联合登录 UI，避免第三方 Cookie 跟踪：navigator.credentials.get({ identity: { providers, mode, context } })。'), 
            // Local Font 子区块
            this._subSection('Local Font Access：', h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('枚举本地字体', { type: 'primary', size: 'sm', disabled: !caps.queryLocalFonts || s.localFontsLoading, onClick: () => this._queryLocalFonts() })), s.localFonts.length === 0
                ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无字体数据）')
                : h('div', { class: 'flex flex-col gap-xs' }, ...s.localFonts.map((f) => h('div', { class: 'api-metric' }, h('span', { class: 'fs-sm fw-medium', style: { minWidth: '180px' } }, f.family), h('span', { class: 'fs-sm text-secondary', style: { minWidth: '140px' } }, f.style), h('span', { class: 'fs-sm text-tertiary', style: { wordBreak: 'break-all' } }, f.postscriptName))))), 
            // FedCM 子区块
            this._subSection('FedCM：', h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('构造 FedCM 配置', { type: 'primary', size: 'sm', disabled: !caps.identityCredential, onClick: () => this._buildFedcmConfig() })), h('div', { class: 'fs-sm text-secondary' }, 'IdentityCredential 配置预览：'), this._jsonBlock(s.fedcmPreview)))),
            // ============ 日志面板 ============
            h(Card, {
                title: '事件日志',
                extra: h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
            }, this._renderLogPanel()),
        ];
    }
}
//# sourceMappingURL=IdentityPage.js.map