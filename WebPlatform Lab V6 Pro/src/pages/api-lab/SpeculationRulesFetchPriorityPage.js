// =====================================================================
// SpeculationRulesFetchPriorityPage.js —— 推测加载与获取优先级 实验室
// 演示 MDN：
//   1. Speculation Rules API —— <script type="speculationrules"> 内联 JSON
//      { prefetch:[{urls,requires,referrer_policy}], prerender:[{where,eagerness,expectation_match}] }
//      eagerness: immediate|moderate|eager|conservative；where: href_matches/selector_matches/and|or|not
//   2. prerender 预渲染 —— document.prerendering / prerenderingchange 事件、activationStart
//      （NavigationTiming）、30s 超时与内存上限、与 <link rel="prerender">（已废弃）的差异
//   3. prefetch / preload / dns-prefetch / preconnect / modulepreload —— <link> 资源提示、
//      as 取值、crossorigin/integrity/referrerpolicy/media/imagesrcset/imagesizes/fetchpriority
//   4. Fetch Priority API —— fetchpriority 属性（img/link/script/iframe）与 fetch(url,{priority})
//      取值 high|low|auto；new Request(url,{priority:'high'}).priority 检测
//   5. PerformanceObserver 监测推测加载 —— navigation（activationStart）、resource
//      （initiatorType/nextHopProtocol/transferSize/deliveryType）、soft-navigation
//   6. 推测加载策略与最佳实践 —— preconnect + speculationrules prefetch/prerender + fetchpriority
//      + preload 组合、Core Web Vitals 度量、CSP script-src 约束、能力聚合
// 说明：所有 API 调用前做 typeof / in 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//   Speculation Rules API 需 Chrome 121+，fetchpriority 需 Chrome 101+；jsdom/Node 中
//   document.prerendering / prerenderingchange / fetchpriority / deliveryType 通常不可用，
//   仅做能力检测与用法说明；PerformanceObserver 在 Node 18+ 可能可用（实验性）。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class SpeculationRulesFetchPriorityPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      specRulesInfo: '',       // Card 1：Speculation Rules API 规则推测
      prerenderInfo: '',       // Card 2：prerender 预渲染深入
      resourceHintsInfo: '',   // Card 3：prefetch 预取与资源提示
      fetchPriorityInfo: '',   // Card 4：Fetch Priority API 获取优先级
      observerInfo: '',        // Card 5：PerformanceObserver 监测推测加载
      strategyInfo: '',        // Card 6：推测加载策略与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._perfObservers = [];            // Card 5：PerformanceObserver 实例数组
    this._prerenderingChangeBound = false; // Card 2：prerenderingchange 监听是否已注册
    this._injectedScripts = [];          // Card 1：注入的 <script type="speculationrules">
    this._injectedLinks = [];            // Card 3：注入的 <link> 资源提示
    this._observerEntries = [];          // Card 5：观察到的 PerformanceEntry 快照

    // —— 一次性能力检测：推测加载与获取优先级全家桶（绝不抛异常）——
    const caps = this._caps();
    const mark = (b) => (b ? '✓' : '✗');
    const parts = [
      `speculationrules ${mark(caps.speculationrules)}`, `prerendering ${mark(caps.prerendering)}`,
      `prerenderingchange ${mark(caps.prerenderingchange)}`, `resourceHints ${mark(caps.resourceHints)}`,
      `fetchpriority ${mark(caps.fetchpriority)}`, `Request.priority ${mark(caps.requestPriority)}`,
      `PerformanceObserver ${mark(caps.performanceObserver)}`, `deliveryType ${mark(caps.deliveryType)}`,
    ];
    const anyAvailable = caps.performanceObserver || caps.speculationrules || caps.fetchpriority;
    const summary =
      `推测加载与获取优先级 能力检测：${parts.join(' · ')}。\n` +
      `当前环境（jsdom/Node）中 document.prerendering / prerenderingchange / fetchpriority / deliveryType 通常不可用；` +
      `Speculation Rules API 需 Chrome 121+，fetchpriority 需 Chrome 101+；` +
      `PerformanceObserver ${caps.performanceObserver ? '真实可用' : '不可用'}。` +
      `所有按钮点击均做 typeof / in 守卫，不可用时仅记日志说明用法，不会抛异常。在真实浏览器中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.speculationrules) this._addLog('warn', 'speculationrules 脚本类型不可用（需 Chrome 121+，jsdom 不识别）');
    if (!caps.prerendering) this._addLog('warn', 'document.prerendering 不可用（jsdom 未实现，需 Chrome 121+ 预渲染阶段）');
    if (!caps.prerenderingchange) this._addLog('warn', 'document.prerenderingchange 事件不可用（jsdom 未实现）');
    if (!caps.fetchpriority) this._addLog('warn', 'fetchpriority 不可用（需 Chrome 101+，jsdom 未实现 IDL 属性）');
    if (!caps.requestPriority) this._addLog('warn', 'Request.priority 不可用（fetch priority init 在当前环境未暴露）');
    if (!caps.performanceObserver) this._addLog('warn', 'PerformanceObserver 不可用（Node 实验性或 jsdom 未实现）');
    if (!caps.deliveryType) this._addLog('warn', 'ResourceTiming deliveryType 不可用（需较新 Chrome，jsdom 未实现）');
  }

  // —— 生命周期：卸载 —— 释放 PerformanceObserver、移除 prerenderingchange 监听、清理注入元素
  componentWillUnmount() {
    for (const obs of this._perfObservers) { try { obs.disconnect(); } catch { /* noop */ } }
    this._perfObservers = [];
    if (this._prerenderingChangeBound && typeof document !== 'undefined') {
      try { document.removeEventListener('prerenderingchange', this._onPrerenderingChange); } catch { /* noop */ }
    }
    this._prerenderingChangeBound = false;
    this._onPrerenderingChange = null;
    for (const s of this._injectedScripts) { try { s.remove(); } catch { /* noop */ } }
    this._injectedScripts = [];
    for (const l of this._injectedLinks) { try { l.remove(); } catch { /* noop */ } }
    this._injectedLinks = [];
    this._observerEntries = [];
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
  // 无参：返回能力标志对象（供 disabled 判定）；有参 items=[[key,label],...]：返回 Tag 组件数组
  _caps(items) {
    const flags = {
      // speculationrules 脚本类型：创建 <script> 并设置 type，读回验证
      speculationrules: (() => {
        try {
          if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
          if (typeof HTMLScriptElement === 'undefined') return false;
          const s = document.createElement('script'); s.type = 'speculationrules';
          return s.type === 'speculationrules';
        } catch { return false; }
      })(),
      // document.prerendering（布尔，预渲染阶段为 true）
      prerendering: (() => { try { return typeof document !== 'undefined' && 'prerendering' in document; } catch { return false; } })(),
      // document.prerenderingchange 事件
      prerenderingchange: (() => { try { return typeof document !== 'undefined' && 'onprerenderingchange' in document; } catch { return false; } })(),
      // <link> 资源提示
      resourceHints: (() => { try { return typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof HTMLLinkElement !== 'undefined'; } catch { return false; } })(),
      // fetchpriority IDL 属性
      fetchpriority: (() => {
        try {
          if (typeof HTMLImageElement === 'undefined' || typeof document === 'undefined') return false;
          if ('fetchPriority' in HTMLImageElement.prototype) return true;
          const img = document.createElement('img'); img.fetchPriority = 'high';
          return img.fetchPriority === 'high';
        } catch { return false; }
      })(),
      // Request.priority（fetch init 的 priority 字段）
      requestPriority: (() => {
        try {
          if (typeof Request === 'undefined') return false;
          const r = new Request('about:blank', { priority: 'high' });
          return r.priority === 'high';
        } catch { return false; }
      })(),
      performanceObserver: typeof PerformanceObserver !== 'undefined',
      // ResourceTiming deliveryType 字段（需较新 Chrome）
      deliveryType: (() => {
        try {
          if (typeof PerformanceObserver === 'undefined' || typeof performance === 'undefined') return false;
          const entries = performance.getEntriesByType('resource');
          return entries.length > 0 && 'deliveryType' in entries[0];
        } catch { return false; }
      })(),
    };
    if (!items) return flags;
    return items.map(([key, label]) => h(Tag, { color: flags[key] ? 'success' : 'error' }, flags[key] ? `${label} ✓` : `${label} ✗`));
  }

  // =================== Card 1：Speculation Rules API 规则推测 ===================

  // 构造 speculationrules JSON 并注入 <script type="speculationrules">，读回并日志
  _injectSpecRules() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      this._addLog('warn', 'document 不可用，无法注入 speculationrules');
      this.setState({ specRulesInfo: 'document 不可用，无法注入 <script type="speculationrules">。' });
      return;
    }
    try {
      const rules = {
        prefetch: [{ urls: ['/page1', '/page2'], requires: ['anonymous-client-ip-when-cross-origin'], referrer_policy: 'no-referrer' }],
        prerender: [
          { where: { href_matches: '/articles/*' }, eagerness: 'moderate', expectation_match: 'high' },
          { where: { selector_matches: '.next-link' }, eagerness: 'conservative' },
        ],
      };
      const json = JSON.stringify(rules, null, 2);
      const script = document.createElement('script');
      script.type = 'speculationrules';
      script.textContent = json;
      (document.head || document.documentElement).appendChild(script);
      this._injectedScripts.push(script);
      const readType = script.type;
      const readText = script.textContent;
      const parsed = JSON.parse(readText);
      const prefetchCount = (parsed.prefetch && parsed.prefetch.length) || 0;
      const prerenderCount = (parsed.prerender && parsed.prerender.length) || 0;
      this.setState({
        specRulesInfo:
          `已注入 <script type="speculationrules"> ✓\n` +
          `script.type = "${readType}"   script.textContent 长度 = ${readText.length} 字节\n\n` +
          `注入的规则 JSON：\n${json}\n\n` +
          `解析读回：prefetch 规则 ${prefetchCount} 条，prerender 规则 ${prerenderCount} 条\n` +
          `说明：浏览器解析后会按 eagerness 触发预取/预渲染；jsdom 不识别此类型，仅演示注入与读回。`,
      });
      this._addLog('inject', `注入 speculationrules：prefetch ${prefetchCount} 条，prerender ${prerenderCount} 条`);
    } catch (err) {
      this._addLog('warn', `注入 speculationrules 失败：${err.name} - ${err.message}`);
      this.setState({ specRulesInfo: `注入失败：${err.name} - ${err.message}` });
    }
  }

  // 展示 speculationrules 的 schema（eagerness 取值、where 选择器、requires 等）
  _showSpecRulesSchema() {
    this.setState({
      specRulesInfo:
        `===== Speculation Rules API 规则结构 =====\n\n` +
        `<script type="speculationrules"> 内联 JSON，顶层两个数组：{ "prefetch": [...], "prerender": [...] }\n\n` +
        `【prefetch 规则字段】：\n  urls: ["/page1","/page2"]   —— 显式 URL 列表\n` +
        `  where: { href_matches | selector_matches | and | or | not }  —— 选择器匹配\n` +
        `  requires: ["anonymous-client-ip-when-cross-origin"]  —— 跨域匿名 IP 要求\n  referrer_policy: "no-referrer"   —— 引用策略\n\n` +
        `【prerender 规则字段】：where / urls 同上\n  eagerness: "immediate" | "moderate" | "eager" | "conservative"\n` +
        `    immediate —— 规则匹配立即触发；moderate —— 悬停约 200ms 触发（默认）\n    eager —— 指针按下触发；conservative —— 点击时触发\n  expectation_match: "high" | ...   —— 期望匹配度\n\n` +
        `【where 选择器组合】：\n  href_matches: "/articles/*"   —— URL 通配匹配\n  selector_matches: ".next-link"   —— DOM 选择器匹配\n` +
        `  and: [ {href_matches:"/a/*"}, {not:{selector_matches:".no"}} ]   —— 与\n  or:  [ {...}, {...} ]   —— 或；not: { selector_matches: ".external" }   —— 非\n\n` +
        `程序式访问：HTMLScriptElement.type === 'speculationrules'；document.speculationRules（部分浏览器暴露）。`,
    });
    this._addLog('schema', '已展示 Speculation Rules 规则结构（eagerness / where / requires）');
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Speculation Rules API 规则推测',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['speculationrules', 'speculationrules'], ['prerendering', 'prerendering']]),
        h(Tag, { color: 'primary' }, 'prefetch / prerender'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '通过 <script type="speculationrules"> 内联 JSON 声明预取（prefetch）与预渲染（prerender）规则。prefetch 数组含 urls / where / requires / referrer_policy；prerender 数组含 where / eagerness（immediate|moderate|eager|conservative，控制触发时机）/ expectation_match。where 选择器支持 href_matches、selector_matches 及 and / or / not 组合。浏览器按 eagerness 自动触发，无需 JS 介入。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注入规则并读回', { type: 'primary', size: 'sm', onClick: () => this._injectSpecRules() }),
          this._btn('规则结构 schema', { size: 'sm', onClick: () => this._showSpecRulesSchema() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '注入的规则 / 结构：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.specRulesInfo || '（点击「注入规则并读回」或「规则结构 schema」）')),
        h(Alert, {
          type: 'info',
          message: 'Speculation Rules 是声明式预取/预渲染的推荐方式',
          description: '相比 <link rel="prefetch"> 与已废弃的 <link rel="prerender">，Speculation Rules 用 JSON 声明多 URL 与 where 选择器，浏览器按 eagerness 智能触发。需 Chrome 121+；CSP 中 inline 规则受 script-src 约束（需 \'speculationrules\' 或 hash/nonce）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：prerender 预渲染深入 ===================

  // 检测 document.prerendering，说明与 <link rel="prerender"> 的差异及限制
  _detectPrerendering() {
    const caps = this._caps();
    try {
      const prerendering = caps.prerendering ? document.prerendering : undefined;
      this.setState({
        prerenderInfo:
          `document.prerendering 检测：\n  'prerendering' in document = ${caps.prerendering}\n  document.prerendering = ${prerendering === undefined ? 'undefined（不可用）' : String(prerendering)}\n\n` +
          `说明：prerender 阶段该值为 true，激活后变 false。\n与 <link rel="prerender">（已废弃，仅投机性抓取）不同，Speculation Rules 的 prerender\n` +
          `  创建隐藏的完整渲染页面（如同真实导航），保持在内存中，导航时约 50ms 内激活。\n\n` +
          `限制：预渲染页面最长存活 30s（超时丢弃）；浏览器有内存上限，过多预渲染会被回收。\n  预渲染期间部分 API 受限（如 cookie、IndexedDB 部分操作延迟到激活）。`,
      });
      this._addLog('prerender', `检测 document.prerendering：支持=${caps.prerendering}，值=${prerendering === undefined ? 'undefined' : prerendering}`);
    } catch (err) {
      this._addLog('warn', `检测 prerendering 失败：${err.name} - ${err.message}`);
    }
  }

  // 注册 prerenderingchange 事件 + PerformanceObserver 观察 navigation 的 activationStart
  _bindPrerenderingChange() {
    const caps = this._caps();
    if (!caps.prerenderingchange && !caps.performanceObserver) {
      this._addLog('warn', 'prerenderingchange 与 PerformanceObserver 均不可用');
      this.setState({
        prerenderInfo:
          `prerenderingchange 事件与 PerformanceObserver 均不可用（jsdom 未实现）。\n\n` +
          `真实浏览器中：\n` +
          `  document.addEventListener('prerenderingchange', (e) => { /* 预渲染被激活 */ });\n` +
          `  // 或用 PerformanceObserver 观察 navigation 条目的 activationStart\n` +
          `  new PerformanceObserver((list) => {\n` +
          `    for (const e of list.getEntries()) { console.log('activationStart=', e.activationStart); }\n` +
          `  }).observe({ type: 'navigation', buffered: true });`,
      });
      return;
    }
    try {
      if (caps.prerenderingchange && !this._prerenderingChangeBound) {
        this._prerenderingChangeBound = true;
        this._onPrerenderingChange = () => this._addLog('event', 'prerenderingchange 触发：预渲染页面已被激活');
        try { document.addEventListener('prerenderingchange', this._onPrerenderingChange); }
        catch (e) { this._addLog('warn', `注册 prerenderingchange 失败：${e.message}`); }
      }
      let navLine = 'PerformanceObserver 不可用';
      if (caps.performanceObserver) {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const as = entry.activationStart;
            this._addLog('event', `navigation 条目：activationStart=${as ?? '(未定义)'}` + (as && as > 0 ? '（曾预渲染）' : ''));
          }
        });
        try { obs.observe({ type: 'navigation', buffered: true }); this._perfObservers.push(obs); }
        catch (e) { this._addLog('warn', `observe navigation 失败：${e.message}`); }
        navLine = '已 observe({ type: "navigation", buffered: true })，将记录 activationStart';
      }
      this.setState({
        prerenderInfo:
          `已注册激活检测 ✓\n` +
          `prerenderingchange 监听：${this._prerenderingChangeBound ? '已注册（document.addEventListener）' : '不可用'}\n` +
          `PerformanceObserver navigation：${navLine}\n\n` +
          `说明：\n  - prerenderingchange 在预渲染被激活（用户导航到该 URL）时触发\n` +
          `  - NavigationTiming.activationStart > 0 表示本次导航来自预渲染（激活耗时可度量）\n` +
          `  - jsdom 中两者通常不触发，仅演示注册流程`,
      });
      this._addLog('prerender', `注册激活检测：prerenderingchange=${this._prerenderingChangeBound}，navObserver=${caps.performanceObserver}`);
    } catch (err) {
      this._addLog('warn', `注册激活检测失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. prerender 预渲染深入',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['prerendering', 'prerendering'], ['prerenderingchange', 'prerenderingchange']]),
        h(Tag, { color: 'primary' }, 'activationStart'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Speculation Rules 的 prerender 创建隐藏的完整渲染页面（如同真实导航），保持在内存中，用户导航时约 50ms 内激活。与已废弃的 <link rel="prerender">（仅投机性抓取，非真正渲染）不同。document.prerendering 在预渲染阶段为 true；document.prerenderingchange 事件在激活时触发；performance.getEntriesByType("navigation") 的 activationStart > 0 表示来自预渲染。预渲染页面最长存活 30s，受浏览器内存上限约束。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 prerendering', { type: 'primary', size: 'sm', onClick: () => this._detectPrerendering() }),
          this._btn('注册激活检测', { size: 'sm', onClick: () => this._bindPrerenderingChange() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'prerender 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.prerenderInfo || '（点击「检测 prerendering」或「注册激活检测」）')),
        h(Alert, {
          type: 'warning',
          message: '预渲染有 30s 超时与内存上限',
          description: '预渲染页面最长存活 30s，超时后丢弃；浏览器内存不足时会回收预渲染。预渲染期间部分 API（如某些 cookie/IndexedDB 操作、付款 API）受限或延迟到激活后执行，避免在隐藏页面中误触发敏感操作。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：prefetch 预取与资源提示 ===================

  // 动态注入 <link rel="..."> 资源提示，逐个日志
  _injectResourceHint(rel) {
    if (!this._caps().resourceHints) {
      this._addLog('warn', '<link> 资源提示不可用（document/HTMLLinkElement 未定义）');
      this.setState({ resourceHintsInfo: '<link> 资源提示不可用，无法注入。' });
      return;
    }
    try {
      const link = document.createElement('link');
      link.rel = rel;
      const config = {
        prefetch: { href: '/next-page.html' },
        preload: { href: '/critical-font.woff2', as: 'font' },
        preconnect: { href: 'https://cdn.example.com' },
        'dns-prefetch': { href: '//stats.example.com' },
        modulepreload: { href: '/chunk.mjs' },
      }[rel] || { href: '/resource' };
      link.href = config.href;
      if (config.as) link.as = config.as;
      if (rel === 'preconnect' || rel === 'dns-prefetch') link.crossOrigin = 'anonymous';
      (document.head || document.documentElement).appendChild(link);
      this._injectedLinks.push(link);
      const readRel = link.rel;
      const readHref = link.href;
      const readAs = link.as || '(无)';
      this.setState({
        resourceHintsInfo:
          `已注入 <link rel="${rel}"> ✓\n` +
          `  href = "${readHref}"   rel = "${readRel}"   as = ${readAs}\n\n` +
          `说明：\n` +
          `  prefetch      —— 下一导航的低优先级抓取，进 HTTP 缓存\n` +
          `  preload       —— 当前导航的高优先级抓取，必须用 as 指定类型\n` +
          `  preconnect    —— 提前完成 DNS + TCP + TLS 握手\n` +
          `  dns-prefetch  —— 仅提前 DNS 解析\n` +
          `  modulepreload —— 预加载 ES 模块及其依赖\n\n` +
          `<link> 属性：href / as / crossorigin / integrity / referrerpolicy / media / imagesrcset / imagesizes / fetchpriority\n` +
          `as 取值：script|style|font|image|fetch|document|audio|video|track|embed|object|worker`,
      });
      this._addLog('hint', `注入 <link rel="${rel}" href="${config.href}">`);
    } catch (err) {
      this._addLog('warn', `注入 <link rel="${rel}"> 失败：${err.name} - ${err.message}`);
    }
  }

  // 展示资源提示对比表
  _showResourceHintsTable() {
    this.setState({
      resourceHintsInfo:
        `===== 资源提示（Resource Hints）对比 =====\n\n` +
        `rel="prefetch"       优先级：低   时机：下一导航   缓存：HTTP 缓存   用途：预取下一页\n` +
        `rel="preload"        优先级：高   时机：当前导航   缓存：强制加载   用途：当前页关键资源（必须 as）\n` +
        `rel="dns-prefetch"   优先级：低   时机：尽早       缓存：DNS 缓存   用途：提前 DNS 解析\n` +
        `rel="preconnect"     优先级：低   时机：尽早       缓存：连接复用   用途：DNS+TCP+TLS 握手\n` +
        `rel="modulepreload"  优先级：高   时机：当前导航   缓存：模块图缓存 用途：预加载 ES 模块及依赖\n\n` +
        `缓存行为差异：\n  prefetch 写入 HTTP 缓存，下次导航命中（若未过期）；\n  preload 是强制加载（mandatory），即使浏览器认为不需要也会下载；\n` +
        `  preload 必须配 as 属性匹配 CSP 与优先级，否则可能被忽略或双重下载。\n\n` +
        `常用属性组合：\n  <link rel="preload" href="font.woff2" as="font" type="font/woff2" crossorigin>\n` +
        `  <link rel="preconnect" href="https://cdn.example.com" crossorigin>\n  <link rel="prefetch" href="/next.html" referrerpolicy="no-referrer">\n` +
        `  <link rel="modulepreload" href="/app.mjs" integrity="sha384-...">`,
    });
    this._addLog('hint', '已展示资源提示对比表（prefetch/preload/preconnect/dns-prefetch/modulepreload）');
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. prefetch 预取与资源提示',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['resourceHints', 'link 注入']]),
        h(Tag, { color: 'primary' }, 'prefetch / preload / preconnect'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<link rel="prefetch"> 低优先级预取下一导航资源（进 HTTP 缓存）；<link rel="preload"> 高优先级预加载当前页关键资源（必须用 as 指定类型，强制加载）；<link rel="dns-prefetch"> 仅提前 DNS 解析；<link rel="preconnect"> 提前完成 DNS + TCP + TLS 握手；<link rel="modulepreload"> 预加载 ES 模块及其依赖。属性含 href / as / crossorigin / integrity / referrerpolicy / media / imagesrcset / imagesizes / fetchpriority。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('prefetch', { type: 'primary', size: 'sm', disabled: !caps.resourceHints, onClick: () => this._injectResourceHint('prefetch') }),
          this._btn('preload', { size: 'sm', disabled: !caps.resourceHints, onClick: () => this._injectResourceHint('preload') }),
          this._btn('preconnect', { size: 'sm', disabled: !caps.resourceHints, onClick: () => this._injectResourceHint('preconnect') }),
          this._btn('dns-prefetch', { size: 'sm', disabled: !caps.resourceHints, onClick: () => this._injectResourceHint('dns-prefetch') }),
          this._btn('modulepreload', { size: 'sm', disabled: !caps.resourceHints, onClick: () => this._injectResourceHint('modulepreload') }),
          this._btn('对比表', { size: 'sm', onClick: () => this._showResourceHintsTable() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '资源提示状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.resourceHintsInfo || '（点击各 rel 按钮注入 <link> 或查看对比表）')),
        h(Alert, {
          type: 'info',
          message: 'prefetch 进 HTTP 缓存，preload 是强制加载',
          description: 'prefetch 写入 HTTP 缓存供下次导航命中；preload 是 mandatory preload，即使浏览器认为不需要也会下载，必须配 as 匹配 CSP 与优先级。preconnect 应尽早放在 <head> 顶部以最大化握手收益。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Fetch Priority API 获取优先级 ===================

  // 检测 fetchpriority 支持并演示各元素属性读写
  _detectFetchPriority() {
    const caps = this._caps();
    try {
      const imgProto = (typeof HTMLImageElement !== 'undefined') && 'fetchPriority' in HTMLImageElement.prototype;
      let imgSetRead = '(未测试)';
      try {
        if (typeof document !== 'undefined') {
          const img = document.createElement('img'); img.fetchPriority = 'high';
          imgSetRead = `img.fetchPriority = "${img.fetchPriority}"（读回 ${img.fetchPriority === 'high' ? '✓' : '✗'}）`;
        }
      } catch (e) { imgSetRead = `设置失败：${e.message}`; }
      let reqLine = 'Request.priority 不可用';
      if (caps.requestPriority) {
        const r = new Request('about:blank', { priority: 'high' });
        reqLine = `new Request(url, { priority: 'high' }).priority = "${r.priority}"`;
      }
      this.setState({
        fetchPriorityInfo:
          `Fetch Priority 能力检测：\n  'fetchPriority' in HTMLImageElement.prototype = ${imgProto}\n  ${imgSetRead}\n` +
          `  Request.priority 支持 = ${caps.requestPriority}\n  ${reqLine}\n\n` +
          `取值：'high' | 'low' | 'auto'（默认，浏览器启发式）\n\n` +
          `可设置元素 / 调用：\n  <img fetchpriority="high">          —— 提升首屏主图\n` +
          `  <script fetchpriority="low">        —— 降低第三方脚本\n  <link rel="preload" fetchpriority="high"> —— 提升关键预加载\n` +
          `  <iframe fetchpriority="low">        —— 降低非关键 iframe\n  fetch(url, { priority: 'high' })    —— fetch init 优先级\n  new Request(url, { priority })      —— Request 构造优先级`,
      });
      this._addLog('priority', `检测 fetchpriority：imgProto=${imgProto}，requestPriority=${caps.requestPriority}`);
    } catch (err) {
      this._addLog('warn', `检测 fetchpriority 失败：${err.name} - ${err.message}`);
    }
  }

  // 构造不同优先级的 fetch init / Request，日志记录
  _demoFetchPriorityLevel(level) {
    const caps = this._caps();
    try {
      const init = { method: 'GET', priority: level, mode: 'cors' };
      let reqPriority = '(Request 不可用)';
      if (caps.requestPriority) {
        const r = new Request('https://example.com/api', { priority: level });
        reqPriority = `"${r.priority}"`;
      } else if (typeof Request !== 'undefined') {
        try {
          const r = new Request('https://example.com/api', { priority: level });
          reqPriority = `r.priority = ${r.priority === undefined ? 'undefined（不支持）' : `"${r.priority}"`}`;
        } catch (e) { reqPriority = `构造失败：${e.message}`; }
      }
      const useCases = {
        high: '用途：首屏主图、关键 CSS/JS、首屏字体',
        low: '用途：第三方分析、非关键 iframe、延迟图片',
        auto: '用途：默认，浏览器启发式决定',
      }[level] || '';
      this.setState({
        fetchPriorityInfo:
          `构造 fetch 优先级 "${level}"：\n` +
          `  fetch init = ${JSON.stringify(init)}\n` +
          `  new Request(url, init).priority = ${reqPriority}\n\n` +
          `${useCases}\n\n` +
          `说明：fetch(url, { priority }) 通过 init 传递；浏览器据此调整与默认优先级的偏差。\n` +
          `  high 提升到接近最高；low 降到接近最低；auto（默认）沿用浏览器启发式。\n` +
          `  jsdom 中 fetchpriority 通常不生效，仅记录 init 形态。`,
      });
      this._addLog('priority', `演示 fetch priority="${level}"：init=${JSON.stringify(init)}`);
    } catch (err) {
      this._addLog('warn', `演示 priority=${level} 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Fetch Priority API 获取优先级',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['fetchpriority', 'fetchpriority'], ['requestPriority', 'Request.priority']]),
        h(Tag, { color: 'primary' }, 'high | low | auto'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'fetchpriority 属性可设置在 <img> / <link> / <script> / <iframe> 上，fetch(url, { priority }) 与 new Request(url, { priority }) 通过 init 传递。取值 high / low / auto（默认）。典型用例：首屏主图 high、关键 CSS/JS high、第三方分析 low、非关键 iframe low。auto 沿用浏览器启发式（图片/脚本默认 auto）。检测：\'fetchPriority\' in HTMLImageElement.prototype 或 set/read back；new Request(url, { priority: "high" }).priority。需 Chrome 101+。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._detectFetchPriority() }),
          this._btn("priority='high'", { size: 'sm', onClick: () => this._demoFetchPriorityLevel('high') }),
          this._btn("priority='low'", { size: 'sm', onClick: () => this._demoFetchPriorityLevel('low') }),
          this._btn("priority='auto'", { size: 'sm', onClick: () => this._demoFetchPriorityLevel('auto') }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Fetch Priority 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.fetchPriorityInfo || '（点击「检测能力」或各优先级按钮）')),
        h(Alert, {
          type: 'info',
          message: 'fetchpriority 是对浏览器默认优先级的微调',
          description: '浏览器对资源有默认优先级（如 CSS 最高、图片中等、脚本视位置而定）。fetchpriority 在此基础上向 high/low 偏移，不是绝对值。应只对少数关键/非关键资源设置，避免全局滥用导致优先级失真。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：PerformanceObserver 监测推测加载 ===================

  // 创建 PerformanceObserver 观察 resource 类型，记录 deliveryType / transferSize
  _startObserver() {
    const caps = this._caps();
    if (!caps.performanceObserver) {
      this._addLog('warn', 'PerformanceObserver 不可用（Node 实验性或 jsdom 未实现）');
      this.setState({
        observerInfo:
          `PerformanceObserver 不可用：typeof PerformanceObserver === "undefined"\n\n` +
          `真实浏览器中：\n` +
          `  const obs = new PerformanceObserver((list) => {\n` +
          `    for (const e of list.getEntries()) { console.log(e.name, e.initiatorType, e.deliveryType, e.transferSize); }\n` +
          `  });\n  obs.observe({ type: 'resource', buffered: true });\n\n` +
          `entry 类型：navigation（activationStart）/ resource（initiatorType, deliveryType, transferSize）/ soft-navigation`,
      });
      return;
    }
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this._observerEntries.push({
            name: entry.name, type: entry.entryType, initiatorType: entry.initiatorType,
            nextHopProtocol: entry.nextHopProtocol, transferSize: entry.transferSize,
            decodedBodySize: entry.decodedBodySize, deliveryType: entry.deliveryType, activationStart: entry.activationStart,
          });
          let hit = '';
          if (entry.deliveryType === 'navigations-prefetch') hit = ' ← 来自 prefetch 缓存';
          else if (entry.transferSize === 0 && entry.decodedBodySize > 0) hit = ' ← 缓存命中（transferSize=0）';
          this._addLog('observe', `[${entry.entryType}] ${entry.initiatorType || ''} ${entry.name.slice(0, 40)} deliveryType=${entry.deliveryType ?? 'N/A'} transferSize=${entry.transferSize ?? 'N/A'}${hit}`);
        }
      });
      let observed = [];
      try { obs.observe({ type: 'resource', buffered: true }); observed.push('resource'); this._perfObservers.push(obs); }
      catch (e) { this._addLog('warn', `observe resource 失败：${e.message}`); }
      try {
        const navObs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this._addLog('observe', `[navigation] activationStart=${entry.activationStart ?? 'N/A'} ${entry.activationStart > 0 ? '← 曾预渲染' : ''}`);
          }
        });
        navObs.observe({ type: 'navigation', buffered: true });
        this._perfObservers.push(navObs);
        observed.push('navigation');
      } catch (e) { this._addLog('warn', `observe navigation 失败：${e.message}`); }
      this.setState({
        observerInfo:
          `已创建 PerformanceObserver ✓\nobserve 类型：${observed.join(', ') || '（均失败）'}\n已记录条目数：${this._observerEntries.length}\n\n` +
          `entry 类型与关键字段：\n  navigation —— activationStart（>0 表示来自预渲染）\n` +
          `  resource   —— initiatorType / nextHopProtocol / transferSize / deliveryType\n  soft-navigation —— 软导航条目\n\n` +
          `deliveryType 取值：""（普通）/ "navigations-prefetch"（来自 prefetch 缓存）/ "cache"\n` +
          `缓存命中判定：deliveryType === 'navigations-prefetch' 或 (transferSize === 0 && decodedBodySize > 0)\n\n` +
          `点击「触发 fetch」可产生新的 resource 条目；点击「停止观察」断开 observer。`,
      });
      this._addLog('observe', `PerformanceObserver 已启动，observe: ${observed.join(', ') || '无'}`);
    } catch (err) {
      this._addLog('warn', `创建 PerformanceObserver 失败：${err.name} - ${err.message}`);
    }
  }

  // 触发一次 fetch（产生 resource 条目，便于观察）
  async _triggerFetch() {
    if (typeof fetch !== 'function') {
      this._addLog('warn', 'fetch 不可用，无法触发 resource 条目');
      this.setState({ observerInfo: (this.state.observerInfo || '') + '\n\nfetch 不可用，无法触发 resource 条目。' });
      return;
    }
    try {
      const url = 'https://example.com/api-lab-probe?t=' + Date.now();
      this._addLog('observe', `触发 fetch('${url}') 以产生 resource 条目…`);
      try { await fetch(url, { mode: 'no-cors' }); }
      catch (e) { this._addLog('warn', `fetch 抛错（预期，无真实网络）：${e.message}`); }
      const entries = (typeof performance !== 'undefined' && performance.getEntriesByType)
        ? performance.getEntriesByType('resource').slice(-5) : [];
      const lines = entries.map((e) =>
        `  ${e.initiatorType || '?'} ${e.name.slice(0, 50)} | deliveryType=${e.deliveryType ?? 'N/A'} transferSize=${e.transferSize ?? 'N/A'}`);
      this.setState({
        observerInfo:
          (this.state.observerInfo ? this.state.observerInfo + '\n\n' : '') +
          `已触发 fetch ✓\n最近 5 条 resource 条目：\n${lines.join('\n') || '  （无可见条目）'}\n\n` +
          `说明：jsdom 中可能无真实网络条目；真实浏览器中 fetch 会产生 ResourceTiming，\n` +
          `  可通过 deliveryType === 'navigations-prefetch' 或 transferSize===0 判定预取/缓存命中。`,
      });
    } catch (err) {
      this._addLog('warn', `触发 fetch 失败：${err.name} - ${err.message}`);
    }
  }

  // 停止所有 PerformanceObserver
  _stopObserver() {
    if (this._perfObservers.length === 0) { this._addLog('warn', '无 PerformanceObserver 可停止'); return; }
    const n = this._perfObservers.length;
    for (const obs of this._perfObservers) { try { obs.disconnect(); } catch { /* noop */ } }
    this._perfObservers = [];
    this._addLog('observe', `已断开 ${n} 个 PerformanceObserver`);
    this.setState({ observerInfo: `已 disconnect ${n} 个 PerformanceObserver。累计记录条目：${this._observerEntries.length}。重新点击「启动观察」可重建。` });
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. PerformanceObserver 监测推测加载',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['performanceObserver', 'Observer'], ['deliveryType', 'deliveryType']]),
        h(Tag, { color: 'primary' }, 'navigation / resource'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new PerformanceObserver((list) => list.getEntries()) 观察性能条目。navigation 类型含 activationStart（>0 表示来自预渲染）；resource 类型含 initiatorType / nextHopProtocol / transferSize / deliveryType；soft-navigation 类型记录软导航。ResourceTiming.deliveryType 取值：""（普通）、"navigations-prefetch"（来自 prefetch 缓存）、"cache"。预取命中判定：deliveryType === "navigations-prefetch" 或 transferSize === 0 && decodedBodySize > 0。可据此度量 prefetch 命中率。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('启动观察', { type: 'primary', size: 'sm', disabled: !caps.performanceObserver, onClick: () => this._startObserver() }),
          this._btn('触发 fetch', { size: 'sm', onClick: () => this._triggerFetch() }),
          this._btn('停止观察', { danger: true, size: 'sm', disabled: !caps.performanceObserver, onClick: () => this._stopObserver() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'PerformanceObserver 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.observerInfo || '（点击「启动观察」开始监测推测加载）')),
        h(Alert, {
          type: 'info',
          message: '用 deliveryType / transferSize 度量 prefetch 命中率',
          description: '统计 resource 条目中 deliveryType === "navigations-prefetch" 或 transferSize===0 且 decodedBodySize>0 的占比即可算 prefetch 命中率。activationStart > 0 度量预渲染激活加速效果。需较新 Chrome 支持 deliveryType 字段。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：推测加载策略与最佳实践 ===================

  // 展示完整加载策略 JSON/HTML
  _showStrategy() {
    this.setState({
      strategyInfo:
        `===== 完整推测加载策略（HTML + JSON）=====\n\n` +
        `1) preconnect（关键第三方源，尽早放 <head> 顶部）：\n  <link rel="preconnect" href="https://cdn.example.com" crossorigin>\n\n` +
        `2) Speculation Rules prefetch（可能下一页，moderate）：\n  <script type="speculationrules">\n  ${JSON.stringify({ prefetch: [{ where: { selector_matches: '.next-link' }, eagerness: 'moderate' }] }, null, 2)}\n  // 可能的下一页，moderate 悬停触发\n\n` +
        `3) Speculation Rules prerender（高置信下一页）：\n  <script type="speculationrules">\n  ${JSON.stringify({ prerender: [{ where: { href_matches: '/articles/*' }, eagerness: 'immediate' }, { where: { selector_matches: '.related a' }, eagerness: 'conservative' }] }, null, 2)}\n  // 高置信单链 immediate；多链 conservative 点击触发\n\n` +
        `4) fetchpriority（关键资源提升、非关键降低）：\n  <img fetchpriority="high" src="/hero.jpg">           <!-- 首屏主图 -->\n  <link rel="preload" href="/critical.css" as="style" fetchpriority="high">\n  <script fetchpriority="low" src="/analytics.js">      <!-- 第三方分析 -->\n\n` +
        `5) preload（当前页关键资源）：\n  <link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>\n\n` +
        `度量影响：Core Web Vitals（LCP / INP / CLS）改善；activationStart 度量预渲染加速。\n` +
        `CSP 约束：内联 speculationrules 受 script-src 约束（需 'speculationrules' 关键字或 hash/nonce）。`,
    });
    this._addLog('strategy', '已展示完整推测加载策略（preconnect + prefetch + prerender + fetchpriority + preload）');
  }

  // 校验策略结构 + 聚合所有能力检测
  _validateStrategy() {
    const caps = this._caps();
    const sample = {
      prefetch: [{ urls: ['/next'] }],
      prerender: [{ where: { href_matches: '/a/*' }, eagerness: 'moderate' }],
    };
    const checks = [];
    checks.push(`prefetch 是数组：${Array.isArray(sample.prefetch)}（每项需 urls 或 where）`);
    checks.push(`prerender 是数组：${Array.isArray(sample.prerender)}（每项需 where 或 urls + eagerness）`);
    const eagernessOk = sample.prerender.every((r) => ['immediate', 'moderate', 'eager', 'conservative'].includes(r.eagerness));
    checks.push(`eagerness 合法：${eagernessOk}（immediate|moderate|eager|conservative）`);
    const whereOk = sample.prerender.every((r) => !r.where || 'href_matches' in r.where || 'selector_matches' in r.where || 'and' in r.where || 'or' in r.where || 'not' in r.where);
    checks.push(`where 选择器合法：${whereOk}（href_matches|selector_matches|and|or|not）`);
    const agg = [
      `prerendering 支持：${caps.prerendering ? '✓' : '✗'}`, `speculationrules 脚本类型：${caps.speculationrules ? '✓' : '✗'}`,
      `fetchpriority 属性：${caps.fetchpriority ? '✓' : '✗'}`, `Request.priority：${caps.requestPriority ? '✓' : '✗'}`,
      `PerformanceObserver：${caps.performanceObserver ? '✓' : '✗'}`, `ResourceTiming deliveryType：${caps.deliveryType ? '✓' : '✗'}`,
    ];
    this.setState({
      strategyInfo:
        `策略结构校验：\n  • ${checks.join('\n  • ')}\n\n能力聚合：\n  ${agg.join('\n  ')}\n\n` +
        `建议：\n  - speculationrules 不可用时降级为 <link rel="prefetch">（功能子集）\n` +
        `  - fetchpriority 不可用时无害（属性被忽略，沿用默认优先级）\n  - PerformanceObserver / deliveryType 不可用时改用 transferSize===0 判定缓存命中\n` +
        `  - CSP 需在 script-src 允许内联 speculationrules（'speculationrules' 关键字或 nonce/hash）`,
    });
    this._addLog('strategy', `校验策略结构 + 聚合能力：${agg.join('，')}`);
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 推测加载策略与最佳实践',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '组合策略'),
        h(Tag, { color: 'warning' }, 'CSP / 度量'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '组合 Speculation Rules + Fetch Priority + Resource Hints 实现最优加载：1) <link rel="preconnect"> 关键第三方源（尽早）；2) Speculation Rules prefetch 可能下一页（moderate eagerness）；3) Speculation Rules prerender 高置信下一页（单链 immediate，多链 conservative）；4) fetchpriority="high" 关键首屏资源；5) <link rel="preload"> 当前页关键资源。度量：Core Web Vitals（LCP/INP/CLS）改善、activationStart 度量预渲染加速。CSP：内联 speculationrules 受 script-src 约束。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('完整策略', { type: 'primary', size: 'sm', onClick: () => this._showStrategy() }),
          this._btn('校验 + 聚合能力', { size: 'sm', onClick: () => this._validateStrategy() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '加载策略 / 校验结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.strategyInfo || '（点击「完整策略」或「校验 + 聚合能力」）')),
        h(Alert, {
          type: 'warning',
          message: 'Speculation Rules 内联规则受 CSP script-src 约束',
          description: '内联 <script type="speculationrules"> 的 JSON 内容受 CSP script-src 检查：需允许 \'speculationrules\' 关键字、或 nonce、或 hash。外部规则文件（<script type="speculationrules" src="...">）受 script-src 的源约束。配置不当会导致规则被 CSP 拦截而不生效。',
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
    return h('div', { class: 'page api-lab-page speculation-rules-page' },
      h('h2', { class: 'section-title' }, '推测加载与获取优先级 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'Speculation Rules API（prefetch / prerender）+ Fetch Priority + Resource Hints + PerformanceObserver 监测。本页演示声明式预取/预渲染、fetchpriority 微调、资源提示注入与推测加载度量。'),
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
