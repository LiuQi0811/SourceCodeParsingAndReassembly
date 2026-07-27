// =====================================================================
// AdvancedObserverPage.js —— 高级观察器与命中测试实验室
// 演示 MDN：
//   1. IntersectionObserver 深入选项：root / rootMargin / threshold（数组），
//      entries[]（isIntersecting / intersectionRatio / intersectionRect /
//      boundingClientRect / rootBounds / time / target），observe/unobserve/disconnect/takeRecords。
//   2. ResizeObserver 深入 + borderBoxSize：observe(target, {box})，
//      entries[]（target / contentRect / borderBoxSize[{inlineSize,blockSize}] /
//      contentBoxSize / devicePixelContentBoxSize）。
//   3. MutationObserver 深入 + subtree/attributeFilter：childList / attributes /
//      subtree / attributeOldValue / characterData / attributeFilter，
//      records[]（type / target / addedNodes / removedNodes / attributeName / oldValue）。
//   4. elementFromPoint / elementsFromPoint + 命中测试：getBoundingClientRect / contains。
//   5. 三观察器组合 + PerformanceObserver 监听 longtask，统计触发次数对比开销。
// 说明：所有 API 调用前 typeof 能力检测，不可用 _addLog('warn', ...)，绝不抛异常。
//       测试脚本中三大观察器已被 mock 为 no-op（observe/disconnect 空函数，回调不触发，
//       takeRecords 返回空数组），页面必须不报错；按钮"直接改 DOM"逻辑正常执行。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

export interface AdvancedObserverPageProps extends Props {}

export interface AdvancedObserverPageState extends State {}

export class AdvancedObserverPage extends Page {
  declare props: AdvancedObserverPageProps;
  declare state: AdvancedObserverPageState;
  _clickHandler: (() => void) | null = null;
  _comboIo: any = null;
  _comboMo: any = null;
  _comboPerfObs: any = null;
  _comboRo: any = null;
  _inited: boolean = false;
  _io: any = null;
  _ioCount: any = null;
  _longtaskCount: any = null;
  _mo: any = null;
  _moCount: any = null;
  _rafId: any = null;
  _ro: any = null;
  _roBox: any = null;
  _roCount: any = null;
  initialState(): AdvancedObserverPageState {
    return {
      // 共享事件日志（所有卡片写入同一面板，最多保留 40 条）
      logs: [],
      // 能力检测摘要（componentDidMount 中填充，非空才渲染 Alert）
      capsSummary: '',
      // Card 1：IntersectionObserver entries 快照
      ioEntries: [],
      // Card 2：ResizeObserver 最新尺寸
      roSize: null,
      // Card 3：MutationObserver records 快照
      moRecords: [],
      // Card 4：elementFromPoint 命中结果
      hitResult: null,
      // Card 5：三观察器组合统计 { io, ro, mo, longtask }
      comboStats: null,
    };
  }

  componentDidMount(): void {
    // ★ 实例引用必须在守卫之前初始化（首次 render 在 componentDidMount 之前已执行，
    //   若放在守卫后会导致 render 读到 undefined；此处幂等赋值保证安全）
    this._io = null;              // Card 1 IntersectionObserver
    this._ro = null;              // Card 2 ResizeObserver
    this._roBox = 'content-box'; // Card 2 当前 box 模式
    this._mo = null;              // Card 3 MutationObserver
    this._comboIo = null;        // Card 5 组合 IntersectionObserver
    this._comboRo = null;        // Card 5 组合 ResizeObserver
    this._comboMo = null;        // Card 5 组合 MutationObserver
    this._comboPerfObs = null;  // Card 5 PerformanceObserver（longtask）
    this._ioCount = 0;           // Card 5 统计：Intersection 触发次数
    this._roCount = 0;           // Card 5 统计：Resize 触发次数
    this._moCount = 0;           // Card 5 统计：Mutation 触发次数
    this._longtaskCount = 0;     // Card 5 统计：longtask 触发次数
    this._rafId = null;          // requestAnimationFrame 句柄
    this._clickHandler = ((e: any) => this._onClickHit(e)) as any; // Card 4 演示区 click 处理器

    // ★★★ CRITICAL 守卫：必须存在！否则 setState => rerender => componentDidMount
    //     死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（绝不抛异常，仅 typeof 判定）——
    const hasDoc = typeof document !== 'undefined';
    const caps = {
      IntersectionObserver: typeof IntersectionObserver !== 'undefined',
      ResizeObserver: typeof ResizeObserver !== 'undefined',
      MutationObserver: typeof MutationObserver !== 'undefined',
      elementFromPoint: hasDoc && typeof document.elementFromPoint === 'function',
      elementsFromPoint: hasDoc && typeof document.elementsFromPoint === 'function',
      PerformanceObserver: typeof PerformanceObserver !== 'undefined',
    };
    const summary = '能力检测：' + (Object as any).entries(caps)
      .map(([k, v]: any) => `${k}=${v ? '✓' : '✗'}`).join('，');
    this.setState({ capsSummary: summary });
    this._addLog('cap', summary);
    if (!caps.IntersectionObserver) this._addLog('warn', 'IntersectionObserver 不可用（observe 调用会被忽略，回调不触发）');
    if (!caps.ResizeObserver) this._addLog('warn', 'ResizeObserver 不可用（observe 调用会被忽略，回调不触发）');
    if (!caps.MutationObserver) this._addLog('warn', 'MutationObserver 不可用（observe 调用会被忽略，回调不触发）');
    if (!caps.elementFromPoint) this._addLog('warn', 'document.elementFromPoint 不可用，命中测试演示将跳过');
    if (!caps.elementsFromPoint) this._addLog('warn', 'document.elementsFromPoint 不可用，列表演示将跳过');
    if (!caps.PerformanceObserver) this._addLog('warn', 'PerformanceObserver 不可用，longtask 监听将跳过');
  }

