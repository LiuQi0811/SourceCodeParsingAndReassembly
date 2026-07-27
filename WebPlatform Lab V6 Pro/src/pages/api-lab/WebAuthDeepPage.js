// =====================================================================
// WebAuthDeepPage.js —— Web Authentication（WebAuthn）深入实验室
// 演示 MDN：
//   1. PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable /
//      isExternalSignalCTAPBridgingAvailable —— 能力检测与 COSE 算法
//   2. navigator.credentials.create({ publicKey }) —— 注册流程（attestation）
//   3. navigator.credentials.get({ publicKey }) —— 认证流程（assertion）
//   4. AuthenticatorAttachment / transports / UserVerification —— 认证器类型与用户验证
//   5. Resident Key / Discoverable Credential —— 可发现凭据与无密码登录
//   6. parseCreationOptionsFromJSON / toJSON / Extensions —— ES2024 序列化与扩展
// 说明：WebAuthn 基于公钥密码学，用认证器（TouchID/Windows Hello/USB 安全密钥）
//       替代密码实现抗钓鱼的强认证。所有 API 调用前做 typeof 能力检测，不可用时
//       仅记日志（_addLog('warn', ...)），绝不抛异常。jsdom/Node 中 PublicKeyCredential
//       通常 undefined，需真实浏览器 + HTTPS + 认证器才能完整演示。
//       本页不真正调用 credentials.create/get（会触发认证器弹窗），仅展示用法、
//       构造 options，并用 mock 返回值演示解析流程。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// COSE 算法标识表（pubKeyCredParams.alg）：WebAuthn 用 COSE 注册表编号标识公钥算法
// 常见值：ES256=-7（ECDSA P-256 + SHA-256）、RS256=-257（RSASSA-PKCS1-v1_5 + SHA-256）
const COSE_ALGS = [
  { alg: -7, name: 'ES256', desc: 'ECDSA w/ SHA-256, P-256 曲线（推荐，最广泛支持）' },
  { alg: -35, name: 'ES384', desc: 'ECDSA w/ SHA-384, P-384 曲线' },
  { alg: -36, name: 'ES512', desc: 'ECDSA w/ SHA-512, P-521 曲线' },
  { alg: -257, name: 'RS256', desc: 'RSASSA-PKCS1-v1_5 w/ SHA-256（兼容性好，密钥大）' },
  { alg: -258, name: 'RS384', desc: 'RSASSA-PKCS1-v1_5 w/ SHA-384' },
  { alg: -259, name: 'RS512', desc: 'RSASSA-PKCS1-v1_5 w/ SHA-512' },
  { alg: -37, name: 'PS256', desc: 'RSASSA-PSS w/ SHA-256（概率性签名）' },
  { alg: -8, name: 'EdDSA', desc: 'EdDSA（Ed25519，速度快密钥小）' },
];

// 演示用的 mock 挑战值与用户 ID（真实场景由服务器生成随机 challenge）
const MOCK_CHALLENGE = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const MOCK_USER_ID = new Uint8Array([100, 101, 102, 103, 104, 105, 106, 107]);

// transports 取值集合（认证器支持的传输方式）
const TRANSPORTS = ['usb', 'nfc', 'ble', 'internal', 'hybrid', 'smart-card'];

