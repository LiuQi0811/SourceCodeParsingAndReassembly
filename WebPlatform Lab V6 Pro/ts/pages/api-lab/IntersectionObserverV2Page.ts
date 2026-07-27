// =====================================================================
// IntersectionObserverV2Page.js —— IntersectionObserver v2 可见性追踪 实验室
// 演示 MDN：
//   1. trackVisibility 与延迟 —— new IntersectionObserver(cb, { trackVisibility: true, delay: 100, threshold, rootMargin, root })；
//      delay 必须 ≥ 100ms（否则抛 TypeError）；trackVisibility 启用后 entries 多 isVisible 字段；构造器签名与 v1 相同。
//   2. isVisible 字段与遮挡检测 —— entry.isVisible 区分「几何相交」与「实际可见」；opacity:0 / visibility:hidden /
//      被其他元素覆盖 / clip-path / transform: scale(0) 都会让 isVisible=false 但 isIntersecting 可能仍 true。
//   3. rootMargin 与 threshold 数组 —— rootMargin（'10px 20px 30px 40px' / '-50% 0px' 预加载）、threshold（[0,0.25,0.5,0.75,1]
//      多阈值回调）、root（默认 viewport，可为指定元素）；注意 trackVisibility: true 时 rootMargin 限制为 0px（非零抛 TypeError）。
//   4. observe / unobserve / disconnect / takeRecords —— observer.observe(target) / unobserve(target) / disconnect() /
//      takeRecords() 返回未交付的 entry 数组；v2 与 v1 API 完全相同；takeRecords 在回调前同步读取 pending entries。
//   5. 使用场景与限制 —— 广告可见性监测（IAB Viewability：50% 像素 ≥1s 连续）、懒加载（isIntersecting 提前 + isVisible 兜底）、
//      曝光埋点（isVisible=true 才计入）、防盗刷（isVisible=false 不计播放）；限制：trackVisibility 性能开销大、delay 最小 100ms、
//      rootMargin 必须 0、SecureContext（HTTPS）要求、移动端节电。
//   6. 与 IntersectionObserver v1 / PerformanceObserver 对比 —— v1 vs v2 API 差异表（选项/entry 字段/限制）、与 PerformanceObserver
//      对比（PO 监听性能条目 vs IO 监听几何可见）、与 ResizeObserver 协同（IO 触发后 RO 监听尺寸）、与 scroll 事件对比
//      （IO 替代 scroll+getBoundingClientRect 性能更优）。
// 说明：IntersectionObserver v2（trackVisibility / isVisible）为 Chrome 51+/74+ 渐进支持；jsdom 自带 IntersectionObserver polyfill
//       但不实现 trackVisibility（选项被静默忽略，不抛 TypeError），且 mock 不触发回调。所有 API 调用前做能力检测，
//       不可用仅记日志，绝不抛异常；演示通过 setTimeout 模拟 entry 对象 { isIntersecting, isVisible, intersectionRatio,
//       target, time, boundingClientRect, intersectionRect, rootBounds } 展示 v2 语义。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

interface LogEntry { type: string; content: string; time: string; }

interface IntersectionObserverV2PageCaps {
  io: boolean;
  v2: boolean;
  observe: boolean;
  unobserve: boolean;
  disconnect: boolean;
  takeRecords: boolean;
}

export interface IntersectionObserverV2PageProps extends Props {}

export interface IntersectionObserverV2PageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  trackVisibilityInfo: string;
  visibilityInfo: string;
  marginThresholdInfo: string;
  lifecycleInfo: string;
  scenariosInfo: string;
  compareInfo: string;
}

export class IntersectionObserverV2Page extends Page {
  declare props: IntersectionObserverV2PageProps;
  declare state: IntersectionObserverV2PageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _observer!: any;
  _observedTargets!: any[];
  _simTimers!: any[];
  _simTarget!: any;