  componentWillUnmount(): void {
    // 断开所有观察器（Card 1/2/3 + Card 5 三合一 + PerformanceObserver）
    const observers = [
      '_io', '_ro', '_mo',
      '_comboIo', '_comboRo', '_comboMo', '_comboPerfObs',
    ];
    observers.forEach((key: any) => {
      try { if ((this as any)[key]) { (this as any)[key].disconnect?.(); (this as any)[key] = null; } } catch { /* noop */ }
    });
    // 取消尚未触发的 requestAnimationFrame
    try {
      if (this._rafId != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._rafId);
      this._rafId = null;
    } catch { /* noop */ }
    // 移除 Card 4 演示区 click 监听（inline 绑定元素移除时本会自动清理，此处兜底）
    try {
      if (this._clickHandler) {
        const area = (this.$('#hit-area') as any);
        if (area) area.removeEventListener('click', this._clickHandler);
      }
    } catch { /* noop */ }
  }

  // —— 共享日志方法（最多保留 40 条，与项目其它页一致）——
  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 按钮工厂：创建 Button 实例并注册为子组件，便于销毁 ——
  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— Card 工厂：new Card({title, desc, extra, children}) + registerChild + render ——
  _card(title: any, desc: any, extra: any, children: any) {
    const kids: any[] = [];
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
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================================================================
  // Card 1：IntersectionObserver 深入选项
  // =================================================================

  _startIoObserver() {
    if (typeof IntersectionObserver === 'undefined') {
      this._addLog('warn', 'IntersectionObserver 不可用（observe 调用会被忽略，回调不触发）'); return;
    }
    // 已存在则先断开，便于反复演示
    if (this._io) { try { this._io.disconnect(); } catch { /* noop */ } this._io = null; }
    try {
      const target = (this.$('#io-target') as any);
      if (!target) { this._addLog('warn', '未找到 #io-target 演示元素'); return; }
      const observer = new IntersectionObserver((entries: any) => {
        try {
          entries.forEach((e: any) => {
            const rec = { isIntersecting: e.isIntersecting, ratio: e.intersectionRatio, time: e.time, target: e.target ? e.target.tagName : '?' };
            this.setState({ ioEntries: [...this.state.ioEntries, rec].slice(-10) });
            this._addLog('entry',
              `isIntersecting=${e.isIntersecting} ratio=${(e.intersectionRatio * 100).toFixed(0)}% ` +
              `time=${(e.time || 0).toFixed(0)}ms target=${rec.target}`);
          });
        } catch { /* noop */ }
      }, { threshold: [0, 0.5, 1] });
      observer.observe(target);
      this._io = observer;
      this._addLog('io', 'IntersectionObserver 已启动，threshold=[0, 0.5, 1]（多档触发）');
    } catch (err: any) {
      this._addLog('warn', '启动 IntersectionObserver 失败：' + (err && err.message));
    }
  }

  _setIoRootMargin() {
    if (typeof IntersectionObserver === 'undefined') { this._addLog('warn', 'IntersectionObserver 不可用，无法设置 rootMargin'); return; }
    if (this._io) { try { this._io.disconnect(); } catch { /* noop */ } this._io = null; }
    try {
      const target = (this.$('#io-target') as any);
      if (!target) { this._addLog('warn', '未找到 #io-target 演示元素'); return; }
      // rootMargin: '100px' 实现预加载模式（目标进入视口边缘 100px 内即触发）
      const observer = new IntersectionObserver((entries: any) => {
        try {
          entries.forEach((e: any) => {
            this._addLog('entry', `[预加载] isIntersecting=${e.isIntersecting} ratio=${(e.intersectionRatio * 100).toFixed(0)}%`);
          });
        } catch { /* noop */ }
      }, { rootMargin: '100px', threshold: [0, 1] });
      observer.observe(target);
      this._io = observer;
      this._addLog('io', "已切换为 rootMargin='100px' 预加载模式（提前 100px 触发）");
    } catch (err: any) {
      this._addLog('warn', '设置 rootMargin 失败：' + (err && err.message));
    }
  }

  _ioTakeRecords() {
    if (typeof IntersectionObserver === 'undefined') { this._addLog('warn', 'IntersectionObserver 不可用，takeRecords 无效'); return; }
    if (!this._io) { this._addLog('warn', '请先点击「启动观察」'); return; }
    try {
      const records = typeof this._io.takeRecords === 'function' ? (this._io.takeRecords() || []) : [];
      this._addLog('io', `takeRecords() 立即读取到 ${records.length} 条未派发的 entry`);
      if (records.length === 0) this._addLog('io', '（测试环境观察器已 mock，takeRecords 返回空数组，真实浏览器可见）');
    } catch (err: any) {
      this._addLog('warn', 'takeRecords 失败：' + (err && err.message));
    }
  }

  _renderCard1() {
    const s = this.state;
    return this._card(
      'Card 1 · IntersectionObserver 深入选项',
      'new IntersectionObserver(cb, options)：options.root（默认 null=视口）、rootMargin（\'10px 20px\' 形式，可为负）、' +
      'threshold（0~1 单值或数组 [0, 0.25, 0.5, 1]）。entries[] 含 isIntersecting / intersectionRatio / ' +
      'intersectionRect / boundingClientRect / rootBounds / time / target。滚动下方容器可观察目标进入/离开。',
      h(Tag, { color: 'primary' }, 'Intersection'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('启动观察（threshold 数组）', {
            type: 'primary', size: 'sm', onClick: () => this._startIoObserver(),
          }),
          this._btn("设置 rootMargin:'100px' 预加载", {
            size: 'sm', onClick: () => this._setIoRootMargin(),
          }),
          this._btn('takeRecords 立即读取', {
            size: 'sm', onClick: () => this._ioTakeRecords(),
          }),
        ),
        h('div', {
          id: 'io-scroll', class: 'mt-md',
          style: { height: '180px', overflowY: 'auto', border: '1px dashed #d9d9d9', padding: '600px 20px 20px', background: '#fafafa' },
        },
          h('div', {
            id: 'io-target',
            style: {
              width: '120px', height: '120px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #1677ff, #722ed1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 'bold',
            },
          }, '目标方块'),
        ),
        s.ioEntries.length > 0
          ? h('div', { class: 'log-panel mt-md', style: { maxHeight: '120px' } },
              s.ioEntries.map((e: any, i: any) => h('div', { class: 'log-panel__line' },
                h('span', { class: 'log-panel__tag log-panel__tag--entry' }, 'entry'),
                h('span', { class: 'fs-sm' },
                  `[${i}] isIntersecting=${e.isIntersecting} ratio=${(e.ratio * 100).toFixed(0)}% time=${(e.time || 0).toFixed(0)}ms`),
              )),
            )
          : h('div', { class: 'log-panel__empty mt-md' }, '（暂无 entry，点击「启动观察」后滚动容器）'),
        h('pre', { class: 'code-block mt-md' },
`const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    e.isIntersecting; e.intersectionRatio; e.intersectionRect;
    e.boundingClientRect; e.rootBounds; e.time; e.target;
  });
}, { root: null, rootMargin: '10px 20px', threshold: [0, 0.25, 0.5, 1] });
io.observe(target); io.unobserve(target);
io.takeRecords(); io.disconnect();`),
      ],
    );
  }

