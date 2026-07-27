// =====================================================================
// WebCryptoDeepPage.js —— Web Crypto API 深度实验室
// 演示 MDN：
//   1. 哈希摘要 SubtleCrypto.digest（SHA-1 / SHA-256 / SHA-384 / SHA-512）
//   2. 对称加密 AES-GCM（generateKey / encrypt / decrypt / getRandomValues）
//   3. 非对称 RSA-OAEP + ECDSA 签名（generateKey / encrypt / decrypt / sign / verify）
//   4. 密钥派生 PBKDF2 / HKDF + 密钥导入导出（deriveKey / deriveBits / importKey / exportKey）
//   5. 密钥封装 wrapKey / unwrapKey + 算法能力汇总表
// 安全说明：所有加解密在浏览器内完成，私钥不离开设备。
// 兼容性：jsdom 等运行时通常不实现 SubtleCrypto；所有调用前均做 typeof
//         能力检测，不可用时仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 算法能力汇总表（Card 5 展示）：算法 | 用途 | 密钥长度 | 支持的操作
const ALGO_CAPS_TABLE = [
  { algo: 'SHA-1',                 use: '哈希摘要',   keylen: '—',             ops: 'digest' },
  { algo: 'SHA-256',               use: '哈希摘要',   keylen: '—',             ops: 'digest' },
  { algo: 'SHA-384',               use: '哈希摘要',   keylen: '—',             ops: 'digest' },
  { algo: 'SHA-512',               use: '哈希摘要',   keylen: '—',             ops: 'digest' },
  { algo: 'AES-GCM',               use: '对称加密',   keylen: '128/192/256',   ops: 'encrypt / decrypt / wrapKey / unwrapKey' },
  { algo: 'AES-CBC',               use: '对称加密',   keylen: '128/192/256',   ops: 'encrypt / decrypt / wrapKey / unwrapKey' },
  { algo: 'RSA-OAEP',              use: '非对称加密', keylen: '2048/3072/4096', ops: 'encrypt / decrypt / wrapKey / unwrapKey' },
  { algo: 'ECDSA',                 use: '数字签名',   keylen: 'P-256/384/521', ops: 'sign / verify' },
  { algo: 'ECDH',                  use: '密钥协商',   keylen: 'P-256/384/521', ops: 'deriveKey / deriveBits' },
  { algo: 'HKDF',                  use: '密钥派生',   keylen: '任意',          ops: 'deriveKey / deriveBits' },
  { algo: 'PBKDF2',                use: '密钥派生',   keylen: '任意',          ops: 'deriveKey / deriveBits' },
  { algo: 'RSASSA-PKCS1-v1_5',     use: '数字签名',   keylen: '2048/3072/4096', ops: 'sign / verify' },
];

// ArrayBuffer / TypedArray → 十六进制字符串
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 截断长字符串用于 UI 展示（避免 JWK / 哈希等长文本撑破布局）
function truncate(str, max = 64) {
  if (typeof str !== 'string') return String(str);
  return str.length > max ? str.slice(0, max) + `…（共 ${str.length} 字符）` : str;
}