  // —— 初始 state ——
  initialState(): IntersectionObserverV2PageState {
    return {
      logs: [],
      capsSummary: '',
      trackVisibilityInfo: '',  // Card 1：trackVisibility 与延迟
      visibilityInfo: '',       // Card 2：isVisible 字段与遮挡检测
      marginThresholdInfo: '',   // Card 3：rootMargin 与 threshold 数组
      lifecycleInfo: '',        // Card 4：observe / unobserve / disconnect / takeRecords
      scenariosInfo: '',        // Card 5：使用场景与限制
      compareInfo: '',          // Card 6：与 IntersectionObserver v1 / PerformanceObserver 对比
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._observer = null;          // Card 1/4 创建的 IntersectionObserver 引用
    this._observedTargets = [];     // Card 4 observe 的 target 元素列表
    this._simTimers = [];           // Card 2/4 setTimeout 模拟回调的定时器句柄
    this._simTarget = null;         // Card 2 模拟用 target 元素

    // 一次性能力检测：IntersectionObserver + v2 trackVisibility
    const caps = this._caps();
    const parts = [
      `IntersectionObserver ${caps.io ? '✓' : '✗'}`,
      `trackVisibility(v2) ${caps.v2 ? '✓' : '✗'}`,
      `observe ${caps.observe ? '✓' : '✗'}`,
      `unobserve ${caps.unobserve ? '✓' : '✗'}`,
      `disconnect ${caps.disconnect ? '✓' : '✗'}`,
      `takeRecords ${caps.takeRecords ? '✓' : '✗'}`,
    ];
    const anyAvailable = caps.io;
    const summary = anyAvailable
      ? `IntersectionObserver v2 能力检测：${parts.join(' · ')}。jsdom polyfill 提供 v1 构造器与方法，但 trackVisibility 选项被静默忽略（不抛 TypeError，也不真正追踪可见性），且 mock 不可触发回调。可执行的演示将以真实 API 运行构造/方法调用，缺失的回调语义通过 setTimeout 模拟 entry 对象展示。`
      : '当前环境不支持 IntersectionObserver（typeof 为 "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（Chrome 51+ v1 / 74+ v2）中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.v2) this._addLog('warn', 'trackVisibility (v2) 不可用（jsdom polyfill 静默忽略该选项，不强制 delay ≥ 100）');
  }

  componentWillUnmount(): void {
    // 1. 断开所有创建的 IntersectionObserver
    try {
      if (this._observer && typeof this._observer.disconnect === 'function') this._observer.disconnect();
    } catch { /* noop */ }
    this._observer = null;
    // 2. 清理所有 setTimeout 模拟定时器
    for (const t of this._simTimers || []) {
      try { clearTimeout(t); } catch { /* noop */ }
    }
    this._simTimers = [];
    // 3. 释放 observe 的 target 引用
    this._observedTargets = [];
    this._simTarget = null;
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps(): IntersectionObserverV2PageCaps {
    const hasIO = typeof IntersectionObserver !== 'undefined';
    let v2Supported = false;
    let observeFn = false, unobserveFn = false, disconnectFn = false, takeRecordsFn = false;
    if (hasIO) {
      let probe = null;
      // 探测 v2：真正支持 trackVisibility 的浏览器在 delay < 100 时抛 TypeError
      try {
        probe = new IntersectionObserver(() => {}, { trackVisibility: true, delay: 50 } as any);
        // 未抛 → trackVisibility 被静默忽略（jsdom polyfill / v1-only），v2 未真正生效
        v2Supported = false;
      } catch (e: any) {
        if (e instanceof TypeError) v2Supported = true;  // 真正支持 v2（强制 delay ≥ 100）
        else v2Supported = false;
      }
      // 若上面构造抛错，再退回 v1 构造一个 probe 以检测方法
      if (!probe) {
        try { probe = new IntersectionObserver(() => {}); } catch { probe = null; }
      }
      if (probe) {
        observeFn = typeof probe.observe === 'function';
        unobserveFn = typeof probe.unobserve === 'function';
        disconnectFn = typeof probe.disconnect === 'function';
        takeRecordsFn = typeof probe.takeRecords === 'function';
        try { probe.disconnect(); } catch { /* noop */ }
      }
    }
    return {
      io: hasIO,
      v2: v2Supported,
      observe: observeFn,
      unobserve: unobserveFn,
      disconnect: disconnectFn,
      takeRecords: takeRecordsFn,
    };
  }

  // 构造一个模拟的 v2 entry 对象（jsdom 无回调，用于演示 isVisible 语义）
  _makeFakeEntry({  isIntersecting, isVisible, ratio  }: { isIntersecting: boolean; isVisible: boolean; ratio: number }): any {
    const target = this._simTarget || (this._simTarget = (typeof document !== 'undefined' ? document.createElement('div') : {}));
    const rect = { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 100, width: 200, height: 100 };
    return {
      isIntersecting,
      isVisible,
      intersectionRatio: ratio,
      target,
      time: typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
      boundingClientRect: rect,
      intersectionRect: isIntersecting ? rect : { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 },
      rootBounds: rect,
    };
  }

  // =================== Card 1：trackVisibility 与延迟 ===================

  _showIoCaps(): void {
    const caps = this._caps();
    this.setState({ trackVisibilityInfo:
      '===== IntersectionObserver v2 能力检测 =====\n\n' +
      `  IntersectionObserver      : ${caps.io ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  trackVisibility (v2)       : ${caps.v2 ? '支持（delay < 100 抛 TypeError）' : '不支持（选项被静默忽略）'}\n` +
      `  observer.observe          : ${caps.observe ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  observer.unobserve        : ${caps.unobserve ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  observer.disconnect       : ${caps.disconnect ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  observer.takeRecords      : ${caps.takeRecords ? 'function（可用）' : 'undefined（不可用）'}\n\n` +
      "API 表面：new IntersectionObserver(callback, options) → IntersectionObserver\n" +
      "  options = { root, rootMargin, threshold, trackVisibility, delay }\n" +
      "  trackVisibility: true 启用 v2 可见性追踪；delay ≥ 100ms（默认 100）控制可见性稳定时间\n\n" +
      '构造器签名与 v1 相同：v2 通过 options 启用，callback 收到的 entry 多 isVisible 字段。' });
    this._addLog('compare', `IO v2 检测：io=${caps.io}, v2=${caps.v2}, observe=${caps.observe}, takeRecords=${caps.takeRecords}`);
  }

  _createV2Observer(): void {
    const caps = this._caps();
    if (!caps.io) {
      this.setState({ trackVisibilityInfo:
        "IntersectionObserver v2 用法（不可用，仅说明）：\n\n" +
        "const io = new IntersectionObserver((entries, observer) => {\n" +
        "  for (const e of entries) {\n" +
        "    console.log(e.isIntersecting, e.isVisible, e.intersectionRatio);\n" +
        "  }\n" +
        "}, {\n" +
        "  root: null,            // 默认 viewport，可为指定元素\n" +
        "  rootMargin: '0px',     // v2 启用时必须为 0px\n" +
        "  threshold: [0, 0.5, 1],// 多阈值回调\n" +
        "  trackVisibility: true, // ★ 启用 v2 可见性追踪\n" +
        "  delay: 100,            // ★ 可见性稳定时间，最小 100ms\n" +
        "});\n" +
        "io.observe(targetEl);\n\n" +
        '用例：广告可见性监测、曝光埋点（区分「几何相交」与「实际可见」）。' });
      this._addLog('warn', 'IntersectionObserver 不可用（jsdom 无，Chrome 51+ v1 / 74+ v2）');
      return;
    }
    try {
      // 先尝试 v2 构造（trackVisibility: true, delay: 100）
      let observer = null;
      let mode = 'v2';
      try {
        observer = new IntersectionObserver(() => {}, ({ trackVisibility: true, delay: 100, threshold: [0, 0.5, 1], rootMargin: '0px' } as any));
      } catch (e: any) {
        // 真实 v2 浏览器中 rootMargin 非 0 或 delay < 100 才抛；此处 delay=100/rootMargin=0 应不抛
        mode = 'v2-error';
        observer = new IntersectionObserver(() => {}, { threshold: [0, 0.5, 1] });
      }
      // jsdom polyfill 静默忽略 trackVisibility，构造成功但 v2 不会真正生效
      if (this._observer && this._observer !== observer) {
        try { this._observer.disconnect(); } catch { /* noop */ }
      }
      this._observer = observer;
      const realV2 = caps.v2;
      this.setState({ trackVisibilityInfo:
        `${mode === 'v2-error' ? '（v2 选项触发异常，已退回 v1）' : '真实构造 IntersectionObserver（v2 选项）'}：\n` +
        "  new IntersectionObserver(cb, { trackVisibility: true, delay: 100, threshold:[0,0.5,1], rootMargin:'0px' })\n\n" +
        `  typeof observer               = ${typeof observer}\n` +
        `  observer.observe              = ${typeof observer.observe === 'function' ? 'function' : 'undefined'}\n` +
        `  observer.unobserve            = ${typeof observer.unobserve === 'function' ? 'function' : 'undefined'}\n` +
        `  observer.disconnect           = ${typeof observer.disconnect === 'function' ? 'function' : 'undefined'}\n` +
        `  observer.takeRecords          = ${typeof observer.takeRecords === 'function' ? 'function' : 'undefined'}\n\n` +
        `trackVisibility 是否真正生效：${realV2 ? '是（v2 浏览器，delay < 100 会抛 TypeError）' : '否（jsdom polyfill 静默忽略该选项，构造成功但不追踪可见性，回调也不会触发）'}\n\n` +
        '说明：v2 通过 options 启用，构造器签名与 v1 相同；callback 的 entry 在 v2 模式下多 isVisible 字段。' });
      this._addLog('observer', `创建 observer（mode=${mode}，v2生效=${realV2}），将用于 Card 4 演示`);
    } catch (err: any) {
      this._addLog('warn', `创建 v2 observer 失败：${err.name} - ${err.message}`);
    }
  }

  _compareV1V2Options(): void {
    this.setState({ trackVisibilityInfo:
      '===== IntersectionObserver v1 vs v2 options 对比 =====\n\n' +
      '选项             | v1（默认）              | v2（trackVisibility: true）\n' +
      '-----------------|-------------------------|----------------------------------\n' +
      'root             | 默认 viewport           | 同 v1（可为指定元素）\n' +
      'rootMargin       | 任意 CSS margin 字符串   | ★ 必须为 0px（非零抛 TypeError）\n' +
      'threshold        | [0..1] 数组             | 同 v1（建议 [0, 0.5, 1]）\n' +
      'trackVisibility  | 无此选项（undefined）   | ★ true 启用可见性追踪\n' +
      'delay            | 无此选项（undefined）   | ★ ≥ 100ms（默认 100），< 100 抛 TypeError\n' +
      'callback entry   | isIntersecting/ratio   | ★ 多 isVisible 字段\n' +
      '性能开销          | 低                     | 高（每帧渲染层合成检测）\n\n' +
      '构造器签名：两者相同 new IntersectionObserver(cb, options)；v2 通过 options 区分。\n\n' +
      '可见性稳定机制：delay 控制目标「连续满足可见条件」多久后才上报 isVisible=true，避免快速遮挡闪烁。' });
    this._addLog('compare', '已展示 v1/v2 options 对比表（rootMargin/delay/trackVisibility 限制）');
  }

  _explainDelayLimit(): void {
    this.setState({ trackVisibilityInfo:
      '===== delay 限制与 rootMargin 限制详解 =====\n\n' +
      '1. delay 限制（trackVisibility: true 时生效）：\n' +
      '   - 取值范围：[100, +∞) ms，默认 100\n' +
      '   - delay < 100 时抛 TypeError: "delay must be at least 100 ms"\n' +
      '   - 语义：目标连续满足可见条件 delay 毫秒后才上报 isVisible=true\n' +
      '   - 用途：避免短暂遮挡/闪烁导致 isVisible 频繁切换（如滚动经过广告位）\n\n' +
      '2. rootMargin 限制（trackVisibility: true 时生效）：\n' +
      '   - 必须为 "0px"（或等价 0 的写法）\n' +
      '   - 非零 rootMargin 抛 TypeError: "rootMargin must be 0px when trackVisibility is true"\n' +
      '   - 原因：rootMargin 扩展/收缩 root 的判定矩形，会破坏「几何相交」与「实际可见」的一致性\n\n' +
      '3. SecureContext 要求：trackVisibility 需 HTTPS（或 localhost），非安全上下文构造时 trackVisibility 被忽略。\n\n' +
      'jsdom 现状：polyfill 不实现 trackVisibility，delay/rootMargin 限制均不触发；以上规则仅在真实 v2 浏览器中生效。' });
    this._addLog('compare', '已展示 delay/rootMargin 限制详解（v2 强制 delay ≥ 100、rootMargin = 0px）');
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. trackVisibility 与延迟',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.io ? 'success' : 'error' }, caps.io ? 'IO ✓' : 'IO ✗'),
        h(Tag, { color: caps.v2 ? 'success' : 'error' }, caps.v2 ? 'trackVisibility ✓' : 'trackVisibility ✗'),
        h(Tag, { color: 'primary' }, 'delay ≥ 100ms')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new IntersectionObserver(cb, { trackVisibility: true, delay: 100, threshold, rootMargin, root }) 创建 v2 观察者。delay 控制「可见性稳定时间」（最小 100ms，否则抛 TypeError）；trackVisibility 启用后 entries 多 isVisible 字段。构造器签名与 v1 相同，v2 通过 options 区分。delay 让目标连续满足可见条件 delay 毫秒后才上报 isVisible=true，避免快速遮挡闪烁。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showIoCaps() }),
          this._btn('创建 v2 observer', { size: 'sm', disabled: !caps.io, onClick: () => this._createV2Observer() }),
          this._btn('对比 v1/v2 选项', { size: 'sm', onClick: () => this._compareV1V2Options() }),
          this._btn('delay 限制说明', { size: 'sm', onClick: () => this._explainDelayLimit() })),
        h('div', { class: 'fs-sm text-secondary' }, 'trackVisibility / delay 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.trackVisibilityInfo || '（点击「能力检测」或「创建 v2 observer」）')),
        h(Alert, { type: 'info', message: 'v2 通过 options 启用，构造器签名与 v1 相同', description: 'trackVisibility: true 启用可见性追踪；delay ≥ 100ms（默认 100）控制可见性稳定时间，< 100 抛 TypeError；trackVisibility 启用时 rootMargin 必须 0px。jsdom polyfill 静默忽略 trackVisibility，不触发 TypeError，回调也不会触发。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：isVisible 字段与遮挡检测 ===================

  _simulateVisible(): void {
    const entry = this._makeFakeEntry({ isIntersecting: true, isVisible: true, ratio: 1 });
    const timer = setTimeout(() => {
      this._addLog('visible', `模拟 v2 回调：isIntersecting=${entry.isIntersecting}, isVisible=${entry.isVisible}, ratio=${entry.intersectionRatio}`);
      this.setState({ visibilityInfo:
        '===== 模拟 v2 回调（目标实际可见）=====\n\n' +
        'IntersectionObserver v2 回调 entry：\n' +
        `  isIntersecting     = ${entry.isIntersecting}   // 几何相交：是\n` +
        `  isVisible          = ${entry.isVisible}   // ★ 实际可见：是（未被遮挡/透明/剪裁）\n` +
        `  intersectionRatio  = ${entry.intersectionRatio}   // 相交比例：100%\n` +
        `  target             = ${entry.target && entry.target.tagName ? entry.target.tagName : 'div'}\n` +
        `  time               = ${(entry.time as any).toFixed(2)}ms\n` +
        `  boundingClientRect = ${JSON.stringify(entry.boundingClientRect)}\n` +
        `  intersectionRect   = ${JSON.stringify(entry.intersectionRect)}\n` +
        `  rootBounds         = ${JSON.stringify(entry.rootBounds)}\n\n` +
        '场景：目标元素在视口内、不透明、未被其他元素覆盖、无 clip-path/scale(0)。\n' +
        '结论：isIntersecting=true 且 isVisible=true，可计入广告曝光/播放计费。' });
    }, 0);
    this._simTimers.push(timer);
    this._addLog('info', '已调度模拟回调（可见场景），将在下一 tick 触发');
  }

  _simulateObscured(): void {
    const entry = this._makeFakeEntry({ isIntersecting: true, isVisible: false, ratio: 1 });
    const timer = setTimeout(() => {
      this._addLog('visible', `模拟 v2 回调：isIntersecting=${entry.isIntersecting}, isVisible=${entry.isVisible}, ratio=${entry.intersectionRatio}`);
      this.setState({ visibilityInfo:
        '===== 模拟 v2 回调（目标几何相交但不可见）=====\n\n' +
        'IntersectionObserver v2 回调 entry：\n' +
        `  isIntersecting     = ${entry.isIntersecting}   // 几何相交：是（在 root 矩形内）\n` +
        `  isVisible          = ${entry.isVisible}  // ★ 实际可见：否（被遮挡/透明/剪裁）\n` +
        `  intersectionRatio  = ${entry.intersectionRatio}   // 相交比例：100%\n` +
        `  target             = ${entry.target && entry.target.tagName ? entry.target.tagName : 'div'}\n` +
        `  time               = ${(entry.time as any).toFixed(2)}ms\n` +
        `  boundingClientRect = ${JSON.stringify(entry.boundingClientRect)}\n` +
        `  intersectionRect   = ${JSON.stringify(entry.intersectionRect)}\n` +
        `  rootBounds         = ${JSON.stringify(entry.rootBounds)}\n\n` +
        '让 isVisible=false 的情形（isIntersecting 仍可能 true）：\n' +
        '  - opacity: 0        —— 完全透明\n' +
        '  - visibility: hidden —— 隐藏\n' +
        '  - 被其他元素覆盖     —— z-index 更高的元素盖住\n' +
        '  - clip-path: circle(0) —— 剪裁为 0\n' +
        '  - transform: scale(0)  —— 缩放为 0\n\n' +
        '结论：v1 只看 isIntersecting 会误判为「可见」；v2 的 isVisible 才反映真实可见性，用于曝光/计费防刷。' });
    }, 0);
    this._simTimers.push(timer);
    this._addLog('info', '已调度模拟回调（遮挡场景），将在下一 tick 触发');
  }

  _showVisibilityCompare(): void {
    this.setState({ visibilityInfo:
      '===== isIntersecting vs isVisible 对比表 =====\n\n' +
      '场景                       | isIntersecting | isVisible | 说明\n' +
      '---------------------------|----------------|-----------|------------------------------\n' +
      '目标在视口内、不透明        | true           | true      | 正常可见\n' +
      '目标在视口内但 opacity:0   | true           | false     | 几何相交但不可见\n' +
      '目标被其他元素覆盖          | true           | false     | 几何相交但被遮挡\n' +
      '目标 clip-path 剪裁为 0    | true           | false     | 几何相交但渲染面积为 0\n' +
      '目标 transform: scale(0)   | true           | false     | 几何相交但缩放为 0\n' +
      '目标 visibility: hidden    | true           | false     | 几何相交但隐藏\n' +
      '目标部分在视口外            | true(ratio<1)  | 视遮挡     | 部分相交\n' +
      '目标完全在视口外            | false          | false     | 不相交\n\n' +
      '字段来源：\n' +
      '  - isIntersecting：基于「target bounding rect 与 root（含 rootMargin）的几何相交」计算（v1 即有）\n' +
      '  - isVisible：基于「实际渲染层合成可见性」计算，需 trackVisibility: true 才提供\n\n' +
      '决策：广告曝光/计费 → 必须 isVisible=true；懒加载 → isIntersecting=true 即可提前预加载。' });
    this._addLog('compare', '已展示 isIntersecting vs isVisible 对比表（6 种遮挡场景）');
  }

  _explainVisibilitySemantics(): void {
    this.setState({ visibilityInfo:
      '===== isVisible 语义详解 =====\n\n' +
      '定义：isVisible 表示目标「实际对用户可见」，即不仅几何上与 root 相交，且渲染层合成后像素可见。\n\n' +
      '判定规则（满足全部才 true）：\n' +
      '  1. isIntersecting = true（几何相交）\n' +
      '  2. 目标不透明（opacity > 0，非 visibility:hidden/display:none）\n' +
      '  3. 未被其他不透明元素完全覆盖（基于渲染层合成）\n' +
      '  4. 剪裁/变换后实际渲染面积 > 0（clip-path / transform 不为 0）\n\n' +
      '稳定机制（delay）：目标连续满足可见条件 delay（≥100ms）后才上报 isVisible=true，避免短暂闪烁误报。\n\n' +
      '性能开销：isVisible 基于每帧渲染层合成检测，开销显著高于 v1 的几何计算，故 trackVisibility 默认关闭，仅在必要时启用。\n\n' +
      '不可用情形：非 SecureContext（非 HTTPS）、浏览器不支持 v2、trackVisibility 选项被忽略时，entry.isVisible 恒为 undefined（应回退到 isIntersecting）。' });
    this._addLog('compare', '已展示 isVisible 语义详解（判定规则/稳定机制/性能/回退）');
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. isVisible 字段与遮挡检测',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.v2 ? 'success' : 'error' }, caps.v2 ? 'isVisible ✓' : 'isVisible 模拟'),
        h(Tag, { color: 'primary' }, '几何相交 vs 实际可见'),
        h(Tag, { color: 'warning' }, 'opacity/clip/scale')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'entry.isVisible 区分「几何相交」（isIntersecting）与「实际可见」（isVisible）。opacity:0 / visibility:hidden / 被其他元素覆盖 / clip-path / transform: scale(0) 都会让 isVisible=false 但 isIntersecting 可能仍 true。因 jsdom 无真实回调，本页用 setTimeout 模拟 v2 entry 对象 { isIntersecting, isVisible, intersectionRatio, target, time, boundingClientRect, intersectionRect, rootBounds } 展示语义。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('模拟可见', { type: 'primary', size: 'sm', onClick: () => this._simulateVisible() }),
          this._btn('模拟遮挡', { danger: true, size: 'sm', onClick: () => this._simulateObscured() }),
          this._btn('对比表', { size: 'sm', onClick: () => this._showVisibilityCompare() }),
          this._btn('语义说明', { size: 'sm', onClick: () => this._explainVisibilitySemantics() })),
        h('div', { class: 'fs-sm text-secondary' }, 'isVisible / 遮挡检测状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.visibilityInfo || '（点击「模拟可见」或「模拟遮挡」）')),
        h(Alert, { type: 'info', message: 'isVisible 反映渲染层合成的真实可见性', description: '不同于 v1 仅看几何相交，v2 的 isVisible 综合考虑 opacity / visibility / 遮挡 / clip-path / transform，需 trackVisibility: true 启用。jsdom 无合成层，本页用模拟 entry 展示语义。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：rootMargin 与 threshold 数组 ===================

  _demoRootMargin(): void {
    this.setState({ marginThresholdInfo:
      '===== rootMargin 计算演示 =====\n\n' +
      "rootMargin: '10px 20px 30px 40px'  // 上 右 下 左（同 CSS margin 简写）\n" +
      '效果：root 矩形向四周扩展（top+10, right+20, bottom+30, left+40），目标提前/延后进入判定区。\n\n' +
      "rootMargin: '-50% 0px'  // 上 -50%（视口高度一半），下 0\n" +
      '效果：root 矩形顶部收缩 50% 视口高度，目标进入视口中部才触发（用于「真正滚到中部」的懒加载）。\n\n' +
      "rootMargin: '50px'  // 四边均 +50px\n" +
      '效果：目标进入视口边缘前 50px 即触发（用于「预加载」图片/组件）。\n\n' +
      '单位：可用 px 或 %（% 相对于 root 的尺寸）；不能混合 px 与 % 在同一方向。\n\n' +
      '计算示例（root = viewport，宽 1920×高 1080，rootMargin: "20px 10%"）：\n' +
      '  原始 root 矩形：{ top:0, right:1920, bottom:1080, left:0 }\n' +
      '  扩展后        ：{ top:-20, right:1920+192, bottom:1080+20, left:-192 }\n' +
      '  （right/left 各扩 10% × 1920 = 192px；top/bottom 各扩 20px）' });
    this._addLog('margin', '已演示 rootMargin 计算（10px 20px 30px 40px / -50% 0px / 50px）');
  }

  _demoThresholdArray(): void {
    this.setState({ marginThresholdInfo:
      '===== threshold 数组演示 =====\n\n' +
      "threshold: [0, 0.25, 0.5, 0.75, 1]  // 多阈值回调\n\n" +
      '语义：当目标与 root 的相交比例「穿过」某个阈值时触发回调。\n' +
      '  - 0：相交比例从 0 → >0（进入）或 >0 → 0（离开）\n' +
      '  - 0.25：相交比例达 25% 时触发\n' +
      '  - 0.5：相交比例达 50% 时触发（IAB Viewability 常用）\n' +
      '  - 0.75：相交比例达 75% 时触发\n' +
      '  - 1：完全相交时触发\n\n' +
      '回调频率：每次「穿过」阈值（上升或下降）都触发，entry.intersectionRatio 是当前比例。\n\n' +
      '用例：\n' +
      '  - 懒加载图片：threshold: [0, 0.5]，进入视口 50% 才加载\n' +
      '  - 广告可见性：threshold: [0, 0.5]，配合 delay: 1000 检测 50% 像素可见 1s\n' +
      '  - 滚动进度条：threshold: [0, 0.1, 0.2, ..., 1] 细粒度进度\n\n' +
      '注意：threshold 越多回调越频繁，性能开销越大；通常 [0, 0.5, 1] 已足够。' });
    this._addLog('threshold', '已演示 threshold 数组（[0, 0.25, 0.5, 0.75, 1] 多阈值回调）');
  }

  _explainRootContainer(): void {
    this.setState({ marginThresholdInfo:
      '===== root 容器说明 =====\n\n' +
      'root：观察的「视口」元素，默认 null（浏览器 viewport）。\n\n' +
      '用法：\n' +
      '  const scrollContainer = document.querySelector(".scroll-area");\n' +
      '  const io = new IntersectionObserver(cb, { root: scrollContainer, threshold: [0, 1] });\n' +
      '  io.observe(targetEl);  // target 相对 scrollContainer 判定相交\n\n' +
      '规则：\n' +
      '  - root 必须是 target 的祖先（否则 target 永远不与之相交）\n' +
      '  - root 默认 viewport 时 rootBounds = 视口矩形；指定元素时 = 该元素 boundingRect\n' +
      '  - rootMargin 相对 root 计算（% 相对 root 尺寸）\n' +
      '  - threshold 相对 root 与 target 的相交比例\n\n' +
      '用例：\n' +
      '  - 默认 viewport：监听元素进入浏览器视口（懒加载、曝光）\n' +
      '  - 指定滚动容器：监听元素在某个 overflow:auto 容器内的可见性（虚拟列表、无限滚动）\n' +
      '  - 嵌套滚动：外层 + 内层分别 observe，区分「容器可见」与「内容可见」' });
    this._addLog('root', '已展示 root 容器说明（viewport / 指定元素 / 嵌套滚动）');
  }

  _explainV2RootMarginLimit(): void {
    this.setState({ marginThresholdInfo:
      '===== v2 rootMargin 限制（trackVisibility: true 时）=====\n\n' +
      '规则：trackVisibility: true 时，rootMargin 必须 "0px"（或等价 0），非零抛 TypeError。\n\n' +
      '原因：\n' +
      '  - rootMargin 扩展/收缩 root 的判定矩形，使「几何相交区」与「实际渲染区」错位\n' +
      '  - 例如 rootMargin: "100px" 时，目标在 root 外 100px 内也算「相交」（isIntersecting=true），\n' +
      '    但该区域在屏幕外，渲染层合成的「可见性」无意义\n' +
      '  - 为保证 isVisible 与 isIntersecting 语义一致，v2 禁止 rootMargin 偏移\n\n' +
      '错误示例：\n' +
      '  new IntersectionObserver(cb, { trackVisibility: true, delay: 100, rootMargin: "10px" });\n' +
      '  // → TypeError: "rootMargin must be 0px when trackVisibility is true"\n\n' +
      '正确做法：\n' +
      '  - 需要可见性追踪 → trackVisibility: true + rootMargin: "0px"\n' +
      '  - 需要 rootMargin 预加载 → 不启用 trackVisibility（v1 模式），仅用 isIntersecting\n' +
      '  - 两者不可兼得：可见性追踪要求精确几何，预加载要求扩展判定区\n\n' +
      'jsdom 现状：polyfill 不实现 trackVisibility，rootMargin 限制不触发，可任意设置（但 v2 不会生效）。' });
    this._addLog('compare', '已展示 v2 rootMargin 限制（trackVisibility: true 时必须 0px）');
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. rootMargin 与 threshold 数组',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.io ? 'success' : 'error' }, caps.io ? 'IO ✓' : 'IO ✗'),
        h(Tag, { color: 'primary' }, 'rootMargin / threshold'),
        h(Tag, { color: 'warning' }, 'v2 rootMargin = 0px')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'rootMargin（"10px 20px 30px 40px" / "-50% 0px" 预加载）扩展/收缩 root 判定矩形；threshold（[0, 0.25, 0.5, 0.75, 1]）控制相交比例穿过阈值时回调；root（默认 viewport，可为指定元素）决定相对哪个容器判定。注意：trackVisibility: true 时 rootMargin 限制为 0px（非零抛 TypeError），因 rootMargin 偏移会破坏几何相交与实际可见的语义一致性。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 rootMargin', { type: 'primary', size: 'sm', onClick: () => this._demoRootMargin() }),
          this._btn('演示 threshold 数组', { size: 'sm', onClick: () => this._demoThresholdArray() }),
          this._btn('说明 root 容器', { size: 'sm', onClick: () => this._explainRootContainer() }),
          this._btn('v2 rootMargin 限制', { danger: true, size: 'sm', onClick: () => this._explainV2RootMarginLimit() })),
        h('div', { class: 'fs-sm text-secondary' }, 'rootMargin / threshold 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.marginThresholdInfo || '（点击「演示 rootMargin」或「演示 threshold 数组」）')),
        h(Alert, { type: 'warning', message: 'v2 启用 trackVisibility 时 rootMargin 必须 0px', description: 'rootMargin 扩展判定区会破坏 isVisible 与 isIntersecting 的一致性，故 v2 强制 rootMargin=0px。需要预加载时改用 v1（不启用 trackVisibility），仅用 isIntersecting。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：observe / unobserve / disconnect / takeRecords ===================

  _simulateObserve(): void {
    const caps = this._caps();
    if (!caps.io || !caps.observe) {
      this.setState({ lifecycleInfo:
        "observer.observe 用法（不可用，仅说明）：\n\n" +
        "const io = new IntersectionObserver(cb, options);\n" +
        "io.observe(targetEl);  // 开始观察 target，target 进入/离开 root 时触发 cb\n" +
        "io.observe(targetEl2); // 可同时观察多个 target\n\n" +
        '语义：observe 将 target 加入观察列表；target 相对 root 的相交状态变化时异步触发回调。' });
      this._addLog('warn', 'observer.observe 不可用（jsdom 无 IO）');
      return;
    }
    try {
      if (!this._observer) {
        this._observer = new IntersectionObserver(() => {}, { threshold: [0, 0.5, 1] });
      }
      const target = typeof document !== 'undefined' ? document.createElement('div') : {};
      this._observer.observe(target);
      this._observedTargets.push(target);
      this.setState({ lifecycleInfo:
        `模拟 observe（真实 API 调用）：\n  this._observer.observe(<div>)  // target 已加入观察列表\n\n` +
        `已观察 target 数量：${this._observedTargets.length}\n\n` +
        '语义：observe(target) 将 target 加入观察列表；target 相对 root 的相交状态变化时异步触发回调。\n' +
        '注意：jsdom polyfill 的 observe 是 no-op mock，不会真正触发回调；真实浏览器中 target 进入/离开 root 时触发。\n\n' +
        '可重复 observe 同一 target（幂等，不会重复加入）；observe 不同 target 会累积。' });
      this._addLog('observe', `observer.observe(<div>) 已调用（累计 ${this._observedTargets.length} 个 target）`);
    } catch (err: any) {
      this._addLog('warn', `observe 失败：${err.name} - ${err.message}`);
    }
  }

  _simulateUnobserve(): void {
    const caps = this._caps();
    if (!caps.io || !caps.unobserve) {
      this.setState({ lifecycleInfo:
        "observer.unobserve 用法（不可用，仅说明）：\n\n" +
        "io.unobserve(targetEl);  // 停止观察 target，不再触发回调\n\n" +
        '语义：unobserve 将 target 从观察列表移除；已排队的 pending entries 仍会交付一次。' });
      this._addLog('warn', 'observer.unobserve 不可用');
      return;
    }
    try {
      if (!this._observer || this._observedTargets.length === 0) {
        this._addLog('warn', '无 target 可 unobserve（请先点击「模拟 observe」）');
        return;
      }
      const target = this._observedTargets.shift();
      this._observer.unobserve(target);
      this.setState({ lifecycleInfo:
        `模拟 unobserve（真实 API 调用）：\n  this._observer.unobserve(<div>)  // target 已移出观察列表\n\n` +
        `剩余 target 数量：${this._observedTargets.length}\n\n` +
        '语义：unobserve(target) 将 target 从观察列表移除；已排队的 pending entries 仍会交付一次（不会丢失）。\n' +
        '与 disconnect 区别：unobserve 仅移除单个 target，disconnect 移除全部并停止观察。' });
      this._addLog('unobserve', `observer.unobserve(<div>) 已调用（剩余 ${this._observedTargets.length} 个 target）`);
    } catch (err: any) {
      this._addLog('warn', `unobserve 失败：${err.name} - ${err.message}`);
    }
  }

  _simulateTakeRecords(): void {
    const caps = this._caps();
    if (!caps.io || !caps.takeRecords) {
      this.setState({ lifecycleInfo:
        "observer.takeRecords 用法（不可用，仅说明）：\n\n" +
        "const pending = io.takeRecords();  // → IntersectionObserverEntry[]\n" +
        "for (const e of pending) { ... }   // 同步处理未交付的 entries\n\n" +
        '语义：takeRecords 同步返回「已排队但尚未交付回调」的 entry 数组，并清空队列。\n' +
        '典型用途：在 disconnect 前同步读取 pending entries，避免丢失最后一批变更。' });
      this._addLog('warn', 'observer.takeRecords 不可用');
      return;
    }
    try {
      if (!this._observer) {
        this._observer = new IntersectionObserver(() => {}, { threshold: [0, 0.5, 1] });
      }
      const records = this._observer.takeRecords();
      const count = Array.isArray(records) ? records.length : 0;
      // jsdom 无真实相交，records 为空数组；用模拟 entry 展示语义
      const fakeEntry = this._makeFakeEntry({ isIntersecting: true, isVisible: true, ratio: 0.5 });
      this.setState({ lifecycleInfo:
        `模拟 takeRecords（真实 API 调用）：\n  const records = io.takeRecords();  // → IntersectionObserverEntry[]\n\n` +
        `真实返回（jsdom 无相交触发）：records.length = ${count}\n\n` +
        `模拟 entry 结构（真实浏览器中 takeRecords 返回此类对象）：\n${JSON.stringify(fakeEntry, null, 2)}\n\n` +
        '语义：takeRecords 同步返回「已排队但尚未交付回调」的 entry 数组，并清空队列。\n' +
        '用途：\n' +
        '  - disconnect 前同步读取 pending entries，避免丢失最后一批变更\n' +
        '  - 在事件处理中立即刷新观察状态（不等异步回调）\n' +
        '  - 配合 requestIdleCallback 批量处理\n\n' +
        '注意：takeRecords 返回后，这些 entry 不会再通过 callback 交付（已清空队列）。' });
      this._addLog('takeRecords', `io.takeRecords() → ${count} 条 pending（jsdom 无相交触发，记录为空）`);
    } catch (err: any) {
      this._addLog('warn', `takeRecords 失败：${err.name} - ${err.message}`);
    }
  }

  _simulateDisconnect(): void {
    const caps = this._caps();
    if (!caps.io || !caps.disconnect) {
      this.setState({ lifecycleInfo:
        "observer.disconnect 用法（不可用，仅说明）：\n\n" +
        "io.disconnect();  // 停止观察所有 target，释放资源\n\n" +
        '语义：disconnect 移除所有 target 并停止观察；已排队的 pending entries 仍会交付一次。\n' +
        'observer 实例仍可复用：disconnect 后可再 observe 新 target。' });
      this._addLog('warn', 'observer.disconnect 不可用');
      return;
    }
    try {
      if (!this._observer) {
        this._addLog('warn', '无 observer 可 disconnect（请先点击「模拟 observe」）');
        return;
      }
      this._observer.disconnect();
      const cleared = this._observedTargets.length;
      this._observedTargets = [];
      this.setState({ lifecycleInfo:
        `模拟 disconnect（真实 API 调用）：\n  this._observer.disconnect()  // 停止观察所有 target\n\n` +
        `本次清理 target 数量：${cleared}\n\n` +
        '语义：disconnect 移除所有 target 并停止观察；已排队的 pending entries 仍会交付一次（不会丢失）。\n' +
        'observer 实例仍可复用：disconnect 后可再 observe 新 target（不需重新构造）。\n\n' +
        '与 unobserve 区别：unobserve 移除单个 target，disconnect 移除全部。\n' +
        '资源管理：长生命周期页面应在 componentWillUnmount 中 disconnect，避免内存泄漏。' });
      this._addLog('disconnect', `observer.disconnect() 已调用（清理 ${cleared} 个 target）`);
    } catch (err: any) {
      this._addLog('warn', `disconnect 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. observe / unobserve / disconnect / takeRecords',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.observe ? 'success' : 'error' }, caps.observe ? 'observe ✓' : 'observe ✗'),
        h(Tag, { color: caps.takeRecords ? 'success' : 'error' }, caps.takeRecords ? 'takeRecords ✓' : 'takeRecords ✗'),
        h(Tag, { color: 'primary' }, 'v2 = v1 API')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'observer.observe(target) 加入观察；unobserve(target) 移除单个 target；disconnect() 移除全部并停止；takeRecords() 返回未交付的 entry 数组并清空队列。v2 与 v1 API 完全相同，差异仅在 options（trackVisibility/delay）与 entry 字段（isVisible）。takeRecords 在回调前同步读取 pending entries，常用于 disconnect 前避免丢失最后一批变更。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('模拟 observe', { type: 'primary', size: 'sm', disabled: !caps.observe, onClick: () => this._simulateObserve() }),
          this._btn('模拟 unobserve', { size: 'sm', disabled: !caps.unobserve, onClick: () => this._simulateUnobserve() }),
          this._btn('模拟 takeRecords', { size: 'sm', disabled: !caps.takeRecords, onClick: () => this._simulateTakeRecords() }),
          this._btn('模拟 disconnect', { danger: true, size: 'sm', disabled: !caps.disconnect, onClick: () => this._simulateDisconnect() })),
        h('div', { class: 'fs-sm text-secondary' }, 'observe / unobserve / disconnect / takeRecords 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.lifecycleInfo || '（点击「模拟 observe」或「模拟 takeRecords」）')),
        h(Alert, { type: 'info', message: 'takeRecords 同步读取 pending entries，避免丢失', description: '在 disconnect 或页面卸载前调用 takeRecords 可同步处理最后一批变更。v2 与 v1 的 observe/unobserve/disconnect/takeRecords 签名完全相同，差异仅在 options 与 entry.isVisible 字段。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：使用场景与限制 ===================

  _showIabViewability(): void {
    this.setState({ scenariosInfo:
      '===== IAB Viewability 广告可见性监测示例 =====\n\n' +
      'IAB 标准：广告位 ≥ 50% 像素连续可见 ≥ 1 秒（display）/ ≥ 50% 像素连续可见 ≥ 2 秒（video）。\n\n' +
      '实现（v2）：\n' +
      '  const io = new IntersectionObserver((entries) => {\n' +
      '    for (const e of entries) {\n' +
      '      if (e.isVisible && e.intersectionRatio >= 0.5) {\n' +
      '        // 开始计时：连续可见 1s 后计为「有效曝光」\n' +
      '        startViewabilityTimer(e.target, 1000);\n' +
      '      } else {\n' +
      '        // 中断：可见性丢失，清除计时\n' +
      '        clearViewabilityTimer(e.target);\n' +
      '      }\n' +
      '    }\n' +
      '  }, {\n' +
      '    threshold: [0, 0.5, 1],\n' +
      '    trackVisibility: true,  // ★ 启用 isVisible\n' +
      '    delay: 100,             // 可见性稳定 100ms\n' +
      '    rootMargin: "0px",      // v2 必须 0px\n' +
      '  });\n' +
      '  io.observe(adSlotEl);\n\n' +
      '关键点：\n' +
      '  - 用 isVisible 而非 isIntersecting：区分「几何相交」与「实际可见」（被遮挡/透明不计）\n' +
      '  - threshold: 0.5：相交比例 ≥ 50% 才开始计时\n' +
      '  - delay: 100 防闪烁，再叠加 1000ms 连续可见计时\n' +
      '  - 防盗刷：isVisible=false 时不计时（如广告位被覆盖、opacity:0）' });
    this._addLog('scenario', '已展示 IAB Viewability 广告可见性监测示例（v2 + delay 1000ms）');
  }

  _compareLazyLoadStrategies(): void {
    this.setState({ scenariosInfo:
      '===== 懒加载策略对比 =====\n\n' +
      '策略             | 触发条件                       | 适用场景              | 缺点\n' +
      '-----------------|--------------------------------|-----------------------|--------------------------\n' +
      'v1 IO（默认）     | isIntersecting=true            | 图片/组件懒加载       | 不区分遮挡，可能误触发\n' +
      'v1 IO + rootMargin| isIntersecting=true（提前）   | 预加载（提前 200px） | 不区分遮挡\n' +
      'v2 IO（trackVis）| isIntersecting && isVisible    | 严格懒加载（防误判） | 性能开销大，rootMargin=0\n' +
      'scroll 事件      | scroll 触发 + getBoundingClientRect | 老浏览器兜底    | 频繁触发，需节流\n\n' +
      '推荐组合：\n' +
      '  - 普通懒加载：v1 IO + rootMargin "200px"（提前预加载，性能优）\n' +
      '  - 严格可见性（如视频自动播放）：v2 IO + isVisible=true（确保实际可见才播放）\n' +
      '  - 兜底：不支持 IO 的老浏览器降级到 scroll + rAF 节流\n\n' +
      'v2 懒加载示例：\n' +
      '  const io = new IntersectionObserver((entries) => {\n' +
      '    for (const e of entries) {\n' +
      '      if (e.isIntersecting) preloadImage(e.target);  // 提前预加载\n' +
      '      if (e.isVisible) startPlayback(e.target);     // 真正可见才播放\n' +
      '    }\n' +
      '  }, { trackVisibility: true, delay: 100, threshold: [0, 0.5, 1], rootMargin: "0px" });' });
    this._addLog('scenario', '已展示懒加载策略对比（v1/v2/scroll + 推荐组合）');
  }

  _showExposureTrackingCode(): void {
    this.setState({ scenariosInfo:
      '===== 曝光埋点代码示例（v2）=====\n\n' +
      '需求：仅当目标「实际可见」时才计入曝光，避免被遮挡/透明时误报。\n\n' +
      'class ExposureTracker {\n' +
      '  constructor() {\n' +
      '    this.io = new IntersectionObserver((entries) => {\n' +
      '      for (const e of entries) {\n' +
      '        const id = e.target.dataset.exposureId;\n' +
      '        if (e.isVisible) {\n' +
      '          this.report(id, "view", { ratio: e.intersectionRatio, time: e.time });\n' +
      '        } else if (e.isIntersecting) {\n' +
      '          // 几何相交但不可见：不计曝光，可记录"partial"用于分析\n' +
      '          this.report(id, "partial", { reason: "obscured" });\n' +
      '        }\n' +
      '      }\n' +
      '    }, {\n' +
      '      threshold: [0, 0.5, 1],\n' +
      '      trackVisibility: true,\n' +
      '      delay: 100,\n' +
      '      rootMargin: "0px",\n' +
      '    });\n' +
      '  }\n' +
      '  track(el) { this.io.observe(el); }\n' +
      '  report(id, type, data) { navigator.sendBeacon("/exposure", JSON.stringify({ id, type, ...data })); }\n' +
      '}\n\n' +
      '防盗刷要点：\n' +
      '  - isVisible=false 时不计曝光（被遮挡/透明/剪裁）\n' +
      '  - delay 100ms 防短暂闪烁误报\n' +
      '  - threshold: 0.5 确保至少 50% 可见\n' +
      '  - sendBeacon 异步上报，不阻塞卸载\n' +
      '  - 可叠加连续可见计时（如 1s）防快速滚动刷量' });
    this._addLog('scenario', '已展示曝光埋点代码（v2 isVisible + sendBeacon）');
  }

  _showLimitsAndBestPractices(): void {
    this.setState({ scenariosInfo:
      '===== v2 限制与最佳实践 =====\n\n' +
      '限制：\n' +
      '  1. 性能开销大：trackVisibility 基于每帧渲染层合成检测，显著高于 v1 几何计算；仅在必要时启用\n' +
      '  2. delay 最小 100ms：< 100 抛 TypeError（无法更敏感地响应可见性变化）\n' +
      '  3. rootMargin 必须 0px：trackVisibility: true 时非零抛 TypeError（无法预加载）\n' +
      '  4. SecureContext 要求：需 HTTPS（或 localhost），非安全上下文 trackVisibility 被忽略\n' +
      '  5. 移动端节电：低端设备/省电模式可能降低合成检测频率或禁用 v2\n' +
      '  6. 浏览器支持：Chrome 74+ 渐进支持，Safari/Firefox 支持较晚；需 feature-detect\n\n' +
      '最佳实践：\n' +
      '  - 默认用 v1（不启用 trackVisibility）：性能优，覆盖懒加载/曝光等多数场景\n' +
      '  - 仅在「必须区分实际可见」时启用 v2：广告计费、视频自动播放、防刷曝光\n' +
      '  - feature-detect：try { new IO(cb, { trackVisibility: true, delay: 50 }) } catch { 退回 v1 }\n' +
      '  - 回退策略：v2 不可用时退回 v1 + isIntersecting；都不支持时退回 scroll\n' +
      '  - 资源管理：componentWillUnmount 中 disconnect，避免内存泄漏\n' +
      '  - 批量 observe：一个 observer 观察多个 target，比每个 target 一个 observer 更高效\n' +
      '  - threshold 精简：通常 [0, 0.5, 1] 已足够，过多阈值增加回调开销' });
    this._addLog('scenario', '已展示 v2 限制与最佳实践（6 限制 + 7 最佳实践）');
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. 使用场景与限制',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.v2 ? 'success' : 'error' }, caps.v2 ? 'v2 ✓' : 'v2 模拟'),
        h(Tag, { color: 'primary' }, 'IAB Viewability'),
        h(Tag, { color: 'warning' }, '性能开销')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '使用场景：广告可见性监测（IAB Viewability：50% 像素 ≥1s 连续）、懒加载（isIntersecting 提前 + isVisible 兜底）、曝光埋点（isVisible=true 才计入）、防盗刷（isVisible=false 不计播放）。限制：trackVisibility 性能开销大（仅必要时启用）、delay 最小 100ms、rootMargin 必须 0、SecureContext（HTTPS）要求、移动端节电。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('IAB Viewability 示例', { type: 'primary', size: 'sm', onClick: () => this._showIabViewability() }),
          this._btn('懒加载策略对比', { size: 'sm', onClick: () => this._compareLazyLoadStrategies() }),
          this._btn('曝光埋点代码', { size: 'sm', onClick: () => this._showExposureTrackingCode() }),
          this._btn('限制与最佳实践', { danger: true, size: 'sm', onClick: () => this._showLimitsAndBestPractices() })),
        h('div', { class: 'fs-sm text-secondary' }, '使用场景与限制状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.scenariosInfo || '（点击「IAB Viewability 示例」或「懒加载策略对比」）')),
        h(Alert, { type: 'warning', message: 'trackVisibility 性能开销大，仅在必要时启用', description: 'v2 的 isVisible 基于每帧渲染层合成检测，开销显著高于 v1。默认用 v1 覆盖懒加载/曝光等场景；仅在广告计费、视频自动播放等必须区分实际可见的场景启用 v2，并配合 feature-detect 与回退策略。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：与 IntersectionObserver v1 / PerformanceObserver 对比 ===================

  _showV1V2Diff(): void {
    this.setState({ compareInfo:
      '===== IntersectionObserver v1 vs v2 差异表 =====\n\n' +
      '维度             | v1（默认）                | v2（trackVisibility: true）\n' +
      '-----------------|---------------------------|----------------------------------\n' +
      'options.root     | 默认 viewport / 指定元素   | 同 v1\n' +
      'options.rootMargin| 任意 CSS margin           | ★ 必须 0px（非零抛 TypeError）\n' +
      'options.threshold | [0..1] 数组               | 同 v1\n' +
      'options.trackVisibility| 无（undefined）     | ★ true 启用可见性追踪\n' +
      'options.delay    | 无（undefined）           | ★ ≥ 100ms（默认 100），< 100 抛 TypeError\n' +
      'entry.isIntersecting| 有（几何相交）          | 有\n' +
      'entry.isVisible  | 无（undefined）           | ★ 有（实际可见，含遮挡/透明/剪裁判定）\n' +
      'entry.intersectionRatio| 有                  | 有\n' +
      'entry.target/time/rects| 有                 | 有\n' +
      'observe/unobserve/disconnect/takeRecords| 有 | 有（签名相同）\n' +
      '性能开销          | 低（几何计算）            | 高（渲染层合成检测）\n' +
      'SecureContext    | 不要求                    | ★ 需 HTTPS（非安全上下文忽略 trackVisibility）\n' +
      '浏览器支持        | Chrome 51+/全平台         | Chrome 74+ 渐进，Safari/Firefox 较晚\n\n' +
      '迁移建议：\n' +
      '  - v1 代码无需改动即可用 v2（构造器签名相同）\n' +
      '  - 启用 v2 仅需在 options 加 trackVisibility: true + delay: 100 + rootMargin: "0px"\n' +
      '  - entry.isVisible 在 v1 模式下为 undefined，需 feature-detect 后使用' });
    this._addLog('compare', '已展示 v1 vs v2 差异表（options/entry 字段/限制/性能/支持）');
  }

  _compareIoPo(): void {
    this.setState({ compareInfo:
      '===== IntersectionObserver vs PerformanceObserver 对比 =====\n\n' +
      '维度       | IntersectionObserver (IO)         | PerformanceObserver (PO)\n' +
      '-----------|-----------------------------------|----------------------------------\n' +
      '监听对象    | DOM 元素几何可见性                | 性能条目（resource/timing/paint/...）\n' +
      '触发条件    | target 与 root 相交状态变化       | 性能条目被记录时\n' +
      'entry 类型  | IntersectionObserverEntry         | PerformanceEntry（子类多样）\n' +
      '回调频率    | 相交状态变化时（受 threshold 限制）| 性能条目产生时（可 buffered 批量）\n' +
      '典型用例    | 懒加载、曝光、广告可见性          | 性能监控、首屏绘制、资源时序\n' +
      'root 概念   | 有（viewport 或指定元素）         | 无（监听全局性能条目）\n' +
      'observe    | observe(targetEl)                 | observe({ entryTypes: ["resource"] })\n' +
      'takeRecords| 有（同步读取 pending）            | 无（回调即交付）\n' +
      '性能开销    | 低-中（v2 较高）                  | 低（被动接收）\n\n' +
      '协同场景：\n' +
      '  - IO 触发懒加载后，PO 监控加载耗时（resource 条目）\n' +
      '  - IO 检测首屏元素可见 → PO 的 paint 条目辅助 LCP 计算\n' +
      '  - IO + PO 组合：可见性 + 性能双维度监控页面体验' });
    this._addLog('compare', '已展示 IO vs PO 对比（监听对象/触发/用例/协同）');
  }

  _showIoRoSynergy(): void {
    this.setState({ compareInfo:
      '===== IntersectionObserver + ResizeObserver 协同 =====\n\n' +
      '各自职责：\n' +
      '  - IntersectionObserver (IO)：监听 target 与 root 的「相交/可见」状态变化\n' +
      '  - ResizeObserver (RO)：监听 target 的「尺寸」变化（content/border/device-pixel-content-box）\n\n' +
      '协同模式：\n' +
      '  1. IO 触发「进入视口」→ 启动 RO 监听尺寸（仅可见时才监听，省性能）\n' +
      '  2. RO 检测尺寸变化 → 重新计算相交比例 / 调整布局\n' +
      '  3. IO 触发「离开视口」→ 停止 RO（不可见时无需监听尺寸）\n\n' +
      '示例（懒加载 + 自适应尺寸）：\n' +
      '  const io = new IntersectionObserver((entries) => {\n' +
      '    for (const e of entries) {\n' +
      '      if (e.isIntersecting) {\n' +
      '        // 进入视口：启动 RO 监听尺寸\n' +
      '        ro.observe(e.target);\n' +
      '      } else {\n' +
      '        // 离开视口：停止 RO 省性能\n' +
      '        ro.unobserve(e.target);\n' +
      '      }\n' +
      '    }\n' +
      '  }, { threshold: [0, 0.5, 1] });\n' +
      '  const ro = new ResizeObserver((entries) => {\n' +
      '    for (const e of entries) adjustLayout(e.target, e.contentRect);\n' +
      '  });\n\n' +
      '收益：\n' +
      '  - 仅可见元素监听尺寸，减少 RO 回调频率\n' +
      '  - IO 提供相交比例，RO 提供精确尺寸，组合用于虚拟列表/瀑布流\n' +
      '  - v2 IO 的 isVisible 可进一步确保「实际可见」才计算布局' });
    this._addLog('compare', '已展示 IO + RO 协同（IO 触发 + RO 监听尺寸 + 离开停止）');
  }

  _compareIoScroll(): void {
    this.setState({ compareInfo:
      '===== IntersectionObserver vs scroll 事件对比 =====\n\n' +
      '维度          | IntersectionObserver (IO)         | scroll + getBoundingClientRect\n' +
      '--------------|-----------------------------------|----------------------------------\n' +
      '触发方式      | 浏览器内部相交检测，异步回调      | scroll 事件 + 手动计算\n' +
      '主线程开销    | 低（浏览器优化，主线程仅回调）    | 高（每次 scroll 都计算，需节流）\n' +
      '回调频率      | 相交状态变化时（受 threshold 限制）| scroll 每帧（需 rAF 节流）\n' +
      '精确性        | 基于 root/rootMargin/threshold    | 需手动 getBoundingClientRect\n' +
      'root 灵活性   | 可指定任意容器                    | 需手动处理容器滚动\n' +
      '可见性语义    | v2 提供 isVisible（含遮挡判定）   | 仅几何，无遮挡/透明判定\n' +
      '浏览器支持    | Chrome 51+                        | 全平台（最老兼容）\n' +
      '内存          | observer 复用，observe 多 target  | 需手动管理监听器\n' +
      '性能优化      | 浏览器批处理 + 跨帧调度           | 需 rAF + 节流 + 防抖\n\n' +
      '推荐选择：\n' +
      '  - 现代浏览器：优先 IO（性能优、语义清晰、支持 v2 可见性）\n' +
      '  - 老浏览器兜底：scroll + rAF 节流（不支持 IO 时降级）\n' +
      '  - 极端场景：scroll 事件可处理 IO 无法覆盖的「连续滚动位置」（如视差滚动），但相交检测仍建议 IO\n\n' +
      '性能对比（典型懒加载 100 个图片）：\n' +
      '  - IO：仅相交变化触发回调，主线程几乎无负担\n' +
      '  - scroll：每次滚动都遍历 100 个元素 getBoundingClientRect，需 rAF 节流仍较重' });
    this._addLog('compare', '已展示 IO vs scroll 对比（触发/开销/精确性/推荐）');
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 与 IntersectionObserver v1 / PerformanceObserver 对比',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'v1 vs v2'),
        h(Tag, { color: 'info' }, 'IO vs PO'),
        h(Tag, { color: 'warning' }, 'IO + RO / vs scroll')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'v1 vs v2 API 差异表（options/entry 字段/限制）；与 PerformanceObserver 对比（PO 监听性能条目 vs IO 监听几何可见）；与 ResizeObserver 协同（IO 触发后 RO 监听尺寸，离开视口停止 RO 省性能）；与 scroll 事件对比（IO 替代 scroll+getBoundingClientRect 性能更优，浏览器内部相交检测主线程负担小）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('v1/v2 差异表', { type: 'primary', size: 'sm', onClick: () => this._showV1V2Diff() }),
          this._btn('IO vs PO 对比', { size: 'sm', onClick: () => this._compareIoPo() }),
          this._btn('IO + RO 协同', { size: 'sm', onClick: () => this._showIoRoSynergy() }),
          this._btn('IO vs scroll 对比', { size: 'sm', onClick: () => this._compareIoScroll() })),
        h('div', { class: 'fs-sm text-secondary' }, '对比状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.compareInfo || '（点击「v1/v2 差异表」或「IO vs PO 对比」）')),
        h(Alert, { type: 'info', message: 'IO 是 scroll + getBoundingClientRect 的现代化替代', description: 'IO 由浏览器内部相交检测，主线程负担小；支持 root/threshold/rootMargin 精确控制；v2 提供 isVisible 区分实际可见。PO 监听性能条目，RO 监听尺寸变化，三者互补。老浏览器降级到 scroll + rAF 节流。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板 ===================

  _renderLogPanel(): Node | string {
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

  render(): Node {
    const s = this.state;
    return h('div', { class: 'api-lab-page intersection-observer-v2-page' },
      h('h2', { class: 'section-title' }, 'IntersectionObserver v2 可见性追踪 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页深入演示 IntersectionObserver v2 的 trackVisibility / isVisible 可见性追踪（区分几何相交与实际可见）、rootMargin/threshold 配置（v2 rootMargin 必须 0px）、observe/unobserve/disconnect/takeRecords 生命周期，以及广告可见性、懒加载、曝光埋点等使用场景与限制，并对比 v1、PerformanceObserver、ResizeObserver、scroll 事件。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
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