  // =================================================================
  // Card 2：ResizeObserver 深入 + borderBoxSize
  // =================================================================

  _startRoObserver() {
    if (typeof ResizeObserver === 'undefined') {
      this._addLog('warn', 'ResizeObserver 不可用（observe 调用会被忽略，回调不触发）'); return;
    }
    if (this._ro) { try { this._ro.disconnect(); } catch { /* noop */ } this._ro = null; }
    try {
      const target = (this.$('#ro-target') as any);
      if (!target) { this._addLog('warn', '未找到 #ro-target 演示元素'); return; }
      const observer = new ResizeObserver((entries: any) => {
        try {
          entries.forEach((e: any) => {
            const borderBox = e.borderBoxSize && e.borderBoxSize[0];
            const contentBox = e.contentBoxSize && e.contentBoxSize[0];
            const size = {
              contentWidth: e.contentRect ? Math.round(e.contentRect.width) : null as any,
              contentHeight: e.contentRect ? Math.round(e.contentRect.height) : null as any,
              borderInline: borderBox ? Math.round(borderBox.inlineSize) : null as any,
              borderBlock: borderBox ? Math.round(borderBox.blockSize) : null as any,
              contentInline: contentBox ? Math.round(contentBox.inlineSize) : null as any,
            };
            this.setState({ roSize: size });
            this._addLog('size',
              `borderBox inline=${size.borderInline} block=${size.borderBlock} | ` +
              `contentRect ${size.contentWidth}×${size.contentHeight}`);
          });
        } catch { /* noop */ }
      });
      observer.observe(target);
      this._ro = observer;
      this._addLog('ro', `ResizeObserver 已启动，box='${this._roBox}'（观察 borderBoxSize 实时变化）`);
    } catch (err: any) {
      this._addLog('warn', '启动 ResizeObserver 失败：' + (err && err.message));
    }
  }

  _toggleRoBox() {
    // 切换 box 模式并重新 observe（options.box = 'content-box' | 'border-box'）
    this._roBox = this._roBox === 'content-box' ? 'border-box' : 'content-box';
    if (typeof ResizeObserver === 'undefined') { this._addLog('warn', 'ResizeObserver 不可用，仅切换状态：box=' + this._roBox); return; }
    if (!this._ro) { this._addLog('warn', '请先点击「启动 ResizeObserver」（当前 box=' + this._roBox + '）'); return; }
    try {
      const target = (this.$('#ro-target') as any);
      if (!target) { this._addLog('warn', '未找到 #ro-target 演示元素'); return; }
      // observe 第二参数 options.box（部分旧实现不支持，try/catch 兜底）
      try { this._ro.observe(target, { box: this._roBox }); }
      catch { try { this._ro.observe(target); } catch { /* noop */ } }
      this._addLog('ro', `已切换 box='${this._roBox}' 并重新 observe`);
    } catch (err: any) {
      this._addLog('warn', '切换 box 失败：' + (err && err.message));
    }
  }

