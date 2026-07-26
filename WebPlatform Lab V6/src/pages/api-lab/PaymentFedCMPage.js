// =====================================================================
// PaymentFedCMPage.js —— 支付请求与 FedCM 联合身份 实验室
// 演示 MDN：
//   1. PaymentRequest 基础 —— new PaymentRequest(methodData, details, options)
//        methodData / details / options / canMakePayment
//   2. PaymentResponse 与支付流程 —— show / abort / retry / complete
//        requestId / methodName / details / shippingAddress / shippingOption / payer*
//   3. PaymentMethodChangeEvent & PaymentRequestUpdateEvent
//        onpaymentmethodchange / onshippingaddresschange / onshippingoptionchange / updateWith
//   4. Payment Handler API —— ServiceWorker + PaymentManager / PaymentInstruments
//        instruments.set / userHint / enableDelegations
//   5. FedCM 联合身份 —— navigator.credentials.get({ identity })
//        mode / context / providers / IdentityCredential (token, id, configURL)
//   6. Identity Provider Config & Manifest —— IdP 配置文件结构与浏览器→IdP→RP 流程
//        accounts / client_metadata / id_assertion_endpoint / brands / login_url
// 说明：Payment Request API 提供浏览器原生支付 UI；FedCM 提供原生联合登录 UI，
//       替代第三方 Cookie 实现隐私友好的 IdP 登录。多数 API 较新且要求安全上下文
//       （HTTPS/localhost）与用户手势；jsdom 等运行时通常不可用。所有调用前做
//       typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//       本页不真正调用 .show()（需真实支付处理程序与用户手势），仅展示用法与
//       mock 解析流程。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class PaymentFedCMPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1: PaymentRequest 基础
      paymentRequestInfo: '',
      // Card 2: PaymentResponse 与支付流程
      paymentResponseInfo: '',
      // Card 3: PaymentMethodChangeEvent & PaymentRequestUpdateEvent
      paymentEventInfo: '',
      // Card 4: Payment Handler API
      paymentHandlerInfo: '',
      // Card 5: FedCM 联合身份
      fedcmInfo: '',
      // Card 6: Identity Provider Config & Manifest
      idpConfigInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._abortCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    this._paymentRequest = null;   // Card 1/2 PaymentRequest 引用
    this._pendingPromise = null;   // 进行中的 show() / canMakePayment() Promise

    // 一次性能力检测：Payment + FedCM 全家桶
    const hasPR = typeof PaymentRequest !== 'undefined';
    const hasPMCE = typeof PaymentMethodChangeEvent !== 'undefined';
    const hasPRUE = typeof PaymentRequestUpdateEvent !== 'undefined';
    const hasCreds = typeof navigator !== 'undefined' && !!navigator.credentials &&
      typeof navigator.credentials.get === 'function';
    const hasIdentityProvider = typeof IdentityProvider !== 'undefined';
    const hasIdentityCredential = typeof IdentityCredential !== 'undefined';
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasPaymentManager = typeof PaymentManager !== 'undefined';
    const hasPaymentInstruments = typeof PaymentInstruments !== 'undefined';

    const parts = [];
    parts.push(`PaymentRequest ${hasPR ? '✓' : '✗'}`);
    parts.push(`PaymentMethodChangeEvent ${hasPMCE ? '✓' : '✗'}`);
    parts.push(`PaymentRequestUpdateEvent ${hasPRUE ? '✓' : '✗'}`);
    parts.push(`navigator.credentials ${hasCreds ? '✓' : '✗'}`);
    parts.push(`IdentityProvider ${hasIdentityProvider ? '✓' : '✗'}`);
    parts.push(`IdentityCredential ${hasIdentityCredential ? '✓' : '✗'}`);
    parts.push(`serviceWorker ${hasServiceWorker ? '✓' : '✗'}`);
    parts.push(`PaymentManager ${hasPaymentManager ? '✓' : '✗'}`);
    parts.push(`PaymentInstruments ${hasPaymentInstruments ? '✓' : '✗'}`);

    const anyAvailable = hasPR || hasCreds;
    const summary = anyAvailable
      ? `Payment 与 FedCM 能力检测：${parts.join(' · ')}。检测到部分能力。jsdom 中 PaymentRequest 通常 undefined，需真实浏览器 + HTTPS + 支付处理程序才能完整演示 show()；FedCM 需 IdentityCredential 与真实 IdP 配置文件。`
      : '当前环境（jsdom/Node）不支持 PaymentRequest / FedCM（typeof 均为 "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（HTTPS / localhost）中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasPR) this._addLog('warn', 'PaymentRequest 不可用（jsdom 通常无此构造器）');
    if (!hasCreds) this._addLog('warn', 'navigator.credentials.get 不可用（需安全上下文 HTTPS/localhost）');
    if (!hasIdentityCredential) this._addLog('warn', 'IdentityCredential 不可用（FedCM 不支持）');
  }

  componentWillUnmount() {
    // 中止可能进行中的异步检测
    if (this._abortCtrl) {
      try { this._abortCtrl.abort(); } catch { /* noop */ }
      this._abortCtrl = null;
    }
    // 释放进行中的 Promise 引用（无法真正取消，仅清理引用）
    this._pendingPromise = null;
    // 释放 PaymentRequest 引用（abort 可能抛错，try/catch）
    if (this._paymentRequest) {
      try {
        if (typeof this._paymentRequest.abort === 'function') this._paymentRequest.abort();
      } catch { /* noop */ }
    }
    this._paymentRequest = null;
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
      paymentRequest: typeof PaymentRequest !== 'undefined',
      paymentMethodChangeEvent: typeof PaymentMethodChangeEvent !== 'undefined',
      paymentRequestUpdateEvent: typeof PaymentRequestUpdateEvent !== 'undefined',
      credentials: typeof navigator !== 'undefined' && !!navigator.credentials &&
        typeof navigator.credentials.get === 'function',
      identityProvider: typeof IdentityProvider !== 'undefined',
      identityCredential: typeof IdentityCredential !== 'undefined',
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      paymentManager: typeof PaymentManager !== 'undefined',
      paymentInstruments: typeof PaymentInstruments !== 'undefined',
    };
  }

  // =================== Card 1：PaymentRequest 基础 ===================

  // 构造 PaymentRequest 三段结构（methodData + details + options）
  _buildPaymentRequest() {
    const caps = this._caps();
    if (!caps.paymentRequest) {
      this.setState({ paymentRequestInfo:
        'PaymentRequest 用法（测试环境不可用，仅说明）：\n\n' +
        "const methodData = [\n" +
        "  { supportedMethods: 'https://apple.com/apple-pay', data: { version: 3, merchantIdentifier: 'merchant.lab.local' } },\n" +
        "  { supportedMethods: 'basic-card', data: { supportedNetworks: ['visa','mastercard'], supportedTypes: ['credit','debit'] } },\n" +
        "];\n" +
        "const details = {\n" +
        "  id: 'lab-order-001',\n" +
        "  displayItems: [{ label: '商品 × 1', amount: { currency: 'CNY', value: '99.00' } }, { label: '优惠', amount: { currency: 'CNY', value: '-10.00' } }],\n" +
        "  total: { label: '合计', amount: { currency: 'CNY', value: '89.00' } },\n" +
        "  shippingOptions: [{ id: 'std', label: '标准', amount: { currency: 'CNY', value: '0.00' }, selected: true }, { id: 'exp', label: '加急', amount: { currency: 'CNY', value: '12.00' } }],\n" +
        "  modifiers: [], requestBillingAddress: false,\n" +
        "};\n" +
        "const options = { requestPayerName: true, requestPayerEmail: true, requestPayerPhone: true, requestShipping: true, shippingType: 'shipping' };\n" +
        "const req = new PaymentRequest(methodData, details, options);\n" +
        "const can = await req.canMakePayment();  // Promise<boolean>" });
      this._addLog('warn', 'PaymentRequest 不可用（typeof undefined），已记录用法说明');
      return;
    }
    try {
      const methodData = [
        { supportedMethods: 'https://apple.com/apple-pay',
          data: { version: 3, merchantIdentifier: 'merchant.lab.local' } },
        { supportedMethods: 'basic-card',
          data: { supportedNetworks: ['visa', 'mastercard'], supportedTypes: ['credit', 'debit'] } },
      ];
      const details = {
        id: 'lab-order-' + Math.random().toString(36).slice(2, 8),
        displayItems: [
          { label: 'API 实验室订阅 × 1', amount: { currency: 'CNY', value: '99.00' } },
          { label: '满减优惠', amount: { currency: 'CNY', value: '-10.00' } },
        ],
        total: { label: '合计', amount: { currency: 'CNY', value: '89.00' } },
        shippingOptions: [
          { id: 'std', label: '标准配送', amount: { currency: 'CNY', value: '0.00' }, selected: true },
          { id: 'exp', label: '加急配送', amount: { currency: 'CNY', value: '12.00' } },
        ],
        modifiers: [],
        requestBillingAddress: false,
      };
      const options = {
        requestPayerName: true,
        requestPayerEmail: true,
        requestPayerPhone: true,
        requestShipping: true,
        shippingType: 'shipping',
      };
      const req = new PaymentRequest(methodData, details, options);
      this._paymentRequest = req;
      const protoKeys = Object.getOwnPropertyNames(PaymentRequest.prototype || {});
      this.setState({ paymentRequestInfo:
        '已构造 PaymentRequest：\n' +
        '  new PaymentRequest(methodData, details, options) → req\n' +
        `  PaymentRequest.prototype 属性：${protoKeys.length ? protoKeys.join(', ') : '（无自有属性）'}\n\n` +
        'methodData（支持的支付方式与配置）：\n' +
        JSON.stringify(methodData, null, 2) + '\n\n' +
        'details（订单详情：displayItems / total / shippingOptions / modifiers / requestBillingAddress）：\n' +
        JSON.stringify(details, null, 2) + '\n\n' +
        'options（请求选项：requestPayerName / requestPayerEmail / requestPayerPhone / requestShipping / shippingType）：\n' +
        JSON.stringify(options, null, 2) + '\n\n' +
        '说明：basic-card 已弃用但仍可演示；真实生产用 URL 形式的支付处理程序（https://...）。' });
      this._addLog('pay', `已构造 PaymentRequest（methods=${methodData.length}, total=${details.total.amount.value} ${details.total.amount.currency}）`);
    } catch (err) {
      this._addLog('warn', `构造 PaymentRequest 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  // 调用 canMakePayment() 探测是否可支付（返回 Promise<boolean>）
  async _canMakePayment() {
    const caps = this._caps();
    if (!caps.paymentRequest) {
      this._addLog('warn', 'PaymentRequest 不可用，无法调用 canMakePayment()');
      this.setState({ paymentRequestInfo:
        'PaymentRequest 不可用，无法调用 canMakePayment()。\n' +
        '该方法返回 Promise<boolean>，true 表示至少有一个 supportedMethods 可用。' });
      return;
    }
    try {
      if (!this._paymentRequest) this._buildPaymentRequest();
      const req = this._paymentRequest;
      if (!req) return;
      this._addLog('pay', '调用 paymentRequest.canMakePayment() ...');
      const p = req.canMakePayment();
      this._pendingPromise = p;
      const can = await p;
      this._pendingPromise = null;
      this.setState({ paymentRequestInfo:
        'canMakePayment() 调用结果：\n' +
        '  await paymentRequest.canMakePayment() → ' + String(can) + '\n\n' +
        `含义：${can ? '至少有一个 supportedMethods 可用，可调用 show() 弹支付 UI' : '无可用支付方式，show() 会拒绝'}\n\n` +
        '说明：canMakePayment() 不弹 UI，可在页面加载时探测是否支持某支付方式（如 Apple Pay）。' });
      this._addLog('pay', `canMakePayment() = ${can}`);
    } catch (err) {
      this._pendingPromise = null;
      this._addLog('warn', `canMakePayment 失败：${errInfo(err).name} - ${errInfo(err).message}`);
      this.setState({ paymentRequestInfo: `canMakePayment 失败：${errInfo(err).name} - ${errInfo(err).message}` });
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. PaymentRequest 基础',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.paymentRequest ? 'success' : 'error' }, caps.paymentRequest ? 'PaymentRequest ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'canMakePayment'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new PaymentRequest(methodData, details, options) 构造支付请求：methodData 描述支持的支付方式（supportedMethods + data），details 含订单详情（id / displayItems / total / shippingOptions / modifiers / requestBillingAddress），options 控制请求字段（requestPayerName / requestPayerEmail / requestPayerPhone / requestShipping / shippingType）。canMakePayment() 返回 Promise<boolean> 探测是否可支付，不弹 UI。basic-card 已弃用，生产用 URL 形式支付处理程序。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('构造 PaymentRequest', { type: 'primary', size: 'sm', disabled: !caps.paymentRequest, onClick: () => this._buildPaymentRequest() }),
          this._btn('canMakePayment', { size: 'sm', disabled: !caps.paymentRequest, onClick: () => this._canMakePayment() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'PaymentRequest 结构 / canMakePayment 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.paymentRequestInfo || '（点击「构造 PaymentRequest」或「canMakePayment」）')),
        h(Alert, {
          type: 'info',
          message: 'canMakePayment 不弹 UI，可安全探测',
          description: 'canMakePayment() 在页面加载时即可调用，返回 true 表示至少一个 supportedMethods 可用（如检测是否支持 Apple Pay）。返回 false 时 show() 会拒绝。basic-card 标准已弃用，但仍可演示；生产环境推荐使用 https://google.com/pay、https://apple.com/apple-pay 等 URL 形式的支付处理程序。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：PaymentResponse 与支付流程 ===================

  // 演示 show() 调用（jsdom 中会拒绝，try/catch 记录错误类型）
  async _demoShow() {
    const caps = this._caps();
    if (!caps.paymentRequest) {
      this.setState({ paymentResponseInfo:
        'PaymentResponse 与支付流程用法（测试环境不可用，仅说明）：\n\n' +
        'const response = await req.show();  // 弹出浏览器原生支付 UI（需用户手势）\n' +
        'console.log(response.requestId);       // 与 details.id 对应\n' +
        'console.log(response.methodName);      // 实际使用的支付方式\n' +
        'console.log(response.details);         // 支付方式特定数据\n' +
        'console.log(response.shippingAddress); // 收货地址（PaymentAddress）\n' +
        'console.log(response.shippingOption);  // 选中的 shippingOption id\n' +
        'console.log(response.payerName, response.payerEmail, response.payerPhone);\n' +
        "await response.complete('success');    // 'success' | 'fail' | 'unknown'\n\n" +
        'show() 必须 由用户手势触发；无支付处理程序 / 无手势时 reject。\n' +
        'abort() 在 show() 后取消；retry(errorFields) 允许用户修正后重试。' });
      this._addLog('warn', 'PaymentRequest 不可用，无法演示 show()');
      return;
    }
    try {
      if (!this._paymentRequest) this._buildPaymentRequest();
      const req = this._paymentRequest;
      if (!req) return;
      this._addLog('pay', '调用 paymentRequest.show() —— 将弹浏览器原生支付 UI ...');
      const p = req.show();
      this._pendingPromise = p;
      const response = await p;
      this._pendingPromise = null;
      this.setState({ paymentResponseInfo:
        'show() 返回 PaymentResponse：\n' +
        `  requestId = ${response.requestId}\n` +
        `  methodName = ${response.methodName}\n` +
        `  details = ${JSON.stringify(response.details)}\n` +
        `  shippingAddress = ${response.shippingAddress ? 'PaymentAddress' : 'null'}\n` +
        `  shippingOption = ${response.shippingOption}\n` +
        `  payerName = ${response.payerName}\n` +
        `  payerEmail = ${response.payerEmail}\n` +
        `  payerPhone = ${response.payerPhone}\n\n` +
        "下一步：await response.complete('success' | 'fail' | 'unknown') 确认支付结果。" });
      this._addLog('pay', `show() 返回：methodName=${response.methodName}, requestId=${response.requestId}`);
      try { await response.complete('success'); this._addLog('pay', "complete('success') 已确认"); }
      catch (e) { this._addLog('warn', `complete 失败：${errInfo(e).message}`); }
    } catch (err) {
      this._pendingPromise = null;
      this._addLog('warn', `show() 失败：${errInfo(err).name} - ${errInfo(err).message}（jsdom / 无支付处理程序 / 无用户手势时属正常）`);
      this.setState({ paymentResponseInfo:
        `show() 调用失败：${errInfo(err).name} - ${errInfo(err).message}\n\n` +
        '常见失败原因：\n' +
        '• 无用户手势触发（show 必须在点击等手势回调中调用）\n' +
        '• 无可用支付处理程序（canMakePayment() 返回 false）\n' +
        '• 已有进行中的 show()（同时只能一个）\n' +
        '• jsdom / 非安全上下文（需 HTTPS / localhost）\n\n' +
        'PaymentResponse 字段（成功时返回）：\n' +
        '  requestId（与 details.id 对应）、methodName（实际支付方式）、details（方式特定数据）\n' +
        '  shippingAddress（PaymentAddress）、shippingOption（选中的 shippingOption id）\n' +
        '  payerName / payerEmail / payerPhone（请求 options 中开启时才有）\n' +
        "  complete(status)：status ∈ 'success' | 'fail' | 'unknown'" });
    }
  }

  // 演示 abort() 取消（如已调用 show）
  _demoAbort() {
    const caps = this._caps();
    if (!caps.paymentRequest) {
      this._addLog('warn', 'PaymentRequest 不可用，无法演示 abort()');
      return;
    }
    if (!this._paymentRequest) {
      this._addLog('warn', '请先点击「构造 PaymentRequest」');
      return;
    }
    try {
      this._paymentRequest.abort();
      this._addLog('pay', '已调用 paymentRequest.abort()（取消进行中的 show）');
      this.setState({ paymentResponseInfo:
        'abort() 调用：\n' +
        '  paymentRequest.abort() → Promise<void>\n' +
        '  取消进行中的 show()，show() 的 Promise 会 reject（AbortError）\n\n' +
        '说明：abort 必须在 show() 之后调用；若 show 已完成则 abort 无效。' });
    } catch (err) {
      this._addLog('warn', `abort 失败：${errInfo(err).name} - ${errInfo(err).message}`);
    }
  }

  // 演示 retry() 流程（允许用户修正错误后重试）
  _demoRetry() {
    const caps = this._caps();
    if (!caps.paymentRequest) {
      this.setState({ paymentResponseInfo:
        'retry() 用法（测试环境不可用，仅说明）：\n\n' +
        'const response = await req.show();\n' +
        'try {\n' +
        '  // 服务端校验 response.details 失败\n' +
        '  await response.retry({ error: { payer: { email: "无效邮箱" } } });\n' +
        '  // retry 成功后 response 字段已更新，再次校验并 complete()\n' +
        '} catch (retryErr) { /* 用户再次取消 */ }\n\n' +
        'retry(errorFields) 让用户修正错误字段后重新提交，无需重新 show。' });
      this._addLog('warn', 'PaymentRequest 不可用，已记录 retry() 用法');
      return;
    }
    this.setState({ paymentResponseInfo:
      'retry(errorFields) 调用流程：\n' +
      '  在 show() 返回 PaymentResponse 后，若服务端校验失败，\n' +
      '  可调用 response.retry(errorFields) 让用户修正后重试。\n\n' +
      'errorFields 结构示例：\n' +
      '  { error: "支付被拒绝，请重试",\n' +
      '    payer: { email: "邮箱格式错误", phone: "电话无效" },\n' +
      '    shippingAddress: { postalCode: "邮编错误" } }\n\n' +
      'retry() 成功后 response 字段已更新（payerName / shippingAddress 等），\n' +
      '需重新校验并 complete()。retry() reject 表示用户放弃。' });
    this._addLog('pay', '已记录 retry(errorFields) 用法说明');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. PaymentResponse 与支付流程',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.paymentRequest ? 'success' : 'error' }, caps.paymentRequest ? 'show/abort/retry ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'complete(success|fail|unknown)'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'show() 弹出浏览器原生支付 UI，返回 PaymentResponse（需用户手势触发）。PaymentResponse 字段：requestId（对应 details.id）、methodName（实际支付方式）、details（方式特定数据）、shippingAddress（PaymentAddress）、shippingOption（选中的 id）、payerName / payerEmail / payerPhone（options 开启时）。complete(status) 确认结果（success / fail / unknown）；abort() 取消 show；retry(errorFields) 让用户修正后重试。jsdom 中 show() 会拒绝，try/catch 记录错误类型。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 show()', { type: 'primary', size: 'sm', disabled: !caps.paymentRequest, onClick: () => this._demoShow() }),
          this._btn('abort 取消', { danger: true, size: 'sm', disabled: !caps.paymentRequest, onClick: () => this._demoAbort() }),
          this._btn('retry 用法', { size: 'sm', onClick: () => this._demoRetry() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'show / abort / retry 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.paymentResponseInfo || '（点击「演示 show()」或对应按钮）')),
        h(Alert, {
          type: 'warning',
          message: 'show() 必须由用户手势触发',
          description: 'show() 必须在用户点击 / 按键等手势回调中调用，否则浏览器拒绝。同时只能有一个进行中的 show()。complete() 必须在收到 PaymentResponse 后调用以关闭 UI（否则 UI 会超时自动关闭并显示未知状态）。retry() 用于服务端校验失败时让用户修正字段重试，无需重新 show。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：PaymentMethodChangeEvent & PaymentRequestUpdateEvent ===================

  // 展示事件绑定代码
  _showEventWiring() {
    const caps = this._caps();
    const evtAvail = caps.paymentMethodChangeEvent && caps.paymentRequestUpdateEvent;
    this.setState({ paymentEventInfo:
      '事件绑定代码（PaymentMethodChangeEvent / PaymentRequestUpdateEvent）：\n\n' +
      'const req = new PaymentRequest(methodData, details, options);\n\n' +
      '// 支付方式变更（用户从 basic-card 切到 Apple Pay 等）\n' +
      'req.onpaymentmethodchange = (ev) => {\n' +
      '  // PaymentMethodChangeEvent 字段：\n' +
      '  //   ev.methodName     —— 新的支付方式（如 "https://apple.com/apple-pay"）\n' +
      '  //   ev.methodDetails  —— 方式特定数据（由支付处理程序提供）\n' +
      '  const newDetails = recomputeDetails(ev.methodName, ev.methodDetails);\n' +
      '  ev.updateWith(Promise.resolve(newDetails));  // 用新 details 更新 UI\n' +
      '};\n\n' +
      '// 收货地址变更（用户选择 / 修改地址）\n' +
      'req.onshippingaddresschange = (ev) => {\n' +
      '  // PaymentRequestUpdateEvent；地址在 req.shippingAddress\n' +
      '  const updated = recomputeShipping(req.shippingAddress);\n' +
      '  ev.updateWith(Promise.resolve(updated));  // 重算运费 / 总价\n' +
      '};\n\n' +
      '// 配送方式变更（用户选标准 / 加急）\n' +
      'req.onshippingoptionchange = (ev) => {\n' +
      '  // 选中的 id 在 req.shippingOption\n' +
      '  const updated = recomputeTotalByShipping(req.shippingOption);\n' +
      '  ev.updateWith(Promise.resolve(updated));\n' +
      '};\n\n' +
      `当前环境：PaymentMethodChangeEvent=${caps.paymentMethodChangeEvent ? '可用' : '不可用'}, PaymentRequestUpdateEvent=${caps.paymentRequestUpdateEvent ? '可用' : '不可用'}。\n` +
      (evtAvail ? '可在真实浏览器中验证上述事件绑定。' : 'jsdom 中两者通常 undefined，需真实浏览器 + HTTPS。') });
    this._addLog('evt', `事件绑定代码已展示（PMCE=${caps.paymentMethodChangeEvent}, PRUE=${caps.paymentRequestUpdateEvent}）`);
  }

  // 解释重算流程（如地址变更后重算运费 / 总价）
  _explainRecomputeFlow() {
    this.setState({ paymentEventInfo:
      '重算流程（updateWith + Promise）：\n\n' +
      '1. 用户在支付 UI 中变更地址 / 配送方式 / 支付方式\n' +
      '2. 浏览器触发对应事件（onshippingaddresschange 等）\n' +
      '3. 事件处理函数计算新的 details（displayItems / total / shippingOptions）\n' +
      '4. 调用 ev.updateWith(Promise.resolve(newDetails)) 异步更新 UI\n' +
      '5. 浏览器收到新 details 后刷新支付 UI（显示新总价 / 运费）\n\n' +
      '示例：收货地址变更后重算运费与总价\n' +
      'function recomputeShipping(address) {\n' +
      '  const region = address.country;  // PaymentAddress.country\n' +
      "  const shipping = SHIPPING_TABLE[region] || '0.00';\n" +
      '  return {\n' +
      '    ...originalDetails,\n' +
      '    shippingOptions: [{ id: "std", label: "标准", amount: { currency: "CNY", value: shipping }, selected: true }],\n' +
      '    total: { label: "合计", amount: { currency: "CNY", value: subtotal + shipping } },\n' +
      '  };\n' +
      '}\n\n' +
      '注意：\n' +
      '• updateWith 接收 Promise，处理函数可异步请求服务端重算\n' +
      "• Promise reject 或解析超时 → 浏览器显示「计算失败」，UI 不更新\n" +
      '• updateWith 未在事件回调中调用 → 浏览器使用原 details（无变化）' });
    this._addLog('evt', '已解释 updateWith 重算流程（地址变更重算运费 / 总价）');
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. PaymentMethodChangeEvent & PaymentRequestUpdateEvent',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.paymentMethodChangeEvent ? 'success' : 'error' }, caps.paymentMethodChangeEvent ? 'PMCE ✓' : 'PMCE ✗'),
        h(Tag, { color: caps.paymentRequestUpdateEvent ? 'success' : 'error' }, caps.paymentRequestUpdateEvent ? 'PRUE ✓' : 'PRUE ✗'),
        h(Tag, { color: 'primary' }, 'updateWith'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PaymentRequest 三个变更事件：onpaymentmethodchange（PaymentMethodChangeEvent，字段 methodName / methodDetails）、onshippingaddresschange（收货地址变更，地址在 req.shippingAddress）、onshippingoptionchange（配送方式变更，id 在 req.shippingOption）。三者都用 PaymentRequestUpdateEvent.updateWith(detailsPromise) 异步更新支付 UI：处理函数计算新 details（重算运费 / 总价），updateWith 接收 Promise，浏览器收到新 details 后刷新 UI。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('事件绑定代码', { type: 'primary', size: 'sm', onClick: () => this._showEventWiring() }),
          this._btn('重算流程说明', { size: 'sm', onClick: () => this._explainRecomputeFlow() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '事件绑定 / 重算流程：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.paymentEventInfo || '（点击「事件绑定代码」或「重算流程说明」）')),
        h(Alert, {
          type: 'info',
          message: 'updateWith 是异步重算的关键',
          description: 'updateWith(detailsPromise) 接收 Promise，允许处理函数异步请求服务端重算（如根据地址查运费）。Promise resolve 后浏览器用新 details 刷新 UI；reject 或超时则显示「计算失败」。未在回调中调用 updateWith 时浏览器使用原 details。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Payment Handler API ===================

  // 解释 Payment Handler API 的 SW 注册流程（jsdom 无 SW，仅记录代码路径）
  _explainPaymentHandler() {
    const caps = this._caps();
    this.setState({ paymentHandlerInfo:
      'Payment Handler API —— 基于 ServiceWorker 的支付处理程序：\n\n' +
      '注册流程：\n' +
      '1. 注册 ServiceWorker（paymentManager 在 SW 注册对象上可用）：\n' +
      "   const reg = await navigator.serviceWorker.register('/pay-sw.js', { scope: '/' });\n" +
      '   const pm = reg.paymentManager;  // PaymentManager 实例\n\n' +
      '2. 设置支付工具（PaymentInstruments.set）：\n' +
      "   await pm.instruments.set('visa-card', {\n" +
      "     name: '我的 Visa 卡',\n" +
      '     icons: [\n' +
      "       { src: '/icon-96.png', sizes: '96x96', type: 'image/png' },\n" +
      "       { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },\n" +
      '     ],\n' +
      '   });\n\n' +
      '3. 设置 userHint（显示在支付 UI 中的提示）：\n' +
      "   pm.userHint = '**** 4242';\n\n" +
      '4. 启用委托能力（让 Payment Handler 提供地址 / 联系人）：\n' +
      "   await pm.enableDelegations(['shippingAddress', 'payerName']);\n\n" +
      'PaymentManager / PaymentInstruments 字段：\n' +
      '  paymentManager.instruments → PaymentInstruments（set / delete / clear / keys / has）\n' +
      '  paymentManager.userHint —— 支付 UI 提示文本\n' +
      '  paymentManager.enableDelegations(["shippingAddress","payerName","payerEmail","payerPhone"])\n\n' +
      `当前环境：serviceWorker=${caps.serviceWorker ? '可用' : '不可用'}, PaymentManager=${caps.paymentManager ? '可用' : '不可用'}, PaymentInstruments=${caps.paymentInstruments ? '可用' : '不可用'}。\n` +
      '说明：jsdom 无 SW 注册能力（需真实浏览器 + HTTPS），上面为代码路径说明。' });
    this._addLog('handler', `Payment Handler 流程说明（SW=${caps.serviceWorker}, PaymentManager=${caps.paymentManager}）`);
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Payment Handler API',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.serviceWorker ? 'success' : 'error' }, caps.serviceWorker ? 'serviceWorker ✓' : 'serviceWorker ✗'),
        h(Tag, { color: caps.paymentManager ? 'success' : 'error' }, caps.paymentManager ? 'PaymentManager ✓' : 'PaymentManager ✗'),
        h(Tag, { color: 'primary' }, 'instruments / userHint / enableDelegations'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Payment Handler API 让网站通过 ServiceWorker 注册自定义支付方式：navigator.serviceWorker.register 注册 SW，reg.paymentManager 获取 PaymentManager。instruments.set(key, { name, icons }) 注册支付工具（icons 为 [{ src, sizes, type }]）；paymentManager.userHint 设置支付 UI 提示；paymentManager.enableDelegations(["shippingAddress","payerName"]) 让支付处理程序提供地址 / 联系人。SW 内监听 paymentrequest 事件处理支付。jsdom 无 SW，仅记录代码路径。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('Payment Handler 流程', { type: 'primary', size: 'sm', onClick: () => this._explainPaymentHandler() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Payment Handler API 用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.paymentHandlerInfo || '（点击「Payment Handler 流程」）')),
        h(Alert, {
          type: 'info',
          message: 'Payment Handler 让任意网站成为支付方式',
          description: '相比 basic-card（仅限银行卡），Payment Handler API 让任意网站（如支付宝、微信、银行 App）注册为支付方式：SW 拦截 paymentrequest 事件，打开自家支付窗口处理。instruments.set 注册的工具会出现在浏览器原生支付 UI 中。需 HTTPS + SW 支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：FedCM 联合身份 ===================

  // 检测 navigator.credentials 与 identity 支持，记录请求 payload JSON
  _demoFedcm() {
    const caps = this._caps();
    // 检测 'identity' in credopts 支持（运行时无法直接探测，用 IdentityCredential 间接判断）
    const fedcmSupported = caps.identityCredential && caps.credentials;
    const samplePayload = {
      identity: {
        mode: 'widget',                    // 'widget' | 'button'
        context: 'use',                     // 'use' | 'continue' | 'sign-in'
        providers: [
          {
            clientId: 'rp-client-001',
            configURL: 'https://idp.example.com/config.json',
            nonce: 'nonce-' + Math.random().toString(36).slice(2, 10),
            loginHint: 'demo@lab.local',
            accountHint: 'demo@lab.local',
            requestParams: { scope: 'openid email profile' },
            fields: ['name', 'email', 'picture'],
          },
        ],
      },
      mediation: 'optional',
      context: 'use',
      loginHint: 'demo@lab.local',
      accountHint: 'demo@lab.local',
      disclosureTextShown: true,
    };
    this.setState({ fedcmInfo:
      'FedCM 能力检测：\n' +
      `  typeof navigator.credentials.get === 'function'：${caps.credentials ? '是' : '否'}\n` +
      `  'IdentityCredential' in window：${caps.identityCredential ? '是' : '否'}\n` +
      `  'IdentityProvider' in window：${caps.identityProvider ? '是' : '否'}\n` +
      `  FedCM 整体支持（推断）：${fedcmSupported ? '可用' : '不可用（需 IdentityCredential + credentials.get）'}\n\n` +
      'navigator.credentials.get({ identity }) 请求 payload（would-be）：\n' +
      JSON.stringify(samplePayload, null, 2) + '\n\n' +
      'IdentityCredential 返回字段（成功时）：\n' +
      '  token     —— IdP 签发的令牌（RP 用来识别用户）\n' +
      '  id        —— 用户标识（部分实现）\n' +
      '  configURL —— 使用的 IdP 配置文件 URL\n\n' +
      '参数说明：\n' +
      "  mode: 'widget' | 'button' —— widget 为浏览器原生弹窗，button 为 IdP 自定义按钮\n" +
      "  context: 'use' | 'continue' | 'sign-in' —— 上下文提示文案\n" +
      '  providers: [{ clientId, configURL, nonce, loginHint, accountHint, requestParams, fields }]\n' +
      '  disclosureTextShown: 是否显示披露文案\n\n' +
      '说明：' + (fedcmSupported
        ? '当前环境检测到 FedCM 能力，可调用 navigator.credentials.get({ identity }) 弹原生 IdP 登录 UI。'
        : '当前环境不支持 FedCM（IdentityCredential / credentials.get 不可用）。需真实浏览器 + HTTPS + 真实 IdP 配置文件。') });
    this._addLog('fedcm', `FedCM 检测：credentials=${caps.credentials}, IdentityCredential=${caps.identityCredential}，已记录 payload JSON`);
    if (!fedcmSupported) this._addLog('warn', 'FedCM 不可用（需 IdentityCredential + navigator.credentials.get + HTTPS）');
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. FedCM 联合身份',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.credentials ? 'success' : 'error' }, caps.credentials ? 'credentials.get ✓' : 'credentials.get ✗'),
        h(Tag, { color: caps.identityCredential ? 'success' : 'error' }, caps.identityCredential ? 'IdentityCredential ✓' : 'IdentityCredential ✗'),
        h(Tag, { color: 'warning' }, '实验性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'FedCM（Federated Credential Management）提供浏览器原生 IdP 联合登录 UI，替代第三方 Cookie 实现隐私友好的联合登录：navigator.credentials.get({ identity: { providers, mode, context } })。mode 取 widget（浏览器原生弹窗）或 button（IdP 自定义按钮）；context 取 use / continue / sign-in。providers 含 clientId / configURL / nonce / loginHint / accountHint / requestParams / fields。返回 IdentityCredential（token / id / configURL）。需 HTTPS + 真实 IdP 配置文件。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 FedCM 并记录 payload', { type: 'primary', size: 'sm', onClick: () => this._demoFedcm() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'FedCM 能力检测与请求 payload：'),
        h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.fedcmInfo || '（点击「检测 FedCM 并记录 payload」）')),
        h(Alert, {
          type: 'info',
          message: 'FedCM 替代第三方 Cookie 实现联合登录',
          description: '传统联合登录（OAuth with redirect）依赖第三方 Cookie 追踪用户，隐私差。FedCM 由浏览器居中调停：浏览器请求 IdP 配置文件、显示账户选择 UI、获取 token，IdP 与 RP 之间不直接共享 Cookie。mode=widget 用浏览器 UI，mode=button 让 IdP 自定义按钮（较新）。需 HTTPS 与真实 IdP 配置文件。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：Identity Provider Config & Manifest ===================

  // 展示 IdP 配置文件示例
  _showManifest() {
    const manifest = {
      accounts: { endpoint: '/accounts.json' },
      client_metadata: { endpoint: '/client-metadata.json' },
      id_assertion_endpoint: '/assertion.json',
      disconnect_endpoint: '/disconnect.json',
      login_url: 'https://idp.example.com/login',
      brands: [
        { name: '示例 IdP', icon: 'https://idp.example.com/icon.png' },
      ],
      account_icon: 'https://idp.example.com/account-icon.png',
    };
    const accountsResponse = [
      { id: 'user-001', name: '演示用户', email: 'demo@lab.local',
        given_name: '演示', picture: 'https://idp.example.com/avatar.png',
        approved_clients: ['rp-client-001', 'rp-client-002'] },
    ];
    const assertionResponse = { token: 'jwt-or-opaque-token-here', continueOn: '/continue' };
    this.setState({ idpConfigInfo:
      'IdP 配置文件结构（well-known，托管在 IdP 域名 configURL）：\n' +
      JSON.stringify(manifest, null, 2) + '\n\n' +
      '字段说明：\n' +
      '  accounts.endpoint           —— 返回用户账户列表的端点\n' +
      '  client_metadata.endpoint    —— 返回 RP 客户端元数据（图标、名称等）\n' +
      '  id_assertion_endpoint       —— 签发 token 的端点（核心）\n' +
      '  disconnect_endpoint         —— 断开 RP 与 IdP 关联的端点\n' +
      '  login_url                   —— IdP 登录页 URL（用户未登录时跳转）\n' +
      '  brands: [{ name, icon }]    —— IdP 品牌信息（显示在账户选择 UI）\n' +
      '  account_icon                —— 账户默认图标\n\n' +
      'accounts_endpoint 返回（账户列表）：\n' +
      JSON.stringify(accountsResponse, null, 2) + '\n\n' +
      '账户字段：id / name / email / given_name / picture / approved_clients\n\n' +
      'id_assertion_endpoint 返回（token 签发）：\n' +
      JSON.stringify(assertionResponse, null, 2) + '\n\n' +
      '返回字段：token（IdP 签发的令牌，RP 验证用）、continueOn（继续 URL，可选）' });
    this._addLog('idp', '已展示 IdP 配置文件 / accounts / assertion 响应示例');
  }

  // 解释浏览器 → IdP → RP 流程
  _explainFlow() {
    this.setState({ idpConfigInfo:
      'FedCM 浏览器 → IdP → RP 流程：\n\n' +
      '1. RP 调用 navigator.credentials.get({ identity: { providers: [{ configURL, clientId, ... }] } })\n' +
      '2. 浏览器请求 configURL 获取 IdP 配置文件（manifest）\n' +
      '3. 浏览器请求 accounts.endpoint（带 SameSite=Lax Cookie）获取用户账户列表\n' +
      '   —— Cookie 仅在 IdP 域内传递，不暴露给 RP（隐私核心）\n' +
      '4. 若用户未登录 IdP（accounts 为空）→ 浏览器显示「登录 IdP」按钮，跳转 login_url\n' +
      '5. 浏览器显示账户选择 UI（mode=widget 时原生弹窗），含 IdP brands 图标\n' +
      '6. 用户选择账户 → 浏览器请求 client_metadata.endpoint（获取 RP 元数据，显示披露文案）\n' +
      '7. 浏览器请求 id_assertion_endpoint，带 clientId / nonce / account id / disclosure\n' +
      '8. IdP 签发 token，返回 { token, continueOn }\n' +
      '9. 浏览器把 IdentityCredential（含 token）返回给 RP\n' +
      '10. RP 用 token 向自己后端登录（后端验证 token 完成会话建立）\n\n' +
      '隐私要点：\n' +
      '• IdP Cookie 仅在 IdP 域请求中传递（SameSite=Lax），RP 看不到\n' +
      '• 浏览器居中调停，IdP 不知 RP 在何时请求（除非用户选择账户）\n' +
      '• disclosureTextShown 控制是否显示披露文案（向用户说明 RP 将获取哪些字段）\n' +
      '• fields 字段（name/email/picture）控制 RP 可获取的用户信息\n\n' +
      '对比传统 OAuth：传统联合登录用 redirect + 第三方 Cookie，IdP 能在 RP 站点追踪用户；\n' +
      'FedCM 用浏览器居中，IdP 与 RP 不直接共享 Cookie，隐私更友好。' });
    this._addLog('idp', '已解释 FedCM 浏览器→IdP→RP 流程（10 步）与隐私要点');
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. Identity Provider Config & Manifest',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'configURL / accounts / id_assertion'),
        h(Tag, { color: 'warning' }, 'IdP 托管'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'IdP 配置文件（manifest）托管在 IdP 域名 configURL，含 accounts.endpoint（账户列表）、client_metadata.endpoint（RP 元数据）、id_assertion_endpoint（token 签发）、disconnect_endpoint、login_url、brands（品牌图标）、account_icon。accounts_endpoint 返回 [{ id, name, email, given_name, picture, approved_clients }]；id_assertion_endpoint 返回 { token, continueOn }。浏览器请求 configURL → accounts → 显示账户选择 UI → 用户选账户 → id_assertion 签发 token → 返回 IdentityCredential 给 RP。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示配置文件示例', { type: 'primary', size: 'sm', onClick: () => this._showManifest() }),
          this._btn('解释浏览器→IdP→RP 流程', { size: 'sm', onClick: () => this._explainFlow() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'IdP 配置文件 / 流程说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '400px', overflow: 'auto' } },
          h('code', {}, s.idpConfigInfo || '（点击「展示配置文件示例」或「解释流程」）')),
        h(Alert, {
          type: 'warning',
          message: 'IdP 配置文件需托管在 IdP 域名根或 well-known 路径',
          description: 'configURL 指向 IdP 配置文件（JSON），浏览器跨域请求（带 CORS）。accounts.endpoint 用 SameSite=Lax Cookie 识别已登录用户。id_assertion_endpoint 是核心 —— 签发 token 给 RP。生产环境需 HTTPS、CORS、SameSite Cookie 配置正确，且 IdP 实现 accounts / assertion / disconnect 等端点。',
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
    return h('div', { class: 'api-lab-page payment-fedcm-page' },
      h('h2', { class: 'section-title' }, '支付请求与 FedCM 联合身份 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'Payment Request API 提供浏览器原生支付 UI；FedCM 提供原生 IdP 联合登录 UI，替代第三方 Cookie。本页演示 PaymentRequest 三段构造、show/abort/retry 流程、PaymentMethodChangeEvent / PaymentRequestUpdateEvent 事件、Payment Handler API、FedCM 与 IdP 配置文件结构。'),
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
