// =====================================================================
// WebOTPAPIPage.js —— WebOTP API 短信验证码 完整实验室
// 演示 W3C WebOTP API（OTPCredential 凭据类型）的全套能力：
//   1. 概述与动机 —— 短信 OTP 手动输入痛点 / WebOTP API W3C /
//      OTPCredential 凭据类型 / 与 WebAuthn（生物凭据）区别 / 浏览器
//      支持 Chrome Android 84+ / Android only / 需要 HTTPS
//   2. navigator.credentials.get OTPCredential —— navigator.credentials.
//      get({ otp: { transport: ['sms'] } }) / 返回 OTPCredential /
//      credential.code 验证码 / credential.transport / Promise 异步等待短信
//   3. 短信格式规范 —— SMS 必须包含 @origin https://example.com #12345
//      / App Hash 11 位哈希 / 格式不匹配不触发 / 与运营商短信过滤 /
//      兼容旧格式
//   4. abort 信号与超时 —— navigator.credentials.get({ otp: {...},
//      signal: ac.signal }) / AbortController 中止 / 用户切换页面时中止
//      / 防止悬挂 Promise
//   5. autocomplete="one-time-code" —— HTML input autocomplete="one-time-
//      code" / 与 WebOTP API 协同 / 浏览器自动填充 / iOS Safari 支持
//      （非 WebOTP API 但 autocomplete）/ 跨平台降级
//   6. 实战：登录验证码自动填充 —— 发送短信 → input focus →
//      navigator.credentials.get → 自动填充 → 提交表单 / 用户切换/超时
//      处理 / 与现有登录流程集成
//   7. 实战：双因素认证 2FA —— TOTP 与 SMS OTP 区别 / WebOTP 仅支持
//      SMS / 与 WebAuthn 协同（强凭据 + OTP 备用）/ 降级方案
//   8. 陷阱与最佳实践 —— 仅 Android Chrome 支持 / 必须 HTTPS / SMS 格式
//      严格 / 用户手势要求 / 隐私考虑（不暴露短信全文）/ 与 navigator.
//      credentials 其他类型协同 / 安全考虑（防钓鱼）
// 说明：所有特性调用前做 typeof / in 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不实现
//       navigator.credentials.get / OTPCredential，所有能力检测统一兜底
//       返回 false；真实浏览器仅 Android Chrome 84+ 支持。注入演示样式
//       + 完整代码示例，真实 Android Chrome 可查看短信验证码自动填充。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class WebOTPAPIPage extends Page {
    _abortControllers;
    _dynamicStyles;
    _inited;
    _otpTimer;
    _simulatedOtp;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概述与动机
            getOtpInfo: '', // Card 2：navigator.credentials.get OTPCredential
            smsFormatInfo: '', // Card 3：短信格式规范
            abortInfo: '', // Card 4：abort 信号与超时
            autocompleteInfo: '', // Card 5：autocomplete="one-time-code"
            loginFlowInfo: '', // Card 6：登录验证码自动填充
            twoFaInfo: '', // Card 7：双因素认证 2FA
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
        this._abortControllers = []; // 活跃的 AbortController 实例（卸载时中止）
        this._simulatedOtp = ''; // 模拟的 OTP 验证码（jsdom 无法真实接收）
        this._otpTimer = null; // 模拟 OTP 短信定时器
        // 一次性能力检测：WebOTP API 全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `OTPCredential ${c(f.otpCredential)}`,
            `credentials.get ${c(f.credentialsGet)}`,
            `AbortController ${c(f.abortController)}`,
            `AbortSignal ${c(f.abortSignal)}`,
            `WebAuthn ${c(f.webAuthn)}`,
            `SecureContext ${c(f.secureContext)}`,
            `one-time-code ${c(f.oneTimeCode)}`,
        ];
        const summary = f.otpCredential
            ? `WebOTP API 能力检测：${parts.join(' · ')}。当前环境支持 OTPCredential（真实 Android Chrome 84+）。navigator.credentials.get({ otp: { transport: ['sms'] } }) 异步等待短信，收到后 credential.code 即验证码。需 HTTPS 安全上下文。`
            : '当前环境不支持 WebOTP API（jsdom 不实现 OTPCredential；仅 Android Chrome 84+ 支持，iOS Safari/Firefox/桌面浏览器不支持）。所有按钮点击将仅记日志说明（部分用模拟 OTP 演示流程），不会抛异常。在真实 Android Chrome（HTTPS）中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.otpCredential ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.otpCredential)
            this._addLog('warn', 'OTPCredential 不可用（仅 Android Chrome 84+ 支持；iOS Safari/Firefox/桌面浏览器不支持，需降级 autocomplete="one-time-code" + 手动输入）');
        if (!f.credentialsGet)
            this._addLog('warn', 'navigator.credentials.get 不可用（jsdom 不实现，真实浏览器 Chrome 51+/Firefox 60+ 支持 Credential Management API）');
        if (!f.secureContext)
            this._addLog('warn', '当前非安全上下文（window.isSecureContext=false），WebOTP 在非安全上下文被禁用（需 HTTPS 或 localhost）');
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
        // 中止所有活跃的 AbortController（防止悬挂 Promise）
        for (const ac of this._abortControllers) {
            try {
                ac.abort();
            }
            catch { /* noop */ }
        }
        this._abortControllers = [];
        // 清理模拟 OTP 定时器
        if (this._otpTimer) {
            try {
                clearTimeout(this._otpTimer);
            }
            catch { /* noop */ }
            this._otpTimer = null;
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
    // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
    // 用 safe(()=>...) 包裹，jsdom 不可用时返回 false
    _flags() {
        const safe = (fn) => { try {
            return fn();
        }
        catch {
            return false;
        } };
        return {
            otpCredential: safe(() => typeof window !== 'undefined' && 'OTPCredential' in window),
            credentialsGet: safe(() => typeof navigator !== 'undefined' && typeof navigator.credentials === 'object' && typeof navigator.credentials.get === 'function'),
            webAuthn: safe(() => typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'),
            abortController: safe(() => typeof AbortController === 'function'),
            abortSignal: safe(() => typeof window !== 'undefined' && typeof window.AbortSignal !== 'undefined'),
            secureContext: safe(() => typeof window !== 'undefined' && window.isSecureContext === true),
            // autocomplete="one-time-code" 无法直接检测，但 input 元素全支持 autocomplete 属性
            oneTimeCode: safe(() => typeof document !== 'undefined' && typeof document.createElement === 'function' && 'autocomplete' in document.createElement('input')),
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
        this._injectStyle('web-otp-demo', `
      /* ===== 通用舞台 ===== */
      .otp-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2 / Card 6：OTP 输入框 ===== */
      .otp-input-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .otp-input {
        width: 180px;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-size: 16px;
        letter-spacing: 2px;
        font-family: monospace;
        box-sizing: border-box;
      }
      .otp-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
      }
      .otp-input.otp-filled {
        background: #dcfce7;
        border-color: #10b981;
        color: #064e3b;
      }
      /* ===== Card 3：SMS 格式预览 ===== */
      .otp-sms-preview {
        margin-top: 8px;
        padding: 10px;
        background: #fef3c7;
        border-left: 3px solid #f59e0b;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        color: #78350f;
        white-space: pre-wrap;
        line-height: 1.6;
      }
      .otp-sms-preview .tag-origin { color: #1d4ed8; font-weight: 600; }
      .otp-sms-preview .tag-code { color: #b91c1c; font-weight: 700; background: #fee2e2; padding: 0 4px; border-radius: 2px; }
      .otp-sms-preview .tag-hash { color: #6b21a8; font-weight: 600; }
      /* ===== Card 5：autocomplete 演示 ===== */
      .otp-autocomplete-stage {
        margin-top: 8px;
        padding: 10px;
        background: #ede9fe;
        border: 1px dashed #8b5cf6;
        border-radius: 4px;
        font-size: 13px;
        color: #4c1d95;
      }
      /* ===== Card 6：登录流程 ===== */
      .otp-login-flow {
        margin-top: 8px;
        padding: 10px;
        background: #e0f2fe;
        border: 1px solid #0284c7;
        border-radius: 4px;
        font-size: 13px;
        color: #0c4a6e;
      }
      .otp-login-flow .step {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 4px 0;
      }
      .otp-login-flow .step-num {
        display: inline-block;
        width: 20px; height: 20px;
        background: #0284c7; color: #fff;
        border-radius: 50%;
        text-align: center;
        line-height: 20px;
        font-size: 11px;
        flex-shrink: 0;
      }
      .otp-login-flow .step.done .step-num { background: #10b981; }
      .otp-login-flow .step.active .step-num { background: #f59e0b; }
      /* ===== Card 7：2FA 对比表 ===== */
      .otp-2fa-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 12px;
      }
      .otp-2fa-table th, .otp-2fa-table td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        text-align: left;
      }
      .otp-2fa-table th { background: #e0e7ff; font-weight: 600; }
      .otp-2fa-table .yes { color: #10b981; }
      .otp-2fa-table .no { color: #ef4444; }
      .otp-2fa-table .partial { color: #f59e0b; }
      /* ===== 输出区 ===== */
      .otp-output {
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
      .otp-status {
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
    // —— 真实调用 navigator.credentials.get({ otp: {...} })（带能力检测）——
    // 不可用时用模拟 OTP 演示流程；为防止悬挂 Promise，始终绑定 AbortController
    _tryGetOtp(onCode) {
        const f = this._flags();
        if (!f.credentialsGet) {
            this._addLog('warn', 'navigator.credentials.get 不可用（jsdom 不实现），改用模拟 OTP 演示流程');
            this._simulateOtp(onCode);
            return;
        }
        if (!f.otpCredential) {
            this._addLog('warn', 'OTPCredential 不可用（仅 Android Chrome 84+ 支持），credentials.get({otp}) 会 reject，改用模拟 OTP');
            this._simulateOtp(onCode);
            return;
        }
        if (!f.abortController) {
            this._addLog('warn', 'AbortController 不可用，跳过真实调用（防止悬挂 Promise）');
            this._simulateOtp(onCode);
            return;
        }
        const ac = new AbortController();
        this._abortControllers.push(ac);
        // 30 秒超时自动中止，防止悬挂
        const timeoutId = setTimeout(() => {
            try {
                ac.abort();
            }
            catch { /* noop */ }
        }, 30000);
        this._addLog('info', 'navigator.credentials.get({ otp: { transport: ["sms"] } }) 已调用，等待短信...');
        navigator.credentials.get({
            otp: { transport: ['sms'] },
            signal: ac.signal,
        }).then((cred) => {
            clearTimeout(timeoutId);
            if (cred && cred.code) {
                this._addLog('success', `WebOTP 收到验证码：${cred.code}（transport=${cred.transport || 'sms'}）`);
                if (typeof onCode === 'function')
                    onCode(cred.code);
            }
            else {
                this._addLog('warn', 'WebOTP 返回凭据但无 code 字段');
            }
        }).catch((err) => {
            clearTimeout(timeoutId);
            const name = err && err.name ? err.name : 'Error';
            if (name === 'AbortError') {
                this._addLog('warn', `WebOTP 被中止（AbortError）：${err.message || '用户切换页面或超时'}`);
            }
            else {
                this._addLog('warn', `WebOTP 失败：${name} - ${err && err.message ? err.message : ''}`);
            }
        });
    }
    // —— 模拟 OTP 短信（jsdom / 不支持环境降级演示）——
    _simulateOtp(onCode) {
        this._addLog('info', '模拟短信：3 秒后到达（格式 @https://example.com #123456 8mA3Kp9xQ2L）');
        if (this._otpTimer)
            clearTimeout(this._otpTimer);
        this._otpTimer = setTimeout(() => {
            if (this._destroyed)
                return;
            const code = '123456';
            this._addLog('success', `模拟 WebOTP 收到验证码：${code}（模拟 SMS：@https://example.com #${code} <8mA3Kp9xQ2L>）`);
            if (typeof onCode === 'function')
                onCode(code);
        }, 3000);
    }
    // =================== Card 1：概述与动机 ===================
    _readOverviewInfo() {
        const f = this._flags();
        try {
            return `===== WebOTP API 概述与动机 =====\n` +
                `\n` +
                `【规范归属】\n` +
                `  WebOTP API（OTPCredential），W3C 规范\n` +
                `  规范地址：https://wicg.github.io/web-otp/\n` +
                `  归属：WICG（Web Incubator Community Group）\n` +
                `  基于 Credential Management API 扩展 OTPCredential 凭据类型\n` +
                `\n` +
                `【核心动机】\n` +
                `  短信 OTP 验证码手动输入痛点：\n` +
                `    - 收到短信 → 切换到短信应用 → 记忆/复制验证码 → 切回浏览器 → 粘贴\n` +
                `    - 流程繁琐，用户体验差，转化率低\n` +
                `    - 6 位数字易输错（尤其老人/视力障碍用户）\n` +
                `  WebOTP API：浏览器自动从短信提取验证码，自动填充到表单\n` +
                `  无需用户操作，体验接近原生 App\n` +
                `\n` +
                `【OTPCredential 凭据类型】\n` +
                `  基于 Credential Management API（navigator.credentials）\n` +
                `  新增 OTPCredential 类型：{ code: string, transport: 'sms' }\n` +
                `  通过 navigator.credentials.get({ otp: { transport: ['sms'] } }) 获取\n` +
                `\n` +
                `【与 WebAuthn（生物凭据）区别】\n` +
                `  WebOTP：短信验证码（SMS OTP）， possession 因素（你拥有手机号）\n` +
                `    弱凭据，易被 SIM 交换攻击，但部署简单\n` +
                `  WebAuthn：生物凭据/硬件密钥（指纹/Face ID/安全密钥），强凭据\n` +
                `    抗钓鱼，但需硬件支持，部署复杂\n` +
                `  两者协同：WebAuthn 为主凭据，SMS OTP 为备用（账户恢复）\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  Chrome Android 84+（2020 年起）\n` +
                `  Edge Android 84+\n` +
                `  仅 Android 平台（依赖 Android SMS Retriever API / Auto Fill API）\n` +
                `  iOS Safari 不支持 WebOTP API（但支持 autocomplete="one-time-code"）\n` +
                `  Firefox / 桌面浏览器 不支持\n` +
                `  必须 HTTPS 安全上下文\n` +
                `\n` +
                `【当前环境能力检测】\n` +
                `  OTPCredential       = ${f.otpCredential}\n` +
                `  credentials.get     = ${f.credentialsGet}\n` +
                `  AbortController     = ${f.abortController}\n` +
                `  WebAuthn            = ${f.webAuthn}\n` +
                `  SecureContext       = ${f.secureContext}\n` +
                `  one-time-code       = ${f.oneTimeCode}\n` +
                `\n` +
                `【核心 API 一览】\n` +
                `  // 请求短信验证码\n` +
                `  const cred = await navigator.credentials.get({\n` +
                `    otp: { transport: ['sms'] },\n` +
                `    signal: ac.signal,  // 可选，用于中止\n` +
                `  });\n` +
                `  if (cred) {\n` +
                `    input.value = cred.code;  // 自动填充\n` +
                `    form.submit();\n` +
                `  }\n` +
                `\n` +
                `【完整代码示例：最小可运行】\n` +
                `  if ('OTPCredential' in window) {\n` +
                `    const ac = new AbortController();\n` +
                `    setTimeout(() => ac.abort(), 60000);  // 60 秒超时\n` +
                `    navigator.credentials.get({\n` +
                `      otp: { transport: ['sms'] },\n` +
                `      signal: ac.signal,\n` +
                `    }).then((cred: any) => {\n` +
                `      if (cred && cred.code) {\n` +
                `        document.querySelector('input[autocomplete="one-time-code"]').value = cred.code;\n` +
                `      }\n` +
                `    }).catch((err: any) => console.warn(err));\n` +
                `  }`;
        }
        catch (err) {
            return `读取 WebOTP 概述信息失败：${err.name} - ${err.message}`;
        }
    }
    _runOverviewDemo() {
        this.setState({ overviewInfo: this._readOverviewInfo() });
        this._addLog('info', `WebOTP 概述演示：OTPCredential=${this._flags().otpCredential}, secureContext=${this._flags().secureContext}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述与动机 —— WebOTP API / OTPCredential',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['OTPCredential', f.otpCredential],
                ['credentials.get', f.credentialsGet],
                ['SecureContext', f.secureContext],
            ]), h(Tag, { color: 'primary' }, 'Android only')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'WebOTP API（W3C/WICG 规范）基于 Credential Management API 扩展 OTPCredential 凭据类型，浏览器自动从短信提取验证码填充表单，解决手动输入痛点。与 WebAuthn（生物凭据/硬件密钥，强凭据抗钓鱼）区别：WebOTP 是 SMS OTP 弱凭据（易被 SIM 交换攻击），但部署简单。两者协同：WebAuthn 为主凭据，SMS OTP 为备用（账户恢复）。浏览器支持：仅 Chrome Android 84+/Edge Android 84+，iOS Safari/Firefox/桌面不支持，必须 HTTPS。iOS Safari 用 autocomplete="one-time-code" 降级。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「运行演示」查看 WebOTP API 完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'WebOTP 仅 Android Chrome 84+ 支持，iOS Safari 用 autocomplete="one-time-code" 降级',
                    description: 'WebOTP API 基于 Credential Management API 扩展 OTPCredential，自动从短信提取验证码。仅 Chrome Android 84+/Edge Android 84+ 支持（依赖 Android SMS Retriever API），必须 HTTPS。iOS Safari/Firefox/桌面不支持，需降级 autocomplete="one-time-code" + 手动输入。与 WebAuthn 协同：强凭据 + OTP 备用。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：navigator.credentials.get OTPCredential ===================
    _readGetOtpInfo() {
        const f = this._flags();
        try {
            const input = this.el && this.el.querySelector('.otp-input-2');
            let currentVal = '(未渲染)';
            if (input)
                currentVal = input.value || '(空)';
            return `===== navigator.credentials.get OTPCredential =====\n` +
                `\n` +
                `【API 签名】\n` +
                `  const cred = await navigator.credentials.get({\n` +
                `    otp: { transport: ['sms'] },\n` +
                `    signal: ac.signal,  // 可选\n` +
                `  });\n` +
                `  // 返回 OTPCredential 或 null\n` +
                `\n` +
                `【OTPCredential 结构】\n` +
                `  {\n` +
                `    code: "123456",        // 6 位验证码\n` +
                `    transport: "sms",      // 传输方式（仅 'sms'）\n` +
                `    id: "...",             // 凭据 ID\n` +
                `    type: "otp",           // 凭据类型\n` +
                `  }\n` +
                `\n` +
                `【transport 取值】\n` +
                `  目前仅支持 'sms'（短信）\n` +
                `  transport 数组：['sms']（必须为数组，即使单元素）\n` +
                `  未来可能扩展其他传输方式\n` +
                `\n` +
                `【Promise 异步等待短信】\n` +
                `  credentials.get 返回 Promise，异步等待短信到达\n` +
                `  收到符合格式短信后 resolve，返回 OTPCredential\n` +
                `  无短信则一直 pending（需 AbortController 超时中止）\n` +
                `\n` +
                `【当前演示输入框】\n` +
                `  .otp-input-2 当前值="${currentVal}"\n` +
                `  OTPCredential 可用 = ${f.otpCredential}\n` +
                `  credentials.get 可用 = ${f.credentialsGet}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  async function receiveOtp(input) {\n` +
                `    if (!('OTPCredential' in window)) return;\n` +
                `    const ac = new AbortController();\n` +
                `    const timer = setTimeout(() => ac.abort(), 60000);\n` +
                `    try {\n` +
                `      const cred = await navigator.credentials.get({\n` +
                `        otp: { transport: ['sms'] },\n` +
                `        signal: ac.signal,\n` +
                `      });\n` +
                `      if (cred && cred.code) {\n` +
                `        input.value = cred.code;\n` +
                `        input.form.submit();\n` +
                `      }\n` +
                `    } catch (err: any) {\n` +
                `      if (err.name !== 'AbortError') console.warn(err);\n` +
                `    } finally {\n` +
                `      clearTimeout(timer);\n` +
                `    }\n` +
                `  }\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ transport 必须为数组 ['sms']，字符串 'sms' 不生效\n` +
                `  ✗ 无短信时 Promise 永久 pending，必须 AbortController 超时\n` +
                `  ✗ 非 HTTPS / 非 Android Chrome 直接 reject 或 API 不存在\n` +
                `  ✗ credential.code 可能含空格（部分运营商），需 trim()`;
        }
        catch (err) {
            return `读取 credentials.get OTP 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runGetOtpDemo() {
        const f = this._flags();
        this.setState({ getOtpInfo: this._readGetOtpInfo() });
        this._addLog('info', `credentials.get 演示启动：OTPCredential=${f.otpCredential}（不支持环境将用模拟 OTP）`);
        this._tryGetOtp((code) => {
            const input = this.el && this.el.querySelector('.otp-input-2');
            if (input) {
                input.value = code;
                input.classList.add('otp-filled');
            }
            this.setState({ getOtpInfo: this._readGetOtpInfo() });
        });
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. navigator.credentials.get OTPCredential',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['OTPCredential', f.otpCredential], ['credentials.get', f.credentialsGet]]), h(Tag, { color: 'primary' }, 'Promise 异步')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.credentials.get({ otp: { transport: ["sms"] }, signal }) 异步等待短信，返回 OTPCredential（含 code 验证码、transport、id、type）。transport 目前仅支持 "sms"（必须为数组）。Promise 异步等待短信到达，无短信则永久 pending（必须 AbortController 超时中止）。credential.code 可能含空格需 trim()。完整流程：等待短信 → 拿到 code → 填充 input → 提交表单。非 HTTPS/非 Android Chrome 直接 reject 或 API 不存在。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('接收验证码', { type: 'primary', size: 'sm', disabled: !f.credentialsGet && !f.oneTimeCode, onClick: () => this._runGetOtpDemo() }), this._btn('读取信息', { size: 'sm', onClick: () => this.setState({ getOtpInfo: this._readGetOtpInfo() }) })),
                h('div', { class: 'otp-input-wrap' }, h('input', { class: 'otp-input otp-input-2', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: '点击「接收验证码」', maxlength: '6' })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.getOtpInfo || '（点击「接收验证码」查看 OTPCredential 完整说明；不支持环境用模拟 OTP）')),
                h(Alert, {
                    type: 'warning',
                    message: '无短信时 Promise 永久 pending，必须 AbortController 超时中止',
                    description: 'transport 必须为数组 ["sms"]，字符串不生效。无短信 Promise 永久 pending，必须 AbortController 超时（如 60 秒）。非 HTTPS/非 Android Chrome 直接 reject 或 API 不存在。credential.code 可能含空格需 trim()。jsdom 不实现，用模拟 OTP 演示流程。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：短信格式规范 ===================
    _readSmsFormatInfo() {
        const f = this._flags();
        try {
            return `===== WebOTP 短信格式规范 =====\n` +
                `\n` +
                `【短信格式】\n` +
                `  SMS 必须包含以下格式（最后一行）：\n` +
                `    @origin <URL> #<code> [<app hash>]\n` +
                `  示例：\n` +
                `    Your verification code is 123456\n` +
                `    @https://example.com #123456 8mA3Kp9xQ2L\n` +
                `\n` +
                `【格式详解】\n` +
                `  @origin https://example.com\n` +
                `    - @origin 关键字（必须）\n` +
                `    - 后跟当前页面 URL 的 origin（协议+域名+端口）\n` +
                `    - 浏览器校验：短信中的 origin 必须与当前页面 origin 匹配\n` +
                `    - 防钓鱼：恶意网站无法收到其他网站的短信\n` +
                `  #123456\n` +
                `    - # 关键字（必须）\n` +
                `    - 后跟验证码（数字或字母）\n` +
                `    - 浏览器提取此部分作为 credential.code\n` +
                `  8mA3Kp9xQ2L（App Hash，可选）\n` +
                `    - 11 位哈希（Android App Hash）\n` +
                `    - 唯一标识发送短信的 App/网站\n` +
                `    - Chrome Android 用此过滤：只处理匹配当前 App Hash 的短信\n` +
                `    - 不带 App Hash 也可工作（但安全性降低）\n` +
                `\n` +
                `【格式不匹配不触发】\n` +
                `  短信不符合上述格式 → WebOTP 不触发，credentials.get 继续 pending\n` +
                `  常见不匹配原因：\n` +
                `    - 缺少 @origin 或 # 关键字\n` +
                `    - origin 不匹配当前页面（防钓鱼）\n` +
                `    - App Hash 不匹配（Chrome Android）\n` +
                `    - 格式不在短信最后一行\n` +
                `\n` +
                `【与运营商短信过滤】\n` +
                `  Android 系统可能拦截/分类短信（如验证码短信归类）\n` +
                `  Chrome Android 用 Android SMS Retriever API 自动读取\n` +
                `  运营商可能附加广告/签名到短信，需保证 @origin #code 在末尾\n` +
                `\n` +
                `【兼容旧格式】\n` +
                `  旧短信格式：<#> Your code is 123456 8mA3Kp9xQ2L\n` +
                `    - <#> 前缀（Android SMS Retriever 旧格式）\n` +
                `    - 仍被部分系统识别\n` +
                `  新格式（WebOTP）：@origin <URL> #<code>\n` +
                `    - 推荐，更安全（origin 校验）\n` +
                `\n` +
                `【当前演示预览】\n` +
                `  模拟 SMS 内容：\n` +
                `    Your verification code is 123456\n` +
                `    @https://example.com #123456 8mA3Kp9xQ2L\n` +
                `  OTPCredential 可用 = ${f.otpCredential}\n` +
                `\n` +
                `【完整代码示例：服务端发送短信】\n` +
                `  # 服务端（Node.js 示例）\n` +
                `  const code = generateOtp();  // 6 位数字\n` +
                `  const origin = 'https://example.com';  // 当前页面 origin\n` +
                `  const appHash = '8mA3Kp9xQ2L';  // 11 位 App Hash\n` +
                `  const sms = \`Your verification code is \${code}.\\n@\${origin} #\${code} \${appHash}\`;\n` +
                `  await sendSms(userPhone, sms);\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ origin 必须与当前页面完全匹配（含协议/端口）\n` +
                `  ✗ @origin #code 必须在短信最后一行\n` +
                `  ✗ App Hash 是 11 位，需通过 Android Play Console 获取\n` +
                `  ✗ 短信被运营商附加内容可能破坏格式`;
        }
        catch (err) {
            return `读取短信格式规范信息失败：${err.name} - ${err.message}`;
        }
    }
    _runSmsFormatDemo() {
        this.setState({ smsFormatInfo: this._readSmsFormatInfo() });
        this._addLog('info', `短信格式演示：@origin <URL> #<code> [<app hash>]；OTPCredential=${this._flags().otpCredential}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. 短信格式规范 —— @origin <URL> #<code> [<app hash>]',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['OTPCredential', f.otpCredential]]), h(Tag, { color: 'warning' }, '格式严格')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'WebOTP 短信必须包含格式：@origin https://example.com #123456 [8mA3Kp9xQ2L]（最后一行）。@origin 后跟当前页面 URL 的 origin（防钓鱼：浏览器校验 origin 匹配），# 后跟验证码（提取为 credential.code），App Hash 11 位哈希（可选，Android App Hash 唯一标识发送 App）。格式不匹配不触发（缺关键字/origin 不匹配/App Hash 不匹配/不在最后一行）。与运营商短信过滤：Chrome Android 用 SMS Retriever API 自动读取，运营商附加内容需保证格式在末尾。兼容旧格式 <#> 前缀。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runSmsFormatDemo() })),
                h('div', { class: 'otp-sms-preview' }, '模拟 SMS 内容：\n', h('span', {}, 'Your verification code is '), h('span', { class: 'tag-code' }, '123456'), h('span', {}, '.\n'), h('span', { class: 'tag-origin' }, '@https://example.com'), h('span', {}, ' '), h('span', { class: 'tag-code' }, '#123456'), h('span', {}, ' '), h('span', { class: 'tag-hash' }, '8mA3Kp9xQ2L')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.smsFormatInfo || '（点击「运行演示」查看短信格式规范完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'origin 必须与当前页面完全匹配（防钓鱼），@origin #code 必须在短信最后一行',
                    description: '格式：@origin <URL> #<code> [<app hash>]。@origin 校验防钓鱼（恶意网站无法收到其他网站短信）。App Hash 11 位（Android Play Console 获取）。不匹配不触发。运营商附加内容需保证格式在末尾。兼容旧格式 <#> 前缀。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：abort 信号与超时 ===================
    _readAbortInfo() {
        const f = this._flags();
        try {
            return `===== abort 信号与超时 =====\n` +
                `\n` +
                `【API 签名】\n` +
                `  const ac = new AbortController();\n` +
                `  navigator.credentials.get({\n` +
                `    otp: { transport: ['sms'] },\n` +
                `    signal: ac.signal,  // 传入 abort 信号\n` +
                `  });\n` +
                `  ac.abort();  // 中止\n` +
                `  AbortController 可用 = ${f.abortController}\n` +
                `  AbortSignal 可用 = ${f.abortSignal}\n` +
                `\n` +
                `【中止场景】\n` +
                `  1. 超时中止：setTimeout(() => ac.abort(), 60000)\n` +
                `     防止 credentials.get 永久 pending（无短信时）\n` +
                `     推荐超时：60 秒（短信通常 30 秒内到达）\n` +
                `  2. 用户切换页面：visibilitychange 事件 → ac.abort()\n` +
                `     用户离开当前页面，不再需要等待短信\n` +
                `     防止后台 Promise 消耗资源\n` +
                `  3. 用户手动取消：取消按钮 → ac.abort()\n` +
                `     用户改用手动输入，主动中止等待\n` +
                `\n` +
                `【中止后行为】\n` +
                `  credentials.get Promise reject，err.name === 'AbortError'\n` +
                `  不会触发 OTPCredential 返回\n` +
                `  AbortError 应被静默处理（非真实错误）\n` +
                `\n` +
                `【完整代码示例：超时 + visibilitychange】\n` +
                `  const ac = new AbortController();\n` +
                `  // 60 秒超时\n` +
                `  const timer = setTimeout(() => ac.abort(), 60000);\n` +
                `  // 用户切换页面中止\n` +
                `  const onVis = () => {\n` +
                `    if (document.visibilityState === 'hidden') ac.abort();\n` +
                `  };\n` +
                `  document.addEventListener('visibilitychange', onVis);\n` +
                `\n` +
                `  navigator.credentials.get({\n` +
                `    otp: { transport: ['sms'] },\n` +
                `    signal: ac.signal,\n` +
                `  }).then((cred: any) => {\n` +
                `    if (cred) input.value = cred.code;\n` +
                `  }).catch((err: any) => {\n` +
                `    if (err.name !== 'AbortError') console.warn(err);\n` +
                `  }).finally(() => {\n` +
                `    clearTimeout(timer);\n` +
                `    document.removeEventListener('visibilitychange', onVis);\n` +
                `  });\n` +
                `\n` +
                `【防止悬挂 Promise】\n` +
                `  credentials.get 无短信时永久 pending\n` +
                `  不中止会导致：\n` +
                `    - Promise 永不 resolve/reject，内存泄漏\n` +
                `    - 页面切换后仍占用 SMS 监听资源\n` +
                `    - 多次调用累积多个 pending Promise\n` +
                `  解决：始终绑定 AbortController + 超时 + visibilitychange\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ 不设超时 → Promise 永久 pending（资源泄漏）\n` +
                `  ✗ 不处理 AbortError → 控制台报错（应静默）\n` +
                `  ✗ 多次调用 credentials.get 累积 pending（需先 abort 旧的）`;
        }
        catch (err) {
            return `读取 abort 信号信息失败：${err.name} - ${err.message}`;
        }
    }
    _runAbortDemo() {
        const f = this._flags();
        this.setState({ abortInfo: this._readAbortInfo() });
        if (!f.abortController) {
            this._addLog('warn', 'AbortController 不可用（jsdom 不实现），无法演示中止；真实浏览器全支持');
            return;
        }
        // 演示：启动后 3 秒自动中止（用模拟 OTP 但提前 abort）
        const ac = new AbortController();
        this._abortControllers.push(ac);
        this._addLog('info', 'AbortController 已创建，3 秒后将自动 abort()（演示中止流程）');
        const timer = setTimeout(() => {
            if (this._destroyed)
                return;
            try {
                ac.abort();
                this._addLog('warn', 'AbortController.abort() 已调用（演示中止：err.name === "AbortError"）');
            }
            catch (err) {
                this._addLog('warn', `abort 调用异常：${err.name} - ${err.message}`);
            }
        }, 3000);
        this._abortControllers.push({ abort: () => clearTimeout(timer) });
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. abort 信号与超时 —— AbortController 中止',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['AbortController', f.abortController], ['AbortSignal', f.abortSignal]]), h(Tag, { color: 'primary' }, '防悬挂 Promise')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.credentials.get({ otp, signal: ac.signal }) 通过 AbortController 中止等待。中止场景：超时（setTimeout 60 秒，防永久 pending）、用户切换页面（visibilitychange → hidden 时 abort）、用户手动取消（取消按钮）。中止后 Promise reject，err.name === "AbortError"（应静默处理）。防止悬挂 Promise：不中止会导致 Promise 永不 resolve/reject 内存泄漏、页面切换后仍占用 SMS 监听资源、多次调用累积 pending。解决：始终绑定 AbortController + 超时 + visibilitychange。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示（3 秒后中止）', { type: 'primary', size: 'sm', disabled: !f.abortController, onClick: () => this._runAbortDemo() }), this._btn('读取信息', { size: 'sm', onClick: () => this.setState({ abortInfo: this._readAbortInfo() }) })),
                h('div', { class: 'otp-output' }, '点击「运行演示」后 3 秒将触发 abort()（见日志）'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.abortInfo || '（点击「运行演示」查看 abort 信号完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: '不设超时 → Promise 永久 pending（资源泄漏），AbortError 应静默处理',
                    description: 'credentials.get 无短信时永久 pending，必须 AbortController 超时中止（60 秒）+ visibilitychange 切换页面中止。AbortError 应静默处理（非真实错误）。多次调用需先 abort 旧的，避免累积 pending Promise。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：autocomplete="one-time-code" ===================
    _readAutocompleteInfo() {
        const f = this._flags();
        try {
            const input = this.el && this.el.querySelector('.otp-input-otc');
            let hasAutocomplete = '(未渲染)';
            if (input)
                hasAutocomplete = input.getAttribute('autocomplete') || '(空)';
            return `===== autocomplete="one-time-code" =====\n` +
                `\n` +
                `【HTML 属性】\n` +
                `  <input autocomplete="one-time-code" inputmode="numeric" />\n` +
                `  autocomplete="one-time-code" 是 HTML 标准属性（非 WebOTP API）\n` +
                `  浏览器识别此值，收到短信后自动填充\n` +
                `  当前 .otp-input-otc autocomplete="${hasAutocomplete}"\n` +
                `  one-time-code 支持 = ${f.oneTimeCode}\n` +
                `\n` +
                `【与 WebOTP API 协同】\n` +
                `  WebOTP API（navigator.credentials.get）：主动请求验证码，JS 控制\n` +
                `  autocomplete="one-time-code"：声明式，浏览器自动检测短信填充\n` +
                `  两者可同时使用：\n` +
                `    <input autocomplete="one-time-code" />\n` +
                `    <script>navigator.credentials.get({otp:{transport:['sms']}})</script>\n` +
                `  WebOTP API 优先（更可控），autocomplete 作为降级\n` +
                `\n` +
                `【浏览器自动填充】\n` +
                `  iOS Safari：支持 autocomplete="one-time-code"（但不支持 WebOTP API）\n` +
                `    收到短信后弹出"填充验证码"建议，点击自动填充\n` +
                `  Chrome Android：同时支持 WebOTP API 和 autocomplete\n` +
                `  Chrome 桌面/Firefox：autocomplete="one-time-code" 部分支持\n` +
                `\n` +
                `【跨平台降级方案】\n` +
                `  Android Chrome：WebOTP API（首选）+ autocomplete（降级）\n` +
                `  iOS Safari：仅 autocomplete="one-time-code"（无 WebOTP API）\n` +
                `  桌面浏览器：autocomplete="one-time-code"（部分支持）+ 手动输入\n` +
                `  老浏览器：纯手动输入\n` +
                `\n` +
                `【最佳实践：同时使用】\n` +
                `  <form>\n` +
                `    <input \n` +
                `      type="text" \n` +
                `      inputmode="numeric" \n` +
                `      autocomplete="one-time-code" \n` +
                `      pattern="\\d{6}" \n` +
                `      maxlength="6" \n` +
                `      required />\n` +
                `  </form>\n` +
                `  <script>\n` +
                `    if ('OTPCredential' in window) {\n` +
                `      // Android Chrome：WebOTP API 主动获取\n` +
                `      navigator.credentials.get({ otp: { transport: ['sms'] } })\n` +
                `        .then((cred: any) => { if (cred) input.value = cred.code; });\n` +
                `    }\n` +
                `    // iOS Safari / 其他：依赖 autocomplete 自动填充\n` +
                `  </script>\n` +
                `\n` +
                `【inputmode="numeric"】\n` +
                `  移动端弹出数字键盘（而非全键盘）\n` +
                `  提升验证码输入体验\n` +
                `  配合 autocomplete="one-time-code" 效果最佳\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ autocomplete="one-time-code" 不是 WebOTP API（易混淆）\n` +
                `  ✗ iOS Safari 仅支持 autocomplete，不支持 WebOTP API\n` +
                `  ✗ 部分浏览器需用户点击"填充建议"（非全自动）`;
        }
        catch (err) {
            return `读取 autocomplete 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runAutocompleteDemo() {
        this.setState({ autocompleteInfo: this._readAutocompleteInfo() });
        this._addLog('info', `autocomplete="one-time-code" 演示：one-time-code 支持=${this._flags().oneTimeCode}（iOS Safari 降级方案）`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. autocomplete="one-time-code" —— 跨平台降级',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['one-time-code', f.oneTimeCode]]), h(Tag, { color: 'success' }, 'iOS Safari 支持')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'autocomplete="one-time-code" 是 HTML 标准属性（非 WebOTP API），浏览器识别后收到短信自动填充。与 WebOTP API 协同：WebOTP API 主动请求（JS 控制，Android Chrome 首选），autocomplete 声明式自动检测（降级）。iOS Safari 支持 autocomplete（但不支持 WebOTP API），收到短信弹"填充验证码"建议。跨平台降级：Android Chrome 用 WebOTP API + autocomplete，iOS Safari 仅 autocomplete，桌面部分支持 + 手动输入。最佳实践：同时使用，配 inputmode="numeric" 弹数字键盘。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runAutocompleteDemo() })),
                h('div', { class: 'otp-autocomplete-stage' }, '跨平台降级输入框（iOS Safari 也能自动填充）：', h('div', { class: 'otp-input-wrap' }, h('input', { class: 'otp-input otp-input-otc', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]*', maxlength: '6', placeholder: '123456' })), h('div', { style: { marginTop: '6px', fontSize: '12px' } }, 'iOS Safari 收到短信会弹出"填充验证码"建议；Android Chrome 同时支持 WebOTP API 和 autocomplete。')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.autocompleteInfo || '（点击「运行演示」查看 autocomplete="one-time-code" 完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'autocomplete="one-time-code" 是 HTML 标准属性，iOS Safari 也支持（非 WebOTP API）',
                    description: '与 WebOTP API 协同：WebOTP API 主动请求（Android Chrome 首选），autocomplete 声明式降级（iOS Safari/桌面）。最佳实践同时使用 + inputmode="numeric"。autocomplete 不是 WebOTP API，易混淆。部分浏览器需用户点击"填充建议"。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：实战 - 登录验证码自动填充 ===================
    _readLoginFlowInfo() {
        const f = this._flags();
        try {
            return `===== 实战：登录验证码自动填充流程 =====\n` +
                `\n` +
                `【完整流程】\n` +
                `  1. 用户输入手机号 → 点击"发送验证码" → 服务端发送短信\n` +
                `  2. 前端 input focus + 调用 navigator.credentials.get({ otp })\n` +
                `  3. 浏览器等待短信（Promise pending）\n` +
                `  4. 短信到达 → credentials.get resolve → credential.code\n` +
                `  5. 自动填充 input.value = cred.code\n` +
                `  6. 自动提交表单 form.submit()\n` +
                `\n` +
                `【用户切换/超时处理】\n` +
                `  - 用户切换页面：visibilitychange → abort()，停止等待\n` +
                `  - 超时（60 秒）：abort()，提示用户手动输入\n` +
                `  - 用户手动输入：监听 input 事件 → abort()（避免冲突）\n` +
                `\n` +
                `【当前模拟流程状态】\n` +
                `  OTPCredential 可用 = ${f.otpCredential}\n` +
                `  AbortController 可用 = ${f.abortController}\n` +
                `  （点击「运行演示」启动模拟流程，不支持环境用模拟 OTP）\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  const form = document.querySelector('#login-form');\n` +
                `  const phoneInput = document.querySelector('#phone');\n` +
                `  const codeInput = document.querySelector('#code');\n` +
                `  let ac = null;\n` +
                `\n` +
                `  // 步骤 1：发送验证码\n` +
                `  document.querySelector('#send').addEventListener('click', async () => {\n` +
                `    await fetch('/api/send-sms', { \n` +
                `      method: 'POST', \n` +
                `      body: JSON.stringify({ phone: phoneInput.value }) \n` +
                `    });\n` +
                `    // 步骤 2：开始监听短信\n` +
                `    startOtpListener();\n` +
                `  });\n` +
                `\n` +
                `  function startOtpListener() {\n` +
                `    if (!('OTPCredential' in window)) return;  // 不支持则降级手动输入\n` +
                `    ac = new AbortController();\n` +
                `    const timer = setTimeout(() => ac.abort(), 60000);\n` +
                `    const onVis = () => {\n` +
                `      if (document.visibilityState === 'hidden') ac.abort();\n` +
                `    };\n` +
                `    document.addEventListener('visibilitychange', onVis);\n` +
                `\n` +
                `    navigator.credentials.get({\n` +
                `      otp: { transport: ['sms'] },\n` +
                `      signal: ac.signal,\n` +
                `    }).then((cred: any) => {\n` +
                `      // 步骤 5：自动填充\n` +
                `      codeInput.value = cred.code;\n` +
                `      // 步骤 6：自动提交\n` +
                `      form.submit();\n` +
                `    }).catch((err: any) => {\n` +
                `      if (err.name !== 'AbortError') console.warn(err);\n` +
                `    }).finally(() => {\n` +
                `      clearTimeout(timer);\n` +
                `      document.removeEventListener('visibilitychange', onVis);\n` +
                `    });\n` +
                `  }\n` +
                `\n` +
                `  // 用户手动输入时中止 WebOTP\n` +
                `  codeInput.addEventListener('input', () => {\n` +
                `    if (ac) ac.abort();\n` +
                `  });\n` +
                `\n` +
                `【与现有登录流程集成】\n` +
                `  - 渐进增强：先检测 OTPCredential，不支持则跳过（保持手动输入）\n` +
                `  - 不破坏现有流程：WebOTP 仅加速，失败时降级手动输入\n` +
                `  - 表单仍需 pattern + maxlength 校验\n` +
                `  - 提交仍需服务端校验（WebOTP 仅前端填充，不可信）\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ 不要 await credentials.get 阻塞 UI（用 .then 异步）\n` +
                `  ✗ 自动提交前确认用户意图（部分场景需用户确认）\n` +
                `  ✗ 服务端必须校验验证码（前端填充不可信）`;
        }
        catch (err) {
            return `读取登录流程信息失败：${err.name} - ${err.message}`;
        }
    }
    _runLoginFlowDemo() {
        const f = this._flags();
        this.setState({ loginFlowInfo: this._readLoginFlowInfo() });
        this._addLog('info', `登录流程演示启动：发送短信 → credentials.get → 自动填充 → 提交（不支持环境用模拟 OTP）`);
        // 模拟流程：标记 step 状态
        const steps = this.el && this.el.querySelectorAll('.otp-login-flow .step');
        if (steps && steps.length >= 5) {
            steps[0].classList.add('done');
            steps[1].classList.add('active');
        }
        this._tryGetOtp((code) => {
            const input = this.el && this.el.querySelector('.otp-input-login');
            if (input) {
                input.value = code;
                input.classList.add('otp-filled');
            }
            if (steps && steps.length >= 5) {
                steps[1].classList.remove('active');
                steps[1].classList.add('done');
                steps[2].classList.add('done');
                steps[3].classList.add('done');
                steps[4].classList.add('done');
            }
            this._addLog('success', `登录流程完成：验证码 ${code} 已自动填充，模拟提交表单`);
        });
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 实战：登录验证码自动填充流程',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['OTPCredential', f.otpCredential], ['AbortController', f.abortController]]), h(Tag, { color: 'primary' }, '渐进增强')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '完整流程：发送短信 → input focus + credentials.get → 浏览器等待 → 短信到达 resolve → 自动填充 → 自动提交。用户切换/超时处理：visibilitychange/60 秒超时/手动输入 abort()。与现有登录流程集成：渐进增强（不支持跳过，保持手动输入）、不破坏现有流程（WebOTP 仅加速）、表单仍需 pattern+maxlength 校验、提交仍需服务端校验（前端填充不可信）。陷阱：不要 await 阻塞 UI（用 .then 异步）、自动提交前确认用户意图、服务端必须校验。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runLoginFlowDemo() })),
                h('div', { class: 'otp-login-flow' }, h('div', { class: 'step' }, h('span', { class: 'step-num' }, '1'), h('span', {}, '发送短信（用户输入手机号，点击发送）')), h('div', { class: 'step' }, h('span', { class: 'step-num' }, '2'), h('span', {}, 'input focus + navigator.credentials.get({ otp })')), h('div', { class: 'step' }, h('span', { class: 'step-num' }, '3'), h('span', {}, '浏览器等待短信到达（Promise pending）')), h('div', { class: 'step' }, h('span', { class: 'step-num' }, '4'), h('span', {}, '自动填充 input.value = cred.code')), h('div', { class: 'step' }, h('span', { class: 'step-num' }, '5'), h('span', {}, '自动提交表单 form.submit()'))),
                h('div', { class: 'otp-input-wrap' }, h('input', { class: 'otp-input otp-input-login', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '验证码自动填充到此' })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.loginFlowInfo || '（点击「运行演示」查看登录验证码自动填充完整流程）')),
                h(Alert, {
                    type: 'info',
                    message: '渐进增强：不支持 WebOTP 则跳过，保持手动输入；服务端必须校验（前端填充不可信）',
                    description: '完整流程：发送 → credentials.get → 等待 → 填充 → 提交。visibilitychange/超时/手动输入 abort()。渐进增强不破坏现有流程，表单仍需 pattern+maxlength 校验，提交仍需服务端校验。不要 await 阻塞 UI，自动提交前确认用户意图。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：实战 - 双因素认证 2FA ===================
    _readTwoFaInfo() {
        const f = this._flags();
        try {
            return `===== 实战：双因素认证 2FA =====\n` +
                `\n` +
                `【TOTP 与 SMS OTP 区别】\n` +
                `  SMS OTP：短信发送验证码，WebOTP API 支持\n` +
                `    依赖手机号 + 短信通道，易被 SIM 交换攻击\n` +
                `    用户体验好（无需安装 App），但安全性较低\n` +
                `  TOTP（Time-based OTP）：Google Authenticator 等 App 生成\n` +
                `    基于时间 + 共享密钥，离线生成 6 位码\n` +
                `    安全性高，但需安装 App，用户体验稍差\n` +
                `    WebOTP API 不支持 TOTP（仅 SMS）\n` +
                `\n` +
                `【WebOTP 仅支持 SMS】\n` +
                `  WebOTP API 仅支持 SMS OTP（transport: ['sms']）\n` +
                `  TOTP 由用户手动输入（Authenticator App 显示）\n` +
                `  WebAuthn 是另一种强凭据（生物/硬件），非 OTP\n` +
                `\n` +
                `【与 WebAuthn 协同】\n` +
                `  WebAuthn（强凭据）：指纹/Face ID/安全密钥，抗钓鱼\n` +
                `    作为主凭据，日常登录用\n` +
                `  SMS OTP（弱凭据）：作为备用/账户恢复\n` +
                `    WebAuthn 不可用时（如换设备）用 SMS OTP\n` +
                `  典型架构：\n` +
                `    主登录：WebAuthn（navigator.credentials.get({ publicKey })）\n` +
                `    备用：SMS OTP（navigator.credentials.get({ otp })）\n` +
                `    账户恢复：SMS OTP + 邮箱验证\n` +
                `\n` +
                `【当前环境能力检测】\n` +
                `  OTPCredential 可用 = ${f.otpCredential}\n` +
                `  WebAuthn 可用 = ${f.webAuthn}\n` +
                `  SecureContext = ${f.secureContext}\n` +
                `\n` +
                `【完整代码示例：WebAuthn + SMS OTP 协同】\n` +
                `  async function login() {\n` +
                `    // 优先 WebAuthn（强凭据）\n` +
                `    if (window.PublicKeyCredential) {\n` +
                `      try {\n` +
                `        const cred = await navigator.credentials.get({\n` +
                `          publicKey: buildPublicKeyOptions(),\n` +
                `        });\n` +
                `        return verifyWebAuthn(cred);\n` +
                `      } catch (err: any) {\n` +
                `        // WebAuthn 失败，降级 SMS OTP\n` +
                `        console.warn('WebAuthn 失败，降级 SMS OTP');\n` +
                `      }\n` +
                `    }\n` +
                `    // 降级 SMS OTP\n` +
                `    if ('OTPCredential' in window) {\n` +
                `      const cred = await navigator.credentials.get({\n` +
                `        otp: { transport: ['sms'] },\n` +
                `      });\n` +
                `      return verifySmsOtp(cred.code);\n` +
                `    }\n` +
                `    // 最终降级：手动输入\n` +
                `    return manualInput();\n` +
                `  }\n` +
                `\n` +
                `【降级方案链】\n` +
                `  1. WebAuthn（最强，抗钓鱼）\n` +
                `  2. SMS OTP via WebOTP API（Android Chrome）\n` +
                `  3. SMS OTP via autocomplete="one-time-code"（iOS Safari）\n` +
                `  4. SMS OTP 手动输入（兜底）\n` +
                `  5. TOTP 手动输入（Authenticator App）\n` +
                `\n` +
                `【陷阱】\n` +
                `  ✗ SMS OTP 易被 SIM 交换攻击，不应作为唯一凭据\n` +
                `  ✗ WebOTP 不支持 TOTP（仅 SMS）\n` +
                `  ✗ WebAuthn 失败需优雅降级（避免锁死用户）\n` +
                `  ✗ 账户恢复流程需额外安全（避免成为弱点）`;
        }
        catch (err) {
            return `读取 2FA 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runTwoFaDemo() {
        this.setState({ twoFaInfo: this._readTwoFaInfo() });
        this._addLog('info', `2FA 演示：OTPCredential=${this._flags().otpCredential}, WebAuthn=${this._flags().webAuthn}（WebAuthn 主 + SMS OTP 备用）`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 实战：双因素认证 2FA',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['OTPCredential', f.otpCredential], ['WebAuthn', f.webAuthn]]), h(Tag, { color: 'primary' }, 'WebAuthn 协同')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'TOTP 与 SMS OTP 区别：SMS OTP（WebOTP 支持，依赖手机号+短信通道，易被 SIM 交换攻击，体验好但安全性低）；TOTP（Google Authenticator 基于 time+共享密钥离线生成，安全性高但需装 App，WebOTP 不支持 TOTP 仅 SMS）。与 WebAuthn 协同：WebAuthn（指纹/Face ID/安全密钥，抗钓鱼）作主凭据日常登录，SMS OTP 作备用/账户恢复。降级方案链：WebAuthn → WebOTP API → autocomplete → 手动输入 → TOTP。陷阱：SMS OTP 不应作唯一凭据（SIM 交换攻击）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runTwoFaDemo() })),
                h('table', { class: 'otp-2fa-table' }, h('thead', {}, h('tr', {}, h('th', {}, '方案'), h('th', {}, '凭据类型'), h('th', {}, 'WebOTP 支持'), h('th', {}, '抗钓鱼'), h('th', {}, '体验'))), h('tbody', {}, h('tr', {}, h('td', {}, 'WebAuthn'), h('td', {}, '生物/硬件'), h('td', { class: 'no' }, '✗'), h('td', { class: 'yes' }, '✓'), h('td', {}, '好')), h('tr', {}, h('td', {}, 'SMS OTP'), h('td', {}, '短信验证码'), h('td', { class: 'yes' }, '✓'), h('td', { class: 'no' }, '✗'), h('td', {}, '好')), h('tr', {}, h('td', {}, 'TOTP'), h('td', {}, '时间一次性码'), h('td', { class: 'no' }, '✗'), h('td', { class: 'partial' }, '部分'), h('td', {}, '中')))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.twoFaInfo || '（点击「运行演示」查看 2FA WebAuthn + SMS OTP 协同完整代码）')),
                h(Alert, {
                    type: 'warning',
                    message: 'SMS OTP 易被 SIM 交换攻击，不应作为唯一凭据；WebOTP 不支持 TOTP（仅 SMS）',
                    description: '与 WebAuthn 协同：WebAuthn 主凭据（抗钓鱼），SMS OTP 备用/账户恢复。降级链：WebAuthn → WebOTP API → autocomplete → 手动输入 → TOTP。SMS OTP 不应作唯一凭据。WebAuthn 失败需优雅降级避免锁死用户。账户恢复流程需额外安全。',
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
            return `===== WebOTP 陷阱与最佳实践 =====\n` +
                `\n` +
                `【陷阱 1：仅 Android Chrome 支持】\n` +
                `  WebOTP API 仅 Chrome Android 84+/Edge Android 84+ 支持\n` +
                `  iOS Safari/Firefox/桌面浏览器 不支持\n` +
                `  解决：能力检测 'OTPCredential' in window，不支持则降级\n` +
                `  代码：\n` +
                `    if ('OTPCredential' in window) {\n` +
                `      // Android Chrome：WebOTP API\n` +
                `    } else {\n` +
                `      // 其他：autocomplete="one-time-code" + 手动输入\n` +
                `    }\n` +
                `\n` +
                `【陷阱 2：必须 HTTPS】\n` +
                `  WebOTP 必须安全上下文（window.isSecureContext === true）\n` +
                `  HTTPS 或 localhost，http:// 远端被禁用\n` +
                `  防止中间人攻击窃取验证码\n` +
                `  SecureContext = ${f.secureContext}\n` +
                `\n` +
                `【陷阱 3：SMS 格式严格】\n` +
                `  短信必须符合 @origin <URL> #<code> [<app hash>] 格式\n` +
                `  origin 必须与当前页面完全匹配（防钓鱼）\n` +
                `  @origin #code 必须在短信最后一行\n` +
                `  App Hash 11 位（Android Play Console 获取）\n` +
                `  格式不匹配不触发（credentials.get 继续 pending）\n` +
                `\n` +
                `【陷阱 4：用户手势要求】\n` +
                `  部分浏览器要求用户手势触发 credentials.get\n` +
                `  如：用户点击"发送验证码"按钮后才能调用\n` +
                `  非 user gesture 调用可能被拒绝\n` +
                `  解决：在 click 事件回调内调用\n` +
                `\n` +
                `【陷阱 5：隐私考虑（不暴露短信全文）】\n` +
                `  WebOTP 仅暴露 credential.code（验证码），不暴露短信全文\n` +
                `  浏览器校验 origin 匹配后才返回 code\n` +
                `  保护用户隐私：恶意网站无法读取其他网站短信\n` +
                `  但服务端短信内容仍需谨慎（避免泄露敏感信息）\n` +
                `\n` +
                `【陷阱 6：与 navigator.credentials 其他类型协同】\n` +
                `  Credential Management API 支持多种凭据类型：\n` +
                `    - PasswordCredential：账号密码\n` +
                `    - FederatedCredential：联合登录（Google/Facebook）\n` +
                `    - PublicKeyCredential：WebAuthn（生物/硬件）\n` +
                `    - OTPCredential：WebOTP（短信验证码）\n` +
                `  credentials.get({ password: true }) 与 credentials.get({ otp }) 互斥\n` +
                `  不能同时请求多种类型（一次只能一种）\n` +
                `\n` +
                `【陷阱 7：安全考虑（防钓鱼）】\n` +
                `  SMS OTP 易被 SIM 交换攻击（攻击者骗运营商换 SIM 卡）\n` +
                `  钓鱼网站可能诱导用户输入验证码\n` +
                `  WebOTP 防护：origin 校验（仅匹配页面收到 code）\n` +
                `  但仍有风险：\n` +
                `    - SIM 交换攻击（WebOTP 无法防）\n` +
                `    - 中间人攻击（HTTPS 缓解）\n` +
                `    - 用户主动转发验证码（社会工程，无法防）\n` +
                `  建议：高安全场景用 WebAuthn 替代 SMS OTP\n` +
                `\n` +
                `【最佳实践清单】\n` +
                `  ✓ 能力检测 'OTPCredential' in window，不支持降级\n` +
                `  ✓ 必须 HTTPS（安全上下文）\n` +
                `  ✓ SMS 格式严格 @origin <URL> #<code> [<app hash>]\n` +
                `  ✓ origin 与当前页面匹配，@origin #code 在最后一行\n` +
                `  ✓ 用户手势触发（click 回调内调用）\n` +
                `  ✓ AbortController 超时 + visibilitychange 中止\n` +
                `  ✓ 同时使用 autocomplete="one-time-code" 跨平台降级\n` +
                `  ✓ inputmode="numeric" 弹数字键盘\n` +
                `  ✓ 服务端必须校验验证码（前端填充不可信）\n` +
                `  ✓ 高安全场景用 WebAuthn 替代 SMS OTP\n` +
                `  ✓ 不阻塞 UI（用 .then 异步，不 await）\n` +
                `  ✓ AbortError 静默处理（非真实错误）\n` +
                `\n` +
                `  OTPCredential 可用 = ${f.otpCredential}\n` +
                `  SecureContext = ${f.secureContext}`;
        }
        catch (err) {
            return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPitfallsDemo() {
        this.setState({ pitfallsInfo: this._readPitfallsInfo() });
        this._addLog('info', `陷阱与最佳实践演示完成；OTPCredential=${this._flags().otpCredential}, secureContext=${this._flags().secureContext}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 陷阱与最佳实践 —— Android only/HTTPS/格式/手势/隐私/安全',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['OTPCredential', f.otpCredential], ['SecureContext', f.secureContext]]), h(Tag, { color: 'warning' }, '7 大陷阱')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '七大陷阱：仅 Android Chrome 84+ 支持（降级 autocomplete）；必须 HTTPS（安全上下文防中间人）；SMS 格式严格（@origin <URL> #<code> [<app hash>]，origin 匹配防钓鱼，最后一行）；用户手势要求（click 回调内调用）；隐私考虑（仅暴露 code 不暴露全文，origin 校验）；与 credentials 其他类型协同（一次只能一种凭据类型，password/otp/publicKey 互斥）；安全考虑（SIM 交换攻击，高安全用 WebAuthn 替代）。最佳实践清单 12 条覆盖能力检测、HTTPS、格式、手势、AbortController、autocomplete、inputmode、服务端校验、WebAuthn、异步、AbortError 静默。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.pitfallsInfo || '（点击「运行演示」查看 7 大陷阱与 12 条最佳实践完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: '仅 Android Chrome 84+ 支持；必须 HTTPS；SMS OTP 易被 SIM 交换攻击，高安全用 WebAuthn',
                    description: '陷阱清单：Android only（降级 autocomplete）、HTTPS、SMS 格式严格（origin 匹配防钓鱼）、用户手势、隐私（仅 code）、credentials 类型互斥、SIM 交换安全。最佳实践：能力检测、HTTPS、格式、手势、AbortController、autocomplete、inputmode、服务端校验、WebAuthn、异步、AbortError 静默。',
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
        return h('div', { class: 'api-lab-page web-otp-api-page' }, h('h2', { class: 'section-title' }, 'WebOTP API 短信验证码完整实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 WebOTP API（OTPCredential，W3C/WICG 规范）全套能力：概述与动机、navigator.credentials.get OTPCredential、短信格式规范（@origin #code）、abort 信号与超时、autocomplete="one-time-code" 跨平台降级、登录验证码自动填充实战、双因素认证 2FA（与 WebAuthn 协同）、陷阱与最佳实践。所有特性通过 typeof / in 能力检测，不可用时仅记日志（部分用模拟 OTP 演示流程），绝不抛异常。jsdom 不实现 WebOTP，仅 Android Chrome 84+ 支持，必须 HTTPS。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()), this._renderLogPanel());
    }
}
//# sourceMappingURL=WebOTPAPIPage.js.map