  _resizeTarget() {
    // 制造尺寸变化：循环改变 width（直接改 DOM，回调由观察器触发）
    const target = (this.$('#ro-target') as any);
    if (!target) { this._addLog('warn', '未找到 #ro-target 演示元素'); return; }
    try {
      const cur = parseInt(target.style.width, 10) || 200;
      const next = cur >= 400 ? 100 : cur + 80;
      target.style.width = next + 'px';
      this._addLog('ro', `已改 width：${cur}px → ${next}px（观察器回调应触发，测试环境已 mock 不触发）`);
    } catch (err: any) {
      this._addLog('warn', '制造尺寸变化失败：' + (err && err.message));
    }
  }

  _renderCard2() {
    const s = this.state;
    const size = s.roSize;
    return this._card(
      'Card 2 · ResizeObserver 深入 + borderBoxSize',
      'new ResizeObserver(cb)；observer.observe(target, options?)，options.box = \'content-box\' | \'border-box\'（默认 content-box）。' +
      'entries[] 含 target / contentRect（旧，已废弃但仍可用）/ borderBoxSize[]（[{inlineSize, blockSize}]）/ ' +
      'contentBoxSize[] / devicePixelContentBoxSize[]。点击「制造尺寸变化」改 width 观察实时输出。',
      h(Tag, { color: 'warning' }, 'Resize'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('启动 ResizeObserver', {
            type: 'primary', size: 'sm', onClick: () => this._startRoObserver(),
          }),
          this._btn("切换 box: 'border-box'", {
            size: 'sm', onClick: () => this._toggleRoBox(),
          }),
          this._btn('制造尺寸变化（改 width）', {
            size: 'sm', onClick: () => this._resizeTarget(),
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          h(Tag, { color: 'default' }, "box: " + this._roBox),
          size
            ? h(Tag, { color: 'success' },
                'borderBox: ' + (size.borderInline != null ? size.borderInline + '×' + size.borderBlock : '—'))
            : h(Tag, { color: 'default' }, 'borderBox: —'),
          size
            ? h(Tag, { color: 'primary' },
                'contentRect: ' + (size.contentWidth != null ? size.contentWidth + '×' + size.contentHeight : '—'))
            : null,
        ),
        h('div', {
          id: 'ro-target',
          style: {
            width: '200px', height: '80px', borderRadius: '8px', marginTop: '12px',
            background: 'linear-gradient(135deg, #52c41a, #1677ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 'bold', resize: 'horizontal', overflow: 'auto',
          },
        }, '可调整大小容器'),
        h('pre', { class: 'code-block mt-md' },
`const ro = new ResizeObserver((entries) => {
  entries.forEach((e) => {
    e.target; e.contentRect;            // 旧 API（已废弃）
    e.borderBoxSize[0];                 // [{inlineSize, blockSize}]
    e.contentBoxSize[0]; e.devicePixelContentBoxSize[0];
  });
});
ro.observe(target);                              // 默认 content-box
ro.observe(target, { box: 'border-box' }); ro.disconnect();`),
      ],
    );
  }

  // =================================================================
  // Card 3：MutationObserver 深入 + subtree/attributeFilter
  // =================================================================

  _startMoObserver() {
    if (typeof MutationObserver === 'undefined') {
      this._addLog('warn', 'MutationObserver 不可用（observe 调用会被忽略，回调不触发）'); return;
    }
    if (this._mo) { try { this._mo.disconnect(); } catch { /* noop */ } this._mo = null; }
    try {
      const target = (this.$('#mo-target') as any);
      if (!target) { this._addLog('warn', '未找到 #mo-target 演示元素'); return; }
      // observe subtree + attributeFilter:['class','data-state']，仅观察指定属性
      const observer = new MutationObserver((records: any) => {
        try {
          const snaps: any[] = [];
          for (const m of records) {
            const snap = {
              type: m.type, target: m.target ? m.target.tagName : '?',
              attributeName: m.attributeName || null, oldValue: m.oldValue || null,
              added: m.addedNodes ? m.addedNodes.length : 0,
              removed: m.removedNodes ? m.removedNodes.length : 0,
            };
            snaps.push(snap);
            if (m.type === 'attributes') {
              this._addLog('mut',
                `attr ${m.attributeName} → ${(m.target as Element).getAttribute(m.attributeName)}` +
                (m.oldValue != null ? `（旧值=${m.oldValue}）` : ''));
            } else if (m.type === 'childList') {
              this._addLog('mut',
                `childList +${snap.added} -${snap.removed}` +
                (m.addedNodes && m.addedNodes[0] ? `（新增 ${m.addedNodes[0].nodeName}）` : '') +
                (m.removedNodes && m.removedNodes[0] ? `（移除 ${m.removedNodes[0].nodeName}）` : ''));
            } else if (m.type === 'characterData') {
              this._addLog('mut', 'characterData 文本变化');
            }
          }
          this.setState({ moRecords: [...this.state.moRecords, ...snaps].slice(-10) });
        } catch { /* noop */ }
      });
      observer.observe(target, {
        childList: true, attributes: true, subtree: true, attributeOldValue: true,
        attributeFilter: ['class', 'data-state'],
      });
      this._mo = observer;
      this._addLog('mo', 'MutationObserver 已启动（subtree + attributeFilter:[class, data-state]）');
    } catch (err: any) {
      this._addLog('warn', '启动 MutationObserver 失败：' + (err && err.message));
    }
  }

  _triggerMoAttr() {
    // 触发属性变化：切换 class / data-state（attributeFilter 内的属性才会被观察）
    const target = (this.$('#mo-target') as any);
    if (!target) { this._addLog('warn', '未找到 #mo-target 演示元素'); return; }
    try {
      const hasClass = target.classList.contains('mo-active');
      target.classList.toggle('mo-active', !hasClass);
      target.setAttribute('data-state', hasClass ? 'idle' : 'active');
      // 改一个未被 filter 的属性，观察器不会触发（演示 attributeFilter 的过滤效果）
      target.setAttribute('data-ignore', String(Date.now()));
      this._addLog('mo', '已切换 class/data-state（应触发），同时改 data-ignore（被 filter 过滤，不触发）');
    } catch (err: any) {
      this._addLog('warn', '触发属性变化失败：' + (err && err.message));
    }
  }

  _triggerMoChild() {
    // 触发子节点增删（subtree=true 时后代变化也会被观察）
    const target = (this.$('#mo-target') as any);
    if (!target) { this._addLog('warn', '未找到 #mo-target 演示元素'); return; }
    try {
      const child = document.createElement('span');
      child.className = 'tag tag--primary';
      child.textContent = '子节点 #' + (target.children.length + 1);
      target.appendChild(child);
      // 超过 5 个子节点则移除最后一个，演示 removedNodes
      if (target.children.length > 5 && target.lastChild) target.removeChild(target.lastChild);
      this._addLog('mo', '已 appendChild（观察器应触发 childList，测试环境已 mock 不触发）');
    } catch (err: any) {
      this._addLog('warn', '触发子节点增删失败：' + (err && err.message));
    }
  }

  _moTakeRecords() {
    if (typeof MutationObserver === 'undefined') { this._addLog('warn', 'MutationObserver 不可用，takeRecords 无效'); return; }
    if (!this._mo) { this._addLog('warn', '请先点击「启动 MutationObserver」'); return; }
    try {
      const records = typeof this._mo.takeRecords === 'function' ? (this._mo.takeRecords() || []) : [];
      this._addLog('mo', `takeRecords() 立即读取到 ${records.length} 条未派发的 record`);
      if (records.length === 0) this._addLog('mo', '（测试环境观察器已 mock，takeRecords 返回空数组，真实浏览器可见）');
    } catch (err: any) {
      this._addLog('warn', 'takeRecords 失败：' + (err && err.message));
    }
  }

  _renderCard3() {
    const s = this.state;
    return this._card(
      'Card 3 · MutationObserver 深入 + subtree/attributeFilter',
      'new MutationObserver(cb)；observer.observe(target, options)。options：childList（子节点增删）/ attributes（属性变化）/ ' +
      'subtree（含后代）/ attributeOldValue / characterData / characterDataOldValue / attributeFilter([\'class\',\'data-x\'] 仅观察指定属性)。' +
      'records[] 含 type / target / addedNodes / removedNodes / attributeName / oldValue / nextSibling / previousSibling。',
      h(Tag, { color: 'success' }, 'Mutation'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('启动 MO（subtree + attributeFilter）', {
            type: 'primary', size: 'sm', onClick: () => this._startMoObserver(),
          }),
          this._btn('触发属性变化', {
            size: 'sm', onClick: () => this._triggerMoAttr(),
          }),
          this._btn('触发子节点增删', {
            size: 'sm', onClick: () => this._triggerMoChild(),
          }),
          this._btn('takeRecords', {
            size: 'sm', onClick: () => this._moTakeRecords(),
          }),
        ),
        h('div', {
          id: 'mo-target', 'data-state': 'idle', class: 'mo-target',
          style: {
            minHeight: '60px', padding: '12px', marginTop: '12px', borderRadius: '8px',
            border: '1px dashed #d9d9d9', display: 'flex', flexWrap: 'wrap', gap: '6px',
            alignItems: 'center', background: '#fafafa',
          },
        }, h('span', { class: 'fs-sm text-secondary' }, '观察容器（改 class/data-state/子节点）')),
        s.moRecords.length > 0
          ? h('div', { class: 'log-panel mt-md', style: { maxHeight: '120px' } },
              s.moRecords.map((r: any, i: any) => h('div', { class: 'log-panel__line' },
                h('span', { class: 'log-panel__tag log-panel__tag--mut' }, r.type),
                h('span', { class: 'fs-sm' },
                  `[${i}] ${r.type} target=${r.target}` +
                  (r.attributeName ? ` attr=${r.attributeName}` : '') +
                  (r.oldValue != null ? ` old=${r.oldValue}` : '') +
                  ` +${r.added} -${r.removed}`),
              )),
            )
          : h('div', { class: 'log-panel__empty mt-md' }, '（暂无 record，启动后改属性/子节点）'),
        h('pre', { class: 'code-block mt-md' },
`const mo = new MutationObserver((records) => {
  for (const m of records) {
    m.type;            // 'childList' | 'attributes' | 'characterData'
    m.target; m.addedNodes; m.removedNodes;
    m.attributeName; m.oldValue; m.previousSibling; m.nextSibling;
  }
});
mo.observe(target, {
  childList: true, attributes: true, subtree: true, attributeOldValue: true,
  attributeFilter: ['class', 'data-state'], // 仅观察指定属性
});
mo.takeRecords(); mo.disconnect();`),
      ],
    );
  }

