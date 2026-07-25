// =====================================================================
// PerformanceAPIDeepPage.js —— Performance 性能监控深度实验室
// 演示 MDN：
//   1. Performance Timeline 基础 —— performance.now() / timeOrigin /
//      getEntries / getEntriesByType / getEntriesByName，entry 类型：
//      mark / measure / navigation / resource / paint / longtask / event /
//      first-input / layout-shift / largest-contentful-paint。
//   2. User Timing —— performance.mark / measure / clearMarks / clearMeasures，
//      getEntriesByType('mark'|'measure')。
//   3. PerformanceObserver —— new PerformanceObserver(cb)、observe({type,buffered})
//      或 observe({entryTypes})、disconnect()、buffered 历史缓冲。
//   4. Navigation Timing + Resource Timing —— PerformanceNavigationTiming
//      (requestStart/responseStart/responseEnd/domInteractive/domComplete/
//       domContentLoadedEventStart/End/loadEventStart/End/transferSize/
//       encodedBodySize/type)、PerformanceResourceTiming (name/initiatorType/
//       duration/transferSize/decodedBodySize)、TTFB、DOM 解析耗时。
//   5. Web Vitals —— LCP(largest-contentful-paint) / CLS(layout-shift) /
//      FID(first-input) / Long Task(longtask) / Event Timing(event) /
//      navigator.deviceMemory / performance.measureUserAgentSpecificMemory()。
//   6. Long Animation Frames API (LoAF) —— PerformanceLongAnimationFrameEntry
//      （PerformanceLongTask 后继者，>50ms 长帧检测，Chrome 123+/Edge 123+），
//      entry 字段 duration / renderStart / styleAndLayoutStart / blockingDuration /
//      scripts[] / firstUIEventTimestamp，是 INP 调优核心工具。
// 说明：所有 API 调用前做 typeof 能力检测，不可用时 _addLog('warn', ...)，
//      绝不抛异常；jsdom 中 performance 已被 mock（getEntries 返回空数组，
//      PerformanceObserver 为 no-op mock 类），页面代码必须能在该环境下不报错。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class PerformanceAPIDeepPage extends Page {
  initialState() {
    return {
      // 共享事件日志（所有卡片写入同一面板）
      logs: [],
      // 能力检测摘要（componentDidMount 中填充，渲染时非空才显示 Alert）
      capsSummary: '',
      // Card 1：高精度时间戳与 entries
      nowResult: '',
      entriesList: [],
      // Card 2：mark / measure 结果
      markResult: '',
      measureResult: '',
      // Card 3：PerformanceObserver 状态
      observerStatus: '未启动',
      // Card 4：navigation / resource timing
      navTiming: null,
      resourceList: [],
      // Card 5：Web Vitals 与内存
      vitalsStatus: '未启动',
      memoryResult: '',
      // Card 6：Long Animation Frames API (LoAF)
      loafStatus: '未启动',
      loafInfo: null,
    };
  }

  componentDidMount() {
    // 初始化实例引用（必须在守卫之前，因为首次 render 在 componentDidMount 前已执行，
    // 若放在守卫后会导致 render 读到 undefined；此处幂等赋值保证安全）
    this._perfObserver = null;     // Card 3 PerformanceObserver
    this._vitalsObserver = null;   // Card 5 Web Vitals 观察器集合（含 disconnect）
    this._loafObserver = null;     // Card 6 LoAF (long-animation-frame) 观察器
    this._rafId = null;            // requestAnimationFrame 句柄
    this._visUnsub = null;         // visibilitychange 解绑函数
    this._cls = 0;                 // CLS 累计值
    this._lcp = null;              // 最新 LCP 时间
    this._fid = null;              // 最新 FID

    if (this._inited) return; this._inited = true;

    // —— 能力检测（绝不抛异常，仅 typeof / in 判定）——
    const perfSupported =
      typeof performance !== 'undefined' && typeof performance.now === 'function';
    const observerSupported = typeof PerformanceObserver !== 'undefined';
    const memorySupported =
      typeof performance !== 'undefined' &&
      typeof performance.measureUserAgentSpecificMemory === 'function';
    const deviceMemory =
      typeof navigator !== 'undefined' && typeof navigator.deviceMemory !== 'undefined'
        ? navigator.deviceMemory
        : null;

    // LoAF 能力检测：long-animation-frame 入口类型 + PerformanceLongAnimationFrameEntry
    // （需 Chrome 123+/Edge 123+；jsdom 中 supportedEntryTypes 为 undefined，安全降级为 ✗）
    const loafEntrySupported = this._safe(() =>
      typeof PerformanceObserver !== 'undefined' &&
      !!PerformanceObserver.supportedEntryTypes &&
      PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'));
    const loafClassSupported = this._safe(() =>
      typeof PerformanceLongAnimationFrameEntry !== 'undefined');

    const summary =
      '能力检测：performance.now=' + (perfSupported ? '✓' : '✗') +
      '，PerformanceObserver=' + (observerSupported ? '✓' : '✗') +
      '，measureUserAgentSpecificMemory=' + (memorySupported ? '✓' : '✗') +
      '，navigator.deviceMemory=' + (deviceMemory != null ? deviceMemory + 'GB' : '—') +
      '，LoAF(long-animation-frame)=' + (loafEntrySupported ? '✓' : '✗') +
      '，PerformanceLongAnimationFrameEntry=' + (loafClassSupported ? '✓' : '✗');
    this.setState({ capsSummary: summary });
    this._addLog('info', summary);

    if (!perfSupported) {
      this._addLog('warn', 'performance API 不可用，Performance Timeline 相关演示将跳过');
    }
    if (!observerSupported) {
      this._addLog('warn', 'PerformanceObserver 不可用，观察器相关演示将跳过（observe 调用会被忽略）');
    }
    if (!memorySupported) {
      this._addLog('warn', 'performance.measureUserAgentSpecificMemory 不可用（需 crossOriginIsolated 且较新 Chromium）');
    }
    if (!loafEntrySupported) {
      this._addLog('warn', 'LoAF (long-animation-frame) 不可用（需 Chrome 123+/Edge 123+，jsdom 无此能力）');
    }

    // 监听页面隐藏，flush 一次最终 Web Vitals（演示真实性能监控场景）
    try {
      this._visHandler = () => {
        if (typeof document !== 'undefined' && document.hidden) {
          this._addLog('info',
            '页面隐藏，flush Web Vitals：' +
            `LCP=${this._lcp != null ? this._lcp.toFixed(2) + 'ms' : '—'}，` +
            `CLS=${this._cls.toFixed(4)}，` +
            `FID=${this._fid != null ? this._fid.toFixed(2) + 'ms' : '—'}`);
        }
      };
      this._visUnsub = this.on(document, 'visibilitychange', this._visHandler);
    } catch { /* noop */ }
  }

  componentWillUnmount() {
    // 断开 PerformanceObserver（Card 3）
    try {
      if (this._perfObserver) {
        try { this._perfObserver.disconnect(); } catch { /* noop */ }
        this._perfObserver = null;
      }
    } catch { /* noop */ }
    // 断开 Web Vitals 观察器集合（Card 5）
    try {
      if (this._vitalsObserver) {
        try { this._vitalsObserver.disconnect(); } catch { /* noop */ }
        this._vitalsObserver = null;
      }
    } catch { /* noop */ }
    // 断开 LoAF 观察器（Card 6）
    try {
      if (this._loafObserver) {
        try { this._loafObserver.disconnect(); } catch { /* noop */ }
        this._loafObserver = null;
      }
    } catch { /* noop */ }
    // 取消尚未触发的 requestAnimationFrame
    try {
      if (this._rafId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._rafId);
      }
      this._rafId = null;
    } catch { /* noop */ }
    // 移除事件监听（visibilitychange）；on() 注册的其余监听由基类 destroy 自动解绑
    try {
      if (this._visUnsub) { this._visUnsub(); this._visUnsub = null; }
    } catch { /* noop */ }
  }

  // —— 共享日志方法 ——
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 安全执行：捕获异常返回 undefined，绝不抛出（用于能力检测与跨域字段读取）——
  _safe(fn) {
    try { return fn(); } catch { return undefined; }
  }

  // —— 按钮工厂：创建 Button 实例并注册为子组件 ——
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— Card 工厂：new Card({title, desc, extra, children}) + registerChild + render ——
  _card(title, desc, extra, children) {
    const kids = [];
    if (desc) kids.push(h('p', { class: 'fs-sm text-secondary' }, desc));
    const arr = Array.isArray(children) ? children : (children ? [children] : []);
    kids.push(...arr);
    const card = new Card({ title, desc, extra, children: kids });
    this.registerChild(card);
    return card.render();
  }

  // —— 日志面板渲染（所有卡片共享）——
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

  // =================================================================
  // Card 1：Performance Timeline 基础
  // =================================================================

  _compareNow() {
    if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
      this._addLog('warn', 'performance.now 不可用，无法进行高精度计时');
      return;
    }
    try {
      const t0 = performance.now();
      const d0 = Date.now();
      // 一段轻量计算，制造可观测的时间差
      let sum = 0;
      for (let i = 0; i < 20000; i++) sum += i;
      const t1 = performance.now();
      const d1 = Date.now();
      const perfDelta = (t1 - t0);
      const dateDelta = (d1 - d0);
      let timeOrigin = '—';
      try { timeOrigin = String(performance.timeOrigin); } catch { /* noop */ }
      const text =
        'performance.now() 增量 = ' + perfDelta.toFixed(4) + ' ms（高精度，受 timeOrigin 影响）\n' +
        'Date.now()    增量 = ' + dateDelta + ' ms（整数毫秒，无亚毫秒精度）\n' +
        'performance.timeOrigin = ' + timeOrigin + '\n' +
        '说明：performance.now 基于 timeOrigin 的单调时钟，适合测量耗时；Date.now 受系统时钟影响。';
      this.setState({ nowResult: text });
      this._addLog('now', `performance.now Δ=${perfDelta.toFixed(4)}ms，Date.now Δ=${dateDelta}ms`);
    } catch (err) {
      this._addLog('warn', 'performance.now 计时失败：' + (err && err.message));
    }
  }

  _listEntries() {
    if (typeof performance === 'undefined' || typeof performance.getEntries !== 'function') {
      this._addLog('warn', 'performance.getEntries 不可用');
      return;
    }
    // 用 requestAnimationFrame 延后一帧读取，确保 paint 等 entry 已写入缓冲
    try {
      if (this._rafId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._rafId);
      }
    } catch { /* noop */ }
    const read = () => {
      this._rafId = null;
      try {
        const entries = performance.getEntries() || [];
        const list = entries.map((e) => ({
          type: e.entryType,
          name: e.name,
          startTime: e.startTime,
          duration: e.duration,
        }));
        this.setState({ entriesList: list });
        this._addLog('now', `getEntries() 共 ${list.length} 条`);
      } catch (err) {
        this._addLog('warn', '读取 entries 失败：' + (err && err.message));
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      this._rafId = requestAnimationFrame(read);
    } else {
      read();
    }
  }

  _renderEntriesList() {
    const list = this.state.entriesList;
    if (!list || list.length === 0) {
      return h('div', { class: 'log-panel__empty' }, '（暂无 entries，点击上方按钮读取）');
    }
    return h('div', { class: 'log-panel', style: { maxHeight: '160px' } },
      list.map((e, i) => h('div', { class: 'log-panel__line' },
        h('span', { class: 'log-panel__tag log-panel__tag--now' }, e.type),
        h('span', { class: 'fs-sm' },
          `[${i}] ${e.name || '(无名)'} | start=${e.startTime} | dur=${e.duration}`),
      )),
    );
  }

  _renderCard1() {
    const s = this.state;
    return this._card(
      'Card 1 · Performance Timeline 基础',
      'performance.now() 返回受 timeOrigin 影响的高精度单调时间戳；' +
      'getEntries / getEntriesByType(type) / getEntriesByName(name, type) 读取缓冲区条目，' +
      'entry 类型含 mark / measure / navigation / resource / paint / longtask / event / first-input / layout-shift / largest-contentful-paint。',
      h(Tag, { color: 'primary' }, 'Timeline'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('performance.now() 对比 Date.now()', {
            type: 'primary', size: 'sm', onClick: () => this._compareNow(),
          }),
          this._btn('列出当前所有 entries', {
            size: 'sm', onClick: () => this._listEntries(),
          }),
        ),
        s.nowResult
          ? h('pre', { class: 'code-block mt-md' }, s.nowResult)
          : null,
        h('div', { class: 'mt-md' }, this._renderEntriesList()),
        h('pre', { class: 'code-block mt-md' },
`performance.now();              // 高精度时间戳（毫秒，亚毫秒精度）
performance.timeOrigin;         // 时间基准点
performance.getEntries();       // 全部条目
performance.getEntriesByType('mark');
performance.getEntriesByName('gap', 'measure');`),
      ],
    );
  }

  // =================================================================
  // Card 2：User Timing (mark / measure)
  // =================================================================

  _markMeasureGap() {
    if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
      this._addLog('warn', 'performance.mark 不可用');
      return;
    }
    try {
      performance.mark('mark-A');
      this.setState({ markResult: '已标记 mark-A，50ms 后标记 mark-B 并 measure' });
      this._addLog('mark', 'performance.mark("mark-A")');
      setTimeout(() => {
        try {
          if (typeof performance.mark !== 'function') return;
          performance.mark('mark-B');
          this._addLog('mark', 'performance.mark("mark-B")');
          let dur = null;
          if (typeof performance.measure === 'function') {
            performance.measure('gap', 'mark-A', 'mark-B');
            let m = null;
            try {
              const arr = performance.getEntriesByName
                ? performance.getEntriesByName('gap', 'measure')
                : [];
              m = arr && arr[0] ? arr[0] : null;
            } catch { m = null; }
            dur = m ? m.duration : null;
          }
          const text = 'measure("gap", "mark-A", "mark-B") → duration = ' +
            (dur != null ? dur.toFixed(3) + ' ms' : '（无法读取）');
          this.setState({ measureResult: text });
          this._addLog('measure', `gap duration=${dur != null ? dur.toFixed(3) + 'ms' : '?'}`);
        } catch (err) {
          this._addLog('warn', 'mark-B / measure 失败：' + (err && err.message));
        }
      }, 50);
    } catch (err) {
      this._addLog('warn', 'mark-A 失败：' + (err && err.message));
    }
  }

  _batchMarks() {
    if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
      this._addLog('warn', 'performance.mark 不可用');
      return;
    }
    try {
      const N = 100;
      for (let i = 0; i < N; i++) {
        performance.mark('batch-' + i);
      }
      let spanDur = null;
      if (typeof performance.measure === 'function') {
        try {
          performance.measure('batch-span', 'batch-0', 'batch-' + (N - 1));
          const arr = performance.getEntriesByName
            ? performance.getEntriesByName('batch-span', 'measure')
            : [];
          const m = arr && arr[0] ? arr[0] : null;
          spanDur = m ? m.duration : null;
        } catch { /* noop */ }
      }
      let markCount = 0;
      let measureCount = 0;
      try {
        markCount = (performance.getEntriesByType('mark') || []).length;
      } catch { /* noop */ }
      try {
        measureCount = (performance.getEntriesByType('measure') || []).length;
      } catch { /* noop */ }
      this.setState({
        markResult: `批量标记 ${N} 个 mark，当前 mark 数=${markCount}，measure 数=${measureCount}`,
        measureResult: 'batch-span（batch-0 → batch-99）duration = ' +
          (spanDur != null ? spanDur.toFixed(3) + ' ms' : '（无法读取）'),
      });
      this._addLog('mark', `批量标记 ${N} 个 mark，mark 数=${markCount}`);
      this._addLog('measure', `batch-span duration=${spanDur != null ? spanDur.toFixed(3) + 'ms' : '?'}`);
    } catch (err) {
      this._addLog('warn', '批量 mark 失败：' + (err && err.message));
    }
  }

  _clearUserTiming() {
    if (typeof performance === 'undefined') {
      this._addLog('warn', 'performance 不可用');
      return;
    }
    try {
      if (typeof performance.clearMarks === 'function') performance.clearMarks();
      if (typeof performance.clearMeasures === 'function') performance.clearMeasures();
      this.setState({ markResult: '已执行 clearMarks() / clearMeasures()', measureResult: '' });
      this._addLog('mark', '已清除所有 marks / measures');
    } catch (err) {
      this._addLog('warn', '清除失败：' + (err && err.message));
    }
  }

  _renderCard2() {
    const s = this.state;
    return this._card(
      'Card 2 · User Timing (mark / measure)',
      'performance.mark(name) 创建标记，performance.measure(name, startMark, endMark) 测量区间，' +
      'clearMarks() / clearMeasures() 清除，getEntriesByType("mark"|"measure") 读取。',
      h(Tag, { color: 'success' }, 'User Timing'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('mark-A → 50ms → mark-B → measure', {
            type: 'primary', size: 'sm', onClick: () => this._markMeasureGap(),
          }),
          this._btn('批量 mark 100 + measure 统计', {
            size: 'sm', onClick: () => this._batchMarks(),
          }),
          this._btn('clearMarks / clearMeasures', {
            size: 'sm', danger: true, onClick: () => this._clearUserTiming(),
          }),
        ),
        s.markResult
          ? h('div', { class: 'fs-sm mt-md', style: { whiteSpace: 'pre-line' } }, s.markResult)
          : null,
        s.measureResult
          ? h('div', { class: 'fs-sm mt-xs', style: { whiteSpace: 'pre-line' } }, s.measureResult)
          : null,
        h('pre', { class: 'code-block mt-md' },
`performance.mark('mark-A');
// ...do work...
performance.mark('mark-B');
performance.measure('gap', 'mark-A', 'mark-B');
performance.getEntriesByType('measure'); // 读取 duration
performance.clearMarks(); performance.clearMeasures();`),
      ],
    );
  }

  // =================================================================
  // Card 3：PerformanceObserver
  // =================================================================

  _startObserver() {
    if (typeof PerformanceObserver === 'undefined') {
      this._addLog('warn', 'PerformanceObserver 不可用（observe 调用会被忽略）');
      return;
    }
    if (this._perfObserver) {
      this._addLog('observer', 'PerformanceObserver 已在运行');
      return;
    }
    try {
      const observer = new PerformanceObserver((list) => {
        try {
          const entries = list && typeof list.getEntries === 'function'
            ? list.getEntries() : [];
          entries.forEach((e) => {
            this._addLog('observer',
              `回调 entryType=${e.entryType} name=${e.name || '(无)'} ` +
              `start=${e.startTime} dur=${(e.duration || 0).toFixed(2)}ms`);
          });
        } catch { /* noop */ }
      });
      // 优先用新版 { type, buffered } 写法，失败则回退到 { entryTypes }
      try {
        observer.observe({ type: 'measure', buffered: true });
        try { observer.observe({ type: 'mark', buffered: true }); } catch { /* noop */ }
      } catch {
        try { observer.observe({ entryTypes: ['measure', 'mark'] }); } catch { /* noop */ }
      }
      this._perfObserver = observer;
      this.setState({ observerStatus: '运行中（观察 measure / mark，buffered=true）' });
      this._addLog('observer', 'PerformanceObserver 已启动，观察 measure / mark（含历史缓冲）');
    } catch (err) {
      this._addLog('warn', '创建 PerformanceObserver 失败：' + (err && err.message));
    }
  }

  _triggerObserver() {
    if (!this._perfObserver) {
      this._addLog('warn', '请先点击「启动 observer」');
      return;
    }
    if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
      this._addLog('warn', 'performance.mark 不可用，无法触发');
      return;
    }
    try {
      const tag = 'obs-' + Date.now();
      performance.mark(tag + '-start');
      this._addLog('mark', `触发 mark ${tag}-start，30ms 后 measure`);
      setTimeout(() => {
        try {
          if (typeof performance.mark !== 'function') return;
          performance.mark(tag + '-end');
          if (typeof performance.measure === 'function') {
            performance.measure(tag, tag + '-start', tag + '-end');
          }
          this._addLog('mark', `已 mark ${tag}-end 并 measure(${tag})`);
        } catch (err) {
          this._addLog('warn', '触发 measure 失败：' + (err && err.message));
        }
      }, 30);
    } catch (err) {
      this._addLog('warn', '触发 observer 失败：' + (err && err.message));
    }
  }

  _stopObserver() {
    if (!this._perfObserver) {
      this._addLog('info', 'PerformanceObserver 未启动');
      return;
    }
    try { this._perfObserver.disconnect(); } catch { /* noop */ }
    this._perfObserver = null;
    this.setState({ observerStatus: '已 disconnect' });
    this._addLog('observer', 'PerformanceObserver 已 disconnect');
  }

  _renderCard3() {
    const s = this.state;
    return this._card(
      'Card 3 · PerformanceObserver',
      'new PerformanceObserver(cb) 异步订阅性能条目；observe({type, buffered:true}) 订阅单个类型并回放历史缓冲，' +
      '或 observe({entryTypes:[...]}) 一次订阅多个类型；disconnect() 停止订阅。componentWillUnmount 会自动 disconnect。',
      h(Tag, { color: s.observerStatus.startsWith('运行') ? 'success' : 'default' }, s.observerStatus),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('启动 observer 观察 measure', {
            type: 'primary', size: 'sm', onClick: () => this._startObserver(),
          }),
          this._btn('触发 mark + measure', {
            size: 'sm', onClick: () => this._triggerObserver(),
          }),
          this._btn('disconnect', {
            size: 'sm', danger: true, onClick: () => this._stopObserver(),
          }),
        ),
        h('pre', { class: 'code-block mt-md' },
`const obs = new PerformanceObserver((list) => {
  list.getEntries().forEach((e) => console.log(e.entryType, e.name));
});
// 新版写法（单类型 + 历史缓冲）
obs.observe({ type: 'measure', buffered: true });
// 旧版写法（多类型）
obs.observe({ entryTypes: ['mark', 'measure'] });
obs.disconnect(); // 停止订阅`),
      ],
    );
  }

  // =================================================================
  // Card 4：Navigation Timing + Resource Timing
  // =================================================================

  _readNavTiming() {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
      this._addLog('warn', 'performance.getEntriesByType 不可用');
      return;
    }
    let nav = null;
    try {
      const arr = performance.getEntriesByType('navigation');
      nav = arr && arr[0] ? arr[0] : null;
    } catch { nav = null; }
    if (!nav) {
      this.setState({ navTiming: null });
      this._addLog('warn', 'navigation timing 不可用（非浏览器环境或已被 mock 为空）');
      return;
    }
    const ttfb = (nav.responseStart || 0) - (nav.requestStart || 0);
    const domParse = (nav.domComplete || 0) - (nav.responseEnd || 0);
    const data = {
      type: nav.type,
      startTime: nav.startTime,
      requestStart: nav.requestStart,
      responseStart: nav.responseStart,
      responseEnd: nav.responseEnd,
      domInteractive: nav.domInteractive,
      domContentLoadedEventStart: nav.domContentLoadedEventStart,
      domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
      domComplete: nav.domComplete,
      loadEventStart: nav.loadEventStart,
      loadEventEnd: nav.loadEventEnd,
      transferSize: nav.transferSize,
      encodedBodySize: nav.encodedBodySize,
      decodedBodySize: nav.decodedBodySize,
      ttfb,
      domParse,
    };
    this.setState({ navTiming: data });
    this._addLog('nav',
      `type=${data.type}，TTFB=${ttfb.toFixed(2)}ms，DOM解析=${domParse.toFixed(2)}ms，` +
      `transferSize=${data.transferSize}`);
  }

  _listResources() {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
      this._addLog('warn', 'performance.getEntriesByType 不可用');
      return;
    }
    let res = [];
    try { res = performance.getEntriesByType('resource') || []; } catch { res = []; }
    const list = res.slice(0, 10).map((r) => ({
      name: r.name,
      initiatorType: r.initiatorType,
      duration: r.duration,
      transferSize: r.transferSize,
      decodedBodySize: r.decodedBodySize,
    }));
    this.setState({ resourceList: list });
    this._addLog('resource', `共 ${res.length} 条 resource，展示前 ${list.length} 条`);
  }

  _renderNavTable(nav) {
    if (!nav) {
      return h('div', { class: 'log-panel__empty' }, '（暂无 navigation timing，点击上方按钮读取）');
    }
    const TH = { padding: '6px 10px', borderBottom: '1px solid var(--color-border, #eee)', textAlign: 'left', fontSize: '12px' };
    const TD = { padding: '6px 10px', borderBottom: '1px solid var(--color-border, #f0f0f0)', fontSize: '12px' };
    const f = (v) => (typeof v === 'number' ? v.toFixed(2) + ' ms' : String(v));
    const stages = [
      ['重定向', nav.startTime, nav.requestStart],
      ['TTFB（请求→响应首字节）', nav.requestStart, nav.responseStart],
      ['响应下载', nav.responseStart, nav.responseEnd],
      ['DOM 解析（响应结束→domComplete）', nav.responseEnd, nav.domComplete],
      ['DOMContentLoaded 事件', nav.domContentLoadedEventStart, nav.domContentLoadedEventEnd],
      ['load 事件', nav.loadEventStart, nav.loadEventEnd],
      ['总耗时（startTime→loadEventEnd）', nav.startTime, nav.loadEventEnd],
    ];
    return h('div', {},
      h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' } },
        h('thead', {}, h('tr', {},
          h('th', { style: TH }, '阶段'),
          h('th', { style: TH }, '起点(ms)'),
          h('th', { style: TH }, '终点(ms)'),
          h('th', { style: TH }, '耗时(ms)'),
        )),
        h('tbody', {},
          ...stages.map((row) => {
            const dur = (row[2] || 0) - (row[1] || 0);
            return h('tr', {},
              h('td', { style: TD }, row[0]),
              h('td', { style: TD }, f(row[1])),
              h('td', { style: TD }, f(row[2])),
              h('td', { style: TD }, dur.toFixed(2)),
            );
          }),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' },
        h(Tag, { color: 'primary' }, 'type: ' + (nav.type || '—')),
        h(Tag, { color: 'default' }, 'transferSize: ' + (nav.transferSize ?? '—')),
        h(Tag, { color: 'default' }, 'encodedBodySize: ' + (nav.encodedBodySize ?? '—')),
        h(Tag, { color: 'default' }, 'decodedBodySize: ' + (nav.decodedBodySize ?? '—')),
        h(Tag, { color: 'success' }, 'TTFB: ' + nav.ttfb.toFixed(2) + 'ms'),
        h(Tag, { color: 'warning' }, 'DOM解析: ' + nav.domParse.toFixed(2) + 'ms'),
      ),
    );
  }

  _renderResourceList() {
    const list = this.state.resourceList;
    if (!list || list.length === 0) {
      return h('div', { class: 'log-panel__empty' }, '（暂无 resource entries，点击上方按钮读取）');
    }
    const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border, #f0f0f0)', fontSize: '12px' };
    const TH = { padding: '4px 8px', borderBottom: '1px solid var(--color-border, #eee)', textAlign: 'left', fontSize: '12px' };
    return h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' } },
      h('thead', {}, h('tr', {},
        h('th', { style: TH }, 'name(url)'),
        h('th', { style: TH }, 'initiatorType'),
        h('th', { style: TH }, 'duration(ms)'),
        h('th', { style: TH }, 'transferSize'),
      )),
      h('tbody', {},
        ...list.map((r) => h('tr', {},
          h('td', { style: TD, title: r.name }, r.name.length > 40 ? r.name.slice(0, 40) + '…' : r.name),
          h('td', { style: TD }, r.initiatorType || '—'),
          h('td', { style: TD }, (r.duration || 0).toFixed(2)),
          h('td', { style: TD }, r.transferSize ?? '—'),
        )),
      ),
    );
  }

  _renderCard4() {
    return this._card(
      'Card 4 · Navigation Timing + Resource Timing',
      'performance.getEntriesByType("navigation")[0] 得到 PerformanceNavigationTiming，' +
      '可计算 TTFB = responseStart - requestStart、DOM 解析耗时 = domComplete - responseEnd；' +
      'getEntriesByType("resource") 得到 PerformanceResourceTiming[]（name/initiatorType/duration/transferSize）。',
      h(Tag, { color: 'warning' }, 'Timing'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('读取 navigation timing', {
            type: 'primary', size: 'sm', onClick: () => this._readNavTiming(),
          }),
          this._btn('列出 resource entries（前 10）', {
            size: 'sm', onClick: () => this._listResources(),
          }),
        ),
        h('div', { class: 'mt-md' }, this._renderNavTable(this.state.navTiming)),
        h('div', { class: 'mt-md' }, this._renderResourceList()),
        h('pre', { class: 'code-block mt-md' },
`const nav = performance.getEntriesByType('navigation')[0];
// PerformanceNavigationTiming
nav.type;                 // 'navigate' | 'reload' | 'back_forward'
nav.requestStart; nav.responseStart; nav.responseEnd;
nav.domInteractive; nav.domComplete;
nav.domContentLoadedEventStart; nav.domContentLoadedEventEnd;
nav.loadEventStart; nav.loadEventEnd;
nav.transferSize; nav.encodedBodySize;
const ttfb = nav.responseStart - nav.requestStart;
const domParse = nav.domComplete - nav.responseEnd;

const res = performance.getEntriesByType('resource');
res.forEach((r) => {
  r.name;            // 资源 url
  r.initiatorType;   // script | link | img | xmlhttprequest ...
  r.duration; r.transferSize; r.decodedBodySize;
});`),
      ],
    );
  }

  // =================================================================
  // Card 5：Web Vitals (LCP / CLS / FID / Long Task) + measureMemory
  // =================================================================

  _startVitals() {
    if (typeof PerformanceObserver === 'undefined') {
      this._addLog('warn', 'PerformanceObserver 不可用，Web Vitals 观察器无法启动');
      return;
    }
    if (this._vitalsObserver) {
      this._addLog('info', 'Web Vitals 观察器已在运行');
      return;
    }
    const observers = [];
    // 订阅单个类型，优先 { type, buffered }，失败回退 { entryTypes }
    const subscribe = (type, handler, label) => {
      try {
        const obs = new PerformanceObserver((list) => {
          try {
            const entries = list && typeof list.getEntries === 'function'
              ? list.getEntries() : [];
            entries.forEach((e) => {
              try { handler(e); } catch { /* noop */ }
            });
          } catch { /* noop */ }
        });
        try { obs.observe({ type, buffered: true }); }
        catch {
          try { obs.observe({ entryTypes: [type] }); } catch { /* noop */ }
        }
        observers.push(obs);
        this._addLog('info', `已订阅 ${label}（${type}）`);
      } catch (err) {
        this._addLog('warn', `订阅 ${label}（${type}）失败：` + (err && err.message));
      }
    };

    // LCP：largest-contentful-paint，entry.startTime 为 LCP
    subscribe('largest-contentful-paint', (e) => {
      this._lcp = e.startTime || 0;
      const el = e.element ? e.element.tagName : '—';
      this._addLog('lcp', `LCP=${this._lcp.toFixed(2)}ms，element=${el}，size=${e.size || 0}`);
    }, 'LCP');

    // CLS：layout-shift，累加 value（忽略 hadRecentInput）
    subscribe('layout-shift', (e) => {
      if (!e.hadRecentInput) {
        this._cls += e.value || 0;
        this._addLog('cls', `CLS 累计=${this._cls.toFixed(4)}（本次=${(e.value || 0).toFixed(4)}）`);
      }
    }, 'CLS');

    // FID：first-input，processingStart - startTime
    subscribe('first-input', (e) => {
      this._fid = (e.processingStart || 0) - (e.startTime || 0);
      this._addLog('fid', `FID=${this._fid.toFixed(2)}ms`);
    }, 'FID');

    // Long Task：longtask，duration > 50ms
    subscribe('longtask', (e) => {
      if ((e.duration || 0) > 50) {
        this._addLog('longtask', `longtask duration=${(e.duration || 0).toFixed(2)}ms`);
      }
    }, 'Long Task');

    // Event Timing：event，entry.duration（含 processingTime）
    subscribe('event', (e) => {
      if ((e.duration || 0) > 50) {
        this._addLog('longtask', `event(${e.name || '—'}) duration=${(e.duration || 0).toFixed(2)}ms`);
      }
    }, 'Event Timing');

    this._vitalsObserver = {
      _observers: observers,
      disconnect() {
        observers.forEach((o) => { try { o.disconnect(); } catch { /* noop */ } });
      },
    };
    this.setState({ vitalsStatus: '运行中（LCP / CLS / FID / longtask / event）' });
    this._addLog('info', 'Web Vitals 四合一观察器已启动');
  }

  _stopVitals() {
    if (!this._vitalsObserver) {
      this._addLog('info', 'Web Vitals 观察器未启动');
      return;
    }
    try { this._vitalsObserver.disconnect(); } catch { /* noop */ }
    this._vitalsObserver = null;
    this.setState({ vitalsStatus: '已 disconnect' });
    this._addLog('info', 'Web Vitals 观察器已 disconnect');
  }

  _makeLongTask() {
    // 制造一个长任务：while 循环阻塞约 100ms，应触发 longtask observer 回调
    const nowFn = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? () => performance.now()
      : () => Date.now();
    this._addLog('info', '开始制造长任务（while 阻塞 ~100ms）');
    try {
      const start = nowFn();
      // eslint-disable-next-line no-empty
      while (nowFn() - start < 100) { /* busy loop */ }
      const elapsed = nowFn() - start;
      this._addLog('longtask', `长任务完成，阻塞约 ${elapsed.toFixed(2)}ms（若 longtask observer 已启动应回调）`);
    } catch (err) {
      this._addLog('warn', '制造长任务失败：' + (err && err.message));
    }
  }

  async _measureMemory() {
    if (typeof performance === 'undefined' ||
        typeof performance.measureUserAgentSpecificMemory !== 'function') {
      this._addLog('warn', 'performance.measureUserAgentSpecificMemory 不可用（需 crossOriginIsolated 且较新 Chromium）');
      this.setState({ memoryResult: '不可用（需 crossOriginIsolated 且较新 Chromium）' });
      return;
    }
    try {
      const result = await performance.measureUserAgentSpecificMemory();
      const bytes = result.bytes || 0;
      const mb = (bytes / 1024 / 1024).toFixed(2);
      const breakdown = result.breakdown || [];
      const parts = breakdown.map((b) =>
        `${b.jsMemoryType || b.type || '?'}=${b.bytes || 0}`);
      const text = `bytes=${bytes}（${mb} MB）\nbreakdown(${breakdown.length} 项)：\n` +
        (parts.length ? parts.join('\n') : '（无）');
      this.setState({ memoryResult: text });
      this._addLog('info', `measureMemory: ${mb} MB（${breakdown.length} 项 breakdown）`);
    } catch (err) {
      this._addLog('warn', 'measureMemory 失败：' + (err && err.message));
      this.setState({ memoryResult: '失败：' + (err && err.message) });
    }
  }

  _renderCard5() {
    const s = this.state;
    const deviceMemory = (typeof navigator !== 'undefined' && typeof navigator.deviceMemory !== 'undefined')
      ? navigator.deviceMemory + 'GB'
      : '—';
    const coi = (typeof self !== 'undefined' && !!self.crossOriginIsolated)
      || (typeof window !== 'undefined' && !!window.crossOriginIsolated);
    return this._card(
      'Card 5 · Web Vitals (LCP / CLS / FID / Long Task) + measureMemory',
      'LCP 观察 largest-contentful-paint 的 startTime；CLS 累加 layout-shift 的 value（!hadRecentInput）；' +
      'FID = first-input 的 processingStart - startTime；Long Task 观察 longtask（duration>50ms）；' +
      'Event Timing 观察 event 的 duration；navigator.deviceMemory 为设备内存(GB)；' +
      'performance.measureUserAgentSpecificMemory() 需 crossOriginIsolated。',
      h(Tag, { color: s.vitalsStatus.startsWith('运行') ? 'success' : 'default' }, s.vitalsStatus),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          h(Tag, { color: 'primary' }, 'deviceMemory: ' + deviceMemory),
          h(Tag, { color: coi ? 'success' : 'warning' },
            'crossOriginIsolated: ' + (coi ? 'true' : 'false')),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('启动 LCP/CLS/FID/longtask 四合一', {
            type: 'primary', size: 'sm', onClick: () => this._startVitals(),
          }),
          this._btn('制造一个长任务（while 100ms）', {
            size: 'sm', onClick: () => this._makeLongTask(),
          }),
          this._btn('measureMemory', {
            size: 'sm', onClick: () => this._measureMemory(),
          }),
          this._btn('disconnect', {
            size: 'sm', danger: true, onClick: () => this._stopVitals(),
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          h(Tag, { color: 'success' }, 'LCP: ' + (this._lcp != null ? this._lcp.toFixed(2) + 'ms' : '—')),
          h(Tag, { color: 'warning' }, 'CLS: ' + ((this._cls || 0).toFixed(4))),
          h(Tag, { color: 'primary' }, 'FID: ' + (this._fid != null ? this._fid.toFixed(2) + 'ms' : '—')),
        ),
        s.memoryResult
          ? h('pre', { class: 'code-block mt-md' }, s.memoryResult)
          : null,
        h('pre', { class: 'code-block mt-md' },
`// LCP
new PerformanceObserver((l) => l.getEntries()
  .forEach((e) => console.log('LCP', e.startTime)))
  .observe({ type: 'largest-contentful-paint', buffered: true });

// CLS（累加 value，排除 hadRecentInput）
let cls = 0;
new PerformanceObserver((l) => l.getEntries().forEach((e) => {
  if (!e.hadRecentInput) cls += e.value;
})).observe({ type: 'layout-shift', buffered: true });

// FID
new PerformanceObserver((l) => l.getEntries().forEach((e) => {
  const fid = e.processingStart - e.startTime;
})).observe({ type: 'first-input', buffered: true });

// Long Task
new PerformanceObserver((l) => l.getEntries()
  .forEach((e) => console.log('longtask', e.duration)))
  .observe({ type: 'longtask', buffered: true });

navigator.deviceMemory; // GB
performance.measureUserAgentSpecificMemory(); // 需 crossOriginIsolated`),
      ],
    );
  }

  // =================================================================
  // Card 6：Long Animation Frames API (LoAF)
  // =================================================================

  _runLoAFDemo() {
    if (typeof PerformanceObserver === 'undefined') {
      this._addLog('warn', 'PerformanceObserver 不可用，LoAF 观察器无法启动');
      return;
    }
    const supported = this._safe(() =>
      PerformanceObserver.supportedEntryTypes &&
      PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'));
    if (!supported) {
      this._addLog('warn', '当前浏览器不支持 long-animation-frame（需 Chrome 123+/Edge 123+）');
      this.setState({ loafStatus: '不支持 long-animation-frame（需 Chrome 123+/Edge 123+）' });
      return;
    }
    if (this._loafObserver) {
      this._addLog('info', 'LoAF 观察器已在运行');
      return;
    }
    try {
      const observer = new PerformanceObserver((list) => {
        try {
          const entries = list && typeof list.getEntries === 'function'
            ? list.getEntries() : [];
          entries.forEach((entry) => {
            try {
              const scripts = (entry.scripts || []).map((sc) => ({
                name: sc.name,
                startTime: sc.startTime,
                duration: sc.duration,
                durationType: sc.durationType,
                involuntaryType: sc.involuntaryType,
                invoker: sc.invoker,
                invokerType: sc.invokerType,
              }));
              const info = {
                startTime: entry.startTime,
                duration: entry.duration,
                renderStart: entry.renderStart,
                styleAndLayoutStart: entry.styleAndLayoutStart,
                blockingDuration: entry.blockingDuration,
                firstUIEventTimestamp: entry.firstUIEventTimestamp,
                scripts,
              };
              this.setState({ loafInfo: info });
              this._addLog('loaf',
                `LoAF duration=${(entry.duration || 0).toFixed(2)}ms ` +
                `blocking=${(entry.blockingDuration || 0).toFixed(2)}ms ` +
                `renderStart=${(entry.renderStart || 0).toFixed(2)}ms ` +
                `scripts=${scripts.length}`);
              scripts.forEach((sc, i) => {
                this._addLog('loaf',
                  `  script[${i}] ${sc.name || '(无名)'} ` +
                  `dur=${(sc.duration || 0).toFixed(2)}ms type=${sc.durationType || '—'} ` +
                  `invoker=${sc.invoker || '—'}(${sc.invokerType || '—'}) ` +
                  `involuntary=${sc.involuntaryType || '—'}`);
              });
            } catch { /* noop */ }
          });
        } catch { /* noop */ }
      });
      // 优先 { type, buffered }，失败回退 { entryTypes }
      try { observer.observe({ type: 'long-animation-frame', buffered: true }); }
      catch {
        try { observer.observe({ entryTypes: ['long-animation-frame'] }); } catch { /* noop */ }
      }
      this._loafObserver = observer;
      this.setState({ loafStatus: '运行中（观察 long-animation-frame，buffered=true）' });
      this._addLog('loaf', 'LoAF 观察器已启动，观察 long-animation-frame（buffered=true）');

      // 制造一个 ~80ms 长任务以触发 LoAF 回调（同步 while 阻塞主线程）
      const nowFn = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? () => performance.now()
        : () => Date.now();
      setTimeout(() => {
        try {
          const start = nowFn();
          // eslint-disable-next-line no-empty
          while (nowFn() - start < 80) { /* busy loop 制造长帧 */ }
          this._addLog('loaf', `已制造 ~80ms 长任务，等待 LoAF 回调（实际阻塞约 ${(nowFn() - start).toFixed(2)}ms）`);
        } catch (err) {
          this._addLog('warn', '制造长任务失败：' + (err && err.message));
        }
      }, 0);
    } catch (err) {
      this._addLog('warn', '创建 LoAF 观察器失败：' + (err && err.message));
    }
  }

  _stopLoAF() {
    if (!this._loafObserver) {
      this._addLog('info', 'LoAF 观察器未启动');
      return;
    }
    try { this._loafObserver.disconnect(); } catch { /* noop */ }
    this._loafObserver = null;
    this.setState({ loafStatus: '已 disconnect' });
    this._addLog('loaf', 'LoAF 观察器已 disconnect');
  }

  _renderLoAFInfo() {
    const info = this.state.loafInfo;
    if (!info) {
      return h('div', { class: 'log-panel__empty' },
        '（暂无 LoAF entry，点击上方按钮启动观察器并制造长任务以触发回调）');
    }
    const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border, #f0f0f0)', fontSize: '12px' };
    const TH = { padding: '4px 8px', borderBottom: '1px solid var(--color-border, #eee)', textAlign: 'left', fontSize: '12px' };
    const f = (v) => (typeof v === 'number' ? v.toFixed(2) + ' ms' : String(v == null ? '—' : v));
    const trimName = (n) => {
      const s = n || '(无名)';
      return s.length > 40 ? s.slice(0, 40) + '…' : s;
    };
    return h('div', {},
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' },
        h(Tag, { color: 'warning' }, 'duration: ' + f(info.duration)),
        h(Tag, { color: 'danger' }, 'blockingDuration: ' + f(info.blockingDuration)),
        h(Tag, { color: 'primary' }, 'renderStart: ' + f(info.renderStart)),
        h(Tag, { color: 'primary' }, 'styleAndLayoutStart: ' + f(info.styleAndLayoutStart)),
        h(Tag, { color: 'default' }, 'firstUIEvent: ' + f(info.firstUIEventTimestamp)),
        h(Tag, { color: 'default' }, 'startTime: ' + f(info.startTime)),
      ),
      info.scripts && info.scripts.length > 0
        ? h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' } },
            h('thead', {}, h('tr', {},
              h('th', { style: TH }, 'name(url)'),
              h('th', { style: TH }, 'duration'),
              h('th', { style: TH }, 'durationType'),
              h('th', { style: TH }, 'invoker / invokerType'),
              h('th', { style: TH }, 'involuntaryType'),
            )),
            h('tbody', {},
              ...info.scripts.map((sc) => h('tr', {},
                h('td', { style: TD, title: sc.name || '' }, trimName(sc.name)),
                h('td', { style: TD }, f(sc.duration)),
                h('td', { style: TD }, sc.durationType || '—'),
                h('td', { style: TD }, (sc.invoker || '—') + ' / ' + (sc.invokerType || '—')),
                h('td', { style: TD }, sc.involuntaryType || '—'),
              )),
            ),
          )
        : h('div', { class: 'fs-sm text-secondary mt-sm' }, '（本帧无 scripts 归因）'),
    );
  }

  _renderCard6() {
    const s = this.state;
    const supported = this._safe(() =>
      typeof PerformanceObserver !== 'undefined' &&
      !!PerformanceObserver.supportedEntryTypes &&
      PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'));
    const entryClass = this._safe(() =>
      typeof PerformanceLongAnimationFrameEntry !== 'undefined');
    return this._card(
      'Card 6 · Long Animation Frames API (LoAF)',
      'LoAF (Long Animation Frames) 是 PerformanceLongTask 的后继者，观测 >50ms 的长动画帧（含渲染阶段），' +
      '浏览器支持 Chrome 123+/Edge 123+。PerformanceLongAnimationFrameEntry 含 duration / renderStart / ' +
      'styleAndLayoutStart / blockingDuration / firstUIEventTimestamp / startTime / scripts[]；' +
      'blockingDuration 为阻塞主线程时长（含 LongTask，与 INP 强相关），scripts[] 可把慢交互归因到具体脚本（含第三方），' +
      '是 INP (Interaction to Next Paint) 调优的核心工具。',
      h(Tag, { color: supported ? 'success' : 'warning' },
        'LoAF: ' + (supported ? 'supported' : 'unsupported')),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          h(Tag, { color: supported ? 'success' : 'default' },
            'supportedEntryTypes 含 long-animation-frame: ' + (supported ? '✓' : '✗')),
          h(Tag, { color: entryClass ? 'success' : 'default' },
            'PerformanceLongAnimationFrameEntry: ' + (entryClass ? '✓' : '✗')),
          h(Tag, { color: s.loafStatus.startsWith('运行') ? 'success' : 'default' }, s.loafStatus),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('启动 LoAF 观察器 + 制造长任务', {
            type: 'primary', size: 'sm', onClick: () => this._runLoAFDemo(),
          }),
          this._btn('disconnect', {
            size: 'sm', danger: true, onClick: () => this._stopLoAF(),
          }),
        ),
        h('div', { class: 'mt-md' }, this._renderLoAFInfo()),
        h('pre', { class: 'code-block mt-md' },
`// LoAF：观测 >50ms 长动画帧（PerformanceLongAnimationFrameEntry）
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    entry.startTime;             // 帧起点
    entry.duration;              // 帧总时长（含渲染，>50ms 才上报）
    entry.renderStart;           // 渲染阶段起点
    entry.styleAndLayoutStart;   // 样式与布局起点
    entry.blockingDuration;      // 主线程阻塞时长（含 LongTask，与 INP 强相关）
    entry.firstUIEventTimestamp; // 帧内首个 UI 事件时间戳（用于归因交互）
    entry.scripts.forEach((sc) => {
      sc.name;            // 脚本 url（跨域受限，可能为空）
      sc.startTime; sc.duration;
      sc.durationType;          // 'script' | 'long-script'
      sc.involuntaryType;       // 'forcedLayout' | 'reclonedFlow' | null（非自愿执行）
      sc.invoker; sc.invokerType; // 触发者，如 'BUTTON#x' / 'event'
    });
  });
}).observe({ type: 'long-animation-frame', buffered: true });
// 或 observe({ entryTypes: ['long-animation-frame'] })

// duration vs blockingDuration：
//   duration          = 帧总时长（含 task + render + style/layout）
//   blockingDuration  = 阻塞主线程时长（duration - 渲染并行部分，含 LongTask）
// 与 INP 协同：点击按钮 → INP >200ms → LoAF 找到 blockingDuration 与阻塞脚本 → 优化

// 陷阱：
// 1. buffered 仅回放 observe 之前页面加载后已缓冲的 entry，无法补全更早历史
// 2. scripts[] 含帧内执行的所有脚本（含第三方库 / 广告 / 分析脚本）
// 3. 跨域脚本 name 字段受限，部分浏览器仅返回空串或 origin
// 4. LoAF 观察器本身有性能开销，生产建议采样或加 duration 阈值过滤
// 5. 与 longtask 的区别：LoAF 含渲染阶段归因，longtask 仅给 duration 无脚本归因`),
      ],
    );
  }

  // =================================================================
  // 整页渲染
  // =================================================================

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Performance 性能监控实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Performance Timeline / User Timing / PerformanceObserver / Navigation & Resource Timing / Web Vitals（LCP/CLS/FID/Long Task）/ Long Animation Frames (LoAF)。'),
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
