// =====================================================================
// ReportingTrustedTypesPage.js —— Reporting API / Trusted Types / 跨源隔离 实验室
// 演示 MDN：
//   1. ReportingObserver —— 网站错误/废弃/干预/CSP 违规报告收集
//      new ReportingObserver(callback, options) / observe / disconnect / takeRecords
//      Report 对象：type / url / body / toJSON()；四种 body：Deprecation/Intervention/Crash/CSP
//      服务端配置：Report-To HTTP 头，经 sendBeacon / fetch POST 上报
//   2. Trusted Types API —— 防止 DOM XSS
//      trustedTypes.createPolicy(name, { createHTML / createScript / createScriptURL })
//      → TrustedHTML / TrustedScript / TrustedScriptURL；defaultPolicy / emptyHTML / emptyScript
//      getAttributeType / getPropertyType；CSP: require-trusted-types-for 'script'
//   3. 跨源隔离策略 —— COOP / COEP / CORP / CORB
//      self.crossOriginIsolated / SharedArrayBuffer / performance.measureUserAgentSpecificMemory
//   4. Speculation Rules API —— 预取 / 预渲染
//      <script type="speculationrules"> / prefetch / prerender / eagerness / href_matches
//      document.prerendering / prerenderingchange 事件
//   5. Referrer Policy —— document.referrer / 8 种 Referrer-Policy 值
// 说明：ReportingObserver 与 trustedTypes 在 jsdom 中均为 undefined，所有 API 调用前做
//       typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//       真实完整演示需在 HTTPS 浏览器中并配置对应 HTTP 响应头。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 模拟恶意 HTML 字符串：包含 onerror 事件注入与 <script> 标签（典型 DOM XSS 载荷）
const MALICIOUS_HTML = '<img src="x" onerror="alert(1)"><script>document.cookie</script>';

// 模拟恶意脚本字符串（含 alert 调用）
const MALICIOUS_SCRIPT = "alert('XSS via eval')";

// 模拟恶意跨源脚本 URL
const MALICIOUS_SCRIPT_URL = 'https://evil.example.com/inject.js';

// 8 种 Referrer-Policy 值及其说明（含默认值标注）
const REFERRER_POLICIES = [
  { value: 'no-referrer', desc: '不发送任何 Referer 头' },
  { value: 'no-referrer-when-downgrade', desc: 'HTTPS→HTTP 降级时不发送（旧默认行为）' },
  { value: 'same-origin', desc: '仅同源请求发送完整 Referer，跨源不发送' },
  { value: 'origin', desc: '仅发送源（协议+主机+端口），不含路径' },
  { value: 'strict-origin', desc: '仅发送源，且降级时不发送' },
  { value: 'origin-when-cross-origin', desc: '同源发完整，跨源仅发源' },
  { value: 'strict-origin-when-cross-origin', desc: '同源完整、跨源仅源、降级不发（现代默认）' },
  { value: 'unsafe-url', desc: '始终发送完整 URL（含凭据信息，不安全）' },
];

