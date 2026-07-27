// =====================================================================
// WebSmartCardAPIPage.js —— Web Smart Card API 智能卡/eID/数字签名实验室
// 演示 W3C Web Smart Card API 提案（基于 PC/SC 模型，通过浏览器直接访问智能卡）：
//   1. 概念与 PC/SC 模型
//      PC/SC 工作组模型（IFD/ICC/ICC 资源管理器）+ APDU 命令/响应
//      navigator.smartCard 入口 + 与 WebUSB/WebHID 实现智能卡的差异
//      浏览器支持（Chromium 提案阶段，需 flag）
//   2. SmartCardContext 生命周期
//      SmartCardContext.establishContext() + PCSCInterface（pcsc 透传 PC/SC 错误码）
//      releaseContext 生命周期 + smart-card 权限策略
//   3. 读卡器列举与热插拔
//      SmartCardContext.listReaders() + 读卡器热插拔事件
//      SmartCardRequest/SmartCardStatus 状态机
//   4. 连接与协议
//      SmartCardConnection.connect()/disconnect() + 协议 T=0/T=1/raw
//      isConnected + ATR 解析
//   5. APDU 传输
//      SmartCardConnection.transmit(PCSCCommand) + APDU 拼装（CLA/INS/P1/P2/Lc/Data/Le）
//      响应 SW1/SW2 解析 + 长响应链（GET RESPONSE）
//   6. eID 实战
//      读取 eID 卡片信息（MF/DF/EF 文件结构、SELECT、READ BINARY）
//      PIN 验证（VERIFY）+ 数字签名（PSO Perform Security Operation）
//   7. PAdES 数字签名
//      PDF PAdES 数字签名（PKCS#11 → Web Crypto + Smart Card + PDF.js）
//      与 WebAuthn 协同
//   8. 权限与安全
//      smart-card Permission Policy + HTTPS/localhost 限制
//      能力检测与降级（WebUSB 直连 CCID 读卡器）
//      安全考虑（PIN 输入界面隔离、计时攻击防护）
// 说明：Web Smart Card API 仅在真实浏览器（Chromium 提案阶段，需 flag）中可用。
//       jsdom/Node 环境 navigator.smartCard 与 SmartCardContext 全部为 undefined，
//       所有 API 调用前做 typeof/in 检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常；真实浏览器配合 PC/SC 驱动的读卡器可完整体验。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class WebSmartCardAPIPage extends Page {
    _connection;
    _context;
    _dynamicStyles;
    _inited;
    _readerUnbind;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概念与 PC/SC 模型
            contextInfo: '', // Card 2：SmartCardContext 生命周期
            readersInfo: '', // Card 3：读卡器列举与热插拔
            connectInfo: '', // Card 4：连接与协议
            apduInfo: '', // Card 5：APDU 传输
            eidInfo: '', // Card 6：eID 实战
            padesInfo: '', // Card 7：PAdES 数字签名
            securityInfo: '', // Card 8：权限与安全
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        // —— 初始化 refs：动态样式表 + SmartCardContext/Connection 句柄 ——
        this._dynamicStyles = [];
        this._context = null; // SmartCardContext 实例（establishContext 后持有）
        this._connection = null; // SmartCardConnection 实例（connect 后持有）
        this._readerUnbind = null; // 读卡器热插拔事件解绑函数
        // —— 能力检测：navigator.smartCard / SmartCardContext，jsdom 中均不存在 ——
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `navigator.smartCard ${c(f.smartCard)}`,
            `SmartCardContext ${c(f.smartCardContext)}`,
            `PCSCInterface ${c(f.pcscInterface)}`,
            `SmartCardConnection ${c(f.smartCardConnection)}`,
            `PermissionPolicy ${c(f.permissionPolicy)}`,
        ];
        const any = f.smartCard || f.smartCardContext;
        const summary = any
            ? `Web Smart Card API 能力检测：${parts.join(' · ')}。当前环境部分支持，配合 PC/SC 读卡器可真实收发 APDU；数字签名涉及 PIN 输入，需用户手势与安全上下文。`
            : `Web Smart Card API 能力检测：${parts.join(' · ')}。jsdom/Node 环境无 navigator.smartCard/SmartCardContext，所有按钮点击仅记日志说明，不会抛异常；真实浏览器（Chromium 提案阶段，需 flag）配合 PC/SC 驱动读卡器可完整体验。`;
        this.setState({ capsSummary: summary });
        this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.smartCard)
            this._addLog('warn', 'navigator.smartCard 不可用（jsdom 无 Smart Card API，真实浏览器需 Chromium 提案 flag）');
        if (!f.smartCardContext)
            this._addLog('warn', 'SmartCardContext 不可用（establishContext 入口缺失）');
        if (!f.pcscInterface)
            this._addLog('warn', 'PCSCInterface 不可用（pcsc 透传 PC/SC 错误码的接口未暴露）');
        if (!f.smartCardConnection)
            this._addLog('warn', 'SmartCardConnection 不可用（connect/transmit 入口缺失）');
        if (!f.permissionPolicy)
            this._addLog('warn', 'Permissions-Policy: smart-card 未声明或 document.policy 不可用');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        // 1. 释放 SmartCardConnection（若已 connect）
        if (this._connection) {
            try {
                if (typeof this._connection.isConnected === 'boolean' ? this._connection.isConnected : true) {
                    this._connection.disconnect?.();
                }
            }
            catch { /* noop */ }
            this._connection = null;
        }
        // 2. 释放 SmartCardContext（若已 establishContext）
        if (this._context) {
            try {
                this._context.releaseContext?.();
            }
            catch { /* noop */ }
            this._context = null;
        }
        // 3. 解绑读卡器热插拔事件
        if (this._readerUnbind) {
            try {
                this._readerUnbind();
            }
            catch { /* noop */ }
            this._readerUnbind = null;
        }
        // 4. 移除动态注入的样式
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    // —— 辅助方法 ——
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    _flags() {
        const safe = (fn) => {
            try {
                return fn();
            }
            catch {
                return false;
            }
        };
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        const win = typeof window !== 'undefined' ? window : null;
        const doc = typeof document !== 'undefined' ? document : null;
        return {
            smartCard: safe(() => 'smartCard' in nav && typeof nav.smartCard === 'object' && nav.smartCard !== null),
            smartCardContext: safe(() => typeof win.SmartCardContext === 'function' || (nav.smartCard && typeof nav.smartCard.SmartCardContext === 'function')),
            pcscInterface: safe(() => typeof win.PCSCInterface === 'object' || (nav.smartCard && typeof nav.smartCard.PCSCInterface === 'object')),
            smartCardConnection: safe(() => typeof win.SmartCardConnection === 'function' || (nav.smartCard && typeof nav.smartCard.SmartCardConnection === 'function')),
            permissionPolicy: safe(() => (doc.policy && typeof doc.policy.features === 'function') || (typeof win.featurePolicy === 'object')),
            secureContext: safe(() => typeof win.isSecureContext === 'boolean' ? win.isSecureContext : false),
            webusb: safe(() => 'usb' in nav),
            webcrypto: safe(() => 'crypto' in win && typeof win.crypto.subtle === 'object'),
            webauthn: safe(() => 'credentials' in nav && typeof nav.credentials.get === 'function'),
        };
    }
    _injectStyle(id, css) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    _injectBaseStyles() {
        this._injectStyle('wsc-base', `
      .wsc-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .wsc-apdu-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 6px;
        margin-top: 8px;
      }
      .wsc-apdu-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
        font-family: monospace;
      }
      .wsc-apdu-cell b { color: #1e40af; }
      .wsc-status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .wsc-status--ok { background: #dcfce7; color: #166534; }
      .wsc-status--no { background: #fee2e2; color: #991b1b; }
      .wsc-status--run { background: #dbeafe; color: #1e40af; }
      .wsc-fs-tree {
        margin-top: 8px;
        padding: 10px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 6px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre;
        line-height: 1.6;
      }
      .wsc-pin-pad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        max-width: 240px;
        margin-top: 8px;
      }
      .wsc-pin-key {
        padding: 10px;
        text-align: center;
        background: #fff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-weight: 600;
        font-family: monospace;
      }
      .wsc-arch {
        margin-top: 8px;
        padding: 10px;
        background: #f1f5f9;
        border-radius: 6px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre;
        line-height: 1.5;
      }
    `);
    }
    // ===================== Card 1：概念与 PC/SC 模型 =====================
    _runOverviewDemo() {
        const f = this._flags();
        const info = [
            '===== Web Smart Card API 概念与 PC/SC 模型 =====',
            '',
            '【PC/SC 工作组模型】',
            '  PC/SC（Personal Computer/Smart Card）是跨平台智能卡访问标准，',
            '  定义了应用 ↔ 资源管理器 ↔ 读卡器 ↔ 卡片 的分层模型：',
            '    Application   ←→  IFD Handler（读卡器驱动）',
            '    Resource Manager（SCardEstablishContext/SCardListReaders）',
            '    IFD（Interface Device，读卡器硬件）',
            '    ICC（Integrated Circuit Card，智能卡）',
            '',
            '  Web Smart Card API 把 PC/SC 资源管理器暴露到浏览器：',
            '    Web App → navigator.smartCard → PC/SC 资源管理器 → 读卡器 → 卡',
            '',
            '【APDU 命令/响应】',
            '  APDU（Application Protocol Data Unit）是卡片通信协议单元：',
            '    命令 APDU：CLA INS P1 P2 [Lc Data] [Le]',
            '      CLS  CLA  指令类别（0x00 普通，0x80 专用）',
            '      INS  指令码（如 0xA4 SELECT、0xB0 READ BINARY、0x20 VERIFY）',
            '      P1/P2 参数',
            '      Lc   Data 字段长度',
            '      Data 数据载荷',
            '      Le   期望响应最大长度',
            '    响应 APDU：[Data] SW1 SW2',
            '      SW1=0x90 SW2=0x00 → 成功',
            '      SW1=0x61 SW2=xx   → 还有 xx 字节可取（GET RESPONSE）',
            '      SW1=0x6C SW2=xx   → Le 错误，用 xx 重发',
            '      SW1=0x69 SW2=0x82 → 安全状态不满足（需 PIN）',
            '',
            '【navigator.smartCard 入口】',
            "  // Web Smart Card API 入口",
            "  if ('smartCard' in navigator) {",
            "    const sc = navigator.smartCard;",
            "    const ctx = await sc.establishContext();",
            "  }",
            '',
            '【与 WebUSB/WebHID 实现智能卡的差异】',
            '  Web Smart Card API（高层，PC/SC 透传）：',
            '    - 走 PC/SC 资源管理器，复用系统读卡器驱动',
            '    - 自动处理 T=0/T=1 协议、ATR、卡热点插拔',
            '    - 同一读卡器多应用协调（资源管理器仲裁）',
            '    - 权限策略 smart-card，HTTPS + 用户手势',
            '',
            '  WebUSB 直连 CCID 读卡器（底层）：',
            '    - claimInterface 抢占 USB 端点，独占读卡器',
            '    - 需自行实现 CCID 协议（USB CCID Class 1.1）',
            '    - 需自行处理 T=0/T=1 协议状态机',
            '    - 系统其他应用无法同时访问该读卡器',
            '',
            '  WebHID 接入读卡器（更底层）：',
            '    - 仅适用于 HID 类读卡器（部分键盘楔形读卡器）',
            '    - 收到的是键盘扫描码，非 APDU',
            '    - 无法发送命令，只能被动接收',
            '',
            '【浏览器支持矩阵】',
            '  浏览器        Web Smart Card   备注',
            '  Chrome        ✗ 提案阶段需 flag  chrome://flags/#web-smart-card',
            '  Edge          ✗ 同 Chromium     需 flag',
            '  Safari        ✗ 未实现           -',
            '  Firefox       ✗ 未实现           -',
            '  移动端        ✗ 智能手机无读卡器  平板可外接 USB',
            '',
            '【实际能力检测演示】',
            `  navigator.smartCard: ${f.smartCard ? '✓' : '✗'}`,
            `  SmartCardContext: ${f.smartCardContext ? '✓' : '✗'}`,
            `  PCSCInterface: ${f.pcscInterface ? '✓' : '✗'}`,
            `  SmartCardConnection: ${f.smartCardConnection ? '✓' : '✗'}`,
            `  isSecureContext: ${f.secureContext ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. Web Smart Card API 仍处提案阶段，生产环境需降级 WebUSB+CCID',
            '  2. PC/SC 资源管理器在 Windows/macOS/Linux 行为不一致（错误码透传差异）',
            '  3. 读卡器被其他应用独占时 establishContext 成功但 listReaders 返回空',
            '  4. ATR 解析依赖卡片类型，eID/SIM/银行卡 ATR 格式各异',
            '  5. T=0（字符协议）与 T=1（块协议）APDU 拼装方式不同（Lc/Le 处理）',
        ].join('\n');
        this.setState({ overviewInfo: info });
        this._addLog('info', `概念演示完成：navigator.smartCard=${f.smartCard}，SmartCardContext=${f.smartCardContext}，PCSCInterface=${f.pcscInterface}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概念与 PC/SC 模型 —— navigator.smartCard 入口与 APDU 通信',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['smartCard', f.smartCard],
                ['SmartCardContext', f.smartCardContext],
            ]), h(Tag, { color: 'primary' }, 'PC/SC')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Web Smart Card API 基于 PC/SC 工作组模型，通过 navigator.smartCard 把系统 PC/SC 资源管理器暴露到浏览器，应用以 APDU（CLA/INS/P1/P2/Lc/Data/Le 命令、SW1/SW2 响应）与卡片通信。与 WebUSB/WebHID 直连读卡器的差异：Web Smart Card 走资源管理器复用驱动并自动处理 T=0/T=1 协议与 ATR，WebUSB 需自行实现 CCID 协议且独占读卡器，WebHID 仅能被动接收键盘楔形读卡器扫描码。浏览器支持：Chromium 提案阶段需 flag，Safari/Firefox 未实现。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行概念演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// Web Smart Card API 入口检测
