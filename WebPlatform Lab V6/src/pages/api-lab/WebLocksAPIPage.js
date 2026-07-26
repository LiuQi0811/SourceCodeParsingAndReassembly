// =====================================================================
// WebLocksAPIPage.js —— Web Locks API 实验室
// 演示 MDN：
//   1. LockManager.request 基本用法 —— navigator.locks.request(name, callback) → Promise；
//      callback 接收 Lock 对象 { name, mode }；callback 返回的 Promise resolve 后锁释放；
//      锁名跨 origin 内全局唯一；同名锁请求排队（FIFO）。
//   2. mode exclusive / shared —— 默认 exclusive（排他锁，同名同时仅 1 个持有）；
//      shared（共享锁，多个 shared 可共存，但与 exclusive 互斥）；
//      navigator.locks.request(name, { mode: 'shared' }, cb)；典型：shared 用于读、exclusive 用于写。
//   3. ifAvailable 与 steal —— { ifAvailable: true } 立即获取或失败（callback 接收 null 表示未获取，不排队）；
//      { steal: true } 抢占当前持有者（被抢占者收到 AbortSignal aborted）；
//      callback 第二参数为 AbortSignal（被 steal / 系统抢占时 aborted）。
//   4. query 状态查询 —— navigator.locks.query() → Promise<{ held, pending }>；
//      held=[{ name, clientId, mode }]，pending=[{ name, clientId, mode }]；
//      clientId 区分 tab/worker（不暴露具体页面）；用于调试锁争用、监控排队深度、决策是否 steal。
//   5. Lock 对象与 onrelease —— Lock { name, mode }；callback 内同步/异步操作；
//      锁释放触发 onrelease（若有注册）；锁不能跨 callback 边界持有（无显式 unlock）；
//      持久锁模式：callback 内保持 await pending Promise（长任务、监听器）；页面关闭锁自动释放。
//   6. 使用场景与组合 —— IndexedDB 写入串行化（避免读写竞态）、跨 tab 任务去重（ifAvailable 防重入）、
//      轮询任务协调（shared + query）、资源池管理（命名锁表示槽位）；
//      与 BroadcastChannel 对比（广播消息 vs 互斥协调）、与 SharedWorker 对比（状态管理 vs 无状态锁）、
//      与 Atomics 对比（共享内存 vs 命名锁）；限制：同源 + SecureContext + Promise 正确 resolve + 异常自动释放。
// 说明：Web Locks API 为 Chrome 69+ / Firefox 96+ / Safari 15.4+，需 SecureContext（HTTPS/localhost）；
//       jsdom 中 navigator.locks 不可用，所有调用前做能力检测，不可用仅记日志，绝不抛异常。
//       所有演示通过模拟锁状态展示（_simLocks Map 维护锁名 → 模拟 Lock 对象 + 引用计数）。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class WebLocksAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      requestInfo: '',      // Card 1：LockManager.request 基本用法
      modeInfo: '',         // Card 2：mode exclusive / shared
      stealInfo: '',        // Card 3：ifAvailable 与 steal
      queryInfo: '',        // Card 4：query 状态查询
      lockObjInfo: '',      // Card 5：Lock 对象与 onrelease
      scenarioInfo: '',     // Card 6：使用场景与组合
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._simLocks = new Map();        // 模拟锁表：name → { mode, holders:Set<clientId>, queue:[{clientId,mode,resolve}] }
    this._simClientId = 'tab-' + Math.random().toString(36).slice(2, 8);
    this._simClientSeq = 0;            // 模拟 clientId 序号
    this._pendingLocks = new Map();    // Card 5 持久锁：name → { resolve, signalController }

    // 一次性能力检测：Web Locks API 全家桶
    const caps = this._caps();
    const parts = [
      `navigator.locks ${caps.locks ? '✓' : '✗'}`,
      `request ${caps.request ? '✓' : '✗'}`,
      `query ${caps.query ? '✓' : '✗'}`,
      `Lock.mode ${caps.lockMode ? '✓' : '✗'}`,
      `AbortSignal ${caps.abortSignal ? '✓' : '✗'}`,
    ];
    const anyAvailable = caps.locks && caps.request;
    const summary = anyAvailable
      ? `Web Locks API 能力检测：${parts.join(' · ')}。当前环境支持 navigator.locks，可真实执行 request/query；ifAvailable/steal/shared 模式均可演示。`
      : '当前环境不支持 Web Locks API（navigator.locks 不可用）；所有按钮点击将仅记日志说明并通过模拟锁表展示状态，不会抛异常。在真实浏览器（Chrome 69+ / SecureContext）中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.locks) this._addLog('warn', 'navigator.locks 不可用（jsdom 无此对象，需 SecureContext + Chrome 69+）');
    if (!caps.query) this._addLog('warn', 'navigator.locks.query 不可用（jsdom 无此方法）');
  }

  componentWillUnmount() {
    // 1. 释放所有模拟锁（resolve 队列中 pending 的 Promise，避免悬挂）
    for (const [name, entry] of this._simLocks || []) {
      try {
        if (entry && entry.queue) {
          for (const q of entry.queue) {
            try { if (q && typeof q.resolve === 'function') q.resolve(null); } catch { /* noop */ }
          }
        }
        if (entry && entry.signalController && typeof entry.signalController.abort === 'function') {
          entry.signalController.abort('componentWillUnmount');
        }
      } catch { /* noop */ }
    }
    this._simLocks = null;
    // 2. 释放持久锁的 pending Promise（Card 5）
    for (const [name, holder] of this._pendingLocks || []) {
      try {
        if (holder && holder.signalController && typeof holder.signalController.abort === 'function') {
          holder.signalController.abort('componentWillUnmount');
        }
        if (holder && typeof holder.resolve === 'function') holder.resolve();
      } catch { /* noop */ }
    }
    this._pendingLocks = null;
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
    const hasNav = typeof navigator !== 'undefined';
    const locks = hasNav && navigator.locks ? navigator.locks : null;
    return {
      locks: !!locks,
      request: !!(locks && typeof locks.request === 'function'),
      query: !!(locks && typeof locks.query === 'function'),
      lockMode: typeof Lock !== 'undefined' && Lock.prototype && 'mode' in Lock.prototype,
      abortSignal: typeof AbortSignal !== 'undefined' || typeof AbortController !== 'undefined',
    };
  }

  // —— 模拟锁辅助：生成 clientId ——
  _simNextClientId() {
    this._simClientSeq += 1;
    return `${this._simClientId}-${this._simClientSeq}`;
  }

  // =================== Card 1：LockManager.request 基本用法 ===================

  _showRequestCaps() {
    const caps = this._caps();
    this.setState({ requestInfo:
      '===== LockManager.request 能力检测 =====\n\n' +
      `  navigator.locks        : ${caps.locks ? 'object（可用）' : 'undefined（不可用）'}\n` +
      `  navigator.locks.request: ${caps.request ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  navigator.locks.query  : ${caps.query ? 'function（可用）' : 'undefined（不可用）'}\n\n` +
      "API 表面：navigator.locks.request(name, callback) → Promise\n" +
      "         navigator.locks.request(name, options, callback) → Promise\n" +
      '         callback(lock) → Promise|undefined（返回值 resolve 后锁释放）\n\n' +
      'Lock 对象：{ name: string, mode: "exclusive"|"shared" }\n\n' +
      '锁名作用域：跨同源 tab/worker 全局唯一（同 origin 内共享命名空间）；不同 origin 互不可见。' });
    this._addLog('compare', `LockManager 检测：locks=${caps.locks}, request=${caps.request}, query=${caps.query}`);
  }

  async _simulateRequest() {
    const caps = this._caps();
    const name = 'api-lab-lock-' + Date.now();
    if (!caps.request) {
      // 模拟：直接调用 callback，传入模拟 Lock 对象
      const simLock = { name, mode: 'exclusive' };
      this._addLog('lock', `[模拟] request('${name}', cb) → cb({ name:'${name}', mode:'exclusive' })`);
      try {
        await new Promise((resolve) => {
          // callback 同步持有锁；返回 Promise resolve 后释放
          Promise.resolve(simLock).then((lock) => {
            this._addLog('lock', `[模拟] callback 持有锁 ${lock.name}（mode=${lock.mode}），执行同步/异步操作`);
            setTimeout(() => {
              this._addLog('lock', `[模拟] callback Promise resolve → 锁 '${lock.name}' 释放`);
              resolve();
            }, 100);
          });
        });
      } catch { /* noop */ }
      this.setState({ requestInfo:
        `模拟 navigator.locks.request('${name}', cb) 执行流程：\n\n` +
        '  1) 调用 request(name, callback) → 返回 Promise\n' +
        '  2) 浏览器获取锁后调用 callback({ name, mode }) —— 此处 callback 同步持有锁\n' +
        '  3) callback 内执行同步/异步操作（如 IDB 事务、网络请求）\n' +
        '  4) callback 返回的 Promise resolve → 浏览器释放锁\n' +
        '  5) request 返回的 Promise resolve → 链式 await 完成\n\n' +
        '并发语义：同名锁的多个请求排队执行（FIFO），callback 完成一个再唤醒下一个。' });
      return;
    }
    try {
      let captured = null;
      await navigator.locks.request(name, async (lock) => {
        captured = lock ? { name: lock.name, mode: lock.mode } : null;
        this._addLog('lock', `真实 request('${name}') → callback({ name:'${captured.name}', mode:'${captured.mode}' })`);
        await new Promise((r) => setTimeout(r, 100));
      });
      this.setState({ requestInfo:
        `真实 navigator.locks.request('${name}', cb)：\n` +
        `  callback 接收 Lock = ${JSON.stringify(captured)}\n` +
        '  callback 返回的 Promise resolve（await setTimeout 100ms）→ 锁释放\n' +
        '  request 返回的 Promise resolve → 完成\n\n' +
        '说明：锁名跨同源 tab/worker 全局唯一；callback 返回的 Promise resolve 后锁立即释放；callback 抛异常时锁也会自动释放。' });
    } catch (err) {
      this._addLog('warn', `真实 request 失败：${err.name} - ${err.message}`);
    }
  }

  _explainCallbackModel() {
    this.setState({ requestInfo:
      '===== callback 模型详解 =====\n\n' +
      '签名：navigator.locks.request(name, options?, callback) → Promise<T>\n' +
      '  callback: (lock: Lock | null, signal: AbortSignal) => Promise<T> | T\n\n' +
      '锁持有期：从 callback 被调用起，到 callback 返回的 Promise resolve/reject 为止。\n' +
      '  - callback 返回非 Promise：浏览器自动包装为 Promise.resolve(value)，锁立即释放\n' +
      '  - callback 返回 Promise：等 Promise settle 后释放锁\n' +
      '  - callback 抛异常：锁自动释放（不会泄漏），request Promise reject\n\n' +
      '同步 vs 异步：\n' +
      '  - 同步获取：callback 被调用时同步持有锁（无需 await 获取）\n' +
      '  - 异步操作：callback 内可 await 任意异步任务（IDB 事务、fetch 等）\n\n' +
      '锁名唯一性：\n' +
      '  - 同 origin 内：锁名全局唯一，跨 tab/worker 共享命名空间\n' +
      '  - 跨 origin：互不可见（origin 隔离）\n' +
      '  - 同名锁请求：默认 exclusive 模式下排队执行（FIFO）' });
    this._addLog('explain', '已展示 callback 模型（持有期 / 同步异步 / 锁名唯一性）');
  }

  _explainReleaseTiming() {
    this.setState({ requestInfo:
      '===== 锁释放时机 =====\n\n' +
      '1. callback 返回的 Promise resolve → 锁释放（最常见）\n' +
      '2. callback 返回的 Promise reject → 锁释放（request Promise reject）\n' +
      '3. callback 抛同步异常 → 锁释放（request Promise reject）\n' +
      '4. callback 返回非 Promise 值 → 锁立即释放（包装为 Promise.resolve）\n' +
      '5. AbortSignal aborted（被 steal / 系统抢占）→ 锁释放（callback 应停止工作）\n' +
      '6. 页面/worker 关闭 → 锁自动释放（浏览器清理）\n\n' +
      '注意：锁不能跨 callback 边界持有（无显式 unlock 函数）；如需长时间持有，使用持久锁模式（见 Card 5）。' });
    this._addLog('explain', '已展示锁释放时机（6 种情况）');
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. LockManager.request 基本用法',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.request ? 'success' : 'error' }, caps.request ? 'request ✓' : 'request ✗'),
        h(Tag, { color: 'primary' }, 'callback 模型'),
        h(Tag, { color: 'warning' }, 'FIFO 排队')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.locks.request(name, callback) 返回 Promise；callback 接收 Lock 对象 { name, mode }。callback 返回的 Promise resolve 后锁释放；锁名跨同源 tab/worker 全局唯一。同名锁请求默认 exclusive 模式排队（FIFO）执行。callback 抛异常时锁自动释放（不会泄漏）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showRequestCaps() }),
          this._btn('模拟请求锁', { size: 'sm', onClick: () => this._simulateRequest() }),
          this._btn('callback 模型', { size: 'sm', onClick: () => this._explainCallbackModel() }),
          this._btn('锁释放时机', { size: 'sm', onClick: () => this._explainReleaseTiming() })),
        h('div', { class: 'fs-sm text-secondary' }, 'request 状态 / 用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.requestInfo || '（点击「能力检测」或「模拟请求锁」）')),
        h(Alert, { type: 'info', message: 'Web Locks 提供跨 tab/worker 的命名锁', description: '无需 SharedWorker/BroadcastChannel，navigator.locks.request 让同源多个上下文互斥访问资源。callback 模型保证锁持有期与 Promise 生命周期绑定，不会泄漏。Chrome 69+，需 SecureContext。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：mode exclusive / shared ===================

  async _demoExclusiveQueue() {
    const caps = this._caps();
    const name = 'exclusive-demo-' + Date.now();
    if (!caps.request) {
      // 模拟：3 个 exclusive 请求应排队执行
      const order = [];
      const make = (id) => new Promise((resolve) => {
        setTimeout(() => {
          order.push(`req#${id} 获取锁`);
          this._addLog('lock', `[模拟] req#${id} 获取 exclusive 锁 '${name}'`);
          setTimeout(() => {
            order.push(`req#${id} 释放锁`);
            this._addLog('lock', `[模拟] req#${id} 释放锁 '${name}'`);
            resolve();
          }, 80);
        }, 0);
      });
      await Promise.all([make(1), make(2), make(3)]);
      this.setState({ modeInfo:
        `模拟 exclusive 排队（锁名 '${name}'，3 个请求）：\n  ${order.join('\n  ')}\n\n` +
        'exclusive 模式（默认）：同名锁同时仅 1 个持有者；后续请求排队等待，FIFO 顺序执行。' });
      return;
    }
    try {
      const order = [];
      const make = (id) => navigator.locks.request(name, async (lock) => {
        order.push(`req#${id} 获取锁 (mode=${lock.mode})`);
        this._addLog('lock', `真实 req#${id} 获取 exclusive 锁 '${name}'`);
        await new Promise((r) => setTimeout(r, 80));
        order.push(`req#${id} 释放锁`);
        this._addLog('lock', `真实 req#${id} 释放锁 '${name}'`);
      });
      await Promise.all([make(1), make(2), make(3)]);
      this.setState({ modeInfo:
        `真实 exclusive 排队（锁名 '${name}'，3 个请求）：\n  ${order.join('\n  ')}\n\n` +
        'exclusive 模式（默认）：同名锁同时仅 1 个持有者；后续请求排队等待，FIFO 顺序执行。' });
    } catch (err) {
      this._addLog('warn', `exclusive 演示失败：${err.name} - ${err.message}`);
    }
  }

  async _demoSharedCoexist() {
    const caps = this._caps();
    const name = 'shared-demo-' + Date.now();
    if (!caps.request) {
      // 模拟：3 个 shared 请求应同时持有
      const acquired = [];
      const make = (id) => new Promise((resolve) => {
        setTimeout(() => {
          acquired.push(`req#${id} (shared) 同时持有`);
          this._addLog('lock', `[模拟] req#${id} 同时持有 shared 锁 '${name}'`);
          setTimeout(() => {
            this._addLog('lock', `[模拟] req#${id} 释放 shared 锁 '${name}'`);
            resolve();
          }, 80);
        }, 0);
      });
      await Promise.all([make(1), make(2), make(3)]);
      this.setState({ modeInfo:
        `模拟 shared 共存（锁名 '${name}'，3 个请求）：\n  ${acquired.join('\n  ')}\n\n` +
        "shared 模式：navigator.locks.request(name, { mode: 'shared' }, cb)；多个 shared 可同时持有，但与 exclusive 互斥。" });
      return;
    }
    try {
      const acquired = [];
      const make = (id) => navigator.locks.request(name, { mode: 'shared' }, async (lock) => {
        acquired.push(`req#${id} 同时持有 (mode=${lock.mode})`);
        this._addLog('lock', `真实 req#${id} 同时持有 shared 锁 '${name}'`);
        await new Promise((r) => setTimeout(r, 80));
        this._addLog('lock', `真实 req#${id} 释放 shared 锁 '${name}'`);
      });
      await Promise.all([make(1), make(2), make(3)]);
      this.setState({ modeInfo:
        `真实 shared 共存（锁名 '${name}'，3 个请求）：\n  ${acquired.join('\n  ')}\n\n` +
        "shared 模式：navigator.locks.request(name, { mode: 'shared' }, cb)；多个 shared 可同时持有，但与 exclusive 互斥。" });
    } catch (err) {
      this._addLog('warn', `shared 演示失败：${err.name} - ${err.message}`);
    }
  }

  _showReadWriteMatrix() {
    this.setState({ modeInfo:
      '===== 读写锁矩阵（exclusive vs shared）=====\n\n' +
      '当前请求 \\ 已持有     | exclusive | shared\n' +
      '---------------------|-----------|--------\n' +
      'exclusive（写）       | 排队      | 排队\n' +
      'shared（读）          | 排队      | 同时持有\n\n' +
      '典型用法：\n' +
      "  写：navigator.locks.request('resource', { mode: 'exclusive' }, async (lock) => { /* 写入 */ });\n" +
      "  读：navigator.locks.request('resource', { mode: 'shared' }, async (lock) => { /* 读取 */ });\n\n" +
      '场景：多 tab 读多写少时，shared 让读并发；写时 exclusive 互斥保证一致性（读写互斥、写写互斥）。\n\n' +
      '公平性：规范未严格规定，但多数实现采用 FIFO + 模式兼容策略：\n' +
      '  - 队首请求若与当前持有者兼容 → 立即获取\n' +
      '  - 队首请求若不兼容 → 阻塞，后续请求即使兼容也排队（避免 exclusive 饥饿）' });
    this._addLog('matrix', '已展示读写锁矩阵（exclusive/shared 兼容性 + 公平性）');
  }

  _explainFairness() {
    this.setState({ modeInfo:
      '===== 公平性与饥饿避免 =====\n\n' +
      'Web Locks 规范未严格定义调度算法，但实现普遍遵循：\n\n' +
      '1. FIFO 基础顺序：同名锁请求按发起顺序排队\n' +
      '2. 模式兼容检查：队首请求与当前持有者兼容则获取\n' +
      '3. 阻塞传递：队首阻塞时，后续即使兼容也等待（避免写饥饿）\n\n' +
      '饥饿避免：\n' +
      '  - exclusive 饥饿：若持续有 shared 请求，写可能等待很久 → 队首阻塞传递机制保证写最终获取\n' +
      '  - shared 饥饿：若有 exclusive 等待，新 shared 排在写后面 → 写完成后才能批量获取\n\n' +
      '建议：\n' +
      '  - 读多写少用 shared 提升并发\n' +
      '  - 写操作尽快完成（短临界区）避免阻塞读\n' +
      '  - 不要在锁内做长耗时网络请求（用 query 监控排队深度）' });
    this._addLog('explain', '已展示公平性与饥饿避免策略');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. mode exclusive / shared',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.request ? 'success' : 'error' }, caps.request ? '可用 ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'exclusive / shared'),
        h(Tag, { color: 'warning' }, '读写锁')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "默认 exclusive（排他锁，同名同时仅 1 个持有者）；shared（共享锁，多个 shared 可共存，但与 exclusive 互斥）。用法：navigator.locks.request(name, { mode: 'shared' }, cb)。典型：shared 用于读（并发）、exclusive 用于写（互斥），类似读写锁。"),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 exclusive 排队', { type: 'primary', size: 'sm', onClick: () => this._demoExclusiveQueue() }),
          this._btn('演示 shared 共存', { size: 'sm', onClick: () => this._demoSharedCoexist() }),
          this._btn('读写锁矩阵', { size: 'sm', onClick: () => this._showReadWriteMatrix() }),
          this._btn('公平性说明', { size: 'sm', onClick: () => this._explainFairness() })),
        h('div', { class: 'fs-sm text-secondary' }, 'mode 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.modeInfo || '（点击「演示 exclusive 排队」或「演示 shared 共存」）')),
        h(Alert, { type: 'info', message: 'shared 提升读并发，exclusive 保证写一致性', description: '读写锁模式：多 tab 读多写少时，shared 让读并发执行；写时 exclusive 互斥保证数据一致。规范未严格定义公平性，但实现普遍采用 FIFO + 兼容检查 + 阻塞传递避免饥饿。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：ifAvailable 与 steal ===================

  async _demoIfAvailable() {
    const caps = this._caps();
    const name = 'ifavail-demo-' + Date.now();
    if (!caps.request) {
      // 模拟：第一次获取，第二次 ifAvailable 因被持有返回 null
      this._addLog('lock', `[模拟] request('${name}', { ifAvailable:true }, cb) 第一次 → cb(lock)`);
      this._addLog('lock', `[模拟] 第二次 ifAvailable → cb(null)（锁被持有，不排队）`);
      this.setState({ stealInfo:
        `模拟 ifAvailable（锁名 '${name}'）：\n\n` +
        '  request(name, { ifAvailable: true }, cb) 第一次：\n' +
        '    → 锁空闲，cb 接收 Lock 对象 { name, mode }\n' +
        '    → callback 完成后释放锁\n\n' +
        '  request(name, { ifAvailable: true }, cb) 第二次（锁被持有）：\n' +
        '    → 锁被占用，cb 接收 null（不排队，立即返回）\n' +
        '    → callback 应判断 lock === null 走降级逻辑\n\n' +
        '典型用法：跨 tab 任务去重（只有一个 tab 执行任务，其他跳过）。' });
      return;
    }
    try {
      const results = [];
      // 第一次：长持有
      const slow = navigator.locks.request(name, async (lock) => {
        results.push(`slow 获取锁: ${lock ? lock.name : 'null'}`);
        this._addLog('lock', `真实 ifAvailable 演示：slow 持有锁 '${name}'`);
        await new Promise((r) => setTimeout(r, 200));
      });
      // 第二次：ifAvailable 立即返回
      await new Promise((r) => setTimeout(r, 50));
      const fast = navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
        results.push(`fast ifAvailable: ${lock ? '获取' : 'null（已被持有，跳过）'}`);
        this._addLog('lock', `真实 ifAvailable：fast cb 接收 ${lock ? 'Lock' : 'null'}`);
      });
      await Promise.all([slow, fast]);
      this.setState({ stealInfo:
        `真实 ifAvailable（锁名 '${name}'）：\n  ${results.join('\n  ')}\n\n` +
        '说明：{ ifAvailable: true } 不排队，锁空闲则获取（cb 接收 Lock），锁被占用则 cb 接收 null 立即返回。' });
    } catch (err) {
      this._addLog('warn', `ifAvailable 演示失败：${err.name} - ${err.message}`);
    }
  }

  async _demoSteal() {
    const caps = this._caps();
    const name = 'steal-demo-' + Date.now();
    if (!caps.request) {
      this._addLog('lock', `[模拟] request('${name}', cb) → 持有者 A 收到 signal.aborted=true`);
      this._addLog('lock', `[模拟] request('${name}', { steal:true }, cb) → 抢占 A，B 获取锁`);
      this.setState({ stealInfo:
        `模拟 steal（锁名 '${name}'）：\n\n` +
        '  持有者 A：navigator.locks.request(name, async (lock, signal) => {\n' +
        '    // 长任务\n' +
        '    await longTask();\n' +
        '    // 若被抢占，signal.aborted === true，应停止工作\n' +
        '  });\n\n' +
        '  抢占者 B：navigator.locks.request(name, { steal: true }, async (lock) => {\n' +
        '    // B 立即获取锁，A 的 signal 被 abort\n' +
        '  });\n\n' +
        '说明：{ steal: true } 抢占当前持有者；被抢占者 callback 第二参数 AbortSignal 收到 aborted=true，应停止工作并让 callback Promise settle（释放锁给抢占者）。' });
      return;
    }
    try {
      const events = [];
      // A：长持有，监听 signal
      const a = navigator.locks.request(name, async (lock, signal) => {
        events.push(`A 获取锁 ${lock.name}，signal.aborted=${signal && signal.aborted}`);
        this._addLog('lock', `真实 steal：A 持有锁 '${name}'，监听 signal`);
        await new Promise((resolve) => {
          if (signal && signal.aborted) return resolve();
          if (signal && typeof signal.addEventListener === 'function') {
            signal.addEventListener('abort', () => {
              events.push(`A 收到 signal.aborted=true（被抢占）`);
              this._addLog('lock', `真实 steal：A 收到 AbortSignal aborted`);
              resolve();
            });
          }
          setTimeout(resolve, 500); // 兜底
        });
      });
      // B：steal 抢占
      await new Promise((r) => setTimeout(r, 50));
      const b = navigator.locks.request(name, { steal: true }, async (lock) => {
        events.push(`B steal 获取锁 ${lock.name}`);
        this._addLog('lock', `真实 steal：B 抢占并获取锁 '${name}'`);
      });
      await Promise.all([a, b]);
      this.setState({ stealInfo:
        `真实 steal（锁名 '${name}'）：\n  ${events.join('\n  ')}\n\n` +
        '说明：{ steal: true } 抢占当前持有者；被抢占者 callback 第二参数 AbortSignal 收到 aborted=true，应停止工作并让 callback Promise settle（释放锁给抢占者）。' });
    } catch (err) {
      this._addLog('warn', `steal 演示失败：${err.name} - ${err.message}`);
    }
  }

  _explainAbortSignal() {
    this.setState({ stealInfo:
      '===== AbortSignal 详解 =====\n\n' +
      'callback 第二参数：navigator.locks.request(name, (lock, signal) => { ... })\n' +
      '  signal: AbortSignal —— 表示锁是否被抢占\n\n' +
      '触发 aborted 的场景：\n' +
      '  1. 其他请求用 { steal: true } 抢占当前锁\n' +
      '  2. 浏览器内部需要回收（罕见，如资源压力）\n\n' +
      '使用模式：\n' +
      '  await navigator.locks.request(name, async (lock, signal) => {\n' +
      '    if (signal.aborted) return;  // 已被抢占，立即退出\n' +
      '    // 长任务：监听 abort 事件及时停止\n' +
      '    await new Promise((resolve) => {\n' +
      '      const timer = setInterval(work, 100);\n' +
      '      signal.addEventListener("abort", () => { clearInterval(timer); resolve(); });\n' +
      '    });\n' +
      '  });\n\n' +
      '注意：被抢占后 callback 必须让 Promise settle（resolve 或 reject），否则锁不会真正释放给抢占者。' });
    this._addLog('explain', '已展示 AbortSignal 用法（监听 abort 事件及时停止工作）');
  }

  _explainStealSemantics() {
    this.setState({ stealInfo:
      '===== 抢占语义 =====\n\n' +
      'steal 与 ifAvailable 互补：\n' +
      '  - ifAvailable: true —— 不排队，锁空闲则获取，占用则 cb(null) 立即返回（非阻塞尝试）\n' +
      '  - steal: true —— 抢占当前持有者，被抢占者收到 AbortSignal（强制抢占）\n\n' +
      '不能同时使用：options 中 ifAvailable 和 steal 互斥，同时设置会抛 TypeError。\n\n' +
      'steal 适用场景：\n' +
      '  - 高优先级任务需立即执行（如用户主动操作）\n' +
      '  - 持有者长时间无响应（需强制回收）\n' +
      '  - 紧急清理任务（如登出时清理资源）\n\n' +
      'steal 风险：\n' +
      '  - 被抢占者可能处于中间状态（数据不一致）\n' +
      '  - 应在 callback 内监听 signal，及时回滚或保存中间状态\n' +
      '  - 不要在锁内做不可中断的长任务（如大文件写入）' });
    this._addLog('explain', '已展示 steal 语义（与 ifAvailable 互斥、适用场景、风险）');
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. ifAvailable 与 steal',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.request ? 'success' : 'error' }, caps.request ? '可用 ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'ifAvailable / steal'),
        h(Tag, { color: 'warning' }, 'AbortSignal')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '{ ifAvailable: true } 立即获取或失败：锁空闲则 callback 接收 Lock，被占用则接收 null（不排队，立即返回）。{ steal: true } 抢占当前持有者：被抢占者 callback 第二参数 AbortSignal 收到 aborted=true。两者互斥（同时设置抛 TypeError）。典型：ifAvailable 用于跨 tab 任务去重，steal 用于高优先级抢占。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 ifAvailable', { type: 'primary', size: 'sm', onClick: () => this._demoIfAvailable() }),
          this._btn('演示 steal', { danger: true, size: 'sm', onClick: () => this._demoSteal() }),
          this._btn('AbortSignal 说明', { size: 'sm', onClick: () => this._explainAbortSignal() }),
          this._btn('抢占语义', { size: 'sm', onClick: () => this._explainStealSemantics() })),
        h('div', { class: 'fs-sm text-secondary' }, 'ifAvailable / steal 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.stealInfo || '（点击「演示 ifAvailable」或「演示 steal」）')),
        h(Alert, { type: 'warning', message: 'ifAvailable 与 steal 互斥，不可同时使用', description: 'ifAvailable 是非阻塞尝试（不排队），steal 是强制抢占（中断当前持有者）。被抢占者通过 AbortSignal 感知，应停止工作并让 Promise settle 释放锁。callback 必须正确处理 signal，否则锁无法传递给抢占者。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：query 状态查询 ===================

  async _simulateQuery() {
    const caps = this._caps();
    if (!caps.query) {
      // 模拟：构造 held + pending 结构
      const held = [
        { name: 'db-write-lock', clientId: this._simNextClientId(), mode: 'exclusive' },
        { name: 'read-cache', clientId: this._simNextClientId(), mode: 'shared' },
        { name: 'read-cache', clientId: this._simNextClientId(), mode: 'shared' },
      ];
      const pending = [
        { name: 'db-write-lock', clientId: this._simNextClientId(), mode: 'exclusive' },
        { name: 'read-cache', clientId: this._simNextClientId(), mode: 'exclusive' },
      ];
      this._addLog('query', `[模拟] query() → held=${held.length}, pending=${pending.length}`);
      this.setState({ queryInfo:
        `模拟 navigator.locks.query() →\n{\n  held: [\n${held.map((h) => `    { name:'${h.name}', clientId:'${h.clientId}', mode:'${h.mode}' }`).join(',\n')}\n  ],\n  pending: [\n${pending.map((p) => `    { name:'${p.name}', clientId:'${p.clientId}', mode:'${p.mode}' }`).join(',\n')}\n  ]\n}\n\n` +
        '说明：query() 返回当前 origin 内所有锁的快照（held + pending）。held 是当前持有的锁，pending 是排队等待的锁。' });
      return;
    }
    try {
      const snapshot = await navigator.locks.query();
      const held = (snapshot.held || []).map((h) => `    { name:'${h.name}', clientId:'${h.clientId}', mode:'${h.mode}' }`);
      const pending = (snapshot.pending || []).map((p) => `    { name:'${p.name}', clientId:'${p.clientId}', mode:'${p.mode}' }`);
      this._addLog('query', `真实 query() → held=${(snapshot.held || []).length}, pending=${(snapshot.pending || []).length}`);
      this.setState({ queryInfo:
        `真实 navigator.locks.query() →\n{\n  held: [\n${held.join(',\n') || '    (空)'}\n  ],\n  pending: [\n${pending.join(',\n') || '    (空)'}\n  ]\n}\n\n` +
        '说明：query() 返回当前 origin 内所有锁的快照（held + pending）。held 是当前持有的锁，pending 是排队等待的锁。' });
    } catch (err) {
      this._addLog('warn', `query 失败：${err.name} - ${err.message}`);
    }
  }

  _showHeldStructure() {
    this.setState({ queryInfo:
      '===== held 结构详解 =====\n\n' +
      'navigator.locks.query() → Promise<{ held, pending }>\n' +
      '  held: LockInfo[] —— 当前持有的锁\n\n' +
      'LockInfo 结构：\n' +
      '  {\n' +
      '    name: string,        // 锁名（同 request 第一参数）\n' +
      '    mode: "exclusive"|"shared",  // 模式\n' +
      '    clientId: string     // 持有者标识（tab/worker 的唯一 ID）\n' +
      '  }\n\n' +
      'held 特性：\n' +
      '  - exclusive 锁：held 中同名仅 1 项\n' +
      '  - shared 锁：held 中同名可多项（多个持有者）\n' +
      '  - clientId 区分不同 tab/worker，但不暴露具体页面 URL\n\n' +
      '用途：调试锁争用（哪个 tab 持有锁）、监控并发度（shared 持有者数量）。' });
    this._addLog('explain', '已展示 held 结构（LockInfo 字段 + clientId 含义）');
  }

  _showPendingStructure() {
    this.setState({ queryInfo:
      '===== pending 结构详解 =====\n\n' +
      'navigator.locks.query() → Promise<{ held, pending }>\n' +
      '  pending: LockInfo[] —— 排队等待的锁请求\n\n' +
      'pending 特性：\n' +
      '  - 同名锁可能有多个 pending 项（多个请求排队）\n' +
      '  - pending 顺序反映 FIFO 排队顺序（队首优先获取）\n' +
      '  - mode 字段提示等待模式（exclusive/shared）\n\n' +
      '用途：\n' +
      '  - 监控排队深度：pending 长度反映锁争用程度\n' +
      '  - 决策是否 steal：若 pending 过多，可考虑 steal 抢占\n' +
      '  - 调试死锁：若 held + pending 长期不变，可能存在死锁（虽然 Web Locks 设计上无死锁）\n\n' +
      '注意：query() 返回的是快照（非实时），两次 query 间状态可能变化。' });
    this._addLog('explain', '已展示 pending 结构（排队顺序 + 监控用途）');
  }

  _explainClientIdPrivacy() {
    this.setState({ queryInfo:
      '===== clientId 隐私说明 =====\n\n' +
      'clientId 是什么：\n' +
      '  - 浏览器为每个 tab/worker 分配的唯一标识符（字符串）\n' +
      '  - 同一 tab 内多次 request 共享同一 clientId\n' +
      '  - 不同 tab/worker 的 clientId 不同\n\n' +
      '隐私保护：\n' +
      '  - clientId 不暴露具体页面 URL、标题、内容\n' +
      '  - 无法通过 clientId 反查用户访问的页面\n' +
      '  - 仅用于区分「这是不同的持有者」，便于调试\n\n' +
      '使用场景：\n' +
      '  - 调试：query().held[].clientId 与自身对比，判断是否是自己持有\n' +
      '  - 监控：统计不同 clientId 数量，了解跨 tab 并发情况\n' +
      '  - 决策：若 held 中 clientId 与自己相同，说明自己已持有（避免重入）\n\n' +
      '限制：clientId 无法跨 origin 追踪（每个 origin 独立命名空间）。' });
    this._addLog('explain', '已展示 clientId 隐私（不暴露页面信息，仅区分持有者）');
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. query 状态查询',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.query ? 'success' : 'error' }, caps.query ? 'query ✓' : 'query ✗'),
        h(Tag, { color: 'primary' }, 'held / pending'),
        h(Tag, { color: 'warning' }, 'clientId')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.locks.query() 返回 Promise<{ held, pending }>：held 是当前持有的锁数组，pending 是排队等待的锁数组。每项含 { name, clientId, mode }。clientId 区分 tab/worker（不暴露具体页面）。用途：调试锁争用、监控排队深度、决策是否 steal。返回快照（非实时订阅）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('模拟 query', { type: 'primary', size: 'sm', onClick: () => this._simulateQuery() }),
          this._btn('held 结构', { size: 'sm', onClick: () => this._showHeldStructure() }),
          this._btn('pending 结构', { size: 'sm', onClick: () => this._showPendingStructure() }),
          this._btn('clientId 隐私', { size: 'sm', onClick: () => this._explainClientIdPrivacy() })),
        h('div', { class: 'fs-sm text-secondary' }, 'query 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.queryInfo || '（点击「模拟 query」或「held 结构」）')),
        h(Alert, { type: 'info', message: 'query() 提供锁状态快照，便于调试与监控', description: 'held/pending 数组反映当前 origin 内锁的持有与等待情况。clientId 区分持有者但不暴露页面信息（隐私保护）。query 是快照而非实时订阅，需轮询监控动态变化。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Lock 对象与 onrelease ===================

  async _demoLockObject() {
    const caps = this._caps();
    const name = 'lock-obj-demo-' + Date.now();
    if (!caps.request) {
      this._addLog('lock', `[模拟] request('${name}', cb) → cb({ name:'${name}', mode:'exclusive' })`);
      this.setState({ lockObjInfo:
        `模拟 Lock 对象（锁名 '${name}'）：\n\n` +
        '  await navigator.locks.request(name, async (lock) => {\n' +
        '    console.log(lock.name);  // "' + name + '"\n' +
        '    console.log(lock.mode);  // "exclusive"\n' +
        '    // lock 是只读对象，无 unlock 方法\n' +
        '    // 锁在 callback Promise settle 后自动释放\n' +
        '  });\n\n' +
        'Lock 对象属性：\n' +
        '  name: string —— 锁名（与 request 第一参数一致）\n' +
        '  mode: "exclusive"|"shared" —— 锁模式\n\n' +
        '注意：Lock 对象无 unlock() 方法，不能跨 callback 边界持有（callback 返回后锁释放）。' });
      return;
    }
    try {
      let captured = null;
      await navigator.locks.request(name, async (lock) => {
        captured = lock ? { name: lock.name, mode: lock.mode, keys: Object.keys(lock) } : null;
        this._addLog('lock', `真实 Lock 对象：name=${lock.name}, mode=${lock.mode}`);
      });
      this.setState({ lockObjInfo:
        `真实 Lock 对象（锁名 '${name}'）：\n` +
        `  lock.name = "${captured.name}"\n` +
        `  lock.mode = "${captured.mode}"\n` +
        `  Object.keys(lock) = [${captured.keys.join(', ')}]\n\n` +
        '说明：Lock 对象仅含 name 和 mode 两个只读属性，无 unlock() 方法。锁在 callback Promise settle 后自动释放，不能跨 callback 边界持有。' });
    } catch (err) {
      this._addLog('warn', `Lock 对象演示失败：${err.name} - ${err.message}`);
    }
  }

  _explainOnRelease() {
    this.setState({ lockObjInfo:
      '===== onrelease 说明 =====\n\n' +
      '规范历史：早期 Web Locks 规范有 lock.onrelease 事件（锁释放时触发），但已从标准移除。\n\n' +
      '当前替代方案：\n' +
      '  - 在 callback 内自行管理释放逻辑（finally 块）\n' +
      '  - 使用 AbortSignal 监听被抢占事件\n\n' +
      '示例：\n' +
      '  await navigator.locks.request(name, async (lock, signal) => {\n' +
      '    try {\n' +
      '      await doWork();\n' +
      '    } finally {\n' +
      '      // 锁即将释放，执行清理\n' +
      '      cleanup();\n' +
      '    }\n' +
      '  });\n\n' +
      '注意：onrelease 在部分旧版浏览器（如旧 Chrome）可能仍存在但已废弃，不应依赖。生产代码用 finally + AbortSignal 替代。' });
    this._addLog('explain', '已展示 onrelease（已废弃，用 finally + AbortSignal 替代）');
  }

  _explainPersistentLock() {
    this.setState({ lockObjInfo:
      '===== 持久锁模式 =====\n\n' +
      '场景：需要长时间持有锁（如长任务、监听器、轮询协调）。\n\n' +
      '模式：callback 内保持 await 一个未 resolve 的 Promise，锁即持续持有。\n\n' +
      '示例：\n' +
      '  await navigator.locks.request(name, async (lock, signal) => {\n' +
      '    return new Promise((resolve) => {\n' +
      '      // 监听 abort（被 steal / 页面关闭）\n' +
      '      signal.addEventListener("abort", resolve);\n' +
      '      // 或等待某个外部条件\n' +
      '      someConditionReady.then(resolve);\n' +
      '    });\n' +
      '  });\n\n' +
      '风险：\n' +
      '  - 持有期过长可能阻塞其他请求（exclusive 模式）\n' +
      '  - 页面崩溃时锁可能延迟释放（浏览器最终会清理）\n' +
      '  - 应监听 signal，及时响应抢占\n\n' +
      '用例：\n' +
      '  - 跨 tab 任务去重：一个 tab 持有锁执行任务，其他 tab ifAvailable 跳过\n' +
      '  - 资源池管理：锁名表示槽位，持有锁即占用槽位' });
    this._addLog('explain', '已展示持久锁模式（await pending Promise 长期持有）');
  }

  _explainPageUnload() {
    this.setState({ lockObjInfo:
      '===== 页面卸载释放 =====\n\n' +
      '浏览器保证：页面/worker 关闭时，其持有的所有锁自动释放。\n\n' +
      '机制：\n' +
      '  - 浏览器维护 clientId → 锁的映射\n' +
      '  - tab/worker 关闭时，浏览器清理其持有的锁\n' +
      '  - 排队中的 pending 请求会被唤醒获取锁\n\n' +
      '注意事项：\n' +
      '  - 不要依赖 beforeunload 手动释放（不可靠，且无法保证执行）\n' +
      '  - 持久锁在页面崩溃时也可能延迟释放（浏览器心跳检测后清理）\n' +
      '  - ServiceWorker 中：SW 终止时锁释放；SW 重启后需重新 request\n\n' +
      '最佳实践：\n' +
      '  - callback 内做幂等操作（即使中断重试也安全）\n' +
      '  - 长任务分阶段提交（避免中断丢失全部进度）\n' +
      '  - 用 AbortSignal 监听中断，及时保存状态' });
    this._addLog('explain', '已展示页面卸载释放（浏览器自动清理 + 最佳实践）');
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Lock 对象与 onrelease',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.lockMode ? 'success' : 'error' }, caps.lockMode ? 'Lock ✓' : 'Lock ✗'),
        h(Tag, { color: 'primary' }, 'name / mode'),
        h(Tag, { color: 'warning' }, '持久锁')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Lock 对象含 { name, mode } 两个只读属性，无 unlock() 方法（锁不能跨 callback 边界持有）。锁释放触发 onrelease（早期规范，已废弃，现用 finally + AbortSignal 替代）。持久锁模式：callback 内保持 await pending Promise 实现长期持有（长任务、监听器）。页面关闭时浏览器自动释放锁。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 Lock 对象', { type: 'primary', size: 'sm', onClick: () => this._demoLockObject() }),
          this._btn('onrelease 说明', { size: 'sm', onClick: () => this._explainOnRelease() }),
          this._btn('持久锁模式', { size: 'sm', onClick: () => this._explainPersistentLock() }),
          this._btn('页面卸载释放', { size: 'sm', onClick: () => this._explainPageUnload() })),
        h('div', { class: 'fs-sm text-secondary' }, 'Lock 对象状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.lockObjInfo || '（点击「演示 Lock 对象」或「onrelease 说明」）')),
        h(Alert, { type: 'info', message: 'Lock 对象无 unlock，锁随 callback Promise 生命周期释放', description: 'Lock 仅含 name/mode，不能跨 callback 边界持有。持久锁通过 await pending Promise 实现长期持有。onrelease 已从规范移除，用 finally + AbortSignal 替代。页面关闭时浏览器自动清理锁。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：使用场景与组合 ===================

  _showScenarios() {
    const scenarios = [
      {
        name: 'IndexedDB 写入串行化',
        code: "await navigator.locks.request('db-write', async () => { await tx.commit(); });",
        reason: '避免多 tab 并发写同一记录导致读写竞态（read-modify-write 非原子）',
      },
      {
        name: '跨 tab 任务去重',
        code: "navigator.locks.request('poll-task', { ifAvailable: true }, async (lock) => { if (!lock) return; await poll(); });",
        reason: 'ifAvailable 防重入：只有一个 tab 执行任务，其他 tab 跳过',
      },
      {
        name: '轮询任务协调',
        code: "navigator.locks.request('poll', { mode:'shared' }, async () => { /* read */ }); query() 监控并发度",
        reason: 'shared 锁允许多 tab 并发读，query 监控活跃 tab 数',
      },
      {
        name: '资源池管理',
        code: "await navigator.locks.request('slot-1', async () => { /* 使用槽位 1 */ });",
        reason: '命名锁表示槽位（slot-1/2/3），持有锁即占用槽位，释放后其他 tab 可获取',
      },
    ];
    const lines = scenarios.map((sc, i) => `场景 ${i + 1}：${sc.name}\n  代码：${sc.code}\n  原因：${sc.reason}`);
    this.setState({ scenarioInfo:
      '===== 4 场景示例 =====\n\n' + lines.join('\n\n') +
      '\n\n关键点：\n  - 写串行化用 exclusive（默认）\n  - 任务去重用 ifAvailable\n  - 读并发用 shared + query 监控\n  - 资源池用命名锁（slot-N）' });
    this._addLog('scenario', `已展示 4 场景示例：${scenarios.map((sc) => sc.name).join(' / ')}`);
  }

  _compareWithBroadcastChannel() {
    this.setState({ scenarioInfo:
      '===== Web Locks vs BroadcastChannel 对比 =====\n\n' +
      '维度       | Web Locks                | BroadcastChannel\n' +
      '-----------|--------------------------|------------------------------\n' +
      '核心能力    | 互斥协调（锁）           | 广播消息（发布订阅）\n' +
      '状态       | 无状态（仅锁名）         | 无状态（仅消息）\n' +
      '同步语义    | 互斥（同时仅 1 个持有）  | 异步广播（所有监听者收到）\n' +
      '排队       | FIFO 排队               | 无排队（消息丢失若无监听者）\n' +
      '跨 tab     | ✓                        | ✓\n' +
      '跨 worker  | ✓                        | ✓\n' +
      '用例       | 写入串行化、任务去重     | 状态同步、消息通知\n\n' +
      '互补关系：\n' +
      '  - Web Locks：需要互斥访问资源时（避免并发冲突）\n' +
      '  - BroadcastChannel：需要广播状态/消息时（多 tab 同步 UI）\n' +
      '  - 组合：用 WL 串行化写操作，用 BC 通知其他 tab 刷新缓存' });
    this._addLog('compare', '已展示 Web Locks vs BroadcastChannel 对比');
  }

  _compareWithSharedWorker() {
    this.setState({ scenarioInfo:
      '===== Web Locks vs SharedWorker 对比 =====\n\n' +
      '维度       | Web Locks                | SharedWorker\n' +
      '-----------|--------------------------|------------------------------\n' +
      '核心能力    | 互斥协调（锁）           | 共享 Worker（状态管理）\n' +
      '状态       | 无状态                    | 有状态（持久变量、连接）\n' +
      '复杂度     | 低（API 简单）            | 高（需编写 SW 脚本、端口管理）\n' +
      '生命周期    | 随 tab/worker            | 独立（所有 tab 关闭后终止）\n' +
      '跨 tab     | ✓（同源）                | ✓（同源）\n' +
      '用例       | 简单互斥、任务去重        | 复杂状态共享、长连接管理\n\n' +
      '选择建议：\n' +
      '  - 只需互斥：用 Web Locks（无需额外脚本，API 简洁）\n' +
      '  - 需共享状态/长连接：用 SharedWorker（如 WebSocket 复用）\n' +
      '  - 组合：SW 内用 Web Locks 协调多 tab 请求' });
    this._addLog('compare', '已展示 Web Locks vs SharedWorker 对比');
  }

  _showLimitsAndBestPractices() {
    this.setState({ scenarioInfo:
      '===== 限制与最佳实践 =====\n\n' +
      '限制：\n' +
      '  1. 同源才可用：不同 origin 的锁互不可见（origin 隔离）\n' +
      '  2. SecureContext：需 HTTPS 或 localhost（防止中间人攻击）\n' +
      '  3. Promise 必须正确 resolve：callback 返回的 Promise 若永远 pending，锁会泄漏（直到页面关闭）\n' +
      '  4. callback 抛异常：锁自动释放（不会泄漏），但 request Promise reject\n' +
      '  5. 无显式 unlock：锁不能跨 callback 边界持有（持久锁除外）\n\n' +
      '最佳实践：\n' +
      '  - 临界区尽量短：避免在锁内做长耗时网络请求\n' +
      '  - 监听 AbortSignal：被 steal 时及时停止工作\n' +
      '  - 幂等操作：callback 内操作应幂等（中断重试安全）\n' +
      '  - 分阶段提交：长任务分阶段保存进度\n' +
      '  - 避免死锁：Web Locks 设计上无死锁（无显式 unlock，不会循环等待）\n' +
      '  - 用 query() 调试：监控锁争用情况\n' +
      '  - 合理命名：锁名应反映资源（如 "db-write:user-table"）' });
    this._addLog('best', '已展示限制与最佳实践（同源/SecureContext/Promise 正确 resolve）');
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 使用场景与组合',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.locks ? 'success' : 'error' }, caps.locks ? 'WL ✓' : 'WL ✗'),
        h(Tag, { color: 'primary' }, '4 场景'),
        h(Tag, { color: 'warning' }, 'vs BC/SW/Atomics')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '场景：IndexedDB 写入串行化（避免读写竞态）、跨 tab 任务去重（ifAvailable 防重入）、轮询任务协调（shared + query）、资源池管理（命名锁表示槽位）。与 BroadcastChannel 对比（广播消息 vs 互斥协调）、与 SharedWorker 对比（状态管理 vs 无状态锁）、与 Atomics 对比（共享内存 vs 命名锁）。限制：同源 + SecureContext + Promise 正确 resolve + 异常自动释放。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('4 场景示例', { type: 'primary', size: 'sm', onClick: () => this._showScenarios() }),
          this._btn('WL vs BC 对比', { size: 'sm', onClick: () => this._compareWithBroadcastChannel() }),
          this._btn('WL vs SW 对比', { size: 'sm', onClick: () => this._compareWithSharedWorker() }),
          this._btn('限制与最佳实践', { size: 'sm', onClick: () => this._showLimitsAndBestPractices() })),
        h('div', { class: 'fs-sm text-secondary' }, '场景与组合：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.scenarioInfo || '（点击「4 场景示例」或「WL vs BC 对比」）')),
        h(Alert, { type: 'warning', message: 'Web Locks 是无状态互斥协调，不可替代状态管理', description: 'WL 适合简单互斥（写入串行化、任务去重），不适合复杂状态共享（用 SharedWorker）或消息广播（用 BroadcastChannel）。组合使用：WL 互斥 + BC 通知 + SW 状态。限制：同源 + SecureContext + Promise 正确 resolve。' }),
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
    return h('div', { class: 'api-lab-page web-locks-api-page' },
      h('h2', { class: 'section-title' }, 'Web Locks API 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页深入演示 Web Locks API（navigator.locks）：request 基本用法（callback 模型 + 锁释放时机）、mode exclusive/shared（读写锁矩阵）、ifAvailable/steal（非阻塞尝试 + 强制抢占 + AbortSignal）、query 状态查询（held/pending + clientId）、Lock 对象与 onrelease（持久锁模式 + 页面卸载释放）、使用场景与组合（vs BroadcastChannel/SharedWorker/Atomics + 限制与最佳实践）。'),
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