  // =================================================================
  // Card 4：elementFromPoint / elementsFromPoint + 命中测试
  // =================================================================

  _onClickHit(e: any) {
    // 演示区 click 事件：输出点击坐标的 elementFromPoint 结果
    if (typeof document === 'undefined' ||
        typeof document.elementFromPoint !== 'function') {
      this._addLog('warn', 'document.elementFromPoint 不可用，点击命中测试跳过');
      return;
    }
    try {
      const x = (typeof e.clientX === 'number') ? e.clientX : 0;
      const y = (typeof e.clientY === 'number') ? e.clientY : 0;
      const el = document.elementFromPoint(x, y);
      const tag = el ? el.tagName : 'null';
      const id = el && el.id ? '#' + el.id : '';
      const cls = el && el.className ? '.' + String(el.className).split(/\s+/).slice(0, 2).join('.') : '';
      this.setState({ hitResult: { source: 'click', x, y, tag, id, cls, list: null } });
      this._addLog('hit', `click (${x}, ${y}) → ${tag}${id}${cls || '(无 id/class)'}`);
    } catch (err: any) {
      this._addLog('warn', 'click 命中测试失败：' + (err && err.message));
    }
  }

  // 获取 #hit-target 中心点坐标与 rect（公共逻辑）
  _targetCenter() {
    const target = (this.$('#hit-target') as any);
    if (!target) { this._addLog('warn', '未找到 #hit-target 演示元素'); return null; }
    const rect = typeof target.getBoundingClientRect === 'function'
      ? target.getBoundingClientRect() : null;
    if (!rect) { this._addLog('warn', 'getBoundingClientRect 不可用'); return null; }
    return { target, rect, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  }

  _hitFromCenter() {
    // 获取 #hit-target 中心点并 elementFromPoint
    if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
      this._addLog('warn', 'document.elementFromPoint 不可用，命中测试跳过'); return;
    }
    const c = this._targetCenter();
    if (!c) return;
    try {
      const el = document.elementFromPoint(c.cx, c.cy);
      const tag = el ? el.tagName : 'null';
      const contains = el ? c.target.contains(el) : false;
      this.setState({
        hitResult: {
          source: 'center', x: (c.cx as any).toFixed(1), y: (c.cy as any).toFixed(1), tag,
          rect: { w: (c.rect.width as any).toFixed(0), h: (c.rect.height as any).toFixed(0) }, contains,
        },
      });
      this._addLog('hit',
        `elementFromPoint(中心 ${(c.cx as any).toFixed(0)}, ${(c.cy as any).toFixed(0)}) → ${tag}（target.contains=${contains}）`);
      if (!el) this._addLog('hit', '（jsdom 无布局引擎，elementFromPoint 可能返回 null，真实浏览器可见）');
    } catch (err: any) {
      this._addLog('warn', '中心点命中测试失败：' + (err && err.message));
    }
  }

