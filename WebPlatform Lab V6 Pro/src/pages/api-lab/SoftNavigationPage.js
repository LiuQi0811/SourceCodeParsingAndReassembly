// =====================================================================
// SoftNavigationPage.js —— 软导航（Soft Navigation）深度实验室
// 演示 MDN：
//   1. 软导航概念与检测 —— SoftNavigationEntry（name/entryType:'soft-navigation'/startTime/duration/
//      navigationId UUID）/ getEntriesByType('soft-navigation') / PerformanceObserver({ type }) /
//      performance.softNav（实验性布尔）/ supportedEntryTypes.includes('soft-navigation')；
//      启发式：History/Navigation API 改 URL + 用户手势 + 可见 DOM 内容变化 + 合理时间窗
//   2. Navigation API 与软导航触发 —— navigate 事件 / navigate|reload|back|forward|traverseTo /
//      currentEntry（url/key/id/type/getState/setState）/ event.intercept({ handler })；
//      manual history.pushState 单独不一定被识别
//   3. 软导航 LCP/INP 重算 —— 软导航前按整页测一次；软导航后每条独立重算；
//      LCP/event 条目带 navigationId 关联 SoftNavigationEntry；按 navigationId 过滤；event 含 interactionId
//   4. PerformanceObserver 监听软导航 —— observe 类型：soft-navigation / largest-contentful-paint /
//      layout-shift / event / longtask；observe({ type, buffered:true })；navigationId 关联；缓冲上限
//   5. 软导航与 history.pushState 协调 —— 自动检测条件；无 API 时 pushState + mark/measure；
//      框架路由发射信号；navigator.scheduling.isInputPending() 检查是否阻塞输入
//   6. 软导航分析上报与最佳实践 —— 三层上报（初始整页 + 每软导航 + 聚合 avg/median/P75）；
//      sendBeacon；Web Vitals onLCP(cb,{reportSoftNavs:true})/onCLS/onINP；attribution；能力聚合矩阵
// 说明：Soft Navigation 是 Chrome 120+ flag 后实验性能力。jsdom/Node 中 PerformanceObserver 可能可用
//   但不产生真实 soft-navigation 条目；window.navigation 与 performance.softNav 通常为 undefined。
//   所有 API 调用前做 typeof / in / supportedEntryTypes 守卫，不可用时仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class SoftNavigationPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：Soft Navigation 概念与检测
      detectInfo: '',
      // Card 2：Navigation API 与软导航触发
      navTriggerInfo: '',
      // Card 3：软导航 LCP/INP 重算
      lcpInpInfo: '',
      // Card 4：PerformanceObserver 监听软导航
      observerInfo: '',
      // Card 5：软导航与 history.pushState 协调
      pushStateInfo: '',
      // Card 6：软导航分析上报与最佳实践
      reportInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._perfObservers = [];
    this._navigateHandler = null;
    this._currententrychangeHandler = null;
    this._popstateHandler = null;
    this._softNavEntries = [];
    this._lcpByRoute = {};

    // —— 一次性能力检测：Soft Navigation 全家桶（绝不抛异常）——
    const caps = this._caps();
    const mark = (b) => (b ? '✓' : '✗');
    const parts = [
      `soft-navigation entry ${mark(caps.softNavEntry)}`, `PerformanceObserver ${mark(caps.performanceObserver)}`,
      `performance.softNav ${mark(caps.softNavFlag)}`, `Navigation API ${mark(caps.navigation)}`,
      `performance.getEntriesByType ${mark(caps.getEntriesByType)}`, `performance.mark/measure ${mark(caps.markMeasure)}`,
      `sendBeacon ${mark(caps.sendBeacon)}`, `isInputPending ${mark(caps.isInputPending)}`,
    ];
    const anyAvailable = caps.performanceObserver || caps.navigation || caps.getEntriesByType;
    const summary =
      `Soft Navigation 能力检测：${parts.join(' · ')}。\n` +
      `Chrome 120+ flag 后实验性能力；jsdom/Node 中 PerformanceObserver ${caps.performanceObserver ? '可用' : '不可用'}但通常不产生真实 soft-navigation 条目；` +
      `window.navigation 与 performance.softNav 在 jsdom 中通常为 undefined。所有按钮点击均做 typeof / supportedEntryTypes 守卫，` +
      `不可用时仅记日志说明用法，不会抛异常。在真实 Chrome (开启 soft-navigation 特性) 中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.softNavEntry) this._addLog('warn', "soft-navigation 条目类型不可用（需 Chrome 120+ 开启特性，jsdom 未实现）");
    if (!caps.softNavFlag) this._addLog('info', 'performance.softNav 实验性布尔未暴露（jsdom 无，Chrome 需 flag）');
    if (!caps.navigation) this._addLog('warn', 'Navigation API 不可用（仅 Chrome 实现，jsdom 未实现）');
    if (!caps.performanceObserver) this._addLog('warn', 'PerformanceObserver 不可用（Node 实验性或 jsdom 未实现）');
    if (!caps.isInputPending) this._addLog('info', 'navigator.scheduling.isInputPending 不可用（jsdom 未实现）');
  }

  // —— 生命周期：卸载 —— 断开 PerformanceObserver、移除 navigate/popstate 监听、清空引用
  componentWillUnmount() {
    for (const obs of this._perfObservers) { try { obs.disconnect(); } catch { /* noop */ } }
    this._perfObservers = [];
    if (typeof navigation !== 'undefined' && navigation) {
      if (this._navigateHandler) { try { navigation.removeEventListener('navigate', this._navigateHandler); } catch { /* noop */ } }
      if (this._currententrychangeHandler) { try { navigation.removeEventListener('currententrychange', this._currententrychangeHandler); } catch { /* noop */ } }
    }
    if (typeof window !== 'undefined' && this._popstateHandler) {
      try { window.removeEventListener('popstate', this._popstateHandler); } catch { /* noop */ }
    }
    this._navigateHandler = null;
    this._currententrychangeHandler = null;
    this._popstateHandler = null;
    this._softNavEntries = [];
    this._lcpByRoute = {};
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
  // 无参：返回能力标志对象；有参 items=[[key,label],...]：返回 Tag 组件数组
  _caps(items) {
    let supported = [];
    try {
      supported = (typeof PerformanceObserver !== 'undefined' && Array.isArray(PerformanceObserver.supportedEntryTypes))
        ? PerformanceObserver.supportedEntryTypes : [];
    } catch { /* noop */ }
    const hasPerf = typeof performance !== 'undefined';
    const flags = {
      softNavEntry: supported.includes('soft-navigation'),
      performanceObserver: typeof PerformanceObserver !== 'undefined',
      softNavFlag: (() => { try { return hasPerf && 'softNav' in performance && performance.softNav === true; } catch { return false; } })(),
      navigation: typeof navigation !== 'undefined' && navigation !== null,
      getEntriesByType: hasPerf && typeof performance.getEntriesByType === 'function',
      markMeasure: hasPerf && typeof performance.mark === 'function' && typeof performance.measure === 'function',
      sendBeacon: typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function',
      isInputPending: typeof navigator !== 'undefined' && typeof navigator.scheduling !== 'undefined' && typeof navigator.scheduling.isInputPending === 'function',
    };
    if (!items) return flags;
    return items.map(([key, label]) => h(Tag, { color: flags[key] ? 'success' : 'error' }, flags[key] ? `${label} ✓` : `${label} ✗`));
  }

  // =================== Card 1：Soft Navigation 概念与检测 ===================

  // 检测 soft-navigation 条目支持 + 概念说明
  _detectSoftNav() {
    const caps = this._caps();
    let supportedTypes = [];
    try {
      supportedTypes = (typeof PerformanceObserver !== 'undefined' && Array.isArray(PerformanceObserver.supportedEntryTypes))
        ? PerformanceObserver.supportedEntryTypes.slice() : [];
    } catch { /* noop */ }
    const hasSoft = caps.softNavEntry;
    this.setState({
      detectInfo:
        '===== Soft Navigation 概念与检测 =====\n\n' +
        '【概念】软导航是 SPA 路由切换：更新 URL + DOM 但不整页重载，浏览器将其视为新导航以重算 LCP/INP/CLS。\n\n' +
        '【与硬导航差异】硬导航=完整文档加载，重置一切计时；软导航不重载文档，但"重置 LCP 候选"，对当前路由重新度量 LCP/INP。\n\n' +
        '【检测方式】\n' +
        '  1) performance.getEntriesByType("soft-navigation") → SoftNavigationEntry[]\n' +
        '  2) new PerformanceObserver(cb).observe({ type: "soft-navigation", buffered: true })\n' +
        '  3) PerformanceObserver.supportedEntryTypes.includes("soft-navigation") —— 同步能力探测\n' +
        '  4) performance.softNav —— 实验性布尔（Chrome flag）\n\n' +
        '【SoftNavigationEntry 字段】name / entryType:"soft-navigation" / startTime / duration / navigationId（UUID 字符串）\n' +
        '【浏览器启发式】URL 经 History/Navigation API 改变 + 用户手势 + 可见 DOM 内容变化 + 合理时间窗\n\n' +
        `当前环境检测：PerformanceObserver.supportedEntryTypes = [${supportedTypes.join(', ')}]\n` +
        `  含 'soft-navigation' = ${hasSoft}；performance.softNav = ${caps.softNavFlag}；PerformanceObserver 可用 = ${caps.performanceObserver}；getEntriesByType 可用 = ${caps.getEntriesByType}`,
    });
    this._addLog('detect', `soft-navigation 支持探测：supportedEntryTypes 含=${hasSoft}，softNav flag=${caps.softNavFlag}`);
  }

  // 读取已有 soft-navigation 条目（如可用）
  _readSoftNavEntries() {
    const caps = this._caps();
    if (!caps.getEntriesByType) {
      this._addLog('warn', 'performance.getEntriesByType 不可用');
      this.setState({ detectInfo: 'performance.getEntriesByType 不可用，无法读取 soft-navigation 条目。\n请在真实 Chrome（开启特性）中打开本页演示。' });
      return;
    }
    try {
      let entries = [];
      try { entries = performance.getEntriesByType('soft-navigation'); } catch { entries = []; }
      const lines = entries.length
        ? entries.map((e, i) => `[${i}] name=${e.name} navigationId=${e.navigationId} startTime=${e.startTime?.toFixed?.(2) ?? e.startTime} duration=${e.duration?.toFixed?.(2) ?? e.duration}`)
        : '（暂无 soft-navigation 条目；触发一次 SPA 路由切换后浏览器可能记录）';
      this.setState({
        detectInfo:
          `performance.getEntriesByType('soft-navigation') → SoftNavigationEntry[${entries.length}]\n\n${lines}\n\n` +
          `字段说明：name=软导航目标 URL；entryType 固定 'soft-navigation'；startTime=软导航开始时间（performance.timeOrigin 相对）；duration=软导航持续时间；navigationId=UUID 字符串，关联本条软导航的 LCP/CLS/INP 条目`,
      });
      this._addLog('detect', `读取 soft-navigation 条目：共 ${entries.length} 条`);
    } catch (err) {
      this._addLog('warn', `读取 soft-navigation 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Soft Navigation 概念与检测',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['softNavEntry', 'soft-nav entry'], ['softNavFlag', 'softNav flag']]),
        h(Tag, { color: 'primary' }, 'SoftNavigationEntry'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '软导航（soft navigation）是 SPA 路由切换：更新 URL + DOM 但不整页重载，浏览器将其视为一次新导航以重算 LCP/INP/CLS。检测：performance.getEntriesByType("soft-navigation") 返回 SoftNavigationEntry[]，字段含 name / entryType / startTime / duration / navigationId（UUID）。PerformanceObserver.supportedEntryTypes.includes("soft-navigation") 同步探测能力；performance.softNav（实验性布尔）。浏览器启发式：URL 经 History/Navigation API 改变 + 用户手势 + 可见内容变化 + 合理时间窗。与硬导航差异：软导航不重载文档但重置 LCP 候选。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力 + 概念', { type: 'primary', size: 'sm', onClick: () => this._detectSoftNav() }),
          this._btn('读取已有条目', { size: 'sm', disabled: !caps.getEntriesByType, onClick: () => this._readSoftNavEntries() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Soft Navigation 检测 / 概念：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.detectInfo || '（点击「检测能力 + 概念」或「读取已有条目」）')),
        h(Alert, {
          type: 'info',
          message: '软导航重置 LCP 候选，但不重载文档',
          description: '硬导航会触发完整文档加载并重置一切计时；软导航保持当前文档，仅"重置 LCP 候选"并重算 LCP/INP/CLS，使 SPA 路由切换也能被真实度量。performance.softNav 是 Chrome 实验性布尔，需在 chrome://flags 开启 Soft Navigation 特性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Navigation API 与软导航触发 ===================

  // 启动 / 停止监听 navigate 事件，演示软导航触发
  _toggleNavigateListener() {
    const caps = this._caps();
    if (!caps.navigation) {
      this._addLog('warn', 'Navigation API 不可用（仅 Chrome 实现，jsdom 未实现）');
      this.setState({
        navTriggerInfo:
          'Navigation API 不可用（typeof navigation === "undefined"）。\n\n真实浏览器中：\n' +
          "navigation.addEventListener('navigate', (event) => {\n" +
          "  console.log(event.destination.url, event.navigationType);  // 'push'|'replace'|'reload'|'traverse'\n" +
          '  event.intercept({ async handler() { /* 更新 DOM，使其成为客户端导航 */ } });\n' +
          '});\nawait navigation.navigate("/page2");   // 触发一次潜在的软导航\n' +
          'await navigation.back(); await navigation.forward(); await navigation.traverseTo(key);\n\n' +
          '说明：Navigation API + intercept 让导航成为客户端导航，配合浏览器启发式可被识别为软导航；\n' +
          '单独 manual history.pushState 不一定被识别（缺少统一信号）。',
      });
      return;
    }
    if (this._navigateHandler) {
      try { navigation.removeEventListener('navigate', this._navigateHandler); } catch { /* noop */ }
      if (this._currententrychangeHandler) {
        try { navigation.removeEventListener('currententrychange', this._currententrychangeHandler); } catch { /* noop */ }
        this._currententrychangeHandler = null;
      }
      this._navigateHandler = null;
      this._addLog('nav', '已停止监听 navigate / currententrychange');
      this.setState({ navTriggerInfo: '已停止监听 Navigation API 事件。重新点击「监听 navigate 事件」可恢复。' });
      return;
    }
    try {
      this._navigateHandler = (event) => {
        const dest = event.destination;
        this._addLog('nav', `navigate 事件：type=${event.navigationType}，userInitiated=${event.userInitiated}，dest.url=${dest ? dest.url : '?'}`);
      };
      this._currententrychangeHandler = (event) => {
        const to = event.to;
        this._addLog('nav', `currententrychange：to.url=${to ? to.url : '?'}，to.type=${to ? to.type : '?'}，to.key=${to ? to.key : '?'}`);
      };
      navigation.addEventListener('navigate', this._navigateHandler);
      navigation.addEventListener('currententrychange', this._currententrychangeHandler);
      this._addLog('nav', '已开始监听 navigate / currententrychange（点击「触发 navigate 演示」）');
      this.setState({
        navTriggerInfo:
          '已开始监听 Navigation API 事件 ✓\n' +
          '  navigation.addEventListener("navigate", cb) —— 导航开始时触发\n' +
          '  navigation.addEventListener("currententrychange", cb) —— 当前条目切换\n\n' +
          'NavigateEvent 关键字段：event.navigationType —— "push"|"replace"|"reload"|"traverse"\n' +
          '  event.destination.url/.key/.id/.index/.sameDocument/.getState()；event.userInitiated / canIntercept / hashChange / signal\n' +
          '  event.intercept({ handler, focusReset }) —— 拦截为客户端导航\n\n' +
          'navigation.currentEntry：.url/.key/.id/.type/.getState()/.setState()\n\n' +
          '点击「触发 navigate 演示」可调用 navigation.navigate() 触发一次潜在软导航。',
      });
    } catch (err) {
      this._addLog('warn', `监听 navigate 失败：${err.name} - ${err.message}`);
    }
  }

  // 演示触发 navigation.navigate（用同文档 hash 避免离开页面）
  async _triggerNavigate() {
    const caps = this._caps();
    if (!caps.navigation) {
      this._addLog('warn', 'navigation.navigate 不可用（仅 Chrome 实现）');
      return;
    }
    try {
      const targetUrl = `${location.pathname}${location.search}#soft-nav-${Date.now()}`;
      this._addLog('nav', `调用 navigation.navigate("${targetUrl}")…`);
      let resultInfo = '（未返回 NavigationResult）';
      try {
        const result = await navigation.navigate(targetUrl, {
          transition: 'push',
          info: { source: 'SoftNavigationPage', ts: Date.now() },
        });
        resultInfo = `NavigationResult：committed=${typeof result?.committed !== 'undefined'}，fulfilled=${typeof result?.fulfilled !== 'undefined'}`;
      } catch (e) {
        resultInfo = `navigate 抛错（预期，jsdom URL 限制）：${e.message}`;
      }
      const ce = navigation.currentEntry;
      this.setState({
        navTriggerInfo:
          `navigation.navigate(url, options) 触发软导航演示：\n` +
          `  目标 url = ${targetUrl}\n` +
          `  options.transition = 'push'（默认）| 'replace'；options.info = { source, ts }（传给 navigate 事件 event.info）\n` +
          `  ${resultInfo}\n\n` +
          `触发后 navigation.currentEntry：url=${ce ? ce.url : '?'}，key=${ce ? ce.key : '?'}，id=${ce ? ce.id : '?'}，type=${ce ? ce.type : '?'}（push|replace|reload|traverse）\n\n` +
          `说明：intercept({ handler }) 让导航成为客户端导航，配合浏览器启发式（URL 改变 + 用户手势 + 可见内容变化）才会被识别为软导航并产生 soft-navigation 条目。\n` +
          `  单独 manual history.pushState 不一定被识别（缺少统一信号）。`,
      });
      this._addLog('nav', `navigate 完成：currentEntry.type=${ce ? ce.type : '?'}，url=${ce ? ce.url : '?'}`);
    } catch (err) {
      this._addLog('warn', `navigate 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Navigation API 与软导航触发',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['navigation', 'Navigation API']]),
        h(Tag, { color: 'primary' }, 'navigate / intercept'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigation.addEventListener("navigate", e => e.destination.url / e.navigationType) 监听所有导航。navigation.navigate(url) / reload() / back() / forward() / traverseTo(key) 触发导航，均返回 Promise<NavigationResult>={ committed, fulfilled }。navigation.currentEntry 含 url / key / id / type（push|replace|reload|traverse）/ getState() / setState()。event.intercept({ handler }) 让导航成为客户端导航，配合浏览器启发式（URL 改变 + 用户手势 + 可见内容变化）才会被识别为软导航。单独 manual history.pushState 不一定被识别。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('监听 navigate 事件', { type: 'primary', size: 'sm', disabled: !caps.navigation, onClick: () => this._toggleNavigateListener() }),
          this._btn('触发 navigate 演示', { size: 'sm', disabled: !caps.navigation, onClick: () => this._triggerNavigate() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Navigation API / 软导航触发：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.navTriggerInfo || '（点击「监听 navigate 事件」后，再点击「触发 navigate 演示」）')),
        h(Alert, {
          type: 'warning',
          message: 'intercept 是软导航识别的关键',
          description: '使用 Navigation API 并调用 event.intercept({ handler }) 让导航成为客户端导航，浏览器启发式（URL 改变 + 用户手势 + 可见 DOM 内容变化 + 合理时间窗）通过后才会产生 soft-navigation 条目。仅 history.pushState 改 URL 而无可见内容变化，通常不被识别为软导航。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：软导航 LCP/INP 重算 ===================

  // 展示 LCP/INP 重算流程 + 按 navigationId 过滤 LCP
  _showLcpInpRecalc() {
    this.setState({
      lcpInpInfo:
        '===== 软导航 LCP/INP 重算流程 =====\n\n' +
        '【软导航前】LCP/INP 仅按整页测一次 → SPA 路由切换不更新指标 → 数据陈旧\n' +
        '【软导航后】每条软导航独立重新测 LCP/INP/CLS\n\n' +
        '【关联机制】LCP 条目带 navigationId 关联对应 SoftNavigationEntry；INP 也按软导航重算；event 条目含 interactionId + navigationId。\n' +
        '【上报建议】软导航的 LCP/INP/CLS 应与初始整页指标分开上报，便于按路由聚合分析。\n\n' +
        '示例代码（获取最近一条软导航的 LCP）：\n' +
        '  const softNavs = performance.getEntriesByType("soft-navigation");\n  const latest = softNavs[softNavs.length - 1];\n  if (!latest) return;\n' +
        '  const lcpForRoute = performance.getEntriesByType("largest-contentful-paint")\n' +
        '    .filter((e) => e.navigationId === latest.navigationId)\n' +
        '    .reduce((max, e) => (e.startTime > max.startTime ? e : max), { startTime: 0 });\n' +
        '  console.log("route LCP:", lcpForRoute.startTime, "ms, navigationId:", latest.navigationId);\n\n' +
        '示例代码（获取某软导航的 INP）：\n' +
        '  const events = performance.getEntriesByType("event").filter((e) => e.navigationId === latest.navigationId && e.interactionId > 0);\n' +
        '  // INP ≈ 该软导航内所有交互的最大 duration（取 P75 近似）',
    });
    this._addLog('lcp', '已展示软导航 LCP/INP 重算流程与按 navigationId 过滤的代码');
  }

  // 真实读取 LCP 条目并按 navigationId 分组（如可用）
  _readLcpByNav() {
    const caps = this._caps();
    if (!caps.getEntriesByType) {
      this._addLog('warn', 'performance.getEntriesByType 不可用');
      this.setState({ lcpInpInfo: 'performance.getEntriesByType 不可用，无法读取 LCP 条目。' });
      return;
    }
    try {
      let lcpEntries = []; let softNavs = [];
      try { lcpEntries = performance.getEntriesByType('largest-contentful-paint'); } catch { lcpEntries = []; }
      try { softNavs = performance.getEntriesByType('soft-navigation'); } catch { softNavs = []; }
      const hasNavId = lcpEntries.length > 0 && 'navigationId' in lcpEntries[0];
      const groups = {};
      for (const e of lcpEntries) {
        const key = hasNavId ? (e.navigationId || 'initial') : 'initial';
        if (!groups[key] || e.startTime > groups[key].startTime) groups[key] = e;
      }
      const softLines = softNavs.length
        ? softNavs.map((s, i) => `[${i}] name=${s.name} navigationId=${s.navigationId} startTime=${s.startTime?.toFixed?.(2) ?? s.startTime}`)
        : '（暂无 soft-navigation 条目）';
      const lcpLines = Object.keys(groups).length
        ? Object.entries(groups).map(([k, e]) => `navigationId=${k} → LCP startTime=${e.startTime?.toFixed?.(2) ?? e.startTime} ms, element=${e.element ? e.element.tagName : '(无)'}`)
        : '（暂无 LCP 条目）';
      this.setState({
        lcpInpInfo:
          `performance.getEntriesByType('largest-contentful-paint') → ${lcpEntries.length} 条（含 navigationId = ${hasNavId}）\n` +
          `performance.getEntriesByType('soft-navigation') → ${softNavs.length} 条\n\n` +
          `soft-navigation 条目：\n${softLines}\n\n按 navigationId 分组的 LCP：\n${lcpLines}\n\n` +
          `说明：初始整页 LCP 条目 navigationId 通常为 undefined（视实现）；软导航后 LCP 条目 navigationId 等于对应 SoftNavigationEntry.navigationId；INP（event 条目含 interactionId + navigationId）同理按 navigationId 过滤。`,
      });
      this._addLog('lcp', `读取 LCP 条目：共 ${lcpEntries.length} 条，含 navigationId=${hasNavId}`);
    } catch (err) {
      this._addLog('warn', `读取 LCP 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. 软导航 LCP/INP 重算',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['getEntriesByType', 'getEntriesByType']]),
        h(Tag, { color: 'primary' }, 'navigationId 关联'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '软导航前：LCP/INP 仅按整页测一次，SPA 路由切换不更新指标导致数据陈旧。软导航后：每条软导航独立重新测 LCP/INP/CLS。LargestContentfulPaint 条目带 navigationId 字段关联对应 SoftNavigationEntry；performance.getEntriesByType("largest-contentful-paint") 按 navigationId 过滤可得每路由 LCP。INP（Interaction to Next Paint）也按软导航重算；event 条目含 interactionId + navigationId。上报：软导航的 LCP/INP/CLS 应与初始整页指标分开上报，便于按路由聚合分析。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示重算流程', { type: 'primary', size: 'sm', onClick: () => this._showLcpInpRecalc() }),
          this._btn('读取 LCP 按 navId 分组', { size: 'sm', disabled: !caps.getEntriesByType, onClick: () => this._readLcpByNav() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'LCP/INP 重算 / 关联：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.lcpInpInfo || '（点击「展示重算流程」或「读取 LCP 按 navId 分组」）')),
        h(Alert, {
          type: 'info',
          message: 'navigationId 是软导航指标关联的钥匙',
          description: '每条 SoftNavigationEntry 有唯一 navigationId（UUID 字符串），同一次软导航的 LCP / CLS / INP 条目都带相同的 navigationId。按 navigationId 过滤即可得每路由的指标，再与初始整页指标分开上报，实现 SPA 路由级性能分析。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：PerformanceObserver 监听软导航 ===================

  // 创建 PerformanceObserver 监听 soft-navigation 与 LCP（按 navigationId 关联）
  _startSoftNavObserver() {
    const caps = this._caps();
    if (!caps.performanceObserver) {
      this._addLog('warn', 'PerformanceObserver 不可用');
      this.setState({
        observerInfo:
          'PerformanceObserver 不可用：typeof PerformanceObserver === "undefined"\n\n真实浏览器中：\n' +
          '  // 1. 监听 soft-navigation\n' +
          '  const softObs = new PerformanceObserver((list) => {\n' +
          '    for (const e of list.getEntries()) {\n' +
          '      if (e.entryType === "soft-navigation") console.log(e.name, e.navigationId);\n' +
          '    }\n' +
          '  });\n  softObs.observe({ type: "soft-navigation", buffered: true });\n\n' +
          '  // 2. 监听 LCP，按 navigationId 关联\n' +
          '  const lcpObs = new PerformanceObserver((list) => {\n' +
          '    for (const e of list.getEntries()) console.log("LCP", e.navigationId, e.startTime);\n' +
          '  });\n  lcpObs.observe({ type: "largest-contentful-paint", buffered: true });',
      });
      return;
    }
    try {
      const observed = [];
      // 监听 soft-navigation
      try {
        const softObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            this._softNavEntries.push({ name: e.name, navigationId: e.navigationId, startTime: e.startTime, duration: e.duration });
            this._addLog('observe', `[soft-navigation] name=${e.name} navigationId=${e.navigationId} startTime=${e.startTime?.toFixed?.(2) ?? e.startTime}`);
          }
        });
        softObs.observe({ type: 'soft-navigation', buffered: true });
        this._perfObservers.push(softObs); observed.push('soft-navigation');
      } catch (e) { this._addLog('warn', `observe soft-navigation 失败：${e.message}`); }
      // 监听 LCP，按 navigationId 关联
      try {
        const lcpObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const navId = e.navigationId || 'initial';
            if (!this._lcpByRoute[navId] || e.startTime > this._lcpByRoute[navId].startTime) {
              this._lcpByRoute[navId] = { startTime: e.startTime, element: e.element ? e.element.tagName : null };
            }
            this._addLog('observe', `[LCP] navigationId=${navId} startTime=${e.startTime?.toFixed?.(2) ?? e.startTime}ms`);
          }
        });
        lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
        this._perfObservers.push(lcpObs); observed.push('largest-contentful-paint');
      } catch (e) { this._addLog('warn', `observe LCP 失败：${e.message}`); }
      // 监听 layout-shift（per-route CLS）
      try {
        const lsObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            this._addLog('observe', `[layout-shift] navigationId=${e.navigationId ?? 'initial'} value=${e.value?.toFixed?.(4) ?? e.value}`);
          }
        });
        lsObs.observe({ type: 'layout-shift', buffered: true });
        this._perfObservers.push(lsObs); observed.push('layout-shift');
      } catch (e) { this._addLog('warn', `observe layout-shift 失败：${e.message}`); }
      this.setState({
        observerInfo:
          `已创建 PerformanceObserver ✓\nobserve 类型：${observed.join(', ') || '（均失败）'}\n已捕获 soft-navigation 条目：${this._softNavEntries.length}\n\n` +
          `可观察类型与关键字段：\n` +
          `  soft-navigation —— name / startTime / duration / navigationId\n` +
          `  largest-contentful-paint —— startTime / element / navigationId（per-route LCP）\n` +
          `  layout-shift —— value / navigationId（per-route CLS）\n` +
          `  event —— duration / interactionId / navigationId（per-route INP）\n` +
          `  longtask —— startTime / duration（per-route 长任务）\n\n` +
          `关联机制：每个时间条目 .navigationId 匹配对应 SoftNavigationEntry.navigationId；buffered:true 拉取历史条目（受缓冲上限约束）。\n` +
          `缓冲上限：LCP 默认 10 条，soft-navigation 较小，超出后早期条目被丢弃；buffered:true 只能拿到尚未丢弃的部分。`,
      });
      this._addLog('observe', `PerformanceObserver 已启动，observe: ${observed.join(', ') || '无'}`);
    } catch (err) {
      this._addLog('warn', `创建 PerformanceObserver 失败：${err.name} - ${err.message}`);
    }
  }

  // 停止所有 PerformanceObserver
  _stopSoftNavObserver() {
    if (this._perfObservers.length === 0) {
      this._addLog('warn', '无 PerformanceObserver 可停止');
      return;
    }
    const n = this._perfObservers.length;
    for (const obs of this._perfObservers) { try { obs.disconnect(); } catch { /* noop */ } }
    this._perfObservers = [];
    this._addLog('observe', `已断开 ${n} 个 PerformanceObserver`);
    this.setState({ observerInfo: `已 disconnect ${n} 个 PerformanceObserver。\n累计捕获 soft-navigation 条目：${this._softNavEntries.length}。\n按 navigationId 聚合的 LCP：${Object.keys(this._lcpByRoute).length} 条。\n重新点击「启动软导航观察」可重建。` });
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. PerformanceObserver 监听软导航',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['performanceObserver', 'Observer'], ['softNavEntry', 'soft-nav entry']]),
        h(Tag, { color: 'primary' }, 'buffered / navigationId'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new PerformanceObserver((list) => list.getEntries().forEach(e => e.entryType === "soft-navigation")) 观察软导航。可观察类型：soft-navigation / largest-contentful-paint（带 navigationId，per-route LCP）/ layout-shift（带 navigationId，per-route CLS）/ event（interactionId + navigationId，per-route INP）/ longtask（per-route 长任务）。observe({ type: "soft-navigation", buffered: true }) 中 buffered 拉取历史条目。每个时间条目 .navigationId 关联对应 SoftNavigationEntry。缓冲有上限，超出后早期条目被丢弃。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('启动软导航观察', { type: 'primary', size: 'sm', disabled: !caps.performanceObserver, onClick: () => this._startSoftNavObserver() }),
          this._btn('停止观察', { danger: true, size: 'sm', disabled: !caps.performanceObserver, onClick: () => this._stopSoftNavObserver() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'PerformanceObserver 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.observerInfo || '（点击「启动软导航观察」开始监测软导航与 per-route 指标）')),
        h(Alert, {
          type: 'info',
          message: 'buffered:true 拉取历史条目，但受缓冲上限约束',
          description: 'PerformanceEntry 各类型有缓冲上限（如 LCP 默认 10 条、soft-navigation 较小），超出后早期条目被丢弃。buffered:true 只能拿到缓冲区内尚未丢弃的部分。生产环境建议尽早创建 observer，或配合 getEntriesByType 兜底。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：软导航与 history.pushState 协调 ===================

  // 模拟软导航：history.pushState + 内容切换 + performance.mark/measure
  _simulatePushStateSoftNav() {
    const caps = this._caps();
    const canPushState = typeof history !== 'undefined' && typeof history.pushState === 'function';
    const canMark = caps.markMeasure;
    if (!canPushState && !canMark) {
      this._addLog('warn', 'history.pushState 与 performance.mark 均不可用');
      this.setState({ pushStateInfo: 'history.pushState 与 performance.mark 均不可用，无法模拟软导航。' });
      return;
    }
    try {
      const startMark = `soft-nav-start-${Date.now()}`;
      const endMark = `soft-nav-end-${Date.now()}`;
      const measureName = `soft-nav-duration-${Date.now()}`;
      if (canMark) { try { performance.mark(startMark); } catch { /* noop */ } }
      // pushState 改 URL（jsdom 可能限制）
      let pushOk = false;
      let pushErr = '';
      if (canPushState) {
        try {
          const newUrl = `${location.pathname}${location.search}#sim-soft-nav-${Date.now()}`;
          history.pushState({ source: 'SoftNavigationPage', ts: Date.now() }, '', newUrl);
          pushOk = true;
        } catch (e) { pushErr = e.message; }
      }
      // 模拟"可见内容变化"（jsdom 无真实渲染，仅记录）+ 标记结束 + measure
      const contentChanged = true;
      let measureLine = '(performance.measure 不可用)';
      if (canMark) {
        try { performance.mark(endMark); } catch { /* noop */ }
        try {
          performance.measure(measureName, startMark, endMark);
          const m = performance.getEntriesByName(measureName, 'measure')[0];
          measureLine = m ? `performance.measure → duration=${m.duration?.toFixed?.(2) ?? m.duration} ms` : 'measure 未生成条目';
        } catch (e) { measureLine = `measure 失败：${e.message}`; }
      }
      this.setState({
        pushStateInfo:
          `模拟软导航（history.pushState + 内容切换 + performance.mark/measure）：\n\n` +
          `  1) performance.mark("${startMark}")   —— 软导航开始\n` +
          `  2) history.pushState(state, "", newUrl) —— 改 URL；结果：${pushOk ? '成功' : `失败（${pushErr || '不可用'}）`}\n` +
          `  3) 模拟可见内容变化（DOM 替换）：${contentChanged ? '已完成（记录）' : '未完成'}\n` +
          `  4) performance.mark("${endMark}")     —— 软导航结束\n` +
          `  5) ${measureLine}\n\n` +
          `说明：自动检测需 URL 改变（pushState/replaceState 或 Navigation API）+ 用户手势 + 可见 DOM 内容变化 + 合理时间窗。本模拟仅演示手动 mark/measure 计时；浏览器是否产生 soft-navigation 条目取决于启发式。\n\n` +
          `手动检测（无 API 时）：用 performance.mark + performance.measure 自行计时；contentVisibilityState 变化可作"可见内容变化"信号；框架路由（React/Vue/Svelte）可发射自定义信号告知分析库。`,
      });
      this._addLog('pushState', `模拟软导航：pushOk=${pushOk}，mark=${canMark}，contentChanged=${contentChanged}`);
    } catch (err) {
      this._addLog('warn', `模拟软导航失败：${err.name} - ${err.message}`);
    }
  }

  // 展示 isInputPending + 框架路由信号协调
  _showInputPendingAndFramework() {
    const caps = this._caps();
    let inputPendingLine = 'navigator.scheduling.isInputPending 不可用（jsdom 未实现）';
    if (caps.isInputPending) {
      try {
        const pending = navigator.scheduling.isInputPending({ includeContinuous: false });
        inputPendingLine = `navigator.scheduling.isInputPending() = ${pending}（true 表示有输入待处理，软导航可能阻塞）`;
      } catch (e) { inputPendingLine = `isInputPending 调用失败：${e.message}`; }
    }
    this.setState({
      pushStateInfo:
        '===== 软导航与 history.pushState 协调 =====\n\n' +
        '【浏览器自动检测条件】1) URL 经 pushState/replaceState 或 Navigation API 改变；\n' +
        '  2) 用户手势（点击/键盘）发起；3) DOM 内容可见变化；4) 合理时间窗内完成\n\n' +
        '【无 API 时手动检测】pushState + 内容变化 + performance.mark("soft-nav-start"/"soft-nav-end")\n' +
        '  + performance.measure("soft-nav-duration")；contentVisibilityState 变化可作"可见内容变化"信号\n\n' +
        '【框架路由集成】React Router / Vue Router / SvelteKit 可发射自定义信号告知分析库，例如 window.dispatchEvent(new CustomEvent("soft-nav", { detail: { url } }))\n\n' +
        '【isInputPending 检查】' + inputPendingLine + '\n' +
        '  用法：if (!navigator.scheduling.isInputPending()) { /* 执行软导航渲染 */ }；作用：避免软导航渲染阻塞用户输入，提升 INP\n\n' +
        '【参考】ContentVisibilityState：document.visibilityState（visible/hidden）+ 元素可见性 API；框架可在路由切换前后 dispatchEvent 发射信号，分析库据此归类指标。',
    });
    this._addLog('pushState', `展示 pushState 协调 + isInputPending：${inputPendingLine}`);
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. 软导航与 history.pushState 协调',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['markMeasure', 'mark/measure'], ['isInputPending', 'isInputPending']]),
        h(Tag, { color: 'primary' }, 'pushState / 启发式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '浏览器自动检测软导航需满足：1) URL 经 history.pushState/replaceState 或 Navigation API 改变；2) 用户手势发起；3) DOM 内容可见变化；4) 合理时间窗。无 API 时手动检测：pushState + 内容变化 + performance.mark("soft-nav-start"/"soft-nav-end") + performance.measure("soft-nav-duration")；contentVisibilityState 变化可作可见信号。框架路由（React/Vue/Svelte）可发射自定义信号。navigator.scheduling.isInputPending() 检查软导航是否会阻塞输入，避免影响 INP。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('模拟 pushState 软导航', { type: 'primary', size: 'sm', onClick: () => this._simulatePushStateSoftNav() }),
          this._btn('isInputPending + 框架信号', { size: 'sm', onClick: () => this._showInputPendingAndFramework() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'pushState 协调 / 手动计时：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.pushStateInfo || '（点击「模拟 pushState 软导航」或「isInputPending + 框架信号」）')),
        h(Alert, {
          type: 'warning',
          message: '单独 history.pushState 不一定被识别为软导航',
          description: '浏览器启发式要求 URL 改变 + 用户手势 + 可见内容变化 + 合理时间窗同时满足。仅 pushState 改 URL 而无可见内容变化（如仅更新状态）通常不被识别。手动用 performance.mark/measure 可在无 API 时自行计时，但与浏览器原生 soft-navigation 条目不等价。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：软导航分析上报与最佳实践 ===================

  // 构造完整软导航指标上报 payload（JSON）+ Web Vitals 库用法
  _showReportingPayload() {
    const samplePayload = {
      page: '/articles/spa-routing',
      initialPageLoad: { lcp: 1850, inp: 120, cls: 0.05, navigationId: null, ts: 1717000000000 },
      softNavs: [
        { navigationId: 'a1b2c3d4-...', url: '/articles/soft-nav', name: '/articles/soft-nav', lcp: 920, inp: 80, cls: 0.02, lcpElement: 'ARTICLE > H1', inpTarget: 'A.next-link', ts: 1717000010000 },
        { navigationId: 'e5f6g7h8-...', url: '/articles/inp', name: '/articles/inp', lcp: 760, inp: 95, cls: 0.01, lcpElement: 'IMG.hero', inpTarget: 'BUTTON.cta', ts: 1717000020000 },
      ],
      aggregate: { routes: 2, lcp: { mean: 840, median: 840, p75: 920 }, inp: { mean: 87, median: 87, p75: 95 }, cls: { mean: 0.015, median: 0.015, p75: 0.02 } },
    };
    this.setState({
      reportInfo:
        '===== 软导航指标上报策略 =====\n\n' +
        '【三层上报】\n' +
        '  1) 初始整页指标（traditional）—— 首屏 LCP/INP/CLS\n' +
        '  2) 每条软导航指标（per-soft-nav）—— 每路由 LCP/INP/CLS\n' +
        '  3) 聚合（aggregate）—— 每路由的 avg / median / P75\n\n' +
        '【sendBeacon 卸载安全上报】navigator.sendBeacon("/analytics", JSON.stringify(payload));优势：页面卸载时仍能可靠发送，不阻塞卸载；适合 unload / pagehide 时机\n\n' +
        '【Web Vitals 库集成】\n' +
        '  import { onLCP, onCLS, onINP } from "web-vitals";\n' +
        '  onLCP((m) => sendBeacon("/r", m), { reportSoftNavs: true });  onCLS((m) => sendBeacon("/r", m), { reportSoftNavs: true });\n' +
        '  onINP((m) => sendBeacon("/r", m), { reportSoftNavs: true });  // reportSoftNavs:true 让库同时上报每条软导航指标（含 navigationId、attribution）\n\n' +
        '【Attribution】LCP element per soft nav；INP interaction target per soft nav；web-vitals/attribution 提供更细归因。\n\n' +
        '【完整上报 payload 示例（JSON）】\n' +
        JSON.stringify(samplePayload, null, 2),
    });
    this._addLog('report', '已展示软导航指标上报策略 + payload + Web Vitals 用法');
  }

  // 最佳实践 + 能力聚合矩阵
  _showBestPractices() {
    const caps = this._caps();
    const m = (b) => (b ? '✓' : '✗');
    const matrix = [
      `soft-navigation 条目支持：${m(caps.softNavEntry)}`, `Navigation API：${m(caps.navigation)}`,
      `performance.mark/measure：${m(caps.markMeasure)}`, `sendBeacon：${m(caps.sendBeacon)}`,
      `PerformanceObserver：${m(caps.performanceObserver)}`, `isInputPending：${m(caps.isInputPending)}`,
    ];
    this.setState({
      reportInfo:
        '===== 软导航最佳实践 + 能力聚合矩阵 =====\n\n' +
        '【最佳实践】\n' +
        '  1) 优先 Navigation API（navigate + intercept）而非 manual pushState —— 浏览器更易识别为软导航\n' +
        '  2) 确保内容变化可见（不仅是 URL 改变）—— 启发式要求可见 DOM 内容变化\n' +
        '  3) 避免过频繁软导航（节流 / debounce）—— 防止指标噪声与缓冲区溢出\n' +
        '  4) 预取/预渲染下一路由（Speculation Rules prefetch/prerender）—— 降低软导航 LCP\n' +
        '  5) 用 isInputPending 避免渲染阻塞输入 —— 提升 INP\n' +
        '  6) 上报时区分初始整页 vs 每软导航 —— 便于按路由聚合分析\n\n' +
        '【能力聚合矩阵（当前环境）】\n  ' + matrix.join('\n  ') + '\n\n' +
        '【降级策略】soft-navigation 不可用→mark/measure；Navigation API 不可用→pushState + 框架信号；sendBeacon 不可用→fetch(url,{keepalive:true})；PerformanceObserver 不可用→轮询 getEntriesByType\n\n' +
        '【上报时机】软导航完成时立即上报（navigatesuccess / setTimeout）；卸载时（pagehide / visibilitychange=hidden）用 sendBeacon 补发',
    });
    this._addLog('report', `展示最佳实践 + 能力聚合：${matrix.join('，')}`);
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 软导航分析上报与最佳实践',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['sendBeacon', 'sendBeacon'], ['softNavEntry', 'soft-nav entry']]),
        h(Tag, { color: 'primary' }, '三层上报 / Web Vitals'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '上报策略三层：1) 初始整页指标（traditional）；2) 每条软导航指标（per-soft-nav 的 LCP/INP/CLS）；3) 聚合（avg/median/P75 per route）。navigator.sendBeacon 卸载安全上报。Web Vitals 库 onLCP(cb, { reportSoftNavs: true }) / onCLS / onINP 同时上报每软导航指标。Attribution：每软导航的 LCP 元素与 INP 交互目标。最佳实践：优先 Navigation API、确保内容可见变化、节流、Speculation Rules 预取/预渲染、isInputPending 避免阻塞。能力聚合矩阵：soft-navigation 条目 / Navigation API / performance.mark / sendBeacon。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('上报 payload + Web Vitals', { type: 'primary', size: 'sm', onClick: () => this._showReportingPayload() }),
          this._btn('最佳实践 + 能力矩阵', { size: 'sm', onClick: () => this._showBestPractices() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '上报策略 / 最佳实践：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.reportInfo || '（点击「上报 payload + Web Vitals」或「最佳实践 + 能力矩阵」）')),
        h(Alert, {
          type: 'info',
          message: 'Web Vitals 库的 reportSoftNavs 选项是关键',
          description: 'web-vitals 库的 onLCP/onCLS/onINP 第三参数 { reportSoftNavs: true } 让库在每条软导航完成时回调，metric 对象含 navigationId 与 attribution（LCP 元素、INP 交互目标）。配合 sendBeacon 可实现 SPA 路由级 Core Web Vitals 监控。',
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
    return h('div', { class: 'page api-lab-page soft-navigation-page' },
      h('h2', { class: 'section-title' }, '软导航（Soft Navigation）深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'Soft Navigation 让 SPA 路由切换被浏览器视为新导航并重算 LCP/INP/CLS。本页演示软导航概念与检测、Navigation API 触发、LCP/INP 重算、PerformanceObserver 监听、pushState 协调与上报最佳实践。'),
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
