// =====================================================================
// NavigationAPIDeepPage.js —— Navigation API 深度实验室
// 演示 MDN：
//   1. Navigation API —— 现代客户端导航（替代 History API）
//      window.navigation / navigation.currentEntry（url/key/id/index/sameDocument/
//        type/getState/setState/dispose 事件）/ navigation.entries() /
//        canGoBack / canGoForward /
//        navigate(url,options) / reload / back / forward / traverseTo(key) /
//        updateCurrentEntry(options) —— 均返回 Promise<NavigationResult>={committed,fulfilled}
//      事件：navigate / navigatesuccess / navigateerror / currententrychange
//      navigate 事件：canTransition / canIntercept / userInitiated / hashChange /
//        navigationType / destination / signal / formData /
//        transitionWhile(promise) / intercept({ handler, focusReset })
//      options.transition：'push'（默认）| 'replace'；options.info：任意值
//   2. Fragment Directive —— #:~:text=... 文本片段指令（document.fragmentDirective，仅 Chrome）
//   3. Scroll Restoration —— history.scrollRestoration 'auto' | 'manual'
//   4. URL Hashchange + hashchange 事件（对比补充）：event.oldURL / event.newURL
//   5. pageswap / pagereveal 事件 —— 视图过渡跨文档
// 说明：jsdom/Node 中 window.navigation 与 document.fragmentDirective 通常为 undefined
//       （仅 Chrome 实现），history.scrollRestoration 与 hashchange 在 jsdom 中可能可用。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志，绝不抛异常。
//       演示不真正改变 URL（用 try/catch 包裹），避免影响测试环境。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class NavigationAPIDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：navigation 能力检测 + currentEntry
      currentEntryInfo: '',
      // Card 2：navigation.entries() 历史栈
      entriesInfo: '',
      // Card 3：navigate 事件拦截
      navigateEventInfo: '',
      navigateListening: false,
      // Card 4：navigate / reload / back / forward 方法
      navMethodInfo: '',
      // Card 5：fragmentDirective + Text Fragments
      fragmentInfo: '',
      // Card 6：scrollRestoration + hashchange
      scrollHashInfo: '',
      hashListening: false,
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各事件回调引用（componentWillUnmount 中移除）
    this._navigateHandler = null;           // navigate 事件回调
    this._navigatesuccessHandler = null;    // navigatesuccess 事件回调
    this._navigateerrorHandler = null;      // navigateerror 事件回调
    this._currententrychangeHandler = null; // currententrychange 事件回调
    this._disposeHandlers = [];             // 每个历史条目的 dispose 事件回调
    this._hashchangeHandler = null;         // hashchange 事件回调
    this._pageswapHandler = null;           // pageswap 事件回调
    this._pagerevealHandler = null;         // pagereveal 事件回调

    // 一次性能力检测：Navigation API 全家桶
    const hasNav = typeof navigation !== 'undefined' && navigation !== null;
    const nf = (m) => hasNav && typeof navigation[m] === 'function';
    const ne = (m) => hasNav && typeof navigation[m] !== 'undefined';
    const wf = (m) => typeof window !== 'undefined' && m in window;
    const caps = {
      navigation: hasNav, currentEntry: ne('currentEntry'), entries: nf('entries'),
      navigate: nf('navigate'), reload: nf('reload'), back: nf('back'), forward: nf('forward'),
      traverseTo: nf('traverseTo'), updateCurrentEntry: nf('updateCurrentEntry'),
      fragmentDirective: typeof document !== 'undefined' && typeof document.fragmentDirective !== 'undefined',
      scrollRestoration: typeof history !== 'undefined' && 'scrollRestoration' in history,
      hashchange: typeof window !== 'undefined' && typeof window.addEventListener === 'function',
      pageswap: wf('onpageswap'), pagereveal: wf('onpagereveal'),
    };
    const parts = Object.entries(caps).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`);

    const summary = caps.navigation
      ? `Navigation API 能力检测：${parts.join(' · ')}。当前环境支持 Navigation API，可读取 currentEntry / entries()，监听 navigate 等事件，并调用 navigate / reload / back / forward / traverseTo 方法。`
      : `Navigation API 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）window.navigation 通常为 undefined（仅 Chrome 实现 Navigation API），所有 Navigation 演示按钮点击将仅记日志说明，不会抛异常。请在真实 Chrome 浏览器中打开以完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(caps.navigation ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.fragmentDirective) this._addLog('warn', 'document.fragmentDirective 不可用（仅 Chrome 实现 Text Fragments）');
    if (!caps.scrollRestoration) this._addLog('warn', 'history.scrollRestoration 不可用');
    if (!caps.hashchange) this._addLog('warn', 'hashchange 事件不可用');
    if (!caps.pageswap) this._addLog('warn', 'pageswap 事件不可用（需支持跨文档视图过渡的浏览器）');
    if (!caps.pagereveal) this._addLog('warn', 'pagereveal 事件不可用（需支持跨文档视图过渡的浏览器）');
  }

  componentWillUnmount() {
    // 移除所有 navigation 事件监听器，避免内存泄漏
    if (typeof navigation !== 'undefined' && navigation) {
      if (this._navigateHandler) navigation.removeEventListener('navigate', this._navigateHandler);
      if (this._navigatesuccessHandler) navigation.removeEventListener('navigatesuccess', this._navigatesuccessHandler);
      if (this._navigateerrorHandler) navigation.removeEventListener('navigateerror', this._navigateerrorHandler);
      if (this._currententrychangeHandler) navigation.removeEventListener('currententrychange', this._currententrychangeHandler);
    }
    // 移除每个历史条目上的 dispose 监听
    if (this._disposeHandlers.length && typeof navigation !== 'undefined' && navigation) {
      for (const { entry, handler } of this._disposeHandlers) {
        try { entry.removeEventListener('dispose', handler); } catch { /* noop */ }
      }
    }
    // 移除 window 上的事件
    if (typeof window !== 'undefined') {
      if (this._hashchangeHandler) window.removeEventListener('hashchange', this._hashchangeHandler);
      if (this._pageswapHandler) window.removeEventListener('pageswap', this._pageswapHandler);
      if (this._pagerevealHandler) window.removeEventListener('pagereveal', this._pagerevealHandler);
    }
    // 释放引用，便于 GC
    this._navigateHandler = null;
    this._navigatesuccessHandler = null;
    this._navigateerrorHandler = null;
    this._currententrychangeHandler = null;
    this._disposeHandlers = [];
    this._hashchangeHandler = null;
    this._pageswapHandler = null;
    this._pagerevealHandler = null;
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
    const hasNav = typeof navigation !== 'undefined' && navigation !== null;
    return {
      navigation: hasNav,
      currentEntry: hasNav && typeof navigation.currentEntry !== 'undefined',
      entries: hasNav && typeof navigation.entries === 'function',
      navigate: hasNav && typeof navigation.navigate === 'function',
      reload: hasNav && typeof navigation.reload === 'function',
      back: hasNav && typeof navigation.back === 'function',
      forward: hasNav && typeof navigation.forward === 'function',
      traverseTo: hasNav && typeof navigation.traverseTo === 'function',
      updateCurrentEntry: hasNav && typeof navigation.updateCurrentEntry === 'function',
      fragmentDirective: typeof document !== 'undefined' && typeof document.fragmentDirective !== 'undefined',
      scrollRestoration: typeof history !== 'undefined' && 'scrollRestoration' in history,
      hashchange: typeof window !== 'undefined' && typeof window.addEventListener === 'function',
      pageswap: typeof window !== 'undefined' && 'onpageswap' in window,
      pagereveal: typeof window !== 'undefined' && 'onpagereveal' in window,
    };
  }

  // =================== Card 1：navigation 能力检测 + currentEntry ===================

  // 读取 navigation.currentEntry：url / key / id / index / sameDocument / type / getState()
  _readCurrentEntry() {
    const caps = this._caps();
    if (!caps.currentEntry) {
      this._addLog('warn', 'navigation.currentEntry 不可用（测试环境不支持，请用真实浏览器）');
      this.setState({ currentEntryInfo: 'navigation.currentEntry 不可用。\n测试环境（jsdom/Node）不支持 Navigation API，请在真实 Chrome 浏览器中打开。\n在 Chrome 中，navigation.currentEntry 返回 NavigationCurrentEntry（NavigationHistoryEntry 子类），\n包含 url / key / id / index / sameDocument / type 属性以及 getState() / setState() 方法。' });
      return;
    }
    try {
      const entry = navigation.currentEntry;
      const state = entry.getState();
      this.setState({ currentEntryInfo: `navigation.currentEntry → NavigationCurrentEntry（NavigationHistoryEntry 子类）\nentry.url = ${entry.url}\nentry.key = ${entry.key}\nentry.id = ${entry.id}\nentry.index = ${entry.index}\nentry.sameDocument = ${entry.sameDocument}\nentry.type = ${entry.type}（'push' | 'replace' | 'reload' | 'traverse'）\nentry.getState() = ${JSON.stringify(state)}\n说明：key 同文档导航中保持不变（稳定标识）；id 每次导航唯一；index 是 entries() 数组中的位置。` });
      this._addLog('currentEntry', `读取 currentEntry：url=${entry.url}，key=${entry.key}，id=${entry.id}，index=${entry.index}，type=${entry.type}`);
    } catch (err) {
      this._addLog('warn', `读取 currentEntry 失败：${err.name} - ${err.message}`);
    }
  }

  // navigation.updateCurrentEntry({ state })：更新当前条目的状态（推荐用法，取代旧 entry.setState）
  _setStateOnEntry() {
    const caps = this._caps();
    if (!caps.currentEntry) {
      this._addLog('warn', 'navigation.currentEntry 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    if (!caps.updateCurrentEntry) {
      this._addLog('warn', 'navigation.updateCurrentEntry 不可用');
      return;
    }
    try {
      const before = navigation.currentEntry.getState();
      const prevCount = before && typeof before.count === 'number' ? before.count : 0;
      const newState = { visitedAt: Date.now(), source: 'NavigationAPIDeepPage', count: prevCount + 1 };
      // 推荐用 navigation.updateCurrentEntry({ state }) 而非旧 entry.setState()
      navigation.updateCurrentEntry({ state: newState });
      const after = navigation.currentEntry.getState();
      this.setState({ currentEntryInfo: `navigation.updateCurrentEntry({ state }) 更新当前条目状态：\ngetState() 之前 = ${JSON.stringify(before)}\n写入 state = ${JSON.stringify(newState)}\ngetState() 之后 = ${JSON.stringify(after)}\n说明：updateCurrentEntry 会触发 currententrychange 事件；旧 API entry.setState() 已被取代。` });
      this._addLog('setState', `updateCurrentEntry({ state })：count=${newState.count}，visitedAt=${newState.visitedAt}`);
    } catch (err) {
      this._addLog('warn', `setState 失败：${err.name} - ${err.message}`);
    }
  }

  // 监听 entry 的 dispose 事件（条目从历史栈移除时触发）
  _listenDispose() {
    const caps = this._caps();
    if (!caps.currentEntry) {
      this._addLog('warn', 'navigation.currentEntry 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    try {
      const entry = navigation.currentEntry;
      const handler = () => {
        this._addLog('dispose', `NavigationHistoryEntry dispose 触发：被移除的 entry.id=${entry.id}，url=${entry.url}`);
      };
      entry.addEventListener('dispose', handler);
      this._disposeHandlers.push({ entry, handler });
      this.setState({ currentEntryInfo: `已为当前 entry 添加 dispose 监听：\nentry.id = ${entry.id}\nentry.url = ${entry.url}\n说明：条目从 entries() 中被移除（历史栈裁剪、replace 导航）时触发 dispose，便于清理关联资源。` });
      this._addLog('dispose', `已监听 entry.dispose：id=${entry.id}`);
    } catch (err) {
      this._addLog('warn', `监听 dispose 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. navigation 能力检测 + currentEntry',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.navigation ? 'success' : 'error' }, caps.navigation ? 'navigation 可用' : 'navigation 不可用'),
        h(Tag, { color: caps.currentEntry ? 'success' : 'warning' }, caps.currentEntry ? 'currentEntry 可用' : 'currentEntry 不可用'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.navigation 是 Navigation API 的入口对象（仅 Chrome 实现）。navigation.currentEntry 返回当前 NavigationHistoryEntry，包含 url / key / id / index / sameDocument / type 属性，以及 getState() / setState() 方法。key 在同文档导航中保持不变；id 每次导航都唯一；type 取值 push / replace / reload / traverse。entry 还可监听 dispose 事件（条目从历史栈移除时触发）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 currentEntry', { type: 'primary', size: 'sm', disabled: !caps.currentEntry, onClick: () => this._readCurrentEntry() }),
          this._btn('updateCurrentEntry', { type: 'primary', size: 'sm', disabled: !caps.updateCurrentEntry, onClick: () => this._setStateOnEntry() }),
          this._btn('监听 dispose', { size: 'sm', disabled: !caps.currentEntry, onClick: () => this._listenDispose() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'currentEntry 信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.currentEntryInfo || '（点击「读取 currentEntry」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const entry = navigation.currentEntry;
console.log(entry.url, entry.key, entry.id, entry.index, entry.type);
const state = entry.getState();                    // 读取状态
navigation.updateCurrentEntry({ state: { x: 1 } }); // 写入状态（推荐）
entry.addEventListener('dispose', () => {          // 条目被移除
  console.log('disposed', entry.id);
});`)),
        h(Alert, {
          type: 'info',
          message: 'Navigation API 是 History API 的现代替代',
          description: '相较于 history.pushState/replaceState 的"哑"操作，Navigation API 提供完整的历史栈（entries()）、导航事件（navigate）、异步过渡（intercept/transitionWhile）、状态管理（getState/setState）和方向感知（canGoBack/canGoForward）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：navigation.entries() 历史栈 ===================

  // 列出所有历史条目（navigation.entries() → NavigationHistoryEntry[]）
  _listEntries() {
    const caps = this._caps();
    if (!caps.entries) {
      this._addLog('warn', 'navigation.entries() 不可用（测试环境不支持，请用真实浏览器）');
      this.setState({
        entriesInfo:
          'navigation.entries() 不可用。\n' +
          '测试环境（jsdom/Node）不支持 Navigation API，请在真实 Chrome 浏览器中打开。\n' +
          '在 Chrome 中，navigation.entries() 返回完整的 NavigationHistoryEntry 数组，\n' +
          '包含当前条目与所有前后条目，可遍历 inspect 每个 entry 的 url / key / id / type。',
      });
      return;
    }
    try {
      const entries = navigation.entries();   // NavigationHistoryEntry[]
      const canBack = navigation.canGoBack;
      const canFwd = navigation.canGoForward;
      const currentIdx = navigation.currentEntry ? navigation.currentEntry.index : -1;
      const lines = entries.map((e, i) => {
        const marker = i === currentIdx ? '  <- 当前' : '';
        return `[${i}] key=${e.key} id=${e.id} type=${e.type} sameDocument=${e.sameDocument} url=${e.url}${marker}`;
      });
      this.setState({ entriesInfo: `navigation.entries() → NavigationHistoryEntry[${entries.length}]\nnavigation.canGoBack = ${canBack}\nnavigation.canGoForward = ${canFwd}\n\n历史栈：\n${lines.join('\n')}\n\n说明：entries() 返回完整历史栈；canGoBack/canGoForward 为只读布尔；与 history.length（仅数字）相比，entries() 让历史栈"可见"。` });
      this._addLog('entries', `entries() 共 ${entries.length} 个条目；canGoBack=${canBack}，canGoForward=${canFwd}`);
    } catch (err) {
      this._addLog('warn', `entries() 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. navigation.entries() 历史栈',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.entries ? 'success' : 'error' }, caps.entries ? 'entries() 可用' : 'entries() 不可用'),
        h(Tag, { color: 'primary' }, 'canGoBack / canGoForward'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigation.entries() 返回完整的 NavigationHistoryEntry 数组（含当前条目与所有前后条目），不像 History API 只能通过 history.length 看到长度。navigation.canGoBack / navigation.canGoForward 是只读布尔属性，表示当前是否可以 back() / forward()。每个条目都有 url / key / id / index / type / sameDocument 属性，可被遍历与 inspect。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('列出 entries()', { type: 'primary', size: 'sm', disabled: !caps.entries, onClick: () => this._listEntries() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '历史栈信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.entriesInfo || '（点击「列出 entries()」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const entries = navigation.entries();        // NavigationHistoryEntry[]
entries.forEach((e, i) => console.log(i, e.url, e.key, e.id, e.type));
if (navigation.canGoBack)  await navigation.back();
if (navigation.canGoForward) await navigation.forward();
await navigation.traverseTo(targetKey);       // 跳转到指定 key 的条目`)),
        h(Alert, {
          type: 'info',
          message: 'entries() 让历史栈可见',
          description: 'History API 只暴露 history.length（数字），开发者无法枚举历史条目；Navigation API 的 entries() 让完整历史栈可被遍历与 inspect，配合 traverseTo(key) 可跳转到任意条目，实现"跳到第 N 步"等场景。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：navigate 事件拦截 ===================

  // 启动 / 停止监听 navigate 事件
  _toggleNavigateListener() {
    const caps = this._caps();
    if (!caps.navigation) {
      this._addLog('warn', 'navigation 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    if (this._navigateHandler) {
      // 已在监听 → 停止
      navigation.removeEventListener('navigate', this._navigateHandler);
      if (this._navigatesuccessHandler) {
        navigation.removeEventListener('navigatesuccess', this._navigatesuccessHandler);
        this._navigatesuccessHandler = null;
      }
      if (this._navigateerrorHandler) {
        navigation.removeEventListener('navigateerror', this._navigateerrorHandler);
        this._navigateerrorHandler = null;
      }
      if (this._currententrychangeHandler) {
        navigation.removeEventListener('currententrychange', this._currententrychangeHandler);
        this._currententrychangeHandler = null;
      }
      this._navigateHandler = null;
      this.setState({ navigateListening: false });
      this._addLog('navigate', '已停止监听 navigate / navigatesuccess / navigateerror / currententrychange');
      return;
    }
    try {
      // navigate 事件：导航开始时触发
      this._navigateHandler = (event) => {
        const dest = event.destination;
        const destInfo = dest ? {
          url: dest.url, key: dest.key, id: dest.id, index: dest.index,
          sameDocument: dest.sameDocument,
          getState: dest.getState ? JSON.stringify(dest.getState()) : null,
        } : null;
        this._addLog('navigate', `navigate 事件：type=${event.navigationType}，userInitiated=${event.userInitiated}，dest.url=${destInfo ? destInfo.url : '?'}`);
        this.setState({
          navigateEventInfo:
            '【navigate 事件】导航开始时触发：\n' +
            `event.navigationType = ${event.navigationType}（'push' | 'replace' | 'reload' | 'traverse'）\n` +
            `event.canTransition = ${event.canTransition}\n` +
            `event.canIntercept = ${event.canIntercept}\n` +
            `event.userInitiated = ${event.userInitiated}（是否用户点击/键盘触发）\n` +
            `event.hashChange = ${event.hashChange}\n` +
            `event.signal 存在 = ${typeof event.signal !== 'undefined'}（AbortSignal，可取消导航）\n` +
            `event.formData = ${event.formData ? 'FormData' : 'null'}\n` +
            `event.destination = ${JSON.stringify(destInfo, null, 2)}\n\n` +
            '可调用：event.transitionWhile(promise) / event.intercept({ handler }) 拦截并自定义过渡。',
        });
      };
      // navigatesuccess：导航成功完成
      this._navigatesuccessHandler = () => {
        this._addLog('navigate', 'navigatesuccess 事件：导航成功完成');
      };
      // navigateerror：导航失败
      this._navigateerrorHandler = (event) => {
        this._addLog('warn', `navigateerror 事件：导航失败 - ${event.error ? event.error.message : 'unknown'}`);
      };
      // currententrychange：当前条目变化
      this._currententrychangeHandler = (event) => {
        const from = event.from ? `from.id=${event.from.id}` : 'from=?';
        const to = event.to ? `to.id=${event.to.id}` : 'to=?';
        this._addLog('navigate', `currententrychange 事件：${from} → ${to}，navigationType=${event.navigationType}`);
      };
      navigation.addEventListener('navigate', this._navigateHandler);
      navigation.addEventListener('navigatesuccess', this._navigatesuccessHandler);
      navigation.addEventListener('navigateerror', this._navigateerrorHandler);
      navigation.addEventListener('currententrychange', this._currententrychangeHandler);
      this.setState({ navigateListening: true });
      this._addLog('navigate', '已开始监听 navigate / navigatesuccess / navigateerror / currententrychange（请用 Card 4 触发导航）');
    } catch (err) {
      this._addLog('warn', `监听 navigate 失败：${err.name} - ${err.message}`);
    }
  }

  // 演示 event.intercept({ handler }) —— 仅静态展示，不实际触发（避免改变 URL 影响测试）
  _demoIntercept() {
    const caps = this._caps();
    if (!caps.navigation) {
      this._addLog('warn', 'navigation 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    this.setState({
      navigateEventInfo:
        'event.intercept({ handler, focusReset }) 用法演示：\n' +
        "navigation.addEventListener('navigate', (event) => {\n" +
        '  if (!event.canIntercept || event.hashChange) return;\n' +
        '  event.intercept({\n' +
        '    async handler() { await renderPage(event.destination.url); },\n' +
        "    focusReset: 'manual',  // 'auto'(默认) | 'manual'\n" +
        '  });\n' +
        '});\n\n' +
        'event.transitionWhile(promise) 是 intercept 的早期版本，现推荐 intercept。\n' +
        '拦截后导航"暂停"在当前条目，直到 handler 完成；handler 抛错会触发 navigateerror。\n' +
        'canIntercept 为 false 时（如跨文档导航）不可拦截。',
    });
    this._addLog('navigate', '已展示 event.intercept({ handler }) 用法（不实际触发，避免改变 URL 影响测试）');
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. navigate 事件拦截',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.navigation ? 'success' : 'error' }, caps.navigation ? 'navigation 可用' : 'navigation 不可用'),
        h(Tag, { color: s.navigateListening ? 'success' : 'default' }, s.navigateListening ? '监听中' : '未监听'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigation.addEventListener("navigate", cb) 监听所有导航开始事件。事件对象含 navigationType（push/replace/reload/traverse）、canTransition、canIntercept、userInitiated、hashChange、destination（含 url/key/id/index/sameDocument/getState）、signal（AbortSignal）、formData。调用 event.intercept({ handler }) 可拦截导航并自定义过渡（如 SPA 路由）；navigatesuccess 在成功完成时触发；navigateerror 在失败时触发（event.error）；currententrychange 在当前条目切换时触发。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn(s.navigateListening ? '停止监听 navigate' : '开始监听 navigate', { type: s.navigateListening ? 'danger' : 'primary', size: 'sm', disabled: !caps.navigation, onClick: () => this._toggleNavigateListener() }),
          this._btn('查看 intercept 用法', { size: 'sm', disabled: !caps.navigation, onClick: () => this._demoIntercept() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'navigate 事件信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.navigateEventInfo || '（点击「开始监听 navigate」后，用 Card 4 触发导航）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`navigation.addEventListener('navigate', (event) => {
  if (!event.canIntercept) return;             // 跨文档导航无法拦截
  event.intercept({                            // 拦截并自定义过渡
    async handler() {
      const html = await fetch(event.destination.url).then(r => r.text());
      document.querySelector('#app').innerHTML = html;
    },
  });
});
navigation.addEventListener('navigatesuccess', () => hideLoader());
navigation.addEventListener('navigateerror', (e) => showError(e.error));
navigation.addEventListener('currententrychange', (e) => console.log(e.from, '->', e.to));`)),
        h(Alert, {
          type: 'warning',
          message: 'intercept 是 SPA 路由的核心',
          description: '不同于 History API 的 pushState（仅改 URL 不通知），Navigation API 的 navigate 事件让框架可以拦截所有导航（包括用户点击链接、表单提交、浏览器后退）并统一处理。intercept 的 handler 是异步的，可配合 View Transitions API 实现平滑过渡。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：navigate / reload / back / forward 方法 ===================

  // navigation.navigate(url, options) → Promise<NavigationResult>
  async _navigateDemo() {
    const caps = this._caps();
    if (!caps.navigate) {
      this._addLog('warn', 'navigation.navigate 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    try {
      // 使用同文档 hash 导航，避免真正离开页面（不影响测试环境）
      const targetUrl = `${location.pathname}${location.search}#nav-demo-${Date.now()}`;
      this._addLog('navigate', `调用 navigation.navigate("${targetUrl}", { transition: 'push', info: {...} })…`);
      const result = await navigation.navigate(targetUrl, {
        transition: 'push',           // 'push'（默认）| 'replace'
        info: { source: 'NavigationAPIDeepPage', ts: Date.now() }, // 传递给 navigate 事件的 info
      });
      this.setState({ navMethodInfo: `navigation.navigate(url, options) → Promise<NavigationResult>\n目标 url = ${targetUrl}\noptions.transition = 'push'（默认）| 'replace'\noptions.info = { source, ts }（任意值，传给 navigate 事件 event.info）\nNavigationResult = { committed: Promise<NavigationHistoryEntry>, fulfilled: Promise<void> }\nresult.committed 存在 = ${typeof result.committed !== 'undefined'}\nresult.fulfilled 存在 = ${typeof result.fulfilled !== 'undefined'}\n说明：committed 在新条目入栈时 resolve；fulfilled 在 intercept handler 完成时 resolve。` });
      this._addLog('navigate', 'navigate 完成：result 含 committed 与 fulfilled 两个 Promise');
    } catch (err) {
      this._addLog('warn', `navigate 失败：${err.name} - ${err.message}`);
      this.setState({ navMethodInfo: `navigate 失败：${err.name} - ${err.message}` });
    }
  }

  // navigation.reload(options) → Promise<NavigationResult>
  async _reloadDemo() {
    const caps = this._caps();
    if (!caps.reload) {
      this._addLog('warn', 'navigation.reload 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    try {
      this._addLog('reload', '查看 navigation.reload({ info: {...} }) 用法（注意：reload 会重新加载当前文档）');
      // 注：实际调用会重新加载页面，这里仅静态演示，不真正调用以避免影响测试环境
      this.setState({
        navMethodInfo:
          'navigation.reload(options) → Promise<NavigationResult>\n' +
          'options.info = { source, ts }（传给 navigate 事件的 info）\n' +
          "说明：reload 会触发 navigationType='reload' 的 navigate 事件，真正重新加载当前文档（可能丢失页面状态）。\n" +
          '本演示不实际调用以避免影响测试环境。\n' +
          "参考调用：const result = await navigation.reload({ info: { source: 'demo' } });",
      });
      this._addLog('reload', '已展示 reload 用法（不实际调用，避免重新加载页面）');
    } catch (err) {
      this._addLog('warn', `reload 失败：${err.name} - ${err.message}`);
    }
  }

  // navigation.back(options) → Promise<NavigationResult>
  async _backDemo() {
    const caps = this._caps();
    if (!caps.back) {
      this._addLog('warn', 'navigation.back 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    try {
      if (!navigation.canGoBack) {
        this._addLog('warn', 'navigation.canGoBack = false，无法 back()（历史栈中没有前一条目）');
        this.setState({
          navMethodInfo:
            'navigation.canGoBack = false，无法 back()。\n' +
            '请先用 Card 4 的 navigate() 创建至少一条历史，再点击 back。',
        });
        return;
      }
      this._addLog('back', "调用 navigation.back({ info: {...} })…");
      await navigation.back({ info: { source: 'NavigationAPIDeepPage' } });
      this.setState({
        navMethodInfo:
          'navigation.back(options) → Promise<NavigationResult>\n' +
          'result.committed / result.fulfilled 已返回\n' +
          '说明：back() 等价于 traverseTo(entries()[index-1].key)；canGoBack=false 时会 reject。',
      });
      this._addLog('back', 'back() 完成');
    } catch (err) {
      this._addLog('warn', `back 失败：${err.name} - ${err.message}`);
      this.setState({ navMethodInfo: `back 失败：${err.name} - ${err.message}` });
    }
  }

  // navigation.forward(options) → Promise<NavigationResult>
  async _forwardDemo() {
    const caps = this._caps();
    if (!caps.forward) {
      this._addLog('warn', 'navigation.forward 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    try {
      if (!navigation.canGoForward) {
        this._addLog('warn', 'navigation.canGoForward = false，无法 forward()（历史栈中没有后一条目）');
        this.setState({
          navMethodInfo:
            'navigation.canGoForward = false，无法 forward()。\n' +
            '请先用 back() 后退过，再点击 forward。',
        });
        return;
      }
      this._addLog('forward', "调用 navigation.forward({ info: {...} })…");
      await navigation.forward({ info: { source: 'NavigationAPIDeepPage' } });
      this.setState({
        navMethodInfo:
          'navigation.forward(options) → Promise<NavigationResult>\n' +
          'result.committed / result.fulfilled 已返回\n' +
          '说明：forward() 等价于 traverseTo(entries()[index+1].key)；canGoForward=false 时会 reject。',
      });
      this._addLog('forward', 'forward() 完成');
    } catch (err) {
      this._addLog('warn', `forward 失败：${err.name} - ${err.message}`);
      this.setState({ navMethodInfo: `forward 失败：${err.name} - ${err.message}` });
    }
  }

  // navigation.traverseTo(key, options) → Promise<NavigationResult>
  async _traverseToDemo() {
    const caps = this._caps();
    if (!caps.traverseTo) {
      this._addLog('warn', 'navigation.traverseTo 不可用（测试环境不支持，请用真实浏览器）');
      return;
    }
    try {
      const entries = navigation.entries();
      const other = entries.find((e) => e !== navigation.currentEntry);
      if (!other) {
        this._addLog('warn', '历史栈中无其他条目，无法演示 traverseTo');
        this.setState({
          navMethodInfo:
            '历史栈中无其他条目，无法演示 traverseTo。\n' +
            '请先用 navigate() 创建至少一条历史。',
        });
        return;
      }
      this._addLog('traverseTo', `调用 navigation.traverseTo("${other.key}")…`);
      await navigation.traverseTo(other.key, { info: { source: 'NavigationAPIDeepPage' } });
      this.setState({
        navMethodInfo:
          'navigation.traverseTo(key, options) → Promise<NavigationResult>\n' +
          `目标 key = ${other.key}（id=${other.id}，url=${other.url}）\n` +
          'result.committed / result.fulfilled 已返回\n' +
          '说明：traverseTo 跳转到指定 key 的历史条目；key 在同文档导航中保持不变，可作为稳定标识。',
      });
      this._addLog('traverseTo', `traverseTo 完成：目标 key=${other.key}`);
    } catch (err) {
      this._addLog('warn', `traverseTo 失败：${err.name} - ${err.message}`);
      this.setState({ navMethodInfo: `traverseTo 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. navigate / reload / back / forward / traverseTo',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.navigate ? 'success' : 'error' }, caps.navigate ? 'navigate 可用' : 'navigate 不可用'),
        h(Tag, { color: 'primary' }, 'NavigationResult'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigation.navigate(url, options) → Promise<NavigationResult>：导航到 url，options.transition 取值 push（默认）| replace，options.info 任意值传给 navigate 事件。reload(options) 重新加载当前文档。back(options) / forward(options) 后退/前进。traverseTo(key, options) 跳转到指定 key 的条目。所有方法返回 { committed, fulfilled } 两个 Promise：committed 在新条目入栈时 resolve，fulfilled 在 intercept 的 handler 完成时 resolve。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('navigate()', { type: 'primary', size: 'sm', disabled: !caps.navigate, onClick: () => this._navigateDemo() }),
          this._btn('reload()', { size: 'sm', disabled: !caps.reload, onClick: () => this._reloadDemo() }),
          this._btn('back()', { size: 'sm', disabled: !caps.back, onClick: () => this._backDemo() }),
          this._btn('forward()', { size: 'sm', disabled: !caps.forward, onClick: () => this._forwardDemo() }),
          this._btn('traverseTo()', { size: 'sm', disabled: !caps.traverseTo, onClick: () => this._traverseToDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '方法调用结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.navMethodInfo || '（点击按钮调用 navigation 方法）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`// push：默认 transition
const r1 = await navigation.navigate('/page2', { info: { from: 'home' } });
// replace：替换当前条目（不增加历史）
const r2 = await navigation.navigate('/login', { transition: 'replace' });
// reload：重新加载
const r3 = await navigation.reload({ info: { force: true } });
// back / forward：需要 canGoBack / canGoForward
if (navigation.canGoBack) await navigation.back();
// traverseTo：跳转到指定 key
const key = navigation.entries()[0].key;
await navigation.traverseTo(key);`)),
        h(Alert, {
          type: 'info',
          message: 'NavigationResult 的两个 Promise',
          description: 'committed 在新 NavigationHistoryEntry 被加入历史栈时 resolve（导航"已提交"）；fulfilled 在 intercept 的 handler 完成（或未拦截时）resolve（导航"已完成"）。若 handler 抛错，fulfilled 会 reject，同时触发 navigateerror 事件。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：fragmentDirective + Text Fragments ===================

  // 读取 document.fragmentDirective
  _readFragmentDirective() {
    const caps = this._caps();
    if (!caps.fragmentDirective) {
      this._addLog('warn', 'document.fragmentDirective 不可用（仅 Chrome 实现 Text Fragments，jsdom 不支持）');
      this.setState({ fragmentInfo: 'document.fragmentDirective → FragmentDirective（仅 Chrome 实现）\n当前环境（jsdom/Node）不支持，请在真实 Chrome 浏览器中打开。\n\nText Fragments 语法（#:~:text=...）：\n  #:~:text=Hello               高亮首个 "Hello"\n  #:~:text=Hello,World         高亮从 "Hello" 到 "World" 的范围\n  #:~:text=prefix-,Hello       前缀匹配（prefix 后紧跟 Hello）\n  #:~:text=Hello,-suffix       后缀匹配（Hello 后紧跟 suffix）\n  #:~:text=pre-,start,end,-suf 同时带前后缀的范围匹配\n\n用途：深链接到页面特定文本并自动高亮，常见于搜索结果跳转、引用分享。' });
      return;
    }
    try {
      const fd = document.fragmentDirective;   // FragmentDirective
      const items = fd && Array.isArray(fd.items) ? fd.items : [];
      const itemsText = items.length
        ? items.map((it, i) => `[${i}] text="${it.text || ''}" prefix="${it.prefix || ''}" suffix="${it.suffix || ''}" start="${it.start || ''}" end="${it.end || ''}"`).join('\n')
        : '（当前 URL 无 #:~:text= 片段，items 为空）';
      this.setState({ fragmentInfo: `document.fragmentDirective → FragmentDirective\nfragmentDirective.items → FragmentDirectiveItem[${items.length}]\n\n${itemsText}\n\n说明：fragmentDirective 暴露当前 URL 中 #:~:text= 解析后的结构化结果；每个 item 含 text/prefix/suffix/start/end 字段。\n请在 URL 后追加 #:~:text=某文本 重新打开本页，items 将包含解析结果。` });
      this._addLog('fragment', `读取 fragmentDirective：items 共 ${items.length} 项`);
    } catch (err) {
      this._addLog('warn', `读取 fragmentDirective 失败：${err.name} - ${err.message}`);
    }
  }

  // 说明 Text Fragments 语法
  _showTextFragmentsSyntax() {
    this.setState({ fragmentInfo: 'Text Fragments（#:~:text=...）语法详解：\n\n基本形式：#:~:text=start[,end]\n  - 单段：#:~:text=Hello              高亮首个 "Hello"\n  - 范围：#:~:text=Hello,World         高亮从 "Hello" 到 "World" 之间的所有内容\n\n前缀 / 后缀（用 - 分隔）：\n  - 前缀：#:~:text=prefix-,Hello       匹配紧跟在 "prefix" 之后的 "Hello"\n  - 后缀：#:~:text=Hello,-suffix       匹配紧跟在 "suffix" 之前的 "Hello"\n  - 全套：#:~:text=prefix-,start,end,-suffix\n\n多片段：用 & 连接 —— #:~:text=foo&text=bar 同时高亮 "foo" 和 "bar"\nURL 编码：空格用 %20 —— #:~:text=Hello%20World\n\n用途：搜索引擎结果跳转、文档引用分享、阅读器"复制链接到此段"。\n兼容性：仅 Chromium 系浏览器实现（Chrome/Edge），Firefox/Safari 部分支持。\n读取：document.fragmentDirective.items 返回结构化解析结果。' });
    this._addLog('fragment', '已展示 Text Fragments 语法详解');
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. fragmentDirective + Text Fragments',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.fragmentDirective ? 'success' : 'error' }, caps.fragmentDirective ? 'fragmentDirective 可用' : 'fragmentDirective 不可用'),
        h(Tag, { color: 'primary' }, '#:~:text='),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.fragmentDirective 返回 FragmentDirective 对象（仅 Chrome 实现），其 items 属性是 FragmentDirectiveItem 数组，对应 URL 中 #:~:text=... 解析后的结构化结果。Text Fragments 语法：#:~:text=start[,end] 高亮文本范围；带前缀/后缀 #:~:text=prefix-,start,end,-suffix；多片段用 & 连接。用途：深链接到页面特定文本并自动滚动+高亮，常见于搜索结果与文档引用。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 fragmentDirective', { type: 'primary', size: 'sm', disabled: !caps.fragmentDirective, onClick: () => this._readFragmentDirective() }),
          this._btn('查看 Text Fragments 语法', { size: 'sm', onClick: () => this._showTextFragmentsSyntax() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'fragmentDirective 信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.fragmentInfo || '（点击「读取 fragmentDirective」或「查看 Text Fragments 语法」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`// URL 形如 https://example.com/doc#:~:text=Hello,World
const fd = document.fragmentDirective;
fd.items.forEach((it) => {
  console.log(it.text, it.prefix, it.suffix, it.start, it.end);
});
// 检测是否支持
if (!('fragmentDirective' in document)) {
  console.log('Text Fragments 不支持');
}`)),
        h(Alert, {
          type: 'info',
          message: 'Text Fragments 让"复制链接到这段话"成为可能',
          description: '配合 Navigation API 的 sameDocument 导航，#:~:text= 片段会在 navigate 事件中作为 hashChange=true 出现，浏览器自动滚动并高亮目标文本。fragmentDirective 让 JS 能读取解析结果，便于二次处理（如复制、统计）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：scrollRestoration + hashchange ===================

  // 读取 history.scrollRestoration
  _readScrollRestoration() {
    const caps = this._caps();
    if (!caps.scrollRestoration) {
      this._addLog('warn', 'history.scrollRestoration 不可用');
      return;
    }
    try {
      const mode = history.scrollRestoration;   // 'auto' | 'manual'
      this.setState({
        scrollHashInfo:
          `history.scrollRestoration = '${mode}'\n` +
          "取值：'auto'（默认，浏览器自动恢复滚动位置）| 'manual'（开发者手动控制）\n" +
          '说明：navigate 后若 transition 为 traverse（back/forward），浏览器按此属性决定是否恢复滚动；\n' +
          "设为 'manual' 后可在 navigatesuccess 事件中用 entry 状态保存的 scrollY 手动恢复。",
      });
      this._addLog('scroll', `读取 history.scrollRestoration = '${mode}'`);
    } catch (err) {
      this._addLog('warn', `读取 scrollRestoration 失败：${err.name} - ${err.message}`);
    }
  }

  // 设置 history.scrollRestoration
  _setScrollRestoration(mode) {
    const caps = this._caps();
    if (!caps.scrollRestoration) {
      this._addLog('warn', 'history.scrollRestoration 不可用');
      return;
    }
    try {
      const before = history.scrollRestoration;
      history.scrollRestoration = mode;     // 'auto' | 'manual'
      const after = history.scrollRestoration;
      this.setState({
        scrollHashInfo:
          `history.scrollRestoration：'${before}' → '${after}'\n` +
          `已设为 '${mode}'。\n` +
          "说明：'manual' 时浏览器不再自动恢复滚动位置，需在 navigatesuccess / pageshow 中手动 window.scrollTo；\n" +
          '典型场景：SPA 路由切换时按页面类型决定是否恢复滚动（列表页恢复、详情页置顶）。',
      });
      this._addLog('scroll', `scrollRestoration：'${before}' → '${after}'`);
    } catch (err) {
      this._addLog('warn', `设置 scrollRestoration 失败：${err.name} - ${err.message}`);
    }
  }

  // 启动 / 停止监听 hashchange 事件
  _toggleHashchangeListener() {
    const caps = this._caps();
    if (!caps.hashchange) {
      this._addLog('warn', 'hashchange 事件不可用');
      return;
    }
    if (this._hashchangeHandler) {
      window.removeEventListener('hashchange', this._hashchangeHandler);
      this._hashchangeHandler = null;
      this.setState({ hashListening: false });
      this._addLog('hash', '已停止监听 hashchange');
      return;
    }
    try {
      this._hashchangeHandler = (event) => {
        this._addLog('hash', `hashchange 事件：oldURL="${event.oldURL}" → newURL="${event.newURL}"`);
        this.setState({
          scrollHashInfo:
            '【hashchange 事件】URL hash 变化时触发：\n' +
            `event.oldURL = ${event.oldURL}\n` +
            `event.newURL = ${event.newURL}\n` +
            `location.hash = ${location.hash}\n\n` +
            '说明：hashchange 是 History API 时代的 hash 路由基础；Navigation API 的 navigate 事件中\n' +
            'event.hashChange=true 也覆盖此场景，并额外提供 destination / canIntercept 等信息。',
        });
      };
      window.addEventListener('hashchange', this._hashchangeHandler);
      this.setState({ hashListening: true });
      this._addLog('hash', '已开始监听 hashchange（点击「触发 hashchange」按钮模拟）');
    } catch (err) {
      this._addLog('warn', `监听 hashchange 失败：${err.name} - ${err.message}`);
    }
  }

  // 触发一次 hashchange（修改 location.hash，用 try/catch 包裹避免影响测试环境）
  _triggerHashchange() {
    const caps = this._caps();
    if (!caps.hashchange) {
      this._addLog('warn', 'hashchange 事件不可用');
      return;
    }
    try {
      const newHash = `#hash-demo-${Date.now()}`;
      this._addLog('hash', `即将设置 location.hash = "${newHash}"（仅改 hash，不离开页面）`);
      // 用 try/catch 包裹，jsdom 对某些 URL 修改可能抛错
      try {
        location.hash = newHash;
      } catch (err) {
        this._addLog('warn', `设置 location.hash 抛错（jsdom URL 限制）：${err.message}；事件可能仍触发`);
      }
      this._addLog('hash', `location.hash 已设置；当前 hash="${location.hash}"`);
    } catch (err) {
      this._addLog('warn', `触发 hashchange 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. scrollRestoration + hashchange',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.scrollRestoration ? 'success' : 'error' }, caps.scrollRestoration ? 'scrollRestoration 可用' : 'scrollRestoration 不可用'),
        h(Tag, { color: caps.hashchange ? 'success' : 'error' }, caps.hashchange ? 'hashchange 可用' : 'hashchange 不可用'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'history.scrollRestoration 取值 auto（默认）| manual：控制 back/forward 时是否自动恢复滚动位置。设为 manual 后开发者需在 navigatesuccess / pageshow 中手动 window.scrollTo。window.addEventListener("hashchange", cb) 监听 URL hash 变化，event.oldURL / event.newURL 给出变化前后的完整 URL。Navigation API 的 navigate 事件以 event.hashChange=true 覆盖此场景，并提供更丰富的 destination / canIntercept 信息。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 scrollRestoration', { size: 'sm', disabled: !caps.scrollRestoration, onClick: () => this._readScrollRestoration() }),
          this._btn("设为 'auto'", { type: 'primary', size: 'sm', disabled: !caps.scrollRestoration, onClick: () => this._setScrollRestoration('auto') }),
          this._btn("设为 'manual'", { type: 'primary', size: 'sm', disabled: !caps.scrollRestoration, onClick: () => this._setScrollRestoration('manual') }),
          this._btn(s.hashListening ? '停止 hashchange' : '开始 hashchange', { type: s.hashListening ? 'danger' : 'primary', size: 'sm', disabled: !caps.hashchange, onClick: () => this._toggleHashchangeListener() }),
          this._btn('触发 hashchange', { size: 'sm', disabled: !caps.hashchange, onClick: () => this._triggerHashchange() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'scrollRestoration / hashchange 信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.scrollHashInfo || '（点击按钮读取 / 设置 / 触发）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`// 滚动恢复：手动模式
history.scrollRestoration = 'manual';
navigation.addEventListener('navigatesuccess', () => {
  const y = navigation.currentEntry.getState()?.scrollY ?? 0;
  window.scrollTo(0, y);
});
// hashchange（History API 时代）
window.addEventListener('hashchange', (e) => console.log(e.oldURL, '->', e.newURL));
// pageswap / pagereveal（跨文档视图过渡）
window.addEventListener('pageswap', () => { /* 卸载前 */ });
window.addEventListener('pagereveal', () => { /* 显示前 */ });`)),
        h(Alert, {
          type: 'info',
          message: 'pageswap / pagereveal 是跨文档视图过渡事件',
          description: 'window.addEventListener("pageswap", cb) 在页面卸载前触发（含 viewTransition），window.addEventListener("pagereveal", cb) 在新页面显示前触发。配合 View Transitions API 可实现跨文档（MPA）的平滑过渡。本页未单独开 Card 演示，因其仅在跨文档导航时有意义，本 SPA 页面内不触发。',
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
      h('h2', { class: 'section-title' }, 'Navigation API 深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'Navigation API 是 Chrome 提出的现代客户端导航 API，目标是替代 History API。本页演示 navigation.currentEntry / entries() / navigate 事件 / navigate-reload-back-forward 方法 / fragmentDirective / scrollRestoration / hashchange / pageswap-pagereveal。'),
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
