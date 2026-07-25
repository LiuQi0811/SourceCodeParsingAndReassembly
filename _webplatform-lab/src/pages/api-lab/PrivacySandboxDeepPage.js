// =====================================================================
// PrivacySandboxDeepPage.js —— Privacy Sandbox 深入 实验室
// 演示 MDN：
//   1. Attribution Reporting API —— fetch(url, { attributionsrc: true|'url'|[...] })
//      / HTMLAnchorElement.attributionsrc / HTMLImageElement.attributionsrc /
//      HTMLScriptElement.attributionsrc；响应头 Attribution-Reporting-Register-Source
//      / Attribution-Reporting-Register-Trigger；事件级报告 + 汇总报告（Aggregation Service）
//   2. Private State Tokens (PST，原 Privacy Pass) —— navigator.privateTokenIssuance /
//      document.hasPrivateToken(issuer) / document.privateTokenOperation(issuer, 'redeem'|'verify')
//      / /.well-known/private-token-issuer-directory / 发行/兑换流程与信任曲线
//   3. CHIPS (Partitioned Cookies) —— Set-Cookie: ...; Partitioned; Secure; SameSite=None
//      / regex 解析属性 / cookieStore.get({ partitioned: true }) / 分区键 = top-level site
//   4. Related Website Sets (RWS，原 First-Party Sets) —— /.well-known/related-website-sets.json
//      { primary, associatedSites, rationaleBySite, contact } / 结构校验 / 提交审核流程
//   5. FedCM 与 Storage Access 协同 —— navigator.credentials.get({ identity }) +
//      document.requestStorageAccess / iframe allow="fedcm; storage-access;
//      attribution-reporting; private-state-token-issuance; private-state-token-redemption;
//      local-fonts" / iframe.permissionsPolicy
//   6. Privacy Sandbox 汇总检测矩阵 —— 全部 PS API ✓/✗ 矩阵 + 第三方 cookie 弃用时间线 +
//      每个 API 替代的传统追踪用例
// 说明：本页聚焦 SecurityPrivacyPage（Topics + Protected Audience）与
//       StorageAccessMultiOriginPage（requestStorageAccess / Storage Access API）未覆盖的内容。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。jsdom/Node 中相关 API 多为 undefined，需真实浏览器 + HTTPS 演示。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class PrivacySandboxDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：Attribution Reporting API
      attributionInfo: '',
      // Card 2：Private State Tokens
      pstInfo: '',
      // Card 3：CHIPS（Partitioned Cookies）
      chipsInfo: '',
      // Card 4：Related Website Sets
      rwsInfo: '',
      // Card 5：FedCM 与 Storage Access 协同
      fedcmInfo: '',
      // Card 6：Privacy Sandbox 汇总检测矩阵
      matrixInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._abortControllers = []; // Card 1 fetch AbortController 数组（mock，未真实发起）
    this._ppIframe = null;       // Card 5 临时 iframe 引用（permissionsPolicy 内省用）

    // 一次性能力检测：Privacy Sandbox 全家桶（聚焦未覆盖部分）
    const caps = this._caps();
    const parts = [
      `attributionsrc ${caps.attributionSrc ? '✓' : '✗'}`,
      `privateTokenIssuance ${caps.pstIssuance ? '✓' : '✗'}`,
      `hasPrivateToken ${caps.hasPrivateToken ? '✓' : '✗'}`,
      `privateTokenOperation ${caps.privateTokenOp ? '✓' : '✗'}`,
      `cookieStore(partitioned) ${caps.cookieStore ? '✓' : '✗'}`,
      `FedCM(IdentityProvider) ${caps.fedcm ? '✓' : '✗'}`,
      `iframe.permissionsPolicy ${caps.iframePP ? '✓' : '✗'}`,
      `requestStorageAccess ${caps.rsa ? '✓' : '✗'}`,
      `requestStorageAccessFor ${caps.rsaFor ? '✓' : '✗'}`,
      `browsingTopics ${caps.topics ? '✓' : '✗'}`,
      `runAdAuction ${caps.runAdAuction ? '✓' : '✗'}`,
    ];

    const any = caps.attributionSrc || caps.pstIssuance || caps.hasPrivateToken ||
      caps.privateTokenOp || caps.cookieStore || caps.fedcm || caps.iframePP ||
      caps.rsa || caps.rsaFor || caps.topics || caps.runAdAuction;
    const summary = any
      ? `Privacy Sandbox 能力检测：${parts.join(' · ')}。当前环境部分 API 可用；Attribution Reporting / PST / FedCM 通常需真实浏览器 + HTTPS + 用户开启 Privacy Sandbox 试用才能完整演示，本页对不可用 API 仅记日志不抛异常。`
      : `Privacy Sandbox 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）几乎所有相关 API 均为 undefined；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（HTTPS）中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.attributionSrc) this._addLog('warn', 'attributionsrc 不可用（Attribution Reporting 需 Chrome 试用 + HTTPS，jsdom 未实现）');
    if (!caps.hasPrivateToken) this._addLog('warn', 'document.hasPrivateToken 不可用（PST 实验性 API，jsdom 不支持）');
    if (!caps.fedcm) this._addLog('warn', 'IdentityProvider / FedCM 不可用（jsdom 未实现，需真实浏览器 + HTTPS）');
    if (!caps.iframePP) this._addLog('warn', 'iframe.permissionsPolicy 不可用（jsdom 未实现 Permissions Policy 内省）');
  }

  componentWillUnmount() {
    // 释放所有 AbortController（Card 1 fetch 用，mock）
    for (const ac of this._abortControllers) {
      try { if (ac && typeof ac.abort === 'function') ac.abort(); } catch { /* noop */ }
    }
    this._abortControllers = [];
    // 移除临时 iframe（Card 5 permissionsPolicy 内省时创建）
    if (this._ppIframe && this._ppIframe.parentNode) {
      try { this._ppIframe.parentNode.removeChild(this._ppIframe); } catch { /* noop */ }
    }
    this._ppIframe = null;
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
  // 调用 _caps() 返回能力对象；调用 _caps(items) 返回 Tag 组件数组
  _caps(items) {
    const caps = {
      attributionSrc: typeof HTMLAnchorElement !== 'undefined' &&
        typeof HTMLAnchorElement.prototype !== 'undefined' &&
        'attributionsrc' in HTMLAnchorElement.prototype,
      pstIssuance: typeof navigator !== 'undefined' && !!navigator.privateTokenIssuance,
      hasPrivateToken: typeof document !== 'undefined' && typeof document.hasPrivateToken === 'function',
      privateTokenOp: typeof document !== 'undefined' && typeof document.privateTokenOperation === 'function',
      cookieStore: (typeof cookieStore !== 'undefined' && typeof cookieStore.get === 'function') ||
        (typeof window !== 'undefined' && !!window.cookieStore && typeof window.cookieStore.get === 'function'),
      fedcm: typeof navigator !== 'undefined' && !!navigator.credentials &&
        typeof navigator.credentials.get === 'function' && typeof IdentityProvider !== 'undefined',
      iframePP: typeof HTMLIFrameElement !== 'undefined' && !!HTMLIFrameElement.prototype.permissionsPolicy,
      topics: typeof navigator !== 'undefined' && typeof navigator.browsingTopics === 'function',
      runAdAuction: typeof navigator !== 'undefined' && typeof navigator.runAdAuction === 'function',
      joinAdIG: typeof navigator !== 'undefined' && typeof navigator.joinAdInterestGroup === 'function',
      rsa: typeof document !== 'undefined' && typeof document.requestStorageAccess === 'function',
      rsaFor: typeof document !== 'undefined' && typeof document.requestStorageAccessFor === 'function',
      sharedStorage: typeof window !== 'undefined' && !!window.sharedStorage,
      sharedStorageWorklet: typeof window !== 'undefined' && typeof window.sharedStorageWorklet === 'object',
      storageFoundation: typeof navigator !== 'undefined' && !!navigator.storageFoundation,
    };
    if (items === undefined) return caps;
    return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // =================== Card 1：Attribution Reporting API ===================

  // 构造带 attributionsrc 的 fetch options，记录预期请求/响应头（不真实发起网络请求）
  _demoAttributionFetch() {
    try {
      const targetUrl = 'https://advertiser.example/register-source';
      // fetch(url, { attributionsrc: true | 'url' | ['url1','url2'] })
      const fetchOptions = {
        method: 'GET',
        attributionsrc: true,          // true = 用 target URL 自身作为登记端点
        // 也可：attributionsrc: 'https://advertiser.example/register-trigger'
        // 也可：attributionsrc: ['url1', 'url2']
        credentials: 'omit',
        mode: 'cors',
      };
      // 模拟 source 登记响应头
      const sourceRegisterHeader = {
        source_event_id: '1234567890',
        destination: 'https://advertiser.example',
        source_expiration: '259200',       // 秒（3 天）
        event_report_window: '172800',     // 秒（2 天）
        aggregatable_report_window: '1296000',
        source_type: 'navigation',
      };
      // 模拟 trigger 登记响应头
      const triggerRegisterHeader = {
        event_trigger_data: [{ trigger_data: '4', priority: '100' }],
        aggregatable_trigger_data: [{ key_piece: '0x1', source_keys: ['campaignCounts'] }],
      };

      // 检测元素属性形式（不真实发起）
      let attrSrcOnAnchor = false, attrSrcOnImage = false, attrSrcOnScript = false;
      try {
        attrSrcOnAnchor = typeof HTMLAnchorElement !== 'undefined' &&
          typeof HTMLAnchorElement.prototype !== 'undefined' &&
          'attributionsrc' in HTMLAnchorElement.prototype;
      } catch { /* noop */ }
      try {
        attrSrcOnImage = typeof HTMLImageElement !== 'undefined' &&
          typeof HTMLImageElement.prototype !== 'undefined' &&
          'attributionsrc' in HTMLImageElement.prototype;
      } catch { /* noop */ }
      try {
        attrSrcOnScript = typeof HTMLScriptElement !== 'undefined' &&
          typeof HTMLScriptElement.prototype !== 'undefined' &&
          'attributionsrc' in HTMLScriptElement.prototype;
      } catch { /* noop */ }

      this.setState({ attributionInfo:
        'Attribution Reporting API 演示（不真实发起请求，仅构造 options + 记录预期头）：\n\n' +
        `fetch('${targetUrl}', options)\noptions = ${JSON.stringify(fetchOptions, null, 2)}\n\n` +
        'attributionsrc 取值：\n  true —— 用 target URL 自身作为登记端点；\n' +
        "  'url' —— 用指定 URL 作为登记端点；['url1','url2'] —— 多个登记端点\n\n" +
        '元素属性形式（等价）：\n' +
        `  <a attributionsrc>     HTMLAnchorElement.attributionsrc 可用：${attrSrcOnAnchor ? '✓' : '✗'}\n` +
        `  <img attributionsrc>   HTMLImageElement.attributionsrc 可用：${attrSrcOnImage ? '✓' : '✗'}\n` +
        `  <script attributionsrc> HTMLScriptElement.attributionsrc 可用：${attrSrcOnScript ? '✓' : '✗'}\n\n` +
        'Source 登记响应头（服务端返回）：\n' +
        'Attribution-Reporting-Register-Source: ' + JSON.stringify(sourceRegisterHeader) + '\n\n' +
        'Trigger 登记响应头（服务端返回）：\n' +
        'Attribution-Reporting-Register-Trigger: ' + JSON.stringify(triggerRegisterHeader) + '\n\n' +
        '两种报告类型：\n' +
        '  (1) 事件级报告 (event-level reports)：source 与 trigger 关联后延迟约 2 天上报；\n      payload 含 source_event_id + trigger_data，可用于细粒度归因。\n' +
        '  (2) 汇总报告 (summary reports)：通过 Aggregation Service（TEE 部署）聚合多源数据上报；\n      payload 为加密的可聚合贡献，进一步保护用户隐私。\n\n' +
        '延迟说明：impression → 2 天 → 报告送达（防止短时序侧信道泄露用户身份）。' });
      this._addLog('attr', `构造 attributionsrc fetch：target=${targetUrl}，attributionsrc=true；anchor=${attrSrcOnAnchor}, img=${attrSrcOnImage}, script=${attrSrcOnScript}`);
    } catch (err) {
      this._addLog('warn', `Attribution Reporting 演示失败：${err.name} - ${err.message}`);
    }
  }

  // 解释 source / trigger 登记头字段与触发流程
  _explainAttributionHeaders() {
    this.setState({ attributionInfo:
      '===== Attribution-Reporting-Register-Source 字段 =====\n' +
      '  source_event_id            —— 字符串，源事件唯一 ID（用于事件级报告关联）\n' +
      '  destination                —— 目标站点（advertiser），trigger 必须在该站点触发\n' +
      '  source_expiration          —— 源过期时间（秒，默认/最大 30 天）\n' +
      '  event_report_window        —— 事件级报告窗口（秒，默认 2 天）\n' +
      '  aggregatable_report_window —— 汇总报告窗口（秒）\n' +
      '  source_type                —— "navigation"（点击/导航）或 "event"（图片/script 触发）\n' +
      '  filter_data / aggregate_deduplication_keys —— 过滤与去重键\n\n' +
      '===== Attribution-Reporting-Register-Trigger 字段 =====\n' +
      '  event_trigger_data        —— [{ trigger_data, priority, deduplication_key, filters }]，事件级触发数据\n' +
      '  aggregatable_trigger_data —— [{ key_piece, source_keys, filters }]，汇总触发数据\n' +
      '  aggregatable_values       —— { source_key: value }，可聚合贡献值\n\n' +
      '===== 触发流程 =====\n' +
      '  1. 用户点击广告 → 浏览器请求 advertiser.example/register-source\n' +
      '  2. 服务端响应含 Attribution-Reporting-Register-Source 头 → 浏览器存储 source\n' +
      '  3. 用户在 advertiser.example 完成转化 → 浏览器请求 advertiser.example/register-trigger\n' +
      '  4. 服务端响应含 Attribution-Reporting-Register-Trigger 头 → 浏览器匹配 source\n' +
      '  5. 延迟后浏览器上报报告到 advertiser 的 /.well-known/attribution-reporting 端点' });
    this._addLog('attr', '已展示 Source/Trigger 登记头字段与触发流程说明');
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Attribution Reporting API（归因报告）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['attributionsrc', caps.attributionSrc]]),
        h(Tag, { color: 'primary' }, '事件级 / 汇总'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Attribution Reporting API 让广告主在不暴露用户身份的前提下度量广告转化。fetch(url, { attributionsrc: true | "url" | ["url1","url2"] }) 或 HTMLAnchorElement/HTMLImageElement/HTMLScriptElement.attributionsrc 标记请求为归因登记；服务端在响应中返回 Attribution-Reporting-Register-Source / Attribution-Reporting-Register-Trigger 头。两类报告：事件级报告（source → trigger 关联，延迟约 2 天上报）与汇总报告（经 Aggregation Service 聚合，保护隐私）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('构造 attributionsrc fetch', { type: 'primary', size: 'sm', onClick: () => this._demoAttributionFetch() }),
          this._btn('Source/Trigger 头字段', { size: 'sm', onClick: () => this._explainAttributionHeaders() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Attribution Reporting 用法 / 头字段：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.attributionInfo || '（点击「构造 attributionsrc fetch」或「Source/Trigger 头字段」）')),
        h(Alert, {
          type: 'info',
          message: '归因报告有 ~2 天延迟，防止短时序侧信道',
          description: '浏览器故意延迟事件级报告（impression → 2 天 → report），避免攻击者通过快速时间关联反推用户身份。汇总报告需通过 Aggregation Service（TEE 部署）聚合，进一步保护隐私。attributionsrc 是声明式 API，浏览器自动处理登记与上报，JS 无法读取 source/trigger 内容。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Private State Tokens (PST) ===================

  // 检测 document.hasPrivateToken 与发行目录结构
  _detectPST() {
    const caps = this._caps();
    try {
      const hasHPT = caps.hasPrivateToken;
      const hasPTO = caps.privateTokenOp;
      const hasIssuance = caps.pstIssuance;
      // issuer 目录结构（.well-known/private-token-issuer-directory）
      const issuerDirSample = {
        'issuer-directory': [
          {
            name: 'Anti-Fraud Issuer',
            origins: ['https://pst-issuer.example'],
            contact: 'admin@pst-issuer.example',
            endpoints: {
              issuance: 'https://pst-issuer.example/issuance',
              redemption: 'https://pst-issuer.example/redemption',
            },
          },
        ],
      };
      let hptResult = '(API 不可用)';
      if (hasHPT) {
        try {
          // document.hasPrivateToken(issuer) → boolean
          hptResult = String(document.hasPrivateToken('https://pst-issuer.example'));
        } catch (e) {
          hptResult = `调用失败：${e.name} - ${e.message}`;
        }
      }
      this.setState({ pstInfo:
        'Private State Tokens (PST，原 Privacy Pass) 能力检测：\n' +
        `  navigator.privateTokenIssuance   = ${hasIssuance ? '可用' : 'undefined（不可用）'}\n` +
        `  document.hasPrivateToken         = ${hasHPT ? 'function（可用）' : 'undefined（不可用）'}\n` +
        `  document.privateTokenOperation   = ${hasPTO ? 'function（可用）' : 'undefined（不可用）'}\n` +
        `  document.hasPrivateToken(issuer) = ${hptResult}\n\n` +
        'Issuer 目录结构（部署在 /.well-known/private-token-issuer-directory）：\n' +
        JSON.stringify(issuerDirSample, null, 2) + '\n\n' +
        '说明：navigator.privateTokenIssuance 用于发行（issuance）；\n' +
        '  document.hasPrivateToken(issuer) 检查是否已持有某 issuer 的 token；\n' +
        "  document.privateTokenOperation(issuer, 'redeem'|'verify') 执行兑换/验证。" });
      this._addLog('pst', `PST 检测：issuance=${hasIssuance}, hasPrivateToken=${hasHPT}, privateTokenOperation=${hasPTO}, hasPrivateToken()=${hptResult}`);
    } catch (err) {
      this._addLog('warn', `PST 检测失败：${err.name} - ${err.message}`);
    }
  }

  // 解释 PST 发行/兑换流程与信任曲线
  _explainPSTFlow() {
    this.setState({ pstInfo:
      '===== Private State Tokens 发行/兑换流程 =====\n\n' +
      '[发行 Issuance]\n' +
      '  1. 客户端访问发行方（issuer）站点\n  2. 客户端生成多个 blinded token（盲化令牌），发送给 issuer\n' +
      '  3. issuer 对每个 blinded token 签名后返回（看不到原始 token）\n  4. 客户端 unblind 得到签名 token，本地存储\n' +
      '  API：navigator.privateTokenIssuance（发行方调用）\n\n' +
      '[兑换 Redemption]\n' +
      '  1. 客户端访问兑换方（redeemer）站点\n' +
      "  2. document.privateTokenOperation(issuer, 'redeem') 提交 blinded token\n" +
      '  3. issuer 验证签名（redemption endpoint），返回验证结果\n' +
      '  4. 兑换方得知"用户持有该 issuer 的有效 token"，但无法关联到发行环节\n\n' +
      '===== 信任曲线（issuer / redeemer 分离）=====\n\n' +
      '  issuer（发行方）：验证用户身份后签发 token，但不参与后续兑换；\n' +
      '  redeemer（兑换方）：只验证 token 签名有效，看不到用户身份；\n' +
      '  关键：issuer 与 redeemer 串通才能关联用户，单方无法追踪。\n\n' +
      '===== 用例 =====\n' +
      '  - 反欺诈：发行方验证用户为真人，兑换方据此放行（无需 cookie 追踪）\n' +
      '  - 机器人检测：CAPTCHA 通过后发行 token，后续站点兑换免验证码\n' +
      '  - 速率限制：按 token 计数而非 IP/cookie，保护隐私\n' +
      '  - 1-RTT 隐私保护证明：单次往返完成兑换，无持久标识符' });
    this._addLog('pst', '已展示 PST 发行/兑换流程与信任曲线说明');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Private State Tokens（私有状态令牌）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['issuance', caps.pstIssuance],
          ['hasPrivateToken', caps.hasPrivateToken],
        ]),
        h(Tag, { color: 'primary' }, '原 Privacy Pass'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Private State Tokens（PST，原 Privacy Pass）通过密码学盲签让客户端向兑换方证明"我持有某发行方签发的有效令牌"，而兑换方无法关联到发行环节。navigator.privateTokenIssuance 用于发行；document.hasPrivateToken(issuer) 检测是否已持有；document.privateTokenOperation(issuer, "redeem"|"verify") 执行兑换/验证。issuer 目录部署在 /.well-known/private-token-issuer-directory。用例：反欺诈、机器人检测、隐私保护速率限制。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 PST 能力', { type: 'primary', size: 'sm', onClick: () => this._detectPST() }),
          this._btn('发行/兑换流程', { size: 'sm', onClick: () => this._explainPSTFlow() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'PST 检测 / 流程说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, s.pstInfo || '（点击「检测 PST 能力」或「发行/兑换流程」）')),
        h(Alert, {
          type: 'info',
          message: 'PST 通过 issuer/redeemer 分离实现隐私保护',
          description: '发行方签发盲化令牌但不参与兑换；兑换方仅验证签名，看不到用户身份。只有双方串通才能关联用户，单方无法追踪。1-RTT 完成兑换，无需持久 cookie。PST 仍处实验阶段，需 Chrome 试用 + HTTPS；jsdom 不可用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：CHIPS（Partitioned Cookies）===================

  // 构造 Partitioned Set-Cookie 字符串并用 regex 解析属性
  _parseChipsCookie() {
    try {
      // 构造 Set-Cookie 字符串（CHIPS 要求 Partitioned + Secure + SameSite=None）
      const setCookieStr = 'partitioned_token=chips-xyz-789; Path=/; Secure; SameSite=None; Partitioned; Max-Age=86400';
      // 逐属性解析（更可靠的正则）
      const parts = setCookieStr.split(';').map((p) => p.trim());
      const nameValue = parts[0].split('=');
      const name = nameValue[0];
      const value = nameValue[1];
      const attrs = {};
      for (let i = 1; i < parts.length; i++) {
        const seg = parts[i];
        const eqIdx = seg.indexOf('=');
        if (eqIdx === -1) {
          attrs[seg.toLowerCase()] = true;       // 布尔属性（如 Partitioned, Secure）
        } else {
          const k = seg.slice(0, eqIdx).trim().toLowerCase();
          const v = seg.slice(eqIdx + 1).trim();
          attrs[k] = v;
        }
      }
      // 校验 CHIPS 必备属性
      const hasPartitioned = attrs.partitioned === true;
      const hasSecure = attrs.secure === true;
      const sameSite = attrs.samesite || '(未指定)';
      const isChipsValid = hasPartitioned && hasSecure && sameSite.toLowerCase() === 'none';
      this.setState({ chipsInfo:
        'CHIPS（Partitioned Cookies）解析演示：\n\n' +
        `原始 Set-Cookie 字符串：\n  ${setCookieStr}\n\n` +
        `解析结果：\n  name  = ${name}\n  value = ${value}\n` +
        `  属性  = ${JSON.stringify(attrs, null, 2)}\n\n` +
        'CHIPS 合规性校验：\n' +
        `  Partitioned 属性存在：${hasPartitioned ? '✓' : '✗'}\n` +
        `  Secure 属性存在：${hasSecure ? '✓' : '✗'}\n` +
        `  SameSite = None：${sameSite.toLowerCase() === 'none' ? '✓' : '✗'}（实际：${sameSite}）\n` +
        `  CHIPS 合规：${isChipsValid ? '✓ 合法分区 cookie' : '✗ 缺少必备属性'}\n\n` +
        '说明：CHIPS 要求 Partitioned + Secure + SameSite=None 三者齐全；\n' +
        '  缺少任一项浏览器将拒绝作为分区 cookie 存储（可能降级为普通 cookie 或被丢弃）。' });
      this._addLog('chips', `解析 Set-Cookie：name=${name}, partitioned=${hasPartitioned}, secure=${hasSecure}, sameSite=${sameSite}, 合规=${isChipsValid}`);
    } catch (err) {
      this._addLog('warn', `CHIPS 解析失败：${err.name} - ${err.message}`);
    }
  }

  // 解释分区键（partition key = top-level site）与 cookieStore.get({ partitioned: true })
  _explainPartitionKey() {
    const caps = this._caps();
    let csLine;
    if (caps.cookieStore) {
      csLine = '\n\ncookieStore.get({ partitioned: true }) 在浏览器中需在第三方上下文调用；\n  当前环境 cookieStore 可用但分区语义需真实浏览器验证。';
    } else {
      csLine = '\n\ncookieStore 不可用（jsdom 不支持），无法演示 cookieStore.get({ partitioned: true })。';
    }
    this.setState({ chipsInfo:
      '===== CHIPS 分区键（partition key）=====\n\n' +
      '分区键 = top-level site（host + scheme）\n' +
      '  示例：用户访问 https://a.com，其中嵌入 iframe 来自 https://embed.com\n' +
      '  embed.com 设置 Partitioned cookie 后，分区键 = (https, a.com)\n' +
      '  同一 embed.com 在 https://b.com 嵌入时，分区键 = (https, b.com)\n' +
      '  两个分区键的 cookie 完全隔离，互不可见\n\n' +
      'document.cookie 行为：\n' +
      '  - 第一方上下文：document.cookie 读取第一方 cookie，行为不变\n' +
      '  - 第三方上下文（嵌入 iframe）：document.cookie 只能读取当前分区键的 cookie\n' +
      '  - 同一第三方在 A.com 与 B.com 嵌入时，document.cookie 返回不同的 cookie\n\n' +
      'cookieStore API：\n' +
      '  cookieStore.get({ partitioned: true })    —— 读取分区 cookie\n' +
      '  cookieStore.set({ ..., partitioned: true }) —— 设置分区 cookie\n' +
      '  cookieStore.getAll({ partitioned: true }) —— 列出所有分区 cookie\n' +
      '  说明：partitioned 选项仅在第三方上下文有意义' + csLine + '\n\n' +
      '目的：保留第三方嵌入功能（如评论、地图、支付）的同时，阻止跨站追踪；\n' +
      '  每个 top-level site 拥有独立 cookie jar，身份信息不跨站共享。' });
    this._addLog('chips', '已展示 CHIPS 分区键（top-level site）说明');
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. CHIPS（分区 Cookie）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['cookieStore', caps.cookieStore]]),
        h(Tag, { color: 'primary' }, 'Partitioned; Secure; SameSite=None'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CHIPS（Partitioned Cookies）通过 Set-Cookie: name=value; Partitioned; Secure; SameSite=None; Path=/ 让第三方 cookie 按 top-level site（host+scheme）分区存储。同一第三方在 A.com 与 B.com 嵌入时 cookie 互不可见，防止跨站追踪同时保留嵌入功能。document.cookie 第一方访问不变；第三方上下文只读当前分区。cookieStore.get({ partitioned: true }) 读取分区 cookie。本卡片用 regex 解析 Set-Cookie 字符串并校验 CHIPS 合规性。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('解析 Set-Cookie', { type: 'primary', size: 'sm', onClick: () => this._parseChipsCookie() }),
          this._btn('分区键说明', { size: 'sm', onClick: () => this._explainPartitionKey() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'CHIPS 解析 / 分区键说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.chipsInfo || '（点击「解析 Set-Cookie」或「分区键说明」）')),
        h(Alert, {
          type: 'info',
          message: 'CHIPS 是第三方 cookie 的"分区"替代方案',
          description: '不同于完全弃用第三方 cookie，CHIPS 让第三方功能继续可用，但每个 top-level site 拥有独立 cookie jar，身份信息不跨站共享。必须同时 Partitioned + Secure + SameSite=None；缺少任一项浏览器将拒绝作为分区 cookie 存储。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Related Website Sets (RWS) ===================

  // 展示 RWS manifest 示例并校验结构
  _validateRwsManifest() {
    try {
      const manifest = {
        primary: 'https://example.com',
        associatedSites: ['https://associate1.example', 'https://associate2.example'],
        rationaleBySite: {
          'https://associate1.example': 'Login',
          'https://associate2.example': 'Payment',
        },
        contact: 'admin@example.com',
      };
      // 校验规则
      const checks = [];
      checks.push(['primary 是字符串', typeof manifest.primary === 'string']);
      checks.push(['primary 是 https URL', typeof manifest.primary === 'string' && manifest.primary.startsWith('https://')]);
      checks.push(['associatedSites 是非空数组', Array.isArray(manifest.associatedSites) && manifest.associatedSites.length > 0]);
      checks.push(['primary 不在 associatedSites 中', !manifest.associatedSites.includes(manifest.primary)]);
      let rationaleOk = true;
      for (const site of manifest.associatedSites) {
        if (!manifest.rationaleBySite || !manifest.rationaleBySite[site]) {
          rationaleOk = false;
          break;
        }
      }
      checks.push(['每个 associatedSite 都有 rationale', rationaleOk]);
      checks.push(['contact 是字符串', typeof manifest.contact === 'string']);
      // scope 校验：associatedSites 与 primary host 不重复（简化为 host 字符串比较）
      let scopeOk = true;
      const primaryHost = manifest.primary.replace(/^https?:\/\//, '');
      for (const site of manifest.associatedSites) {
        const host = site.replace(/^https?:\/\//, '');
        if (host === primaryHost) scopeOk = false;
      }
      checks.push(['associatedSites 与 primary host 不重复', scopeOk]);
      const allPass = checks.every(([, ok]) => ok);
      const checkLines = checks.map(([n, ok]) => `  ${ok ? '✓' : '✗'} ${n}`).join('\n');
      this.setState({ rwsInfo:
        'Related Website Sets（RWS）manifest 示例与结构校验：\n\n' +
        `manifest JSON（部署在 primary 的 /.well-known/related-website-sets.json）：\n${JSON.stringify(manifest, null, 2)}\n\n` +
        `结构校验结果：\n${checkLines}\n  ─────────────────────────\n  ${allPass ? '✓ manifest 合法' : '✗ manifest 不合法（见上方 ✗ 项）'}\n\n` +
        '字段说明：\n' +
        '  primary            —— 主域（canonical），manifest 部署在此域\n' +
        '  associatedSites    —— 关联站点数组（必须声明 rationaleBySite）\n' +
        '  rationaleBySite    —— 每个关联站点的用途说明（Login/Payment 等）\n' +
        '  contact            —— 联系邮箱（提交审核用）\n' +
        '  可选：serviceSites / uncheckedCandidateSites / ccTLDs\n\n' +
        '说明：浏览器加载 RWS 后，集合内站点可视为同一"第一方"，\n' +
        '  配合 document.requestStorageAccessFor 共享登录态，放宽 SameSite 限制。' });
      this._addLog('rws', `RWS manifest 校验：${allPass ? '合法' : '不合法'}（${checks.filter(([, ok]) => ok).length}/${checks.length} 项通过）`);
    } catch (err) {
      this._addLog('warn', `RWS 校验失败：${err.name} - ${err.message}`);
    }
  }

  // 解释 RWS 提交/审核流程
  _explainRwsSubmission() {
    this.setState({ rwsInfo:
      '===== Related Website Sets 提交/审核流程 =====\n\n' +
      '1. 准备 manifest JSON：在 primary 域部署 /.well-known/related-website-sets.json\n' +
      '   字段：primary / associatedSites / rationaleBySite / contact；每个关联站点需有清晰用途说明（Login/Payment/Search 等）\n\n' +
      '2. 提交到 Chromium 仓库：https://github.com/GoogleChrome/related-website-sets\n' +
      '   通过 PR 提交，需声明组织关系与使用场景\n\n' +
      '3. 人工审核：\n' +
      '   - primary 与 associatedSites 必须属于同一组织/实体\n' +
      '   - rationale 必须合理（仅限 Login/Payment/Search 等真实场景）\n' +
      '   - 限制集合大小（通常 ≤ 5 个关联站点）；审核 PR 后合入 chromium/related_website_sets.JSON\n\n' +
      '4. 浏览器分发：\n' +
      '   - Chrome 通过组件更新下发已知 RWS 列表\n' +
      '   - 用户访问集合内站点时浏览器自动应用"第一方"判定；同一 RWS 内站点可放宽 SameSite 限制、共享存储访问\n\n' +
      '5. 变更管理：增删关联站点需重新提交 PR + 审核；浏览器定期同步 chromium 仓库的列表\n\n' +
      '与 CHIPS 的关系：\n' +
      '  CHIPS 让第三方 cookie 按 top-level site 分区（保留功能，隔离身份）；\n' +
      '  RWS 让真正关联的站点声明为同一第一方（共享登录态，无需 SameSite=None）；\n' +
      '  两者互补：CHIPS 解决"独立第三方嵌入"，RWS 解决"关联站点共享身份"。' });
    this._addLog('rws', '已展示 RWS 提交/审核流程说明');
  }

  _renderCard4() {
    const s = this.state;
    const card = new Card({
      title: '4. Related Website Sets（关联网站集）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'RWS / FPS'),
        h(Tag, { color: 'warning' }, 'manifest + 审核'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Related Website Sets（RWS，原 First-Party Sets）允许一组关联域名通过 primary 域部署 /.well-known/related-website-sets.json 声明为同一"第一方"实体，manifest 含 primary / associatedSites / rationaleBySite / contact。集合内站点可放宽 SameSite 限制、配合 document.requestStorageAccessFor 共享登录态。需提交到 Chromium 仓库审核（验证同实体、合理 rationale）。与 CHIPS 互补：CHIPS 分区独立第三方，RWS 共享关联站点身份。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('校验 manifest', { type: 'primary', size: 'sm', onClick: () => this._validateRwsManifest() }),
          this._btn('提交/审核流程', { size: 'sm', onClick: () => this._explainRwsSubmission() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'RWS manifest / 流程说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.rwsInfo || '（点击「校验 manifest」或「提交/审核流程」）')),
        h(Alert, {
          type: 'info',
          message: 'RWS 需提交到 Chromium 仓库人工审核',
          description: '与浏览器自动应用的 manifest 不同，RWS 需通过 GitHub PR 提交并经 Google 人工审核（验证 primary 与 associatedSites 同属一实体、rationale 合理）。审核通过后通过组件更新下发到 Chrome。这是为了防止滥用（如把无关联站点声明为同第一方以绕过隐私限制）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：FedCM 与 Storage Access 协同 ===================

  // 构造 iframe allow 字符串并解析 allowlist，尝试 iframe.permissionsPolicy 内省
  _parseIframeAllow() {
    const caps = this._caps();
    try {
      // 构造一个含 Privacy Sandbox 相关 allow 值的 iframe 字符串
      const allowStr = 'fedcm; storage-access; attribution-reporting; private-state-token-issuance; private-state-token-redemption; local-fonts';
      // 解析 allowlist（分号分隔，可选 origin 限定）
      const entries = allowStr.split(';').map((s) => s.trim()).filter(Boolean);
      const parsed = entries.map((e) => {
        const m = e.match(/^([a-z0-9-]+)(?:\s+(.+))?$/i);
        if (!m) return { feature: e, origins: [] };
        const feature = m[1].toLowerCase();
        const rest = (m[2] || '').trim().replace(/^\((.*)\)$/, '$1').trim();
        const origins = rest ? rest.split(/\s+/).filter(Boolean) : [];
        return { feature, origins };
      });
      // 已知 Privacy Sandbox 相关 allow 值
      const known = [
        'fedcm', 'storage-access', 'attribution-reporting',
        'private-state-token-issuance', 'private-state-token-redemption',
        'local-fonts',
      ];
      const knownLines = parsed.map((p) => {
        const isKnown = known.includes(p.feature);
        const originStr = p.origins.length ? ` @ [${p.origins.join(', ')}]` : ' (self)';
        return `  ${isKnown ? '✓' : '?'} ${p.feature}${originStr}`;
      }).join('\n');
      // 检测 iframe.permissionsPolicy（如可用，列实际允许的 feature）
      let ppLine;
      if (caps.iframePP) {
        try {
          const iframe = document.createElement('iframe');
          iframe.allow = allowStr;
          this._ppIframe = iframe;
          const pp = iframe.permissionsPolicy;
          let allowed = [];
          if (typeof pp.allowedFeatures === 'function') {
            allowed = pp.allowedFeatures();
          }
          ppLine = `\n\niframe.permissionsPolicy.allowedFeatures() => ${allowed.length} 个 feature（含未在 allow 中列出的默认允许项）。\n  前 10 个：${allowed.slice(0, 10).join(', ')}${allowed.length > 10 ? '...' : ''}`;
        } catch (e) {
          ppLine = `\n\niframe.permissionsPolicy 内省异常：${e.name} - ${e.message}`;
        }
      } else {
        ppLine = '\n\niframe.permissionsPolicy 不可用（jsdom 未实现），无法列举实际允许的 feature。';
      }
      this.setState({ fedcmInfo:
        'FedCM 与 Storage Access 协同 —— iframe allow 解析演示：\n\n' +
        `allow 字符串：\n  ${allowStr}\n\n` +
        `解析结果（feature + 限定 origin）：\n${knownLines}\n\n` +
        '已知 Privacy Sandbox 相关 allow 值：\n' +
        "  'fedcm'                           —— 允许 FedCM（navigator.credentials.get({ identity })）\n" +
        "  'storage-access'                  —— 允许 Storage Access API（requestStorageAccess）\n" +
        "  'attribution-reporting'           —— 允许 Attribution Reporting\n" +
        "  'private-state-token-issuance'    —— 允许 PST 发行\n" +
        "  'private-state-token-redemption'  —— 允许 PST 兑换\n" +
        "  'local-fonts'                     —— 允许 queryLocalFonts（本地字体访问）" + ppLine });
      this._addLog('fedcm', `解析 iframe allow：${parsed.length} 项；iframePP 可用=${caps.iframePP}`);
    } catch (err) {
      this._addLog('warn', `iframe allow 解析失败：${err.name} - ${err.message}`);
    }
  }

  // 解释 FedCM + Storage Access 协同
  _explainFedcmComposition() {
    this.setState({ fedcmInfo:
      '===== FedCM 与 Storage Access API 协同 =====\n\n' +
      'FedCM（Federated Credential Management）：\n' +
      "  navigator.credentials.get({ identity: { providers: [{ clientId, origin }] } }) → Promise<IdentityCredential>\n" +
      '  流程：用户点击"用 X 登录" → 浏览器（非 JS）向 IdP well-known 端点请求 →\n' +
      '  弹出浏览器原生账户选择 UI → 用户选择后浏览器向 RP 发送令牌\n' +
      '  关键：IdP cookie 与 RP cookie 完全隔离，浏览器作为中介，无第三方 cookie 追踪\n\n' +
      'Storage Access API：\n' +
      '  document.requestStorageAccess() → Promise<void>\n' +
      '  嵌入 iframe 请求访问其第一方 cookie/storage（需用户手势 + Permissions-Policy: storage-access）\n\n' +
      '协同场景（SSO + 嵌入式应用）：\n' +
      '  1. 嵌入在第三方站点的 IdP iframe 需访问自身 cookie 验证会话\n' +
      '  2. document.requestStorageAccess() 先获取存储访问权\n' +
      '  3. 再用 navigator.credentials.get({ identity }) 触发 FedCM 流程\n' +
      '  4. iframe allow="fedcm; storage-access" 同时授权两者\n\n' +
      '===== Permissions-Policy allow 值（Privacy Sandbox 相关）=====\n' +
      "  'fedcm'                          —— FedCM 联邦登录\n" +
      "  'storage-access'                 —— Storage Access API\n" +
      "  'attribution-reporting'          —— Attribution Reporting\n" +
      "  'private-state-token-issuance'   —— PST 发行\n" +
      "  'private-state-token-redemption' —— PST 兑换\n" +
      "  'local-fonts'                    —— 本地字体访问（queryLocalFonts）\n" +
      "  语法：allow='feature1; feature2 origin1 origin2; feature3 (*)'\n" +
      "        ()=禁用；(self)=仅同源；origin 列表=指定源；*=任意源\n\n" +
      '说明：FedCM 是替代 OAuth 隐式流程 + 第三方 cookie 的现代方案；\n' +
      '  与 Storage Access API 协同可覆盖嵌入式 SSO 场景。jsdom 中均不可用。' });
    this._addLog('fedcm', '已展示 FedCM 与 Storage Access 协同说明');
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. FedCM 与 Storage Access 协同',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['FedCM', caps.fedcm],
          ['iframePP', caps.iframePP],
        ]),
        h(Tag, { color: 'primary' }, 'allow="fedcm; storage-access; ..."'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'FedCM（navigator.credentials.get({ identity: { providers } })）让浏览器作为中介完成联邦登录，IdP 与 RP cookie 完全隔离，替代 OAuth 隐式流程 + 第三方 cookie。与 Storage Access API（document.requestStorageAccess）协同覆盖嵌入式 SSO：嵌入 iframe 先 requestStorageAccess 获取自身 cookie 访问，再 credentials.get 触发 FedCM。Permissions-Policy allow 值：\'fedcm\' / \'storage-access\' / \'attribution-reporting\' / \'private-state-token-issuance\' / \'private-state-token-redemption\' / \'local-fonts\'。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('解析 iframe allow', { type: 'primary', size: 'sm', onClick: () => this._parseIframeAllow() }),
          this._btn('协同说明', { size: 'sm', onClick: () => this._explainFedcmComposition() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'FedCM / iframe allow 解析：'),
        h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.fedcmInfo || '（点击「解析 iframe allow」或「协同说明」）')),
        h(Alert, {
          type: 'info',
          message: 'FedCM 是 OAuth + 第三方 cookie 的现代替代',
          description: '浏览器作为中介，IdP cookie 与 RP cookie 完全隔离，用户在浏览器原生 UI 选择账户，JS 无法读取 IdP cookie。与 Storage Access API 协同可覆盖嵌入式 SSO 场景（iframe 内完成联邦登录）。jsdom 中 IdentityProvider / credentials.get 均不可用，需真实浏览器演示。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：Privacy Sandbox 汇总检测矩阵 ===================

  // 检测全部 Privacy Sandbox API 并生成 ✓/✗ 矩阵
  _detectMatrix() {
    const caps = this._caps();
    const rows = [
      ['Topics API', 'navigator.browsingTopics', caps.topics, '兴趣推断广告（替代跨站追踪用户兴趣）'],
      ['Protected Audience (auction)', 'navigator.runAdAuction', caps.runAdAuction, '广告拍卖（替代 DSP 跨站追踪用户）'],
      ['Protected Audience (join)', 'navigator.joinAdInterestGroup', caps.joinAdIG, '加入兴趣组（替代 cookie 重定向）'],
      ['Attribution Reporting', 'fetch attributionsrc / 元素属性', caps.attributionSrc, '广告转化归因（替代跟踪像素 + 第三方 cookie）'],
      ['Private State Tokens', 'document.hasPrivateToken / privateTokenOperation', caps.hasPrivateToken || caps.privateTokenOp || caps.pstIssuance, '反欺诈 / 反机器人（替代 IP/cookie 速率限制）'],
      ['CHIPS (Partitioned)', 'Set-Cookie: ...; Partitioned', caps.cookieStore, '分区第三方 cookie（替代裸第三方 cookie 追踪）'],
      ['Storage Access API', 'document.requestStorageAccess', caps.rsa, '嵌入 iframe 第一方存储访问（替代隐式跨站 cookie）'],
      ['requestStorageAccessFor', 'Document.requestStorageAccessFor', caps.rsaFor, '顶级页面请求关联源存储（配合 RWS）'],
      ['FedCM', 'navigator.credentials.get({ identity })', caps.fedcm, '联邦登录（替代 OAuth + 第三方 cookie）'],
      ['iframe.permissionsPolicy', 'HTMLIFrameElement.permissionsPolicy', caps.iframePP, '权限策略内省（控制 PS API 授权）'],
    ];
    const lines = rows.map(([name, api, ok, purpose]) => {
      const mark = ok ? '✓' : '✗';
      return `  ${mark}  ${name.padEnd(28)} ${api.padEnd(48)} ${purpose}`;
    });
    const available = rows.filter((r) => r[2]).length;
    this.setState({ matrixInfo:
      '===== Privacy Sandbox 全家桶检测矩阵 =====\n\n' +
      '标记  API                            接口                                                用途\n' +
      '─'.repeat(120) + '\n' +
      lines.join('\n') + '\n' +
      '─'.repeat(120) + '\n' +
      `总计：${available}/${rows.length} 个 API 在当前环境可用\n\n` +
      '说明：本矩阵检测全部 Privacy Sandbox API（含 SecurityPrivacyPage 与 StorageAccessMultiOriginPage 覆盖的 Topics/Protected Audience/Storage Access，及本页聚焦的 Attribution Reporting/PST/CHIPS/RWS/FedCM）。jsdom 中多数为 ✗，需真实浏览器 + HTTPS + 用户开启 Privacy Sandbox 试用才能完整演示。' });
    this._addLog('matrix', `Privacy Sandbox 矩阵：${available}/${rows.length} 可用`);
  }

  // 解释弃用时间线与 API 替代关系
  _explainTimeline() {
    this.setState({ matrixInfo:
      '===== 第三方 Cookie 弃用时间线与 API 替代关系 =====\n\n' +
      '时间线（Chromium 计划，可能调整）：\n' +
      '  2022 Q1  —— 开始逐步限制第三方 cookie（经验共享存储等试点）\n' +
      '  2023     —— Privacy Sandbox 各 API 进入 origin trial\n' +
      '  2024 H1  —— Chrome 启动第三方 cookie 弃用（受监管沟通影响时间表多次调整）\n' +
      '  2024-2025 —— 逐步灰度移除第三方 cookie，提供"提示给予临时启用"过渡期\n' +
      '  2025+    —— 完全弃用第三方 cookie（CHIPS/RWS/FedCM 等成为替代方案）\n\n' +
      '===== 每个 API 替代的传统追踪用例 =====\n\n' +
      'Topics API              ←  替代"基于跨站浏览历史的兴趣推断广告"\n' +
      '                          传统：第三方 cookie 跨站追踪用户浏览，构建兴趣画像\n' +
      '                          Topics：浏览器本地推断兴趣主题，按 epoch 轮换，无需跨站追踪\n\n' +
      'Protected Audience      ←  替代"基于 cookie 的重定向广告"\n' +
      '                          传统：DSP 用第三方 cookie 记录用户访问过的商品，跨站重定向\n' +
      '                          PA：兴趣组数据本地存储，浏览器内 on-device 拍卖，DSP 无法跨站追踪\n\n' +
      'Attribution Reporting   ←  替代"跟踪像素 + 第三方 cookie 转化归因"\n' +
      '                          传统：广告主埋 1x1 像素 + 第三方 cookie 跟踪转化路径\n' +
      '                          AR：浏览器匹配 source/trigger，延迟上报，事件级 + 汇总两种报告\n\n' +
      'Private State Tokens   ←  替代"基于 IP/cookie 的速率限制与反欺诈"\n' +
      '                          传统：服务端用 IP + cookie 标识用户做限流与风控\n' +
      '                          PST：盲签令牌证明"持有有效凭据"，无持久标识符\n\n' +
      'CHIPS                   ←  替代"第三方 cookie 在嵌入式功能中的使用"\n' +
      '                          传统：第三方在多站点嵌入时共享同一 cookie jar\n' +
      '                          CHIPS：按 top-level site 分区，保留功能但隔离身份\n\n' +
      'Storage Access API      ←  替代"隐式跨站 cookie 访问"\n' +
      '                          传统：iframe 自动带第三方 cookie\n' +
      '                          SAA：用户显式授权后 iframe 才能访问第一方 cookie\n\n' +
      'FedCM                   ←  替代"OAuth 隐式流程 + 第三方 cookie 联邦登录"\n' +
      '                          传统：IdP 用第三方 cookie 跟踪用户在 RP 的登录\n' +
      '                          FedCM：浏览器中介，IdP/RP cookie 隔离，无跨站追踪\n\n' +
      '===== 总结 =====\n' +
      'Privacy Sandbox 用一组"隐私保护 + 功能保留"的 API 替代裸第三方 cookie 追踪；\n' +
      '  每个 API 针对特定用例（兴趣广告/重定向/归因/反欺诈/嵌入/SSO），\n' +
      '  通过浏览器中介、本地计算、分区存储、延迟上报等机制切断跨站身份关联。' });
    this._addLog('matrix', '已展示第三方 cookie 弃用时间线与 API 替代关系');
  }

  _renderCard6() {
    const s = this.state;
    const card = new Card({
      title: '6. Privacy Sandbox 汇总检测矩阵',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '全 API ✓/✗'),
        h(Tag, { color: 'warning' }, '弃用时间线'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '汇总检测全部 Privacy Sandbox API（Topics / Protected Audience / Attribution Reporting / PST / CHIPS / Storage Access / FedCM / iframe.permissionsPolicy），展示 ✓/✗ 矩阵与每个 API 替代的传统追踪用例。第三方 cookie 弃用时间线：2024-2025 逐步移除，CHIPS/RWS/FedCM 等成为替代方案。每个 API 通过浏览器中介、本地计算、分区存储、延迟上报等机制切断跨站身份关联。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测全 API 矩阵', { type: 'primary', size: 'sm', onClick: () => this._detectMatrix() }),
          this._btn('弃用时间线 + 替代关系', { size: 'sm', onClick: () => this._explainTimeline() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Privacy Sandbox 检测矩阵 / 时间线：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, s.matrixInfo || '（点击「检测全 API 矩阵」或「弃用时间线 + 替代关系」）')),
        h(Alert, {
          type: 'warning',
          message: 'Privacy Sandbox 时间表多次调整，需关注 Chromium 官方公告',
          description: '受监管沟通（如英国 CMA）与生态反馈影响，第三方 cookie 弃用时间表多次推迟。开发者应同时准备 Privacy Sandbox API 适配与过渡方案（如 CHIPS + RWS）。本矩阵检测当前环境能力，jsdom 多为 ✗，真实浏览器（HTTPS + 试用开启）才能完整演示。',
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
    return h('div', { class: 'api-lab-page privacy-sandbox-deep-page' },
      h('h2', { class: 'section-title' }, 'Privacy Sandbox 深入 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'Privacy Sandbox 用一组隐私保护 API 替代裸第三方 cookie。本页聚焦 Attribution Reporting / Private State Tokens / CHIPS / Related Website Sets / FedCM 协同 / 全 API 矩阵，补充 SecurityPrivacyPage 与 StorageAccessMultiOriginPage 未覆盖的内容。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