  _elementsFromPointList() {
    // elementsFromPoint 返回所有重叠元素数组（从顶到底）
    if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
      this._addLog('warn', 'document.elementsFromPoint 不可用，列表演示跳过'); return;
    }
    const c = this._targetCenter();
    if (!c) return;
    try {
      const list = document.elementsFromPoint(c.cx, c.cy) || [];
      const names = list.map((el: any) =>
        el ? (el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(/\s+/)[0] : '')) : '?');
      this.setState({ hitResult: { source: 'list', x: (c.cx as any).toFixed(1), y: (c.cy as any).toFixed(1), count: list.length, names } });
      this._addLog('point',
        `elementsFromPoint(${(c.cx as any).toFixed(0)}, ${(c.cy as any).toFixed(0)}) → ${list.length} 个元素：` +
        (names.length ? names.join(' > ') : '（空）'));
    } catch (err: any) {
      this._addLog('warn', 'elementsFromPoint 失败：' + (err && err.message));
    }
  }

  _renderHitResult() {
    const r = this.state.hitResult;
    if (!r) return h('div', { class: 'log-panel__empty mt-md' }, '（暂无命中结果，点击演示区或上方按钮）');
    let text;
    if (r.source === 'list') {
      text = `elementsFromPoint(${r.x}, ${r.y}) → ${r.count} 个元素（从顶到底）：\n` +
        (r.names && r.names.length ? r.names.map((n: any, i: any) => `  [${i}] ${n}`).join('\n') : '  （空，jsdom 无布局引擎时常见）');
    } else if (r.source === 'click') {
      text = `click (${r.x}, ${r.y}) → ${r.tag}${r.id}${r.cls || ''}`;
    } else {
      text = `elementFromPoint(中心 ${r.x}, ${r.y}) → ${r.tag}\nrect: ${r.rect.w}×${r.rect.h}，target.contains=${r.contains}`;
    }
    return h('div', { class: 'fs-sm mt-md', style: { whiteSpace: 'pre-line' } }, text);
  }

  _renderCard4() {
    return this._card(
      'Card 4 · elementFromPoint / elementsFromPoint + 命中测试',
      'document.elementFromPoint(x, y) 返回该坐标最顶层元素；document.elementsFromPoint(x, y) 返回所有重叠元素数组（从顶到底）。' +
      'element.getBoundingClientRect() 获取坐标，element.contains(node) 检查包含关系。' +
      '点击下方演示区，或点击按钮获取 #hit-target 中心点的命中结果。',
      h(Tag, { color: 'primary' }, 'Hit Test'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('获取中心点 elementFromPoint', {
            type: 'primary', size: 'sm', onClick: () => this._hitFromCenter(),
          }),
          this._btn('elementsFromPoint 列表', {
            size: 'sm', onClick: () => this._elementsFromPointList(),
          }),
        ),
        h('div', {
          id: 'hit-area', class: 'mt-md',
          style: {
            padding: '24px', border: '1px dashed #d9d9d9', borderRadius: '8px',
            background: '#fafafa', cursor: 'crosshair', position: 'relative',
          },
          onClick: (e: any) => this._onClickHit(e),
        },
          h('div', {
            id: 'hit-target',
            style: {
              width: '120px', height: '60px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #fa541c, #fa8c16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 'bold',
            },
          }, '点击此处或周围'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, '↑ 点击本区域内任意位置进行命中测试'),
        ),
        this._renderHitResult(),
        h('pre', { class: 'code-block mt-md' },
`const el = document.elementFromPoint(x, y);    // 最顶层元素
const list = document.elementsFromPoint(x, y);   // 全部重叠元素（顶→底）
const rect = el.getBoundingClientRect();        // {left, top, width, height, ...}
target.contains(node);                            // 是否包含某节点`),
      ],
    );
  }

  // =================================================================
  // Card 5：三观察器组合 + PerformanceObserver 监听长任务
  // =================================================================

  _startCombo() {
    // 同时启动 Intersection + Resize + Mutation 观察同一容器
    const ioOk = typeof IntersectionObserver !== 'undefined';
    const roOk = typeof ResizeObserver !== 'undefined';
    const moOk = typeof MutationObserver !== 'undefined';
    const poOk = typeof PerformanceObserver !== 'undefined';
    if (!ioOk && !roOk && !moOk) {
      this._addLog('warn', '三个观察器均不可用，无法启动组合观察');
      return;
    }
    this._comboDisconnect(true); // 已存在则先全部断开
    const target = (this.$('#combo-target') as any);
    if (!target) { this._addLog('warn', '未找到 #combo-target 演示元素'); return; }
    // 重置统计
    this._ioCount = 0; this._roCount = 0; this._moCount = 0; this._longtaskCount = 0;
    this._updateComboStats();
    // 计数自增辅助：触发某观察器时累加并记日志
    const bump = (key: any, label: any) => {
      (this as any)[key]++; this._addLog('combo', `${label} 触发（累计 ${(this as any)[key]}）`); this._updateComboStats();
    };
    try {
      if (ioOk) {
        this._comboIo = new IntersectionObserver((es: any) => {
          try { es.forEach(() => bump('_ioCount', 'Intersection')); } catch { /* noop */ }
        }, { threshold: [0, 0.5, 1] });
        try { this._comboIo.observe(target); } catch { /* noop */ }
      }
      if (roOk) {
        this._comboRo = new ResizeObserver((es: any) => {
          try { es.forEach(() => bump('_roCount', 'Resize')); } catch { /* noop */ }
        });
        try { this._comboRo.observe(target); } catch { /* noop */ }
      }
      if (moOk) {
        this._comboMo = new MutationObserver((records: any) => {
          try {
            this._moCount += records.length || 0;
            this._addLog('combo', `Mutation 触发 ${records.length} 条（累计 ${this._moCount}）`);
            this._updateComboStats();
          } catch { /* noop */ }
        });
        try { this._comboMo.observe(target, { childList: true, attributes: true, subtree: true, attributeOldValue: true }); } catch { /* noop */ }
      }
      // PerformanceObserver 观察 longtask（若可用）
      if (poOk) {
        try {
          this._comboPerfObs = new PerformanceObserver((list: any) => {
            try {
              const entries = list && typeof list.getEntries === 'function' ? list.getEntries() : [];
              entries.forEach(() => bump('_longtaskCount', 'longtask'));
            } catch { /* noop */ }
          });
          try { this._comboPerfObs.observe({ type: 'longtask', buffered: true }); }
          catch { try { this._comboPerfObs.observe({ entryTypes: ['longtask'] }); } catch { /* noop */ } }
        } catch { /* noop */ }
      }
      this._addLog('combo',
        '三合一观察器已启动：Intersection + Resize + Mutation' +
        (poOk ? ' + longtask' : '（PerformanceObserver 不可用，跳过 longtask）'));
    } catch (err: any) {
      this._addLog('warn', '启动组合观察失败：' + (err && err.message));
    }
  }

  _triggerComboChange() {
    // 对容器做一次"改属性 + 改尺寸 + 插入子节点"，三个观察器各应触发
    const target = (this.$('#combo-target') as any);
    if (!target) { this._addLog('warn', '未找到 #combo-target 演示元素'); return; }
    try {
      // 1. 改属性
      const cur = target.getAttribute('data-state') || 'idle';
      target.setAttribute('data-state', cur === 'idle' ? 'active' : 'idle');
      // 2. 改尺寸
      const w = parseInt(target.style.width, 10) || 160;
      target.style.width = (w >= 240 ? 120 : w + 40) + 'px';
      // 3. 插入子节点
      const child = document.createElement('span');
      child.className = 'tag tag--success';
      child.textContent = '节点 #' + (target.children.length + 1);
      target.appendChild(child);
      // 超过 6 个子节点则移除最旧的，避免无限增长
      if (target.children.length > 6 && target.firstChild) target.removeChild(target.firstChild);
      this._addLog('combo', '已触发综合变化（改属性 + 改尺寸 + 插入子节点），三观察器各应触发一次');
      this._addLog('combo', '（测试环境观察器已 mock，回调不会触发，真实浏览器可见对比开销）');
    } catch (err: any) {
      this._addLog('warn', '触发综合变化失败：' + (err && err.message));
    }
  }

  _updateComboStats() {
    this.setState({
      comboStats: { io: this._ioCount, ro: this._roCount, mo: this._moCount, longtask: this._longtaskCount },
    });
  }

  _comboStatsLog() {
    if (!this._comboIo && !this._comboRo && !this._comboMo) { this._addLog('warn', '请先点击「启动三合一观察」'); return; }
    this._updateComboStats();
    this._addLog('stat',
      `统计 → Intersection=${this._ioCount}，Resize=${this._roCount}，` +
      `Mutation=${this._moCount}，longtask=${this._longtaskCount}`);
    this._addLog('stat', '说明：Intersection/Resize 通常各触发 1 次/Mutation 改动；longtask 仅在主线程阻塞 >50ms 时触发（开销对比依据）');
  }

  _comboDisconnect(silent: any) {
    const keys = ['_comboIo', '_comboRo', '_comboMo', '_comboPerfObs'];
    let any = false;
    keys.forEach((k: any) => {
      if ((this as any)[k]) { try { (this as any)[k].disconnect?.(); } catch { /* noop */ } (this as any)[k] = null; any = true; }
    });
    if (!silent) {
      if (any) this._addLog('combo', '已 disconnect 全部观察器（Intersection/Resize/Mutation/longtask）');
      else this._addLog('warn', '无正在运行的组合观察器');
    }
  }

  _renderCard5() {
    const s = this.state;
    const st = s.comboStats;
    return this._card(
      'Card 5 · 三观察器组合 + PerformanceObserver 监听长任务',
      '同时启动 Intersection + Resize + Mutation 观察同一容器，配合 PerformanceObserver 观察 longtask（若可用）。' +
      '统计各自触发次数，对比开销。点击「触发综合变化」对容器做一次"改属性 + 改尺寸 + 插入子节点"，三个观察器各触发几次。',
      h(Tag, { color: st ? 'success' : 'default' }, st ? '运行中' : '未启动'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('启动三合一观察', {
            type: 'primary', size: 'sm', onClick: () => this._startCombo(),
          }),
          this._btn('触发综合变化', {
            size: 'sm', onClick: () => this._triggerComboChange(),
          }),
          this._btn('输出统计', {
            size: 'sm', onClick: () => this._comboStatsLog(),
          }),
          this._btn('disconnect all', {
            size: 'sm', danger: true, onClick: () => this._comboDisconnect(false),
          }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          h(Tag, { color: 'primary' }, 'Intersection: ' + (st ? st.io : 0)),
          h(Tag, { color: 'warning' }, 'Resize: ' + (st ? st.ro : 0)),
          h(Tag, { color: 'success' }, 'Mutation: ' + (st ? st.mo : 0)),
          h(Tag, { color: 'default' }, 'longtask: ' + (st ? st.longtask : 0)),
        ),
        h('div', {
          id: 'combo-target', 'data-state': 'idle',
          style: {
            width: '160px', minHeight: '60px', padding: '12px', marginTop: '12px', borderRadius: '8px',
            border: '1px dashed #d9d9d9', display: 'flex', flexWrap: 'wrap', gap: '6px',
            alignItems: 'center', background: 'linear-gradient(135deg, #f0f5ff, #f6ffed)',
            transition: 'width 0.2s',
          },
        }, h('span', { class: 'fs-sm text-secondary' }, '组合观察容器')),
        h('pre', { class: 'code-block mt-md' },
`// 三观察器组合 + longtask
const io = new IntersectionObserver(cb).observe(el);
const ro = new ResizeObserver(cb).observe(el);
const mo = new MutationObserver(cb).observe(el, { childList: true, attributes: true, subtree: true });
// PerformanceObserver 监听长任务（主线程阻塞 >50ms）
new PerformanceObserver((list) => {
  list.getEntries().forEach((e) => console.log('longtask', e.duration));
}).observe({ type: 'longtask', buffered: true });
io.disconnect(); ro.disconnect(); mo.disconnect(); // 对比开销后释放`),
      ],
    );
  }

  // =================================================================
  // 整页渲染
  // =================================================================

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '高级观察器与命中测试实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 IntersectionObserver/ResizeObserver/MutationObserver 深入选项 + elementFromPoint 命中测试 + 三观察器组合。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