if ('smartCard' in navigator) {
  const sc = navigator.smartCard;
  const ctx = await sc.establishContext();  // 建立 PC/SC 上下文
  const readers = await ctx.listReaders();  // 列举读卡器
  const conn = await ctx.connect(readers[0], { protocol: 'T=0' });
  // APDU：SELECT MF（3F00）
  const resp = await conn.transmit({
    cla: 0x00, ins: 0xA4, p1: 0x00, p2: 0x00,
    data: new Uint8Array([0x3F, 0x00]),
  });
  // resp.sw1 === 0x90 && resp.sw2 === 0x00 → 成功
  await conn.disconnect();
  await ctx.releaseContext();
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击按钮查看 Web Smart Card 概念与 PC/SC 模型完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：SmartCardContext 生命周期 =====================
    _runContextDemo() {
        const f = this._flags();
        // 尝试真实建立上下文（jsdom 不可用，仅记日志）
        if (f.smartCard) {
            try {
                const nav = typeof navigator !== 'undefined' ? navigator : null;
                const promise = nav.smartCard.establishContext();
                if (promise && typeof promise.then === 'function') {
                    promise.then((ctx) => {
                        this._context = ctx;
                        this._addLog('info', 'SmartCardContext.establishContext() 成功，已持有上下文句柄');
                    }).catch((err) => {
                        this._addLog('warn', `establishContext 失败：${err && err.message}`);
                    });
                }
            }
            catch (err) {
                this._addLog('warn', `establishContext 调用异常：${err && err.message}`);
            }
        }
        else {
            this._addLog('warn', 'navigator.smartCard 不可用，跳过真实 establishContext（jsdom 无 Smart Card API）');
        }
        const info = [
            '===== SmartCardContext 生命周期 =====',
            '',
            '【SmartCardContext.establishContext()】',
            '  // 建立 PC/SC 上下文，等价 SCardEstablishContext',
            "  const ctx = await navigator.smartCard.establishContext({",
            "    interface: 'pcsc',   // PCSCInterface，透传 PC/SC 错误码",
            "  });",
            '',
            '  // 返回 SmartCardContext 实例，持有资源管理器句柄',
            '  // 后续 listReaders / connect 都基于此 ctx',
            '',
            '【PCSCInterface：pcsc 透传 PC/SC 错误码】',
            '  interface PCSCInterface {',
            '    name: "pcsc";',
            '    // 透传 PC/SC 工作组定义的错误码（LONG 类型）',
            '    // SCARD_S_SUCCESS              0x00000000',
            '    // SCARD_E_NO_SERVICE           0x8010001D',
            '    // SCARD_E_NO_SMARTCARD         0x8010000C',
            '    // SCARD_E_CARD_NOT_PRESENT     0x80100070',
            '    // SCARD_E_READER_UNAVAILABLE   0x80100017',
            '    // SCARD_W_REMOVED_CARD         0x80100069',
            '    // SCARD_W_RESET_CARD           0x80100068',
            '  }',
            '',
            '  // 捕获 PC/SC 错误码',
            '  try {',
            '    const ctx = await navigator.smartCard.establishContext();',
            '  } catch (err: any) {',
            '    console.log(err.pcscCode);  // 0x8010001D 等',
            '    console.log(err.pcscMessage); // "SCARD_E_NO_SERVICE"',
            '  }',
            '',
            '【releaseContext 生命周期】',
            '  // 释放上下文，等价 SCardReleaseContext',
            '  await ctx.releaseContext();',
            '',
            '  // 生命周期完整流程：',
            '  //   establishContext → listReaders → connect → transmit → disconnect → releaseContext',
            '  //   任何一步异常都需在 finally 中 releaseContext 避免句柄泄漏',
            '',
            '  async function withContext(fn) {',
            '    const ctx = await navigator.smartCard.establishContext();',
            '    try {',
            '      return await fn(ctx);',
            '    } finally {',
            '      await ctx.releaseContext();',
            '    }',
            '  }',
            '',
            '【smart-card 权限策略】',
            '  <!-- HTTP 响应头声明 Permission-Policy -->',
            '  Permissions-Policy: smart-card=(self)',
            '',
            '  <!-- iframe 委托 -->',
            '  <iframe allow="smart-card" src="..."></iframe>',
            '',
            '  // 运行时检测',
            "  if (document.policy && !document.policy.features().includes('smart-card')) {",
            "    console.warn('smart-card 权限未授予');",
            '  }',
            '',
            '【上下文复用与并发】',
            '  - 一个页面可 establishContext 多次，每次返回独立 ctx',
            '  - 多 ctx 共享同一资源管理器，读卡器互斥（connect 独占）',
            '  - ctx 应在组件卸载时 releaseContext（componentWillUnmount）',
            '  - 页面刷新/导航离开会自动释放所有 ctx',
            '',
            '【实际能力检测演示】',
            `  navigator.smartCard: ${f.smartCard ? '✓' : '✗'}`,
            `  SmartCardContext: ${f.smartCardContext ? '✓' : '✗'}`,
            `  PCSCInterface: ${f.pcscInterface ? '✓' : '✗'}`,
            `  permissionPolicy: ${f.permissionPolicy ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. establishContext 不需用户手势，但 connect 需用户激活',
            '  2. PC/SC 服务未启动（Windows Smart Card 服务、macOS pcscd）时 SCARD_E_NO_SERVICE',
            '  3. releaseContext 未调用导致句柄泄漏，长期运行耗尽资源',
            '  4. PCSCInterface 错误码跨平台一致，但消息文本可能本地化',
            '  5. iframe 内使用需父页面 allow="smart-card" 显式委托',
        ].join('\n');
        this.setState({ contextInfo: info });
        this._addLog('info', `Context 演示完成：smartCard=${f.smartCard}，PCSCInterface=${f.pcscInterface}，permissionPolicy=${f.permissionPolicy}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. SmartCardContext 生命周期 —— establishContext/releaseContext 与 PCSCInterface',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['establishContext', f.smartCard],
                ['PCSCInterface', f.pcscInterface],
            ]), h(Tag, { color: 'primary' }, '生命周期')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'SmartCardContext.establishContext() 建立 PC/SC 上下文（等价 SCardEstablishContext），返回持有资源管理器句柄的 ctx，后续 listReaders/connect 都基于此。PCSCInterface（interface: "pcsc"）透传 PC/SC 工作组错误码（SCARD_E_NO_SERVICE 0x8010001D、SCARD_E_CARD_NOT_PRESENT 0x80100070 等）。releaseContext 释放句柄（等价 SCardReleaseContext），务必在 finally 或 componentWillUnmount 调用避免泄漏。需声明 Permissions-Policy: smart-card=(self)。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('建立/释放上下文', { type: 'primary', size: 'sm', onClick: () => this._runContextDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 建立 PC/SC 上下文（PCSCInterface 透传错误码）
const ctx = await navigator.smartCard.establishContext({
  interface: 'pcsc',
});

// 生命周期模板：finally 中 releaseContext
async function withContext(fn: any) {
  const ctx = await navigator.smartCard.establishContext();
  try {
    return await fn(ctx);
  } finally {
    await ctx.releaseContext();
  }
}

// 捕获 PC/SC 错误码
try {
  const ctx = await navigator.smartCard.establishContext();
} catch (err: any) {
  console.log(err.pcscCode);     // 0x8010001D
  console.log(err.pcscMessage);  // "SCARD_E_NO_SERVICE"
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.contextInfo || '（点击按钮查看 SmartCardContext 生命周期完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：读卡器列举与热插拔 =====================
    _runReadersDemo() {
        const f = this._flags();
        // 尝试真实列举读卡器（jsdom 不可用，仅记日志）
        if (f.smartCard && this._context) {
            try {
                const p = this._context.listReaders();
                if (p && typeof p.then === 'function') {
                    p.then((readers) => {
                        this._addLog('info', `listReaders 返回 ${readers.length} 个读卡器`);
                    }).catch((err) => {
                        this._addLog('warn', `listReaders 失败：${err && err.message}`);
                    });
                }
            }
            catch (err) {
                this._addLog('warn', `listReaders 调用异常：${err && err.message}`);
            }
        }
        else {
            this._addLog('warn', 'navigator.smartCard 或 ctx 不可用，跳过真实 listReaders（jsdom 无 Smart Card API）');
        }
        const info = [
            '===== 读卡器列举与热插拔 =====',
            '',
            '【SmartCardContext.listReaders()】',
            '  // 列举当前已连接的读卡器，等价 SCardListReaders',
            '  const readers = await ctx.listReaders();',
            '  // readers: SmartCardReader[]',
            '  //   reader.name   读卡器名称（如 "ACS ACR122U PICC Interface 00"）',
            '  //   reader.id     读卡器唯一标识',
            '  //   reader.state  读卡器状态',
            '',
            '  for (const r of readers) {',
            '    console.log(r.name, r.state);',
            '  }',
            '',
            '【读卡器热插拔事件】',
            '  // 监听读卡器接入/移除（USB 读卡器热插拔）',
            '  ctx.addEventListener($1, (e: any) => {',
            '    console.log("读卡器接入:", e.reader.name);',
            '  });',
            '  ctx.addEventListener($1, (e: any) => {',
            '    console.log("读卡器移除:", e.reader.name);',
            '  });',
            '',
            '  // 卡片插入/拔出（卡片级别，需 connect 后监听）',
            '  conn.addEventListener($1, (e: any) => {',
            '    console.log("卡片插入, ATR:", e.atr);',
            '  });',
            '  conn.addEventListener("card-removed", () => {',
            '    console.log("卡片拔出");',
            '  });',
            '',
            '【SmartCardRequest 状态机】',
            '  SmartCardRequest 描述请求生命周期（PC/SC SCardState 映射）：',
            '    "inactive"     读卡器无卡',
            '    "present"      卡已插入，未激活',
            '    "swallowed"    卡已被读卡器吞卡（机械式）',
            '    "active"       卡已激活（已 connect）',
            '    "transmitting" 正在传输 APDU',
            '    "powered"      卡已上电',
            '    "negotiable"   协议协商中',
            '    "specific"     协议已确定（T=0 或 T=1）',
            '',
            '【SmartCardStatus 状态机】',
            '  SmartCardStatus 描述卡片当前状态：',
            '    state          SmartCardRequest 当前态',
            '    protocol       "T=0" | "T=1" | "raw"',
            '    atr            Uint8Array ATR（Answer To Reset）',
            '    readerName     所属读卡器名',
            '  const status = await conn.getStatus();',
            '  console.log(status.state, status.protocol, status.atr);',
            '',
            '【轮询 vs 事件】',
            '  // 事件驱动（推荐）：reader-added/removed + card-inserted/removed',
            '  // 轮询（兼容）：setInterval 定期 listReaders + getStatus',
            '  // 注意：轮询 SCardGetStatusChange 在 jsdom 不可用，真实浏览器优先事件',
            '',
            '【ATR 概览】',
            '  ATR（Answer To Reset）是卡片复位后的应答，包含协议/参数信息：',
            '    3B 67 00 00 22 21 02 01 00 02  ← eID 卡典型 ATR',
            '    TS 3B：直接约定',
            '    T0  67：历史字节长度 7，无 TA1/TB1/TC1/TD1',
            '    T1-T7：历史字节（卡片厂商/类型标识）',
            '    TCK   ：校验字节（T=0 协议无 TCK）',
            '',
            '【实际能力检测演示】',
            `  navigator.smartCard: ${f.smartCard ? '✓' : '✗'}`,
            `  SmartCardContext: ${f.smartCardContext ? '✓' : '✗'}`,
            `  context 已建立: ${this._context ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. listReaders 在读卡器被其他应用独占时返回空数组',
            '  2. 热插拔事件需在 establishContext 之后注册才生效',
            '  3. 卡片拔出后 connection 自动失效，需重新 connect',
            '  4. SmartCardRequest 状态迁移非原子，transmitting 中拔卡触发 card-removed',
            '  5. ATR 解析需按 ISO/IEC 7816-3 规则，eID/SIM/银行卡格式不同',
        ].join('\n');
        this.setState({ readersInfo: info });
        this._addLog('info', `读卡器演示完成：smartCard=${f.smartCard}，ctx=${this._context ? '已建立' : '未建立'}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. 读卡器列举与热插拔 —— listReaders + reader-added/removed 事件',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['listReaders', f.smartCard],
                ['热插拔事件', f.smartCardContext],
            ]), h(Tag, { color: 'primary' }, '读卡器')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'SmartCardContext.listReaders() 列举已连接读卡器（等价 SCardListReaders），返回 SmartCardReader[]（含 name/id/state）。读卡器热插拔通过 reader-added/reader-removed 事件，卡片级别通过 card-inserted/card-removed 事件。SmartCardRequest 状态机描述请求生命周期（inactive/present/swallowed/active/transmitting/powered/negotiable/specific，映射 PC/SC SCardState），SmartCardStatus 描述卡片当前态（state/protocol/atr/readerName，等价 SCardStatus）。优先事件驱动，轮询兼容用 listReaders + getStatus。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('列举读卡器', { type: 'primary', size: 'sm', onClick: () => this._runReadersDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 列举读卡器
const readers = await ctx.listReaders();
for (const r of readers) console.log(r.name, r.state);

// 监听读卡器热插拔
ctx.addEventListener($1, (e: any) => {
  console.log('读卡器接入:', e.reader.name);
});
ctx.addEventListener($1, (e: any) => {
  console.log('读卡器移除:', e.reader.name);
});

// SmartCardStatus 状态机
const status = await conn.getStatus();
// status.state: "active" | "present" | ...
// status.protocol: "T=0" | "T=1" | "raw"
// status.atr: Uint8Array (Answer To Reset)`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.readersInfo || '（点击按钮查看读卡器列举与热插拔完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：连接与协议 =====================
    _runConnectDemo() {
        const f = this._flags();
        // 尝试真实连接（jsdom 不可用，仅记日志）
        if (f.smartCard && this._context) {
            try {
                const p = this._context.listReaders();
                if (p && typeof p.then === 'function') {
                    p.then(async (readers) => {
                        if (readers && readers.length > 0) {
                            try {
                                this._connection = await this._context.connect(readers[0], { protocol: 'T=0' });
                                this._addLog('info', `connect 成功：${readers[0].name}，协议 T=0`);
                            }
                            catch (err) {
                                this._addLog('warn', `connect 失败：${err && err.message}`);
                            }
                        }
                        else {
                            this._addLog('warn', 'listReaders 返回空，无读卡器可连接');
                        }
                    }).catch((err) => {
                        this._addLog('warn', `listReaders 失败：${err && err.message}`);
                    });
                }
            }
            catch (err) {
                this._addLog('warn', `connect 流程异常：${err && err.message}`);
            }
        }
        else {
            this._addLog('warn', 'navigator.smartCard 或 ctx 不可用，跳过真实 connect（jsdom 无 Smart Card API）');
        }
        const info = [
            '===== 连接与协议 =====',
            '',
            '【SmartCardConnection.connect()】',
            '  // 连接读卡器中的卡片，等价 SCardConnect',
            '  const conn = await ctx.connect(reader, {',
            '    protocol: "T=0",   // "T=0" | "T=1" | "raw"',
            '    share: "shared",   // "shared" | "exclusive" | "direct"',
            '  });',
            '',
            '  // reader: listReaders 返回的 SmartCardReader',
            '  // 返回 SmartCardConnection 实例',
            '',
            '【disconnect()】',
            '  // 断开连接，等价 SCardDisconnect',
            '  await conn.disconnect({',
            '    disposition: "leave",  // "leave" | "reset" | "unpower" | "eject"',
            '  });',
            '  // leave：保持卡当前状态',
            '  // reset：复位卡（触发新 ATR）',
            '  // unpower：断电',
            '  // eject：弹出（机械式读卡器）',
            '',
            '【协议 T=0 / T=1 / raw】',
            '  T=0（字符协议，异步半双工）：',
            '    - 每次传输一个 APDU，命令与响应交替',
            '    - 面向字节，需 CASE 3/CASE 4 区分',
            '    - SIM 卡、GSM 卡常用',
            '    - Lc/Le 处理：CASE 4 命令带 Data + Le',
            '',
            '  T=1（块协议，异步半双工）：',
            '    - 数据分块传输，含差错校验（CRC/EDC）',
            '    - 面向块，支持链式传输',
            '    - eID、银行卡 EMV 常用',
            '    - APDU 直接透传，无需 CASE 区分',
            '',
            '  raw（原始协议）：',
            '    - 不做协议处理，直接收发原始字节',
            '    - 用于非 ISO 7816 卡（如存储卡）',
            '    - 需自行实现协议状态机',
            '',
            '【isConnected 属性】',
            '  // 连接状态',
            '  console.log(conn.isConnected);  // true/false',
            '',
            '  // 卡片拔出后自动 false，transmit 抛 SCARD_W_REMOVED_CARD',
            '  if (!conn.isConnected) {',
            '    await ctx.connect(reader, { protocol: "T=1" });',
            '  }',
            '',
            '【ATR 解析（Answer To Reset）】',
            '  // conn.atr 或 getStatus().atr 返回 Uint8Array',
            '  function parseATR(atr) {',
            '    const bytes = Array.from(atr);',
            '    const ts = bytes[0];  // 0x3B 直接 / 0x3F 反向',
            '    const t0 = bytes[1];  // K(低4位历史字节长度) + 接口字节指示',
            '    let td = t0 >> 4;',
            '    let i = 2;',
            '    while (td > 0) {',
            '      if (td & 1) i++; // TAi',
            '      if (td & 2) i++; // TBi',
            '      if (td & 4) i++; // TCi',
            '      if (td & 8) { td = bytes[i] >> 4; i++; } else break;',
            '    }',
            '    const hist = bytes.slice(i, i + (t0 & 0x0F));',
            '    return { ts, t0, historical: hist };',
            '  }',
            '',
            '  // eID 典型 ATR：3B 67 00 00 22 21 02 01 00 02',
            '  //   TS=0x3B 直接约定',
            '  //   T0=0x67 历史7字节',
            '  //   历史 22 21 02 01 00 02 → 中国 eID 标识',
            '',
            '【实际能力检测演示】',
            `  navigator.smartCard: ${f.smartCard ? '✓' : '✗'}`,
            `  SmartCardConnection: ${f.smartCardConnection ? '✓' : '✗'}`,
            `  context 已建立: ${this._context ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. T=0 与 T=1 APDU 拼装不同，T=0 CASE4 响应需 GET RESPONSE 取回',
            '  2. exclusive 模式独占读卡器，其他应用无法访问',
            '  3. connect 需用户手势（按钮点击），不能页面加载自动连接',
            '  4. disconnect disposition=reset 会触发新 ATR，原 conn 失效',
            '  5. ATR 解析需按 ISO/IEC 7816-3，跨卡片类型格式不同',
        ].join('\n');
        this.setState({ connectInfo: info });
        this._addLog('info', `连接演示完成：smartCard=${f.smartCard}，SmartCardConnection=${f.smartCardConnection}`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. 连接与协议 —— connect/disconnect + T=0/T=1/raw + ATR 解析',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['connect', f.smartCardConnection],
                ['T=0/T=1', f.smartCardConnection],
            ]), h(Tag, { color: 'primary' }, '连接')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'SmartCardConnection.connect(reader, {protocol, share}) 连接读卡器中卡片（等价 SCardConnect），protocol 取 "T=0"（字符协议，SIM 卡常用，CASE 3/4 区分）、"T=1"（块协议，eID/EMV 常用，APDU 透传）、"raw"（原始字节，非 ISO 7816 卡）。disconnect({disposition}) 断开（leave/reset/unpower/eject）。isConnected 属性反映连接状态，卡片拔出自动 false。ATR（Answer To Reset）按 ISO/IEC 7816-3 解析 TS/T0/历史字节，eID/SIM/银行卡 ATR 格式各异。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('连接卡片', { type: 'primary', size: 'sm', onClick: () => this._runConnectDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 连接卡片（T=0 字符协议）
const conn = await ctx.connect(reader, {
  protocol: 'T=0',
  share: 'shared',
});

console.log(conn.isConnected); // true
console.log(conn.atr);         // Uint8Array [0x3B, 0x67, ...]

// 断开（复位卡片触发新 ATR）
await conn.disconnect({ disposition: 'reset' });

// ATR 解析（ISO/IEC 7816-3）
function parseATR(atr: any) {
  const ts = atr[0]; // 0x3B 直接 / 0x3F 反向
  const t0 = atr[1]; // K(低4位) + 接口字节指示
  // ... 解析 TAi/TBi/TCi/TDi + 历史字节
  return { ts, t0 };
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.connectInfo || '（点击按钮查看连接与协议完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：APDU 传输 =====================
    _runApduDemo() {
        const f = this._flags();
        // 尝试真实传输（jsdom 不可用，仅记日志）
        if (f.smartCardConnection && this._connection) {
            try {
                const p = this._connection.transmit({
                    cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00,
                    data: new Uint8Array([0x3F, 0x00]),
                });
                if (p && typeof p.then === 'function') {
                    p.then((resp) => {
                        this._addLog('info', `transmit 完成：SW1=${resp.sw1.toString(16)} SW2=${resp.sw2.toString(16)}`);
                    }).catch((err) => {
                        this._addLog('warn', `transmit 失败：${err && err.message}`);
                    });
                }
            }
            catch (err) {
                this._addLog('warn', `transmit 调用异常：${err && err.message}`);
            }
        }
        else {
            this._addLog('warn', 'SmartCardConnection 或 conn 不可用，跳过真实 transmit（jsdom 无 Smart Card API）');
        }
        const info = [
            '===== APDU 传输 =====',
            '',
            '【SmartCardConnection.transmit(PCSCCommand)】',
            '  // 发送 APDU 命令，等价 SCardTransmit',
            '  const resp = await conn.transmit({',
            '    cla: 0x00,       // 指令类别',
            '    ins: 0xA4,       // 指令码（0xA4 = SELECT）',
            '    p1:  0x04,       // 参数1（SELECT by DF name）',
            '    p2:  0x00,       // 参数2',
            '    data: new Uint8Array([0xA0, 0x00, 0x00, 0x00, 0x63, 0x50, 0x4B, 0x43, 0x53, 0x2D, 0x31, 0x35]),',
            '    le: 256,         // 期望响应最大长度',
            '  });',
            '',
            '  // resp: { data: Uint8Array, sw1: number, sw2: number }',
            '  if (resp.sw1 === 0x90 && resp.sw2 === 0x00) {',
            '    console.log("成功", resp.data);',
            '  }',
            '',
            '【APDU 拼装：CLA/INS/P1/P2/Lc/Data/Le】',
            '  CASE 1：无数据无响应（CLA INS P1 P2）',
            '    { cla: 0x00, ins: 0x20, p1: 0x00, p2: 0x00 }  // 指令无数据',
            '',
            '  CASE 2：无数据有响应（CLA INS P1 P2 Le）',
            '    { cla: 0x00, ins: 0xB0, p1: 0x00, p2: 0x00, le: 256 }  // READ BINARY',
            '',
            '  CASE 3：有数据无响应（CLA INS P1 P2 Lc Data）',
            '    { cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00,',
            '      data: new Uint8Array([0x3F, 0x00]) }  // SELECT',
            '',
            '  CASE 4：有数据有响应（CLA INS P1 P2 Lc Data Le）',
            '    { cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00,',
            '      data: new Uint8Array([...]), le: 256 }',
            '',
            '【响应 SW1/SW2 解析】',
            '  SW1=0x90 SW2=0x00  → 成功',
            '  SW1=0x61 SW2=xx    → 还有 xx 字节，需 GET RESPONSE',
            '  SW1=0x6C SW2=xx    → Le 错误，用 xx 重发命令',
            '  SW1=0x62 SW2=0x82  → 文件结束（Le 超过文件长度）',
            '  SW1=0x6A SW2=0x82  → 文件/DF 未找到',
            '  SW1=0x69 SW2=0x82  → 安全状态不满足（需 PIN）',
            '  SW1=0x69 SW2=0x83  → 认证方法被封锁（PIN 锁死）',
            '  SW1=0x6D SW2=0x00  → INS 不支持',
            '  SW1=0x6E SW2=0x00  → CLA 不支持',
            '',
            '【长响应链 GET RESPONSE】',
            '  // T=0 协议下，CASE 4 命令响应可能只有 SW1=0x61',
            '  // 需发送 GET RESPONSE 取回完整数据',
            '  async function transmitFull(conn, cmd) {',
            '    let resp = await conn.transmit(cmd);',
            '    while (resp.sw1 === 0x61) {',
            '      resp = await conn.transmit({',
            '        cla: cmd.cla, ins: 0xC0, p1: 0x00, p2: 0x00,',
            '        le: resp.sw2,',
            '      });',
            '    }',
            '    if (resp.sw1 === 0x6C) {',
            '      // Le 错误，用 sw2 重发',
            '      resp = await conn.transmit({ ...cmd, le: resp.sw2 });',
            '    }',
            '    return resp;',
            '  }',
            '',
            '【Uint8Array 与十六进制互转】',
            '  // 字符串 → Uint8Array',
            '  function hexToBytes(hex) {',
            '    const arr = hex.match(/.{2}/g).map((b: any) => parseInt(b, 16));',
            '    return new Uint8Array(arr);',
            '  }',
            '',
            '  // Uint8Array → 字符串',
            '  function bytesToHex(bytes) {',
            '    return Array.from(bytes)',
            '      .map((b: any) => b.toString(16).padStart(2, "0").toUpperCase())',
            '      .join(" ");',
            '  }',
            '',
            '【实际能力检测演示】',
            `  SmartCardConnection: ${f.smartCardConnection ? '✓' : '✗'}`,
            `  connection 已建立: ${this._connection ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. T=0 CASE 4 响应可能只有 SW1=0x61，需 GET RESPONSE 链式取回',
            '  2. Le=0 在部分卡片表示 256，部分表示 0，需查卡片规范',
            '  3. SW1=0x6C 需用 SW2 作为新 Le 重发整个命令',
            '  4. data 超过 255 字节需 EXTENDED APDU（T=1 才支持）',
            '  5. transmit 期间卡片拔出抛 SCARD_W_REMOVED_CARD，需重新 connect',
        ].join('\n');
        this.setState({ apduInfo: info });
        this._addLog('info', `APDU 演示完成：SmartCardConnection=${f.smartCardConnection}，conn=${this._connection ? '已连接' : '未连接'}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. APDU 传输 —— transmit(PCSCCommand) + CLA/INS/P1/P2/Lc/Data/Le',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['transmit', f.smartCardConnection],
                ['GET RESPONSE', f.smartCardConnection],
            ]), h(Tag, { color: 'primary' }, 'APDU')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'SmartCardConnection.transmit(PCSCCommand) 发送 APDU（等价 SCardTransmit），命令含 CLA/INS/P1/P2/Lc/Data/Le 四种 CASE（CASE1 无数据无响应、CASE2 有响应、CASE3 有数据、CASE4 有数据有响应）。响应 SW1/SW2：0x9000 成功、0x61xx 需 GET RESPONSE 取回、0x6Cxx Le 错误用 SW2 重发、0x6982 安全状态不满足、0x6A82 文件未找到。T=0 CASE4 长响应需 GET RESPONSE 链式取回。Uint8Array 与十六进制互转辅助拼装。'),
                h('div', { class: 'wsc-apdu-grid' }, h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'CLA'), ' 0x00'), h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'INS'), ' 0xA4'), h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'P1'), ' 0x04'), h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'P2'), ' 0x00'), h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'Lc'), ' 0x0C'), h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'Data'), ' A000...'), h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'Le'), ' 0x00'), h('div', { class: 'wsc-apdu-cell' }, h('b', {}, 'SW'), ' 9000')),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('发送 APDU', { type: 'primary', size: 'sm', onClick: () => this._runApduDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 发送 APDU（SELECT by DF name）
const resp = await conn.transmit({
  cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00,
  data: new Uint8Array([0xA0, 0x00, 0x00, 0x00, 0x63, 0x50,
                        0x4B, 0x43, 0x53, 0x2D, 0x31, 0x35]),
  le: 256,
});
// resp.sw1 === 0x90 && resp.sw2 === 0x00 → 成功

// 长响应链 GET RESPONSE（T=0 CASE4）
async function transmitFull(conn: any,  cmd: any) {
  let resp = await conn.transmit(cmd);
  while (resp.sw1 === 0x61) {
    resp = await conn.transmit({
      cla: cmd.cla, ins: 0xC0, p1: 0x00, p2: 0x00,
      le: resp.sw2,
    });
  }
  return resp;
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.apduInfo || '（点击按钮查看 APDU 传输完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：eID 实战 =====================
    _runEidDemo() {
        const f = this._flags();
        // 尝试真实 eID 读取（jsdom 不可用，仅记日志）
        if (f.smartCardConnection && this._connection) {
            this._addLog('warn', 'eID 实战需真实卡片与读卡器，jsdom 仅记日志说明流程');
        }
        else {
            this._addLog('warn', 'SmartCardConnection 不可用，跳过真实 eID 读取（jsdom 无 Smart Card API）');
        }
        const info = [
            '===== eID 实战：MF/DF/EF + SELECT + READ BINARY + PIN + PSO =====',
            '',
            '【eID 文件结构 MF/DF/EF】',
            '  eID（中国居民身份证）遵循 ISO/IEC 7816-4 文件结构：',
            '',
            '  MF (3F00) 主文件',
            '  ├── DF (电子证件应用)  AID: A000000063504B43532D3135',
            '  │   ├── EF(DIR)        2F00  应用目录',
            '  │   ├── EF(CardData)   企业标识/卡类型',
            '  │   ├── EF(TokenInfo)  令牌信息',
            '  │   ├── EF_Cert(PKCS#15)  证书容器',
            '  │   │   ├── EF_OD      对象目录',
            '  │   │   └── EF_PrKD    私钥目录',
            '  │   ├── EF_InfoEID     eID 个人信息',
            '  │   │   ├── 姓名',
            '  │   │   ├── 性别',
            '  │   │   ├── 民族',
            '  │   │   ├── 出生日期',
            '  │   │   └── 住址',
            '  │   ├── EF_PhotoEID    照片（JPEG）',
            '  │   └── EF_Cert_Auth   认证证书',
            '  └── DF(签名应用)       PSO 签名私钥',
            '',
            '【SELECT 选择文件】',
            '  // 1. SELECT MF（3F00）',
            '  await conn.transmit({',
            '    cla: 0x00, ins: 0xA4, p1: 0x00, p2: 0x00,',
            '    data: new Uint8Array([0x3F, 0x00]),',
            '  });',
            '',
            '  // 2. SELECT DF by AID（电子证件应用）',
            '  const aid = new Uint8Array([',
            '    0xA0, 0x00, 0x00, 0x00, 0x63, 0x50,',
            '    0x4B, 0x43, 0x53, 0x2D, 0x31, 0x35,',
            '  ]);',
            '  await conn.transmit({',
            '    cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00,',
            '    data: aid, le: 256,',
            '  });',
            '',
            '  // 3. SELECT EF by FID（EF_InfoEID）',
            '  await conn.transmit({',
            '    cla: 0x00, ins: 0xA4, p1: 0x02, p2: 0x04,',
            '    data: new Uint8Array([0xDF, 0x02]),',
            '  });',
            '',
            '【READ BINARY 读取文件内容】',
            '  // 先读 4 字节获取文件长度',
            '  const head = await conn.transmit({',
            '    cla: 0x00, ins: 0xB0, p1: 0x00, p2: 0x00,',
            '    le: 4,',
            '  });',
            '  const len = (head.data[2] << 8) | head.data[3];',
            '',
            '  // 读取完整内容',
            '  const body = await conn.transmit({',
            '    cla: 0x00, ins: 0xB0, p1: 0x00, p2: 0x04,',
            '    le: len,',
            '  });',
            '  // body.data: 姓名/性别/民族/出生/住址 TLV 编码',
            '',
            '【PIN 验证 VERIFY】',
            '  // VERIFY 指令验证 PIN（INS=0x20）',
            '  // P2 指定 PIN 引用（eID 主 PIN=1，签名 PIN=2）',
            '  const pinBytes = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0xFF, 0xFF, 0xFF, 0xFF]);',
            '  // PIN 以 ASCII 编码，未用位填 0xFF',
            '  const resp = await conn.transmit({',
            '    cla: 0x00, ins: 0x20, p1: 0x00, p2: 0x02,',
            '    data: pinBytes,',
            '  });',
            '  // SW1=0x90 SW2=0x00 → PIN 正确',
            '  // SW1=0x63 SW2=0xCx → PIN 错误，剩余 x 次',
            '  // SW1=0x69 SW2=0x83 → PIN 已锁死，需 PUK 解锁',
            '',
            '【数字签名 PSO（Perform Security Operation）】',
            '  // PSO 指令（INS=0x2A）执行数字签名',
            '  // 1. MSE SET（管理安全环境，指定算法/密钥引用）',
            '  await conn.transmit({',
            '    cla: 0x00, ins: 0x22, p1: 0x41, p2: 0xB6,',
            '    data: new Uint8Array([0x80, 0x01, 0x11,  // 算法 RSA-PKCS',
            '                          0x84, 0x01, 0x02]), // 私钥引用',
            '  });',
            '',
            '  // 2. PSO HASH（计算哈希，9E9A）',
            '  const hash = await crypto.subtle.digest("SHA-256", data);',
            '  await conn.transmit({',
            '    cla: 0x00, ins: 0x2A, p1: 0x90, p2: 0xA0,',
            '    data: new Uint8Array(hash),',
            '  });',
            '',
            '  // 3. PSO SIGN（9E9A 生成签名）',
            '  const sigResp = await conn.transmit({',
            '    cla: 0x00, ins: 0x2A, p1: 0x9E, p2: 0x9A,',
            '    le: 256,',
            '  });',
            '  // sigResp.data: RSA 签名（256/384 字节，对应 RSA-2048/3072）',
            '',
            '【实际能力检测演示】',
            `  SmartCardConnection: ${f.smartCardConnection ? '✓' : '✗'}`,
            `  Web Crypto: ${f.webcrypto ? '✓' : '✗'}`,
            `  connection 已建立: ${this._connection ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. eID PIN 连续 3 次错误锁死，需 PUK 或柜台解锁',
            '  2. READ BINARY 需先 SELECT EF，文件偏移超长报 0x6282',
            '  3. PSO 签名前必须 MSE SET 指定算法与密钥引用',
            '  4. 签名值需用卡片证书验签，不能直接信任',
            '  5. 个人信息 TLV 解析需按 GA/T 1331 标准',
        ].join('\n');
        this.setState({ eidInfo: info });
        this._addLog('info', `eID 演示完成：SmartCardConnection=${f.smartCardConnection}，WebCrypto=${f.webcrypto}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. eID 实战 —— MF/DF/EF + SELECT + READ BINARY + PIN + PSO 数字签名',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['eID APDU', f.smartCardConnection],
                ['Web Crypto', f.webcrypto],
            ]), h(Tag, { color: 'primary' }, 'eID')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'eID（中国居民身份证）遵循 ISO/IEC 7816-4 文件结构 MF/DF/EF：SELECT（INS=0xA4）选择 MF/DF by AID/EF by FID，READ BINARY（INS=0xB0）按偏移读取 TLV 编码个人信息（姓名/性别/民族/出生/住址/照片）。PIN 验证用 VERIFY（INS=0x20，P2 指定 PIN 引用），3 次错误锁死。数字签名用 PSO（INS=0x2A）：先 MSE SET（INS=0x22）指定算法 RSA-PKCS 与私钥引用，再 PSO HASH（9E9A）+ PSO SIGN（9E9A）生成 RSA 签名，配合卡片证书验签。'),
                h('div', { class: 'wsc-fs-tree' }, `MF (3F00) 主文件
├── DF 电子证件应用 AID: A000000063504B43532D3135
│   ├── EF(DIR) 2F00       应用目录
│   ├── EF_InfoEID         姓名/性别/民族/出生/住址
│   ├── EF_PhotoEID        照片 JPEG
│   └── EF_Cert_Auth       认证证书
└── DF 签名应用            PSO 签名私钥`),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取 eID 信息', { type: 'primary', size: 'sm', onClick: () => this._runEidDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// SELECT DF by AID（电子证件应用）
const aid = new Uint8Array([0xA0, 0x00, 0x00, 0x00, 0x63, 0x50,
                            0x4B, 0x43, 0x53, 0x2D, 0x31, 0x35]);
await conn.transmit({
  cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00, data: aid, le: 256,
});

// READ BINARY 读取个人信息
const body = await conn.transmit({
  cla: 0x00, ins: 0xB0, p1: 0x00, p2: 0x04, le: len,
});

// PSO 数字签名：MSE SET + PSO HASH + PSO SIGN
await conn.transmit({
  cla: 0x00, ins: 0x22, p1: 0x41, p2: 0xB6,
  data: new Uint8Array([0x80, 0x01, 0x11, 0x84, 0x01, 0x02]),
});
const sig = await conn.transmit({
  cla: 0x00, ins: 0x2A, p1: 0x9E, p2: 0x9A, le: 256,
});`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.eidInfo || '（点击按钮查看 eID 实战完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 7：PAdES 数字签名 =====================
    _runPadesDemo() {
        const f = this._flags();
        // 尝试真实 PAdES（jsdom 不可用，仅记日志）
        if (f.smartCardConnection && this._connection) {
            this._addLog('warn', 'PAdES 需真实卡片与 PDF.js，jsdom 仅记日志说明流程');
        }
        else {
            this._addLog('warn', 'SmartCardConnection 不可用，跳过真实 PAdES 签名（jsdom 无 Smart Card API）');
        }
        const info = [
            '===== PAdES 数字签名：PDF + PKCS#11 → Web Crypto + Smart Card + PDF.js =====',
            '',
            '【PAdES 概述】',
            '  PAdES（PDF Advanced Electronic Signature）是 ETSI TS 102 778 标准，',
            '  定义在 PDF 中嵌入高级电子签名的规范：',
            '    B-B  基本签名（签名值 + 证书）',
            '    B-T  加时间戳（RFC 3161 TSA）',
            '    B-LT 长期（加 CRL/OCSP 证据）',
            '    B-LTA 长期归档（加归档时间戳链）',
            '',
            '【传统 PKCS#11 vs Web 方案】',
            '  传统（桌面应用）：',
            '    应用 → PKCS#11 .so/.dll → 读卡器驱动 → 卡片',
            '    PKCS#11 提供 C_SignInit/C_SignUpdate/C_SignFinal',
            '    私钥永不离开卡片，签名在卡内完成',
            '',
            '  Web 方案（Web Smart Card + Web Crypto + PDF.js）：',
            '    Web App → navigator.smartCard → 卡片（PSO 签名）',
            '    Web App → crypto.subtle.digest（哈希）',
            '    Web App → PDF.js（PDF 字节流修改）',
            '    私钥仍在卡片内，PSO 返回签名值，应用嵌入 PDF',
            '',
            '【PAdES 签名流程】',
            '  // 1. PDF.js 加载 PDF，准备 ByteRange',
            '  const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes });',
            '  const byteRange = [0, placeholderOffset, placeholderEnd, pdfLength];',
            '',
            '  // 2. 计算待签名 PDF 字节哈希（ByteRange 内除签名外的字节）',
            '  const signedBytes = concat(',
            '    pdfBytes.slice(0, placeholderOffset),',
            '    pdfBytes.slice(placeholderEnd),',
            '  );',
            '  const hash = await crypto.subtle.digest("SHA-256", signedBytes);',
            '',
            '  // 3. Smart Card PSO 签名（卡片内 RSA 私钥）',
            '  //    MSE SET + PSO HASH + PSO SIGN',
            '  await conn.transmit({',
            '    cla: 0x00, ins: 0x22, p1: 0x41, p2: 0xB6,',
            '    data: new Uint8Array([0x80, 0x01, 0x11, 0x84, 0x01, 0x02]),',
            '  });',
            '  await conn.transmit({',
            '    cla: 0x00, ins: 0x2A, p1: 0x90, p2: 0xA0,',
            '    data: new Uint8Array(hash),',
            '  });',
            '  const sigResp = await conn.transmit({',
            '    cla: 0x00, ins: 0x2A, p1: 0x9E, p2: 0x9A, le: 256,',
            '  });',
            '',
            '  // 4. 构造 PKCS#7/CAdES 签名容器（含证书 + 签名值）',
            '  const p7 = buildPKCS7({',
            '    signature: sigResp.data,',
            '    certificate: cardCert,   // 从 EF_Cert 读取',
            '    hashAlgorithm: "SHA-256",',
            '  });',
            '',
            '  // 5. 嵌入 PDF /Contents 字段（DER 编码 hex string）',
            '  const hex = bytesToHex(p7).toLowerCase();',
            '  pdfBytes.set(new TextEncoder().encode(hex), placeholderOffset);',
            '',
            '  // 6. B-T：加 RFC 3161 时间戳',
            '  const tsr = await fetch(tsaUrl, {',
            '    method: "POST",',
            '    headers: { "Content-Type": "application/timestamp-query" },',
            '    body: buildTimestampQuery(hash),',
            '  }).then((r: any) => r.arrayBuffer());',
            '  embedTimestamp(pdfBytes, tsr);',
            '',
            '【与 WebAuthn 协同】',
            '  WebAuthn（FIDO2）与 Smart Card 互补，非互斥：',
            '    WebAuthn：平台/漫游认证器（TPM/Secure Enclave/USB Key）',
            '             → 高层 API，自动处理挑战/签名，不可控算法',
            '    Smart Card：eID/证书卡，可控 PKCS#11/PSO，合规电子签名',
            '              → 低层 API，手动拼装 APDU，符合 eIDAS QES',
            '',
            '  // 场景：WebAuthn 登录 + Smart Card 法定签名',
            '  async function loginAndSign(pdfBytes) {',
            '    // 1. WebAuthn 登录认证用户',
            '    const assertion = await navigator.credentials.get({',
            '      publicKey: { challenge, allowCredentials, ... },',
            '    });',
            '    if (!verifyAssertion(assertion)) throw new Error("登录失败");',
            '',
            '    // 2. Smart Card 法定签名（PSO）',
            '    const ctx = await navigator.smartCard.establishContext();',
            '    const conn = await ctx.connect(reader, { protocol: "T=1" });',
            '    const signature = await psoSign(conn, hash);',
            '    await conn.disconnect();',
            '    await ctx.releaseContext();',
            '',
            '    // 3. 嵌入 PDF',
            '    return embedSignature(pdfBytes, signature);',
            '  }',
            '',
            '【实际能力检测演示】',
            `  SmartCardConnection: ${f.smartCardConnection ? '✓' : '✗'}`,
            `  Web Crypto: ${f.webcrypto ? '✓' : '✗'}`,
            `  WebAuthn: ${f.webauthn ? '✓' : '✗'} (navigator.credentials)`,
            '',
            '【常见陷阱】',
            '  1. ByteRange 占位符长度需精确，否则 PDF 字节偏移错乱',
            '  2. PKCS#7 容器需 DER 编码，PEM 会被 PDF 拒绝',
            '  3. /Contents 值需 <hex string> 格式，不足补 0',
            '  4. 时间戳 TSA 需可信第三方，自建 TSA 不被承认',
            '  5. PAdES B-LT 需嵌入 CRL/OCSP，证书过期后仍可验签',
        ].join('\n');
        this.setState({ padesInfo: info });
        this._addLog('info', `PAdES 演示完成：SmartCard=${f.smartCardConnection}，WebCrypto=${f.webcrypto}，WebAuthn=${f.webauthn}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. PAdES 数字签名 —— PDF + Web Crypto + Smart Card + PDF.js + WebAuthn 协同',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['PAdES', f.smartCardConnection],
                ['WebAuthn', f.webauthn],
            ]), h(Tag, { color: 'primary' }, 'PAdES')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'PAdES（ETSI TS 102 778）在 PDF 嵌入高级电子签名（B-B/B-T/B-LT/B-LTA）。Web 方案替代传统 PKCS#11：PDF.js 准备 ByteRange，crypto.subtle.digest 算哈希，Smart Card PSO 在卡片内签名（私钥不出卡），构造 PKCS#7/CAdES 容器嵌入 /Contents，B-T 加 RFC 3161 时间戳。与 WebAuthn 协同：WebAuthn 负责用户登录认证（高层），Smart Card 负责法定签名（低层 PSO，符合 eIDAS QES）。'),
                h('div', { class: 'wsc-arch' }, `Web App
  ├── PDF.js ── ByteRange / /Contents 占位
  ├── crypto.subtle.digest ── SHA-256 哈希
  ├── navigator.smartCard ── PSO 签名（卡片内 RSA）
  ├── buildPKCS7 ── DER 编码签名容器
  └── fetch TSA ── RFC 3161 时间戳（B-T）
         ↓
      PAdES B-T 签名 PDF`),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('PAdES 签名流程', { type: 'primary', size: 'sm', onClick: () => this._runPadesDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// PAdES 签名：PDF.js + Web Crypto + Smart Card
const hash = await crypto.subtle.digest('SHA-256', signedBytes);

// Smart Card PSO 签名（卡片内 RSA 私钥）
await conn.transmit({
  cla: 0x00, ins: 0x22, p1: 0x41, p2: 0xB6,
  data: new Uint8Array([0x80, 0x01, 0x11, 0x84, 0x01, 0x02]),
});
const sig = await conn.transmit({
  cla: 0x00, ins: 0x2A, p1: 0x9E, p2: 0x9A, le: 256,
});

// 嵌入 PDF /Contents
const p7 = buildPKCS7({ signature: sig.data, certificate: cardCert });
pdfBytes.set(new TextEncoder().encode(bytesToHex(p7)), placeholderOffset);

// WebAuthn 协同：先登录认证，再 Smart Card 法定签名
const assertion = await navigator.credentials.get({ publicKey: { challenge } });`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.padesInfo || '（点击按钮查看 PAdES 数字签名完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 8：权限与安全 =====================
    async _runSecurityDemo() {
        const f = this._flags();
        // 尝试真实权限检测（jsdom 部分可用）
        let permState = 'unknown';
        if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
            try {
                const result = await navigator.permissions.query({ name: 'smart-card' });
                permState = result.state;
                this._addLog('info', `smart-card 权限状态：${permState}`);
            }
            catch (err) {
                this._addLog('warn', `permissions.query 不支持 smart-card：${err && err.message}`);
            }
        }
        else {
            this._addLog('warn', 'Permissions API 不可用，跳过 smart-card 权限查询');
        }
        const info = [
            '===== 权限与安全 =====',
            '',
            '【smart-card Permission Policy】',
            '  <!-- HTTP 响应头 -->',
            '  Permissions-Policy: smart-card=(self "https://trusted.example.com")',
            '',
            '  <!-- iframe 委托 -->',
            '  <iframe allow="smart-card" src="signer.html"></iframe>',
            '',
            '  // 运行时检测（Permissions API）',
            '  const result = await navigator.permissions.query({',
            "    name: 'smart-card',",
            '  });',
            '  // result.state: "granted" | "denied" | "prompt"',
            '  if (result.state === "prompt") {',
            '    // 需用户手势触发 connect 才会弹出授权',
            '  }',
            '',
            '【HTTPS / localhost 限制】',
            '  - 必须 Secure Context：HTTPS 或 http://localhost',
            '  - http:// 非 localhost 直接拒绝 establishContext',
            '  - 检测：window.isSecureContext === true',
            '  - file:// 部分浏览器允许，部分拒绝',
            '  - 内网 IP（http://192.168.x.x）不算 localhost，需 HTTPS',
            '',
            '【能力检测与降级】',
            '  // 优先级：Web Smart Card > WebUSB+CCID > 服务端签名',
            '  async function getSmartCardConnection() {',
            '    // 1. Web Smart Card API（首选）',
            "    if ('smartCard' in navigator) {",
            '      const ctx = await navigator.smartCard.establishContext();',
            '      const readers = await ctx.listReaders();',
            '      if (readers.length > 0) {',
            '        return await ctx.connect(readers[0], { protocol: "T=1" });',
            '      }',
            '    }',
            '',
            '    // 2. WebUSB 直连 CCID 读卡器（降级）',
            "    if ('usb' in navigator) {",
            '      const device = await navigator.usb.requestDevice({',
            '        filters: [{ classCode: 0x0B }],  // USB CCID class',
            '      });',
            '      await device.open();',
            '      await device.claimInterface(0);',
            '      return new CCIDOverWebUSB(device);  // 自行实现 CCID 协议',
            '    }',
            '',
            '    // 3. 服务端签名（最终降级，私钥在 HSM）',
            '    return new RemoteSigner("/api/sign");',
            '  }',
            '',
            '【WebUSB 直连 CCID 读卡器】',
            '  // CCID（USB Chip/Smart Card Interface Device）Class 0x0B',
            '  const device = await navigator.usb.requestDevice({',
            '    filters: [{ classCode: 0x0B }],',
            '  });',
            '  await device.open();',
            '  await device.claimInterface(0);',
            '',
            '  // CCID 命令（PC_to_RDR_IccPowerOn 等）',
            '  // 需自行实现 CCID 1.1 协议状态机',
            '  //   - PC_to_RDR_IccPowerOn  上电',
            '  //   - PC_to_RDR_XfrBlock    传输 APDU',
            '  //   - RDR_to_PC_DataBlock   响应',
            '  //   - RDR_to_PC_SlotStatus  状态',
            '',
            '【安全考虑】',
            '  1. PIN 输入界面隔离：',
            '     - PIN 必须由用户直接输入，禁止脚本预填',
            '     - 推荐使用浏览器原生 PIN 收集器（如 Secure Payment Confirmation）',
            '     - 自建 PIN 输入框需：isolated DOM、防 keylogger、防截屏',
            '     - PIN 在内存中停留最短时间，签名后立即清零',
            '',
            '  2. 计时攻击防护：',
            '     - PIN 比对在卡片内完成（VERIFY 指令），不在 JS 中比较',
            '     - PSO 签名在卡片内，私钥永不离开',
            '     - 卡片返回错误码固定时间（0x63Cx 剩余次数）',
            '     - 应用层避免基于响应时间的分支逻辑',
            '',
            '  3. 中间人防护：',
            '     - HTTPS 加密传输 APDU（虽然 Smart Card 不走网络，但页面 JS 走 HTTPS）',
            '     - CSP 限制脚本来源，防恶意 JS 篡改 APDU',
            '     - Subresource Integrity（SRI）校验第三方库',
            '     - 签名前显示待签内容摘要，用户确认后再 PSO',
            '',
            '  4. 重放与重放攻击：',
            '     - PAdES B-T 加时间戳防重放',
            '     - 挑战值（nonce）每次随机，PSO 签名含 nonce',
            '     - 卡片会话 ID 防跨会话重放',
            '',
            '  5. 隐私与合规：',
            '     - eID 个人信息读取需明确告知用户用途',
            '     - 符合 eIDAS QES（Qualified Electronic Signature）',
            '     - GDPR：最小化读取，不存储敏感字段',
            '     - 中国《电子签名法》：可靠的电子签名需专有控制',
            '',
            '【实际能力检测演示】',
            `  navigator.smartCard: ${f.smartCard ? '✓' : '✗'}`,
            `  isSecureContext: ${f.secureContext ? '✓' : '✗'}`,
            `  WebUSB（降级）: ${f.webusb ? '✓' : '✗'}`,
            `  smart-card 权限: ${permState}`,
            '',
            '【常见陷阱】',
            '  1. Permission Policy 未声明 smart-card 时，iframe 内静默失败',
            '  2. WebUSB 降级需用户选择设备，不能自动 requestDevice',
            '  3. CCID 协议实现复杂，建议用开源 pcsc-web-ccid 库',
            '  4. PIN 输入框被恶意 DOM 替换可截获，需 Shadow DOM 隔离',
            '  5. 服务端签名降级需 HSM，否则私钥泄漏风险高',
        ].join('\n');
        this.setState({ securityInfo: info });
        this._addLog('info', `安全演示完成：secureContext=${f.secureContext}，WebUSB=${f.webusb}，权限=${permState}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 权限与安全 —— smart-card Policy + HTTPS + 降级 WebUSB/CCID + PIN 隔离',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['SecureContext', f.secureContext],
                ['WebUSB 降级', f.webusb],
            ]), h(Tag, { color: 'primary' }, '安全')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'smart-card Permission Policy 通过 Permissions-Policy 响应头或 iframe allow 声明，运行时用 navigator.permissions.query({name:"smart-card"}) 查询状态。必须 HTTPS 或 localhost（window.isSecureContext）。能力检测优先级：Web Smart Card > WebUSB 直连 CCID 读卡器（classCode 0x0B，需自行实现 CCID 1.1 协议）> 服务端 HSM 签名。安全考虑：PIN 输入界面隔离（Shadow DOM/原生收集器）、计时攻击防护（PIN 比对在卡内）、中间人防护（HTTPS+CSP+SRI+签名前摘要确认）、重放防护（时间戳+nonce）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测权限与降级', { type: 'primary', size: 'sm', onClick: () => this._runSecurityDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 权限检测
const result = await navigator.permissions.query({ name: 'smart-card' } as any);
if (result.state === 'prompt') { /* 需用户手势 */ }

// 降级链：Web Smart Card → WebUSB+CCID → 服务端 HSM
async function getSigner() {
  if ('smartCard' in navigator) {
    const ctx = await navigator.smartCard.establishContext();
    return ctx;  // 首选
  }
  if ('usb' in navigator) {
    const dev = await navigator.usb.requestDevice({
      filters: [{ classCode: 0x0B }],  // CCID
    });
    return new CCIDOverWebUSB(dev);     // 降级1
  }
  return new RemoteSigner('/api/sign'); // 降级2
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.securityInfo || '（点击按钮查看权限与安全完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return null;
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'Web Smart Card API 智能卡/eID/数字签名实验室'),
            h(Alert, {
                type: 'info',
                message: 'Web Smart Card API —— 基于 PC/SC 模型的浏览器智能卡访问（eID/数字签名/PAdES）实验室',
                description: '演示 Web Smart Card API（W3C 提案，navigator.smartCard 入口）：概念与 PC/SC 模型（PC/SC 工作组分层模型 + APDU 命令/响应 CLA/INS/P1/P2/Lc/Data/Le + SW1/SW2 + 与 WebUSB/WebHID 直连读卡器差异 + 浏览器支持矩阵）、SmartCardContext 生命周期（establishContext 等价 SCardEstablishContext + PCSCInterface 透传 PC/SC 错误码 SCARD_E_NO_SERVICE/SCARD_E_CARD_NOT_PRESENT + releaseContext + smart-card Permission Policy）、读卡器列举与热插拔（listReaders 等价 SCardListReaders + reader-added/removed 与 card-inserted/removed 事件 + SmartCardRequest/SmartCardStatus 状态机 + ATR 概览）、连接与协议（connect/disconnect 等价 SCardConnect/SCardDisconnect + T=0 字符协议/T=1 块协议/raw + isConnected + ATR 解析 ISO/IEC 7816-3）、APDU 传输（transmit 等价 SCardTransmit + 四种 CASE + SW1/SW2 解析 0x9000/0x61xx/0x6Cxx/0x6982 + 长响应链 GET RESPONSE + Uint8Array/十六进制互转）、eID 实战（MF/DF/EF 文件结构 + SELECT by AID/FID + READ BINARY TLV + PIN VERIFY + PSO MSE SET/HASH/SIGN 数字签名）、PAdES 数字签名（ETSI TS 102 778 B-B/B-T/B-LT/B-LTA + PKCS#11→Web Crypto+Smart Card+PDF.js + ByteRange+/Contents 嵌入 + RFC 3161 时间戳 + WebAuthn 协同）、权限与安全（smart-card Permission Policy + HTTPS/localhost + 降级链 Web Smart Card→WebUSB CCID→服务端 HSM + PIN 输入界面 Shadow DOM 隔离 + 计时攻击防护 + 中间人/重放/隐私合规）。必须 HTTPS/localhost 与用户手势。jsdom 无 navigator.smartCard 所有检测为 false，真实浏览器 Chromium 提案阶段需 flag 配合 PC/SC 读卡器可完整体验。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=WebSmartCardAPIPage.js.map