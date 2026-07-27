// =====================================================================
// ComputePressureAPIPage.js —— Compute Pressure API 完整 实验室
// 演示 W3C Compute Pressure API 系统压力感知能力：
//   1. 概述与动机 —— Web 应用对系统资源的自适应需求 /
//      现有 Performance API 只观测耗时不能感知压力 /
//      Compute Pressure API W3C / PressureObserver /
//      浏览器支持 Chrome/Edge ship / Safari/Firefox 开发中
//   2. PressureObserver 基础 —— new PressureObserver(callback) /
//      observe('cpu', { sampleRate }) / unobserve('cpu') / disconnect() /
//      takeRecords() / callback(records, observer) / 异步回调
//   3. 压力源 source —— 'cpu' 当前支持 / 'thermal' 热量 /
//      'power-supply' 电源（提案中）/ 各 source 浏览器支持矩阵 /
//      安全考虑（避免指纹识别）
//   4. 压力状态 state —— 'nominal' 正常 / 'fair' 轻微 / 'serious' 严重 /
//      'critical' 危急 / 4 级阈值含义 / 状态转换触发回调 /
//      与 CPU 占用率映射
//   5. PressureRecord 结构 —— record.source / record.state / record.time /
//      record.toJSON() / 历史记录与平均 / sampleRate 采样频率 / 时间戳
//   6. 实战：视频会议自适应降级 —— critical → 关闭视频 / serious → 降低分辨率 /
//      fair → 降帧率 / nominal → 恢复 /
//      与 MediaStreamTrack.applyConstraints 协同
//   7. 实战：游戏画质自适应 —— CPU 压力 → 降低粒子数/视距/阴影 /
//      与 requestAnimationFrame 配合 / WebGPU 性能监控 / 长任务降级
//   8. 陷阱与最佳实践 —— 观察者去重 / 样本频率权衡（高频耗电） /
//      用户隐私（不暴露精确数值） / 与 navigator.deviceMemory 协同 /
//      与 Scheduler API 互补 / feature detection / 降级到 LongTask API
// 说明：所有特性调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不实现 Compute Pressure API，
//       PressureObserver/PressureRecord 在 jsdom 均为 undefined，
//       统一 safe(()=>...) 兜底返回 false。注入演示样式 + 完整代码示例，
//       真实浏览器（Chrome 125+ ship）可运行实际压力监听。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ComputePressureAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',        // Card 1：概述与动机
      observerInfo: '',        // Card 2：PressureObserver 基础
      sourceInfo: '',          // Card 3：压力源 source
      stateInfo: '',           // Card 4：压力状态 state
      recordInfo: '',          // Card 5：PressureRecord 结构
      videoConfInfo: '',       // Card 6：视频会议自适应降级
      gameAdaptInfo: '',       // Card 7：游戏画质自适应
      pitfallsInfo: '',        // Card 8：陷阱与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];     // 动态创建并插入 head 的 <style> 元素列表
    this._pressureObservers = []; // PressureObserver 实例（componentWillUnmount 中 disconnect）
    this._simTimer = null;        // 模拟压力变化的定时器（jsdom 无真实压力源）

    this._observeSource = 'cpu';          // Card 2 当前观察 source
    this._sampleRate = 1.0;               // Card 2 采样频率（Hz）
    this._currentSource = 'cpu';          // Card 3 当前查看 source
    this._currentState = 'nominal';       // Card 4 当前模拟 state
    this._videoPolicy = 'auto';           // Card 6 当前视频降级策略
    this._gameQuality = 'high';           // Card 7 当前游戏画质

    // 一次性能力检测：Compute Pressure API
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `PressureObserver ${c(f.pressureObserver)}`,
      `PressureRecord ${c(f.pressureRecord)}`,
      `observe 方法 ${c(f.observeMethod)}`,
      `'PressureObserver' in window ${c(f.inWindow)}`,
    ];

    const summary = f.pressureObserver
      ? `Compute Pressure API 能力检测：${parts.join(' · ')}。当前环境支持 PressureObserver（Chrome/Edge ship），可运行真实压力监听。建议 sampleRate 不超过 1Hz 以平衡实时性与耗电。jsdom 不实现该 API。`
      : `Compute Pressure API 能力检测：${parts.join(' · ')}。当前环境（jsdom 或不支持 Compute Pressure 的浏览器）不可用，所有按钮点击将仅记日志说明，不会抛异常。在 Chrome/Edge 125+ 真实浏览器中打开可完整演示压力监听与自适应降级。`;

    this.setState({ capsSummary: summary });
    this._addLog(f.pressureObserver ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.pressureObserver) this._addLog('warn', 'PressureObserver 不可用（jsdom 不实现；Chrome/Edge 125+ ship，Safari/Firefox 开发中）');
    if (!f.pressureRecord) this._addLog('warn', 'PressureRecord 不可用（jsdom 不实现；PressureObserver 输出的记录类型）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    this._destroyed = true;
    // 移除动态创建的 <style> 元素
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    // 断开所有 PressureObserver，避免内存泄漏
    for (const po of this._pressureObservers) {
      try { po.disconnect(); } catch { /* noop */ }
    }
    this._pressureObservers = [];
    // 清理模拟定时器
    if (this._simTimer) {
      try { clearInterval(this._simTimer); clearTimeout(this._simTimer); } catch { /* noop */ }
      this._simTimer = null;
    }
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

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  // jsdom 不可用时 safe 返回 false，绝不抛异常
  _flags() {
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    return {
      pressureObserver: safe(() => typeof window.PressureObserver === 'function'),
      pressureRecord: safe(() => typeof window.PressureRecord !== 'undefined'),
      observeMethod: safe(() => {
        try {
          return typeof new PressureObserver(() => {}).observe === 'function';
        } catch { return false; }
      }),
      inWindow: safe(() => 'PressureObserver' in window),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id, textContent) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 动态注入所有演示样式 ——
  _injectDemoStyles() {
    this._injectStyle('compute-pressure-api-demo', `
      /* ===== 通用舞台 ===== */
      .cp-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 4：压力状态指示器 ===== */
      .cp-state-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-top: 8px;
      }
      .cp-state-cell {
        padding: 10px;
        border-radius: 6px;
        text-align: center;
        font-size: 12px;
        border: 2px solid transparent;
        transition: all 0.2s;
      }
      .cp-state-cell .lvl { font-weight: 700; font-size: 14px; }
      .cp-state-cell .desc { color: #64748b; margin-top: 4px; font-size: 11px; }
      .cp-state-nominal { background: #dcfce7; border-color: #10b981; color: #064e3b; }
      .cp-state-fair { background: #fef3c7; border-color: #f59e0b; color: #78350f; }
      .cp-state-serious { background: #fed7aa; border-color: #ea580c; color: #7c2d12; }
      .cp-state-critical { background: #fee2e2; border-color: #ef4444; color: #7f1d1d; }
      .cp-state-cell.active { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      /* ===== Card 6：视频会议策略表 ===== */
      .cp-policy-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 12px;
      }
      .cp-policy-table th, .cp-policy-table td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        text-align: left;
      }
      .cp-policy-table th { background: #e0e7ff; font-weight: 600; }
      .cp-policy-table .state-nominal { color: #10b981; font-weight: 600; }
      .cp-policy-table .state-fair { color: #f59e0b; font-weight: 600; }
      .cp-policy-table .state-serious { color: #ea580c; font-weight: 600; }
      .cp-policy-table .state-critical { color: #ef4444; font-weight: 600; }
      /* ===== Card 7：游戏画质指示器 ===== */
      .cp-quality-bar {
        display: flex;
        gap: 4px;
        margin-top: 8px;
        height: 24px;
        border-radius: 4px;
        overflow: hidden;
      }
      .cp-quality-bar .seg {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: #fff;
        font-weight: 600;
      }
      .cp-quality-low { background: #10b981; }
      .cp-quality-medium { background: #f59e0b; }
      .cp-quality-high { background: #3b82f6; }
      .cp-quality-ultra { background: #8b5cf6; }
      .cp-quality-bar .seg.inactive { opacity: 0.3; }
      /* ===== 输出区 ===== */
      .cp-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        max-height: 200px;
        overflow: auto;
      }
    `);
  }

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo() {
    const f = this._flags();
    try {
      return `===== Compute Pressure API 概述与动机 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  Compute Pressure API 由 W3C Compute Pressure Working Group 制定\n` +
        `  规范地址：https://www.w3.org/TR/compute-pressure/\n` +
        `  状态：Candidate Recommendation Draft（2024+）\n` +
        `\n` +
        `【动机：Web 应用自适应需求】\n` +
        `  现代 Web 应用（视频会议、云游戏、AI 推理、3D 渲染）对系统资源需求高：\n` +
        `    视频会议：高负载时发热、风扇噪音、电池耗尽\n` +
        `    云游戏：CPU/GPU 满载导致掉帧\n` +
        `    AI 推理（WebGPU/WebNN）：持续高负载\n` +
        `    WebRTC：编码高负载导致延迟\n` +
        `  需求：根据系统压力自适应降级，保持流畅 + 省电 + 不卡顿\n` +
        `\n` +
        `【现有 Performance API 局限】\n` +
        `  Performance API（PerformanceObserver / PerformanceEntry）：\n` +
        `    只观测耗时（LongTask、Measure、Resource timing）\n` +
        `    不能直接感知系统压力（CPU 占用率、温度、电量）\n` +
        `    被动响应（任务已执行完才记录）\n` +
        `    无前瞻性预警\n` +
        `  navigator.hardwareConcurrency / deviceMemory：\n` +
        `    静态能力信息（逻辑核心数、内存容量）\n` +
        `    不反映实时负载\n` +
        `\n` +
        `【Compute Pressure API 提供】\n` +
        `  PressureObserver —— 异步观察系统压力变化\n` +
        `  PressureRecord —— 单次压力记录（source + state + time）\n` +
        `  4 级压力状态：nominal / fair / serious / critical\n` +
        `  压力源：cpu（当前支持）/ thermal / power-supply（提案中）\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 125+（2024.05）—— Origin Trial → ship\n` +
        `  Edge 125+ —— 同 Chromium 内核\n` +
        `  Safari —— 开发中（未 ship）\n` +
        `  Firefox —— 开发中（未 ship）\n` +
        `  jsdom —— 不实现\n` +
        `\n` +
        `【与 Performance API 对比】\n` +
        `  Performance API：观测任务耗时（被动、事后）\n` +
        `  Compute Pressure API：感知系统压力（主动、前瞻）\n` +
        `  互补：Performance 找出长任务，Compute Pressure 触发降级\n` +
        `\n` +
        `【能力检测】\n` +
        `  PressureObserver 可用 = ${f.pressureObserver}\n` +
        `  PressureRecord 可用 = ${f.pressureRecord}\n` +
        `  observe 方法可用 = ${f.observeMethod}\n` +
        `  'PressureObserver' in window = ${f.inWindow}\n` +
        `\n` +
        `【隐私考虑】\n` +
        `  仅暴露 4 级离散状态（nominal/fair/serious/critical），不暴露精确数值\n` +
        `  避免指纹识别（精确 CPU 占用率可指纹）\n` +
        `  sampleRate 限制采样频率，防止高频探测\n` +
        `  需要安全上下文（HTTPS 或 localhost）`;
    } catch (err) {
      return `读取 Compute Pressure 概述信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo() {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    const f = this._flags();
    this._addLog('info', `Compute Pressure 概述演示：PressureObserver=${f.pressureObserver}, inWindow=${f.inWindow}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— 系统压力感知 / W3C Compute Pressure',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PressureObserver', f.pressureObserver],
          ['PressureRecord', f.pressureRecord],
        ]),
        h(Tag, { color: 'primary' }, 'Chrome 125+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Compute Pressure API 由 W3C 制定，弥补现有 Performance API（仅观测耗时，被动事后）无法感知系统实时压力的局限。提供 PressureObserver 异步观察 + PressureRecord（source/state/time）+ 4 级状态（nominal/fair/serious/critical）+ 压力源（cpu 当前支持，thermal/power-supply 提案中）。适用场景：视频会议自适应降级、云游戏画质调整、AI 推理负载控制。Chrome/Edge 125+ ship，Safari/Firefox 开发中。仅暴露离散状态避免指纹识别，需 HTTPS 安全上下文。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 Compute Pressure API 全景）')),
        h(Alert, {
          type: 'info',
          message: 'Compute Pressure API 是 Performance API 的主动前瞻补充',
          description: 'Performance API 观测任务耗时（被动、事后记录 LongTask/Measure）。Compute Pressure API 感知系统压力（主动、前瞻预警），让应用在压力升高时提前降级。仅暴露 4 级离散状态避免指纹识别，sampleRate 限制采样频率。Chrome/Edge 125+ ship，Safari/Firefox 开发中。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：PressureObserver 基础 ===================

  _readObserverInfo() {
    const f = this._flags();
    try {
      return `===== PressureObserver 基础 =====\n` +
        `\n` +
        `【构造】\n` +
        `  const observer = new PressureObserver((records, observer) => {\n` +
        `    // records: PressureRecord[]，状态变化时触发\n` +
        `    // observer: PressureObserver 实例本身\n` +
        `    for (const record of records) {\n` +
        `      console.log('source=' + record.source + ' state=' + record.state);\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `【observe 观察】\n` +
        `  observer.observe('${this._observeSource}', { sampleRate: ${this._sampleRate} });\n` +
        `  // source: 'cpu'（当前唯一支持）\n` +
        `  // sampleRate: 采样频率（Hz），如 1.0 = 每秒最多 1 次回调\n` +
        `  // 不传 sampleRate 时使用浏览器默认（通常 1Hz）\n` +
        `\n` +
        `【unobserve 停止观察】\n` +
        `  observer.unobserve('${this._observeSource}');\n` +
        `  // 仅停止指定 source，观察者仍可观察其他 source\n` +
        `\n` +
        `【disconnect 全部断开】\n` +
        `  observer.disconnect();\n` +
        `  // 停止所有 source 观察，释放资源\n` +
        `  // 组件卸载时必须调用，避免内存泄漏\n` +
        `\n` +
        `【takeRecords 立即获取】\n` +
        `  const records = observer.takeRecords();\n` +
        `  // 取出并清空待处理的 PressureRecord[]\n` +
        `  // 不等待异步回调，立即同步获取\n` +
        `\n` +
        `【callback 异步回调】\n` +
        `  回调在状态变化时触发（非轮询）：\n` +
        `    nominal → fair → serious → critical 升级时触发\n` +
        `    critical → serious → fair → nominal 降级时触发\n` +
        `  sampleRate 限制触发频率上限（防止高频探测指纹）\n` +
        `  records 可能包含多条（状态快速变化时累积）\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  const observer = new PressureObserver((records) => {\n` +
        `    for (const r of records) {\n` +
        `      console.log(r.time + ' [' + r.source + '] ' + r.state);\n` +
        `      if (r.state === 'critical') {\n` +
        `        // 关闭视频/降低画质\n` +
        `      }\n` +
        `    }\n` +
        `  });\n` +
        `  observer.observe('cpu', { sampleRate: 1.0 });\n` +
        `\n` +
        `  // 卸载时\n` +
        `  observer.disconnect();\n` +
        `\n` +
        `【能力检测】\n` +
        `  PressureObserver 可用 = ${f.pressureObserver}\n` +
        `  observe 方法可用 = ${f.observeMethod}\n` +
        `  当前观察 source = '${this._observeSource}'\n` +
        `  当前 sampleRate = ${this._sampleRate} Hz\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 125+ / Edge 125+ —— ship\n` +
        `  Safari / Firefox —— 开发中\n` +
        `  jsdom —— 不实现`;
    } catch (err) {
      return `读取 PressureObserver 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setObserveSource(source) {
    this._observeSource = source;
    this.setState({ observerInfo: this._readObserverInfo() });
    this._addLog('info', `切换观察 source → ${source}`);
  }

  _setSampleRate(rate) {
    this._sampleRate = rate;
    this.setState({ observerInfo: this._readObserverInfo() });
    this._addLog('info', `切换 sampleRate → ${rate} Hz`);
  }

  _runObserverDemo() {
    const f = this._flags();
    if (!f.pressureObserver) {
      this._addLog('warn', `PressureObserver 不可用（jsdom 不实现），无法创建真实观察者；已输出代码示例`);
      this.setState({ observerInfo: this._readObserverInfo() });
      return;
    }
    // 真实浏览器：创建观察者并尝试 observe
    try {
      const observer = new PressureObserver((records) => {
        for (const r of records) {
          this._addLog('info', `PressureObserver 回调：source=${r.source} state=${r.state} time=${r.time}`);
        }
      });
      observer.observe(this._observeSource, { sampleRate: this._sampleRate });
      this._pressureObservers.push(observer);
      this._addLog('info', `PressureObserver 已创建并 observe('${this._observeSource}', { sampleRate: ${this._sampleRate} })`);
    } catch (err) {
      this._addLog('warn', `PressureObserver 创建/observe 失败：${err.name} - ${err.message}`);
    }
    this.setState({ observerInfo: this._readObserverInfo() });
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. PressureObserver —— observe / unobserve / disconnect / takeRecords',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PressureObserver', f.pressureObserver],
          ['observe', f.observeMethod],
        ]),
        h(Tag, { color: 'primary' }, '异步回调'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PressureObserver 通过 new PressureObserver(callback) 构造，callback 在状态变化时异步触发（非轮询）。observe(\'cpu\', { sampleRate }) 开始观察指定 source（sampleRate 限制回调频率上限，防指纹）。unobserve(source) 停止单个 source，disconnect() 全部断开（卸载时必须调用）。takeRecords() 同步取出待处理记录。回调签名 (records: PressureRecord[], observer)，状态升级/降级均触发。sampleRate 默认约 1Hz，过高耗电。Chrome 125+ ship。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行观察者演示', { type: 'primary', size: 'sm', onClick: () => this._runObserverDemo() }),
          this._btn('cpu', { size: 'sm', onClick: () => this._setObserveSource('cpu') }),
          this._btn('thermal', { size: 'sm', onClick: () => this._setObserveSource('thermal') }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' },
          h('span', { class: 'fs-sm text-secondary' }, 'sampleRate：'),
          this._btn('0.5 Hz', { size: 'sm', onClick: () => this._setSampleRate(0.5) }),
          this._btn('1 Hz', { size: 'sm', onClick: () => this._setSampleRate(1.0) }),
          this._btn('2 Hz', { size: 'sm', onClick: () => this._setSampleRate(2.0) }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' },
          '当前 source：' + this._observeSource + ' / sampleRate：' + this._sampleRate + ' Hz'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.observerInfo || '（点击「运行观察者演示」创建 PressureObserver 并查看代码）')),
        h(Alert, {
          type: 'info',
          message: 'callback 是异步触发（状态变化时），非轮询；sampleRate 限制频率上限',
          description: 'PressureObserver.callback 在状态转换时触发（升级/降级均触发），非定时轮询。sampleRate 限制回调频率上限（防高频探测指纹），默认约 1Hz。records 可能含多条（状态快速变化时累积）。组件卸载必须 disconnect() 释放，避免泄漏。takeRecords() 同步取出待处理记录。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：压力源 source ===================

  _readSourceInfo() {
    const f = this._flags();
    try {
      return `===== 压力源 source =====\n` +
        `\n` +
        `【source 取值】\n` +
        `  'cpu'          —— CPU 压力（当前唯一广泛支持）\n` +
        `  'thermal'      —— 热量压力（提案中，部分浏览器 Origin Trial）\n` +
        `  'power-supply' —— 电源压力（提案中，电池状态相关）\n` +
        `\n` +
        `【'cpu' CPU 压力源】\n` +
        `  当前唯一广泛支持的 source（Chrome 125+ ship）\n` +
        `  反映系统整体 CPU 负载（含其他进程）\n` +
        `  不区分单核/多核，仅整体压力\n` +
        `  状态映射（近似）：\n` +
        `    nominal  —— CPU 占用 < 50%（系统空闲）\n` +
        `    fair     —— CPU 占用 50-75%（轻度负载）\n` +
        `    serious  —— CPU 占用 75-90%（重度负载）\n` +
        `    critical —— CPU 占用 > 90%（饱和，可能掉帧）\n` +
        `  注意：阈值由浏览器/系统决定，非规范固定数值\n` +
        `\n` +
        `【'thermal' 热量压力源】\n` +
        `  提案中（Compute Pressure Level 2）\n` +
        `  反映设备温度（移动端/笔记本散热受限场景）\n` +
        `  状态映射：nominal（正常）/fair（温热）/serious（过热预警）/critical（过热保护）\n` +
        `  浏览器支持：Chrome 部分 Origin Trial，Safari/Firefox 未支持\n` +
        `\n` +
        `【'power-supply' 电源压力源】\n` +
        `  提案中（Compute Pressure Level 2）\n` +
        `  反映电源状态（电池电量/充电状态）\n` +
        `  状态映射：nominal（充电/电量充足）/fair（电量中等）/serious（低电量）/critical（极低电量）\n` +
        `  与 Battery Status API 区别：Pressure 是离散状态，Battery API 暴露精确数值\n` +
        `  浏览器支持：均未 ship\n` +
        `\n` +
        `【浏览器支持矩阵】\n` +
        `  source         | Chrome | Edge | Safari | Firefox | jsdom\n` +
        `  ---------------|--------|------|--------|---------|------\n` +
        `  cpu            | 125+ ✓ | 125+ | 开发中 | 开发中  | ✗\n` +
        `  thermal        | OT     | OT   | ✗      | ✗       | ✗\n` +
        `  power-supply   | ✗      | ✗    | ✗      | ✗       | ✗\n` +
        `\n` +
        `【能力检测：source 可用性】\n` +
        `  // 通过 try observe 检测（source 不支持抛 NotSupportedError）\n` +
        `  async function isSourceSupported(source) {\n` +
        `    try {\n` +
        `      const obs = new PressureObserver(() => {});\n` +
        `      await obs.observe(source, { sampleRate: 1 });\n` +
        `      obs.disconnect();\n` +
        `      return true;\n` +
        `    } catch { return false; }\n` +
        `  }\n` +
        `  isSourceSupported('cpu');        // Chrome 125+ → true\n` +
        `  isSourceSupported('thermal');    // Chrome OT → true/false\n` +
        `  isSourceSupported('power-supply'); // → false\n` +
        `\n` +
        `【安全考虑：避免指纹识别】\n` +
        `  仅暴露 4 级离散状态，不暴露精确 CPU 占用率/温度/电量\n` +
        `  精确数值可指纹识别（不同设备负载特征不同）\n` +
        `  sampleRate 限制采样频率，防止高频探测\n` +
        `  需 HTTPS 安全上下文（防止中间人注入）\n` +
        `  Permissions Policy 可限制第三方 iframe 访问\n` +
        `\n` +
        `【当前查看 source】\n` +
        `  source = '${this._currentSource}'\n` +
        `  PressureObserver 可用 = ${f.pressureObserver}`;
    } catch (err) {
      return `读取 source 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setCurrentSource(source) {
    this._currentSource = source;
    this.setState({ sourceInfo: this._readSourceInfo() });
    this._addLog('info', `切换查看 source → ${source}`);
  }

  _runSourceDemo() {
    const f = this._flags();
    if (!f.pressureObserver) {
      this._addLog('warn', `PressureObserver 不可用（jsdom 不实现），无法探测 source；已输出矩阵说明`);
    } else {
      this._addLog('info', `探测 source='${this._currentSource}' 支持（真实浏览器异步验证）`);
    }
    this.setState({ sourceInfo: this._readSourceInfo() });
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const sources = [
      ['cpu', 'CPU 压力（已 ship）'],
      ['thermal', '热量压力（提案中）'],
      ['power-supply', '电源压力（提案中）'],
    ];
    const card = new Card({
      title: '3. 压力源 source —— cpu / thermal / power-supply',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['cpu source', f.pressureObserver]]),
        h(Tag, { color: 'primary' }, '3 类 source'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'source 取值：cpu（当前唯一广泛支持，Chrome 125+ ship，反映系统整体 CPU 负载，状态映射 nominal<50%/fair 50-75%/serious 75-90%/critical>90% 近似阈值）/thermal（提案中，反映设备温度，移动端散热受限场景，Chrome 部分 Origin Trial）/power-supply（提案中，电源状态，与 Battery Status API 区别为离散状态非精确数值）。浏览器支持矩阵：cpu Chrome 125+/Edge 125+ ship，thermal/power-supply 均未 ship。安全考虑：仅 4 级离散状态避免指纹识别，sampleRate 限制频率，需 HTTPS。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 source 探测', { type: 'primary', size: 'sm', onClick: () => this._runSourceDemo() }),
          ...sources.map(([src, name]) =>
            this._btn(name, { size: 'sm', onClick: () => this._setCurrentSource(src) })),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '当前查看 source：' + this._currentSource),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.sourceInfo || '（点击按钮查看 source 矩阵与能力检测代码）')),
        h(Alert, {
          type: 'info',
          message: '仅 cpu source 广泛支持，thermal/power-supply 提案中',
          description: 'source 探测通过 try observe 捕获 NotSupportedError。cpu 反映整体 CPU 负载（含其他进程），不区分单核/多核。thermal 适合移动端散热受限场景，power-supply 与 Battery Status API 区别为离散状态避免精确电量指纹。安全：4 级离散状态 + sampleRate 限制 + HTTPS + Permissions Policy。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：压力状态 state ===================

  _readStateInfo() {
    const f = this._flags();
    try {
      return `===== 压力状态 state =====\n` +
        `\n` +
        `【4 级状态】\n` +
        `  'nominal'  —— 正常（系统空闲，无压力）\n` +
        `  'fair'     —— 轻微（轻度负载，可维持当前性能）\n` +
        `  'serious'  —— 严重（重度负载，建议降级）\n` +
        `  'critical' —— 危急（饱和，必须降级避免卡顿/过热）\n` +
        `\n` +
        `【阈值含义（近似，浏览器/系统决定）】\n` +
        `  nominal  —— CPU 占用 < 50%，温度正常，电量充足\n` +
        `  fair     —— CPU 占用 50-75%，温度温热，电量中等\n` +
        `  serious  —— CPU 占用 75-90%，温度过热预警，低电量\n` +
        `  critical —— CPU 占用 > 90%，温度过热保护，极低电量\n` +
        `  注意：阈值非规范固定，由浏览器/操作系统/硬件共同决定\n` +
        `\n` +
        `【状态转换触发回调】\n` +
        `  PressureObserver.callback 仅在状态变化时触发：\n` +
        `    nominal → fair → serious → critical（升级）触发\n` +
        `    critical → serious → fair → nominal（降级）触发\n` +
        `  同状态不重复触发（如持续 serious 不重复回调）\n` +
        `  sampleRate 限制回调频率上限\n` +
        `\n` +
        `【与 CPU 占用率映射】\n` +
        `  state 是 CPU 占用率的离散量化（4 级）：\n` +
        `    nominal  ≈ 0-50%\n` +
        `    fair     ≈ 50-75%\n` +
        `    serious  ≈ 75-90%\n` +
        `    critical ≈ 90-100%\n` +
        `  但实际映射依赖：\n` +
        `    操作系统调度（Linux/Windows/macOS 负载计算不同）\n` +
        `    硬件核心数（多核系统阈值更高）\n` +
        `    热量/电源状态（即使 CPU 占用低，过热也可能升级）\n` +
        `\n` +
        `【当前模拟状态】\n` +
        `  state = '${this._currentState}'\n` +
        `  PressureObserver 可用 = ${f.pressureObserver}\n` +
        `\n` +
        `【状态应对建议】\n` +
        `  nominal  —— 维持最高画质/性能\n` +
        `  fair     —— 维持，但准备降级（如关闭后台任务）\n` +
        `  serious  —— 主动降级（降低分辨率/帧率/画质）\n` +
        `  critical —— 紧急降级（关闭视频/暂停非关键任务）\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  const observer = new PressureObserver((records) => {\n` +
        `    for (const r of records) {\n` +
        `      switch (r.state) {\n` +
        `        case 'nominal':  restoreQuality(); break;\n` +
        `        case 'fair':     // 维持\n` +
        `        case 'serious':  reduceResolution(); break;\n` +
        `        case 'critical': disableVideo(); break;\n` +
        `      }\n` +
        `    }\n` +
        `  });\n` +
        `  observer.observe('cpu', { sampleRate: 1 });`;
    } catch (err) {
      return `读取 state 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setCurrentState(state) {
    this._currentState = state;
    this.setState({ stateInfo: this._readStateInfo() });
    this._addLog('info', `切换模拟 state → ${state}`);
  }

  _runStateDemo() {
    const f = this._flags();
    this.setState({ stateInfo: this._readStateInfo() });
    this._addLog('info', `状态演示：模拟 state=${this._currentState}（真实浏览器由系统决定）`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const states = [
      ['nominal', '正常', 'cp-state-nominal'],
      ['fair', '轻微', 'cp-state-fair'],
      ['serious', '严重', 'cp-state-serious'],
      ['critical', '危急', 'cp-state-critical'],
    ];
    const card = new Card({
      title: '4. 压力状态 state —— nominal/fair/serious/critical',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['4 级状态', true]]),
        h(Tag, { color: 'primary' }, '离散量化'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'state 4 级：nominal（正常，CPU<50%）/fair（轻微，50-75%）/serious（严重，75-90%，建议降级）/critical（危急，>90%，必须降级）。阈值由浏览器/操作系统/硬件共同决定非规范固定。状态转换触发回调（升级/降级均触发，同状态不重复），sampleRate 限制频率。与 CPU 占用率映射为离散量化（4 级），但实际依赖 OS 调度/核心数/热量/电源。应对建议：nominal 维持/fair 准备/serious 降级/critical 紧急降级。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行状态演示', { type: 'primary', size: 'sm', onClick: () => this._runStateDemo() }),
          ...states.map(([state, name]) =>
            this._btn(name, { size: 'sm', onClick: () => this._setCurrentState(state) })),
        ),
        h('div', { class: 'cp-state-grid' },
          states.map(([state, name, cls]) =>
            h('div', { class: 'cp-state-cell ' + cls + (this._currentState === state ? ' active' : '') },
              h('div', { class: 'lvl' }, name),
              h('div', { class: 'desc' }, state),
            )),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.stateInfo || '（点击按钮切换模拟状态查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'state 是 CPU 占用率的 4 级离散量化，阈值非规范固定',
          description: 'nominal/fair/serious/critical 对应 CPU 占用近似 0-50%/50-75%/75-90%/90-100%，但实际阈值由浏览器/OS/硬件决定。状态转换触发回调（升级降级均触发），同状态不重复。应对：nominal 维持/fair 准备/serious 降级/critical 紧急降级（关闭视频/暂停任务）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：PressureRecord 结构 ===================

  _readRecordInfo() {
    const f = this._flags();
    try {
      return `===== PressureRecord 结构 =====\n` +
        `\n` +
        `【属性】\n` +
        `  record.source    —— 压力源（'cpu' | 'thermal' | 'power-supply'）\n` +
        `  record.state     —— 压力状态（'nominal' | 'fair' | 'serious' | 'critical'）\n` +
        `  record.time      —— 时间戳（DOMHighResTimeStamp，毫秒，相对 performance.timeOrigin）\n` +
        `  record.toJSON()  —— 序列化为 { source, state, time }\n` +
        `\n` +
        `【time 时间戳】\n` +
        `  record.time 是 DOMHighResTimeStamp（毫秒，double）\n` +
        `  相对 performance.timeOrigin（页面导航起点）\n` +
        `  与 performance.now() 同源，可用于计算压力持续时长\n` +
        `  示例：record.time = 12345.678 表示页面加载后约 12.3 秒\n` +
        `\n` +
        `【toJSON 序列化】\n` +
        `  const json = record.toJSON();\n` +
        `  // { source: 'cpu', state: 'serious', time: 12345.678 }\n` +
        `  JSON.stringify(record);  // 调用 toJSON\n` +
        `\n` +
        `【历史记录与平均】\n` +
        `  PressureObserver 不维护历史，需手动累积：\n` +
        `  const history = [];\n` +
        `  const observer = new PressureObserver((records) => {\n` +
        `    for (const r of records) {\n` +
        `      history.push({ source: r.source, state: r.state, time: r.time });\n` +
        `    }\n` +
        `  });\n` +
        `  // 计算压力分布\n` +
        `  const stats = history.reduce((acc, r) => {\n` +
        `    acc[r.state] = (acc[r.state] || 0) + 1;\n` +
        `    return acc;\n` +
        `  }, {});\n` +
        `  // { nominal: 80, fair: 15, serious: 4, critical: 1 }\n` +
        `\n` +
        `【sampleRate 采样频率】\n` +
        `  observe(source, { sampleRate }) 的 sampleRate：\n` +
        `    单位 Hz（每秒回调次数上限）\n` +
        `    sampleRate: 1.0 —— 每秒最多 1 次回调\n` +
        `    sampleRate: 0.5 —— 每 2 秒最多 1 次\n` +
        `    sampleRate: 5.0 —— 每秒最多 5 次（高频，耗电）\n` +
        `  注意：sampleRate 是上限，实际回调仅在状态变化时触发\n` +
        `    持续 nominal 不会每秒回调（除非状态变化）\n` +
        `  高 sampleRate 耗电 + 指纹风险，建议 ≤ 1Hz\n` +
        `\n` +
        `【takeRecords 立即获取】\n` +
        `  const pending = observer.takeRecords();\n` +
        `  // 同步取出待处理 PressureRecord[]，清空队列\n` +
        `  // 适合在 disconnect 前最后一次获取\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  const history = [];\n` +
        `  const observer = new PressureObserver((records, obs) => {\n` +
        `    const now = performance.now();\n` +
        `    for (const r of records) {\n` +
        `      history.push(r.toJSON());\n` +
        `      console.log('[' + (r.time / 1000).toFixed(1) + 's] ' +\n` +
        `        r.source + ' → ' + r.state);\n` +
        `    }\n` +
        `  });\n` +
        `  observer.observe('cpu', { sampleRate: 1.0 });\n` +
        `\n` +
        `  // 5 秒后输出统计\n` +
        `  setTimeout(() => {\n` +
        `    const stats = history.reduce((a, r) => {\n` +
        `      a[r.state] = (a[r.state] || 0) + 1;\n` +
        `      return a;\n` +
        `    }, {});\n` +
        `    console.log('压力分布：', stats);\n` +
        `    observer.disconnect();\n` +
        `  }, 5000);\n` +
        `\n` +
        `【能力检测】\n` +
        `  PressureRecord 可用 = ${f.pressureRecord}\n` +
        `  PressureObserver 可用 = ${f.pressureObserver}`;
    } catch (err) {
      return `读取 PressureRecord 信息失败：${err.name} - ${err.message}`;
    }
  }

  _runRecordDemo() {
    const f = this._flags();
    if (!f.pressureRecord) {
      this._addLog('warn', `PressureRecord 不可用（jsdom 不实现），无法展示真实记录；已输出结构说明`);
    } else {
      this._addLog('info', `PressureRecord 可用（属性：source/state/time/toJSON）`);
    }
    this.setState({ recordInfo: this._readRecordInfo() });
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. PressureRecord —— source / state / time / toJSON',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['PressureRecord', f.pressureRecord]]),
        h(Tag, { color: 'primary' }, 'DOMHighResTimeStamp'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PressureRecord 属性：source（压力源 cpu/thermal/power-supply）、state（4 级状态）、time（DOMHighResTimeStamp 毫秒，相对 performance.timeOrigin，与 performance.now() 同源）、toJSON() 序列化为 { source, state, time }。PressureObserver 不维护历史需手动累积（push r.toJSON()）。sampleRate 是回调频率上限（Hz），实际仅在状态变化时触发（持续 nominal 不重复回调）。takeRecords() 同步取出清空队列，适合 disconnect 前最后获取。高 sampleRate 耗电 + 指纹风险，建议 ≤ 1Hz。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Record 演示', { type: 'primary', size: 'sm', onClick: () => this._runRecordDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.recordInfo || '（点击按钮查看 PressureRecord 结构与历史累积代码）')),
        h(Alert, {
          type: 'info',
          message: 'PressureObserver 不维护历史，需手动累积 toJSON()；sampleRate 是上限非轮询',
          description: 'record.time 是 DOMHighResTimeStamp（毫秒，相对 performance.timeOrigin）。sampleRate 是回调频率上限，实际仅在状态变化时触发（持续 nominal 不重复回调）。takeRecords() 同步取出清空队列。建议 sampleRate ≤ 1Hz 平衡实时性与耗电。历史累积用 reduce 统计状态分布。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：实战：视频会议自适应降级 ===================

  _readVideoConfInfo() {
    const f = this._flags();
    try {
      return `===== 实战：视频会议自适应降级 =====\n` +
        `\n` +
        `【降级策略】\n` +
        `  critical → 关闭视频（仅音频，最低功耗）\n` +
        `  serious  → 降低分辨率（1280x720 → 640x360）\n` +
        `  fair     → 降低帧率（30fps → 15fps）\n` +
        `  nominal  → 恢复原始设置（1280x720 @ 30fps）\n` +
        `\n` +
        `【与 MediaStreamTrack.applyConstraints 协同】\n` +
        `  MediaStreamTrack.applyConstraints() 动态调整摄像头采集参数：\n` +
        `    await track.applyConstraints({\n` +
        `      width: { ideal: 640 },\n` +
        `      height: { ideal: 360 },\n` +
        `      frameRate: { ideal: 15 },\n` +
        `    });\n` +
        `  无需重新 getUserMedia，热切换分辨率/帧率\n` +
        `\n` +
        `【完整代码】\n` +
        `  // 1. 获取摄像头\n` +
        `  const stream = await navigator.mediaDevices.getUserMedia({\n` +
        `    video: { width: 1280, height: 720, frameRate: 30 },\n` +
        `    audio: true,\n` +
        `  });\n` +
        `  const videoTrack = stream.getVideoTracks()[0];\n` +
        `\n` +
        `  // 2. 配置降级策略\n` +
        `  const policies = {\n` +
        `    nominal:  { width: 1280, height: 720, frameRate: 30 },\n` +
        `    fair:     { width: 1280, height: 720, frameRate: 15 },\n` +
        `    serious:  { width: 640,  height: 360, frameRate: 15 },\n` +
        `    critical: null,  // 关闭视频\n` +
        `  };\n` +
        `\n` +
        `  // 3. 监听压力并降级\n` +
        `  const observer = new PressureObserver(async (records) => {\n` +
        `    for (const r of records) {\n` +
        `      const policy = policies[r.state];\n` +
        `      if (policy === null) {\n` +
        `        videoTrack.stop();  // critical 关闭视频\n` +
        `        console.log('压力危急，关闭视频');\n` +
        `      } else {\n` +
        `        await videoTrack.applyConstraints({\n` +
        `          width: { ideal: policy.width },\n` +
        `          height: { ideal: policy.height },\n` +
        `          frameRate: { ideal: policy.frameRate },\n` +
        `        });\n` +
        `        console.log('压力' + r.state + '，调整为 ' +\n` +
        `          policy.width + 'x' + policy.height + '@' + policy.frameRate);\n` +
        `      }\n` +
        `    }\n` +
        `  });\n` +
        `  observer.observe('cpu', { sampleRate: 1 });\n` +
        `\n` +
        `【当前策略】\n` +
        `  policy = '${this._videoPolicy}'\n` +
        `\n` +
        `【策略表】\n` +
        `  state      | 分辨率       | 帧率  | 动作\n` +
        `  -----------|--------------|-------|----------\n` +
        `  nominal    | 1280x720     | 30fps | 恢复\n` +
        `  fair       | 1280x720     | 15fps | 降帧率\n` +
        `  serious    | 640x360      | 15fps | 降分辨率\n` +
        `  critical   | 关闭视频     | -     | 仅音频\n` +
        `\n` +
        `【WebRTC 协同】\n` +
        `  RTCRtpSender.setParameters() 调整编码参数：\n` +
        `    const sender = pc.getSenders().find(s => s.track.kind === 'video');\n` +
        `    const params = sender.getParameters();\n` +
        `    params.encodings[0].maxBitrate = 500_000;  // 降码率\n` +
        `    params.encodings[0].maxFramerate = 15;\n` +
        `    await sender.setParameters(params);\n` +
        `\n` +
        `【能力检测】\n` +
        `  PressureObserver = ${f.pressureObserver}\n` +
        `  MediaStreamTrack.applyConstraints = ${typeof MediaStreamTrack !== 'undefined' && typeof MediaStreamTrack.prototype.applyConstraints === 'function'}`;
    } catch (err) {
      return `读取视频会议降级信息失败：${err.name} - ${err.message}`;
    }
  }

  _setVideoPolicy(policy) {
    this._videoPolicy = policy;
    this.setState({ videoConfInfo: this._readVideoConfInfo() });
    this._addLog('info', `切换视频降级策略 → ${policy}`);
  }

  _runVideoConfDemo() {
    const f = this._flags();
    if (!f.pressureObserver) {
      this._addLog('warn', `PressureObserver 不可用（jsdom 不实现），无法运行真实降级；已输出完整策略代码`);
    } else {
      this._addLog('info', `视频会议降级演示就绪（policy=${this._videoPolicy}，真实浏览器可运行）`);
    }
    this.setState({ videoConfInfo: this._readVideoConfInfo() });
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 实战 —— 视频会议自适应降级（applyConstraints 协同）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['PressureObserver', f.pressureObserver]]),
        h(Tag, { color: 'primary' }, 'MediaStreamTrack'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '视频会议自适应降级：critical 关闭视频（仅音频，最低功耗）/serious 降低分辨率（1280x720→640x360）/fair 降低帧率（30fps→15fps）/nominal 恢复。与 MediaStreamTrack.applyConstraints() 协同热切换采集参数（无需重新 getUserMedia）。WebRTC 协同用 RTCRtpSender.setParameters() 调整 maxBitrate/maxFramerate。PressureObserver 监听 cpu source 触发降级策略。降级表：nominal 1280x720@30/fair 1280x720@15/serious 640x360@15/critical 关闭视频。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行视频降级演示', { type: 'primary', size: 'sm', onClick: () => this._runVideoConfDemo() }),
          this._btn('nominal 策略', { size: 'sm', onClick: () => this._setVideoPolicy('nominal') }),
          this._btn('serious 策略', { size: 'sm', onClick: () => this._setVideoPolicy('serious') }),
          this._btn('critical 策略', { size: 'sm', onClick: () => this._setVideoPolicy('critical') }),
        ),
        h('table', { class: 'cp-policy-table' },
          h('thead', {},
            h('tr', {}, h('th', {}, 'state'), h('th', {}, '分辨率'), h('th', {}, '帧率'), h('th', {}, '动作')),
          ),
          h('tbody', {},
            h('tr', {}, h('td', { class: 'state-nominal' }, 'nominal'), h('td', {}, '1280x720'), h('td', {}, '30fps'), h('td', {}, '恢复')),
            h('tr', {}, h('td', { class: 'state-fair' }, 'fair'), h('td', {}, '1280x720'), h('td', {}, '15fps'), h('td', {}, '降帧率')),
            h('tr', {}, h('td', { class: 'state-serious' }, 'serious'), h('td', {}, '640x360'), h('td', {}, '15fps'), h('td', {}, '降分辨率')),
            h('tr', {}, h('td', { class: 'state-critical' }, 'critical'), h('td', {}, '关闭视频'), h('td', {}, '-'), h('td', {}, '仅音频')),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.videoConfInfo || '（点击按钮查看视频会议降级完整代码）')),
        h(Alert, {
          type: 'info',
          message: 'applyConstraints 热切换分辨率/帧率，无需重新 getUserMedia',
          description: 'MediaStreamTrack.applyConstraints({ width: {ideal}, height: {ideal}, frameRate: {ideal} }) 热切换采集参数，避免重新 getUserMedia 的中断。WebRTC 用 RTCRtpSender.setParameters() 调整编码 maxBitrate/maxFramerate。降级链：critical 关闭视频 → serious 降分辨率 → fair 降帧率 → nominal 恢复。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：实战：游戏画质自适应 ===================

  _readGameAdaptInfo() {
    const f = this._flags();
    try {
      return `===== 实战：游戏画质自适应 =====\n` +
        `\n` +
        `【降级策略】\n` +
        `  CPU 压力升高时降低：\n` +
        `    粒子数（1000 → 500 → 200 → 100）\n` +
        `    视距（draw distance 2000 → 1000 → 500）\n` +
        `    阴影质量（高 → 中 → 低 → 关闭）\n` +
        `    后处理特效（开启 → 部分关闭 → 全关）\n` +
        `    渲染分辨率（1.0 → 0.85 → 0.7 → 0.5）\n` +
        `\n` +
        `【与 requestAnimationFrame 配合】\n` +
        `  PressureObserver 异步回调设置目标画质，rAF 循环读取应用：\n` +
        `    let targetQuality = 'high';\n` +
        `    const observer = new PressureObserver((records) => {\n` +
        `      for (const r of records) {\n` +
        `        targetQuality = {\n` +
        `          nominal: 'high', fair: 'medium',\n` +
        `          serious: 'low', critical: 'lowest',\n` +
        `        }[r.state];\n` +
        `      }\n` +
        `    });\n` +
        `    observer.observe('cpu', { sampleRate: 1 });\n` +
        `\n` +
        `    function loop() {\n` +
        `      render(targetQuality);  // 每帧读取目标画质\n` +
        `      requestAnimationFrame(loop);\n` +
        `    }\n` +
        `    loop();\n` +
        `\n` +
        `【WebGPU 性能监控】\n` +
        `  WebGPU 无直接压力 API，但可通过以下方式间接监控：\n` +
        `    // 1. GPU 适配器信息\n` +
        `    const adapter = await navigator.gpu.requestAdapter();\n` +
        `    // 2. 帧时间统计\n` +
        `    let lastTime = performance.now();\n` +
        `    function loop() {\n` +
        `      const now = performance.now();\n` +
        `      const frameTime = now - lastTime;\n` +
        `      if (frameTime > 33) {  // < 30fps\n` +
        `        // GPU 可能压力高，降级\n` +
        `      }\n` +
        `      lastTime = now;\n` +
        `      requestAnimationFrame(loop);\n` +
        `    }\n` +
        `  WebGPU + Compute Pressure 协同：\n` +
        `    CPU 压力高（编码/物理/AI）→ 降 CPU 任务\n` +
        `    GPU 帧时间长 → 降渲染负载（分辨率/特效）\n` +
        `\n` +
        `【长任务降级】\n` +
        `  PerformanceObserver 监听 longtask（>50ms）补充 Compute Pressure：\n` +
        `    const perfObs = new PerformanceObserver((list) => {\n` +
        `      for (const entry of list.getEntries()) {\n` +
        `        if (entry.duration > 100) {\n` +
        `          // 长任务 > 100ms，主动降级\n` +
        `        }\n` +
        `      }\n` +
        `    });\n` +
        `    perfObs.observe({ entryTypes: ['longtask'] });\n` +
        `\n` +
        `【当前画质】\n` +
        `  quality = '${this._gameQuality}'\n` +
        `\n` +
        `【画质参数表】\n` +
        `  quality   | 粒子数 | 视距  | 阴影 | 后处理 | 渲染分辨率\n` +
        `  ----------|--------|-------|------|--------|-----------\n` +
        `  ultra     | 1000   | 2000  | 高   | 全开   | 1.0\n` +
        `  high      | 800    | 1500  | 高   | 全开   | 1.0\n` +
        `  medium    | 500    | 1000  | 中   | 部分   | 0.85\n` +
        `  low       | 200    | 500   | 低   | 关闭   | 0.7\n` +
        `  lowest    | 100    | 300   | 关   | 关闭   | 0.5\n` +
        `\n` +
        `【能力检测】\n` +
        `  PressureObserver = ${f.pressureObserver}\n` +
        `  requestAnimationFrame = ${typeof requestAnimationFrame === 'function'}\n` +
        `  WebGPU = ${typeof navigator !== 'undefined' && typeof navigator.gpu !== 'undefined'}`;
    } catch (err) {
      return `读取游戏画质自适应信息失败：${err.name} - ${err.message}`;
    }
  }

  _setGameQuality(quality) {
    this._gameQuality = quality;
    this.setState({ gameAdaptInfo: this._readGameAdaptInfo() });
    this._addLog('info', `切换游戏画质 → ${quality}`);
  }

  _runGameAdaptDemo() {
    const f = this._flags();
    if (!f.pressureObserver) {
      this._addLog('warn', `PressureObserver 不可用（jsdom 不实现），无法运行真实画质自适应；已输出完整代码`);
    } else {
      this._addLog('info', `游戏画质自适应演示就绪（quality=${this._gameQuality}）`);
    }
    this.setState({ gameAdaptInfo: this._readGameAdaptInfo() });
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const qualities = [
      ['ultra', '极高', 'cp-quality-ultra'],
      ['high', '高', 'cp-quality-high'],
      ['medium', '中', 'cp-quality-medium'],
      ['low', '低', 'cp-quality-low'],
    ];
    const card = new Card({
      title: '7. 实战 —— 游戏画质自适应（rAF + WebGPU 协同）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['PressureObserver', f.pressureObserver]]),
        h(Tag, { color: 'primary' }, '5 级画质'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '游戏画质自适应：CPU 压力升高时降低粒子数（1000→100）/视距（2000→300）/阴影（高→关）/后处理（全开→全关）/渲染分辨率（1.0→0.5）。与 requestAnimationFrame 配合：PressureObserver 异步设置 targetQuality，rAF 循环每帧读取应用。WebGPU 性能监控：无直接压力 API，通过帧时间统计（>33ms 即 <30fps）间接判断 GPU 压力，与 CPU 压力协同（CPU 降 AI/物理，GPU 降渲染）。长任务降级用 PerformanceObserver longtask 补充。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行游戏自适应演示', { type: 'primary', size: 'sm', onClick: () => this._runGameAdaptDemo() }),
          ...qualities.map(([q, name]) =>
            this._btn(name, { size: 'sm', onClick: () => this._setGameQuality(q) })),
        ),
        h('div', { class: 'cp-quality-bar' },
          qualities.map(([q, name, cls]) =>
            h('div', { class: 'seg ' + cls + (this._gameQuality === q ? '' : ' inactive') }, name)),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.gameAdaptInfo || '（点击按钮查看游戏画质自适应完整代码）')),
        h(Alert, {
          type: 'info',
          message: 'PressureObserver 设置目标画质，rAF 循环每帧应用',
          description: '异步回调设置 targetQuality，rAF 循环读取应用，避免在 PressureObserver 回调中直接渲染（回调频率与帧率不同步）。WebGPU 通过帧时间统计间接监控 GPU 压力。PerformanceObserver longtask 补充 Compute Pressure（长任务 >100ms 主动降级）。CPU 压力降 AI/物理，GPU 帧时间长降渲染负载。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 8：陷阱与最佳实践 ===================

  _readPitfallsInfo() {
    const f = this._flags();
    try {
      return `===== Compute Pressure 陷阱与最佳实践 =====\n` +
        `\n` +
        `【陷阱 1：观察者去重】\n` +
        `  多次 observe 同一 source 不会创建多个观察者：\n` +
        `    observer.observe('cpu', { sampleRate: 1 });\n` +
        `    observer.observe('cpu', { sampleRate: 2 });  // 覆盖前一次\n` +
        `  但多个 PressureObserver 实例可同时观察同一 source：\n` +
        `    const obs1 = new PressureObserver(cb1);\n` +
        `    const obs2 = new PressureObserver(cb2);\n` +
        `    obs1.observe('cpu'); obs2.observe('cpu');  // 两个回调都会触发\n` +
        `  建议：单例模式，全局一个 observer 集中处理\n` +
        `\n` +
        `【陷阱 2：样本频率权衡】\n` +
        `  sampleRate 高频（>5Hz）问题：\n` +
        `    ✓ 更快响应压力变化\n` +
        `    ✗ 耗电（频繁唤醒）\n` +
        `    ✗ 指纹风险（高频探测系统特征）\n` +
        `    ✗ 浏览器可能限制（强制降低）\n` +
        `  建议：\n` +
        `    实时性要求高（游戏）：1-2Hz\n` +
        `    一般场景（视频会议）：0.5-1Hz\n` +
        `    后台监控：0.1-0.5Hz\n` +
        `\n` +
        `【陷阱 3：用户隐私（不暴露精确数值）】\n` +
        `  Compute Pressure 仅暴露 4 级离散状态，设计上避免指纹：\n` +
        `    精确 CPU 占用率（如 73.2%）可指纹识别\n` +
        `    4 级状态（nominal/fair/serious/critical）指纹信息有限\n` +
        `  但仍需注意：\n` +
        `    ✓ 不要记录/上传精确 time 序列（可推断负载模式）\n` +
        `    ✓ 不要结合其他 API 推断精确数值\n` +
        `    ✓ 第三方 iframe 需 Permissions Policy 授权\n` +
        `    ✓ 需 HTTPS 安全上下文\n` +
        `\n` +
        `【陷阱 4：与 navigator.deviceMemory 协同】\n` +
        `  navigator.deviceMemory 暴露设备内存（GB，离散值 0.25/0.5/1/2/4/8）：\n` +
        `    if (navigator.deviceMemory < 4) {\n` +
        `      // 低内存设备，初始就用低画质\n` +
        `      initialQuality = 'low';\n` +
        `    }\n` +
        `  与 Compute Pressure 区别：\n` +
        `    deviceMemory —— 静态能力信息（设备硬件）\n` +
        `    Compute Pressure —— 动态负载信息（实时压力）\n` +
        `  协同：deviceMemory 决定初始画质基线，Pressure 动态调整\n` +
        `\n` +
        `【陷阱 5：与 Scheduler API 互补】\n` +
        `  Scheduler API（scheduler.postTask / scheduler.yield）控制任务调度：\n` +
        `    // 压力高时让出主线程\n` +
        `    if (pressureState === 'serious') {\n` +
        `      await scheduler.yield();  // 让出给更高优先级任务\n` +
        `    }\n` +
        `  Compute Pressure 决定「是否降级」，Scheduler API 决定「如何让出」\n` +
        `  互补：Pressure 触发降级策略，Scheduler 执行让出\n` +
        `\n` +
        `【陷阱 6：feature detection】\n` +
        `  正确检测方式：\n` +
        `    // 1. 全局存在性\n` +
        `    if ('PressureObserver' in window) { ... }\n` +
        `    // 2. 构造函数可调用\n` +
        `    if (typeof PressureObserver === 'function') { ... }\n` +
        `    // 3. observe 方法存在\n` +
        `    try {\n` +
        `      const obs = new PressureObserver(() => {});\n` +
        `      if (typeof obs.observe === 'function') { ... }\n` +
        `    } catch { /* 不支持 */ }\n` +
        `    // 4. source 可用性（observe 不抛 NotSupportedError）\n` +
        `    try {\n` +
        `      await obs.observe('cpu', { sampleRate: 1 });\n` +
        `    } catch (e) {\n` +
        `      if (e.name === 'NotSupportedError') { /* source 不支持 */ }\n` +
        `    }\n` +
        `\n` +
        `【陷阱 7：降级到 LongTask API】\n` +
        `  不支持 Compute Pressure 的浏览器降级到 LongTask API：\n` +
        `    if ('PressureObserver' in window) {\n` +
        `      // 用 Compute Pressure\n` +
        `      const obs = new PressureObserver(cb);\n` +
        `      obs.observe('cpu', { sampleRate: 1 });\n` +
        `    } else if ('PerformanceObserver' in window) {\n` +
        `      // 降级到 LongTask\n` +
        `      const perfObs = new PerformanceObserver((list) => {\n` +
        `        for (const entry of list.getEntries()) {\n` +
        `          if (entry.duration > 100) {\n` +
        `            // 长任务 > 100ms，触发降级\n` +
        `          }\n` +
        `        }\n` +
        `      });\n` +
        `      perfObs.observe({ entryTypes: ['longtask'] });\n` +
        `    }\n` +
        `\n` +
        `【最佳实践清单】\n` +
        `  ✓ 单例 observer 集中处理（避免多实例重复回调）\n` +
        `  ✓ sampleRate ≤ 1Hz（平衡实时性与耗电）\n` +
        `  ✓ 不记录/上传精确 time 序列（隐私）\n` +
        `  ✓ 需 HTTPS + Permissions Policy（第三方 iframe）\n` +
        `  ✓ 组件卸载时 disconnect() 释放\n` +
        `  ✓ feature detection 4 步（全局/构造/方法/source）\n` +
        `  ✓ 降级到 LongTask API（PerformanceObserver longtask）\n` +
        `  ✓ 与 navigator.deviceMemory 协同（静态基线 + 动态调整）\n` +
        `  ✓ 与 Scheduler API 互补（Pressure 决定降级，Scheduler 让出）\n` +
        `  ✓ 异步回调设置目标，rAF 循环应用（避免回调中渲染）\n` +
        `\n` +
        `【能力检测】\n` +
        `  PressureObserver = ${f.pressureObserver}\n` +
        `  PressureRecord = ${f.pressureRecord}\n` +
        `  observe 方法 = ${f.observeMethod}\n` +
        `  in window = ${f.inWindow}`;
    } catch (err) {
      return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPitfallsDemo() {
    const f = this._flags();
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    this._addLog('info', `陷阱与最佳实践演示：PressureObserver=${f.pressureObserver}, inWindow=${f.inWindow}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— 去重/频率/隐私/deviceMemory/Scheduler/降级',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PressureObserver', f.pressureObserver],
          ['in window', f.inWindow],
        ]),
        h(Tag, { color: 'warning' }, '7 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '七大陷阱：观察者去重（单 observer 多次 observe 同 source 覆盖，多实例可并存建议单例）；样本频率权衡（>5Hz 耗电+指纹风险，建议 ≤1Hz）；用户隐私（仅 4 级离散状态避免指纹，不记录精确 time 序列，需 HTTPS + Permissions Policy）；与 navigator.deviceMemory 协同（静态内存基线 + 动态压力调整）；与 Scheduler API 互补（Pressure 决定降级，scheduler.yield 让出）；feature detection 4 步（全局/构造/方法/source）；降级到 LongTask API（PerformanceObserver longtask >100ms）。最佳实践 10 条覆盖单例/频率/隐私/释放/检测/降级/协同。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 7 大陷阱与 10 条最佳实践）')),
        h(Alert, {
          type: 'warning',
          message: 'sampleRate ≤ 1Hz；组件卸载必须 disconnect；降级到 LongTask API',
          description: '陷阱清单：观察者去重（单例）；样本频率权衡（≤1Hz 省电防指纹）；用户隐私（不记录精确 time）；deviceMemory 协同（静态基线）；Scheduler API 互补（Pressure 降级 + yield 让出）；feature detection 4 步；降级 LongTask API（longtask >100ms 触发降级）。最佳实践：单例 observer + ≤1Hz + HTTPS + disconnect + 4 步检测 + LongTask 降级 + deviceMemory/Scheduler 协同。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  // =================== 渲染入口 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page compute-pressure-api-page' },
      h('h2', { class: 'section-title' }, 'Compute Pressure API 完整实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 W3C Compute Pressure API 系统压力感知：PressureObserver 基础（observe/unobserve/disconnect/takeRecords）、压力源 source（cpu/thermal/power-supply）、压力状态 state（nominal/fair/serious/critical 4 级）、PressureRecord 结构（source/state/time/toJSON）、视频会议自适应降级（applyConstraints 协同）、游戏画质自适应（rAF + WebGPU 协同）、陷阱与最佳实践（去重/频率/隐私/deviceMemory/Scheduler/LongTask 降级）。所有特性通过 typeof 能力检测，不可用时仅记日志，绝不抛异常。jsdom 不实现该 API，真实浏览器（Chrome 125+）可运行实际压力监听。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard7(),
      this._renderCard8(),
      this._renderLogPanel(),
    );
  }
}