// 安全过滤函数：从 HTML 中剥离 <script> 标签与 on* 事件属性
// 实际生产中应使用 DOMPurify 等成熟库，此处仅作教学演示
function sanitizeHTML(input) {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

export class ReportingTrustedTypesPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：ReportingObserver
      reportingInfo: '',
      // Card 2：Trusted Types createPolicy
      policyInfo: '',
      // Card 3：Trusted Types 防注入演示
      injectionInfo: '',
      // Card 4：跨源隔离检测
      isolationInfo: '',
      // Card 5：Speculation Rules
      speculationInfo: '',
      // Card 6：Referrer Policy
      referrerInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._reportingObserver = null;  // Card 1 ReportingObserver 实例
    this._policy = null;             // Card 2 TrustedTypePolicy 实例
    this._injectedScript = null;     // Card 5 动态创建的 speculationrules script

    // 一次性能力检测
    const caps = this._caps();
    const parts = [
      `ReportingObserver ${caps.reporting ? '✓' : '✗'}`,
      `trustedTypes ${caps.trustedTypes ? '✓' : '✗'}`,
      `crossOriginIsolated ${typeof self !== 'undefined' && typeof self.crossOriginIsolated === 'boolean' ? '✓' : '✗'}`,
      `sendBeacon ${caps.sendBeacon ? '✓' : '✗'}`,
      `prerendering ${caps.prerendering ? '✓' : '✗'}`,
      `measureUserAgentSpecificMemory ${caps.measureMemory ? '✓' : '✗'}`,
      `SharedArrayBuffer ${caps.sharedArrayBuffer ? '✓' : '✗'}`,
      `fetch ${caps.fetch ? '✓' : '✗'}`,
    ];

    const summary = `Reporting / TrustedTypes / 跨源隔离 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）多数 API 不可用，仅记日志说明；在真实 HTTPS 浏览器中并配置对应 HTTP 头后可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(caps.reporting ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.reporting) this._addLog('warn', 'ReportingObserver 不可用（需真实浏览器，jsdom 未实现）');
    if (!caps.trustedTypes) this._addLog('warn', 'trustedTypes 不可用（需真实浏览器 + CSP 配置，jsdom 未实现）');
    if (!(typeof self !== 'undefined' && typeof self.crossOriginIsolated === 'boolean')) this._addLog('warn', 'self.crossOriginIsolated 不可用（需 COOP+COEP 头，jsdom 中为 undefined）');
    if (!caps.measureMemory) this._addLog('warn', 'performance.measureUserAgentSpecificMemory 不可用（需 crossOriginIsolated 环境）');
  }

  componentWillUnmount() {
    // 释放 ReportingObserver：调用 disconnect() 停止观察
    if (this._reportingObserver && typeof this._reportingObserver.disconnect === 'function') {
      try { this._reportingObserver.disconnect(); } catch { /* noop */ }
    }
    this._reportingObserver = null;
    this._policy = null;
    // 移除动态注入的 speculationrules script
    if (this._injectedScript && this._injectedScript.parentNode) {
      try { this._injectedScript.parentNode.removeChild(this._injectedScript); } catch { /* noop */ }
    }
    this._injectedScript = null;
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
    const hasTT = typeof trustedTypes !== 'undefined' ||
      (typeof window !== 'undefined' && typeof window.trustedTypes !== 'undefined');
    const hasDoc = typeof document !== 'undefined';
    return {
      reporting: typeof ReportingObserver !== 'undefined',
      trustedTypes: hasTT,
      crossOriginIsolated: typeof self !== 'undefined' && self.crossOriginIsolated === true,
      sendBeacon: typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function',
      prerendering: hasDoc && typeof document.prerendering === 'boolean',
      measureMemory: typeof performance !== 'undefined' && typeof performance.measureUserAgentSpecificMemory === 'function',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      fetch: typeof fetch === 'function',
    };
  }

  // 获取 trustedTypes 对象（统一入口，处理全局 trustedTypes 与 window.trustedTypes）
  _getTT() {
    if (typeof trustedTypes !== 'undefined') return trustedTypes;
    if (typeof window !== 'undefined' && typeof window.trustedTypes !== 'undefined') return window.trustedTypes;
    return null;
  }

  // =================== Card 1：ReportingObserver ===================

  // new ReportingObserver(callback, options) → observer
  // options.types: ['deprecation', 'intervention', 'crash', 'csp-violation']
  // options.buffered: boolean —— 是否报告历史缓冲的报告
  _createObserver() {
    if (!this._caps().reporting) {
      this._addLog('warn', 'ReportingObserver 不可用：测试环境不支持，需真实浏览器 + Report-To HTTP 头配置');
      return;
    }
    try {
      const callback = (reports, observer) => {
        for (const report of reports) {
          this._addLog('report', `收到报告 type=${report.type}，url=${report.url}`);
        }
      };
      const observer = new ReportingObserver(callback, {
        types: ['deprecation', 'intervention', 'crash', 'csp-violation'],
        buffered: true,
      });
      this._reportingObserver = observer;
      this.setState({
        reportingInfo:
          `new ReportingObserver(callback, options) → observer ✓\n` +
          `options.types = ['deprecation', 'intervention', 'crash', 'csp-violation']，buffered = true（报告历史缓冲的报告）\n` +
          `说明：callback(reports, observer) 在每批报告产生时被调用，reports 为 Report[]。Report 对象字段：type / url / body / toJSON()。`,
      });
      this._addLog('observer', `已创建 ReportingObserver：types=4 种，buffered=true`);
    } catch (err) {
      this._addLog('warn', `创建 ReportingObserver 失败：${err.name} - ${err.message}`);
    }
  }

  // observer.observe() —— 开始观察
  _observeReports() {
    if (!this._caps().reporting) {
      this._addLog('warn', 'ReportingObserver 不可用：测试环境不支持，需真实浏览器');
      return;
    }
    if (!this._reportingObserver) {
      this._addLog('warn', '请先点击「创建 Observer」');
      return;
    }
    try {
      this._reportingObserver.observe();
      this.setState({ reportingInfo:
          `observer.observe() —— 开始观察报告 ✓\n` +
          `说明：observe() 后浏览器持续收集已配置 types 的报告，通过 callback 异步派发。需配合服务端 Report-To 头配置端点：{ "group": "default", "max_age": 86400, "endpoints": [...] }` });
      this._addLog('observe', `observer.observe() 已调用，开始收集报告`);
    } catch (err) {
      this._addLog('warn', `observe 失败：${err.name} - ${err.message}`);
    }
  }

  // observer.takeRecords() → Report[]：取出未处理的报告
  _takeRecords() {
    if (!this._caps().reporting) {
      this._addLog('warn', 'ReportingObserver 不可用：测试环境不支持，需真实浏览器');
      return;
    }
    if (!this._reportingObserver) {
      this._addLog('warn', '请先点击「创建 Observer」');
      return;
    }
    try {
      const reports = this._reportingObserver.takeRecords();
      const lines = [];
      lines.push(`observer.takeRecords() → Report[]（取出未处理的报告），本次取出：${reports.length} 条`);
      for (const report of reports) {
        lines.push(`\n--- Report ---`);
        lines.push(`type = ${report.type}，url = ${report.url}`);
        const body = report.body || {};
        if (report.type === 'deprecation') {
          lines.push(`body: id=${body.id}, message=${body.message}, sourceFile=${body.sourceFile}, line=${body.lineNumber}, col=${body.columnNumber}`);
          lines.push(`      anticipatedRemoval=${body.anticipatedRemoval}`);
        } else if (report.type === 'intervention') {
          lines.push(`body: id=${body.id}, message=${body.message}, sourceFile=${body.sourceFile}, line=${body.lineNumber}, col=${body.columnNumber}`);
        } else if (report.type === 'crash') {
          lines.push(`body: crashId=${body.crashId}, reason=${body.reason}`);
        } else if (report.type === 'csp-violation') {
          lines.push(`body: blockedURL=${body.blockedURL}, directive=${body.directive}, line=${body.lineNumber}, col=${body.columnNumber}`);
        }
        if (typeof report.toJSON === 'function') {
          lines.push(`toJSON() = ${JSON.stringify(report.toJSON())}`);
        }
      }
      this.setState({ reportingInfo: lines.join('\n') });
      this._addLog('records', `takeRecords() 取出 ${reports.length} 条报告`);
    } catch (err) {
      this._addLog('warn', `takeRecords 失败：${err.name} - ${err.message}`);
    }
  }

  // observer.disconnect() —— 停止观察
  _disconnectObserver() {
    if (!this._caps().reporting) {
      this._addLog('warn', 'ReportingObserver 不可用：测试环境不支持，需真实浏览器');
      return;
    }
    if (!this._reportingObserver) {
      this._addLog('warn', '请先点击「创建 Observer」');
      return;
    }
    try {
      this._reportingObserver.disconnect();
      this.setState({ reportingInfo:
          `observer.disconnect() —— 停止观察 ✓\n` +
          `说明：disconnect() 后不再收集新报告；已缓冲的报告仍可通过 takeRecords() 取出。报告通过 navigator.sendBeacon() 或 fetch POST 发送到 Report-To 配置的端点。` });
      this._addLog('disconnect', `observer.disconnect() 已调用，停止收集`);
    } catch (err) {
      this._addLog('warn', `disconnect 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. ReportingObserver —— 网站错误报告收集',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.reporting ? 'success' : 'error' }, caps.reporting ? 'ReportingObserver ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'deprecation / intervention / crash / csp-violation'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new ReportingObserver(callback, options) 创建报告观察器；options.types 指定监听的报告类型（deprecation 废弃特性 / intervention 浏览器干预 / crash 崩溃 / csp-violation CSP 违规）；options.buffered: true 报告历史缓冲的报告。observer.observe() 开始观察；observer.takeRecords() 取出未处理的 Report[]；observer.disconnect() 停止观察。Report 对象含 type / url / body / toJSON()。服务端通过 Report-To HTTP 头配置端点，报告经 sendBeacon 或 fetch POST 上报。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Observer', { type: 'primary', size: 'sm', disabled: !caps.reporting, onClick: () => this._createObserver() }),
          this._btn('observe', { type: 'primary', size: 'sm', disabled: !caps.reporting, onClick: () => this._observeReports() }),
          this._btn('takeRecords', { size: 'sm', disabled: !caps.reporting, onClick: () => this._takeRecords() }),
          this._btn('disconnect', { danger: true, size: 'sm', disabled: !caps.reporting, onClick: () => this._disconnectObserver() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Observer 状态与报告内容：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.reportingInfo || '（点击「创建 Observer」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const observer = new ReportingObserver((reports) => {
  for (const r of reports) console.log(r.type, r.url, r.body);
}, { types: ['deprecation', 'intervention', 'crash', 'csp-violation'], buffered: true });
observer.observe();
const pending = observer.takeRecords(); // 取出未处理报告
observer.disconnect();                   // 停止观察
// 服务端：Report-To: {"group":"default","max_age":86400,"endpoints":[...]}`)),
        h(Alert, {
          type: 'info',
          message: '四种报告类型对应不同的 body 结构',
          description: 'DeprecationReportBody：id/message/sourceFile/lineNumber/columnNumber/anticipatedRemoval；InterventionReportBody：id/message/sourceFile/lineNumber/columnNumber；CrashReportBody：crashId/reason；CSPReportBody：blockedURL/lineNumber/columnNumber/directive。所有 Report 均有 toJSON() 方法。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Trusted Types createPolicy ===================

  // trustedTypes.createPolicy(policyName, policyOptions) → TrustedTypePolicy
  // policyOptions.createHTML / createScript / createScriptURL：过滤回调，返回安全字符串
  _createPolicy() {
    const tt = this._getTT();
    if (!tt) {
      this._addLog('warn', 'trustedTypes 不可用：测试环境不支持，需真实浏览器 + CSP 配置（require-trusted-types-for \'script\'）');
      return;
    }
    try {
      const policy = tt.createPolicy('my-policy', {
        createHTML: (input) => sanitizeHTML(input),
        createScript: (input) => input.replace(/alert/g, 'console.log'),
        createScriptURL: (input) => {
          // 仅允许同源脚本 URL
          try {
            const u = new URL(input, location.href);
            if (u.origin === location.origin) return input;
            return '';
          } catch {
            return '';
          }
        },
      });
      this._policy = policy;
      const hasDefault = typeof tt.defaultPolicy !== 'undefined' && tt.defaultPolicy !== null;
      this.setState({
        policyInfo:
          `trustedTypes.createPolicy('my-policy', policyOptions) → TrustedTypePolicy ✓\n` +
          `createHTML = (input) => sanitizeHTML(input)（剥离 <script> 与 on* 事件）\n` +
          `createScript = (input) => input.replace(/alert/g, 'console.log')\n` +
          `createScriptURL = (input) => 仅允许同源 URL\n` +
          `trustedTypes.defaultPolicy = ${hasDefault ? '已设置' : 'null（未配置默认策略）'}\n` +
          `说明：createHTML/Script/ScriptURL 返回 TrustedHTML/Script/ScriptURL，可赋值给 innerHTML / eval / script.src，普通字符串将被 CSP 拦截。`,
      });
      this._addLog('policy', `已创建 TrustedTypePolicy：name=my-policy，含 createHTML/Script/ScriptURL`);
    } catch (err) {
      this._addLog('warn', `创建 policy 失败：${err.name} - ${err.message}`);
    }
  }

  // policy.createHTML(input) → TrustedHTML：过滤后返回安全 HTML
  _createHTML() {
    const tt = this._getTT();
    if (!tt) {
      this._addLog('warn', 'trustedTypes 不可用：测试环境不支持，需真实浏览器 + CSP 配置');
      return;
    }
    if (!this._policy) {
      this._addLog('warn', '请先点击「创建 Policy」');
      return;
    }
    try {
      const raw = MALICIOUS_HTML;
      const trusted = this._policy.createHTML(raw);
      this.setState({
        policyInfo:
          `policy.createHTML(input) → TrustedHTML\n` +
          `输入（恶意）：${raw}\n过滤后（TrustedHTML）：${trusted}\n` +
          `说明：createHTML 回调剥离 <script> 与 onerror；返回的 TrustedHTML 可安全赋值给 innerHTML（require-trusted-types-for 'script' 下）。对比：直接 innerHTML = raw 会被 CSP 拦截并抛 TypeError。`,
      });
      this._addLog('html', `createHTML 过滤：剥离 <script> 与 on* 事件，返回 TrustedHTML`);
    } catch (err) {
      this._addLog('warn', `createHTML 失败：${err.name} - ${err.message}`);
    }
  }

  // policy.createScript(input) → TrustedScript
  _createScript() {
    const tt = this._getTT();
    if (!tt) {
      this._addLog('warn', 'trustedTypes 不可用：测试环境不支持，需真实浏览器 + CSP 配置');
      return;
    }
    if (!this._policy) {
      this._addLog('warn', '请先点击「创建 Policy」');
      return;
    }
    try {
      const raw = MALICIOUS_SCRIPT;
      const trusted = this._policy.createScript(raw);
      this.setState({
        policyInfo:
          `policy.createScript(input) → TrustedScript\n` +
          `输入（含 alert）：${raw}\n过滤后（TrustedScript）：${trusted}（alert → console.log）\n` +
          `说明：返回的 TrustedScript 可传给 eval() / new Function() / setTimeout(string) 等；普通字符串在 require-trusted-types-for 'script' 下会被拦截。`,
      });
      this._addLog('script', `createScript 过滤：alert → console.log，返回 TrustedScript`);
    } catch (err) {
      this._addLog('warn', `createScript 失败：${err.name} - ${err.message}`);
    }
  }

  // policy.createScriptURL(input) → TrustedScriptURL
  _createScriptURL() {
    const tt = this._getTT();
    if (!tt) {
      this._addLog('warn', 'trustedTypes 不可用：测试环境不支持，需真实浏览器 + CSP 配置');
      return;
    }
    if (!this._policy) {
      this._addLog('warn', '请先点击「创建 Policy」');
      return;
    }
    try {
      const raw = MALICIOUS_SCRIPT_URL;
      const trusted = this._policy.createScriptURL(raw);
      this.setState({
        policyInfo:
          `policy.createScriptURL(input) → TrustedScriptURL\n` +
          `输入（跨源恶意 URL）：${raw}\n过滤后（TrustedScriptURL）：${trusted === '' ? '（空字符串，跨源被拒）' : trusted}\n` +
          `说明：createScriptURL 回调仅允许同源 URL，跨源返回空串；返回的 TrustedScriptURL 可赋值给 script.src。`,
      });
      this._addLog('url', `createScriptURL 过滤：跨源 URL 被拒，返回 TrustedScriptURL`);
    } catch (err) {
      this._addLog('warn', `createScriptURL 失败：${err.name} - ${err.message}`);
    }
  }

  // trustedTypes.getAttributeType(tagName, attribute) / getPropertyType(tagName, property)
  _getAttributeType() {
    const tt = this._getTT();
    if (!tt) {
      this._addLog('warn', 'trustedTypes 不可用：测试环境不支持，需真实浏览器 + CSP 配置');
      return;
    }
    try {
      const checks = [
        ['div', 'innerHTML', 'getPropertyType'],
        ['iframe', 'srcdoc', 'getPropertyType'],
        ['script', 'src', 'getPropertyType'],
        ['script', 'src', 'getAttributeType'],
        ['div', 'onclick', 'getAttributeType'],
      ];
      const lines = ['trustedTypes.getAttributeType / getPropertyType —— 查询属性所需的 Trusted 类型'];
      for (const [tag, attr, method] of checks) {
        let result;
        try {
          result = method === 'getPropertyType' ? tt.getPropertyType(tag, attr) : tt.getAttributeType(tag, attr);
        } catch (e) {
          result = `（查询失败：${e.message}）`;
        }
        lines.push(`${method}('${tag}', '${attr}') = ${result == null ? 'null' : `'${result}'`}`);
      }
      lines.push(`\n说明：返回值 ∈ 'TrustedHTML' | 'TrustedScript' | 'TrustedScriptURL' | null；`);
      lines.push(`null 表示该属性不需要 Trusted 类型包装。`);
      this.setState({ policyInfo: lines.join('\n') });
      this._addLog('attr', `getAttributeType/getPropertyType 查询完成（5 项）`);
    } catch (err) {
      this._addLog('warn', `getAttributeType 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Trusted Types —— createPolicy / createHTML / createScript / createScriptURL',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.trustedTypes ? 'success' : 'error' }, caps.trustedTypes ? 'trustedTypes ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'TrustedHTML / Script / ScriptURL'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'trustedTypes.createPolicy(policyName, policyOptions) 创建策略；policyOptions 提供 createHTML / createScript / createScriptURL 三个过滤回调，分别返回 TrustedHTML / TrustedScript / TrustedScriptURL。policy.createHTML(input) 过滤 HTML（剥离 script/事件）；policy.createScript(input) 过滤脚本；policy.createScriptURL(input) 过滤脚本 URL。trustedTypes.defaultPolicy 为默认策略；trustedTypes.emptyHTML / emptyScript 为空值常量。CSP 配置 Content-Security-Policy: require-trusted-types-for \'script\' 后，innerHTML = 普通字符串会抛异常，必须用 policy.createHTML() 包装。getAttributeType / getPropertyType 查询属性所需的 Trusted 类型。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Policy', { type: 'primary', size: 'sm', disabled: !caps.trustedTypes, onClick: () => this._createPolicy() }),
          this._btn('createHTML', { type: 'primary', size: 'sm', disabled: !caps.trustedTypes, onClick: () => this._createHTML() }),
          this._btn('createScript', { size: 'sm', disabled: !caps.trustedTypes, onClick: () => this._createScript() }),
          this._btn('createScriptURL', { size: 'sm', disabled: !caps.trustedTypes, onClick: () => this._createScriptURL() }),
          this._btn('getAttributeType', { size: 'sm', disabled: !caps.trustedTypes, onClick: () => this._getAttributeType() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Policy 操作结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.policyInfo || '（点击「创建 Policy」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const policy = trustedTypes.createPolicy('my-policy', {
  createHTML: (s) => DOMPurify.sanitize(s),     // → TrustedHTML
  createScript: (s) => s,                        // → TrustedScript
  createScriptURL: (s) => s,                     // → TrustedScriptURL
});
el.innerHTML = policy.createHTML(untrusted);     // 安全
// el.innerHTML = untrusted;                     // CSP 下抛 TypeError
trustedTypes.getAttributeType('div', 'innerHTML'); // 'TrustedHTML'`)),
        h(Alert, {
          type: 'warning',
          message: 'require-trusted-types-for \'script\' 是防御 DOM XSS 的关键',
          description: '配置该 CSP 后，所有 DOM 注入点（innerHTML / outerHTML / insertAdjacentHTML / document.write / eval / setTimeout(string) / script.src 等）只接受 Trusted* 类型，强制开发者通过 policy 过滤，从根源消除 DOM XSS。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Trusted Types 防注入演示 ===================

  // 对比：直接 innerHTML = 恶意字符串（CSP 下会被拦截）vs policy.createHTML(恶意字符串)（安全）
  _unsafeInject() {
    const tt = this._getTT();
    if (!tt) {
      // 测试环境无 trustedTypes，innerHTML 不受 CSP 限制，仍可注入（演示对比）
      try {
        const div = document.createElement('div');
        div.innerHTML = MALICIOUS_HTML;
        const hasScript = div.querySelectorAll('script').length;
        const hasOnError = div.querySelector('[onerror]') !== null;
        this.setState({
          injectionInfo:
            `[对比演示 - 不安全注入] element.innerHTML = MALICIOUS_HTML\n` +
            `恶意字符串：${MALICIOUS_HTML}\n` +
            `注入后 DOM 含 <script>：${hasScript > 0}（${hasScript} 个），含 onerror：${hasOnError}\n` +
            `说明：真实浏览器 + require-trusted-types-for 'script' CSP 下会抛 TypeError："Refused to assign to 'innerHTML' because it requires TrustedHTML."\n` +
            `当前测试环境（jsdom）无 CSP 强制，注入未拦截（仅教学演示对比）。`,
        });
        this._addLog('warn', `不安全注入演示：注入 ${hasScript} 个 <script> + onerror=${hasOnError}（真实 CSP 下会被拦截）`);
      } catch (err) {
        this._addLog('warn', `不安全注入被拦截（CSP 生效）：${err.name} - ${err.message}`);
        this.setState({ injectionInfo: `[不安全注入被 CSP 拦截] ${err.name}: ${err.message}\n说明：require-trusted-types-for 'script' 已生效，innerHTML = 普通字符串被拒绝。` });
      }
      return;
    }
    // 真实浏览器 + trustedTypes：直接 innerHTML = 普通字符串应抛异常
    try {
      const div = document.createElement('div');
      div.innerHTML = MALICIOUS_HTML;
      this._addLog('warn', `不安全注入未拦截（意外，CSP 未配置 require-trusted-types-for?）`);
      this.setState({ injectionInfo: `[不安全注入] innerHTML = 恶意字符串\n结果：未被拦截（CSP 可能未配置 require-trusted-types-for 'script'）\n恶意字符串：${MALICIOUS_HTML}` });
    } catch (err) {
      this._addLog('unsafe', `不安全注入被 CSP 拦截：${err.name}（require-trusted-types-for 'script' 生效）`);
      this.setState({ injectionInfo: `[不安全注入被拦截] ${err.name}: ${err.message}\n说明：require-trusted-types-for 'script' 生效，必须用 policy.createHTML() 包装。` });
    }
  }

  // 安全注入：policy.createHTML(恶意字符串) 过滤后赋值
  _safeInject() {
    const tt = this._getTT();
    if (!tt) {
      // 测试环境无 trustedTypes，模拟过滤逻辑演示
      try {
        const filtered = sanitizeHTML(MALICIOUS_HTML);
        const div = document.createElement('div');
        div.innerHTML = filtered;
        const hasScript = div.querySelectorAll('script').length;
        const hasOnError = div.querySelector('[onerror]') !== null;
        this.setState({
          injectionInfo:
            `[对比演示 - 安全注入] policy.createHTML(MALICIOUS_HTML)\n` +
            `原始恶意字符串：${MALICIOUS_HTML}\n` +
            `过滤后字符串：${filtered}\n` +
            `注入后 DOM 含 <script>：${hasScript > 0}，含 onerror：${hasOnError}\n` +
            `说明：createHTML 回调剥离 <script> 与 on* 事件，注入安全；真实环境返回 TrustedHTML，赋值 innerHTML 不触发 CSP 拦截。`,
        });
        this._addLog('safe', `安全注入演示：过滤后 <script>=${hasScript > 0}, onerror=${hasOnError}（已剥离）`);
      } catch (err) {
        this._addLog('warn', `安全注入失败：${err.name} - ${err.message}`);
      }
      return;
    }
    if (!this._policy) {
      this._addLog('warn', '请先点击「创建 Policy」');
      return;
    }
    try {
      const trusted = this._policy.createHTML(MALICIOUS_HTML);
      const div = document.createElement('div');
      div.innerHTML = trusted;
      const hasScript = div.querySelectorAll('script').length;
      const hasOnError = div.querySelector('[onerror]') !== null;
      this.setState({
        injectionInfo:
          `[安全注入] policy.createHTML(MALICIOUS_HTML) → TrustedHTML\n` +
          `原始恶意字符串：${MALICIOUS_HTML}\n过滤后（TrustedHTML）：${trusted}\n` +
          `注入后 DOM 含 <script>：${hasScript > 0}，含 onerror：${hasOnError}\n` +
          `说明：createHTML 过滤后赋值 innerHTML，不触发 CSP 拦截，DOM XSS 被消除。`,
      });
      this._addLog('safe', `安全注入：createHTML 过滤后 <script>=${hasScript > 0}, onerror=${hasOnError}（已剥离）`);
    } catch (err) {
      this._addLog('warn', `安全注入失败：${err.name} - ${err.message}`);
    }
  }

  // 演示 emptyHTML / emptyScript 常量
  _emptyConstants() {
    const tt = this._getTT();
    if (!tt) {
      this._addLog('warn', 'trustedTypes 不可用：测试环境不支持，需真实浏览器');
      return;
    }
    try {
      const emptyHTML = tt.emptyHTML;
      const emptyScript = tt.emptyScript;
      this.setState({
        injectionInfo:
          `trustedTypes.emptyHTML / emptyScript —— 空值常量\n` +
          `emptyHTML = ${emptyHTML}（TrustedHTML）\nemptyScript = ${emptyScript}（TrustedScript）\n` +
          `用途：清空 innerHTML 时用 el.innerHTML = trustedTypes.emptyHTML；在 require-trusted-types-for 'script' 下，el.innerHTML = '' 会被拦截，必须用 emptyHTML。`,
      });
      this._addLog('empty', `emptyHTML/emptyScript 常量读取完成`);
    } catch (err) {
      this._addLog('warn', `empty 常量读取失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. Trusted Types 防注入演示 —— innerHTML 对比',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.trustedTypes ? 'success' : 'warning' }, caps.trustedTypes ? 'CSP 强制 ✓' : '无 CSP（仅模拟）'),
        h(Tag, { color: 'warning' }, 'DOM XSS 防御'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '本卡片对比两种注入方式：① 不安全：element.innerHTML = 恶意字符串（在 require-trusted-types-for \'script\' CSP 下抛 TypeError 被拦截）；② 安全：element.innerHTML = policy.createHTML(恶意字符串)（经 createHTML 回调过滤，剥离 <script> 与 on* 事件，返回 TrustedHTML 不被拦截）。恶意字符串含 <img onerror> 与 <script>，是典型 DOM XSS 载荷。测试环境无 CSP 强制时，不安全注入仅演示 DOM 解析结果（仍含恶意标签）；安全注入则演示过滤后的安全结果。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('不安全注入', { danger: true, size: 'sm', onClick: () => this._unsafeInject() }),
          this._btn('安全注入', { type: 'primary', size: 'sm', onClick: () => this._safeInject() }),
          this._btn('emptyHTML/emptyScript', { size: 'sm', disabled: !caps.trustedTypes, onClick: () => this._emptyConstants() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '注入对比结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.injectionInfo || '（点击「不安全注入」或「安全注入」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '恶意字符串载荷：'),
        h('pre', { class: 'code-block', style: { maxHeight: '100px', overflow: 'auto' } },
          h('code', {}, MALICIOUS_HTML)),
        h(Alert, {
          type: 'warning',
          message: 'DOM XSS 的根源是字符串直注 DOM',
          description: 'innerHTML / outerHTML / insertAdjacentHTML / document.write / eval / setTimeout(string) / new Function(string) / script.src 等接收字符串的注入点都是 XSS 风险。Trusted Types 通过 CSP 强制这些点只接受 Trusted* 类型，迫使开发者显式过 policy 过滤，从类型系统层面消除 XSS。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：跨源隔离检测 ===================

  // 检测 self.crossOriginIsolated / SharedArrayBuffer / measureUserAgentSpecificMemory 可用性
  _checkIsolation() {
    const crossIsolated = typeof self !== 'undefined' && self.crossOriginIsolated === true;
    const lines = [`self.crossOriginIsolated = ${crossIsolated}（true 表示页面处于跨源隔离环境，需 COOP + COEP 头）`, ''];
    // SharedArrayBuffer
    if (typeof SharedArrayBuffer !== 'undefined') {
      try {
        const sab = new SharedArrayBuffer(1024);
        const view = new Int32Array(sab);
        view[0] = 42;
        lines.push(`SharedArrayBuffer 可用：new SharedArrayBuffer(1024) ✓，Int32Array(sab)[0] = ${view[0]}（跨线程共享内存，需 crossOriginIsolated）`);
      } catch (err) {
        lines.push(`SharedArrayBuffer 存在但创建失败：${err.name} - ${err.message}`);
      }
    } else lines.push(`SharedArrayBuffer 不可用（需 crossOriginIsolated: true，即 COOP+COEP 头）`);
    lines.push('');
    const hasMem = typeof performance !== 'undefined' && typeof performance.measureUserAgentSpecificMemory === 'function';
    lines.push(`performance.measureUserAgentSpecificMemory = ${hasMem ? '可用 ✓' : '不可用'}（需 crossOriginIsolated）`, `跨源隔离所需的响应头配置：`, `  Cross-Origin-Opener-Policy: same-origin (COOP)`, `  Cross-Origin-Embedder-Policy: require-corp | credentialless (COEP)`, `  Cross-Origin-Resource-Policy: same-origin (CORP，资源响应头)`, '', `COOP: same-origin / same-origin-allow-popups / unsafe-none → same-origin 下 window.opener 为 null`, `COEP: require-corp / credentialless / unsafe-none → 要求所有跨源资源带 CORP 头`, `CORP: same-site / same-origin / cross-origin → 资源响应头，声明谁可加载此资源`, `CORB（Cross-Origin Read Blocking）：浏览器自动拦截跨源 HTML/JSON/XML 响应`);
    this.setState({ isolationInfo: lines.join('\n') });
    this._addLog(crossIsolated ? 'iso' : 'warn', `跨源隔离检测：crossOriginIsolated=${crossIsolated}，SharedArrayBuffer=${typeof SharedArrayBuffer !== 'undefined'}`);
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. 跨源隔离策略 —— COOP / COEP / CORP / CORB',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.crossOriginIsolated ? 'success' : 'warning' }, caps.crossOriginIsolated ? '已隔离 ✓' : '未隔离'),
        h(Tag, { color: caps.sharedArrayBuffer ? 'success' : 'error' }, caps.sharedArrayBuffer ? 'SharedArrayBuffer ✓' : 'SharedArrayBuffer ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'self.crossOriginIsolated 布尔值表示页面是否跨源隔离（需同时配置 COOP: same-origin 与 COEP: require-corp 头）。启用跨源隔离后可使用 SharedArrayBuffer（跨线程共享内存，Atomics 原子操作）与 performance.measureUserAgentSpecificMemory（内存测量）。COOP（Cross-Origin-Opener-Policy）防止跨源窗口共享 browsing context group，same-origin 下 window.opener 为 null。COEP（Cross-Origin-Embedder-Policy）要求所有跨源资源带 CORP 头。CORP（Cross-Origin-Resource-Policy）是资源响应头，声明谁可加载此资源。CORB（Cross-Origin Read Blocking）浏览器自动拦截跨源 HTML/JSON/XML 响应。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测跨源隔离', { type: 'primary', size: 'sm', onClick: () => this._checkIsolation() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '隔离状态与配置说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.isolationInfo || '（点击「检测跨源隔离」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考配置：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`# 启用跨源隔离（HTTP 响应头）
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp   # 或 credentialless
Cross-Origin-Resource-Policy: same-origin    # 资源端 CORP

# 检测
if (self.crossOriginIsolated) {
  const sab = new SharedArrayBuffer(1024);        // 可用
  performance.measureUserAgentSpecificMemory();   // 可用
}`)),
        h(Alert, {
          type: 'info',
          message: '跨源隔离是高级 API 的前置条件',
          description: 'SharedArrayBuffer / performance.measureUserAgentSpecificMemory / WASM 线程等高特权 API 要求 crossOriginIsolated: true，防止 Spectre 等侧信道攻击。这是用 COOP+COEP 换取的隔离保证：浏览器确保页面无法与跨源窗口/资源共享上下文。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Speculation Rules ===================

  // 动态创建 <script type="speculationrules"> 注入 prefetch / prerender 规则
  _injectSpecRules() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      this._addLog('warn', 'document.createElement 不可用：测试环境不支持');
      return;
    }
    try {
      const rules = {
        prefetch: [
          { where: { href_matches: '/products/*' }, eagerness: 'eager' },
          { where: { href_matches: '/articles/*' }, eagerness: 'moderate' },
        ],
        prerender: [
          { where: { href_matches: '/checkout' }, eagerness: 'eager' },
        ],
      };
      const script = document.createElement('script');
      script.type = 'speculationrules';
      script.textContent = JSON.stringify(rules, null, 2);
      document.head.appendChild(script);
      this._injectedScript = script;
      const ruleText = JSON.stringify(rules, null, 2);
      this.setState({
        speculationInfo:
          `动态创建 <script type="speculationrules"> 注入规则 ✓\n` +
          `document.createElement('script') → script.type = 'speculationrules' → textContent = JSON.stringify(rules) → head.appendChild\n\n` +
          `注入的规则：\n${ruleText}\n\n` +
          `说明：prefetch 预取页面资源（eagerness: eager/moderate/conservative）；prerender 预渲染整个页面（含 JS 执行）；href_matches 支持通配符。\n` +
          `与 <link rel="prefetch"> / <link rel="prerender">（已废弃）区别：speculationrules 更智能，支持条件匹配与多规则。`,
      });
      this._addLog('spec', `已注入 speculationrules：prefetch 2 条 + prerender 1 条`);
    } catch (err) {
      this._addLog('warn', `注入 speculationrules 失败：${err.name} - ${err.message}`);
    }
  }

  // 读取 document.prerendering 与 prerenderingchange 事件
  _checkPrerendering() {
    if (typeof document === 'undefined') {
      this._addLog('warn', 'document 不可用：测试环境不支持');
      return;
    }
    try {
      const isPrerendering = document.prerendering;
      const hasPrerendering = typeof document.prerendering === 'boolean';
      const lines = [`document.prerendering = ${isPrerendering === undefined ? 'undefined（API 不可用）' : isPrerendering}`, `typeof = ${typeof document.prerendering}，API 可用：${hasPrerendering ? '是' : '否（测试环境不支持，需真实浏览器）'}`, ''];
      if (hasPrerendering) {
        lines.push(`说明：document.prerendering = true 表示当前页面正在被预渲染（prerender 规则触发）。\nprerenderingchange 事件：预渲染页面被用户激活（点击/导航）时触发，监听：document.addEventListener('prerenderingchange', fn)`);
      } else {
        lines.push(`说明：document.prerendering 在 jsdom 中为 undefined，需真实浏览器支持 Speculation Rules API。\n真实浏览器中：prerendering=true 表示正在预渲染（用户尚未到达）；false 表示已激活或未预渲染；prerenderingchange 事件在激活时触发。`);
      }
      this.setState({ speculationInfo: lines.join('\n') });
      this._addLog(hasPrerendering ? 'pre' : 'warn', `document.prerendering 检测：${isPrerendering === undefined ? 'undefined' : isPrerendering}`);
    } catch (err) {
      this._addLog('warn', `检测 prerendering 失败：${err.name} - ${err.message}`);
    }
  }

  // 移除已注入的 speculationrules script
  _removeSpecRules() {
    if (!this._injectedScript) {
      this._addLog('warn', '请先点击「注入 Speculation Rules」');
      return;
    }
    try {
      if (this._injectedScript.parentNode) {
        this._injectedScript.parentNode.removeChild(this._injectedScript);
      }
      this._injectedScript = null;
      this.setState({
        speculationInfo: `已移除注入的 <script type="speculationrules"> ✓\n说明：移除后浏览器不再执行新的 prefetch/prerender（已在进行的会完成）。动态注入与移除可用于按页面状态调整预取策略。`,
      });
      this._addLog('spec', `已移除 speculationrules script`);
    } catch (err) {
      this._addLog('warn', `移除 speculationrules 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Speculation Rules API —— 预取 / 预渲染',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.prerendering ? 'success' : 'warning' }, caps.prerendering ? 'prerendering API ✓' : 'API 不可用'),
        h(Tag, { color: 'primary' }, 'prefetch / prerender'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<script type="speculationrules"> 标签注入 JSON 规则；prefetch 预取页面资源（HTML/CSS/JS），prerender 预渲染整个页面（含 JS 执行），用户点击时瞬间显示。eagerness: eager（立即）/ moderate（悬停/指针按下）/ conservative（点击）。where.href_matches 支持通配符。document.prerendering 布尔值表示当前页面是否正在预渲染；prerenderingchange 事件在预渲染页面被激活时触发。动态添加：document.createElement(\'script\') + type = \'speculationrules\' + textContent = JSON.stringify(rules)。与已废弃的 <link rel="prefetch"> / <link rel="prerender"> 相比，speculationrules 更智能、支持条件匹配。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注入 Speculation Rules', { type: 'primary', size: 'sm', onClick: () => this._injectSpecRules() }),
          this._btn('检测 prerendering', { size: 'sm', onClick: () => this._checkPrerendering() }),
          this._btn('移除规则', { danger: true, size: 'sm', onClick: () => this._removeSpecRules() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Speculation Rules 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.speculationInfo || '（点击「注入 Speculation Rules」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`// 静态：HTML 内嵌
<script type="speculationrules">
{ "prefetch": [{ "where": { "href_matches": "/products/*" }, "eagerness": "eager" }],
  "prerender": [{ "where": { "href_matches": "/checkout" }, "eagerness": "eager" }] }
</script>

// 动态：JS 注入
const s = document.createElement('script');
s.type = 'speculationrules';
s.textContent = JSON.stringify(rules);
document.head.appendChild(s);
if (document.prerendering) document.addEventListener('prerenderingchange', activate);`)),
        h(Alert, {
          type: 'info',
          message: 'prefetch 与 prerender 的区别',
          description: 'prefetch 仅预取资源（HTML/CSS/JS），不执行 JS、不渲染；prerender 完整预渲染页面（执行 JS、构建 DOM、应用样式），用户点击时瞬间显示，但消耗更多资源。eagerness 控制 eagerness 触发时机：eager 立即、moderate 悬停、conservative 点击。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：Referrer Policy ===================

  // 读取 document.referrer，列出 8 种 Referrer-Policy 值
  _checkReferrer() {
    if (typeof document === 'undefined') {
      this._addLog('warn', 'document 不可用：测试环境不支持');
      return;
    }
    try {
      const referrer = document.referrer;
      const lines = [`document.referrer = "${referrer}"`, `说明：当前页面来源 URL；直接打开或 no-referrer 时为空。长度：${referrer.length}`];
      lines.push('');
      lines.push(`8 种 Referrer-Policy 值及说明：`);
      for (const p of REFERRER_POLICIES) lines.push(`  • ${p.value} —— ${p.desc}`);
      lines.push('');
      lines.push(`配置方式：1) HTTP 响应头 Referrer-Policy: strict-origin-when-cross-origin；2) <meta name="referrer" content="no-referrer">；3) <a rel="noreferrer"> 单链接控制\n现代浏览器默认：strict-origin-when-cross-origin（同源完整、跨源仅源、降级不发）`);
      this.setState({ referrerInfo: lines.join('\n') });
      this._addLog('ref', `document.referrer 读取：${referrer === '' ? '（空）' : referrer}；已列出 8 种策略`);
    } catch (err) {
      this._addLog('warn', `检测 referrer 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const card = new Card({
      title: '6. Referrer Policy —— Referer 头控制',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'success' }, 'document.referrer ✓'),
        h(Tag, { color: 'primary' }, '8 种策略值'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Referrer-Policy HTTP 头（或 <meta name="referrer">）控制请求中 Referer 头携带多少信息。document.referrer 读取当前页面来源 URL（直接打开或 no-referrer 时为空）。共 8 种策略值：no-referrer / no-referrer-when-downgrade / same-origin / origin / strict-origin / origin-when-cross-origin / strict-origin-when-cross-origin（现代默认）/ unsafe-url。也可用 <a rel="noreferrer"> 单链接控制。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 referrer', { type: 'primary', size: 'sm', onClick: () => this._checkReferrer() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'document.referrer 与策略列表：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.referrerInfo || '（点击「读取 referrer」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考配置：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`# HTTP 响应头
Referrer-Policy: strict-origin-when-cross-origin
<!-- HTML meta -->  <meta name="referrer" content="no-referrer">
<!-- 单链接 -->      <a href="..." rel="noreferrer">不发送 Referer</a>
console.log(document.referrer); // 读取来源 URL 或空串`)),
        h(Alert, {
          type: 'info',
          message: 'strict-origin-when-cross-origin 是现代默认',
          description: '同源请求发送完整 URL；跨源请求仅发送源（协议+主机+端口）；HTTPS→HTTP 降级不发送。兼顾功能与隐私：跨源场景不泄露路径/查询参数，避免敏感信息（如 token in URL）泄露给第三方。',
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
      h('h2', { class: 'section-title' }, 'Reporting / Trusted Types / 跨源隔离 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 Reporting API（错误报告收集）、Trusted Types（防止 DOM XSS）、跨源隔离（COOP/COEP/CORP）、Speculation Rules（预取/预渲染）、Referrer Policy（Referer 头控制）。多数 API 需真实 HTTPS 浏览器 + 对应 HTTP 头配置，jsdom 中仅记日志说明。'),
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