export class WebCryptoDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      supported: false,
      capsSummary: '',
      // Card 1: digest
      digestResult: '',          // SHA-256("hello") 的 hex
      digestCompare: '',         // 4 种算法输出对比文本
      // Card 2: AES-GCM
      aesCipher: '',             // 加密后 hex
      aesPlain: '',              // 解密还原的明文
      // Card 3: RSA-OAEP + ECDSA
      rsaPubJwk: '',             // RSA 公钥 JWK 摘要
      rsaDecrypt: '',            // RSA 解密还原的明文
      ecdsaSig: '',              // ECDSA 签名 hex
      verifyResult: '',          // 验证结果文本
      // Card 4: PBKDF2 / HKDF + import/export
      deriveKeyJwk: '',          // 派生密钥 / 导出的 JWK
      deriveTiming: '',          // PBKDF2 计时
      // Card 5: wrapKey / unwrapKey
      wrapResult: '',            // 封装结果 hex
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 创建 AbortController，用于 componentWillUnmount 中止可能进行中的长任务（如 PBKDF2 派生）
    this._abortCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    // 一次性能力检测：crypto / crypto.subtle / crypto.subtle.digest
    let supported = false;
    try {
      supported = typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof crypto.subtle.digest === 'function';
    } catch { /* jsdom 等环境访问 crypto.subtle 可能抛错 */ }

    const summary = supported
      ? 'SubtleCrypto 可用：digest / generateKey / encrypt / decrypt / sign / verify / deriveKey / deriveBits / importKey / exportKey / wrapKey / unwrapKey。所有操作在浏览器内完成，私钥不离开设备。'
      : '当前环境（jsdom 等）SubtleCrypto 不可用；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（HTTPS / localhost）中打开可完整演示。';

    this.setState({ supported, capsSummary: summary });
    this._addLog(supported ? 'info' : 'warn',
      `能力检测：crypto.subtle ${supported ? '可用 ✓' : '不可用 ✗'}；TextEncoder ${typeof TextEncoder !== 'undefined' ? '✓' : '✗'}；getRandomValues ${typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? '✓' : '✗'}`);
  }

  componentWillUnmount() {
    // 中止可能进行中的长任务（PBKDF2 等）
    if (this._abortCtrl) {
      try { this._abortCtrl.abort(); } catch { /* noop */ }
      this._abortCtrl = null;
    }
    // 清理缓存的密钥 / 密文引用（便于 GC；密钥本身不会离开内存被序列化）
    this._aesKey = null;
    this._aesIv = null;
    this._aesCipherBuf = null;
    this._rsaKeyPair = null;
    this._ecdsaKeyPair = null;
    this._ecdsaSignedData = null;
    this._derivedKey = null;
    this._lastJwk = null;
    this._wrappingKey = null;
    this._wrapIv = null;
    this._wrappedBuf = null;
    this._wrappedKeyAlgo = null;
    this._wrappedKeyUsages = null;
    this._unwrappedKey = null;
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type, content) {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
    });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    let subtle = false;
    try {
      subtle = typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof crypto.subtle.digest === 'function';
    } catch { /* noop */ }
    return {
      subtle,
      textEncoder: typeof TextEncoder !== 'undefined',
      textDecoder: typeof TextDecoder !== 'undefined',
      getRandomValues: typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function',
      randomUUID: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function',
    };
  }

  // =================== 1. 哈希摘要 digest ===================

  // 计算 SHA-256("hello")
  async _computeSHA256() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.digest 不可用（jsdom 限制）；在 Chrome/Firefox/Edge 中打开可正常演示');
      return;
    }
    try {
      const text = 'hello';
      const data = new TextEncoder().encode(text);
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      const hex = bufToHex(hashBuf);
      this.setState({ digestResult: hex });
      this._addLog('hash', `SHA-256("${text}") = ${hex}（256 位 / 64 hex 字符）`);
    } catch (err) {
      this._addLog('err', `SHA-256 计算失败：${err.name} - ${err.message}`);
    }
  }

  // 对比 4 种算法（SHA-1/256/384/512）的输出长度
  async _compareDigests() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.digest 不可用，无法对比');
      return;
    }
    try {
      const text = 'The quick brown fox jumps over the lazy dog';
      const data = new TextEncoder().encode(text);
      const algos = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
      const lines = [];
      for (const algo of algos) {
        const buf = await crypto.subtle.digest(algo, data);
        const hex = bufToHex(buf);
        const bits = new Uint8Array(buf).length * 8;
        lines.push(`${algo}（${bits} 位 / ${hex.length} hex）:\n${hex}`);
      }
      this.setState({ digestCompare: lines.join('\n\n') });
      this._addLog('hash', '已对比 4 种算法输出长度：SHA-1=160 / SHA-256=256 / SHA-384=384 / SHA-512=512 位');
    } catch (err) {
      this._addLog('err', `对比算法失败：${err.name} - ${err.message}`);
    }
  }

  // =================== 2. AES-GCM 对称加密 ===================

  async _generateAesKey() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.generateKey 不可用');
      return;
    }
    try {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
      this._aesKey = key;
      this._aesIv = null;
      this._aesCipherBuf = null;
      this.setState({ aesCipher: '', aesPlain: '' });
      this._addLog('aes', '已生成 AES-GCM 256 位密钥（extractable=true, usages=[encrypt,decrypt]）');
    } catch (err) {
      this._addLog('err', `生成 AES 密钥失败：${err.name} - ${err.message}`);
    }
  }

  async _aesEncrypt() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.encrypt 不可用');
      return;
    }
    if (!this._aesKey) {
      this._addLog('warn', '请先点击「生成 AES 密钥」');
      return;
    }
    try {
      const text = 'Hello AES-GCM';
      const data = new TextEncoder().encode(text);
      // GCM 推荐 12 字节 IV（96 位）；用 crypto.getRandomValues 生成
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this._aesKey,
        data,
      );
      this._aesIv = iv;
      this._aesCipherBuf = cipherBuf;
      const hex = bufToHex(cipherBuf);
      this.setState({ aesCipher: hex, aesPlain: '' });
      this._addLog('aes', `已加密 "Hello AES-GCM"：明文 ${data.length} 字节 → 密文 ${cipherBuf.byteLength} 字节（含 16 字节 GCM auth tag）`);
      this._addLog('aes', `IV（12 字节）: ${bufToHex(iv)}`);
    } catch (err) {
      this._addLog('err', `AES 加密失败：${err.name} - ${err.message}`);
    }
  }

  async _aesDecrypt() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.decrypt 不可用');
      return;
    }
    if (!this._aesKey || !this._aesCipherBuf || !this._aesIv) {
      this._addLog('warn', '请先生成密钥并加密');
      return;
    }
    try {
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: this._aesIv },
        this._aesKey,
        this._aesCipherBuf,
      );
      const text = new TextDecoder().decode(plainBuf);
      this.setState({ aesPlain: text });
      this._addLog('aes', `解密成功，还原明文："${text}"（auth tag 校验通过）`);
    } catch (err) {
      this._addLog('err', `AES 解密失败（IV 或 auth tag 不匹配）：${err.name} - ${err.message}`);
    }
  }

  // =================== 3. RSA-OAEP + ECDSA 签名 ===================

  // 生成 RSA-OAEP 2048 位密钥对，并演示 encrypt/decrypt
  async _generateRsaKey() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.generateKey 不可用');
      return;
    }
    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),  // 65537
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt'],
      );
      this._rsaKeyPair = keyPair;
      const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const jwkStr = JSON.stringify({
        kty: pubJwk.kty, e: pubJwk.e, n: truncate(pubJwk.n, 32),
        alg: pubJwk.alg, ext: pubJwk.ext, key_ops: pubJwk.key_ops,
      });
      this.setState({ rsaPubJwk: jwkStr, rsaDecrypt: '' });
      this._addLog('rsa', '已生成 RSA-OAEP 2048 位密钥对（e=65537, hash=SHA-256, usages=[encrypt,decrypt]）');

      // 演示 encrypt/decrypt：用公钥加密 "Hello RSA"，再用私钥解密
      const msg = new TextEncoder().encode('Hello RSA-OAEP');
      const cipherBuf = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        keyPair.publicKey,
        msg,
      );
      this._addLog('rsa', `公钥加密 "Hello RSA-OAEP" → ${cipherBuf.byteLength} 字节（= modulusLength/8 = 256）`);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        keyPair.privateKey,
        cipherBuf,
      );
      const plain = new TextDecoder().decode(plainBuf);
      this.setState({ rsaDecrypt: plain });
      this._addLog('rsa', `私钥解密还原："${plain}"`);
    } catch (err) {
      this._addLog('err', `生成 RSA 密钥失败：${err.name} - ${err.message}`);
    }
  }

  // 生成 ECDSA P-256 密钥对
  async _generateEcdsaKey() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.generateKey 不可用');
      return;
    }
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      this._ecdsaKeyPair = keyPair;
      this._ecdsaSignedData = null;
      this.setState({ ecdsaSig: '', verifyResult: '' });
      this._addLog('sign', '已生成 ECDSA P-256 密钥对（usages=[sign,verify]）');
    } catch (err) {
      this._addLog('err', `生成 ECDSA 密钥失败：${err.name} - ${err.message}`);
    }
  }

  // 用私钥签名
  async _ecdsaSign() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.sign 不可用');
      return;
    }
    if (!this._ecdsaKeyPair) {
      this._addLog('warn', '请先点击「生成 ECDSA 密钥」');
      return;
    }
    try {
      const text = 'message-to-sign';
      const data = new TextEncoder().encode(text);
      const sigBuf = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        this._ecdsaKeyPair.privateKey,
        data,
      );
      const hex = bufToHex(sigBuf);
      this._ecdsaSignedData = data;
      this.setState({ ecdsaSig: hex, verifyResult: '' });
      this._addLog('sign', `已用 ECDSA P-256 + SHA-256 对 "${text}" 签名：${sigBuf.byteLength} 字节 / ${hex.length} hex 字符`);
    } catch (err) {
      this._addLog('err', `ECDSA 签名失败：${err.name} - ${err.message}`);
    }
  }

  // 用公钥验证签名；tampered=true 时翻转数据末字节制造篡改
  async _ecdsaVerify(tampered = false) {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.verify 不可用');
      return;
    }
    if (!this._ecdsaKeyPair || !this._ecdsaSig || !this._ecdsaSignedData) {
      this._addLog('warn', '请先生成密钥并签名');
      return;
    }
    try {
      // 从 hex 重建 signature 的 Uint8Array
      const sigBytes = new Uint8Array(
        this._ecdsaSig.match(/.{2}/g).map((h) => parseInt(h, 16)),
      );
      let data = this._ecdsaSignedData;
      if (tampered) {
        // 篡改数据：把最后一字节翻转，制造与签名不匹配的内容
        data = new Uint8Array(data);
        data[data.length - 1] = data[data.length - 1] ^ 0xff;
        this._addLog('verify', '已篡改被签名数据最后一字节，预期验证失败');
      }
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        this._ecdsaKeyPair.publicKey,
        sigBytes,
        data,
      );
      this.setState({ verifyResult: ok ? '通过 ✓' : '失败 ✗' });
      this._addLog('verify',
        `验证结果：${ok ? '通过 ✓' : '失败 ✗'}${tampered ? '（篡改后应失败）' : '（原文应通过）'}`);
    } catch (err) {
      this._addLog('err', `ECDSA 验证失败：${err.name} - ${err.message}`);
    }
  }

  // =================== 4. PBKDF2 / HKDF + 密钥导入导出 ===================

  // 从密码派生 AES-GCM 密钥（100000 次迭代，计时）
  async _deriveKeyPbkdf2() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.deriveKey 不可用');
      return;
    }
    try {
      const password = 'correct horse battery staple';
      const salt = crypto.getRandomValues(new Uint8Array(16));
      // 1. 把密码作为 raw 密钥导入（PBKDF2 的 baseKey）
      const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey', 'deriveBits'],
      );
      // 2. 用 PBKDF2 派生 AES-GCM 256 位密钥（计时）
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const derivedKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      this._derivedKey = derivedKey;
      // 3. 同时 deriveBits 取原始 256 位（与 deriveKey 输出应一致）
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey,
        256,
      );
      const jwk = await crypto.subtle.exportKey('jwk', derivedKey);
      this._lastJwk = jwk;
      this.setState({
        deriveKeyJwk: JSON.stringify(jwk),
        deriveTiming: `100000 次迭代耗时 ${(t1 - t0).toFixed(1)} ms（salt=${bufToHex(salt)}）`,
      });
      this._addLog('derive', `PBKDF2 派生完成：100000 次迭代耗时 ${(t1 - t0).toFixed(1)} ms；salt(16字节)=${bufToHex(salt)}`);
      this._addLog('derive', `deriveBits(256) = ${bufToHex(bits)}`);
      this._addLog('derive', `派生的 AES-GCM 密钥 JWK k 字段（base64url）长度=${(jwk.k || '').length}`);
    } catch (err) {
      this._addLog('err', `PBKDF2 派生失败：${err.name} - ${err.message}`);
    }
  }

  // 用 HKDF 从密码派生密钥（对比 PBKDF2）
  async _deriveKeyHkdf() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.deriveKey 不可用');
      return;
    }
    try {
      const ikm = new TextEncoder().encode('input-keying-material');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const info = new TextEncoder().encode('api-lab-hkdf-info');
      const baseKey = await crypto.subtle.importKey(
        'raw',
        ikm,
        { name: 'HKDF' },
        false,
        ['deriveKey', 'deriveBits'],
      );
      const derived = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
      const bits = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        baseKey,
        256,
      );
      this._addLog('derive', `HKDF 派生完成（hash=SHA-256, salt=${bufToHex(salt)}, info="api-lab-hkdf-info"）`);
      this._addLog('derive', `deriveBits(256) = ${bufToHex(bits)}（HKDF 单轮派生，比 PBKDF2 快得多）`);
      this._addLog('derive', `派生的 AES-GCM 密钥 usages=[encrypt,decrypt]，extractable=true`);
    } catch (err) {
      this._addLog('err', `HKDF 派生失败：${err.name} - ${err.message}`);
    }
  }

  // 导出密钥为 JWK
  async _exportJwk() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.exportKey 不可用');
      return;
    }
    if (!this._derivedKey) {
      this._addLog('warn', '请先派生 AES 密钥');
      return;
    }
    try {
      const jwk = await crypto.subtle.exportKey('jwk', this._derivedKey);
      const jwkStr = JSON.stringify(jwk);
      this._lastJwk = jwk;
      this.setState({ deriveKeyJwk: jwkStr });
      this._addLog('jwk', `exportKey('jwk') => ${truncate(jwkStr, 80)}`);
      this._addLog('jwk', 'JWK 字段：kty=密钥类型, k=对称密钥 base64url, key_ops=允许操作, ext=可导出');
    } catch (err) {
      this._addLog('err', `exportKey 失败：${err.name} - ${err.message}`);
    }
  }

  // 从 JWK 导入密钥
  async _importJwk() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.importKey 不可用');
      return;
    }
    if (!this._lastJwk) {
      this._addLog('warn', '请先派生并导出 JWK');
      return;
    }
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        this._lastJwk,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
      this._derivedKey = key;
      this._addLog('jwk', `importKey('jwk', ...) 成功；导入的密钥 usages=[encrypt,decrypt], extractable=true`);
      this._addLog('jwk', '注：JWK 可跨设备传输密钥；非对称密钥的 JWK 公钥用 kty=RSA/EC，私钥用 d 字段');
    } catch (err) {
      this._addLog('err', `importKey 失败：${err.name} - ${err.message}`);
    }
  }

  // =================== 5. wrapKey / unwrapKey + 能力表 ===================

  // 用 AES-GCM 密钥封装一个 ECDSA 私钥（pkcs8 格式）
  async _wrapKey() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.wrapKey 不可用');
      return;
    }
    try {
      // 1. 生成 wrapping AES-GCM 256 位密钥（usages 含 wrapKey/unwrapKey）
      const wrappingKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['wrapKey', 'unwrapKey'],
      );
      // 2. 生成被封装的 ECDSA P-256 密钥对
      const ecdsaKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      // 3. 用 AES-GCM 封装 ECDSA 私钥（format='pkcs8'，对应私钥；'spki' 对应公钥）
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.wrapKey(
        'pkcs8',
        ecdsaKeyPair.privateKey,
        wrappingKey,
        { name: 'AES-GCM', iv },
      );
      this._wrappingKey = wrappingKey;
      this._wrapIv = iv;
      this._wrappedBuf = wrapped;
      this._wrappedKeyAlgo = { name: 'ECDSA', namedCurve: 'P-256' };
      this._wrappedKeyUsages = ['sign'];
      const hex = bufToHex(wrapped);
      this.setState({ wrapResult: hex });
      this._addLog('wrap', `已用 AES-GCM 256 位密钥封装 ECDSA P-256 私钥（format=pkcs8 + 12字节 IV）`);
      this._addLog('wrap', `封装结果：${wrapped.byteLength} 字节；IV=${bufToHex(iv)}`);
      this._addLog('wrap', '注：pkcs8 用于私钥、spki 用于公钥、raw 用于对称/EC 公钥；封装算法需与 wrappingKey 匹配');
    } catch (err) {
      this._addLog('err', `wrapKey 失败：${err.name} - ${err.message}`);
    }
  }

  // 解封装还原
  async _unwrapKey() {
    if (!this._caps().subtle) {
      this._addLog('warn', 'crypto.subtle.unwrapKey 不可用');
      return;
    }
    if (!this._wrappingKey || !this._wrappedBuf || !this._wrapIv) {
      this._addLog('warn', '请先点击「封装 ECDSA 私钥」');
      return;
    }
    try {
      const unwrapped = await crypto.subtle.unwrapKey(
        'pkcs8',
        this._wrappedBuf,
        this._wrappingKey,
        { name: 'AES-GCM', iv: this._wrapIv },
        this._wrappedKeyAlgo,
        true,
        this._wrappedKeyUsages,
      );
      this._unwrappedKey = unwrapped;
      this._addLog('wrap', `unwrapKey 成功；还原 ECDSA 私钥，usages=${JSON.stringify(this._wrappedKeyUsages)}`);
      this._addLog('info', '注：解封装后的私钥可重新用于 sign；与 importKey 不同，unwrapKey 同时完成解密 + 导入');
    } catch (err) {
      this._addLog('err', `unwrapKey 失败（IV 或封装格式不匹配）：${err.name} - ${err.message}`);
    }
  }

  // 把算法能力表全部输出到日志
  _logAlgoCaps() {
    this._addLog('info', `算法能力汇总表共 ${ALGO_CAPS_TABLE.length} 项，详见上方表格`);
    ALGO_CAPS_TABLE.forEach((r) => {
      this._addLog('info', `${r.algo}（${r.use}，密钥长度=${r.keylen}）: ${r.ops}`);
    });
  }

  // =================== 渲染 ===================

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. 哈希摘要 (digest)',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.subtle ? 'success' : 'warning' }, caps.subtle ? 'SubtleCrypto 可用' : 'SubtleCrypto 不可用'),
        h(Tag, { color: 'primary' }, 'SHA-1/256/384/512'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'crypto.subtle.digest(algo, data) 返回 Promise<ArrayBuffer>；输入需为 BufferSource（用 new TextEncoder().encode(str) 转换）。SHA-1 输出 160 位、SHA-256 输出 256 位、SHA-384 输出 384 位、SHA-512 输出 512 位。所有算法返回原始比特，常用 bufToHex 转十六进制展示。digest 是单向不可逆函数，常用于完整性校验、内容寻址、密码存储（需加盐）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('计算 SHA-256("hello")', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._computeSHA256() }),
          this._btn('对比 4 种算法输出长度', { size: 'sm', disabled: !caps.subtle, onClick: () => this._compareDigests() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'SHA-256("hello") 十六进制（256 位 = 64 hex 字符）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '60px', overflow: 'auto' } },
          h('code', {}, s.digestResult || '（点击「计算 SHA-256("hello")」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '4 种算法输出长度对比（SHA-1=160 / SHA-256=256 / SHA-384=384 / SHA-512=512 位）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.digestCompare || '（点击「对比 4 种算法输出长度」）')),
        h(Alert, {
          type: 'info',
          message: 'digest 不需要密钥',
          description: 'SHA-* 是无密钥哈希；若需带密钥的认证（HMAC），应使用 SubtleCrypto 的 sign({ name: \'HMAC\' }, key, data)。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. 对称加密 AES-GCM',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.subtle ? 'success' : 'warning' }, caps.subtle ? '可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'AES-GCM 256'),
        h(Tag, { color: 'warning' }, 'AEAD'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'crypto.subtle.generateKey({ name:\'AES-GCM\', length:256 }, true, [\'encrypt\',\'decrypt\']) 生成对称密钥；encrypt({ name:\'AES-GCM\', iv }, key, data) 返回的密文末尾自带 16 字节 GCM auth tag（AEAD 同时保证机密性与完整性）；iv 推荐 12 字节（96 位），用 crypto.getRandomValues(new Uint8Array(12)) 生成，每次加密必须随机且不重复；decrypt 用相同 iv + key 还原，tag 校验失败会抛 OperationError。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('生成 AES 密钥', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._generateAesKey() }),
          this._btn('加密 "Hello AES-GCM"', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._aesEncrypt() }),
          this._btn('解密还原', { size: 'sm', disabled: !caps.subtle, onClick: () => this._aesDecrypt() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '密文（十六进制，末 16 字节为 GCM auth tag）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '80px', overflow: 'auto' } },
          h('code', {}, s.aesCipher || '（点击「生成 AES 密钥」→「加密」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, `解密还原明文：${s.aesPlain || '—'}`),
        h(Alert, {
          type: 'warning',
          message: 'GCM 的 IV 不可重复使用',
          description: '同一密钥下 IV 重复会破坏 GCM 的安全性（暴露明文 XOR）。生产环境务必每次加密用 crypto.getRandomValues 生成新 IV，并将 IV 与密文一起存储/传输。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. 非对称 RSA-OAEP + ECDSA 签名',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.subtle ? 'success' : 'warning' }, caps.subtle ? '可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'RSA-OAEP 2048'),
        h(Tag, { color: 'primary' }, 'ECDSA P-256'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'RSA-OAEP：generateKey({ name:\'RSA-OAEP\', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]) /* 65537 */, hash:\'SHA-256\' }, true, [\'encrypt\',\'decrypt\']) 生成密钥对；encrypt(publicKey) 加密、decrypt(privateKey) 解密。ECDSA：generateKey({ name:\'ECDSA\', namedCurve:\'P-256\' }, true, [\'sign\',\'verify\']) 生成密钥对；sign({ name:\'ECDSA\', hash:\'SHA-256\' }, privateKey, data) 签名；verify(..., publicKey, signature, data) 返回 boolean。RSA 加密适合短数据（≤ modulusLength/8 - padding），长数据应改用混合加密（RSA 包 AES 密钥）。'),
        h('div', { class: 'fs-sm text-secondary' }, 'RSA-OAEP：'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('生成 RSA 密钥并加解密', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._generateRsaKey() }),
          h(Tag, { color: s.rsaPubJwk ? 'success' : 'default' }, s.rsaPubJwk ? '已生成' : '未生成'),
        ),
        s.rsaPubJwk && h('pre', { class: 'code-block', style: { maxHeight: '80px', overflow: 'auto' } },
          h('code', {}, `RSA 公钥 JWK 摘要：${s.rsaPubJwk}`)),
        h('div', { class: 'fs-sm text-secondary' }, `RSA 解密还原："Hello RSA-OAEP" → ${s.rsaDecrypt || '—'}`),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'ECDSA 签名 / 验证：'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('生成 ECDSA 密钥', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._generateEcdsaKey() }),
          this._btn('签名', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._ecdsaSign() }),
          this._btn('验证', { size: 'sm', disabled: !caps.subtle, onClick: () => this._ecdsaVerify(false) }),
          this._btn('篡改数据后验证', { size: 'sm', disabled: !caps.subtle, onClick: () => this._ecdsaVerify(true) }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'ECDSA 签名（hex）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '60px', overflow: 'auto' } },
          h('code', {}, s.ecdsaSig || '（点击「生成 ECDSA 密钥」→「签名」）')),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h(Tag, { color: s.verifyResult.startsWith('通过') ? 'success' : s.verifyResult ? 'error' : 'default' },
            `验证结果：${s.verifyResult || '未验证'}`),
        ),
        h(Alert, {
          type: 'info',
          message: 'ECDSA 签名非确定性 + 验证防篡改',
          description: '同一私钥对同一数据每次签名结果不同（含随机 k）；篡改数据或签名后 verify 返回 false（不抛异常）。RSA-OAEP 是概率加密（带随机 padding），同一公钥加密同一明文每次密文不同。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. 密钥派生 PBKDF2 / HKDF + 密钥导入导出',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.subtle ? 'success' : 'warning' }, caps.subtle ? '可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'PBKDF2'),
        h(Tag, { color: 'primary' }, 'HKDF'),
        h(Tag, { color: 'warning' }, 'JWK'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PBKDF2：importKey(\'raw\', passwordBytes, { name:\'PBKDF2\' }, false, [\'deriveKey\',\'deriveBits\']) 把密码包装为 baseKey；deriveKey({ name:\'PBKDF2\', salt, iterations:100000, hash:\'SHA-256\' }, baseKey, { name:\'AES-GCM\', length:256 }, true, [...]) 派生 AES 密钥；deriveBits 派生原始比特。HKDF：importKey raw + deriveKey { name:\'HKDF\', hash:\'SHA-256\', salt, info }，单轮派生（比 PBKDF2 快，不适合低熵密码）。exportKey(\'jwk\'|\'raw\'|\'pkcs8\'|\'spki\', key) 导出；importKey(\'jwk\'|\'raw\', ...) 反向导入。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('从密码派生 AES 密钥（100000 次迭代）', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._deriveKeyPbkdf2() }),
          this._btn('HKDF 派生（对比）', { size: 'sm', disabled: !caps.subtle, onClick: () => this._deriveKeyHkdf() }),
          this._btn('导出密钥为 JWK', { size: 'sm', disabled: !caps.subtle, onClick: () => this._exportJwk() }),
          this._btn('从 JWK 导入', { size: 'sm', disabled: !caps.subtle, onClick: () => this._importJwk() }),
        ),
        s.deriveTiming && h('div', { class: 'fs-sm fw-medium' }, s.deriveTiming),
        h('div', { class: 'fs-sm text-secondary' }, '派生 / 导出的 AES-GCM 密钥 JWK：'),
        h('pre', { class: 'code-block', style: { maxHeight: '100px', overflow: 'auto' } },
          h('code', {}, s.deriveKeyJwk || '（点击「从密码派生 AES 密钥」）')),
        h(Alert, {
          type: 'warning',
          message: 'PBKDF2 迭代次数应随硬件提升逐年增加',
          description: 'OWASP 2023 建议 PBKDF2-SHA256 至少 600000 次迭代；本演示用 100000 次以兼顾安全与卡顿。HKDF 适合从已有高熵 IKM（如 ECDH 共享密钥）派生，不能替代 PBKDF2 做密码存储。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. 密钥封装 wrapKey/unwrapKey + 算法能力汇总表',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.subtle ? 'success' : 'warning' }, caps.subtle ? '可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'wrapKey/unwrapKey'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'crypto.subtle.wrapKey(format, key, wrappingKey, wrapAlgo) 把一个密钥用 wrappingKey 加密导出；format 取 \'raw\'（对称/EC 公钥）/ \'pkcs8\'（私钥）/ \'spki\'（公钥）。unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgo, unwrappedKeyAlgo, extractable, usages) 反向解密并导入。常用于跨设备传输私钥（先用 RSA/AES 协商 wrappingKey，再封装业务密钥）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('用 AES-GCM 封装 ECDSA 私钥', { type: 'primary', size: 'sm', disabled: !caps.subtle, onClick: () => this._wrapKey() }),
          this._btn('解封装还原', { size: 'sm', disabled: !caps.subtle, onClick: () => this._unwrapKey() }),
          this._btn('把能力表输出到日志', { size: 'sm', onClick: () => this._logAlgoCaps() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '封装结果（pkcs8 + AES-GCM，hex）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '80px', overflow: 'auto' } },
          h('code', {}, s.wrapResult || '（点击「用 AES-GCM 封装 ECDSA 私钥」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '算法能力汇总表（算法 | 用途 | 密钥长度 | 支持的操作）：'),
        h('div', { class: 'table-wrap', style: { overflowX: 'auto' } },
          h('table', { class: 'data-table', style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
            h('thead', {},
              h('tr', {},
                h('th', { style: thStyle }, '算法'),
                h('th', { style: thStyle }, '用途'),
                h('th', { style: thStyle }, '密钥长度'),
                h('th', { style: thStyle }, '支持的操作'),
              ),
            ),
            h('tbody', {},
              ...ALGO_CAPS_TABLE.map((r) => h('tr', {},
                h('td', { style: tdStyle }, h('code', {}, r.algo)),
                h('td', { style: tdStyle }, r.use),
                h('td', { style: tdStyle }, r.keylen),
                h('td', { style: tdStyle }, r.ops),
              )),
            ),
          ),
        ),
        h(Alert, {
          type: 'info',
          message: 'wrapKey = exportKey + encrypt 的原子组合',
          description: '相比手动 exportKey 再 encrypt，wrapKey 在浏览器内一步完成，避免中间密钥明文暴露在 JS 内存中。unwrapKey 同理 = decrypt + importKey。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Web Crypto 加密实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 SubtleCrypto 全套：哈希摘要 / 对称加密 / 非对称签名 / 密钥派生 / 密钥封装。所有操作在浏览器内完成，私钥不离开设备。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}

// 表格内联样式（与项目 .data-table 样式互补，保证未加载样式时也可见）
const thStyle = {
  padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #444',
  background: '#1e1e2e', color: '#cdd6f4', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '6px 10px', borderBottom: '1px solid #333', verticalAlign: 'top',
  color: '#cdd6f4',
};