// 工具：把 ArrayBuffer / Uint8Array 转成十六进制字符串（用于展示二进制数据）
function bufToHex(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

// 工具：把 ArrayBuffer / Uint8Array 转成 Base64URL 字符串（模拟 credential.id 的编码形式）
function bufToBase64Url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function'
    ? btoa(bin)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export class WebAuthDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：能力检测
      supportInfo: '',
      platformAuthInfo: '',
      // Card 2：注册流程 attestation
      creationOptionsInfo: '',
      attestationResult: '',
      // Card 3：认证流程 assertion
      requestOptionsInfo: '',
      assertionResult: '',
      // Card 4：Attachment + transports + UV
      attachmentInfo: '',
      // Card 5：Resident Key
      residentKeyInfo: '',
      // Card 6：ES2024 JSON + Extensions
      jsonInfo: '',
      extensionsInfo: '',
      // Card 9：Digital Credentials API 数字凭证
      digitalCredentialsInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 创建 AbortController，用于 componentWillUnmount 中止可能进行中的异步检测
    this._abortCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._mockCredential = null;   // Card 2 mock 出的 PublicKeyCredential（attestation）
    this._mockAssertion = null;    // Card 3 mock 出的 assertion credential

    // 一次性能力检测：WebAuthn 全家桶
    const hasPKC = typeof PublicKeyCredential !== 'undefined';
    const hasCredStore = typeof navigator !== 'undefined' && !!navigator.credentials &&
      typeof navigator.credentials.create === 'function';
    const hasGet = typeof navigator !== 'undefined' && !!navigator.credentials &&
      typeof navigator.credentials.get === 'function';
    const hasUVPA = hasPKC && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
    const hasSignal = hasPKC && typeof PublicKeyCredential.isExternalSignalCTAPBridgingAvailable === 'function';
    const hasParseCreation = hasPKC && typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function';
    const hasParseRequest = hasPKC && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function';

    const parts = [];
    parts.push(`PublicKeyCredential ${hasPKC ? '✓' : '✗'}`);
    parts.push(`credentials.create ${hasCredStore ? '✓' : '✗'}`);
    parts.push(`credentials.get ${hasGet ? '✓' : '✗'}`);
    parts.push(`isUVPlatformAuth ${hasUVPA ? '✓' : '✗'}`);
    parts.push(`signalCTAP ${hasSignal ? '✓' : '✗'}`);
    parts.push(`parseCreation ${hasParseCreation ? '✓' : '✗'}`);
    parts.push(`parseRequest ${hasParseRequest ? '✓' : '✗'}`);

    const summary = hasPKC
      ? `WebAuthn 能力检测：${parts.join(' · ')}。检测到 PublicKeyCredential，但 credentials.create/get 需真实浏览器 + HTTPS + 认证器才会真正触发；jsdom 等测试环境通常仅静态方法可用。`
      : '当前环境（jsdom/Node）不支持 WebAuthn（typeof PublicKeyCredential === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（HTTPS / localhost）+ 认证器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(hasPKC ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasCredStore) this._addLog('warn', 'navigator.credentials.create 不可用（需安全上下文 HTTPS/localhost）');
    if (!hasUVPA) this._addLog('warn', 'isUserVerifyingPlatformAuthenticatorAvailable 不可用');
    if (!hasParseCreation) this._addLog('warn', 'parseCreationOptionsFromJSON 不可用（ES2024 新方法）');
    const hasDigitalCred = (() => { try { return typeof window !== 'undefined' && typeof window.DigitalCredential !== 'undefined'; } catch { return false; } })();
    if (!hasDigitalCred) this._addLog('warn', 'DigitalCredential 不可用（W3C WebAuth 2024-2025，Chrome behind flag，jsdom 无）');
  }

  componentWillUnmount() {
    // 中止可能进行中的异步检测（isUserVerifyingPlatformAuthenticatorAvailable）
    if (this._abortCtrl) {
      try { this._abortCtrl.abort(); } catch { /* noop */ }
      this._abortCtrl = null;
    }
    // 释放 mock 凭据引用，便于 GC
    this._mockCredential = null;
    this._mockAssertion = null;
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
    const hasPKC = typeof PublicKeyCredential !== 'undefined';
    const hasCred = typeof navigator !== 'undefined' && !!navigator.credentials &&
      typeof navigator.credentials.create === 'function';
    return {
      pkc: hasPKC,
      credCreate: hasCred,
      credGet: typeof navigator !== 'undefined' && !!navigator.credentials &&
        typeof navigator.credentials.get === 'function',
      uvpa: hasPKC && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function',
      signal: hasPKC && typeof PublicKeyCredential.isExternalSignalCTAPBridgingAvailable === 'function',
      parseCreation: hasPKC && typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function',
      parseRequest: hasPKC && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function',
      digitalCredential: (() => { try { return typeof window !== 'undefined' && typeof window.DigitalCredential !== 'undefined'; } catch { return false; } })(),
    };
  }

  // =================== Card 1：能力检测 + 平台认证器 ===================

  // 同步能力检测：列出所有 WebAuthn 相关 API 的可用性
  _detectSupport() {
    const caps = this._caps();
    const lines = [];
    lines.push('WebAuthn 同步能力检测结果：');
    lines.push(`• PublicKeyCredential（全局构造器）：${caps.pkc ? '可用' : '不可用'}`);
    lines.push(`• navigator.credentials.create（注册）：${caps.credCreate ? '可用' : '不可用'}`);
    lines.push(`• navigator.credentials.get（认证）：${caps.credGet ? '可用' : '不可用'}`);
    lines.push(`• isUserVerifyingPlatformAuthenticatorAvailable：${caps.uvpa ? '可用' : '不可用'}`);
    lines.push(`• isExternalSignalCTAPBridgingAvailable：${caps.signal ? '可用' : '不可用'}`);
    lines.push(`• parseCreationOptionsFromJSON（ES2024）：${caps.parseCreation ? '可用' : '不可用'}`);
    lines.push(`• parseRequestOptionsFromJSON（ES2024）：${caps.parseRequest ? '可用' : '不可用'}`);
    lines.push('');
    lines.push('说明：credentials.create/get 需安全上下文（HTTPS/localhost），否则 navigator.credentials 为 undefined；');
    lines.push('jsdom/Node 测试环境通常 PublicKeyCredential 整体为 undefined；');
    lines.push('即使检测可用，create/get 也只在用户交互（点击）后才真正弹出认证器。');
    this.setState({ supportInfo: lines.join('\n') });
    this._addLog('caps', `同步检测：PKC=${caps.pkc}，create=${caps.credCreate}，get=${caps.credGet}`);
  }

  // PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() → Promise<boolean>
  // 检测是否存在平台认证器（TouchID / Windows Hello / 指纹），不触发认证器弹窗
  async _detectPlatformAuthenticator() {
    const caps = this._caps();
    if (!caps.uvpa) {
      this._addLog('warn', 'PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable 不可用');
      this.setState({
        platformAuthInfo:
          'PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable 不可用\n' +
          '该方法检测是否存在平台认证器（TouchID/Windows Hello），需真实浏览器 + HTTPS。',
      });
      return;
    }
    try {
      this._addLog('uvpa', '调用 isUserVerifyingPlatformAuthenticatorAvailable()…');
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      this.setState({
        platformAuthInfo:
          'PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() → Promise<boolean>\n' +
          `返回值：${available}\n` +
          `含义：${available ? '存在平台认证器（TouchID/Windows Hello/指纹），可做 platform 注册' : '无平台认证器，只能用 cross-platform（USB 安全密钥/手机）'}\n\n` +
          '说明：\n' +
          '• 该方法不触发认证器弹窗，仅做能力探测，可安全调用\n' +
          '• 返回 true 不代表用户已注册，只代表设备具备平台认证器硬件/能力；COOP/COEP 可能影响结果',
      });
      this._addLog('uvpa', `平台认证器检测结果：${available ? '可用' : '不可用'}`);
    } catch (err) {
      this._addLog('warn', `isUVPlatformAuth 调用失败：${err.name} - ${err.message}`);
      this.setState({ platformAuthInfo: `检测失败：${err.name} - ${err.message}` });
    }
  }

  // 列出 COSE 公钥算法标识表（pubKeyCredParams.alg）
  _listCoseAlgs() {
    const lines = [];
    lines.push('COSE 算法标识表（pubKeyCredParams.alg）：');
    lines.push('WebAuthn 用 COSE 注册表编号标识公钥算法，alg 为负数。');
    lines.push('');
    for (const a of COSE_ALGS) {
      lines.push(`• alg: ${a.alg.toString().padStart(5)}  ${a.name.padEnd(6)}  ${a.desc}`);
    }
    lines.push('');
    lines.push('pubKeyCredParams 示例：');
    lines.push("  [{ type: 'public-key', alg: -7 },   // ES256（推荐）");
    lines.push("   { type: 'public-key', alg: -257 }] // RS256（兼容）");
    lines.push('');
    lines.push('说明：服务器按优先级列出可接受的算法，认证器选其一；ES256(-7) 默认最广支持；type 固定 "public-key"。');
    this.setState({ supportInfo: lines.join('\n') });
    this._addLog('cose', `列出 ${COSE_ALGS.length} 种 COSE 算法（ES256/RS256/EdDSA 等）`);
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. WebAuthn 能力检测 + 平台认证器',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.pkc ? 'success' : 'error' }, caps.pkc ? 'PublicKeyCredential ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'isUVPA / COSE'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() → Promise<boolean> 检测平台认证器（TouchID/Windows Hello），不触发弹窗；isExternalSignalCTAPBridgingAvailable() 检测 CTAP 桥接（较新）。所有 API 前做 typeof 检测，jsdom/Node 中 PublicKeyCredential 通常 undefined，需真实浏览器 + HTTPS。pubKeyCredParams.alg 用 COSE 注册表编号标识公钥算法（ES256=-7、RS256=-257、EdDSA=-8）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('同步检测', { type: 'primary', size: 'sm', onClick: () => this._detectSupport() }),
          this._btn('检测平台认证器', { type: 'primary', size: 'sm', disabled: !caps.uvpa, onClick: () => this._detectPlatformAuthenticator() }),
          this._btn('COSE 算法表', { size: 'sm', onClick: () => this._listCoseAlgs() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '能力检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.supportInfo || '（点击「同步检测」或「COSE 算法表」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '平台认证器检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.platformAuthInfo || '（点击「检测平台认证器」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`// 检测平台认证器（不触发弹窗，可安全调用）
if (typeof PublicKeyCredential !== 'undefined' &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
  const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  // ok=true → 设备有 TouchID/Windows Hello，可做 platform 注册
}

// pubKeyCredParams：接受的公钥算法（COSE 编号）
pubKeyCredParams: [
  { type: 'public-key', alg: -7 },    // ES256（推荐）
  { type: 'public-key', alg: -257 },  // RS256（兼容）
];`)),
        h(Alert, {
          type: 'info',
          message: 'isUserVerifyingPlatformAuthenticatorAvailable 可安全调用',
          description: '该方法只做能力探测，不触发认证器交互，可在页面加载时调用以决定 UI（是否显示"用 TouchID 注册"按钮）。返回 true 仅表示设备具备平台认证器，不代表用户已注册凭据。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：注册流程 attestation ===================

  // 构造 PublicKeyCredentialCreationOptions（注册选项）
  _buildCreationOptions() {
    const options = {
      challenge: MOCK_CHALLENGE,
      rp: { name: 'API Lab 演示站', id: 'localhost' },
      user: {
        id: MOCK_USER_ID,
        name: 'demo@example.com',
        displayName: '演示用户',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },    // ES256
        { type: 'public-key', alg: -257 },  // RS256
      ],
      timeout: 60000,
      excludeCredentials: [
        { type: 'public-key', id: new Uint8Array([10, 20, 30]), transports: ['internal', 'hybrid'] },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        requireResidentKey: false,
        userVerification: 'preferred',
      },
      attestation: 'none',
      extensions: { credProps: true },
    };
    const lines = [];
    lines.push('PublicKeyCredentialCreationOptions 构造结果：');
    lines.push(JSON.stringify({
      challenge: `Uint8Array(${MOCK_CHALLENGE.length}) [${Array.from(MOCK_CHALLENGE).join(', ')}]`,
      rp: options.rp,
      user: { id: `Uint8Array(${MOCK_USER_ID.length})`, name: options.user.name, displayName: options.user.displayName },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      excludeCredentials: options.excludeCredentials.map((c) => ({ ...c, id: 'Uint8Array(...)' })),
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation,
      extensions: options.extensions,
    }, null, 2));
    lines.push('');
    lines.push('字段说明：');
    lines.push('• challenge：服务器生成的随机挑战（Uint8Array，≥16 字节），防重放');
    lines.push('• rp：依赖方（网站）信息，id 必须是当前域名或其可注册后缀');
    lines.push('• user：用户标识，id 为 Uint8Array（不透明字节，服务器主键）');
    lines.push('• pubKeyCredParams：接受的公钥算法列表，认证器按优先级选其一');
    lines.push('• timeout：超时毫秒数；excludeCredentials：已注册凭据，防重复注册');
    lines.push('• authenticatorSelection：认证器筛选条件（见 Card 4/5）');
    lines.push('• attestation：none/indirect/direct；extensions：扩展（见 Card 6）');
    this.setState({ creationOptionsInfo: lines.join('\n') });
    this._addLog('create', '已构造 PublicKeyCredentialCreationOptions（challenge/rp/user/pubKeyCredParams/...）');
  }

  // 演示 navigator.credentials.create 调用流程 + mock 返回值解析
  // 注意：不真正调用 create（会触发认证器弹窗），仅展示用法与解析流程
  _demoCreateFlow() {
    const caps = this._caps();
    const lines = [];
    lines.push('注册流程（attestation）调用与解析：');
    lines.push('');
    lines.push('// 真实调用代码（需用户点击触发，会弹出认证器）：');
    lines.push('const credential = await navigator.credentials.create({ publicKey: creationOptions });');
    lines.push('// → 返回 PublicKeyCredential（AuthenticatorAttestationResponse）');
    lines.push('');
    if (!caps.credCreate) {
      lines.push('当前环境 navigator.credentials.create 不可用（需真实浏览器 + HTTPS + 认证器）。下面用 mock 返回值演示解析流程：');
      lines.push('');
    }
    // mock 一个 PublicKeyCredential 返回值（不真正调用 create）
    const mockRawId = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
    const mockClientData = new Uint8Array(
      Array.from('{"type":"webauthn.create","challenge":"AQIDBAU","origin":"https://localhost"}')
        .map((c) => c.charCodeAt(0))
    );
    const mockAttObj = new Uint8Array([0xa3, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const mockAuthData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    const mockPubKey = new Uint8Array([0x30, 0x59, 0x30, 0x13, 0x06, 0x07]);
    const mockCred = {
      id: bufToBase64Url(mockRawId),
      rawId: mockRawId.buffer,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: mockClientData.buffer,
        attestationObject: mockAttObj.buffer,
        getAuthenticatorData: () => mockAuthData.buffer,
        getPublicKey: () => mockPubKey.buffer,
        getPublicKeyAlgorithm: () => -7,
        getTransports: () => ['internal', 'hybrid'],
      },
      getClientExtensionResults: () => ({ credProps: { rk: true } }),
    };
    this._mockCredential = mockCred;

    lines.push('解析返回的 PublicKeyCredential（AuthenticatorAttestationResponse）：');
    lines.push(`• credential.id（Base64URL）= ${mockCred.id}`);
    lines.push(`• credential.rawId（ArrayBuffer）= [${bufToHex(new Uint8Array(mockCred.rawId))}]`);
    lines.push(`• credential.type = ${mockCred.type}；authenticatorAttachment = ${mockCred.authenticatorAttachment}`);
    lines.push(`• response.clientDataJSON（ArrayBuffer）= [${bufToHex(mockClientData).slice(0, 48)}...] → 解码：{ type:'webauthn.create', challenge, origin }`);
    lines.push(`• response.attestationObject（ArrayBuffer）= [${bufToHex(mockAttObj)}] → CBOR 编码（含 fmt/attStmt/authData）`);
    lines.push(`• response.getAuthenticatorData() = [${bufToHex(mockAuthData)}] → 认证器数据（rpIdHash+flags+signCount+attestedCredentialData）`);
    lines.push(`• response.getPublicKey() = [${bufToHex(mockPubKey)}] → SPKI 格式公钥，服务器用于后续验签`);
    lines.push(`• response.getPublicKeyAlgorithm() = ${mockCred.response.getPublicKeyAlgorithm()}（ES256）`);
    lines.push(`• response.getTransports() = ${JSON.stringify(mockCred.response.getTransports())} → 存库供后续 allowCredentials.transports 用`);
    lines.push(`• credential.getClientExtensionResults() = ${JSON.stringify(mockCred.getClientExtensionResults())}`);
    lines.push('');
    lines.push('服务器验证流程：');
    lines.push('1. 解析 clientDataJSON，校验 type=webauthn.create、challenge、origin');
    lines.push('2. 解析 attestationObject（CBOR），提取 authData，校验 rpIdHash/flags');
    lines.push('3. 提取公钥 getPublicKey() 存库（凭据 id → 公钥），验证 attStmt 签名（none 时跳过）');
    this.setState({ attestationResult: lines.join('\n') });
    this._addLog('create', `注册流程演示完成（mock）：id=${mockCred.id.slice(0, 12)}...，alg=-7，transports=[internal,hybrid]`);
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. WebAuthn 注册流程（attestation）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.credCreate ? 'success' : 'error' }, caps.credCreate ? 'create ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'credentials.create'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.credentials.create({ publicKey: creationOptions }) → Promise<PublicKeyCredential> 触发注册：认证器生成密钥对，私钥留存认证器，公钥经 attestationObject 返回。返回的 AuthenticatorAttestationResponse 含 clientDataJSON（客户端上下文）、attestationObject（CBOR 编码的签名数据）；getAuthenticatorData()/getPublicKey()/getPublicKeyAlgorithm()/getTransports() 为较新的便捷访问器。本页不真正调用 create（会弹认证器），仅构造 options 并用 mock 返回值演示解析。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('构造 CreationOptions', { type: 'primary', size: 'sm', onClick: () => this._buildCreationOptions() }),
          this._btn('演示 create 解析', { type: 'primary', size: 'sm', onClick: () => this._demoCreateFlow() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'PublicKeyCredentialCreationOptions：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.creationOptionsInfo || '（点击「构造 CreationOptions」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'create 返回值解析（mock）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.attestationResult || '（点击「演示 create 解析」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`const creationOptions = {
  challenge: new Uint8Array([/* 16 字节随机 */]),
  rp: { name: '我的站点', id: 'example.com' },
  user: { id: new Uint8Array([100,101,102]), name: 'alice', displayName: 'Alice' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  authenticatorSelection: { userVerification: 'preferred' },
  attestation: 'none',
};
// 用户点击后调用（会弹出认证器）
const cred = await navigator.credentials.create({ publicKey: creationOptions });
// cred.response.attestationObject / clientDataJSON / getPublicKey() … 发服务器存公钥`)),
        h(Alert, {
          type: 'warning',
          message: 'create 必须由用户手势触发',
          description: 'navigator.credentials.create 必须在用户点击/按键等手势的回调中调用，否则浏览器拒绝弹出认证器。返回的 attestationObject 是 CBOR 编码，服务器需用 CBOR 解码库解析（authData 含 rpIdHash/flags/signCount/attestedCredentialData）。attestation: none 可减少隐私泄露，多数场景推荐。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：认证流程 assertion ===================

  // 构造 PublicKeyCredentialRequestOptions（认证选项）
  _buildRequestOptions() {
    const options = {
      challenge: MOCK_CHALLENGE,
      rpId: 'localhost',
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: [
        { type: 'public-key', id: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]), transports: ['internal', 'hybrid'] },
      ],
      extensions: { credProps: true },
    };
    const lines = [];
    lines.push('PublicKeyCredentialRequestOptions 构造结果：');
    lines.push(JSON.stringify({
      challenge: `Uint8Array(${MOCK_CHALLENGE.length}) [${Array.from(MOCK_CHALLENGE).join(', ')}]`,
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification,
      allowCredentials: options.allowCredentials.map((c) => ({ ...c, id: 'Uint8Array(...)' })),
      extensions: options.extensions,
    }, null, 2));
    lines.push('');
    lines.push('字段说明：');
    lines.push('• challenge：服务器生成的随机挑战（Uint8Array），防重放');
    lines.push('• rpId：依赖方 ID（域名），必须与注册时 rp.id 一致');
    lines.push('• timeout：超时毫秒数；userVerification：required/preferred/discouraged（见 Card 4）');
    lines.push('• allowCredentials：允许的凭据列表（id 来自注册返回）；可发现凭据时可省略，认证器自行匹配用户');
    lines.push('• extensions：扩展（见 Card 6）');
    this.setState({ requestOptionsInfo: lines.join('\n') });
    this._addLog('get', '已构造 PublicKeyCredentialRequestOptions（challenge/rpId/allowCredentials/...）');
  }

  // 演示 navigator.credentials.get 调用流程 + mock 返回值解析
  // 注意：不真正调用 get（会触发认证器弹窗），仅展示用法与解析流程
  _demoGetFlow() {
    const caps = this._caps();
    const lines = [];
    lines.push('认证流程（assertion）调用与解析：');
    lines.push('');
    lines.push('// 真实调用代码（需用户点击触发，会弹出认证器）：');
    lines.push('const assertion = await navigator.credentials.get({ publicKey: requestOptions });');
    lines.push('// → 返回 PublicKeyCredential（AuthenticatorAssertionResponse）');
    lines.push('');
    if (!caps.credGet) {
      lines.push('当前环境 navigator.credentials.get 不可用（需真实浏览器 + HTTPS + 认证器）。下面用 mock 返回值演示解析流程：');
      lines.push('');
    }
    // mock 一个 assertion 返回值
    const mockRawId = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
    const mockClientData = new Uint8Array(
      Array.from('{"type":"webauthn.get","challenge":"AQIDBAU","origin":"https://localhost"}')
        .map((c) => c.charCodeAt(0))
    );
    const mockAuthData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    const mockSignature = new Uint8Array([0x30, 0x45, 0x02, 0x20, 0x11, 0x22, 0x33, 0x44]);
    const mockUserHandle = MOCK_USER_ID;   // userHandle 存在表示 UV 成功
    const mockAssertion = {
      id: bufToBase64Url(mockRawId),
      rawId: mockRawId.buffer,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: mockClientData.buffer,
        authenticatorData: mockAuthData.buffer,
        signature: mockSignature.buffer,
        userHandle: mockUserHandle.buffer,
      },
      getClientExtensionResults: () => ({}),
    };
    this._mockAssertion = mockAssertion;

    lines.push('解析返回的 PublicKeyCredential（AuthenticatorAssertionResponse）：');
    lines.push(`• assertion.id（Base64URL）= ${mockAssertion.id}`);
    lines.push(`• assertion.rawId（ArrayBuffer）= [${bufToHex(new Uint8Array(mockAssertion.rawId))}]`);
    lines.push(`• assertion.type = ${mockAssertion.type}；authenticatorAttachment = ${mockAssertion.authenticatorAttachment}`);
    lines.push(`• response.clientDataJSON（ArrayBuffer）= [${bufToHex(mockClientData).slice(0, 40)}...] → 解码：{ type:'webauthn.get', challenge, origin }`);
    lines.push(`• response.authenticatorData（ArrayBuffer）= [${bufToHex(mockAuthData)}] → 认证器数据（rpIdHash+flags+signCount），无 attestedCredentialData`);
    lines.push(`• response.signature（ArrayBuffer）= [${bufToHex(mockSignature)}] → 对 authenticatorData || SHA256(clientDataJSON) 的签名`);
    lines.push(`• response.userHandle（ArrayBuffer）= [${bufToHex(mockUserHandle)}] → 用户 ID（可发现凭据返回；存在表示 UV 成功）`);
    lines.push('');
    lines.push('服务器验证流程：');
    lines.push('1. 用 challenge 对应的凭据 id 查库取公钥');
    lines.push('2. 解析 clientDataJSON，校验 type=webauthn.get、challenge、origin');
    lines.push('3. 校验 authenticatorData 的 rpIdHash/flags.UP/UV，用公钥验签 signature');
    lines.push('4. 校验 signCount > 上次记录值（防克隆，可选）；验签通过则登录成功');
    this.setState({ assertionResult: lines.join('\n') });
    this._addLog('get', `认证流程演示完成（mock）：userHandle 存在（UV 成功），signature 已展示`);
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. WebAuthn 认证流程（assertion）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.credGet ? 'success' : 'error' }, caps.credGet ? 'get ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'credentials.get'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.credentials.get({ publicKey: requestOptions }) → Promise<PublicKeyCredential> 触发认证：认证器用留存的私钥对挑战签名，返回 AuthenticatorAssertionResponse。response 含 clientDataJSON、authenticatorData（认证器数据）、signature（签名）、userHandle（用户 ID，可发现凭据时返回；存在表示 UV 成功）。服务器用注册时的公钥验签。本页不真正调用 get，仅构造 options 并用 mock 返回值演示解析。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('构造 RequestOptions', { type: 'primary', size: 'sm', onClick: () => this._buildRequestOptions() }),
          this._btn('演示 get 解析', { type: 'primary', size: 'sm', onClick: () => this._demoGetFlow() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'PublicKeyCredentialRequestOptions：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.requestOptionsInfo || '（点击「构造 RequestOptions」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'get 返回值解析（mock）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.assertionResult || '（点击「演示 get 解析」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const requestOptions = {
  challenge: new Uint8Array([/* 16 字节随机 */]),
  rpId: 'example.com',
  userVerification: 'preferred',
  allowCredentials: [{ type: 'public-key', id: storedCredId }],
};
// 用户点击后调用（会弹出认证器）
const assertion = await navigator.credentials.get({ publicKey: requestOptions });
// assertion.response.signature / authenticatorData / userHandle … 发服务器验签`)),
        h(Alert, {
          type: 'info',
          message: 'assertion 用注册公钥验签完成登录',
          description: '认证流程不传输密码或私钥，认证器内部用留存的私钥对（authenticatorData || SHA256(clientDataJSON)）签名，服务器用注册时存库的公钥验签。验签通过即完成强认证。userHandle 存在表示用户验证（UV）成功，可据此识别用户（可发现凭据场景）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Attachment + transports + UV ===================

  // 对比 platform/cross-platform，列出 transports，说明 UV 三种模式
  _explainAttachments() {
    const transportDesc = {
      usb: 'USB 有线连接（安全密钥）',
      nfc: 'NFC 近场通信（轻触）',
      ble: '蓝牙低功耗',
      internal: '平台内置（TouchID/Windows Hello）',
      hybrid: '混合（手机经 BLE+互联网协助）',
      'smart-card': '智能卡读卡器（较新）',
    };
    const transportsText = TRANSPORTS.map((t) => `  • ${t.padEnd(12)} ${transportDesc[t]}`).join('\n');
    const text = `AuthenticatorAttachment（认证器附着类型）：

• platform：平台认证器（内置于设备，不可移除）
  示例：TouchID（macOS/iOS）、Windows Hello、Android 指纹/面部
  特点：便捷、私钥不离开设备；换设备需重新注册
  选项：authenticatorSelection.authenticatorAttachment = "platform"

• cross-platform：漫游认证器（可拔插、跨设备使用）
  示例：USB 安全密钥（YubiKey）、NFC 卡、手机（跨设备蓝牙）
  特点：可在多设备间共享凭据；需物理交互
  选项：authenticatorSelection.authenticatorAttachment = "cross-platform"

• 省略 authenticatorAttachment：允许任意类型（最宽松）

Transports（认证器传输方式，getTransports() 返回）：
${transportsText}
  用途：存库后供下次 allowCredentials.transports 用，帮助浏览器选合适传输。

UserVerification（用户验证，userVerification 字段）：
• required：必须验证用户身份（生物识别 / PIN），不支持则失败（高安全场景）
• preferred：优先验证，不支持则降级为 presence（仅触控）（默认推荐）
• discouraged：仅 presence（用户触控），不做身份验证（低风险场景）

UV 判定：authenticatorData 的 flags.UV 位=1 表示 UV 成功；
assertion 中 response.userHandle 存在也表示 UV 成功（可发现凭据）。`;
    this.setState({ attachmentInfo: text });
    this._addLog('attach', '已对比 platform/cross-platform，列出 transports 与 UV 三种模式');
  }

  _renderCard4() {
    const s = this.state;
    const card = new Card({
      title: '4. AuthenticatorAttachment + transports + UserVerification',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'platform / cross-platform'),
        h(Tag, { color: 'primary' }, 'UV 三模式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'authenticatorSelection.authenticatorAttachment 控制 platform（TouchID/Windows Hello，内置不可移除）或 cross-platform（USB 安全密钥/手机，漫游可拔插）。transports（getTransports() 返回 usb/nfc/ble/internal/hybrid/smart-card）描述认证器传输方式，存库供后续 allowCredentials.transports 用。userVerification 三种模式：required（必须生物识别/PIN）、preferred（优先验证，降级为 presence）、discouraged（仅触控）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('对比说明', { type: 'primary', size: 'sm', onClick: () => this._explainAttachments() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Attachment / transports / UV 说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.attachmentInfo || '（点击「对比说明」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// 注册时筛选认证器类型
authenticatorSelection: {
  authenticatorAttachment: 'platform',  // 或 'cross-platform'，或省略
  userVerification: 'preferred',        // required / preferred / discouraged
}
// 注册返回的 transports 存库，下次认证时回填 allowCredentials.transports
const transports = cred.response.getTransports(); // ['internal','hybrid']
allowCredentials: [{ type: 'public-key', id, transports }]`)),
        h(Alert, {
          type: 'info',
          message: 'UV 优先级与降级策略',
          description: 'userVerification=preferred 时，若认证器支持生物识别/PIN 则做 UV（flags.UV=1），否则降级为 presence（flags.UP=1）。required 则强制 UV，不支持直接失败。服务器应校验 flags.UV 是否满足策略，不可仅依赖客户端声明。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Resident Key / Discoverable Credential ===================

  // 解释 residentKey 三种值与无密码登录
  _explainResidentKey() {
    const text = `Resident Key / Discoverable Credential（可发现凭据）：

residentKey 字段（authenticatorSelection.residentKey）三种取值：

• required：必须创建可发现凭据
  认证器若不支持则注册失败；凭据存储在认证器内，绑定用户身份。
  认证时无需 allowCredentials，认证器自行匹配用户（无密码登录）。
• preferred：优先创建可发现凭据
  支持则创建，不支持则退化为非可发现凭据（服务器端凭据）。多数场景推荐。
• discouraged：不创建可发现凭据
  凭据仅存于服务器（认证器只存私钥引用），认证时必须提供 allowCredentials。

requireResidentKey（旧字段，兼容）：true 等价于 residentKey: "required"。

无密码登录流程（residentKey: required）：
1. 注册：userVerification=required + residentKey=required，凭据绑定用户。
2. 认证：RequestOptions 中省略 allowCredentials（或留空）。
3. 认证器内部匹配用户，返回 userHandle（用户 ID）。
4. 服务器据 userHandle 直接识别用户，完成登录（无需输入用户名）。

allowCredentials 省略示例（可发现凭据）：
  const requestOptions = { challenge, rpId, timeout, userVerification: "required" };
  // allowCredentials 省略 → 认证器自行匹配

对比非可发现凭据（residentKey: discouraged）：
  认证时必须 allowCredentials: [{ type, id, transports }]，否则认证器不知用哪个凭据。`;
    this.setState({ residentKeyInfo: text });
    this._addLog('rk', '已解释 residentKey 三种值与无密码登录流程');
  }

  _renderCard5() {
    const s = this.state;
    const card = new Card({
      title: '5. Resident Key / Discoverable Credential',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'residentKey 三模式'),
        h(Tag, { color: 'primary' }, '无密码登录'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '可发现凭据（Discoverable Credential，又称 Resident Key）存储在认证器内并绑定用户身份。residentKey 三种值：required（必须创建，认证时可省略 allowCredentials，认证器自行匹配用户）、preferred（优先创建，不支持则退化）、discouraged（不创建，认证时必须提供 allowCredentials）。requireResidentKey 为旧字段，true 等价于 residentKey: "required"。可发现凭据是无密码登录的基础。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('解释可发现凭据', { type: 'primary', size: 'sm', onClick: () => this._explainResidentKey() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Resident Key 说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.residentKeyInfo || '（点击「解释可发现凭据」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// 无密码登录：注册时强制可发现凭据
authenticatorSelection: {
  residentKey: 'required',           // 必须 resident key
  userVerification: 'required',
  authenticatorAttachment: 'platform',
}
// 认证时省略 allowCredentials（认证器自行匹配用户）
const requestOptions = {
  challenge, rpId: 'example.com', timeout: 60000, userVerification: 'required',
  // 无 allowCredentials → 认证器返回 userHandle 识别用户
};
const assertion = await navigator.credentials.get({ publicKey: requestOptions });
const userId = new Uint8Array(assertion.response.userHandle); // 用户 ID`)),
        h(Alert, {
          type: 'warning',
          message: '可发现凭据占用认证器存储',
          description: '每个可发现凭据占用认证器内部存储（尤其是 USB 安全密钥容量有限），平台认证器（TouchID）通常无此限制。residentKey: required 时若认证器存储已满会注册失败。生产环境推荐 preferred 以兼顾无密码体验与兼容性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：ES2024 JSON 序列化 + Extensions ===================

  // 演示 parseCreationOptionsFromJSON / parseRequestOptionsFromJSON / toJSON
  _demoParseFromJSON() {
    const caps = this._caps();
    const lines = [];
    lines.push('ES2024 JSON 序列化 API（PublicKeyCredential 静态方法）：');
    lines.push('');
    lines.push('• parseCreationOptionsFromJSON(JSON) → PublicKeyCredentialCreationOptions');
    lines.push('  从纯 JSON（challenge/user.id 等为 Base64URL 字符串）构造 creationOptions。');
    lines.push('• parseRequestOptionsFromJSON(JSON) → PublicKeyCredentialRequestOptions');
    lines.push('  从纯 JSON 构造 requestOptions。');
    lines.push('• credential.toJSON() → object（Base64URL 编码二进制字段，可直接 JSON 传输）');
    lines.push('');
    lines.push('用途：服务器与客户端间用 JSON 传递 options/credential，无需手写 ArrayBuffer ↔ Base64URL 转换。');
    lines.push('');
    const jsonCreation = JSON.stringify({
      challenge: bufToBase64Url(MOCK_CHALLENGE),
      rp: { name: 'API Lab', id: 'localhost' },
      user: {
        id: bufToBase64Url(MOCK_USER_ID),
        name: 'demo@example.com',
        displayName: '演示用户',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      authenticatorSelection: { userVerification: 'preferred' },
      attestation: 'none',
    });
    lines.push('parseCreationOptionsFromJSON 输入示例（纯 JSON）：');
    lines.push(jsonCreation);
    lines.push('');
    if (caps.parseCreation) {
      try {
        const opts = PublicKeyCredential.parseCreationOptionsFromJSON(JSON.parse(jsonCreation));
        lines.push(`parseCreationOptionsFromJSON() → 成功`);
        lines.push(`  opts.challenge = Uint8Array(${opts.challenge.byteLength})，opts.user.id = Uint8Array(${opts.user.id.byteLength})`);
        lines.push(`  opts.rp.name = ${opts.rp.name}，opts.pubKeyCredParams = ${JSON.stringify(opts.pubKeyCredParams)}`);
        this._addLog('json', 'parseCreationOptionsFromJSON 成功（真实调用）');
      } catch (err) {
        lines.push(`parseCreationOptionsFromJSON() 抛错：${err.name} - ${err.message}`);
        this._addLog('warn', `parseCreationOptionsFromJSON 抛错：${err.message}`);
      }
    } else {
      lines.push('parseCreationOptionsFromJSON 不可用（ES2024 新方法，当前环境不支持）。');
      lines.push('解析后等价于（challenge/user.id 自动从 Base64URL 解码为 Uint8Array）：');
      lines.push('  { challenge: Uint8Array(16),');
      lines.push("    rp: { name: 'API Lab', id: 'localhost' },");
      lines.push("    user: { id: Uint8Array(8), name: 'demo@example.com', displayName: '演示用户' },");
      lines.push("    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 60000,");
      lines.push("    authenticatorSelection: { userVerification: 'preferred' }, attestation: 'none' }");
      this._addLog('warn', 'parseCreationOptionsFromJSON 不可用（ES2024）');
    }
    lines.push('');
    lines.push('credential.toJSON() 输出示例（Base64URL 编码二进制字段）：');
    const rkId = bufToBase64Url(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]));
    lines.push(JSON.stringify({
      id: rkId, rawId: rkId, type: 'public-key',
      response: {
        clientDataJSON: bufToBase64Url(new Uint8Array([1, 2, 3, 4])),
        attestationObject: bufToBase64Url(new Uint8Array([5, 6, 7, 8])),
        authenticatorData: bufToBase64Url(new Uint8Array([9, 10])),
        publicKey: bufToBase64Url(new Uint8Array([0x30, 0x59])),
        publicKeyAlgorithm: -7, transports: ['internal', 'hybrid'],
      },
      authenticatorAttachment: 'platform', clientExtensionResults: { credProps: { rk: true } },
    }, null, 2));
    this.setState({ jsonInfo: lines.join('\n') });
  }

  // 演示 WebAuthn Extensions（credProps / largeBlob / prf / payment）
  _demoExtensions() {
    const text = `WebAuthn Extensions（扩展）：
在 options.extensions 中指定，结果在 credential.getClientExtensionResults() 返回。

• credProps（认证器属性查询）
  注册时 extensions: { credProps: true }
  返回 { credProps: { rk: true|false } }，rk=true 表示创建了 resident key。
  用于确认可发现凭据是否真的创建（residentKey: preferred 时尤其有用）。

• largeBlob（大块数据存储）
  注册/认证时 extensions: { largeBlob: { support: "required"|"preferred" } }
  认证后可读写最多约 1KB 状态数据（如 remember-me token）。
  写：extensions.largeBlob.write = ArrayBuffer；读：extensions.largeBlob.read = true。
  结果 { largeBlob: { supported: true, blob: ArrayBuffer|undefined } }。

• prf（伪随机函数扩展，密钥派生）
  注册时 extensions: { prf: {} }；认证时 extensions: { prf: { eval: { first: Uint8Array } } }。
  返回 { prf: { results: { first: ArrayBuffer } } }，派生密钥可用于加密本地数据。
  每个 (凭据, 输入) 派生唯一密钥，认证器不暴露私钥。

• payment（支付扩展，SPC = Secure Payment Confirmation）
  用于在线支付场景，浏览器原生支付确认弹窗，绑定商户/支付方。
  通过 PaymentRequest API 触发，与 WebAuthn 协同。

注册扩展示例：
  const creationOptions = { ..., extensions: {
    credProps: true,                     // 查询 resident key
    largeBlob: { support: "preferred" }, // 大块存储
    prf: {},                             // 密钥派生能力
  }};
  const cred = await navigator.credentials.create({ publicKey: creationOptions });
  const extResults = cred.getClientExtensionResults();
  // { credProps: { rk: true }, largeBlob: { supported: true }, prf: { enabled: true } }

认证扩展示例（prf 派生 + largeBlob 读）：
  const requestOptions = { ..., extensions: {
    prf: { eval: { first: new Uint8Array([1,2,3,4]) } },
    largeBlob: { read: true },
  }};
  const assertion = await navigator.credentials.get({ publicKey: requestOptions });
  const ext = assertion.getClientExtensionResults();
  // { prf: { results: { first: ArrayBuffer(32) } }, largeBlob: { blob: ArrayBuffer } }`;
    this.setState({ extensionsInfo: text });
    this._addLog('ext', '已列出 credProps/largeBlob/prf/payment 四种扩展及用法');
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. ES2024 JSON 序列化 + Extensions',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.parseCreation ? 'success' : 'warning' }, caps.parseCreation ? 'parseFromJSON ✓' : 'parseFromJSON ✗'),
        h(Tag, { color: 'primary' }, 'credProps / largeBlob / prf'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ES2024 新增 PublicKeyCredential.parseCreationOptionsFromJSON()/parseRequestOptionsFromJSON() 从纯 JSON 构造 options（自动 Base64URL→Uint8Array），credential.toJSON() 反向序列化，省去手写二进制转码。Extensions（扩展）在 options.extensions 指定，结果在 getClientExtensionResults() 返回：credProps（查询 resident key）、largeBlob（约 1KB 状态存储）、prf（伪随机函数密钥派生）、payment（SPC 支付确认）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 JSON 序列化', { type: 'primary', size: 'sm', onClick: () => this._demoParseFromJSON() }),
          this._btn('演示 Extensions', { type: 'primary', size: 'sm', onClick: () => this._demoExtensions() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'JSON 序列化结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.jsonInfo || '（点击「演示 JSON 序列化」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Extensions 说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.extensionsInfo || '（点击「演示 Extensions」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`// ES2024：从 JSON 构造 options（自动解码 Base64URL）
const opts = PublicKeyCredential.parseCreationOptionsFromJSON({
  challenge: "AQIDBAU...",   // Base64URL
  rp: { name: '站点', id: 'example.com' },
  user: { id: "ZGVtbw==", name: 'demo', displayName: 'Demo' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
});
// credential.toJSON() 反向：ArrayBuffer → Base64URL，可直接 JSON.stringify 传输`)),
        h(Alert, {
          type: 'info',
          message: 'Extensions 在 getClientExtensionResults() 中返回',
          description: '扩展结果不在 credential.response 里，而通过 credential.getClientExtensionResults() 获取（返回普通对象）。credProps.rk 用于确认 resident key 是否真创建；largeBlob 支持认证器内约 1KB 状态；prf 用 (凭据, 输入) 派生唯一密钥，适合加密本地数据且不暴露私钥。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 9：Digital Credentials API 数字凭证 ===================

  _runDigitalCredentialsDemo() {
    const caps = this._caps();
    const lines = [];
    lines.push('===== Digital Credentials API 数字凭证 =====');
    lines.push('');
    lines.push('【标准】W3C Web Authentication Working Group 2024-2025');
    lines.push('  - 政府签发数字凭证（驾照、护照）的 Web 调用 API');
    lines.push('  - 与 WebAuthn 互补但独立：WebAuthn 用于认证，Digital Credentials 用于身份验证');
    lines.push('');
    lines.push('【核心 API】');
    lines.push('  // 请求数字凭证（需用户手势 + 安全上下文）');
    lines.push('  const cred = await navigator.credentials.get({');
    lines.push('    digital: {');
    lines.push('      requests: [{');
    lines.push('        protocol: "org.iso.18013.5",       // mDL 协议（移动驾照）');
    lines.push('        request: "<base64-encoded-request>",');
    lines.push('      }],');
    lines.push('    },');
    lines.push('  });');
    lines.push('  // cred 是 DigitalCredential 实例');
    lines.push('  // cred.protocol / cred.data（凭证响应数据）');
    lines.push('');
    lines.push('【DigitalCredential 实例】');
    lines.push('  class DigitalCredential extends Credential {');
    lines.push('    readonly protocol;  // 凭证协议标识');
    lines.push('    readonly data;      // 凭证数据（字符串）');
    lines.push('  }');
    lines.push('  // 继承 Credential 基类：id / type');
    lines.push('');
    lines.push('【实战：数字身份验证】');
    lines.push('  // 1. 后端生成请求，前端发起数字凭证请求');
    lines.push('  async function verifyAge() {');
    lines.push('    const request = await fetch("/api/dl/request", { method: "POST" });');
    lines.push('    const { encoded } = await request.json();');
    lines.push('    const cred = await navigator.credentials.get({');
    lines.push('      digital: { requests: [{ protocol: "org.iso.18013.5", request: encoded }] },');
    lines.push('    });');
    lines.push('    // 2. 将凭证数据回传后端验证');
    lines.push('    const res = await fetch("/api/dl/verify", {');
    lines.push('      method: "POST",');
    lines.push('      body: JSON.stringify({ protocol: cred.protocol, data: cred.data }),');
    lines.push('    });');
    lines.push('    return res.json();  // { verified: true, ageOver21: true }');
    lines.push('  }');
    lines.push('');
    lines.push('【与 WebAuthn 对比】');
    lines.push('  WebAuthn：基于公钥的认证（登录），抗钓鱼');
    lines.push('  Digital Credentials：传递政府签发身份信息（年龄/国籍验证）');
    lines.push('  // 两者都走 navigator.credentials.get，但 digital 与 publickey 选项不同');
    lines.push('  // DigitalCredential 独立于 PublicKeyCredential');
    lines.push('');
    lines.push('【降级策略】');
    lines.push('  - 不支持 DigitalCredential：引导用户上传证件照片（传统流程）');
    lines.push('  - 或跳转第三方身份验证服务（如 IDV 厂商）');
    lines.push('  - 用 typeof window.DigitalCredential !== "undefined" 检测');
    lines.push('');
    lines.push('【当前环境能力检测】');
    lines.push('  window.DigitalCredential: ' + (caps.digitalCredential ? '✓' : '✗'));
    lines.push('  // 注意：navigator.credentials.get({digital:{}}) 为异步且需用户手势，');
    lines.push('  // 同步能力检测仅用 typeof DigitalCredential 判断');
    lines.push('');
    lines.push('【浏览器支持】');
    lines.push('  Chrome        behind flag（实验性）');
    lines.push('  Firefox       未实现');
    lines.push('  Safari        未实现');
    lines.push('  jsdom/Node    ✗（无数字凭证概念）');

    this.setState({ digitalCredentialsInfo: lines.join('\n') });

    if (!caps.digitalCredential) {
      this._addLog('warn', 'DigitalCredential 不可用（W3C WebAuth 2024-2025，Chrome behind flag），仅展示文档与代码');
    } else {
      this._addLog('info', 'DigitalCredential 可用，可体验数字身份验证');
    }
  }

  _renderCard9() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '9. Digital Credentials API —— 数字凭证（驾照/护照）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.digitalCredential ? 'success' : 'error' }, caps.digitalCredential ? 'DigitalCredential ✓' : 'DigitalCredential ✗'),
        h(Tag, { color: 'primary' }, 'W3C WebAuth 2024-2025'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Digital Credentials API（W3C WebAuth WG 2024-2025）通过 navigator.credentials.get({ digital: {...} }) 请求政府签发数字凭证（驾照、护照），用于年龄/身份验证。返回 DigitalCredential 实例（protocol/data）。与 WebAuthn 互补但独立：WebAuthn 用于认证登录，Digital Credentials 传递身份信息。两者都走 navigator.credentials.get 但选项不同。Chrome behind flag，Firefox/Safari 未实现。降级：上传证件照片或第三方 IDV 服务。jsdom 无，演示仅展示文档。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 Digital Credentials 文档与代码', { type: 'primary', size: 'sm', onClick: () => this._runDigitalCredentialsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Digital Credentials 文档与示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '520px', overflow: 'auto' } },
          h('code', {}, s.digitalCredentialsInfo || '（点击按钮查看 Digital Credentials API 完整文档与数字身份验证示例）')),
        h(Alert, {
          type: 'info',
          message: 'Digital Credentials API 让 Web 调用政府签发数字凭证',
          description: '通过 navigator.credentials.get({ digital }) 请求驾照/护照等数字凭证做年龄/身份验证。与 WebAuthn 互补独立。Chrome behind flag。jsdom 无，演示仅展示文档。降级用上传证件或第三方 IDV。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Web Authentication（WebAuthn）深入实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'WebAuthn 基于公钥密码学，用认证器（TouchID/Windows Hello/USB 安全密钥）替代密码实现抗钓鱼强认证。本页演示注册（attestation）、认证（assertion）、Attachment/transports/UV、可发现凭据与 ES2024 JSON 序列化。测试环境仅展示用法与 mock 解析。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard9(),
      this._renderLogPanel(),
    );
  }
}
