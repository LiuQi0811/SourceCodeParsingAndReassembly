// =====================================================================
// ViewTransitionsL2Page.js —— 跨文档 View Transitions (L2) 深入 实验室
// 演示 MDN：
//   1. Cross-document View Transitions (L2) 跨文档概览 —— 同文档(L1) vs 跨文档(L2)
//      document.startViewTransition / <meta name="view-transition"> /
//      HTTP 响应头 View-Transition: same-origin / @view-transition { navigation: auto }
//   2. pageswap 事件 —— PageSwapEvent.activation(NavigationActivation) /
//      PageSwapEvent.viewTransition(ViewTransitionTypes，仅 types Set) /
//      activation.navigationType('push'|'replace'|'reload'|'traverse') /
//      activation.from(URL) / activation.entry(NavigationHistoryEntry)
//   3. pagereveal 事件 —— PageRevealEvent.viewTransition(完整 ViewTransition:
//      ready/finished/updateCallbackDone/skipTransition/types) /
//      PageRevealEvent.activatedBy('pageswap'|null)
//   4. ViewTransition.types 与 CSS 定制 —— :active-view-transition-type() 伪类 /
//      @view-transition 规则 / ::view-transition-group(root) / types Set add/delete
//   5. 同源与跨源限制 —— same-origin 检测 / opt-in meta+HTTP 头 /
//      Permission Policy document.featurePolicy.allowsFeature('view-transition')
//   6. Navigation API 与 VT 协同 —— navigation.navigate / event.intercept /
//      startViewTransition({ update, types }) 跨文档→同文档降级
// 说明：跨文档 View Transitions (L2) 在 Chrome 124+ 才支持；同文档 L1 在 Chrome 111+。
//       所有 API 调用前做 typeof / 'xxx' in window 能力检测，不可用时仅记日志
//       （_addLog('warn'|'info', ...)），绝不抛异常。jsdom/Node 中 pageswap /
//       pagereveal / Navigation API 通常不可用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ViewTransitionsL2Page extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',    // Card 1：跨文档 View Transitions (L2) 概览
      pageswapInfo: '',    // Card 2：pageswap 事件
      pagerevealInfo: '',  // Card 3：pagereveal 事件
      typesCssInfo: '',    // Card 4：ViewTransition.types 与 CSS 定制
      sameOriginInfo: '',  // Card 5：同源与跨源限制
      navApiInfo: '',      // Card 6：Navigation API 与 VT 协同
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._pageswapHandler = null;        // Card 2 pageswap 监听器
    this._pagerevealHandler = null;      // Card 3 pagereveal 监听器
    this._transitionstartHandler = null; // Card 3 transitionstart 监听器
    this._navigateHandler = null;        // Card 6 navigate 监听器

    // 一次性能力检测：跨文档 View Transitions (L2) 全家桶
    const hasL1 = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
    const hasPageswap = typeof window !== 'undefined' && 'pageswap' in window;
    const hasPagereveal = typeof window !== 'undefined' && 'pagereveal' in window;
    const hasNavigation = typeof navigation !== 'undefined';
    let hasFeaturePolicy = false;
    try {
      hasFeaturePolicy = typeof document !== 'undefined' && !!document.featurePolicy
        && typeof document.featurePolicy.allowsFeature === 'function';
    } catch { /* noop */ }
    let allowsVT = false;
    if (hasFeaturePolicy) {
      try { allowsVT = document.featurePolicy.allowsFeature('view-transition'); } catch { /* noop */ }
    }
    let origin = '';
    try { origin = typeof location !== 'undefined' ? (location.origin || '') : ''; } catch { /* noop */ }

    const parts = [];
    parts.push(`L1 startViewTransition ${hasL1 ? '✓' : '✗'}`);
    parts.push(`L2 pageswap ${hasPageswap ? '✓' : '✗'}`);
    parts.push(`L2 pagereveal ${hasPagereveal ? '✓' : '✗'}`);
    parts.push(`Navigation API ${hasNavigation ? '✓' : '✗'}`);
    parts.push(`FeaturePolicy ${hasFeaturePolicy ? '✓' : '✗'}`);
    if (hasFeaturePolicy) parts.push(`allowsFeature('view-transition') ${allowsVT ? '✓' : '✗'}`);

    const anyL2 = hasPageswap || hasPagereveal;
    const summary = anyL2
      ? `跨文档 View Transitions (L2) 能力检测：${parts.join(' · ')}。当前环境支持部分 L2 事件，可注册真实监听器演示。`
      : `跨文档 View Transitions (L2) 能力检测：${parts.join(' · ')}。jsdom/Node 中 pageswap / pagereveal / Navigation API 通常不可用（Chrome 124+ 才支持 L2）；所有按钮点击仅记日志说明，不会抛异常。在真实浏览器（Chrome 124+）中打开可完整演示跨文档过渡。`;

    this.setState({ capsSummary: summary });
    this._addLog(anyL2 ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasL1) this._addLog('warn', 'document.startViewTransition 不可用（L1 同文档过渡，需 Chrome 111+）');
    if (!hasPageswap) this._addLog('warn', 'pageswap 事件不可用（L2 跨文档，需 Chrome 124+）');
    if (!hasPagereveal) this._addLog('warn', 'pagereveal 事件不可用（L2 跨文档，需 Chrome 124+）');
    if (!hasNavigation) this._addLog('warn', 'Navigation API 不可用（typeof navigation === "undefined"）');
    if (origin) this._addLog('info', `当前 location.origin = ${origin}（同源检测基准：scheme+host+port）`);
  }

  componentWillUnmount() {
    // 移除所有事件监听器：pageswap / pagereveal / transitionstart / navigate
    const detach = (target, type, handler) => {
      if (target && handler && typeof target.removeEventListener === 'function') {
        try { target.removeEventListener(type, handler); } catch { /* noop */ }
      }
    };
    try { detach(window, 'pageswap', this._pageswapHandler); } catch { /* noop */ }
    try { detach(window, 'pagereveal', this._pagerevealHandler); } catch { /* noop */ }
    try { detach(window, 'transitionstart', this._transitionstartHandler); } catch { /* noop */ }
    try { detach(navigation, 'navigate', this._navigateHandler); } catch { /* noop */ }
    this._pageswapHandler = null;
    this._pagerevealHandler = null;
    this._transitionstartHandler = null;
    this._navigateHandler = null;
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
    const hasL1 = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
    const hasPageswap = typeof window !== 'undefined' && 'pageswap' in window;
    const hasPagereveal = typeof window !== 'undefined' && 'pagereveal' in window;
    const hasNavigation = typeof navigation !== 'undefined';
    let allowsVT = false;
    try {
      allowsVT = typeof document !== 'undefined' && !!document.featurePolicy
        && typeof document.featurePolicy.allowsFeature === 'function'
        && document.featurePolicy.allowsFeature('view-transition');
    } catch { /* noop */ }
    return { l1: hasL1, pageswap: hasPageswap, pagereveal: hasPagereveal, navigation: hasNavigation, allowsVT };
  }

  // =================== Card 1：跨文档 View Transitions (L2) 概览 ===================

  // L1 vs L2 架构对比 + 能力检测
  _showOverview() {
    const caps = this._caps();
    this.setState({ overviewInfo:
      '===== View Transitions L1（同文档）vs L2（跨文档）=====\n\n' +
      '【L1 同文档（Same-document）】\n' +
      '  入口：document.startViewTransition(callback) → ViewTransition\n' +
      '  适用：SPA 路由切换（前端框架路由），不触发整页导航\n' +
      '  机制：JS callback 控制何时更新 DOM，浏览器捕获旧/新快照交叉淡入\n' +
      '  时序：updateCallbackDone → ready → finished（三个 Promise）\n' +
      `  检测：typeof document.startViewTransition === 'function' → ${caps.l1}\n\n` +
      '【L2 跨文档（Cross-document）】\n' +
      '  触发：浏览器在整页导航（MPA）时自动触发，无需 JS 调用 startViewTransition\n' +
      '  适用：传统多页应用（MPA），服务器渲染页面间的跳转\n' +
      '  机制：浏览器控制整页加载 + 应用过渡（旧页快照 → 新页首绘）\n' +
      '  opt-in：两页都通过 <meta name="view-transition" content="same-origin">\n' +
      '          或 HTTP 响应头 View-Transition: same-origin 声明启用\n' +
      '  要求：同源（scheme+host+port 匹配）、两页都 opt-in、非下载、未被 Navigation API intercept\n' +
      `  检测：'pageswap' in window → ${caps.pageswap}；'pagereveal' in window → ${caps.pagereveal}\n\n` +
      '【架构差异】\n' +
      '  L1：JS callback 控制 DOM swap；浏览器只负责动画\n' +
      '  L2：浏览器控制整页加载 + 动画；JS 只能通过 pageswap/pagereveal 钩子定制 types\n' +
      '  兼容：L1 = Chrome 111+；L2 = Chrome 124+' });
    this._addLog('overview', `L1/L2 架构对比：L1=${caps.l1}, pageswap=${caps.pageswap}, pagereveal=${caps.pagereveal}`);
  }

  // 检测 L1 能力并展示 startViewTransition 签名（不真正调用，避免污染当前页）
  _detectL1() {
    const caps = this._caps();
    if (!caps.l1) {
      this.setState({ overviewInfo:
        'L1 同文档 View Transitions 不可用（typeof document.startViewTransition === "undefined"）。\n请用 Chrome 111+ 真实浏览器打开本页。\n\n' +
        'L1 用法（仅说明）：\n  const t = document.startViewTransition(() => { el.textContent = "new"; });\n' +
        '  t.updateCallbackDone.then(() => /* DOM 已更新 */);\n  t.ready.then(() => /* 动画开始 */);\n  t.finished.then(() => /* 过渡完成 */);\n\n' +
        '说明：L1 由 JS 显式调用 startViewTransition；L2 由浏览器在导航时自动触发。' });
      this._addLog('warn', 'L1 startViewTransition 不可用，已记录用法说明');
      return;
    }
    this.setState({ overviewInfo:
      'L1 同文档 View Transitions 可用：typeof document.startViewTransition === "function" ✓\n\n' +
      'startViewTransition 签名（两种重载）：\n' +
      '  1) document.startViewTransition(callback?: () => void) → ViewTransition —— 传统形式\n' +
      '  2) document.startViewTransition({ update: callback, types: new Set(["forward"]) }) → ViewTransition —— 新形式（Chrome 125+）\n\n' +
      'ViewTransition 对象：.updateCallbackDone / .ready / .finished（三个 Promise）、.skipTransition()、.types（ViewTransitionTypes Set，Chrome 125+）\n\n' +
      '说明：本演示不真正调用 startViewTransition（避免污染当前页 DOM）；L1 用法详见 WebGPUViewTransitionsPage 的 Card 4（同文档 L1 已覆盖）。' });
    this._addLog('overview', 'L1 startViewTransition 可用，已展示签名（不真正调用）');
  }

  // 构造 L2 opt-in 的 meta 标签与 HTTP 头说明
  _showOptIn() {
    this.setState({ overviewInfo:
      'L2 跨文档 View Transitions 的 opt-in 方式（两页都需声明）：\n\n' +
      '【方式 1：HTML <meta> 标签】\n  <meta name="view-transition" content="same-origin">\n  放在 <head> 内，声明本页参与同源跨文档过渡。\n\n' +
      '【方式 2：HTTP 响应头】\n  View-Transition: same-origin\n  在服务器响应头中声明，效果与 meta 等价（优先级：HTTP 头 > meta）。\n\n' +
      '【方式 3：CSS opt-in（@view-transition 规则）】\n  @view-transition { navigation: auto; }\n  放在两页的 CSS 中，是规范定义的 CSS 层面 opt-in。\n\n' +
      '【要求】\n  1) 同源（scheme+host+port 完全匹配）\n  2) 两页都 opt-in（任一页未声明则不触发过渡）\n  3) 导航不是下载（Content-Disposition: attachment）\n  4) 未被 Navigation API 的 event.intercept() 拦截（拦截则降级为 L1）\n  5) 跨源 iframe 内不能使用（仅顶层框架）' });
    this._addLog('overview', '已展示 L2 opt-in 的 meta / HTTP 头 / @view-transition 三种方式');
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. View Transitions L2 跨文档概览',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.l1 ? 'success' : 'error' }, caps.l1 ? 'L1 ✓' : 'L1 ✗'),
        h(Tag, { color: caps.pageswap ? 'success' : 'error' }, caps.pageswap ? 'pageswap ✓' : 'pageswap ✗'),
        h(Tag, { color: caps.pagereveal ? 'success' : 'error' }, caps.pagereveal ? 'pagereveal ✓' : 'pagereveal ✗'),
        h(Tag, { color: 'primary' }, '同文档 vs 跨文档'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '同文档（L1）用 document.startViewTransition(callback) 在 SPA 内手动触发过渡，JS callback 控制 DOM swap；跨文档（L2）由浏览器在整页导航（MPA）时自动触发，两页通过 <meta name="view-transition" content="same-origin"> 或 HTTP 头 View-Transition: same-origin 声明启用。L2 要求同源、两页都 opt-in、非下载、未被 Navigation API intercept。架构差异：L1 = JS 控制 DOM swap + 浏览器做动画；L2 = 浏览器控制整页加载 + 动画，JS 仅能通过 pageswap/pagereveal 钩子定制 types。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('L1 vs L2 对比', { type: 'primary', size: 'sm', onClick: () => this._showOverview() }),
          this._btn('检测 L1 能力', { size: 'sm', onClick: () => this._detectL1() }),
          this._btn('L2 opt-in 方式', { size: 'sm', onClick: () => this._showOptIn() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'L1/L2 概览与能力：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「L1 vs L2 对比」或对应按钮）')),
        h(Alert, {
          type: 'info',
          message: 'L2 跨文档过渡由浏览器自动驱动',
          description: 'L1 需要 JS 显式调用 startViewTransition；L2 由浏览器在导航时自动捕获旧页快照并应用到新页首绘。JS 无法直接 "启动" L2，只能在 pageswap（旧页）与 pagereveal（新页）事件中定制 types 与是否 skipTransition。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：pageswap 事件 ===================

  // 注册 pageswap 监听器，记录 activation + viewTransition.types
  _registerPageswap() {
    const caps = this._caps();
    if (!caps.pageswap) {
      this.setState({ pageswapInfo:
        'pageswap 事件不可用（"pageswap" in window === false）。\n请用 Chrome 124+ 真实浏览器，并确保两页都 opt-in。\n\n' +
        'pageswap 用法（仅说明）：\n  window.addEventListener("pageswap", (event) => {\n' +
        '    const activation = event.activation;          // NavigationActivation\n' +
        '    console.log(activation.navigationType);       // "push"|"replace"|"reload"|"traverse"\n' +
        '    console.log(activation.from.href);            // 旧页 URL\n' +
        '    console.log(activation.entry);                // NavigationHistoryEntry\n' +
        '    if (event.viewTransition) { event.viewTransition.types.add("forward"); }\n  });\n\n' +
        '说明：pageswap 是唯一能从"旧页（即将被替换的页）"定制跨文档过渡的钩子。' });
      this._addLog('warn', 'pageswap 不可用，已记录用法说明');
      return;
    }
    try {
      if (this._pageswapHandler && typeof window.removeEventListener === 'function') {
        try { window.removeEventListener('pageswap', this._pageswapHandler); } catch { /* noop */ }
      }
      this._pageswapHandler = (event) => {
        try {
          const activation = event.activation || {};
          const navType = activation.navigationType || '(未知)';
          const fromUrl = activation.from ? activation.from.href : '(无)';
          const entryKey = activation.entry ? (activation.entry.key || '(无 key)') : '(无 entry)';
          const hasVT = !!event.viewTransition;
          let typesLine = '';
          if (hasVT && event.viewTransition.types) {
            try { typesLine = `；types=[${Array.from(event.viewTransition.types).join(', ')}]`; } catch { /* noop */ }
          }
          this._addLog('pageswap', `pageswap 触发：navigationType=${navType}，from=${fromUrl}${typesLine}`);
          this.setState({ pageswapInfo:
            `pageswap 事件触发 ✓\n  event.activation.navigationType = ${navType}（push|replace|reload|traverse）\n` +
            `  event.activation.from = ${fromUrl}\n  event.activation.entry.key = ${entryKey}（NavigationHistoryEntry）\n` +
            `  event.viewTransition ${hasVT ? '存在（ViewTransitionTypes）' : '不存在'}${typesLine}\n\n` +
            '说明：pageswap 在旧页"即将被替换"前触发，是唯一能从旧页定制 types 的钩子。\n' +
            '  通过 event.viewTransition.types.add("forward") 添加自定义类型，配合 CSS :active-view-transition-type() 定制动画。' });
        } catch (err) {
          this._addLog('warn', `pageswap 处理抛错：${err.name} - ${err.message}`);
        }
      };
      window.addEventListener('pageswap', this._pageswapHandler);
      this._addLog('pageswap', '已注册 pageswap 监听器（导航时触发，当前页测试环境不会真实触发）');
      this.setState({ pageswapInfo:
        '已注册 pageswap 监听器 ✓\n\n' +
        'PageSwapEvent 属性：\n  .activation: NavigationActivation —— 包含 navigationType / from / entry\n' +
        '  .viewTransition: ViewTransitionTypes —— 注意：是 ViewTransitionTypes（仅 types Set），\n    不是完整 ViewTransition 对象（没有 ready/finished/skipTransition）\n\n' +
        'NavigationActivation 属性：\n  .navigationType: "push" | "replace" | "reload" | "traverse"\n  .from: URL —— 旧页 URL\n  .entry: NavigationHistoryEntry —— 新页历史条目（含 key/url/...）\n\n' +
        '说明：在真实浏览器中导航到其他 opt-in 页面时才会触发；当前测试环境不会真实触发。\n  这是唯一能从"旧页"定制跨文档过渡的钩子（旧页即将卸载，只能改 types）。' });
    } catch (err) {
      this._addLog('warn', `注册 pageswap 监听器失败：${err.name} - ${err.message}`);
    }
  }

  // 展示 pageswap 中修改 types 的代码模板
  _showPageswapTypesCode() {
    this.setState({ pageswapInfo:
      'pageswap 中定制 types 的代码模板：\n\n  window.addEventListener("pageswap", (event) => {\n' +
      '    if (!event.viewTransition) return;  // 无跨文档过渡则跳过\n' +
      '    const navType = event.activation?.navigationType;\n' +
      '    // 根据导航类型添加不同 type，配合 CSS 实现不同动画方向\n' +
      '    if (navType === "traverse" && navigation.currentEntry.index < event.activation.from.index) {\n' +
      '      event.viewTransition.types.add("back");     // 后退：左滑\n    } else {\n' +
      '      event.viewTransition.types.add("forward");  // 前进：右滑\n    }\n' +
      '    if (navType === "reload") { event.viewTransition.types.add("reload"); }  // 刷新：淡入\n  });\n\n' +
      '说明：\n  - event.viewTransition.types 是 ViewTransitionTypes（Set-like），支持 add/delete/clear/has\n' +
      '  - 添加的 type 会被 CSS 的 :active-view-transition-type(forward) 等选择器匹配\n' +
      '  - pageswap 中的 types 是"传出页"的；pagereveal 中的 types 是"传入页"的（两页可分别定制）\n' +
      '  - 注意：pageswap 的 event.viewTransition 不是完整 ViewTransition，没有 skipTransition()' });
    this._addLog('pageswap', '已展示 pageswap 定制 types 的代码模板');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. pageswap 事件',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.pageswap ? 'success' : 'error' }, caps.pageswap ? 'pageswap ✓' : 'pageswap ✗'),
        h(Tag, { color: 'primary' }, 'PageSwapEvent / NavigationActivation'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.addEventListener("pageswap", (event) => {...}) 在旧页"即将被替换"前触发。PageSwapEvent.activation 是 NavigationActivation，含 .navigationType（"push"|"replace"|"reload"|"traverse"）、.from（旧页 URL）、.entry（NavigationHistoryEntry）。PageSwapEvent.viewTransition 是 ViewTransitionTypes（注意：仅 types Set，不是完整 ViewTransition 对象，没有 ready/finished/skipTransition）。通过 event.viewTransition.types.add("forward") 添加自定义类型，配合 CSS :active-view-transition-type() 定制动画。这是唯一能从旧页定制跨文档过渡的钩子。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注册 pageswap', { type: 'primary', size: 'sm', disabled: !caps.pageswap, onClick: () => this._registerPageswap() }),
          this._btn('types 代码模板', { size: 'sm', onClick: () => this._showPageswapTypesCode() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'pageswap 事件信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.pageswapInfo || '（点击「注册 pageswap」开始监听，或查看 types 代码模板）')),
        h(Alert, {
          type: 'warning',
          message: 'pageswap 的 viewTransition 不是完整 ViewTransition',
          description: 'PageSwapEvent.viewTransition 是 ViewTransitionTypes（仅 types Set），没有 ready/finished/updateCallbackDone/skipTransition。要 skipTransition 或 await finished，需在新页的 pagereveal 事件中操作（那里的 event.viewTransition 才是完整对象）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：pagereveal 事件 ===================

  // 注册 pagereveal + transitionstart 监听器
  _registerPagereveal() {
    const caps = this._caps();
    if (!caps.pagereveal) {
      this.setState({ pagerevealInfo:
        'pagereveal 事件不可用（"pagereveal" in window === false）。\n请用 Chrome 124+ 真实浏览器，并确保两页都 opt-in。\n\n' +
        'pagereveal 用法（仅说明）：\n  window.addEventListener("pagereveal", async (event) => {\n' +
        '    console.log(event.activatedBy);  // "pageswap" | null\n' +
        '    const vt = event.viewTransition; // 完整 ViewTransition 对象！\n' +
        '    if (vt) { vt.types.add("forward"); await vt.ready; await vt.finished; /* vt.skipTransition(); */ }\n  });\n\n' +
        '说明：pagereveal 在新页"首次显示"前触发，event.viewTransition 是完整对象。' });
      this._addLog('warn', 'pagereveal 不可用，已记录用法说明');
      return;
    }
    try {
      if (this._pagerevealHandler && typeof window.removeEventListener === 'function') {
        try { window.removeEventListener('pagereveal', this._pagerevealHandler); } catch { /* noop */ }
      }
      if (this._transitionstartHandler && typeof window.removeEventListener === 'function') {
        try { window.removeEventListener('transitionstart', this._transitionstartHandler); } catch { /* noop */ }
      }
      this._pagerevealHandler = (event) => {
        try {
          const activatedBy = event.activatedBy;
          const hasVT = !!event.viewTransition;
          let typesLine = '';
          let readyLine = '';
          if (hasVT && event.viewTransition.types) {
            try { typesLine = `；types=[${Array.from(event.viewTransition.types).join(', ')}]`; } catch { /* noop */ }
          }
          if (hasVT && event.viewTransition.ready) {
            event.viewTransition.ready.then(() => this._addLog('pagereveal', 'viewTransition.ready resolve（过渡动画开始）'))
              .catch((e) => this._addLog('warn', `viewTransition.ready reject：${e.message}`));
            readyLine = '\n  已挂 ready 监听（resolve 后记日志）';
          }
          if (hasVT && event.viewTransition.finished) {
            event.viewTransition.finished.then(() => this._addLog('pagereveal', 'viewTransition.finished resolve（过渡动画完成）'))
              .catch((e) => this._addLog('warn', `viewTransition.finished reject：${e.message}`));
          }
          this._addLog('pagereveal', `pagereveal 触发：activatedBy=${activatedBy}，viewTransition ${hasVT ? '存在' : '不存在'}${typesLine}`);
          this.setState({ pagerevealInfo:
            `pagereveal 事件触发 ✓\n  event.activatedBy = ${activatedBy}（"pageswap" 表示有旧页过渡；null 表示首次加载无过渡）\n` +
            `  event.viewTransition ${hasVT ? '存在（完整 ViewTransition 对象）' : '不存在'}${typesLine}${readyLine}\n\n` +
            `PageRevealEvent 属性：\n  .viewTransition: ViewTransition —— 完整对象（有 ready/finished/updateCallbackDone/skipTransition/types）\n  .activatedBy: "pageswap" | null\n\n` +
            `可在此：1) skipTransition() 跳过动画  2) types.add() 修改 types  3) await ready 等过渡开始  4) await finished 等过渡完成` });
        } catch (err) {
          this._addLog('warn', `pagereveal 处理抛错：${err.name} - ${err.message}`);
        }
      };
      this._transitionstartHandler = (event) => {
        try {
          const name = event && event.propertyName ? event.propertyName : '(未知)';
          this._addLog('pagereveal', `transitionstart 触发：propertyName=${name}`);
        } catch { /* noop */ }
      };
      window.addEventListener('pagereveal', this._pagerevealHandler);
      try { window.addEventListener('transitionstart', this._transitionstartHandler); } catch { /* noop */ }
      this._addLog('pagereveal', '已注册 pagereveal + transitionstart 监听器');
      this.setState({ pagerevealInfo:
        '已注册 pagereveal + transitionstart 监听器 ✓\n\n' +
        'PageRevealEvent 属性：\n  .viewTransition: ViewTransition —— 完整对象（有 ready/finished/updateCallbackDone/skipTransition/types）\n  .activatedBy: "pageswap" | null —— 是否由旧页 pageswap 触发\n\n' +
        '时序：pageswap(旧页) → 整页导航 → pagereveal(新页) → 过渡动画运行 → finished\n  pageswap 在旧页"即将被替换"前；pagereveal 在新页"首次显示"前（first paint 之前）\n\n' +
        '可在此：1) skipTransition() 跳过动画  2) types.add() 修改 types  3) await ready 等过渡开始  4) await finished 等过渡完成\n\n' +
        '说明：当前测试环境不会真实触发（需真实浏览器跨页导航）。' });
    } catch (err) {
      this._addLog('warn', `注册 pagereveal 监听器失败：${err.name} - ${err.message}`);
    }
  }

  // 展示 pagereveal 中 skipTransition / await finished 的代码模板
  _showPagerevealCode() {
    this.setState({ pagerevealInfo:
      'pagereveal 中操作完整 ViewTransition 的代码模板：\n\n  window.addEventListener("pagereveal", async (event) => {\n' +
        '    if (event.activatedBy !== "pageswap") return;  // 首次加载无需定制\n' +
        '    const vt = event.viewTransition;  // 完整 ViewTransition 对象\n    if (!vt) return;\n\n' +
        '    // 1) 修改 types 定制 CSS（与 pageswap 中的 types 合并生效）\n    vt.types.add("forward");\n\n' +
        '    // 2) 可选：跳过动画（仅显示新页，不播放过渡）\n    // vt.skipTransition();\n\n' +
        '    // 3) 等过渡动画开始\n    await vt.ready;  console.log("过渡开始");\n\n' +
        '    // 4) 等过渡动画完成\n    await vt.finished;  console.log("过渡完成");\n  });\n\n' +
        '时序：旧页 pageswap → 浏览器导航 → 新页 pagereveal → vt.ready → 动画 → vt.finished\n\n' +
        '说明：\n  - pagereveal 的 event.viewTransition 是完整 ViewTransition（有 ready/finished/skipTransition）\n' +
        '  - 与 pageswap 的 ViewTransitionTypes 不同（后者只有 types Set）\n' +
        '  - activatedBy === "pageswap" 表示存在旧页过渡；null 表示首次加载（无过渡可定制）' });
    this._addLog('pagereveal', '已展示 pagereveal 操作完整 ViewTransition 的代码模板');
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. pagereveal 事件',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.pagereveal ? 'success' : 'error' }, caps.pagereveal ? 'pagereveal ✓' : 'pagereveal ✗'),
        h(Tag, { color: 'primary' }, 'PageRevealEvent / 完整 ViewTransition'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.addEventListener("pagereveal", (event) => {...}) 在新页"首次显示"前（first paint 之前）触发。PageRevealEvent.viewTransition 是完整 ViewTransition 对象（有 .ready/.finished/.updateCallbackDone/.skipTransition()/.types），与 pageswap 的 ViewTransitionTypes 不同。PageRevealEvent.activatedBy 为 "pageswap"（有旧页过渡）或 null（首次加载）。可在此：1) 调用 skipTransition() 跳过动画；2) 修改 types Set；3) await ready 等过渡开始；4) await finished 等过渡完成。时序：pageswap(旧页) → 导航 → pagereveal(新页) → 过渡运行 → finished。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注册 pagereveal', { type: 'primary', size: 'sm', disabled: !caps.pagereveal, onClick: () => this._registerPagereveal() }),
          this._btn('代码模板', { size: 'sm', onClick: () => this._showPagerevealCode() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'pagereveal 事件信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.pagerevealInfo || '（点击「注册 pagereveal」开始监听，或查看代码模板）')),
        h(Alert, {
          type: 'info',
          message: 'pagereveal 的 viewTransition 是完整对象',
          description: '与 pageswap 的 ViewTransitionTypes 不同，pagereveal 的 event.viewTransition 是完整 ViewTransition：有 ready/finished/updateCallbackDone/skipTransition/types。因此 skipTransition()、await ready、await finished 都只能在 pagereveal 中调用，不能在 pageswap 中调用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：ViewTransition.types 与 CSS 定制 ===================

  // 展示 types 与 CSS :active-view-transition-type() 的配合
  _showTypesCss() {
    this.setState({ typesCssInfo:
      '===== ViewTransition.types 与 CSS 定制 =====\n\n' +
      '【types Set 的来源】\n  pageswap: event.viewTransition.types（ViewTransitionTypes，仅 Set）\n' +
      '  pagereveal: event.viewTransition.types（完整 ViewTransition 的 types 属性）\n' +
      '  L1 同文档: document.startViewTransition({ update, types: new Set(["forward"]) })\n' +
      '            或 startViewTransition(callback) 后 t.types.add("forward")\n\n' +
      '【CSS opt-in 跨文档过渡】\n  @view-transition { navigation: auto; }  /* 两页 CSS 都需声明 */\n\n' +
      '【CSS 匹配 types —— :active-view-transition-type() 伪类】\n' +
      '  ::view-transition-group(root) { animation-duration: 0.4s; }  /* 默认 */\n' +
      '  :active-view-transition-type(forward) ::view-transition-group(root) { animation-name: slide-from-right; }  /* 右滑进入 */\n' +
      '  :active-view-transition-type(back) ::view-transition-group(root) { animation-name: slide-to-left; }  /* 左滑退出 */\n' +
      '  :active-view-transition-type(reload) ::view-transition-old(root),\n  :active-view-transition-type(reload) ::view-transition-new(root) { animation-name: fade; }  /* 淡入 */\n\n' +
      '【关键帧定义】\n  @keyframes slide-from-right { from { transform: translateX(100%); } to { transform: translateX(0); } }\n' +
      '  @keyframes slide-to-left { from { transform: translateX(0); } to { transform: translateX(-100%); } }' });
    this._addLog('types', '已展示 types 与 :active-view-transition-type() CSS 配合');
  }

  // 展示在 pageswap / pagereveal / L1 中设置 types 的代码
  _showSetTypesCode() {
    this.setState({ typesCssInfo:
      '在三种场景中设置 types 的代码：\n\n' +
      '【场景 1：pageswap（旧页，跨文档 L2）】\n  window.addEventListener("pageswap", (event) => {\n' +
      '    if (!event.viewTransition) return;\n' +
      '    const fromIdx = event.activation.from?.index ?? 0;\n' +
      '    const curIdx = navigation.currentEntry?.index ?? 0;\n' +
      '    event.viewTransition.types.add(curIdx < fromIdx ? "back" : "forward");\n  });\n\n' +
      '【场景 2：pagereveal（新页，跨文档 L2）】\n  window.addEventListener("pagereveal", (event) => {\n' +
      '    if (event.activatedBy !== "pageswap") return;\n' +
      '    const vt = event.viewTransition;\n    if (vt) vt.types.add("forward");\n  });\n\n' +
      '【场景 3：L1 同文档（startViewTransition 新重载）】\n' +
      '  // Chrome 125+ 新重载：直接传 { update, types }\n' +
      '  document.startViewTransition({ update: () => { el.textContent = "new"; }, types: new Set(["forward"]) });\n' +
      '  // 或旧重载 + 手动 add\n  const t = document.startViewTransition(() => { el.textContent = "new"; });\n  t.types.add("forward");\n\n' +
      '【types API（ViewTransitionTypes，Set-like）】\n  .add(type) / .delete(type) / .has(type) / .clear() / .size / [Symbol.iterator]\n' +
      '  允许的 type：任意字符串（建议用语义化名称如 "forward"/"back"/"reload"/"modal-open"）' });
    this._addLog('types', '已展示 pageswap/pagereveal/L1 三种场景设置 types 的代码');
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. ViewTransition.types 与 CSS 定制',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.l1 ? 'success' : 'error' }, caps.l1 ? 'L1 types ✓' : 'L1 types ✗'),
        h(Tag, { color: (caps.pageswap || caps.pagereveal) ? 'success' : 'error' }, (caps.pageswap || caps.pagereveal) ? 'L2 types ✓' : 'L2 types ✗'),
        h(Tag, { color: 'primary' }, ':active-view-transition-type()'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'types Set 控制 CSS 匹配：在 pageswap（ViewTransitionTypes）、pagereveal（完整 ViewTransition 的 types）或 L1 startViewTransition({ update, types }) 中 add 自定义类型字符串，CSS 用 :active-view-transition-type(forward) ::view-transition-group(root) { animation: ...; } 匹配。@view-transition { navigation: auto; } 是跨文档 opt-in 的 CSS 规则。常见模式：forward 右滑、back 左滑、reload 淡入。::view-transition-group(root) 包裹整体过渡，::view-transition-old/new(root) 是旧/新快照伪元素。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('types 与 CSS 配合', { type: 'primary', size: 'sm', onClick: () => this._showTypesCss() }),
          this._btn('设置 types 代码', { size: 'sm', onClick: () => this._showSetTypesCode() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'types 与 CSS 定制：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.typesCssInfo || '（点击「types 与 CSS 配合」或「设置 types 代码」）')),
        h(Alert, {
          type: 'info',
          message: 'types 是跨文档过渡定制动画的唯一手段',
          description: 'L2 跨文档过渡无法用 JS 直接控制 DOM swap（浏览器自动加载新页），只能通过 types Set + CSS :active-view-transition-type() 伪类定制不同方向的动画。types 在 pageswap（旧页）与 pagereveal（新页）中都可设置，最终取并集匹配 CSS。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：同源与跨源限制 ===================

  // 检测同源 + opt-in + Permission Policy
  _detectSameOrigin() {
    let origin = '';
    let sameOriginCheck = '';
    try {
      origin = typeof location !== 'undefined' ? (location.origin || '') : '';
      sameOriginCheck = `当前 location.origin = ${origin || '(空)'}\n  同源 = scheme + host + port 三者完全匹配\n` +
        '  示例：https://a.com:443/page1 → https://a.com:443/page2 同源\n' +
        '        https://a.com → http://a.com 不同源（scheme 不同）\n' +
        '        https://a.com → https://b.com 不同源（host 不同）\n' +
        '        https://a.com:443 → https://a.com:8443 不同源（port 不同）';
    } catch (err) {
      sameOriginCheck = `location 访问失败：${err.message}`;
    }
    this.setState({ sameOriginInfo:
      '===== 同源与跨源限制 =====\n\n' +
      `${sameOriginCheck}\n\n` +
      '【跨文档 VT 触发条件（全部满足）】\n' +
      '  1) 同源：两页 origin（scheme+host+port）完全匹配\n' +
      '  2) 两页都 opt-in：HTML <meta> / HTTP 头 View-Transition: same-origin / CSS @view-transition { navigation: auto; }\n' +
      '  3) 导航不是下载（无 Content-Disposition: attachment）\n' +
      '  4) 未被 Navigation API 的 event.intercept() 拦截（拦截则降级为 L1）\n' +
      '  5) 仅顶层框架：跨源 iframe 内不能使用跨文档 VT\n' +
      '  6) Permission Policy 允许 view-transition（默认允许）\n\n' +
      '【降级规则】\n  - 若导航被 Navigation API intercept() 拦截 → 变为同文档（L1）过渡\n' +
      '  - 此时需在 intercept handler 内手动调用 document.startViewTransition()\n  - 跨源 iframe 的导航不会触发顶层跨文档 VT' });
    this._addLog('sameOrigin', `同源检测：location.origin=${origin || '(空)'}`);
  }

  // 检测 Permission Policy 与 opt-in 构造
  _detectPermissionPolicy() {
    const caps = this._caps();
    let policyLine = '';
    if (caps.allowsVT) {
      policyLine = 'document.featurePolicy.allowsFeature("view-transition") = true ✓（当前上下文允许 view-transition）';
    } else {
      const hasFP = typeof document !== 'undefined' && !!document.featurePolicy
        && typeof document.featurePolicy.allowsFeature === 'function';
      policyLine = hasFP
        ? 'document.featurePolicy.allowsFeature("view-transition") = false（被 Permission Policy 禁用）'
        : 'document.featurePolicy 不可用（typeof undefined，jsdom 通常无；真实浏览器中可检测）';
    }
    this.setState({ sameOriginInfo:
      'Permission Policy 与 opt-in 构造：\n\n' +
      `【Permission Policy 检测】\n  ${policyLine}\n\n` +
      '【opt-in 构造示例（三种等价方式，任选其一，两页都需声明）】\n\n' +
      '方式 1：HTML meta 标签\n  <meta name="view-transition" content="same-origin">\n  放在 <head> 内。\n\n' +
      '方式 2：HTTP 响应头（服务器配置）\n  View-Transition: same-origin\n  # Nginx: add_header View-Transition "same-origin";\n  # Express: res.setHeader("View-Transition", "same-origin");\n\n' +
      '方式 3：CSS @view-transition 规则\n  @view-transition { navigation: auto; }\n\n' +
      '【Permission Policy 控制】\n  HTTP 头：Permissions-Policy: view-transition=(self)\n  允许跨源 iframe 使用：view-transition=(self "https://iframe-origin.com")\n  检测：document.featurePolicy.allowsFeature("view-transition")\n\n' +
      '【安全模型】\n  - 同源要求防止泄露跨源页面结构（避免攻击者通过过渡动画推断跨源页内容）\n  - 两页都 opt-in 确保双方都同意参与过渡\n  - 跨源 iframe 默认禁用，需显式 Permission Policy 授权' });
    this._addLog('sameOrigin', `Permission Policy 检测：allowsVT=${caps.allowsVT}`);
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. 同源与跨源限制',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.allowsVT ? 'success' : 'warning' }, caps.allowsVT ? 'allowsFeature ✓' : 'FeaturePolicy n/a'),
        h(Tag, { color: 'primary' }, 'same-origin / opt-in'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '跨文档 View Transitions 要求：1) 同源（scheme+host+port 完全匹配）；2) 两页都 opt-in（<meta name="view-transition" content="same-origin"> 或 HTTP 头 View-Transition: same-origin 或 CSS @view-transition { navigation: auto; }）；3) 非下载导航；4) 未被 Navigation API event.intercept() 拦截（拦截则降级为 L1）；5) 仅顶层框架，跨源 iframe 内不能使用；6) Permission Policy 允许 view-transition（document.featurePolicy.allowsFeature("view-transition")）。安全模型：同源要求防止泄露跨源页面结构。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('同源检测', { type: 'primary', size: 'sm', onClick: () => this._detectSameOrigin() }),
          this._btn('Permission Policy', { size: 'sm', onClick: () => this._detectPermissionPolicy() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '同源与跨源限制：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.sameOriginInfo || '（点击「同源检测」或「Permission Policy」）')),
        h(Alert, {
          type: 'warning',
          message: 'Navigation API intercept 会把 L2 降级为 L1',
          description: '若导航被 navigation.addEventListener("navigate", e => e.intercept({...})) 拦截，浏览器不会执行整页加载，跨文档过渡（L2）不触发；需在 intercept handler 内手动调用 document.startViewTransition() 实现同文档过渡（L1）。这是 SPA 用 Navigation API 时常见的"降级"路径。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：Navigation API 与 VT 协同 ===================

  // 注册 Navigation API navigate 监听器
  _registerNavigate() {
    const caps = this._caps();
    if (!caps.navigation) {
      this.setState({ navApiInfo:
        'Navigation API 不可用（typeof navigation === "undefined"）。\n请用 Chrome 102+ 真实浏览器。\n\n' +
        'Navigation API 用法（仅说明）：\n  navigation.addEventListener("navigate", (event) => {\n' +
        '    // event.navigationType: "push"|"replace"|"reload"|"traverse"\n    // event.destination.url: 目标 URL\n' +
        '    if (event.canIntercept) {\n      event.intercept({\n        handler: async () => {\n' +
        '          // 在此更新 DOM（SPA 路由），可调用 document.startViewTransition() 实现同文档过渡\n        },\n      });\n    }\n  });\n\n' +
        '说明：intercept 后导航变为同文档（L1），需手动 startViewTransition。' });
      this._addLog('warn', 'Navigation API 不可用，已记录用法说明');
      return;
    }
    try {
      if (this._navigateHandler && typeof navigation.removeEventListener === 'function') {
        try { navigation.removeEventListener('navigate', this._navigateHandler); } catch { /* noop */ }
      }
      this._navigateHandler = (event) => {
        try {
          const navType = event.navigationType || '(未知)';
          const destUrl = event.destination && event.destination.url ? event.destination.url : '(无)';
          const canIntercept = !!event.canIntercept;
          this._addLog('navigate', `navigate 触发：navigationType=${navType}，destination=${destUrl}，canIntercept=${canIntercept}`);
          this.setState({ navApiInfo:
            `navigation.navigate 事件触发 ✓\n  event.navigationType = ${navType}\n  event.destination.url = ${destUrl}\n  event.canIntercept = ${canIntercept}\n\n` +
            '说明：若调用 event.intercept({ handler })，导航变为同文档（L1），需在 handler 内手动 document.startViewTransition()。\n  不 intercept 则执行整页加载，触发跨文档（L2）过渡。' });
        } catch (err) {
          this._addLog('warn', `navigate 处理抛错：${err.name} - ${err.message}`);
        }
      };
      navigation.addEventListener('navigate', this._navigateHandler);
      this._addLog('navigate', '已注册 navigation.navigate 监听器');
      this.setState({ navApiInfo:
        '已注册 navigation.navigate 监听器 ✓\n\n' +
        'NavigateEvent 关键属性：\n  .navigationType: "push" | "replace" | "reload" | "traverse"\n  .destination: NavigationDestination（含 .url）\n' +
        '  .canIntercept: boolean —— 是否可 intercept\n  .intercept({ handler }): 拦截导航，变为同文档（L1）\n\n' +
        '说明：当前测试环境不会真实触发导航事件（需真实浏览器中点击链接/调用 navigation.navigate）。' });
    } catch (err) {
      this._addLog('warn', `注册 navigate 监听器失败：${err.name} - ${err.message}`);
    }
  }

  // 展示 L1/L2 两种路径的代码流程
  _showCodeFlow() {
    this.setState({ navApiInfo:
      '===== Navigation API 与 View Transitions 协同 =====\n\n' +
      '【路径 A：intercept → 同文档（L1）过渡】\n  navigation.addEventListener("navigate", (event) => {\n' +
      '    if (!event.canIntercept) return;  // 跨源导航不能 intercept\n    const isForward = event.navigationType === "push";\n' +
      '    event.intercept({\n      handler: async () => {\n' +
      '        // 在此更新 DOM（SPA 路由切换），用 L1 新重载传入 types（Chrome 125+）\n' +
      '        const t = document.startViewTransition({\n' +
      '          update: () => { renderNewPage(event.destination.url); },\n' +
      '          types: new Set([isForward ? "forward" : "back"]),\n        });\n        await t.finished;\n      },\n    });\n  });\n  // 结果：无整页加载，SPA 内 L1 过渡\n\n' +
      '【路径 B：不 intercept → 整页加载 → 跨文档（L2）过渡】\n  // 不调用 event.intercept()，浏览器执行整页导航\n  // 两页都 opt-in（<meta name="view-transition" content="same-origin">）\n' +
      '  // 旧页：\n  window.addEventListener("pageswap", (e) => { if (e.viewTransition) e.viewTransition.types.add("forward"); });\n' +
      '  // 新页：\n  window.addEventListener("pagereveal", (e) => { if (e.viewTransition) e.viewTransition.types.add("forward"); });\n' +
      '  // 结果：浏览器自动加载新页 + 应用 L2 过渡动画\n\n' +
      '【聚合检测矩阵】\n' +
      '  - L1: typeof document.startViewTransition === "function"（Chrome 111+）\n' +
      '  - L2: "pageswap" in window && "pagereveal" in window（Chrome 124+）\n' +
      '  - ViewTransition.types: typeof t.types === "object"（Chrome 125+）\n' +
      '  - Navigation API: typeof navigation !== "undefined"（Chrome 102+）\n' +
      '  - intercept: NavigateEvent.prototype.intercept（Chrome 102+）\n' +
      '  - Permission Policy: document.featurePolicy.allowsFeature("view-transition")\n' +
      '  - @view-transition CSS: CSS supports 检测（@view-transition 规则）' });
    this._addLog('nav', '已展示 Navigation API 与 VT 协同的两种代码路径 + 检测矩阵');
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. Navigation API 与 VT 协同',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.navigation ? 'success' : 'error' }, caps.navigation ? 'navigation ✓' : 'navigation ✗'),
        h(Tag, { color: caps.l1 ? 'success' : 'error' }, caps.l1 ? 'L1 ✓' : 'L1 ✗'),
        h(Tag, { color: 'primary' }, 'intercept / 降级'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '使用 Navigation API navigation.addEventListener("navigate", e => e.intercept({...})) 拦截导航后，导航变为同文档（L1）过渡——可在 intercept handler 内调用 document.startViewTransition({ update, types }) 实现过渡。不 intercept 则执行整页加载，触发跨文档（L2）过渡（需两页 opt-in）。NavigateEvent 的 navigationType（push/replace/reload/traverse）与 destination.url 帮助决定 transition types。跨文档在 pageswap/pagereveal 中加 types；同文档通过 startViewTransition 新重载 { update, types } 传入。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注册 navigate', { type: 'primary', size: 'sm', disabled: !caps.navigation, onClick: () => this._registerNavigate() }),
          this._btn('L1/L2 代码流程', { size: 'sm', onClick: () => this._showCodeFlow() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Navigation API 与 VT 协同：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.navApiInfo || '（点击「注册 navigate」或「L1/L2 代码流程」）')),
        h(Alert, {
          type: 'info',
          message: 'intercept 是 L2 → L1 降级的关键开关',
          description: 'Navigation API 的 event.intercept() 把整页导航转为 SPA 内导航，浏览器不再加载新页，因此跨文档过渡（L2）不触发。开发者需在 intercept handler 内手动调用 startViewTransition() 实现 L1 过渡。这是现代 SPA 借助 Navigation API 统一导航体验的推荐路径，types 可通过新重载 { update, types } 传入。',
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
    return h('div', { class: 'page api-lab-page view-transitions-l2-page' },
      h('h2', { class: 'section-title' }, '跨文档 View Transitions (L2) 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'View Transitions L2（跨文档）由浏览器在整页导航时自动触发过渡，区别于 L1（同文档，JS 手动 startViewTransition）。本页演示 pageswap/pagereveal 事件、ViewTransition.types 与 CSS :active-view-transition-type() 定制、同源与 opt-in 限制、Navigation API 协同。所有 API 调用前做能力检测，不可用时仅记日志，绝不抛异常。'),
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
